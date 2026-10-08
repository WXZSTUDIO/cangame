# PERF-01 · cangame 健壮性与耦合风险评审

| 项 | 值 |
|---|---|
| 任务 ID | PERF-01 |
| 角色 | engineering-lead（程基岩）· 技术负责人 |
| 评审对象 | cangame「人生模拟 · 中国人生重开模拟器」Web 版 **v5.5.0** |
| 代码路径 | `C:/Users/ro3ea/WorkBuddy/作品集/cangame` |
| 日期 | 2026-10-07 |
| 运行时 | Node v22.22.2 + jsdom |
| 是否改动源码 | **否** |
| 证据脚本 | `production/phase6-polish/perf/scripts/robust-fuzz.js`、`coupling-probe.js` |
| **门控判定** | **CONCERNS** |

---

## 0. 门控判定

### 判定：**CONCERNS**

**理由（为什么不是 PASS）**

发现 **8 项缺陷**，其中 **1 项是安全缺陷（R-04，属性上下文未转义）**，另有 **2 项会造成「用户数据丢失且无提示」（R-02）或「旧存档白屏」（R-01）**。这三项的组合属于「线上可接受，但必须在下一个发布窗口前修掉」的级别。

**理由（为什么不是 FAIL）**

- **没有任何一项会造成「正常路径下必崩」**。8 项缺陷全部需要特定触发条件（畸形存档、隐私模式、构造输入、网络异常）。
- **基准健壮性其实相当好**：`robust-fuzz.js` B 组 10 项除零/空集合路径**全部通过**——这个项目在防御式编程上是下了功夫的（`bind()` 的容错、`uiConfirm` 的缺失兜底、`hasSave` 的判断都很扎实）。
- 所有缺陷的修复成本都很低：**P0 三项合计不超过 15 行代码**。

### 修复完成后的门控条件

```bash
node robust-fuzz.js      # ✗ 行必须归零
node coupling-probe.js   # 必须仍为「没有重名」
```

---

## 1. 评审范围与方法

### 1.1 范围

| 类别 | 内容 |
|---|---|
| **在范围内** | 异常输入、边界值、旧存档迁移、存储不可用、XSS 注入面、崩溃兜底覆盖率、存档码 round-trip、全局命名空间耦合、加载顺序敏感性、数据表利用率 |
| **不在范围内** | 玩法数值平衡（属 QA-01 / quality-lead）、视觉与无障碍（属 ART-01 / art-director）、音频（属 AUD-01）、真实浏览器 XSS 可利用性验证（无真机环境，见 §6）、`cangame-mp` 源代码评审（只读核对了 `tools/build-engine.js`，未改） |

### 1.2 方法

`robust-fuzz.js` 分 A–G 七组在 jsdom 里对真实游戏对象做操作：

| 组 | 内容 | 手法 |
|---|---|---|
| A | 极端数值注入 | 把 `NaN / +Inf / -Inf / 1e308 / -1e308 / null / undefined / string` 写入 `STATE` 各字段，然后跑渲染，扫捕 `<div class="line">` 等处是否出现脏文本 |
| B | 除零与空集合路径 | 构造 `loan.years=0`、`stock.cost=0`、`career=null`、`parents=null`、`classmates=[]`、`credit=null` 等，各跑一遍主流程 |
| C | 旧存档字段迁移 | **逐个字段删除**（每个字段单独一个 case），跑 `migrateState` 后尝试渲染，看是否抛错 |
| D | localStorage 不可用 | 把 `localStorage` 替换成会抛 `SecurityError` 的桩，跑一遍完整流程 |
| E | 姓名注入面 | 通过 `#inputName` 注入 3 组 payload，检查生成的 SVG 元素属性列表 |
| F | 崩溃兜底覆盖 | 注入 4 种失败场景（含 1 组对照），检查 `#crash` 横幅是否显示 |
| G | 存档码 round-trip | 纯中文 / emoji / 混合三种导入导出比对 |

`coupling-probe.js` 的六项见 `perf-profile.md` §2。

---

## 2. 缺陷清单

### 2.1 总表

| ID | 缺陷 | 严重度 | 优先级 | 触发条件 | 对应优化条目 | 涉及文件 | 连带影响 |
|---|---|---|---|---|---|---|---|
| **R-01** | `migrateState` 缺 `log` / `flags` 兜底 → 白屏 | **致命**（不可恢复） | **P0** | 旧存档缺字段 | O-08 | `engine.js` | **小程序也受影响** |
| **R-02** | `lsSet()` 静默吞异常 → 存档丢失无提示 | 高（用户数据丢失） | **P0** | 配额满 / 隐私模式 | O-07 | `ui.js` | 仅 Web |
| **R-03** | `btnRestart` 的 `removeItem` 不在 try 里 | 中 | P1 | 隐私模式下点重开 | O-10 | `ui.js` | 仅 Web |
| **R-04** | `esc()` 不转义引号 → 属性边界突破 | **高（安全）** | **P0** | 姓名含 `"` | O-04 | `ui.js` | 仅 Web |
| **R-05** | 极端数值泄漏到 UI（NaN / Infinity） | 中 | P1 | 数值异常 | O-09 | `ui.js` | 仅 Web |
| **R-06** | `SAVE_VERSION` 是死字段 | 低（技术债） | P2 | — | O-12 | `engine.js` | **小程序也受影响** |
| **R-07** | 崩溃横幅覆盖盲区：早期脚本失败不可见 | 高（排障困难） | P1 | 加载期失败 | O-06 | `ui.js` / `index.html` | 仅 Web |
| **R-08** | 使用已废弃的 `escape` / `unescape` | 低（未来兼容） | P2 | — | O-11 | `ui.js` | 仅 Web |
| **R-09** | 导入存档码只校验 `obj.stats` 存在 | 低 | P2 | 用户粘贴畸形码 | — | `ui.js` | 仅 Web |

---

### R-01 · `migrateState` 缺 `log` / `flags` 兜底 —— **致命**

| 项 | 值 |
|---|---|
| 严重度 | **致命**（用户进游戏就是白屏，且不知道发生了什么） |
| 优先级 | **P0** |
| 位置 | `assets/engine.js`（`migrateState`，约 594 行起） |
| 【连带影响】 | **Web + 小程序，落地后必须跑 `node tools/build-engine.js`** |

**再现** —— `robust-fuzz.js` C 组：把存档里的 `log` 字段删掉，`migrateState` 不报错，但随后渲染时：

```
✗ TypeError: Cannot read properties of undefined (reading 'map')
```

把 `flags` 字段删掉：

```
✗ TypeError: Cannot read properties of undefined (reading 'past_life')
```

**为什么严重**

这是本次评审唯一一条**普通用户可能自然遇到**的致命路径：

1. 玩家的 localStorage 里有一个**旧版本**（比如 v5.0 时期）的存档
2. 打开新版 → `migrateState` 走逐字段兜底 → **`log` / `flags` 这两个恰好没兜住**
3. 抛错 → **此时 `#crash` 横幅能不能显示，取决于错误发生在 `ui.js` 加载之后**（这条是能的，因为 `migrateState` 在用户点「继续」时才跑）
4. 但因为它是列表渲染的第一行代码，**很可能连 toast 都来不及出**，用户看到的就是「点了继续，然后卡死」

C 组逐个字段删除测试（`edu`、`love`、`classmates`、`exes`、`children`、`friends`、`parents`、`family`、`market`、`career`、`loans`、`ill`、`achievements`、`socialTouch`、`uniTouch`、`goodTouch`、`spouse`、`spouseName`、`log`、`queue`、`credit`、`flags`、`pet`、`grief`、`talents`），**只有 `log` 和 `flags` 两个失败**——说明作者的兜底意识是有的，只是漏了两个。

**改法**

`migrateState` 里补两行：

```js
if (!Array.isArray(s.log)) s.log = [];
if (!s.flags || typeof s.flags !== 'object') s.flags = { past_life: false };  // ← 形状以 mkState() 为准
```

> ⚠️ **落地前必读**：上面 `flags` 的默认值是**示意**，不是实际值。**必须先读 `mkState()` 里 `flags` 的初始形状**，照抄那个形状。拍脑袋填一个默认值会引入「迁移后行为不对」的新问题。

**更好的做法（建议但不强求）**

不要继续逐字段打补丁。在 `migrateState` 末尾加一张「字段形状默认值表」统一校验——这样以后再加新字段就不会重演这次的事。C 组的 24 个 case 可以直接变成回归测试用例。

**回归方法**

```bash
node robust-fuzz.js   # C 组全部 case（log / flags / queue / credit …）应全部 ✓
```

---

### R-02 · `lsSet()` 静默吞异常 —— 用户不知道自己的存档没了

| 项 | 值 |
|---|---|
| 严重度 | 高（**用户数据丢失 + 完全没有提示**） |
| 优先级 | **P0** |
| 位置 | `assets/ui.js:44` |
| 【连带影响】 | **仅 Web**（小程序走 `utils/store.js` + `wx.setStorageSync`，是另一套） |

**现状代码**

```js
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
```

注意那个 **空的 `catch (e) { }`**。

**为什么会真实发生**

| 场景 | 抛的异常 | 概率 |
|---|---|---|
| iOS Safari **隐私模式** | `SecurityError` | 中高（很多用户不知道自己开了） |
| Safari ITP 第三方 iframe 内 | `SecurityError` | 低 |
| localStorage **配额写满** | `QuotaExceededError` | 低（本项目只占 43 KB / <1%），但**同一域名下其他页面**可能占满 |
| 企业策略禁用 Web Storage | `SecurityError` | 低 |

**后果链条**

```
写失败 → catch 吞掉 → autosave() 返回 undefined → 调用方不知道失败
      → HUD 上没有任何异常 → 玩家以为存了
      → 下次打开 → loadAuto() 拿到旧/空 → hasSave() 返回 false
      → 「继续游戏」按钮消失 → 玩家：我的存档呢？
```

这是**最伤用户信任**的一类 bug：它不会崩溃，只会让人觉得「这游戏莫名其妙把我进度弄丢了」。

**现状证据（D 组）**

好消息：把 `localStorage` 换成抛 `SecurityError` 的桩之后，**游戏没有崩**（`try/catch` 是生效的）。也就是说它们的防御意图是对的，**只差「告诉用户」这一步**。

全项目 localStorage 调用点清单：**行 43, 44, 1881**——其中 43（`lsGet`）和 44（`lsSet`）都有 try，**只有 1881 没有（见 R-03）**。

**改法**

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

配套建议（很便宜）：如果 `autosave()` 返回 false，把 HUD 上的 💾 图标变灰，让用户**始终**知道当前这一局有没有被记住。

**回归方法**

```bash
node robust-fuzz.js   # D 组应出现「已提示用户」而不是「静默通过」
```

---

### R-03 · `btnRestart` 的 `localStorage.removeItem` 不在 try 里

| 项 | 值 |
|---|---|
| 严重度 | 中（隐私模式下点「重开」会抛错） |
| 优先级 | P1 |
| 位置 | `assets/ui.js:1881` |
| 【连带影响】 | **仅 Web** |

**现状代码**

```js
bind('btnRestart', () => {
  if (confirm('放弃当前人生，重新开始？')) {
    localStorage.removeItem(LS.auto);     // ← 唯一一处裸奔的 localStorage 调用
    STATE = null; renderTitle(); showScreen('screen-title');
  }
});
```

这是全项目**三处** localStorage 调用中唯一没有 try 的一处（`ui.js:43` → `lsGet`、`ui.js:44` → `lsSet` 都有 try）。

**后果**：隐私模式下点 🔁 会抛异常。`bind()` 里有 `try { el.onclick = fn } catch`，但那层 try 只包住了**赋值**，包不住**回调执行时**的异常。回调里的异常会冒泡到 `window.error` → 触发崩溃横幅（R-07 的那条路径），而且**后面的 `renderTitle()` 不会执行**——用户会卡在一个半重建的界面上。

**改法**：1 行。

```js
try { localStorage.removeItem(LS.auto); } catch (e) { }
```

---

### R-04 · `esc()` 不转义引号 —— **属性边界被突破**

| 项 | 值 |
|---|---|
| 严重度 | **高（本轮唯一的安全缺陷）** |
| 优先级 | **P0（上线前必修）** |
| 位置 | `assets/ui.js:125` |
| 【连带影响】 | **仅 Web** |

**现状代码**

```js
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
```

只转义 `& < >`，**不转 `"` 和 `'`**。

而它被用在**双引号属性上下文**里：

```js
aria-label="${esc(name)}"
title="${esc(...)}"
```

上面这段不是举例，是实际代码。全量检索确认 **`esc()` 落在双引号属性上下文**的调用点有 **4 处**：

| 位置 | 模板 |
|---|---|
| `ui.js:591` | `aria-label="${esc(name \|\| '')}"`（在 `portraitSVG` 的 `<svg>` 开标签里） |
| 另外 3 处 | `title="${esc(...)}"` |

其中 `ui.js:591` 就是 E 组 payload 命中的那一处——**它正是 `portraitSVG` 生成 4.95 KB 内联 SVG 的开标签**，所以每张卡片、每个头像都会走这条路。

**注入路径**

姓名有三个来源：

1. `#inputName` 输入框（`index.html:87`，`maxlength="10"`，**不校验字符集**）
2. 随机生成（安全）
3. **孩子姓氏继承 `state.name[0]`** —— 也就是说，玩家第 1 局造一个坏名字，能**一直遗传到后面的局**

**实测证据（E 组）**

```
⚠ payload "\" onload=\"__PWN__\"" → SVG 元素属性：viewBox,width,height,xmlns,aria-label,onload,"
⚠ payload "\"><script>__PWN__</script>" → SVG 元素属性：viewBox,width,height,xmlns,aria-label,&gt;&lt;script&gt;__pwn__&lt;,script&gt;"
⚠ payload "\"><img src=x onerror=__PWN__>" → SVG 元素属性：viewBox,width,height,xmlns,aria-label,&gt;&lt;img,src,onerror
```

注意第三组的属性列表：出现了 **`onerror`**、**`src`** 这些**真实的属性名**。这证明 **`aria-label` 的双引号边界已经被突破**，攻击者可以往 `<svg>` 元素上注入任意属性。

**诚实的能力边界声明**

| 已确认 | 未确认 |
|---|---|
| ✅ **属性边界已被突破**（`onload` / `onerror` / `src` 成为真实属性） | ❌ **真实浏览器中是否真的执行**。jsdom 里 `__PWNED` 计数为 **0** |

> jsdom 会编译内联 handler 但有自己的差异；真实浏览器的行为走的是同一条 parse → attribute → 编译路径，**理论上应该会执行，但我没有真机环境验证，所以不把它写成「已确认的 XSS」**。
> **但**：修复成本只有 1 行，而「属性上下文未转义」是 OWASP 明确列举的结构性缺陷。**没有理由留着。** 建议按「存在漏洞」处理。

**关于 `maxlength=10` 的一点说明**

`"` + ` onload=x` 需要 11 个字符，刚好超过 10 位。但是：
- `"/onload=` 这类变体（斜杠代替空格）在 HTML 属性解析中是合法的
- **`aria-label` 之外还有很多 `title="${esc(...)}"` 的调用点，那些地方的输入不一定限制在 10 字符**
- 依赖「长度不够」当防线本身就是脆弱的

**改法**

保守版（推荐，改动半径小、可回归）——保留 `esc` 不变，新增专用于属性上下文的函数：

```js
function escAttr(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
```

然后把**所有双引号属性里**的 `esc(...)` 换成 `escAttr(...)`。

激进版——直接给 `esc` 补齐引号（少一处函数，但改动面覆盖所有调用点）：两种都行，我倾向保守版。

配套（不强求）：给 `#inputName` 加字符集过滤，输入仍只有 10 字符，几乎不影响体验。

> **顺带**：优化方案里的 **O-01**（`renderStream` 改用 `createTextNode`）会顺手消掉日志文本那一处的注入面，虽然不是同一处缺陷。

**回归方法**

```bash
node robust-fuzz.js   # E 组三个 payload 的属性列表里不应再出现 onload / onerror
```

---

### R-05 · 极端数值泄漏到 UI

| 项 | 值 |
|---|---|
| 严重度 | 中（不崩，但界面出现 `NaN` / `Infinity` 这种鬼东西） |
| 优先级 | P1 |
| 位置 | UI 渲染出口（HUD / 属性条 / 市场） |
| 【连带影响】 | **仅 Web** |

**实测（A 组）**

| 注入值 | 抛错次数 | 脏文本首次出现 |
|---|---:|---|
| NaN | **0** | `HP → NaN` |
| +Inf | **0** | `MONEY → Infinity` |
| -Inf | **0** | `MONEY → Infinity` |
| 1e308 | 0 | — |
| -1e308 | 0 | — |
| null | 0 | — |
| undefined | **0** | `HP → NaN` |
| string | 0 | `MONEY → NaN` |

**这是一个「好消息 + 坏消息」的组合**：

- **好消息**：**一个错都没抛**。8 种极端输入全部安全通过 —— 引擎层的容错比一般同类项目强。
- **坏消息**：脏值被**原封不动渲染到了屏幕上**。玩家会看到 `健康 NaN`。

**归属说明**

这里我要划一条线：
- **NaN 是怎么产生的**（哪个玩法公式溢出 / 除零） → 这是**数值平衡问题，属于 QA-01 / quality-lead 的域**，我这次没有深挖。
- **NaN 进了 UI** → 这是**UI 出口没有收口，是我的域**。

**改法**

在 UI 出口统一收口，不去动产生脏值的玩法逻辑：

```js
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : (fallback === undefined ? 0 : fallback);
}
```

把 HUD / 属性条 / 市场数值的渲染点统一走 `num(x)`。

**建议**：`robust-fuzz.js` A 组这一轮跑出来的是「哪些地方会漏」，可以直接作为修复后的回归用例——脏文本消失为准。

---

### R-06 · `SAVE_VERSION` 是死字段

| 项 | 值 |
|---|---|
| 严重度 | 低（技术债，不是 bug） |
| 优先级 | P2 |
| 位置 | `assets/engine.js` 内写入 `state.v`，但**无任何地方读取** |
| 【连带影响】 | **Web + 小程序** |

**现状**

`SAVE_VERSION = 2` 写进了 `state.v`，但全文检索确认：**没有任何地方读取或比较它**。版本号目前完全是装饰，迁移完全依赖 `migrateState` 的逐字段兜底——而这正是 R-01 之所以会发生的根因。

**为什么要修**

这是「下一次加字段就又会翻车」的结构性缺口。加上后会形成一个正反馈：

```js
// 读档入口
if (s.v !== SAVE_VERSION) { /* 记录版本差 → 必须走完整 migrate 路径 */ }
```

加上这一句之后，**以后每次加字段都会有人被提醒要去检查 `migrateState`**。成本极低，价值在长期。

---

### R-07 · 崩溃横幅覆盖盲区：早期脚本失败完全不可见

| 项 | 值 |
|---|---|
| 严重度 | 高（**排障极其困难**） |
| 优先级 | P1 |
| 位置 | `assets/ui.js:114-115`（注册在最后一个脚本里）+ `index.html:226-233` |
| 【连带影响】 | **仅 Web** |

**根因**

加载顺序是：

```
data.js → market.js → engine.js → school.js → career.js → love.js → loan.js → ui.js
```

而 `window.addEventListener("error", …)` 注册在 **`ui.js`** 里，也就是**最后一个脚本。**

**这意味着：在 ui.js 成功加载之前发生的一切错误，兜底自己还没注册。**

**实测（F 组）**

| 场景 | 横幅显示 | 说明 |
|---|---|---|
| ① `data.js` 语法错误（CDN 截断 / 缓存损坏 / 中间设备污染） | **✗ 未显示** | 最可能真实发生的一种 |
| ② `data.js` 顶层运行时抛错 | **✗ 未显示** | |
| ③ `ui.js` 语法错误（**兜底自己坏了**） | **✗ 未显示** | 最讽刺的一种 |
| ④ 【对照】`ui.js` 加载成功后的运行时抛错 | **✓ 显示** | 对照组正常，证明测试方法本身有效 |

> 对照组（④）必须提及：如果连对照都不显示，那说明是测量方法坏了。它显示了，**证明上面三个 ✗ 是真实缺陷而不是测试 bug**。

**为什么这条严重**

这三种失败场景下，用户看到的是：**一个停在标题页、按钮全都点不动、控制台才有错误的纯白/半屏页面。** 而且由于 `index.html` 的骨架本身是静态 HTML，标题和按钮看起来都在——**用户会以为是自己的问题**。

场景 ①尤其真实：GitHub Pages + CDN + 移动网络，脚本被截断或缓存损坏不算罕见。

**补充观察：TDZ 让这个坑更深**

`data.js` 一旦加载失败，后续脚本报的错是：

```
ReferenceError: Cannot access 'JOBS' before initialization
```

这是 **top-level `const` 的暂时性死区（TDZ）**。跨文件只能靠加载顺序保证，编译器**不给任何保护**（详见 C-02）。而这个错误信息对排障极不友好——它指向的是 `engine.js`，根因却在 `data.js`。

**改法**

把兜底提到 `<head>` 里用内联脚本注册（**这是唯一能覆盖全部失败场景的位置**）：

```html
<head>
  <script>
  window.addEventListener('error', function (e) {
    var el = document.getElementById('crash');
    if (el) {
      el.textContent = '⚠️ 脚本出错了：' + (e.message || 'unknown') +
                       '　请刷新页面；若反复出现，请清空浏览器缓存后再试。';
      el.classList.add('show');
    }
  });
  window.addEventListener('unhandledrejection', function (e) {
    var el = document.getElementById('crash');
    if (el) {
      el.textContent = '⚠️ 出问题了：' + String(e.reason) + '　请刷新页面重试。';
      el.classList.add('show');
    }
  });
  </script>
</head>
```

然后把 `ui.js:114-115` 那两行删掉（避免重复注册导致同一错误弹两次）。

> 注意：内联脚本执行时 `<body>` 还没到，`document.getElementById('crash')` 会返回 null——所以**监听器里要判空**（上面的代码已经判了），等事件真发生时 DOM 早就准备好了。

这条同时是优化方案的 **O-06**（首屏 `defer` 改造）的一部分，建议一起做。

---

### R-08 · 使用已废弃的 `escape` / `unescape`

| 项 | 值 |
|---|---|
| 严重度 | 低（**当前没有实测到 bug**） |
| 优先级 | P2 |
| 位置 | `assets/ui.js:87`（导出）、`ui.js:97`（导入） |
| 【连带影响】 | **仅 Web** |

**现状**

```js
const txt = btoa(unescape(encodeURIComponent(JSON.stringify(STATE))));   // 导出
const obj = JSON.parse(decodeURIComponent(escape(atob(txt))));           // 导入
```

`escape` / `unescape` 是 ECMAScript **Annex B** 遗留 API，已废弃，且依赖**非标准**的 `%uXXXX` 扩展来处理 > U+FFFF 的字符（emoji 就在这一段）。

**round-trip 实测（G 组）—— 目前是好的**

| 用例 | Base64 长度 | 结果 |
|---|---:|---|
| 纯中文 | 32 | ✓ 一致 |
| emoji（含非 BMP） | 32 | ✓ 一致 |
| 混合 | 40 | ✓ 一致 |

**所以这不是火烧眉毛的 bug。** 但它是「依赖一个已被明确废弃、随时可能被移除的 API」——随着时间推移风险只会上升不会下降。

**改法（UTF-8 安全的标准写法）**

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

> **兼容性核对（必做）**：`TextEncoder` / `TextDecoder` 在所有现代浏览器可用，**但部分老版本 Android WebView（特别是微信内置的老版本）可能没有**。建议加一句 feature detect，缺失时回退到现在的 `escape` 方案：
> `if (typeof TextEncoder !== 'undefined') { …新方案… } else { …旧方案… }`

---

### R-09 · 导入存档码只校验 `obj.stats` 存在

| 项 | 值 |
|---|---|
| 严重度 | 低 |
| 优先级 | P2 |
| 位置 | `assets/ui.js:93-105`（`importSave`） |
| 【连带影响】 | **仅 Web** |

```js
const obj = JSON.parse(decodeURIComponent(escape(atob(txt))));
if (!obj || !obj.stats) throw 0;
STATE = obj;          // ← 直接赋值，不做形状校验
lsSet(LS.auto, STATE);
enterGame();
```

只要 `obj.stats` 存在，任意结构的 JSON 都会被直接赋给 `STATE` 并立即 `enterGame()`。

**已确认的关键事实**：`enterGame()`（`ui.js:290`）会先调 `marketMigrate(STATE)` 再调 `migrateState(STATE)`。也就是说：

- ✅ **好消息**：导入路径**确实会走迁移**，不是裸赋值就跑。
- ⚠️ **坏消息**：正因为会走迁移，**R-01 的缺陷会直接命中导入路径**——导入一个缺 `log` / `flags` 的旧存档码，就是 `migrateState` 漏兜底 → 白屏。

> 换句话说：**「玩家从网上/朋友那里拿到一个旧版存档码并粘贴进来」是 R-01 最容易触发的真实场景之一**，比「localStorage 里躺着旧存档」还容易遇到（因为这个游戏有导出/导入功能，存档码是会被分享的）。这也把 R-01 的优先级钉死在 P0。

**改法**：形状校验 + 和 R-01 / R-06 一起做。R-06 补上版本判断后，这里就可以按版本走不同的迁移严格度。

---

## 3. 耦合风险清单

### C-01 · 377 个顶层标识符共享同一个全局词法作用域

| 模块 | 顶层标识符 | 其中 function | 其中 const/let | KB |
|---|---:|---:|---:|---:|
| data.js | 34 | 0 | 34 | 161.1 |
| market.js | 31 | 21 | 10 | 25.7 |
| engine.js | 107 | 95 | 12 | 99.7 |
| school.js | 27 | 18 | 9 | 23.7 |
| career.js | 10 | 8 | 2 | 21.8 |
| love.js | 32 | 29 | 3 | 31.5 |
| loan.js | 9 | 7 | 2 | 6.3 |
| ui.js | 127 | 108 | 19 | 98.3 |
| **合计** | **377** | **286** | **91** | — |

**正面结论**：
- ✓ **8 个文件之间没有任何重名** —— 这是目前**唯一**在保护这套架构的东西
- ✓ **没有任何顶层 `function`/`var` 覆盖 window 内建成员**

**风险**

这个架构的约束力来自「开发者记得住全部 377 个名字」。它的失效模式是**静默的**：

```
某天有人在 career.js 里加一个 `const helper = (x) => …`
同一周有人也在 love.js 里加同名 helper
→ 加载时 SyntaxError: Identifier 'helper' has already been declared
→ 整页白屏，且因为 ui.js 还没注册兜底（R-07），连横幅都没有
```

**缓解建议（成本低）**

加一条 CI / 发布前检查：跑一遍 `coupling-probe.js`，只要第 2 节不再是「没有重名」就 fail。这个脚本已经有了，不需要额外开发。

---

### C-02 · TDZ：加载顺序是硬性的，但**没有任何机器校验**

| 测试 | 结果 |
|---|---|
| 正常顺序 | 运行期错误 **0** 条 |
| 把 `data.js` 和 `school.js` 换位置 | 错误 **2** 条，首条：`ReferenceError: GAME_META is not defined` |
| 把 `engine.js` 和 `love.js` 换位置 | 错误 **1** 条，首条：`ReferenceError: JOBS is not defined` |

**为什么换位置会炸**

8 个文件之间没有 `import` / `export`，全靠「都在同一个全局作用域里」。而**顶层 `const` 存在暂时性死区（TDZ）**——`engine.js` 顶层引用的 `JOBS`（声明在 `data.js`）必须在 `engine.js` 执行**之前**完成初始化。

> 注意：`function` 声明会被提升跨文件可用，**顶层 `const` 不会**。这就导致这套架构的敏感性是**混合的**：换位置有时炸有时不炸，取决于那条依赖是 function 还是 const。**这种不确定性是最危险的。**

**`index.html` 里那 8 行 `<script>` 的顺序，是全项目最重要、也最脆弱的一处「配置」。**

**缓解建议**

1. **给这 8 行加一行注释**：`<!-- ⚠️ 顺序敏感，勿调整：data → market → engine → school → career → love → loan → ui -->`
2. **把 `coupling-probe.js` 的顺序敏感性测试纳入 CI**：目前脚本里已经实现了（故意调换后看报什么错）。
3. **如果要加 `defer`（O-06）必须先完整冒烟**：虽然 `defer` 规范保证顺序执行，但在这种「把加载顺序当硬约束」的架构上，**任何时机变化都值得一次完整的端到端验证**。

---

### C-03 · 崩溃兜底依赖最后一个文件 —— 加载期是裸奔的

这条是 **R-07 的架构层解释**，不重复。要点：**可用性兜底和资源加载在同一个依赖链的最末端**，这是兜底设计的大忌。兜底必须尽可能早、尽可能独立于被兜底的系统。

---

### C-04 · **Web 与小程序共享逻辑层，且是「构建期拼接」**

> 🔴 **这是本次评审发现的最重要的工程风险**，虽然它当前状态是健康的。

`cangame-mp/tools/build-engine.js` 把 7 个逻辑层文件**原样拼接**成 `cangame-mp/engine/bundle.js`：

```
源：cangame/assets/{data.js, market.js, engine.js, school.js, career.js, love.js, loan.js}
顺序敏感：data → market → engine → school → career → love → loan
前提：这 7 个模块不能碰 DOM / localStorage（已核验为 0 依赖）
```

**当前状态核对（只读）**

```
逻辑层最后修改：love.js   10-07 13:29
cangame-mp/engine/bundle.js  10-07 13:38      ← 同步 ✓
```

**风险点**

| 风险 | 后果 | 缓解 |
|---|---|---|
| **改了逻辑层忘记重跑 build** | 小程序停在旧版本，且**没有任何报错**——最难查的一类差异 | 把 `node tools/build-engine.js` 写进 CI / 发布 checklist |
| **新增 / 拆分 / 重命名逻辑层文件** | `build-engine.js` 写死了这 7 个文件名 → 新文件不会被拼进去 → 小程序运行时 `ReferenceError` | 这就是为什么优化方案里 **S-02（拆分 data.js）标记为「会打断小程序构建（禁止）」** |
| **逻辑层里引入 DOM / localStorage** | 破坏 bundle 的生成前提（注释里明确写了「已核验为 0 依赖」）→ 小程序直接崩 | 任何给逻辑层加持久化的改动都要先过这条检查 |
| 加载顺序敏感性**两边都有** | 小程序的 bundle 也是拼接后的顺序执行，C-02 的 TDZ 风险同样存在 | 同上 |

**正面评价**：这个设计本身是聪明的——用构建期拼接换取了「引擎怎么改，跑一条命令就同步」，避免了逐个加 `module.exports` 带来的强耦合。**问题只是它没有配套的自动化保障。**

---

### C-05 · `data.js` 一行都不能删 —— 但也不能因此就去删

跑了 60 局随机人生，统计事件池实际利用率：

| 组 | 条数 | 60 局中出现过 | 覆盖率 |
|---|---:|---:|---:|
| 本体 | 106 | 95 | 89.6 % |
| EVENTS_EXTRA | 66 | 65 | 98.5 % |
| EVENTS_FAMILY | 31 | 25 | 80.6 % |
| EVENTS_FAMILY2 | 28 | 24 | 85.7 % |
| EVENTS_ERA | 10 | 10 | 100.0 % |
| **合计** | **241** | **219** | **90.9 %** |

> 更正说明：`data.js` 加载末尾有 `EVENTS.push.apply(EVENTS, EVENTS_EXTRA / FAMILY / FAMILY2 / ERA)`，四个子数组**在加载期就被合并进 `EVENTS`**。所以「376 条」是重复计数，**运行时真正的池就是 241 条**。

**解读**

- 90.9 % 的覆盖率说明：**没有任何一行 data.js 是加载时可以省掉的**。
- 但**「没被抽到」≠「没用」**——那 22 条没被抽到的大多是低概率 / 强条件事件，它们是内容深度的一部分。**不能拿这张表去做内容裁剪。**
- 这张表的正确用途是：**堵住「把 data.js 拆小来提速」这个提案**（见优化方案 S-02）。既然删不掉，唯一能做的就是「晚点加载」，而那意味着动加载顺序——见 C-02。

---

## 4. 正面结论 —— 这个项目做对了什么

评审不应该只列问题。以下几项在实测中**全部通过**，是项目本身的优势，改动时要小心别破坏：

| # | 通过了什么 | 证据 |
|---|---|---|
| 1 | **10 项除零 / 空集合路径全部通过** —— `loan.years=0`、`loan.left=0`、`stock.cost=0`、空 property 列表、`family.assets=0`、`career=null`、`parents=null`、空 classmates、空 love candidates、`credit=null` | B 组 10/10 ✓ |
| 2 | **8 种极端数值注入，一个异常都没抛** | A 组抛错次数全为 0（脏文本是另一回事，见 R-05） |
| 3 | **localStorage 完全不可用时游戏不崩溃** | D 组 ✓（只是没提示，见 R-02） |
| 4 | **存档码 round-trip 三种字符集全部一致**（含 emoji / 非 BMP） | G 组 3/3 ✓ |
| 5 | **8 个文件之间零重名** | coupling §2 ✓ |
| 6 | **没有任何顶层声明覆盖 window 内建 API** | coupling §4 ✓ |
| 7 | **`bind()` 做了元素缺失容错** —— 单个 DOM 元素缺失不会让后续所有按钮失效 | `ui.js:120-124` |
| 8 | **`uiConfirm()` 做了弹窗缺失容错** —— `#confirmBox` 不在时直接执行回调而不是崩溃 | `ui.js:21-29` |
| 9 | **`hasSave()` 做了形状检查** —— 不只是判断非空，还判断 `a.stats` 存在 | `ui.js:52-55` |
| 10 | **`socialActAll` 是引擎侧批量执行** —— 「一键和所有人叙一遍」只触发一次 `afterAct`，没有 N 倍渲染放大 | 见 `perf-profile.md` §3.6.6 |
| 11 | **`ui.js` 是逻辑层的唯一消费者** —— 渲染改造不会波及玩法数据 | coupling §3，见 `perf-profile.md` §7 |
| 12 | **迁移兜底覆盖率很高** —— C 组逐个字段删除测试中，25 个字段里只有 `log` / `flags` 失败，其余 23 个都能正确补回 | C 组 |

> 第 1 和 第 2 项尤其值得肯定。一个随机性这么强的模拟游戏，边界防御做到这个程度是超出平均水平的。**当前发现的缺陷都是「最后 5 %」的问题，不是基础薄弱。**

---

## 5. 建议修复批次

| 批次 | 内容 | 合计改动量 | 理由 |
|---|---|---|---|
| **Batch A · 必修（下一个发布窗口前）** | R-01、R-02、**R-04** | **≈ 15 行** | 一个是白屏、一个是静默丢档、一个是安全 |
| **Batch B · 该修** | R-03、R-07、R-05 | ≈ 20 行 | 提升排障能力与界面整洁度 |
| **Batch C · 技术债** | R-06、R-08、R-09 | ≈ 30 行 | 防止未来翻车 |

### 回归方式

```bash
cd production/phase6-polish/perf/scripts
node robust-fuzz.js      # ✗ 条目应归零（Batch A 后：R-01/R-02/R-04 对应的 ✗ 消失）
node coupling-probe.js   # 必须仍为「没有重名」+ 正常顺序 0 错误
```

**建议把这两个脚本纳入发布检查清单**——它们已经写好了，不需要额外投入。

**人工冒烟清单（每条 fix 后都要走一遍）**：
1. 新建一局 → 玩到结局页
2. 人际页五个 tab 逐个点
3. 工作页 + 市场买卖
4. 存档：导出 → 清空 → 导入，确认能续上
5. 手动存档槽 1/2/3 存取
6. 隐私模式下打开 → 确认有提示而不是白屏

---

## 6. 诚实清单：这份评审里我没把握 / 没做的部分

| # | 不确定项 | 为什么 | 建议怎么消除 |
|---|---|---|---|
| 1 | **R-04 在真实浏览器上是否真的可执行 XSS** | jsdom 里 `__PWNED = 0`，我**没有真机/真实浏览器**去验证 | **按存在漏洞处理**（修 1 行）；同时找一台真实浏览器验证一次，把结论补进来。**我不宣称它是已确认的 XSS**。 |
| 2 | R-01 里 `flags` 的正确默认形状 | 我读了 `migrateState` 但**没逐个对照 `mkState()`** 的字段 | **落地前必须先读 `mkState()`**，本文给的 `{ past_life: false }` 只是示意 |
| 3 | R-05 里 NaN 的**产生源头**（哪个玩法公式） | 那是数值平衡问题，属 QA-01 域，这次没深挖 | 建议转给 quality-lead，用 A 组的注入用例反查 |
| 4 | R-02 在各平台的具体触发概率 | 依赖浏览器 / WebView 行为，无真机 | iOS Safari 隐私模式是最高概率场景，优先用真 iPhone 验证 |
| 5 | 各平台 / 各 WebView 版本上存储的**真实行为差异** | 需要真机矩阵，本次只有 jsdom | 优先覆盖：iOS Safari 隐私模式、微信内置 WebView、低端 Android WebView |
| 6 | `cangame-mp` 是否真的调用 `migrateState` | 我只读了 `tools/build-engine.js`，**没有读小程序业务代码**（scope 约束） | 如果 Mini Program 侧真的调用（大概率），R-01/R-06 的修复对它同样有效，是一次「改一处两端受益」 |
| 7 | `#inputName` 之外是否还有其他可控输入进入 `esc()` | E 组只测了姓名一条路径 | 建议做一次全量 grep：`esc(` 落在双引号属性里的调用点清单，逐个确认 |
| 8 | **为什么没加 CSP** | 本项目大量使用 `onclick="..."` 内联 handler，`Content-Security-Policy` 一旦启用会全部失效 | **结论：暂时不要加 CSP。** 要加必须先完成 O-05（事件委托）把内联 handler 全部消灭。这件事值得单独立项，但不在 Phase 6 范围内。 |

---

## 7. 一句话总结

> cangame 的健壮性**底子是好的**——迁移兜底 25 个字段里兜住了 23 个、10 条除零/空集合路径全绿、8 种极端数值注入一个异常都没抛。
> 真正要补的是三件事：**① 缺 `log`/`flags` 的旧存档会白屏；② 存档写失败时用户完全不知情；③ `esc()` 不转义引号导致属性边界可被突破。**
> 这三件加起来 **15 行代码**，建议在下个发布窗口前完成。另外请尽快把 `node tools/build-engine.js` 写进发布 checklist——那是目前唯一一个「会静默出问题」的跨端风险。
