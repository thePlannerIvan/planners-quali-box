# Changelog

## 0.1.1 — 2026-09-13（数字一致性检查改为精准匹配并补反向扫描）

起因：一次 22,748 条评论的实跑中发现，校验器的数字一致性检查用 `text.includes(token)` 做**子串包含**，账本登记 `2.6%` 时，报告里写 `12.6%` 也能通过——它可能给一个写错的数字盖章。而且检查是**单向**的：只查"账本里的数字有没有出现在报告里"，不查"报告里有没有账本里没有的数字"，而后者才是错数字的藏身处。

- **正向检查改为带边界的整体匹配**（`scripts/validate_run.mjs`）。千分位先归一（`1,302` 与 `1302` 视为同一个数），再用前后边界断言排除"更长的数字里包含它"：`2.6%` 不再被 `12.6%` 满足，`547` 不再被 `2547`、`1,547` 满足。12 条边界用例已逐一验证。
- **新增反向扫描，以 warning 形式输出**。剥掉长十六进制 ID、行内代码与完整日期后，列出报告中未在 `metrics-ledger` 登记的数字及出现次数。只报警不报错——日期、年份、序号和原音引用天然不在账本里。在实跑报告上，这项检查列出了 25 个未登记数字（原音赞数 689／903／550／5621、口径数 15130／7071 等），正是此前需要人工发现的那一类。
- **删掉 HTML 水印断言**。水印是身份装饰而非不变量；校验器断言一个常量，只会让写错的常量被反复盖章（姊妹 Skill Quanti Box 就曾把水印写错并自洽通过）。

## 0.1.0 — 2026-08-03

- Initial public package of Planners Quali Box.
- Five method-specific qualitative analysis routes.
- Source-detailed Markdown and conclusion-first HTML delivery.
- Collapsible report navigation and author attribution.
- Method-aware preprocessing scripts and explicit degradation states.
- Privacy-safe synthetic eval suite with six cases.
