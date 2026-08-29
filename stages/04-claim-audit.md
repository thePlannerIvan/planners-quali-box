# Stage 4：主张与证据逆向审计

## 任务

把候选解释当作待证伪主张，从 Claim 逆向回到证据、反证、语境和原始语料。

## Project Grounding

- `evidence-index.json`：`source_id / dataset_id / locator / actor_identity / identity_status / evidence_role / text / context`。定位器必须稳定；`text` 使用规范化语料中的原文或可机械回查的节选，可用省略号或方括号省略非关键内容。因隐私需要脱敏时增加 `redaction_note`，但仍须保留足够连续原文供回查；不得用改写或总结替代证据文本。
- `claim-ledger.json`：`claim_id / claim / support_ids / counter_ids / confidence / confidence_reason / boundary / status`。`confidence` 只允许 `高 / 中 / 低`；“中高”“较高”“高（限语料内）”等限定写入 `confidence_reason` 或 `boundary`，不另造等级。
- `metrics-ledger.json`：报告出现的每个数字保存 `metric_id / label / numerator / denominator / filter / generation / report_tokens`。`report_tokens` 是 Markdown 和 HTML 中必须同时出现的简短数字字面，用于机械检查两种报告一致。互斥分类共用 `partition_id`，它们的分子合计必须等于分母；允许重叠时不得伪装成总体构成。

正式主张默认至少两条支持证据；若语料天然只有一个可用来源，必须降信并解释。计数不是引用数量，重复转载和同一对话链不能自动算独立验证。

## 审计顺序

1. Claim 是否是一句可反驳判断？
2. 每条支持与反证能否通过 ID 回到 `normalized-corpus.jsonl` 与原始语境？`dataset_id / locator` 是否一致，证据节选是否仍能在规范化原文中顺序定位？
3. 证据角色是否拥有该主张，例如消费者评论不能直接证明品牌内部意图？
4. 说话者身份是否经过验证？若只有语气、昵称、标签或商业风格，是否仍诚实标为 `inferred/unknown`？
5. 是否存在被过滤、低互动或少数材料中的相反解释？
6. 置信度是否来自覆盖、独立性、一致性和推断距离，而不是固定条数或显眼措辞？
7. 数字主张是否已写入 `metrics-ledger.json`？分子、分母、筛选条件和生成方式能否重算？互斥分类是否合计回总体？
8. “用户确认/用户选择/已批准”是否能回到真实用户消息？不能时改写为工作假设或模型决定。
9. 摘要出现“多数、主流、最大、大量、决定、证明、已验证”等强推断词时，是否有相匹配的可复算证据？没有时改成“本批语料中更常见”、“突出信号”、“提示可试点”或待验证假设。
10. 方法身份是否越界：无追问轨迹却写 Laddering、无纵向/关系证据却写完整 BRQ、无成员关系却写品牌社群、无参与观察却写网络志、无量化测量却写 MDS/区别性资产强度？任一成立都必须改名、降级或删除。

报告定稿前再做一次“比较级与排他性”扫描：`真正 / 最大 / 最重要 / 最有资格 / 唯一 / 已证明 / 最高优先` 都需要明确比较全集、可复算依据或外部验证；否则改为 `证据更充分 / 较突出之一 / 更值得试点 / 本批语料支持 / 优先试点`。这项是语义审阅，不能交给机械 Validator 代替。

本阶段只建立账本，最终统一校验在 Stage 5 运行：

```text
node scripts/validate_run.mjs RUN_DIRECTORY
```

Validator 只证明结构闭环、数字内部一致和报告机械契约，不证明语义正确。不得为当次项目另写替代校验器；如官方脚本失败，修正产物或回报 Skill 兼容性问题。语义审计失败的主张应降信、改写为假设或删除。
