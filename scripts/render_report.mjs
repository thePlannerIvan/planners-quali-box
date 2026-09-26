#!/usr/bin/env node
/**
 * quali 的报告渲染入口（保留原 CLI：report-data.json report.html）。
 *
 * **装配不在这里** —— 填落点、注水印、未解析占位符不写盘，都是公共件
 * `planners-report-kit` 的事。本 Skill 保留的是自己的骨架（八种方法的视觉隐喻）
 * 与方法模块；水印文字也只从公共件读，不再在这里硬编码。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { moduleScript } from './lib/planners-modules.mjs';

const [dataPath, outputPathArg] = process.argv.slice(2);
if (!dataPath || !outputPathArg) {
  console.error('Usage: node render_report.mjs report-data.json report.html');
  process.exit(2);
}
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const method = data.method;
if (!/^[a-z0-9-]+$/.test(method ?? '')) throw new Error('report-data.json requires a safe method slug');

const kit = moduleScript('planners-report-kit', 'scripts/render-report.mjs');
const result = spawnSync(process.execPath, [
  kit,
  '--frame', path.join(skillDir, 'assets', 'report-shell.html'),
  '--content', path.join(skillDir, 'assets', 'methods', `${method}.html`),
  '--placeholders-json', JSON.stringify(data.placeholders ?? {}),
  '--out', path.resolve(outputPathArg),
], { encoding: 'utf8' });
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Rendered ${outputPathArg} with method ${method}`);
