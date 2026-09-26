/**
 * 公共模组「缺了就自动装」的唯一实现（JS 侧）。**每个用到它的 Skill 各带一份副本**
 * —— Skill 是逐个独立发布的条目，跨 Skill 共享一个 node_modules 会把「模组找不到」
 * 变成「安装器找不到」，所以这里有意重复（与适配器本身的重复理由相同）。
 *
 * ============================ 契约（mjs 与 py 两份实现必须一致） ============================
 * ① 安装根优先级（同一个环境变量语义，两份实现一字不差）：
 *      $PLANNERS_MODULES_INSTALL_DIR                                  ← 显式指定，最高优先
 *      $PLANNERS_MODULES_HOME（**仅当**它已含该模组，或那目录还不存在时）
 *      <home>/.planners-modules                                       ← 默认；库外、用户级
 *    解析顺序不变：env → 兄弟目录 → monorepo 分类 → 用户级兜底 → 才装。
 * ② 禁止落点（两份实现同一套断言）：
 *      a. 目标 realpath（及其未解析形态）**不得位于 02-skills-library 工作树内**；
 *      b. 不得落进 /usr、/etc、/System、/Library、/bin、/sbin、/var、/opt；
 *      c. 不得写 ~/.codex/skills、~/.claude/skills、~/.gemini/config/skills（publish 的领地）。
 *    违反即 throw，**绝不**降级成「装到别处算了」。
 * ③ staging → rename 原子就位：先在安装根下建 .pm-staging-<name>-<pid>（同一文件系统，
 *    rename 才原子），clone 进去，验过再改名。**任何失败都删 staging**（try/finally）。
 * ④ 装完必须验：目录非空 + SKILL.md + 该模组声明的契约/校验器锚点文件都在；
 *    空目录 / 缺锚点 = 失败，且不留半成品。
 * ⑤ 幂等：目标已存在且通过验证 → 直接复用并报「已装好」，不 clone、不覆盖。
 * ⑥ 不静默：每条动作都往 stderr 打一行 [planners-modules] 日志（来源 / 目标 / candidate /
 *    command / commit）。失败时抛出**带可复制手动命令**的错误。
 * ⑦ 可关掉：$PLANNERS_NO_AUTO_INSTALL=1 → 只报不装（仍给可复制手动命令）。
 *    版本：默认装**默认分支 HEAD**（跟着最新走）；设 $PLANNERS_MODULES_REF=<tag 或分支> 则钉在那上面。
 *    日志里**永远打 commit**；HEAD 恰好被某个 tag 指着时把 tag 一并打出来。
 * ⑧ 永不往模组目录里写文件（不写 INSTALLED.json、不改模组一个字）——provenance 只出现在日志里。
 * ===========================================================================================
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';

export const LOG_PREFIX = '[planners-modules]';
export const REPO_OWNER = 'thePlannerIvan';
export const LIBRARY_DIR_NAME = '02-skills-library';

/**
 * 每个公共模组的「装完怎么算装好了」锚点。
 * contracts/ + scripts/ 里的文件是该模组**声明过**的契约与校验器，缺一个就是这个模组装歪了。
 */
export const MODULE_SPECS = {
  'planners-review-core': {
    anchors: [
      'SKILL.md',
      'contracts/review-surface.schema.json',
      'scripts/validate-surface.mjs',
      'scripts/review-host.mjs',
    ],
  },
  'planners-source-index': {
    anchors: [
      'SKILL.md',
      'contracts/source-index.schema.json',
      'scripts/validate-source-index.mjs',
    ],
  },
  'planners-fact-check': {
    anchors: ['SKILL.md', 'contracts/fact-audit.schema.json', 'scripts/validate-fact-audit.mjs'],
  },
  'planners-report-kit': {
    anchors: ['SKILL.md', 'contracts/attribution.json', 'scripts/render-report.mjs', 'scripts/validate-report.mjs'],
  },
};

/**
 * 禁地：这些目录**本身及其下**都不许装。
 * 注意**不含 /var** —— macOS 的临时目录是 /var/folders/…（$TMPDIR），顶层 /var 只是
 * 指向 /private/var 的符号链接，一刀切会把合法临时路径误杀。
 */
export const FORBIDDEN_SYSTEM_DIRS = ['/usr', '/etc', '/bin', '/sbin', '/System', '/Library', '/opt'];

/** 禁地：这两个**本身上下**不许装，但它们的子目录（如 /var/folders/…）是合法临时区。 */
export const FORBIDDEN_SYSTEM_DIRS_EXACT = ['/var', '/tmp'];

export function moduleSpec(name) {
  const spec = MODULE_SPECS[name];
  if (!spec) {
    throw new Error(
      `${LOG_PREFIX} 不认识的公共模组：${name}（已知：${Object.keys(MODULE_SPECS).join('、')}）。` +
        `如果你新加了模组，请先在 planners-modules-install.mjs 的 MODULE_SPECS 里登记它的锚点文件。`,
    );
  }
  return spec;
}

export function repoUrl(name) {
  return `https://github.com/${REPO_OWNER}/${name}.git`;
}

/**
 * 要钉的 ref（tag 或分支）。不设 = 装默认分支 HEAD（跟着最新走）。
 * 设了却不存在 → git clone 会如实失败，不会悄悄退回 HEAD。
 */
export function moduleRef(env = process.env) {
  const ref = (env.PLANNERS_MODULES_REF ?? '').trim();
  return ref || null;
}

function log(message) {
  process.stderr.write(`${LOG_PREFIX} ${message}\n`);
}

function normalize(p) {
  return p.replace(/[/\\]+$/, '') || sep;
}

function isInside(child, parent) {
  const c = normalize(resolve(child));
  const p = normalize(resolve(parent));
  return c === p || c.startsWith(p + sep);
}

/**
 * 目标目录的禁地断言（契约 ②）。realpath 与未解析形态都比一遍 —— CloudStorage 下
 * /Users/... 与 /private/... 是常见分歧点。
 */
export function assertInstallTargetAllowed(target, testPaths = {}) {
  const raw = resolve(target);
  const real = (() => {
    try {
      return existsSync(raw) ? resolve(realpathSync(raw)) : raw;
    } catch {
      return raw;
    }
  })();
  const variants = [...new Set([raw, real])];

  const libraryRoot = testPaths.libraryRoot;
  if (libraryRoot) {
    for (const v of variants) {
      if (isInside(v, libraryRoot)) {
        throw new Error(
          `${LOG_PREFIX} 拒绝安装：目标 ${v} 位于 ${LIBRARY_DIR_NAME} 工作树内（${libraryRoot}）。\n` +
            `  那会再造一个嵌套仓库。请把安装根指到库外，例如 PLANNERS_MODULES_INSTALL_DIR=$HOME/.planners-modules。`,
        );
      }
    }
  }

  const home = testPaths.home ?? homedir();
  const runtimeDirs = [
    join(home, '.codex', 'skills'),
    join(home, '.claude', 'skills'),
    join(home, '.gemini', 'config', 'skills'),
  ];
  for (const v of variants) {
    for (const dir of runtimeDirs) {
      if (isInside(v, dir)) {
        throw new Error(
          `${LOG_PREFIX} 拒绝安装：目标 ${v} 位于 runtime 技能目录 ${dir}。\n` +
            `  那里是 publish_skills.py 的领地，自动装进去会变成第二份漂移副本。请改用库外安装根。`,
        );
      }
    }
    for (const sysDir of FORBIDDEN_SYSTEM_DIRS) {
      if (isInside(v, sysDir)) {
        throw new Error(`${LOG_PREFIX} 拒绝安装：目标 ${v} 位于系统目录 ${sysDir} 之下。`);
      }
    }
    for (const sysDir of FORBIDDEN_SYSTEM_DIRS_EXACT) {
      if (normalize(resolve(v)) === normalize(resolve(sysDir))) {
        throw new Error(`${LOG_PREFIX} 拒绝安装：目标就是系统目录 ${sysDir} 本身。`);
      }
    }
  }
  return raw;
}

/**
 * 安装根怎么定（契约 ①）。
 * @param {{name: string, env?: Record<string,string|undefined>, home?: string}} input
 */
export function installRootFor({ name, env = process.env, home = homedir() }) {
  const explicit = env.PLANNERS_MODULES_INSTALL_DIR?.trim();
  if (explicit) {
    return { root: explicit, source: 'PLANNERS_MODULES_INSTALL_DIR', configured: true };
  }
  const homeEnv = env.PLANNERS_MODULES_HOME?.trim();
  if (homeEnv) {
    // 只有当它「已经含这个模组」（说明它本来就是为此设的）或「还不存在」（mkdir 不会伤到任何东西）
    // 时才拿它当安装根；否则落到默认根，避免往别人的目录里塞东西。
    if (existsSync(join(homeEnv, name)) || !existsSync(homeEnv)) {
      return { root: homeEnv, source: 'PLANNERS_MODULES_HOME', configured: true };
    }
  }
  return { root: join(home, '.planners-modules'), source: '默认 ~/.planners-modules', configured: false };
}

export function manualCommands(name, { env = process.env, home = homedir() } = {}) {
  const { root } = installRootFor({ name, env, home });
  const ref = moduleRef(env);
  const branch = ref ? ` --branch ${ref}` : '';
  return {
    npx: `npx skills add ${repoUrl(name).replace(/\.git$/, '')} --skill ${name}`,
    git: `git clone --depth 1${branch} ${repoUrl(name)} "${join(root, name)}"`,
    pinned: `PLANNERS_MODULES_REF=v1.0.0 npx skills add ${repoUrl(name).replace(/\.git$/, '')} --skill ${name}`,
    root,
  };
}

export function moduleNotFound(name, candidates, { env = process.env, home = homedir() } = {}) {
  const { npx, git } = manualCommands(name, { env, home });
  return new Error(
    `找不到公共模组 ${name}（自动安装已关闭或不可用）。找过：\n  ${candidates.join('\n  ')}\n` +
      `装法（任选一条，可复制）：\n  ${npx}\n  ${git}\n` +
      `或设 PLANNERS_MODULES_HOME 指向已有模组的目录。`,
  );
}

/**
 * 装完怎么算装好了（契约 ④）。空目录 / 缺锚点一律 false。
 * @returns {{ok: boolean, missing: string[], reason?: string}}
 */
export function verifyInstall(dir, name) {
  const spec = moduleSpec(name);
  if (!existsSync(dir)) return { ok: false, missing: spec.anchors, reason: '目录不存在' };
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (error) {
    return { ok: false, missing: spec.anchors, reason: `读不了目录：${error.message}` };
  }
  // .git 单独存在不算内容（克隆到一半的残余就长这样）
  const visible = entries.filter((e) => e !== '.git');
  if (visible.length === 0) return { ok: false, missing: spec.anchors, reason: '目录是空的（只有 .git）' };
  const missing = spec.anchors.filter((rel) => !existsSync(join(dir, rel)));
  if (missing.length) return { ok: false, missing, reason: `缺声明的契约/校验器：${missing.join('、')}` };
  return { ok: true, missing: [] };
}

/** provenance：装了哪个 commit（以及有没有 tag 可钉）。 */
export function describeInstall(dir, runner = defaultRunner) {
  const commit = runner('git', ['-C', dir, 'rev-parse', 'HEAD']);
  if (commit.status !== 0) return { commit: null, tags: [] };
  const tags = runner('git', ['-C', dir, 'tag', '--points-at', 'HEAD']);
  return {
    commit: commit.stdout.trim() || null,
    tags: tags.status === 0 ? tags.stdout.split('\n').map((t) => t.trim()).filter(Boolean) : [],
  };
}

function defaultRunner(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

function hasBinary(command, runner) {
  return runner(command, ['--version']).status === 0;
}

/**
 * 主入口：缺模组时把它装到安装根，装完验，验完回验。
 * @returns {{path: string, action: 'installed'|'reused', commit: string|null, tags: string[],
 *            root: string, rootSource: string, method: string, npxAvailable: boolean, verifyPath: string|null}}
 */
export function ensureModule(name, {
  env = process.env,
  home = homedir(),
  runner = defaultRunner,
  libraryRoot,
  candidates = [],
  verifyPath = null,
  log: logFn = log,
} = {}) {
  moduleSpec(name);
  const { root, source } = installRootFor({ name, env, home });
  const target = join(resolve(root), name);
  assertInstallTargetAllowed(target, { home, libraryRoot });

  const npxAvailable = hasBinary('npx', runner);
  const gitAvailable = hasBinary('git', runner);
  const method = npxAvailable
    ? 'npx skills add（先试官方工具）→ 失败则 git clone --depth 1'
    : 'npx 不可用 → git clone --depth 1';

  // ⑤ 幂等：已经在位且验过，就复用。
  if (existsSync(target)) {
    const check = verifyInstall(target, name);
    if (check.ok) {
      const info = describeInstall(target, runner);
      logFn(`已装好，不需要重装：${name} → ${target}${info.commit ? `（commit ${info.commit}）` : ''}`);
      return { path: target, action: 'reused', root, rootSource: source, method, npxAvailable, verifyPath, ...info };
    }
    throw new Error(
      `${LOG_PREFIX} 目录 ${target} 已存在，但**没通过验证**（${check.reason}）——不是自动装出来的完整模组，我不覆盖它。\n` +
        `  请人工确认后删除，或改 PLANNERS_MODULES_INSTALL_DIR / PLANNERS_MODULES_HOME 换一个安装根。`,
    );
  }

  // ⑦ 可关掉：只报不装。
  if (env.PLANNERS_NO_AUTO_INSTALL === '1') {
    logFn(`PLANNERS_NO_AUTO_INSTALL=1 → 只报不装：${name} 不在 ${target}`);
    throw moduleNotFound(name, candidates, { env, home });
  }

  mkdirSync(resolve(root), { recursive: true });
  const staging = join(resolve(root), `.pm-staging-${name}-${process.pid}`);
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });

  logFn(`缺少公共模组 ${name}；已找过：${candidates.length ? candidates.join(' , ') : '（候选列表未传）'}`);
  const ref = moduleRef(env);
  logFn(`正在安装：来源 ${repoUrl(name)}（${ref ? `PLANNERS_MODULES_REF=${ref}，钉在这个 ref 上` : '默认分支；装的是 HEAD，不钉 tag'}）→ 目标 ${target}`);
  logFn(`安装命令：${method}`);

  try {
    if (!gitAvailable) throw new Error('本机没有 git，无法退化为 git clone');

    if (npxAvailable) {
      const npx = runner('npx', ['-y', 'skills@latest', 'add', repoUrl(name).replace(/\.git$/, ''), '--skill', name, '-y', '--copy'], {
        cwd: resolve(root),
        env: { ...env, ...(env.npm_config_cache ? {} : { npm_config_cache: join(resolve(root), '.pm-npm-cache') }) },
      });
      if (npx.status !== 0) {
        const why = (npx.stderr || npx.stdout || '').trim().split('\n').filter(Boolean).slice(-1)[0] ?? `退出码 ${npx.status}`;
        logFn(`npx skills add 不可用 → 退化为 git clone --depth 1（原因：${why}）`);
      } else {
        logFn('npx skills add 成功；但它不带 .git、也不能指定安装根，故仍以 git clone 的副本为准（可追溯 commit）');
      }
    }

    const cloneArgs = ['clone', '--depth', '1'];
    if (ref) cloneArgs.push('--branch', ref);
    cloneArgs.push(repoUrl(name), staging);
    const clone = runner('git', cloneArgs, { cwd: resolve(root), env });
    if (clone.status !== 0) {
      const reason = (clone.stderr || clone.stdout || '').trim().split('\n').slice(-3).join(' / ') || `退出码 ${clone.status}`;
      throw new Error(`git clone 失败：${reason}`);
    }

    const check = verifyInstall(staging, name);
    if (!check.ok) throw new Error(`装下来的内容没通过验证：${check.reason}`);

    const info = describeInstall(staging, runner);
    if (!info.tags.length) {
      logFn('该仓库这个 commit 上没有 tag 可钉 —— 装的是默认分支 HEAD，可追溯性靠上面的 commit');
    }
    assertInstallTargetAllowed(target, { home, libraryRoot });
    try {
      // ③ rename 原子就位；同目录同文件系统，不会出现半成品
      renameSync(staging, target);
    } catch (error) {
      if (existsSync(target)) {
        // 并发：别的进程先装好了。用先到的，丢弃自己的 staging。
        rmSync(staging, { recursive: true, force: true });
        const winner = describeInstall(target, runner);
        logFn(`并发：另一个进程先装好了 ${name} → ${target}（commit ${winner.commit ?? '未知'}），丢弃本次 staging`);
        return { path: target, action: 'reused', root, rootSource: source, method, npxAvailable, verifyPath, ...winner };
      }
      throw error;
    }

    const final = verifyInstall(target, name);
    if (!final.ok) throw new Error(`就位后复验失败：${final.reason}`);

    logFn(`已安装 ${name} ✓ commit ${info.commit ?? '未知'}｜tag：${info.tags.length
      ? info.tags.join('、') + '（默认分支当前 HEAD 正好被这个 tag 指着；适配器仍按默认分支装）'
      : '（该仓库这个 commit 上没有 tag 可钉，装的是默认分支）'}`);
    logFn(`落点：${target}（安装根来源：${source}）｜版本：${ref ? `钉在 PLANNERS_MODULES_REF=${ref}` : '默认分支 HEAD'}`
      + `｜npx 可用性：${npxAvailable ? '可用' : '不可用（已退化为 git clone）'}`);

    // ⑥ 回验：让**本适配器自己**再解析一次，确认下次一定找得到。
    if (verifyPath) {
      const resolvedByAdapter = verifyPath(name);
      if (!resolvedByAdapter) {
        throw new Error(
          `${LOG_PREFIX} 装完了，但本 Skill 的适配器仍解析不到 ${name}。\n` +
            `  已装到 ${target}；请把它放到适配器的候选路径之一，或设 PLANNERS_MODULES_HOME=${resolve(root)}。`,
        );
      }
      logFn(`回验通过：本适配器现在解析到 ${resolvedByAdapter}`);
    }

    return { path: target, action: 'installed', root, rootSource: source, method, npxAvailable, verifyPath, ...info };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    const { npx, git } = manualCommands(name, { env, home });
    throw new Error(
      `${LOG_PREFIX} 自动安装 ${name} **失败**（真实原因：${error.message}）。已清掉暂存目录 ${basename(staging)}，没有留下半成品。\n` +
        `  手动装（任选一条，可复制）：\n    ${npx}\n    ${git}`,
    );
  } finally {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  }
}
