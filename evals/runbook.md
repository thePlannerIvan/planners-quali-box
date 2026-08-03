# Planners Quali Box — 外部模型测试包

## 怎么用

每个测试启动一个干净任务，只给执行模型：

1. 完整的 `planners-quali-box/` Skill 目录（至少含 `SKILL.md`、`references/`、`assets/`、`scripts/`）
2. 对应的 `prompts/0x-*.md`
3. Prompt 中列出的数据文件
4. 一个空输出目录

不要把 `evals.json`、`rubric.md`、历史输出或本轮诊断结论给执行模型。

执行结束后，再让另一个 Judge 模型或人工读取完整产物，按 `rubric.md` 评分。

## 测试集

公开仓库只包含人工编写的虚构合成数据，用于流程冒烟、证据追溯和报告验收。它不替代使用经过授权的大样本做方法效果评估。

| Case | 方法 | 数据 | 合成记录数 | 重点 |
|---|---|---:|---:|---|
| 00 | 路由 | `synthetic_routing_comments.csv` | 15 | 是否先读数据、少问问题 |
| 01 | Ogilvy | `synthetic_campaign_comments.csv` | 25 | 情绪深化、活动噪声与反证 |
| 02 | NeedScope | `synthetic_needscope_comments.csv` | 18 | 六空间定位、signal owner、报告主图 |
| 03 | GWTB | 三份 `synthetic_gwtb_*.csv` | 24 | 官方属性判断、轻量词频、三品牌对比 |
| 04 | TBWA | `synthetic_bistro_comments.csv` | 20 | 真习俗而非普通抱怨 |
| 05 | Lévi-Strauss | `synthetic_bistro_comments.csv` | 20 | 稳定对立、真实 checkpoint、趋势边界 |

记录数使用 `qsv count` 校验，不使用物理行数，因为 CSV 文本可能包含换行。

若要测试 Ogilvy 大样本语义聚类、长尾主题稳定性或跨平台泛化，应另建不提交仓库的私有 benchmark，并使用拥有处理权限的数据。

## 输出约定

每个 Case 单独输出：

- `report.md`（完整分析底稿，必须详细登记原始数据来源）
- `report.html`（结论优先的阅读版，必须单文件离线可读）
- `work/` 中真正需要回源或恢复的文件
- `run-notes.md`：使用了哪些脚本、遇到什么缺口、哪些步骤没有执行及原因

Judge 还应横向比较五个方法的 HTML：证据审阅语言应一致，但主图、页面节奏和信息结构必须能一眼辨认方法身份。
同时核对 Markdown 与 HTML 的结论、数字、source_id 和限制是否一致；检查 HTML 导航可隐藏且水印可见。
