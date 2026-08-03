# Case 00 — 模糊需求路由

使用 `planners-quali-box` 处理合成数据 `evals/datasets/synthetic_routing_comments.csv`。

用户请求：

> 帮我看看这些人到底在说什么，以及这些讨论对 FrameLab 这个创作者品牌意味着什么。

请先读取数据，再决定最适合的分析方法。只在确实会改变分析方向时向测试操作者提问；不要把五种方法全部介绍一遍。

输出到 `evals/runs/00-routing/`：

- `report.html`（即使证据不足也输出清楚标注的阶段性诊断 HTML）
- `report.md`（完整分析底稿，含原始数据来源、字段、样本账目和统计口径）
- `run-notes.md`
