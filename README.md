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

## 授权、署名与商业支持

- 以 [AGPL-3.0-only](LICENSE) 发布；
- 请保留 [NOTICE](NOTICE) 中的项目来源；
- 修改版须标明 fork 或改动，且不得暗示作者背书，详见 [TRADEMARK.md](TRADEMARK.md)；
- 闭源授权、私有部署、团队工作流定制、培训和咨询见 [COMMERCIAL.md](COMMERCIAL.md)。

## English summary

Planners Quali Box is a traceable qualitative decision-analysis Skill. It routes a corpus to one suitable method, requires explicit approval before formal analysis, audits claims against evidence and counter-evidence, and delivers Markdown plus an offline single-file HTML report.
