# GDD · S10 选秀与青训（`draft.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §10　·　依赖：S1、S3、S11（青训预算）
> **反摆烂（Tank）的关键系统**，见 `concept.md` R6。

---

## 一、概述

S10 负责每年休赛期的**人才输入**：乐透抽签 → 新秀生成 → 选秀 → 签约，以及常年的青训投入产出。

### v1 最小可玩版本长什么样

- 乐透：14 支非季后赛球队抽前 4 顺位，权重 `(15-rank)^1.6`。
- 选秀：2 轮 × 30 顺位 = 60 名新秀；玩家按顺位手动选，AI 自动选（按"最高 OVR + 位置缺口"）。
- 新秀合同：固定薪资表（按顺位），首轮 4 年（第 4 年球队选项），次轮 2 年。
- 青训：3 档投入（300 / 800 / 1500 万），产出 1 / 2 / 3 名候选。
- **不做**：选秀权交易、国际球员、新秀夏季联赛表现、提前参选声明。

> 设计支柱引用：**P4 单机也长线**（新秀成长是王朝骨架的主要来源）。

---

## 二、数据结构

```js
draft: {
  year: int,
  lotteryOrder: [teamId],      // 14 支，抽签后的最终顺序（前 4 为抽签产生）
  order: [teamId],             // 30 支，完整首轮顺序
  picks: [ { pick:int, teamId, playerId|null } ],   // 60 项（2 轮）
  pool: [playerId],            // 新秀池，≥60 名
  currentPick: int,
}

Player.draft = { year:int, pick:int|null }
Player.career.debutYear = int
```

---

## 三、规则

1. **乐透池**：14 支未进季后赛的球队，按常规赛战绩从差到好排 `rank 1..14`（rank 1 = 最差）。
2. **抽前 4 顺位**：每抽中一队，该队从池中移除（不重复中奖）。第 5~14 顺位按剩余战绩倒序。
3. **季后赛球队**：16 支按战绩倒序（冠军最后）占据第 15~30 顺位。
4. **新秀池生成**：每届生成 **80 名**候选（实际被选 60 名，剩 20 名落选进自由市场底薪签约）。
5. **新秀 OVR**：`mu(pick) = 63 - 18 × ((pick-1)/59)^0.75`，但**池内候选是按独立分布预生成的**，选秀时 AI/玩家从中挑。
   - 实现：池内 80 人的 `ovr` 按 `mu(slot)` 生成，`slot = 1..80`（`mu(60) = 45`）。
6. **玩家选秀**：轮到玩家顺位时弹出候选列表（按 OVR 降序，可切换排序），选中后立即进入下一顺位。
7. **AI 选秀**：选**位置缺口最大**且 **OVR 最高**的加权最优：`score = ovr + 12 * need + 8 * (pot - ovr)/10`。
8. **新秀签约**：自动按顺位薪资表签约，占名册名额（若名册满 15 则需先裁人）。
9. **青训**：休赛期第 6 步，玩家选档位；候选直接进名册（3 年底薪合同）。
10. **落选新秀**：选秀结束后，池中剩余球员以底薪（120 万，1 年）随机签约薪资空间充足的球队。

---

## 四、公式

### 4.1 乐透

```js
weight(rank) = Math.pow(15 - rank, 1.6);          // rank 1..14
// rank 1 → 68.21 (16.97%)；rank 7 → 22.50 (5.60%)；rank 14 → 1.00 (0.25%)
// 总权重 401.99

function lottery(rng) {
  const pool = [...lotteryTeams];                  // 按 rank 升序
  const result = [];
  for (let i = 0; i < 4; i++) {
    const w = pool.map(t => Math.pow(15 - rankOf(t), 1.6));
    const winner = rng.weighted(pool, w);
    result.push(winner);
    pool.splice(pool.indexOf(winner), 1);
  }
  return [...result, ...pool];                     // 前 4 抽签 + 剩余按战绩倒序
}
```

### 4.2 新秀生成

```js
function genRookie(rng, slot) {                    // slot 1..80
  const age = rng.weighted([19,20,21,22], [0.45, 0.30, 0.18, 0.07]);
  const mu = 63 - 18 * Math.pow((slot - 1) / 79, 0.75);
  const sigma = slot <= 30 ? 6.5 : 8.0;
  const ovr = clamp(Math.round(rng.normal(mu, sigma)), 35, 78);
  const youngBonus = {19:1.30, 20:1.10, 21:0.95, 22:0.80}[age];
  const pot = clamp(ovr + Math.max(0, Math.round(rng.normal(12, 6) * youngBonus)), ovr, 95);
  const pos = rng.pick(['PG','SG','SF','PF','C']);   // 均匀，保证位置多样
  // 属性按 OVR 反解：以位置权重为基准生成，再缩放到目标 OVR
  ...
}
```
**属性反解算法**（保证 `ovr(p) === 目标 ovr`）：
```js
let raw = {};
for (k of ATTR_KEYS) raw[k] = clamp(round(rng.normal(50 + (W[pos][k]-0.0833)*55, 9)), 20, 95);
let base = Σ W[pos][k] * raw[k];
let scale = targetOvr / base;
for (k of ATTR_KEYS) raw[k] = clamp(round(raw[k] * scale), 20, 95);
// 微调：round 后可能差 1~2 点，对最大权重项 ±1 修正到恰好等于 targetOvr
```

### 4.3 新秀薪资表

```js
function rookieSalary(pick) {
  if (pick === 1)  return 900;
  if (pick <= 5)   return 720 - (pick - 2) * 60;     // 720, 660, 600, 540
  if (pick <= 14)  return 480 - (pick - 6) * 22;     // 480 → 304
  if (pick <= 30)  return 280 - (pick - 15) * 8;     // 280 → 160
  return Math.round(200 - (pick - 31) * 2.7);        // 200 → 122
}
years = pick <= 30 ? 4 : 2;
teamOption = (pick <= 30);                            // 最后一年球队选项
```

### 4.4 青训

```js
YOUTH_TIERS = [
  { cost:300,  n:1, mu:42, sigma:5,  genius:0 },
  { cost:800,  n:2, mu:46, sigma:6,  genius:0 },
  { cost:1500, n:3, mu:50, sigma:7,  genius:0.15 },
];
候选年龄 17~19（均匀）
ovr = clamp(round(rng.normal(mu, sigma)), 30, 75)
若命中 genius（仅第 3 档）：ovr += 10; pot += 15
签约：3 年，年薪 120 万（底薪）
```

### 4.5 AI 选秀评分

```js
score = ovr
      + 12 * need(pos)                              // need 见 gdd/transfer.md 4.3
      + 8 * clamp((pot - ovr) / 10, 0, 3);
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 休赛期 step4 · 乐透 | 抽签动画（依次揭晓前 4 顺位） | 可「跳过动画」 |
| 乐透结果页 | 14 队的中签概率表 + 实际结果 | 高亮玩家队 |
| 选秀页 | 左侧：顺位进度（60 格）；右侧：候选池表格 | 轮到玩家顺位时高亮 |
| 候选池 | 列：姓名 / 位置 / 年龄 / OVR / **潜力** / 预测顺位 | 可按 OVR 或潜力排序，可搜姓名 |
| 候选行 | 点击展开：12 项属性雷达 + 性格 4 维 | 弹层 |
| 选中后 | 「确认选择」→ 自动进入下一顺位 | AI 顺位 0.4 秒自动完成（可加速） |
| 休赛期 step6 · 青训 | 4 档单选卡片（0 / 300 / 800 / 1500 万） | 显示预期产出与概率 |
| 选秀结果 | 「本届选秀回顾」列表 60 项 | 可导出为文本 |

**可访问性**：选秀候选表格用 `<table>`；乐透动画有键盘跳过；候选排序按钮有 `aria-pressed`。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 新秀池 < 60 人（生成异常） | 断言失败；兜底补充生成至 80 人 |
| E2 | 玩家队名册已满 15 人时轮到选秀 | 提示「需先裁掉 N 名球员才能完成签约」，暂停选秀直到处理 |
| E3 | 玩家不选直接跳过顺位 | 允许「自动选择」（按 AI 评分最高的候选） |
| E4 | 乐透权重全为 0（不可能） | `rng.weighted` 退化为均匀分布 |
| E5 | 青训候选 `ovr` 超过 75 | clamp 到 75；天才加成后 clamp 到 82 |
| E6 | `pot` 反解后小于 `ovr` | `pot = max(pot, ovr)` |
| E7 | 落选新秀无队可签（全部满员/超帽） | 移除该球员（退役处理），生成新闻 |
| E8 | 玩家队在乐透中抽到第 1 顺位但战绩并非最差 | **允许**（这是乐透的意义），生成「惊喜」新闻 |
| E9 | 属性反解后 `ovr` 与目标差 > 2 | 对最大权重属性做 ±1 循环修正，最多 10 次 |
| E10 | 选秀中途刷新页面 | 从 `draft.currentPick` 恢复，`picks` 数组已持久化 |

---

## 七、与其他系统的接口

```
依赖：S1（config / rng.fork(`draft:${year}:lottery`) / rng.fork(`draft:${year}:pool`)）、
     S3（genPlayer / ovr）、S8（战绩 → 乐透 rank）、S11（青训预算扣款）

对外暴露：
  CG.Draft.genPool(state, year) -> playerId[80]
  CG.Draft.runLottery(state) -> teamId[14]
  CG.Draft.buildFullOrder(state) -> teamId[30]
  CG.Draft.autoPick(state, teamId) -> playerId        // AI / 玩家跳过时使用
  CG.Draft.manualPick(state, teamId, playerId)
  CG.Draft.signRookie(state, teamId, playerId, pick)
  CG.Draft.finishDraft(state)                          // 落选新秀处理
  CG.Draft.runYouth(state, teamId, tier) -> playerId[]
  CG.Draft.rookieSalary(pick) -> int

被依赖：S7 season（休赛期 step4 / step6）
       S13 ui（选秀页 / 青训卡）
```

---

## 八、验收用例

```js
// T1 乐透分布（B10）
const counts = {};
for (let i=0;i<10000;i++){
  const order = CG.Draft.runLottery(mkState(i));
  counts[order[0]] = (counts[order[0]]||0) + 1;
}
const worst = counts[rank1TeamId] / 10000;
assert(worst >= 0.13 && worst <= 0.20);                 // 最差队状元概率 13~20%
const lastLottery = counts[rank14TeamId] / 10000;
assert(lastLottery >= 0.001 && lastLottery <= 0.006);   // 末位 0.1~0.6%

// T2 乐透不重复
for (let i=0;i<2000;i++){
  const order = CG.Draft.runLottery(mkState(i));
  assert(new Set(order).size === 14);
}

// T3 顺位顺序
const full = CG.Draft.buildFullOrder(st);
assert(full.length === 30);
assert(full.slice(0,14).every(t => isLotteryTeam(t)));
assert(full[14] === 战绩第16的队);                       // 季后赛队伍按战绩倒序

// T4 新秀 OVR 分布
const pool = CG.Draft.genPool(st, 2);
assert(pool.length === 80);
const ovrs = pool.map(id => CG.Roster.ovr(st.players[id]));
assert(Math.min(...ovrs) >= 35 && Math.max(...ovrs) <= 78);
assert(mean(ovrs.slice(0,10)) > mean(ovrs.slice(30,40)));   // 前面更强

// T5 OVR 反解精度
pool.forEach(id => {
  const p = st.players[id];
  assert(Math.abs(CG.Roster.ovr(p) - p.targetOvr) <= 1);
});

// T6 潜力 ≥ OVR
pool.forEach(id => assert(st.players[id].pot >= CG.Roster.ovr(st.players[id])));

// T7 薪资表
assert(CG.Draft.rookieSalary(1) === 900);
assert(CG.Draft.rookieSalary(2) === 720);
assert(CG.Draft.rookieSalary(5) === 540);
assert(CG.Draft.rookieSalary(6) === 480);
assert(CG.Draft.rookieSalary(14) === 304);
assert(CG.Draft.rookieSalary(15) === 280);
assert(CG.Draft.rookieSalary(30) === 160);

// T8 选秀完整性
runDraft(st);
assert(st.draft.picks.length === 60);
assert(st.draft.picks.every(p => p.playerId !== null));
assert(new Set(st.draft.picks.map(p=>p.playerId)).size === 60);

// T9 名册上限
const full15 = mkTeamWith(15);
assertThrows(() => CG.Draft.signRookie(st, full15.id, rookieId, 5));

// T10 青训产出
const t3 = CG.Draft.runYouth(st, 'T01', 3);
assert(t3.length === 3);
t3.forEach(id => { const p = st.players[id];
  assert(p.age >= 17 && p.age <= 19);
  assert(CG.Roster.ovr(p) >= 30 && CG.Roster.ovr(p) <= 82);
  assert(p.contract.years === 3 && p.contract.salaries[0] === 120);
});

// T11 青训预算扣除
const before = cash('T01');
CG.Draft.runYouth(st, 'T01', 3);
assert(cash('T01') === before - 1500);

// T12 反摆烂（B11）
const tank = simulateStrategy(st, 'TANK', 3);      // 连续 3 赛季摆烂
const mid  = simulateStrategy(st, 'MID', 3);       // 中游经营
assert(netWorth(tank) < netWorth(mid));
// netWorth = 名册 OVR 总和 + 现金/100

// T13 可复现
const A = mkState(1234); CG.Draft.genPool(A, 1); CG.Draft.runLottery(A);
const B = mkState(1234); CG.Draft.genPool(B, 1); CG.Draft.runLottery(B);
assert(JSON.stringify(A.draft) === JSON.stringify(B.draft));
```

---

## 附 · v1 不做

- 选秀权交易（v1 选秀权完全不可交易）
- 国际球员 / 海外联赛挖掘
- 新秀夏季联赛、试训、体测数据
- 提前参选 / 退出选秀声明
- 落选新秀的发展联赛
