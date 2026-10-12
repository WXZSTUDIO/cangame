# GDD · S9 转会市场（`transfer.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §8、§9　·　依赖：S1、S3、S11（薪资空间）、S12（AI 报价）

---

## 一、概述

S9 管理球员流通：身价计算、挂牌、报价、成交判定、签约、裁员，以及所有**工资帽与名册上限的硬校验**。

### v1 最小可玩版本长什么样

- 挂牌：玩家可挂自己的球员，AI 会来报价；也可浏览 AI 挂牌池主动出价。
- 自由市场：休赛期 3 轮竞价，球员按 `p_sign` 概率选择报价。
- 裁员：支付剩余合同 50%（老将 80%）的买断金。
- 硬校验：名册 ∈ [10, 15]、薪资 ≤ 工资帽（底薪与续约特例除外）、现金 ≥ 0。
- **不做**：选秀权交易、三方交易、先签后换、交易否决权、球员选项。

> 设计支柱引用：**P2 数字可解释**（每个报价显示被接受概率）、**P4 单机也长线**（市场是长期阵容构建的主渠道）。

---

## 二、数据结构

```js
Listing {
  id, playerId, sellerTeamId,
  askingPrice: int,               // 万元
  listedRound: int,
  drops: int,                     // 已自动降价次数 0..3
  willingness: float,             // 0.70 ~ 1.30，卖家成交意愿
  status: 'OPEN'|'SOLD'|'EXPIRED',
}

Offer {
  id, listingId|playerId,
  fromTeamId, toTeamId,
  cash: int,                      // 转会费（万元）
  playerIds: [string],            // 作为筹码的球员（可为空）
  salaryOffer: [int],             // 若是自由球员签约，给出合同薪资数组
  years: int,
  round: int,
  status: 'PENDING'|'ACCEPTED'|'REJECTED'|'EXPIRED',
  prob: float,                    // ★ 判定出来的接受概率，UI 直接展示
}

transfer: {
  listings: [Listing],
  offers:   [Offer],
  freeAgents: [playerId],         // teamId === null 的球员
}
```

---

## 三、规则

1. **交易窗口**：`round ≤ 40` 开放；季后赛与休赛期 step1-5 关闭；选秀后（step 4 起）重新开放给自由市场。
2. **每队每轮最多 2 笔报价**（`MAX_OFFERS_PER_ROUND = 2`），防市场爆炸。
3. **挂牌自动降价**：挂出后 8 轮无人成交 → 自动降价 8%，最多降 3 次；之后自动下架。
4. **成交判定**：玩家出价后**立即**用 `p_accept` 判定（不等待），判定结果当场揭晓并生成新闻。
5. **硬校验（交易成立的前置条件，任一失败则拒绝）**：
   - 买家名册数 + 得到人数 - 付出人数 ∈ [10, 15]
   - 买家付出现金后 `cash ≥ 0`
   - 买家交易后总薪资 ≤ `SALARY_CAP`（签约本队球员续约、底薪签约除外）
   - 球员不在伤缺的严重伤病期（可交易，但需在新闻里标注）
   - 交易双方不是同一队
6. **底薪特例**：签 `MIN_SALARY`（120 万）的自由球员不受工资帽限制（每队每赛季最多 3 个）。
7. **裁员**：立即生效，付买断金；被裁球员进自由市场。
8. **续约**：只能在休赛期对本队到期球员进行；伯德条款（`birdYears ≥ 3`）允许年薪涨幅 12% 且可超帽。
9. **AI 报价**每轮生成一次，走 `ai.js` 调用本模块的 `makeOffer()`。

---

## 四、公式

### 4.1 身价与期望年薪

```js
// numbers.md 8.1 / 8.2
function expectedSalary(p) {
  const o = CG.Roster.ovr(p);
  if (o <= 40) return 120;                                  // 底薪
  return 8 * Math.pow(o - 40, 1.40)
       * AGE_SALARY_MUL(p.age)
       * (0.92 + 0.0016 * p.ego);
}

function value(p) {
  const o = CG.Roster.ovr(p);
  if (o <= 40) return 30;
  const youngBonus = p.age <= 23 ? 1.0 : (p.age <= 26 ? 0.4 : 0);
  const potPremium = clamp((p.pot - o) / 30, 0, 1) * 0.55 * youngBonus;
  return 22 * Math.pow(o - 40, 1.35) * AGE_VALUE_MUL(p.age) * (1 + potPremium);
}
```

### 4.2 挂牌

```js
askingPrice = value(p) * (1.15 + (greed - 50) / 500);
willingness =
    (球员近 5 场场均上场 < 8 分钟 ? 1.25 : 1.00)
  * (球员是首发                    ? 0.80 : 1.00)
  * (卖家 cash < 1000 万           ? 1.20 : 1.00);
willingness = clamp(willingness, 0.70, 1.30);
```

### 4.3 AI 报价

```js
need = clamp(1.25 - (该位置现有 2 名主力 OVR 和 / 150), 0.30, 1.40);
budgetMul = clamp(availableCap / (value(p) * need), 0, 1.15);
  availableCap = 12000 - teamPayroll(buyerId);
personalityMul = 0.85 + 0.003 * aggression;
offer = round(value(p) * need * budgetMul * personalityMul);
```

### 4.4 成交概率（★ UI 直接展示）

```js
p_accept = clamp((offer / askingPrice - 0.75) / 0.55, 0, 1) * willingness;
```
| offer / asking | p_accept（willingness = 1.0） |
|---|---|
| 0.80× | 0.091 |
| 1.00× | 0.455 |
| 1.15× | 0.727 |
| 1.30× | 1.000 |

### 4.5 自由球员签约

```js
score = 0.55 * clamp((offerSalary / expectedSalary(p) - 0.75) / 0.45, 0, 1.2)
      + 0.25 * teamStrength(buyerId)                       // 0~1
      + 0.20 * (p.lastTeamId === buyerId ? 0.60 + 0.004 * p.loyalty : 0);
p_sign = clamp(score, 0, 0.95);
```
```
teamStrength = clamp((bestOvr(team) - 45) / 40, 0, 1)
```

### 4.6 买断金

```js
buyout = round(sum(remainingSalaries) * (p.age >= 32 ? 0.80 : 0.50));
// 被裁后仍占用薪资空间：按剩余年限 × BUYOUT_RATE 分摊到各年
deadCapYear = round(currentSalary * BUYOUT_RATE);
```

### 4.7 续约涨幅

```js
maxRaise = (birdYears >= 3) ? 0.12 : 0.08;
salaries[i] = round(base * Math.pow(1 + maxRaise, i));
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 市场页 | Tab：挂牌池 / 自由球员 / 我的挂牌 / 报价记录 | — |
| 挂牌池 | 表格：球员 / 位置 / 年龄 / OVR / 潜力 / 身价 / 挂牌价 / 卖家 | 可按位置与 OVR 筛选排序 |
| 球员行 | 「出价」按钮 → 弹窗输入转会费（滑块，默认 = 身价） | **实时显示接受概率**（支柱 P2） |
| 出价弹窗 | 显示：我的薪资空间、现金、出价后名册数 | 校验失败时按钮禁用并说明原因 |
| 我的球员 | 「挂牌」按钮 → 输入要价（范围 `[value*0.7, value*1.8]`） | — |
| 收到的报价 | 列表：报价方 / 金额 / 球员 | 「接受 / 拒绝」，拒绝可还价一次 |
| 名册行 | 「裁人」→ 二次确认显示买断金 | 红色危险操作 |
| 休赛期自由市场 | 3 轮竞价，每轮玩家对任意 FA 出价一次 | 每轮结束统一结算 |

**可访问性**：概率用数字 + 进度条双呈现；危险操作有文字确认而非仅颜色。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 交易后买家名册 > 15 | 拒绝，提示「需先裁掉 N 名球员」 |
| E2 | 交易后买家名册 < 10 | 拒绝，提示「名册将不足 10 人」 |
| E3 | 交易后薪资 > 工资帽 | 拒绝（续约/底薪特例除外），提示超出金额 |
| E4 | 现金不足支付转会费 | 出价按钮禁用，提示可贷款（上限 3000 万，年息 12%） |
| E5 | 交易截止日后尝试交易 | 按钮禁用 + 顶栏说明「交易市场已关闭」 |
| E6 | 报价被拒后玩家还价 | 允许 1 次还价，还价后重新判定 `p_accept` |
| E7 | 自由球员 3 轮无人签 | 底薪签约随机球队（用 `rng.fork('fa:fallback')`） |
| E8 | AI 报价超过其薪资空间 | `budgetMul` 已限制；最终仍校验，失败则放弃该笔报价 |
| E9 | 挂牌球员被交易走 | 挂牌自动撤销，`status = 'EXPIRED'` |
| E10 | 挂牌降价 3 次后仍无人问津 | 自动下架，生成新闻「XXX 无人问津，撤回挂牌」 |
| E11 | 玩家队现金 < -2000 万 | 禁止任何付费操作（签约/报价/青训），只能卖人 |
| E12 | 同一球员同一轮收到多笔报价 | 按 `offer` 降序处理，第一笔成交后其余标记 `EXPIRED` |

---

## 七、与其他系统的接口

```
依赖：S1（config / rng.fork('transfer:R${round}')）、S3（Player / roster / teamPayroll）、
     S11（Finance.availableCap / cash / applyCash）

对外暴露：
  CG.Transfer.value(p) -> int
  CG.Transfer.expectedSalary(p) -> int
  CG.Transfer.createListing(state, teamId, playerId, askingPrice)
  CG.Transfer.autoDropPrice(state)                  // 每轮调用
  CG.Transfer.makeOffer(state, fromTeamId, listingId, cash, playerIds) -> Offer
  CG.Transfer.resolveOffer(state, offer) -> bool     // 立即判定
  CG.Transfer.signFreeAgent(state, teamId, playerId, salaries[], years) -> bool
  CG.Transfer.waive(state, teamId, playerId)         // 裁员
  CG.Transfer.reSign(state, teamId, playerId, years) // 续约
  CG.Transfer.validateTrade(state, buyerId, getIds, giveIds, cash) -> {ok, reason}

被依赖：S7 season（每轮调用 autoDropPrice + AI 报价结算）
       S10 draft（签约新秀复用 signFreeAgent 的校验）
       S12 ai（调用 makeOffer）
       S13 ui（市场页）
```

---

## 八、验收用例

```js
// T1 身价量级
assert(CG.Transfer.value(mk({ovr:70, age:25, pot:78})) > 2000);
assert(CG.Transfer.value(mk({ovr:50, age:21, pot:85})) > 800);   // 潜力新秀不便宜
assert(CG.Transfer.value(mk({ovr:70, age:34, pot:70})) < 1200);  // 老将贬值

// T2 期望薪资单调
assert(CG.Transfer.expectedSalary(mk({ovr:80,age:27})) > CG.Transfer.expectedSalary(mk({ovr:70,age:27})));
assert(CG.Transfer.expectedSalary(mk({ovr:70,age:35})) < CG.Transfer.expectedSalary(mk({ovr:70,age:27})));

// T3 成交概率曲线
assert(Math.abs(acceptProb(0.80 * asking, asking, 1.0) - 0.0909) < 0.005);
assert(Math.abs(acceptProb(1.00 * asking, asking, 1.0) - 0.4545) < 0.005);
assert(Math.abs(acceptProb(1.30 * asking, asking, 1.0) - 1.0) < 1e-9);
assert(acceptProb(0.50 * asking, asking, 1.0) === 0);

// T4 意愿区间
l = createListing(...);
assert(l.willingness >= 0.70 && l.willingness <= 1.30);

// T5 名册上限
const big = mkTeamWith(15);
assert(CG.Transfer.validateTrade(st, big.id, [p1], [], 0).ok === false);
assert(CG.Transfer.validateTrade(st, big.id, [p1], [p2, p3], 0).ok === true);

// T6 工资帽
const capped = mkTeamPayroll(11800);
assert(CG.Transfer.validateTrade(st, capped.id, [starPlayer], [], 0).ok === false);

// T7 底薪特例
assert(CG.Transfer.validateTrade(st, capped.id, [bumPlayer], [], 0).ok === true);  // 120 万

// T8 现金
const poor = mkTeamCash(100);
assert(CG.Transfer.validateTrade(st, poor.id, [starPlayer], [], 5000).ok === false);

// T9 自动降价
const l2 = createListing(state, 'T01', pid, 3000);
for (let i=0;i<8;i++) CG.Transfer.autoDropPrice(state);
assert(Math.abs(l2.askingPrice - 3000*0.92) < 1);
for (let i=0;i<24;i++) CG.Transfer.autoDropPrice(state);
assert(l2.status === 'EXPIRED');

// T10 成交率（B13）
let made=0, acc=0;
for (let i=0;i<500;i++){
  const o = CG.Transfer.makeOffer(st, 'T01', listing.id, value*1.1, []);
  made++; if (CG.Transfer.resolveOffer(st, o)) acc++;
}
assert(acc/made >= 0.25 && acc/made <= 0.60);

// T11 自由球员签约概率
const fa = mk({ovr:65, age:26, loyalty:50});
assert(CG.Transfer.signFreeAgentProb(st,'T01',fa, expectedSalary(fa)*1.2, 3) >
       CG.Transfer.signFreeAgentProb(st,'T01',fa, expectedSalary(fa)*0.9, 3));

// T12 买断
const p = mkPlayer({contract:{years:2, salaries:[1000,1000]}, age:30});
CG.Transfer.waive(st,'T01',p.id);
assert(teamCash('T01') decreased by 1000);      // (1000+1000)*0.5
assert(p.teamId === null);

// T13 市场不垄断（B12）
runSeasons(st, 3);
const counts = teams.map(t => rosterOf(t).filter(p => CG.Roster.ovr(p) >= 85).length);
assert(Math.max(...counts) <= 3);

// T14 AI 不超帽
Object.values(st.league.teams).forEach(t => assert(CG.Roster.teamPayroll(t.id) <= 14500));
```

---

## 附 · v1 不做

- 选秀权交易、未来签、现金上限
- 三方 / 多方交易
- 先签后换（sign-and-trade）
- 交易否决权、球员选项、10 天合同
- 交易谈判多轮拉扯（v1 是"出价 → 概率立即判定"）
