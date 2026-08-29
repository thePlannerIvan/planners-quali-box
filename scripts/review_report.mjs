#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const [htmlArg, outputArg] = process.argv.slice(2);
if (!htmlArg) {
  console.error('Usage: node review_report.mjs REPORT_HTML [OUTPUT_DIRECTORY]');
  process.exit(2);
}

const htmlPath = path.resolve(htmlArg);
const outputDir = path.resolve(outputArg ?? path.dirname(htmlPath));
if (!fs.existsSync(htmlPath)) {
  console.error(`Missing report: ${htmlPath}`);
  process.exit(2);
}
fs.mkdirSync(outputDir, { recursive: true });

async function loadPlaywright() {
  const attempts = [
    () => import('playwright'),
    async () => {
      const requireFromCwd = createRequire(path.join(process.cwd(), 'package.json'));
      return import(pathToFileURL(requireFromCwd.resolve('playwright')).href);
    }
  ];
  for (const attempt of attempts) {
    try { return await attempt(); } catch { /* try next resolver */ }
  }
  throw new Error('Playwright is unavailable. Install it in the current workspace or use an existing browser tool for the same three checks.');
}

const playwrightModule = await loadPlaywright();
const { chromium } = playwrightModule.chromium ? playwrightModule : playwrightModule.default;
const browser = await chromium.launch({ headless: true });
const fileUrl = pathToFileURL(htmlPath).href;
const failures = [];
let audit;

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await desktop.goto(fileUrl, { waitUntil: 'load' });
  await desktop.screenshot({ path: path.join(outputDir, 'report-desktop.png'), fullPage: false });
  audit = await desktop.evaluate(() => {
    const answer = document.querySelector('#answer');
    const headline = document.querySelector('#answer .decision-headline');
    const findings = [...document.querySelectorAll('#answer .decision-list > *')];
    const watermark = document.querySelector('.watermark');
    const navToggle = document.querySelector('.nav-toggle');
    const overflowing = [...document.querySelectorAll('body *')]
      .filter(el => el.scrollWidth > el.clientWidth + 2)
      .slice(0, 12)
      .map(el => ({ tag: el.tagName, class: el.className, id: el.id, overflow: el.scrollWidth - el.clientWidth }));
    const visible = el => Boolean(el && el.getBoundingClientRect().top < 900 && el.getBoundingClientRect().bottom > 0);
    return {
      title: document.title,
      answer_present: Boolean(answer),
      headline_visible: visible(headline),
      visible_short_findings: findings.filter(visible).length,
      watermark_present: Boolean(watermark),
      nav_toggle_present: Boolean(navToggle),
      external_dependencies: [...document.querySelectorAll('script[src],link[href]')]
        .map(el => el.src || el.href).filter(value => /^https?:/i.test(value)),
      horizontal_overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      overflowing_elements: overflowing
    };
  });
  if (!audit.answer_present) failures.push('missing #answer');
  if (!audit.headline_visible) failures.push('answer headline is not visible in 1440x900 first screen');
  if (audit.visible_short_findings < 3) failures.push('fewer than three short findings visible in 1440x900 first screen');
  if (!audit.watermark_present) failures.push('missing watermark');
  if (!audit.nav_toggle_present) failures.push('missing nav toggle');
  if (audit.external_dependencies.length) failures.push('external dependencies found');
  if (audit.horizontal_overflow) failures.push('desktop page has horizontal overflow');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(fileUrl, { waitUntil: 'load' });
  await mobile.screenshot({ path: path.join(outputDir, 'report-mobile.png'), fullPage: false });
  const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  audit.mobile_horizontal_overflow = mobileOverflow;
  if (mobileOverflow) failures.push('mobile page has horizontal overflow');

  await desktop.pdf({ path: path.join(outputDir, 'report-print.pdf'), format: 'A4', printBackground: true });
} finally {
  await browser.close();
}

const result = { report: htmlPath, checked_at: new Date().toISOString(), audit, failures, status: failures.length ? 'FAIL' : 'PASS' };
fs.writeFileSync(path.join(outputDir, 'report-review.json'), `${JSON.stringify(result, null, 2)}\n`);
if (failures.length) {
  failures.forEach(item => console.error(`FAIL ${item}`));
  process.exit(1);
}
console.log(`PASS report review: ${path.join(outputDir, 'report-review.json')}`);
