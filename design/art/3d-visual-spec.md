# cangame v4 · 3D 视觉规格（Liquid Glass · CSS 3D）

> **文件**：`design/art/3d-visual-spec.md`
> **版本**：v4.0-draft · **作者**：林绘澄（art-director） · **任务号**：ART-3D-01
> **基线**：`index.html`(169 行) + `assets/style.css`(163 行) + `assets/ui.js`(796 行) · 现有视觉基线为 v3「战术板 Chalkboard」
> **目标平台**：GitHub Pages 静态托管 / 纯前端 vanilla JS / 零构建、零 npm、无外部字体与 CDN

---

## 0. 前置：与 v3 美术圣经的关系（必读）

`docs/design/art-bible.md`（v3）第 9 节「反模式清单」明确写过 **「禁止毛玻璃滥用、渐变发光」**。
本规格**在用户显式锁定 Apple 流体玻璃（Liquid Glass）语言后，对该条作定向解除**，其余条款全部继承：

| v3 条款 | v4 处置 |
|---|---|
| 禁止毛玻璃滥用 | **解除**，但改为「受控使用」：同屏 blur 层 ≤6、blur 半径 ≤24px、滚动区默认关闭（见 §8） |
| 禁止渐变发光、霓虹外溢 | **保留**。辉光只允许出现在「选中态 / 焦点环 / 战术板地板反光」，且必须 ≤ 24px 半径、透明度 ≤ .35 |
| 禁止圆角大卡片网格 + 阴影堆叠 | **保留**。圆角统一 14–16px（不是 24px+）；阴影一律「1 层投影 + 2 层内高光」，禁止 3 层以上堆叠 |
| 禁止外部字体/图标库/CDN | **保留**。字体栈不变，全部几何用 CSS/SVG 生成 |
| 禁止无意义动效（粒子、漂浮、自动轮播） | **保留**。3D 只服务「层级表达」与「空间定位」，不装饰 |
| 等宽数字 + tabular-nums + 右对齐 | **保留并强化**（见 §6.5） |
| 粉笔圆头虚线语言 | **部分保留**：仅保留在战术板球场线（`.court-dim` 的 `stroke-dasharray:2 5`），UI 描边不再用虚线 |

**一句话定位变更**：v3 是「一块哑光战术板」；v4 是「一块悬浮在暗色球馆里的玻璃战术板」——粉笔线还在，但板子有了厚度、有了光。

---

## 1. 视觉定位与风格主张

> **一句话风格主张：**
> **「暗色球馆里的一叠悬浮玻璃战术板——橙色篮球是唯一光源，所有面板有厚度、有景深，但表格永远平、永远可读。」**

三条展开：

1. **空间即层级**：信息密度靠「谁离你更近」来表达，而不是靠边框和分割线。顶栏最近 → 操作面板次之 → 内容卡片再次 → 舞台最远。
2. **克制的热度**：整站只有一种暖色（篮球橙 `#ff7a3c`）+ 一种材质暖色（枫木地板 `#b07a3f`）。玻璃本身是冷中性的（微偏青灰），冷暖对比由「球场地板」单点提供。
3. **可读性不可谈判**：3D 只加在**容器**上，绝不加在**文字与数字**上。任何导致表格文字发虚、行错位、对比度下降的效果，一律撤回。

**禁止**：Three.js / WebGL / canvas 重写 / 任何 npm 依赖 / 任何外部资源。全部用 `perspective` + `transform-style: preserve-3d` + `rotateX/Y` + `translateZ` + `backdrop-filter` + 渐变伪元素实现。

---

## 2. 空间系统：Z 轴层级定义

### 2.1 层级表（全局）

| 层 | 名称 | `translateZ` | 用途 | 是否 `preserve-3d` |
|---|---|---|---|---|
| **L0** | 舞台 Stage | — | `body` 背景：深空渐变 + 球馆顶光 + 极轻噪点。**永不参与 3D** | 否 |
| **L1** | 底衬 Backplate | `0` | `.shell` 三栏容器骨架、`.view` 容器 | 否（flat） |
| **L2** | 面板 Panel | `8–12px` | `.card`、`.topbar`、`.nav`、`.side > .card`、`.tabs` | 否（叶子） |
| **L3** | 浮起 Raised | `18–28px` | hover/active/focus 的面板、`.team-btn:hover`、`.tab-btn.active`、`.nav-btn.active` | 否（叶子） |
| **L4** | 覆盖 Overlay | `60–90px` | 弹窗 `.modal-box`、下拉浮层、`#season-end.champion` | 否（叶子） |
| **C1** | 场地地板 Court floor | `-6px` | `#board::before` 木地板 | **是**（唯一真 3D 场景） |
| **C2** | 场地线/棋子 Court plane | `0` | `#board > svg.board` | 是（内部 flat） |
| **C3** | 场地玻璃罩 Court glaze | `18px` | `#board::after` 反光扫光 | 是（叶子） |

> **铁律 G1 · 全局只有 1 个真 3D 场景**：整个页面只有 `#board` 允许 `transform-style: preserve-3d`。
> 其余所有「3D 感」一律用 **flat tilt**（元素自身 `transform: perspective(...) rotateX() translateZ()`，无 preserve-3d 子树）。
> 理由见 §8.4（backdrop-filter 与 preserve-3d 互斥，混用会导致玻璃「采不到背景」变成灰白雾面）。

### 2.2 Perspective 取值与透视原点

**原则**：共享透视（父级 `perspective` 属性）只用于「元素集合构成一个连贯舞台」的场景；滚动内容用**局部透视**（`transform` 里的 `perspective()` 函数），避免单一消失点在长滚动列里造成远端畸变。

| 容器 | 写法 | 值 | `perspective-origin` | 理由 |
|---|---|---|---|---|
| `#team-grid` | 属性 | `perspective: 1000px` | `50% 40%` | 42 张卡构成连贯阵列，共享消失点才有「一叠卡片」感 |
| `#board` | 属性 | `perspective: 900px` | `50% 34%` | 球场地板，视线略高于场地中线上方 |
| `.card` / `#hdr` / `.nav` / `.side` | 函数 | `perspective(900px)` / `(1400px)` / `(700px)` / `(700px)` | 元素自身 `transform-origin` | 局部透视，随滚动不产生累积畸变 |
| `.modal` 舞台 | 属性 | `perspective: 1100px` | `50% 45%` | 弹窗从深处推出的推进感 |

**`transform-origin` 约定**：
- 顶栏 `#hdr`：`50% 0%`（顶边固定，向下倾倒）
- 内容卡片 `.card`：`50% 0%`
- 左导航 `.nav`：`0% 50%`（左边缘固定，右缘向观众转 `rotateY(2.5deg)`）
- 右面板 `.side > .card`：`100% 50%`（右边缘固定，左缘向观众转 `rotateY(-2.5deg)`）
- 战术板 `svg.board`：`50% 50%`

### 2.3 透视缩放速查（`perspective(900px)`）

| `translateZ` | 视觉放大 | 适用 |
|---|---|---|
| 8px | ×1.009 | L2 面板常态 |
| 16px | ×1.018 | L3 卡片 hover |
| 28px | ×1.032 | L3 选队卡 hover |
| 60px | ×1.071 | L4 弹窗入场终点 |
| −24px | ×0.974 | 视图入场起点（后退） |

> 位移量本身极小（1–3%），**3D 感主要来自 `rotateX/Y` 的透视形变与阴影变化，不是来自缩放**。这是 Apple 式「克制」的关键。

---

## 3. 材质系统：玻璃面板配方

### 3.1 核心配方（`.glass` 通用类，供 `.card`/`#hdr`/`.nav`/`.tabs`/`.side` 复用）

```css
.glass{
  /* ① 对比度保底层：无论背后是什么，先压一层暗底，保证正文对比度 */
  background-color: var(--glass-floor);            /* rgba(11,17,20,.62) */
  /* ② 玻璃本体：上亮下暗的双向渐变，模拟厚度与透光 */
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.085) 0%, rgba(255,255,255,.022) 46%, rgba(255,255,255,.055) 100%),
    radial-gradient(120% 80% at 22% -12%, var(--light-1), transparent 62%);   /* 左上角主光 */
  /* ③ 景深模糊 */
  -webkit-backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat));
  backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat));             /* blur 12px / sat 180% */
  /* ④ 渐变发丝边框（多层背景 + border-box 裁剪，无需额外节点） */
  border: 1px solid transparent;
  background-origin: padding-box, padding-box;
  background-clip: padding-box, border-box;
  /* ⑤ 高光边（上亮 / 下暗）+ 投影（单层） */
  border-radius: 14px;
  box-shadow:
    inset 0  1px 0 rgba(255,255,255,.34),   /* 顶边高光 */
    inset 0 -1px 0 rgba(0,0,0,.34),         /* 底边环境遮蔽 */
    inset 1px 0 0 rgba(255,255,255,.10),    /* 左侧微高光 */
    0 18px 38px -14px rgba(0,0,0,.70);      /* 唯一一层外投影 */
  /* ⑥ 抗锯齿与合成提示 */
  isolation: isolate;
  backface-visibility: hidden;
}
```

> **配方要点（工程别改）**
> - **① 是刚需**：没有 `--glass-floor` 这个不透明度下限，正文对比度会随背后内容漂移，直接违反约束 §4。`.62` 是实测下限（见 §4.4 对比度核算）。
> - **④ 若不放心**（`background-clip: border-box` 在个别旧内核上的合成差异），降级为 `border:1px solid var(--glass-stroke)`（P0 可接受），发丝渐变边框列为 P1。
> - **⑤ 只有一层外投影**。禁止叠加第二层 `box-shadow` 投影做「光晕」——那是 v3 明令禁止的模板感。

### 3.2 厚度分层（同一个配方，三档强度）

| 档 | blur | `--glass-floor` | 边框高光 | 用在哪 |
|---|---|---|---|---|
| **薄玻璃 thin** | 8px | `rgba(11,17,20,.52)` | `.22` | 表格行 hover、`.tag`、`.mini-btn`、`.cup-card` |
| **标准 panel** | 12px | `rgba(11,17,20,.62)` | `.34` | `.card`、`.tabs`、`.side > .card` |
| **厚玻璃 chrome** | 16px | `rgba(11,17,20,.78)` | `.42` | `#hdr` 顶栏、`.nav` 导航（常驻不动、数量少，可吃贵效果） |
| **模态 modal** | 24px | `rgba(11,17,20,.86)` | `.48` | `.modal-box`（同屏仅 1 个，不占常规预算） |

### 3.3 卡片悬浮 / 按压的 3D 反馈

```css
/* ——— 常态 ——— */
.card{
  transform: perspective(900px) translateZ(var(--z-panel)) rotateX(1deg);
  transform-origin: 50% 0%;
  transition:
    transform 220ms var(--ease-out),
    box-shadow 220ms var(--ease-out),
    background-color 220ms linear;
}
/* ——— 悬浮：抬起 + 回正倾角（不是加大倾角！回正才像"凑近看"）——— */
.card:hover{
  transform: perspective(900px) translateZ(var(--z-raise)) rotateX(0deg);
  box-shadow:
    inset 0  1px 0 rgba(255,255,255,.42),
    inset 0 -1px 0 rgba(0,0,0,.34),
    0 28px 56px -18px rgba(0,0,0,.78);
}
/* ——— 按压 ——— */
.card:active{ transform: perspective(900px) translateZ(4px) rotateX(.6deg) scale(.994);
  transition-duration: 90ms; }
```

**规则**：
- **hover 倾角方向**：常态 `rotateX(1deg)`（微微后仰）→ hover `rotateX(0deg)`（回正并前移）。**不要** hover 时加大倾角，那样像"翻牌"而不是"凑近"。
- **内容卡片（`.view > .card`）不做鼠标跟随倾角**：正文密集，鼠标扫过时文字重采样会闪。跟随倾角只给 `#team-grid .team-btn`（§6.7）。
- **倾角幅度上限**：任何参与 3D 旋转且含 ≥13px 正文的元素，`|rotateX| ≤ 3°`、`|rotateY| ≤ 2.5°`。超过会触发位图重采样发虚。
- **选中态（`.nav-btn.active` / `.tab-btn.active`）** 用「嵌入凹槽」而非「抬起」：见 §6.2 / §6.3。

### 3.4 过渡曲线与时长（统一变量）

```css
--d-press: 90ms;    --d-fast: 120ms;  --d: 220ms;  --d-3d: 280ms;  --d-slow: 360ms;
--ease-out:   cubic-bezier(.22,.61,.36,1);   /* 通用出场 */
--ease-in:    cubic-bezier(.4,0,.2,1);       /* 通用入场 */
--ease-sheet: cubic-bezier(.32,.72,0,1);     /* Apple  sheets / 3D 推进 */
--ease-follow:linear;                        /* 跟随倾角：跟手，无缓动 */
--ease-settle:cubic-bezier(.32,.72,0,1);     /* 松开回弹 400ms */
```

---

## 4. 色彩系统

### 4.1 舞台底色（深色）

```css
--stage-0:#070b0d;   /* 最深处（页面四角、遮罩底） */
--stage-1:#0c1418;   /* 主舞台 */
--stage-2:#121d22;   /* 球馆顶光区，微微偏青（继承 v3 深灰绿基因） */
--stage-vignette: rgba(0,0,0,.55);
```

```css
body{
  background:
    radial-gradient(140% 90% at 50% -10%, var(--stage-2) 0%, var(--stage-1) 38%, var(--stage-0) 100%),
    var(--stage-0);
  background-attachment: fixed;      /* 视差滚动时背景不重绘，省性能 */
}
/* 球馆顶光：两盏冷白聚光 + 一抹橙（唯一暖源） */
body::before{
  content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
  background:
    radial-gradient(60% 40% at 18% -6%,  rgba(190,225,235,.10), transparent 70%),
    radial-gradient(50% 36% at 84% -4%,  rgba(190,225,235,.07), transparent 70%),
    radial-gradient(45% 30% at 50% 108%, rgba(255,122,60,.10),  transparent 72%);
}
```

> `body::before` 是**唯一**常驻的全屏光效层，`position:fixed` + `pointer-events:none`，不参与滚动重绘。

### 4.2 主色 / 强调色（篮球运动感）

```css
--accent:      #ff7a3c;   /* 篮球皮革橙 —— 唯一主色（沿用 v3，不变） */
--accent-hi:   #ffb066;   /* 高光端：渐变、hover、辉光 */
--accent-deep: #d9541a;   /* 暗端：按压、内阴影 */
--accent-a15:  rgba(255,122,60,.15);
--accent-a30:  rgba(255,122,60,.30);
--accent-glow: 0 0 24px -6px rgba(255,122,60,.45);

--hardwood-a:  #c08a4e;   /* 枫木地板亮部（战术板专用） */
--hardwood-b:  #8a5527;   /* 枫木地板暗部 */
--hardwood-key:#e6b277;   /* 地板高光（打蜡反光） */
--star:        #c084fc;   /* 球星紫（沿用 v3） */
```

**橙色预算**：全屏常驻的橙色像素占比 ≤ 6%。橙色只出现在——主按钮、选中态、`.you` 行、涨/关键数字、战术板地板反光、焦点环。**禁止**橙色背景大面积铺底。

### 4.3 文本层级色

| 角色 | 色值 | 用于 | 对比度（对玻璃面板） |
|---|---|---|---|
| 一级文本 | `--chalk: #eef2ee` | 正文、表头、卡标题 | **16:1** ✅ AAA |
| 二级文本 | `--chalk-2: #c3cec9` | 表体次要列、副标题 | **11.4:1** ✅ AAA |
| 三级文本 | `--chalk-dim: #9fb0a8` | 单位、说明、日志（沿用 v3 值） | **8.2:1** ✅ AAA |
| 四级文本 | `--chalk-mute: #6e7d77` | 占位符、禁用态（**仅用于非关键信息**） | 4.6:1 ✅ AA |
| 强调 | `--accent:#ff7a3c` | 主队、`.you`、关键数字 | **7.2:1** ✅ AAA |

> **新增 `--chalk-2`**：v3 只有两级文本色，玻璃上层次不够。原 `--chalk-dim` 降级为三级。
> **禁止**正文使用 `--chalk-mute`；它只给 `placeholder` / `[disabled]` / 装饰性角标。

### 4.4 玻璃面板上的对比度核算（必须留档）

玻璃合成后底色 ≈ `0.62 × rgb(11,17,20) + 0.38 × rgb(12,20,24)` ≈ `rgb(11.4, 18.1, 21.5)`，相对亮度 `L ≈ 0.0064`。

| 前景 | L | 对比度 | 结论 |
|---|---|---|---|
| `#eef2ee` | 0.855 | **16.1:1** | AAA |
| `#c3cec9` | 0.578 | **11.4:1** | AAA |
| `#9fb0a8` | 0.413 | **8.2:1** | AAA |
| `#ff7a3c` | 0.355 | **7.2:1** | AAA |

→ **`--glass-floor ≥ .62` 是硬下限**。`prefers-reduced-transparency` 时提到 `.94`（对比度进一步升到 ~17:1）。

### 4.5 表格斑马纹与 hover（玻璃上的特殊处理）

玻璃上不能用「实色斑马纹」，会破坏通透感；用**极低幅度的白色叠加**：

```css
tbody tr:nth-child(even){ background-color: rgba(255,255,255,.028); }   /* ≤3% 白 */
tbody tr:hover{
  background-color: rgba(255,255,255,.065);
  box-shadow: inset 3px 0 0 rgba(255,122,60,.55);   /* 左侧橙色行指示器 —— 宽表横向追踪 */
}
tbody tr:focus-within{ background-color: rgba(255,255,255,.075); }
```

> **行指示器（inset 左侧橙条）是信息密集表格的关键可用性设计**：技术统计表 10 列、名册表 8 列，鼠标横向移动时极易串行。所有 `tbody tr` 必须带这条（包括 `.you` 行，橙色加粗到 3px）。

**斑马纹幅度红线**：偶数行叠加 ≤ 3% 白，hover ≤ 7% 白。超过会让玻璃「发白」失去通透。

### 4.6 状态色（涨红跌绿如何融入）

本作有**两套**红绿，必须严格分离语境，否则歧义：

| 语境 | 语义 | 色 | 形状双编码（强制） |
|---|---|---|---|
| **竞技胜负** | 胜 | `--win: #5fd48a` | 必须同时出现 `✔` / 「升」/「胜」文字 |
| 竞技胜负 | 负 | `--lose:#ff6b6b` | 必须同时出现 `✘` / 「降」/「负」文字 |
| **数值涨跌**（资金、积分、能力、威望） | 涨 | `--up: #ff5f5a`（红） | **必须**同时出现 `▲` |
| 数值涨跌 | 跌 | `--down:#3fcf8e`（绿） | **必须**同时出现 `▼` |
| 警告 | — | `--warn:#f2c14e` | 必须同时出现 `⚠` |
| 中性提示 | — | `--info:#7fb2d9` | — |

**规则**：
1. 涨跌色（红涨绿跌，中国习惯）**只用于带 ▲/▼ 的数值 delta 语境**，永不用于胜负；胜负色（绿胜红负，体育习惯）永不用于涨跌。
2. 两者色相接近（都在红绿轴），**靠"是否带 ▲▼ / ✔✘"与"出现位置（财务/积分区 vs 战绩区）"消歧**——这是 §8 双编码要求的落地。
3. 色盲模式下（§8.2），两套同时切到 **橙 / 蓝** 轴：`--win:#57b6ff`、`--lose:#ffa14a`；`--up:#ffa14a`、`--down:#57b6ff`。

### 4.7 新增 Token 全表（追加到 `:root`，**不删除任何现有变量**）

```css
:root{
  /* —— 舞台 —— */
  --stage-0:#070b0d; --stage-1:#0c1418; --stage-2:#121d22;
  --light-1:rgba(255,255,255,.16); --light-2:rgba(255,255,255,.07);
  /* —— 文本 —— */
  --chalk-2:#c3cec9; --chalk-mute:#6e7d77;
  /* —— 玻璃 —— */
  --glass-floor:rgba(11,17,20,.62); --glass-floor-strong:rgba(11,17,20,.78);
  --glass-floor-modal:rgba(11,17,20,.86);
  --glass-stroke:rgba(255,255,255,.14); --glass-stroke-hi:rgba(255,255,255,.42);
  --glass-hi-top:rgba(255,255,255,.34); --glass-ao-bottom:rgba(0,0,0,.34);
  --blur-thin:8px; --blur-panel:12px; --blur-chrome:16px; --blur-modal:24px;
  --sat:180%;
  /* —— Z 轴 —— */
  --z-panel:8px; --z-raise:18px; --z-lift:28px; --z-overlay:60px; --z-back:-24px;
  /* —— 透视 —— */
  --persp-card:900px; --persp-chrome:1400px; --persp-nav:700px; --persp-grid:1000px; --persp-court:900px;
  /* —— 倾角（全部走变量，reduced-motion 一处归零） —— */
  --tilt-card:1deg; --tilt-nav:2.5deg; --tilt-side:-2.5deg; --tilt-tab:0deg;
  --tilt-grid-max:6deg; --tilt-court:12deg; --tilt-modal:6deg;
  /* —— 阴影 —— */
  --shadow-panel:0 18px 38px -14px rgba(0,0,0,.70);
  --shadow-raise:0 28px 56px -18px rgba(0,0,0,.78);
  --shadow-lift: 0 30px 60px -20px rgba(0,0,0,.82), 0 10px 30px -12px rgba(255,122,60,.22);
  --shadow-press:0 6px 14px -8px rgba(0,0,0,.70);
  --glow-accent:0 0 0 1px rgba(255,122,60,.55), 0 8px 24px -8px rgba(255,122,60,.38);
  /* —— 强调 —— */
  --accent-hi:#ffb066; --accent-deep:#d9541a;
  --accent-a15:rgba(255,122,60,.15); --accent-a30:rgba(255,122,60,.30);
  --hardwood-a:#c08a4e; --hardwood-b:#8a5527; --hardwood-key:#e6b277;
  /* —— 状态 —— */
  --win:#5fd48a; --lose:#ff6b6b; --up:#ff5f5a; --down:#3fcf8e; --info:#7fb2d9;
  /* —— 玻璃分隔线（比 v3 --line 更柔，玻璃上 .18 太重） —— */
  --line-glass:rgba(255,255,255,.09); --line-glass-strong:rgba(255,255,255,.16);
  /* —— 动效 —— */
  --d-press:90ms; --d-3d:280ms; --d-settle:400ms;
  --ease-sheet:cubic-bezier(.32,.72,0,1); --ease-settle:cubic-bezier(.32,.72,0,1);
  /* —— 几何 —— */
  --r-glass:14px; --r-glass-lg:16px; --r-pill:999px;
}
```

---

## 5. 光影系统

### 5.1 光源设定（全局唯一，不许第二盏）

- **主光 Key**：左上 `22% / -12%`，冷白 `rgba(255,255,255,.16)`，`radial-gradient` 半径 ~120%×80%，落在每个玻璃面板的**左上角**。
- **边缘光 Rim**：面板**顶边 1px** `rgba(255,255,255,.34)`，左侧 1px `.10`。
- **环境遮蔽 AO**：面板**底边 1px** `rgba(0,0,0,.34)`。
- **辅光（唯一暖源）**：页面底部 `50% / 108%` 的橙色 `rgba(255,122,60,.10)`，模拟地板反光打到玻璃背面。
- **禁止**：右下补光、双高光、彩色边缘光（霓虹）。

### 5.2 投影规则（距离 / 模糊 / 颜色）

| 层级 | `box-shadow` | 说明 |
|---|---|---|
| L2 面板常态 | `0 18px 38px -14px rgba(0,0,0,.70)` | y 偏移 18 / 模糊 38 / 收缩 −14 |
| L3 面板 hover | `0 28px 56px -18px rgba(0,0,0,.78)` | 抬得更高 → 偏移更大、更散 |
| L3 选队卡 hover | `0 30px 60px -20px rgba(0,0,0,.82)` + `0 10px 30px -12px rgba(255,122,60,.22)` | 唯一一处允许「橙调副影」，模拟球场地板反光 |
| 按压 | `0 6px 14px -8px rgba(0,0,0,.70)` | 贴回去，影收紧 |
| L4 弹窗 | `0 48px 90px -28px rgba(0,0,0,.88)` | 离舞台最远 |

**规律**：`translateZ` 每 +10px，投影 y 偏移 +5px、模糊 +9px、透明度 +0.04。禁止超过 1 层外投影。

### 5.3 选中态辉光（唯一允许的"发光"）

```css
.is-selected, .nav-btn.active, .tab-btn.active{
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.30),
    inset 0 -1px 0 rgba(0,0,0,.28),
    0 0 0 1px rgba(255,122,60,.55),          /* 1px 橙色描边环 */
    0 8px 24px -8px rgba(255,122,60,.38);    /* 24px 内收辉光，透明度 .38 */
}
```
辉光**仅**出现在：`.nav-btn.active`、`.tab-btn.active`、`:focus-visible`、`.champion` 冠军卡、战术板选中棋子。
**禁止**：文字 `text-shadow` 发光、边框 `box-shadow` 超过 24px 半径、透明度超过 `.45`。

### 5.4 玻璃高光扫光（P1，可选）

```css
.glass::after{
  content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background: linear-gradient(105deg, transparent 34%, rgba(255,255,255,.085) 47%, transparent 60%);
  opacity:0; transition:opacity var(--d-3d) var(--ease-out);
}
.glass:hover::after{ opacity:1; }
```
> 只在 hover 时激活，**不常驻**（常驻会多 6 个合成层）。

---

## 6. 关键组件的 3D 化处理（逐项数值）

> **通用前置**：所有组件均**不新增 DOM 节点**（除战术板棋子阴影椭圆，属"新增子节点"），只通过 `style.css` 新增类 + 伪元素实现。
> **绝不改名**：`#hdr .tb-item/.tb-team/.broadcast/#btn-advance`、`.nav/.nav-h/.nav-btn/.nav-team`、`.tabs/.tab-btn`、`.view/.card/.card-h`、`.side/.side-tabs/.side-tab/#side-roster/.side-roster-row`、`.team-grid/.team-btn/.dot`、`#board/svg.board/.court/.court-dim/.token` 全部保留。

### 6.1 顶栏 `#hdr`（赛季 / 资金 / 战绩条）

```css
.topbar{
  position:relative; isolation:isolate;
  background-color: var(--glass-floor-strong);                     /* .78 */
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.095), rgba(255,255,255,.022) 48%, rgba(255,255,255,.06)),
    radial-gradient(130% 90% at 20% -20%, var(--light-1), transparent 60%);
  -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(var(--sat));   /* 16px */
  backdrop-filter: blur(var(--blur-chrome)) saturate(var(--sat));
  border:1px solid var(--glass-stroke);
  border-radius: var(--r-glass);
  box-shadow:
    inset 0  1px 0 var(--glass-stroke-hi),
    inset 0 -1px 0 var(--glass-ao-bottom),
    0 20px 42px -18px rgba(0,0,0,.76);
  /* 3D：顶栏是离用户最近的一层，向下微倾 1.2° */
  transform: perspective(var(--persp-chrome)) translateZ(12px) rotateX(1.2deg);
  transform-origin: 50% 0%;
  padding: 10px 16px;
}
/* 顶边高光扫线（1px 渐变到两端透明） */
.topbar::before{
  content:''; position:absolute; left:12%; right:12%; top:0; height:1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.60), transparent);
}
/* 各项：玻璃内嵌胶囊 */
.topbar .tb-item{
  padding:4px 12px; border-radius:10px;
  background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.015));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
  transition: transform var(--d-fast) var(--ease-out), background var(--d-fast) linear;
}
.topbar .tb-item:hover{ transform: translateZ(6px); background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03)); }
.topbar .tb-team{ font-size:var(--fs-xl); letter-spacing:.5px;
  background: linear-gradient(180deg, #fff, #cfd9d4);
  -webkit-background-clip:text; background-clip:text; color:transparent; }
/* 主按钮：唯一实心暖色，做"按下"的厚玻璃 */
#btn-advance.btn-primary{
  background: linear-gradient(180deg, var(--accent-hi), var(--accent) 42%, var(--accent-deep));
  color:#1c1410; border:0; border-radius:12px; padding:10px 20px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 0 rgba(0,0,0,.22), 0 10px 22px -10px rgba(255,122,60,.55);
  transform: perspective(700px) translateZ(4px);
  transition: transform var(--d-press) var(--ease-out), box-shadow var(--d-press) var(--ease-out);
}
#btn-advance.btn-primary:hover{ transform: perspective(700px) translateZ(10px); filter:none; }
#btn-advance.btn-primary:active{ transform: perspective(700px) translateZ(1px) scale(.985);
  box-shadow: inset 0 2px 5px rgba(0,0,0,.34), 0 4px 10px -6px rgba(255,122,60,.45); }
/* 广播条：玻璃凹槽 */
.topbar .broadcast{ border-top:1px solid var(--line-glass); padding-top:8px; margin-top:2px; color:var(--chalk-2); }
```
- **注意**：`#hdr` 用 `flex-wrap:wrap`，3D 变换不影响 flex 换行。
- **注意**：`.tb-team` 的 `background-clip:text` 在旧内核会把文字变透明且无回退 → 加 `@supports not ((-webkit-background-clip:text) or (background-clip:text)){ .tb-team{color:var(--chalk)} }`。

### 6.2 左侧导航 `.nav`（分组树）

```css
.nav{
  position:relative; isolation:isolate;
  background-color: var(--glass-floor-strong);
  background-image: linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.02) 50%, rgba(255,255,255,.05));
  -webkit-backdrop-filter: blur(var(--blur-chrome)) saturate(var(--sat));
  backdrop-filter: blur(var(--blur-chrome)) saturate(var(--sat));
  border:1px solid var(--glass-stroke); border-radius:var(--r-glass);
  box-shadow: inset 0 1px 0 var(--glass-stroke-hi), inset -1px 0 0 rgba(255,255,255,.08), 0 18px 38px -16px rgba(0,0,0,.72);
  padding:12px 10px;
  /* 像一块向内斜的控制面板：左缘固定，右缘转向观众 */
  transform: perspective(var(--persp-nav)) translateZ(8px) rotateY(2.5deg);
  transform-origin: 0% 50%;
}
/* 分组标题：细字距 + 渐变收尾分隔线 */
.nav-h{
  position:relative; color:var(--chalk-dim); font-size:var(--fs-xs); letter-spacing:2px;
  margin:14px 4px 6px; padding-left:2px;
}
.nav-h::after{
  content:''; position:absolute; left:0; right:0; bottom:-3px; height:1px;
  background: linear-gradient(90deg, var(--line-glass-strong), transparent 78%);
}
.nav-h:first-child{ margin-top:2px; }
/* 按钮：悬浮玻璃条 + 悬浮时向观众转出 */
.nav-btn{
  position:relative; display:block; width:100%;
  border:1px solid transparent; border-radius:10px; padding:8px 10px;
  background: transparent; color:var(--chalk-2); text-align:left; font-size:var(--fs-s);
  transform: perspective(700px) translateZ(0) rotateY(0deg);
  transform-origin: 0% 50%;
  transition: transform var(--d) var(--ease-out), background var(--d-fast) linear, box-shadow var(--d-fast) var(--ease-out), color var(--d-fast) linear;
}
.nav-btn:hover{
  transform: perspective(700px) translateZ(10px) rotateY(-5deg);
  background: linear-gradient(90deg, rgba(255,255,255,.11), rgba(255,255,255,.03));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 10px 20px -12px rgba(0,0,0,.70);
  color: var(--chalk);
}
/* 选中 = 嵌入式凹槽（不是抬起）+ 左侧橙条 + 辉光 */
.nav-btn.active{
  transform: perspective(700px) translateZ(6px) rotateY(-2deg);
  background: linear-gradient(90deg, var(--accent-a30), var(--accent-a15) 55%, rgba(255,122,60,.04));
  box-shadow:
    inset 3px 0 0 var(--accent),
    inset 0 1px 0 rgba(255,255,255,.22),
    0 0 0 1px rgba(255,122,60,.45),
    0 8px 20px -10px rgba(255,122,60,.40);
  color: var(--accent); font-weight: var(--w-semi);
}
.nav-team{ margin-top:14px; padding-top:12px; border-top:1px solid var(--line-glass); color:var(--chalk-dim); }
```
- **倾角红线**：`rotateY(-5deg)` 是 hover 瞬时值，`.nav-btn` 字号 13px，5° 会造成轻微重采样。**若实机发虚，降到 −3°**。

### 6.3 主区 Tab 行 `.tabs`

```css
.tabs{
  position:relative; isolation:isolate;
  background-color: var(--glass-floor);
  background-image: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.015));
  -webkit-backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat));
  backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat));
  border:1px solid var(--glass-stroke); border-radius:var(--r-glass);
  box-shadow: inset 0 1px 0 var(--glass-stroke-hi), inset 0 -1px 0 var(--glass-ao-bottom), 0 14px 30px -16px rgba(0,0,0,.68);
  padding:3px; gap:3px; overflow:hidden;          /* 保留现有 overflow:hidden（会 flatten，无所谓） */
  transform: perspective(var(--persp-card)) translateZ(6px);
  transform-origin: 50% 0%;
}
.tab-btn{
  position:relative; flex:1; padding:10px 4px; border:0; border-radius:11px;
  background:transparent; color:var(--chalk-dim); font-size:var(--fs-s);
  transform: perspective(700px) translateZ(0);
  transition: transform var(--d) var(--ease-out), color var(--d-fast) linear, background var(--d-fast) linear, box-shadow var(--d-fast) var(--ease-out);
}
.tab-btn:hover{ color:var(--chalk-2); background:rgba(255,255,255,.06); transform: perspective(700px) translateZ(5px); }
.tab-btn.active{
  color: var(--accent); font-weight:var(--w-semi);
  transform: perspective(700px) translateZ(10px);
  background: linear-gradient(180deg, rgba(255,255,255,.11), rgba(255,122,60,.10));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.30), inset 0 -1px 0 rgba(0,0,0,.20),
              0 0 0 1px rgba(255,122,60,.45), 0 8px 18px -10px rgba(255,122,60,.36);
}
/* 选中指示：底部 2px 渐变高光条（替代原 border-bottom 实色） */
.tab-btn.active::after{
  content:''; position:absolute; left:10px; right:10px; bottom:3px; height:2px; border-radius:2px;
  background: linear-gradient(90deg, transparent, var(--accent-hi), transparent);
  box-shadow: 0 0 12px -2px rgba(255,122,60,.85);
}
```

### 6.4 内容卡片 `.card`

```css
.card{
  position:relative; isolation:isolate;
  background-color: var(--glass-floor);
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.085) 0%, rgba(255,255,255,.022) 46%, rgba(255,255,255,.055) 100%),
    radial-gradient(120% 80% at 22% -12%, var(--light-1), transparent 62%);
  -webkit-backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat));
  backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat));
  border:1px solid var(--glass-stroke); border-radius:var(--r-glass-lg);
  box-shadow: inset 0 1px 0 var(--glass-stroke-hi), inset 0 -1px 0 var(--glass-ao-bottom), var(--shadow-panel);
  padding: var(--s4);
  transform: perspective(var(--persp-card)) translateZ(var(--z-panel)) rotateX(var(--tilt-card));
  transform-origin: 50% 0%;
  transition: transform var(--d) var(--ease-out), box-shadow var(--d) var(--ease-out);
  /* ★ 禁止 overflow:hidden —— 战术板 #board 的 3D 地板会被裁掉 */
}
.card:hover{ transform: perspective(var(--persp-card)) translateZ(var(--z-raise)) rotateX(0deg); box-shadow: inset 0 1px 0 rgba(255,255,255,.42), inset 0 -1px 0 var(--glass-ao-bottom), var(--shadow-raise); }
/* 标题：左侧 3px 橙色刻度块 + 轻微文字浮雕 */
.card-h{
  position:relative; padding-left:12px; margin:0 0 var(--s3);
  font-size:var(--fs-l); font-weight:var(--w-semi); color:var(--chalk);
  text-shadow: 0 1px 0 rgba(0,0,0,.45);
}
.card-h::before{
  content:''; position:absolute; left:0; top:.28em; width:3px; height:.92em; border-radius:2px;
  background: linear-gradient(180deg, var(--accent-hi), var(--accent-deep));
  box-shadow: 0 0 10px -2px rgba(255,122,60,.70);
}
```

### 6.5 表格（积分榜 / 技术统计 / 名册）—— **可读性优先区**

> **铁律 G2：表格区域 `transform: none`。** 容器可以玻璃化，行与单元格绝不参与 3D。

```css
/* 容器：薄玻璃包一层，给表格一个"托盘" */
.view .card table{ /* 不变结构 */ }
table{ width:100%; border-collapse:collapse; }
thead th{
  position:sticky; top:0; z-index:2;                    /* P1：sticky 表头 + 玻璃底 */
  background-color: rgba(11,17,20,.86);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);   /* 仅 sticky 生效时才吃 blur */
  color:var(--chalk); font-weight:var(--w-semi); font-size:var(--fs-s);
  text-align:right; padding:8px 10px; white-space:nowrap;
  border-bottom:1px solid var(--line-glass-strong);
  letter-spacing:.02em;
}
th:first-child, td:first-child{ text-align:left; }
tbody td{
  padding:7px 10px; text-align:right; font-size:var(--fs-s); color:var(--chalk-2);
  border-bottom:1px solid var(--line-glass);
}
tbody td:first-child{ color:var(--chalk); }             /* 首列（队名/球员名）提亮 */
tbody tr{ transition: background-color var(--d-fast) linear, box-shadow var(--d-fast) linear; }
tbody tr:nth-child(even){ background-color: rgba(255,255,255,.028); }
tbody tr:hover{
  background-color: rgba(255,255,255,.065);
  box-shadow: inset 3px 0 0 rgba(255,122,60,.55);
}
tbody tr:last-child td{ border-bottom:0; }
/* 我队行：橙色渐变 + 左侧 3px 实条 + 文字提亮 */
tbody tr.you{
  background: linear-gradient(90deg, rgba(255,122,60,.16), rgba(255,122,60,.03) 62%, transparent);
  box-shadow: inset 3px 0 0 var(--accent);
}
tbody tr.you td{ color:var(--accent); font-weight:var(--w-semi); }
tbody tr.you:hover{ background: linear-gradient(90deg, rgba(255,122,60,.24), rgba(255,122,60,.06) 62%, transparent); }
/* 数字：等宽 + tabular（沿用 v3，强化字距） */
td.num, th.num, .num{ font-family:var(--font-num); font-variant-numeric:tabular-nums; font-weight:var(--w-semi); letter-spacing:.01em; }
/* 标签胶囊：薄玻璃 */
.tag{
  font-size:var(--fs-xs); padding:2px 8px; border-radius:var(--r-pill);
  border:1px solid var(--glass-stroke); background:rgba(255,255,255,.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.20);
}
.tag.win{ color:var(--win); border-color:rgba(95,212,138,.45); background:rgba(95,212,138,.10); }
.tag.lose{color:var(--lose);border-color:rgba(255,107,107,.45); background:rgba(255,107,107,.10); }
.tag.warn{color:var(--warn);border-color:rgba(242,193,78,.45); background:rgba(242,193,78,.10); }
/* 能力条：变为带内凹槽的玻璃管 */
.bar{ height:6px; border-radius:3px; overflow:hidden; margin-top:4px;
  background: rgba(255,255,255,.07); box-shadow: inset 0 1px 2px rgba(0,0,0,.45); }
.bar > i{ display:block; height:100%; border-radius:3px;
  background: linear-gradient(90deg, var(--accent-deep), var(--accent) 60%, var(--accent-hi));
  box-shadow: 0 0 8px -2px rgba(255,122,60,.70); }
```

**检查项**：
- 表格区域对比度：`--chalk-2 #c3cec9` on 玻璃 = **11.4:1** ✅；hover 叠加 6.5% 白后底色 ≈ `rgb(27,33,36)`，`L≈0.0165` → 对比度 **10.3:1** ✅。
- 列宽不因 3D 变化：`table` 与 `td` 均 `transform:none`，`tabular-nums` 保证数字不跳。
- 长表（名册 12 行 × 8 列、技术统计 10 列）横向不换行：`white-space:nowrap` 加在 `th`，`td` 保持自动。

### 6.6 右侧球员面板 `.side`

```css
.side > .card{
  transform: perspective(var(--persp-nav)) translateZ(8px) rotateY(-2.5deg);
  transform-origin: 100% 50%;                 /* 右缘固定，左缘转向观众，与左导航镜像 */
  padding:12px;
}
.side-tabs{
  background: rgba(255,255,255,.05); border:1px solid var(--glass-stroke);
  border-radius:10px; padding:3px; gap:3px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.16), inset 0 -1px 0 rgba(0,0,0,.22);
}
.side-tab{ border:0; border-radius:8px; padding:6px 0; color:var(--chalk-dim); font-size:var(--fs-xs);
  transition: transform var(--d-fast) var(--ease-out), background var(--d-fast) linear, color var(--d-fast) linear; }
.side-tab:hover{ color:var(--chalk-2); background:rgba(255,255,255,.06); }
.side-tab.active{
  color:var(--accent); font-weight:var(--w-semi);
  background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,122,60,.12));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 0 0 1px rgba(255,122,60,.40);
  transform: perspective(700px) translateZ(6px);
}
/* 名单行：悬浮玻璃条，hover 抬起 + 左侧橙条 */
.side-roster-row{
  position:relative; display:flex; align-items:center; gap:6px;
  padding:6px 8px; border-radius:9px; margin:2px -4px;
  border-bottom:0;                              /* 用间距替代原 border-bottom，避免破坏圆角玻璃 */
  transition: transform var(--d-fast) var(--ease-out), background var(--d-fast) linear, box-shadow var(--d-fast) linear;
}
.side-roster-row:hover{
  transform: perspective(700px) translateZ(7px);
  background: linear-gradient(90deg, rgba(255,255,255,.10), rgba(255,255,255,.02));
  box-shadow: inset 2px 0 0 rgba(255,122,60,.60), inset 0 1px 0 rgba(255,255,255,.20);
}
.side-roster-row .pos{
  display:inline-flex; align-items:center; justify-content:center;
  width:26px; height:18px; border-radius:6px; font-size:10px; color:var(--chalk-2);
  background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.03));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.30);
}
.side-roster-row .ovr{
  font-family:var(--font-num); font-variant-numeric:tabular-nums; font-weight:var(--w-semi);
  min-width:26px; text-align:right; padding:1px 6px; border-radius:6px;
  background: linear-gradient(180deg, rgba(255,122,60,.22), rgba(255,122,60,.06));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.20);
}
```

### 6.7 选队首屏 42 队网格（**重点：3D 悬浮**）

```css
#team-grid{
  perspective: var(--persp-grid);              /* 1000px */
  perspective-origin: 50% 40%;
  display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:var(--s3);
}
.team-btn{
  position:relative; display:flex; flex-direction:column; gap:3px;
  padding:14px; border-radius:var(--r-glass); text-align:left; color:var(--chalk);
  background-color: var(--glass-floor);
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.022) 46%, rgba(255,255,255,.055)),
    radial-gradient(120% 90% at 20% -10%, var(--light-1), transparent 60%);
  -webkit-backdrop-filter: blur(var(--blur-thin)) saturate(var(--sat));   /* 8px：42 张只能用薄档 */
  backdrop-filter: blur(var(--blur-thin)) saturate(var(--sat));
  border:1px solid var(--glass-stroke);
  box-shadow: inset 0 1px 0 var(--glass-stroke-hi), inset 0 -1px 0 var(--glass-ao-bottom), 0 12px 26px -14px rgba(0,0,0,.66);
  /* 跟随倾角：--mx/--my ∈ [-1,1]，由指针位置注入（JS 见下） */
  --mx:0; --my:0;
  transform: translateZ(0px) rotateX(calc(var(--my) * var(--tilt-grid-max) * -1)) rotateY(calc(var(--mx) * var(--tilt-grid-max)));
  transform-style: preserve-3d;                /* 叶子节点，允许 */
  transition: transform var(--d-settle) var(--ease-settle), box-shadow var(--d) var(--ease-out);
}
.team-btn.is-lift{                              /* hover 中：JS 加类 */
  transform: translateZ(var(--z-lift)) rotateX(calc(var(--my) * var(--tilt-grid-max) * -1)) rotateY(calc(var(--mx) * var(--tilt-grid-max))) scale(1.035);
  z-index:5;                                    /* 抬起后盖住邻居 */
  box-shadow: var(--shadow-lift);
  transition: transform var(--d-fast) var(--ease-follow), box-shadow var(--d) var(--ease-out);
}
.team-btn:active{ transform: translateZ(6px) scale(.99); transition-duration: var(--d-press); }
.team-btn .dot{ box-shadow: 0 0 8px -1px currentColor, inset 0 1px 0 rgba(255,255,255,.5); }  /* 队色点做成发光小球 */
.team-btn b{ font-size:var(--fs-l); text-shadow:0 1px 0 rgba(0,0,0,.45); }
.team-btn small{ color:var(--chalk-dim); }
/* 入场 stagger（--i 由 renderPick 注入） */
@media (prefers-reduced-motion: no-preference){
  .team-btn{ animation: cardIn var(--d-slow) var(--ease-out) both; animation-delay: calc(min(var(--i, 0), 24) * 14ms); }
}
@keyframes cardIn{ from{ opacity:0; transform: translateZ(-28px) rotateX(6deg) scale(.97);} to{ opacity:1; transform:none; } }
```

**跟随倾角 JS（事件委托，只挂 1 个监听器，不挂 42 个）**：

```js
// 追加到 ui.js renderPick() 末尾；不改任何既有 id/class
(function () {
  var grid = document.getElementById('team-grid');
  if (!grid || grid.dataset.tilt) return;
  grid.dataset.tilt = '1';
  var fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var low  = document.documentElement.dataset.perf === 'low';
  if (!fine || low) return;                       // 触屏 / 低端设备直接不启用
  var cur = null;
  grid.addEventListener('pointermove', function (e) {
    var b = e.target.closest ? e.target.closest('.team-btn') : null;
    if (b !== cur) { if (cur) { cur.classList.remove('is-lift'); cur.style.removeProperty('--mx'); cur.style.removeProperty('--my'); } cur = b; if (cur) cur.classList.add('is-lift'); }
    if (!cur) return;
    var r = cur.getBoundingClientRect();
    cur.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 2 - 1).toFixed(3));
    cur.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 2 - 1).toFixed(3));
  }, { passive: true });
  grid.addEventListener('pointerleave', function () {
    if (cur) { cur.classList.remove('is-lift'); cur.style.removeProperty('--mx'); cur.style.removeProperty('--my'); cur = null; }
  });
})();
```
并在 `renderPick()` 的 `grid.appendChild(b)` 前加一行注入序号（**新增，不改既有结构**）：
```js
b.style.setProperty('--i', i);   // 需把 forEach(function(t){ 改为 forEach(function(t, i){
```

**性能护栏（必须实现）**：
1. `will-change` **不常驻**。42 张卡常驻 `will-change:transform` = 42 个合成层 → 移动端显存爆。改为在 `.is-lift` 内加 `will-change:transform`，`pointerleave` 后移除类即释放。
2. 仅在 `(hover:hover) and (pointer:fine)` 下启用跟随倾角。
3. 触屏 / `data-perf="low"` 下 `--tilt-grid-max:0deg`、`--z-lift:0px`，只保留 shadow 变化。

### 6.8 战术板 `#board` —— **CSS 3D 透视球场地板（本作最出彩点）**

#### 6.8.1 结构（**不新增 DOM 节点**，只用 `#board::before` / `#board::after` + 现有 `<svg class="board">`）

```
#board                      ← 舞台：perspective + preserve-3d
 ├ ::before                 ← C1 枫木地板（rotateX 同角，translateZ -6px）
 ├ svg.board                ← C2 球场线 + 棋子（rotateX 同角，translateZ 0）
 └ ::after                  ← C3 玻璃罩反光（rotateX 同角，translateZ 18px, pointer-events:none）
```

```css
#board{
  --court-tilt: 12deg;                 /* P0 值；P1 可上探到 20deg（必须同步改 hit-test，见 6.8.4） */
  --court-persp: 900px;
  position: relative;
  perspective: var(--court-persp);
  perspective-origin: 50% 34%;
  transform-style: preserve-3d;        /* ★ 全局唯一允许的 preserve-3d */
  max-width: 520px; margin: 0 auto;
  padding: 26px 0 34px;
}
/* C1 · 枫木地板 */
#board::before{
  content:''; position:absolute; inset: -3% -5% -8%;
  border-radius: 12px;
  background:
    /* 打蜡反光 */
    radial-gradient(70% 50% at 50% 12%, var(--hardwood-key), transparent 66%),
    /* 木纹（细密重复线性渐变，纯 CSS，无图片） */
    repeating-linear-gradient(90deg,
      rgba(0,0,0,.055) 0 2px, rgba(255,255,255,.030) 2px 4px, transparent 4px 22px),
    /* 地板基色：近处亮、远处暗（距离雾） */
    linear-gradient(180deg, var(--hardwood-b) 0%, var(--hardwood-a) 62%, #a06e37 100%);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,.22),
    inset 0 -14px 26px -10px rgba(0,0,0,.55),
    0 34px 60px -22px rgba(0,0,0,.85);
  transform: rotateX(var(--court-tilt)) translateZ(-6px);
  transform-origin: 50% 50%;
}
/* C2 · 球场线 + 棋子（现有 SVG，只加 3D 与阴影） */
#board svg.board{
  position: relative; z-index: 1; display:block; width:100%; height:auto;
  transform: rotateX(var(--court-tilt)) translateZ(0);
  transform-origin: 50% 50%;
  filter: drop-shadow(0 10px 14px rgba(0,0,0,.42));   /* 整块板压在地板上的接触阴影 */
  touch-action: none;
}
/* C3 · 玻璃罩反光（扫过地板的一道高光） */
#board::after{
  content:''; position:absolute; inset:-3% -5% -8%; border-radius:12px;
  pointer-events:none;
  background: linear-gradient(104deg, transparent 36%, rgba(255,255,255,.10) 47%, transparent 58%);
  transform: rotateX(var(--court-tilt)) translateZ(18px);
  transform-origin: 50% 50%;
}
/* 场地线在木地板上要更亮、更实 */
#board .court{ stroke:#fff8ee; stroke-width:2.2; filter: drop-shadow(0 1px 0 rgba(0,0,0,.35)); }
#board .court-dim{ stroke:rgba(255,248,238,.62); stroke-width:1.6; }
```

#### 6.8.2 棋子「竖立」——伪 3D（SVG 内部，需新增 2 个子节点）

SVG 不支持 `preserve-3d`，棋子用**「落地椭圆阴影 + 柱身高光」**伪造站立（这是唯一允许的 DOM 新增）：

```js
// renderBoard() 内，token 模板改为（新增 <ellipse> 与 <circle class="token-hi">，不改 class 名与 data-*）
'<g class="token home" data-id="'+p.id+'" data-pos="'+p.pos+'" transform="translate('+x+','+y+')">'+
  '<title>'+p.name+' · '+p.pos+'</title>'+
  '<ellipse class="token-shadow" cx="1" cy="13" rx="15" ry="5.5"/>'+   // 落地投影（先画，在下）
  '<circle r="15"/>'+                                                   // 柱身（保留，r=15 不变）
  '<circle class="token-hi" r="15" cx="-3" cy="-4"/>'+                  // 左上高光（半透明白，只画上半）
  '<text>'+nums[p.id]+'</text>'+
'</g>'
```
```css
.token-shadow{ fill: rgba(0,0,0,.42); }
.token{ cursor:grab; filter: drop-shadow(0 7px 7px rgba(0,0,0,.55)); transition: filter var(--d-fast) var(--ease-out); }
.token:active{ cursor:grabbing; filter: drop-shadow(0 3px 3px rgba(0,0,0,.60)); }   /* 抓起时影收=离地 */
.token-hi{ fill: rgba(255,255,255,.22); stroke:none; }
.token.home circle{ fill: var(--accent); stroke:#2a1710; stroke-width:2; }
.token.home .token-hi{ fill: rgba(255,255,255,.34); }   /* 主队棋子打蜡更亮 */
.token text{ fill:#1c1410; font-family:var(--font-num); font-weight:700; font-size:12px;
  text-anchor:middle; dominant-baseline:central; }
```
> 视觉结果：木地板 + 亮白场地线 + 橙色棋子带落地阴影 + 一道斜向玻璃反光 = **「一块立在球馆地板上的玻璃战术板」**。这是全站最出彩的一屏。

#### 6.8.3 6×6 站位网格（地板格线）

半场可用区 `x∈[20,480] y∈[20,450]`（viewBox 500×470），切 6 列 × 6 行：

| 项 | 值 |
|---|---|
| 格宽 | `460/6 = 76.67` |
| 格高 | `430/6 = 71.67` |
| 列心 `x` | `20 + 76.67 × (c + 0.5)` → 58.3 / 135.0 / 211.7 / 288.3 / 365.0 / 441.7 |
| 行心 `y` | `20 + 71.67 × (r + 0.5)` → 55.8 / 127.5 / 199.2 / 270.8 / 342.5 / 414.2 |

在 `courtSVG()` 里**新增** 36 个 `<rect class="cell">`（不改现有元素）：
```js
var g = '';
for (var r = 0; r < 6; r++) for (var c = 0; c < 6; c++)
  g += '<rect class="cell" x="'+(20+76.67*c).toFixed(1)+'" y="'+(20+71.67*r).toFixed(1)+'" width="76.7" height="71.7"/>';
```
```css
.cell{ fill:none; stroke:rgba(255,248,238,.16); stroke-width:1; }
.cell:hover{ fill:rgba(255,122,60,.10); stroke:rgba(255,122,60,.45); }
```

#### 6.8.4 ⚠ 拖拽 hit-test：3D 化会打碎现有坐标映射（**头号风险**）

现有 `attachDrag()` 用 `getBoundingClientRect()` + 线性比例 `sx=500/rect.width, sy=470/rect.height` 反算 SVG 坐标。
**在 `rotateX(θ)` + `perspective(p)` 下，屏幕→局部的映射是非线性的投影，不是等比缩放。** 实测误差（对 viewBox 单位，行高 71.67）：

| 倾角 θ | 边框处最大定位误差 | 折合行数 | 结论 |
|---|---|---|---|
| 0° | 0 | 0 | 现状 |
| **12°** | ≈ 25 单位 | **0.35 行** | ✅ **P0 推荐**，不修 hit-test 也够用 |
| 18° | ≈ 38 单位 | 0.53 行 | ⚠ 临界，必须开网格吸附 |
| 26° | ≈ 54 单位 | 0.75 行 | ❌ 不修 hit-test 会明显"拖不准" |

**P0 方案（推荐先上）**：`--court-tilt: 12deg`，**不改 `attachDrag()`**，仅把拖拽夹取范围对齐格心区 `x∈[56,446] y∈[54,416]`。误差 0.35 行，配合吸附完全无感。

**P1 方案（要更陡的俯视）**：`--court-tilt: 18–22deg` + **换逆投影 hit-test** + **松手吸附最近格心**：

```js
// 替换 attachDrag() 里的 move()，其余不变
// —— 只用未变换的布局盒（offsetTop/offsetWidth），不用 getBoundingClientRect() ——
function toLocal(ev){
  var bd  = document.getElementById('board');
  var svg = document.querySelector('svg.board');
  var cs  = getComputedStyle(bd);
  var th  = parseFloat(cs.getPropertyValue('--court-tilt')) * Math.PI / 180;  // 需 --court-tilt 带 deg 单位时用 parseFloat 前先去单位
  var p   = parseFloat(cs.getPropertyValue('--court-persp'));
  var bo  = bd.getBoundingClientRect();                       // #board 自身无 transform，rect 可信
  var s   = svg.offsetWidth / 500;                            // 布局宽（未受 3D 影响）
  var ox  = bo.left + bo.width  * 0.50;                       // perspective-origin 50%
  var oy  = bo.top  + bo.height * 0.34;                       // perspective-origin 34%
  var cx  = bo.left + svg.offsetLeft + svg.offsetWidth  / 2;  // svg 变换原点（50% 50%）屏幕位置
  var cy  = bo.top  + svg.offsetTop  + svg.offsetHeight / 2;
  var X   = ev.clientX - ox, S = ev.clientY - oy;             // 相对透视原点
  var den = p * Math.cos(th) + S * Math.sin(th);
  var yPx = S * p * Math.cos(th) / den;                       // 局部 y（px，相对 svg 中心）
  var xPx = X * p * Math.cos(th) / (s * den) * s;             // 局部 x（px）
  return { u: 250 + (xPx + (cx - ox)) / s,                    // viewBox x
           v: 235 + (yPx + (cy - oy)) / s };                  // viewBox y
}
function snap(v, min, max, n){                                 // 吸附到最近格心
  var step = (max - min) / (n - 1);
  return Math.round((v - min) / step) * step + min;
}
// 松手时：x = snap(x, 58.3, 441.7, 6); y = snap(y, 55.8, 414.2, 6);
```

> 若 `--court-tilt` 写成 `12deg`，`parseFloat` 得 `12`，需自行 `/1` 后转弧度（上例已假设数值为度）。工程实现时建议改为**独立的无单位变量** `--court-deg: 12` 供 JS 读取，`transform` 里用 `rotateX(calc(var(--court-deg) * 1deg))`。

#### 6.8.5 战术控件区（`#tactic-controls` / `#lineup-controls`）

```css
.tc select, .lc select, .train-row select{
  background-color: rgba(11,17,20,.72);
  background-image: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.015));
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  border:1px solid var(--glass-stroke); border-radius:10px; color:var(--chalk);
  padding:8px 10px; font-family:inherit;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.20), inset 0 -1px 0 rgba(0,0,0,.28);
  transition: border-color var(--d-fast) linear, box-shadow var(--d-fast) linear, transform var(--d-fast) var(--ease-out);
}
.tc select:hover, .lc select:hover{ border-color: rgba(255,122,60,.55); transform: perspective(700px) translateZ(4px); }
.tc select:focus-visible, .lc select:focus-visible{ border-color:var(--accent); box-shadow: 0 0 0 3px rgba(255,122,60,.22), inset 0 1px 0 rgba(255,255,255,.20); }
/* 原生下拉展开面板无法样式化 —— 用 optgroup? 不行。折衷：给 select 加自定义箭头伪元素 */
.tc, .lc{ position:relative; }
.tc::after, .lc::after{
  content:''; position:absolute; right:14px; bottom:16px; width:6px; height:6px;
  border-right:1.5px solid var(--chalk-dim); border-bottom:1.5px solid var(--chalk-dim);
  transform: rotate(45deg); pointer-events:none;
}
```
> 注意：`.tc::after` 定位依赖 `label` 高度（现 `label` 在上、`select` 在下）。若实机错位，改为给 `select` 包一层不可行（不能加节点）→ 退化为**不加箭头**（P0 可接受）。

### 6.9 弹窗 / 遮罩层

当前 `index.html` **没有** modal 节点（竞猜失败用的是原生 `alert()`，无法样式化）。
规范按「未来接入 DOM 弹窗」给出；legacy 分支已有 `.modal / .modal-box / #popActions` 结构，**类名沿用即可**。

```css
/* 遮罩：1 层全屏 blur，半径克制 */
.modal{
  position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center;
  perspective: 1100px; perspective-origin: 50% 45%;
  background: radial-gradient(120% 90% at 50% 32%, rgba(8,12,14,.58), rgba(4,7,9,.86));
  -webkit-backdrop-filter: blur(6px) saturate(120%); backdrop-filter: blur(6px) saturate(120%);
  opacity:0; visibility:hidden;
  transition: opacity var(--d) linear, visibility 0s linear var(--d);
}
.modal.show{ opacity:1; visibility:visible; transition: opacity var(--d) linear, visibility 0s; }
/* 弹窗本体：从深处推上来（Apple sheet 感） */
.modal-box{
  background-color: var(--glass-floor-modal);                 /* .86 */
  background-image:
    linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.02) 44%, rgba(255,255,255,.06)),
    radial-gradient(120% 80% at 24% -14%, var(--light-1), transparent 62%);
  border:1px solid var(--glass-stroke-hi); border-radius:20px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.40), inset 0 -1px 0 rgba(0,0,0,.40),
              0 48px 90px -28px rgba(0,0,0,.88);
  padding: 24px 26px; max-width: min(520px, 92vw);
  /* 起点：后退 + 后仰 + 缩小 */
  transform: perspective(1100px) translateZ(-40px) rotateX(8deg) scale(.94);
  transform-origin: 50% 100%;
  transition: transform var(--d-slow) var(--ease-sheet), opacity var(--d) linear;
}
.modal.show .modal-box{ transform: perspective(1100px) translateZ(0) rotateX(0deg) scale(1); }
.modal.closing .modal-box{ transform: perspective(1100px) translateZ(-24px) rotateX(-3deg) scale(.97); }
/* 弹窗按钮区 */
.pop-actions, .modal-btns{ display:flex; gap:var(--s2); justify-content:flex-end; margin-top:var(--s4); }
```
- **禁止**给 `.modal-box` 再叠 `backdrop-filter`（遮罩已有一层），双层 blur 是最贵的操作之一。
- `alert()` 替换为 DOM 弹窗列为 **P2**，需 ui.js 配合，不在本次视觉改造范围。

### 6.10 其余组件的统一处理

| 组件 | 处理 |
|---|---|
| `.mini-btn` | 薄玻璃胶囊：`background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.02)); border:1px solid var(--glass-stroke); border-radius:9px; box-shadow:inset 0 1px 0 rgba(255,255,255,.22); ` hover `translateZ(5px)` + 边框转橙；`:disabled` 降 `opacity:.38` + 去高光 |
| `.cup-card` | 薄玻璃 panel，`border-radius:12px`，hover `translateZ(10px)`；`.cup-head b` 加 `text-shadow:0 1px 0 rgba(0,0,0,.45)` |
| `.fin-row` | 去 `border-bottom`（改 `padding:5px 0` + 每项 `border-radius:8px` hover `rgba(255,255,255,.06)`） |
| `.log-line` | `border-bottom:1px solid var(--line-glass)`；`color:var(--chalk-dim)` |
| `.pbp` | 滚动区 → **不启用 blur**；`background:rgba(0,0,0,.22); border-radius:10px; box-shadow:inset 0 1px 3px rgba(0,0,0,.45)`；`div:nth-child(odd)` 保持 `opacity:.8` |
| `.score-big` | `background:linear-gradient(180deg,#fff,#c9d4cf)` + `background-clip:text` + `text-shadow:0 2px 0 rgba(0,0,0,.5)`；加 `@supports` 回退 |
| `.champion`（`#season-end`） | 冠军卡：`translateZ(28px)`，橙色渐变边框（`border:1px solid rgba(255,122,60,.55)`）+ `box-shadow:0 0 40px -12px rgba(255,122,60,.55), inset 0 1px 0 rgba(255,255,255,.35)`。**全站唯一允许 40px 辉光处** |
| `.trophy-list li` | 薄玻璃胶囊，hover `translateZ(6px)` |
| `.attr-mini b` | 等宽数字，色 `--chalk` |
| `.star` | 紫 `#c084fc`，加 `text-shadow:0 0 10px rgba(192,132,252,.45)`（球星专属微辉光） |
| `.side-roster-row` / `.train-row` | 见 §6.6 |
| `.screen`（`#screen-pick` / `#screen-game`） | 入场：`animation: screenIn 320ms var(--ease-out)`，`from{opacity:0; transform:translateZ(-40px) rotateX(3deg)}` |

---

## 7. 动效规范

### 7.1 时长 / 曲线 / 位移量总表

| 场景 | 时长 | 曲线 | 位移量 | 备注 |
|---|---|---|---|---|
| **入场 · 屏幕** | 320ms | `--ease-out` | `translateZ(-40px)→0`, `rotateX(3deg)→0`, `opacity 0→1` | `.screen` |
| **入场 · 卡片 stagger** | 360ms / 每张延 14ms | `--ease-out` | `translateZ(-28px)→0`, `rotateX(6deg)→0`, `scale .97→1` | 仅选队网格，`--i` cap 24 |
| **切换 · 视图** | 220ms | `--ease-out` | `translateZ(-18px)+opacity 0` → `translateZ(0)+opacity 1` | **禁止横向滑动**（XBA 无滑动语义） |
| **悬浮 · 内容卡片** | 220ms | `--ease-out` | `translateZ 8px→18px`，`rotateX 1deg→0deg` | 不做跟随倾角 |
| **悬浮 · 导航项** | 220ms | `--ease-out` | `translateZ 0→10px`，`rotateY 0→-5deg` | |
| **悬浮 · 队卡（常态）** | 280ms | `--ease-settle` | `translateZ 0→28px` | 无指针时 |
| **跟随 · 队卡（跟手）** | 120ms | `--ease-follow` | `rotateX/Y ±6deg` | `--mx/--my` 驱动 |
| **松开 · 队卡回弹** | 400ms | `--ease-settle` | 回到 `translateZ(0) rotate(0)` | |
| **按压 · 任意** | 90ms | `--ease-out` | `translateZ→4px`, `scale .985–.994` | 阴影同步收紧到 `--shadow-press` |
| **弹窗 · 开** | 360ms | `--ease-sheet` | `translateZ -40px→0`, `rotateX 8deg→0`, `scale .94→1` | |
| **弹窗 · 关** | 220ms | `--ease-in` | `translateZ 0→-24px`, `rotateX 0→-3deg`, `scale 1→.97` | |
| **数字变化** | 180ms | `--ease-out` | `scale 1→1.06→1` + `color` 200ms | 不做滚动数字 |
| **轮次推进脉冲** | 360ms | `--ease-out` | `#btn-advance` `translateZ 4px→14px→4px` | 一次性 |
| **扫光（P1）** | 280ms | `--ease-out` | `opacity 0→1` | `.glass::after` |

### 7.2 视差 / scroll-driven（P2，渐进增强）

```css
@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) {
    /* 顶栏随滚动轻微后退，制造景深；幅度极小，不影响可读 */
    #hdr{ animation: hdrDepth linear both; animation-timeline: scroll(root block); animation-range: 0 320px; }
    @keyframes hdrDepth{ to{ transform: perspective(1400px) translateZ(4px) rotateX(2.2deg); } }
    /* 舞台顶光随滚动上移（背景层，不影响文字） */
    body::before{ animation: lightDrift linear both; animation-timeline: scroll(root block); animation-range: 0 100vh; }
    @keyframes lightDrift{ to{ transform: translateY(-6%); } }
  }
}
```
- **范围红线**：视差只允许施加在 `#hdr`、`body::before`、`.side`（`translateZ` 随滚动 ±4px）。**绝不允许**作用于 `.card` 内容或表格——滚动中的 3D 变换会让文字持续重采样，直接违反约束 §4。
- `animation-timeline` 在 Safari / Firefox 尚未全量支持 → 必须包在 `@supports` 内，不支持时静默失效，视觉回落到静态玻璃。

### 7.3 焦点与键盘

```css
:focus-visible{
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 8px;
  box-shadow: 0 0 0 4px rgba(255,122,60,.20), 0 0 18px -6px rgba(255,122,60,.55);
}
```
- 焦点环在所有状态下**不被 3D 变换削弱**：`.team-btn:focus-visible` 强制 `--z-lift:20px` 且 `--tilt-grid-max:0deg`（抬起但摆正，保证焦点环完整可见）。
- 战术板棋子（`.token`）需可 Tab 聚焦：给 `<g>` 加 `tabindex="0"`（新增属性，不改 class），方向键微调 ±8 单位（P1，见 §8.1）。

---

## 8. 无障碍与性能降级矩阵

### 8.1 可访问性分级：**Standard**（目标 Comprehensive）

| 项 | 达标 | 落地 |
|---|---|---|
| 正文对比度 | ✅ AAA（16:1 / 11.4:1 / 8.2:1） | §4.4 |
| 非文本对比度（边框/图标） | ✅ ≥3:1 | `--glass-stroke .14` 对玻璃底 ≈ 1.6:1 ⚠ → **交互控件边框必须 ≥ `rgba(255,255,255,.28)`**（≈3.2:1）。普通装饰分隔线可保持 .09 |
| 键盘可达 | ✅ 全部 button/select/a 原生可达；棋子 `tabindex="0"`（P1） | §7.3 |
| 焦点可见 | ✅ 2px accent + 4px 外环 + 辉光 | §7.3 |
| 语义 | ✅ 沿用现有 `button`/`table`/`svg[role=img][aria-label]` | 不改 |
| 双编码（色盲） | ✅ 胜负带 ✔/✘ 与文字；涨跌带 ▲/▼；升降带「升/降」字 | §4.6 |
| 色盲模式 | ✅ `html[data-cvd]` 切换到橙/蓝轴 | §8.2 |
| 动效降级 | ✅ `prefers-reduced-motion` | §8.2 |
| 透明度降级 | ✅ `prefers-reduced-transparency` | §8.2 |
| 强制颜色 | ✅ `forced-colors: active` | §8.2 |
| 读屏播报 | 🔸 P2：`#hdr` 加 `aria-live="polite"` 播报轮次/比分变化 | 交 engineering-lead |

### 8.2 降级覆盖（**全部关掉 3D 量，CSS 变量一处归零**）

> **关键工程建议：所有 3D 量（倾角 / translateZ / blur）必须走 CSS 变量，不要在具体规则里写死数值。** 这样降级只需覆盖 `:root`，不会漏项。

```css
/* ① 动效降级：3D 与视差全关，回落到平面玻璃 */
@media (prefers-reduced-motion: reduce){
  :root{
    --tilt-card:0deg; --tilt-nav:0deg; --tilt-side:0deg; --tilt-tab:0deg;
    --tilt-grid-max:0deg; --tilt-court:0deg; --tilt-modal:0deg;
    --z-panel:0px; --z-raise:0px; --z-lift:0px; --z-overlay:0px; --z-back:0px;
    --d-press:0ms; --d-fast:80ms; --d:100ms; --d-3d:100ms; --d-slow:140ms;
  }
  *, *::before, *::after{ animation:none !important; }
  .card, .nav, .side > .card, .topbar, .tabs, .team-btn, svg.board, #board::before, #board::after{
    transform: none !important;
  }
  /* 保留 opacity / color / background 的极短过渡，避免"硬闪" */
  .card, .nav-btn, .tab-btn, .team-btn{ transition: opacity 80ms linear, color 80ms linear, background-color 80ms linear !important; }
  /* 战术板：地板与球场线回落到同平面（θ=0 时 ::before 仍可保留木纹，只是不再倾斜） */
  #board{ perspective:none; }
}

/* ② 透明度降级：提高不透明度，去掉 blur */
@media (prefers-reduced-transparency: reduce){
  :root{ --glass-floor:rgba(11,17,20,.94); --glass-floor-strong:rgba(11,17,20,.96); --glass-floor-modal:rgba(8,12,14,.98); }
  .glass, .card, .topbar, .nav, .tabs, .side > .card, .team-btn, .modal{
    -webkit-backdrop-filter:none !important; backdrop-filter:none !important;
  }
  tbody tr:nth-child(even){ background-color: rgba(255,255,255,.05); }
}

/* ③ 不支持 backdrop-filter（旧内核 / Firefox 未开启） */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))){
  :root{ --glass-floor:rgba(11,17,20,.90); --glass-floor-strong:rgba(11,17,20,.93); --glass-floor-modal:rgba(8,12,14,.96); }
}

/* ④ 色盲模式（JS 切换 html[data-cvd]） */
:root[data-cvd="deuter"], :root[data-cvd="protan"], :root[data-cvd="tritan"]{
  --win:#57b6ff; --lose:#ffa14a;      /* 胜负 → 蓝 / 橙 */
  --up:#ffa14a;  --down:#57b6ff;      /* 涨跌 → 橙 / 蓝（仍带 ▲▼ 双编码） */
  --warn:#ffd54a; --info:#9ecbff;
}

/* ⑤ 强制颜色模式（Windows 高对比） */
@media (forced-colors: active){
  .card, .topbar, .nav, .tabs, .side > .card, .team-btn, .modal-box{
    background: Canvas !important; border:1px solid CanvasText !important;
    -webkit-backdrop-filter:none !important; backdrop-filter:none !important;
    box-shadow:none !important; transform:none !important;
  }
  .nav-btn.active, .tab-btn.active, tbody tr.you{ border:2px solid Highlight !important; }
}
```

### 8.3 性能预算（硬上限）

| 项 | 上限 | 超出处置 |
|---|---|---|
| 同屏 `backdrop-filter` 元素数 | **≤ 6** | 见「视口内才开玻璃」策略 |
| blur 半径 | 薄 8 / 面板 12 / chrome 16 / modal 24（**单层上限 24px**） | 超出即降级 |
| 同屏 `preserve-3d` 容器 | **≤ 1**（只有 `#board`） | 违反见 §8.4 风险 1 |
| 同屏参与 3D 变换的元素 | ≤ 40（常态下只有 hover 的 1 个 + 常驻 5 个面板） | 42 队网格：常驻 `transform:none`，只有 hover 项变换 |
| 常驻 `will-change` 元素 | **0** | 只在 hover 期间加类，离开即移除 |
| 外投影层数 | 每元素 1 层 | — |
| 全屏光效层 | 1（`body::before`） | — |
| `style.css` 体积 | ≤ 26 KB（当前 11.9 KB） | 超出则压缩注释 |

**「视口内才开玻璃」策略（推荐实现，P1）**：

```js
// 只给视口内的 .card 启用 backdrop-filter，其余降级为"预烘焙玻璃"（无 blur，仅渐变+高光）
var io = new IntersectionObserver(function (es) {
  es.forEach(function (e) { e.target.classList.toggle('is-near', e.isIntersecting); });
}, { rootMargin: '120px' });
function watchCards(){ document.querySelectorAll('.view .card').forEach(function (c){ io.observe(c); }); }
```
```css
.card{ background-color: rgba(11,17,20,.80); -webkit-backdrop-filter:none; backdrop-filter:none; }   /* 默认：无 blur */
.card.is-near{ background-color: var(--glass-floor); -webkit-backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat)); backdrop-filter: blur(var(--blur-panel)) saturate(var(--sat)); }
```
> **为什么必须这样**：`backdrop-filter` 元素在页面滚动时每帧都要重采样并重算模糊。主区是长滚动列（名册 12 行 / 技术统计 10 列 / 日志 60 行），若每张卡常驻 blur，滚动帧率会掉到 30fps 以下。
> **更省事的 P0 替代**：直接**不给主区 `.card` 加 blur**，只加渐变 + 内高光（视觉上 90% 像玻璃），blur 只给常驻不动的 `#hdr` / `.nav` / `.tabs` / `.side`（4 个）。**推荐先按这条做**，P1 再上 IntersectionObserver。

**低端设备探测（P1）**：
```js
var lowPerf = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4
  || matchMedia('(update: slow)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.dataset.perf = lowPerf ? 'low' : 'high';
```
```css
:root[data-perf="low"]{
  --blur-panel:6px; --blur-thin:4px; --blur-chrome:8px; --blur-modal:12px;
  --tilt-grid-max:0deg; --tilt-court:0deg; --z-lift:0px;   /* 网格与球场不做 3D */
  --d-slow:200ms; --d-3d:160ms;
}
:root[data-perf="low"] .glass::after{ display:none; }       /* 去掉扫光层 */
```

### 8.4 ⚠ 三个技术雷区（必读）

1. **`backdrop-filter` × `preserve-3d` 互斥**
   `backdrop-filter` 属于 CSS 的「分组属性」（与 `filter`/`opacity<1`/`mask`/`clip-path` 同类），会把元素强制**扁平化**并创建独立的 backdrop root。后果：(a) 父级 `preserve-3d` 被静默降级为 `flat`，子元素的 `translateZ` 全部失效；(b) 3D 上下文内的玻璃**采不到背后的真实内容**，渲染成灰白雾面。
   → **对策**：全局只有 `#board` 用 `preserve-3d`；玻璃面板一律作为**叶子节点**使用 `backdrop-filter`，且其 3D 变换用 `transform: perspective() …`（自带透视，不依赖父级 preserve-3d）。

2. **`overflow:hidden` / `isolation:isolate` 也会强制扁平化**
   现有 `.tabs{overflow:hidden}` 会使其子元素扁平——可接受（Tab 内部不需要 3D）。
   但 **`.card` 绝不能加 `overflow:hidden`**，否则 `#board` 的地板（`::before` 超出卡片边界）会被裁掉。
   → 已在 §6.4 标注。

3. **3D 旋转导致文字重采样发虚**
   浏览器对变换中的元素按合成层分辨率栅格化一次，旋转后位图被重采样。中文（笔画密）在 >3° 时明显发虚。
   → **对策**：含正文的元素 `|rotateX| ≤ 3°`、`|rotateY| ≤ 2.5°`；表格区域 `transform:none`；`--tilt-grid-max` 只作用于队卡（字号 18/13px，且仅 hover 瞬时）。

---

## 9. 落地检查清单（工程验收项）

> 实现方：engineering-lead。全部勾选后方可合并。

### A. 结构安全（P0，一票否决）
- [ ] `index.html` 的 **DOM id / class 零改动**：diff 检查 `index.html` 仅允许新增 `style.css` 版本号；不得增删改任何 `id=` 与既有 `class=`
- [ ] `tools/verify-ui.js` **全绿**（当前 48 项断言，不得新增失败项）
- [ ] `#team-grid .team-btn` 数量仍为 42（断言 24 行）
- [ ] `.nav-btn ≥ 12`、`.tab-btn === 4`、`.view` 20 个、`#side-roster .side-roster-row` 首发 5 / 替补 7 全部不变
- [ ] `svg.board` 仍存在且 `viewBox="0 0 500 470"`；`.token` 的 `data-id` / `data-pos` 不变
- [ ] `#hdr` 内 `.tb-item / .tb-team / .broadcast / #btn-advance` 文本与结构不变（顶栏 5 项文本断言）
- [ ] 新增请求数 **0**：无新 `<link>`、无新 `<script>`、无外部字体/CDN/图片
- [ ] `style.css` 体积 ≤ 26 KB

### B. 3D 与材质（P0）
- [ ] 全局 `transform-style: preserve-3d` 仅出现在 `#board`（用 DevTools 搜索确认 ≤1 处）
- [ ] 所有 3D 量走 CSS 变量（`--tilt-*`、`--z-*`），无硬编码角度/位移散落在规则中
- [ ] 玻璃配方含 `--glass-floor` 保底层，且 ≥ `.62`
- [ ] 每元素外投影 ≤ 1 层；`box-shadow` 内高光 ≤ 3 条
- [ ] 全站 `will-change` **无常驻**（grep 确认只出现在 `.is-lift` 等 hover 态内）
- [ ] 同屏 `backdrop-filter` 元素 ≤ 6（用 `getComputedStyle` 脚本统计：顶栏 1 + 导航 1 + Tab 1 + 右面板 1 + 主区卡片 ≤2）

### C. 可读性（P0）
- [ ] 表格区域（`table / thead / tbody / tr / th / td`）`transform: none`
- [ ] 表格正文对比度 ≥ 7:1（`#c3cec9` on 玻璃 = 11.4:1；hover 态 ≥ 10:1）
- [ ] `--chalk-dim` 对比度 ≥ 7:1（8.2:1）
- [ ] 所有交互控件（`.nav-btn/.tab-btn/.mini-btn/select`）边框对比度 ≥ 3:1
- [ ] `th,td` 右对齐、首列左对齐不变；`.num` 仍 `tabular-nums`；列宽不跳
- [ ] 所有 `tbody tr:hover` 带 `inset 3px 0 0` 左侧橙色行指示器
- [ ] 名册 12 行 × 8 列、技术统计 10 列、积分榜 14 行 × 6 列，**无横向溢出、无换行错乱**

### D. 战术板（P0/P1）
- [ ] `#board::before` 木地板与 `svg.board` 使用**同一个** `--court-tilt`（视觉上贴合无缝）
- [ ] `.card` **未**被加 `overflow:hidden`（否则地板被裁）
- [ ] 拖拽回归 5 点：中心 / 左上 / 右上 / 左下 / 右下，落点误差 ≤ 半格（P0 tilt=12° 时 ≤ 25 viewBox 单位）
- [ ] 若 tilt > 12°：**必须**已换逆投影 hit-test（`toLocal()`）+ 松手吸附格心
- [ ] 棋子含落地椭圆阴影 + 左上高光（`token-shadow` / `token-hi`）
- [ ] 6×6 格线渲染 36 格（P1）
- [ ] `.token` 拖拽时 `filter` 阴影收紧（抓起感）

### E. 降级（P0）
- [ ] `prefers-reduced-motion: reduce`：所有 `transform:none`、无 animation、战术板不倾斜
- [ ] `prefers-reduced-transparency: reduce`：`backdrop-filter:none`、`--glass-floor ≥ .94`
- [ ] `@supports not (backdrop-filter)` 回退生效
- [ ] `@media (hover:none)`：无跟随倾角
- [ ] `:root[data-perf="low"]`：blur ≤ 8px、网格与球场倾角 0
- [ ] `forced-colors: active`：无 blur、无 transform、边框 `CanvasText`
- [ ] **手动验证**：DevTools → Rendering → Emulate `prefers-reduced-motion` / `prefers-reduced-transparency` 各跑一遍全流程

### F. 性能（P1）
- [ ] 选队页 42 卡：pointermove 扫过全网格，DevTools Performance 帧率 ≥ 55fps
- [ ] 名册页（最长表）滚动：帧率 ≥ 55fps，无 layout thrash
- [ ] 合成层数：Layers 面板中常驻层 ≤ 12
- [ ] 无内存泄漏：切换视图 20 次后 `performance.memory` 无明显增长（IntersectionObserver 需 `disconnect`）
- [ ] `style.css` 无 `@import`、无 `filter: url()`（SVG 滤镜重 raster，禁用）

### G. 视觉复核（P0，人工）
- [ ] 全屏橙色像素占比 ≤ 6%（截图取色统计）
- [ ] 玻璃面板在深色与浅色背景区域（选队页 vs 主界面）均不"发白、发灰"
- [ ] 顶栏、左导航、右面板三者的倾角方向构成「向内环抱」的舞台感（左 +2.5°，右 −2.5°，顶 −1.2°）
- [ ] 战术板一屏为全站视觉高潮，截图与 §6.8 描述一致
- [ ] 1280 / 960 / 680 三个断点各截图一次，3D 不破版（680 以下 `.nav` 变横向，需确认 `rotateY(2.5deg)` 不裁切）

---

## 附：实现顺序建议（给 engineering-lead）

| 阶段 | 内容 | 风险 |
|---|---|---|
| **S1** | 追加 §4.7 全部 Token；`body` 舞台背景；`.card` / `#hdr` / `.nav` / `.tabs` / `.side` 玻璃化 + flat tilt（**暂不加 blur 到主区卡片**） | 低 |
| **S2** | 表格改造（§6.5）：斑马纹、行指示器、`.you`、`.tag`、`.bar` | 低 |
| **S3** | 战术板 3D 地板（§6.8），`--court-tilt: 12deg`，**不改 `attachDrag()`** | 中（hit-test 误差已核算为 0.35 行） |
| **S4** | 选队网格 3D 悬浮 + 事件委托跟随倾角 + stagger（§6.7） | 中（性能） |
| **S5** | 降级矩阵全量（§8.2）+ 验收清单 E | 低 |
| **S6（P1）** | 战术板 tilt 提到 18–22° + 逆投影 hit-test + 6×6 吸附；IntersectionObserver 玻璃；`data-perf` 探测 | 中高 |
| **S7（P2）** | scroll-driven 视差；`alert()` → DOM 弹窗；棋子键盘拖拽；`aria-live` 播报 | 低 |

---

*— 林绘澄 · ART-3D-01 · 完 —*
