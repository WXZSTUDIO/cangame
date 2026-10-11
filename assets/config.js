/* =========================================================
 * cangame v2 · config.js
 * 单一真源：所有可调数值集中此处（§3 数值基线）。
 * 改数不动逻辑；所有系统只读 CONFIG。
 * 加载顺序：第一个 defer（无依赖）。
 * ========================================================= */

var CONFIG = (function () {
  // 四阵营定义（id / 显示名 / 卡片色 / 人口 / 初始资源 / 产能系数 / 专利）
  // 色值用「色 + 数值」双重编码（色盲友好由 UI 层补图标）。
  var FACTION_DEFS = [
    {
      id: 'white', name: '白队', color: '#E5E7EB', pop: 6,           // 「可调」劳动力大国
      initial: { life: 6, goods: 20, won: 32, militaryFund: 0 },     // 「可调」v2.0.1 平衡：6药撑过首夜+32金可买药（原 2/10 首夜必死）
      production: { goodsMin: 6, goodsMax: 10, lifeMin: 0, lifeMax: 1, ap: 2 }, // 「可调」产能极高（与下方 PRODUCTION 同步）
      patents: []
    },
    {
      id: 'blue', name: '蓝队', color: '#3B82F6', pop: 3,            // 「可调」医药垄断
      initial: { life: 20, goods: 5, won: 15, militaryFund: 0 },     // 「可调」自带大药库（v2.0.1: 30→20）
      production: { goodsMin: 0, goodsMax: 1, lifeMin: 3, lifeMax: 5, ap: 2 }, // 「可调」专职产药（与下方 PRODUCTION 同步）
      patents: []
    },
    {
      id: 'red', name: '红队', color: '#EF4444', pop: 3,             // 「可调」军事帝国
      initial: { life: 10, goods: 5, won: 32, militaryFund: 10 },     // 「可调」战备金充足（v2.0.1: 25→32，红队无产药需现金买药）
      production: { goodsMin: 0, goodsMax: 1, lifeMin: 0, lifeMax: 0, ap: 2 }, // 「可调」产能极低
      patents: []
    },
    {
      id: 'black', name: '黑队', color: '#111827', pop: 1,           // 「可调」孤狼
      initial: { life: 6, goods: 3, won: 22, militaryFund: 0 },      // 「可调」人少钱多持专利（v2.0.1: 药5→6/金20→22，孤狼需撑到专利回本）
      production: { goodsMin: 1, goodsMax: 2, lifeMin: 0, lifeMax: 0, ap: 2 }, // 「可调」产能低
      patents: ['科技品', '军备件']                                  // 「可调」专利范围
    }
  ];

  return {
    version: 'cangame-s1',            // 「可调」兼容标记

    // —— §3.1 人口与总盘（固定）——
    TOTAL_PLAYERS: 13,               // 「可调」1 人类 + 12 AI
    POP: { white: 6, blue: 3, red: 3, black: 1 }, // 「可调」与 FACTION_DEFS.pop 保持一致
    DAILY_LIFE_COST: 1,              // 「可调」每人/天扣药；阵营总耗 = 存活人数 × 此值

    // —— §3.2 初始资源（极度不平等）——
    // ⚠ 唯一真源：factions.js 只读 CONFIG.INITIAL（FACTION_DEFS.initial 仅作文档镜像，务必同步）。
    // v2.0.1 平衡校准结论（tools/sim-balance.js · 400 局 × 2 种子基）：
    //   白 35~38% / 蓝 19~20% / 红 17~24% / 黑 22~25%，首夜淘汰率 0%，最高阵营 ≤38%（<40% dominance 阈值）。
    //   校准手法：MAX_DAY 12→8 压缩成短局（长局蓝队靠药垄断必然独赢 95%+）；
    //             白 药2→6 / 金10→32 / 货3~5→6~10（原首夜必死、必败）；
    //             红 金25→32（无产药，全靠现金买药续命）；黑 药5→6 / 金20→22（孤狼需撑到专利回本）。
    //   敏感旋钮警示：黑队初始药 6→7 会让黑队独占 40%（+1 药 ≈ +16pp），改前必跑 sim-balance。
    INITIAL: {
      white: { life: 6, goods: 20, won: 32, militaryFund: 0 },
      blue:  { life: 20, goods: 5, won: 15, militaryFund: 0 },
      red:   { life: 10, goods: 5, won: 32, militaryFund: 10 },
      black: { life: 6, goods: 3, won: 22, militaryFund: 0 }
    },

    // —— §3.3 产能系数（确定性区间，每日生产阶段）——
    // 产出公式：out = min + floor(rng()*(max-min+1))
    // 注：蓝队产药量 3~5→6~9 对胜率「零影响」（蓝队药本就溢出，多产即浪费）——
    //     真正的瓶颈是蓝队愿意卖出多少，由 ai.js 的 aiDecideTrade 决定。别再靠调蓝队产能找平衡。
    PRODUCTION: {
      white: { goodsMin: 6, goodsMax: 10, lifeMin: 0, lifeMax: 1, ap: 2 }, // v2.0.1：产能按人头加权 + 微量自产药
      blue:  { goodsMin: 0, goodsMax: 1, lifeMin: 3, lifeMax: 5, ap: 2 },  // v2.0.1：日产下调（原 4~6 垄断过肥）
      red:   { goodsMin: 0, goodsMax: 1, lifeMin: 0, lifeMax: 0, ap: 2 },
      black: { goodsMin: 1, goodsMax: 2, lifeMin: 0, lifeMax: 0, ap: 2 }
    },

    // —— §3.4 战争与专利（不对称核心，Sprint 3 启用，此处先留参）——
    WAR_UNLOCK_DAY: 2,               // 「可调」第 2 天起可宣战
    WAR_COST: { white: 20, blue: 18, red: 4, black: 10 }, // 「可调」红队极低（设计点）
    PLUNDER: { goods: 0.20, won: 0.10 },  // 「可调」胜者掠夺比例
    PATENT_ROYALTY: 0.15,           // 「可调」非黑队产专利线缴 Won 比例
    BLACK_PATENTS: ['科技品', '军备件'],   // 「可调」

    // —— §2.6 战争战斗力系数（Sprint 3 新增，非 §3 既有平衡项；不改动宣战费/掠夺率）——
    // 战斗力 = Σ(militaryFund×K_MILITARY) + Σ(存活人数×K_POP)，再乘 ±PERTURB 随机扰动。
    WAR_COMBAT: {
      K_MILITARY: 1.0,   // militaryFund 权重
      K_POP: 3.0,        // 存活人数权重
      PERTURB: 0.15      // 随机扰动幅度（±15%，由 warRNG 派生，确定性）
    },
    // 人类战争小游戏加成：每答对 1 题 +BONUS_STEP（封顶 BONUS_MAX）。仅人类宣战时生效。
    WAR_MINIGAME: { QUESTIONS: 3, BONUS_STEP: 0.15, BONUS_MAX: 1.6 },

    // —— §3.5 奖金池与终局 ——  （Sprint 5 精修，此处为最简实现基线）
    PRIZE_SEED: 1000,                // 「可调」奖金池初始种子
    MAX_DAY: 8,                     // 「可调」达此天数强制终局；或仅剩 ≤1 阵营即终局
    // 阵营奖金总额 = PrizePool × (FactionGoods / ΣAllGoods)
    // 人均奖金     = 阵营奖金总额 ÷ 阵营存活人数（人头稀释）

    // —— §2 阶段定义（5 阶段）——
    PHASES: ['MORNING', 'PRODUCTION', 'TRADING', 'WAR', 'SETTLEMENT'],
    PHASE_LABELS: {
      MORNING: '早间 · 选举',
      PRODUCTION: '生产',
      TRADING: '贸易',
      WAR: '战争',
      SETTLEMENT: '结算 · 生命药'
    },

    // —— §5.2 性格权重（Sprint 4 启用）——
    PERSONALITY_WEIGHTS: {
      greedy:      { prod: 0.6, trade: 0.9, war: 0.5, betray: 0.9 },
      steady:      { prod: 0.8, trade: 0.3, war: 0.1, betray: 0.2 },
      risky:       { prod: 0.5, trade: 0.6, war: 0.9, betray: 0.6 },
      vengeful:    { prod: 0.5, trade: 0.4, war: 0.7, betray: 0.8 },
      opportunist: { prod: 0.5, trade: 0.8, war: 0.5, betray: 0.7 },
      lone:        { prod: 0.4, trade: 0.7, war: 0.1, betray: 0.5 }
    },

    // —— §5.3 阵营默认性格倾向（Sprint 4）：AI 初始化依此「抖动」分配 ——
    // 与 factions.js 的 PERSONALITY_POOLS 同源；白=守成为主个别贪狼 / 蓝=投机守成 /
    // 红=冒险复仇 / 黑=孤狼。每成员在默认权重上再做 ±PERSONALITY_JITTER 抖动（确定性）。
    FACTION_PERSONA: {
      white: ['steady', 'steady', 'greedy', 'steady', 'greedy', 'steady'],
      blue:  ['steady', 'opportunist', 'steady'],
      red:   ['risky', 'vengeful', 'risky'],
      black: ['lone']
    },
    PERSONALITY_JITTER: 0.1,   // 「可调」性格权重抖动幅度（±），确定性、夹 0~1

    // —— §5.4 背叛/生存裁决参数（Sprint 4）——
    // 背叛收益(预期掠夺) × 性格背叛权重 > 维系成本 → 输出 betray。
    BETRAY_MAINTAIN_COST: 2,  // 「可调」维系成本基线（数值越小越易背叛）
    // 生存淘汰：贪狼自保偏置（0~1，越大贪狼越「压低」自身被淘汰排序，叠加 Infinity 硬保护）。
    AI_GREEDY_SELF_BIAS: 0.3, // 「可调」

    FACTION_DEFS: FACTION_DEFS
  };
})();

// 跨文件保险：确保 vm 沙箱与浏览器均能按全局名访问 CONFIG。
if (typeof globalThis !== 'undefined') globalThis.CONFIG = CONFIG;
