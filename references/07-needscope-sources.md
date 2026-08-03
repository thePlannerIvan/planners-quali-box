# NeedScope 官方资料研究与报告重建设计

> 研究日期：2026-08-03。优先采用 Kantar 官方页面、官方报告和 Kantar Marketplace 支持资料。

## 核心纠正

当前 quali-box 把两个层级混在了一起：

- NeedScope 的底图是由 **Affiliative ↔ Individualistic** 与 **Extroverted ↔ Introverted** 两条驱动力轴构成的连续情感空间。
- 底图上有六个相邻的情感空间：
  - Yellow：Fun-loving / Carefree / Spontaneous
  - Red：Bold / Dynamic / Independent
  - Purple：Self-assured / Assertive / Forthright
  - Blue：Focused / Competent / Controlled
  - Brown：Careful / Caring / Sensitive
  - Orange：Friendly / Approachable / Open
- Kantar 官方 BrandZ 内容同时给出十二个 archetypes，按相邻位置落入六个空间：
  - Red：Rebel、Hero
  - Purple：Enchanter、Ruler
  - Blue：Sage、Expert
  - Brown：Caregiver、Innocent
  - Orange：Best Friend、Networker
  - Yellow：Joker、Free Spirit

因此：不能把“六个情感空间”写成六个互不相关的性格分数，也不能直接套用另一套十二原型清单。正确表达是“品牌在连续空间中的主位置、邻接位置和竞争关系”。

## NeedScope 真正回答什么

Kantar 把 NeedScope 定义为情感驱动的品牌定位工具，目的是：

1. 找到品类中的情感需求空间；
2. 判断品牌和竞品当前占据的位置；
3. 找到可信、差异化且能长期一致执行的目标位置；
4. 把定位落实到视觉、语言、音乐、体验和其他触点。

官方材料同时强调三层需求：**functional、identity、emotional**。正式 NeedScope 通常结合 survey、consumer context 与 projective tools；社媒评论只能提供其中一部分自然语言证据。因此本 Skill 的输出应标为：

> “基于社媒文本的 NeedScope-inspired 情感定位诊断”，除非用户真的提供了正式调研和投射材料。

## 编码建议

不要让模型逐条把文本硬塞进颜色。先做三层判断：

1. **这条文本在说谁**：品牌、产品、人物、活动、平台还是社区。
2. **它表达哪一层需要**：功能、身份或情感。
3. **它指向空间中的哪个方向**：看相对位置和语境，不靠单个关键词。

编码结果保留：主空间、相邻空间、方向强度、正/负向、signal owner、证据 ID、替代解释。最终定位必须综合证据，而不是把编码次数直接变成“人格得分”。

## 报告应该怎么写

### 1. 研究边界

- 分析对象、数据来源、平台语境和可回答范围。
- 明确这是正式定位研究，还是社媒文本探索性诊断。

### 2. 品类情感地图

- 先说明品类中的功能、身份和情感需求。
- 再画六空间底图，展示品类 heartland、拥挤区和稀缺空间。

### 3. 品牌与竞品位置

- 当前品牌与竞品作为点放入同一张定位轮盘。
- 点的大小表示有效证据量，透明外圈表示不确定性；颜色表示位置，不表示好坏。
- 官方表达和消费者感知用“实心点 / 空心点”或连线展示 gap，而不是画两张无关雷达图。

### 4. 品牌情感核心

- 当前主空间、相邻 nuance、品牌能够可信承载的情感 essence。
- 支撑证据、反证、平台差异和置信度。
- 不要求六个空间都高；清晰的单一核心往往比平均分布更有意义。

### 5. 定位机会

- 当前位置 → 可赢位置 → 为什么可信 → 与竞品有什么差异。
- 把“品类基本盘”与“品牌差异”分开。Cadbury 官方案例显示，Joy 可能只是品类共性，最终需要找到更独特的 Generosity。

### 6. 触点执行

- 用矩阵审阅语言、视觉、人物、音乐、产品体验和渠道体验是否与目标空间一致。
- 输出 Do / Avoid guardrails，而不是只给一个颜色名称。

## 核心图怎么画

主图应是二维定位轮盘，而不是雷达图或六根分数柱：

```text
                    Extroverted
             Yellow           Red
          Orange                 Purple
             Brown            Blue
                    Introverted

        Affiliative  ←────────→  Individualistic
```

实际 HTML/SVG 应画成圆形连续色带或六扇区：

- 六空间围绕圆周连续相邻，不是六个离散盒子。
- 两条轴穿过中心。
- 品牌、竞品、官方表达、消费者感知作为可比较的点。
- 证据不足用更大的不确定性外圈，不制造小数点精度。
- 证据密度柱状图可以放附录，但不能代替定位轮盘。

## 官方来源

- Kantar, *Archetypes and emotion help build meaningful difference*: https://www.kantar.com/north-america/Inspiration/Brands/Archetypes-and-emotion-help-build-meaningful-difference
- Kantar, *Introducing Kantar Brand Strategy*: https://www.kantar.com/campaigns/brand-strategy-2
- Kantar, *Find your Meaningful Difference with NeedScope*: https://www.kantar.com/campaigns/-/media/dadb53b3c7434e1a8d20ad1298354d1f.ashx
- Kantar Marketplace, *Brand positioning / NeedScope Positioner*: https://www.kantar.com/marketplace/Solutions/Brand-insights/Brand-positioning
- Kantar Marketplace Support, *What is NeedScope Positioner?*: https://marketplacesupport.kantar.com/support/solutions/articles/77000595482-what-is-needscope-positioner-needscope-positioner
- Kantar, *Qualitative Research*: https://www.kantar.com/en-cn/expertise/research-services/research-capabilities-and-technology/qualitative-research
- Kantar BrandZ 2022, “Universal drivers / The six emotive spaces”: https://indd.adobe.com/view/publication/bb7c01af-7f11-4c17-a3f5-15b4e07436ce/uwnw/publication-web-resources/pdf/Kantar_BrandZ_Global_Report_2022.pdf
- Kantar, *Build Stronger Brands with Kantar* PDF: https://www.kantar.com/-/media/E3706A0696BE443ABE9836EF95A6DE7A.ashx
