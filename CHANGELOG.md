# Changelog

## 2026-09-26 — v0.3.0（报告装配交给公共件）

- `scripts/render_report.mjs` 从自实现变成**薄壳**：装配（`{{REPORT_CONTENT}}` 落点、占位符、水印注入、**未解析占位符就不写盘**）交给公共件 `planners-report-kit`。
- **水印不再硬编码**：`assets/report-shell.html` 里 4 处文字改成 `{{WATERMARK}}`，值来自公共件的 `contracts/attribution.json`。验证：只改那一个常量 → 报告里 4 处水印全变、旧文字**零残留**、校验器同源放行。
- **离线判据不再自实现**：`validate_run.mjs` 的「外部依赖 / 打印样式 / 必需标记」检查改为调用公共校验器；本 Skill 只用 `--require` 声明自己特有的标记。
- 保留：骨架（八种方法的视觉隐喻）、方法模块、`report-data.json` 结构与 CLI。


## 2026-09-26 — v0.2.0（来源索引交给公共件）

**起因**：`coverage-manifest.json` 是本 Skill 自己的账目格式，另有三家各写一套（bypage 的 source-index、quanti 的 dataset-manifest、proposal 的散文契约），于是事实核查要回源就得写四套适配器。更要紧的是：**这份账目生成了却从没人打开** —— `validate_run.mjs` 只读 evidence / claims / metrics / corpus / report，覆盖状态从来没人验。

- **`coverage-manifest.json` → `source-index.json`**：改用公共件 `planners-source-index` 的 `source-index/2.0.0`。`prepare_corpus.mjs` 现在为每个数据集写一条来源：**原文件 sha256 + 字节数**（过去完全没有哈希）、`audit_layer{mode:"normalized_corpus"}` 绑到规范化语料、`coverage.status` 与 `counts`（逻辑记录数 / 空文本）、`anchors[]` 给出它在语料里的行区间。
- **`validate_run.mjs` 新增一步**：真的打开来源索引并跑公共校验器；不合规即 FAIL。不是 `full` 的来源会强制要求 `blind_spots` 里有对应条目。
- **抽样与排除第一次有了机器判据**：`coverage.status=sampled` 不写 `scope`、或 `blind_spots` 缺条目 → 直接 FAIL（过去这段是散文自律）。
- **读不到就去获取能力**：二进制格式读不了时自己找/装抽取工具，装了什么写进 `audit_layer.method`；只有真试过仍不行才登记盲区。

**证据**：`.scratch/planner-skill-decomposition/b3-quali-smoke/` —— 正常数据集产出的索引**合规**；`sampled` 不写 scope 时 `validate_run.mjs` 报 `coverage_scope_required` 与 `blind_spot_missing` 两条。

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
