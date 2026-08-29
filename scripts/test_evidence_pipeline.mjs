#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scripts = name => path.join(root, 'scripts', name);
const fixture = name => path.join(root, 'evals', 'fixtures', name);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'quali-pipeline-test-'));

function run(script, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [scripts(script), ...args], { encoding: 'utf8' });
  if (result.status !== expectedStatus) throw new Error(`${script} returned ${result.status}; expected ${expectedStatus}\n${result.stdout}\n${result.stderr}`);
  return result;
}

try {
  run('validate_evidence.mjs', [fixture('evidence-index.json'), fixture('claim-ledger.json')]);
  const broken = JSON.parse(fs.readFileSync(fixture('claim-ledger.json'), 'utf8'));
  broken.claims[0].support_ids[0] = 'missing:source';
  const brokenPath = path.join(temp, 'broken-claims.json');
  fs.writeFileSync(brokenPath, JSON.stringify(broken));
  run('validate_evidence.mjs', [fixture('evidence-index.json'), brokenPath], 1);
  const badConfidence = JSON.parse(fs.readFileSync(fixture('claim-ledger.json'), 'utf8'));
  badConfidence.claims[0].confidence = '中高';
  const badConfidencePath = path.join(temp, 'bad-confidence.json');
  fs.writeFileSync(badConfidencePath, JSON.stringify(badConfidence));
  run('validate_evidence.mjs', [fixture('evidence-index.json'), badConfidencePath], 1);

  const preparedDir = path.join(temp, 'prepared');
  run('prepare_corpus.mjs', [fixture('corpus-config.json'), preparedDir]);
  const prepared = fs.readFileSync(path.join(preparedDir, 'normalized-corpus.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  if (prepared.length !== 3 || prepared[0].source_id !== 'consumer-comments:c-01') throw new Error('prepare_corpus did not preserve stable logical IDs');

  const runDir = path.join(temp, 'run');
  fs.mkdirSync(runDir);
  fs.copyFileSync(fixture('evidence-index.json'), path.join(runDir, 'evidence-index.json'));
  fs.copyFileSync(fixture('claim-ledger.json'), path.join(runDir, 'claim-ledger.json'));
  fs.copyFileSync(fixture('metrics-ledger.json'), path.join(runDir, 'metrics-ledger.json'));
  fs.copyFileSync(path.join(preparedDir, 'normalized-corpus.jsonl'), path.join(runDir, 'normalized-corpus.jsonl'));
  fs.writeFileSync(path.join(runDir, 'report.md'), '# Report\n\n作者回复 2/5；成员回复 1/5；一次性互动 2/5。\n');
  run('render_report.mjs', [fixture('report-data.json'), path.join(runDir, 'report.html')]);
  run('validate_run.mjs', [runDir]);

  const goodEvidence = JSON.parse(fs.readFileSync(path.join(runDir, 'evidence-index.json'), 'utf8'));
  const badSource = structuredClone(goodEvidence);
  badSource.entries[0].source_id = 'invented:source';
  fs.writeFileSync(path.join(runDir, 'evidence-index.json'), JSON.stringify(badSource));
  run('validate_run.mjs', [runDir], 1);

  const badLocator = structuredClone(goodEvidence);
  badLocator.entries[0].locator = 'wrong-locator';
  fs.writeFileSync(path.join(runDir, 'evidence-index.json'), JSON.stringify(badLocator));
  run('validate_run.mjs', [runDir], 1);

  const paraphrased = structuredClone(goodEvidence);
  paraphrased.entries[0].text = '用户既追求轻量，又要求完全不损失稳定性。';
  fs.writeFileSync(path.join(runDir, 'evidence-index.json'), JSON.stringify(paraphrased));
  run('validate_run.mjs', [runDir], 1);

  fs.writeFileSync(path.join(runDir, 'evidence-index.json'), JSON.stringify(goodEvidence));

  const badMetrics = JSON.parse(fs.readFileSync(path.join(runDir, 'metrics-ledger.json'), 'utf8'));
  badMetrics.metrics[2].numerator = 3;
  fs.writeFileSync(path.join(runDir, 'metrics-ledger.json'), JSON.stringify(badMetrics));
  const metricFailure = run('validate_run.mjs', [runDir], 1);
  if (!metricFailure.stderr.includes('partition interaction-type')) throw new Error('metric partition inconsistency was not diagnosed');
  console.log('PASS QualiBox pipeline (prepare, corpus traceability, evidence, render, unified validation, metric rejection)');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
