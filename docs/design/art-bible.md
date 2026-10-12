# cangame v3 · 美术圣经（战术板 Chalkboard）

> 视觉方向 A · 战术板 Chalkboard（用户从 4 方案选定）。本文件为美术单一事实来源；工程抄 `art-tokens.md`。

## 1. 品牌调性与情绪板（文字描述）
像一块真实的教练战术板：哑光深灰绿板面、粉笔白线条、单一强调橙。安静、专业、可信。用户感觉"我在场边执教，而不是逛一个后台"。不热闹、不花哨——靠信息密度与精确感取胜。

## 2. 构图与网格系统
- 全局：左主区（战术板 / 列表），右信息栏（数据条 / 操作）。桌面 12 列栅格，间距阶梯 8/12/16/24。
- 战术板坐标系：半场 SVG，`viewBox="0 0 500 470"`。球场边框 20px 内缩；三分弧、罚球弧、篮筐用粉笔虚线。5 个首发点位默认坐标见 art-tokens.md。
- 列表/表格：左对齐、等宽数字、细横线分隔（非卡片堆叠）。

## 3. 色彩系统（hex，明暗两套）
```
暗面（默认）:
  --board:    #1c2b26  板面（深灰绿）
  --board-2:  #16211d  板面暗角
  --chalk:    #eef2ee  粉笔白（主文字/线条）
  --chalk-dim:#9fb0a8  粉笔灰（次要）
  --accent:   #ff7a3c  强调橙（主队/关键操作/命中）
  --win:      #6fcf7f  正（胜/增益）
  --lose:     #e26d6d  负（败/惩罚）
  --warn:     #f2c14e  警告（工资帽/伤病）
  --line:     rgba(238,242,238,0.18) 细线
明面（可选，--theme=light）:
  --board:#f4f6f3 --chalk:#1c2b26 --board-2:#e7ebe6 --accent:#e85d1f
对比度：粉笔白 on 板面 ≈ 12:1（远超 AA）。强调橙 on 板面 ≈ 4.6:1。
```

## 4. 字体系统（仅系统字体栈，禁外部字体）
```
--font-ui: "PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif
--font-num: "SF Mono",ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace  // 等宽数字
字号阶梯: --fs-xxl 28 / --fs-xl 22 / --fs-l 18 / --fs-m 15 / --fs-s 13 / --fs-xs 11
字重: 400 常规 / 600 半粗（仅标题与数字）/ 700 仅强调橙数字
数字一律 --font-num + font-variant-numeric: tabular-nums（对齐）
```

## 5. 图形语言与图标（粉笔质感，全 SVG 手绘）
- 线条：`stroke-linecap="round"`，`stroke-linejoin="round"`，主线条 `stroke-width:2`，辅助 `1`，虚线 `stroke-dasharray:"2 5"`。
- 粉笔抖动：用 `filter` 轻噪点（feTurbulence baseFrequency 0.9 + 位移 0.4）做边缘毛糙；性能敏感处可省略。
- 图标：一律内联 SVG path，单色 `--chalk` 描边，尺寸 16/20/24 三档。例：篮筐○、战术△、换人⇄、伤⚠（形状 + 文字双重编码，色盲友好）。
- 球员 token：圆点 `r=14`，填 `--chalk` 描边 `--board`，内写号码；主队填 `--accent`、客队填 `--chalk-dim`。

## 6. 材质与层次
- 板面：`radial-gradient(--board, --board-2)` + 极轻噪点（SVG feTurbulence 叠 4% 白）模拟哑光。
- 卡片：1px `--line` 描边 + 2px 投影，无圆角或 4px；不堆玻璃。
- 层级：板面(0) < 数据条(1) < 弹窗/模态(2，半透明遮罩 + 板面卡片)。

## 7. 动效原则
- 时长阶梯：--d-fast 120ms / --d 220ms / --d-slow 360ms。
- 缓动：`cubic-bezier(.22,.61,.36,1)`（出）；`cubic-bezier(.4,0,.2,1)`（入）。
- 入场：数据条从 0 宽展开（width transition）；模态淡入 + 上移 8px。
- 数字滚动：比分变化用 `transition: color 200ms` + 短暂放大，不做滚动数字（省性能）。
- **`prefers-reduced-motion`**：全部 transition/animation 置 none，模态直接显隐。

## 8. 可访问性分级
- Basic：对比度达标、键盘可达（tab 到战术点位/按钮）、焦点环 `--accent` 2px。
- Standard：语义 `button`/`table`/`aria-label`；战术点位可键盘拖动（方向键微调坐标）。
- Comprehensive：色盲双编码（形状+文字）、`prefers-reduced-motion` 降级、读屏播报比分变化。

## 9. 反模式清单（明确禁止）
- 渐变发光、霓虹外溢、毛玻璃滥用。
- 圆角大卡片网格 + 阴影堆叠（后台模板感）。
- 外部字体/图标库/CDN 资源。
- 装饰性插画/摄影素材（本作无素材，全 CSS/SVG）。
- 无意义动效（粒子、漂浮、自动轮播）。

## 10. 反模板感的三条具体做法
1. **半场即导航**：战术板不是装饰图，是主要操作区——拖点位直接改阵容，信息密度来自坐标而非卡片。
2. **粉笔线即品牌**：全局线条统一圆头虚线粉笔质感，连数据条都是"画上去的"，形成一致的手绘教练语境，而非标准 UI 控件。
3. **等宽数字即态度**：所有比分/能力值用等宽 tabular-nums，右对齐成列，像赛后技术统计表——克制、专业、不讨好。
