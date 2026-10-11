# 重规划 / 系统设计文档（GDD）——「阵营博弈：生命药与战争」
> 项目代号：**WXZ-STUDIO / cangame v2**
> 性质：将现有 `cangame`（已下线纯前端人生模拟器）整体改造为一款**单机网页 4 阵营经济-战争博弈游戏**
> 版本：`v0.1-design`（规划稿，未含任何实现代码）
> 作者：文策渊（设计 / 叙事）
> 状态：待主理人与用户评审 → 进入开发

---

## 0. 范围与硬约束（对齐开发底座）

| 项 | 约束 | 说明 |
|---|---|---|
| 技术底座 | 纯前端 **vanilla JS**，无框架、无构建步骤 | 直接静态部署 GitHub Pages |
| 加载范式 | 复用仓库 `index.html` + `assets/*.js` **有序 `defer` 加载**（绝不用 `async`，保序） | 硬依赖顺序见附录 A |
| 测试范式 | 复用 `tools/` 下的 **Node `vm` 沙箱测试**（mock `document/window/localStorage`） | 见附录 B |
| AI 架构 | **纯规则 AI**：确定性行为树 + 性格光谱，**不调用 LLM、不依赖后端、不暴露 Key** | 完全离线可玩 |
| v1 范围 | 完整 **5 阶段含战争**，一步到位 | 不做分阶段上线 |
| 玩家入场 | **随机分配**到 4 阵营之一并任领袖；其余 3 阵营 AI 接管 | 见 §3 人口分布 |
| 总人数 | 固定 **13**（1 人类 + 12 AI） | 白队人多、黑队孤狼 |
| 仓库动作 | **覆盖**现有 `cangame` 仓库（原人生模拟器下线），逻辑全部重写 | 旧 `assets/*.js`/`index.html` 替换；美术资产可保留 `avatars.jpg` 思路，视觉交给美术 |

> 文档中所有数值均为**默认值且标注「可调」**，集中收敛到 `assets/config.js` 单一真源，便于平衡微调而不动逻辑。

---

## 1. 游戏概述与支柱（MDA 提炼）

### 1.1 一句话定位
> 「你是一支弱势/强势阵营的领袖，在每天 5 个阶段里生产、贸易、结盟、掀桌子；活到最后、并囤够 Goods 的人，瓜分系统奖金池。」

### 1.2 MDA 三层
- **Mechanics（机制）**
  - 4 阵营**初始资源极度不平等**（比较优势）：白=劳动力、蓝=生命药垄断、红=暴力、黑=专利。
  - 每日 **5 阶段循环**：早间选举 → 生产 → 贸易 → 战争 → 结算/生命药提交。
  - 资源四件套：**生命药 Life / 基础商品 Goods / 个人资金 Won / 系统奖金池 PrizePool**。
  - **生命药是刚需阀门**：每天按存活人数扣药，交不出→淘汰；制造持续压迫感。
  - **战争是释放阀**：第 2~3 天解锁，胜者掠夺失败者固定比例资产。
- **Dynamics（动态）**
  - 白队产能高但天天为药发愁 → 被迫向蓝队低头 → 蓝队坐地起价。
  - 红队产能低 → 只能靠保护费 / 战争掠夺 → 早期就成不稳定因素。
  - 黑队人少但有专利 → 所有人生产都要给它交「过路费」→ 苟活吸血。
  - 玩家作为领袖，在「囤货自保 / 结盟制衡 / 背刺独吞」间反复横跳。
- **Aesthetics（美学 / 乐趣）**
  - **资源压迫感**：药不够就要死人，时间压力贯穿每天。
  - **尔虞我诈**：贸易、协议、盟友、背刺全由确定性 AI 演绎，可复盘。
  - **不对称博弈**：每个阵营优劣势鲜明，无「标准答案」，重开即新局。

### 1.3 玩家动机（自我决定论 SDT）
| 需求 | 落点 |
|---|---|
| **自主 Autonomy** | 随机入营后仍可自选本阵营战略（囤货 / 结盟 / 侵略） |
| **胜任 Competence** | 小游戏产出 Goods、调价盈利、打赢战争掠夺，反馈即时 |
| **关联 Relatedness** | 与 3 个 AI 阵营的外交（提议 / 接受 / 背叛）构成「人际关系」 |

### 1.4 目标人群
- 策略 / 桌游 / 模拟经营玩家；偏好**单机、离线、可重开**的轻中度网页游戏。
- 单局时长目标 **20~40 分钟**（约 8~12 天循环），适合碎片时间。
- 平台：桌面 + 移动端浏览器（响应式 HUD，触控优先）。

---

## 2. 系统清单（System Breakdown）

> 每个系统给：**职责 / 关键状态 / 输入·输出 / 依赖**。系统边界清晰、可独立实现与单测。
> 实现文件映射见附录 A。

### 2.1 资源系统（Resource System）
- **职责**：四类资源的持有、流转、每日消耗与校验。所有加减走统一 `transfer()`，杜绝「幽灵资源」。
- **关键状态**：`faction.{life, goods, won, militaryFund}`；全局 `prizePool`。
- **输入**：生产产出、贸易成交、战争掠夺、专利费、宣战费、每日结算扣药。
- **输出**：资源变更事件（供 UI 与日志）。
- **依赖**：阵营系统（资源挂在阵营上）、结算系统（扣药）、经济系统（成交）、战争系统（掠夺）。

### 2.2 阵营与人口系统（Faction & Population）
- **职责**：4 阵营定义、13 人随机分配、存活/淘汰跟踪、领袖绑定。
- **关键状态**：`factions[4]`、`players[13]`、`humanFactionId`、`aliveCount`。
- **输入**：随机种子（分配人类入营）、初始基线表（§3）、淘汰指令。
- **输出**：阵营快照、存活人数、人类所属阵营。
- **依赖**：资源系统（初始资源注入）、配置系统（基线参数）。

### 2.3 领袖选举系统（Leader Election）
- **职责**：多人阵营每日早间内部投票选领袖；单人阵营领袖即本人；人类阵营领袖恒为玩家。
- **关键状态**：`faction.leaderId`、`electionRound`、`proposals[]`（领袖会议提案）。
- **输入**：各玩家「声望/贡献」分、人类手动指定或 AI 投票（行为树 §5）。
- **输出**：今日 `leaderId`；领袖会议提案列表（进入贸易/外交）。
- **依赖**：AI 系统（AI 阵营投票）、阵营系统。

### 2.4 生产小游戏系统（Production Minigames）
- **职责**：消耗行动力参加小游戏（文科逻辑 / 数学 / 代码拼图 / 医药合成），产出 Goods 或 Life。
- **关键状态**：`player.actionPoints`、`pendingMinigame`、`yieldResult`。
- **输入**：玩家作答、阵营产能系数（§3）、种子 RNG。
- **输出**：本阶段 Goods/Life 增量（确定性区间，见 §3 产能表）。
- **依赖**：资源系统（注入产出）、配置（产能系数）、AI 系统（AI 自动作答）。

### 2.5 交易 / 市场系统（Trading & Market）
- **职责**：全服交易大厅——自由挂单、私密交易、签协议、保护费索求。
- **关键状态**：`market.orders[]`、`market.trades[]`、`agreements[]`、`bribeQueue[]`。
- **输入**：买卖挂单、私聊报价、协议条款、红队保护费要挟。
- **输出**：成交记录、协议状态、Won/Goods 流转。
- **依赖**：资源系统、AI 系统（AI 挂单/议价/接受）、阵营系统（黑队专利抽成在此结算）。

### 2.6 战争系统（War System）
- **职责**：宣战、战争小游戏选型、结算掠夺。
- **关键状态**：`war.active`、`war.attacker/defender`、`war.minigame`、`war.result`、`warUnlockedDay`。
- **输入**：领袖支付宣战费、参战方（可带盟友）、小游戏结果。
- **输出**：掠夺结果（胜者夺固定比例 Goods/Won）、阵亡（可选）、战争日志。
- **依赖**：资源系统（扣宣战费、执行掠夺）、AI 系统（AI 宣战/应战）、配置（宣战费/掠夺率）。

### 2.7 生命药结算与淘汰系统（Settlement & Elimination）
- **职责**：阶段 5 按存活人数扣药；不足则决定谁淘汰；实时刷新奖金预期。
- **关键状态**：`day`、`requiredLife`、`deficit`、`eliminatedToday[]`。
- **输入**：阵营当前 Life、存活人数、淘汰裁决（领袖/投票/AI 性格）。
- **输出**：死亡玩家列表、各阵营奖金预期（实时显示）。
- **依赖**：资源系统、阵营系统、AI 系统（AI 淘汰谁）、配置（日耗药）。

### 2.8 AI 行为树系统（含性格光谱）(AI Behavior Tree + Personality)
- **职责**：12 个 AI 玩家 + AI 阵营决策的统一大脑。输出**可解析 JSON 决策**，不生成自然语言文案。
- **关键状态**：`personality{type, weights}`、`memory{agreements, grudges, lastWar}`、`decisionJSON`。
- **输入**：全局盘面快照（每阶段开始时喂给 AI）。
- **输出**：`{action:'produce|trade|declareWar|acceptDeal|betray|eliminate', params:{...}}`。
- **依赖**：全部系统（读盘面、写决策）；是其他系统的「消费者 + 驱动者」。

### 2.9 终局奖金结算系统（Endgame Prize Settlement）
- **职责**：游戏结束（仅剩 ≤1 阵营 / 达天数上限）按 Goods 比例瓜分奖金池。
- **关键状态**：`prizePool`、`result{factionTotals[], perPerson[]}`。
- **输入**：各阵营 Goods 总数、存活人数、奖金池。
- **输出**：分红页数据（阵营总额 + 人均）。
- **依赖**：资源系统、阵营系统、配置（奖金公式）。

### 2.10 UI / 盘面系统（UI / Board）
- **职责**：HUD、4 阵营面板、市场/战争/结算弹窗、终局页、日志流；人类决策点收集与「结束阶段」触发。
- **关键状态**：`currentScreen`、`activeModal`、`selectedFaction`。
- **输入**：游戏状态、人类操作。
- **输出**：DOM 渲染、阶段推进请求（→ 引擎）。
- **依赖**：引擎（状态机）、所有系统（展示数据）。

### 2.11 引擎 / 阶段状态机（Engine / Phase FSM）—— 粘合层
- **职责**：驱动 5 阶段流转；人类点「结束阶段」后，**同步批量跑完 12 个 AI 决策（<1s）**再刷新盘面。
- **关键状态**：`phase`、`phaseStep`、`pendingAIDecisions`、`isResolving`。
- **输入**：阶段推进指令、各系统计算结果。
- **输出**：阶段切换、日推进、终局触发。
- **依赖**：全部系统。

---

## 3. 四阵营数值基线草案（可调参数表）

> 所有数值为**默认值**，集中放 `config.js`，改数不动逻辑。下表即首版平衡基线，需经 §8 平衡 pass 校准。

### 3.1 人口与总盘（固定）
| 参数 | 默认 | 说明 |
|---|---|---|
| `TOTAL_PLAYERS` | 13 | 1 人类 + 12 AI |
| 白队人口 `POP.white` | 6 「可调」 | 劳动力大国 |
| 蓝队人口 `POP.blue` | 3 「可调」 | 医药垄断 |
| 红队人口 `POP.red` | 3 「可调」 | 军事帝国 |
| 黑队人口 `POP.black` | 1 「可调」 | 孤狼 |
| `DAILY_LIFE_COST`（每人/天） | 1 「可调」 | 结算阶段每人扣 1 药；阵营总耗 = 存活人数 × 此值 |

### 3.2 初始资源（极度不平等）
| 阵营 | 初始 Life | 初始 Goods | 初始 Won | 初始军费库 | 说明 |
|---|---|---|---|---|---|
| 白 White | 2 「可调」 | 20 「可调」 | 10 「可调」 | 0 | 人多产能高，但药极少、天天要买 |
| 蓝 Blue | 30 「可调」 | 5 「可调」 | 15 「可调」 | 0 | 药垄断，自带大药库 |
| 红 Red | 8 「可调」 | 5 「可调」 | 25 「可调」 | 10 「可调」 | 战备金充足、有武器 |
| 黑 Black | 3 「可调」 | 3 「可调」 | 20 「可调」 | 0 | 人少钱多、持专利 |

### 3.3 产能系数（确定性区间，每日生产阶段）
| 阵营 | Goods 日产出区间 | Life 日产出 | 行动力/人 | 说明 |
|---|---|---|---|---|
| 白 White | 3~5 「可调」 | 0 | 2 「可调」 | 产能极高 |
| 蓝 Blue | 0~1 「可调」 | 4~6 「可调」 | 2 | 专职产药 |
| 红 Red | 0~1 「可调」 | 0 | 2 | 产能极低 |
| 黑 Black | 1~2 「可调」 | 0 | 2 | 产能低 + 靠专利费 |

> 产出公式（确定性）：`out = baseMin + floor(rng()*(baseMax-baseMin+1))`，`rng()` 来自种子化 RNG（§6 / 附录 A）。

### 3.4 战争与专利（不对称核心）
| 参数 | 默认 | 说明 |
|---|---|---|
| `WAR_UNLOCK_DAY` | 2 「可调」 | 第 2 天起可宣战 |
| 宣战费 `WAR_COST.white` | 20 「可调」 | 白/蓝宣战极贵 |
| 宣战费 `WAR_COST.blue` | 18 「可调」 | |
| 宣战费 `WAR_COST.red` | 4 「可调」 | 红队极低（设计点） |
| 宣战费 `WAR_COST.black` | 10 「可调」 | |
| 掠夺率 `PLUNDER.goods` | 20% 「可调」 | 胜者夺失败者 Goods 比例 |
| 掠夺率 `PLUNDER.won` | 10% 「可调」 | 胜者夺失败者 Won 比例 |
| 专利费率 `PATENT_ROYALTY` | 15% 「可调」 | 非黑队生产「专利线」Goods 时，按比例缴 Won 给黑队 |
| 黑队专利范围 `BLACK_PATENTS` | ["科技品","军备件"] 「可调」 | 任何阵营产这两类须缴费；v1 可简化为「高产出档必缴」 |

### 3.5 奖金池与终局
| 参数 | 默认 | 说明 |
|---|---|---|
| `PRIZE_SEED` | 1000 「可调」 | 奖金池初始种子 |
| 奖金池累加 | 宣战费 + 专利费 + 交易税（如设） | 系统保管 |
| `MAX_DAY` | 12 「可调」 | 达此天数强制终局；或仅剩 ≤1 阵营即终局 |
| 阵营奖金总额 | `PrizePool × (FactionGoods / ΣAllGoods)` | 仅按 Goods 比例 |
| 人均奖金（实时显示） | `阵营奖金总额 ÷ 阵营存活人数` | **人头稀释**是核心张力 |

> **关键张力**：奖金总额只跟 Goods 占比有关，但「人均」被存活人数稀释。于是「多养人=多产能但少分钱+多耗药」vs「精兵苟活=少产能但人均暴富」构成根本博弈。

---

## 4. 5 阶段状态机

### 4.1 每日流转（状态图）
```
[新的一天 day++]
   │
   ▼
┌─ PHASE 1 早间 Morning ──────────────┐
│  人类阵营：玩家即领袖（无需选）       │
│  AI 多人阵营：行为树投票选领袖        │
│  领袖会议：提案/协议写进 agreements[]  │
│  【人类决策点】查看/发起提案          │
└───────────────┬──────────────────────┘
                ▼
┌─ PHASE 2 生产 Production ───────────┐
│  消耗行动力玩小游戏 → Goods/Life      │
│  【人类决策点】选小游戏/作答          │
│  AI：按产能系数自动产出（确定性）     │
└───────────────┬──────────────────────┘
                ▼
┌─ PHASE 3 贸易 Trading ──────────────┐
│  交易大厅：挂单/私聊/协议/保护费      │
│  【人类决策点】买卖/议价/签协议       │
│  AI：行为树挂单+议价+收专利费         │
└───────────────┬──────────────────────┘
                ▼
┌─ PHASE 4 战争 War（day≥WAR_UNLOCK）─┐
│  领袖付宣战费 → 宣战 → 小游戏对抗     │
│  【人类决策点】是否宣战/应战/选玩法   │
│  AI：行为树决定宣战/应战/掠夺         │
└───────────────┬──────────────────────┘
                ▼
┌─ PHASE 5 结算 Settlement ───────────┐
│  按存活人数扣 Life；不足→淘汰裁决     │
│  实时刷新各阵营奖金预期               │
│  【人类决策点】若本队缺药，决定谁死   │
│  AI：性格化淘汰（§5.4）              │
└───────────────┬──────────────────────┘
                ▼
       [人类点「结束今日」→ 引擎推进 day++]
                │
        (终局判定：≤1 阵营存活 或 day>MAX_DAY)
                ▼
        [终局奖金结算 → 分红页]
```

### 4.2 人类决策点 vs AI 自动点
| 阶段 | 人类决策点 | AI 自动点（人类点「结束阶段」后 <1s 并发跑完） |
|---|---|---|
| 1 早间 | 查看/发起领袖会议提案 | AI 阵营内部选举、生成提案 |
| 2 生产 | 选小游戏、作答 | 按产能系数确定性产出 |
| 3 贸易 | 挂单、私聊报价、签/毁协议 | 议价、收专利费、接受/拒单 |
| 4 战争 | 宣战/应战、选战争小游戏 | 宣战判定、应战、掠夺结算 |
| 5 结算 | 本队缺药时裁决谁淘汰 | 性格化淘汰、奖金预期刷新 |

### 4.3 「结束阶段」触发 AI 并发结算的时机
- 每个阶段内，人类完成可操作项后点 **「结束本阶段」**（或阶段 5 的「结束今日」）。
- 引擎收到指令 → 置 `isResolving=true` → **同步**遍历其余 12 个 AI 玩家/阵营，依次调用 AI 系统产出 `decisionJSON` 并落地（生产/成交/宣战/淘汰）。
- 全程纯同步计算，目标 **<1s**（无网络、无随机 IO）；完成后 `isResolving=false`，UI 全量重渲染盘面。
- ⚠️「并发」是**逻辑并发**（批量决议），非多线程；vanilla JS 单线程顺序执行即可满足离线即时反馈。

---

## 5. AI 行为树与性格光谱

### 5.1 设计原则（纯规则，可解析，可复盘）
- 每个 AI 玩家有 `personality{type, weights}` + `memory{agreements, grudges, lastWarDay}`。
- 每阶段开始，引擎把**只读盘面快照**喂给 AI；AI 输出**结构化 `decisionJSON`**（见 §2.8），由对应系统执行。
- 决策由 **性格权重 × 阈值 × 种子化噪声** 决定，**不生成任何自然语言文案**（无 LLM）。

### 5.2 六类性格原型（权重 0~1，越高越激进/机会主义）
| 性格 | Production 产出倾向 | Trade 贸易倾向 | War 战争倾向 | Betray 背叛倾向 | 典型行为 |
|---|---|---|---|---|---|
| 贪狼 Greedy | 0.6 | 0.9 | 0.5 | 0.9 | 高价卖、低价收、优先自保 |
| 守成 Steady | 0.8 | 0.3 | 0.1 | 0.2 | 稳产出、少冒险、守协议 |
| 冒险 Risky | 0.5 | 0.6 | 0.9 | 0.6 | 爱宣战、赌一把 |
| 复仇 Vengeful | 0.5 | 0.4 | 0.7 | 0.8 | 记仇、优先背刺得罪过自己者 |
| 投机 Opportunist | 0.5 | 0.8 | 0.5 | 0.7 | 哪边有利站哪边 |
| 孤狼 Lone（黑队默认） | 0.4 | 0.7 | 0.1 | 0.5 | 收专利费、苟活、择机反水 |

> 权重用于「是否越过阈值触发某动作」与「多选项排序」；具体阈值见各场景规则。

### 5.3 各阵营 AI 默认策略倾向
| 阵营 | 默认性格 | 核心策略（确定性） |
|---|---|---|
| 白 White | 守成为主、个别贪狼 | 囤 Goods 换药；早买蓝队药保命；避免战争（宣战贵）；寻求防御结盟 |
| 蓝 Blue | 投机/守成 | 高价卖药换 Won；用 Won 收 Goods；中立、囤药库；不主动开战 |
| 红 Red | 冒险/复仇 | 第 2 天起对最弱邻宣战或索保护费；低宣战费尽情用；掠夺补产能 |
| 黑 Black | 孤狼 | 强收专利费吸血；苟活少战；对手互耗时择机背刺/收割 |

### 5.4 四场景决策规则（确定性，非文案）
**① 生产场景**
```
if 阵营==蓝: 全力产 Life（4~6）
else: out = 产能区间确定性抽样；冒险性格额外 +1（上限封顶）
```
**② 贸易场景**
```
need = requiredLife - life
if need > 0:                        // 缺药→急购
    向蓝队发求药单，出价 = min(自身Won, 对手要价×urgency)，urgency 随贪狼↑
if goods > goodsTarget && won < wonTarget:
    挂单卖 Goods 换 Won（要价随 Trade 权重浮动 ±20%）
黑队：对每笔非黑队 Goods 成交抽 PATENT_ROYALTY 缴 Won
```
**③ 战争场景**
```
if day < WAR_UNLOCK_DAY: 不宣战
else if War权重 > 0.6 && militaryFund+won >= WAR_COST[自身] && 目标( Goods 或 Won 高 且 存活少):
    if 自身==红: 优先 day≥2 即宣（低费）
    else: 评估收益=掠夺预期/宣战费 > 1.5 才宣
```
**④ 背叛 / 生存场景（关键）**
```
// 背叛盟友
if 盟友曾毁约(memory.grudges) && (背叛收益 × (1 - loyalty权重) > 维系成本):
    输出 {action:'betray', target:盟友}
// 生存淘汰（阶段5缺药）
deficit = requiredLife - life
killN = ceil(deficit / DAILY_LIFE_COST)
按 score 升序淘汰 killN 人：
    score = 产出贡献×(1 - 贪狼自保偏置) - (复仇? 对头加分:0)
    贪狼性格：自身 score 强制最高（绝不先死自己）
    复仇性格：优先把「对头/曾背叛者」score 压到最低
```
> 上述规则全部可单测：给定盘面+性格，输出唯一 `decisionJSON`，无随机语言。

---

## 6. 数据模型（state 结构草案）

> 顶层 `gameState` 为单一可序列化对象（便于存档 / vm 测试 / 重放）。

### 6.1 顶层 `gameState`
| 字段 | 类型 | 说明 |
|---|---|---|
| `version` | string | 兼容标记 |
| `seed` | number | 种子化 RNG 种子（分配/产出/战争确定性来源） |
| `day` | number | 当前天数（从 1 起） |
| `phase` | enum | `MORNING/PRODUCTION/TRADING/WAR/SETTLEMENT` |
| `phaseStep` | number | 阶段内子步（可选） |
| `status` | enum | `PLAYING / ENDED` |
| `humanFactionId` | enum | `white/blue/red/black` |
| `factions` | Faction[4] | 阵营数组 |
| `players` | Player[13] | 玩家数组 |
| `market` | Market | 挂单/成交/协议 |
| `war` | WarState | 当前战争 + 历史 |
| `prizePool` | number | 系统奖金池 |
| `config` | object | 本局生效的参数快照（来自 config.js） |
| `log` | LogEntry[] | 事件流（供 UI 与时间线） |
| `result` | object\|null | 终局分红结果 |

### 6.2 `Faction` 子结构
```
{
  id, name, color,
  popAlive,                  // 当前存活人数
  playerIds: [id...],
  eliminatedIds: [id...],
  leaderId,                  // 今日领袖
  life, goods, won,          // 阵营资源池（v1 阵营池化）
  militaryFund,              // 公共小金库（军费）
  patents: [goodsType...],   // 黑队专利
  alive: bool                // 是否还有存活者
}
```
### 6.3 `Player` 子结构
```
{
  id, name, factionId, isHuman, alive,
  personality: { type, weights:{prod,trade,war,betray} },
  actionPoints,              // 当日剩余行动力
  skills: { production, combat },   // 影响小游戏/战争
  memory: { agreements:[], grudges:[], lastWarDay },
  eliminatedDay
}
```
### 6.4 `Market` / `WarState` 子结构
```
Market: { orders:[{id,side,factionId,goodsType,qty,price,status}],
          trades:[{...}], agreements:[{a,b,terms,breached}], bribeQueue:[] }
WarState: { active:{attacker,defender,allies:{attacker:[],defender:[]},
                    minigame, costPaid, status} | null,
            history:[{day,attacker,defender,winner,plundered}] }
```

---

## 7. UI / UX 流程（信息架构，视觉留给美术）

### 7.1 屏幕与导航
```
标题页 ──▶ 入营动画（随机分配+亮明阵营/领袖身份）──▶ 主盘面（游戏页）
                                                      │
                       ┌──────────────────────────────┼───────────────┐
                       ▼          ▼           ▼        ▼               ▼
                  交易大厅    战争面板    结算弹窗     领袖会议       终局分红页
                  (模态)     (模态)      (模态)       (模态)         (整页)
```
### 7.2 主盘面布局（游戏页）
- **顶栏 HUD**：天数 / 当前阶段进度条（5 格）/ 系统奖金池 / 本阵营资源速览（Life·Goods·Won·军费）。
- **左/中：4 阵营面板**（每阵营一张卡）：阵营色、存活人数（血条式）、Goods/Won/Life 条形、领袖头像、当前状态标签（缺药⚠/宣战中⚔/协议🤝）。点击展开详情。
- **右栏：日志流**：当日事件时间线（产出/成交/宣战/淘汰），可折叠。
- **底栏 Dock**：阶段内操作按钮 + 居中的 **「结束本阶段 ▶」**（阶段 5 为「结束今日」）。
- **阶段提示条**：当前阶段说明 + 人类待办（如「去交易大厅挂单」）。

### 7.3 关键交互
| 交互 | 形态 |
|---|---|
| 交易大厅 | 挂单表单（买卖/数量/单价）+ 私聊报价列表 + 协议签署；自由挂单 / 私密交易双模式 |
| 战争 | 宣战确认（显示宣战费+预期掠夺）→ 战争小游戏选型（策略棋/抢答/投票）→ 结果动画 |
| 结算淘汰 | 缺药弹窗：列出将死人数，人类手动选（或交给 AI/投票）；实时奖金预期并排显示 |
| 终局分红 | 整页：各阵营总额 + 人均 + 你的名次 + 「再来一局（重随机入营）」 |

### 7.4 可访问性对齐（预留）
- 资源用色 + 图标 + 数值三重编码（色盲友好）；阶段进度有文字标签；弹窗支持键盘聚焦与 Esc 关闭。

---

## 8. v1 构建路线图（按冲刺）

> 每冲刺可独立验收；系统依赖见 §2，优先级遵循「先经济循环 → 再交易 → 再战争 → 后 AI 性格 → 终局」。

### Sprint 1 — 资源 + 阵营 + 单日结算（跑通经济循环）
- 交付：config.js、rng.js、state.js、factions.js、resource.js、settle.js（仅扣药/淘汰骨架）、engine.js（阶段 1→5 空转）、极简 UI。
- 验收：13 人随机入营；每天扣药正确；缺药触发淘汰；无交易/战争也能跑通 N 天直到终局（按 Goods 分奖）。

### Sprint 2 — 生产小游戏 + 交易/市场
- 交付：production.js（小游戏+确定性产出）、economy.js（挂单/私聊/成交/专利抽成）、UI 交易大厅。
- 验收：产能区间产出正确；黑队专利费自动扣缴；人类可与 AI 成交；盘面资源随交易更新。

### Sprint 3 — 战争系统
- 交付：war.js（宣战/小游戏/掠夺）、UI 战争面板与宣战流、阶段 4 解锁逻辑。
- 验收：第 2 天起可宣战；红队低费可用；掠夺按固定比例结算；盟友可参战。

### Sprint 4 — AI 性格 + 行为树 + 外交
- 交付：ai.js（6 性格 + 4 场景决策 + memory）、leader.js（AI 选举/提案）、背叛/生存裁决。
- 验收：给定盘面+性格输出唯一 decisionJSON；AI 会买药/卖药/宣战/背刺；可复盘（日志可追）。

### Sprint 5 — 终局奖金 + UI 打磨 + 平衡 pass
- 交付：endgame.js（分红）、完整 UI/弹窗/终局页、vm 沙箱测试套件（附录 B）、平衡校准。
- 验收：终局分红公式正确（含人均稀释）；全 9 系统联调通过；参数扫描验证无「必胜阵营」；离线 <1s/阶段 AI 批量。

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解对策 |
|---|---|---|
| **纯规则 AI 太蠢 / 太 predictable** | 体验单调、背刺无惊喜 | 6 性格光谱 + 阈值 + 种子噪声；决策带「性格偏移」而非全随机；保留 `memory` 让 AI「记仇/履约」；平衡 pass 调权重 |
| **阵营失衡（某阵营必胜/必败）** | 随机入营即定胜负，劝退 | 所有数值收敛 config.js；Sprint 5 做参数扫描（每阵营 100 局模拟）找 dominance；用「人均稀释」「药耗」天然制衡白队人数优势 |
| **随机入营难度方差大** | 玩家觉得自己「命不好」 | 入营动画明示优劣势；提供「重开/换阵营」；或加权分配（避免人类总落最弱）；把方差当作 roguelike 卖点 |
| **战争成唯一 dominant strategy** | 大家都打仗、经济系统废 | 宣战费不对称（白/蓝极贵）+ 掠夺率封顶 + 战争有反噬（盟友离弃、被群殴） |
| **认知过载（系统太多）** | 新玩家懵 | 阶段化 UI、默认折叠 AI 内部、只显「与你相关」信息；首局加引导提示条 |
| **离线即时性（<1s 批量 AI）** | 卡顿 | 全同步计算、无 IO；12 AI 决策为 O(常数)；复杂小游戏仅人类侧渲染 |
| **确定性导致可速通/背板** | 重玩价值降 | 种子化但每局新种子；性格在阵营内随机分布；协议/背叛引入不可完全预测的人际链 |
| **仓库覆盖踩坑（旧人生模拟器残留）** | 加载冲突 | 全量替换 `index.html` + `assets/*.js`；旧文件移入 `legacy/` 或直接删；`deploy.py` PUBLISH 清单同步更新（附录 A） |

---

## 附录 A — 技术底座与仓库改造方案（对齐现有范式）

### A.1 新模块拆分与 `defer` 加载顺序（硬依赖，保序）
```
index.html:
  <script defer src="assets/config.js"></script>     // 参数单一真源（最先）
  <script defer src="assets/rng.js"></script>        // 种子化 RNG
  <script defer src="assets/state.js"></script>       // gameState 工厂/序列化
  <script defer src="assets/factions.js"></script>    // 阵营/人口/入营
  <script defer src="assets/resource.js"></script>    // 资源流转
  <script defer src="assets/leader.js"></script>      // 领袖选举
  <script defer src="assets/production.js"></script>  // 生产小游戏
  <script defer src="assets/economy.js"></script>     // 交易/市场/专利
  <script defer src="assets/war.js"></script>         // 战争
  <script defer src="assets/ai.js"></script>          // 行为树+性格光谱
  <script defer src="assets/settle.js"></script>      // 结算/淘汰/终局
  <script defer src="assets/engine.js"></script>      // 阶段状态机（编排）
  <script defer src="assets/ui.js"></script>          // 渲染/交互（最后）
```
> 沿用仓库「全 `defer`、不用 `async`、顶层 const 顺序即依赖」的范式；`ui.js` 的 `init()` 挂 `DOMContentLoaded`，defer 脚本先执行完，时序不受影响。

### A.2 vm 沙箱测试范式（沿用 `tools/_verify-*.js`）
- 新建 `tools/verify-*.js`，沿用现有模式：`vm.createContext({console,Math,JSON,Date,window,document,localStorage})` → 按上面顺序 `runInContext` 各 `assets/*.js` → 断言。
- 重点单测（确定性）：产能区间、扣药/淘汰、专利抽成、宣战费、掠夺率、奖金公式（含人均稀释）、AI `decisionJSON` 唯一性。
- 新增 `tools/sim-balance.js`：跑 N 局全 AI 模拟，统计各阵营胜率，服务于 §9 平衡 pass。

### A.3 `deploy.py` PUBLISH 清单更新
- 旧清单（data/market/engine/school/career/love/pet/legacy/loan/ui）替换为新 13 个 js + `style.css` + `index.html` + `README.md`。
- 两个目标仓库（`WXZSTUDIO/cangame` 根目录、`WXZSTUDIO/wxzstudio.github.io` 的 `/cangame/`）不变。

### A.4 仓库覆盖动作
- `index.html`、`assets/*.js`（旧人生模拟器逻辑）**全量重写**；`assets/style.css` 重写（视觉风格交美术，但结构先留）。
- 旧 `assets/{data,market,school,career,love,pet,legacy,loan}.js` 不再需要，移入 `legacy/` 或直接删除。
- `README.md` 改写为新游戏说明；`.gitignore` 维持（`.sync/` 等）。

---

> 文档结束。下一步：主理人评审 → 用户确认数值基线 → 进入 Sprint 1 开发（程基岩接手实现，我据评审回填逐系统 GDD 八节与数值表）。
