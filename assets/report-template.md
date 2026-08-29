# {{REPORT_TITLE}}

> {{METHOD_NAME}} · {{REPORT_TYPE}}  
> 分析日期：{{ANALYSIS_DATE}}  
> 作者水印：阿祖不看 TVC · https://demyth.info

## 0. 先看答案

### 一句话回答

{{DECISION_HEADLINE}}

### 关键结论

{{KEY_CONCLUSIONS}}

摘要区每条只写一条短结论和必要限定，不放原音、source_id 列表或完整推理链；置信度、证据与反证在“证据审阅”展开。

### 优先建议

{{RECOMMENDATIONS}}

### 整体置信度与决策边界

{{OVERALL_CONFIDENCE_AND_BOUNDARY}}

本段只保留一行总判断；详细限制放入第 4 节。

## 1. 数据来源

### 原始数据来源

| 数据集 ID | 原始文件/工作表 | 来源平台或机构 | 采集方式 | 导出/取得日期 | 数据时间范围 | 原始条数 | 有效条数 | 用途 |
|---|---|---|---|---|---|---:|---:|---|
| {{DATASET_ID}} | {{ORIGINAL_FILE}} | {{SOURCE_PLATFORM}} | {{COLLECTION_METHOD}} | {{EXPORT_DATE}} | {{DATE_RANGE}} | {{RAW_COUNT}} | {{VALID_COUNT}} | {{DATASET_ROLE}} |

未知信息写“未知—待数据提供方补充”，不得推断补齐。若有多个文件，每个文件单独一行。

### 字段与证据角色

| 字段 | 含义 | 完整度/异常 | 在本分析中的用途 |
|---|---|---|---|
| {{FIELD_NAME}} | {{FIELD_MEANING}} | {{FIELD_QUALITY}} | {{FIELD_USE}} |

{{EVIDENCE_ROLE_LEDGER}}

### 样本账目与处理

- 原始记录：{{RAW_COUNT_AND_DEFINITION}}
- 去重后：{{DEDUP_COUNT_AND_RULE}}
- 排除：{{EXCLUDED_COUNT_AND_RULE}}
- 有效分析样本：{{VALID_COUNT_AND_DEFINITION}}
- 抽样/分层：{{SAMPLING_RULE}}
- 统计口径：{{METRIC_DENOMINATORS_AND_QUERIES}}
- 数据缺口：{{DATA_GAPS}}

## 2. 方法分析

### 为什么使用 {{METHOD_NAME}}

{{METHOD_FIT_AND_NON_GOALS}}

### 辅助镜头（如有）

{{AUXILIARY_LENSES_AND_BOUNDARIES}}

### 方法专属主分析

{{METHOD_ANALYSIS}}

### 证据审阅

{{FINDINGS_WITH_EVIDENCE_COUNTEREVIDENCE_CONFIDENCE}}

## 3. 行动与验证

{{ACTION_PLAN_AND_VALIDATION}}

## 4. 方法、参数与限制

{{METHOD_PARAMETERS}}

{{LIMITATIONS}}

## 5. 来源索引

| source_id | 数据集 ID | 原始位置 | 原文/内容摘要 | 证据角色 |
|---|---|---|---|---|
| {{SOURCE_ID}} | {{DATASET_ID}} | {{ROW_SHEET_URL_OR_NOTE_ID}} | {{VERBATIM_OR_SUMMARY}} | {{EVIDENCE_ROLE}} |

---

阿祖不看 TVC · https://demyth.info
