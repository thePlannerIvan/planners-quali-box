#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
  datasets.push({ dataset_id: dataset.dataset_id, path: sourcePath, format, logical_records: expanded.length, empty_text: emptyText });
}

const duplicateIds = [...new Set(normalized.map(item => item.source_id).filter((id, index, values) => values.indexOf(id) !== index))];
if (duplicateIds.length) throw new Error(`Duplicate source_id values: ${duplicateIds.slice(0, 10).join(', ')}`);
fs.writeFileSync(path.join(outputDir, 'normalized-corpus.jsonl'), normalized.map(item => JSON.stringify(item)).join('\n') + '\n');
fs.writeFileSync(path.join(outputDir, 'coverage-manifest.json'), JSON.stringify({ schema_version: '1.0', generated_at: new Date().toISOString(), total_records: normalized.length, datasets }, null, 2) + '\n');
console.log(`Prepared ${normalized.length} records across ${datasets.length} datasets in ${outputDir}`);
