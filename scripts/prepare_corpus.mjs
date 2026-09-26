#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const [configPath, outputDirArg] = process.argv.slice(2);
if (!configPath || !outputDirArg) {
  console.error('Usage: node prepare_corpus.mjs corpus-config.json OUTPUT_DIRECTORY');
  process.exit(2);
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value));
  return rows.slice(1).filter(rowValue => rowValue.some(Boolean)).map((values, index) => {
    const record = { __logical_row: index + 2 };
    headers.forEach((header, column) => { record[header] = values[column] ?? ''; });
    return record;
  });
}

function expandJson(value, expression) {
  if (!expression || expression === '$' || expression === '[]') return Array.isArray(value) ? value.map((record, index) => ({ record, inherited: {}, locator: [index] })) : [{ record: value, inherited: {}, locator: [] }];
  const tokens = expression.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let states = [{ value, inherited: {}, locator: [] }];
  for (const token of tokens) {
    const arrayToken = token.endsWith('[]');
    const key = arrayToken ? token.slice(0, -2) : token;
    const next = [];
    for (const state of states) {
      const target = key ? state.value?.[key] : state.value;
      if (arrayToken) {
        const parentFields = state.value && typeof state.value === 'object' && !Array.isArray(state.value)
          ? Object.fromEntries(Object.entries(state.value).filter(([parentKey]) => parentKey !== key))
          : {};
        for (const [index, item] of (Array.isArray(target) ? target : []).entries()) {
          next.push({ value: item, inherited: { ...state.inherited, ...parentFields }, locator: [...state.locator, index] });
        }
      } else if (target !== undefined) next.push({ value: target, inherited: state.inherited, locator: state.locator });
    }
    states = next;
  }
  return states.map(state => ({ record: state.value, inherited: state.inherited, locator: state.locator }));
}

function get(record, key) {
  return key?.split('.').reduce((value, part) => value?.[part], record);
}

function cleanId(value) {
  return String(value).trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_.:@/-]+/gu, '-').replace(/^-+|-+$/g, '');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const outputDir = path.resolve(outputDirArg);
fs.mkdirSync(outputDir, { recursive: true });
const normalized = [];
const datasets = [];

for (const dataset of config.datasets ?? []) {
  const sourcePath = path.resolve(path.dirname(configPath), dataset.path);
  const format = (dataset.format ?? path.extname(sourcePath).slice(1)).toLowerCase();
  let expanded;
  if (format === 'csv' || format === 'tsv') {
    const records = parseDelimited(fs.readFileSync(sourcePath, 'utf8'), format === 'tsv' ? '\t' : ',');
    expanded = records.map(record => ({ record, inherited: {}, locator: [record.__logical_row] }));
  } else if (format === 'json') {
    expanded = expandJson(JSON.parse(fs.readFileSync(sourcePath, 'utf8')), dataset.record_path ?? '[]');
  } else {
    throw new Error(`Unsupported format ${format} for ${sourcePath}. Export Excel sheets to CSV or JSON first with the workspace-native spreadsheet reader.`);
  }

  let emptyText = 0;
  const startLine = normalized.length + 1;
  for (const [index, item] of expanded.entries()) {
    const merged = { ...item.inherited, ...(item.record && typeof item.record === 'object' ? item.record : { value: item.record }) };
    const text = (dataset.text_fields ?? ['text', 'content']).map(key => get(merged, key)).filter(value => value !== undefined && value !== null && String(value).trim()).join('\n').trim();
    if (!text) emptyText++;
    const locatorParts = (dataset.locator_fields ?? []).map(key => get(merged, key)).filter(value => value !== undefined && value !== null && String(value).trim());
    if (!locatorParts.length && dataset.locator_fields?.length) throw new Error(`No locator fields resolved for ${dataset.dataset_id} record ${index}`);
    if (!locatorParts.length && format === 'json' && dataset.record_path && !dataset.allow_positional_locator) {
      throw new Error(`JSON dataset ${dataset.dataset_id} requires locator_fields or allow_positional_locator=true; array position alone is not stable`);
    }
    const locator = locatorParts.length ? locatorParts.join('/') : (format === 'csv' || format === 'tsv' ? `row:${merged.__logical_row}` : `json:${item.locator.join('.') || index}`);
    const sourceId = `${cleanId(dataset.dataset_id)}:${cleanId(locator)}`;
    normalized.push({
      source_id: sourceId,
      dataset_id: dataset.dataset_id,
      locator,
      actor_identity: String(get(merged, dataset.actor_field) ?? dataset.actor_default ?? 'unknown'),
      identity_status: dataset.identity_status ?? 'unknown',
      evidence_role: dataset.evidence_role ?? 'unassigned',
      text,
      context: (dataset.context_fields ?? []).map(key => get(merged, key)).filter(Boolean).join(' | '),
      raw: merged
    });
  }
  datasets.push({
    dataset_id: dataset.dataset_id, path: sourcePath, format,
    logical_records: expanded.length, empty_text: emptyText,
    line_range: `${startLine}-${normalized.length}`,
    role: dataset.role ?? null,
    analysis_unit: dataset.analysis_unit ?? null,
    coverage_status: dataset.coverage_status ?? null,
    coverage_scope: dataset.coverage_scope ?? null,
    coverage_reason: dataset.coverage_reason ?? null,
    impact_if_incomplete: dataset.impact_if_incomplete ?? null,
  });
}

const duplicateIds = [...new Set(normalized.map(item => item.source_id).filter((id, index, values) => values.indexOf(id) !== index))];
if (duplicateIds.length) throw new Error(`Duplicate source_id values: ${duplicateIds.slice(0, 10).join(', ')}`);
const corpusFile = path.join(outputDir, 'normalized-corpus.jsonl');
fs.writeFileSync(corpusFile, normalized.map(item => JSON.stringify(item)).join('\n') + '\n');
const corpusHash = sha256(fs.readFileSync(corpusFile));

// 数据集级账目 → 公共契约 source-index/2.0.0（取代旧的 coverage-manifest.json）。
// 契约与校验器都在公共件 planners-source-index；这里只负责把产出写成那个形状。
const cwd = process.cwd();
const sources = datasets.map(dataset => {
  const absolute = path.resolve(dataset.path);
  const bytes = fs.readFileSync(absolute);
  const hash = sha256(bytes);
  return {
    source_id: dataset.dataset_id,
    origin: { path: path.relative(cwd, absolute).split(path.sep).join('/'), sha256: hash, bytes: bytes.length },
    kind: 'corpus',
    role: dataset.role || `${dataset.dataset_id}（${dataset.format}）`,
    audit_layer: {
      mode: 'normalized_corpus',
      path: path.relative(outputDir, corpusFile).split(path.sep).join('/'),
      sha256: corpusHash,
      derived_from_sha256: hash,   // 规范化语料里属于本数据集的那一段，来自这个文件
      snapshot_sha256: null,
      method: `${dataset.format} → normalized-corpus.jsonl`,
      anchor_marks: null,
    },
    coverage: {
      // 默认 full：CSV/TSV/JSON 是整表展开的。抽样或部分读入时由 corpus-config 显式声明。
      status: dataset.coverage_status || 'full',
      scope: dataset.coverage_scope ?? null,
      reason: dataset.coverage_reason ?? null,
      impact_if_incomplete: dataset.impact_if_incomplete ?? null,
      counts: { logical_records: dataset.logical_records, empty_text: dataset.empty_text },
    },
    analysis_unit: dataset.analysis_unit ?? null,
    anchors: [
      { kind: 'corpus-lines', value: dataset.line_range, note: '本数据集在 normalized-corpus.jsonl 里的行区间' },
      { kind: 'file', value: dataset.path },
    ],
    conflicts: [], notes: '',
  };
});
const sourceIndex = {
  contract_version: 'source-index/2.0.0',
  source_root: path.relative(outputDir, cwd) || '.',
  index_sha256: null,
  sources,
  blind_spots: [],
};
fs.writeFileSync(path.join(outputDir, 'source-index.json'), JSON.stringify(sourceIndex, null, 2) + '\n');
const needsBlindSpots = sources.filter(source => source.coverage.status !== 'full').map(source => source.source_id);
console.log(`Prepared ${normalized.length} records across ${datasets.length} datasets in ${outputDir}`);
console.log(`Wrote source-index.json (${sources.length} sources)${needsBlindSpots.length ? `; 这些来源不是 full，按契约要在 blind_spots 里各有一条：${needsBlindSpots.join(', ')}` : ''}`);
