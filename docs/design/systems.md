# cangame v3 · 系统拆解与依赖序

> 配合 concept.md 与 numbers.md。模块文件名即 `assets/<name>.js`，按 defer 顺序加载（见 architecture）。

## 1. 系统清单与依赖序（先做上游）
| # | 系统 | 模块文件 | 一句话职责 | 依赖 |
|---|---|---|---|---|
| 1 | 配置 | `config.js` | 所有可调数值集中地 | — |
| 2 | 随机 | `rng.js` | mulberry32 种子 RNG + 派生种子 | config |
| 3 | 状态 | `state.js` | `gameState` 唯一真源工厂 + 序列化 | rng |
| 4 | 球员 | `players.js` | 属性生成、综合评分、年龄/伤病/状态 | config, rng |
| 5 | 联赛 | `league.js` | 30 队生成、分区、名册装配 | players, rng |
| 6 | 战术 | `tactics.js` | 战术维度、克制矩阵、阵容评分 | config, players |
| 7 | 比赛 | `match.js` | 回合模拟、play-by-play、数据 | config, rng, players, tactics |
| 8 | 赛季 | `season.js` | 赛程（圆桌法）、积分榜、季后赛 | config, league, match |
| 9 | 引擎 | `engine.js` | 阶段编排：下一场→模拟→更新→结算 | 上述全部 |
| 10 | 界面 | `ui.js` | 渲染 + 战术板 SVG 拖拽 + 事件 | 上述全部 |
| 11 | 转会 | `transfer.js` | 挂牌/报价/成交（Sprint 2） | players, league, finance |
| 12 | 青训 | `draft.js` | 选秀乐透/新秀生成（Sprint 2） | players, league |
| 13 | 财务 | `finance.js` | 收入/支出/工资帽（Sprint 2 接入） | config, league |

## 2. 模块边界规则
- **数据用 `var`、API 用 `function`**，避免浏览器共享词法作用域的 `const` 重声明崩溃；保持 vm 沙箱/browser 双兼容。
- `engine.js` 只做编排，业务逻辑在系统文件；UI 只读 `gameState` + 调 `engine` API。
- `gameState` 可 `JSON.stringify` 序列化即存档；所有随机走种子，保证同种子同局。

## 3. 各系统 v1 最小可玩形态
- **球员**：随机生成 10 维属性 + 位置 + 年龄 + 性格 + 合同（年限/年薪）；综合评分按位置权重。
- **联赛**：30 队（2 联盟×3 分区×5），每队 12 人名册（5 首发 + 7 替补），队名/城市虚构。
- **战术**：半场 5 点位拖拽 + 节奏/进攻倾向/防守策略/轮换频率 四选；克制矩阵给命中加成。
- **比赛**：每队 ~68 回合，逐回合判定命中/篮板/助攻/失误/抢断，输出可读 play-by-play + 盒子分。
- **赛季**：圆桌法排 82 轮（每轮每队一场）；"下一场"推进一轮，玩家队比赛可手动布阵、其余 AI；常规赛后取各联盟前 8 进季后赛（7 局 4 胜），决出总冠军。
- **财务（v1 轻量）**：每轮结算门票/赞助收入 − 工资支出；工资帽超限给警告，不强制。

## 4. 接口契约（函数级，供工程与测试对齐）
- `players.genPlayer(rng, opts)` → player
- `players.overall(p)` → number（0–99）
- `league.buildLeague(rng)` → {teams:[...], conferences, divisions}
- `tactics.counterBonus(atk, def)` → number（命中加成，含节奏/攻防克制）
- `tactics.lineupRating(team, tactics)` → {off, def, pace}
- `match.simulateGame(state, homeId, awayId, seed)` → {home, away, log:[...], winner}
- `season.buildSchedule(teams, rounds, rng)` → [{round, games:[[a,b],...]}]
- `season.standings(state)` → sorted table
- `engine.advanceRound(state)` → mutates state（模拟本轮所有比赛 + 更新积分榜 + 处理季后赛）
- `engine.newGame(seed, humanTeamId)` → gameState
