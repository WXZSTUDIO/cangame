# GDD · S6 比赛引擎（`match.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §3、§6、§7　·　依赖：S1、S3、S5
> **★ 数值内核：所有规则在此汇合。本模块必须是纯函数，最好测。**

---

## 一、概述

给定两支球队的阵容 + 战术 + 当前状态，模拟一场比赛，产出 play-by-play 事件流与双方 box score。

### v1 最小可玩版本长什么样

- 回合制（possession-based），每队约 100 回合（受节奏修正）。
- 每回合 9 步判定（选战术乘子 → 选出手者 → 失误 → 犯规 → 出手类型 → 助攻 → 命中 → 篮板 → 体力/换人）。
- 输出：中文 pbp 事件数组 + 球员 box score + 球队 box score。
- `fastMode` 开关：快进时跳过文本生成（省 ~60% 时间），保留 `prob` 与全部统计。
- **不做**：手动暂停/换人干预、2D 动画、关键时刻特殊 UI、实时逐条播放（v1 一次性渲染整场）。

> 设计支柱引用：**P2 数字可解释**（每条 pbp 带 `prob` 字段）、**P3 阵容即战术**（点位权重直接进引擎）。

---

## 二、数据结构

```js
MatchResult {
  gameId, roundIdx,
  homeId, awayId,
  scoreHome, scoreAway,
  quarters: [ {q:1, home:int, away:int}, ... ],   // 4 项 + 加时
  ot: int,                                        // 加时次数 0..3
  pbp: [ PbpEvent ],                              // fastMode 时 text 为空串
  box: {
    home: [ PlayerBox ],
    away: [ PlayerBox ],
    teamHome: TeamBox,
    teamAway: TeamBox,
  },
  winnerId,
  possessions: int,
}

PbpEvent {           // 字段详见 numbers.md §7.5
  idx, round, gameId, quarter, clock, poss, teamId,
  type, actorId, targetId, assistId, shotType,
  points, prob, scoreHome, scoreAway, key, text
}

PlayerBox { playerId, teamId, min, pts, fgm, fga, tpm, tpa, ftm, fta,
            oreb, dreb, reb, ast, tov, stl, blk, pf, plusMinus, staminaEnd }
TeamBox   { teamId, pts, quarters[], fgm, fga, tpm, tpa, ftm, fta,
            oreb, dreb, reb, ast, tov, stl, blk, pf, possessions }
```

**调用签名（纯函数）**：

```js
CG.Match.simulate({
  homeTeam, awayTeam,       // { id, tactic, lineup, roster }
  homePlayers, awayPlayers, // Player[]（含 attr / staminaNow / form / morale）
  roundIdx, gameId, rng,    // rng = CG.RNG.fork(`match:R${roundIdx}:${gameId}`)
  isPlayoff: bool,
  fastMode: bool,
}) -> MatchResult
```
> **不写 `gameState`**。所有状态变更由调用方（`season.js`）在拿到结果后执行。

---

## 三、规则

1. **回合数**：`possessions = round(100 × (paceMulA + paceMulB)/2)`，两队各打这么多回合（交替进攻）。
2. **比赛时长**：48 分钟 = 4 节 × 12 分钟。每回合的 `clock` 由回合序号线性映射：
   `clock = 720 - floor(possIdx / possessionsPerQuarter × 720)`（加时为 300 秒）。
3. **交替进攻**：A 队第 1 回合 → B 队第 1 回合 → A 队第 2 回合…
4. **每回合必有结果**：得分 / 失误 / 进攻篮板二次进攻后必有一次出手。
5. **加时**：常规赛最多 1 个 OT；季后赛最多 3 个。常规赛 1 个 OT 后仍平 → 主队判胜（标记 `OT_TIEBREAK`）。
6. **犯规**：个人 6 犯离场；单节团队犯规 ≥ 5 后，非投篮犯规也送 2 次罚球。
7. **换人检查**：每节末 + 每 12 回合检查一次（见 §4.7）。
8. **体力**：场上 10 人每回合都消耗；场下每人每回合恢复 0.18。
9. **伤病判定在赛后由 `season.js` 执行**（引擎只输出 `staminaEnd` 与 `trainedWhileFatigued` 标记）。
10. **确定性**：一场比赛只使用一支 `rng` 派生流，调用次数固定（不受 fastMode 影响）。

---

## 四、公式

### 4.1 赛前准备

```js
for (const p of allPlayersOfBothTeams) {
  p.form = clamp(Math.round(rng.normal(0, 8)), -20, 20);     // FORM_SIGMA=8, FORM_CAP=20
  p.pf = 0; p.possOnCourt = 0; p.hotStreak = 0; p.coldStreak = 0;
  p.box = emptyBox();
}
onCourt.home = lineup.starters.slice();    // 5 人
onCourt.away = lineup.starters.slice();
```

### 4.2 实时有效能力

```js
function effAbil(p, key, ctx) {
  let v = p.attr[key];
  v *= CG.Roster.posFitMul(p, ctx.assignedPos);            // numbers.md 2.2
  v *= 0.68 + 0.32 * (p.staminaNow / 100);                 // STAMINA_FLOOR
  v *= 1 + p.form / 100;                                   // 0.80 ~ 1.20
  v *= 0.92 + 0.16 * (p.morale / 100);                     // 0.92 ~ 1.08
  return Math.round(v);
}
```

### 4.3 全队进攻乘子

```js
teamOffMul = CG.Tactics.matchupMul(offTac, defTac.defense)   // 1 ± 0.08，含熟练度打折
           * CG.Tactics.chemMul(offTac)                      // 0.94 ~ 1.06
           * CG.Tactics.paceQuality(offTac, onCourt)         // ~0.90 ~ 1.10
           * (isHome ? 1.012 : 0.988);
```

### 4.4 失误判定

```js
p_tov = clamp((0.16
        - 0.0025 * effAbil(shooter, 'handle')
        + DEFENSE[defTac.defense].tovDelta
        + OFFENSE_FOCUS[offTac.offenseFocus].tovDelta)
        * (2 - teamOffMul), 0.02, 0.40);

if (rng.bool(p_tov)) {
  if (rng.bool(0.40)) → 抢断（归 def 场上 perD 最高者）
  else                → 失误（归 shooter）
  shooter.hotStreak = 0;
  回合结束;
}
```
> `handle` 95 → `0.16 - 0.2375 = -0.0775` → clamp 到 0.02（几乎不失误）；`handle` 20 → `0.16+0.075=0.235`。

### 4.5 犯规判定

```js
p_foul = clamp(0.09
        + DEFENSE[defTac.defense].foulDelta
        - 0.0012 * effAbil(shooter, 'iq'), 0.01, 0.20);

若犯规：
  fouler.pf += 1; team.foulsThisQuarter += 1;
  投篮犯规 → 命中则 and-1（1 次罚球）；不中则按 shotType 给 2 或 3 次罚球
  非投篮犯规 且 team.foulsThisQuarter ≥ 5 → 2 次罚球（bonus）
  罚球命中率 = clamp(effAbil(shooter,'ft') / 100 × 0.55 + 0.38, 0.40, 0.98)
    // ft=95 → 0.90；ft=50 → 0.655；ft=20 → 0.49
```

### 4.6 出手类型与命中

```js
mix     = CG.Tactics.shotMixFor(shooter, offTac, lineup);
shotType= rng.weighted(['inside','mid','three'], [mix.inside, mix.mid, mix.three]);

// 助攻（先于命中率判定）
p_assist = clamp(0.30 + 0.004 * (effAbil(passer,'pass') - 50)
                 + OFFENSE_FOCUS[offTac.offenseFocus].astBonus, 0.15, 0.75);
assisted = rng.bool(p_assist);

// 命中率
OFF_EFF = effAbil(shooter, shotType);            // inside→inside, mid→mid, three→three
DEF_EFF = defOnCourt 加权均值:
    shotType === 'inside' → mean(effAbil(d,'intD')) + DEFENSE[def].intD
    shotType !== 'inside' → mean(effAbil(d,'perD')) + DEFENSE[def].perD

p_make = BASE_FG[shotType] + K_FG[shotType] * (OFF_EFF - DEF_EFF);
p_make *= teamOffMul;
p_make += assisted ? 0.05 : 0;                    // AST_BONUS
p_make += hotHandBonus;                           // 0 / 0.04 / 0.07 / 0.10
if (isClutchTime) p_make *= (1 + (shooter.clutch - 50) / 250);
p_make  = clamp(p_make, 0.04, 0.92);

BASE_FG = { inside:0.545, mid:0.415, three:0.335 };
K_FG    = { inside:0.0045, mid:0.0040, three:0.0035 };
```

### 4.7 篮板与二次进攻

```js
p_oreb = clamp(0.22 + 0.0025 * (offRebEff - defRebEff)
               + DEFENSE[defTac.defense].rebDelta, 0.05, 0.45);

进攻篮板 → 二次进攻：立刻再出手一次，`p_make × 0.92`（最多 1 次补篮，之后必归防守方）
防守篮板 → 归 def 场上 reb 最高者
未命中且非进攻篮板 → 12% 概率记为盖帽（归对位防守者，权重 perD + intD）
```

### 4.8 体力与换人

```js
// 每回合结束，场上 10 人：
p.staminaNow -= 0.42 * paceStamMul * (1 + (100 - p.attr.stamina) / 200) * (isPlayoff ? 1.15 : 1.0);
// 场下每人：
p.staminaNow += 0.18;
clamp(staminaNow, 0, 100);

// 换人检查（每 12 回合 + 每节末）：
threshold = 30 + 7 * subFreq;
for (const p of onCourt) {
  if (p.staminaNow < threshold || (p.pf >= 4 && scoreDiff > -10) || p.pf >= 6) {
    sub = nextAvailableBench(p.positionSlot, restMin = 6);
    if (sub) swap(onCourt, p, sub);
  }
}
// pf ≥ 6 → 犯满离场，本场不可再上
// 可用人数 < 5 → 允许犯满者留场，每次再犯给对手 1 罚 + 球权
```

### 4.9 关键时刻定义

```js
isClutchTime = (quarter >= 4) && (clock <= 300) && (Math.abs(scoreDiff) <= 5);
// 加时赛整个加时段都算关键时刻
```

### 4.10 上场时间

```js
min = Math.round(p.possOnCourt / totalPossessions * (48 + ot * 5));
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 赛后页（默认展示） | 左侧：pbp 文本流（深灰/浅灰交替） | 关键回合（`key=true`）高亮加粗 |
| pbp 行 | hover 显示 `prob` 百分比（**支柱 P2 的"为什么"**） | tooltip |
| 赛后页 | 右侧：双方 box score 表格 | 按 `pts` 降序 |
| 赛后页 | 顶部：比分条 + 分节比分 | — |
| 赛后页 | 「本场转折」自动标注：找出最大分差变化的一次攻势 | 一句文案 |
| 快进模式 | 不渲染 pbp，只显示「R12 江城雷霆 108 - 102 云港海鸥」一行 | 汇总列表 |
| 全联盟视图 | 快进后展示该轮 15 场比分网格 | — |

**pbp 文案模板**（中文）：
```
{clock} {actorName} {shotTypeText}出手{assistText}，{result}（{points}）
例："09:42 李昊 三分出手（张伟助攻），命中！（3）"
    "03:17 王强 突破上篮，不中；陈刚 抢下防守篮板"
    "01:05 赵雷 失误，被 刘洋 抢断"
```

**可访问性**：pbp 列表用 `<ol>`；关键回合除颜色外有「关键」文字标签。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 可用球员 < 5 人 | 调用方应拒绝开赛（见 gdd/season.md E2）；引擎兜底：填满后允许犯满者留场 |
| E2 | `p_make` 计算出 NaN（属性缺失） | 属性缺失时取 50；`clamp` 前 `Number.isFinite` 检查，兜底 0.40 |
| E3 | 二次进攻无限循环 | 硬性「每回合最多 1 次补篮」，之后必归防守方 |
| E4 | 加时后仍平局（常规赛） | 主队判胜，标记 `OT_TIEBREAK = true` |
| E5 | 加时超过 3 个（季后赛） | 第 3 个 OT 后按 seed 判定（比较两队 OVR 总和），标记 `OT_SEED_DECIDE` |
| E6 | 换人时无人可换 | 保持原阵容；`staminaNow` 允许降到 0（最低效率 0.68 倍） |
| E7 | `staminaNow` 为负 | clamp 到 0 |
| E8 | 所有球员体力归零 | 允许，比赛继续（效率为地板值），赛后统一恢复 +22/轮 |
| E9 | `rng` 流在 fastMode 与正常模式下调用次数不同 | **禁止**：`text` 生成不得消耗 rng（用纯模板拼接） |
| E10 | 一节内团队犯规累积到 20+ | 不做额外规则，仍按 ≥5 送 2 罚 |
| E11 | 某球员 `possOnCourt = 0` 但被记为篮板手 | 不可能发生（篮板只从场上 5 人中选） |
| E12 | 分差过大导致「垃圾时间」 | v1 不特殊处理（保持公式纯净）；**v1.5 可加"垃圾时间降权"** |

---

## 七、与其他系统的接口

```
依赖：S1（config / rng）、S3（Player / attr / posFitMul）、S5（tactics 全部查表函数）

对外暴露：
  CG.Match.simulate(input) -> MatchResult          // ★ 纯函数
  CG.Match.effAbil(p, key, ctx)
  CG.Match.formatPbp(event, players) -> string

被依赖：
  S7 season    —— 每轮调用 15 次（玩家队正常模式，其余 fastMode）
  S8 standings —— 消费比分与胜负
  S11 finance  —— 消费主场得分/胜负更新 hype
  S12 ai       —— 用于评估阵容（可复用 simulate 做批量试算，但 v1 不用）
  S13 ui       —— 渲染 pbp 与 box score
```

---

## 八、验收用例

```js
// T1 健壮性（B1）
for (let seed = 1; seed <= 1000; seed++) {
  const r = CG.Match.simulate(mkInput(seed));
  assert(Number.isFinite(r.scoreHome) && Number.isFinite(r.scoreAway));
  assert(r.pbp.length > 0 && r.pbp.length < 3000);
  r.box.home.concat(r.box.away).forEach(b =>
    Object.values(b).forEach(v => assert(!Number.isNaN(v))));
}

// T2 得分分布（B1）
let sum = 0;
for (let i=0;i<1000;i++){ const r = CG.Match.simulate(mkInput(i)); sum += (r.scoreHome+r.scoreAway)/2; }
const avg = sum/1000;
assert(avg >= 95 && avg <= 115);

// T3 投篮分布（B2）
let tpa=0, fga=0, fta=0;
for (let i=0;i<200;i++){ const r=CG.Match.simulate(mkInput(i));
  tpa += box(r).tpa; fga += box(r).fga; fta += box(r).fta; }
assert(tpa/fga >= 0.28 && tpa/fga <= 0.45);
assert(fta/200 >= 15 && fta/200 <= 28);

// T4 命中率区间
const r = CG.Match.simulate(mkInput(42));
const t = r.box.teamHome;
assert(t.fgm/t.fga >= 0.38 && t.fgm/t.fga <= 0.52);
assert(t.tpm/t.tpa >= 0.28 && t.tpm/t.tpa <= 0.42);

// T5 上场时间守恒
sum(r.box.home.map(b=>b.min)) ≈ 240 + (r.ot>0 ? 5*r.ot*5 : 0);   // 5 人 × 48 分钟
assert(Math.abs(sum - (240 + r.ot*25)) <= 6);                    // 允许取整误差

// T6 体力消耗
const before = homePlayers[0].staminaNow;
const r2 = CG.Match.simulate(mkInput(7));
assert(r2.box.home.find(b=>b.playerId===homePlayers[0].id).staminaEnd < before);
assert(staminaEnd >= 0 && staminaEnd <= 100);

// T7 确定性（fastMode 不影响 rng）
const a = CG.Match.simulate({...mkInput(7), fastMode:false});
const b = CG.Match.simulate({...mkInput(7), fastMode:true });
assert(a.scoreHome === b.scoreHome && a.scoreAway === b.scoreAway);
assert(a.pbp.length === b.pbp.length);
a.pbp.forEach((e,i) => assert(e.prob === b.pbp[i].prob));

// T8 主场优势
let hw=0; for(let i=0;i<400;i++){ const r=CG.Match.simulate(mkEvenInput(i)); if(r.winnerId===r.homeId) hw++; }
assert(hw/400 >= 0.52 && hw/400 <= 0.62);      // 略高于 50% 但不夸张

// T9 战术真的有效（B5/B6 的引擎侧验证）
const strongVsWeak = 0;
for(let i=0;i<300;i++){
  const r1 = CG.Match.simulate(mkInput(i, {off:'PERIMETER', def:'PACK'}));  // 克制
  const r2 = CG.Match.simulate(mkInput(i, {off:'PERIMETER', def:'ZONE'}));  // 被克
  assert((r1.scoreHome/r1.possessions) > (r2.scoreHome/r2.possessions));
}

// T10 点位真的有效（支柱 P3）
const rCorner = CG.Match.simulate(mkInput(9, {points:{BALL:shooterId}}));
const rBall   = CG.Match.simulate(mkInput(9, {points:{CORNER:shooterId}}));
assert(threesAttempted(rBall, shooterId) > threesAttempted(rCorner, shooterId));

// T11 犯规规则
assert(maxPf(r) <= 6);
assert(r.box.teamHome.fta >= 0);

// T12 加时上限
for(let i=0;i<300;i++){ const r=CG.Match.simulate(mkInput(i,{isPlayoff:true})); assert(r.ot <= 3); }

// T13 prob 字段存在
r.pbp.filter(e=>e.type==='shot_make'||e.type==='shot_miss')
     .forEach(e => assert(e.prob > 0 && e.prob < 1));

// T14 无 Math.random（命令行）
// rg "Math\.random" src/match.js → 无命中
```

---

## 附 · v1 不做

- 手动暂停 / 换人干预 / 喊战术（我们是总经理，不是教练）
- 2D 动画或逐帧回放（v1 文本流）
- 垃圾时间降权、球员情绪影响命中、裁判尺度随机
- 24 秒违例、8 秒过半场等真实规则细节（用失误率抽象）
