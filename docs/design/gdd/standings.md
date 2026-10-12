# GDD · S8 排名与季后赛（`standings.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §1　·　依赖：S1、S2、S6

---

## 一、概述

S8 把比赛结果汇总成**排名**，并在常规赛结束后生成**季后赛对阵树**并推进晋级。

### v1 最小可玩版本长什么样

- 战绩统计：胜/负/胜率/连胜/主客场/分区战绩/净胜分。
- 排名口径：胜率 → 相互交手 → 净胜分 → `teamId`（确定性兜底）。
- 季后赛：每联盟前 8 共 16 队，1v8/2v7/3v6/4v5，固定对阵不重排；bo5 ×3 + 总决赛 bo7。
- 奖项：MVP / 得分王 / 篮板王 / 助攻王 / 最佳阵容一阵二阵。
- **不做**：赛区冠军保送（v1 纯胜率排序）、最佳防守阵容、进步最快球员、历史排行榜。

> 设计取舍：**v1 不做赛区冠军保送**。6 个赛区只用于赛程编排与展示分组，避免"弱赛区冠军挤掉强队"的公平性争议。

---

## 二、数据结构

```js
TeamRecord {
  teamId,
  w:int, l:int,
  winPct:float,
  ptsFor:int, ptsAgainst:int,
  diff:float,                    // (ptsFor - ptsAgainst) / games
  homeW:int, homeL:int, awayW:int, awayL:int,
  divW:int, divL:int,            // 同赛区战绩
  confW:int, confL:int,          // 同联盟战绩
  streak:int,                    // 正=连胜，负=连负
  last10: {w:int, l:int},
  headToHead: { [oppTeamId]: {w, l} },
  rank:int,                      // 联盟内排名 1..15
  divRank:int,                   // 赛区内排名 1..5
  clinched:bool,                 // 已锁定季后赛
}

PlayoffSeries {
  id, conferenceId, roundIdx,       // 0..3
  highId, lowId,                    // 高种子 / 低种子
  highWins:int, lowWins:int,
  games: [ { gameId, winnerId, scoreHigh, scoreLow } ],
  winnerId: string|null,
  homePattern: [int],               // 主客场序列，如 [H,H,A,A,H]
}

playoff: {
  bracket: [ [PlayoffSeries x8], [x4], [x2], [x1] ],   // 4 轮
  roundIdx: int,
  champion: teamId|null,
  finalsMvp: playerId|null,
}

Award { year, type, playerId|teamId, value }
```

---

## 三、规则

1. **排名口径**（tie-break 顺序，**必须确定性，禁止随机**）：
   1. `winPct`
   2. 两队并列时：相互交手胜率（`headToHead`）；三队以上并列时：相互之间总胜率
   3. `diff`（净胜分/场）
   4. `ptsFor`（总分高者靠前）
   5. `teamId` 字典序（兜底）
2. **季后赛名额**：每联盟前 8（共 16 队），**不看赛区**。
3. **对阵固定**：`1v8, 2v7, 3v6, 4v5`；下一轮 `1v4 / 2v3`（按种子，不按上一轮胜者重排）。
4. **主场模式**：
   - bo5（5 战 3 胜）：`高种子主场 2 → 低种子 2 → 高种子 1`，即 `[H,H,A,A,H]`
   - bo7：`[H,H,A,A,A,H,H]`（2-2-1-1-1）
5. **胜场需求**：bo5 需 3 胜，bo7 需 4 胜。
6. **推进**：`Season.advanceRound()` 在季后赛阶段调用 `Playoff.advanceRound()`，所有未结束的系列赛各打 1 场；全部结束后生成下一轮对阵。
7. **奖项**：常规赛结束后计算，休赛期第 1 步展示。
8. **跨赛季重置**：`standings` 每年清空重建；`career` 档案保留。

---

## 四、公式

### 4.1 战绩更新

```js
function applyResult(record, result, teamId) {
  const isHome = result.homeId === teamId;
  const won = result.winnerId === teamId;
  won ? record.w++ : record.l++;
  isHome ? (won ? record.homeW++ : record.homeL++)
         : (won ? record.awayW++ : record.awayL++);
  const opp = isHome ? result.awayId : result.homeId;
  record.ptsFor += (isHome ? result.scoreHome : result.scoreAway);
  record.ptsAgainst += (isHome ? result.scoreAway : result.scoreHome);
  won ? record.headToHead[opp].w++ : record.headToHead[opp].l++;
  // 同赛区 / 同联盟判定
  if (sameDivision(teamId, opp)) won ? record.divW++ : record.divL++;
  if (sameConference(teamId, opp)) won ? record.confW++ : record.confL++;
  record.streak = won ? (record.streak > 0 ? record.streak + 1 : 1)
                      : (record.streak < 0 ? record.streak - 1 : -1);
  record.winPct = record.w / (record.w + record.l);
  record.diff = (record.ptsFor - record.ptsAgainst) / (record.w + record.l);
  record.last10 = lastN(record, 10);
}
```

### 4.2 排序比较器

```js
function cmp(a, b) {
  if (a.winPct !== b.winPct) return b.winPct - a.winPct;
  const h = h2hWinPct(a, b);                    // a 对 b 的胜率
  if (h !== 0.5) return h - 0.5;                // >0.5 → a 靠前
  if (a.diff !== b.diff) return b.diff - a.diff;
  if (a.ptsFor !== b.ptsFor) return b.ptsFor - a.ptsFor;
  return a.teamId < b.teamId ? -1 : 1;          // 字典序兜底
}

function h2hWinPct(a, b) {
  const g = a.headToHead[b.teamId];             // {w, l}
  const total = g.w + g.l;
  return total === 0 ? 0.5 : g.w / total;
}
```

### 4.3 季后赛对阵生成

```js
function buildBracket(state) {
  const bracket = [[], [], [], []];
  for (const conf of ['E','W']) {
    const top8 = teamsOfConference(conf).sort(cmp).slice(0, 8);
    const seeds = [[1,8],[2,7],[3,6],[4,5]];
    seeds.forEach(([hi, lo]) => bracket[0].push(mkSeries(top8[hi-1], top8[lo-1], conf, 0)));
  }
  // 后续轮次在上一轮全部结束后按种子生成
  return bracket;
}

function mkSeries(high, low, conf, roundIdx) {
  return {
    highId: high, lowId: low, highWins:0, lowWins:0, games:[], winnerId:null,
    homePattern: roundIdx === 3 ? [1,1,0,0,0,1,1] : [1,1,0,0,1],   // 1=高种子主场
  };
}
```

### 4.4 系列赛推进

```js
function advanceRound(state) {
  const round = state.playoff.bracket[state.playoff.roundIdx];
  for (const s of round) {
    if (s.winnerId) continue;
    const gameIdx = s.highWins + s.lowWins;
    const highIsHome = s.homePattern[gameIdx] === 1;
    const result = CG.Match.simulate({ homeId: highIsHome ? s.highId : s.lowId, ... , isPlayoff:true });
    const highWon = result.winnerId === s.highId;
    highWon ? s.highWins++ : s.lowWins++;
    s.games.push({ gameId, winnerId: result.winnerId, ... });
    const need = Math.ceil(PLAYOFF_SERIES[state.playoff.roundIdx] / 2);
    if (s.highWins >= need) s.winnerId = s.highId;
    if (s.lowWins  >= need) s.winnerId = s.lowId;
  }
  // 全部结束 → 生成下一轮
  if (round.every(s => s.winnerId)) {
    if (state.playoff.roundIdx === 3) state.playoff.champion = round[0].winnerId;
    else buildNextRound(state);
  }
}
```

### 4.5 奖项

```
MVP        : 赢球最多联盟的、OVR 最高的、（ppg×1.0 + apg×1.6 + rpg×1.2）最高的球员
得分王     : max(ppg)（需出场 ≥ 40 场）
篮板王     : max(rpg)
助攻王     : max(apg)
最佳阵容一阵：按 OVR 排序取 PG/SG/SF/PF/C 各 1（全联盟，不分位置限制为"该位置 OVR 最高"）
最佳阵容二阵：次高各 1
总决赛 MVP ：总决赛系列赛中 场均 pts 最高的冠军队球员
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 排名页 | 两个联盟的表格（15 行 × 2） | 列：# / 球队 / 胜-负 / 胜率 / 净胜分 / 连胜 / 近 10 |
| 排名页 | 玩家队行高亮；第 8/9 名之间有**季后赛分割线** | 视觉分界 |
| 排名页 | 切换「联盟排名 / 赛区排名 / 全联盟」 | — |
| 季后赛页 | 对阵树（左右两半 = 东西联盟） | 系列赛比分 + 逐场小比分 |
| 季后赛页 | 鼠标 hover 系列赛 → 显示逐场比分与主场 | tooltip |
| 休赛期 step1 | 奖项展示卡 | MVP 卡 + 最佳阵容 10 人 |

**可访问性**：排名表格用 `<table>` + `<th scope>`；季后赛分割线有「季后赛线」文字标注。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 两队胜率完全相同 | 走 h2h → diff → ptsFor → teamId 兜底，**必出结果** |
| E2 | 两队从未交手（不可能，v1 每队与每队打 2 场） | `h2hWinPct = 0.5`，继续下一级 |
| E3 | 三队以上并列 | 两两比较时仍用 `cmp`；排序稳定（`Array.sort` 在 v1 需保证稳定，用 `teamId` 兜底即可） |
| E4 | 系列赛打满 5 场仍 2-2 平 | 不可能（bo5 打满第 5 场必分胜负）；若出现 → 按 seed 判定并标记异常 |
| E5 | 某队因伤缺无法凑齐 5 人 | 判负 0:20（见 gdd/season.md E4） |
| E6 | 常规赛未打满 58 场就进入季后赛（数据错误） | 断言失败，拒绝生成 bracket |
| E7 | 同一队出现在两个系列赛 | 不可能（固定对阵），生成后断言校验 |
| E8 | `champion` 已产生但 `roundIdx < 3` | 断言失败，报错 |
| E9 | 全联盟 0 胜或 58 胜的极端情况 | 允许；MVP 评选需 `w + l ≥ 40` 才合格，否则取 OVR 最高者 |

---

## 七、与其他系统的接口

```
依赖：S1（config）、S2（teams / divisions / conferences）、S6（MatchResult）

对外暴露：
  CG.Standings.newRecord(teamId)
  CG.Standings.applyResult(record, result, teamId)
  CG.Standings.rankConference(confId) -> TeamRecord[]（已排序）
  CG.Standings.rankDivision(divId)    -> TeamRecord[]
  CG.Standings.buildBracket(state)
  CG.Playoff.advanceRound(state)
  CG.Playoff.buildNextRound(state)
  CG.Awards.compute(state) -> Award[]
  CG.Standings.resetForNewSeason(state)

被依赖：S7 season（每轮调用 applyResult；季后赛阶段调用 Playoff.advanceRound）
       S11 finance（读最终名次发奖金）
       S13 ui（排名页 / 季后赛页）
```

---

## 八、验收用例

```js
// T1 战绩守恒（v1 赛程 = 29 个对手 × 2 场，故：同赛区 4 队×2=8，同联盟异区 10 队×2=20，跨联盟 15 队×2=30）
Object.values(st.standings).forEach(r => {
  assert(r.w + r.l === 58);
  assert(r.winPct >= 0 && r.winPct <= 1);
  assert(r.homeW + r.homeL === 29 && r.awayW + r.awayL === 29);
  assert(r.divW  + r.divL  === 8);                 // 同赛区 4 队 × 2
  assert(r.confW + r.confL === 28);                // 同赛区 8 + 同联盟异区 20
});

```js
// T2 排名确定性
const r1 = CG.Standings.rankConference('E');
const r2 = CG.Standings.rankConference('E');
assert(JSON.stringify(r1.map(x=>x.teamId)) === JSON.stringify(r2.map(x=>x.teamId)));
// 同 seed 两次排序结果一致（无随机）

// T3 胜率降序
for (let i=1;i<r1.length;i++) assert(r1[i-1].winPct >= r1[i].winPct);

// T4 tie-break 兜底（构造完全相同战绩）
const A = mkRecord({w:40,l:18,diff:0,ptsFor:8000,teamId:'T01'});
const B = mkRecord({w:40,l:18,diff:0,ptsFor:8000,teamId:'T02'});
assert(cmp(A,B) < 0);                          // T01 靠前（字典序）

// T5 季后赛 16 队
CG.Standings.buildBracket(st);
assert(st.playoff.bracket[0].length === 8);
assert(new Set(st.playoff.bracket[0].flatMap(s=>[s.highId,s.lowId])).size === 16);

// T6 对阵固定
const E = st.playoff.bracket[0].filter(s=>s.conferenceId==='E');
const eRank = CG.Standings.rankConference('E');
assert(E[0].highId === eRank[0].teamId && E[0].lowId === eRank[7].teamId);
assert(E[1].highId === eRank[1].teamId && E[1].lowId === eRank[6].teamId);

// T7 主场模式
assert(E[0].homePattern.join('') === '11001');          // bo5: 2-2-1
st.playoff.roundIdx = 3;
assert(mkSeries(h,l,'E',3).homePattern.join('') === '1100011');  // bo7: 2-2-1-1-1

// T8 系列赛必分胜负
for (let i=0;i<200;i++){
  const s = mkSeries('T01','T02','E',0);
  while(!s.winnerId && s.games.length < 5) playOne(s);
  assert(s.winnerId !== null || s.games.length === 5);
  if (s.games.length === 5) assert(s.highWins === 3 || s.lowWins === 3);
}

// T9 冠军唯一
runFullPlayoff(st);
assert(st.playoff.champion !== null);
assert(st.playoff.bracket[3][0].winnerId === st.playoff.champion);

// T10 季后赛轮数上限
assert(countPlayoffRounds(st) <= 22);

// T11 跨赛季重置
CG.Standings.resetForNewSeason(st);
Object.values(st.standings).forEach(r => assert(r.w === 0 && r.l === 0));
assert(st.playoff.champion === null && st.playoff.roundIdx === 0);

// T12 奖项
const aw = CG.Awards.compute(st);
assert(aw.some(a=>a.type==='MVP'));
assert(aw.filter(a=>a.type.startsWith('TEAM1')).length === 5);
```

---

## 附 · v1 不做

- 赛区冠军保送 / 赛区冠军特殊种子
- 最佳防守阵容、最佳新秀阵容、进步最快球员
- 历史战绩对比（"vs 某队历史 12-8"）
- 季后赛主场优势动态计算（v1 用常规赛胜率一次定死）
