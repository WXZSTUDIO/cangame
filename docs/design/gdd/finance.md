# GDD · S11 财务与赞助（`finance.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §8、§11　·　依赖：S1、S2（marketSize）、S3（薪资）
> **反摆烂的经济惩罚就落在本系统**，见 `concept.md` R6。

---

## 一、概述

S11 负责所有钱的进出：门票 / 转播 / 赞助 / 周边 / 季后赛奖金，薪资 / 奢侈税 / 运营 / 教练 / 青训 / 转会费，以及工资帽校验与破产判定。

### v1 最小可玩版本长什么样

- 4 项收入 + 4 项支出，赛季末一次性决算 + 门票按轮入账。
- 工资帽 12000 万 / 奢侈税线 14500 万 / 穷鬼线 9000 万。
- 玩家可调票价（140~340 元，弹性需求）与青训档位。
- 破产：现金 < -2000 万且连续 2 赛季 → **联盟托管**（不结束游戏）。
- **不做**：球馆升级、赞助商逐家谈判、门票季票系统、股价/上市。

> 设计支柱引用：**P4 单机也长线**（托管而非 GG）、**P1 一轮一决策**（票价调整是有真实 trade-off 的决策）。

---

## 二、数据结构

```js
// 挂在 Team 上
cash:         int,      // 万元，可为负
loan:         int,      // 万元
ticketPrice:  int,      // 元
youthTier:    int,      // 0..3
coachAbility: int,      // 0~100
reputation:   float,    // 0~1
hype:         float,    // 0~1
taxRepeater:  int,      // 连续超税年数

// 挂在 gameState.user 上（玩家队专属）
finance: {
  seasonIncome:  { ticket, merch, tv, sponsor, bonus },
  seasonExpense: { salary, tax, minPayroll, ops, coach, youth, transfer, buyout, interest },
  history: [ { year, income, expense, net, cashEnd, rank } ],
}

Loan { amount:int, year:int }     // 下赛季需还 amount × 1.12
```

---

## 三、规则

1. **门票按轮入账**：玩家队每有一个主场，当轮结算一次门票收入（现金实时反映战绩）。
2. **其余收入赛季末决算**：转播、赞助、季后赛奖金、周边在休赛期 step1 一次性入账。
3. **支出赛季末一次性结算**：薪资、奢侈税、穷鬼线补缴、运营、教练。
4. **转会费与买断金即时扣款**。
5. **工资帽校验**：任何签约前校验 `payroll + newSalary ≤ 12000`（底薪特例 ≤ 3 人、伯德续约除外）。
6. **贷款**：现金不足时可贷，上限 3000 万，年息 12%，**下赛季休赛期自动扣还**。
7. **破产判定**：`cash < -2000 万` 且**连续 2 个赛季** → 联盟托管。
8. **联盟托管后果**（不结束游戏）：
   - 强制挂牌出售薪资最高的 2 名球员，`askingPrice = value × 0.85`
   - `reputation -= 0.20`（clamp ≥ 0.05）
   - 现金重置为 0，获一次性补助 3000 万
   - 连续 3 次托管 → 游戏结束（GG 结算页）
9. **reputation 有滞后**：`rep += 0.30 × (winPct - rep)`，摆烂后恢复缓慢。
10. **AI 球队同样受工资帽与破产规则约束**（不作弊）。

---

## 四、公式

### 4.1 门票

```js
function attendanceRate(team, record) {
  const winPct = record.winPct;
  const starPower = clamp((bestOvr(team) - 55) / 35, 0, 1);
  return clamp(
      0.42 + 0.30 * winPct + 0.13 * starPower + 0.08 * team.hype + 0.14 * (team.reputation - 0.5),
    0.30, 1.00);
}

function elasticity(team, record) {
  const marketNorm = clamp((team.marketSize - 0.70) / 0.70, 0, 1);
  return clamp(0.90 * (1.45 - 0.55 * record.winPct - 0.35 * marketNorm), 0.45, 1.40);
}

function ticketRevenue(team, record, homeGames) {
  const E = elasticity(team, record);
  const ef = clamp(1 - E * (team.ticketPrice - 220) / 220, 0.55, 1.35);
  const att = clamp(attendanceRate(team, record) * ef, 0.25, 1.00);
  return Math.round(homeGames * 18000 * att * team.ticketPrice / 10000);   // 万元
}
```

**票价决策验算**（`marketSize = 1.0`）：
| 票价 | 中游队 E=0.90 | 强队(winPct .7, market 1.4) E=0.64 |
|---|---|---|
| 180 | ×1.164 → 209.5 | ×1.117 → 201.0 |
| 220 | ×1.000 → 220.0 | ×1.000 → 220.0 |
| 260 | ×0.836 → 217.4 | ×0.883 → 229.6 |
| 300 | ×0.673 → 201.8 | ×0.766 → 229.8 |
| 340 | ×0.509 → 173.1 | ×0.649 → 220.7 |

> **结论**：中游队最优票价 ≈ 220；强队/大市场最优 ≈ 280-300。**票价是真实决策，不是摆设。**

### 4.2 其余收入

```js
merch   = round(ticketRevenue * 0.18);
tv      = 4500 + 600 * playoffRoundsWon;
sponsor = round(2500 * marketSize * (0.70 + 0.60 * winPct) * (0.80 + 0.40 * rep));
bonus   = [800, 800, 800, 800, 1200].slice(0, playoffRoundsWon + (madePlayoff ? 1 : 0)).reduce(a+b);
// 进季后赛 +800；每赢一轮 +800/800/800；夺冠再 +1200 → 夺冠合计 4400
```

### 4.3 支出

```js
salary     = teamPayroll(teamId);
tax        = max(0, salary - 14500) * (taxRepeater >= 2 ? 2.50 : 1.75);
minPayroll = max(0, 9000 - salary) * 1.00;
ops        = 1800;
coach      = 200 + 6 * coachAbility;              // 200 ~ 800
youth      = YOUTH_TIERS[tier].cost;              // 0 / 300 / 800 / 1500
interest   = round(loan * 0.12);
```

### 4.4 净利与破产

```js
net = (ticket + merch + tv + sponsor + bonus) - (salary + tax + minPayroll + ops + coach + youth + interest);
cash += net;

if (cash < -2000) bankruptcyStreak++; else bankruptcyStreak = 0;
if (bankruptcyStreak >= 2) triggerTrusteeship(teamId);
```

### 4.5 reputation / hype 更新

```js
// 赛季末
rep = clamp(rep + 0.30 * (winPct - rep), 0.05, 1.00);
// 每轮
eventScore = 0.5 + (won ? 0.25 : -0.15) + clamp(winStreak / 8, 0, 0.25) + (margin >= 20 ? 0.15 : 0);
hype = clamp(0.85 * hype + 0.15 * eventScore, 0, 1);
```

### 4.6 财政平衡基线（`numbers.md` §11.4）

| 画像 | winPct | rep | 收入 | 支出 | 净利 |
|---|---|---|---|---|---|
| 弱队 | 0.30 | 0.35 | 13994 | 11600 | **+2394** |
| 中游 | 0.50 | 0.50 | 16316 | 13800 | **+2516** |
| 强队 | 0.70 | 0.70 | 23599 | 15900 | **+7699** |

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 顶栏数据条 | 现金 / 薪资空间 / 票价（可点） | 现金为负时红色 |
| 财务页 | 收入/支出分项条形图 + 赛季预测 | 显示「预计本赛季净利 ±N 万」 |
| 财务页 | 票价滑块（140-340，步长 20） | **实时显示预计上座率与门票收入**（支柱 P2） |
| 财务页 | 未来薪资表（按年，显示合同到期年） | 提前看到薪资爆炸风险 |
| 财务页 | 「贷款」按钮（上限 3000 万） | 显示下赛季需还金额 |
| 赛季末决算页 | 收入 / 支出 / 净利 三栏明细 | 与预算对比 |
| 破产警告 | 现金 < -1000 万时顶栏橙色横幅 | 「连续 2 赛季资不抵债将被联盟托管」 |

**可访问性**：现金负值同时有文字「负债」；图表有数据表替代。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 现金不足以支付赛季末薪资 | 现金变负；若 < -2000 → `bankruptcyStreak++` |
| E2 | 现金为负时尝试签约 | 禁止（除底薪），提示「现金不足，可贷款或出售球员」 |
| E3 | 贷款已达上限仍不足 | 只能卖人或裁员 |
| E4 | 薪资超奢侈税线 | 允许（不阻止），但赛季末按 1.75× 扣税；`taxRepeater++` |
| E5 | 薪资低于穷鬼线 | 赛季末按差额 100% 补缴（惩罚摆烂省钱） |
| E6 | `attendanceRate` 计算出 > 1 | clamp 到 1.00 |
| E7 | 票价设为极值导致需求崩塌 | `elasticFactor` clamp 到 [0.55, 1.35]，收入不会归零 |
| E8 | 连续 3 次托管 | 游戏结束（GG 页），展示生涯总结，禁止推进 |
| E9 | 季后赛奖金重复发放 | 用 `playoffRoundsWon` 精确计数，结算后置零 |
| E10 | AI 球队破产 | 同样触发托管（强制卖人），保证联盟生态健康 |
| E11 | 玩家队在休赛期没钱签新秀 | 新秀签约走底薪特例，不受现金限制（新秀薪资已包含在预算内） |
| E12 | `reputation` 被扣到负 | clamp 到 0.05 |

---

## 七、与其他系统的接口

```
依赖：S1（config）、S2（marketSize）、S3（teamPayroll / currentSalary）、
     S8（战绩 winPct / 季后赛轮数）

对外暴露：
  CG.Finance.attendanceRate(team, record)
  CG.Finance.ticketRevenue(team, record, homeGames)
  CG.Finance.applyRoundIncome(state, teamId, isHome, isPlayoff)
  CG.Finance.settleSeason(state, teamId) -> {income, expense, net}
  CG.Finance.availableCap(teamId) -> int         // 12000 - payroll
  CG.Finance.canSign(teamId, salary, isMinimum) -> bool
  CG.Finance.takeLoan(state, teamId, amount)
  CG.Finance.checkBankruptcy(state, teamId)
  CG.Finance.triggerTrusteeship(state, teamId)

被依赖：S7 season（每轮 applyRoundIncome；休赛期 step1 settleSeason）
       S9 transfer（canSign / availableCap 校验）
       S10 draft（青训预算扣款）
       S12 ai（AI 球队的财务决策）
       S13 ui（财务页 / 数据条）
```

---

## 八、验收用例

```js
// T1 票价最优（中游队）
const mid = mkTeam({marketSize:1.0, record:{winPct:0.5}, rep:0.5});
const revs = [180,220,260,300,340].map(p => ticketRevenueWith(mid, p));
assert(indexOfMax(revs) === 1);                    // 220 最优

// T2 票价最优（强队大市场）
const rich = mkTeam({marketSize:1.40, record:{winPct:0.70}, rep:0.7});
const revs2 = [180,220,260,300,340].map(p => ticketRevenueWith(rich, p));
assert(indexOfMax(revs2) >= 2);                    // ≥260

// T3 强弱队收入差（B9）
const weakIncome = seasonIncome(mkTeam({winPct:0.30, rep:0.35, marketSize:0.9}));
const strongIncome = seasonIncome(mkTeam({winPct:0.70, rep:0.70, marketSize:1.2, playoffRounds:2}));
assert(strongIncome - weakIncome >= 4000);

// T4 破产率（B8）
let bankrupt = 0, total = 0;
for (let s=1;s<=20;s++){
  const st = CG.State.create(s);
  for (let y=0;y<5;y++) runSeasonWithDefaultAI(st);
  Object.values(st.league.teams).forEach(t => { total++; if (t.bankruptcyStreak > 0) bankrupt++; });
}
const rate = bankrupt / total;
assert(rate >= 0.02 && rate <= 0.12);

// T5 工资帽
assert(CG.Finance.availableCap(mkTeamPayroll(11000)) === 1000);
assert(CG.Finance.canSign(mkTeamPayroll(11900), 200, false) === false);
assert(CG.Finance.canSign(mkTeamPayroll(11900), 120, true) === true);   // 底薪特例

// T6 奢侈税
const t = mkTeamPayroll(15500, {taxRepeater:0});
assert(CG.Finance.settleSeason(st, t.id).expense.tax === Math.round(1000 * 1.75));
const t2 = mkTeamPayroll(15500, {taxRepeater:2});
assert(CG.Finance.settleSeason(st, t2.id).expense.tax === Math.round(1000 * 2.50));

// T7 穷鬼线
const poor = mkTeamPayroll(8000);
assert(CG.Finance.settleSeason(st, poor.id).expense.minPayroll === 1000);

// T8 托管
const broke = mkTeamCash(-2500, {bankruptcyStreak:1});
CG.Finance.checkBankruptcy(st, broke.id);
assert(broke.trusteeCount === 1);
assert(Math.abs(broke.reputation - (repBefore - 0.20)) < 1e-9 || broke.reputation === 0.05);
assert(broke.cash === 3000);

// T9 连续 3 次托管 → GG
broke.trusteeCount = 3;
assert(CG.Season.isGameOver(st) === true);

// T10 reputation 滞后
const r = mkTeam({rep:0.5, record:{winPct:0.2}});
settleSeason(st, r.id);
assert(Math.abs(r.reputation - (0.5 + 0.30*(0.2-0.5))) < 1e-9);   // 0.41

// T11 贷款
CG.Finance.takeLoan(st, 'T01', 3000);
assert(cash('T01') increased by 3000 && loan('T01') === 3000);
CG.Finance.settleSeason(st,'T01');   // 下赛季
assert(cash('T01') decreased by 3360 && loan('T01') === 0);

// T12 AI 不超帽
Object.values(st.league.teams).forEach(t => assert(CG.Roster.teamPayroll(t.id) <= 14500 + 1));

// T13 无 NaN
assert(Number.isFinite(CG.Finance.settleSeason(st,'T01').net));
```

---

## 附 · v1 不做

- 球馆升级 / 容量差异（v1 全场馆 18000）
- 逐家赞助商谈判（v1 一个 `sponsor` 聚合数值）
- 季票 / 会员 / 周边商店经营
- 球队上市 / 股价 / 估值
- 转播合同谈判
