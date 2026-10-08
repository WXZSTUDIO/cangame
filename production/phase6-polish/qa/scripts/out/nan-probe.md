# R-05 NaN 源头定位（数值域）· cangame v5.5.0

> 归属说明：engineering-lead 已在 UI 出口加 `num()` 兜底（显示层收口）。
> 本文件回答的是**上游问题：NaN 是哪个玩法公式产生的、怎么传出去的**。

## 0. 三条基础事实（决定了 NaN 能不能扩散）

| 表达式 | 结果 | 含义 |
|---|---|---|
| `NaN <= 0` | **false** | `if (x <= 0) return` 这类守卫**拦不住 NaN** |
| `NaN > max` | **false** | `if (x > max) return` 这类上限守卫**也拦不住 NaN** |
| `Math.max(0, NaN)` | **NaN** | `Math.max` 不消毒 |
| `Math.min(100, NaN)` | **NaN** | `Math.min` 不消毒 |
| `clamp(NaN, 0, 100)` | **NaN** | **引擎的 clamp 不是 NaN 守卫**（`Math.max(a, Math.min(b, v))`） |

**结论：项目里大量使用的 `if (n <= 0) return` / `if (amt > max) return` 守卫，对 NaN 全部失效。**
这是 R-05 的系统性根因，不是某个单点笔误。

## 1. 静态审计：会改动 `MONEY` 的入口，守卫是否挡得住 NaN

| 入口函数 | 脏入参 | 调用后 `MONEY` | `netWorth` | `scoreOf` | 判定 |
|---|---|---|---|---|---|
| `borrow(state, id, amount)` | NaN（parseInt("") 的结果） | NaN | NaN | NaN | **污染** |
| `borrow(state, id, amount)` | undefined（空引用） | NaN | NaN | NaN | **污染** |
| `borrow(state, id, amount)` | null | 1899301393 | 1999300005 | 54 | 安全 |
| `borrow(state, id, amount)` | 字符串 "abc"（parseInt 失败） | NaN | NaN | NaN | **污染** |
| `borrow(state, id, amount)` | 空字符串 "" | 1899313623 | 1999300048 | 47 | 安全 |
| `borrow(state, id, amount)` | Infinity | 1899310320 | 1999300036 | 47 | 安全 |
| `repayLoan(state, idx, amount)` | NaN（parseInt("") 的结果） | NaN | NaN | NaN | **污染** |
| `repayLoan(state, idx, amount)` | undefined（空引用） | NaN | NaN | NaN | **污染** |
| `repayLoan(state, idx, amount)` | null | 1899317122 | 1999300060 | 49 | 安全 |
| `repayLoan(state, idx, amount)` | 字符串 "abc"（parseInt 失败） | NaN | NaN | NaN | **污染** |
| `repayLoan(state, idx, amount)` | 空字符串 "" | 1881400275 | 1981380071 | 53 | 安全 |
| `repayLoan(state, idx, amount)` | Infinity | 1781386246 | 1881380022 | 45 | 安全 |
| `buyStock(state, id, shares)` | NaN（parseInt("") 的结果） | NaN | NaN | NaN | **污染** |
| `buyStock(state, id, shares)` | undefined（空引用） | NaN | NaN | NaN | **污染** |
| `buyStock(state, id, shares)` | null | 1899339296 | 1999300137 | 50 | 安全 |
| `buyStock(state, id, shares)` | 字符串 "abc"（parseInt 失败） | NaN | NaN | NaN | **污染** |
| `buyStock(state, id, shares)` | 空字符串 "" | 1881386364 | 1981380022 | 47 | 安全 |
| `buyStock(state, id, shares)` | Infinity | 1899308902 | 1999300031 | 50 | 安全 |
| `sellStock(state, id, shares)` | NaN（parseInt("") 的结果） | NaN | NaN | NaN | **污染** |
| `sellStock(state, id, shares)` | undefined（空引用） | NaN | NaN | NaN | **污染** |
| `sellStock(state, id, shares)` | null | 1899306703 | 1999300023 | 50 | 安全 |
| `sellStock(state, id, shares)` | 字符串 "abc"（parseInt 失败） | NaN | NaN | NaN | **污染** |
| `sellStock(state, id, shares)` | 空字符串 "" | 1881398414 | 1981380064 | 47 | 安全 |
| `sellStock(state, id, shares)` | Infinity | 2098600024 | 1998600024 | 44 | 安全 |
| `repayDebt(state, amount)` | NaN（parseInt("") 的结果） | NaN | NaN | NaN | **污染** |
| `repayDebt(state, amount)` | undefined（空引用） | NaN | NaN | NaN | **污染** |
| `repayDebt(state, amount)` | null | 1799310138 | 1899300035 | 25 | 安全 |
| `repayDebt(state, amount)` | 字符串 "abc"（parseInt 失败） | NaN | NaN | NaN | **污染** |
| `repayDebt(state, amount)` | 空字符串 "" | 1899306643 | 1999300023 | 47 | 安全 |
| `repayDebt(state, amount)` | Infinity | 1799306033 | 1999300021 | 48 | 安全 |
| `buyProp(…, downRatio, …)` | NaN（parseInt("") 的结果） | 1752862855 | 1981380058 | 52 | 安全 |
| `buyProp(…, downRatio, …)` | undefined（空引用） | 1771076116 | 1999300022 | 48 | 安全 |
| `buyProp(…, downRatio, …)` | null | 1771145533 | 1999300055 | 49 | 安全 |
| `buyProp(…, downRatio, …)` | 字符串 "abc"（parseInt 失败） | 1771343953 | 1999300030 | 48 | 安全 |
| `buyProp(…, downRatio, …)` | 空字符串 "" | 1770614792 | 1999300056 | 51 | 安全 |
| `buyProp(…, downRatio, …)` | Infinity | 1771204914 | 1999300006 | 49 | 安全 |
| `buyProp(…, …, qty)` | NaN（parseInt("") 的结果） | 1858049946 | 1981380023 | 49 | 安全 |
| `buyProp(…, …, qty)` | undefined（空引用） | 1875971373 | 1999300028 | 49 | 安全 |
| `buyProp(…, …, qty)` | null | 1875965288 | 1999300007 | 48 | 安全 |
| `buyProp(…, …, qty)` | 字符串 "abc"（parseInt 失败） | NaN | NaN | NaN | **污染** |
| `buyProp(…, …, qty)` | 空字符串 "" | 1875994921 | 1999300110 | 47 | 安全 |
| `buyProp(…, …, qty)` | Infinity | 1899320528 | 1999300072 | 53 | 安全 |

命中 **16** 组「脏入参 → 数值污染」。

## 2. 传播链：一次污染会波及到哪里

| 环节 | 污染前 | 污染后 | 是否泄漏 |
|---|---|---|---|
| `state.stats.MONEY` | 1899300562 | **NaN** | **是** |
| `netWorth()` | 1999300002 | **NaN** | **是** |
| `scoreOf()` | 50 | **NaN** | **是** |
| `fmtMoney(MONEY)` | — | **0元** | 否（`(NaN\|\|0)` 把 NaN 吞成 0） |

**关键矛盾**：`fmtMoney()` 里 `const raw = (v || 0) * CNY_RATE;` —— NaN 是 falsy，
所以**金额文本会被悄悄显示成「0元」**，而 `scoreOf()` 的 `Math.sqrt(Math.max(0, NaN))` **不会被吞**，
于是玩家看到的是「现金 0 元、净资产 0 元，但结局页评分 NaN」。
这正是 R-05 里 `HP → NaN` / `MONEY → NaN` 两种症状同时出现、却又不完全一致的原因。

## 3. 其它候选公式（除零 / 0÷0 / undefined 参与算术）

| 公式 | 位置 | 触发条件 | 实测输出 | 是否可达 |
|---|---|---|---|---|
| `annualPayment` → `l.principal / l.years` | loan.js:101 | 存档里 loan.years = 0 或 principal 缺失（旧存档 / 导入畸形码） | years=0 → Infinity；principal=undefined → NaN | **B 类：脏存档可达** |
| `sellStock` → `pos.cost * (n / pos.shares)` | market.js:486 | 持股记录 shares = 0 或 undefined（脏存档） | {"ok":false,"msg":"数量不对"} | 否（有 n<=0 守卫） |
| `Math.sqrt(clamp(rawScore / P.ceil, 0, 1))` | school.js:307 | P.ceil = 0（配置错误）或 rawScore = NaN | clamp(Inf,0,1)=1 → sqrt=1（安全）；rawScore=NaN → clamp=NaN → sqrt=NaN | C 类：需配置错误 |
| `tableAt` → `(year-a[0])/(b[0]-a[0])` | market.js:221 | 两张表里有重复年份（b[0]-a[0]=0） | FIN_SCALE 1985 → 1（表内无重复年份） | 否 |
| `scoreOf` → `sqrt(max(0,worth)/1e8)` | engine.js:2229 | worth 已是 NaN | scoreOf = NaN | **下游：放大器** |
| `careerIncome` → `income*(1+s.INT/520)*…` | career.js:489 | stats.INT / NET / LOY 为 NaN | careerIncome = NaN | **下游：放大器** |
| `stockValue` → `p.shares * price` | market.js:392 | 持股 shares = undefined | netWorth = NaN | **B 类：脏存档可达** |

## 4. 运行时追踪：正常玩法路径是否自产 NaN

- 采样局数：**300**（6 画像 × 50，含随机市场买卖）
- 崩溃：**0**
- `stats.*` 出现非有限值：**0**
- `netWorth()` 非有限：**0**
- `scoreOf()` 非有限：**0**

**结论：正常玩法路径 —— 不产生 NaN。**
这条要写清楚：R-05 不是"数值系统算崩了"，而是**输入层没做净化**。

## 5. 定级：三类 NaN 来源

| 类别 | 定义 | 本轮实测 | 归属 |
|---|---|---|---|
| **A 类 · 正常玩法可达** | 玩家按正常 UI 操作、不借助畸形输入就能产生 | **0 条**（见 §4） | — |
| **B 类 · 脏存档 / 畸形输入可达** | 导入旧存档码、老 localStorage、或 UI 输入框解析失败 | **19 条**（§1 的 16 组 + §3 的 3 条） | **R-01 / R-09 + 本条**，属 engineering-lead 的 Batch A/B |
| **C 类 · 仅直接注入可达** | 只能通过手写 STATE 字段产生（robustness-review A 组的做法） | 存在，但**不是玩法缺陷** | 只需 UI 出口 `num()` 兜底（已修） |

### 5.1 最可能的真实触发路径（按概率排序）

| # | 路径 | 概率 | 后果 |
|---|---|---|---|
| 1 | **UI 数量输入框留空 / 输入非数字** → `parseInt` 得 NaN → 传给 `buyStock` / `sellStock` / `repayDebt` / `borrow` / `repayLoan` | **中** | 现金立刻变 NaN，且**不可逆**（`MONEY += NaN` 之后所有运算都是 NaN）；`fmtMoney` 显示 0 元，玩家以为是"钱没了"，实际是整局数值已废 |
| 2 | **导入旧版存档码**（R-09 只校验 `obj.stats` 存在）→ loan 的 `principal`/`years` 缺失 → `annualPayment` 除零/NaN → `loanTick` 里 `MONEY -= NaN` | 中 | 同上，且发生在"读档后第一次推进年份"时 |
| 3 | **老 localStorage 存档缺字段**（R-01 域）→ 迁移后 `market.stocks[i].shares` 为 undefined → `stockValue` NaN → `netWorth` NaN → `scoreOf` NaN | 中 | 净资产与评分崩坏 |
| 4 | 配置错误（`P.ceil = 0`、表内重复年份） | 低 | 属开发期问题 |

### 5.2 建议修复（按成本排序）

```js
// (1) 一行工具函数，放在 engine.js 顶部（clamp 旁边）
function safeNum(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fb === undefined ? 0 : fb);
}

// (2) 六个金额入口统一在第一行净化（各 1 行，共 6 行）
//     borrow / repayLoan / buyStock / sellStock / repayDebt / buyProp(qty)
const amt = safeNum(amount, 0);      // 之后所有守卫都能正常工作
const n   = Math.floor(safeNum(shares, 0));
const q   = Math.max(1, Math.floor(safeNum(qty, 1)));  // ← 注意：qty||1 挡不住 "abc"（字符串非空即 truthy）

// (3) loan.js annualPayment 加一个年份守卫
function annualPayment(l) {
  if (l.left <= 0) return 0;
  const per = l.principal / Math.max(1, l.years);   // ← 原来是 / l.years
  return Math.round(per + l.left * l.rate);
}

// (4) marketMigrate 里顺手消毒一次持股记录（脏存档进不来）
m.stocks = (m.stocks || []).map(p => ({
  id: p.id, shares: safeNum(p.shares, 0), cost: safeNum(p.cost, 0)
})).filter(p => p.id && p.shares > 0);
```

> 说明：第 (2) 条是**根治**。UI 出口的 `num()` 只是让 NaN 不显示，
> 但玩家的存档此时已经是脏的，下一局/下一次读档仍会炸。
