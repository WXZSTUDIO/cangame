# 可访问性分级与特性矩阵 · cangame

> 阶段：Phase 6 · Polish　｜　范围：Web 版 cangame　｜　审计人：art-director（林绘澄）
> 现状基线：**零无障碍设施**（全站仅头像 `<svg aria-label>` 一处语义，无 `role`/`tabindex`/`reduced-motion`/字幕/字号设置）
> 目标：给出 **Basic / Standard / Comprehensive** 三级 + 特性矩阵 + 落地优先级

---

## 1. 分级定义

参考 WCAG 2.1 AA 与「行业无障碍分级」实践，为本作（**纯静态文字人生模拟器**）定义三级。**推荐目标：Standard**（可达成本低，收益覆盖 90% 障碍用户）。

| 级别 | 定位 | 覆盖障碍类型 | 本作适配度 |
| --- | --- | --- | --- |
| **Basic** | 合规底线，消除「读不了/点不到」 | 低视力、色盲、运动障碍（轻度） | 必做，成本极低 |
| **Standard**（默认目标） | 主流发行标准，含键盘全通 + 语义化 | 低视力、色盲、全盲（基本）、运动障碍、认知 | 推荐，增量 ≈ 1 个 Sprint |
| **Comprehensive** | 示范级，含自定义 + 屏幕阅读器深度支持 | 全谱系含重度视听障碍 | 可选，成本较高 |

---

## 2. 对比度审计（Basic 级核心项）

已按 WCAG 2.1 相对亮度公式实测（脚本见 `asset-audit.md` §7）：

| 前景 | 背景 | 用途 | 对比度 | 判定 |
| --- | --- | --- | --- | --- |
| `#100F06` ink | `#FFFFFF` card | 正文 | 19.21 | ✅ AA/AAA |
| `#FFFFFF` | `#100F06` HUD | HUD 主字 | 19.21 | ✅ |
| `#6F6D5E` | `#FFFFFF` | `.lead/.line` | 5.22 | ✅ AA |
| `#6F6D5E` | `#F5F4ED` | 正文灰 | 4.73 | ✅ AA |
| `#8B897C` dim | `#FFFFFF` | 次要文字 | **3.52** | ⚠ 仅 AA-large（<18px 正文不达标） |
| `#8B897C` dim | `#F5F4ED` | 次要文字 | **3.19** | ⚠ 仅 AA-large |
| `#B4B1A0` | `#FFFFFF` | `.foot/.of-meta/.mk-meta` | **2.16** | ❌ **FAIL** |
| `#B4B1A0` | `#F5F4ED` | 弱化文字 | **1.96** | ❌ **FAIL** |
| `#C9C6B6` | `#FFFFFF` | `.ladder .arrow` | **1.72** | ❌ **FAIL** |
| `#C2403E` red-d | `#FFFFFF` | 涨/危险 | 5.13 | ✅ |
| `#1E7A4E` green-d | `#FFFFFF` | 跌/成功 | 5.32 | ✅ |
| `#8F6E00` gold-d | `#FFF3CC` gold-l | 金币文字 | **4.31** | ⚠ 仅 AA-large |
| `#FFDA57` gold | `#100F06` ink | HUD 金额 | 14.11 | ✅ |
| white@0.65（`--dim` 语义） | ink HUD | `.hud-age` 等 | 8.35 | ✅ |
| white@0.72 | ink HUD | dock 未选中 | 10.09 | ✅ |

### 结论

- **必须修（FAIL）**：`#B4B1A0`（3 处使用类）、`#C9C6B6`（1 处）——弱化文字对比 <3:1。
- **建议修（AA-large-only）**：`--dim #8B897C`（大量次要文字 >18px 才达标）、`gold-d on gold-l`。
- **达标**：深色 HUD 上所有白字、正文 ink、语义色 `-d` 系列。

> **最小修复**：把 `#B4B1A0`/`#C9C6B6` 统一替换为 `var(--dim #8B897C)` 并把 `--dim` 加深到 `#7A7869`（≈4.5:1），一次性解决全部 FAIL + AA-large。

---

## 3. 色觉障碍（colorblind）审计 —— **本作最大无障碍风险**

### 3.1 涨红跌绿问题

中国习惯「涨红跌绿」，本作 `--red #F47575 / --red-d #C2403E`（涨）、`--green #2FA36B / --green-d #1E7A4E`（跌）。

**实测**：`red-d #C2403E` 亮度 L=0.155，`green-d #1E7A4E` 亮度 L=0.147，**两者对比仅 1.04**。对**红绿色盲（deuteranopia/protanopia，约占男性 8%）**而言，这两个色**在明度上几乎完全相同**，只看明度无法区分 —— **若仅靠颜色，涨跌将不可辨**。

### 3.2 已有的缓解（值得表扬，应固化）

- **市场模块**：`ui.js:1752/1782/1799` 输出 `+`/`−` 符号；`mk-alert.up/.down` 带文字（「XX 年 … 上涨/暴跌」）。
- **属性条 warn**：`.m.bad` 除红色外还有 `background:var(--red-l)` 底 + 边框变化。

**这是 WCAG 1.4.1「不单靠颜色」的正确实践**，但**未系统化**：

### 3.3 缺口

| 位置 | 是否仅靠颜色 | 应补线索 |
| --- | --- | --- |
| 市场涨跌价格 | 部分（有 `+/−`） | ✅ 已够，保持 |
| **属性条数值变化**（红涨绿跌） | **是** | 加 ▲/▼ 或 `+/−` |
| **netWorth / 现金流正负** | 是（`ui.js:719/720` 内联 `var(--red)`） | 加符号或图标 |
| **`.line.money`/`.line.warn`** 日志 | 是（纯色文字） | 加前缀符号（💰/⚠） |
| HUD 现金/净值 pill | 颜色区分但语义靠 🏦💵 | ✅ 可接受 |

**建议**：制定「**颜色冗余规则**」——所有「涨/跌、正/负、好/坏」不得仅用红/绿，**必须同时具备 符号 或 形状 或 文字**。列入资产规格 §6。

### 3.4 色盲模式（可选特性）

Comprehensive 级应提供「**色盲友好模式**」：把 `--red/--green` 改为**蓝-黄轴**（deuteranopia 可辨），或叠加**纹理/图案**。成本较高，列 Comprehensive。

---

## 4. 键盘可达性审计

### 4.1 现状

- **几乎所有交互依赖鼠标/触屏 `onclick`**：`div`/`span` 当按钮用（如 `.rel-name.tap`、`.metric-strip .m.more`）。
- **唯一的键盘支持**（`ui.js:1904`）：游戏页按下 `Space`/`Enter` 时，**仅当选项恰好只有 1 个**才触发 `btns[0].click()`。
- 无 `tabindex`、无可见 focus 样式（除 `#inputName:focus`、`.talent-bar input:focus`），**`.btn` 无 `:focus-visible` 样式**。

### 4.2 缺口与影响

| 缺口 | 影响 |
| --- | --- |
| 3 选 1 事件选项无法用方向键/数字键选择 | 键盘用户卡在核心玩法 |
| `.rel-name.tap`（点名字聊天）是 `span` 无 tabindex | 无法键盘触达 |
| `.metric-strip .m.more`（＋更多）是 `span` | 无法键盘触达 |
| `div.btn.choice`? — 实为 `<button>` 已可点（需核实），但 **无 focus 样式**，键盘用户不知焦点在哪 | 迷失 |
| Modal（存档/确认）无 focus trap、无 Esc 关闭 | 键盘难以操作弹窗 |
| dock 导航是 `<button>` ✅ 可 Tab，但无 focus 视觉 | 迷失 |

### 4.3 Basic / Standard 级的键盘要求

- **Basic**：`.btn:focus-visible` 可见轮廓；所有 `<button>` 可 Tab。
- **Standard**：3 选 1 支持 `1/2/3` 键 + `↑↓` + `Enter`；把假按钮（`span.tap`/`.m.more`）改 `role="button" tabindex="0"` + 键盘事件；Modal 加 focus trap + Esc。
- **Comprehensive**：全站快捷键表 + 可重映射。

---

## 5. 动效与偏好设置

### 5.1 `prefers-reduced-motion`

**现状：完全未处理**。全站含大量 `transition`（`.btn` 位移、`.how` 展开、`#toast` 滑入、`.quiz-progress` 宽度）与 `transform`（hover 上浮、active 下沉）。

虽无剧烈动画（无视差/无自动播放），但 **hover 位移 + toast 滑动** 对前庭障碍用户仍应尊重系统偏好。

**改法（Basic 级，CSS ~5 行）**：

```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{transition-duration:.001ms !important;animation-duration:.001ms !important;animation-iteration-count:1 !important;}
  .btn:hover,.btn:active,.fam:hover,.talent:hover{transform:none !important;}
}
```

### 5.2 字号缩放

- 全部字号为 `px`（`body` 未设基准），**用户浏览器「字号放大」不生效**（px 不随根字号缩放）。
- 移动端 `viewport` 未限制 `user-scalable`（**好** —— 允许双指缩放，保留）。
- **建议（Standard）**：`html{font-size:100%}`，把正文字号改用 `rem`；或提供「**大字号模式**」切换（`body.big-font .card-text{font-size:19px}` 等），列 Standard 特性。

---

## 6. 屏幕阅读器语义

### 6.1 现状

- 仅头像 `portraitSVG` 有 `aria-label="${name}"` ✅。
- 其余：**`<div class="screen">` 换页无 `aria-hidden`**（隐藏页仍被读）、`#stream` 滚动区无 `role="log"`、`#card` 无 `role="region"`、选项 `.actions` 无分组、`#toast` 无 `role="status"`、`.crash` 无 `role="alert"`。
- 大量内容用 emoji 单字（🏅💼）承载语义，**SR 会念 emoji 名称**（如「奖牌」），噪音大。

### 6.2 Basic / Standard 要求

| 元素 | 建议 |
| --- | --- |
| `.screen` | `display:none` 已隐藏 DOM 但 `display:block` 时才有语义；确保**非活动页用 `hidden` 或 `aria-hidden="true"`** |
| `#stream` | `role="log" aria-live="polite"`（新事件自动播报） |
| `#card` | `role="region" aria-label="当前事件"` |
| `#toast` | `role="status"` |
| `.crash` | `role="alert"` |
| 装饰 emoji | `aria-hidden="true"` 或改 `::before` 内容 |
| dock/icon-btn | `aria-label`（如 `aria-label="存档"`，现只有 `title`） |
| `.m.more` / `.tap` | `role="button"` + 键盘 |
| `<html lang="zh-CN">` ✅ 已正确 |

---

## 7. 移动端与触控目标（Basic 级）

| 项 | 现状 | WCAG 2.5.5 目标 44×44 | 判定 |
| --- | --- | --- | --- |
| `.icon-btn`（HUD 存/档/重开/返回） | `34×34` | 44×44 | ❌ 偏小 |
| `.pill`（现金/净值） | padding 6×10 + 12px 字 ≈ 32×30 | 44×44 | ❌ 偏小 |
| `.dock-btn` | flex 均分 + padding 7px，≈ 44 高 | — | ✅ 达标 |
| `.rel-act` | padding 8×14 + 13px ≈ 36 高 | 44 | ⚠ 接近 |
| `.btn.tiny` | padding 5×12 + 12px ≈ 28 高 | 44 | ❌ 偏小 |
| `.mtab` | padding 7×14 ≈ 34 高 | 44 | ⚠ 接近 |

**建议**：触控目标 `min-height:40–44px`（可保持视觉小、用透明 padding 扩热区）。`.icon-btn` 提到 `40×40`、`.pill` 加 `min-height:40`。列 Basic。

---

## 8. 可访问性特性矩阵

| 特性 | Basic | Standard | Comprehensive | 本作现状 |
| --- | :-: | :-: | :-: | --- |
| 对比度 ≥ 4.5:1（正文） | ● | ● | ● | ⚠ 3 处 FAIL |
| 非文字对比 ≥ 3:1（图标/边框） | ● | ● | ● | ⚠ |
| 不单靠颜色传达信息 | ● | ● | ● | ⚠ 部分（市场✅） |
| 键盘可操作全部交互 | — | ● | ● | ❌ |
| 可见 focus 指示 | ● | ● | ● | ❌ |
| `prefers-reduced-motion` | ● | ● | ● | ❌ |
| 触控目标 ≥ 44px | ● | ● | ● | ⚠ |
| 语义化标签 / ARIA | — | ● | ● | ❌ |
| 屏幕阅读器支持（live region） | — | ● | ● | ❌ |
| Modal focus trap + Esc | — | ● | ● | ❌ |
| `lang` 声明 | ● | ● | ● | ✅ |
| 页面可缩放（不禁 user-scalable） | ● | ● | ● | ✅ |
| 字号缩放 / 大字号模式 | — | ● | ● | ❌ |
| 色盲模式（蓝黄轴/纹理） | — | — | ● | ❌ |
| 高对比模式 | — | — | ● | ❌ |
| 字幕 / 文字替代（音频） | — | — | ● | N/A（无音频） |
| 输入重映射 | — | — | ● | ❌ |
| 屏幕阅读器深度优化（角色/状态播报） | — | — | ● | ❌ |

图例：●=该级要求　—=该级不要求　⚠=部分达标　❌=缺失　✅=已达标

---

## 9. 落地优先级（按 ROI 排序）

| 优先级 | 项 | 成本 | 收益 | 级别 |
| :-: | --- | --- | --- | --- |
| **P0** | 修 3 组 FAIL 对比度（`#B4B1A0`/`#C9C6B6`→`--dim` 并加深） | 极低（改 1 变量） | 高 | Basic |
| **P0** | 给涨跌/正负加非颜色冗余（▲▼ 或 `+/−`） | 低 | 高 | Basic |
| **P0** | `.btn:focus-visible` 可见焦点 | 极低（~3 行） | 高 | Basic |
| **P1** | `prefers-reduced-motion` 媒体查询 | 极低（~5 行） | 中 | Basic |
| **P1** | 触控目标提到 ≥40–44px | 低 | 中 | Basic |
| **P1** | 3 选 1 支持 `1/2/3` 数字键 | 低 | 高 | Standard |
| **P2** | 语义化：`role="log"/"region"/"status"/"alert"` + `aria-hidden` | 中 | 高 | Standard |
| **P2** | 假按钮（`.tap`/`.m.more`）`role=button`+键盘 | 中 | 中 | Standard |
| **P2** | Modal focus trap + Esc | 中 | 中 | Standard |
| **P3** | 大字号模式 | 中 | 中 | Standard |
| **P3** | 色盲友好模式（蓝黄轴） | 高 | 中 | Comprehensive |
| **P4** | 高对比模式 / 输入重映射 | 高 | 低 | Comprehensive |

**推荐 Phase 6 范围：P0 全部 + P1 全部**（Basic 级达成），成本约 1–1.5 人日，全部为 CSS + 少量 JS，**不动核心逻辑，回归风险低**。

---

## 10. 交接备注

- 本文件与 `asset-spec.md` §6「颜色冗余规则」、§7「无障碍约束」配套。
- **UX 规格（文策渊侧）须引用本分级**（引用方式：`可访问性分级：Standard`）。
- 所有「必须改代码」的项已在 §9 列明改法与层级，交主理人排期；**art-director 未修改任何源码**。
