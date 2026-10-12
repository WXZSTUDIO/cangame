# GDD · S2 联盟与赛程（`league.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §1、§2.3、§11、§13　·　依赖：S1（config / rng / state）

---

## 一、概述

S2 负责**开局那一刻**把整个虚构世界造出来：30 支球队（名字 / 城市 / 赛区 / 市场属性 / 初始资金）与一整季 58 轮的赛程表。

### v1 最小可玩版本长什么样

- 30 队，2 联盟 × 3 赛区 × 5 队，队名由「城市前缀 + 队名后缀」程序化拼接（如「江城雷霆」「云港海鸥」）。
- 用 **circle method** 生成 58 轮赛程，每轮 15 场，每队 58 场（主客各 29）。
- 球队属性：`marketSize`（0.70~1.40）、`reputation`（0~1，初始 0.5）、`arenaCapacity`（固定 18000）、`cash`（初始 6000 万）。
- **不做**：球队搬迁、球馆升级、队徽美术（v1 用色块 + 队名首字）。

> 设计支柱引用：**P5 零版权**（全部程序化生成）、**P1 一轮一决策**（赛程保证每轮玩家队必有一场）。

---

## 二、数据结构

```js
Team {
  id:           string,     // 'T01'..'T30'
  name:         string,     // '江城雷霆'
  city:         string,     // '江城'
  shortName:    string,     // '雷霆'
  abbr:         string,     // 'JCLT'（3-4 字母，用于赛程表窄列）
  conferenceId: string,     // 'E' | 'W'
  divisionId:   string,     // 'E1' | 'E2' | 'E3' | 'W1' | 'W2' | 'W3'
  colors:       { primary:string, secondary:string },   // HSL 生成
  marketSize:   float,      // 0.70 ~ 1.40
  reputation:   float,      // 0 ~ 1，初始 0.5
  arenaCapacity:int,        // 18000（v1 固定）
  cash:         int,        // 万元，初始 6000
  loan:         int,        // 万元，初始 0
  ticketPrice:  int,        // 元，初始 220
  coachAbility: int,        // 0~100，初始 rng.int(35, 65)
  youthTier:    int,        // 0..3，初始 0
  hype:         float,      // 初始 0.35
  strength:     float,      // 生成用基线 38~62（不随赛季变化，仅初始定强度）
  isUser:       bool,       // 玩家队为 true
  // 战术与名册见 tactics.js / roster.js，通过 teamId 关联
  tactic:       Tactic,     // { pace, offenseFocus, defense, subFreq, familiarity{}, chemistry }
  playerIds:    [string],   // 名册，10~15
  personality:  { winNow, spend, patience, aggression },   // AI 用，见 gdd/ai.md
  taxRepeater:  int,        // 连续超税年数，初始 0
}

Round {
  index:  int,              // 1..58（常规赛）
  games:  [ Game ],
}
Game {
  id:        string,        // 'G0120'
  roundIdx:  int,
  homeId:    string,
  awayId:    string,
  played:    bool,
  result:    MatchResult | null,   // 见 gdd/match.md
}
```

---

## 三、规则

1. **分区**：30 队按 `id` 顺序均匀分配 —— T01-T15 → 东联盟（E1:E T01-05 / E2: T06-10 / E3: T11-15），T16-T30 → 西联盟。
2. **赛程完整性**（硬约束，违反即生成失败）：
   - 每队恰好 58 场
   - 每队主场 29 场、客场 29 场
   - 每队与其余 29 队各打 2 场（1 主 1 客）
   - 每轮 15 场，每队每轮恰好 1 场
3. **赛程不得跨轮重复对手对局**（同一对组合在相邻两轮不重复出现，避免背靠背同对手）。
4. **球队属性生成约束**：
   - `marketSize` 用分层抽样：大城市 5 队（1.20~1.40）、中等 15 队（0.95~1.20）、小市场 10 队（0.70~0.95）。
   - `strength ~ clamp(N(50, 6), 38, 62)`，**保证至少 1 队 ≥ 60、至少 1 队 ≤ 42**（否则重抽）。
5. **初始薪资约束**：每队初始总薪资 ∈ [9000, 11800] 万元（由 `roster.js` 生成时保证，S2 只做校验）。
6. **玩家队选择**：开局让玩家从 30 队中挑一支（默认推荐 `marketSize` 中等、`strength` 在 45~55 的队，保证起点不极端）。
7. **赛程一次性生成并写入 `gameState.league.schedule`**，赛季中不再改动。

---

## 四、公式

### 4.1 队名生成

```
城市池（30 个，虚构）：江城 云港 苍岭 白沙 青川 铁关 星湖 霜城 沙洲 雪原
                      南麓 雷泽 岩城 汨水 长风 归墟 烬野 鸣沙 苍梧 断云
                      滟海 孤舟 临渊 朔方 灼原 幽篁 寒山 浮玉 苍冥 无定
队名后缀池（30 个）：雷霆 海鸥 铁骑 苍鹰 磐石 烈焰 潮汐 雪豹 游隼 长弓
                      黑曜 白鲸 山岳 疾风 荆棘 流火 星辰 巨浪 荒狼 苍龙
                      断刃 疾电 玄冰 赤羽 石盾 云帆 铁锚 孤星 劲松 沧澜
规则：city[i] + suffix[i]，i 由 shuffle 后的排列决定；abbr = 队名首字拼音首字母 × 2 + 序号
```

### 4.2 颜色生成

```
hue = rng.int(0, 359)
primary   = hsl(hue, 62%, 42%)
secondary = hsl((hue + 165) % 360, 55%, 62%)
// 保证两色亮度差 ≥ 25%（可访问性基线，给林绘澄）
```

### 4.3 赛程生成（circle method）

```
输入：teams[30]
固定 T01 不动，其余 29 个位置轮转（虚拟 bye 位用 null）
for (let r = 0; r < 29; r++) {          // 29 个单循环
   pairs = circlePairing(rotation[r])   // 15 对
   for each pair (a, b):
      if (r % 2 === 0) 主场 = a else 主场 = b     // 交替主场
      写入 round[r*2]     与 round[r*2 + 1]
}
// 共 58 轮，每队每轮 1 场，自然满足「每队与其余 29 队各 2 场、主客各 1」
```

### 4.4 `marketSize` 分层

```
打乱 30 个 index：
  tier1（5 队）: marketSize = 1.20 + rng.float() * 0.20   // 1.20~1.40
  tier2（15 队）: marketSize = 0.95 + rng.float() * 0.25   // 0.95~1.20
  tier3（10 队）: marketSize = 0.70 + rng.float() * 0.25   // 0.70~0.95
```

### 4.5 `strength`

```
strength = clamp(round(rng.normal(50, 6)), 38, 62)
// 生成后校验：max(strength) ≥ 60 且 min(strength) ≤ 42，否则整批重抽（上限 10 次）
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 开局 → 选队 | 30 队卡片网格，显示 队名 / 联盟 / 市场等级 / 预估强度条 | 点击选中；默认高亮推荐队 |
| 选队卡片 | hover 展开：赛区、marketSize、初始薪资空间、核心球员 Top3 | 只读预览 |
| 主界面 → 赛程页 | 58 轮 × 玩家队对手的纵向列表 | 已打过的显示比分，未打的显示对手强度 |
| 赛程页 | 顶部切换「我的赛程 / 全联盟」 | 全联盟视图按轮次横排 15 场 |

**可访问性**：球队卡片用 `<button>` 而非 `<div>`；强度条同时有数字标签，不依赖颜色。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | `strength` 重抽 10 次仍不满足极值约束 | 强制把最大值的队设为 62、最小值的队设为 38 |
| E2 | circle method 生成的某轮出现空对（29 队奇数问题） | 已用虚拟 bye（null）处理；**生成后断言每轮 15 场非空** |
| E3 | 队名重复（shuffle 后两个池元素同 index 撞名） | 生成后做 `Set` 去重校验，重复则整体重 shuffle |
| E4 | 玩家开局不选队直接点开始 | 默认选中推荐队（strength 最接近 50 且 marketSize ∈ [0.95,1.20]） |
| E5 | `marketSize` 计算出的 `marketNorm` 越界 | clamp 到 [0, 1]（在 finance 层做，S2 只保证原始区间正确） |
| E6 | 30 队初始薪资总和不合理（超出 [9000,11800]） | S2 校验失败 → 交给 roster.js 重新生成该队名册（见 gdd/roster.md E4） |

---

## 七、与其他系统的接口

```
依赖：S1（CG.CONFIG / CG.RNG.fork('gen:league') / CG.State）

对外暴露：
  CG.League.generate(state)              // 生成 30 队 + 6 赛区 + 2 联盟
  CG.League.generateSchedule(teamIds)    // 返回 Round[58]
  CG.League.getTeam(id)
  CG.League.teamsOfConference(cid)
  CG.League.teamsOfDivision(did)
  CG.League.gamesOfRound(idx)
  CG.League.recommendUserTeam()          // 开局推荐

被依赖：
  S3 roster  —— 为每队生成 13 人（读 team.strength）
  S7 season  —— 按 schedule 推进
  S8 standings —— 读赛区/联盟归属
  S11 finance —— 读 marketSize / reputation / arenaCapacity
  S13 ui     —— 赛程页渲染
```

---

## 八、验收用例

```js
// T1 队伍数量与分区
assert(state.league.teams.length === 30);
assert(state.league.divisions.length === 6);
state.league.divisions.forEach(d => assert(d.teamIds.length === 5));
state.league.conferences.forEach(c => assert(c.teamIds.length === 15));

// T2 赛程完整性
const cnt = {};   // 每队场次
state.league.schedule.forEach(r => {
  assert(r.games.length === 15);
  const seen = new Set();
  r.games.forEach(g => { seen.add(g.homeId); seen.add(g.awayId); });
  assert(seen.size === 30);                        // 每轮 30 队全部出战，无重复
  r.games.forEach(g => {
    cnt[g.homeId] = (cnt[g.homeId]||0)+1;
    cnt[g.awayId] = (cnt[g.awayId]||0)+1;
  });
});
assert(state.league.schedule.length === 58);
Object.values(cnt).forEach(v => assert(v === 58));  // 每队 58 场

// T3 主客平衡
const home = {};
state.league.schedule.forEach(r => r.games.forEach(g => home[g.homeId]=(home[g.homeId]||0)+1));
Object.values(home).forEach(v => assert(v === 29));

// T4 对手配对（每对恰好 2 次，且 1 主 1 客）
const pair = {};
state.league.schedule.forEach(r => r.games.forEach(g => {
  const k = [g.homeId,g.awayId].sort().join('-');
  pair[k] = (pair[k]||0) + 1;
}));
assert(Object.keys(pair).length === 435);            // C(30,2) = 435
Object.values(pair).forEach(v => assert(v === 2));

// T5 相邻轮不重复对手
for (let i=1;i<58;i++){
  const a = new Set(state.league.schedule[i-1].games.map(g=>[g.homeId,g.awayId].sort().join('-')));
  state.league.schedule[i].games.forEach(g =>
    assert(!a.has([g.homeId,g.awayId].sort().join('-'))));
}

// T6 队名唯一
const names = new Set(state.league.teams.map(t=>t.name));
assert(names.size === 30);

// T7 marketSize 分层
const ms = state.league.teams.map(t=>t.marketSize);
assert(Math.min(...ms) >= 0.70 && Math.max(...ms) <= 1.40);
assert(ms.filter(v=>v>=1.20).length === 5);

// T8 strength 极值
const st = state.league.teams.map(t=>t.strength);
assert(Math.max(...st) >= 60 && Math.min(...st) <= 42);

// T9 可复现
const a = CG.League.generate(CG.State.create(1234));
const b = CG.League.generate(CG.State.create(1234));
assert(JSON.stringify(a.league.teams) === JSON.stringify(b.league.teams));
assert(JSON.stringify(a.league.schedule) === JSON.stringify(b.league.schedule));

// T10 球员归属（交给 roster 后）
state.league.teams.forEach(t => {
  assert(t.playerIds.length >= 10 && t.playerIds.length <= 15);
  t.playerIds.forEach(pid => assert(state.players[pid].teamId === t.id));
});
```

---

## 附 · v1 不做

- 球馆升级 / 容量差异（v1 全场馆 18000）
- 球队搬迁 / 扩军 / 改名（玩家队休赛期改名除外，见 concept.md Q5）
- 赛程手动编辑
- 全明星赛
