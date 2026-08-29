import fs from 'node:fs';

export function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

export function evidenceEntries(value) {
  if (Array.isArray(value)) return value;
  return value?.entries;
}

export function claimEntries(value) {
  if (Array.isArray(value)) return value;
  return value?.claims;
}

function comparableText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptSegments(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .split(/(?:\.{3,}|…+|\[[^\]]*\])/)
    .map(comparableText)
    .filter(part => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(part) ? part.length >= 4 : part.length >= 8);
}

export function validateEvidenceAgainstCorpus(evidence, corpus) {
  const entries = evidenceEntries(evidence) ?? [];
  const failures = [];
  const corpusById = new Map();
  for (const [index, record] of corpus.entries()) {
    if (typeof record?.source_id !== 'string' || !record.source_id.trim()) {
      failures.push(`corpus[${index}] missing source_id`);
      continue;
    }
    if (corpusById.has(record.source_id)) failures.push(`corpus duplicate source_id ${record.source_id}`);
    corpusById.set(record.source_id, record);
  }

  for (const [index, item] of entries.entries()) {
    const at = `evidence[${index}]`;
    const source = corpusById.get(item?.source_id);
    if (!source) {
      failures.push(`${at} source_id not found in normalized corpus: ${item?.source_id}`);
      continue;
    }
    if (item.dataset_id !== source.dataset_id) failures.push(`${at} dataset_id differs from normalized corpus`);
    if (item.locator !== source.locator) failures.push(`${at} locator differs from normalized corpus`);
    const sourceText = comparableText(source.text);
    const evidenceText = comparableText(item.text);
    if (!sourceText || !evidenceText || sourceText.includes(evidenceText)) continue;
    const segments = excerptSegments(item.text);
    let cursor = 0;
    let traceable = segments.length > 0;
    for (const segment of segments) {
      const found = sourceText.indexOf(segment, cursor);
      if (found < 0) { traceable = false; break; }
      cursor = found + segment.length;
    }
    if (!traceable) failures.push(`${at} text is not a traceable excerpt of normalized corpus; use verbatim ordered segments and document privacy redaction with redaction_note`);
  }
  return { failures };
}

export function validateEvidenceAndClaims(evidence, ledger) {
  const entries = evidenceEntries(evidence);
  const claims = claimEntries(ledger);
  const failures = [];
  const warnings = [];
  const identityStatuses = new Set(['verified', 'inferred', 'unknown']);
  const confidenceLevels = new Set(['高', '中', '低']);

  if (!Array.isArray(entries) || !entries.length) failures.push('evidence index requires a non-empty top-level array or entries array');
  if (!Array.isArray(claims) || !claims.length) failures.push('claim ledger requires a non-empty top-level array or claims array');

  const ids = new Set();
  for (const [index, item] of (entries ?? []).entries()) {
    const at = `evidence[${index}]`;
    for (const key of ['source_id', 'dataset_id', 'locator', 'actor_identity', 'identity_status', 'evidence_role', 'text']) {
      if (typeof item?.[key] !== 'string' || !item[key].trim()) failures.push(`${at} missing ${key}`);
    }
    if (item?.identity_status && !identityStatuses.has(item.identity_status)) failures.push(`${at} identity_status must be verified, inferred, or unknown`);
    if (ids.has(item?.source_id)) failures.push(`${at} duplicate source_id ${item.source_id}`);
    if (item?.source_id) ids.add(item.source_id);
  }

  const claimIds = new Set();
  for (const [index, claim] of (claims ?? []).entries()) {
    const at = `claim[${index}]`;
    for (const key of ['claim_id', 'claim', 'confidence', 'confidence_reason', 'boundary', 'status']) {
      if (typeof claim?.[key] !== 'string' || !claim[key].trim()) failures.push(`${at} missing ${key}`);
    }
    if (claim?.confidence && !confidenceLevels.has(claim.confidence)) failures.push(`${at} confidence must be 高, 中, or 低`);
    if (claimIds.has(claim?.claim_id)) failures.push(`${at} duplicate claim_id ${claim.claim_id}`);
    if (claim?.claim_id) claimIds.add(claim.claim_id);
    for (const key of ['support_ids', 'counter_ids']) {
      if (!Array.isArray(claim?.[key])) failures.push(`${at} ${key} must be an array`);
      for (const id of claim?.[key] ?? []) if (!ids.has(id)) failures.push(`${at} ${key} references unknown ${id}`);
    }
    if (claim?.status === 'approved' && (claim.support_ids?.length ?? 0) < 2) failures.push(`${at} approved claim needs at least two support_ids or must be downgraded`);
    if (new Set(claim?.support_ids ?? []).size !== (claim?.support_ids ?? []).length) failures.push(`${at} repeats support_ids`);
  }
  return { entries: entries ?? [], claims: claims ?? [], failures, warnings };
}

export function validateMetrics(value) {
  const metrics = Array.isArray(value) ? value : value?.metrics;
  const failures = [];
  const warnings = [];
  if (!Array.isArray(metrics)) return { metrics: [], failures: ['metrics ledger requires a top-level array or metrics array'], warnings };
  const ids = new Set();
  const partitions = new Map();
  for (const [index, metric] of metrics.entries()) {
    const at = `metric[${index}]`;
    for (const key of ['metric_id', 'label', 'filter', 'generation']) {
      if (typeof metric?.[key] !== 'string' || !metric[key].trim()) failures.push(`${at} missing ${key}`);
    }
    if (!Array.isArray(metric?.report_tokens) || !metric.report_tokens.length || metric.report_tokens.some(token => typeof token !== 'string' || !token.trim())) {
      failures.push(`${at} report_tokens must be a non-empty string array`);
    }
    if (ids.has(metric?.metric_id)) failures.push(`${at} duplicate metric_id ${metric.metric_id}`);
    if (metric?.metric_id) ids.add(metric.metric_id);
    for (const key of ['numerator', 'denominator']) if (!Number.isFinite(metric?.[key])) failures.push(`${at} ${key} must be numeric`);
    if (Number.isFinite(metric?.numerator) && Number.isFinite(metric?.denominator)) {
      if (metric.denominator <= 0) failures.push(`${at} denominator must be positive`);
      if (metric.numerator < 0 || metric.numerator > metric.denominator) failures.push(`${at} numerator must be between 0 and denominator`);
    }
    if (metric?.partition_id) {
      const list = partitions.get(metric.partition_id) ?? [];
      list.push(metric);
      partitions.set(metric.partition_id, list);
    }
  }
  for (const [partitionId, group] of partitions) {
    const denominators = new Set(group.map(item => item.denominator));
    if (denominators.size !== 1) failures.push(`partition ${partitionId} uses inconsistent denominators`);
    else {
      const denominator = group[0].denominator;
      const total = group.reduce((sum, item) => sum + item.numerator, 0);
      if (total !== denominator) failures.push(`partition ${partitionId} totals ${total}, expected ${denominator}; categories must be mutually exclusive or partition_id must be removed`);
    }
  }
  return { metrics, failures, warnings };
}

export function hasPlaceholders(text) {
  return /\{\{[^}]+\}\}|PLACEHOLDER|<!--\s*METHOD_MODULE\s*-->/.test(text);
}
