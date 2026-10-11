# cangame v2 · 架构说明（Sprint 1 — 经济循环跑通）

> 本文件为 **Sprint 1** 的工程架构基线，覆盖设计文档 §0 硬约束、§2 系统清单、
> §3 数值基线、§4 状态机、§6 数据模型、§8 冲刺范围、附录 A 加载顺序。
> 后续冲刺（2~5）按本架构的预留钩子接入，不改变本文件确立的核心约束。

---

## 一、单一真源与分层

```
设计文档(GDD) ──▶ config.js（数值单一真源）
                      │
                      ▼
                 rng.js（种子化 RNG）
                      │
                      ▼
        state.js（gameState 工厂 / 序列化 / 日志）
                      │ 依赖
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
   factions.js   resource.js    settle.js(结算/淘汰/终局)
        │             │              │
        └─────┬───────┴──────────────┘
              ▼
         engine.js（阶段状态机 / 编排层）
              │
              ▼
           ui.js（渲染 / 交互，只读状态 + 调引擎）
```

- **数据层**：`gameState` 是唯一真源（§6.1），全部为纯数据（无函数），可 `JSON` 序列化、可重放、可 vm 测试。
- **引擎层**：`engine.js` 只做 5 阶段流转与「结束阶段→批量跑 AI」的钩子；**业务全在各 system 文件**。
- **表现层**：`ui.js` 不持有游戏状态，只读 `GAME/ENGINE` 并调用引擎；人类操作点唯一入口 = 「结束本阶段」按钮。

---

## 二、架构决策记录（ADR）

### ADR-1 · `gameState` 为唯一真源
- **上下文**：多系统（资源/阵营/结算/AI）需共享同一盘面；测试与重放要求状态可序列化。
- **决定**：顶层 `gameState`（§6.1）集中持有 `factions/players/market/war/prizePool/...`；
  所有系统读写它，不另设全局可变副本。提供 `serializeGameState()/deserializeGameState()`。
- **后果**：状态可被 vm 沙箱完整断言、可重放对局；代价是各系统需显式传 `state`（已接受）。

### ADR-2 · 种子化 RNG（确定性）
- **上下文**：纯规则 AI + 可测试 + 可重放，禁止不可复现的随机。
- **决定**：所有随机走 `rng.js` 的 `makeRNG(seed)`（mulberry32）；分配/产出/结算/人类入营均由其派生。
  `seed` 存于 `gameState.seed`；同类随机用「派生子种子」（如 `(seed ^ day*K)`）避免序列耦合。
- **后果**：同 seed 同结果，测试断言稳定；人类入场随机但可复现。

### ADR-3 · 模块边界与 `defer` 加载顺序（禁用 async、保序）
- **上下文**：设计硬约束要求纯前端、无构建、有序 `defer`、绝不 `async`。
- **决定**：严格按附录 A 的 13 文件顺序；Sprint 1 仅实现 8 个文件，顺序为：
  ```
  config → rng → state → factions → resource → settle → engine → ui
  ```
  **Sprint 2 在 `resource` 与 `settle` 之间插入 `production / economy`，10 文件顺序：**
  ```
  config → rng → state → factions → resource → production → economy → settle → engine → ui
  ```
  **Sprint 3 在 `economy` 与 `settle` 之间插入 `war`，11 文件顺序：**
  ```
  config → rng → state → factions → resource → production → economy → war → settle → engine → ui
  ```
  **Sprint 4 在 `resource` 之后插入 `ai / leader`（置于 `production` 之前，确保 personality 初始化早于各 system 咨询），最终恢复 13 文件顺序：**
  ```
  config → rng → state → factions → resource → ai → leader → production → economy → war → settle → engine → ui
  ```
  跨文件符号用 `var`（数据常量）+ `function`（API）暴露，全局名唯一，规避浏览器共享词法作用域的 `const` 重名冲突。
- **后果**：零打包、零运行时依赖解析；加载即就绪，`ui.js` 的 `boot()` 挂 `DOMContentLoaded`。
- **Sprint 4 接入要点（AI 行为树 + 领袖选举）**：
  - `ai.js` / `leader.js` 在调用期才引用 `economy`/`war`/`settle`（仅函数体内），故置于其之前加载无碍；各 system 的 `runAll` 内部用 `typeof ai !== 'undefined'` 守卫咨询 `ai.*`，**ai.js 缺失时（verify-s1/s2/s3 不加载）自动回退原逻辑 → 零回归**。
  - `engine.runAIDecisions` 新增 **MORNING 分支**（`leader.runAll` 选举 + `ai.decideAll('MORNING')` 背叛评估）；`endDay` 进入新一天 `MORNING` 时调用 `runMorningAI`（守卫 no-op）。
  - 决策/执行分离：`ai.js` 出 decisionJSON（produce/trade/war/betray/survive），`production/economy/war/settle` 负责执行并复用既有防重入标记。
- **阶段→系统分派约定（Sprint 2 起）**：`engine.runAIDecisions(state)` 按当前 `state.phase` 分派——
  `TRADING` 调 `production.runAll`（AI 自动产出）、
  `WAR` 调 `economy.runAll`（AI 自动挂单/接单收尾）+ `war.runAll`（AI 宣战并立即结算其战争）、
  `SETTLEMENT` 调 `war.runAll`（统一结算人类 WAR 阶段宣战的 pending 战争）；
  各系统再以 `lastProducedDay` / `aiTradeDay` / `lastWarDay` / `war.pending` 等当日标记防重入。
  **顺序关键**：战争掠夺（WAR 阶段 AI 战 / SETTLEMENT 结算人类战）早于阶段 5 `settle` 扣药，
  故「结算扣药」在掠夺之后进行（人类战在 `advancePhase(WAR→SETTLEMENT)` 的 `runAIDecisions` 中先结算，
  随后 `endDay` 的 `settleDay` 才扣药）。

### ADR-4 · 引擎为编排层（业务下沉到 system）
- **上下文**：状态机职责必须清晰，避免引擎膨胀。
- **决定**：`engine.js` 仅负责 `advance()/endDay()/endPhase()` 阶段流转、`isResolving` 置位、
  终局判定（`≤1 阵营存活` 或 `day>MAX_DAY`）、以及 `runAIDecisions()` 钩子。
  **Sprint 1 仅 `settle`（阶段5）真算**；Sprint 2 起 `runAIDecisions()` 按阶段分派
  `production.runAll`（离开生产）/ `economy.runAll`（离开贸易）。战争(war.runAll)/完整 AI 行为树(ai.decideAll)
  仍为后续冲刺接入点（空桩）。
- **后果**：业务增量不改动引擎；各 system 可独立单测。空桩保证「结束阶段」即时（<1s 同步）。

---

## 三、控制流图

```
人类操作（按钮）
   │
   ▼
endPhase()
   │
   ├─ 非 SETTLEMENT → advancePhase()：phase 前进一格
   │                      │
   │                      ▼
   │                  isResolving = true
   │                      │
   │                      ▼
   │              runAIDecisions()  ── Sprint 1：空桩(no-op)
   │                      │
   │                      ▼
   │                  isResolving = false → 重渲染
   │
   └─ SETTLEMENT   → endDay()：
                         │
                         ▼
                    settleDay()  ★ 唯一真算：扣药 → 缺口淘汰 → 刷新 requiredLife/deficit
                         │
                         ▼
                    runAIDecisions()（空桩）
                         │
                         ▼
                    isEndgame?  ── 是 ─▶ endGame()：按 Goods 占比 ÷ 存活人数 分红 → status=ENDED
                         │否
                         ▼
                    day++ → phase=MORNING → 重渲染
```

---

## 四、Sprint 1 文件清单与职责

| 文件 | 职责 | 关键导出 |
|---|---|---|
| `assets/config.js` | §3 全部默认值（单真源，全标「可调」） | `CONFIG` |
| `assets/rng.js` | 种子化 RNG + 抽样/洗牌 | `makeRNG`, `randInt`, `shuffle` |
| `assets/state.js` | `gameState` 工厂 / 日志 / 序列化 | `createGameState`, `pushLog`, `serialize/deserialize` |
| `assets/factions.js` | 13 人随机入 4 阵营（6/3/3/1）+ 注初始资源 + 人类入营 | `randomAssign`, `assignHumanFaction` |
| `assets/resource.js` | 统一 `transfer` 增减，防幽灵资源 | `transferResource`/`transfer`, `canAfford` |
| `assets/production.js` | **Sprint 2** 生产小游戏：AI 确定性产出 + 人类小游戏产出 + 行动力 | `production.runAll`, `production.humanProduce`, `production.resetDailyAP` |
| `assets/economy.js` | **Sprint 2** 交易/市场/黑队专利抽成/协议/私密交易 | `economy.runAll`, `economy.placeOrder`, `economy.executeTrade`, `economy.resolveOrders`, `economy.signAgreement` |
| `assets/settle.js` | 阶段5 扣药/淘汰骨架 + 实时奖金预期 + 终局分红 | `settleDay`, `endGame`, `factionPrizeTotal/PerPerson` |
| `assets/engine.js` | 阶段状态机 / 编排 / 终局判定 / AI 钩子空桩 | `advancePhase`, `endDay`, `endPhase`, `createEngine`, `runAIDecisions` |
| `assets/ui.js` | HUD + 4 阵营卡片 + 阶段提示 + 「结束本阶段」+ 终局页 | `boot`, `render`, `startNewGame` |
| `index.html` | 按附录 A 顺序 `defer` 加载上述 8 文件 + `style.css` | — |
| `assets/style.css` | 基础布局/卡片/进度条/终局页样式 | — |
| `tools/verify-s1.js` | vm 沙箱测试（断言见下） | — |

> 旧人生模拟器文件整体移入 `cangame/legacy/`（`index.html` / `README.md` / `assets/*` / `tools/*`），未删除，可回退。

---

## 五、可测试性约束（供 `verify-s1.js`）

- 全部逻辑走纯函数，依赖仅 `CONFIG` + `makeRNG(seed)`；无 DOM、无 `Date.now()` 副作用（人类入场种子除外，UI 层负责，不进核心逻辑）。
- `createGameState(seed)` 为确定性入口；`randomAssign(seed)` 同 seed 同结果。
- `settleDay` 的结算 RNG 由 `(seed ^ day*K)` 派生，盘面可逐日复现。
- 终局公式：`factionTotal = prizePool × (factionGoods / ΣaliveGoods)`，`perPerson = total / popAlive`。
