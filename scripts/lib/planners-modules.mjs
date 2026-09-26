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
 *   ④ 用户级兜底：<安装根>/<name>（$PLANNERS_MODULES_INSTALL_DIR → $PLANNERS_MODULES_HOME
 *      → 默认 ~/.planners-modules；库外，绝不写进 02-skills-library）
 *   ⑤ 都没有 → **自动装**进安装根，装完复验再重解析；装不成才报错
 *      （PLANNERS_NO_AUTO_INSTALL=1 → 只报不装；契约见 planners-modules-install.mjs）
 *
 * 自检：node scripts/lib/planners-modules.mjs --check
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_DIR_NAME, ensureModule, installRootFor, moduleNotFound }
  from './planners-modules-install.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));   // <skill>/scripts/lib
const SKILL_ROOT = resolve(HERE, '..', '..');            // <skill>
const SKILLS_ROOT = resolve(SKILL_ROOT, '..');           // 发布后的 skills 根

const REPO_ROOT = resolve(SKILLS_ROOT, '..');

/**
 * 从 start 往上找 02-skills-library 工作树根（找不到返回 null）。
 * 拿它做硬约束：自动安装的目标**不得位于库工作树内**（否则会再造一个嵌套仓库）。
 */
export function libraryRootFor(start) {
  let current = resolve(start);
  for (let depth = 0; depth < 12; depth += 1) {
    // ① 名字就是库目录（目录被改名也不影响这条之外的判据）
    // ② 这一层**装着**一个叫 02-skills-library 的子目录（不依赖本文件在库里的深度）
    // ③ 这一层同时住着本 Skill 与已知公共模组分发目录（说明它就是 skills 根）
    const subdirs = (() => {
      try {
        return new Set(readdirSync(current));
      } catch {
        return new Set();
      }
    })();
    if (current.endsWith(sep + LIBRARY_DIR_NAME) || subdirs.has(LIBRARY_DIR_NAME)) return current;
    if (subdirs.has('planners-review-core') && subdirs.has('planners-source-index')) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

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
  const out = [
    process.env.PLANNERS_MODULES_HOME ? join(process.env.PLANNERS_MODULES_HOME, name) : null,
    join(SKILLS_ROOT, name),
    ...repoCategories().map(category => join(category, name)),
  ].filter(Boolean);
  // ⑤ 兜底（最后一条，绝不遮蔽上面任何一条）：缺依赖时自动装到「库外用户级」安装根。
  out.push(join(installRootFor({ name }).root, name));
  return [...new Set(out)];
}

export function resolveModule(name) {
  for (const c of moduleCandidates(name)) if (existsSync(c)) return c;
  return installModuleThenResolve(name);
}

/**
 * 本地一条都没命中 → 自动装（契约见 planners-modules-install.mjs）。
 * 装失败时错误信息里带着「缺哪个、找过哪些路径、手动怎么装（可复制）」。
 */
function installModuleThenResolve(name) {
  const candidates = moduleCandidates(name);
  const libraryRoot = libraryRootFor(HERE);
  try {
    ensureModule(name, {
      candidates,
      libraryRoot,
      verifyPath: probeName => (existsSync(join(installRootFor({ name: probeName }).root, probeName))
        ? join(installRootFor({ name: probeName }).root, probeName)
        : null),
    });
  } catch (error) {
    // 安装器的错误信息本身已经说清了「缺哪个、找过哪些路径、手动怎么装」，
    // 再套一层只会把它埋掉 —— 原样抛出，另加一句上下文。
    throw new Error(`公共模组 ${name} 不在本地，自动安装也没成功。\n${error.message}`);
  }
  for (const c of moduleCandidates(name)) if (existsSync(c)) return c;
  throw moduleNotFound(name, candidates);
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
