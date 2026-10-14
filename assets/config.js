// cangame v3.4 · 配置（唯一可调数值源）
// XBA 逆向：金字塔联赛 / 街球杯赛 / 冠军杯(512淘汰) / 联盟系统 / 经营细化 / 竞猜 / 球星 / 6v6 战术
var CONFIG = {
  VERSION: '3.5.0',
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
    TRAIT_VOLATILE: { 稳重: 0.03, 好胜: 0.04, 独狼: 0.05, 领袖: 0.04, 玻璃人: 0.05, 神经刀: 0.09 },
    // 篮板位置基础权重（C/PF 最高，PG 最低）—— 修复 PG 篮板异常的核心
    POS_REB_WEIGHT: { PG: 0.5, SG: 0.85, SF: 1.1, PF: 2.4, C: 3.2 },
    // 身高区间（cm，按位置）—— 参与篮板/内线对抗
    HEIGHT: { PG: [178, 193], SG: [188, 200], SF: [195, 208], PF: [201, 214], C: [207, 221] },
    STR_RANGE: [45, 90]   // 力量属性区间（a.STR，单独存，不参与综合）
  },

  MATCH: {
    POSSESSIONS: 68,
    BASE_2P: 0.50, BASE_3P: 0.36,
    SHO_COEF: 0.0042, TRE_COEF: 0.0045, DEF_COEF: 0.0035, IQ_COEF: 0.0020,
    FATIGUE_SHOOT_PENALTY: 0.004, FATIGUE_MIN_THRESHOLD: 24,
    TO_BASE: 0.12, IQ_TO_COEF: 0.0018, PRESS_TO_BONUS: 0.05,
    REB_COEF: 0.006, REB_BASE: 0.30,   // 进攻篮板率压到真实区间（~25-35%）
    OREB_FACTOR: 0.82,                  // 进攻篮板相对防守更难
    NOISE: 0.05,
    CLUTCH_DIFF: 3, CLUTCH_BONUS: 0.02,
    STARTER_MIN: 34, BENCH_MIN: 14, FREQ_STARTER_DELTA: -4, FREQ_BENCH_DELTA: 4,
    FATIGUE_PER_POSSESS: 0.70,          // 每回合在场所耗体力（赛中轮换用）
    REST_RECOVER_POSSESS: 1.20,         // 板凳每回合恢复体力（短休息→首发快速回归，占比~85%）
    SUB_STAMINA: 60,                    // 体力≤此值换下
    FOUL_SUB: 4, FOUL_OUT: 5,           // 4 犯换下 / 5 犯离场
    FOUL_RATE: 0.10,                    // 每回合出现犯规的概率
    MIN_ROTATION: 8,                    // 每场至少登场人数
    ROT_MIN: { 保守: { starter: 42, bench: 14 }, 均衡: { starter: 34, bench: 20 }, 频繁: { starter: 28, bench: 24 } }
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
    STADIUM_CAP: 8000,        // 主场容量（经营细化：票价×上座率）
    AD_PER_SLOT: 240,         // 每个广告位单轮价值（随球迷/威望放大）
    JERSEY_BASE: 150,         // 球衣销售基础（随战绩/球星/极限球员放大）
    SPONSOR_BASE: 800, BANKRUPT: -50000, SAL_K: 1.6, CLUTCH_SAL_BONUS: 30
  },

  // —— 经营细化：票价档位 + 上座率（XBA：上座率 80%–90% 净收入最高）——
  PRICE: {
    default: 'mid',
    options: [
      { key: 'low',  label: '低价 ¥30', price: 30, att: 0.95 },
      { key: 'mid',  label: '中价 ¥55', price: 55, att: 0.88 },
      { key: 'high', label: '高价 ¥90', price: 90, att: 0.70 }
    ]
  },
  // 球衣销售放大系数（单场战绩 + 球星 + 极限球员）
  JERSEY: { perWin: 1.4, starBonus: 0.10, extremeBonus: 0.20 },

  // —— 球场（广告位数量 = 球场等级 + 球迷/4000）——
  STADIUM: { DEFAULT_LEVEL: 1, LEVEL_CAP: 3, UPGRADE_COST: [0, 120000, 400000] },

  // —— 赞助商合同制广告（替换原“胜负赔钱”简单模型）——
  SPONSOR: {
    COUNT: 14,                          // 生成的赞助商数量
    industries: ['运动品牌', '饮料', '汽车', '金融', '电子', '餐饮', '地产', '航空', '互联网', '护肤'],
    namePrefix: ['锐', '腾', '恒', '昇', '星', '云', '海', '极', '光', '川', '宇', '晟'],
    nameSuffix: ['动', '驰', '达', '耀', '联', '峰', '润', '锐', '源', '创', '盛', '通'],
    basePrice: [2000, 7000],            // 单轮基础单价区间
    roundsOpts: [5, 10, 20],            // 合同轮次选项
    FAN_COEF_CAP: 1.5,                  // 球迷系数上限 = min(1.5, 球迷/4000)
    RECORD_WIN_BONUS: 0.5,              // 战绩系数 = 1 + 胜率×0.5 + 连胜加成
    STREAK_BONUS: 0.15,
    IMPORTANCE: { REGULAR: 1.0, CUP: 1.2, PLAYOFF: 1.5 },  // 比赛重要性系数
    FIT_RANGE: [0.8, 1.2],              // 品牌契合度
    DYNAMIC_DOWN: 0.92,                 // 签得多 → 单价下降
    DYNAMIC_UP: 1.04,                   // 没人签 → 单价回升
    BREACH_PENALTY: 0.5,                // 提前解约扣已得收入比例
    bonuses: { champion: 50000, playoff: 20000, streak3: 5000, rankTop4: 15000 }  // 奖金条款
  },

  // —— CBA 真实队名导入（阶段3）——
  USE_CBA: true,                        // 新游戏用真实 CBA 队名 + 占位球员(TODO)

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

  // —— 街球杯赛（XBA 逆向：新人杯/小杯赛/大杯赛/大师杯，淘汰赛制）——
  CUP: {
    // 每个杯赛：开赛轮 = rounds 数组（依次 1/16→1/8→1/4→1/2→决赛 视 size 而定）
    TYPES: [
      { id: 'rookie', name: '新人杯', size: 16, startRound: 4, gap: 2, only: 'first-season',
        prize: [50000, 20000, 10000, 5000], kings: 6, desc: '新赛季首次参赛保护杯（仅第一赛季，16 队淘汰赛）' },
      { id: 'small', name: '小杯赛', size: 8, startRound: 10, gap: 3, only: 'all',
        prize: [30000, 12000, 6000, 3000], kings: 4, desc: '赛季中热身（8 队淘汰赛，全等级可报）' },
      { id: 'big', name: '大杯赛', size: 16, startRound: 16, gap: 3, only: 'all',
        prize: [80000, 30000, 15000, 8000], kings: 8, desc: '全等级开放 · 每赛季一次（16 队淘汰赛）' },
      { id: 'master', name: '大师杯', size: 16, startRound: 22, gap: 3, only: 'all', reqCupWin: true,
        prize: [150000, 60000, 30000, 12000], kings: 12, desc: '最高等级街球杯（需先夺得任意杯赛冠军方可报名）' }
    ],
    MIN_ENTRY: 0.5   // 报名人数≥上限 50% 才发全额奖金（XBA 规则，展示用）
  },

  // —— 冠军杯赛（XBA 逆向：512 人制单淘汰 + 报名分阶段）——
  // 规模 512（AI 俱乐部填充 + 人类资格队）；报名三阶段：优先邀请函→盟邀请函→全员
  CHAMPIONSHIP: {
    size: 512,            // 单淘汰规模（2 的幂）
    openRound: 6,         // 第 6 轮开放报名（优先邀请函：各级联赛前 2）
    phase2Round: 9,       // 第 9 轮开放盟邀请函（联盟排名资格）
    phase3Round: 12,      // 第 12 轮开放全员报名
    bracketStart: 14,     // 第 14 轮抽签/首轮开打
    gap: 1,               // 每联赛轮推进一 bracket 轮
    championPrize: { cash: 1000000, prestige: 500, kings: 30 }, // 总冠军
    runPrize: 8000        // 每赢一轮奖金
  },

  // —— 联盟系统（XBA 逆向：联盟首页/盟战/联盟威望/联盟杯赛/至尊杯邀请函）——
  ALLIANCE: {
    poolSize: 8,          // AI 联盟数量（单机版模拟工会）
    warGap: 4,            // 每 4 轮一场盟战
    warPrestige: 8,       // 盟战胜场为联盟加威望
    warKings: 3,          // 盟战胜场给经理王者积分
    cupRound: 13,         // 联盟杯赛抽签轮（每赛季一次）
    cupGap: 2,
    cupPrize: [60000, 20000, 8000],
    cupPrestige: [30, 15, 5],
    supremeTopN: 6,       // 联盟排名前 6 获至尊杯邀请函
    supremeCheckRound: 16,
    supremeRound: 18,
    supremeGap: 2,
    supremePrize: { cash: 1500000, prestige: 800, kings: 50 }
  },

  // —— 有奖竞猜（XBA 逆向：押注比赛结果赢资金）——
  BET: {
    maxStakePct: 0.4,     // 单注最多押资金 40%
    baseOdd: 1.9,         // 基础赔率（按实力差微调）
    featured: 3           // 每轮展示可押注场次
  },

  // —— 转会市场（XBA 逆向：系统球员池，按综合定价买卖）——
  TRANSFER: {
    poolSize: 14,
    priceK: 2.2,        // 身价 ≈ overall² × priceK
    extremeRate: 0.2,   // 极限球员占比
    resellRate: 0.5     // 转出回收比例
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
