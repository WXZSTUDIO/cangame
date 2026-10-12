# GDD · S3 球员与名册（`roster.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §2　·　依赖：S1、S2（team.strength）

---

## 一、概述

S3 是**几乎所有系统的地基**：造球员、算 OVR、管名册、推合同。

### v1 最小可玩版本长什么样

- 390 名球员（30 队 × 13 人），12 项属性 + 潜力 + 年龄 + 4 维性格 + 中文姓名。
- `Roster.ovr(player, atPos)` 是**全工程唯一的 OVR 算法**（跨 GDD 红线 2）。
- 名册操作：设首发 / 调替补顺序 / 裁人 / 签人；名册数 ∈ [10, 15]。
- 合同：年限 1~5 年、年薪、每年薪资数组；赛季末年限 -1。
- **不做**：球员情绪事件、球员交易否决权、双向合同、球员选项（v1 只有球队选项）。

> 设计支柱引用：**P2 数字可解释**、**P5 零版权**（中文姓名 100% 程序生成）。

---

## 二、数据结构

```js
Player {
  id:          string,      // 'P0001'
  name:        string,      // '李昊'
  teamId:      string,      // 'T07'；自由球员为 null
  pos:         enum,        // 'PG'|'SG'|'SF'|'PF'|'C'
  altPos:      enum|null,
  age:         int,         // 19~36
  attr: {
    inside:int, mid:int, three:int, ft:int,
    pass:int, handle:int, perD:int, intD:int,
    reb:int, speed:int, stamina:int, iq:int,
  },                        // 各 20~95
  pot:         int,         // 20~99
  // 状态
  form:        int,         // -20~+20
  morale:      int,         // 0~100
  staminaNow:  int,         // 0~100 ★ 体力存量
  injury:      { out:int, severity:enum } | null,   // out = 剩余缺阵轮数
  // 性格
  ego:int, workEthic:int, loyalty:int, clutch:int,   // 各 0~100
  injuryProne: bool,
  // 合同
  contract: {
    years:      int,        // 剩余年限 1~5
    salaries:   [int],      // 长度 = years，单位万元/年
    birdYears:  int,        // 在同一队连续年数，≥3 享伯德条款
    rookieScale:bool,       // 新秀合同标记
    teamOption: bool,       // 最后一年是否为球队选项
  },
  // 生涯档案（叙事与展示）
  career: {
    debutYear:  int,
    seasons:    [ { year, teamId, g, mpg, ppg, rpg, apg, ovr } ],
    titles:     int,
    awards:     [string],
  },
  draft: { year:int|null, pick:int|null } | null,
}
```

---

## 三、规则

1. **每队 13 人**：PG×2, SG×2, SF×2, PF×2, C×2, 随机×3。
2. **属性生成**：`attr[k] ~ clamp(N(team.strength + POS_BIAS[pos][k], 9), 20, 95)`，其中
   `POS_BIAS[pos][k] = (OVR_WEIGHTS[pos][k] - 0.0833) * 55`。
3. **年龄分布**：19-22（15%）/ 23-26（25%）/ 27-30（28%）/ 31-33（20%）/ 34-36（12%）。
4. **潜力**：`pot = clamp(ovr + max(0, round(N((24-age)*0.9, 5))), ovr, 95)`。
5. **性格**：4 维 `~ clamp(N(50, 18), 0, 100)`；`workEthic` 与 `clutch` 相关系数 +0.3（用 `clutch = clamp(workEthic*0.3 + N(50,15)*0.7, 0, 100)`）。
6. **`injuryProne`**：15% 概率为 `true`。
7. **名册硬约束**：任何时刻每队球员数 ∈ [10, 15]；低于 10 时禁止推进赛季（强制签底薪自由球员）。
8. **首发 5 人必须各占一个位置**（PG/SG/SF/PF/C 各 1）。若某位置无人可用，允许用相邻位置球员顶替（有 `posFitMul` 惩罚）。
9. **合同推进**：赛季末 `years -= 1`，`salaries.shift()`；`years === 0` → 进入自由市场。
10. **球队选项**：新秀合同第 4 年为球队选项，休赛期 AI/玩家可决定是否执行。
11. **OVR 唯一性**：任何模块需要 OVR 时必须调用 `CG.Roster.ovr()`，禁止自行加权求和。

---

## 四、公式

### 4.1 OVR（**唯一算法**）

```js
function ovr(p, atPos) {
  const W = OVR_WEIGHTS[atPos || p.pos];
  let s = 0;
  for (const k of ATTR_KEYS) s += W[k] * p.attr[k];
  return Math.round(s);                    // 20~95
}
```

### 4.2 位置适配

```js
const POS_IDX = { PG:0, SG:1, SF:2, PF:3, C:4 };
function posFitMul(p, atPos) {
  if (atPos === p.pos) return 1.00;
  const d = Math.abs(POS_IDX[atPos] - POS_IDX[p.pos]);
  let m = POS_FIT[d];                      // [1.00, 0.92, 0.84, 0.74, 0.64]
  if (atPos === p.altPos) m = Math.max(m, 0.94);
  return m;
}
```

### 4.3 球员生成

```js
function genPlayer(rng, teamStrength, pos, age) {
  const attr = {};
  for (const k of ATTR_KEYS) {
    const bias = (OVR_WEIGHTS[pos][k] - 0.0833) * 55;
    attr[k] = clamp(Math.round(rng.normal(teamStrength + bias, 9)), 20, 95);
  }
  const p = { attr, pos, age, ... };
  p.pot = clamp(ovr(p) + Math.max(0, Math.round(rng.normal((24 - age) * 0.9, 5))), ovr(p), 95);
  p.ego = clamp(Math.round(rng.normal(50, 18)), 0, 100);
  p.workEthic = clamp(Math.round(rng.normal(50, 18)), 0, 100);
  p.loyalty = clamp(Math.round(rng.normal(50, 18)), 0, 100);
  p.clutch = clamp(Math.round(p.workEthic * 0.3 + rng.normal(50, 15) * 0.7), 0, 100);
  p.injuryProne = rng.bool(0.15);
  p.morale = 60; p.staminaNow = 100; p.form = 0;
  return p;
}
```

### 4.4 中文姓名生成

```
姓池（120 个常见姓）：王李张刘陈杨黄赵吴周徐孙马朱胡林郭何高罗郑梁谢宋唐许韩冯邓曹彭曾…
名池 · 单字（60）：昊 泽 轩 睿 辰 宇 峰 涛 磊 洋 勇 军 强 磊 明 超 鹏 涛 斌 杰 …
名池 · 双字（60）：子豪 俊杰 天宇 浩然 嘉诚 立诚 家豪 志远 云飞 若尘 …
规则：surname = pick(姓池)
      given = rng.float() < 0.45 ? pick(单字) : pick(双字)
      name = surname + given
外援（10% 概率）：音译名，如 '卡尔·罗德里格斯'，用 音译姓池 × 音译名池 拼接
唯一性：全局 Set 校验，重复则重新生成（最多 5 次，兜底加序号）
```

### 4.5 合同生成（初始联赛）

```js
function genContract(rng, p) {
  const o = ovr(p);
  const years = clamp(Math.round(rng.normal(3.0, 1.2)), 1, 5);
  const base  = expectedSalary(p);                    // 见 numbers.md 8.1
  const salaries = [];
  for (let i = 0; i < years; i++) {
    salaries.push(Math.round(base * Math.pow(1 + rng.float() * RAISE_MAX, i)));
  }
  return { years, salaries, birdYears: rng.int(0, 3), rookieScale:false, teamOption:false };
}
```

### 4.6 本季薪资

```js
function currentSalary(p) { return p.contract.salaries[0] || 0; }
function teamPayroll(teamId) {
  return players.filter(p => p.teamId === teamId).reduce((s,p) => s + currentSalary(p), 0);
}
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 名册页（右侧抽屉） | 13 行表格：位置 / 姓名 / 年龄 / OVR / 潜力 / 体力条 / 状态 / 年薪 / 合同年限 | 默认按位置分组排序 |
| 名册行 | 点击展开：12 项属性雷达 + 性格 4 维 + 生涯档案 | 弹层 |
| 名册行 | 拖拽到左侧战术板点位 → 设为首发/替补（与 S5 联动） | 见 gdd/tactics.md |
| 名册行 | 「裁人」按钮 → 二次确认，显示买断金额 | 见 gdd/transfer.md |
| 排序 | 表头点击按 OVR / 年龄 / 薪资 / 潜力 排序 | 客户端排序 |
| 筛选 | 位置筛选 chips（全部 / PG / SG / SF / PF / C） | — |

**可访问性**：体力条有数字标签；状态图标（伤病/疲劳）有 `aria-label`。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | 名册 < 10 人 | 禁止推进赛季；UI 顶部红色提示「名册不足 10 人，需签入自由球员」 |
| E2 | 名册 > 15 人（交易后） | 交易提交时校验失败，要求先裁人 |
| E3 | 某位置无人可用（全伤/全裁） | 允许相邻位置顶替，`posFitMul` 最低 0.64；若凑不齐 5 人 → E1 |
| E4 | 初始总薪资超 [9000, 11800] | 对薪资最高的球员按比例缩放（最多 20 次重试），兜底强制截断到 11800 |
| E5 | `pot < ovr`（生成时） | `pot = max(pot, ovr)` 强制修正 |
| E6 | 属性生成越界 | clamp 到 [20, 95]；`staminaNow` clamp 到 [0, 100] |
| E7 | 合同到期但球员仍在名册 | 休赛期第 3 步统一清理：移入自由市场，`teamId = null` |
| E8 | 球员年龄 > 40 | 强制退役：移出名册，写入 `career`，生成「XXX 宣布退役」新闻 |
| E9 | 姓名重复 | 重新生成（最多 5 次），兜底加数字后缀（如「李昊(2)」） |
| E10 | 首发 5 人中有伤员 | UI 黄色警示，但允许强行出场（会提高伤病概率 ×1.5） |

---

## 七、与其他系统的接口

```
依赖：S1（rng.fork('gen:roster:T07') / config）、S2（team.strength）

对外暴露：
  CG.Roster.genLeagueRosters(state)        // 为 30 队生成名册（含薪资约束）
  CG.Roster.genPlayer(rng, strength, pos, age)
  CG.Roster.ovr(p, atPos)                  // ★ 唯一 OVR 算法
  CG.Roster.posFitMul(p, atPos)
  CG.Roster.teamPayroll(teamId)
  CG.Roster.currentSalary(p)
  CG.Roster.setStarters(teamId, [5 ids])
  CG.Roster.benchOrder(teamId)             // 每位置的替补顺序
  CG.Roster.addPlayer(teamId, p) / removePlayer(p)
  CG.Roster.advanceContracts(state)        // 赛季末年限 -1
  CG.Roster.retireCheck(state)             // 强制退役

被依赖：S4 S5 S6 S7 S8 S9 S10 S11 S12 S13（全部）
```

---

## 八、验收用例

```js
// T1 名册规模
state.league.teams.forEach(t => assert(t.playerIds.length === 13));

// T2 位置构成
const t = state.league.teams[0];
const cnt = countBy(t.playerIds.map(id=>state.players[id].pos));
['PG','SG','SF','PF','C'].forEach(pos => assert(cnt[pos] >= 2));

// T3 OVR 范围与权重和
ATTR_KEYS.forEach(k => state.players.forEach(p => assert(p.attr[k]>=20 && p.attr[k]<=95)));
Object.values(CG.CONFIG.OVR_WEIGHTS).forEach(W =>
  assert(Math.abs(Object.values(W).reduce((a,b)=>a+b,0) - 1.0) < 1e-9));

// T4 OVR 一致性（跨系统红线）
const p = state.players['P0001'];
assert(CG.Roster.ovr(p) === Math.round(sum(W[p.pos][k]*p.attr[k])));
assert(CG.Roster.ovr(p, 'C') !== CG.Roster.ovr(p, 'PG'));    // 位置影响 OVR

// T5 posFitMul
assert(CG.Roster.posFitMul(p, p.pos) === 1.00);
const pg = aPlayerWithPos('PG');
assert(CG.Roster.posFitMul(pg, 'C') === 0.64);

// T6 初始薪资约束
state.league.teams.forEach(t => {
  const pay = CG.Roster.teamPayroll(t.id);
  assert(pay >= 9000 && pay <= 11800);
});

// T7 潜力 ≥ OVR
Object.values(state.players).forEach(p => assert(p.pot >= CG.Roster.ovr(p)));

// T8 姓名唯一
const names = Object.values(state.players).map(p=>p.name);
assert(new Set(names).size === names.length);

// T9 合同推进
const before = state.players['P0001'].contract.years;
CG.Roster.advanceContracts(state);
if (before > 1) assert(state.players['P0001'].contract.years === before - 1
                    && state.players['P0001'].contract.salaries.length === before - 1);
else assert(state.players['P0001'].teamId === null);   // 到期 → 自由市场

// T10 可复现
const a = CG.State.create(777); CG.Roster.genLeagueRosters(a);
const b = CG.State.create(777); CG.Roster.genLeagueRosters(b);
assert(JSON.stringify(a.players) === JSON.stringify(b.players));

// T11 无 NaN
assert(!JSON.stringify(state.players).includes('null,null'));
Object.values(state.players).forEach(p =>
  Object.values(p.attr).forEach(v => assert(Number.isFinite(v))));

// T12 首发校验
CG.Roster.setStarters('T01', fiveIds);
const poss = fiveIds.map(id=>state.players[id].pos);
assert(new Set(poss).size === 5);   // 五个不同位置（允许顶替时改为 ≥4）
```

---

## 附 · v1 不做

- 球员情绪事件 / 更衣室冲突
- 交易否决权、球员选项、双向合同、10 天短合同
- 球员退役后的教练/管理层转职
- 球员头像美术（v1 用姓名首字 + 位置色块）
