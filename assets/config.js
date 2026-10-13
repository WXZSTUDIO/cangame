// cangame v3.2 · 配置（唯一可调数值源）
// XBA 逆向：14 队金字塔联赛 / 杯赛 / 胜者为王 / 球星系统 / 6v6 战术相克
var CONFIG = {
  VERSION: '3.2.0',
  SEED_DEFAULT: 20261014,

  // —— 职业联赛（XBA 金字塔）：1级联赛×1 + 2级联赛×2，每个联赛 14 队 ——
  LEAGUE: {
    TEAMS_PER_LEAGUE: 14,     // 每个联赛 14 队（XBA 规则）
    LEVEL1_LEAGUES: 1,        // 1级联赛数量
    LEVEL2_LEAGUES: 2,        // 2级联赛数量（= 2倍 1级，保证 2升4降 闭环）
    REGULAR_ROUNDS: 26,       // 主客场双循环 26 轮（XBA 规则）
    PROMOTE_PER_LEAGUE: 2,    // 每个 2级联赛前 2 名升级（XBA 规则）
    RELEGATE_PER_LEAGUE: 4    // 1级联赛后 4 名降级（XBA 规则）
  },

  PLAYER: {
    POSITIONS: ['PG', 'SG', 'SF', 'PF', 'C'],
    ATTRS: ['SHO', 'TRE', 'DRV', 'PAS', 'REB', 'DEF', 'SPD', 'STA', 'IQ', 'CLU'],
    ATTR_MIN: 35, ATTR_MAX: 99,
    BASE_MEAN: 65, POS_SPREAD: 10,
    ROSTER_SIZE: 12, STARTING: 5,
    AGE_MIN: 19, AGE_MAX: 38, ROOKIE_AGE: [19, 22],
    TRAITS: ['稳重', '好胜', '独狼', '领袖', '玻璃人', '神经刀'],
    POS_WEIGHT: {
      PG: { PAS: 1.4, SPD: 1.3, IQ: 1.3, TRE: 1.2, DRV: 1.1, SHO: 1.0, DEF: 0.9, REB: 0.5, STA: 0.9, CLU: 0.9 },
      SG: { SHO: 1.4, TRE: 1.3, SPD: 1.1, DRV: 1.1, CLU: 1.1, DEF: 0.9, IQ: 0.9, PAS: 0.9, REB: 0.5, STA: 0.9 },
      SF: { DEF: 1.2, SHO: 1.2, DRV: 1.1, SPD: 1.1, REB: 1.0, IQ: 1.0, TRE: 1.0, PAS: 0.9, STA: 1.0, CLU: 1.0 },
      PF: { REB: 1.4, DEF: 1.2, DRV: 1.1, SHO: 1.0, IQ: 0.9, SPD: 0.8, TRE: 0.7, PAS: 0.8, STA: 1.0, CLU: 0.9 },
      C:  { REB: 1.6, DEF: 1.3, SHO: 0.9, DRV: 0.8, IQ: 0.9, SPD: 0.6, TRE: 0.4, PAS: 0.7, STA: 1.1, CLU: 0.8 }
    },
    TRAIT_USAGE: { 稳重: 0.95, 好胜: 1.10, 独狼: 1.25, 领袖: 1.05, 玻璃人: 0.90, 神经刀: 1.00 },
    TRAIT_VOLATILE: { 稳重: 0.03, 好胜: 0.04, 独狼: 0.05, 领袖: 0.04, 玻璃人: 0.05, 神经刀: 0.09 }
  },

  MATCH: {
    POSSESSIONS: 68,
    BASE_2P: 0.50, BASE_3P: 0.36,
    SHO_COEF: 0.0042, TRE_COEF: 0.0045, DEF_COEF: 0.0035, IQ_COEF: 0.0020,
    FATIGUE_SHOOT_PENALTY: 0.004, FATIGUE_MIN_THRESHOLD: 24,
    TO_BASE: 0.12, IQ_TO_COEF: 0.0018, PRESS_TO_BONUS: 0.05,
    REB_COEF: 0.005, REB_BASE: 0.5,
    NOISE: 0.05,
    CLUTCH_DIFF: 3, CLUTCH_BONUS: 0.02,
    STARTER_MIN: 34, BENCH_MIN: 14, FREQ_STARTER_DELTA: -4, FREQ_BENCH_DELTA: 4,
    FATIGUE_PER_MIN: 0.045
  },

  // —— 战术系统（XBA 逆向：6 进攻 × 6 防守 + 相克矩阵）——
  TACTICS: {
    OFFENSE: ['内线强攻', '中锋策应', '外线', '快攻', '整体', '挡拆'],
    DEFENSE: ['2-3联防', '3-2联防', '2-1-2联防', '盯人', '盯内', '盯外'],
    ROTATION: ['保守', '均衡', '频繁'],
    // 节奏：进攻战术自带 tempo（ possessions 乘数）
    OFF_TEMPO: { '内线强攻': 0.95, '中锋策应': 0.97, '外线': 1.0, '快攻': 1.08, '整体': 1.0, '挡拆': 1.0 },
    // 攻克防命中加成（攻_防 → ±）。依据 XBA 老玩家攻略：联防克整体/内线，挡拆克 2-3，外线怕 2-3/盯外…
    COUNTER: {
      '内线强攻_盯人': 0.04, '内线强攻_2-3联防': -0.05, '内线强攻_盯内': -0.06, '内线强攻_3-2联防': 0.03,
      '中锋策应_盯人': 0.03, '中锋策应_盯外': 0.05, '中锋策应_2-3联防': -0.04, '中锋策应_2-1-2联防': -0.04,
      '外线_3-2联防': 0.05, '外线_2-3联防': -0.04, '外线_盯外': -0.03, '外线_盯人': 0.02,
      '快攻_盯人': 0.03, '快攻_2-1-2联防': 0.02, '快攻_2-3联防': -0.03, '快攻_3-2联防': -0.03,
      '整体_盯人': 0.02, '整体_2-3联防': -0.05, '整体_3-2联防': -0.04, '整体_2-1-2联防': -0.04,
      '挡拆_2-3联防': 0.04, '挡拆_2-1-2联防': -0.04, '挡拆_盯外': -0.03, '挡拆_盯人': 0.02
    },
    COUNTER_CAP: 0.08
  },

  INJURY: {
    BASE: 0.04, AGE_FACTOR: 0.004, GLASS_MULT: 1.6, MAX_DNP: 8, REST_RECOVER: 18
  },

  FINANCE: {
    HOME_GATE: 1200, SPONSOR_BASE: 800, BANKRUPT: -50000, SAL_K: 1.6, CLUTCH_SAL_BONUS: 30,
    AD_BASE: 300, JERSEY_BASE: 150
  },

  // —— 训练（普通训练：训练点制）——
  TRAINING: {
    POINTS_PER_WIN: 3, POINTS_PER_LOSS: 1,
    START_POINTS: 10,
    COST_POINTS: 5, COST_STAMINA: 8, COST_MOOD: 4,
    GAIN_MIN: 1, GAIN_MAX: 3,
    ATTRS: ['SHO', 'TRE', 'DRV', 'PAS', 'REB', 'DEF', 'SPD', 'STA', 'IQ', 'CLU'],
    PHYSIO_CASH: 100, PHYSIO_STAMINA: 15, PHYSIO_MOOD: 10
  },

  // —— 球星系统（XBA 逆向：王者积分 + 资金训练，每级最高 +7% 综合，可降级重训）——
  STAR: {
    MAX_LEVEL: 5,
    GAIN_PCT_MAX: 0.07,          // 每升一级最高 +当前值 7%
    GAIN_PCT_MIN: 0.02,
    KINGS_PTS_BASE: 8,           // 升到第 n 级消耗 王者积分 = BASE + (n-1)*STEP
    KINGS_PTS_STEP: 4,
    CASH_BASE: 5000, CASH_STEP: 5000,   // 资金消耗同理
    DOWNGRADE_CASH: 3000,        // 降级费用（积分不返还）
    COLOR: '#c084fc'             // 球星紫色
  },

  // —— 胜者为王（连续淘汰赛，连胜 3/6/9 领取）——
  KINGS: {
    MAX_STREAK: 9,
    POINTS_PER_WIN: [1, 1, 1, 2, 2, 2, 4, 4, 4], // 第 n 场胜利的积分
    CASH_PER_WIN: 800,
    STAMINA_COST: 6,
    CLAIM_AT: [3, 6, 9],
    EXIT_KEEP_PCT: 0.6           // 非里程碑退出只得 60% 积分
  },

  // —— 街球杯赛（XBA 逆向：新人杯/小杯赛/大杯赛，淘汰赛制）——
  CUP: {
    // 每个杯赛：开赛轮 = rounds 数组（依次 1/16→1/8→1/4→1/2→决赛 视 size 而定）
    TYPES: [
      { id: 'rookie', name: '新人杯', size: 16, startRound: 4, gap: 2, only: 'first-season',
        prize: [50000, 20000, 10000, 5000], kings: 6, desc: '新赛季首次参赛保护杯（16 队淘汰赛）' },
      { id: 'major', name: '大杯赛', size: 16, startRound: 14, gap: 2, only: 'all',
        prize: [80000, 30000, 15000, 8000], kings: 8, desc: '全等级开放 · 每赛季一次（16 队淘汰赛）' },
      { id: 'minor', name: '小杯赛', size: 8, startRound: 22, gap: 2, only: 'all',
        prize: [30000, 12000, 6000, 3000], kings: 4, desc: '赛季末热身（8 队淘汰赛）' }
    ],
    MIN_ENTRY: 0.5   // 报名人数≥上限 50% 才发全额奖金（XBA 规则，展示用）
  },

  // 心情：影响比赛命中，每轮向基线回归
  MOOD: { BASE: 70, LOW: 40, HIGH: 75, LOW_PENALTY: 0.015, HIGH_BONUS: 0.010, RECOVER: 2 },

  TEAM_LEVEL: [
    { min: 0, name: '业余球队' },
    { min: 20000, name: '职业球队' },
    { min: 60000, name: '豪门球队' }
  ]
};

if (typeof module !== 'undefined') { module.exports = CONFIG; }
