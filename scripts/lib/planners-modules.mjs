/**
 * 公共模组的解析适配器（每个消费方一份，约 35 行）。
 *
 * 「公共模组单独发布成条目」意味着：发布后它们与本 Skill **平铺在同一个 skills 根下**，
 * 所以按名字找兄弟目录即可，不需要任何 runtime 专属路径。开发时它们还在 monorepo 里。
 *
 * 找的顺序（票 11 定的约定）：
 *   ① $PLANNERS_MODULES_HOME/<name>
 *   ② 本 Skill 目录的兄弟：<skills-root>/<name>          ← 发布后的主路径
 *   ③ monorepo：02-skills-library/00-system/<name>
 *   ④ 都没有 → 报错并给安装提示（**不许静默降级成"跳过校验"**）
 *
 * 自检：node scripts/lib/planners-modules.mjs --check
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));   // <skill>/scripts/lib
const SKILL_ROOT = resolve(HERE, '..', '..');            // <skill>
const SKILLS_ROOT = resolve(SKILL_ROOT, '..');           // 发布后的 skills 根

const REPO_ROOT = resolve(SKILLS_ROOT, '..');

/** monorepo 里所有分类目录（00-system、01-data-analysis、…）。公共模组可以住在任何一类。 */
function repoCategories() {
  try {
    return readdirSync(REPO_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d\d-/.test(d.name))
      .map(d => join(REPO_ROOT, d.name));
  } catch {
    return [];
  }
}

export function moduleCandidates(name) {
  return [
    process.env.PLANNERS_MODULES_HOME ? join(process.env.PLANNERS_MODULES_HOME, name) : null,
    join(SKILLS_ROOT, name),                                  // 发布后：兄弟目录
    ...repoCategories().map(c => join(c, name)),              // monorepo：任意分类下
  ].filter(Boolean);
}

export function resolveModule(name) {
  for (const c of moduleCandidates(name)) if (existsSync(c)) return c;
  throw new Error(
    `找不到公共模组 ${name}。找过：\n  ` + moduleCandidates(name).join('\n  ')
    + `\n装法：把 ${name} 放进同一个 skills 根目录，或设 PLANNERS_MODULES_HOME 指向它所在目录。`,
  );
}

/** 公共模组里的一个脚本的绝对路径 */
export function moduleScript(name, relPath) {
  const p = join(resolveModule(name), relPath);
  if (!existsSync(p)) throw new Error(`公共模组 ${name} 里没有这个脚本：${relPath}`);
  return p;
}

if (process.argv.includes('--check')) {
  for (const name of ['planners-source-index', 'planners-fact-check', 'planners-review-core']) {
    try {
      const dir = resolveModule(name);
      console.log(`✓ ${name} → ${dir}`);
    } catch (e) {
      console.log(`✗ ${name}：${String(e.message).split('\n')[0]}`);
    }
  }
  console.log('\n候选路径：');
  for (const c of moduleCandidates('planners-source-index')) console.log('  ' + c);
}
