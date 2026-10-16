# 《3D UI 改造约束与风险清单》· cangame「战术板 · 篮球经理」

> 编制：程基岩（engineering-lead） · Task ENG-3D-01 · P0
> 目标：为「ui 改成 3D 设计」扫清地雷。**本轮只做结构审计与约束清单，不实现、不改任何代码文件。**
> 技术约束：纯前端 vanilla JS 单页、无构建、静态部署 GitHub Pages、零依赖（不引入 Three.js），3D 靠 CSS `transform` / `perspective` / `preserve-3d` / `backdrop-filter` 实现。

---

## 0. 审计基线（实测，非推测）

| 项 | 实测结果 |
| --- | --- |
| `node tools/verify-ui.js` | **通过 65 / 65 ✅**（写作时实测，exit 0） |
| `tools/verify-s1.js` / `tools/verify-v35.js` | vm 沙箱，**FILES 列表不含 `ui.js`**（`tools/verify-s1.js:4-5`、`tools/verify-v35.js:5-6`）→ **零 DOM 依赖，3D 改动打不挂** |
| jsdom 是否加载 `assets/style.css` | **不加载**。实测 `document.styleSheets.length === 0`（`verify-ui.js:13` 只传了 `runScripts`+`pretendToBeVisual`，未开 `resources:'usable'`）→ **纯 CSS 改动对测试链完全不可见** |
| jsdom `getBoundingClientRect()` | 恒返回全 0（实测 `#board` rect = `{0,0,0,0}`）→ 拖拽坐标换算在测试中不可验证 |
| `position:fixed` / `sticky` / `z-index` / `backdrop-filter` / `perspective` / `preserve-3d` | **`assets/style.css` 中一处都没有**（全文件 grep 为空）→ 当前是纯文档流布局，无层叠上下文历史包袱 |
| 唯一滚动容器 | `.pbp`（`style.css:102`，`max-height:240px; overflow:auto`） |
| `overflow:hidden` 出现处 | `.bar:95`、`.broadcast:149`、`.tabs:150` |
| 触 DOM 的文件 | **只有 `assets/ui.js`**（其余 15 个 asset 文件 `document./window.` 计数均为 0） |

**最重要的一条结论（决定了整个改造策略）：**
> 22 个 `.card` **全部写在 `index.html` 里**（实测 `class="card"` × 22），而 `ui.js` 模板只负责卡片**内部内容**。
> 因此：**把 3D 挂载点放在 `index.html` 的 `.card` / `.topbar` / `.nav` / `.side` / `.tabs` 上，可以做到「零 ui.js 改动」完成 80% 的 3D 化**，天然规避「有的卡片有 3D 有的没有」。
> 需要动 `ui.js` 的只有「内容层装饰」——而内容层又能用 **稳定 id 做后代选择器**（`#cups .cup-card`、`#training .mini-btn`）规避新增 class。

---

## 1. 不可动清单（测试 / 逻辑硬依赖）

### 1.1 `tools/verify-ui.js` 逐条选择器依赖表（65 条断言）

> 表内「冻结级别」：**LOCK** = 绝不可改名/删除/改数量；**COUNT** = 名字可留但数量被断言锁死；**CLASS-ONLY** = 只要 class 还在（样式随便改）。

| # | verify-ui.js 行 | 选择器 / 契约 | 断言内容 | 级别 |
| --- | --- | --- | --- | --- |
| 1 | 24 | `#team-grid` | `children.length === 42` | COUNT |
| 2 | 26 | `#team-grid` textContent | 含「东莞银行」 | LOCK |
| 3 | 29 | **`#team-grid .team-btn`** | `.click()` 触发 `startGame` | **LOCK** |
| 4 | 30 | `#screen-game` + `.hidden` | 选队后不含 `hidden` | **LOCK** |
| 5 | 32-34 | `window.G.sponsors / stadiumLevel / reservePool` | 逻辑态 | — |
| 6 | 36-37 | `window.teamById(G, G.humanTeamId)` | 全局函数必须暴露 | LOCK |
| 7 | 39 | **`#hdr .tb-team`** | 存在 | **LOCK** |
| 8 | 40-45 | `#hdr` textContent | 含 球队资金 / 球队等级 / 联赛排名 / 训练点 / 王者积分 | **LOCK** |
| 9 | 46 | **`#hdr .broadcast`** | 存在 | **LOCK** |
| 10 | 48 | **`.nav-btn`** | `length >= 12`（现 20，余量 8） | COUNT |
| 11 | 49 | **`.tab-btn`** | `length === 4` ⚠️ **严格等值，不能加第 5 个 Tab** | **COUNT** |
| 12 | 50 / 110 | **`svg.board`** | 战术板 SVG 存在（默认视图 + 换首发后仍在） | **LOCK** |
| 13 | 52 | **`#side-roster .side-roster-row`** | `=== 5`（首发） | **LOCK** |
| 14 | 53 | **`.side-tab[data-st="bench"]`** | 点击后 `.side-roster-row === 7` | **LOCK** |
| 15 | 55 | **`.side-tab[data-st="starters"]`** | 切回 | **LOCK** |
| 16 | 57 | **`.tab-btn[data-view="standings"]`** | 点击 | **LOCK** |
| 17 | 58 | `#view-standings` + `.hidden` | 不含 `hidden` | **LOCK** |
| 18 | 59 | `#standings thead th` | `=== 6`（6 列） | COUNT |
| 19 | 60 | `#standings tbody tr` | `=== 14` | COUNT |
| 20 | 62 | **`.nav-btn[data-view="standings"].active`** | `switchView` 同步高亮 → `active` class 必须保留 | **LOCK** |
| 21 | 64-65 | `.tab-btn[data-view="logs"]` → `#view-logs` | 切视图 | LOCK |
| 22 | 67-68 | `.nav-btn[data-view="training"]` → `#training tbody tr === 12` | 训练页 12 行 | COUNT |
| 23 | 69 | **`[data-train]`** | `=== 12` | **LOCK** |
| 24 | 70 | **`[data-physio]`** | `=== 12` | **LOCK** |
| 25 | 71 | **`[data-star]`** | `=== 12` ⚠️ 不能给别的元素加 `data-star` | **LOCK** |
| 26 | 73-74 | `.nav-btn[data-view="cups"]` → **`.cup-card === 4`** | 4 张杯赛卡 | COUNT |
| 27 | 75-76 | **`[data-cup-reg]`** | 点击不抛错 | **LOCK** |
| 28 | 78-79 | `.nav-btn[data-view="kings"]` → `#kings` textContent | 渲染 | LOCK |
| 29 | 80-81 | **`#kings-start`** → **`#kings-next`** | 报名后出现下一场 | **LOCK** |
| 30 | 83-84 | **`#btn-advance`** | 推进 5 轮 | **LOCK** |
| 31 | 85 | `#report` textContent 非空 | 战报 | LOCK |
| 32 | 86 | `#hdr` 含「轮」 | 顶栏轮次 | LOCK |
| 33 | 88-89 | `.nav-btn[data-view="rounds"]` → **`#round-prev tbody tr === 7`** | 上轮 7 场 | COUNT |
| 34 | 91-92 | `.nav-btn[data-view="stats"]` → `#stats tbody tr <= 12` | 技术统计 | COUNT |
| 35 | 94-95 | `[data-train]:not([disabled])` | 点击训练 | LOCK |
| 36 | 99 | `.nav-btn[data-view="tactics"]` | 回战术板 | LOCK |
| 37 | 100-101 | **`#tactic-controls select[data-k="offense"]`** | `options.length === 6` | **LOCK** |
| 38 | 103-104 | **`#tactic-controls select[data-k="defense"]`** | `options.length === 6` | **LOCK** |
| 39 | 108 | **`#lineup-controls select`** | 换首发 | **LOCK** |
| 40 | 112-113 | `.nav-btn[data-view="honors"]` → `#honors` 含「联赛冠军」 | 荣誉室 | LOCK |
| 41 | 116-119 | `.nav-btn[data-view="…"]` × 8 | **championship / transfer / manager / record / history / alliance / supreme / bet** 八个导航项必须存在 | **LOCK** |
| 42 | 122-123 | `#hdr` 含「威望」「球迷」 | 顶栏 | LOCK |
| 43 | 126-128 | **`#alliance-name`** + **`#alliance-create`** | 创建联盟（`alliance-name.value='雷霆联盟'`） | **LOCK** |
| 44 | 129 | `window.G.alliance.name === '雷霆联盟'` | 逻辑态 | — |
| 45 | 132-135 | `.nav-btn[data-view="bet"]` → **`[data-bet-h]`** | 押注 | **LOCK** |
| 46 | 138 | `window.G.bets.length === 1` | 逻辑态 | — |
| 47 | 142-145 | **`#ticket-price`** | `options.length === CONFIG.PRICE.options.length`；`change` 后 `G.finance.ticketPrice === 'high'` | **LOCK** |
| 48 | 148-149 | `.nav-btn[data-view="roster"]` → **`#roster [data-jersey]`** | `>= 0` | **LOCK** |

**`data-view` 取值全集（20 个，必须与 `#view-*` id 一一对应）**：
`tactics / training / roster / report / rounds / standings / stats / logs / cups / championship / kings / transfer / bet / finance / honors / manager / record / history / alliance / supreme`

### 1.2 `assets/ui.js` 内部逻辑依赖（不是测试依赖，但改了就白屏）

| 位置 | 选择器 / 契约 | 说明 |
| --- | --- | --- |
| `ui.js:102` | `'.nav-btn, .tab-btn'` | `switchView` 用 `b.dataset.view` 批量切 `active` |
| `ui.js:105` | **`.main .view`** | 隐藏全部视图（**后代选择器 → 中间插包裹层安全**） |
| `ui.js:106` | `#view-' + v` | 显示目标视图 |
| `ui.js:110/115/120` | `.nav-btn` / `.tab-btn` / `.side-tab` | `bindNav/bindTabs/bindSideTabs` 只在 `boot()` 绑一次 |
| `ui.js:123` | `.side-tab` + `active` | 侧页签高亮 |
| `ui.js:161/176` | `#tactic-controls select` / `#lineup-controls select` | 绑定 `onchange` |
| `ui.js:186` | `#tactic-controls select[data-k="…"]` | `q()` 读值 |
| `ui.js:189` | **`svg.board`** | `attachDrag` 入口，找不到直接 return（静默失效！） |
| `ui.js:190` | **`.token`** | 每个 token 绑 `pointerdown` |
| `ui.js:193-204` | `svg.getBoundingClientRect()` + 硬编码 `500/470` + `clamp(x,60,440)` `clamp(y,60,410)` | **拖拽坐标换算，见 §8-R7** |
| `ui.js:194` | `BOARD_POS[p.pos]` / `g.dataset.pos` / `g.dataset.id` | 位置持久化（**模块级变量，非存档，刷新重置**） |
| `ui.js:423` | **`.train-attr[data-pid="…"]`** | 训练读属性下拉 |
| `ui.js:548/552` | `#season-end` + `.hidden` | 赛季结束横幅显隐（**不在 `.view` 体系内**，不受 `switchView` 管） |
| `ui.js:604` | `#train-info-tf` | 转会页资金行（注意：与训练页 `#train-info` 是两个不同 id） |
| `ui.js:355/420/429/435/442/523/619/693/782/785` | `[data-cup-reg] [data-train] [data-physio] [data-star] [data-star-down] [data-jersey] [data-buy] [data-alliance-join] [data-bet-h] [data-bet-a2]` | 事件委托式批量绑定（每次 `renderAll` 重绑） |

### 1.3 `index.html` 结构契约（数量 / 层级冻结）

```
.app                                   (max-width:1100px, padding:24px)
├── #screen-pick.screen                (.hidden 由 renderPick 摘掉)
│   ├── h1.title
│   └── #team-grid.team-grid           → 42 × .team-btn (JS 生成)
└── #screen-game.screen.hidden         (.hidden 由 startGame 摘掉)
    ├── #hdr.topbar                    (innerHTML 全量重建，ui.js:73)
    └── .shell                          ← 三栏 grid：150px / 1fr / 220px
        ├── #nav.nav                   (20 × .nav-btn, 7 × .nav-h, #nav-team.nav-team)
        ├── main.main                  (flex column, gap:16px)
        │   ├── #tabs.tabs             (4 × .tab-btn)  ← overflow:hidden ⚠️
        │   ├── #view-*.view.hidden ×20  (每个内含 1~2 个 .card)
        │   └── #season-end.champion.hidden   ← 不在 .view 体系
        └── aside.side
            └── .card → .side-tabs (2 × .side-tab) + #side-roster
```

冻结数字：`.nav-btn` = 20（≥12）、`.tab-btn` = **4（严格）**、`.card` = 22、`#view-*` = 20、`.nav-h` = 7、`.side-tab` = 2。

---

## 2. `assets/ui.js` 模板 class 全清单（按视图函数分组）

> 图例：**★** = 跨多个视图共用（改一处必须全局同步）；**⚠** = 存在「同源不同写法」的高危分叉点。

### 2.1 分组清单

| 渲染函数 | 行 | 产出的 class（含标签） | 挂载容器 |
| --- | --- | --- | --- |
| `starHTML()` ★⚠ | 16-18 | `<span class="star">` | 被 4 处调用（406/517/540 等） |
| `renderPick()` | 28-45 | `button.team-btn`（`b.className='team-btn'`，**非 innerHTML**）、`<span class="dot">`（含**内联 `style="background:…"`**）、`<b>`、`<small>` | `#team-grid` |
| `renderTopbar()` | 65-87 | `div.tb-item` ★、`.tb-team`、`b.num` ★、`b.accent` ★、`b.star` ★、`button.btn.btn-primary#btn-advance`、`div.broadcast` | `#hdr` |
| `renderNavTeam()` | 89-92 | 无 class（纯文本 + `<br>`） | `#nav-team` |
| `courtSVG()` | 130-136 | `rect.court` / `circle.court` / `path.court` / `path.court-dim` / `line.court-dim` | 注入 svg |
| `renderBoard()` | 137-182 | `svg.board` ★（**测试锁定**）、`g.token.home`（含 SVG `transform` **属性**）、`<title>`/`<circle>`/`<text>`、`div.tc` + `<label>`+`<select>`、`div.lc` + `<label>`+`<select>` | `#board` / `#tactic-controls` / `#lineup-controls` |
| `renderReport()` | 215-237 | `p.sub` ★、`h3.sub`、`div.score-big`、`span.num` ★、`span.tag.win/.tag.lose` ★、`div.pbp` + `<div>` | `#report` |
| `renderRounds()` | 244-268 | 裸 `<table>/<thead>/<tr>/<th>/<td>`（**无 class**）、`tr.you` ★、`td.num` ★、`p.sub` ★ | `#round-prev` / `#round-next` |
| `renderStandings()` | 271-289 | 裸 table、`tr.you` ★、`span.tag.win`（升）★、`span.tag.lose`（降）★、`td.num` ★ | `#standings` |
| `renderStats()` | 292-312 | `p.sub` ★、裸 table、`td.num` ★ | `#stats` |
| `renderLogs()` | 315-321 | `div.log-line`、`p.sub` ★ | `#logs` |
| `renderCups()` | 324-362 | `div.cup-card`（**计数 4**）、`div.cup-head` ★、`span.sub` ★、`span.tag`/`.tag.win`、`button.mini-btn[data-cup-reg]` ★、`div.star` ⚠、`div.bracket-r` | `#cups` |
| `renderKings()` | 365-389 | `p.sub` ★、`b.star` ⚠、`div.cup-head` ★、`button.mini-btn#kings-start/#kings-next/#kings-claim` ★、`p.stat-note` ★ | `#kings` |
| `renderTraining()` | 392-448 | `b.num.accent` ★、`b.star` ⚠、裸 table、`td.num` ★、`span.tag.warn` ★、`select.train-attr`（**逻辑依赖**）、`button.mini-btn[data-train/data-physio/data-star/data-star-down]` ★ | `#train-info` / `#training` |
| `renderFinance()` | 451-489 | `div.sub`、`select#ticket-price`、`span.sub`、`div.fin-row` ★、`span.num`+`span.num.warn` ★、`p.sub`、`p.warn` | `#finance` |
| `renderHonors()` | 492-505 | `div.fin-row` ★、`span.num` ★、`p.sub` ★、裸 table | `#honors` |
| `renderRoster()` | 508-529 | 裸 table、`span.tag.warn/.lose/.win` ★、`button.mini-btn[data-jersey]` ★、`small.sub` ★、`td.num` ★、**`div.bar > i`（宽度走内联 style）**、`<span>`（starHTML） | `#roster` |
| `renderSideRoster()` | 532-543 | `div.side-roster-row`（**计数 5/7**）、`span.pos`、`span.ovr`、`span.tag.warn` ★、`<span>`（starHTML） | `#side-roster` |
| `renderSeasonEnd()` | 546-558 | 裸 `<h2>`、`p.sub` ★（**无 `.card` 包裹**） | `#season-end` |
| `renderChampionship()` | 561-600 | `p.sub` ★、`b`（裸）、`div.star` ⚠、`p.stat-note` ★、`button.mini-btn#champ-reg-open` ★ | `#championship` |
| `renderTransfer()` | 603-626 | `b.num.accent` ★、`p.sub` ★、裸 table、`span.star`（⚡极限）⚠、`td.num` ★、`div.bar > i`（内联宽度）、`button.mini-btn[data-buy]` ★ | `#train-info-tf` / `#transfer` |
| `renderManager()` | 629-640 | `div.fin-row` ★、`span.num` ★、`span.num.star` ⚠ | `#manager` |
| `renderRecord()` | 643-659 | `p.sub` ★、`div.fin-row` ★、`span.num` ★、`h3.sub` ★、**`ul.trophy-list > li`** | `#record` |
| `renderHistory()` | 662-670 | `p.sub` ★、裸 table、`tr.you` ★、`td.num.star` ⚠、`td.num` ★ | `#history` |
| `renderAlliance()` | 673-729 | `p.sub` ★、`div.sub` ★、`input#alliance-name`（含内联 `style="width:120px"`）、`button.mini-btn#alliance-create` ★、`h3.sub` ★、裸 table、`td.num` ★、`button.mini-btn[data-alliance-join]` ★、`div.fin-row` ★、`span.num.star` ⚠、`button.mini-btn#alliance-leave`、`span.tag.win` ★ | `#alliance` |
| `renderSupreme()` | 731-749 | `p.sub` ★、`div.star` ⚠ | `#supreme` |
| `renderBet()` | 752-788 | `p.sub` ★、裸 table、`td.num` ★、`button.mini-btn[data-bet-h]/[data-bet-a2]` ★、`span.tag.win/.tag.lose` ★、`span.sub` ★、`h3.sub` ★ | `#bet` |

### 2.2 跨视图共用度矩阵（最容易漏改的 Top 6）

| class | 出现视图数 | 出现位置（ui.js 行） |
| --- | --- | --- |
| `.sub` | **15+** | 220, 230, 247, 266, 296, 304, 320, 331, 332, 369, 464, 466, 484, 496, 516, 566, 571, 607, 611, 646, 655, 664, 668, 677, 678, 679, 735, 741, 754, 756 …（**散落式，且部分带内联 `style="margin-top:…"`**） |
| `.num` | **13+** | 77, 228, 253, 285, 307, 308, 395, 407, 408, 482, 495, 518, 605, 612, 613, 632-638, 647-652, 666, 683, 723, 762, 777 |
| `.tag`(+win/lose/warn) | **8** | 229, 281, 282, 406, 512, 513, 539, 722, 776 |
| `.mini-btn` | **9** | 334, 373, 374, 376, 412-415, 515, 593, 615, 684, 705, 763-764 |
| `.fin-row` | **5** | 482, 495, 632-638, 647-652, 701-704 |
| `.star` | **12** | ⚠ 见下表 |

### 2.3 ⚠ 头号漏改点：`.star` 的「双轨制」

`starHTML()`（`ui.js:16-18`）只覆盖 **4 处**调用（406 训练行、517 名册行、540 侧栏行），但另有 **8 处是硬编码字符串**，完全绕过该 helper：

| 写法 | 行 | 上下文 |
| --- | --- | --- |
| `starHTML(p)` | 406, 517, 540 | 表格行 / 侧栏行（`renderTraining`/`renderRoster`/`renderSideRoster`） |
| `b class="star"` | 81, 82（顶栏威望/王者积分）、369、397 | `renderTopbar` / `renderKings` / `renderTraining` |
| `div class="star"` | 337, 574, 590, 591, 744, 746 | `renderCups` / `renderChampionship` / `renderSupreme` |
| `span class="star"` | 611（⚡极限） | `renderTransfer` |

> **结论**：任何「改 `starHTML` 就完事」的方案都会漏掉 8 处，直接产生「同一页面里星星有的 3D 有的平面」。
> **对策**：**不要改 `starHTML`**，改为在 CSS 里用「作用域后代选择器」统一处理：
> `#hdr .star, #cups .star, #kings .star, #championship .star, #supreme .star, #transfer .star, #training .star, #roster .star, #side-roster .star { … }`
> 即 **零 ui.js 改动**。

### 2.4 内联 `style` 清单（CSS 打不过它们，需 `!important` 或先清理）

| 行 | 内联样式 | 冲突点 |
| --- | --- | --- |
| 38 | `style="background:<队色>"`（`.dot`） | 队色是动态数据，必须保留内联 |
| 230 | `style="margin-top:6px"` | 会覆盖 CSS 的 margin |
| 484 | `style="margin-top:10px"` | 同上 |
| 485 | `style="font-size:var(--fs-xs);margin:8px 0 0"` | 同上 |
| 518 / 613 | `style="width:<pct>%"`（`.bar > i`） | 能力条宽度，必须保留内联 |
| 678 | `style="width:120px"`（`#alliance-name`） | 3D 化时可能要改宽度 |

### 2.5 `.hidden` 的实现不可改语义

`.hidden{display:none!important}`（`style.css:26`）。测试只断言 **class 是否存在**（`classList.contains('hidden')`），不断言视觉。
**但强烈建议不要把它改成 `opacity:0` / `visibility:hidden`**——那样 20 个 `#view-*` 会同时占位，三栏布局直接塌掉。若想要「切视图淡入」，应新增一个独立动画 class，而不是改 `.hidden`。

---

## 3. `assets/style.css` 现有 class 全清单（结构 / 装饰分类）

### 3.1 结构性（改动有风险 —— 动前先跑 verify-ui + 人眼看三栏）

| 行 | 选择器 | 作用 | 风险说明 |
| --- | --- | --- | --- |
| 17 | `*{box-sizing:border-box}` | 全局盒模型 | 安全 |
| 18 | `html,body{height:100%}` | 文档级滚动 | 若改 `overflow` 会连带影响 sticky/3D |
| 26 | **`.hidden`** | `display:none!important` | 🔴 逻辑依赖（见 2.5） |
| 27 | `.app` | `max-width:1100px; margin auto; padding` | 布局容器 |
| 30-31 | **`.screen`** + `@keyframes fade` | `opacity:0→1` + `translateY(8px)→none` | 🔴 见 §8-R3/R4 |
| 34 | `.team-grid` | 选队网格 | |
| 35-37 | `.team-btn` | flex column + `transition:transform` + `:hover{translateY(-2px)}` | ⚠ 已有 transform，3D 化时注意叠加 |
| 113-115 | **`.topbar`** | flex + `flex-wrap:wrap` + border | 三栏之上的横条 |
| 116-119 | `.topbar .tb-item` / `.tb-team` | 竖排 label/value | 🔴 测试依赖 `.tb-team` |
| 120-122 | **`.shell`** | `grid-template-columns:150px minmax(0,1fr) 220px` + 两个断点（960/680） | 🔴 三栏骨架 |
| 123-124 | `.nav` | flex column | |
| 126-128 | `.nav-btn` | padding/font-size | |
| 132 | `.main` | flex column gap | |
| 133 | `.side` | flex column | |
| 137 | **`.main .view`** | `animation:fade .25s` | 🔴 `switchView` 依赖；见 §8-R4 |
| 149 | `.broadcast` | `flex-basis:100%` + **`overflow:hidden`** + `text-overflow` | ⚠ 见 §8-R1/R2 |
| 150 | **`.tabs`** | flex + **`overflow:hidden`** | 🔴 见 §8-R2 |
| 54 | `.card` | border/bg/padding/box-shadow | ✅ 22 处，3D 主战场 |
| 55 | `.card-h` | flex 标题行 | |
| 59 | `svg.board` | `width:100%; max-width:460px; height:auto; touch-action:none` | 🔴 见 §8-R7 |
| 62-67 | `.token` / `.token circle` / `.token text` | 拖拽点位 | 🔴 见 §8-R7 |
| 71-77 | `.tactic-controls` / `.tc` / `.lineup-controls` / `.lc` | grid 布局 | |
| 80-83 | `table/th/td/tbody tr` | 表格布局 | 全局裸标签选择器，3D 化时**不要**给 `table` 加 transform |
| 95-96 | `.bar` / `.bar > i` | `overflow:hidden` + 内联宽度 | 加 3D 会被压平 |
| 102 | **`.pbp`** | `max-height:240px; overflow:auto` | 🔴 唯一滚动容器，见 §8-R5 |
| 109-110 | `.fin-row` | flex 两端对齐 | |
| 134-136 | `.side-roster-row` / `.pos` / `.ovr` | flex 行 | 🔴 计数 5/7 |
| 155 | `.cup-card` | 卡片边框 | 🔴 计数 4 |
| 156-157 | `.cup-head` | flex wrap | |
| 161-163 | `.side-tabs` / `.side-tab` | flex | 🔴 `data-st` 依赖 |

### 3.2 纯装饰性（✅ 可自由改造）

`.num`(24，仅字体+tabular-nums) · `.accent/.win/.lose/.warn`(25) · `.title`(28) · `.sub`(29) · `.btn/.btn-primary/:hover`(46-48) · `.btn-ghost`(49，**未使用**) · `.card-h` 字号(55) · `.court/.court-dim`(60-61) · `.token.home circle{fill}`(65) · `.token.away`(66，**未使用**) · `.pos-label`(68，**未使用**) · `.tc label`(73) · `.tc select/.lc select`(74,77) · `.you`(84) · `.tag/.tag.win/.lose/.warn`(85-88) · `.trophy-list/li`(91-92) · `.attr-mini`(97-98，**未使用**) · `.score-big`(101) · `.pbp div:nth-child(odd){opacity:.8}`(103) · `.champion`(106-107) · `:focus-visible`(108) · `.nav-h`(125) · `.nav-btn:hover/.active`(129-130) · `.nav-team`(131) · `.mini-btn/:hover/:disabled`(141-144) · `.stat-note`(145) · `.tab-btn/:hover/.active`(151-153) · `.star`(154) · `.bracket-r`(158-159) · `.log-line`(160) · `.side-tab.active`(163)

### 3.3 死规则 / 已失效（改造时可顺手清理，零风险）

| 行 | 选择器 | 状态 |
| --- | --- | --- |
| 43-45 | `.hdr` / `.hdr .name` / `.hdr .rec` | 🔴 **死规则**：全项目无 `class="hdr"`（真实元素是 `<header id="hdr" class="topbar">`，id 与 class 错位） |
| 51-53 | `.grid2` / `.col-main` / `.col-side` | 未使用（三栏已改 `.shell`） |
| 58 | `.board-wrap` | **未被使用** —— 已是现成的 3D 包裹层空位（见 §6） |
| 92 | `.trophy-list li{background:var(--card-2)}` | 🔴 `var(--card-2)` **未定义**（`:root` 里只有 `--board/--board-2`）→ 该 background 声明无效 |
| 97-98 | `.attr-mini` | 未使用 |
| 138-140 | `.train-row` | 未使用（训练页实际用 table） |
| 66 | `.token.away` | 未使用（`renderBoard` 只产 `token home`） |
| 68 | `.pos-label` | 未使用 |
| 49 | `.btn-ghost` | 未使用 |
| — | `--shadow-1` | `docs/design/art-tokens.md:27` 定义了，但 `style.css` 里没有 |

---

## 4. `index.html` 容器层级关系（三栏）

见 §1.3 的树。补充关键点：

1. **滚动发生在文档级**（`html,body{height:100%}` 但无 `overflow` 约束，`.app` 无 `height`）→ 当前**没有任何祖先是滚动容器**，这对 3D 是利好（不用处理「3D 元素内部滚动」）。
2. `.shell` 的 grid 在 ≤960px 隐藏 `.side`、≤680px 变单列且 `.nav` 转横向 → **3D 方案必须有窄屏降级**（透视在小屏上会把内容压扁）。
3. `#hdr.topbar` 是 `.screen` 的**第一个子节点**，不是 fixed/sticky。
4. `#season-end` 是 `main` 的**最后一个子节点**，且**不在 `.view` 体系**（`switchView` 管不到它），只有 `renderSeasonEnd` 自己切 `hidden`。

---

## 5. 可自由改造区（白名单）

| 区域 | 说明 |
| --- | --- |
| `:root` **新增**变量（`--glass-*`、`--z-*`、`--elev-*`） | 只增不改现有值，零风险 |
| `.card` / `.card-h` 的全部装饰属性 | 22 处统一生效，一次改完全站 |
| `.topbar` / `.nav` / `.side` / `.tabs` 的阴影、渐变、圆角、边框 | 容器级，一次成型 |
| `.tag` / `.mini-btn` / `.btn` / `.cup-card` / `.fin-row` / `.log-line` / `.side-roster-row` / `.bar` 的**颜色与阴影** | 纯装饰，但**不改 flex/grid 属性** |
| `.court` / `.court-dim` / `.token circle` 的描边与发光 | SVG 装饰 |
| `@keyframes` / `transition` / `:hover` | 但要遵守 §8-R4 |
| 新增 `@supports` / `@media (prefers-reduced-motion)` / 断点 | 纯新增 |
| `#board::before` / `::after` 伪元素 | **零 JS 改动**的 3D 地板方案（见 §6） |
| 死规则清理（§3.3） | 建议改造前先清一遍 |

---

## 6. 战术板 `#board` 现状评估与 3D 化可行性

### 6.1 现状（先纠正一个误解）

> **「6×6」不是网格。** `ui.js:129` 注释「战术板（6攻 × 6防）」指的是 `CONFIG.TACTICS.OFFENSE`（6 项）× `DEFENSE`（6 项）的**相克矩阵**（`assets/tactics.js:16-20` 查 `CONFIG.TACTICS.COUNTER[offense + '_' + defense]`，共 36 组合），与板的渲染无关。
> **真实渲染**：一个 `<svg class="board" viewBox="0 0 500 470">` 的**半场矢量图**（`courtSVG()`：`ui.js:130-136`）——外框 rect + 篮筐 circle + 三分弧 + 罚球弧 + 中线，外加 **5 个可拖拽球员 token**（`<g class="token home" transform="translate(x,y)">` + `<circle r=15>` + `<text>` 号码）。**没有任何网格。**

坐标契约（改前必须知道）：
- viewBox `0 0 500 470`；板面 `x=20 y=20 w=460 h=430`
- 默认点位 `BOARD_POS`（`ui.js:5`）：PG(150,235) SG(250,120) SF(250,350) PF(350,160) C(350,310)
- 拖拽 clamp：`x∈[60,440]`，`y∈[60,410]`（`ui.js:197,203`）
- 映射：`clientX/Y → viewBox` 走 `svg.getBoundingClientRect()` 的 **等比缩放**（`ui.js:193-204`，硬编码 500/470）
- `attachDrag` 每次 `renderBoard` 后重绑；`BOARD_POS` 是**模块级变量，不入存档，刷新即复位**

### 6.2 三个方案对比

| 方案 | 做法 | JS 改动 | 拖拽风险 | 代价 | 建议 |
| --- | --- | --- | --- | --- | --- |
| **A. 伪元素地板（推荐）** | `#board{position:relative; perspective:900px}`，`#board::before{transform:rotateX(62deg)}` 画透视木地板 + `#board::after` 画中圈投影；**SVG 本身保持平面，浮在地板之上** | **0 行** | **无**（SVG 未变换，`getBoundingClientRect` 仍然准确） | 低（~40 行 CSS） | ✅ **首选** |
| B. 卡片倾斜 + 球场地板贴片 | 在 `#board` 外包一层 `div.board-wrap`（**CSS 已定义但没用到，`style.css:58`** → 现成钩子），包层做 `rotateX`，SVG 保持水平 | 仅 `index.html` 加 1 个 `div`（**不改 ui.js**） | 低 | 中低 | ✅ 备选 |
| C. **SVG 本体 3D 旋转** | 给 `svg.board` 加 `rotateX()` | 需重写 `attachDrag` | 🔴 **高**：① `getBoundingClientRect()` 返回的是**投影后外接矩形**，等比换算失效 → 拖拽漂移；② 需自己做透视逆变换；③ 移动端更不准 | 高 | ❌ **不要做** |

### 6.3 🔴 绝对不要做的事

**不要给 `.token` 加任何 CSS `transform`。**
`.token` 的位置靠 SVG **`transform` 属性**（`g.setAttribute('transform','translate(x,y)')`，`ui.js:198`）。CSS `transform` **属性会覆盖 SVG `transform` presentation attribute**（presentation attribute 等同于最低优先级的作者样式）。一旦 CSS 里出现 `.token{transform:translateZ(8px)}`，**5 个点位会全部塌到原点**，且拖拽后仍不恢复。
→ 想要 token 有"浮起"感，用 **`filter: drop-shadow(...)`**（SVG 安全，`style.css:62` 已有 `transition:filter` 可复用），或在 SVG 内加一个 `<ellipse>` 阴影层。

---

## 7. 改造实施路径（分阶段 · 影响面 · 回滚）

> 通用前置：**P0 建快照**（`git stash` / 复制 `index.html` + `assets/style.css` 到 `design/engineering/_bak/`，并记录 `verify-ui` 的 65/65 基线）。
> 每一步结束后必须跑三测（§9.1）。

| 阶段 | 动作 | 影响面 | 回滚 |
| --- | --- | --- | --- |
| **P1 结构包裹层** | 仅在 `index.html` 里插入 3D 舞台容器（如 `.app > .stage`、`.shell` 内的 `.stage-3d`），**不写任何 3D CSS** | 极低。`.main .view` 是**后代选择器**，中间插层不影响；`#view-*` 用 `getElementById`，不影响 | 删掉新增 div |
| **P2 Token 扩展** | 在 `:root` **只新增** `--glass-*`、`--z-1..3`、`--elev-*`，不动现有值 | 零 | 删新增行 |
| **P3 容器级 3D（主力）** | 只改 `.card` / `.topbar` / `.nav` / `.side` / `.tabs` / `.champion` 的**装饰 + 少量 `translateZ` + `box-shadow` 分层**，并在 `.stage` 上给 `perspective` | 中高（全站视觉），但 **ui.js 一行不改** | 还原 `style.css`（P0 快照） |
| **P4 内容级（可选、最难）** | 需要动 `ui.js` 模板的装饰。**优先用「稳定 id + 后代选择器」代替新增 class**（`#cups .cup-card`、`#training .mini-btn`、`#hdr .star`…），把 ui.js 改动压到 0~3 处 | 高（漏改即出现「有的有 3D 有的没有」） | 按 §2.3/§2.4 清单逐处回滚；每改一批跑一次 verify-ui |
| **P5 战术板地板** | 采用 §6 方案 A（`#board::before/::after`） | 中（仅战术板视图） | 删伪元素规则 |
| **P6 降级与无障碍** | 加 `@supports not (backdrop-filter: blur(1px))` 兜底、`-webkit-backdrop-filter`、`@media (prefers-reduced-motion: reduce)` 关 3D（复用 `style.css:16` 的既有钩子）、窄屏断点关透视 | 低 | 删媒体查询块 |
| **P7 验收 + 发布** | 跑三测 → 人工清单（§9.3）→ `python tools/deploy.py --msg="…"` | — | `git revert` |

**排序建议（这是我对主理人的核心建议）：P1 → P2 → P3 → P5 → P6 → P7，P4 能不做就不做。**
理由：P3+P5 用纯 CSS 就能拿到 80% 的「空间感 + 玻璃质感」，且完全绕开 ui.js 这个雷区；P4 是唯一会产生「局部不一致」的阶段，放到最后、且尽量用 id 作用域选择器规避。

---

## 8. 风险点与对策

### R1 · `backdrop-filter` 被祖先「Backdrop Root」掏空（**最易翻车**）

- **机理**：`backdrop-filter` 采样的是「最近的 Backdrop Root」内的已渲染内容。任何祖先带 `opacity < 1`、`filter`、`backdrop-filter`、`mask`、`mix-blend-mode`、`will-change:opacity/filter`、`contain:paint`、`transform`（部分引擎）都会**新建 Backdrop Root** → 玻璃变成「透视到一片空」，看起来就是没效果。
- **本项目的具体引爆点**：
  - `.screen{animation:fade}`（`style.css:30`）→ `@keyframes fade`（31）**`from{opacity:0}`**。进入游戏后 **头 0.3s `#screen-game` 的 opacity < 1** → 全站玻璃在这 0.3s 内失效，然后"啪"地出现 → **可见闪跳**。
  - `.main .view{animation:fade .25s}`（137）→ **每次切视图都重演一次同样的闪跳**。
  - 若 3D 化时给 `.card` 加 `opacity:.98` 做"通透感"，会**永久**破坏其内部玻璃。
- **对策**：
  1. 把 `fade` 拆成两个动画：容器用 `fade-3d`（**只改 `transform`/不改 opacity**），玻璃元素用独立 opacity 动画；或
  2. 玻璃一律挂在**动画元素之外**（例如把 `backdrop-filter` 放在 `.card` 上，而 `animation` 放在 `#view-*` 上——此时仍会被祖先 opacity 影响，所以仍需方案 1）；
  3. **禁律**：`.card` / `.topbar` / `.nav` 上不得出现 `opacity < 1`（想要通透改 `background` 的 alpha，不要改 `opacity`）。
  4. Safari 必须写 `-webkit-backdrop-filter`。

### R2 · `transform-style: preserve-3d` 被 `overflow` / `opacity` / `filter` 强制压平

- **机理**：`preserve-3d` 与「grouping property」互斥——同一元素上只要出现 `overflow != visible`、`opacity < 1`、`filter`、`clip-path`、`mask`、`mix-blend-mode`、`isolation:isolate`、`contain:paint`，`preserve-3d` 会被**强制按 `flat` 计算**。
- **本项目现有 3 处 `overflow:hidden`**：`.bar`(95)、`.broadcast`(149)、`.tabs`(150)。
  - **`.tabs`（150）最危险**：Tab 行若想做「按下去陷进去」的 3D 效果，会被自己的 `overflow:hidden` 压平；若 `.tabs` 又是某个 `preserve-3d` 父的子节点，它还会把**自己整个子树压平**。
  - **`.pbp` 的 `overflow:auto`（102）同理**：它是滚动容器，永远 flat，别指望它内部有 3D 层级。
- **对策**：
  1. `preserve-3d` **只挂在不含 overflow/opacity/filter 的纯包裹层上**（P1 新建的 `.stage-3d`）；
  2. 真正需要 3D 的叶子节点自己带 `transform: translateZ()`，不要求父级 `preserve-3d`（父级只要有 `perspective` 就能出透视效果）——**这是本项目最省事的路线：只用 `perspective` + 子节点 `translateZ`，尽量不用 `preserve-3d`**；
  3. 若必须给 `.tabs` 做效果，改为在 `.tab-btn` 上做，而不是在 `.tabs` 容器上。

### R3 · `transform` 创建新的包含块 → 破坏 `position: fixed` / `sticky`

- **现状**：`style.css` **全文件无 `position`、无 `z-index`** → 顶栏不是 fixed，当前**没有这个 bug**。
- **但改造中极可能引入**：3D 设计稿通常要求「顶栏吸附 / 悬浮」。一旦给 `#hdr` 加 `position:fixed` 或 `sticky`：
  - `.screen` 有 `animation:fade`（含 `transform`）→ 头 0.3s 内 `#hdr` 的 fixed 会以 `.screen` 为包含块 → **顶栏跳位**；动画结束后 transform 归 `none`，包含块回视口 → **再跳一次**。
  - 若给 `.app` / `body` 加 `perspective` 或 `transform`，**fixed 永久失效**（相对该祖先定位）。
  - `sticky` 则会被祖先的 `overflow:hidden` 直接废掉（sticky 的滚动容器变成那个不滚动的祖先）。
- **对策**：
  1. **顶栏继续保持文档流**（不要为了 3D 而改 fixed）；若一定要吸顶，把 `animation:fade` 从 `.screen` 上摘掉，或改成只对 `#screen-pick` 生效；
  2. **禁律**：`#screen-game`、`.app`、`.shell`、`.main` 上**不得出现** `transform` / `perspective` / `filter` / `contain`；`perspective` 只放在 P1 新建的**内层** `.stage-3d` 上，且 `#hdr` 必须在它**之外**（`#hdr` 当前是 `.shell` 的兄弟，正好安全 —— 别把它挪进 stage）；
  3. 若后续要 sticky，先确认 `.main` / `.shell` / `.app` 无 `overflow:hidden`。

### R4 · `@keyframes fade` 的 `to{transform:none}` 会吃掉 `translateZ`

- **机理**：`style.css:31` `@keyframes fade{from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none}}`。动画期间（`.screen` 0.3s / `.main .view` 0.25s）元素的 `transform` 由动画接管，**终态是 `transform:none`** —— 会把我们在 `.view` 上设的 `translateZ(8px)` 抹平，动画结束后 CSS 的 translateZ 才恢复 → **每次切视图都看到一次「先平后凸」的跳变**。
- **对策**（三选一）：
  1. 给 3D 视图改用**只含 opacity** 的动画（`@keyframes fade3d{from{opacity:0}to{opacity:1}}`），并把 `translateY` 去掉；
  2. 把 `translateZ` 挂在 `.card` 上（`.card` 自己没有 animation），而不是 `.view` 上；← **推荐，与 P3 一致**
  3. 用 `animation-fill-mode` 无法解决——终态本身就是 `none`，只能改 keyframes。

### R5 · 长表格 / 长列表在 3D 容器内的滚动与性能

- **现状**：最长的是 `#standings`（14 行 × 6 列）、`#training`（12 行 × 9 列，每行 3~4 个按钮）、`#roster`（12 行 × 8 列）、`.pbp`（≤40 行）。**当前全部靠文档级滚动，没有内部滚动容器**，规模很小，性能不是瓶颈。
- **风险来自改造动作**：若为了让三栏各自滚动而给 `.main` / `.side` 加 `max-height + overflow:auto`：
  - 立刻触发 R2（该容器被压平，`preserve-3d` 失效）；
  - 每个带 `backdrop-filter` 的卡片在滚动时都要**逐帧重采样背景** → 中低端机明显掉帧；
  - `.side` 变滚动容器后，`#side-roster` 的 sticky 页签（若加了）行为改变。
- **对策**：
  1. **保持文档级滚动**，别给三栏加内部滚动；
  2. `backdrop-filter` **限量**：只给 ≤4 个大面（`.topbar` / `.nav` / `.side > .card` / `.tabs`），**不要给 22 个 `.card` 全上真玻璃**——卡片改用「分层渐变 + `inset` 高光 + 双层 `box-shadow`」的**伪玻璃**（成本 ≈ 0，视觉接近 90%）；
  3. 滚动中禁用玻璃：`.stage-3d.scrolling .card{backdrop-filter:none}`（可选，需 JS 加/摘 class，会动 ui.js，谨慎）；
  4. 别给 `table` 或 `tbody tr` 加 `transform`（会为每行创建合成层，14~12 行尚可但没必要）；
  5. 文字容器避免非整数 `scale` / `translateZ`，否则**文字发虚**。

### R6 · `z-index` 与 `translateZ` 混用导致层级错乱

- **机理**：在同一个 3D 渲染上下文（`preserve-3d`）里，元素按**计算后的 3D 位置**排序，`z-index` 退化为「同位置时的次要判据」；而 `perspective`（非 preserve-3d）父级下，子节点仍走传统 paint 顺序 + `z-index`。两种机制混用会出现「z-index:999 的浮层被 z-index:0 的卡片盖住」。
- **本项目**：当前**零 `z-index`**，是干净的。但 3D 化必然要引入（浮起卡片、顶栏压住内容、赛季结束横幅 `#season-end`）。
- **对策**：
  1. 二选一，**不要同层混用**：要么全部用 `translateZ` 表达层级（推荐，与 3D 语义一致），要么全部用 `z-index`；
  2. 若两者必须共存，让 `z-index` 只作用于**不同 3D 上下文之间**（即 `preserve-3d` 链断开的边界），上下文内部一律用 `translateZ`；
  3. 新增 token：`--z-1:2px / --z-2:6px / --z-3:14px / --z-float:40px`，**禁止裸写魔数**；
  4. 注意 `:focus-visible{outline}`（`style.css:108`）：键盘焦点环在 3D 变换下可能被裁或错位，需人工确认。

### R7 · SVG 战术板的 3D 化会打断拖拽（**功能级风险，不是视觉风险**）

- **机理**：`attachDrag`（`ui.js:188-212`）用 `svg.getBoundingClientRect()` 做 `clientXY → viewBox` 的**等比换算**（硬编码 500/470）。一旦 `svg.board` 被施加 3D 旋转/透视，`getBoundingClientRect()` 返回的是**投影后外接矩形**，与真实布局矩形不等比 → **拖拽点位漂移、越拖越偏**。
- 次要风险：CSS `transform` 覆盖 SVG `transform` 属性 → 点位全塌到原点（§6.3）。
- **对策**：
  1. **SVG 本体不做任何 3D 变换**（采用 §6 方案 A/B）；
  2. 若未来一定要做方案 C，必须改写 `attachDrag`：改用 `svg.getScreenCTM().inverse()` + `DOMPoint.matrixTransform()` 做坐标反算（这是正确做法，且**jsdom 测不到**），并补人工用例；
  3. 保留 `touch-action:none`（`style.css:59`），它是移动端拖拽的前提。

### R8 · jsdom 测试环境的盲区

**实测结论**：`verify-ui.js` 构造的 jsdom **根本不加载 `assets/style.css`**（`document.styleSheets.length === 0`，未开 `resources:'usable'`）。因此：

| 改动类型 | 测试能否发现 |
| --- | --- |
| 纯 CSS（新增/修改规则、3D、玻璃、动画） | ❌ **完全测不到**，改坏了也全绿 |
| `index.html` 结构（加/删/改元素与 class） | ✅ 能测到（HTML 被 `readFileSync` 读进 jsdom） |
| `ui.js` 模板（class / 结构 / id / data-*） | ✅ 大部分能测到（65 条断言覆盖 48 个选择器） |
| 拖拽坐标换算 | ❌ jsdom `getBoundingClientRect()` 恒为 0，且测试不触发 `pointerdown` |
| 视觉（深度、玻璃、模糊、层级、文字清晰度） | ❌ 无渲染 |
| 性能（掉帧、合成层数量） | ❌ |

→ **必须人工看线上**（§9.3）。

### R9 · 假绿风险：jsdom 缺失时测试静默跳过

`verify-ui.js:8-9`：找不到 jsdom 就 `console.log('⚠ 无 jsdom，跳过 UI 冒烟'); process.exit(0)`。
→ **换机器 / 换环境时，UI 冒烟会「通过」但一条都没跑**。且 jsdom 路径是**硬编码绝对路径** `C:/Users/ro3ea/.workbuddy/binaries/node/workspace/node_modules/jsdom`（`verify-ui.js:5`），不可移植。
**对策**：验收时必须肉眼确认输出是 `verify-ui: 通过 65 / 65 ✅ 全部通过`，而不是 `⚠ 无 jsdom，跳过 UI 冒烟`。建议（后续工作项）把它改成缺失时 `exit 1`。

### R10 · 内联 `style` 与 3D CSS 打架

§2.4 的 6 处内联样式（特别是 `230/484/485` 的 `margin`、`678` 的 `width`）优先级高于普通 CSS 规则。3D 化调间距时若发现"改了没效果"，先查这 6 处。

### R11 · 部署白名单：新文件不会自动上线

`tools/deploy.py:34-54` 的 `PUBLISH` 列表是**逐文件白名单**。若 3D 化新增文件（如 `assets/style-3d.css`、`assets/glass.css`），**必须同步加进 `PUBLISH`**，否则 GitHub Pages 上会 404 → 线上变"没改"，而本地是好的。
**对策**：优先把 CSS 全写进现有的 `assets/style.css`（本来就在白名单里），**不新增文件**。

### R12 · 窄屏降级

`.shell` 在 ≤960px 隐藏 `.side`、≤680px 单列（`style.css:121-122`）。`perspective` 在窄屏会把内容压得极扁。
**对策**：`@media (max-width:680px){ .stage-3d{perspective:none} .card{transform:none} }`。

---

## 9. 验收方法

### 9.1 现有测试链（改造每一步都要跑）

```bash
cd C:/Users/ro3ea/WorkBuddy/作品集/cangame     # 必须在仓库根：脚本用 process.cwd() 推导 ROOT
node tools/verify-s1.js      # 逻辑层（vm 沙箱）· 与 3D 无关，用于确认没误伤逻辑
node tools/verify-v35.js     # v3.5 验收（vm 沙箱）· 与 3D 无关
node tools/verify-ui.js      # UI 冒烟（jsdom）· 唯一能测到 index.html + ui.js 的
```
- 基线：`verify-ui` **65 / 65**；`verify-s1` / `verify-v35` 见各自输出。
- ⚠ 无 `package.json`、无 npm scripts，只能手动跑。
- ⚠ 必须确认输出是 `通过 65 / 65`，不是 `⚠ 无 jsdom，跳过 UI 冒烟`（R9）。

### 9.2 建议新增的断言（改造期间）

| 新增文件 | 断言 | 目的 |
| --- | --- | --- |
| `tools/verify-3d.js`（jsdom） | ① `index.html` 必须含 `.stage-3d` 包裹层；② 20 个 `#view-*` 的祖先链上都存在 `.stage-3d`；③ `renderAll()` 后 `#cups .cup-card` / `#training .mini-btn` / `.side-roster-row` 等关键内容节点**仍在原容器内**（防模板改坏层级） | 防"加包裹层加漏" |
| 同上 | ④ 用 `getComputedStyle` 断言 `.hidden` 仍为 `display:none`（jsdom 不加载 CSS，此条只能在浏览器里做 → 降级为人工） | — |
| `tools/lint-3d.js`（静态正则，无需 jsdom） | ① `style.css` 中**同一选择器块内**不得同时出现 `transform-style:preserve-3d` 与 `overflow/pacity/filter/mask/clip-path`；② `.card`/`.topbar`/`.nav` 不得出现 `opacity:` 小于 1；③ `.token` 不得出现 `transform:`；④ `svg.board` 不得出现 `rotateX/rotateY/perspective/transform-style`；⑤ `:` 数量守恒检查（防手写 CSS 漏括号） | **把 §8 的 R2/R3/R6/R7 变成机器可查** |
| `tools/verify-ui.js` 追加 | ⑥ `#board` 内 `svg.board` 的 `getAttribute('transform')` 为 null（确保 SVG 本体没被 CSS 变换影响结构）；⑦ `renderAll` 后 `.token` 数量 === 5 | 防 R7 |

### 9.3 必须人工确认的清单（测试覆盖不到，逐条打勾）

浏览器：**Chrome（最新）+ Safari（macOS/iOS）+ 一个 Android Chrome**。每项按 1280 / 960 / 680 / 380 四个宽度看一遍。

- [ ] **闪跳**：进入游戏瞬间、每次点导航切视图，玻璃/阴影**没有**"先平后凸"或"先无模糊后有模糊"（R1 + R4）
- [ ] **顶栏**：位置正确、无跳位；若改成吸顶，滚动时行为正常（R3）
- [ ] **玻璃生效**：`.nav` / `.topbar` / `.side` 上的 `backdrop-filter` 真的有模糊（不是一片死黑/全透）（R1）
- [ ] **层级**：卡片浮起顺序正确；焦点环（Tab 键走一遍 `.tab-btn`/`.nav-btn`/`.mini-btn`）可见不被裁（R6）
- [ ] **战术板拖拽**：5 个点位可拖、拖到哪儿停在哪儿、不漂移；拖到边界被 clamp 在 `x[60,440] y[60,410]`；**换首发后板仍在**（R7）
- [ ] **战术板视觉**：地板透视方向与 SVG 半场对齐，没有"球场地板和球员不在一个平面"的割裂感
- [ ] **滚动**：长页面（积分榜 14 行 / 名册 12 行）滚动流畅；`.pbp` 内部滚动正常；无滚动条被 3D 裁掉（R5）
- [ ] **文字清晰度**：3D 变换后表格数字（`.num`）不发虚（R5）
- [ ] **窄屏**：960 / 680 断点下 3D 已降级，内容不压扁、不溢出（R12）
- [ ] **降级路径**：`prefers-reduced-motion: reduce` 下无动画无 3D（复用 `style.css:16`）；不支持 `backdrop-filter` 的浏览器（Firefox 旧版 / 或手动关）页面仍可读
- [ ] **20 个视图逐个点一遍**：尤其 `cups`(4 卡) / `training`(12 行 ×3 按钮) / `roster`(能力条) / `honors`(奖杯列表) / `season-end`（横幅，需推进到赛季结束才可见）
- [ ] **线上一致性**：`python tools/deploy.py` 推完，打开 GitHub Pages 实际地址再看一遍（R11：确认新文件没被 `PUBLISH` 白名单漏掉）

### 9.4 发布前 Checklist

1. 三测全绿，且 `verify-ui` 明确输出 `65 / 65`（不是跳过）
2. §9.3 人工清单全部打勾
3. 未新增 CSS/JS 文件（或已同步加进 `deploy.py:PUBLISH`）
4. 未改 `assets/ui.js`（若改了，逐处对照 §2.3/§2.4 复核）
5. `git status` 干净，`deploy.py --msg` 写清本次改动

---

## 10. 待确认 / 知识缺口

1. **美术侧《3D 视觉规格》尚未产出**（`design/art/3d-visual-spec.md` 当前不存在）。本清单只约束"不能碰什么"与"怎么改安全"，**不预判视觉方向**。规格出来后需回补一条映射表：规格里的每个视觉 token → 落在哪个选择器。
2. **顶栏是否要改成吸顶/悬浮**：当前 `#hdr` 是文档流。若规格要求悬浮，必须先解决 R3（`.screen` 的 fade 动画），属于结构改动，需单开一轮。
3. **`--card-2` 未定义**（`style.css:92` 引用了不存在的变量）→ 属既有小 bug，建议在 P2 顺手补进 `:root`（或删掉该声明）。已记录，等主理人授权再动。
4. **jsdom 路径硬编码 + 缺失即 exit(0)**（R9）：建议后续单独开一个工程任务把测试基建修一下（改成缺失 exit 1、路径改为 `require.resolve` 回退），不在本轮改造范围内。
5. **`BOARD_POS` 不入存档**（`ui.js:5`，模块级变量）：拖拽后的阵型刷新即丢失。若 3D 化顺带想做"阵型持久化"，是**逻辑改动**，需要走 GDD + 存档字段变更流程，不在 UI 改造范围。
6. **本轮未改动任何代码文件**（仅新建本文档）。

---

*文档结束 · ENG-3D-01 · 程基岩*
