#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readJson, validateEvidenceAndClaims, validateEvidenceAgainstCorpus, validateMetrics, hasPlaceholders } from './validation-core.mjs';

const runDir = process.argv[2];
if (!runDir) {
  console.error('Usage: node validate_run.mjs RUN_DIRECTORY');
  process.exit(2);
}

function firstExisting(candidates) {
  return candidates.find(candidate => fs.existsSync(candidate));
}

const evidencePath = firstExisting([
  path.join(runDir, 'evidence-index.json'),
  path.join(runDir, 'work', '04_audit', 'evidence-index.json')
]);
const claimsPath = firstExisting([
  path.join(runDir, 'claim-ledger.json'),
  path.join(runDir, 'work', '04_audit', 'claim-ledger.json')
]);
const metricsPath = firstExisting([
  path.join(runDir, 'metrics-ledger.json'),
  path.join(runDir, 'work', '04_audit', 'metrics-ledger.json')
]);
const corpusPath = firstExisting([
  path.join(runDir, 'normalized-corpus.jsonl'),
  path.join(runDir, 'work', '01_design', 'normalized-corpus.jsonl')
]);
const reportMdPath = path.join(runDir, 'report.md');
const reportHtmlPath = path.join(runDir, 'report.html');
const failures = [];
const warnings = [];

if (!evidencePath) failures.push('missing evidence-index.json');
if (!claimsPath) failures.push('missing claim-ledger.json');
if (!corpusPath) failures.push('missing normalized-corpus.jsonl');
let evidenceCount = 0;
let claimCount = 0;
if (evidencePath && claimsPath) {
  const evidence = readJson(evidencePath);
  const result = validateEvidenceAndClaims(evidence, readJson(claimsPath));
  failures.push(...result.failures);
  warnings.push(...result.warnings);
  evidenceCount = result.entries.length;
  claimCount = result.claims.length;
  if (corpusPath) {
    try {
      const corpus = fs.readFileSync(corpusPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
        try { return JSON.parse(line); }
        catch (error) { throw new Error(`normalized-corpus.jsonl line ${index + 1}: ${error.message}`); }
      });
      failures.push(...validateEvidenceAgainstCorpus(evidence, corpus).failures);
    } catch (error) {
      failures.push(error.message);
    }
  }
}

let metrics = [];
if (metricsPath) {
  const result = validateMetrics(readJson(metricsPath));
  failures.push(...result.failures);
  warnings.push(...result.warnings);
  metrics = result.metrics;
}

for (const [label, filePath] of [['report.md', reportMdPath], ['report.html', reportHtmlPath]]) {
  if (!fs.existsSync(filePath)) failures.push(`missing ${label}`);
  else if (hasPlaceholders(fs.readFileSync(filePath, 'utf8'))) failures.push(`${label} contains unresolved placeholders`);
}

if (metrics.length && fs.existsSync(reportMdPath) && fs.existsSync(reportHtmlPath)) {
  const markdown = fs.readFileSync(reportMdPath, 'utf8');
  const html = fs.readFileSync(reportHtmlPath, 'utf8');
  for (const metric of metrics) for (const token of metric.report_tokens ?? []) {
    if (!markdown.includes(token)) failures.push(`report.md missing metric token ${metric.metric_id}: ${token}`);
    if (!html.includes(token)) failures.push(`report.html missing metric token ${metric.metric_id}: ${token}`);
  }
}

if (fs.existsSync(reportHtmlPath)) {
  const html = fs.readFileSync(reportHtmlPath, 'utf8');
  for (const required of ['id="answer"', 'id="data"', '阿祖不看 TVC', '@media print', 'nav-toggle']) {
    if (!html.includes(required)) failures.push(`report.html missing required marker ${required}`);
  }
  if (/<(?:script|link)[^>]+(?:src|href)=["']https?:\/\//i.test(html)) failures.push('report.html contains an external script or stylesheet dependency');
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`PASS QualiBox run (${evidenceCount} evidence units, ${claimCount} claims${metricsPath ? ', metrics checked' : ''})`);
console.log('Mechanical validation passed. Semantic interpretation and one final visual review remain human/model responsibilities.');
