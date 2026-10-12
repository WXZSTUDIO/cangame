# GDD · S1 核心状态与随机（`rng.js` / `state.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §1、§13　·　依赖：**零依赖**（`config.js` 除外）

---

## 一、概述

S1 是整个游戏的**地基**，负责两件事：

1. **确定性随机**：提供 mulberry32 种子 RNG 与派生工具，保证「同 seed 同结果」。
2. **唯一真源**：定义 `gameState` 的完整结构，负责初始化、序列化、存档/读档、导出/导入。

### v1 最小可玩版本长什么样

- `CG.RNG` 暴露 `float() / int(a,b) / pick(arr) / weighted(items, weights) / normal(mu, sigma) / bool(p) / fork(salt)`。
- `CG.State` 暴露 `create(seed) / save() / load(json) / export() / import(str)`。
- 存档写 `localStorage['cangame.save.v1']`，提供「导出 JSON 到剪贴板 / 从文件导入」。
- **不做**：云存档、多存档槽、版本迁移工具（v1 只做版本号校验 + 拒绝加载）。

> 设计支柱引用：**P2 数字可解释**（所有随机可追溯）、**P4 单机也长线**（存档可靠）。

---

## 二、数据结构

### 2.1 RNG 对象

```js
// 不进 gameState（可重建），但 cursor 进 gameState 用于调试
RNGStream {
  seed:      uint32,   // 当前内部状态
  salt:      string,   // 派生标记，如 'match:R12:G007'
  cursor:    int,      // 已调用次数（调试/回归用）
}
```

### 2.2 `gameState` 顶层结构（**唯一真源，必须完全可 JSON 序列化**）

```js
gameState = {
  version:    int,          // 存档格式版本，v1 = 1
  seed:       uint32,       // 根种子（玩家开局可见、可手填）
  createdAt:  int,          // 时间戳（仅展示用，不参与逻辑）
  rngCursor:  { [salt]: int },   // 各派生流的调用计数（调试）

  // ── 联盟静态数据（开局生成后基本不变）
  league: {
    teams: [ Team ],        // 30 支，见 gdd/league.md
    divisions: [ { id, name, conferenceId, teamIds:[5] } ],   // 6 个
    conferences: [ { id, name, teamIds:[15] } ],              // 2 个
    schedule: [ Round ],    // 58 轮，见 gdd/league.md
  },

  // ── 球员（全联盟共享一个池，按 teamId 归属）
  players:   { [playerId]: Player },     // ~390+ 名

  // ── 赛季状态机
  season: {
    year:        int,       // 第几赛季，从 1 开始
    phase:       enum,      // 'REGULAR' | 'PLAYOFF' | 'OFFSEASON'
    round:       int,       // 当前轮次 1..80（OFFSEASON 时为 0）
    playoffRound:int,       // 0=未开始, 1..4
    tradeOpen:   bool,      // R40 后为 false
    phaseStep:   int,       // OFFSEASON 内的 6 步进度 0..6
  },

  // ── 战绩与排名
  standings: { [teamId]: TeamRecord },   // 见 gdd/standings.md
  playoff:   { bracket: [...], champion: teamId|null },

  // ── 市场
  transfer:  { listings: [ Listing ], offers: [ Offer ], freeAgents: [playerId] },
  draft:     { year, lotteryOrder:[], picks:[], pool:[playerId] },

  // ── 玩家队（teamId，指向 league.teams 中一项）
  userTeamId: string,
  user: {
    cash:        int,       // 万元
    loan:        int,       // 万元
    ticketPrice: int,       // 元
    youthTier:   int,       // 0..3
    coachAbility:int,       // 0..100
    reputation:  float,     // 0..1
    hype:        float,     // 0..1
    history:     [ SeasonSummary ],
  },

  // ── 展示用
  news:      [ NewsItem ],  // 最近 50 条
  lastMatch: { pbp:[], boxHome:{}, boxAway:{} } | null,
}
```

### 2.3 存档格式

```
localStorage key : 'cangame.save.v1'
value            : JSON.stringify(gameState)
导出文件名        : cangame-save-Y{year}-R{round}-{seed}.json
```

---

## 三、规则

1. **禁止 `Math.random()`**。全工程任何一处出现 `Math.random` 即视为 P0 缺陷（`rg "Math\.random" src/` 必须为 0 命中）。
2. **RNG 派生流**：每个子系统用 `rng.fork(salt)` 拿独立流。salt 命名规范：`<system>:<scope>`，例如
   - `match:R12:G007`（第 12 轮第 7 场）
   - `draft:2027:lottery`
   - `injury:R12`
   - `gen:league`（开局生成）
3. ** salt 必须可复现**：salt 字符串里只能包含确定性数据（轮次、场次 id、赛季年），**不得包含时间戳或对象引用顺序**。
4. **`gameState` 只能被 `state.js` 的 mutation 函数修改**，其他模块只读或通过各自系统的 API 改。
5. **存档版本号不匹配 → 拒绝加载并提示**，不做静默迁移。
6. **每轮推进结束后自动存档**（`season.advanceRound()` 末尾调用 `State.save()`）。
7. `rngCursor` 每次 fork 时累加，用于回归对比——若改了公式导致某流调用次数变化，测试脚本会立刻发现。

---

## 四、公式

### 4.1 mulberry32

```js
function mulberry32(a) {
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### 4.2 派生流 `fork`

```js
fork(salt) {
  const h = hashString(salt);              // FNV-1a 32bit
  const s = (this.rootSeed ^ h) >>> 0;     // 与根种子混合
  return new RNGStream(s, salt);
}

function hashString(str) {                 // FNV-1a
  let h = 0x811C9DC5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
```

### 4.3 工具函数

```js
float()                 -> [0, 1)
int(a, b)               -> a + floor(float() * (b - a + 1))        闭区间
bool(p)                 -> float() < p
pick(arr)               -> arr[floor(float() * arr.length)]
weighted(items, w)      -> Σw 归一化后轮盘赌；Σw ≤ 0 时退化为 pick(items)
normal(mu, sigma)       -> Box-Muller：
    u1 = max(float(), 1e-12); u2 = float();
    z  = sqrt(-2*ln(u1)) * cos(2π*u2);
    return mu + sigma * z;
shuffle(arr)            -> Fisher-Yates（用 float()）
```

### 4.4 序列化完整性校验

```js
validate(state) -> bool
  检查：version === 1
       teams.length === 30
       players 中每个 teamId 都能在 teams 中找到
       每队球员数 ∈ [10, 15]
       Object.keys(players).length ≥ 300
       无 function / undefined / NaN / Infinity
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 开局页 | 种子输入框（默认随机 8 位数字）+「开始新赛季」 | 显示种子，允许手填以便复现 |
| 开局页 | 「读取存档」「导入 JSON」 | 导入时校验 version |
| 顶栏 | 「存档 / 导出」按钮 | 导出为 `.json` 下载 |
| 顶栏 | 常驻显示 `种子 #12345678 · 第 N 赛季 · R{round}` | 只读 |
| 设置 | 「自动存档」开关（默认开） | 每轮结束写 localStorage |

**可访问性**：种子输入框有 `<label>`；导入失败用 `role="alert"` 提示，不依赖颜色。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | localStorage 不可用（隐私模式 / 配额满） | 捕获异常 → 降级为「仅内存存档」，顶栏显示橙色警告「本局无法保存」 |
| E2 | 导入的 JSON 版本号不符 | 拒绝加载，弹出「存档版本 2 与当前版本 1 不兼容」 |
| E3 | 导入的 JSON 结构损坏（缺字段） | `validate()` 失败 → 拒绝，提示首个失败原因 |
| E4 | `weighted()` 权重全为 0 或含负值 | 负值 clamp 到 0；全 0 时退化为均匀分布 |
| E5 | `normal()` 产生极端值（>4σ） | 不 clamp 在 RNG 层；**由调用方 clamp**（各系统自己定上下限） |
| E6 | 种子为 0 或负数 | `seed = seed >>> 0`，0 是合法种子；负数转无符号 |
| E7 | 存档体积过大（> 2MB） | v1 不做压缩；若超 5MB 警告并建议导出后重开 |
| E8 | 同一 salt 在一轮内被 fork 两次 | 允许，但 `cursor` 会翻倍 → 回归脚本报警（提示公式改动） |

---

## 七、与其他系统的接口

```
被依赖方（本系统不依赖任何业务系统，仅依赖 config.js）

对外暴露：
  CG.RNG.fork(salt) -> RNGStream
  CG.RNG.hashString(s)
  CG.State.create(seed) -> gameState
  CG.State.save() / load(json) / export() / import(str)
  CG.State.validate(state) -> {ok:bool, reason:string}
  CG.State.get() -> gameState          // 全局唯一实例

被以下系统调用：全部（S2~S13）
```

---

## 八、验收用例（可写成脚本断言）

```js
// T1 确定性
const a = CG.RNG.fork('test:1'), b = CG.RNG.fork('test:1');
assert(a.float() === b.float());                    // 单步一致
for (let i=0;i<1e6;i++) assert(a.float() === b.float());   // 100 万步一致

// T2 不同 salt 不同序列
assert(CG.RNG.fork('a').float() !== CG.RNG.fork('b').float());

// T3 int 闭区间
const r = CG.RNG.fork('int');
for (let i=0;i<1e4;i++){ const v = r.int(1,5); assert(v>=1 && v<=5 && Number.isInteger(v)); }

// T4 normal 分布
const n = CG.RNG.fork('nm'); let s=0, ss=0;
for (let i=0;i<1e5;i++){ const v=n.normal(50,10); s+=v; ss+=v*v; }
const mu = s/1e5, sd = Math.sqrt(ss/1e5 - mu*mu);
assert(Math.abs(mu-50) < 0.2 && Math.abs(sd-10) < 0.2);

// T5 weighted 退化
assert(CG.RNG.fork('w').weighted(['a','b'],[0,0]) !== undefined);

// T6 存档 round-trip
const st = CG.State.create(20261012);
const json = JSON.stringify(st);
assert(JSON.stringify(JSON.parse(json)) === json);          // 无 undefined/NaN
assert(CG.State.validate(JSON.parse(json)).ok === true);

// T7 无 Math.random
// 命令行：rg "Math\.random" src/  → 退出码 1（无命中）

// T8 开局可复现
const s1 = CG.State.create(999), s2 = CG.State.create(999);
assert(JSON.stringify(s1) === JSON.stringify(s2));          // 同 seed 开局完全一致

// T9 版本号校验
assert(CG.State.validate({version:2}).ok === false);

// T10 fork 稳定性（跨进程）
assert(CG.RNG.hashString('match:R12:G007') === 0x????????); // 固定字面量，写死在测试里
```

---

## 附 · v1 不做

- 云存档 / 账号系统
- 多存档槽（v1 单槽 + 导出 JSON 手动管理）
- 存档版本迁移（v2 再做）
- 存档压缩
