# cangame v3 · 数值基线（死数值，工程可直接抄进 config.js）

> 所有公式必须能被 `tools/sim-balance.js` 批量验证。改动先扫参再落盘。

## 1. 联赛结构
- 球队数 `TEAMS = 30`；2 联盟（东/西），每联盟 3 分区，每分区 5 队。
- 常规赛 `REGULAR_ROUNDS = 82`（圆桌法排，每轮每队一场；82 轮 ≈ 每队 82 场）。
- 季后赛：各联盟前 `8` 队，4 轮（首轮/半决赛/决赛/总决），每轮 `best-of-7`（先 4 胜晋级）。
- 主场优势：常规赛主客各半；季后赛高排名多一个主场。

## 2. 球员属性（10 维，取值 35–99）
`SHO` 投篮 · `TRE` 三分 · `DRV` 突破 · `PAS` 传球 · `REB` 篮板 · `DEF` 防守 · `SPD` 速度 · `STA` 体力 · `IQ` 球商 · `CLU` 关键球。
- 位置 `POS ∈ {PG,SG,SF,PF,C}`。
- 生成：基础均值 65，按位置偏移 ±10；潜力决定成长空间。年龄正态分布 19–38（新秀 19–22）。
- 性格 `TRAIT ∈ {稳重,好胜,独狼,领袖,玻璃人,神经刀}`：影响使用率与波动。

## 3. 综合评分（位置加权，0–99）
`overall = Σ(attr × POS_WEIGHT[pos][attr]) / Σweight`，四舍五入到整数。权重见 config.PLAYER.POS_WEIGHT。

## 4. 比赛引擎（核心，逐回合）
- 每队预估回合 `POSSESSIONS = 68`。
- 每回合流程：
  1. 进攻方选射手：5 名在场球员按 `usage = offenseRating × traitBias` 加权随机。
  2. 出手类型：若 `TRE > SHO + 6` 且战术=外线 → 三分，否则二分。
  3. 命中概率：
     ```
     p = BASE_2P (或 BASE_3P)
       + SHO_COEF × (shooter.SHO − 65)        // 二分用 SHO，三分用 TRE
       + (三分? TRE_COEF × (shooter.TRE − 65) : 0)
       − DEF_COEF × (defender.DEF − 65)
       + IQ_COEF × (shooter.IQ − defender.IQ)
       + counterBonus(atkTactic, defTactic)    // 战术克制（§6）
       − fatiguePenalty                          // 按累计上场分钟
       + noise(rng, ±0.05)
     p = clamp(p, 0.05, 0.95)
     ```
  4. `rng() < p` → 得分（2 或 3），记 pts；若有助攻手（PAS≥70 且在场）→ 记 ast。
  5. 未中 → 篮板竞争：`rebProb = REB_COEF × (teamREB − oppREB)`，赢家得篮板（记 reb），二次进攻或攻防转换。
  6. 失误：`toProb = TO_BASE − IQ_COEF2 × (offIQ − defIQ) + pressBonus`，发生则攻防转换（记 to/stl）。
- 单节/全场比分由累计回合得出；末节分差 ≤3 且落后方 IQ 高 → 关键球加成（CLU）。

### 关键常数（config.MATCH）
```
POSSESSIONS = 68
BASE_2P = 0.50, BASE_3P = 0.36
SHO_COEF = 0.0042, TRE_COEF = 0.0045, DEF_COEF = 0.0035, IQ_COEF = 0.0020
FATIGUE_PER_MIN = 0.012, FATIGUE_SHOOT_PENALTY = 0.004   // 每名球员累计分钟→命中惩罚
TO_BASE = 0.12, IQ_TO_COEF = 0.0018
REB_COEF = 0.005
```

## 5. 体力与伤病
- 每场消耗：上场分钟 × `FATIGUE_PER_MIN`；首发 ~34min，替补 ~14min。
- 恢复：每轮 +`REST_RECOVER = 18`（封顶 100）。
- 伤病：`injuryChance = INJURY_BASE + ageFactor`；缺阵 `DNP = round(rng × 8) + 1` 轮（玻璃人 ×1.6）。v1 简化为"轮休"。

## 6. 战术系统 + 克制矩阵
四维：`PACE{慢,稳,快}` · `OFFENSE{内线,均衡,外线}` · `DEFENSE{盯人,联防,夹击}` · `ROTATION{保守,均衡,频繁}`。
克制矩阵（攻方战术对守方，命中加成，封顶 ±0.10）：
```
外线 vs 联防   +0.06    内线 vs 夹击   −0.04
外线 vs 夹击   +0.03    内线 vs 盯人   +0.02
快   vs 慢     +0.04    慢   vs 快     −0.02
快   vs 夹击   −0.05    慢   vs 联防   +0.03
均衡 vs 任何   0.00（不亏不赚，稳健选择）
```
节奏影响回合数：`快`→POSSESSIONS×1.08，`慢`→×0.93。
轮换影响体力分布：`频繁`→首发分钟 −4、替补 +4（更稳但深度要求高）。

## 7. 薪资与工资帽
- 球员年薪 `salary = round( overall^2 × SAL_K + clutchBonus )`，`SAL_K = 1.6`（overall 70→7840，80→10240，90→12960，单位：万）。
- 合同年限 1–4 年，新秀 2–3 年。
- 工资帽 `CAP = 110000`（万）；超限 `OVER_CAP_WARN` 仅警告，v1 不罚。
- 奢侈税（v1 不做）。

## 8. 财务（v1 轻量）
- 每轮收入：`gate = HOME_GATE × min(attendance,1)`（主场比赛）+ `sponsor = SPONSOR_BASE`（稳定）。
- 每轮支出：工资摊销 `Σsalary / REGULAR_ROUNDS`。
- 破产线：`cash < BANKRUPT = −50000` → 信任危机（胜率/续约惩罚），不强制结束。
```
HOME_GATE = 1200, SPONSOR_BASE = 800, BANKRUPT = −50000
```

## 9. 验收用例（脚本可断言）
- 同 seed 两次 `simulateGame` 结果完全一致（确定性）。
- overall 必在 35–99。
- 强队（overall 差 +12）对弱队常规赛胜率 ≈ 70–80%（sim-balance 统计）。
- 克制生效：外线队 vs 联防队命中率高于 vs 盯人队（同阵容对比）。
- 常规赛 82 轮后积分榜无并列违规；季后赛 4 轮后恰 1 冠军。
- 工资帽计算正确：Σsalary 不超过名册 12 人。
