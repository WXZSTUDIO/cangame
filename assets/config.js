// cangame v3 · 配置（唯一可调数值源）
// 改数值不动逻辑；所有公式常数来自 docs/design/numbers.md
var CONFIG = {
  VERSION: '3.0.0',
  SEED_DEFAULT: 20261012,

  LEAGUE: {
    TEAMS: 30,
    CONFS: ['东', '西'],
    DIVS_PER_CONF: 3,
    TEAMS_PER_DIV: 5,
    REGULAR_ROUNDS: 82,        // 每轮每队一场；82 轮 ≈ 每队 82 场
    PLAYOFF_PER_CONF: 8,
    PLAYOFF_WINS_NEEDED: 4,    // best-of-7
    HOME_GAMES_H2H: [1, 2, 4, 5, 7] // 系列赛这些场次高排位主场
  },

  PLAYER: {
    POSITIONS: ['PG', 'SG', 'SF', 'PF', 'C'],
    ATTRS: ['SHO', 'TRE', 'DRV', 'PAS', 'REB', 'DEF', 'SPD', 'STA', 'IQ', 'CLU'],
    ATTR_MIN: 35, ATTR_MAX: 99,
    BASE_MEAN: 65, POS_SPREAD: 10,
    ROSTER_SIZE: 12, STARTING: 5,
    AGE_MIN: 19, AGE_MAX: 38, ROOKIE_AGE: [19, 22],
    TRAITS: ['稳重', '好胜', '独狼', '领袖', '玻璃人', '神经刀'],
    // 位置权重（综合评分 / 战术适配）
    POS_WEIGHT: {
      PG: { PAS: 1.4, SPD: 1.3, IQ: 1.3, TRE: 1.2, DRV: 1.1, SHO: 1.0, DEF: 0.9, REB: 0.5, STA: 0.9, CLU: 0.9 },
      SG: { SHO: 1.4, TRE: 1.3, SPD: 1.1, DRV: 1.1, CLU: 1.1, DEF: 0.9, IQ: 0.9, PAS: 0.9, REB: 0.5, STA: 0.9 },
      SF: { DEF: 1.2, SHO: 1.2, DRV: 1.1, SPD: 1.1, REB: 1.0, IQ: 1.0, TRE: 1.0, PAS: 0.9, STA: 1.0, CLU: 1.0 },
      PF: { REB: 1.4, DEF: 1.2, DRV: 1.1, SHO: 1.0, IQ: 0.9, SPD: 0.8, TRE: 0.7, PAS: 0.8, STA: 1.0, CLU: 0.9 },
      C:  { REB: 1.6, DEF: 1.3, SHO: 0.9, DRV: 0.8, IQ: 0.9, SPD: 0.6, TRE: 0.4, PAS: 0.7, STA: 1.1, CLU: 0.8 }
    },
    // 性格使用率乘数（出手权重）
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
    STARTER_MIN: 34, BENCH_MIN: 14, FREQ_STARTER_DELTA: -4, FREQ_BENCH_DELTA: 4
  },

  TACTICS: {
    PACE: ['慢', '稳', '快'],
    OFFENSE: ['内线', '均衡', '外线'],
    DEFENSE: ['盯人', '联防', '夹击'],
    ROTATION: ['保守', '均衡', '频繁'],
    PACE_POS_FACTOR: { 慢: 0.93, 稳: 1.0, 快: 1.08 }
  },

  // 克制矩阵：攻方战术 → 守方战术 的命中加成（封顶 ±0.10）
  COUNTER: {
    '外线_联防': 0.06, '内线_夹击': -0.04, '外线_夹击': 0.03, '内线_盯人': 0.02,
    '快_慢': 0.04, '慢_快': -0.02, '快_夹击': -0.05, '慢_联防': 0.03
  },

  INJURY: {
    BASE: 0.04, AGE_FACTOR: 0.004, GLASS_MULT: 1.6, MAX_DNP: 8, REST_RECOVER: 18
  },

  FINANCE: {
    HOME_GATE: 1200, SPONSOR_BASE: 800, BANKRUPT: -50000, SAL_K: 1.6, CLUTCH_SAL_BONUS: 30,
    AD_BASE: 300,        // 广告收入：每轮固定（XBA 三大收入之一）
    JERSEY_BASE: 150     // 球衣销售：每轮固定
  },

  // —— XBA 逆向 · 训练系统（xinren4 教程：训练点/体力/心情/次日生效）——
  TRAINING: {
    POINTS_PER_WIN: 3, POINTS_PER_LOSS: 1,  // 训练点：打比赛获得
    START_POINTS: 10,
    COST_POINTS: 5, COST_STAMINA: 8, COST_MOOD: 4, // 一次训练的代价
    GAIN_MIN: 1, GAIN_MAX: 3,               // 属性提升区间
    ATTRS: ['SHO', 'TRE', 'DRV', 'PAS', 'REB', 'DEF', 'SPD', 'STA', 'IQ', 'CLU'],
    PHYSIO_CASH: 100, PHYSIO_STAMINA: 15, PHYSIO_MOOD: 10  // 理疗中心
  },

  // 心情：影响比赛命中（低落惩罚 / 高涨加成），每轮向基线回归
  MOOD: { BASE: 70, LOW: 40, HIGH: 75, LOW_PENALTY: 0.015, HIGH_BONUS: 0.010, RECOVER: 2 },

  // 球队等级（XBA：业余球队 → 职业）
  TEAM_LEVEL: [
    { min: 0, name: '业余球队' },
    { min: 20000, name: '职业球队' },
    { min: 60000, name: '豪门球队' }
  ]
};

if (typeof module !== 'undefined') { module.exports = CONFIG; }
