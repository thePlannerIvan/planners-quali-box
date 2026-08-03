# Planners Quali Box

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Codex Skill](https://img.shields.io/badge/Codex-Skill-111111)](SKILL.md)
[![Claude compatible](https://img.shields.io/badge/Claude-compatible-D97757)](SKILL.md)

一个面向社媒笔记、评论、搜索词与竞品内容的定性分析 Skill。它把五种不同的问题框架放进同一入口，但保留每种方法各自的数据处理、推理 Gate 与报告形态。

作者：**阿祖不看 TVC**<br>
网站：[demyth.info](https://demyth.info) · 邮箱：[Lawyif@163.com](mailto:Lawyif@163.com) · GitHub：[@thePlannerIvan](https://github.com/thePlannerIvan)

## 它解决什么问题

| 研究问题 | 路由方法 | 典型产出 |
|---|---|---|
| 消费者情绪背后的人性真相与文化张力是什么 | Ogilvy 社交情绪洞察 | 深度地图、文化张力、证据卡 |
| 品牌占据怎样的情感空间 | NeedScope | 二维情感空间、当前位置与机会区 |
| 品牌想让谁采取什么行动、靠什么说服 | GWTB | GET / WHO / TO / BY 策略板 |
| 品类惯例在哪里失效 | TBWA | 惯例、疲劳、愿景与颠覆路径 |
| 哪组文化对立正在发生结构变化 | Lévi-Strauss | 二元对立、转换候选与趋势边界 |

无论选择哪种方法，报告都遵守同一套审阅契约：结论可反驳、证据可回溯、反证可见、置信度有解释、边界不隐藏。

## 核心工作流

```text
研究问题与原始数据
  → 登记来源、字段、样本账目与证据角色
  → 选择一个最匹配的方法
  → 运行该方法专属的预处理与推理链
  → 审阅证据、反证、置信度与边界
  → report.md（完整分析底稿）
  → report.html（结论优先、可导航的单文件阅读版）
```

## 适合与不适合

适合：

- 已有 CSV、TSV、JSON、XLSX、TXT 或 Markdown 形式的文本数据；
- 需要把大量社媒材料变成可审阅、可追溯的策略判断；
- 希望同时保留 Markdown 分析底稿与 HTML 决策阅读版；
- 愿意明确数据边界，而不是把定性样本伪装成总体民调。

不适合：

- 没有数据却要求确定性消费者结论；
- 需要正式 NeedScope 量表、代表性抽样或统计推断；
- 只想得到词云、泛化摘要或自动生成的品牌口号；
- 要求把五种方法混成一个统一分数。

## 安装

以下命令在 canonical GitHub 仓库发布后可用：

使用 Skills CLI：

```bash
npx skills add https://github.com/thePlannerIvan/planners-quali-box --skill planners-quali-box
```

或手动安装到 Claude Skills：

```bash
git clone https://github.com/thePlannerIvan/planners-quali-box.git ~/.claude/skills/planners-quali-box
```

也可以克隆后将完整目录复制到 `~/.codex/skills/planners-quali-box`。

## 依赖

基础报告生成不依赖联网资源。脚本使用 Python 3.10+；不同方法按需使用：

- 通用文本预处理：`jieba`
- 表格输入：`openpyxl` 或 `xlrd`
- 轻量聚类：`scikit-learn`
- Ogilvy 大样本语义主题路线：见 [`scripts/requirements-ogilvy.txt`](scripts/requirements-ogilvy.txt)

缺少可选依赖时，Skill 必须在报告中明确写出降级状态，不得把未聚类结果描述成等价分析。

## 典型 Prompt

```text
使用 $planners-quali-box 分析这批社媒评论。
我想理解消费者情绪背后的人性真相与文化张力。
请先登记每个原始文件的数据来源、字段、样本账目与清洗规则，
最后同时交付 report.md 和结论优先、可隐藏导航的 report.html。
```

```text
使用 $planners-quali-box 比较三个品牌的传播策略。
先判断每条内容是官方表达、商业合作还是消费者内容，
再为每个品牌分别拆解一套 GET / WHO / TO / BY。
证据不足的格子保留不确定，不要补写成事实。
```

## 目录结构

```text
planners-quali-box/
├── SKILL.md                 # Skill 路由、流程与完成 Gate
├── agents/openai.yaml       # Codex/Agent 展示配置
├── assets/                  # Markdown/HTML 模板与五种方法模块
├── references/              # 方法说明、边界与脚本路由
├── scripts/                 # 可复现的预处理脚本
└── evals/                   # 合成数据、测试 Prompt 与评分规则
```

## 数据与隐私

仓库中的 eval 数据全部为虚构合成数据，仅用于检查流程、溯源和报告结构。请勿提交真实客户资料、平台 Cookie、访问令牌、私人账号信息或未经许可的社媒全量导出。更多说明见 [`SECURITY.md`](SECURITY.md)。

## 方法名称与项目归属

Ogilvy、NeedScope、BBDO、GWTB、TBWA 及 Lévi-Strauss 等名称仅用于描述分析框架或学术来源。本项目不是相关机构的官方产品，也不代表其背书。详见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

Planners Quali Box 与“阿祖不看 TVC”的项目名称、标识和官方来源不随代码许可证自动授权。Fork 可以说明来源，但不得暗示是官方版本。详见 [`TRADEMARK.md`](TRADEMARK.md)。

## 许可证与商业合作

代码与原创文档采用 [GNU AGPL-3.0](LICENSE) 发布。商业使用并未被禁止，但修改版及网络服务需要遵守 AGPL 的对应源码义务。

私有部署、企业模板适配、闭源商业授权、工作流定制、培训与咨询请查看 [`COMMERCIAL.md`](COMMERCIAL.md)。
