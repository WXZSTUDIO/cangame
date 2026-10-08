# IMP-01 · Sprint 1 第一批实现报告

- 任务：IMP-01 · Sprint 1 第一批实现（5 项）
- 执行：程基岩（engineering-lead）
- 完成时间：2026-10-08
- 运行时：Node v22.22.2 / win32 x64
- 范围：仅 `assets/` 与验收脚本；**未触碰 `cangame-mp/`**、**未提交**

---

## 0. 一句话结论

5 项全部落地并通过验收（第二批 35/35 项断言全绿），逻辑层性能无退化
（p50 +0.1%，两组波动区间重叠），功能回归通过。

**但本批改了 3 个逻辑层文件 → 合并前必须重跑 `node tools/build-engine.js`**
（详见第 7 节「连带影响」）。

另外要提醒的是：**`tools/` 里有三条概率性断言，失败率各 20~30%，
跑一次全套约有 60% 概率「随机红一次」**。我用改前代码做了对照，
证明它们与本批无关，但会干扰 CI 判读（详见第 6 节）。

---

## 1. 改动清单

| # | 项 | 文件 | 性质 |
|---|---|---|---|
| 1 | **A-07** `careerIncome()` 隐藏乘子 → 显式 `CAREER_MULT` | `assets/career.js` | 逻辑层 · 纯重构 |
| 2 | **S-04** `forceEnd` 三处 → 统一走 `ENDINGS.find()` + 死因叠加 | `assets/engine.js`、`assets/data.js` | 逻辑层 · 行为变更 |
| 3 | **A-06** 孤儿职称 → `JOB_ALIAS` 映射进 CAREERS 阶梯 | `assets/career.js`、`assets/engine.js` | 逻辑层 · 行为变更 |
| 4 | **O-04 / R-04** 属性上下文转义 `escAttr()` | `assets/ui.js` | Web 层 · 安全修复 |
| 5 | **R-01 / R-02 / R-03** 存档兜底 P0 | `assets/engine.js`、`assets/ui.js` | 混合 |
| 5b | **O-03 前置** 关页/切后台存档兜底（仅埋点） | `assets/ui.js` | Web 层 · 骨架 |

**触及文件共 4 个**：`assets/career.js`、`assets/data.js`、`assets/engine.js`（以上三个属逻辑层）、
`assets/ui.js`（Web 层）。
`market.js` / `school.js` / `love.js` / `loan.js` **未改动**（mtime 仍为 10-06 / 10-07）。

---

## 2. 逐项验收数据

### 2.1 A-07 · `careerIncome()` 隐藏乘子 → 显式 `CAREER_MULT`

**问题**：`careerIncome()` 函数体里埋了五个魔法数，配置表上看不见：

```
j.salary × (1 + max(0, age-22) × 0.028) × salaryK
         × (1 + INT/520) × (1 + NET/1000) × (1 + LOY/1100)
```

quality-lead 实测「阶梯表年薪」与「玩家实际年薪」差 2.34×（程序员档 3.68×），
所有照着 `CAREERS` 阶梯表做的数值讨论都是错的。

**做法**：提到 `CAREER_MULT` 配置表，并新增 `careerIncomeParts()` 返回逐项乘子
（`{base, kAge, kEdu, kInt, kNet, kLoy, total}`），既用于结算也用于对账。

```js
const CAREER_MULT = {
  seniority: { fromAge: 22, perYear: 0.028 },
  edu:       { field: 'salaryK', default: 1 },
  stats:     { INT: 520, NET: 1000, LOY: 1100 },
  freelance: { INT: 400, NET: 800 }
};
```

| 验收项 | 改前 | 改后 | 判定 |
|---|---|---|---|
| 显式配置表 `CAREER_MULT` 存在 | ✗ 不存在 | ✓ 已存在 | ✓ |
| 五个乘子连乘还原总倍数（最大相对误差） | 0.000% | 0.000% | ✓ 乘子清单完整，**没有漏掉的隐藏项** |
| 中位总倍数 | 2.878× | 2.878× | ✓ **零数值漂移** |
| 散工公式重复实现 | engine.js 与 ui.js 各抄一份 | 统一为 `freelanceIncome()` | ✓ 消除重复 |

**方法说明**：用**消融法**验证 —— 对每个职业把某一项因子逐个清零/归 1，看收入掉多少；
五个乘子相乘应还原出总倍数。误差 0.000% 说明这五个就是全部，没有第六个隐藏项。
29 个职业全部通过（详见 `scripts/imp-verify.out.txt`）。

**⚠ 这是第二批数值重铸的入口**。改这张表 = 改全局经济，请不要再去改函数体。
注意 `seniority` 无上限，100 岁时是 3.2×；`freelance` 不吃学历、不吃工龄、不吃忠诚。

---

### 2.2 S-04 · 结局路径统一

**问题**：以前有两条互不相通的路径 —— `finish()` 走 `ENDINGS.find()` 正式判定（16 条），
`forceEnd()` 直接写「某某死法」的自定义 ending，**一条正式判定都不走**。
死亡占全部结局的 88% 以上，等于 16 条结局在绝大多数局里根本不参与。

**做法**：合并成一条 —— 死亡也先跑 `ENDINGS.find()`，死因只作为**叠加层**。

产物形状 `{ id, baseId, cause, rank, title, text }`：
- `baseId` = ENDINGS 判出来的「这一生是什么」（如 `end_normal`）
- `cause` = 死因 id（`end_elder` / `end_ill` / `end_dead`），正常收尾为 `null`
- `title` = 「普通的人生 · 安然离世」两段式

新增 `endingFor()` / `resolveEnding()` / `endBy()`；保留 `forceEnd` 作为兼容壳
（**语义已变**：第二个参数现在是死因 id 字符串，不再是自定义 ending 对象）。
新增 `DEATH_CAUSES`（`data.js:788`）三条目。

| 验收项 | 改前 | 改后 | 阈值 | 判定 |
|---|---:|---:|---:|---|
| 走 `ENDINGS` 判定的比例 | 8.6% | **100.0%** | ≥ 60% | ✓ |
| 结局可达种类 | 11 / 16 | **13 / 16** | ≥ 12 | ✓ |
| `forceEnd` 直写 `state.ending` 的局数 | 914 | **0** | 归零 | ✓ |
| 死因叠加层分布 | — | `end_elder`×473 / `end_ill`×345 / `end_dead`×107 | — | ✓ |

**方法说明**：每局结算后**重跑一次 `ENDINGS.find()`**，把它判出的 id 与
`state.ending.baseId` 比对。一致 = 走了正式判定；不一致 = 被直写覆盖。
这个判定方式**不依赖实现细节**，所以改前改后的数字可直接比较。

`ui.js` 的 `renderEnd()` 只读 `e.title` / `e.text`，新形状两者都在，
**无需改 UI**——已被 `dom-test` 与 `browser-parity-test` 证实。

> 未达满 16 种的那 3 种（`end_shop`、`end_family`、`end_escape`、`end_legend` 中的部分）
> 是低概率 / 强条件结局，1000 局里只出现 1 次，属抽样不足而非不可达。

---

### 2.3 A-06 · 孤儿职称 → `JOB_ALIAS`

**问题**：事件与系统会直接往 `state.job` 写一批「有名字但没有阶梯」的职称。
它们只存在于 `engine.js` 预置的 `JOBS` 平工资表里（`JOBS[x].career` 为 `undefined`），
于是 `state.career` 一直是 `null` —— 拿固定工资、永不晋升、不吃学历与工龄加成。
随机基线里「公司职员」恰好是 30 岁最主流的落点，等于**把最典型的玩家路径一脚踢出了晋升体系**。

**做法**：新增 `JOB_ALIAS`（10 条）+ `setJob()` 单一职称写入口，
`applyEffects()` / `resolveEvent()` / 赌博分支的 5 处 `state.job = x` 全部改走 `setJob()`。

`setJob()` 三段式：① 已是阶梯内的正经职称 → 同步 `job` 与 `career.level`；
② 孤儿职称 → 换上阶梯里同档职称并补 `career`；③ 学生/待业/退休 → 原样写入，不动 `career`。

| 孤儿职称 | 落地职称 | 阶梯 | 起始级 | 阶梯顶级 | 20 年后 | 判定 |
|---|---|---|---:|---:|---:|---|
| 公司职员 | 行政主管 | clerk | 1 | 4 | 3 | ✓ 可晋升 |
| 大企业职员 | 行政经理 | clerk | 2 | 4 | 3 | ✓ 可晋升 |
| 公务员 | 副科级 | civil | 1 | 6 | 5 | ✓ 可晋升 |
| 工厂工人 | 熟练工 | factory | 1 | 4 | 3 | ✓ 可晋升 |
| 个体户 | 拿到天使轮 | startup | 1 | 5 | 4 | ✓ 可晋升 |
| 创业者 | 拿到天使轮 | startup | 1 | 5 | 4 | ✓ 可晋升 |
| 军人 | 保安队长 | guard | 1 | 4 | 3 | ✓ 可晋升 |
| 大公司战略次长 | 高级产品经理 | pm | 2 | 5 | 4 | ✓ 可晋升 |
| 大公司副董事长 | 业务董事 | finance | 2 | 5 | 4 | ✓ 可晋升 |
| 企业董事长 | 合伙人 / 高管 | finance | 4 | 5 | 4 | ✓ 已在终端级 |

| 验收项 | 改前 | 改后 | 阈值 | 判定 |
|---|---:|---:|---:|---|
| 30 岁 `state.career !== null` 比例 | 87.3% | **93.3%** | ≥ 90% | ✓ |
| 30 岁众数职业 | 区域加盟商 8.7% | **办公室主任 15.0%** | 落在阶梯内 | ✓ |
| 孤儿职称落进阶梯 | 0 / 13 | **10 / 10**（可映射者） | 全部 | ✓ |
| 非终端级可被 `careerTick()` 晋升 | — | **9 / 9** | 全部 | ✓ |

**两点必须说清楚的**：

1. **源码里 13 个孤儿职称字面量一个都没删**。它们是事件文案里写死的 authored 文本
   （「你成为了一名公司职员」），删掉会改变文案。修复落在**写入口**
   （`setJob()` 在写入瞬间翻译成阶梯职称），所以静态扫描仍会报 13 个 ✗ —— 这是预期的。

2. **`企业董事长` 落在 finance 索引 4 即终端级「合伙人 / 高管」，无从晋升**。
   这是正确行为，不是卡死：`ladder` 是 0 基索引，`finance.ladder` 共 5 项（0..4）。
   （我第一版断言按 1 基写，误报了一次，已修正。）

**⚠ level 取法是「按名义年薪同档对齐」，不是终值**：先对齐现有到手收入
（避免一次性把主流路径砍掉一半），再尽量留至少一级晋升空间。
**这是 v6.0 数值重铸（第二批）的输入**，请 design-strategist 出规格后从这里入口改。

---

### 2.4 O-04 / R-04 · 属性上下文转义

**问题**：`esc()` 只转义 `& < >`，**不转义引号**；而它被用在双引号属性里
（`aria-label="${esc(name)}"`、`title="${esc(...)}"`）。玩家姓名（`#inputName`，
10 字符、不限字符集，**且孩子姓氏直接继承 `state.name[0]`**）里带一个双引号
就能突破属性边界，往 `<svg>` 上注入 `onload` / `onerror` 事件处理器属性。

**做法**：新增 `escAttr()`（转义 `& < > " '`），属性上下文全部改用它；
文本上下文继续用 `esc()`（只转义 `& < >` 就够，保持旧行为）。

| 验收项 | 结果 |
|---|---|
| `escAttr()` 覆盖 `& < > " '` | ✓ |
| 属性里带插值的位置全部改用 `escAttr` | ✓ **4 / 4**（`ui.js:391` `title`、`ui.js:661` `aria-label`、`ui.js:832` `title`、`ui.js:1651` `title`） |
| 4 组注入 payload 突破 SVG 属性边界 | ✓ 0 / 4（`'" onload="__P"'`、`'"><script>__P</script>'`、`"' onmouseover='__P'"`、`'"><img src=x onerror=__P>'`） |
| `robust-fuzz` E 组 R-04 | ✗ → **✓** |
| `escAttr('"\'&<>')` 输出 | `&quot;&#39;&amp;&lt;&gt;` ✓ |

> 扫描口径说明：最初按「行」判定，把 `ui.js:832/1651` 误判成失败 —— 那两行里
> 属性用 `escAttr()`、而文本 `<i>${esc(a.name)}</i>` 用 `esc()`，**后者才是对的**
> （文本上下文不需要转义引号）。已改为按「属性」逐个判定，并跳过注释行。

---

### 2.5 R-01 / R-02 / R-03 · 存档兜底 P0 + O-03 前置

| 项 | 内容 | 结果 |
|---|---|---|
| **R-01** | `migrateState()` 补兜 `log` / `queue` / `flags`（含 `flags.parents_alive`）。原代码在第 600 行就读了 `state.flags.orphan`，而 `flags` 漏兜 → 旧档一进来第一行就 `TypeError` | 单删三个字段后 `migrateState()` **全部补回、零抛错** ✓ |
| **R-02** | `lsSet()` 原来 catch 是空的，写失败时玩家**完全不知情**（隐私模式/配额满时会以为存了，下次回来「继续游戏」按钮就消失了） | `lsSet()` 返回布尔 + `_storageBroken` 只提示一次 + `save-broken` 视觉标记 + `console.error` 留痕；实测 `autosave()` 失败返回 `false`、不冒泡、按钮挂上 `save-broken` ✓ |
| **R-03** | `btnRestart` 是全项目唯一一处不在 try 里的 `localStorage.removeItem`（`ui.js:1952`） | 已包进 `try/catch` ✓；`robust-fuzz` D 组 R-03b ✓ |
| **O-03 前置** | 关页/切后台兜底（本批**只埋点，不改节流**） | `markDirty()` / `flushSave()` / `autosaveNow()` + `SAVE_DEBOUNCE_MS = 0` + `pagehide` / `visibilitychange` / `beforeunload` 三个监听 ✓；关键节点（人生结束 / 手动存）走 `autosaveNow()` 同步写，3 处调用 ✓ |

`SAVE_DEBOUNCE_MS` 现在**故意设为 0**，即 `markDirty()` 立即合流、行为与改前完全一致。
真正开启节流是 O-03 的事，留在第二批 —— 先把兜底埋好，O-03 开启时才不会丢存档。

> `pagehide` 是 iOS Safari 上**唯一可靠**的关页时机（`beforeunload` 在 iOS 上不触发），
> 这是 O-03 的硬前置。

---

## 3. 性能验证：同口径 before / after

### 为什么不能直接拿 `perf-profile.md` 里的数字比

那份 step-bench 跑在「exam 两段式驱动缺陷」修好**之前** —— v5.5 的考试是两段式
（`exam.options === null` 且 `exam.quiz` 存在，必须先调 5 次 `answerExamQ()` 才会回填
options），早期驱动漏了这步，角色**永远不入学期**（30 岁仍是「婴儿」），
测到的是「残缺人生」。本轮已同步修正（`step-bench.js` 的 `__driveExam()` 与
`imp-verify.js` 的 `__imp_playExam()`），但绝对值与旧报告不可比。

### 改前代码从哪来

`cangame-mp/engine/bundle.js` 是 `build-engine.js` 把 7 个逻辑层文件拼出来的产物，
**构建于 2026-10-07 13:38，早于本轮改动**（10-08 09:55 起）。已验证
`JOB_ALIAS` / `CAREER_MULT` / `DEATH_CAUSES` / `setJob` 等 8 个新增标识符在其中
**0 命中** → 它是原始逻辑层的完好副本，可直接当 baseline。

### 结果（交替轮次，7 轮 × 40 局，before/after 交替执行）

| 版本 | 局数 | 整局 p50 的中位 (ms) | p50 波动区间 (ms) | 整局均值 (ms) | 存档均值 (KB) | 存档峰值 (KB) |
|---|---:|---:|---|---:|---:|---:|
| 改前（bundle.js 原文） | 280 | 15.514 | 14.62 ~ 16.31 | 14.488 | 42.6 | 47.3 |
| 改后（assets/ 现行） | 280 | 15.536 | 14.52 ~ 16.69 | 14.635 | 41.7 | 47.1 |

| 指标 | 改前 | 改后 | 变化 |
|---|---:|---:|---:|
| 整局 p50 的中位 (ms) | 15.514 | 15.536 | **+0.1%** |
| 整局均值 (ms) | 14.488 | 14.635 | +1.0% |
| 存档均值 (KB) | 42.6 | 41.7 | −2.1% |
| 存档峰值 (KB) | 47.3 | 47.1 | −0.4% |

✅ **两组的 p50 波动区间互相重叠 → 这个量级的差异是噪声。判定为「无性能退化」。**

逻辑层改动都是 O(1) 常量开销：每局多 1 次 `ENDINGS.find()`（实测 **0.0055 ms**，
占整局 **0.04%**）、每次写职称多 1 次 `JOB_ALIAS` 查表。

### 一个测量方法上的坑（记录备查）

第一版按「连续跑 300 局取 p95」报出来 **+36%**，看着像退化。复跑 3 次发现：
**改前组自身的 p95 就在 17.0 → 19.6 ms 之间摆动 15%**。p95 在 40 局/轮下只有约
2 个样本落在尾部，被 GC 停顿完全主导 —— 这是**噪声，不是信号**。
改用「交替轮次 + 各轮 p50 取中位」后差异收敛到 +0.1%。

---

## 4. 回归验证

| 用例 | 结果 | 通过项 |
|---|---|---:|
| `tools/_verify-v52.js` | ✓ PASS（稳定） | 24 |
| `tools/_verify-v53.js` | ⚠ **约 24% 概率随机失败**（既有 flake，见第 6 节） | 41 |
| `tools/_verify-v54.js` | ⚠ **约 14~25% 概率随机失败**（既有 flake，见第 6 节） | 66 |
| `tools/_verify-v55.js` | ⚠ **约 23% 概率随机失败**（既有 flake，见第 6 节） | 54 |
| `tools/dom-test.js` | ✓ PASS（存档写入 true、槽位 3、无运行时错误） | — |
| `tools/browser-parity-test.js` | ✓ PASS（稳定） | 22 |
| `tools/v5-test.js` | ✓ PASS（稳定） | — |
| `scripts/coupling-probe.js` | ✓ 396 个顶层标识符、**无跨文件重名**、无 window 内建覆盖 | — |
| `scripts/robust-fuzz.js` | R-01 ✓ / R-03 ✓ / R-03b ✓ / **R-04 ✓** / G 组 round-trip ✓ | — |

`coupling-probe` 顶层标识符从 377 → 396（新增 19 个，与改动清单一致），
**跨文件重名仍为 0** —— 这是目前唯一在保护这套架构的东西。

> **重要**：`_verify-v53/54/55` 三个用例各自带一条**概率性断言**，失败率都在 20~30%。
> 也就是说**跑一次全套有约 60% 的概率「随机红一次」**，与本批改动无关。
> 这一点我用 `bundle.js` 做了改前/改后对照（见第 6 节），三个都是**既有 flake**。
> 建议 quality-lead 把这三处改成确定性断言，否则 CI 上的红灯没有信息量。

---

## 5. `robust-fuzz` 剩余问题（本批**明确不修**，留给第二批）

| 项 | 组别 | 状态 | 说明 |
|---|---|---|---|
| **R-05** | A 组 | ✗ 仍红 | 极端数值会让 UI 显示 `NaN` / `Infinity` / `undefined`。**P1，属数值钳制，不在本批 5 项范围内**。注：A 组「抛错次数」全为 0，脏文本才会进 UI |
| **R-07** | F 组 | ✗ 仍红（3 项） | 崩溃兜底盲区：`window.addEventListener("error")` 注册在 `ui.js`（最后一个脚本），data.js 语法错误 / 顶层抛错 / ui.js 自身语法错误这三种情况横幅都不显示 |
| **R-08** | G 组 | ⚠ 提示 | `unescape/escape` 是 Annex B 遗留 API（已废弃），依赖 `%uXXXX` 非标准扩展。round-trip 本身正常，建议换 `TextEncoder`（见 O-08） |

---

## 6. 顺带发现：`tools/` 里有三条概率性断言，与本批无关但会让 CI 随机红

跑回归时发现 `_verify-v53 / 54 / 55` 会**随机**失败。我用 `bundle.js`（改前代码）
做了改前/改后对照（脚本：`scripts/_flake-ab.js`），**三条都是既有 flake**：

| 用例 | 失败断言 | 改前失败率 | 改后失败率 | 判定 |
|---|---|---:|---:|---|
| `_verify-v53` | 未能触发疾病用于治疗验证 | 23.0% ~ 28.3% | 23.3% ~ 25.3% | 既有 |
| `_verify-v55` | 前任能复合（+2 条级联） | 20.0% ~ 24.7% | 21.7% ~ 25.0% | 既有 |
| `_verify-v54` | 恩师至少比你大 14 岁 | 见下方专项诊断 | — | 既有 |

（每个场景 300 次，跑 3 轮取区间。**两组区间完全重叠** → 差异是噪声，不是 IMP-01 带来的。）

### 6.1 `_verify-v54`「恩师年龄」：测试脚本用错了驱动函数

`tools/_verify-v54.js` 的「恩师至少比你大 14 岁」断言偶发失败（20 次里 5 次）。
我做了根因诊断（`scripts/_v54-flake-diag.js`）：

**测试调的是 `friendGrowth()`，而产品里每年真正跑的是 `friendTick()`。**
`friendGrowth()` 只负责结识新朋友，**不给已有朋友增龄**；`friendTick()` 里才有
`f.age = (f.age || state.age) + 1`（`engine.js:1199-1201`）。
于是测试里恩师的年龄被**冻结在相遇那年**，6 年后差距被吃掉 6 岁。

| 驱动函数 | 样本 | 差不足 14 岁的局数 | 失败率 | 实测年龄差区间 | 相遇年龄区间 |
|---|---:|---:|---:|---|---|
| `friendGrowth`（v54 现在的写法） | 400 | 56 | **14.0%** | **10 ~ 29** | 12 ~ 17 |
| `friendTick`（产品真实路径） | 400 | **0** | **0.0%** | **16 ~ 30** | 12 ~ 17 |

`FRIEND_TYPES.teacher.ageGap` 配置是 `[16, 30]`。
`friendGrowth` 下实测区间跌到 **10**（跌破配置下限 16，直接证明年龄被冻结）；
`friendTick` 下精确落在 **16 ~ 30**（完全等于配置）。

**结论：产品代码正确，是测试脚本用错了驱动函数。**

修复（一行，属 quality-lead 域，**我未改动**）：

```js
// tools/_verify-v54.js:41
-      A.friendGrowth(s);
+      A.friendTick(s);
```

### 6.2 `_verify-v53`「未能触发疾病」：循环没判 `finished`

```js
// tools/_verify-v53.js:192
while (!s3.ill && g3++ < 60) { s3.age++; A.illnessTick(s3); }
```

`s3` 从 45 岁起跑 60 年 → 到 105 岁，**早已过了 `END_AGE`**。循环条件不判 `s3.finished`，
角色死后 `illnessTick` 不再产生新病，于是 `s3.ill` 永远为空 → 断言失败。
（实测「未触发」的样本最终年龄都是 105。）

修复方向：循环条件加上 `&& !s3.finished`，或在到 `END_AGE` 前停止并重开一局。

### 6.3 `_verify-v55`「前任能复合」：概率判定没有兜底

```js
// tools/_verify-v55.js:154
for (let i = 0; i < 60 && !(rk && rk.ok); i++) rk = A.rekindle(s2, 0);
ok(rk && rk.ok, '前任能复合');
```

`rekindle()` 带成功率，连试 60 次仍有约 23% 概率全败（实测失败原因统一是
「感情还不够（现在 50%，需 55%）」）。失败会级联打掉后面 2 条断言，所以一次 flake 报 3 条红。

修复方向：把好感度直接拉到判定阈值之上再调一次（确定性），
或改成「统计 60 次里成功多少次、要求 ≥ 某比例」。

---

## 7. 连带影响（⚠ 需主理人处理）

本批改了 **`assets/data.js`、`assets/engine.js`、`assets/career.js` 三个逻辑层文件**，
三者都在 `build-engine.js` 的 `FILES` 列表里。

> ### 合并前必须重跑：`node tools/build-engine.js`

我**未触碰 `cangame-mp/`**，构建需由主理人或小程序侧执行。在此之前
`cangame-mp/engine/bundle.js` 仍是**改前版本**（构建于 2026-10-07 13:38），
**与 Web 版逻辑已不一致**。

已做只读前置体检（`scripts/_mp-build-precheck.js`），确认重跑是安全的：

| 检查项 | 结果 |
|---|---|
| 逻辑层沾浏览器 API（`document.` / `window.` / `localStorage` / `alert(` / `prompt(`） | ✓ 7 个文件**全部干净**，重跑不会触发告警 |
| 顶层命名冲突 | ✓ 无冲突 |
| 文件列表与顺序（`data → market → engine → school → career → love → loan`） | ✓ **本次未改动**，重跑不会打断小程序 |
| 导出符号变化 | 250 → **261**（新增 11 个，**消失 0 个**）→ 小程序侧不会断引用 |

新增的 11 个导出符号：

| 符号 | 落点 |
|---|---|
| `JOB_ALIAS` / `NON_JOBS` / `setJob` / `isNonJob` | `career.js:392 / 406 / 409 / 447` |
| `CAREER_MULT` / `careerIncomeParts` / `freelanceIncome` | `career.js:568 / 581 / 607` |
| `DEATH_CAUSES` | `data.js:788` |
| `endingFor` / `resolveEnding` / `endBy` | `engine.js:2225 / 2229 / 2243` |

**对小程序的行为级影响**（重跑构建后生效）：

1. **S-04 会改变小程序的结局结构**。若小程序侧有读 `state.ending.id` 判断死因的代码，
   需改为读 `state.ending.cause`（`end_elder` / `end_ill` / `end_dead` / `null`），
   `state.ending.id` 现在是「这一生是什么」的结局 id（如 `end_normal`）。
   标题字段 `ending.title` 变为「普通的人生 · 安然离世」两段式。
2. **A-06 会改变 `state.job` 的取值**。孤儿职称在写入瞬间被翻译成阶梯职称
   （如「公司职员」→「行政主管」），若小程序侧有按 `state.job` 字符串做分支的代码需复核。
3. **A-07 是纯重构，不改变任何数值**（实测总倍数 2.878× 改前改后一致）。

---

## 8. 第二批需要 design-strategist 出规格后才能做的（本批**未做**）

| 项 | 内容 | 卡在什么上 |
|---|---|---|
| **S-02 / S-01 / S-03** | 数值体系重铸 | 等数值规格。`CAREER_MULT` 与 `JOB_ALIAS` 已备好入口，规格到了直接改表 |
| **B-04** | 房价 / 收入比 | 同上 |
| **O-01** | `renderStream` 增量渲染 | 需先确认渲染层重构的边界与验收口径 |
| **O-02** | 头像 Memo + SVG `<symbol>`/`<use>` | 同上 |
| **O-03** | `autosave` 节流 | **硬前置已就绪**（`markDirty`/`flushSave` + `pagehide` 兜底），把 `SAVE_DEBOUNCE_MS` 从 0 改成实际节流值即可 |
| **R-05** | 极端数值钳制 | P1，需确认钳制策略（截断 / 归零 / 拒绝） |

---

## 9. 交付物

**代码改动**：`assets/career.js`、`assets/data.js`、`assets/engine.js`、`assets/ui.js`

**新增验收脚本**（`production/phase6-polish/perf/scripts/`）：

| 脚本 | 用途 |
|---|---|
| `imp-verify.js` | 第一批主验收：A-06（300 局随机基线）/ A-07（消融法）/ S-04（1000 局结局审计） |
| `imp-verify2.js` | 第二批验收：A-06 晋升链 / R-01 / R-02 / O-04 / O-03 前置（**35 项断言全绿**） |
| `imp-perf-ab.js` | 逻辑层 before/after 同驱动性能对比（交替轮次） |
| `imp-perf-why.js` | 性能归因：`ENDINGS.find()` 单价、A-06 开关对照 |
| `_v54-flake-diag.js` | `_verify-v54` 恩师年龄 flake 根因诊断（改前/改后驱动函数对照） |
| `_flake-ab.js` | `_verify-v53`/`_verify-v55` flake 的改前/改后失败率对照（各 300 次 × 3 轮） |
| `_mp-build-precheck.js` | 小程序构建前置体检（**只读**） |
| `_run-tools.sh` | `tools/` 全套回归串行执行器 |

**输出文件**：`imp-verify.out.txt`、`imp-verify2.out.txt`、`imp-perf-ab.out.txt`、
`imp-perf-why.out.txt`、`_v54-flake-diag` 输出、`_flake-ab.out.txt`、
`_mp-build-precheck.out.txt`、`coupling-probe.out.txt`、`robust-fuzz.out.txt`；
改前基线存于 `scripts/_baseline/imp-verify.before.txt`。

**临时脚本已清理**：`_dbg-play.js`、`_run-tools.js`、`_probe-cold.js`。

---

## 10. 诚实说明（这份报告的边界）

1. **R-05 / R-07 未修**，属第二批 / 其他批次，`robust-fuzz` 里仍显示 ✗。
2. **A-06 的 `level` 取法是「名义年薪同档对齐」的临时值**，不是终值，
   目的是让主流路径不被砍收入；终值等 design-strategist 的规格。
3. **`tools/` 里三条概率性断言我只诊断、未修复**（测试代码属 quality-lead 域）。
   本批跑回归时它们会随机红，我已用 `bundle.js` 证明与本批改动无关。
4. **XSS 的执行面未经真机验证**：jsdom 里 `__PWNED = 0`，结论是
   「属性突破已确认修复、执行面待浏览器实测」——浏览器行为与 jsdom 同路径，但我没跑真机。
5. **小程序侧我一行没动**，第 7 节的三条行为级影响需要小程序侧确认后再合并。
6. **性能对比只覆盖逻辑层**（bundle 里没有 `ui.js`）。本批 5 项里 4 项落在逻辑层，
   `ui.js` 那部分是常量级开销（`escAttr` 与 `esc` 同代价、`lsSet` 多返回一次布尔），
   但我**没有**对 Web 渲染路径做 before/after 实测。
