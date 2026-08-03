# 脚本路线

脚本只负责整理、检索和建立证据锚点，不替代方法判断。调用 Python 时使用当前工作区认可的 Python runner，不要假定裸 `python` 命令。

| 脚本 | 默认用于 | 不应用于 |
|---|---|---|
| `phase1_analyze.py` | Ogilvy 的大样本语义主题发现、MMR 采样和情绪补漏；依赖见 `scripts/requirements-ogilvy.txt` | GWTB 策略句、NeedScope 坐标的直接判定 |
| `deepen.py` | Ogilvy 主题的原文回查；支持 `--text-col`，输出稳定行 ID | 用命中次数代替 L2/L3 |
| `extract_wordfreq.py` | GWTB 按品牌/证据角色做轻量词频入口 | 用高频词直接填 GET/WHO/TO/BY |
| `preprocess_comments.py` | Levi-Strauss 的阅读导航、情绪线索与候选结构材料 | 用聚类直接生成二元对立或趋势；缺 sklearn 时只输出通用未聚类导航，不执行领域词硬编码 |

NeedScope 以对象过滤、证据角色和二维情感编码为主；TBWA 以惯例句式、抱怨、绕行与异常信号为主。两者目前没有强制共享脚本，避免为自动化而牺牲方法质量。

所有输出写入任务目录，例如 `outputs/<project>/<method>/`。`all_quotes.json` 中的 `quotes`、`source_id` 与 `cluster_ids` 可用于回查；聚类字段只是导航标签。

Ogilvy 中大型样本的核心语义聚类缺依赖时，不允许以词频扫描冒充等价降级；输出阶段诊断并在 `report.md`、HTML 首屏和 run-notes 中说明缺失步骤。Levi-Strauss 的聚类只是导航，缺依赖时可以继续，但必须显示 `unclustered_dependency_fallback`。
