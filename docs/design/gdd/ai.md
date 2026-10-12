# GDD · S12 AI 经理（`ai.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §12　·　依赖：S1、S3、S5、S6、S9、S10、S11
> **纯规则行为树 + 性格谱，不接 LLM、不作弊。**

---

## 一、概述

S12 让另外 29 支球队"活"起来：它们会调战术、练球员、买卖球员、摆烂或冲刺。

### v1 最小可玩版本长什么样

- 每支 AI 球队有 4 维性格：`winNow` / `spend` / `patience` / `aggression`（0~100）。
- 6 条行为规则按优先级执行（甩卖 → 争冠 → 摆烂 → 补缺口 → 设战术 → 练球员）。
- **AI 与玩家用完全相同的公式**：同一份 `Roster.ovr()`、同一份 `Tactics.matchupMul()`、同一份 `Transfer.makeOffer()`、同一个工资帽。
- **AI 不预知玩家操作**，只读取当前公开状态（战绩、名册、市场挂牌）。
- **不做**：AI 之间的私下联盟、AI 记仇玩家、AI 学习玩家习惯（v1 无自适应）。

> 设计支柱引用：**P2 数字可解释**（AI 不作弊是"可解释"的一部分）、**P5 零版权**（纯规则，无外部依赖）。

---

## 二、数据结构

```js
Team.personality = {
  winNow:     int,    // 0~100，争冠紧迫度
  spend:      int,    // 0~100，花钱意愿
  patience:   int,    // 0~100，耐心（容忍重建）
  aggression: int,    // 0~100，交易侵略性
}
// 生成：~ clamp(N(50, 18), 0, 100)；其中 winNow 与 patience 负相关（-0.4）

AI 决策记录（调试用）：
aiLog: [ { round, teamId, action, detail } ]   // 保留最近 200 条，玩家可在「联盟动态」查看
```

---

## 三、规则

1. **触发时机**：
   - 赛季中：**每 5 轮** + **交易截止前 3 轮（R37-R40）**检查一次市场行为，每轮更新战术与训练。
   - 休赛期：按 step 顺序被动参与（选秀自动选、自由市场自动出价、续约自动判定）。
2. **行为树按优先级执行，命中即止**（每队每次最多执行 1 条市场规则 + 1 次战术/训练更新）：

| 优先级 | 条件 | 动作 |
|---|---|---|
| P1 | `cash < 1000 万` | 甩卖：挂牌薪资 Top2 且 OVR < 65 的球员，`askingPrice = value × 0.90` |
| P2 | `winNow > 70 且 winPct > 0.55` | 争冠：对 OVR ≥ 72 的挂牌球员出价 `value × need × 1.20` |
| P3 | `winPct < 0.35 且 patience > 60` | 摆烂：挂牌 `age ≥ 30 且 OVR ≥ 68` 的球员，要求换年轻球员或现金 |
| P4 | 某位置 `need > 1.15` | 补缺口：对该位置挂牌球员出价（见 §4.2） |
| P5 | 每轮必执行 | 自动设战术（见 §4.4） |
| P6 | 每轮必执行 | 自动分配训练（见 §4.5） |

3. **每轮每队最多 2 笔报价**（`MAX_OFFERS_PER_ROUND`），与玩家同规则。
4. **AI 不发出超过自身薪资空间 / 现金的报价**（`budgetMul` 已限制，最终仍走 `validateTrade`）。
5. **AI 的战术选择只依赖自己的名册构成**，不针对玩家队做特殊优化（v1 无针对性）。
   - v1.5 可加"对上一场对手的克制调整"，但需 `familiarity` 代价。
6. **AI 续约**：休赛期对本队到期球员，若 `ovr ≥ 65` 或 `age ≤ 25` 且薪资空间允许 → 自动续约（`p_sign` 判定用同一公式）。
7. **AI 不使用 `simulate()` 做批量试算**（性能考虑），只查表决策。

---

## 四、公式

### 4.1 位置缺口 `need`

```js
function needOf(teamId, pos) {
  const top2 = rosterOf(teamId).filter(p => p.pos === pos)
                 .sort((a,b) => ovr(b) - ovr(a)).slice(0, 2);
  const sum = top2.reduce((s,p) => s + ovr(p), 0);
  return clamp(1.25 - sum / 150, 0.30, 1.40);
}
```

### 4.2 出价

```js
function aiOffer(state, buyerId, player) {
  const v = CG.Transfer.value(player);
  const need = needOf(buyerId, player.pos);
  const cap = 12000 - CG.Roster.teamPayroll(buyerId);
  const budgetMul = clamp(cap / (v * need), 0, 1.15);
  const spendMul = 0.85 + 0.003 * personality.spend;      // 0.85~1.15
  const aggrMul  = 0.85 + 0.003 * personality.aggression; // 0.85~1.15
  return Math.round(v * need * budgetMul * spendMul * aggrMul);
}
```

### 4.3 摆烂判定（**反摆烂监控点**）

```js
isTanking = (winPct < 0.35) && (personality.patience > 60) && (personality.winNow < 45);
// 只有约 9% 的 AI 队会同时满足（0.35 × 0.6 × 0.45 ≈ 9.5%）
```

### 4.4 自动设战术

```js
function autoTactic(team) {
  const r = rosterOf(team);
  const avg = k => mean(r.map(p => p.attr[k]));
  const avgInside = mean(r.map(p => (p.attr.inside + p.attr.reb + p.attr.intD) / 3));
  const avgThree  = mean(r.map(p => p.attr.three));
  const avgSpeed  = mean(r.map(p => p.attr.speed));

  let offenseFocus = 'BALANCED', defense = 'MAN', pace = 3;
  if (avgInside >= 70 && avgThree < 55) { offenseFocus = 'POST';     defense = 'PACK';   pace = 2; }
  else if (avgThree >= 65)              { offenseFocus = 'PERIMETER'; defense = 'SWITCH'; pace = 4; }
  else if (avgSpeed >= 70)              { offenseFocus = 'MOTION';   defense = 'PRESS';  pace = 5; }
  else if (bestOvr(r) >= 80)            { offenseFocus = 'STAR';     defense = 'MAN';    pace = 3; }
  if (personality.winNow > 70) pace = Math.min(5, pace + 1);
  if (personality.patience > 70) pace = Math.max(1, pace - 1);
  return { pace, offenseFocus, defense, subFreq: clamp(3 + Math.round((avgSpeed - 60)/12), 1, 5) };
}
```

### 4.5 自动训练

```js
function autoTrain(team) {
  for (const p of rosterOf(team)) {
    if (p.injury || p.staminaNow < 20) { setPlan(p, 'rest'); continue; }
    if (p.age <= 24 && (p.pot - ovr(p)) >= 8) {
      // 练该位置权重最大的属性中最低的那一项
      const key = argminOver(top3WeightKeys(p.pos), k => p.attr[k]);
      setPlan(p, { type:'attr', attrKey: key });
    } else if (p.age <= 29) {
      setPlan(p, { type:'attr', attrKey: (p.attr.speed < p.attr.stamina ? 'speed' : 'stamina') });
    } else {
      setPlan(p, 'rest');                       // 老将保体力
    }
    if (team.tactic.chemistry < 50 && p.age >= 28) setPlan(p, { type:'team', tacticKey: team.tactic.offenseFocus });
  }
}
```

### 4.6 自动选秀

```js
score = ovr + 12 * needOf(teamId, pos) + 8 * clamp((pot - ovr) / 10, 0, 3);
```

### 4.7 自动续约

```js
shouldReSign = (ovr >= 65 || (age <= 25 && pot >= 70))
            && (payrollAfter <= 12000 * (1 + personality.spend / 500))
            && (cash > 500);
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 联盟动态页 | AI 行为日志（最近 20 条） | 「铁关磐石 挂牌 张扬（PF，OVR 68）」 |
| 联盟动态页 | 各队战术风格标签（自动生成的短语） | 如「慢节奏阵地战 · 护框优先」 |
| 球队详情页 | 性格 4 维条形图 + 一句性格描述 | 由性格谱生成文案 |
| 对手预览（赛前） | 显示对手当前 `offenseFocus` / `defense`（**玩家可据此调整**） | **支柱 P2** |
| 市场页 | AI 报价记录 | 显示报价方与金额 |

**性格文案模板**：
```
winNow 高 + aggression 高 → "这支球队急于赢球，愿意为即战力付出溢价"
patience 高 + winNow 低  → "这支球队正在重建，愿意送走老将"
spend 低                  → "老板抠门，很少参与高价竞争"
aggression 高             → "交易市场上非常活跃"
```

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | AI 队名册 < 10 人 | 强制签底薪自由球员（与玩家同规则） |
| E2 | AI 出价超过薪资空间 | `budgetMul` 限制 + `validateTrade` 兜底，失败则放弃 |
| E3 | AI 队现金为负 | 触发 P1 甩卖；连续 2 赛季破产 → 托管（与玩家同规则） |
| E4 | 市场上无人挂牌 | AI 跳过市场行为，只更新战术与训练 |
| E5 | 所有 AI 同时抢同一名球员 | 按 `offer` 降序处理，第一笔成交后其余 `EXPIRED` |
| E6 | AI 球队摆烂导致联赛观赏性下降 | 由 `concept.md` R6 的经济惩罚自然抑制；监控脚本 B11 验证 |
| E7 | `autoTactic` 每轮改变战术导致 familiarity 暴跌 | 加节流：**每 8 轮最多换 1 次战术**（除非名册变化 > 2 人） |
| E8 | AI 训练计划与玩家共用 `training.plan` 结构冲突 | 用 `plan` 的 key 区分 teamId（每队一张 plan 表） |
| E9 | AI 行为导致死循环（反复挂牌/撤回） | 挂牌后 8 轮内不得撤牌（除非成交） |
| E10 | `personality` 字段缺失（旧存档） | 默认填充 `{winNow:50, spend:50, patience:50, aggression:50}` |

---

## 七、与其他系统的接口

```
依赖：S1（rng.fork(`ai:R${round}:${teamId}`)）、S3（roster / ovr）、S5（tactics 查表）、
     S6（只读，用于评估阵容强度）、S9（makeOffer / createListing）、S10（autoPick）、
     S11（availableCap / cash）

对外暴露：
  CG.AI.act(state, round)                     // 每轮调用，遍历 29 支 AI 队
  CG.AI.autoTactic(team) -> Tactic
  CG.AI.autoTrain(state, team)
  CG.AI.aiOffer(state, buyerId, player) -> int
  CG.AI.needOf(teamId, pos) -> float
  CG.AI.autoPick(state, teamId, pool) -> playerId
  CG.AI.autoReSign(state, teamId, player) -> bool

被依赖：S7 season（在 advanceRound 第 9 步调用）、S13 ui（联盟动态页）
```

---

## 八、验收用例

```js
// T1 AI 不作弊：不超工资帽
runSeasons(st, 3);
Object.values(st.league.teams).forEach(t =>
  assert(CG.Roster.teamPayroll(t.id) <= 14500 + 1));

// T2 AI 不出超过现金的价
aiLog.filter(l => l.action === 'offer').forEach(l =>
  assert(l.cash <= teamCashAt(l.teamId, l.round)));

// T3 AI 每轮报价数上限
for (let r=1;r<=58;r++){
  const cnt = countBy(aiLog.filter(l=>l.round===r && l.action==='offer'), 'teamId');
  Object.values(cnt).forEach(v => assert(v <= 2));
}

// T4 行为树优先级
const broke = mkAITeam({cash:500, winPct:0.7, winNow:90});
CG.AI.act(st, 10);
assert(aiLog.filter(l=>l.teamId===broke.id).pop().action === 'list');   // 甩卖优先于争冠

// T5 摆烂队比例
const tanking = st.league.teams.filter(t =>
  CG.AI.isTanking(t, st.standings[t.id])).length;
assert(tanking <= 6);                          // 30 队中不超过 6 支摆烂

// T6 自动战术合理
const insideTeam = mkAITeam({roster: allBigMen});
assert(CG.AI.autoTactic(insideTeam).offenseFocus === 'POST');
const threeTeam = mkAITeam({roster: allShooters});
assert(CG.AI.autoTactic(threeTeam).offenseFocus === 'PERIMETER');

// T7 战术节流（E7）
const t = mkAITeam({});
let changes = 0, last = CG.AI.autoTactic(t).offenseFocus;
for (let r=1;r<=24;r++){ CG.AI.act(st, r);
  const now = st.league.teams.find(x=>x.id===t.id).tactic.offenseFocus;
  if (now !== last) { changes++; last = now; } }
assert(changes <= 4);                          // 24 轮最多换 3~4 次

// T8 AI 与玩家同函数
const p = somePlayer;
assert(CG.AI.aiOffer(st,'T02',p) === Math.round(
  CG.Transfer.value(p) * CG.AI.needOf('T02', p.pos) * budgetMul * spendMul * aggrMul));

// T9 AI 胜率分布（无极端垄断）
runSeasons(st, 3);
const wp = Object.values(st.standings).map(r => r.winPct);
assert(Math.max(...wp) <= 0.85);
assert(Math.min(...wp) >= 0.15);

// T10 AI 队名册健康
Object.values(st.league.teams).forEach(t => assert(t.playerIds.length >= 10));

// T11 AI 不产生 NaN
assert(!JSON.stringify(st.aiLog).includes('NaN'));

// T12 确定性
const A = mkState(88); for(let r=1;r<=58;r++) CG.AI.act(A, r);
const B = mkState(88); for(let r=1;r<=58;r++) CG.AI.act(B, r);
assert(JSON.stringify(A.aiLog) === JSON.stringify(B.aiLog));
```

---

## 附 · v1 不做

- AI 之间的私下联盟 / 串通
- AI 记仇玩家（"上次你抢了我的球员"）
- AI 自适应学习玩家习惯
- AI 针对玩家队做战术克制调整（v1.5 再加）
- AI 用 `simulate()` 批量试算阵容（性能考虑）
