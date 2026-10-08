# PERF-01 · cangame 优化方案

| 项 | 值 |
|---|---|
| 任务 ID | PERF-01 |
| 角色 | engineering-lead（程基岩）· 技术负责人 |
| 上游依据 | `perf-profile.md`（实测数据）、`robustness-review.md`（健壮性缺陷） |
| 日期 | 2026-10-07 |
| 是否改动源码 | **否**，本文件为方案，**未落地任何一行 `assets/` 代码** |
| 修改 `assets/` 前 | 需主理人明确授权；每条改动都应在独立分支上做，并配新一轮 `render-bench` / `save-bench` 回归 |

---

## 0. 决策摘要

### 0.1 先看结论：钱要花在哪

`perf-profile.md` 第 3.6.3 节那张拆分表决定了整份方案的方向：

| 阶段（classmate tab） | p50 ms | 占比 |
|---|---:|---:|
| `renderRelView()` 全量 | 11.578 | 100 % |
| 仅 `innerHTML =` 赋值 | 11.121 | **96.1 %** |
| 纯字符串拼接 | 0.457 | 3.9 % |

**因此：任何「让字符串拼得更快」的优化（Memo、缓存模板串、复用 builder）单独做，天花板都只有 4 %。**
正确的方向只有一个——**减少交给浏览器的 HTML 体量，以及减少「整棵树销毁重建」的次数。**

### 0.2 真正的杠杆在 DOM 体量里，不在字符串拼得多快

把 classmate tab 的 68.3 KB HTML 拆开看：12 个头像 × 4.95 KB `portraitSVG` 字符串 = **59.4 KB**，占 **87 %**。

也就是说，人际页慢的根因不是「渲染逻辑写得不好」，而是**每个头像都是一份 5 KB 的内联 SVG 文本，被塞进了 innerHTML**。这件事同时放大了三处成本：

1. 字符串拼接变长（0.47 ms）
2. HTML 解析输入变长（11.1 ms ← **大头**）
3. DOM 节点数从 ~200 膨胀到 ~791

**所以优先级最高的动作是「把头像从 per-card 内联 SVG，变成可复用的 SVG 资源」。** 它一次命中上面三处。

### 0.3 优先级矩阵

| 编号 | 动作 | 预期收益（桌面单次点击） | 需要构建？ | 优先级 |
|---|---|---|---|---|
| **O-01** | `renderStream()` 增量追加 | **−10.5 ms** | **否** | **P0** |
| **O-02** | 头像：Memo + SVG `<symbol>`/`<use>` 化 | **−8 ~ −9 ms**（人际页） | **否** | **P0** |
| **O-03** | `autosave()` 节流 + 脏标记 | **−0.16 ms（桌面）/ −3~15 ms（真机）**，且大幅减少 IOPS | **否** | **P0** |
| O-04 | `esc()` 补齐引号转义（安全） | 非性能项 | 否 | **P0（安全）** |
| O-05 | `renderRelView` / `renderJobView` 局部刷新 | −3 ~ −5 ms | 否 | P1 |
| O-06 | 首屏：`<script defer>` + 内联骨架 + 提前注册崩溃兜底 | FCP 提前数百 ms ~ 1 s（弱网） | 否 | P1 |
| O-07 | `lsSet()` 失败可见化 | 非性能项，防存档静默丢失 | 否 | P0（健壮性） |
| O-08 | `migrateState()` 补 `log` / `flags` 兜底 | 防旧存档白屏 | 否 | P0（健壮性） |
| O-09 | 数值兜底，禁止 NaN / Infinity 进 UI | 健壮性 | 否 | P1 |
| O-10 | `btnRestart` 的 `localStorage.removeItem` 包 try | 健壮性 | 否 | P1 |
| O-11 | 替换 `escape` / `unescape` | 健壮性 / 未来兼容 | 否 | P2 |
| O-12 | `SAVE_VERSION` 真正参与迁移判断 | 健壮性 | 否 | P2 |
| O-13 | `#view-rel` 加 `contain: content` 试探 | 可能 −1 ~ −3 ms | 否 | P2（低成本试） |
| **S-01** | 引入压缩构建（terser / esbuild minify） | 传输 −25 ~ −30 %（br 132.7 → ~95 KB） | **是** | P2（结构性） |
| **S-02** | `data.js` 拆分 + 懒加载 | 首屏少传 ~40 KB br | **是，且与小程序构建脚本冲突** | **不建议** |
| **S-03** | 引入 VDOM / preact 接管渲染 | 未知且高风险 | 是 | **不建议** |
| **S-04** | `pickEvents` 按 age 建倒排索引 | 当前 ~0（过早优化） | 否 | **暂缓**（阈值 800 条） |

### 0.4 组合收益测算（O-01 + O-02 + O-03 全做）

| 阶段 | 桌面 p50 | 低端安卓估算（×5） |
|---|---:|---:|
| 现状 | 23.77 ms | ≈ 119 ms |
| + O-01（流增量） | ≈ 13.3 ms | ≈ 67 ms |
| + O-02（头像 sprite） | ≈ 5 ~ 6 ms | ≈ 25 ~ 30 ms |
| + O-03（存档节流） | ≈ 5 ms（桌面）<br>**真机再省 3–15 ms × 1.29 次/点击** | ≈ 15 ~ 25 ms |

> 目标：把单次点击压到 **30 ms 以内（低端安卓）**，也就是稳稳在一帧预算（16.7 ms × 2）之内的体感。

---

## 1. 一个必须先讲清楚的前置约束：Web 与小程序共享逻辑层

在逐条给方案之前，必须先把这条约束放在最前面，**否则任何改到 `engine.js` 等逻辑层文件的建议都可能顺带把小程序搞挂**。

只读核对了 `cangame-mp`（**未做任何修改**），结论如下：

`cangame-mp/tools/build-engine.js` 是一个**构建期拼接器**：

```js
/**
 * 把 Web 版的 7 个纯逻辑模块拼成小程序可用的单一模块，并自动生成导出表。
 * 源：cangame/assets/{data.js,market.js,engine.js,school.js,career.js,love.js,loan.js}
 * 前提：这 7 个模块不能碰 DOM / localStorage（已核验为 0 依赖）。
 * 顺序敏感：data → market → engine → school → career → love → loan。
 */
```

它把 **7 个逻辑层文件原样拼成 `cangame-mp/engine/bundle.js`**（实测 383 KB），并自动生成导出表。

**因此改动分为两类：**

| 改动范围 | 影响的端 | 落地后必须做什么 |
|---|---|---|
| `assets/ui.js`、`index.html`、`assets/style.css` | **仅 Web** | 无 |
| `assets/data.js`、`market.js`、`engine.js`、`school.js`、`career.js`、`love.js`、`loan.js` | **Web + 小程序** | **必须跑一句 `node tools/build-engine.js` 重新生成 `engine/bundle.js`** |
| **新增 / 删除 / 重命名任何一个逻辑层文件** | **会直接打断小程序的构建** | `build-engine.js` 写死了这 7 个文件名和顺序，新增的文件不会被拼进去 → 小程序运行时 `ReferenceError` |

**时间戳核对（当前状态）**

```
cangame/assets/loan.js     10-06 12:16
cangame/assets/market.js   10-06 12:16
cangame/assets/school.js   10-07 10:17
cangame/assets/data.js     10-07 10:22
cangame/assets/engine.js   10-07 13:02
cangame/assets/career.js   10-07 13:03
cangame/assets/love.js     10-07 13:29
-------------------------------------------- ← 逻辑层最后一次修改
cangame-mp/engine/bundle.js  10-07 13:38      ← 目前是同步的 ✓
cangame/assets/ui.js         10-07 13:43      ← Web 专属，不影响 bundle
```

> **目前 bundle 与源是同步的**（13:38 > 13:29）。但注意 `ui.js` 在 13:43 又被改过——它是 Web 专属，不影响 bundle，这条只是说明「同步状态会漂移」。
> **建议把 `node tools/build-engine.js` 写进 CI 或发布 checklist**，否则很容易出现「Web 版改了一行事件，小程序还停在旧数据」这种难查的差异。

**本方案的连带影响标注约定**：每条建议下方都有 `【连带影响】` 一行，取值仅为
`仅 Web` / `Web + 小程序（需重跑 build-engine.js）` / `会打断小程序构建（禁止）` 三选一。

---

## 2. A 组：不改构建步骤就能做

### O-01 · `renderStream()` 改为增量追加

| 项 | 值 |
|---|---|
| 优先级 | **P0** |
| 需要构建 | **否** |
| 落地成本 | 约 40 行，单个函数，**不改任何其他文件** |
| 风险 | 低（有全量重建兜底路径） |

#### 问题

`assets/ui.js:1343`：

```js
function renderStream() {
  const box = $('stream');
  box.innerHTML = STATE.log.map(l => {
    const cls = 'line ' + (l.type || 'story');
    return `<div class="${cls}"><span class="y">${l.year} 年 ${l.age}岁</span>${esc(l.text)}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}
```

每次调用都把 `#stream` 的整棵树推倒重建。`pushLog` 会把日志截断到 400 条（`engine.js:854`），所以稳定态是 **35.4 KB HTML / 800 个 DOM 节点 / 10.87 ms**。

而每次 `afterAct()` 其实只新增 **1–3 行**。

#### 现状证据

`perf-profile.md` §3.6.5：`renderStream()` @400 条 = **p50 10.873 ms**，占端到端单次点击（23.767 ms）的 **45.7 %**。

#### 改法

思路：**不要去 diff 日志内容，用对象引用做 diff。** 每行 DIV 记住自己是从哪个 log 对象生成的（`el._src = l`），渲染时从尾部往前比对引用，找到仍然连续的那一段，只补差额。这样「尾部追加」和「头部被 shift 掉」两种情况统一处理，且不需要动 `engine.js` 一行。

```js
/* ---- 增量版 renderStream（替换原函数，ui.js 内自足） ---- */
let _sBox = null;

function makeLine(l) {
  const d = document.createElement('div');
  d.className = 'line ' + (l.type || 'story');
  const y = document.createElement('span');
  y.className = 'y';
  y.textContent = l.year + ' 年 ' + l.age + '岁';
  d.appendChild(y);
  d.appendChild(document.createTextNode(l.text));   // textContent 天然免疫注入，无需 esc()
  d._src = l;                                       // ← 关键：记住来源对象
  return d;
}

function renderStream() {
  const box = $('stream');
  if (box !== _sBox) { _sBox = box; if (box) box._full = true; }
  const log = STATE.log, n = log.length;

  // 从尾部逆向比对引用，找出「仍然有效」的连续后缀长度
  let keep = 0;
  if (!box._full) {
    const kids = box.children;
    while (keep < kids.length && keep < n &&
           kids[kids.length - 1 - keep]._src === log[n - 1 - keep]) keep++;
  }

  if (keep === 0) {
    // 兜底全量：首次渲染 / DOM 被外部改过 / 引用全不匹配
    box.textContent = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) frag.appendChild(makeLine(log[i]));
    box.appendChild(frag);
  } else {
    // 头部：删掉被 shift 出去的那些
    for (let d = box.children.length - keep; d > 0; d--) box.removeChild(box.firstChild);
    // 尾部：只 append 新增
    const frag = document.createDocumentFragment();
    for (let i = keep; i < n; i++) frag.appendChild(makeLine(log[i]));
    box.appendChild(frag);
  }
  box._full = false;
  box.scrollTop = box.scrollHeight;
}
```

配套（可选，很便宜）：在任何「人生重开 / 读档 / 导入」这类会整体换掉 `STATE.log` 的地方置一次 `box._full = true`，避免白白比对一次 400 次引用（其实也不贵）。

#### 预期收益

| 指标 | 现状 | 改造后 |
|---|---|---|
| `renderStream()` @400 条 | 10.873 ms | **≈ 0.1 ~ 0.4 ms**（只创建 1–3 个节点 + 一次 `appendChild`） |
| 单次点击端到端 | 23.767 ms | ≈ 13.3 ms |
| 低端安卓估算 | ≈ 119 ms | ≈ 67 ms |

> **顺带收获**：改成 `createTextNode` 之后，日志文本不再需要 `esc()` 转义（`textContent` 天然安全），同时也**顺手消掉了一处潜在的注入面**。

#### 风险与缓解

| 风险 | 缓解 |
|---|---|
| `_src` 引用比对在极端情况下全不匹配 → 退化全量 | 已设计兜底路径，最坏等于现状，不会更差 |
| 外部代码（如 `innerHTML` 直接写 `#stream`）绕过 | 全项目只有这一处写 `#stream`，已 grep 确认 |
| 滚动位置 | 保留原 `scrollTop = scrollHeight` 行为，视觉不变 |

#### 【连带影响】**仅 Web**（改的是 `ui.js`，小程序 bundle 不含 `ui.js`）

---

### O-02 · 头像：Memo 缓存 + SVG `<symbol>` / `<use>` 资源化

| 项 | 值 |
|---|---|
| 优先级 | **P0**（人际页单项收益最大） |
| 需要构建 | **否** |
| 落地成本 | 中：约 60–80 行，集中在 `portraitSVG` 与其调用点 |
| 风险 | 中（改变 DOM 结构，需要目视确认头像外观完全一致） |

#### 问题

`portraitSVG(name, gender, age, opt)`（`ui.js:406`）根据名字 hash 实时生成一份 **4.95 KB / 63 个 SVG 元素** 的内联 SVG 字符串，然后被**当作文本拼进每张卡片**。

人际页 classmate tab 有 12 张卡 → **59.4 KB 内联 SVG 文本**，占该 tab HTML 总量的 **87 %**。

#### 现状证据

`perf-profile.md`：
- §3.6.1：单个头像 4.95 KB / 63 元素 / 单次生成 23.5 µs
- §3.6.2：classmate tab 68.3 KB HTML / 791 节点 / **11.395 ms**
- §3.6.7：Memo 后 20 个头像串生成 0.466 → 0.0083 ms（**56×**），但仅占整页重建的 4 %

#### 改法（两步，建议一次做完）

**第 1 步：Memo 掉 `portraitSVG` 的字符串生成**

```js
const _svgCache = new Map();
function portraitSVG(name, gender, age, opt) {
  const key = name + '|' + gender + '|' + (opt && opt.face ? opt.face : '') + '|' + Math.floor(age / 5);
  let hit = _svgCache.get(key);
  if (hit) return hit;
  const s = /* …原有生成逻辑原样保留… */;
  if (_svgCache.size < 400) _svgCache.set(key, s);   // 上限防内存无界增长
  return s;
}
```

> 注意：如果 `portraitSVG` 的结果里有随年龄变化的部件，**key 里必须带上那个维度**（上面用 `Math.floor(age/5)` 示意，实际要按真实依赖调整）。缓存 key 漏维度 = 出现「角色长大了头像不变」这类难查 bug，这是本条改动的主要风险点，改完必须逐个年龄段目视确认。
> 全通讯录缓存常驻 ≈ **86 KB**（可接受）。

**第 2 步（真正的大头）：把头像从「每张卡内联一份 5 KB SVG」改成「一个 sprite + 每张卡一行 `<use>`」**

在 body 里放一个隐藏的 sprite 容器，第一次用到某个头像时把它的 `<symbol>` 注册进去，之后所有卡片只引用：

```html
<!-- 一次性，body 末尾 -->
<svg id="avatarSprite" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"></svg>
```

```js
function ensureSymbol(name, gender, age, opt) {
  const id = 'av-' + hashOf(name, gender, age, opt);       // 与 Memo 同一套 key
  if (!document.getElementById(id)) {
    const wrap = document.createElement('div');
    wrap.innerHTML = portraitSVG(name, gender, age, opt);   // 走 Memo
    const svg = wrap.firstElementChild;
    // 把 <svg> 转成 <symbol>，保留 viewBox
    const sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    sym.setAttribute('id', id);
    sym.setAttribute('viewBox', svg.getAttribute('viewBox'));
    while (svg.firstChild) sym.appendChild(svg.firstChild);
    document.getElementById('avatarSprite').appendChild(sym);
  }
  return id;
}

// 卡片里不再内联 5 KB，而是：
`<svg class="pf" viewBox="0 0 100 132" aria-hidden="true"><use href="#${id}"/></svg>`
```

每张卡的头像 HTML 从 **≈ 4.95 KB 降到 ≈ 80 字节**。

#### 预期收益

| 指标 | 现状 | 改后（估算） |
|---|---|---|
| classmate tab HTML | 68.3 KB | **≈ 8 ~ 10 KB** |
| classmate tab DOM 节点 | 791 | **≈ 200 ~ 260** |
| `renderRelView('classmate')` | 11.395 ms | **≈ 2.5 ~ 3.5 ms** |
| `afterAct()` 在人际页端到端 | 23.767 ms | ≈ 5 ~ 6 ms |

> 估算依据：`innerHTML` 成本与输入 HTML 体量近似成正比（§3.6.3 已证明占比 96 % 的是解析/建树），68.3 → 9 KB 即 ~8× 下降。
> **这是唯一一条能把人际页打到冰点以下的改动。**

#### 风险与缓解

| 风险 | 级别 | 缓解 |
|---|---|---|
| Memo key 漏维度导致头像不随年龄/状态变 | **高** | 必须先 grep 出 `portraitSVG` 的全部入参与内部用到的 `STATE` 字段，逐项入 key；改完按 0/10/20/40/70 岁做目视回归 |
| `<use>` 跨 `<symbol>` 的 CSS 选择器失效 | 中 | `style.css` 里若有 `.pf path {…}` 这类后代选择器，需改成对 `<symbol>` 内部，或直接内联 style。**这条要先和美术（林绘澄）确认后再动** |
| `<use>` 在同域 SVG sprite 上是 OK 的，但**外部 SVG 文件不可用** | 低 | 本项目是内联 sprite，符合要求 |
| 头像首次出现仍需一次全量生成 | 低 | 走 Memo，一次性成本 |

#### 【连带影响】**仅 Web**（`portraitSVG` 在 `ui.js`，小程序 bundle 不含 `ui.js`）

> 注：小程序的头像渲染在 `cangame-mp/components/` 下，是另一套实现，本条与它无关。若将来要让两端头像外观统一，需另行评估。

---

### O-03 · `autosave()` 节流 + 脏标记

| 项 | 值 |
|---|---|
| 优先级 | **P0** |
| 需要构建 | **否** |
| 落地成本 | 低：约 25 行 |
| 风险 | 中偏低（**必须保证关键节点仍然落盘**，否则会丢存档） |

#### 问题

`autosave()` 被 **11 个调用点**调用，实测一整局 174 次（**平均 1.29 次 / 次点击**）。每次都做一次 `JSON.stringify(43 KB)` + **同步** `localStorage.setItem`。

其中 `ui.js:1431` 那次藏在 `renderItem()` 里——**渲染函数偷偷做了持久化**，这条路径上「渲染」和「存档」两个关注点没有分开。

#### 现状证据

`perf-profile.md` §3.7：
- 整局 **174 次**写入 / 1.29 次每点击
- 序列化 **0.141 ms**，全流程 **0.163 ms**（**jsdom 是内存 map，`setItem` 只花 0.001 ms**）
- **真实浏览器 `setItem` 会把 43 KB 同步刷盘，低端安卓 WebView 常见 3–15 ms**

> 也就是说真机上这 174 次写入很可能是 **0.5 ~ 2.6 秒的累计主线程阻塞**，分散在整局里。桌面测不出来，但低端机上「点了之后卡一下」很可能就是它。

#### 改法

```js
/* 脏标记 + 延迟写 + 关键节点强制刷 */
let _saveDirty = false, _saveTimer = 0;

function markDirty() {                    // 替代绝大多数 autosave() 调用
  _saveDirty = true;
  if (!_saveTimer) {
    _saveTimer = setTimeout(flushSave, 400);   // 400ms 内的多次点击合并成一次写
  }
}

function flushSave() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = 0; }
  if (!_saveDirty) return;
  _saveDirty = false;
  autosave();                              // 原来的实现保持不变
}

function autosaveNow() { _saveDirty = true; flushSave(); }   // 关键节点用这个
```

调用点替换规则（**行号基于改动前的 v5.5.0 源码，改动过程中会漂移，请以函数名为准**）：

| 调用点 | ui.js 行 | 语义 | 换成 |
|---|---|---|---|
| `afterAct()` | 1121 | 通用 | `markDirty()` |
| `renderItem()` 渲染卡牌后 | 1400、1431 | 通用 | `markDirty()` |
| `doChooseExam()` | 1481 | 通用 | `markDirty()` |
| `doChoose()` | 1520 | 通用 | `markDirty()` |
| `investChoice()` | 1535 | 通用 | `markDirty()` |
| `afterTrade()` | 1825 | 通用 | `markDirty()` |
| **`createGame()` 之后（刚出生）** | **275** | **关键节点**：一局开始了 | **`autosaveNow()`** |
| **`finishGame()`（人生结束）** | **1542** | **关键节点**：不可再变 | **`autosaveNow()`** |
| **`btnSaveGame`（用户点了 💾）** | **1878** | **用户显式要求** | **`autosaveNow()`** |
| `saveToSlot()` / `loadSlot()` | 62、68、75 | 用的是另一个 key（`LS.slots`），且由用户显式触发 | **保持不变** |
| **页面隐藏 / 卸载（新增）** | — | 兜底 | `window.addEventListener('pagehide', flushSave)` + `visibilitychange` 隐藏时 `flushSave` |

> **`pagehide` / `visibilitychange` 兜底是这条改动的生命线**：手机上用户常常直接切后台或关标签，不补这两个钩子就会真的丢存档。
> 另外提醒：`finishGame()` 里的 `autosave()` **必须在 `renderEnd()` 之前**完成，节流之后也要保证这个顺序（用 `autosaveNow()` 即可，它是同步的）。

#### 预期收益

| 指标 | 现状 | 改后 |
|---|---|---|
| 整局写入次数 | 174 | **≈ 30 ~ 50**（取决于停顿；连点会被合并） |
| 桌面每次点击 | 0.163 ms | ≈ 0（异步到空闲） |
| 真机每次点击（估算） | 3–15 ms × 1.29 | **3–15 ms × ~0.3** |
| 每秒最高写放大 | 取决于连点 | 上限 2.5 次/秒 |

#### 风险与缓解

| 风险 | 级别 | 缓解 |
|---|---|---|
| **崩溃 / 切后台丢失最后一步** | **高（这是唯一真风险）** | 必须补 `pagehide` + `visibilitychange` 兜底；节流窗口取 **400 ms 而不是更长** |
| 玩家强杀浏览器导致丢 1 步 | 低 | 人生模拟类游戏丢 1 步的代价远低于每次点击卡 10 ms；且日志本身也是在内存里 |
| `renderItem` 里换成 `markDirty` 后语义变化 | 低 | `renderItem` 只是「把 item 展示出来」，本来就不该负责落盘 |

#### 【连带影响】**仅 Web**（`autosave` / `lsSet` 都在 `ui.js`；小程序走 `utils/store.js` + `wx.setStorageSync`，是另一套）

---

### O-04 · `esc()` 补齐引号转义（**安全，非性能项**）

| 项 | 值 |
|---|---|
| 优先级 | **P0（上线前必修）** |
| 需要构建 | **否** |
| 落地成本 | 极低：1 处函数 + 全量替换属性上下文的调用点 |

#### 问题

`ui.js:125`：

```js
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
```

**只转义 `& < >`，不转义 `"` 和 `'`。** 但它在代码里被广泛用在**双引号属性**里，例如：

```js
aria-label="${esc(name)}"
title="${esc(...)}"
```

姓名来自玩家输入（`#inputName`，`maxlength=10`，**不校验字符集**），也来自 `state.name[0]` 派生（孩子姓氏继承）。

#### 现状证据

`robustness-review.md` R-04（本轮唯一的安全缺陷）。jsdom 实测：注入 `" onload="__PWN__"` 后，SVG 元素的属性列表里出现了 `onload`、`onerror` 等**真实属性名**——**属性边界已经被突破**。

> 诚实说明：jsdom 里 `__PWNED` 计数为 0，**真实浏览器中是否构成可执行 XSS 本次未能证实**（需要真机/真实浏览器验证）。但「属性上下文未转义」是明确的结构性缺陷，且修复成本极低，**没有理由留着**。

#### 改法

```js
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
```

> 若担心一次性改 `esc` 影响 `textContent` 上下文的外观（可能性极低，因为 `&#39;` 会被正常显示），也可采用更安全保守的做法：保留 `esc` 不变，新增一个 `escAttr()`，只把**双引号属性上下文**里的调用换成 `escAttr()`。**两种方式都行，我倾向后者——改动半径更小、可回归。**

同时建议（配套，非必须）：给 `#inputName` 加字符集限制，例如 `oninput` 里剥掉 `<>"'&\` 等字符——输入只有 10 个字符，过滤几乎不影响体验。

#### 预期收益

非性能项。收益是**消除一个输入可控的属性注入面**。

#### 【连带影响】**仅 Web**（`esc` 在 `ui.js`）

---

### O-05 · `renderRelView` / `renderJobView` 局部刷新

| 项 | 值 |
|---|---|
| 优先级 | P1 |
| 需要构建 | **否** |
| 落地成本 | 中偏高（要做 key 化渲染），建议放在 O-02 之后 |

#### 问题

人际页 / 工作页每次 `afterAct` 全量重建。做完 O-02 后这部分从 11.4 ms 降到 ~3 ms，**剩下的部分再用 key 化局部更新进一步压**。

#### 改法要点

1. 每张卡片带稳定 `data-k`（如 `classmate:3`），渲染时按 key 复用已有节点，只更新变了的字段。
2. 卡片里的交互改为**事件委托**（`#view-rel` 上挂一个 listener 读 `data-k`），替代现在每张卡 inline 的 `onclick="uiSocial('classmate:3')"`。这样节点复用不需要重新绑定 handler。
3. 人数超过阈值（如 20）时分组折叠。

> **建议顺序：先做 O-02，再评估是否还需要本条。** O-02 落地后如果人际页已经降到 3 ms 以内（低端安卓 ~15 ms），本条的边际收益就不大了，可以降级到 P2。

#### 【连带影响】**仅 Web**

---

### O-06 · 首屏：`<script defer>` + 内联骨架屏 + 崩溃兜底提前

| 项 | 值 |
|---|---|
| 优先级 | P1 |
| 需要构建 | **否**（只改 `index.html`） |
| 落地成本 | 低：约 20 行 HTML |

#### 问题

`index.html:226-233` 的 8 个 `<script>` **没有一个 `defer`**，全部阻塞渲染。8 个脚本 + CSS 都在关键路径上。

#### 现状证据

`perf-profile.md` §3.2：
- CPU 侧只花 **9.5 ms**（桌面）
- 但 `data.js` 的 **52.6 KB gzip** 在 ≈400 kbps 弱网下要 **~1.0 s**
- 这段期间**纯白屏**

#### 改法

```html
<!-- 1) head 里用内联脚本最早注册崩溃兜底（修 R-07，见健壮性报告） -->
<head>
  <script>
  window.addEventListener('error', function (e) {
    var el = document.getElementById('crash');
    if (el) { el.textContent = '⚠️ 脚本出错了：' + (e.message || 'unknown') + '　请刷新页面；若反复出现，请清空浏览器缓存后再试。'; el.classList.add('show'); }
  });
  window.addEventListener('unhandledrejection', function (e) { /* 同上，用 String(e.reason) */ });
  </script>
</head>

<!-- 2) #screen-title 里放静态骨架（不依赖 JS 就能显示标题+一句文案） -->
<!-- 3) body 末尾的 8 个 script 改成 defer（顺序保证仍然成立：defer 按出现顺序执行） -->
<script src="assets/data.js?v=5.5.0" defer></script>
<script src="assets/market.js?v=5.5.0" defer></script>
…（其余 6 个同）
```

> **`defer` 对本架构是安全的**：带 `defer` 的脚本**仍然严格按照出现顺序执行**，且都在 `DOMContentLoaded` 之前完成——完全等价于现在的「放在 body 末尾」。现在这种「放 body 末尾」的写法本来就是为了顺序执行，加 `defer` 只是把「阻塞」这个副作用去掉。
> **但必须先实测验证一次**（这一点很重要）：把 `defer` 加上后跑一遍完整冒烟 + 一次 `boot-bench.js`，确认 TDZ 问题和现在一样没有出现。见 §2.0 的谨慎原则。

#### 预期收益

| 场景 | 现状 | 改后 |
|---|---|---|
| 弱网（400 kbps）白屏时长 | ≈ 1.0 s+ | **≈ HTML 到达即有标题页**（几十 ms） |
| 正常 4G | 差别不大 | 略有改善 |

#### 风险

- `defer` 改变了脚本执行时机，**虽然规范保证顺序，但这个项目把「加载顺序」当作硬约束用了 8 处**。必须完整冒烟。
- 提前注册 `error` 监听器后，`data.js` 失败也能显示横幅——这是**顺带修掉了 R-07**。

#### 【连带影响】**仅 Web**（`index.html` 是 Web 专属）

---

### O-07 · `lsSet()` 失败可见化

| 项 | 值 |
|---|---|
| 优先级 | **P0（健壮性）** |
| 需要构建 | **否** |
| 落地成本 | 极低：约 6 行 |

#### 问题

`ui.js:44`：

```js
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
```

**空的 `catch`。** 配额写满（`QuotaExceededError`）/ Safari 隐私模式（`SecurityError`）时，异常被静默吞掉。

#### 现状证据

`robustness-review.md` R-02。B/D 组实测：storage 抛 `SecurityError` 时**游戏不崩**（这点是对的），但**玩家完全得不到任何提示**。

#### 改法

```js
let _storageBroken = false;
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) {
    if (!_storageBroken) {
      _storageBroken = true;
      toast('本机无法保存进度（浏览器禁止存储或空间已满），本局可能不会被记住');
      try { console.error('[cangame] storage write failed', e); } catch (_) {}
    }
    return false;
  }
}
```

配套：`autosave()` 若返回 false，可在 HUD 上打一个不打扰的小角标（如 💾 变灰），让用户始终知道「这一局没被记住」。

#### 预期收益

把「静默丢存档」变成「明确告知」。**不提升性能，但显著影响玩家信任。**

#### 【连带影响】**仅 Web**

---

### O-08 · `migrateState()` 补 `log` / `flags` 兜底

| 项 | 值 |
|---|---|
| 优先级 | **P0（健壮性）** |
| 需要构建 | **否** |
| 落地成本 | 极低：2 行 |

#### 问题

把旧存档里的 `log` 或 `flags` 字段删掉后 `migrateState` 没能补回，直接进入渲染：

- 删 `log` → `TypeError: Cannot read properties of undefined (reading 'map')`
- 删 `flags` → `TypeError: Cannot read properties of undefined (reading 'past_life')`

#### 改法

在 `assets/engine.js` 的 `migrateState` 里加：

```js
if (!Array.isArray(s.log)) s.log = [];
if (!s.flags || typeof s.flags !== 'object') s.flags = { past_life: false };
```

（`{ past_life: false }` 只是示意，**实际默认值必须以 `mkState()` 里 `flags` 的初始形状为准**——改之前先读 `mkState`。）

> 建议顺手做一个**通用化的兜底**而不是逐字段打补丁：在 `migrateState` 末尾用一份「字段形状默认值表」统一校验，这样以后再加字段就不会再犯同样的错。

#### 预期收益

消除一整类「旧存档 → 白屏」事故。

#### 【连带影响】**Web + 小程序（改动在 `engine.js`，落地后必须跑 `node tools/build-engine.js`）**

> 注意：小程序有自己的存档（`utils/store.js`），但如果它也调用 `migrateState`（大概率如此），这 2 行对它同样是修复。**这是一条「改一处，两端都受益」的改动。**

---

### O-09 · 数值兜底：禁止 NaN / Infinity 进 UI

| 项 | 值 |
|---|---|
| 优先级 | P1 |
| 需要构建 | 否 |

#### 问题

注入极端值后 UI 直接显示脏文本（`robustness-review.md` R-05）：

| 注入值 | 脏文本 |
|---|---|
| NaN | `HP → NaN` |
| +Inf / -Inf | `MONEY → Infinity` |
| undefined | `HP → NaN` |
| string | `MONEY → NaN` |

#### 改法

在 UI 出口统一收口：

```js
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : (fallback === undefined ? 0 : fallback);
}
```

把 HUD / 属性条 / 市场数值的渲染点统一走 `num(x)`。**不需要改产生 NaN 的地方**（那是玩法平衡问题，属于 quality-lead 的域），只在出口做防御。

#### 【连带影响】**仅 Web**（改的是 UI 渲染出口）

---

### O-10 · `btnRestart` 的 `localStorage.removeItem` 包 try

| 项 | 值 |
|---|---|
| 优先级 | P1 |
| 需要构建 | 否 |
| 落地成本 | 1 行 |

`ui.js:1881` 是全项目唯一一处**不在 try 块里**的 localStorage 调用：

```js
bind('btnRestart', () => {
  if (confirm('放弃当前人生，重新开始？')) { localStorage.removeItem(LS.auto); … }
});
```

隐私模式 / 禁用存储时点「重开」会抛异常。改成：`try { localStorage.removeItem(LS.auto); } catch (e) { }`。

#### 【连带影响】**仅 Web**

---

### O-11 · 替换废弃的 `escape` / `unescape`

| 项 | 值 |
|---|---|
| 优先级 | P2 |
| 需要构建 | 否 |

`ui.js:87 / 97` 的导出/导入用了 Annex B 遗留 API：

```js
const txt = btoa(unescape(encodeURIComponent(JSON.stringify(STATE))));   // 导出
const obj = JSON.parse(decodeURIComponent(escape(atob(txt))));           // 导入
```

`escape`/`unescape` 已废弃，靠非标准 `%uXXXX` 扩展处理 > U+FFFF 字符。本轮 round-trip 实测（纯中文 / emoji / 混合）**全部通过**，所以**不是火烧眉毛的 bug**，但它随时可能被移除。

改法（UTF-8 安全的标准写法）：

```js
// 导出
const bytes = new TextEncoder().encode(JSON.stringify(STATE));
let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
const txt = btoa(bin);
// 导入
const bin2 = atob(txt.trim());
const bytes2 = Uint8Array.from(bin2, c => c.charCodeAt(0));
const obj = JSON.parse(new TextDecoder().decode(bytes2));
```

> **兼容性核对**：`TextEncoder` / `TextDecoder` 全现代浏览器可用。**但如果要兼容很老的微信内置 WebView，需要确认 `TextEncoder` 是否存在**（部分 Android 4.4 WebView 没有 `__proto__`）——建议加一句 feature detect，缺失时回退到现在的 `escape` 方案。

#### 【连带影响】**仅 Web**

---

### O-12 · `SAVE_VERSION` 真正参与迁移判断

| 项 | 值 |
|---|---|
| 优先级 | P2 |
| 需要构建 | 否 |

全文检索确认：`SAVE_VERSION = 2` 写进了 `state.v`，**但没有任何地方读取/比较它**。版本号目前是死字段，迁移完全靠 `migrateState` 的逐字段兜底。

建议在读档入口加一层：

```js
if (s.v !== SAVE_VERSION) { /* 记录版本差，走完整 migrate 路径；必要时提示玩家 */ }
```

这是「未来再加字段不再翻车」的基础设施，成本极低。

#### 【连带影响】**Web + 小程序（若改在 `engine.js`；落地后重跑 `build-engine.js`）**

---

### O-13 · CSS containment 低成本试探

| 项 | 值 |
|---|---|
| 优先级 | P2（**成本 2 行 CSS，值得先试**） |
| 需要构建 | 否 |

`#stream` 和 `#view-rel` 每次重建都把 reflow 范围扩散到整个 `.stage`。建议先试：

```css
#view-rel { contain: content; }
#stream   { contain: content; }
```

效果要在真机 Performance 面板上看 `Layout` 时长才能确认。jsdom 测不出来。**这条我标记为「待真机验证」，不作为承诺收益。**

#### 【连带影响】**仅 Web**

---

## 3. B 组：结构性建议（需要引入构建步骤或大改）

> 以下都**不建议在本 Phase 做**。写出来是为了把「为什么不做」讲清楚，避免下次有人又提出来。

### S-01 · 引入压缩构建（terser / esbuild minify）

| 项 | 值 |
|---|---|
| 需要构建 | **是** |
| 优先级 | P2 |
| 建议 | **可以放到路线图里，但不要为了性能而做，要为「可维护性」而做** |

**现状**：495 KB 原始 → gzip 160.4 KB / **brotli 132.7 KB**（GitHub Pages 已自动压缩）。

**收益测算**：terser 典型能把这类业务代码压到原始的 45–55 %。保守估算 **brotli 会从 132.7 KB 降到 ≈ 90–100 KB**，也就是**传输再省 30–40 KB**，在弱网上约这么多百毫秒。

**代价**：
- 引入 npm 依赖 + 一条 build 命令 + 一个产出目录
- 破坏「零构建、改完直接推 GitHub Pages」这个目前最大的工程优势
- **CI/CD 断点**：现在 `git push` = 上线，加构建后要引入 gh-actions 或本地构建后推 dist
- 与 `tools/build-engine.js` 并存，出现两条流水线

**连带影响**：**Web only**（小程序自己拼源码，不经过 web 构建）

**我的判断**：收益 30 KB br，**不足以抵消丢掉零构建**。真正的价值在于「顺便能做 tree-shaking 和死代码检测」——如果哪天要引入 bundler，理由应该是这个，而不是这 30 KB。

---

### S-02 · `data.js` 拆分 + 懒加载

| 项 | 值 |
|---|---|
| 需要构建 | **是，且会打断小程序** |
| 优先级 | **不建议** |

很多人看到 `data.js` 有 161 KB，第一反应是「拆开懒加载」。**这条在本项目是错的，两个理由：**

**理由一：数据根本没法删。** `coupling-probe.js` 跑了 60 局随机人生，统计事件池利用率：

| 组 | 条数 | 60 局中出现过 | 覆盖率 |
|---|---:|---:|---:|
| 本体 | 106 | 95 | 89.6 % |
| EVENTS_EXTRA | 66 | 65 | 98.5 % |
| EVENTS_FAMILY | 31 | 25 | 80.6 % |
| EVENTS_FAMILY2 | 28 | 24 | 85.7 % |
| EVENTS_ERA | 10 | 10 | 100.0 % |
| **合计** | **241** | **219** | **90.9 %** |

> 「没被抽到」≠「没用」——它们很多是低概率 / 强条件事件，是内容深度的一部分。但这也说明：**没有任何一行 data.js 是加载时可以省掉的**，唯一的做法是「晚点加载」。

**理由二：一旦「晚点加载」就要动加载顺序，而加载顺序是全项目最脆弱的东西。**

- `data.js` 顶层是 `const`（不是 `var`），跨文件引用依赖 TDZ。已实测：把 `data.js` 和 `school.js` 换位置 → `ReferenceError: GAME_META is not defined`；把 `engine.js` 和 `love.js` 换位置 → `ReferenceError: JOBS is not defined`。
- 改成按需注入意味着逻辑层要引入异步加载点，而**当前 8 个 file 全是顶层同步执行的**。这会变成一次真正的架构改造。

**收益测算**：就算成功，首屏少传约 40 KB br，在 4G 上约省 100–200 ms（真能感知的场景只有弱网）。

#### 【连带影响】**会打断小程序构建（禁止）**

> 新增文件不会被 `tools/build-engine.js` 拼进 bundle → 小程序运行时直接 `ReferenceError`。**如果哪天真的要做这条，必须同步改 `build-engine.js`，并且要保证 bundle 仍然包含全部数据。**

---

### S-03 · 引入 VDOM / preact 接管渲染

| 项 | 值 |
|---|---|
| 需要构建 | **是** |
| 优先级 | **不建议** |

理由：
1. **收益已经被更便宜的手段覆盖**。做完 O-01 + O-02 后单次点击从 23.8 ms 降到 ~5 ms，VDOM 最多再省 1–2 ms，**边际收益接近零**。
2. **代价极高**：现有 UI 是 100 KB 的字符串模板，全部要重写；而且引入框架后「零依赖」这个卖点没了。
3. 真实收益其实是「开发体验」，不是性能——如果要引，理由应该是这个，而且要单独立项，不能混进 Phase 6 polish。

#### 【连带影响】**会打断小程序构建（禁止）**

---

### S-04 · `pickEvents` 按 age 建倒排索引

| 项 | 值 |
|---|---|
| 需要构建 | **否** |
| 优先级 | **暂缓** |

这是全项目唯一随数据规模线性增长的热路径，但**当前规模下完全不值得动**：

| 操作 | p50 ms | max ms |
|---|---:|---:|
| `pickEvents(state)` @age=30 | 0.0921 | 0.2972 |
| 全池 `matchEvent` 扫描 241 条 | 0.0964 | 0.2708 |

整局累计 3.787 ms / 14.44 ms 的 tick 总量。

**触发阈值建议：事件池涨到 800–1000 条**（届时单次扫描约 0.3–0.4 ms，整局累计接近 30 ms）时，再考虑 `Map<age, Event[]>`。**现在做是过早优化。**

#### 【连带影响】**Web + 小程序**（改动落在 `engine.js`）

---

## 4. 建议落地顺序与验收方法

### 4.1 批次划分

| 批次 | 内容 | 理由 | 预计风险 |
|---|---|---|---|
| **Batch 1 · 安全与健壮性** | O-04、O-07、O-08、O-10 | 全部 ≤ 10 行，可直接消缺陷，且不影响任何渲染行为 | 极低 |
| **Batch 2 · 渲染三大件** | O-01 → O-02（第 1 步 Memo 先单独发）→ O-02（第 2 步 sprite） | 按子步骤拆开，每步可单独回滚 | Memo key 是主要风险点 |
| **Batch 3 · 存档节流** | O-03（**必须连带 pagehide 兜底**） | 需要先确认全部调用点语义 | 中（丢存档风险） |
| **Batch 4 · 锦上添花** | O-06、O-09、O-11、O-12、O-13 | 各有独立价值，可排期穿插 | 低 |

> **O-02 的两步一定要分开提交。** 第 1 步（Memo）只是加缓存，不改变 DOM 结构，几乎零风险；第 2 步（`<use>` sprite）改变 DOM 结构，要和美术确认 CSS 后再上。

### 4.2 每批次的验收方法（已有工具可直接复用）

```bash
cd production/phase6-polish/perf/scripts

# 1) 改之前先留基线
node render-bench.js     && cp render-bench.out.txt   ../../_baseline/render-before.txt
node save-bench.js       && cp save-bench.out.txt     ../../_baseline/save-before.txt
node step-bench.js       && cp step-bench.out.txt     ../../_baseline/step-before.txt

# 2) 改之后对比
node render-bench.js     # 重点看 §2 各 tab、§4 renderStream、§6 端到端
node save-bench.js       # 重点看 §1 调用次数（应从 174 显著下降）
node step-bench.js       # 回归：逻辑层数字应与改动前一致（不应该有任何变化）

# 3) 健壮性回归
node robust-fuzz.js      # 所有 ✗ 行应清零
node coupling-probe.js   # 应仍为「没有重名」
```

**门控条件（建议写进 Story 的 DoD）**：
- `step-bench.out.txt` 的 tick 归因表**必须与基线一致**（逻辑层零变化）
- `render-bench.out.txt` §6 端到端 p50 **必须 ≤ 8 ms**（桌面）
- `robust-fuzz.out.txt` 的 ✗ 条目 **必须归零**
- 人工冒烟：完整玩一局到结局页 + 人际页五 tab + 工作页 + 市场买卖 + 存档导出导入

### 4.3 需要其他人配合的点

| 事项 | 需要谁 | 说明 |
|---|---|---|
| O-02 第 2 步的 `<use>`/`<symbol>` 是否破坏头像 CSS | **art-director（林绘澄）** | `style.css` 里若有 `.pf path` 这类后代选择器，会失效。改前需确认。 |
| O-09 数值兜底的「脏数来源」 | **quality-lead（严守真）** | UI 出口兜底只是止血；NaN 是哪里产生的属于玩法/平衡问题，建议并入 QA-01 |
| 所有涉及 `assets/` 的实际改动 | **team-lead（主理人）** | **本次未授权改源码，本文件只出方案。** 落地需逐条放行 |
| 落地后 `engine.js` / 其他逻辑层的改动 | **小程序侧** | **必须跑 `node tools/build-engine.js` 并验一遍小程序** |

---

## 5. 诚实清单：这份方案里我没把握的部分

| # | 不确定项 | 为什么没把握 | 建议怎么消除 |
|---|---|---|---|
| 1 | O-02 sprite 的收益是**估算**（按 HTML 体量比例外推），不是实测 | 改动未落地，无法 bench | 落地第 2 步后立刻跑 `render-bench.js` 拿真数 |
| 2 | O-03 的真机收益（3–15 ms/次）来自经验值，jsdom 测不到磁盘 IO | 无真机环境 | Phase 收尾用 Android WebView 远程调试实测一次 |
| 3 | ×5 的移动端换算系数是行业经验值，不是本项目真机实测 | 无真机环境 | 同上；在至少两台不同档位安卓机上各测 3 次取中位 |
| 4 | O-04 在真实浏览器上是否真的可执行 XSS | jsdom 里 `__PWNED = 0`，未能验证 | **建议按存在漏洞处理**（修复成本只有 1 行），同时找一台真机验证一次，把结论写进 robustness-review |
| 5 | O-06 的 `defer` 会不会意外触发 TDZ | 规范上不会，但本项目把加载顺序当硬约束用了 8 处 | 改完跑完整冒烟 + `boot-bench.js` 对比 |
| 6 | `migrateState` 里 `flags` 的正确默认形状 | 我读了 `migrateState`（engine.js:594）但没逐个对照 `mkState()` 的字段 | **落地 O-08 前必须先读 `mkState()` 的 `flags` 初始值**，本文里给的 `{ past_life: false }` 只是示意 |

---

## 附：改动波及范围总表

| 编号 | 涉及文件 | 连带影响 | 需要构建 |
|---|---|---|---|
| O-01 | `ui.js` | 仅 Web | 否 |
| O-02 | `ui.js`（+ 可能 `style.css`） | 仅 Web | 否 |
| O-03 | `ui.js` | 仅 Web | 否 |
| O-04 | `ui.js` | 仅 Web | 否 |
| O-05 | `ui.js` | 仅 Web | 否 |
| O-06 | `index.html` | 仅 Web | 否 |
| O-07 | `ui.js` | 仅 Web | 否 |
| O-08 | `engine.js` | **Web + 小程序，需重跑 `build-engine.js`** | 否 |
| O-09 | `ui.js` | 仅 Web | 否 |
| O-10 | `ui.js` | 仅 Web | 否 |
| O-11 | `ui.js` | 仅 Web | 否 |
| O-12 | `engine.js`（视实现位置） | Web + 小程序，需重跑 `build-engine.js` | 否 |
| O-13 | `style.css` | 仅 Web | 否 |
| S-01 | 全项目 + CI | 仅 Web（但破坏零构建） | **是** |
| S-02 | `data.js` 拆分 | **会打断小程序构建（禁止）** | **是** |
| S-03 | 全项目重写 UI | **会打断小程序构建（禁止）** | **是** |
| S-04 | `engine.js` | Web + 小程序，需重跑 `build-engine.js` | 否（但暂缓） |
