# GDD · S7 赛季推进（`season.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §1、§4、§5、§11　·　依赖：S1、S2、S3、S4、S6、S8、S9、S10、S11、S12
> **编排者系统**：本模块不产生新规则，只负责把其他系统按正确顺序串起来。

---

## 一、概述

S7 是「进行下一轮」按钮背后的主流程。它管理赛季阶段机、一轮推进的完整结算顺序、休赛期 6 步流程、跨赛季状态迁移与新闻生成。

### v1 最小可玩版本长什么样

- 阶段机：`REGULAR(R1-R58) → PLAYOFF(R59-R80) → OFFSEASON → 下一季 REGULAR`。
- 「进行下一轮」：模拟该轮 15 场（玩家队正常模式输出 pbp，其余 fastMode）→ 执行结算 → 自动存档。
- 快进四档：`快进 5 轮` / `快进到交易截止` / `快进到季后赛` / `快进到休赛期`。
- 休赛期 6 步：**赛季结算 → 老化 → 合同推进 → 选秀 → 自由市场 → 青训 + 训练营**。
- **不做**：全明星赛、赛季中途事件（罢工/扩军）、玩家手动编辑赛程、赛季回顾动画。

> 设计支柱引用：**P1 一轮一决策**（快进按钮只在玩家不需要决策时出现）、**P4 单机也长线**（跨赛季无缝）。

---

## 二、数据结构

```js
season: {
  year:         int,        // 1..N
  phase:        enum,       // 'REGULAR' | 'PLAYOFF' | 'OFFSEASON'
  round:        int,        // 1..80（OFFSEASON 时为 0）
  playoffRound: int,        // 0=未开始 | 1=首轮 | 2=半决赛 | 3=分区决赛 | 4=总决赛
  playoffGameIdx: int,      // 当前季后赛轮内的第几场（1..7）
  tradeOpen:    bool,       // round <= 40 时 true
  offseasonStep:int,        // 0..6
}

news: [ { id, round, year, type, text, teamIds:[], playerIds:[] } ]   // 保留最近 50 条
```

### 一轮推进的**固定执行顺序**（★ 顺序不可变，影响可复现性）

```
advanceRound():
  0. 前置校验（名册 ≥10、可用 ≥5、非赛季结束）
  1. 训练结算        Training.applyTraining(每队)               ← 先训练，后比赛（疲劳即刻生效）
  2. 比赛模拟        for game in gamesOfRound: Match.simulate
                      玩家队 → fastMode=false；其余 → fastMode=true
  3. 比赛结果回写    更新 standings、每场 result 写入 schedule
  4. 体力恢复        所有球员 staminaNow += 22（RECOVER_PER_ROUND）
  5. 伤病判定        Injury.rollForMatch(每名上场球员)           ← rng.fork(`injury:R${round}`)
  6. 士气更新        morale 按 4.5 公式
  7. 战术更新        Tactics.updateAfterMatch（familiarity / chemistry）
  8. 财务入账        Finance.applyRoundIncome（门票按该轮主场场次）
  9. AI 行动         AI.act(state, round)                        ← 每 5 轮 + 交易截止前
 10. 新闻生成        生成 1~3 条
 11. 阶段推进        round++；判断是否进入下一阶段
 12. 自动存档        State.save()
```

### 休赛期 6 步

```
step 1  赛季结算   Finance.settleSeason（薪资/奢侈税/穷鬼线/运营/教练/奖金）
                   Awards.compute（MVP / 最佳阵容 / 得分王…）
step 2  球员老化   Training.applyAging
step 3  合同推进   Roster.advanceContracts → 到期球员进自由市场
                   球队选项执行（AI 自动，玩家弹窗）
step 4  选秀       Draft.lottery → Draft.run（玩家选 + AI 自动选）→ 签约
step 5  自由市场   3 轮竞价（玩家出价 + AI 出价，每轮结算一次）
step 6  青训投入   Draft.youthInvest（玩家选档位 + AI 自动）
         训练营     Training.applyTrainingCamp（额外 1 轮训练，无疲劳）
         → season.year++，phase='REGULAR'，round=1，tradeOpen=true
```

---

## 三、规则

1. **每轮每队恰好 1 场**（由 S2 赛程保证），玩家队必有比赛。
2. **交易截止**：`round > 40` 后 `tradeOpen = false`；季后赛与休赛期第 1-5 步禁交易（选秀后 reopen）。
3. **季后赛推进**：每轮推进一个"系列赛轮次"（所有未结束系列赛各打 1 场），直到该轮所有系列赛分出胜负 → 进入下一轮。
4. **玩家队被淘汰后**，季后赛剩余轮次用 `fastForwardTo('OFFSEASON')` 一键跳过。
5. **常规赛结束后**自动计算排名 → 生成季后赛对阵树（S8）。
6. **自动存档**在每轮末尾；快进时只在**最后**存一次（避免 58 次写 localStorage）。
7. **新闻**由模板生成，不消耗 `match` 流的 rng（用 `rng.fork('news:R${round}')`）。
8. **跨赛季状态迁移**：`year++`、`round=1`、`playoffRound=0`、清空 `playoff.bracket`、`standings` 重置、`hype` 保留衰减 0.7。
9. **阶段机不允许回退**（无撤销）—— 存档是唯一的后悔药。

---

## 四、公式

### 4.1 季后赛轮次

```js
PLAYOFF_SERIES = [5, 5, 5, 7];        // 需要胜场数 [3,3,3,4]
function seriesDecided(winsA, winsB, roundIdx) {
  const need = Math.ceil(PLAYOFF_SERIES[roundIdx] / 2);   // 3,3,3,4
  return winsA >= need || winsB >= need;
}
最大轮次 = 5 + 5 + 5 + 7 = 22
```

### 4.2 体力恢复

```js
p.staminaNow = clamp(p.staminaNow + 22, 0, 100);
// 伤缺球员：+30（不参赛）
```

### 4.3 伤病判定（每名上场球员每场一次）

```js
p_injury = 0.012
         * (1 + 0.030 * max(0, p.age - 27))
         * (1 + 0.020 * max(0, (60 - staminaEnd) / 10))
         * (p.injuryProne ? 1.35 : 1.0)
         * (isPlayoff ? 1.20 : 1.0)
         * (p.trainedWhileFatigued ? 1.50 : 1.0);
p_injury = clamp(p_injury, 0, 0.25);

if (rng.bool(p_injury)) {
  const s = rng.float();
  if      (s < 0.60) out = 1 + floor(rng.float()*3);    // 1~3 轮
  else if (s < 0.90) out = 4 + floor(rng.float()*6);    // 4~9 轮
  else               { out = 10 + floor(rng.float()*15); p.pot -= 3; }  // 10~24 轮
  p.injury = { out, severity };
}
```

### 4.4 门票按轮入账

```js
homeGamesThisRound = 1（玩家队常规赛每轮最多 1 个主场）
Finance.ticketRevenueForGame(team, attendanceRate, isPlayoff)
// 也可以赛季末统一结算；v1 采用「按轮入账」以便现金实时反映战绩
```

### 4.5 快进目标

```js
fastForwardTo(target):
  'DEADLINE'  → while (round <= 40) advanceRound();
  'PLAYOFF'   → while (phase === 'REGULAR') advanceRound();
  'OFFSEASON' → while (phase !== 'OFFSEASON') advanceRound();
  'NEXTSEASON'→ 跑完休赛期 6 步
// 快进时：全部比赛用 fastMode=true，跳过新闻生成，只在末尾存档一次
// 快进时：若玩家队有比赛，记录比分到「快进汇总」列表
```

### 4.6 新闻模板（纯字符串拼接，不消耗 match 流 rng）

```
"【{teamA}】{playerName} 砍下 {pts} 分 {reb} 篮板，带队 {score} 击败 {teamB}"
"【{teamA}】{playerName} 遭遇{severity}伤病，预计缺阵 {out} 轮"
"【{teamA}】近期 {n} 连胜，球迷热情高涨"
"【{teamA}】{playerName} 与球队续约 {years} 年，总额 {total} 万"
"【交易】{teamA} 送出 {p1}，从 {teamB} 得到 {p2}"
"【选秀】{teamA} 用第 {pick} 顺位选中 {rookie}（{pos}，OVR {ovr}）"
每轮生成 1~3 条；玩家队相关事件优先
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 主界面底部 | 「▶ 进行下一轮」（主 CTA，最大按钮） | 单击推进 1 轮 |
| CTA 右侧 | 「▶▶」下拉：快进 5 轮 / 到交易截止 / 到季后赛 / 到休赛期 | 快进时显示进度条 |
| 主界面顶栏 | 阶段指示：`第 2 赛季 · 常规赛 R23/58` 或 `季后赛 首轮 G3` | 常驻 |
| 交易截止提示 | R36 起顶栏出现「交易截止还剩 N 轮」橙色提示 | R41 消失 |
| 季后赛页 | 对阵树（16 → 8 → 4 → 2 → 1） | 已结束的系列赛显示 4-1 这类比分 |
| 休赛期页 | 6 步进度条，逐步引导 | 每步一个确认按钮 |
| 新闻流 | 主界面右下角滚动列表（最近 8 条） | 点击展开完整 50 条 |

**可访问性**：快进按钮有 `aria-live` 播报进度；阶段指示有文字而非仅进度条。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 玩家队名册 < 10 人 | 禁止推进，红色提示「名册不足 10 人，请先签入自由球员」 |
| E2 | 玩家队可用（非伤缺）< 5 人 | 禁止推进，提示「可用球员不足 5 人」；**兜底**：自动签 1 名底薪自由球员（120 万/年） |
| E3 | 快进过程中玩家队名册不足 | 快进中断，回到 E1 状态并提示发生在第几轮 |
| E4 | 季后赛某系列赛因伤缺无法凑齐 5 人 | 判该队 0:20 负（标记 `FORFEIT`），生成新闻 |
| E5 | 玩家队被淘汰后点「进行下一轮」 | 自动切换为 fastMode 推进剩余季后赛，不给 pbp |
| E6 | 休赛期某步被中断（刷新页面） | 从 `offseasonStep` 恢复，重入该步（**每步需幂等**） |
| E7 | localStorage 写失败 | 内存继续，顶栏橙色警告（见 gdd/core.md E1） |
| E8 | 连续快进 58 轮导致 UI 卡死 | 分帧执行：每帧最多 5 轮，显示进度条 |
| E9 | 赛季进行中玩家导入旧存档 | 覆盖当前进度，弹二次确认 |
| E10 | 第 3 次联盟托管后 | 游戏结束页（GG），展示生涯总结，禁止再推进 |
| E11 | `round` 越界（> 80） | 强制进入 OFFSEASON |

---

## 七、与其他系统的接口

```
依赖：S1（state / rng.fork）、S2（schedule）、S3（roster）、S4（training）、
     S6（match）、S8（standings / playoff bracket）、S9（transfer）、
     S10（draft）、S11（finance）、S12（ai）

对外暴露：
  CG.Season.advanceRound()
  CG.Season.fastForward(n)
  CG.Season.fastForwardTo(target)
  CG.Season.runOffseasonStep(step)
  CG.Season.currentPhase() -> {phase, round, year}
  CG.Season.isTradeOpen() -> bool
  CG.Season.pushNews(type, data)

被依赖：S13 ui（按钮绑定）、S12 ai（在 advanceRound 内被调用）
```

---

## 八、验收用例

```js
// T1 一个完整赛季跑通
const st = CG.State.create(20261012);
CG.League.generate(st); CG.Roster.genLeagueRosters(st);
let guard = 0;
while (st.season.year === 1 && guard++ < 200) CG.Season.advanceRound();
assert(st.season.year === 2);                    // 成功跨赛季
assert(guard <= 80 + 6);                          // 58 + 22 + 6 步

// T2 每队 58 场
const rec = st.standings;
Object.values(rec).forEach(r => assert(r.w + r.l === 58));

// T3 每轮 15 场且全部 played
st.league.schedule.forEach(r => {
  r.games.forEach(g => assert(g.played && g.result));
});

// T4 交易截止
CG.Season.fastForwardTo('DEADLINE');
assert(st.season.round === 41 && CG.Season.isTradeOpen() === false);

// T5 季后赛 16 队
CG.Season.fastForwardTo('PLAYOFF');
assert(st.season.phase === 'PLAYOFF');
assert(st.playoff.bracket[0].series.length === 8);   // 每联盟 4 组 × 2

// T6 季后赛最多 22 轮
let cnt = 0;
while (st.season.phase === 'PLAYOFF' && cnt++ < 30) CG.Season.advanceRound();
assert(cnt <= 23);
assert(st.playoff.champion !== null);

// T7 体力恢复
const p = pickPlayer(st);
const before = p.staminaNow;
CG.Season.advanceRound();
// 若该球员未上场：assert(p.staminaNow === min(100, before + 22))

// T8 伤病轮次合理
Object.values(st.players).forEach(p => {
  if (p.injury) { assert(p.injury.out >= 1 && p.injury.out <= 24); }
});

// T9 休赛期幂等
const snap = JSON.stringify(st);
CG.Season.runOffseasonStep(2);
CG.Season.runOffseasonStep(2);          // 重复执行同一「老化」步
assert(st.season.offseasonStep === 2);
// 老化只生效一次（靠 lastAgedYear 标记）
Object.values(st.players).forEach(p => assert(p.lastAgedYear === st.season.year));

// T10 可复现（同 seed 同操作）
const A = CG.State.create(555); playFullSeason(A);
const B = CG.State.create(555); playFullSeason(B);
assert(JSON.stringify(A.standings) === JSON.stringify(B.standings));
assert(A.playoff.champion === B.playoff.champion);

// T11 玩家队必有 pbp
CG.Season.advanceRound();
assert(st.lastMatch && st.lastMatch.pbp.length > 0);
assert(st.lastMatch.pbp.some(e => e.text.length > 0));

// T12 名册不足拦截
removePlayersUntil(st, st.userTeamId, 9);
assertThrows(() => CG.Season.advanceRound());

// T13 新闻不消耗 match 流
const before = st.rngCursor['match:R5:G003'];
CG.Season.pushNews('win', {...});
assert(st.rngCursor['match:R5:G003'] === before);
```

---

## 附 · v1 不做

- 撤销 / 回退（存档是唯一后悔药）
- 全明星赛、季中锦标赛
- 赛季中途的随机联盟事件（罢工、扩军、规则变更）
- 赛季回顾动画 / 高光集锦
