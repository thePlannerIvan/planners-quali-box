# Planners Quali Box

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-2563eb)](LICENSE)

面向社媒笔记、评论、搜索词、开放题、访谈摘录与品牌内容的定性决策分析 Skill。它先检查材料能否支持某种判断，说明推荐方法、预期信息和边界，等待确认后再形成可追溯的 Markdown 与离线单文件 HTML 报告。

> 作者：阿祖不看 TVC（小红书同名） · [demyth.info](https://demyth.info) · [Lawyif@163.com](mailto:Lawyif@163.com)

## 它解决什么

它把“从一堆原话中找洞察”变成有证据边界的研究流程：

```text
原始材料 → 语料与证据体检 → 方法推荐 → 用户确认
→ 规范化与小样本校准 → 方法专属分析 → 反证审计
→ Markdown + 离线 HTML 报告
```

Skill 在 Ogilvy、NeedScope、GWTB、TBWA、Levi-Strauss、消费任务与价值链、品牌关系、品牌社群之间路由；默认只选择一个主方法，且不会把不同方法压成一个综合评分。

## 适用与不适用

适合：有可回到原始语境的消费者表达或品牌内容，需要形成消费者、品牌、沟通或品类判断的任务。

不适合：只有结构化指标、需要显著性检验或预测的任务（请用 [Planners Quanti Box](https://github.com/thePlannerIvan/planners-quanti-box)）；也不把公开网页抓取直接称作完整网络志。

## 安装

```bash
npx skills add https://github.com/thePlannerIvan/planners-quali-box --skill planners-quali-box
```

## 公共模组（缺了会自动装）

本 Skill 依赖若干**公共模组**（独立发布的条目，不是本仓库的一部分）：

- [`planners-review-core`](https://github.com/thePlannerIvan/planners-review-core) —— 审阅面契约、桥与本地宿主
- [`planners-source-index`](https://github.com/thePlannerIvan/planners-source-index) —— 来源索引契约与唯一校验器
- [`planners-fact-check`](https://github.com/thePlannerIvan/planners-fact-check) —— 事实核查契约与校验器
- [`planners-report-kit`](https://github.com/thePlannerIvan/planners-report-kit) —— 报告装配与校验（仅带报告出口的 Skill 需要）

某个模组不在本地时，本 Skill 的适配器会**自动从 GitHub 装它**，不需要手动准备。适配器找的地方按顺序：

1. `$PLANNERS_MODULES_HOME/<模组名>`
2. 本 Skill 的兄弟目录 `<skills-root>/<模组名>`（发布后的主路径）
3. monorepo 里 `02-skills-library/<分类>/<模组名>`
4. **用户级安装根**：`$PLANNERS_MODULES_INSTALL_DIR` → `$PLANNERS_MODULES_HOME`（仅当它已含该模组，或那目录还不存在）→ 默认 `~/.planners-modules/<模组名>`

前三条都没有时才自动安装（顺序不变，**本地永远优先、不会无条件联网**）；装到第 4 条那个**库外**用户级目录，**绝不写进** `02-skills-library` 工作树、`~/.codex|~/.claude|~/.gemini` 的技能目录、或任何系统目录。安装过程**不静默**：会打印缺哪个、找过哪些路径、从哪个 URL 装、装到哪、用的是 `git clone --depth 1` 还是 `npx skills add`、以及装到的 **commit**。装完先在暂存目录里验证（`SKILL.md` + 该模组声明的契约/校验器锚点文件都在），再用 rename 原子就位；**任何失败都会清掉暂存、不留半成品**，并给出可复制的手动安装命令。

要它**只报不装**（CI／离线／审计）：

```bash
PLANNERS_NO_AUTO_INSTALL=1 <你的命令>
```

| 环境变量 | 作用 |
|---|---|
| `PLANNERS_MODULES_HOME` | 指定已有模组所在目录（解析第 1 条，也兼作安装根） |
| `PLANNERS_MODULES_INSTALL_DIR` | 只指定**自动安装**的落点（优先级高于上面那条） |
| `PLANNERS_MODULES_REF` | 要钉的 tag 或分支（不设 = 装默认分支 HEAD） |
| `PLANNERS_NO_AUTO_INSTALL=1` | 只报不装；缺依赖时如实失败并打印手动命令 |

装的是**默认分支 HEAD**，日志里**永远打 commit**；HEAD 恰好被某个 tag 指着时，tag 也一并打出来。想钉版本就设 `PLANNERS_MODULES_REF`：

```bash
PLANNERS_MODULES_REF=v1.0.0 <你的命令>     # 钉在 tag 上
PLANNERS_MODULES_REF=main   <你的命令>     # 钉在某个分支上
```

钉了不存在的 ref 会**如实失败**（不会悄悄退回 HEAD），错误里带正确的可复制命令。

### 两条命令别搞混：谁装 Skill，谁抓依赖

**用户装一个 Skill** —— 用 Skills CLI，它会把条目放进各 agent 的技能目录：

```bash
npx skills add https://github.com/thePlannerIvan/<Skill 名> --skill <Skill 名>
```

**Skill 自己抓一个公共模组（内部依赖）** —— 用 `git clone`，落在库外的单一安装根：

```bash
git clone --depth 1 https://github.com/thePlannerIvan/<模组名>.git \
  "$HOME/.planners-modules/<模组名>"
# 想钉版本：加 --branch v1.0.0
```

**内部依赖为什么不走 `npx skills add`**：它没有 `--dir` 之类的落点参数，只会写进 `~/.claude/skills`、`~/.codex/skills` 这类 **runtime 技能目录**（那是发布器的领地，写进去等于多一份漂移副本）；而且它下载的目录**不带 `.git`**，拿不到 commit、也就没法追溯装的是哪一版。**门面命令归用户，内部依赖归 clone** —— 上面自动安装走的就是这条。

> 自动安装器自己的不变量测试（安装根优先级、禁地断言、候选顺序、幂等、失败清理、只报不装）：
> `node --test scripts/lib/planners-modules-install.test.mjs`



或克隆到本地 Skill 目录：

```bash
git clone https://github.com/thePlannerIvan/planners-quali-box.git ~/.codex/skills/planners-quali-box
# 或
git clone https://github.com/thePlannerIvan/planners-quali-box.git ~/.claude/skills/planners-quali-box
```

## 使用

```text
使用 $planners-quali-box，检查这些消费者评论/访谈材料，
推荐适合的方法、预期能回答什么和不能回答什么；先等我确认，再做正式分析。
```

正式分析前必须通过 CP0：用户对当前数据、研究范围与精确方法方案作出明确批准。没有批准时，Skill 只交付诊断与方案，不会伪造最终洞察。

## 开发与验证

```bash
node scripts/test_evidence_pipeline.mjs
```

仓库不包含真实社媒抓取样本或带用户标识的评估数据。请使用自己的已授权材料，或自行准备脱敏数据来运行完整评估。

## 目录结构

```text
planners-quali-box/
├── SKILL.md
├── agents/openai.yaml
├── assets/              # 报告骨架、样式指南与八种方法的视觉隐喻页
├── evals/               # 合成数据集、夹具、方法测试提示与评分标准
├── references/          # 方法定义、方法路由、辅助镜头、方法来源
├── scripts/             # 语料准备、分析、证据校验、报告装配与渲染
└── stages/              # 00–06 分阶段工作流
```

## 授权、署名与商业支持

- 以 [AGPL-3.0-only](LICENSE) 发布；
- 请保留 [NOTICE](NOTICE) 中的项目来源；
- 修改版须标明 fork 或改动，且不得暗示作者背书，详见 [TRADEMARK.md](TRADEMARK.md)；
- 闭源授权、私有部署、团队工作流定制、培训和咨询见 [COMMERCIAL.md](COMMERCIAL.md)。

## English summary

Planners Quali Box is a traceable qualitative decision-analysis Skill. It routes a corpus to one suitable method, requires explicit approval before formal analysis, audits claims against evidence and counter-evidence, and delivers Markdown plus an offline single-file HTML report.
