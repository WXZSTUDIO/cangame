# GDD · S5 战术板与阵容（`tactics.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §6　·　依赖：S1、S3
> **支柱 P3「阵容即战术」的落地系统**，与林绘澄的 Chalkboard 美术圣经直接对接。

---

## 一、概述

S5 把玩家的战术意图**翻译成 match.js 能消费的数值**：4 个战术维度 + 5 点位布阵 + 克制矩阵 + 熟练度 + 化学反应。

### v1 最小可玩版本长什么样

- 4 个战术维度：`pace`(1-5) / `offenseFocus`(5 选 1) / `defense`(5 选 1) / `subFreq`(1-5)。
- 战术板：左半场 5 个点位（BALL / WING / CORNER / POST / PAINT），玩家把名册球员拖上去。
- 点位**直接改数值**：`usageMul`（球权）与 `shotMixDelta`（出手倾向）。
- 熟练度与化学反应：换战术/换首发有代价，防止每场最优应对。
- **不做**：防守端逐人对位拖拽（v1 按位置自动对位 + 1 个「重点盯防」槽）、多套战术预设切换、暂停策略。

> 设计支柱引用：**P3 阵容即战术**（点位真的改数）、**P1 一轮一决策**（熟练度/化学反应让每次改动都有代价）。

---

## 二、数据结构

```js
Tactic {
  pace:         int,        // 1..5
  offenseFocus: enum,       // 'STAR'|'BALANCED'|'MOTION'|'POST'|'PERIMETER'
  defense:      enum,       // 'MAN'|'ZONE'|'PRESS'|'PACK'|'SWITCH'
  subFreq:      int,        // 1..5
  familiarity:  { STAR:n, BALANCED:n, MOTION:n, POST:n, PERIMETER:n,
                  MAN:n, ZONE:n, PRESS:n, PACK:n, SWITCH:n },   // 各 0~100，初始 55
  chemistry:    float,      // 0~100，初始 40
  focusDefendId: string|null,  // 重点盯防的对手球员 id（v1 单一槽位）
}

Lineup {
  starters:   [ string(5) ],              // 按 [PG, SG, SF, PF, C] 顺序的 playerId
  benchOrder: { PG:[ids], SG:[ids], SF:[ids], PF:[ids], C:[ids] },  // 每位置替补顺序
  points:     { BALL:id, WING:id, CORNER:id, POST:id, PAINT:id },   // ★ 战术板点位
  lastStarters: [ string(5) ]|null,       // 上一场首发，用于 chemistry 判定
}
```

---

## 三、规则

1. **首发 5 人必须填满**，且尽量各占一个位置（允许顶替但有 `posFitMul` 惩罚）。
2. **5 个点位每场必须各站 1 名「首发在场球员」**，默认按位置自动填充：
   `BALL←PG, WING←SG, CORNER←SF, POST←PF, PAINT←C`。玩家可覆盖。
3. **点位与首发是两套独立映射**：点位决定球权/出手倾向，首发决定谁在场。若点位上的球员不在首发，则以首发为准（点位退化为倾向，不生效 `usageMul`）。
   - 简化：**点位移出首发的人 → 该点位 `usageMul` 降为 1.00**（仍保留 `shotMixDelta`）。
4. **熟练度**：每场用了 `+1.2`，没用 `-0.4`，球队合练指定 `+4.0`。clamp [0, 100]。
5. **化学反应**：首发与上一场完全相同 `+1.5`；每换 1 名 `-3.0`；球队合练 `+1.5`；连续 5 场不变额外 `+2.0`。clamp [0, 100]。
6. **克制矩阵生效打折**：`× (0.40 + 0.60 × familiarity/100)`。
7. **subThreshold = 30 + 7 × subFreq**（换人体力阈值），交给 match.js 执行。
8. **AI 球队用同一套 `Tactic` 结构与同一套查表函数**（不作弊）。

---

## 四、公式

### 4.1 克制矩阵

```js
TACTIC_MATRIX = {                 // 行=进攻，列=防守，值=命中率乘子增量
  STAR:      { MAN:+0.00, ZONE:+0.04, PRESS:-0.02, PACK:-0.06, SWITCH:+0.06 },
  BALANCED:  { MAN:+0.02, ZONE:+0.01, PRESS:+0.00, PACK:+0.00, SWITCH:+0.00 },
  MOTION:    { MAN:+0.04, ZONE:-0.05, PRESS:+0.02, PACK:+0.03, SWITCH:-0.03 },
  POST:      { MAN:+0.03, ZONE:+0.05, PRESS:-0.03, PACK:-0.08, SWITCH:+0.02 },
  PERIMETER: { MAN:+0.00, ZONE:-0.06, PRESS:+0.05, PACK:+0.08, SWITCH:-0.04 },
};

function matchupMul(offTac, defDefense) {
  const fam = offTac.familiarity[offTac.offenseFocus];
  return 1 + TACTIC_MATRIX[offTac.offenseFocus][defDefense] * (0.40 + 0.60 * fam / 100);
}
```

### 4.2 化学反应

```js
chemMul = 0.94 + 0.12 * (chemistry / 100);        // 0.94 ~ 1.06
```

### 4.3 节奏

```js
possessions = round(100 * (PACE_POS_MUL[paceA-1] + PACE_POS_MUL[paceB-1]) / 2);
  PACE_POS_MUL = [0.86, 0.93, 1.00, 1.07, 1.14];

paceQuality = 1 - 0.045 * (pace - 3) * speedDeficitMul;
  speedDeficitMul = clamp((62 - avgSpeedOnCourt) / 22, 0, 1.5);

paceStamMul = [0.85, 0.93, 1.00, 1.08, 1.18][pace-1];   // 体力消耗倍率（match 用）
```

### 4.4 进攻核心偏移

```js
OFFENSE_FOCUS = {
  STAR:      { mix:{inside:+0.02, mid:+0.10, three:+0.00}, usageConc:1.55, astBonus:+0.00, tovDelta:+0.010, paceDelta: 0.00 },
  BALANCED:  { mix:{},                                     usageConc:1.00, astBonus:+0.04, tovDelta:+0.000, paceDelta: 0.00 },
  MOTION:    { mix:{inside:+0.06, mid:+0.00, three:+0.02}, usageConc:0.80, astBonus:+0.12, tovDelta:-0.005, paceDelta: 0.00 },
  POST:      { mix:{inside:+0.22, mid:+0.04, three:-0.26}, usageConc:1.20, astBonus:+0.02, tovDelta:+0.005, paceDelta:-0.06 },
  PERIMETER: { mix:{inside:-0.20, mid:-0.02, three:+0.22}, usageConc:1.10, astBonus:+0.06, tovDelta:-0.010, paceDelta:+0.06 },
};
```

### 4.5 防守策略修正

```js
DEFENSE = {
  MAN:    { perD:+0, intD:+0, tovDelta:+0.000, rebDelta:+0.00, foulDelta:+0.000, stamMul:1.00 },
  ZONE:   { perD:+6, intD:-3, tovDelta:-0.008, rebDelta:+0.04, foulDelta:-0.015, stamMul:0.90 },
  PRESS:  { perD:+0, intD:+0, tovDelta:+0.030, rebDelta:-0.03, foulDelta:+0.020, stamMul:1.35 },
  PACK:   { perD:-5, intD:+8, tovDelta:-0.010, rebDelta:+0.06, foulDelta:+0.005, stamMul:0.95 },
  SWITCH: { perD:+3, intD:+3, tovDelta:+0.005, rebDelta:-0.01, foulDelta:+0.010, stamMul:1.15 },
};
```

### 4.6 点位布阵（★ P3）

```js
POINT_USAGE = { BALL:2.00, WING:1.15, CORNER:1.00, POST:1.45, PAINT:1.25 };
POINT_MIX = {
  BALL:   { inside:+0.00, mid:+0.06, three:+0.02 },
  WING:   { inside:+0.04, mid:+0.06, three:+0.02 },
  CORNER: { inside:-0.18, mid:-0.06, three:+0.24 },
  POST:   { inside:+0.28, mid:+0.04, three:-0.20 },
  PAINT:  { inside:+0.22, mid:+0.00, three:-0.18 },
};

function shotMixFor(shooter, tactic, lineup) {
  const base = SHOT_TEND[shooter.pos];                       // numbers.md 7.2
  const f = OFFENSE_FOCUS[tactic.offenseFocus].mix;
  const pt = POINT_MIX[pointOf(shooter, lineup)] || {inside:0,mid:0,three:0};
  let m = { inside: base.inside + f.inside + pt.inside,
            mid:    base.mid    + f.mid    + pt.mid,
            three:  base.three  + f.three  + pt.three };
  // clamp 每项到 [0.01, 0.95] 后归一化到 Σ=1
  return normalize(clamp01(m));
}

function usageWeight(shooter, tactic, lineup) {
  const offScore = 0.35*inside + 0.25*mid + 0.25*three + 0.10*pass + 0.05*handle;
  const conc = OFFENSE_FOCUS[tactic.offenseFocus].usageConc;
  const isBall = (lineup.points.BALL === shooter.id);
  const pUsage = isBall ? POINT_USAGE.BALL : POINT_USAGE[pointOf(shooter, lineup)];
  return Math.pow(effOffScore, 3.0)
       * (isBall ? conc : 1.0)
       * (pUsage || 1.0)
       * (0.85 + 0.003 * shooter.ego)
       * posFitMul(shooter, assignedPos);
}
```

### 4.7 全队进攻乘子（match.js 消费）

```js
teamOffMul = matchupMul(offTac, defTac.defense)     // 克制 × 熟练度
           * chemMul(offTac)
           * paceQuality(offTac)
           * homeMul;                                // 1.012 / 0.988
```

---

## 五、交互（Chalkboard 布局）

```
┌──────────────────────────────────────────────────────────────┐
│  顶栏：江城雷霆 · 第 2 赛季 R23 · 种子 #12345678    [存档]    │
├─────────────────────────────────┬────────────────────────────┤
│                                 │  数据条（常驻）              │
│   半场战术板（Chalkboard）       │  ┌──────────────────────┐  │
│   ┌───────────────────────┐     │  │ 战绩 32-21  .604      │  │
│   │      [PAINT]          │     │  │ 排名 西区第 3          │  │
│   │   [POST]  [BALL]      │     │  │ 薪资空间  +1250 万     │  │
│   │      [WING]           │     │  │ 化学反应  68  ▲        │  │
│   │  [CORNER]     [CORNER]│     │  │ 现金      8,420 万     │  │
│   └───────────────────────┘     │  └──────────────────────┘  │
│                                 │                            │
│   节奏  ●──○○   3                │  [名册] [训练] [市场]       │
│   进攻  [均衡 ✓]                 │  ────────────────────────  │
│   防守  [人盯人 ✓]               │  抽屉内容（二级面板）        │
│   换人  ●●●○○   3                │                            │
│                                 │                            │
│   ▶ 进行下一轮   ▶▶ 快进 5 轮    │                            │
└─────────────────────────────────┴────────────────────────────┘
```

| 元素 | 行为 |
|---|---|
| 战术板点位 | 从右侧名册拖拽球员入位；也支持点击点位 → 弹出候选列表（**键盘可达替代**） |
| 点位上的球员卡 | 显示 姓名 / 位置 / OVR / 体力条；拖出即移除 |
| 节奏滑块 | 1-5，实时显示「回合数 ≈ N」「体力消耗 N×」 |
| 进攻/防守下拉 | 5 选 1，hover 显示克制矩阵该行/列的全部数值（**支柱 P2**） |
| 换人滑块 | 1-5，显示「体力低于 N 时换下」 |
| 熟练度指示 | 当前战术旁一个小进度条 + 数字 |
| 「进行下一轮」 | 主 CTA，战术板正下方居中 |

**可访问性**：所有点位有键盘替代（Tab 进入 → 数字键选球员）；克制矩阵数值有文字表；不依赖颜色单通道。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 某点位为空 | 自动填充该位置的默认首发；若该位置无人 → 填任意首发，点位 `usageMul` 降为 1.00 |
| E2 | 首发中有伤员 | UI 黄色警示，允许强行出场（`p_injury × 1.5`）；自动推荐替补 |
| E3 | 首发不足 5 人（名册伤病过多） | 禁止推进；UI 提示「可用球员不足 5 人」 |
| E4 | 玩家每轮都换战术 | 允许，但 `familiarity` 会掉到 20~30 → 克制加成 ×0.52（**天然惩罚，不需要额外规则**） |
| E5 | 玩家每轮都换首发 | `chemistry` 每轮 -3/人 → 掉到 0 → `chemMul` 0.94（天然惩罚） |
| E6 | `familiarity` 溢出 | clamp [0, 100] |
| E7 | `chemistry` 为负 | clamp [0, 100] |
| E8 | 焦点盯防的球员本场未出场 | `focusDefendId` 失效，防守端无额外修正（不报错） |
| E9 | 点位上的球员被交易走 | 点位自动清空 → 触发 E1 自动填充 |
| E10 | `shotMix` 归一化后某项为负 | clamp 到 [0.01, 0.95] 后重新归一化（循环 2 次保证收敛） |

---

## 七、与其他系统的接口

```
依赖：S1（config）、S3（Player / roster / ovr / posFitMul）

对外暴露：
  CG.Tactics.matchupMul(offTac, defDefense) -> float
  CG.Tactics.chemMul(tac) -> float
  CG.Tactics.paceQuality(tac, onCourtPlayers) -> float
  CG.Tactics.possessions(tacA, tacB) -> int
  CG.Tactics.shotMixFor(shooter, tac, lineup) -> {inside,mid,three}
  CG.Tactics.usageWeight(shooter, tac, lineup) -> float
  CG.Tactics.teamOffMul(offTac, defTac, isHome) -> float
  CG.Tactics.subThreshold(tac) -> int            // 30 + 7*subFreq
  CG.Tactics.updateAfterMatch(tac, lineup)       // familiarity +1.2/-0.4, chemistry 更新
  CG.Tactics.validateLineup(lineup, roster) -> {ok, reason}

被依赖：
  S6 match  —— 唯一数值消费者
  S12 ai    —— 自动设置战术（同一函数）
  S13 ui    —— 战术板拖拽与滑块
```

---

## 八、验收用例

```js
// T1 克制矩阵无主导策略（B7）
// 口径（与 numbers.md §6.5 一致）：断言的是**均值** = 行和 ÷ 5
const keys = ['STAR','BALANCED','MOTION','POST','PERIMETER'];
const defs = ['MAN','ZONE','PRESS','PACK','SWITCH'];
keys.forEach(k => {
  const mean = defs.reduce((a,d)=>a+TACTIC_MATRIX[k][d],0) / defs.length;
  assert(Math.abs(mean) <= 0.010 + 1e-9);          // 行均值 ≈ 0
});
defs.forEach(d => {
  const mean = keys.reduce((a,k)=>a+TACTIC_MATRIX[k][d],0) / keys.length;
  assert(Math.abs(mean) <= 0.010 + 1e-9);          // 列均值 ≈ 0
});
// 等价写法：行/列和 ∈ [-0.050, +0.050]

// T2 熟练度打折
const tac = { offenseFocus:'POST', familiarity:{POST:55}, ... };
const at100 = CG.Tactics.matchupMul({...tac, familiarity:{POST:100}}, 'PACK');
const at55  = CG.Tactics.matchupMul({...tac, familiarity:{POST:55}},  'PACK');
assert(Math.abs(at100 - (1 - 0.08)) < 1e-9);              // ×1.00 → -0.08
assert(Math.abs(at55  - (1 - 0.08*0.73)) < 1e-9);         // ×0.73 → -0.0584

// T3 化学反应
assert(Math.abs(CG.Tactics.chemMul({chemistry:0})   - 0.94) < 1e-9);
assert(Math.abs(CG.Tactics.chemMul({chemistry:100}) - 1.06) < 1e-9);

// T4 节奏
assert(CG.Tactics.possessions({pace:3},{pace:3}) === 100);
assert(CG.Tactics.possessions({pace:5},{pace:5}) === 114);
assert(CG.Tactics.possessions({pace:1},{pace:5}) === 100);   // 平均回 100

// T5 慢队提速有质量惩罚
const slowFive = mkFive({speed:45});
assert(CG.Tactics.paceQuality({pace:5}, slowFive) < 0.93);
const fastFive = mkFive({speed:78});
assert(Math.abs(CG.Tactics.paceQuality({pace:5}, fastFive) - 1.0) < 1e-9);  // 无惩罚

// T6 点位真的改数（支柱 P3）
const pg = mkPlayer({pos:'PG', attr:{three:70,...}});
const asCorner = CG.Tactics.shotMixFor(pg, {offenseFocus:'BALANCED'}, {points:{CORNER:pg.id}});
const asBall   = CG.Tactics.shotMixFor(pg, {offenseFocus:'BALANCED'}, {points:{BALL:pg.id}});
assert(asCorner.three > asBall.three + 0.15);          // 底角三分占比显著更高

// T7 shotMix 归一化
const m = CG.Tactics.shotMixFor(anyPlayer, {offenseFocus:'PERIMETER'}, {points:{CORNER:id}});
assert(Math.abs(m.inside+m.mid+m.three - 1.0) < 1e-9);
Object.values(m).forEach(v => assert(v >= 0.01 - 1e-9 && v <= 0.95 + 1e-9));

// T8 换人阈值
assert(CG.Tactics.subThreshold({subFreq:1}) === 37);
assert(CG.Tactics.subThreshold({subFreq:5}) === 65);

// T9 阵容校验
assert(CG.Tactics.validateLineup({starters:[a,b,c]}, roster13).ok === false);   // 不足 5 人
assert(CG.Tactics.validateLineup({starters:[dup,dup,d,e,f]}, roster13).ok === false); // 重复

// T10 熟练度更新
const t = { offenseFocus:'POST', familiarity:{POST:50, STAR:50} };
CG.Tactics.updateAfterMatch(t, lineup);
assert(Math.abs(t.familiarity.POST - 51.2) < 1e-9);
assert(Math.abs(t.familiarity.STAR - 49.6) < 1e-9);

// T11 化学反应更新
const t2 = { chemistry:50 };
CG.Tactics.updateAfterMatch(t2, {starters:sameAsLast});
assert(Math.abs(t2.chemistry - 51.5) < 1e-9);
CG.Tactics.updateAfterMatch(t2, {starters:oneChanged});
assert(Math.abs(t2.chemistry - 48.5) < 1e-9);
```

---

## 附 · v1 不做

- 防守端逐人对位拖拽（v1 自动对位 + 单槽「重点盯防」）
- 多套战术预设（A/B 方案）与按节切换
- 暂停策略 / 挑战规则
- 具体战术板美术（由林绘澄定义，本 GDD 只保证信息架构与数值接口）
