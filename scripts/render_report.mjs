#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasPlaceholders } from './validation-core.mjs';

const [dataPath, outputPathArg] = process.argv.slice(2);
if (!dataPath || !outputPathArg) {
  console.error('Usage: node render_report.mjs report-data.json report.html');
  process.exit(2);
}
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const method = data.method;
if (!/^[a-z0-9-]+$/.test(method ?? '')) throw new Error('report-data.json requires a safe method slug');
let html = fs.readFileSync(path.join(skillDir, 'assets', 'report-shell.html'), 'utf8');
const methodHtml = fs.readFileSync(path.join(skillDir, 'assets', 'methods', `${method}.html`), 'utf8');
html = html.replace('<!-- METHOD_MODULE -->', methodHtml);
for (const [key, value] of Object.entries(data.placeholders ?? {})) html = html.replaceAll(`{{${key}}}`, String(value));
if (hasPlaceholders(html)) throw new Error('Unresolved report placeholders remain; report.html was not written');
fs.writeFileSync(path.resolve(outputPathArg), html);
console.log(`Rendered ${outputPathArg} with method ${method}`);
