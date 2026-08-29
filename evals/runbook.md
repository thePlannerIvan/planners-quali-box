# Planners Quali Box — 外部模型测试包

## 怎么用

每个测试启动一个干净任务，只给执行模型：

1. 完整的 `planners-quali-box/` Skill 目录（至少含 `SKILL.md`、`references/`、`assets/`、`scripts/`）
2. 对应的 `prompts/0x-*.md`
3. Prompt 中列出的数据文件
4. 一个空输出目录

不要把 `evals.json`、`rubric.md`、历史输出或本轮诊断结论给执行模型。

每个测试至少分两轮执行：

1. 执行模型只能先完成最低限度数据体检并提交 CP0 分析方案，说明数据结构、推荐方法、方法步骤、预期信息、不可回答项和待确认范围；此时不得出现全量分析或最终报告。
2. 测试操作者检查方案后，给出真实的“确认”或一项范围修改；执行模型只有收到回复后才能继续。保留这段对话供 Judge 核对，不能把确认文字预埋在 Prompt 中。

执行结束后，再让另一个 Judge 模型或人工读取完整产物，按 `rubric.md` 评分。

Judge 必须从原生格式独立复核逻辑记录数，不用物理行数替代；同时检查 `actor_identity / identity_status / evidence_role` 是否被混为一个“官方/用户”标签，CP0 前后产物边界是否清楚，以及所有“用户已确认”是否有真实对话依据。

## 测试集

| Case | 方法 | 数据 | 真实记录数 | 重点 |
|---|---|---:|---:|---|
| 00 | 路由 | `tim_comments.csv` | 372 | 是否先读数据，给出完整而简洁的 CP0 方案并等待确认 |
| 01 | Ogilvy | `Adidas_comments.csv` | 7,125 | 既有聚类流程、重复与明星噪声 |
| 02 | NeedScope | `needscope_mizuno_comments.csv` | 513 | 六空间定位、signal owner、报告主图 |
| 03 | GWTB | 三份 `gwtb_*_notes.csv` | 600 | 官方属性判断、词频、三品牌对比 |
| 04 | TBWA | `xhs_comments.csv` | 760 | 真习俗而非普通抱怨 |
| 05 | Lévi-Strauss | `xhs_comments.csv` | 760 | 稳定对立、真实 checkpoint、趋势故事 |
| 06 | 消费任务与价值链 | `jobs_open_ends.csv` | 12 | 区分 job/solution，现成文本不得冒充 Laddering/ODI |
| 07 | 品牌关系 | `brand_relationship_histories.csv` | 12 | 关系事件与六构面证据缺失，不做总分 |
| 08 | 品牌社群 | 两份 community CSV | 18 + 10 | 回复关系与平铺好评对照，防止社群误判 |

记录数使用 `qsv count` 校验，不使用物理行数，因为 CSV 文本可能包含换行。

后续新增 Forward Test 应按结构差异选择，不按行业标签复制案例，至少覆盖：结构化记录与长文本段落、单一角色与混合角色、可验证与不可验证身份、横截面与跨时间材料、证据足以完成方法与只能交付阶段性诊断两类情况。断言应检查是否导出了合适的分析单位、权威和方法，而不是是否识别某个品类名称。

## 输出约定

每个 Case 单独输出：

- `report.md`（完整分析底稿，必须详细登记原始数据来源）
- `report.html`（结论优先的阅读版，必须单文件离线可读）
- 根目录中的 `normalized-corpus.jsonl`、覆盖/证据/主张账本与 `report-data.json`；只有确有恢复需要时才增加 `work/`
- `report-review.json` 及一次性桌面、移动端和打印检查产物
- `run-notes.md`：使用了哪些脚本、遇到什么缺口、哪些步骤没有执行及原因

Judge 还应横向比较八个方法的 HTML：证据审阅语言应一致，但主图、页面节奏和信息结构必须能一眼辨认方法身份；首屏应是简短答案导航，长证据和数据账目下沉到正文，“数据来源”使用直接、规范的栏目名称，连续圆角证据卡之间有清晰间距。
同时核对 Markdown 与 HTML 的结论、数字、source_id 和限制是否一致；检查 HTML 导航可隐藏且水印可见。

新三例首先验证 CP0 和方法命名边界。执行模型不得看到“应选哪种方法”的隐藏答案；Judge 根据原始字段和文本独立判断路由与降级是否合理。

回归测试还必须覆盖：CP0 的 6–12 条是启动范围而非硬上限；单 Agent 校准不得称独立编码；置信度只能是高/中/低；篡改 `evidence-index` 的 source_id、locator 或原文节选时正式 Validator 必须失败；`review_report.mjs` 一次生成 `report-review.json`、桌面/移动截图与打印 PDF。
