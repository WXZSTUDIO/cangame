# GDD · S4 训练与成长（`training.js`）

> 八节：概述 / 数据结构 / 规则 / 公式 / 交互 / 边界与异常 / 接口 / 验收用例
> 数值来源：`numbers.md` §4、§5　·　依赖：S1、S3

---

## 一、概述

S4 负责把「每轮一次的点击」变成**长期的成长曲线**，同时用「训练消耗体力」制造与比赛的短期取舍。这是支柱 **P1 一轮一决策** 与 **P4 单机也长线** 的核心交汇点。

### v1 最小可玩版本长什么样

- 每轮、每名球员可选其一：**12 项属性集中训练 / 球队合练 / 休息**。
- 训练面板：一张「球员 × 训练项」的网格，玩家逐行点选，支持「沿用上一轮」一键复制。
- 成长可视化：每个属性显示 `+X.XX/轮` 与「本季累计 +X.X」。
- 休赛期：年龄衰退一次性结算 + 训练营（额外 1 轮训练，无疲劳）。
- **不做**：训练设施升级、私人训练师、训练营事件、属性上限突破。

> 设计取舍：**训练是"慢变量"**。一个赛季核心球员 +5~10 点，玩家不会感到"练几轮就无敌"，但 3 个赛季后能看到明显王朝骨架。

---

## 二、数据结构

```js
// 挂在 gameState 上
training: {
  plan: { [playerId]: TrainingChoice },   // 每轮重置为「沿用上一轮」
  history: [ { round, gains: { [playerId]: { attrKey: delta } } } ],  // 最近 20 轮
}
TrainingChoice = {
  type: 'attr' | 'team' | 'rest',
  attrKey?: enum,     // type='attr' 时必填
  tacticKey?: enum,   // type='team' 时指定练哪个战术（涨 familiarity）
}

// 球员身上的持久字段（在 Player 上）
// attr.*        12 项属性
// pot           潜力
// staminaNow    体力存量（训练会扣）
```

---

## 三、规则

1. **每轮每名球员恰好一个训练选择**，互斥（不能既练三分又合练）。
2. **伤缺球员不可训练**（`injury.out > 0`），强制为 `'rest'`，但恢复 +30/轮。
3. **体力 < 20 禁止任何训练**（UI 灰化），强制 `'rest'`。
4. **体力 < 40 仍训练 → 该球员本场伤病概率 × 1.50**（见 §4.4）。
5. **未训练的属性不自然成长**（`focusMul = 0`），保证训练是唯一成长途径，避免"躺赢"。
6. **成长上限**：`attr[k] ≤ pot[k]`… 简化为 `attr[k] ≤ pot`（单一潜力值对全部属性）。
   - 实现：`gain = min(gain, pot - cur)`；`cur ≥ pot` 时 gain = 0。
7. **休赛期老化**：所有球员按 `numbers.md §4.3` 表一次性扣点；`speed` 与 `stamina` × 1.5。
8. **严重伤病会扣潜力**：`pot -= 3`（见 `numbers.md §5.2`）。
9. **训练营**：休赛期第 6 步提供一次额外训练，**不消耗体力**（休赛期体力已重置）。
10. **AI 球队用同一个 `applyTraining()` 函数**（不作弊，支柱 P2）。

---

## 四、公式

### 4.1 单轮成长

```js
function gainPerRound(p, attrKey, coachAbility) {
  const cur = p.attr[attrKey];
  if (cur >= p.pot) return 0;

  const workEthicMul = 0.60 + 0.008 * p.workEthic;                 // 0.60~1.40
  const ageMul       = AGE_GROWTH(p.age);                           // 见下表
  const potHeadroom  = clamp((p.pot - cur) / 25, 0, 1);
  const focusMul     = 1.60;                                        // 集中训练
  const coachMul     = 0.80 + 0.004 * coachAbility;                 // 0.80~1.20

  let g = 0.055 * workEthicMul * ageMul * potHeadroom * focusMul * coachMul;
  return Math.min(g, p.pot - cur);
}

AGE_GROWTH(age):
  age ≤ 21      → 1.35
  22..24        → 1.15
  25..27        → 1.00
  28..30        → 0.70
  31..33        → 0.35
  age ≥ 34      → 0.15
```

**验算**：
- 22 岁 / workEthic 80 / pot 88 / cur 62 / coach 50 → `0.055 × 1.24 × 1.15 × 1.0 × 1.60 × 1.00 = 0.126` → 58 轮 **+7.3 点**
- 26 岁 / workEthic 60 / pot 75 / cur 70 → `0.055 × 1.08 × 1.00 × 0.20 × 1.60 = 0.019` → 58 轮 **+1.1 点**

### 4.2 应用训练（每轮推进时执行一次）

```js
function applyTraining(state, teamId) {
  const coach = getTeam(teamId).coachAbility;
  for (const p of rosterOf(teamId)) {
    const c = state.training.plan[p.id] || { type:'rest' };

    if (p.injury && p.injury.out > 0) { p.staminaNow = min(100, p.staminaNow + 30); p.morale += 1.0; continue; }
    if (p.staminaNow < 20)            { p.staminaNow = min(100, p.staminaNow + 10); continue; }

    switch (c.type) {
      case 'attr': {
        const g = gainPerRound(p, c.attrKey, coach);
        p.attr[c.attrKey] += g;                       // 浮点累加，UI 显示 1 位小数
        p.staminaNow -= 6;                            // TRAINING_FATIGUE
        break;
      }
      case 'team': {
        team.tactic.familiarity[c.tacticKey] += 4.0;  // FAM_TRAIN
        team.tactic.chemistry += 1.5;                 // CHEM_TRAIN
        p.staminaNow -= 4;                            // TEAM_TRAINING_FATIGUE
        break;
      }
      case 'rest': {
        p.staminaNow += 10;
        break;
      }
    }
    p.staminaNow = clamp(p.staminaNow, 0, 100);
  }
}
```

> 注意：`attr` 用浮点存储，但**参与比赛计算时取整**（`Math.round(effAbil)`），避免累积误差影响确定性。

### 4.3 休赛期老化

```js
function applyAging(state) {
  for (const p of allPlayers) {
    const d = DECAY_AGE(p.age);                      // 0 / -0.6 / -1.5 / -2.6 / -4.0
    for (const k of ATTR_KEYS) {
      const mul = (k === 'speed' || k === 'stamina') ? 1.5 : 1.0;
      p.attr[k] = Math.max(20, p.attr[k] + d * mul);
    }
    if (p.pot > 30 && p.age >= 31) p.pot = Math.max(p.pot - 1, Math.min(p.attr...)); // pot 不低于任一项 attr
    p.age += 1;
    p.staminaNow = 100;
  }
}
```

### 4.4 伤病联动

```
训练时 staminaNow < 40  →  该球员本轮比赛的 p_injury × 1.50
（在 match.js 的伤病判定里读取 flag：p.trainedWhileFatigued = true）
```

### 4.5 士气联动（S3 字段，S4 更新）

```
morale += 0.6 * (minutes - 22) / 10
morale += (win ? +2.5 : -2.0)
morale += (连续 3 轮上场 < 12 分钟 ? -4.0 : 0)
morale = clamp(morale, 0, 100)
```

---

## 五、交互

| 界面 | 元素 | 行为 |
|---|---|---|
| 训练面板（右侧抽屉第 2 页） | 表格：球员 / 当前训练项 / 预计 +X.XX 每轮 / 体力条 | 每行一个下拉选择 12 项 + 合练 + 休息 |
| 面板顶部 | 「沿用上一轮」按钮 + 「全员合练」+ 「全员休息」 | 批量操作 |
| 属性行 hover | tooltip：显示 `potHeadroom` / `ageMul` / `workEthicMul` 分解 | **支柱 P2 的"为什么"** |
| 球员详情 | 「本季成长」曲线（OVR vs 轮次） | 折线图，SVG 手绘 |
| 休赛期结算页 | 老化报告：谁掉了几点 | 列表，红色负号 |

**可访问性**：训练项下拉用原生 `<select>`；预计增益有文字而非仅颜色。

---

## 六、边界与异常

| # | 情况 | 处理 |
|---|---|---|
| E1 | `pot - cur ≤ 0` | gain = 0，UI 显示「已达潜力上限」 |
| E2 | 训练后 `attr > pot` | `Math.min(g, pot - cur)` 保证不越界 |
| E3 | 体力 < 20 但玩家选了训练 | 强制降级为 `rest`，UI 提示「过度疲劳，自动休息」 |
| E4 | 伤缺球员被分配训练 | 强制降级为休养（+30 体力/轮），UI 灰化并标注伤缺轮数 |
| E5 | 休赛期老化后 `attr < 20` | clamp 到 20 |
| E6 | 严重伤病扣 `pot` 后 `pot < cur` | `pot = max(pot, cur)` |
| E7 | 训练计划里出现已离队球员 id | 应用时跳过（`continue`） |
| E8 | `coachAbility` 越界 | clamp 到 [0, 100] |
| E9 | 浮点累积误差导致 attr 出现 61.999999 | 参与计算时 `Math.round`；显示时 `toFixed(1)` |
| E10 | 同一轮对同一球员调用两次 `applyTraining` | 幂等保护：记录 `p.lastTrainedRound`，相同则跳过 |

---

## 七、与其他系统的接口

```
依赖：S1（rng 不直接用，成长是纯确定性）、S3（Player / roster）

对外暴露：
  CG.Training.gainPerRound(p, attrKey, coachAbility) -> float
  CG.Training.applyTraining(state, teamId)
  CG.Training.applyAging(state)                 // 休赛期
  CG.Training.applyTrainingCamp(state, teamId)  // 休赛期第 6 步，无疲劳
  CG.Training.setPlan(state, playerId, choice)
  CG.Training.copyLastPlan(state)

被依赖：
  S6 match  —— 读 attr（经 effAbil）与 trainedWhileFatigued 标记
  S7 season —— 每轮调用 applyTraining；休赛期调用 applyAging
  S12 ai    —— 自动分配训练（同一函数）
  S13 ui    —— 训练面板
```

---

## 八、验收用例

```js
// T1 成长量级（concept.md 成功标准 7）
const p = mkPlayer({age:22, workEthic:80, pot:88, attr:{three:62}});
let total = 0;
for (let r=0;r<58;r++){ total += CG.Training.gainPerRound(p,'three',50); p.attr.three += CG.Training.gainPerRound(p,'three',50); }
assert(total >= 5 && total <= 10);          // 一个赛季 +5~10 点

// T2 老将成长极低
const old = mkPlayer({age:34, workEthic:60, pot:70, attr:{three:65}});
assert(CG.Training.gainPerRound(old,'three',50) < 0.05);

// T3 潜力天花板
const capped = mkPlayer({age:20, workEthic:100, pot:60, attr:{three:60}});
assert(CG.Training.gainPerRound(capped,'three',100) === 0);

// T4 不越界
const q = mkPlayer({pot:62, attr:{three:61.5}});
const g = CG.Training.gainPerRound(q,'three',100);
q.attr.three += g; assert(q.attr.three <= 62 + 1e-9);

// T5 体力代价
const r = mkPlayer({staminaNow:80, attr:{three:50}});
CG.Training.setPlan(state, r.id, {type:'attr', attrKey:'three'});
CG.Training.applyTraining(state, r.teamId);
assert(r.staminaNow === 74);                // -6

// T6 疲劳保护
const tired = mkPlayer({staminaNow:15});
CG.Training.setPlan(state, tired.id, {type:'attr', attrKey:'mid'});
CG.Training.applyTraining(state, tired.teamId);
assert(tired.staminaNow === 25);            // 降级为 rest，+10
assert(tired.attr.mid === before);

// T7 伤缺不可训练
const inj = mkPlayer({injury:{out:5}, attr:{mid:50}});
CG.Training.applyTraining(state, inj.teamId);
assert(inj.attr.mid === before && inj.staminaNow <= 100);

// T8 老化曲线
const a34 = mkPlayer({age:34, attr:{mid:60, speed:60}});
CG.Training.applyAging(state);              // 仅对该球员
assert(Math.abs(a34.attr.mid - 56.0) < 1e-6);     // -4.0
assert(Math.abs(a34.attr.speed - 54.0) < 1e-6);   // -4.0 × 1.5 = -6.0

// T9 3 赛季成长（B14）
let core = mkPlayer({age:22, workEthic:80, pot:88, attr:{three:62}});
for (let y=0;y<3;y++) for (let r=0;r<58;r++) core.attr.three += CG.Training.gainPerRound(core,'three',50);
assert(core.attr.three - 62 >= 12 && core.attr.three - 62 <= 20);

// T10 幂等
CG.Training.applyTraining(state, 'T01');
const snap = JSON.stringify(playersOf('T01'));
CG.Training.applyTraining(state, 'T01');
assert(JSON.stringify(playersOf('T01')) === snap);

// T11 AI 与玩家同公式
assert(CG.Training.gainPerRound(p,'three',50) === CG.Training.gainPerRound(p,'three',50));
```

---

## 附 · v1 不做

- 训练设施升级 / 训练师招聘
- 属性上限突破（吃"潜力药"）
- 训练营随机事件（受伤 / 突破）
- 位置改造（把 SG 练成 PG）—— v1 位置固定，只能改 `altPos`（不做改造训练）
