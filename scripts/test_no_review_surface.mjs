#!/usr/bin/env node
/**
 * 防回退：**本 Skill 的人的决定留在对话里，不上公共审阅缝。**
 *
 * 为什么需要这条（不是"文件今天不存在"的复述）：
 * 在本 Skill 里，人下决定的唯一地点是 **CP0 的方案确认**，而它发生在**要求阶段、模型就在对话里的时候**；
 * 产物阶段（`report.html`）的"审阅"只有阅读，不产生决定。`review_report.mjs` 是**渲染自检**
 * （headless 截图 + DOM 断言），全程无人下决定。
 * 把这种面挂上缝，就是把"模型在旁边多轮协商"换成"一页静态纸 → 写一份文件 → 醒一次"；
 * 而且 `corpus-profile.md` 的 `confirmation_status` 是唯一真相源，挂上缝必然多出一份副本。
 * 兄弟 Skill `planners-quanti-box` 已经因为同一个理由**亲手删掉过**"证明 CP0 发生过"的机器
 * （git 8c4be05，删 `confirmation-record.schema.json` 与全部哈希绑定），并写下判词：
 * **"CP0 是人的决定，不是机器的状态；机器能验的只有'某个字符串非空'。"**
 *
 * 判据写成**扫描式**：这个 Skill 的 scripts / assets / stages / contracts / references 里，
 * **任何缝的标志物一出现即红** —— 这样它真的会在"有人把确认机器加回来"的那天红，
 * 而不是靠"这些文件今天本来就不存在"永远为真。
 *
 * 跑法：node scripts/test_no_review_surface.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// 扫**整棵 Skill 树**（不是几个提名目录）：标志物可能出现在任意新目录里
// （例如 `review/review-surface.json` —— 只扫提名目录就会整个漏掉，而"漏掉"正是这条判据最坏的失败方式）。
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__']);
const TEXT_EXT = new Set(['.mjs', '.js', '.cjs', '.json', '.md', '.html', '.css', '.py', '.txt', '.jsonl']);
// 测试自己必须跳过：**断言里写着标志物字符串**，扫自己就是"永远为真"。
const SELF = path.relative(root, fileURLToPath(import.meta.url));

// 硬红：出现即"缝被接了回来"。
const MARKERS = [
  { pattern: /\{\{REVIEW_BRIDGE\}\}/, why: '桥的注入点（宿主原地替换的裸标记）' },
  { pattern: /\bReviewBridge\b/, why: '公共桥的全局对象' },
  { pattern: /\breview-bridge\b/, why: '公共桥的文件名（页面不许自带副本）' },
  { pattern: /\breview[-_]surface\b/, why: '缝的契约文件（review-surface.json / schema）' },
  { pattern: /\bwriteSurface\b/, why: '缝的生命周期 API' },
  { pattern: /(review-host|serve-review|review-inbox)\.mjs/, why: '缝的宿主（页面不许自带服务器）' },
  { pattern: /\bcreateServer\b|\.listen\s*\(/, why: '页面/脚本不许自带服务器' },
  // 反馈文件与决定词表：本家**没有**任何 feedback 文件，它一旦出现就是缝接回来了。
  { pattern: /\bfeedback\b|反馈文件|反馈词表/, why: '缝的收件文件' },
];

// 软提示：**不是**缝的证据（报告页不在 iframe 里，且已 try/catch），
// 但一旦这页真的被 serve 进不透明帧，顶层读 web storage 会抛异常（验证 13）。
const ADVISORY = [
  { pattern: /localStorage|sessionStorage/, why: '不透明帧里顶层读 web storage 会抛异常；本家报告页当前不在帧里' },
];

// 唯一允许说出缝名字的两个地方（豁免**故意写得很窄**，不是放宽判据）：
// ① `planners-modules.mjs` 是一张"有哪些公共件"的名单（`planners-source-index` / `planners-fact-check` /
//    `planners-review-core` 同在一份名单里），它**不是**接缝的证据 —— 名单里有名字 ≠ 这一家用了它。
// ② `SKILL.md` 里**登记这条回归自己**的那一行：那行必须写出标志物字面量（否则读者不知道它在拦什么）。
//    豁免卡的是"**表格里登记这条回归自己**的那一行"（含脚本名 + 表格竖线），
//    所以 SKILL.md 里任何**别的**接缝写法（包括正文段落里提一句）照样会红。
const ALLOW = {
  // 两张名单都是"有哪些公共件"的名单，都**不是**接缝的证据：
  // ① 解析适配器里的名单；② 安装器 MODULE_SPECS 里 review-core 的锚点文件名。
  'scripts/lib/planners-modules.mjs': [/planners-review-core/],
  // 安装器只豁免"裸的锚点文件名字面量"这一行（形如 'scripts/review-host.mjs',），
  // 不豁免整个文件 —— 谁真的在安装器里接缝，照样会红。
  'scripts/lib/planners-modules-install.mjs': [/^\s*'[^']*\/(review-surface|review-host)[^']*',?\s*$/],
  'SKILL.md': [/scripts\/test_no_review_surface\.mjs.*\|/],
};
const allowed = (rel, line) => (ALLOW[rel] || []).some(pattern => pattern.test(line));

const reds = [];
const advisories = [];
function scanFile(file) {
  const rel = path.relative(root, file);
  if (rel === SELF) return;
  const base = path.basename(file);
  // 文件名本身就是标志物（不依赖内容）
  if (/^review-surface.*\.json$/.test(base) || /^review[-_]?(feedback|bridge)/i.test(base)) {
    reds.push({ rel, why: '缝的标志物文件', text: base });
    return;
  }
  if (!TEXT_EXT.has(path.extname(file).toLowerCase())) return;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  text.split('\n').forEach((line, index) => {
    const hit = list => list.find(({ pattern }) => pattern.test(line));
    const red = hit(MARKERS);
    if (red && !allowed(rel, line)) {
      reds.push({ rel, line: index + 1, why: red.why, text: line.trim().slice(0, 160) });
      return;
    }
    const soft = hit(ADVISORY);
    if (soft) advisories.push({ rel, line: index + 1, why: soft.why });
  });
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) scanFile(full);
  }
}

walk(root);

if (advisories.length) {
  console.log(`NOTE 软提示 ${advisories.length} 处（非缝的证据，不计入红）：`);
  for (const a of advisories) console.log(`  ${a.rel}:${a.line}  [${a.why}]`);
}
if (reds.length) {
  console.error('FAIL 本 Skill 的人的决定应留在对话里，但扫描到缝的标志物：');
  for (const red of reds) {
    console.error(`  ${red.rel}${red.line ? `:${red.line}` : ''}  [${red.why}]`);
    if (red.text) console.error(`      ${red.text}`);
  }
  console.error(`\n共 ${reds.length} 处。若这是有意接缝，先改 SKILL.md 的「统一审阅契约」，并说明 CP0 的真相源为什么不会变成两份。`);
  process.exit(1);
}
console.log(`PASS no review seam (scanned the whole Skill tree; no bridge, no surface contract, no feedback file, no self-hosted server; advisory ${advisories.length})`);
