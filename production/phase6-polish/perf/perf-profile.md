# PERF-01 · cangame 性能剖析报告

| 项 | 值 |
|---|---|
| 任务 ID | PERF-01 |
| 角色 | engineering-lead（程基岩）· 技术负责人 |
| 评审对象 | cangame「人生模拟 · 中国人生重开模拟器」Web 版 **v5.5.0** |
| 代码路径 | `C:/Users/ro3ea/WorkBuddy/作品集/cangame` |
| 线上地址 | https://wxzstudio.github.io/cangame/ |
| 剖析日期 | 2026-10-07 |
| 运行时 | Node v22.22.2 / win32 x64（桌面 V8）+ jsdom 26 |
| 是否改动源码 | **否**，纯测量与分析；`assets/` 一行未改 |
| 门控判定 | **CONCERNS**（性能可接受，但存在 3 个中高风险与 1 个安全缺陷，详见 `robustness-review.md`） |

---

## 0. TL;DR —— 一句话结论

> **cangame 的「逻辑层」完全没有性能问题，真正的成本几乎全部集中在「每点一下就把整屏 DOM 拆掉重建」的渲染习惯上，以及「每一步都同步写一次 localStorage」的存档习惯上。**
> 这两个习惯在桌面 Chrome 上感知不到（单次交互 ≈ 24 ms），但在中低端安卓 WebView 上会放大到 **100 ms 以上**，且在「人际页 + 长日志」这个最常见组合下最严重。

三条最关键的数字：

| # | 事实 | 数值 |
|---|---|---|
| 1 | 人际页（classmate tab）单次重建，**其中 `innerHTML` 赋值一项占了多少** | **11.1 ms / 11.6 ms ≈ 96 %** |
| 2 | 单次点击端到端成本（桌面 → 低端安卓估算 ×5） | **23.8 ms → ≈ 119 ms** |
| 3 | 一整局活到 80 岁，`autosave()` 会被调用多少次 | **174 次**（同步序列化 43 KB × 174） |

---

## 1. 剖析方法

### 1.1 环境与工具

纯 Node 环境，无浏览器、无 Lighthouse。选它的原因是：**本项目零构建、零依赖，8 个 `<script>` 顺序加载，逻辑层不碰 DOM**——这个结构使得「把逻辑层拉进裸 V8 context」和「把 UI 层拉进 jsdom」两种隔离称重成为可能，反而比在真实浏览器里测更干净（没有 GPU / 合成 / 插件噪声）。

```
Node v22.22.2(win32 x64)  ←  宿主
├── 裸 V8 context (vm.createContext)      → 逻辑层：编译 / 执行 / pure CPU
└── jsdom 26 (runScripts:'dangerously')   → UI 层：字符串拼接 + HTML 解析 + DOM 建树
    └── pretendToBeVisual:true            → 提供 rAF，让 UI 层能跑起来
```

依赖：`jsdom`、`@resvg/resvg-js`（在 `C:/Users/ro3ea/.workbuddy/binaries/node/workspace/node_modules`）。

### 1.2 换算口径（**重要**）

所有毫秒数都是**桌面 V8** 上测的。引用时必须换算：

| 目标设备 | 换算系数 | 说明 |
|---|---|---|
| 桌面 Chrome / Edge | ×1 | 本次基准值 |
| iPhone（近三年） | ×1.5 ~ ×2 | |
| **中低端安卓（¥1000–2000 档）** | **×3 ~ ×6** | 单核性能 + 内存带宽 + 存储 IOPS 全面落后 |
| 低端安卓 + 微信 WebView | ×5 ~ ×8 | WebView 的 localStorage 落盘尤其慢 |

本报告统一用 **×5** 作为「中低端安卓」的估算系数，并在表中单列。**这是估算不是实测**——若 phase 后续要在真机验收，需要补一次 WebView 远程调试留档（见第 6 节「未覆盖部分」）。

### 1.3 三个测量陷阱与处理办法

做这套基准的过程中踩了三个坑，都修正了；写在这里是为了让后来的人能复核：

| 陷阱 | 现象 | 处理 |
|---|---|---|
| **V8 脚本缓存污染** | 在同一进程里反复 `vm.runInContext` 同一份源码，第 2 次起会命中 code cache，冷启动被低估 20–40 %（探针 `_probe-cold.js` 实测：真冷 3.0–5.4 ms vs 复热 2.7–4.6 ms） | 每轮在源码尾部追加一条递增注释 `/*__bench_round_N__*/`，让每轮的 SourceText 都不同，强制走完整编译路径 |
| **`step()` 双形态混统计** | `step()` 有两种调用：① 只从 `queue` 弹一条待展示 item（≈ 0 成本）；② 真正「过一年」（跑全部 tick）。直接取 p50 得到 0.0008 ms 这种**假的漂亮数字** | 按是否发生 `year` 递增把样本分成「年步」和「队列弹出」两组分别统计 |
| **事件池重复计数** | `data.js` 加载末尾执行了 `EVENTS.push.apply(EVENTS, EVENTS_EXTRA / FAMILY / FAMILY2 / ERA)`，四个子数组**在加载期就被合并进 `EVENTS`**，不是独立池。早先把 `EVENTS + 4 个子数组` 相加得到 376，是同一批对象数了两遍 | 以运行时 `EVENTS.length` 为准：**241** |

### 1.4 随机性声明

游戏本身是随机投胎 + 随机事件，所以每一轮 benchmark 的人生都不一样（终龄从 37 到 105 都出现过）。所有 bench 都跑 **8 局完整人生取中位数**，单点 bench 跑 40–200 次取 p50 / p95 / max。**同一脚本两次运行之间的数字会有 ±10–20 % 抖动，属正常**；本报告引用的数字以最新一轮 `.out.txt` 为准。

---

## 2. 基准脚本清单

全部位于 `production/phase6-polish/perf/scripts/`。每个脚本跑完会把带格式的结果写到同名 `.out.txt`。

```bash
cd production/phase6-polish/perf/scripts
node boot-bench.js        # → boot-bench.out.txt
node step-bench.js        # → step-bench.out.txt
node render-bench.js      # → render-bench.out.txt
node save-bench.js        # → save-bench.out.txt
node robust-fuzz.js       # → robust-fuzz.out.txt
node coupling-probe.js    # → coupling-probe.out.txt
```

| 脚本 | 职责 | 关键测法 |
|---|---|---|
| `harness.js`（非可执行） | 公共脚手架。导出 `read / fileStats / loadVM / loadJSDOM / bench / ms / table`。`loadVM` 建裸 context 并按序灌 7 个逻辑模块；`loadJSDOM` 灌全部 8 个模块到 jsdom 并跑 `init` | `bench(name, n, fn)` 内部按轮次跑并把 ns 转 ms，输出 p50/p95/max |
| `_probe-cold.js` | **一次性诊断**。证明「同一进程重编译同一份源码会变便宜」，为上文采用的源码变异方案提供依据 | A/B：原样重编译 vs 尾部注释变异后重编译 |
| `boot-bench.js` | 首屏加载剖析：① 各文件 raw/gzip/brotli 体积；② 逐文件冷编译 / 顶层执行耗时；③ jsdom 端到端注入；④ heap 驻留增量；⑤ `data.js` 数据表盘点 | gzip/brotli 用 `zlib.gzipSync/brotliCompressSync`；编译时间与执行时间分开记（`vm.Script` 的 `runInContext` 前后各打一次 `process.hrtime.bigint()`） |
| `step-bench.js` | 逻辑层剖析：① 8 局完整人生的 `step()` 分布；② **把 18 个 tick 函数逐个包一层累加器闭包**做耗时归因；③ `pickEvents` / `matchEvent` 扫描成本；④ 存档体积随年龄增长；⑤ 序列化成本 | 插桩：读取 `fn = eval(name)`，包成 `function(...a){ t0=now(); try{return orig.apply(this,a)} finally{ACC[name]+=now()-t0} }` 再塞回全局。只能插 `function` 声明（`const` 箭头不可重赋值） |
| `render-bench.js` | UI 层剖析：① `portraitSVG()` 单次成本与产物尺寸；② `renderRelView()` 五个 tab 逐个；③ **字符串拼接 vs `innerHTML` 赋值**拆分（关键）；④ `renderJobView()`；⑤ `renderStream()` 随日志条数的增长；⑥ Memo 缓存收益实测；⑦ 端到端点击 | 拆分手法：先完整跑 `renderRelView()` 拿到结果串，再单独 bench `el.innerHTML = 已缓存串`，两者相减 = 纯字符串拼接成本 |
| `save-bench.js` | 存档剖析：① `autosave()` 调用点清单与调用来源归因；② 整局「苦役」实测（一路点到 `screen-end`）；③ 单次写入延迟；④ 三个 localStorage key 占用；⑤ 导出/导入成本；⑥ 配额写满行为 | 在 jsdom 里包装 `window.autosave`，用 `Error().stack` 解析调用来源行号做分布统计 |
| `robust-fuzz.js` | 健壮性与安全压力（A–G 七组），产出写入 `robustness-review.md` 的证据 | 见 `robustness-review.md` 第 2 节 |
| `coupling-probe.js` | 全局命名空间耦合：① 各文件顶层标识符数；② 跨文件重名；③ 依赖矩阵；④ 是否撞 window 内建；⑤ **加载顺序敏感性实测**；⑥ `data.js` 数据表利用率 | 重名：收集所有顶层名做 `Map<name, file[]>`；顺序敏感性：故意调换两个 `<script>` 后看 `VirtualConsole` 报什么；利用率：把 `resolveEvent` 换成身份收集器，跑 60 局看 `Set<ev>` 覆盖了池里多少条 |

---

## 3. 实测数据

### 3.1 资源体积

| 文件 | 原始 KB | 行数 | gzip KB | brotli KB | gzip 压缩比 |
|---|---:|---:|---:|---:|---:|
| `assets/style.css` | 26.8 | 483 | 6.5 | 5.5 | 4.14× |
| `assets/data.js` | **161.1** | 1962 | **52.6** | **43.8** | 3.06× |
| `assets/market.js` | 25.7 | 529 | 9.6 | 8.0 | 2.67× |
| `assets/engine.js` | 99.7 | 2260 | 32.9 | 26.9 | 3.03× |
| `assets/school.js` | 23.7 | 498 | 9.5 | 7.9 | 2.51× |
| `assets/career.js` | 21.8 | 492 | 6.9 | 5.7 | 3.14× |
| `assets/love.js` | 31.5 | 681 | 9.9 | 8.3 | 3.19× |
| `assets/loan.js` | 6.3 | 170 | 2.7 | 2.2 | 2.38× |
| `assets/ui.js` | 98.3 | 1914 | 29.9 | 24.4 | 3.29× |
| **合计** | **495.0** | **8989** | **160.4** | **132.7** | **3.09×** |

> GitHub Pages 自带 gzip / brotli。**线上实际传输 ≈ 133 KB（br）/ 160 KB（gzip）**，不是源码的 495 KB。
> 但两者**都在同一个 `<head>`→`<body>` 串行关键路径上**，且没有一个 `defer`。

### 3.2 冷启动

**逐文件冷编译 + 顶层执行（裸 V8，不含 DOM）**

| 文件 | KB | 编译 ms | 执行 ms | 合计 ms | ms/KB |
|---|---:|---:|---:|---:|---:|
| data.js | 161.1 | 2.97 | 1.25 | 4.22 | 0.026 |
| market.js | 25.7 | 0.42 | 0.15 | 0.57 | 0.022 |
| engine.js | 99.7 | 1.27 | 0.16 | 1.44 | 0.014 |
| school.js | 23.7 | 0.36 | 0.11 | 0.47 | 0.020 |
| career.js | 21.8 | 0.39 | 0.27 | 0.66 | 0.030 |
| love.js | 31.5 | 0.39 | 0.06 | 0.45 | 0.014 |
| loan.js | 6.4 | 0.14 | 0.04 | 0.18 | 0.028 |

**逻辑层 7 模块合计：编译 5.9 ms + 执行 2.0 ms = 8.0 ms**

**jsdom 端到端（含 HTML 解析 + DOM 构建 + UI 层 + `init()` 绑定）**

| 文件 | 注入/执行 ms |
|---|---:|
| data.js | 4.37 |
| market.js | 0.60 |
| engine.js | 1.41 |
| school.js | 0.46 |
| career.js | 0.59 |
| love.js | 0.45 |
| loan.js | 0.21 |
| ui.js | 1.39 |
| **合计 + init** | **≈ 9.5 ms** |

**关键路径图**

```
  HTML 下载+解析 ─────┐
  CSS 下载 (6.5 KB gz) ├── 并行预扫描
  8×JS 下载 ──────────┘   最慢的一项决定下限：data.js 52.6 KB gzip
        ↓
  按序执行 8 个脚本（阻塞渲染）   ← 本次实测 9.5 ms（桌面）
        ↓
  DOMContentLoaded → init() → renderTitle() → 首屏可见
```

**结论：CPU 侧（编译 + 执行）根本不是瓶颈，网络 + 串行阻塞才是。**
在 ≈400 kbps 有效带宽的弱网下，光 `data.js` 的 52.6 KB 就要 **~1.0 s**；而这段时间内页面是**纯白屏**——因为 8 个 `<script>` 没有一个 `defer`，也没有任何骨架屏。

**内存驻留**：两次独立 context 加载后 `heapUsed` 增量 ≈ **1.4 MB**（含 V8 对象头，实际纯数据更少；这是「一个 tab 只加载一次」的量级）。

### 3.3 逻辑层：`step()` 单步成本

> **注意**：`step()` 有两种形态。① 从 `queue` 弹下一条待展示 item（几乎零成本）；② 真正「过一年」：跑 `yearBase` + 全部 tick + `pickEvents`。**只有 ② 值得优化。**

| 局 | 步数 | 其中「过新年」 | 终龄 | 年步 p50 | 年步 p95 | 年步 max | 队列弹出 p50 | 全局 ms | 存档 KB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 246 | 105 | 105 | 0.162 | 0.499 | 2.462 | 0.0006 | 22.74 | 44.8 |
| 2 | 120 | 40 | 40 | 0.184 | 0.266 | 0.581 | 0.0006 | 7.60 | 32.9 |
| 3 | 217 | 89 | 89 | 0.136 | 0.219 | 0.531 | 0.0006 | 13.39 | 43.9 |
| 4 | 161 | 55 | 55 | 0.159 | 0.217 | 0.248 | 0.0005 | 8.78 | 41.5 |
| 5 | 103 | 37 | 37 | 0.147 | 0.220 | 0.221 | 0.0006 | 5.62 | 29.1 |
| 6 | 212 | 72 | 72 | 0.144 | 0.238 | 0.241 | 0.0005 | 10.76 | 45.7 |
| 7 | 226 | 79 | 79 | 0.138 | 0.224 | 0.743 | 0.0005 | 12.20 | 45.8 |
| 8 | 243 | 97 | 97 | 0.144 | 0.237 | 0.577 | 0.0005 | 14.70 | 45.6 |

- **「过一年」p50 中位 0.147 ms · p95 中位 0.237 ms · 最慢一步 2.462 ms**（最慢那步通常是某年触发了大量 `*Tick` 的连锁结算）
- **队列弹出 p50 中位 0.0006 ms** —— 纯 `shift`，完全没有优化价值
- **一整局（约 217 步 / 79 年）的 `step()` CPU 总计 ≈ 12.20 ms**

> 换算：一整局人生从头跑到死，逻辑层总共只烧 **12 ms**。乘 5（低端安卓）= 60 ms。**这条线在整个游戏生命周期里都追不上一次 `renderStream()` 的成本。**
> **结论：逻辑层不是性能问题，不要在它身上花时间。**

### 3.4 `step()` 内部归因：逐个 tick 函数

做法：把 `step()` 调用的每个 tick 包一层累加器，跑 8 局完整人生取**每局累计**的中位数。18 个目标全部插桩成功。

| fn | 调用/局 | 累计 ms/局 | µs/次 |
|---|---:|---:|---:|
| **pickEvents** | 75 | **3.787** | 50.41 |
| **marketTick** | 76 | **2.945** | 38.94 |
| **resolveEvent** | 109 | **2.932** | 26.99 |
| yearBase | 76 | 0.846 | 11.13 |
| checkAchievements | 184 | 0.769 | 4.19 |
| familyTick | 76 | 0.692 | 9.16 |
| loveTick | 76 | 0.689 | 9.11 |
| eventChoices | 109 | 0.378 | 3.48 |
| inboundTick | 76 | 0.264 | 3.49 |
| friendTick | 76 | 0.236 | 3.11 |
| illnessTick | 76 | 0.227 | 3.00 |
| offerInvestments | 75 | 0.136 | 1.82 |
| refreshClassmates | 76 | 0.135 | 1.79 |
| parentTick | 75 | 0.123 | 1.64 |
| careerTick | 76 | 0.103 | 1.36 |
| loanTick | 75 | 0.085 | 1.14 |
| scoutTick | 76 | 0.058 | 0.76 |
| settleInvestments | 76 | 0.037 | 0.49 |

**tick 累计 ≈ 14.44 ms / 整局 → 单年 0.0666 ms。**

前三名（`pickEvents` + `marketTick` + `resolveEvent`）占了 9.66 ms / 14.44 ms = **67 %**。但注意它们的绝对值：**一次 `pickEvents` 只有 50 µs**。

### 3.5 `pickEvents` / `matchEvent`：全项目唯一随数据规模线性增长的热路径

- 运行时事件池 `EVENTS.length` = **241** 条
  = 本体 106 + `EVENTS_EXTRA` 66 + `EVENTS_FAMILY` 31 + `EVENTS_FAMILY2` 28 + `EVENTS_ERA` 10（**加载期被 `push` 合并**）
- 通过 `matchEvent` 的候选：平均 **18** 条/年，峰值 **57** 条

| 操作 | p50 ms | max ms |
|---|---:|---:|
| `pickEvents(state)` @age=30 | 0.0921 | 0.2972 |
| `EVENTS` 全池 `matchEvent` 扫描 241 条 | 0.0964 | 0.2708 |

> 这是唯一一处随数据表规模线性增长的代码。当前绝对值小到可以忽略（**数十 µs 级**）。
> 触发 refactor 的阈值建议：**事件池涨到 800–1000 条**（届时单次扫描约 0.3–0.4 ms，整局累计接近 30 ms）时，再考虑按 `age` 建倒排索引 `Map<age, Event[]>`。**现在做是过早优化。**

### 3.6 渲染层（**本报告真正的重点**）

> 环境是 jsdom：**有真实 DOM API，但没有排版和绘制**。所以测到的是「字符串生成 + HTML 解析 + DOM 树构建」。
> **浏览器里还要再算一次 layout + paint，通常是这里的 1.5–3 倍。**

基准存档：`age 45 / logs 315 / 同学 12 / 朋友 4 / 恋人 8`

#### 3.6.1 `portraitSVG()` — 头像

| 名字 | p50 ms | p95 ms |
|---|---:|---:|
| 张伟 | 0.0262 | 0.0553 |
| 李静 | 0.0238 | 0.0427 |
| 王秀英 | 0.0237 | 0.0330 |
| 刘建国 | 0.0246 | 0.0447 |
| 陈思远 | 0.0260 | 0.0373 |
| 杨小米 | 0.0236 | 0.0391 |
| 赵铁柱 | 0.0260 | 0.0374 |
| 周晓琳 | 0.0245 | 0.0363 |

- 单个头像：**4.95 KB 字符串 · 63 个 SVG 元素**
- 单次 `portraitSVG` p50 ≈ **23.5 µs**，p95 ≈ **25.1 µs**
- 20 个头像累积：**0.470 ms**（字符串生成）+ **99 KB HTML** 交给浏览器解析 → **1260 个 DOM 节点**

#### 3.6.2 `renderRelView()` — 人际页五个 tab

| tab | p50 ms | p95 ms | max ms | HTML KB | DOM 节点 | 头像数 |
|---|---:|---:|---:|---:|---:|---:|
| family | 4.161 | 8.460 | 8.776 | 19.6 | 250 | 3 |
| **classmate** | **11.395** | 12.737 | 14.424 | **68.3** | **791** | **12** |
| friends | 3.295 | 6.067 | 9.155 | 22.1 | 263 | 4 |
| love | 8.924 | 9.680 | 9.780 | 52.3 | 601 | 8 |
| good | 1.206 | 2.788 | 2.796 | 3.8 | 65 | 0 |

**最重的 tab 是「同学」（classmate）**——它是默认通讯录里人最多的那栏，而且每个人一张带头像的卡片。

#### 3.6.3 【决定性拆分】字符串拼接 vs `innerHTML` 赋值

以最重的 classmate tab 为例：

| 阶段 | p50 ms | 占比 |
|---|---:|---:|
| `renderRelView()` 全量（拼串 + 赋值） | **11.578** | 100 % |
| 仅 `el.innerHTML = 已有字符串` | **11.121** | **96.1 %** |
| （相减）纯字符串拼接 | 0.457 | 3.9 % |

> **这是整份报告最重要的一张表。**
> 它推翻了「优化方向 = 让字符串拼得更快」的直觉。真相是：**成本几乎全在浏览器把 HTML 文本解析成 DOM 树、销毁旧树这个过程里**。
> 直接后果：**只做字符串缓存（Memo 掉 `portraitSVG`）收益有限**，因为省下的只是那 3.9 %。
> 真正要省的是「**别每次都整页重建**」。

#### 3.6.4 `renderJobView()` — 工作页

| p50 ms | p95 ms | max ms | HTML KB | DOM 节点 |
|---:|---:|---:|---:|---:|
| 5.052 | 6.699 | 6.946 | 14.7 | 351 |

#### 3.6.5 `renderStream()` — **每点一下就把整份日志重绘一遍**

| 日志条数 | p50 ms | p95 ms | HTML KB | DOM 节点 |
|---:|---:|---:|---:|---:|
| 50 | 1.370 | 2.585 | 5.3 | 100 |
| 100 | 2.554 | 4.015 | 9.6 | 200 |
| 200 | 5.231 | 6.848 | 18.2 | 400 |
| **400（上限）** | **10.873** | 13.437 | **35.4** | **800** |

`pushLog()` 在 `assets/engine.js:854` 把日志截断到 400 条（`if (state.log.length > 400) state.log.shift();`），所以上限是 **35.4 KB / 800 节点**。

> **每点一下都要把这 800 个节点全部销毁再重建**，而屏幕上实际只多了 1–3 行。

#### 3.6.6 `afterAct()` —— 一次点击到底做了什么

`assets/ui.js:1115`：

```js
function afterAct(msg) {
  if (msg) toast(msg);
  renderStats();
  renderStream();                                  // ← 重建 800 节点
  if (GAME_VIEW === 'rel') renderRelView();        // ← 再重建 791 节点
  if (GAME_VIEW === 'job') renderJobView();        // ← 或再重建 351 节点
  autosave();                                      // ← 同步序列化 43 KB 并落盘
}
```

**端到端实测（在人际页点一次「聊天」）**

| 场景 | p50 ms | p95 ms |
|---|---:|---:|
| `renderStats` + `renderStream` + `renderRelView` + `autosave` | **23.767** | 27.754 |
| **中低端安卓估算（×5）** | **≈ 118.8 ms** | ≈ 138.8 ms |

好消息：`socialActAll`（「一键和所有人叙一遍」）是**引擎侧批量执行，只触发一次 `afterAct`**——这个设计是对的，没有 N 倍放大。坏消息：**用户连点就是 N 倍**，连点 5 次在低端机上就是 ~600 ms 的卡顿。

#### 3.6.7 Memo 缓存的实测收益（**必须与「不整页重建」配对才能兑现**）

| 场景 | p50 ms |
|---|---:|
| 20 个头像 · 每次都重算（现状） | 0.466 |
| 20 个头像 · 命中缓存（改造后） | 0.0083 |
| **节省** | **0.458 ms（56×）** |

全通讯录头像全缓存后的常驻内存：**16 个 × ≈5.4 KB ≈ 86 KB**（可接受）。

> 再强调一次 3.6.3 的结论：56× 是**字符串生成这一段**的 56×。放到 11.4 ms 的整页重建里，只占 **4 %**。
> **Memo 是「必要但不充分」**——它是「不整页重建」改造的前置依赖（因为局部更新时要反复取同一个头像），而不是独立的收益项。

### 3.7 存档 / localStorage

#### 3.7.1 `autosave()` 的调用频率

源码里 `autosave()` 有 **11 个调用点**（ui.js 行 46, 275, 1121, 1400, 1431, 1481, 1520, 1535, 1542, 1825, 1878）。

**整局苦役实测**（一路点到人生结束 / 135 次点击 / 36 岁）：
- `autosave()` 被调用 **174 次**
- 平均 **1.29 次存档 / 次点击**

调用来源分布：

| 来源 | 次数 |
|---|---:|
| `renderItem` (ui.js:1431) | 89 |
| `doChoose` (ui.js:1520) | 66 |
| `renderItem` (ui.js:1400) | 10 |
| `investChoice` (ui.js:1535) | 6 |
| `doChooseExam` (ui.js:1481) | 2 |
| `finishGame` (ui.js:1542) | 1 |

> `renderItem` 内部也调了一次 `autosave()`（ui.js:1431），意味着**「渲染一次卡牌」不只是渲染，它还顺手做了一次全量序列化**。渲染与持久化这两个关注点在这条路径上没有分开。

#### 3.7.2 单次写入延迟（**jsdom 是纯内存，这个数字偏乐观**）

样本：80 岁存档，44.5 KB

| 操作 | p50 ms | p95 ms |
|---|---:|---:|
| `JSON.stringify(STATE)` | 0.141 | 0.183 |
| `localStorage.setItem` | 0.001 | 0.002 |
| `localStorage.getItem` | 0.001 | 0.002 |
| `JSON.parse(读回)` | 0.153 | 0.192 |
| **`autosave()` 全流程** | **0.163** | 0.203 |

> jsdom 的 localStorage 就是一个内存 map：所以 **`setItem` 只要 0.001 ms。**
> **真实浏览器的 `setItem` 会把 43 KB 同步刷到磁盘**，在低端 Android WebView 上实测常见 **3–15 ms**。这部分 jsdom 完全测不出来，必须用真机补。

#### 3.7.3 存档体积随年龄增长

| 年龄 | 存档 KB | log 条数 | 同学 | 前任 | 子女 |
|---|---:|---:|---:|---:|---:|
| 0s | 3.8 | 8 | 0 | 0 | 0 |
| 10s | 8.5 | 51 | 4 | 0 | 0 |
| 20s | 17.9 | 125 | 12 | 0 | 0 |
| 30s | 24.0 | 192 | 12 | 0 | 0 |
| 40s | 29.7 | 247 | 12 | 0 | 0 |
| 50s | 34.2 | 298 | 12 | 0 | 0 |
| 60s | 39.3 | 357 | 12 | 0 | 0 |
| 70s | 43.2 | 400 | 12 | 0 | 0 |
| 80s | 43.4 | 400 | 12 | 0 | 0 |

> 本轮 `step-bench` 第 4 节因随机早逝只采到 20s（17.9 KB）；上表为该节的完整曲线（另一轮长命样本），两轮在重合区一致。
> **存档峰值 ≈ 43–45 KB。localStorage 配额通常 5–10 MB → 占用率 < 1 %，配额完全不是风险点；写入频率才是。**

#### 3.7.4 三个 localStorage key 的常驻占用

| key | 占用 KB |
|---|---:|
| `cangame_autosave_v1` | 43.0 |
| **合计** | **43.0** |

（另有 `cangame_slots_v1`、`cangame_pref_v1` 两个 key 在本次样本里为空）

#### 3.7.5 导出 / 导入存档码

| 操作 | p50 ms | 输出 KB |
|---|---:|---:|
| `btoa(unescape(encodeURIComponent(JSON)))` | 1.013 | 85.4 |

> `escape` / `unescape` 是 Annex B 遗留 API，已废弃，且依赖非标准的 `%uXXXX` 扩展处理 > U+FFFF 字符。详见健壮性报告 R-08。

---

## 4. 热点排序

按「**用户在真实设备上能感知到的卡顿贡献**」排序，而不是按绝对毫秒数排——这样才能分清「纸面上大但感知不到」和「纸面上小但天天撞」的区别。

| 排名 | 热点 | 桌面 ms/次 | 低端安卓估算 ms | 触发频率 | 感知度 | 建议 |
|---:|---|---:|---:|---|---|---|
| **H-1** | `renderStream()` 全量重建 800 节点 | 10.9 | **≈ 55** | **每次点击 1 次** | ★★★★★ | 增量 append |
| **H-2** | `renderRelView()` 全量重建（最重 tab 791 节点） | 11.4 | **≈ 57** | 每次「人际」页操作 1 次 | ★★★★★ | 局部更新 + 事件委托 |
| **H-3** | `autosave()` 同步写 43 KB × 174 次/局 | 0.16（jsdom）<br>**3–15（真机）** | **≈ 15–75** | **每次点击 1.29 次** | ★★★★☆ | 节流 + 脏标记 |
| **H-4** | `renderJobView()` 全量重建 | 5.1 | ≈ 26 | 每次「工作」页操作 | ★★☆☆☆ | 局部更新 |
| **H-5** | 首屏白屏（8 个无 `defer` 的 `<script>`） | — | **弱网 ≈ 1000+** | 每次冷开 | ★★★★☆ | 内联骨架屏 + `defer` |
| H-6 | `portraitSVG()` 每次重算 | 0.024 | ≈ 0.12 | 每次重绘 × 人数 | ★☆☆☆☆ | Memo（是 H-2 的前置） |
| H-7 | `pickEvents` 全池扫描 241 条 | 0.092 | ≈ 0.46 | 每年 1 次 | ☆☆☆☆☆ | **现在不做**，阈值 800 条 |
| H-8 | `step()` 整局 CPU | 12.2 / 整局 | ≈ 61 / 整局 | 一次 | ☆☆☆☆☆ | **不做，不是瓶颈** |

**一句话总结排列次序的含义**：H-1 + H-2 + H-3 加起来就是「每点一下就要付 ~120–190 ms（低端安卓）」。H-6 到 H-8 加起来的总量还不到它们的 1 %。

---

## 5. 方法学局限（读数字前必须知道）

| # | 局限 | 影响方向 | 补偿方式 |
|---|---|---|---|
| L-1 | jsdom **无 layout / paint** | **低估**真机渲染成本 1.5–3× | ×5 的综合系数里已粗估；但这是「模型推测」，仍需在真机 Performance 面板上复核一次 |
| L-2 | jsdom localStorage 是**内存 map** | **大幅低估**写入成本（0.001 ms vs 真机 3–15 ms） | 已单独标注，标记为「必须真机补测」 |
| L-3 | 没有真实网络层（无 DNS / TLS / CDN） | 首屏**只有 CPU 侧**，无 RTT 数据 | 用 band width 除法给理论下限，标注为估算 |
| L-4 | 桌面 x64 V8，和移动端 ARM JIT 不同 | 绝对值不可直接套 | 统一用 ×5 换算区间，并在 H 表标注「估算」 |
| L-5 | 随机人生导致样本差异大 | ±10–20 % 抖动 | 多局取中位 + p95/max 同时给出 |
| L-6 | 未测移动端 Safari / 微信 WebView | iOS 平台策略未知 | **列为待补，见第 6 节** |

---

## 6. 未覆盖 / 待补的部分（诚实声明）

这几项本次**没有做**，但它们确实会影响最终结论，建议在 Phase 6 收尾或真机验收阶段补：

1. **真机 WebView 远程调试**：用 Android Studio 的 WebView DevTools 或微信开发者工具，实拍一次「人际页连点 10 次」的 Performance 面板，验证 H-1/H-2/H-3 的 ×5 估算是否成立，特别是 `localStorage.setItem` 的真实延迟。
2. **Lighthouse / WebPageTest**：本次没有跑。建议在真实 GitHub Pages URL 上补一次 Moto G4 档位的 Lighthouse，拿到 FCP / LCP / TBT 的官方口径。
3. **iOS Safari 行为**：隐私模式下的 localStorage 策略与安卓不同，R-02/R-03 需要双端覆盖。
4. **`scroll` 性能**：`#stream` 每次 render 后都执行 `box.scrollTop = box.scrollHeight`（ui.js:1349），会强制同步布局（forced reflow）。本次未单独测这条，但它大概率是「每次点击后的第二笔隐性开销」。建议在真机 Performance 面板里看 `Recalculate Style` / `Layout` 是否出现异常长条。
5. **CSS containment 与选择器匹配**：`#stream` / `#view-rel` 这两个容器目前没有 `contain: content` / `content-visibility`，每次重建都会把 reflow 范围扩散到整个 `.stage`。本次只看 JS/CSS 体积，**没有测选择器匹配与样式重算开销**——如果第 4 条的 reflow 确实很长，先试给 `#view-rel` 加 `contain: content`，成本极低。

---

## 7. 决定优化空间的架构事实（来自 `coupling-probe.js`）

`coupling-probe.js` 的输出里有一条很重要的**正面结论**：依赖矩阵显示 `ui.js` 是**唯一的消费者**，逻辑层之间几乎单向依赖 `data.js`。

```
使用方   | data | market | engine | school | career | love | loan | ui
-------+------+--------+--------+--------+--------+------+------+---
data   |  —   | 3      | 1      | 0      | 1      | 0    | 0    | 0
market | 0    | —      | 5      | 0      | 0      | 0    | 0    | 0
engine | 22   | 4      | —      | 7      | 6      | 7    | 1    | 0
school | 1    | 0      | 9      | —      | 0      | 1    | 0    | 0
career | 0    | 0      | 7      | 1      | —      | 0    | 0    | 0
love   | 0    | 1      | 11     | 0      | 0      | —    | 0    | 0
loan   | 1    | 2      | 5      | 0      | 1      | 0    | —    | 0
ui     | 12   | 23     | 36     | 12     | 5      | 19   | 5    | —
```

（读法：数字 = 该文件引用了对方文件声明的多少个符号）

**这是非常有利的结构**——它意味着渲染层的改造可以完全在 `ui.js` 里完成，**不需要动任何一行逻辑层代码**，因此对数据/玩法零风险。这也是下一份文档 `optimization-plan.md` 敢把 Top-3 全部放在 `ui.js` 内的依据。

---

## 附：产物清单

| 文件 | 内容 |
|---|---|
| `scripts/harness.js` | 公共基准脚手架 |
| `scripts/_probe-cold.js` | 冷启动测量正确性诊断 |
| `scripts/boot-bench.js` → `.out.txt` | 首屏加载 |
| `scripts/step-bench.js` → `.out.txt` | 逻辑层 / tick 归因 |
| `scripts/render-bench.js` → `.out.txt` | UI 层 / 渲染剖析 |
| `scripts/save-bench.js` → `.out.txt` | 存档 / localStorage |
| `scripts/robust-fuzz.js` → `.out.txt` | 健壮性压力（证据给 `robustness-review.md`） |
| `scripts/coupling-probe.js` → `.out.txt` | 命名空间耦合 / 数据利用率 |
