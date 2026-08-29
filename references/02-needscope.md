# NeedScope 品牌情感定位诊断

> 方法边界：NeedScope 是 Kantar 的品牌情感定位体系。本流程把公开框架用于社媒证据诊断，不声称替代 Kantar 的正式研究、常模、量表或授权交付。

## 回答的问题

品牌当前被感知在哪个情感空间？官方表达与消费者体验是否一致？目标位置与当前位置之间的缺口是什么？

仅有社媒文本时，报告名称必须使用“NeedScope-inspired 社媒证据诊断”或“基于 NeedScope 公开框架的定位诊断”，不得写成正式 NeedScope 测量报告。

## 正确的模型

主模型是一张连续的二维情感空间图，不是六个互相独立的分数，也不是雷达图。

- 横轴：**Affiliative 亲和/群体联结 ↔ Individualistic 个体/自我主张**
- 纵轴：**Introverted 内敛/克制 ↔ Extroverted 外放/能量**

六个相邻情感空间沿圆周连续变化：

| 颜色空间 | 核心情感 | BrandZ 常见原型对（辅助命名） |
|---|---|---|
| Yellow | Fun-loving / Carefree / Spontaneous，快乐、无拘束、自发 | Joker / Free Spirit |
| Red | Bold / Dynamic / Independent，大胆、动感、独立 | Rebel / Hero |
| Purple | Self-assured / Assertive / Forthright，自信、坚定、直接 | Enchanter / Ruler |
| Blue | Focused / Competent / Controlled，专注、胜任、掌控 | Sage / Expert |
| Brown | Careful / Caring / Sensitive，谨慎、关怀、敏感 | Caregiver / Innocent |
| Orange | Friendly / Approachable / Open，友好、亲近、开放 | Best Friend / Networker |

十二原型是六个空间内的细分解释，不是另一套随意拼接的 Jung 十二原型清单。不能把 Innocent、Explorer、Magician 等通用原型平均排成雷达图后称为 NeedScope。

## 证据角色

先判定每条材料在回答谁：

- `brand_intent`：品牌官方账号、官网、广告或可确认的品牌自述；
- `commercial_expression`：达人合作、商业笔记，代表传播执行，不自动等于官方战略；
- `consumer_experience`：消费者评论与自发笔记，代表被体验到的品牌；
- `category_context`：竞品和品类语境；
- `unknown`：身份不足，不能强归因。

“是否官方笔记”的判断顺序：账号主体/认证信息 > 明确来源字段 > 文本线索推断。若只能推断，必须显示置信度。

## 工作流

### 1. 建立研究边界

记录品牌、竞品、平台、时间、样本量、字段和去重口径。判断是当前定位诊断、当前/目标差距、竞品地图还是传播一致性检验。

### 2. 对象相关性过滤

排除只讨论渠道、交易、物流或无关人物且不能映射到品牌体验的文本。保留反讽、否定和矛盾材料。为每条保留稳定 `source_id`。

### 3. 分层抽样与开放编码

按证据角色、品牌、平台、时间和互动层抽样。先写文本表达的需要、情绪、关系姿态和控制感，再映射到空间；不要先用颜色词搜答案。

推荐编码字段：

```text
source_id | evidence_role | verbatim | need_expression | affiliation_axis
| activation_axis | primary_space | secondary_space | polarity
| irony_or_negation | coder_reason | confidence
```

### 4. 空间映射

每条有效证据给出横纵轴方向和强度，再判断主空间、邻近空间。相邻色可以构成过渡；跨越对角线的双重落点必须有明确证据，不得为了“全面”平均分配。

关键词、词频、表情和互动量只能协助检索与抽样，不能直接决定坐标。坐标来自完整语境中的情感需要和关系姿态。

### 5. 质量 Gate

进入结论前检查：

- 重要落点至少有两条独立原音，不靠同一转述重复计数；
- 官方意图与消费者体验分别编码，没有混在同一平均值中；
- 对否定、反讽和语境做过复核；
- 至少记录一个竞争解释或反证；
- 样本不足或来源单一时使用宽不确定性区间，并降低置信度。

### 6. 定位判断

分别绘制：

- 当前品牌自述位置；
- 当前消费者感知位置；
- 竞品位置（如有）；
- 目标位置（只有 Brief 或明确策略证据时才画）。

点的位置表示方向，半透明 halo 表示不确定性；点之间的箭头表示差距或迁移路径。不要制造无依据的精确百分数。若需要展示证据量，放在附录条形图，并明确它是编码样本分布而非品牌“得分”。

### 7. 战略解释

先解释当前空间带来的意义，再解释缺口：哪些表达应该强化、哪些触点造成偏移、迁移时什么资产必须保留。建议必须回到证据，而不是只给人格形容词。

## 报告表达

先用 `assets/report-template.md` 写完整 `report.md`，再使用 `assets/report-shell.html` 与 `assets/methods/needscope.html` 生成 HTML。主视觉必须是带两轴、六色连续空间、品牌/竞品点和不确定性 halo 的定位图。社媒诊断的坐标最多保留一位小数，并优先表达区域与不确定性；不得制造正式测量般的精度。

推荐页面顺序：

1. 一句话定位判断、迁移建议与置信度；
2. 原始数据、证据角色、样本账目和诊断边界；
3. 二维情感空间主图；
4. 官方意图 vs 消费者感知；
5. 各落点证据与反证；
6. 差距与迁移路径；
7. 来源、编码和限制。

禁止把雷达图、六条独立进度条或通用十二原型轮盘当作主模型。

## 置信度

- **高**：多来源、多角色证据一致，反证少，编码理由清楚；
- **中**：方向稳定但样本、平台或身份字段有限；
- **低**：单一来源、推断距离长、官方性不明或相反证据显著。

## 公开依据

- Kantar, “Archetypes and emotion help build meaningful difference”
- Kantar Brand Strategy / NeedScope Positioner 公开介绍
- Kantar BrandZ Most Valuable Global Brands 报告中的 NeedScope archetype framework

网址及核对日期记录于 `references/07-needscope-sources.md`。正式商业使用应核对授权与最新官方材料。
