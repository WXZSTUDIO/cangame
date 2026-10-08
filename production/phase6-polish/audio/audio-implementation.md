# CANGAME 音频实现策略 · Audio Implementation

> 作者：阮和鸣（audio-director） · Phase 6 Polish · v1.0
> **硬约束**：纯静态 · 零依赖 · 零构建 · GitHub Pages 托管 · 不得引入 Howler/Tone.js 等库
> 所有行号基于 `assets/*.js` 现状（v5.5.0）核对

---

## 0. 决策摘要

| 决策项 | 结论 | 理由 |
|---|---|---|
| **音频 API** | **Web Audio API**（原生） | 唯一能「不用音频文件」的方案 |
| **是否引入库** | ❌ **坚决不引入** | 违反项目零依赖铁律；本项目所需 API 极浅，库只会增加 20–70KB |
| **MVP 音频资源** | **0 个文件**（程序化合成） | 0 字节、0 带宽、0 版权风险、0 加载失败率 |
| **`<audio>` 标签用不用** | MVP **不用**；仅若将来上 BGM 才用 | `<audio>` 只能播文件；对短促 UI 音有害（多实例、切换延迟） |
| **默认开关状态** | **SFX 默认开（低音量）· BGM 默认关** | 若默认关，绝大多数玩家永远不会发现这里有音频 |
| **偏好存储 key** | **`cangame_audio_v1`（新建，独立）** | ⚠️ 不可用现有 `LS.pref`，会被整体覆盖，详见 §5.2 |
| **降级哲学** | **静默降级，永不报错** | 音频是装饰层，任何情况下不得拖垮游戏 |
| **小程序复用** | 逻辑层（合并/降噪/优先级）✅可复用；**音频 API ❌需替换** | 见 `sfx-event-list.md` §6 |

---

## 1. 为什么是「程序化合成」而不是「下载音效包」

这是本项目最契合的一个选择，四条理由互相加强：

| # | 理由 | 说明 |
|---|---|---|
| 1 | **契合零依赖铁律** | Web Audio 是浏览器原生 API。合成器代码 ≈ 150 行纯 JS，没有包、没有 CDN、没有版本号地狱 |
| 2 | **契合 GitHub Pages 体积/带宽考量** | MVP **增加 0 字节**。对比下载一套 CC0 音效包：就算精挑 JSON+MP3 也要 200–800KB |
| 3 | **彻底消除版权风险**（独立开发者最贵的东西） | 合成音是自己算出来的波形，**不存在授权链**。免费素材站普遍存在「标称 CC0 实为搬运」的隐患（详见 §7.3），逐个核验要花的时间远超写 150 行代码 |
| 4 | **天然支持微随机，抗重复疲劳** | 每次触发可给 ±0.3% detune / ±15ms 起音抖动。文件音效每次**完全一样**，重复 100 次后必然腻；这是纯额外的声学收益 |

### 1.1 但有一个明确的边界：不要用合成做 BGM

⚠️ **程序化合成的适用范围是「短促 SFX」，不是「音乐」。**

- 合成器音乐听起来像 8-bit / demo，会把本作的完成度往回拉
- 「和问题洞察」：合成 SFX 之所以 OK，是因为**短音不需要真实感**（铅笔、点击、铃都是抽象音色）；而音乐需要**真实的乐器共鸣**
- ➡️ 若将来上 BGM，**必须是真实录音/高质量采样**（见 `music-direction.md` §7 R1）

---

## 2. 模块结构与接入方式

### 2.1 新增唯一文件：`assets/audio.js`

```
assets/
  data.js  market.js  engine.js  school.js
  career.js  love.js  loan.js  ui.js
+ audio.js          ← 新增，约 150–200 行，无 外部引用
```

### 2.2 加载位置：放在**第一位**（`index.html` 第 226 行之前）

```html
<script src="assets/audio.js?v=5.6.0"></script>   <!-- 新增，放在最前 -->
<script src="assets/data.js?v=5.6.0"></script>
<script src="assets/market.js?v=5.6.0"></script>
...
<script src="assets/ui.js?v=5.6.0"></script>
```

**放最前的理由**：保证全局 `AU` 对象在任何业务模块加载时就已存在。项目是「按序加载 + 全局函数」的老式结构，先到先得最安全、心智负担最低。

> 📌 版本号建议同步推进到 `v=5.6.0`，避免 GitHub Pages 的 CDN/浏览器缓存导致部分游客拿到旧的 HTML + 新的 JS 或反之。

### 2.3 零风险模式：可选依赖 + no-op 存根

这是本方案的**安全底座**。

`audio.js` 对外只暴露 4 个方法，且**全部在不可用时空转**：

```js
/* 对外 API —— 必须全部是「不可能抛异常」的 */
const AU = {
  emit(id)               { /* 无音频时的候选入队；不可用则 return */ },
  setMuted(v)            { /* 静音开关 + 持久化 */ },
  isMuted()              { /* 读开关 */ },
  unlock()               { /* 首次用户手势解锁 AudioContext */ }
};
```

**业务侧调用点全部写成 `AU.emit('au.xxx')`**：
- `audio.js` 没加载？→ 引用报错。**缓解**：在调用侧统一写 `typeof AU !== 'undefined' && AU.emit(...)`，**或者**更干净地——在 `audio.js` 内把自己挂成 window 全局，并在 `index.html` 里确保一定加载（静态站点，不存在加载失败的其他 resource 之外的场景）。

📌 **我推荐的做法**：既然是**单个静态文件、与 HTML 同一个 origin**，`script` 标签几乎不可能单独加载失败。**但**为了「任何情况下不拖垮游戏」的原则，仍建议在 `ui.js` 顶部加一句兜底：

```js
if (typeof AU === 'undefined') {
  window.AU = { emit(){}, setMuted(){}, isMuted(){ return true; }, unlock(){} };
}
```

**代价 3 行，收益：音频层 100% 不可能崩游戏。** 强烈建议采纳。

---

## 3. 核心实现：同步代码

> 这是给 engineering-lead 的**可直接实现**的规格，不是伪代码示意。

### 3.1 全景骨架

```js
/* assets/audio.js  —— 零依赖 · 可选降级 · IIFE 封装 */
const AU = (function () {

  /* ---------- 常量 ---------- */
  const PREF_KEY  = 'cangame_audio_v1';      // ⚠️ 不用 LS.pref，见 §5.2
  const MAX_VOICES = 12;                      // 同发语音数上限
  const MIN_GAP = [80, 220, 0];               // 三档最小间隔(ms)，见 §3.5
  const PRI = { /* 见 sfx-event-list.md §4.3 优先级表 */ };
  const TAG_TO_SFX = { /* 见 sfx-event-list.md §3.D–G 的【族名】映射 */ };

  /* ---------- 运行时状态 ---------- */
  let ctx = null, master = null, sfxBus = null, bgmBus = null;
  let noiseBuf = null;
  let ready = false, muted = false, voices = 0;
  let pref = loadPref();
  muted = !!pref.muted;

  /* ---------- 帧收集队列 ---------- */
  let q = [], scheduled = false, lastAt = 0;
  const recent = [];   // 时间戳滚动窗口，用于连点降噪

  /* ================= 对外：emit ================= */
  function emit(id) {
    if (!ready || muted) return;              // ← 静默降级第一道闸
    q.push(id);
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(flush);            // ← 微任务：当前同步帧末统一裁决
  }

  /* ================= 裁决 + 限速 ================= */
  function flush() {
    scheduled = false;
    if (!q.length) return;
    let best = q[0];
    for (const id of q) if ((PRI[id] || 0) > (PRI[best] || 0)) best = id;
    q.length = 0;                              // 丢弃同帧其余候选（帧内合并）

    const now = Date.now();
    recent.push(now);
    while (recent.length && now - recent[0] > 2000) recent.shift();

    const mode = dampMode();                   // 0=正常 1=快进 2=连发
    if (mode === 2 && (PRI[best] || 0) < 85) return;
    if (mode === 1 && (PRI[best] || 0) < 70) return;
    if (now - lastAt < MIN_GAP[mode]) return;
    lastAt = now;

    if (voices >= MAX_VOICES) return;          // 同发语音数硬上限
    render(best);
  }

  function dampMode() {
    const n = recent.length;                   // 近 2 秒发声次数
    if (n >= 8) return 2;                      // 连发档
    if (n >= 4) return 1;                      // 快进档
    return 0;
  }

  /* ================= 解锁（自动播放策略）================= */
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;                       // 老浏览器：永久降级为无声
        ctx = new AC();
        buildBuses();
      }
      if (ctx.state === 'suspended') ctx.resume();
      ready = true;
    } catch (e) { ready = false; }             // ← 静默降级第二道闸
  }

  function buildBuses() {
    master = ctx.createGain();  master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();       // 防叠加削波，见 mixing-notes §3
    sfxBus = ctx.createGain();  sfxBus.gain.value = pref.sfx ?? 0.8;
    bgmBus = ctx.createGain();  bgmBus.gain.value = pref.bgm ?? 0;
    sfxBus.connect(master); bgmBus.connect(master);
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = makeNoise(ctx, 1.0);            // 1s 白噪，全局复用
  }

  return { emit, unlock, isMuted: () => muted, setMuted, /* … */ };
})();
```

### 3.2 自动播放限制的完整处理

浏览器策略：**首次用户手势前，AudioContext 处于 `suspended`，任何发声都是静默的。**

三条落地措施，**缺一不可**：

| # | 措施 | 代码位置 | 说明 |
|---|---|---|---|
| 1 | **全局一次性手势监听解锁** | `audio.js` 内部 | 见下方 (a)。本项目首屏第一个手势天然是「开始新的人生」(`ui.js:1848` btnNew) 或「继续」(`:1849`)，**恰好在游戏任何声音之前**，无需改任何 UI 文案 |
| 2 | **每次手势后 `resume()`** | 同上 | iOS/Safari 会在切后台、来电后把 context 挂起；`resume()` 幂等且极廉价，可无脑每次调用 |
| 3 | **页面可见性联动** | 同上 | 见下方 (b)。省电 + 避免「切后台还在响」的社死场景 |

```js
// (a) 手势解锁：capture 阶段 + passive，不影响任何现有点击逻辑
['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
  document.addEventListener(ev, () => { unlock(); }, { capture: true, passive: true })
);

// (b) 可见性联动
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { ctx.suspend(); }
  else { unlock(); }                    // unlock 内含 resume
});
```

> ⚠️ **已知 iOS 限制（无法绕过，请写进 QA 验收的已知事项）**：
> iOS Safari 会让 Web Audio 遵守**机身静音键**。静音键打开时游戏无声，且**前端无法检测**。
> 这是设计如此，**不要试图 hack**（常见 hack 会显著增加复杂度且不稳定）。
> 缓解：首次进入时的引导里明确提示「关闭静音键可获得音效」，并且确保**静音时游戏 100% 可玩**。

### 3.3 三个业务侧挂载点（工程侧只需改这 3 处）

| # | 位置 | 改动 | 说明 |
|---|---|---|---|
| **1** | `engine.js:852` `pushLog()` | 函数开头加 ~6 行：嗅探 `【族名】` → `TAG_TO_SFX` 查表 → `AU.emit(id)`；查不到则按 `type` 落 `au.result.good / bad / neutral` | **一次覆盖全部 119 个调用点** |
| **2** | `ui.js:1361` `renderItem()` | 在呈现卡片的分支里按 `item.type` emit `au.card.open` / `au.exam.start` / `au.invest.offer` | 与 #1 走同一套帧内合并，不会叠音 |
| **3** | `ui.js:1547` `renderEnd()` 或 `:1540` `finishGame()` | emit `au.meta.ending`（若 `STATE.rank` 差或 `forceEnd` 走了死亡，用 `au.meta.ending.bad`） | 结局页是唯一允许「长音」的地方 |

加分项（可选，非必须）：
- `ui.js:335` 成就 toast 分支 → `au.meta.achievement`（**建议做**，成就反馈的手感提升最大）
- `school.js:382` `qz.done = true` → `au.exam.reveal`（**建议做**，这是全游戏最戏剧化的瞬间之一）
- `init()` 内加一个 `.btn` 委托 → `au.ui.tap`（可选，注意别吵）

> 🔑 **关键提醒**：`au.year.tick` **不要挂在 `advance()` 里 emit 后立刻播**，而是把它作为最低优先级候选 emit 出去。这样本帧若有任何真实事件，tick 会被帧内合并自动吃掉；只有「这一年无事发生」时才轻响一声。这是**让游戏有呼吸感**的关键设计。

### 3.4 `【族名】` 嗅探的实现草案（可直接粘贴）

```js
function pushLog(state, text, type) {                 // ← engine.js:852
  try {
    const t = type || 'story';
    let id = null;
    const m = /^【([^】]{1,6})】/.exec(text);          // 取【晋升】→"晋升"
    if (m && TAG_TO_SFX[m[1]]) id = TAG_TO_SFX[m[1]];
    if (!id) {
      if (t === 'money') id = 'au.result.good';
      else if (t === 'warn') id = 'au.result.bad';
      else if (t === 'end') id = 'au.meta.ending';
      // muted / story / stat → 保持 null（默认静音）
    }
    if (id) AU.emit(id);
  } catch (e) { /* 音频层绝不影响主流程 */ }

  state.log.push({ /* …原有逻辑不变… */ });
}
```

⚠️ **务必把原有 `pushLog` 体放进同一种保护之外**：建议保持原有语句**一字不改**，只在最前面加上述 try 块，这样回滚音频只需删掉这一小块。

### 3.5 连点降噪（对应 `sfx-event-list.md` §5）

已在 §3.1 的 `MIN_GAP` + `dampMode()` 中体现。三档：

| 档 | 近 2s 发声数 | 最小间隔 | 保留的优先级阈值 |
|---|---|---|---|
| 0 正常 | < 4 | 80ms | 全部 |
| 1 快进 | 4–7 | 220ms | ≥ 70 |
| 2 连发 | ≥ 8 | — | ≥ 85（结局/成就/丧亲） |

> 目的：`ui.js:1908` 的空格自动推进会让 `emit` 频率暴增。这套机制让**快进时自动安静，但关键时刻绝不漏音**。

---

## 4. 预加载 / 懒加载

**MVP 结论：不需要任何加载策略 —— 因为没有任何文件。**

这是程序化合成的一个被低估的好处：**彻底消灭了「资源没加载完就点了按钮」这一类 bug**。

若将来（`Phase 2`）引入 BGM，策略必须是：

| 项 | 策略 |
|---|---|
| 何时开始加载 | **进入 `screen-game` 之后**（`showScreen` 钩子），不要在标题页加载 |
| 方式 | `fetch` + `decodeAudioData` 到 AudioBuffer，**不用 `<audio>`**（可控性更好） |
| 体积预算 | 见 §6 |
| 加载失败 | `catch` → 仅关闭 `bgmBus`，**SFX 不受影响**（两条总线独立） |
| 预加载禁忌 | GitHub Pages 带宽充足，**但首次移动网络体验要照顾**：宁可晚 2 秒响，不要拖慢首屏 |

---

## 5. 偏好持久化（localStorage）

### 5.1 要存什么

```js
{ muted: false, sfx: 0.8, bgm: 0 }     // bgm 默认 0：Phase 6 无 BGM
```

### 5.2 ⚠️【必读】为什么不能用现有的 `LS.pref`

这是我在读代码时发现的**真实冲突**，务必告知 engineering-lead：

| 位置 | 代码 | 问题 |
|---|---|---|
| `ui.js:8` | `pref: 'cangame_pref_v1'` | 现有 prefs key，**已被使用** |
| `ui.js:163` | `const pref = lsGet(LS.pref) \|\| {}` | 读取 name/gender |
| **`ui.js:273`** | **`lsSet(LS.pref, { name, gender })`** | 🔴 **整体覆盖写！** 只写了 `{name, gender}` 两个字段 |

➡️ **后果**：若把音频偏好塞进 `LS.pref`，**每当玩家点「确认创建」（`confirmCreate` → `ui.js:273`）时，音频偏好就会被静默抹掉**，回到默认（有可能是「静音」）。玩家会反馈「我明明开了音效，重开会就关了」。这是很难查的 bug。

**两条解法，我推荐第 1 条：**

| 方案 | 做法 | 评价 |
|---|---|---|
| ✅ **推荐：独立 key** | `audio.js` 内部用 `'cangame_audio_v1'`，不碰 `LS.pref` | **零侵入**，不改动任何现有逻辑，无回归风险 |
| ⚪ 备选：合并写 | 改 `ui.js:273` 为 `lsSet(LS.pref, Object.assign(lsGet(LS.pref)\|\|{}, {name, gender}))` | 更规范，但要动别人已上线的代码，**收益不配比** |

> 📌 **顺带提示（非本次任务）**：`ui.js:273` 的整体覆盖写，将来任何想往 `LS.pref` 里加字段的人都会踩同一个坑。建议 engineering-lead 记入技术债清单。

### 5.3 存储安全

```js
function loadPref() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; }
  catch (e) { return {}; }        // 隐私模式 / 禁用 Storage → 偏好变挥发性，但不报错
}
function savePref(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
}
```

> Safari 无痕模式 / iOS Safari 的某些场景下 `localStorage` 会抛异常。**必须 try/catch**，这是降级矩阵的一项。

---

## 6. 格式与体积预算

### 6.1 MVP（程序化合成）

| 项 | 预算 |
|---|---|
| 音频文件 | **0 个** |
| 仓库增量 | **0 字节** |
| JS 增量 | ~150–200 行 ≈ **6–8 KB**（未压缩） |
| 运行时内存 | ~**180 KB**（唯一一个 1 秒 mono 白噪 AudioBuffer @ 44.1kHz ≈ 176KB） |

> 💡 白噪 buffer 可优化为 **0.25 秒 + loop**（≈44KB）。`BufferSourceNode.loop = true` 即可。**建议采用**，把运行时内存压到 ~50KB 以内。

### 6.2 Phase 2（若引入真实音频文件）

| 项 | 硬预算 |
|---|---|
| 全站音频总量 | **≤ 1.5 MB** |
| 单个 SFX | ≤ 20 KB（128 kbps mono mp3，300ms 绰绰有余，实际约 5KB） |
| 单条 BGM | ≤ 600 KB（建议 loop 控制在 45–75 秒） |

**格式取舍（请勿忽视可播放性）**：

| 格式 | 体积 | 兼容性 | 结论 |
|---|---|---|---|
| **Opus (.ogg)** | 最优 | iOS Safari 支持较晚，仍存风险 | ⚪ 不建议作为唯一格式 |
| **MP3** | 中 | **全平台通吃** | ✅ **推荐主格式**（或 m4a） |
| AAC (.m4a) | 优 | 全平台（含 iOS）良好 | ✅ 可作为替代主格式 |
| WAV | 极大 | 全平台 | ❌ 禁止用于交付 |

> 本站 GitHub Pages 的体积压力并不大（仓库 2.4MB），**真正的约束是移动端首屏体验与播放器兼容性**。因此这里明确推荐 **MP3 / m4a 而非 Opus**，尽管 Opus 更小。**兼容性优先于体积。**

### 6.3 性能预算

| 指标 | 上限 | 保障措施 |
|---|---|---|
| **同发语音数** | **12** | `voices >= MAX_VOICES` 直接丢弃（见 §3.1）。本方案每音最多 3 个 node，12 并发 ≈ 36 nodes，对移动端毫无压力 |
| **节点生命周期** | 除 ending (≤2.5s) 外全部 ≤ 800ms | 每个 node 都 `stop(t + dur + tail)`；Web Audio 自动回收 |
| **AudioContext 实例数** | **严格 1 个** | 🔴 **关键 gotcha**：iOS 对 context 数量有硬限制（约 4 个），超限后**音频永久失效且难以恢复**。绝不可「每次发声 new 一个」 |
| **主帧影响** | 0 | 全部 `emit` 只是数组 push（< 1μs）；真正的发声在微任务里，且 Web Audio 在独立音频线程渲染 |
| **首屏影响** | ≈ 0 | 无网络请求，无 decode |

---

## 7. 资产获取 / 制作路径建议（给独立开发者的成本–风险评估）

> MVP 不需要任何资产。**本节为「若将来要用真实素材」做准备。**

### 7.1 四条路径对照

| # | 路径 | 成本 | 体积 | 版权风险 | 我的建议 |
|---|---|---|---|---|---|
| **1** | **程序化合成（Web Audio）** | ~0 元，半天 | **0 字节** | **零风险** | 🏆 **MVP 强烈推荐** |
| **2** | CC0 免费素材库 | 0 元，需筛选 | 中 | 🟡 **中** | 备选，见 §7.3 的坑 |
| **3** | 委托音乐人/购买 | 数百–数千元/条 | 小 | 🟢 低（买断合同） | 只在真上 BGM 时考虑（一次性买断） |
| **4** | 自己录音 + 处理 | 设备+时间 | 小 | 🟢 低 | 适合纸、笔、门、脚步等拟音 |

### 7.2 CC0 素材库清单（若走路径 2）

| 来源 | License | 备注 |
|---|---|---|
| **Kenney.nl** | CC0 (Public Domain) | 🏆 **游戏音效首选**。游戏向、风格统一、无需署名。强烈推荐先扫这里 |
| **Pixabay Audio / Music** | 自有宽松协议 | 量大质不均，需筛 |
| **freesound.org** | **逐条不同**（CC0 / CC-BY / CC-BY-NC / Sampling+） | ⚠️ **必须逐条点开确认**。CC-BY 需署名，CC-BY-NC **禁止商用** —— 混一条进来就有合规问题 |
| **Sonniss / GameAudioGDC 免费包** | 各自协议（多为免商用） | 质量高，但需读协议 |
| BBC Sound Effects | RemArc | 有非商用限制，**商业项目慎用** |
| Adobe 免费音效库 | 需 Adobe 账号 | 可用，但需确认二次分发权 |

### 7.3 ⚠️ 免费素材的三个真实坑（请务必知悉）

| 坑 | 说明 | 防御 |
|---|---|---|
| **标称 CC0 实为搬运** | 素材站存在用户上传他人作品并标 CC0 的情况，**原作者可追溯维权** | 优先选**官方发布**的知名包（Kenney、Google 的 UX sounds）；避免冷门上传者 |
| **"Free for personal use"** | 很多「免费」仅限个人非商用 | 逐条查清 **`Commercial use`** 字段 |
| **AI 生成音效的授权不明** | ElevenLabs SFX / Stable Audio 等的产出物商业授权随套餐变化，**且训练数据来源存疑** | 本项目不必冒这个风险；程序化合成比你想象的够用 |

### 7.4 我的最终建议

> **MVP：路径 1（全合成），一条 100% 干净的路。**
> **若日后觉得合成音「不够高级」**，先给 Kenney.nl（CC0、无需署名、风格统一）的机会做对比测试，仍然是 0 元 0 风险。
> **只有在确定要 BGM 时**，才考虑路径 3 的花钱方案——并务必签**买断 + 可商用 + 可分发**的书面条款。

---

## 8. MVP 音效合成参数规格（可直接交给工程实现）

全部只用到：`OscillatorNode` / `GainNode` / `BiquadFilterNode` / `AudioBufferSourceNode`（噪声）。
**无需 IR 文件、无 Convolution**。需要「空间感」时用 **feedback delay**（`DelayNode` + `GainNode` 反馈环）替代混响——零资产的常用技巧。

> 电平单位为**相对值**（0–1），最终总线削减见 `mixing-notes.md`。
> 「detune 抖动」= 每次播放给 freq 加 `±(Math.random()-0.5)*0.006` 倍微扰 + 起音时间 ±15ms，抗重复疲劳。

| ID | 波形 | 频率 | 包络 (A/D) | 滤波 | 时长 | 备注 |
|---|---|---|---|---|---|---|
| `au.ui.tap` | sine | 1800Hz → 1400Hz | A 3ms / D 45ms | LP 4kHz | 50ms | 笔尖点纸。最轻的合成音 |
| `au.year.tick` | triangle | 440Hz | A 2ms / D 30ms | LP 2.5kHz | 35ms | + 极短噪声花椒（bandpass 1.2kHz Q6, 20ms）。最连续性、必须最轻 |
| `au.card.open` | noise | — | A 8ms / D 130ms | **BP 扫频 800→3000Hz**, Q 1.2 | 150ms | 纸张滑动。这是"纸质感"的核心音 |
| `au.result.good` | triangle ×2 | C5 523.25 → E5 659.25 | 每音 A 4ms / D 130ms | LP 6kHz | 60ms 间隔 | 五声音阶**上行**。明亮不跳跃 |
| `au.result.bad` | triangle ×2 | A4 440 → E4 329.63 | 每音 A 4ms / D 180ms | **LP 1.2kHz**（压暗） | 70ms 间隔 | 下行。**音量与 good 持平**，靠低通表达负面 |
| `au.exam.answer` | noise + sine | 噪声 BP 2.5kHz Q8 + sine 900Hz | A 2ms / D 60ms | — | 70ms | 铅笔填涂。**正误同音**（见 sfx 表 §3.F） |
| `au.exam.reveal` | triangle ×3 + noise | G4 392 → C5 523.25 → E5 659.25 | A 5ms / D 400ms（尾音） | LP 7kHz | 90ms 间隔 | 前加 40ms 噪声"悬停"。放榜戏剧性顶点 |
| `au.milestone.up` | triangle ×3 | C5 → E5 → G5 | A 5ms / D 300ms | LP 8kHz + 轻+H8 泛音 | 85ms 间隔 | 用于 晋升/录取/上岸/结婚/生子（各 variant 仅差起始八度与装饰） |
| `au.family.born` | sine + FM bell | 1046.5Hz 载波 | A 4ms / D 500ms | HP 600Hz | 2 音 | 「婴儿第一声哭」意象，但**克制**，别做成卡通婴儿啼哭 |
| `au.milestone.down` | triangle | C3 130.81 | A 8ms / D **900ms** | **LP 600Hz**（音色闷、像重物落地） | ~950ms | 单音 + 长余韵。含 `au.career.fire` / `au.edu.fail`。⚠️ 手机可闻性修正见 `mixing-notes.md` §4.2 |
| `au.family.loss` | sine + triangle | C3 130.81 + G3 196（五度） | A 10ms / D **1400ms** | LP **800Hz** 且包络内下滑 | ~1.5s | **最重的一音**。音量不提高——靠音区下沉 + 长尾表达（见 mixing §3） |
| `au.meta.achievement` | **FM bell** | carrier 1046.5 / mod ratio 3.5, index 480 | A 2ms / D **700ms** | HP 800Hz | 720ms | 最清亮、最易辨。使用 FM：一个 osc 的 output → 另一个 osc 的 frequency AudioParam |
| `au.meta.ending` | sine ×3 pad | C3 130.81 + G3 196 + C4 261.63 | A **300ms** / D **2200ms** | LP 3kHz | 2.5s | 唯一允许长起音的音。按 `STATE.rank` 调 LP（高 rank 更亮） |
| `au.meta.ending.bad` | 同上 | C3 130.81 + D#3 155.56（低二度，不协和但极弱） | A 400ms / D 2400ms | LP **900Hz** | 2.8s | 病逝/过劳。**唯一允许轻微不协和的场合** |

**派生变体规则**（避免为 10 个里程碑写 10 份代码）：
`au.milestone.up` 的 variant 只改两个参数：
- `au.career.promote`：基准起始八度 −1（更沉，有"重量"）
- `au.edu.admit` / `au.love.marry`：基准起始八度 +1（更亮/更暖，加 HP 400Hz 让它"轻"）
- `au.family.born`：装饰音换成 bell 泛音

> ✅ **这意味着核心只需要调好 3 个合成器（blip / bell / pad），其余全是参数化派生。**

---

## 9. 降级矩阵（Degradation Matrix）

| 异常场景 | 预期行为 | 玩家可见影响 | 保障点 |
|---|---|---|---|
| 浏览器无 `AudioContext` | `ready = false`，`emit` 直接 return | 完全无声 | §3.1 `try/catch` + 无 AC 分支 |
| `AudioContext` 处在 suspended（未手势） | 不发声，无报错 | 首个手势前无声（符合所有浏览器策略） | 手势监听自动 resume |
| iOS 静音键打开 | 系统级静音 | 无声（**无法前端检测**） | 游戏逻辑完整可玩 |
| `localStorage` 不可用 | `loadPref` 返回 `{}` | 每次进游戏回到默认音量 | try/catch |
|audio.js 未加载 | `AU` 存根空转 | 无声 | `ui.js` 顶部 3 行兜底（§2.3） |
| 合成参数异常（NaN 频率等） | `render()` try/catch | 少一声 | 建议包裹 |
| 同帧超量 / 连点 | 帧内合并 + 降噪 | 少几声，节奏干净 | §3.1 / §3.5 |
| Phase 2 BGM 加载失败 | `bgmBus.gain = 0` | 无音乐，**SFX 照常** | 总线隔离 |
| 页面切后台 | `ctx.suspend()` | 静音 | visibilitychange |

> **唯一不可接受的情况：音频层让游戏报错或点不动。** 上述每一行都有对应的 try/catch 或幂等保护。

---

## 10. 落地顺序建议（给 engineering-lead）

| 步 | 内容 | 产物 | 风险 |
|---|---|---|---|
| 1 | 新建 `assets/audio.js`（仅 `emit/unlock/setMuted` + 空 P 表 + 一个 `au.ui.tap`） | 能听见第一个音 | 无 |
| 2 | 接入 `index.html` 第一行 + `ui.js` 顶部 AU 存根 | 打通调用链 | 无 |
| 3 | 接入 `engine.js:852 pushLog` 挂载点 + `【】` 嗅探 + `type` 兜底 | 全游戏有声 | 低（可整体删除） |
| 4 | 补 `renderItem` / `renderEnd` / 成就 toast / `exam.reveal` 四个点 | 完成 | 低 |
| 5 | 加帧内合并 + 连点降噪 + voice cap | 不吵 | 低 |
| 6 | 加静音开关 UI + `cangame_audio_v1` 持久化 | 可控 | 低 |
| 7 | **在移动端真机（含 iPhone 静音键开/关、Chrome/Android）验证** | 验收 | — |

**回滚方案**：删除 3 处挂载点 + 移除 script 标签，代码回到 100% 原状。无需数据迁移（独立 localStorage key）。

---

## 11. 待用户/团队决策项

| # | 事项 | 类型 | 我的建议 |
|---|---|---|---|
| I1 | 是否接受「程序化合成」作为 MVP 方案 | 🔴 需拍板 | ✅ 建议接受，0 风险 0 成本 |
| I2 | SFX 默认值：开还是关 | 🔴 需拍板 | ✅ 建议**开**（低音量 + 显著静音开关），否则玩家永远发现不了 |
| I3 | 是否要做 `au.ui.tap`（所有按钮点击） | 🟡 | ⚠️ 建议**只给主操作按钮**，全按钮会在抽屉式 UI 里显得吵 |
| I4 | `neutral` 是否发声 | 🟡 | ⚠️ 建议**不发**（见 sfx 表 §3.B） |
| I5 | 是否在 `LS.pref` 上做修复 | 🟡 | ⚠️ 建议不修（独立 key 即可），记为技术债 |
| I6 | 是否同步把版本号推到 `v=5.6.0` | 🟢 | ✅ 建议，避免缓存不一致 |

---

*配套：`sfx-event-list.md`（事件表）· `mixing-notes.md`（混音）· `music-direction.md`（BGM 方向）*
