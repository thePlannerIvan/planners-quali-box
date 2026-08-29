# 脚本路线

脚本只负责整理、检索和建立证据锚点，不替代方法判断。调用 Python 时使用当前工作区认可的 Python runner，不要假定裸 `python` 命令。

| 脚本 | 默认用于 | 不应用于 |
|---|---|---|
| `prepare_corpus.mjs` | CSV/TSV/JSON 在 CP0 确认后一次性规范化，生成稳定 `source_id`、`normalized-corpus.jsonl` 和 `coverage-manifest.json` | 不替代 Excel 原生读取、语义编码或方法路由 |
| `phase1_analyze.py` | Ogilvy 的大样本语义主题发现、MMR 采样和情绪补漏；依赖见 `scripts/requirements-ogilvy.txt` | GWTB 策略句、NeedScope 坐标的直接判定 |
| `deepen.py` | Ogilvy 主题的原文回查；支持 `--text-col`，输出稳定行 ID | 用命中次数代替 L2/L3 |
| `extract_wordfreq.py` | GWTB 按品牌/证据角色做轻量词频入口 | 用高频词直接填 GET/WHO/TO/BY |
| `preprocess_comments.py` | Levi-Strauss 的阅读导航、情绪线索与候选结构材料 | 用聚类直接生成二元对立或趋势；缺 sklearn 时只输出通用未聚类导航，不执行领域词硬编码 |
| `render_report.mjs` | 把已审阅的 `report-data.json` 与共享 shell/方法模块组成单文件 HTML | 不从原始语料发明结论，不为每个项目重写生成器 |
| `validate_run.mjs` | 最终一次检查证据与主张 schema、规范化语料回源、数字账本、报告存在性与 HTML 机械契约 | 不判断洞察深度，不调用视觉模型，不重跑分析 |
| `review_report.mjs` | Validator 通过后，用一次浏览器会话生成桌面、移动端、打印与 DOM 审计产物 | 不替代语义审阅；没有明确异常时不重复截图 |

`corpus-config.json` 是当次输入映射，只保留数据集 ID、路径、格式、记录路径、原文/定位/身份/语境字段。JSON 默认要求 `locator_fields`；确实无逻辑 ID 时才显式允许 `allow_positional_locator: true`。它的消费者是 `prepare_corpus.mjs`；不要把方法标签、结论或临时思考写进配置。

`metrics-ledger.json` 是 `validate_run.mjs` 消费的数字账本。当报告没有数字主张时可不生成；一旦出现比例、计数排序或“多数/最大”类表述，必须生成。每项用 `report_tokens` 列出 Markdown 和 HTML 中都应出现的最短数字字面，例如 `49/525` 和 `9%`；不要放整段文字。

NeedScope 以对象过滤、证据角色和二维情感编码为主；TBWA 以惯例句式、抱怨、绕行与异常信号为主。两者目前没有强制共享脚本，避免为自动化而牺牲方法质量。

所有输出写入任务目录，例如 `outputs/<project>/<method>/`。Levi-Strauss 路线若生成 `all_quotes.json`，其中的 `quotes`、`source_id` 与 `cluster_ids` 只用于回查和阅读导航。

Ogilvy 中大型样本的核心语义聚类缺依赖时，不允许以词频扫描冒充等价降级；输出阶段诊断并在 `report.md`、HTML 首屏和 run-notes 中说明缺失步骤。Levi-Strauss 的聚类只是导航，缺依赖时可以继续，但必须显示 `unclustered_dependency_fallback`。
