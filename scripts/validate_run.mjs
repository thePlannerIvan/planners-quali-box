#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { moduleScript } from './lib/planners-modules.mjs';
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
const sourceIndexPath = firstExisting([
  path.join(runDir, 'source-index.json'),
  path.join(runDir, 'work', '01_design', 'source-index.json')
]);
const reportMdPath = path.join(runDir, 'report.md');
const reportHtmlPath = path.join(runDir, 'report.html');
const failures = [];
const warnings = [];

if (!evidencePath) failures.push('missing evidence-index.json');
if (!claimsPath) failures.push('missing claim-ledger.json');
if (!corpusPath) failures.push('missing normalized-corpus.jsonl');
if (!sourceIndexPath) failures.push('missing source-index.json');

if (sourceIndexPath) {
  // 来源索引的契约与校验器都在公共件 planners-source-index —— 这里只负责**把它打开**。
  // 过去 coverage-manifest.json 生成了却从没人读：没有人校验的账目，等于没有账目。
  try {
    const cli = moduleScript('planners-source-index', 'scripts/validate-source-index.mjs');
    const result = spawnSync(process.execPath, [cli, sourceIndexPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    let parsed = null;
    try { parsed = JSON.parse(result.stdout); } catch { /* 下面统一报 */ }
    if (!parsed) failures.push(`source-index 校验器没有返回 JSON：${(result.stderr || '').slice(0, 200)}`);
    else if (!parsed.valid) for (const error of parsed.errors) failures.push(`source-index: [${error.code}] ${error.message}`);
  } catch (error) {
    failures.push(`source-index 校验无法运行：${error.message}`);
  }
}
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

const stripThousands = s => String(s).replace(/[,，]/g, '');

/**
 * 数字类 token 必须整体匹配：token `2.6%` 不能靠 `12.6%` 里那几个字符过关。
 * 千分位先归一（`1,302` 与 `1302` 视为同一个数），再用前后边界断言排除
 * "更长的数字里包含它"的情况。非数字开头的 token 仍用普通包含判断。
 */
function containsMetricToken(text, token) {
  if (!/^\d/.test(token)) return text.includes(token);
  const haystack = stripThousands(text);
  const needle = stripThousands(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.])${needle}(?![\\d.])`).test(haystack);
}

if (metrics.length && fs.existsSync(reportMdPath) && fs.existsSync(reportHtmlPath)) {
  const markdown = fs.readFileSync(reportMdPath, 'utf8');
  const html = fs.readFileSync(reportHtmlPath, 'utf8');
  for (const metric of metrics) for (const token of metric.report_tokens ?? []) {
    if (!containsMetricToken(markdown, token)) failures.push(`report.md missing metric token ${metric.metric_id}: ${token}`);
    if (!containsMetricToken(html, token)) failures.push(`report.html missing metric token ${metric.metric_id}: ${token}`);
  }
}

// 反向检查：报告里出现了、账本里没登记的数字。
// 这一向才是错数字的藏身处（例如把原音里的赞数写进正文却没进账本）。
// 只报警不报错——报告里的日期、年份、序号、原音引用都天然不在账本里。
if (metrics.length && fs.existsSync(reportMdPath)) {
  const registered = new Set();
  for (const metric of metrics) {
    const fields = [metric.numerator, metric.denominator, metric.label, metric.filter, metric.generation, ...(metric.report_tokens ?? [])];
    for (const field of fields) for (const n of String(field ?? '').match(/\d+(?:\.\d+)?%?/g) ?? []) registered.add(stripThousands(n));
  }
  const scrubbed = fs.readFileSync(reportMdPath, 'utf8')
    .replace(/[0-9a-f]{12,}/g, ' ')       // 原始 note_id / comment_id
    .replace(/`[^`]*`/g, ' ')             // 行内代码（脚本名、字段名）
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')   // 完整日期
    .replace(/\d{4}年/g, ' ');
  const unregistered = new Map();
  for (const raw of scrubbed.match(/(?<![\d.,])\d[\d,]*(?:\.\d+)?%?(?![\d.])/g) ?? []) {
    const n = stripThousands(raw);
    if (registered.has(n)) continue;
    if (n.replace(/[^\d]/g, '').length <= 2) continue;   // 序号与小计数
    if (/^(?:19|20)\d{2}$/.test(n)) continue;            // 年份
    unregistered.set(n, (unregistered.get(n) ?? 0) + 1);
  }
  if (unregistered.size) {
    const top = [...unregistered.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    warnings.push(
      `report.md 里有 ${unregistered.size} 个数字未在 metrics-ledger 登记（列出前 ${top.length} 个）：` +
      top.map(([n, c]) => `${n}×${c}`).join('、')
    );
  }
}

if (fs.existsSync(reportHtmlPath)) {
  const html = fs.readFileSync(reportHtmlPath, 'utf8');
  // 水印是身份装饰，不是不变量：这里不校验它。校验器断言一个常量，
  // 只会让写错的常量被反复盖章（quanti 侧就曾把水印写错并自洽通过）。
  // 离线契约（外部依赖 / 水印 / 打印样式 / 必需标记）归公共件 planners-report-kit —— 只该有一处定义。
  // 这里只声明**本报告特有**的必需标记。
  try {
    const reportValidator = moduleScript('planners-report-kit', 'scripts/validate-report.mjs');
    const result = spawnSync(process.execPath, [reportValidator, reportHtmlPath,
      '--require', 'id="answer"', '--require', 'id="data"', '--require', 'nav-toggle'], { encoding: 'utf8' });
    let parsed = null;
    try { parsed = JSON.parse(result.stdout); } catch { /* 下面统一报 */ }
    if (!parsed) failures.push(`report.html 离线校验没有返回 JSON：${(result.stderr || '').slice(0, 200)}`);
    else if (!parsed.valid) for (const error of parsed.errors) failures.push(`report.html: [${error.code}] ${error.message}`);
  } catch (error) {
    failures.push(`report.html 离线校验无法运行：${error.message}`);
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`PASS QualiBox run (${evidenceCount} evidence units, ${claimCount} claims${metricsPath ? ', metrics checked' : ''})`);
console.log('Mechanical validation passed. Semantic interpretation and one final visual review remain human/model responsibilities.');
