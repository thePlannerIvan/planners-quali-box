/**
 * 共享安装器的不变量测试（JS 侧）。**与 py 侧的 planners_modules_install_test.py 断言同一套规则**：
 *   ① 安装根优先级（env → install_dir → home 目录）
 *   ② 禁地断言（库工作树内 / runtime 技能目录 / 系统目录）
 *   ③ 用户级候选**永远排在最后**（绝不遮蔽已发布副本）
 *   ④ 装完的验证（空目录 / 缺锚点 / 缺 SKILL.md 都算失败）
 *   ⑤ 幂等（第二次不重装、不 clone）
 *   ⑥ 失败路径不留 staging、报错里带可复制手动命令
 *   ⑦ PLANNERS_NO_AUTO_INSTALL=1 → 只报不装
 *
 * 真·联网安装不在这里测（单测不许碰网）：见 adapters 的验收脚本。
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LOG_PREFIX,
  MODULE_SPECS,
  assertInstallTargetAllowed,
  ensureModule,
  installRootFor,
  manualCommands,
  moduleRef,
  moduleNotFound,
  verifyInstall,
} from './planners-modules-install.mjs';
import { libraryRootFor, moduleCandidates } from './planners-modules.mjs';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const LIBRARY_ROOT = (() => {
  let current = HERE;
  for (let depth = 0; depth < 12; depth += 1) {
    if (current.endsWith('/02-skills-library')) return current;
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
})();

const MODULE = 'planners-source-index';

function scratch() {
  return mkdtempSync(join(tmpdir(), 'pm-install-test-'));
}

/** 造一份「像真的装好了」的模组夹具。 */
function fakeModule(root, name = MODULE) {
  const dir = join(root, name);
  for (const anchor of MODULE_SPECS[name].anchors) {
    const target = join(dir, ...anchor.split('/'));
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, '# fixture\n');
  }
  return dir;
}

/** 假 runner：把 clone 模拟成「从 fixture 复制」，其余命令照实报告。 */
function fakeRunner({ fixture, cloneStatus = 0, cloneStderr = '' } = {}) {
  const calls = [];
  const runner = (command, args, options = {}) => {
    calls.push([command, ...args].join(' '));
    if (command === 'git' && args[0] === 'clone') {
      if (cloneStatus !== 0) return { status: cloneStatus, stdout: '', stderr: cloneStderr };
      cpSync(fixture, args[args.length - 1], { recursive: true });
      return { status: 0, stdout: '', stderr: '' };
    }
    if (command === 'git' && args.includes('rev-parse')) return { status: 0, stdout: 'deadbeef\n', stderr: '' };
    if (command === 'git' && args.includes('tag')) return { status: 0, stdout: '', stderr: '' };
    if (command === 'npx' || command === 'git') return { status: 0, stdout: 'v1\n', stderr: '' };
    return { status: 1, stdout: '', stderr: 'not found' };
  };
  runner.calls = calls;
  return runner;
}

/** 假 runner 的变体：可以指定 `git tag --points-at HEAD` 的输出。 */
function fakeRunnerWith({ fixture, tags = '' }) {
  const base = fakeRunner({ fixture });
  const runner = (command, args, options = {}) => {
    if (command === 'git' && args.includes('tag')) return { status: 0, stdout: tags, stderr: '' };
    return base(command, args, options);
  };
  return runner;
}

test('① 安装根优先级：install_dir > home(含该模组/不存在) > 默认 ~/.planners-modules', () => {
  const home = join(scratch(), 'home');
  mkdirSync(home, { recursive: true });

  assert.equal(
    installRootFor({ name: MODULE, env: { PLANNERS_MODULES_INSTALL_DIR: '/tmp/explicit' }, home }).root,
    '/tmp/explicit',
  );
  assert.equal(
    installRootFor({ name: MODULE, env: { PLANNERS_MODULES_HOME: '/tmp/not-there-yet' }, home }).root,
    '/tmp/not-there-yet',
  );
  assert.equal(installRootFor({ name: MODULE, env: {}, home }).root, join(home, '.planners-modules'));

  // PLANNERS_MODULES_HOME 指向一个「存在但里面没有这个模组」的目录 → 不许往里塞。
  const foreign = join(home, 'somewhere-else');
  mkdirSync(foreign, { recursive: true });
  assert.equal(
    installRootFor({ name: MODULE, env: { PLANNERS_MODULES_HOME: foreign }, home }).root,
    join(home, '.planners-modules'),
  );
});

test('② 禁地断言：库工作树内 / runtime 技能目录 / 系统目录一律拒绝', () => {
  assert.ok(LIBRARY_ROOT && LIBRARY_ROOT.endsWith('/02-skills-library'), '测试没找到库根');
  const home = '/tmp/pm-home';
  const inside = join(LIBRARY_ROOT, '00-system', MODULE);
  assert.throws(() => assertInstallTargetAllowed(inside, { home, libraryRoot: LIBRARY_ROOT }), /工作树内/);
  assert.throws(
    () => assertInstallTargetAllowed(join(home, '.claude', 'skills', MODULE), { home }),
    /runtime 技能目录/,
  );
  assert.throws(
    () => assertInstallTargetAllowed(join(home, '.codex', 'skills', MODULE), { home }),
    /runtime 技能目录/,
  );
  assert.throws(() => assertInstallTargetAllowed('/usr/lib/' + MODULE, { home }), /系统目录/);
  assert.doesNotThrow(() =>
    assertInstallTargetAllowed(join(home, '.planners-modules', MODULE), { home, libraryRoot: LIBRARY_ROOT }));
});

test('③ 用户级候选永远排在最后（不许遮蔽已发布副本 / monorepo 副本）', () => {
  const candidates = moduleCandidates(MODULE);
  assert.ok(candidates.length > 1);
  assert.equal(candidates[candidates.length - 1], join(installRootFor({ name: MODULE }).root, MODULE));
  const repoCopies = candidates.slice(0, -1).filter(c => c.includes('02-skills-library'));
  assert.ok(repoCopies.length > 0, '原有候选被弄丢了');
  for (const candidate of repoCopies) {
    assert.ok(candidates.indexOf(candidate) < candidates.length - 1);
  }
});

test('④ 装完的验证：空目录 / 只有 .git / 缺锚点 都算失败', () => {
  const root = scratch();
  const empty = join(root, 'empty');
  mkdirSync(empty, { recursive: true });
  assert.equal(verifyInstall(empty, MODULE).ok, false);

  const gitOnly = join(root, 'gitonly');
  mkdirSync(join(gitOnly, '.git'), { recursive: true });
  const gitOnlyResult = verifyInstall(gitOnly, MODULE);
  assert.equal(gitOnlyResult.ok, false);
  assert.match(gitOnlyResult.reason, /空的/);

  const partial = join(root, 'partial');
  mkdirSync(partial, { recursive: true });
  writeFileSync(join(partial, 'SKILL.md'), '# partial\n');
  const partialResult = verifyInstall(partial, MODULE);
  assert.equal(partialResult.ok, false);
  assert.match(partialResult.reason, /缺声明的契约\/校验器/);
  assert.ok(partialResult.missing.includes('contracts/source-index.schema.json'));

  assert.equal(verifyInstall(fakeModule(root), MODULE).ok, true);
});

test('⑤ 幂等：第二次不 clone、不覆盖，并报「已装好」', () => {
  const root = scratch();
  const installDir = join(root, 'modules');
  const fixture = fakeModule(join(root, 'fixture'));
  const runner = fakeRunner({ fixture });
  const logs = [];
  const options = {
    env: { PLANNERS_MODULES_INSTALL_DIR: installDir },
    home: root,
    runner,
    libraryRoot: LIBRARY_ROOT,
    log: message => logs.push(message),
  };

  const first = ensureModule(MODULE, options);
  assert.equal(first.action, 'installed');
  assert.equal(first.commit, 'deadbeef');
  assert.deepEqual(first.tags, []);
  const clonesAfterFirst = runner.calls.filter(call => call.startsWith('git clone')).length;
  assert.equal(clonesAfterFirst, 1);

  const second = ensureModule(MODULE, options);
  assert.equal(second.action, 'reused');
  assert.equal(runner.calls.filter(call => call.startsWith('git clone')).length, clonesAfterFirst);
  assert.ok(logs.some(line => line.includes('已装好，不需要重装')), '第二次必须说「已装好」');
  assert.ok(!readdirSync(installDir).some(entry => entry.startsWith('.pm-staging-')), 'leftover staging');
});

test('⑥ 失败路径：删 staging、如实报错、带可复制手动命令', () => {
  const root = scratch();
  const installDir = join(root, 'modules');
  const fixture = fakeModule(join(root, 'fixture'));
  const runner = fakeRunner({ fixture, cloneStatus: 128, cloneStderr: 'fatal: unable to access repository' });
  const logs = [];

  let thrown = null;
  try {
    ensureModule(MODULE, {
      env: { PLANNERS_MODULES_INSTALL_DIR: installDir },
      home: root,
      runner,
      libraryRoot: LIBRARY_ROOT,
      log: message => logs.push(message),
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown, 'clone 失败必须抛错，不许假装成功');
  assert.match(thrown.message, /自动安装 .* 失败/);
  assert.match(thrown.message, /unable to access repository/);
  assert.match(thrown.message, /git clone --depth 1 https:\/\/github\.com\/thePlannerIvan\//);
  assert.match(thrown.message, /npx skills add /);
  assert.ok(!existsSync(join(installDir, MODULE)), '失败后不该留下模组目录');
  assert.ok(!readdirSync(installDir).some(entry => entry.startsWith('.pm-staging-')), 'staging 没清干净');
});

test('⑦ PLANNERS_NO_AUTO_INSTALL=1：只报不装，且报出缺哪个 / 找过哪些 / 手动怎么装', () => {
  const root = scratch();
  const installDir = join(root, 'modules');
  const candidateList = [join(root, 'sibling', MODULE), join(installDir, MODULE)];
  const runner = fakeRunner({ fixture: fakeModule(join(root, 'fixture')) });
  const logs = [];

  assert.throws(
    () => ensureModule(MODULE, {
      env: { PLANNERS_MODULES_INSTALL_DIR: installDir, PLANNERS_NO_AUTO_INSTALL: '1' },
      home: root,
      runner,
      libraryRoot: LIBRARY_ROOT,
      candidates: candidateList,
      log: message => logs.push(message),
    }),
    (error) => {
      assert.match(error.message, /找不到公共模组 planners-source-index/);
      for (const candidate of candidateList) assert.ok(error.message.includes(candidate), '报错要列出找过的路径');
      assert.match(error.message, /npx skills add https:\/\/github\.com\/thePlannerIvan\/planners-source-index/);
      assert.match(error.message, /git clone --depth 1 /);
      return true;
    },
  );
  assert.ok(!runner.calls.some(call => call.startsWith('git clone')), '禁止安装时一个 clone 都不许发');
  assert.ok(!existsSync(installDir), '禁止安装时连安装根都不该建');
  assert.ok(logs.some(line => line.includes('只报不装')), '必须说出来「只报不装」');
  assert.ok(logs.every(line => line.startsWith(LOG_PREFIX) || line.length > 0));
});

test('⑧ 目标已在位但验不过 → 拒绝覆盖（不静默重装）', () => {
  const root = scratch();
  const installDir = join(root, 'modules');
  const broken = join(installDir, MODULE);
  mkdirSync(broken, { recursive: true });
  writeFileSync(join(broken, 'README.md'), 'not a module\n');
  assert.throws(
    () => ensureModule(MODULE, {
      env: { PLANNERS_MODULES_INSTALL_DIR: installDir },
      home: root,
      runner: fakeRunner({ fixture: fakeModule(join(root, 'fixture')) }),
      libraryRoot: LIBRARY_ROOT,
      log: () => {},
    }),
    /没通过验证/,
  );
  assert.equal(readFileSync(join(broken, 'README.md'), 'utf8'), 'not a module\n', '不许动已有目录');
});

test('⑨ manualCommands 给出的命令真的可复制（含绝对落点）', () => {
  const commands = manualCommands(MODULE, { env: {}, home: '/tmp/pm-home' });
  assert.equal(commands.root, '/tmp/pm-home/.planners-modules');
  assert.equal(
    commands.npx,
    'npx skills add https://github.com/thePlannerIvan/planners-source-index --skill planners-source-index',
  );
  assert.equal(
    commands.git,
    'git clone --depth 1 https://github.com/thePlannerIvan/planners-source-index.git "/tmp/pm-home/.planners-modules/planners-source-index"',
  );
  assert.ok(moduleNotFound(MODULE, ['/a', '/b']).message.includes('/a'));
});

test('⑩ 适配器自己认得出「库根」，所以「不许装进库」的闸真的会拦', () => {
  const here = resolve(fileURLToPath(import.meta.url), '..');
  const detected = libraryRootFor(here);
  assert.ok(detected, '适配器没认出库根，库内安装就拦不住了');
  assert.ok(LIBRARY_ROOT.startsWith(detected) || detected === LIBRARY_ROOT, `认错了库根：${detected}`);
  assert.throws(
    () => assertInstallTargetAllowed(join(detected, '00-system', MODULE), { libraryRoot: detected }),
    /工作树内/,
  );
});

test('⑪ 闸不会误杀：skill 父目录里躺着模组 ≠ 库根（那是合法安装根）', () => {
  const root = scratch();
  const home = join(root, 'home');
  const installDir = join(home, '.planners-modules');   // 装完之后就会「住着两个模组目录」
  mkdirSync(join(installDir, 'planners-review-core'), { recursive: true });
  mkdirSync(join(installDir, 'planners-source-index'), { recursive: true });
  const detected = libraryRootFor(join(root, 'planners-bypage', 'scripts', 'lib'));
  assert.equal(detected, null, `把普通目录认成了库根：${detected}`);
  assert.doesNotThrow(() =>
    assertInstallTargetAllowed(join(installDir, MODULE), { home, libraryRoot: detected }));
});

test('⑫ 无 tag 时必须说出来「没有 tag 可钉」（有 tag 时就报 tag）', () => {
  const root = scratch();
  const logsNoTag = [];
  const options = fixtureHome => ({
    env: { PLANNERS_MODULES_INSTALL_DIR: join(fixtureHome, 'modules') },
    home: fixtureHome,
    runner: fakeRunnerWith({ fixture: fakeModule(join(fixtureHome, 'fixture')), tags: '' }),
    libraryRoot: LIBRARY_ROOT,
    log: message => logsNoTag.push(message),
  });
  const homeA = join(root, 'a');
  const result = ensureModule(MODULE, options(homeA));
  assert.deepEqual(result.tags, []);
  assert.ok(logsNoTag.some(line => line.includes('没有 tag 可钉')), '无 tag 时必须明说');

  const logsTagged = [];
  const homeB = join(root, 'b');
  const tagged = ensureModule(MODULE, {
    env: { PLANNERS_MODULES_INSTALL_DIR: join(homeB, 'modules') },
    home: homeB,
    runner: fakeRunnerWith({ fixture: fakeModule(join(homeB, 'fixture')), tags: 'v1.0.0\n' }),
    libraryRoot: LIBRARY_ROOT,
    log: message => logsTagged.push(message),
  });
  assert.deepEqual(tagged.tags, ['v1.0.0']);
  assert.ok(logsTagged.some(line => line.includes('tag：v1.0.0')), '有 tag 时要把 tag 打出来');
  assert.ok(!logsTagged.some(line => line.includes('没有 tag 可钉')), '有 tag 时不许说没有');
});

test('⑬ PLANNERS_MODULES_REF：设了就 --branch 钉上，不设就装 HEAD', () => {
  const root = scratch();
  const fixture = fakeModule(join(root, 'fixture'));

  const runnerPinned = fakeRunner({ fixture });
  const homePinned = join(root, 'pinned');
  const pinned = ensureModule(MODULE, {
    env: { PLANNERS_MODULES_INSTALL_DIR: join(homePinned, 'modules'), PLANNERS_MODULES_REF: 'v1.0.0' },
    home: homePinned,
    runner: runnerPinned,
    libraryRoot: LIBRARY_ROOT,
    log: () => {},
  });
  assert.equal(moduleRef({ PLANNERS_MODULES_REF: 'v1.0.0' }), 'v1.0.0');
  assert.equal(moduleRef({}), null, '不设就得是 null（= 装默认分支 HEAD）');
  const cloneCalls = runnerPinned.calls.filter(call => call.startsWith('git clone'));
  assert.equal(cloneCalls.length, 1);
  assert.match(cloneCalls[0], /--branch v1\.0\.0/, '钉版本时必须带 --branch');
  assert.ok(pinned.commit, '钉了也要报 commit');

  const runnerHead = fakeRunner({ fixture });
  const homeHead = join(root, 'head');
  ensureModule(MODULE, {
    env: { PLANNERS_MODULES_INSTALL_DIR: join(homeHead, 'modules') },
    home: homeHead,
    runner: runnerHead,
    libraryRoot: LIBRARY_ROOT,
    log: () => {},
  });
  const headClone = runnerHead.calls.find(call => call.startsWith('git clone'));
  assert.ok(!headClone.includes('--branch'), '默认不许钉，跟着 HEAD 走');
});

test('⑭ REF 指到一个不存在的 ref：如实失败、不留半成品、不悄悄退回 HEAD', () => {
  const root = scratch();
  const installDir = join(root, 'modules');
  const fixture = fakeModule(join(root, 'fixture'));
  const runner = fakeRunner({
    fixture,
    cloneStatus: 128,
    cloneStderr: "fatal: Remote branch v9.9.9 not found in upstream origin",
  });
  let thrown = null;
  try {
    ensureModule(MODULE, {
      env: { PLANNERS_MODULES_INSTALL_DIR: installDir, PLANNERS_MODULES_REF: 'v9.9.9' },
      home: root,
      runner,
      libraryRoot: LIBRARY_ROOT,
      log: () => {},
    });
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, '坏 ref 必须失败');
  assert.match(thrown.message, /not found in upstream origin/);
  assert.match(thrown.message, /--branch v9\.9\.9/, '手动命令要把钉错的那个 ref 也带出来');
  assert.ok(!existsSync(join(installDir, MODULE)));
  assert.ok(!readdirSync(installDir).some(entry => entry.startsWith('.pm-staging-')));
  assert.equal(verifyInstall(join(installDir, MODULE), MODULE).ok, false);
});
