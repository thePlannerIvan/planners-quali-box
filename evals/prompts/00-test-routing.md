# Case 00 — 模糊需求路由

使用 `planners-quali-box` 处理 `evals/datasets/tim_comments.csv`。

用户请求：

> 帮我看看这些人到底在说什么，以及这些讨论对影视飓风这个品牌意味着什么。

请先读取数据并推荐最适合的分析方法。按 Skill 的 CP0 要求向测试操作者说明分析方案并等待真实确认；不要把所有方法逐一介绍，也不要在确认前开始正式分析。

输出到 `evals/runs/00-routing/`：

- `report.html`（即使证据不足也输出清楚标注的阶段性诊断 HTML）
- `report.md`（完整分析底稿，含原始数据来源、字段、样本账目和统计口径）
- `run-notes.md`
