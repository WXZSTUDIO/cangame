# cangame v3 · 美术 Token 清单（可直接落 style.css）

## 1. `:root` 变量（暗面默认）
```css
:root{
  /* 色彩 */
  --board:#1c2b26; --board-2:#16211d;
  --chalk:#eef2ee; --chalk-dim:#9fb0a8;
  --accent:#ff7a3c; --win:#6fcf7f; --lose:#e26d6d; --warn:#f2c14e;
  --line:rgba(238,242,238,.18); --line-strong:rgba(238,242,238,.34);
  /* 间距阶梯 */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px;
  /* 圆角 */
  --r1:4px; --r2:8px;
  /* 字号 */
  --fs-xxl:28px; --fs-xl:22px; --fs-l:18px; --fs-m:15px; --fs-s:13px; --fs-xs:11px;
  /* 字重 */
  --w-regular:400; --w-semi:600; --w-bold:700;
  /* 字体 */
  --font-ui:"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif;
  --font-num:"SF Mono",ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;
  /* 动效 */
  --d-fast:120ms; --d:220ms; --d-slow:360ms;
  --ease-out:cubic-bezier(.22,.61,.36,1);
  --ease-in:cubic-bezier(.4,0,.2,1);
  /* 阴影层级 */
  --shadow-1:0 1px 0 var(--line);
  --shadow-2:0 8px 24px rgba(0,0,0,.45);
}
@media (prefers-reduced-motion: reduce){ *{transition:none!important;animation:none!important} }
```

## 2. 基础排版骨架（粘贴即用）
```css
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{
  background:radial-gradient(120% 120% at 50% 0%,var(--board),var(--board-2));
  color:var(--chalk);
  font-family:var(--font-ui); font-size:var(--fs-m); line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
.num{font-family:var(--font-num); font-variant-numeric:tabular-nums; font-weight:var(--w-semi)}
.chalk-line{fill:none; stroke:var(--chalk); stroke-width:2; stroke-linecap:round; stroke-linejoin:round}
.chalk-dim{fill:none; stroke:var(--chalk-dim); stroke-width:1.5; stroke-dasharray:2 5; stroke-linecap:round}
.accent{color:var(--accent)} .win{color:var(--win)} .lose{color:var(--lose)} .warn{color:var(--warn)}
button{font-family:inherit; cursor:pointer}
:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
```

## 3. 关键组件规格
- **卡片**：`border:1px solid var(--line); border-radius:var(--r1); background:rgba(255,255,255,.02); padding:var(--s4)`
- **数据条（能力值）**：容器 `height:6px; background:var(--line); border-radius:3px`；填充 `height:100%; background:var(--accent); width:<pct>%`；右侧 `.num` 显示数值。
- **按钮（主）**：`background:var(--accent); color:#1c1410; border:0; border-radius:var(--r1); padding:10px 18px; font-weight:var(--w-semi)`；悬停 `filter:brightness(1.08)`。
- **按钮（次）**：`background:transparent; color:var(--chalk); border:1px solid var(--line-strong); border-radius:var(--r1); padding:9px 16px`。
- **标签**：`font-size:var(--fs-xs); padding:2px 8px; border-radius:999px; border:1px solid var(--line)`；语义色用文字色 `--win/--lose/--warn` + 同色边框。
- **表格（技术统计）**：`border-collapse:collapse`；`th,td{padding:6px 10px; text-align:right}`；`th:first-child,td:first-child{text-align:left}`；行间 `border-bottom:1px solid var(--line)`；数字列加 `.num`。

## 4. 战术板 SVG 坐标系（viewBox 0 0 500 470）
- 板面边框：`x=20 y=20 w=460 h=430`（圆角 8）。
- 篮筐：右侧 `cx=452 cy=235 r=9`（实心 `--chalk`）。
- 三分弧：以篮筐为心 `r=150` 的弧，从左 `(302,~85)` 到右 `(302,~385)`。
- 罚球弧：`r=60` 以 `(452,235)` 为心。
- **5 个首发点位默认坐标（可拖拽，单位 viewBox）**：
  ```
  PG (150, 235)   SG (250, 120)   SF (250, 350)
  PF (350, 160)   C  (350, 310)
  ```
  拖拽约束：`x∈[60,440], y∈[60,410]`。
- 主队点位填 `--accent`，客队填 `--chalk-dim`；点位内写球员号码（`.num`，字号 12，居中）。
- 拖动实现：pointer events；移动端降级为"点击点位→弹出 5 人选择"的非拖拽路径（见 concept.md 风险 3）。

## 5. 布局栅格（桌面）
```
.app{display:grid; grid-template-columns: minmax(0,1fr) 320px; gap:var(--s5); max-width:1100px; margin:0 auto; padding:var(--s5)}
@media (max-width:760px){ .app{grid-template-columns:1fr} }
```
