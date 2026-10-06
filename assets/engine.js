/* =========================================================
 * CANGAME · 引擎层
 * 状态 / 年份推进 / 事件抽取 / 投资 / 结局判定
 * ========================================================= */

const SAVE_VERSION = 2;
const END_AGE = GAME_META.endAge;
const START_YEAR = GAME_META.startYear;

/* ---------- 工具 ---------- */
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function chance(p) { return Math.random() < p; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ---------- 随机姓名 ---------- */
function randomKoreanName(gender) {
  const s = SURNAMES[randInt(0, SURNAMES.length - 1)];
  const pool = (gender === 'F') ? GIVEN_NAMES.F : GIVEN_NAMES.M;
  return s + pool[randInt(0, pool.length - 1)];
}
function randomPersonName(gender) { return randomKoreanName(gender); }
function randomSpouseName(gender) {
  const opp = (gender === 'F') ? 'M' : 'F';
  const pool = GIVEN_NAMES[opp];
  return SURNAMES[randInt(0, SURNAMES.length - 1)] + pool[randInt(0, pool.length - 1)];
}
function randomParentName(gender) {
  // 父母用更年长一代的名字
  const old = { M: ['建国', '志强', '国平', '伟民', '建军', '德胜', '长海', '永年'],
                F: ['秀英', '桂芳', '玉兰', '淑珍', '丽华', '春梅', '素芬', '月娥'] };
  const pool = (gender === 'F') ? old.F : old.M;
  return SURNAMES[randInt(0, SURNAMES.length - 1)] + pool[randInt(0, pool.length - 1)];
}
function randomPetName(type) {
  const dog = ['旺财', '大黄', '豆豆', '可乐', '布丁', '团子', '闪电', '土豆'];
  const cat = ['咪咪', '橘子', '雪球', '芝麻', '汤圆', '年糕', '毛豆', '小花'];
  const pool = (type === 'cat') ? cat : dog;
  return pool[randInt(0, pool.length - 1)];
}

/* ---------- 朋友圈 ---------- */
function makeFriends() {
  const pool = FRIEND_TYPES.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const t = pool.splice(randInt(0, pool.length - 1), 1)[0];
    out.push({
      key: t.key,
      name: randomKoreanName(chance(0.5) ? 'F' : 'M'),
      affinity: randInt(12, 30),
      lastTouch: -1
    });
  }
  return out;
}

/* ---------- 人际互动（人际关系面板） ---------- */
function parentOf(state, which) {
  if (!state.parents) state.parents = null;
  return state.parents && state.parents[which];
}

function socialAct(state, kind, idx) {
  if (!state || state.finished) return { ok: false };
  const s = state.stats;
  const touch = state.socialTouch = state.socialTouch || {};
  const key = kind + (idx != null ? ':' + idx : '');
  if (touch[key] === state.age) return { ok: false, msg: '今年已经互动过了' };
  touch[key] = state.age;
  if (kind === 'father' || kind === 'mother') {
    const p = parentOf(state, kind);
    if (!p || !p.alive) { delete touch[key]; return { ok: false, msg: '已经不在了' }; }
    p.affinity = clamp((p.affinity || 50) + randInt(4, 8), 0, 100);
    const isF = kind === 'father';
    s.LOVE += 3; s.SEC += 3; s.STRESS -= 4;
    if (isF) { s.WILL += 2; s.INT += 1; } else { s.HP += 2; s.MOOD = (s.MOOD || 60) + 3; }
    if (state.age >= 20) s.MONEY -= 400000;
    pushLog(state, isF
      ? `【父子】你和父亲 ${p.name} 喝了二两白酒。他话不多，只说：钱够不够用。`
      : `【母子】你陪母亲 ${p.name} 在厨房择菜。她说：人回来就好，还买什么东西。`, 'muted');
  } else if (kind === 'parents') {
    if (!state.flags.parents_alive) { delete touch[key]; return { ok: false, msg: '已经不在了' }; }
    s.LOVE += 3; s.SEC += 3; s.STRESS -= 4;
    if (state.age >= 20) s.MONEY -= 500000;
    pushLog(state, '【团聚】你回家陪父母吃了一顿饭。母亲说：人回来就好，还带什么东西。', 'muted');
  } else if (kind === 'spouse') {
    if (state.flags.married) {
      s.LOVE += 4; s.STRESS -= 4; s.SEC += 2; s.MOOD = (s.MOOD || 60) + 3;
      pushLog(state, `【夫妻】你和 ${state.spouseName || '爱人'} 像年轻时那样约会了一次。`, 'muted');
    } else if (state.flags.dating) {
      s.LOVE += 3; s.CHA += 1;
      pushLog(state, '【约会】你们去看了一场电影。牵手的时候，谁都没有说话。', 'muted');
    } else { delete touch[key]; return { ok: false, msg: '你现在没有恋人' }; }
  } else if (kind === 'child') {
    if (!state.childCount) { delete touch[key]; return { ok: false }; }
    s.LOVE += 3; s.GROW += 2; s.STRESS -= 2;
    pushLog(state, '【陪伴】你推掉了应酬，陪孩子待了一整天。孩子画了一幅画：这是你。', 'muted');
  } else if (kind === 'pet') {
    if (!state.pet || !state.pet.alive) { delete touch[key]; return { ok: false }; }
    s.LOVE += 2; s.HP += 2; s.SEC += 1; s.MOOD = (s.MOOD || 60) + 2;
    pushLog(state, `【遛弯】你带着 ${state.pet.name} 在江边走了一圈。它很开心，你也是。`, 'muted');
  } else if (kind === 'friend') {
    const f = state.friends && state.friends[idx];
    if (!f) { delete touch[key]; return { ok: false }; }
    f.affinity = clamp(f.affinity + randInt(4, 7), 0, 100);
    s.NET += 2; s.LOVE += 2; s.STRESS -= 2;
    const t = FRIEND_TYPES.find(x => x.key === f.key);
    pushLog(state, `【相聚】你和 ${f.name}（${t ? t.label : '朋友'}）聚了聚。有些关系，不走动就真的远了。`, 'muted');
  } else { delete touch[key]; return { ok: false }; }
  applyEffects(state, {}); // 触发数值夹取
  return { ok: true };
}

/* 一键互动：把今年还没互动过的朋友 / 同学一次性走完 */
function socialActAll(state, kind) {
  if (!state || state.finished) return { ok: false, n: 0 };
  if (kind === 'friend') {
    let n = 0;
    (state.friends || []).forEach((f, i) => {
      const touch = state.socialTouch || {};
      if (touch['friend:' + i] === state.age) return;
      if (socialAct(state, 'friend', i).ok) n++;
    });
    if (n) pushLog(state, `【走动】这一年你把所有朋友都见了一遍（${n} 位）。`, 'muted');
    return { ok: n > 0, n };
  }
  if (kind === 'classmate') {
    let n = 0;
    (state.classmates || []).forEach((c, i) => {
      if (c.lastTouch === state.age) return;
      if (classmateAct(state, i).ok) n++;
    });
    if (n) pushLog(state, `【课间】你和班上的同学都聊了一遍（${n} 位）。`, 'muted');
    return { ok: n > 0, n };
  }
  return { ok: false, n: 0 };
}

/* ---------- 出生叙事（随机人生故事） ---------- */
function pushBirthStory(state) {
  const fam = familyById(state.familyId);
  const opener = BIRTH_OPENERS[randInt(0, BIRTH_OPENERS.length - 1)];
  const byfam = (BIRTH_BY_FAMILY[fam.id] || []);
  const famLine = byfam.length ? byfam[randInt(0, byfam.length - 1)] : '';
  const parents = BIRTH_PARENTS[randInt(0, BIRTH_PARENTS.length - 1)];
  const omen = BIRTH_OMENS[randInt(0, BIRTH_OMENS.length - 1)];
  pushLog(state, opener, 'story');
  if (famLine) pushLog(state, famLine, 'story');
  pushLog(state, parents, 'story');
  pushLog(state, omen, 'story');
  if (state.flags.past_life) {
    pushLog(state, '前世的记忆在午夜涌来：冰冷的江水，和一双擦得发亮的皮鞋。你攥紧拳头——这一世，要改写它。', 'story');
  }
}

/* 内部货币单位 → 人民币元的换算（全局唯一入口，改这里即可整体换币） */
const CNY_RATE = 1 / 180;

function fmtMoney(v) {
  const raw = (v || 0) * CNY_RATE;
  const sign = raw < -0.5 ? '-' : '';
  const n = Math.abs(raw);
  if (n >= 1e12) return sign + (n / 1e12).toFixed(2) + '万亿元';
  if (n >= 1e8) return sign + (n / 1e8).toFixed(n >= 1e10 ? 1 : 2) + '亿元';
  if (n >= 1e4) return sign + (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + '万元';
  return sign + Math.round(n) + '元';
}
function fmtYear(state) { return (state.startYear || START_YEAR) + state.age; }
function grade(score) {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  if (score >= 35) return 'C';
  return 'D';
}

/* ---------- 职业与收支 ---------- */
const JOBS = {
  '婴儿': { salary: 0, cost: 800000 },
  '小学生': { salary: 0, cost: 1500000 },
  '初中生': { salary: 0, cost: 2500000 },
  '高中生': { salary: 0, cost: 4000000 },
  '大学生': { salary: 0, cost: 9000000 },
  '待业': { salary: 0, cost: 8000000 },
  '军人': { salary: 1500000, cost: 0 },
  '无业': { salary: 0, cost: 12000000 },
  '退休': { salary: 26000000, cost: 13000000 },
  '工厂工人': { salary: 26000000, cost: 16000000 },
  '公司职员': { salary: 42000000, cost: 20000000 },
  '公务员': { salary: 38000000, cost: 19000000 },
  '个体户': { salary: 55000000, cost: 24000000 },
  '创业者': { salary: 20000000, cost: 22000000 },
  '大企业职员': { salary: 52000000, cost: 22000000 },
  '大公司战略次长': { salary: 95000000, cost: 30000000 },
  '大公司副董事长': { salary: 320000000, cost: 60000000 },
  '企业董事长': { salary: 900000000, cost: 90000000 }
};

function defaultJob(age) {
  if (age <= 6) return '婴儿';
  if (age <= 12) return '小学生';
  if (age <= 15) return '初中生';
  if (age <= 18) return '高中生';
  if (age <= 22) return '大学生';
  return '无业';
}

/* ---------- 创建角色 ---------- */
function rollTalents(n) {
  const pool = TALENTS.slice();
  const out = [];
  n = n || 10;
  while (out.length < n && pool.length) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
}

function talentById(id) { return TALENTS.find(t => t.id === id); }
function familyById(id) { return FAMILIES.find(f => f.id === id); }

/* ---------- 家庭财务 ---------- */
/* 出生时父母的家底：资产 / 负债，按出生年代缩放（早年 nominal 金额小得多） */
function initFamilyFin(familyId, startYear) {
  const base = FAMILY_FIN[familyId] || { assets: 30000000, debt: 30000000 };
  const k = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, startYear || 1985) : 1;
  return {
    assets: Math.round(base.assets * k),
    debt: Math.round(base.debt * k),
    startAssets: Math.round(base.assets * k),
    startDebt: Math.round(base.debt * k)
  };
}

function createGame(opt) {
  const family = familyById(opt.familyId) || FAMILIES[0];
  const startYear = opt.startYear || randInt(1955, 2005);
  const isOrphan = family.id === 'fuli';
  const isSingle = family.id === 'danqin';
  const parents = isOrphan ? null : {
    father: isSingle ? null : {
      name: randomParentName('M'), alive: true, affinity: randInt(42, 68),
      age: randInt(25, 38), bond: '父'
    },
    mother: {
      name: randomParentName('F'), alive: true, affinity: randInt(52, 76),
      age: randInt(23, 36), bond: '母'
    }
  };
  const state = {
    v: SAVE_VERSION,
    seed: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: opt.name || randomPersonName(opt.gender || 'M'),
    gender: opt.gender || 'M',
    startYear: startYear,
    priority: opt.priority || 'balance',
    age: 0,
    familyId: family.id,
    familyName: family.name,
    talents: opt.talents || [],
    stats: { INT: 5, STR: 5, CHA: 5, WILL: 5, HP: 60, STRESS: 10, MONEY: 0, NET: 0, FAME: 0, LOY: 0,
             CUR: 5, LOVE: 5, SEC: 5, AUTO: 5, GROW: 0, ETH: 60, MOOD: 60 },
    flags: { parents_alive: !isOrphan },
    job: '婴儿',
    log: [],
    used: [],
    queue: [],
    pending: null,
    investments: [],
    spouseName: null,
    spouse: null,
    childCount: 0,
    grandCount: 0,
    pet: null,
    family: initFamilyFin(family.id, startYear),
    parents: parents,
    friends: makeFriends(),
    classmates: [],
    classStage: null,
    love: { candidates: [], partner: null, met: [] },
    career: null,
    edu: { mid: null, gao: null, hs: null, uni: null, eduLevel: 0, study: 0, gradAge: null, major: null, salaryK: 1 },
    loans: [],
    credit: 100,
    grief: null,
    socialTouch: {},
    uniTouch: {},
    alive: true,
    finished: false,
    ending: null,
    peak: { MONEY: 0, FAME: 0, NET: 0 }
  };
  marketInit(state);
  // 出身
  applyEffects(state, family.eff, true);
  if (family.flags) family.flags.forEach(f => state.flags[f] = true);
  // 福利院出身：档案袋上没有父母
  if (isOrphan) state.flags.parents_alive = false;
  // 天赋
  (opt.talents || []).forEach(id => {
    const t = talentById(id);
    if (!t) return;
    if (t.eff) applyEffects(state, t.eff, true);
    if (t.flags) t.flags.forEach(f => state.flags[f] = true);
  });
  state.stats.HP = clamp(state.stats.HP, 20, 100);
  state.stats.STRESS = clamp(state.stats.STRESS, 0, 100);
  pushLog(state, `${state.startYear} 年 · ${state.name} 出生在${family.name.split(' ')[1] || family.name}。`, 'system');
  pushLog(state, family.desc, 'story');
  if (!state.flags.orphan) {
    pushLog(state, `【家底】家里的账簿：资产 ${fmtMoney(state.family.assets)}，负债 ${fmtMoney(state.family.debt)}。未成年之前，这些都不用你来操心。`, 'muted');
  }
  pushBirthStory(state);
  return state;
}

/* ---------- 旧存档迁移（v4.x → v5.x） ---------- */
function migrateState(state) {
  if (!state || !state.stats) return state;
  if (!state.edu) {
    state.edu = { mid: null, gao: null, hs: null, uni: null, eduLevel: 0, study: 0, gradAge: null, major: null, salaryK: 1 };
  }
  if (state.edu.eduLevel == null) state.edu.eduLevel = 0;
  if (!state.parents && !state.flags.orphan) {
    const single = !!state.flags.single;
    state.parents = {
      father: single ? null : { name: randomParentName('M'), alive: !!state.flags.parents_alive, affinity: 55, age: clamp(state.age + randInt(24, 34), 30, 70), bond: '父' },
      mother: { name: randomParentName('F'), alive: !!state.flags.parents_alive, affinity: 62, age: clamp(state.age + randInt(22, 30), 28, 68), bond: '母' }
    };
  }
  if (!state.love) state.love = { candidates: [], partner: null, met: [] };
  if (state.loans == null) state.loans = [];
  if (state.credit == null) state.credit = 100;
  if (state.stats.ETH === undefined) state.stats.ETH = 60;
  if (state.stats.MOOD === undefined) state.stats.MOOD = 60;
  if (state.career === undefined) state.career = null;
  if (state.classmates == null) state.classmates = [];
  if (state.uniTouch == null) state.uniTouch = {};
  if (state.socialTouch == null) state.socialTouch = {};
  if (!state.spouse && state.spouseName) {
    state.spouse = { name: state.spouseName, age: clamp(state.age + randInt(-3, 3), 20, 70), affinity: 65, alive: true, since: state.age };
  }
  return state;
}

function pushLog(state, text, type) {
  state.log.push({ age: state.age, year: (state.startYear || START_YEAR) + state.age, text, type: type || 'story' });
  if (state.log.length > 400) state.log.shift();
}

/* ---------- 效果结算 ---------- */
function applyEffects(state, eff, silent) {
  if (!eff) return;
  const s = state.stats;
  for (const k in eff) {
    const v = eff[k];
    if (typeof v !== 'number') continue;
    if (s[k] === undefined) { s[k] = 0; }
    s[k] += v;
  }
  s.HP = clamp(s.HP, 0, 120);
  s.STRESS = clamp(s.STRESS, 0, 120);
  s.INT = clamp(s.INT, 0, 200); s.STR = clamp(s.STR, 0, 200);
  s.CHA = clamp(s.CHA, 0, 200); s.WILL = clamp(s.WILL, 0, 200);
  s.NET = clamp(s.NET, 0, 200); s.FAME = clamp(s.FAME, 0, 200);
  s.LOY = clamp(s.LOY, -50, 150);
  s.CUR = clamp(s.CUR, 0, 100); s.LOVE = clamp(s.LOVE, 0, 100);
  s.SEC = clamp(s.SEC, 0, 100); s.AUTO = clamp(s.AUTO, 0, 100);
  s.GROW = clamp(s.GROW, 0, 100);
  s.ETH = clamp(s.ETH === undefined ? 60 : s.ETH, 0, 100);
  s.MOOD = clamp(s.MOOD === undefined ? 60 : s.MOOD, 0, 100);
  s.MONEY = Math.round(s.MONEY);
  // 记录峰值
  if (s.MONEY > state.peak.MONEY) state.peak.MONEY = s.MONEY;
  if (s.FAME > state.peak.FAME) state.peak.FAME = s.FAME;
}

function applyFlags(state, flags) {
  if (!flags) return;
  flags.forEach(f => state.flags[f] = true);
}

function describeEffects(eff) {
  const names = {
    INT: '智力', STR: '体魄', CHA: '魅力', WILL: '意志',
    HP: '健康', STRESS: '压力', MONEY: '现金',
    NET: '人脉', FAME: '声望', LOY: '口碑',
    CUR: '好奇', LOVE: '关爱', SEC: '安全', AUTO: '自主', GROW: '成长',
    ETH: '道德', MOOD: '心情'
  };
  const parts = [];
  for (const k in eff || {}) {
    const v = eff[k];
    if (typeof v !== 'number' || v === 0) continue;
    if (k === 'MONEY') parts.push(`${v > 0 ? '+' : ''}${fmtMoney(v)}`);
    else parts.push(`${names[k] || k} ${v > 0 ? '+' : ''}${v}`);
  }
  return parts;
}

/* ---------- 条件判定 ---------- */
function matchCond(state, ev) {
  const c = ev.cond;
  if (!c) return true;
  if (c.ageMin !== undefined && state.age < c.ageMin) return false;
  if (c.ageMax !== undefined && state.age > c.ageMax) return false;
  const year = fmtYear(state);
  if (c.yearMin !== undefined && year < c.yearMin) return false;
  if (c.yearMax !== undefined && year > c.yearMax) return false;
  if (c.gender && state.gender !== c.gender) return false;
  if (c.job && c.job.indexOf(state.job) === -1) return false;
  if (c.need && !c.need.every(f => state.flags[f])) return false;
  if (c.need2 && !c.need2.every(f => state.flags[f])) return false;
  if (c.ban && c.ban.some(f => state.flags[f])) return false;
  if (c.pet && !(state.pet && state.pet.alive)) return false;
  if (c.noPet && state.pet && state.pet.alive) return false;
  if (c.grand && !(state.grandCount > 0)) return false;
  if (c.min) for (const k in c.min) if (state.stats[k] < c.min[k]) return false;
  if (c.max) for (const k in c.max) if (state.stats[k] > c.max[k]) return false;
  return true;
}

function matchEvent(state, ev) {
  const a = ev.age || [0, 200];
  if (state.age < a[0] || state.age > a[1]) return false;
  if (ev.once && state.used.indexOf(ev.id) >= 0) return false;
  if (state.used.indexOf(ev.id) >= 0) return false; // 所有事件每人只发生一次
  return matchCond(state, ev);
}

/* ---------- 三选项系统 ---------- */
/* 无手写选项的事件（成年后）自动生成：慎重 / 照常 / 豁出去 */
function scaleEff(eff, gainK, lossK) {
  const o = {};
  for (const k in eff || {}) {
    const v = eff[k];
    if (typeof v !== 'number') continue;
    o[k] = v >= 0 ? Math.round(v * gainK) : -Math.round(-v * lossK);
  }
  return o;
}

/* ---------- 事件语义识别：让三个选项的文案跟着事件内容走 ---------- */
const TAG_KEYWORDS = [
  ['study', ['考试', '成绩', '老师', '上课', '自习', '笔记', '复习', '作业', '补习', '图书馆', '年级', '班里', '读书', '课本']],
  ['love', ['喜欢', '心动', '表白', '恋爱', '牵手', '暗恋', '分手', '结婚', '相亲', '约会', '好感', '恋人', '追求']],
  ['family', ['父亲', '母亲', '爸爸', '妈妈', '家里', '父母', '家人', '孩子', '女儿', '儿子', '祖父母', '亲人']],
  ['health', ['医院', '生病', '体检', '身体', '发烧', '失眠', '过劳', '跑步', '锻炼', '酒', '烟', '住院', '抑郁']],
  ['money', ['钱', '投资', '股票', '房价', '买房', '贷款', '欠债', '融资', '生意', '股价', '收入', '存款', '比特币', '基金']],
  ['work', ['公司', '上司', '同事', '加班', '项目', '职场', '部门', '领导', '客户', '甲方', '绩效', '裁员', '汇报', '会议']],
  ['social', ['朋友', '聚会', '饭局', '人脉', '认识', '饭桌', '应酬', '帮忙', '搭话', '圈子']],
  ['moral', ['回扣', '好处', '规矩', '举报', '造假', '走后门', '灰色', '行贿', '底线', '良心']]
];

function inferEventTag(state, ev) {
  if (ev.t) return ev.t;
  const txt = String(ev.text || '');
  for (const [tag, words] of TAG_KEYWORDS) {
    for (const w of words) {
      if (txt.indexOf(w) >= 0) return tag;
    }
  }
  const e = ev.eff || {};
  const w = {
    study: (e.INT || 0) + (e.GROW || 0) * 1.2 + (e.CUR || 0),
    love: (e.LOVE || 0) * 1.4 + (e.SEC || 0) * 0.5,
    health: (e.HP || 0) * 1.4 + Math.abs(e.STRESS || 0) * 0.8 + (e.STR || 0) * 0.4,
    money: Math.abs(e.MONEY || 0) / 12000000,
    social: (e.NET || 0) * 1.4 + (e.CHA || 0) * 0.8,
    work: (e.LOY || 0) * 1.3 + (e.FAME || 0) * 0.7,
    moral: Math.abs(e.ETH || 0) * 2.2,
    family: (e.SEC || 0) * 0.6
  };
  if (state.age <= 18) w.study += 3;
  if (ev.cond && ev.cond.need) {
    const f = ev.cond.need.join(' ');
    if (/married|dating|spouse|child/.test(f)) w.love += 6;
    if (/bigco|startup|job|staff/.test(f)) w.work += 6;
  }
  let best = 'default', bv = 1.2;
  for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; }
  return best;
}

function choiceTexts(state, ev) {
  if (!ev._ct) {
    const tag = inferEventTag(state, ev);
    const pool = CHOICE_TEMPLATES[tag] || CHOICE_TEMPLATES.default;
    ev._ct = { tag: tag, i: randInt(0, pool.length - 1), txt: pool[randInt(0, pool.length - 1)] };
  }
  return ev._ct.txt;
}

function eventChoices(state, ev) {
  if (ev.choices && ev.choices.length) {
    return ev.choices.map(c => Object.assign({ risk: c.risk || 2 }, c));
  }
  if (state.age < 13) return null; // 童年叙事事件保持单按钮
  const base = ev.eff || {};
  const hasMoney = typeof base.MONEY === 'number' && base.MONEY !== 0;
  const risk3 = Object.assign(scaleEff(base, 1.7, 1.35), { STRESS: (base.STRESS || 0) + 4 });
  const T = choiceTexts(state, ev);
  return [
    {
      text: T[0], risk: 1, skipFlags: true,
      eff: Object.assign(scaleEff(base, 0.6, 0.45), { STRESS: -2 })
    },
    { text: T[1], risk: 2, eff: scaleEff(base, 1, 1) },
    {
      text: T[2], risk: 3, eff: risk3,
      gamble: {
        p: 0.45,
        win: hasMoney
          ? { MONEY: Math.round(Math.abs(base.MONEY) * 1.5), WILL: 4, INT: 3 }
          : { WILL: 5, INT: 4, NET: 5, FAME: 3 },
        lose: hasMoney
          ? { MONEY: -Math.round(Math.abs(base.MONEY) * 0.7), HP: -2, STRESS: 5 }
          : { HP: -2, STRESS: 6, CHA: -3 }
      }
    }
  ];
}

function riskLabel(r) {
  return ['', '低', '中', '高'][r] || '中';
}

function pickEvents(state) {
  const pool = EVENTS.filter(ev => matchEvent(state, ev));
  if (!pool.length) return [];
  const lucky = !!state.flags.lucky;
  const weighted = [];
  pool.forEach(ev => {
    let w = ev.w || 5;
    if (lucky) w *= 1.35;
    weighted.push({ ev, w });
  });
  const count = state.age <= 12 ? 1 : (chance(0.35) ? 2 : 1);
  const picked = [];
  // 年代事件：窗口开启的年份必触发一个（每个出生年份都有自己独有的时代切片）
  const era = weighted.filter(x => x.ev.era);
  if (era.length) {
    const e = era[randInt(0, era.length - 1)].ev;
    picked.push(e);
    weighted.splice(weighted.findIndex(x => x.ev === e), 1);
  }
  for (let i = picked.length; i < count && weighted.length; i++) {
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < weighted.length; j++) {
      r -= weighted[j].w;
      if (r <= 0) { idx = j; break; }
    }
    picked.push(weighted[idx].ev);
    weighted.splice(idx, 1);
  }
  return picked;
}

/* ---------- 投资系统 ---------- */
function settleInvestments(state) {
  const done = [];
  state.investments = state.investments.filter(inv => {
    inv.yearsLeft -= 1;
    if (inv.yearsLeft > 0) return true;
    // 结算
    let mult = inv.base + (Math.random() * 2 - 1) * inv.vol;
    if (state.flags.past_life) mult = inv.base * 0.7 + mult * 0.3 + 0.3; // 前世记忆：下限更高
    if (state.flags.stock_buff && inv.kind === 'stock') mult *= 1.3;
    if (state.flags.estate_buff && inv.kind === 'estate') mult *= 1.5;
    if (state.flags.lucky) mult *= 1.1;
    mult = Math.max(0.2, mult);
    const payout = Math.round(inv.amount * mult);
    const profit = payout - inv.amount;
    state.stats.MONEY += payout;
    done.push({ inv, payout, profit, mult });
    return false;
  });
  done.forEach(d => {
    pushLog(state,
      `【投资结算】${d.inv.name} · ${fmtYear(state)} 年 · 回报 ${d.mult.toFixed(2)}倍，到手 ${fmtMoney(d.payout)}（净 ${d.profit >= 0 ? '+' : ''}${fmtMoney(d.profit)}）`,
      d.profit >= 0 ? 'money' : 'warn');
  });
  return done;
}

function offerInvestments(state) {
  const year = fmtYear(state);
  const offers = INVESTMENTS.filter(inv => inv.year === year && state.used.indexOf(inv.id) < 0);
  return offers.map(inv => ({
    type: 'invest',
    inv,
    text: `【投资机会 · ${year} 年】${inv.name}\n最低入场 ${fmtMoney(inv.cost)}，持有约 ${inv.hold} 年后一次性结算。\n${state.flags.past_life ? '前世记忆：' + inv.hint : '（你没有关于这件事的记忆，只能赌。）'}`,
    choices: buildInvestChoices(state, inv)
  }));
}

function buildInvestChoices(state, inv) {
  const c = [];
  const m = state.stats.MONEY;
  [0.3, 0.6, 1].forEach(ratio => {
    const amt = Math.max(inv.cost, Math.floor(m * ratio));
    c.push({
      text: `投入身家的 ${Math.round(ratio * 100)}% · ${fmtMoney(amt)}`,
      disabled: m < amt || m <= 0,
      act: 'invest',
      invId: inv.id,
      amount: amt
    });
  });
  c.push({ text: '放过这次机会', act: 'skip', invId: inv.id });
  return c;
}

function doInvest(state, invId, amount) {
  const inv = INVESTMENTS.find(i => i.id === invId);
  if (!inv) return;
  const need = Math.max(inv.cost, Math.round(amount));
  if (state.stats.MONEY < need) return;
  state.stats.MONEY -= need;
  state.investments.push({
    id: inv.id, name: inv.name, amount: need,
    base: inv.base, vol: inv.vol, kind: inv.kind,
    yearsLeft: inv.hold, startYear: fmtYear(state)
  });
  state.used.push(inv.id);
  pushLog(state, `【投资】买入 ${inv.name}，投入 ${fmtMoney(need)}。`, 'money');
}

/* ---------- 悲伤：亲人 / 朋友 / 宠物离世会真实压住心情 ---------- */
function addGrief(state, reason, amount) {
  const a = Math.round(amount || 12);
  state.grief = { reason: reason, level: a, until: state.age + 1 + Math.round(a / 10) };
  const s = state.stats;
  s.MOOD = clamp((s.MOOD === undefined ? 60 : s.MOOD) - a, 0, 100);
  s.STRESS += Math.round(a / 3);
  s.HP -= Math.round(a / 8);
  applyEffects(state, {});
}

/* ---------- 父母逐年老去 / 离世 ---------- */
function parentTick(state) {
  if (!state.parents) return;
  const ps = state.parents;
  ['father', 'mother'].forEach(k => {
    const p = ps[k];
    if (!p || !p.alive) return;
    p.age += 1;
    const risk = 0.0016 + Math.max(0, p.age - 60) * 0.0058;
    if (chance(risk)) {
      p.alive = false;
      const who = k === 'father' ? '父亲' : '母亲';
      addGrief(state, who + '走了', 22);
      pushLog(state, `【丧亲】${who} ${p.name} 走了，${p.age}岁。` +
        (k === 'father' ? '你这辈子没怎么和他说过话，现在没机会了。' : '往后回家，厨房里再没有人等你。'), 'warn');
    }
  });
  const both = (!ps.father || !ps.father.alive) && (!ps.mother || !ps.mother.alive);
  if (both && state.flags.parents_alive) {
    state.flags.parents_alive = false;
    pushLog(state, '【丧亲】父母都不在了。从此你回的那个地方，只能叫老家。', 'muted');
    const fin = state.family || (state.family = initFamilyFin(state.familyId, state.startYear));
    if (state.age >= 19) {
      state.queue = state.queue || [];
      state.queue.unshift({ type: 'event', ev: makeInheritanceEvent(state) });
    } else {
      fin.debt = 0;
      pushLog(state, '【继承】你还没成年。亲戚们替你办了后事，债务一笔勾销，遗产由监护人代管。', 'muted');
    }
  }
}

/* ---------- 朋友也会老、也会走 ---------- */
function friendTick(state) {
  (state.friends || []).forEach(f => {
    if (f.alive === false) return;
    f.age = (f.age || 20) + 1;
    if (state.age >= 55 && chance(0.004 + Math.max(0, state.age - 60) * 0.0016)) {
      f.alive = false;
      const t = FRIEND_TYPES.find(x => x.key === f.key);
      addGrief(state, `老友 ${f.name} 走了`, 14);
      pushLog(state, `【永别】${f.name}（${t ? t.label : '朋友'}）走了。葬礼上你想起很多年前的那个夏天。`, 'warn');
    }
  });
}

/* ---------- 自动求职 ---------- */
function autoEmploy(state) {
  const offers = jobOffers(state).filter(o => o.okEdu && o.okStat && o.okFlag);
  if (!offers.length) {
    state.job = '服务员';
    state.career = { id: 'waiter', level: 0, years: 0, joinedAge: state.age };
    pushLog(state, '【求职】你只找到了一份服务员的工作。先干着吧。', 'muted');
    return;
  }
  offers.sort((a, b) => b.career.ladder[b.entry].sal - a.career.ladder[a.entry].sal);
  const pick = offers[randInt(0, Math.min(2, offers.length - 1))];
  applyJob(state, pick.career.id);
}

/* ---------- 年度基础结算 ---------- */
function yearBase(state) {
  const s = state.stats;
  // 自然成长 + 人生指标自然培养
  if (state.age <= 12) {
    s.INT += rand(1, 3); s.STR += rand(1, 2); s.HP += 2;
    s.CUR += rand(1, 3); s.LOVE += rand(0, 2); s.SEC += rand(0, 2); s.AUTO += rand(0, 2); s.GROW += rand(1, 2);
  }
  else if (state.age <= 18) {
    s.INT += rand(1, 2); s.CHA += rand(0, 2); s.STR += rand(0, 1);
    s.CUR += rand(1, 2); s.LOVE += rand(0, 1); s.SEC += rand(0, 1); s.GROW += rand(0, 2);
  }
  else if (state.age <= 35) {
    s.INT += rand(0, 1); s.HP += s.STRESS < 55 ? rand(0, 2) : rand(-1, 1);
    s.GROW += rand(0, 2); s.AUTO += rand(0, 1);
  }
  else if (state.age <= 55) {
    s.HP += s.STRESS < 45 ? rand(0, 1) : rand(-2, 0); s.STR += -1;
    s.GROW += rand(0, 1); s.AUTO += rand(0, 1);
  }
  else {
    s.HP += s.STRESS < 35 ? rand(0, 1) : rand(-2, 0); s.STR += -1;
    s.GROW += rand(0, 1);
  }

  // 擅长领域倾向（priority）
  if (state.priority === 'career') { s.INT += rand(0, 1); }
  else if (state.priority === 'relation') { s.LOVE += rand(0, 2); s.CHA += rand(0, 1); s.SEC += rand(0, 1); }
  else if (state.priority === 'balance') { s.STRESS = Math.max(0, s.STRESS - 2); s.HP += 1; }
  else if (state.priority === 'success') { s.FAME += rand(0, 1); s.NET += rand(0, 1); }

  // 宠物陪伴
  if (state.pet && state.pet.alive) {
    s.LOVE += rand(0, 2); s.SEC += rand(0, 1); s.GROW += rand(0, 1);
    s.MONEY -= 1500000; // 饲养费
  }

  // 朋友圈被动加成（好感越高，加成越大）
  if (state.friends) state.friends.forEach(f => {
    const t = FRIEND_TYPES.find(x => x.key === f.key);
    if (!t) return;
    const k = Math.max(0.3, (f.affinity || 0) / 50);
    for (const stat in t.pass) {
      if (stat === 'MONEY') s.MONEY += Math.round(t.pass[stat] * k);
      else s[stat] = (s[stat] || 0) + t.pass[stat] * k;
    }
  });

  // 心情：悲伤会压住人，时间会把人慢慢捞起来
  if (state.grief && state.age <= state.grief.until) {
    s.MOOD -= 3; s.STRESS += 2;
  } else if (state.grief && state.age > state.grief.until) {
    pushLog(state, `【释怀】关于 ${state.grief.reason} 的那件事，你终于能平静地提起了。`, 'muted');
    state.grief = null;
  }
  s.MOOD += rand(1, 4) + (s.LOVE > 60 ? 1 : 0) - (s.STRESS > 60 ? 2 : 0);
  if (s.MOOD < 32) { s.HP -= 2; s.STRESS += 4; }
  else if (s.MOOD > 78) { s.HP += 1; s.STRESS -= 1; }

  // 压力伤害
  if (s.STRESS > 70) { s.HP -= Math.round((s.STRESS - 70) / 6); }
  s.STRESS = Math.max(0, s.STRESS - 7);

  // 病重时自动就医（有钱才能买回时间）
  if (s.HP < 35 && s.MONEY >= 20000000 && state.age >= 20) {
    const fee = Math.min(Math.max(20000000, Math.round(s.MONEY * 0.1)), 500000000);
    s.MONEY -= fee;
    s.HP += 20; s.STRESS -= 10;
    pushLog(state, `【住院】你在医院躺了两周，花了 ${fmtMoney(fee)}。医生说：再晚一个月就晚了。`, 'warn');
  }

  // 大学毕业
  if (state.edu && state.edu.gradAge && state.age >= state.edu.gradAge && state.job === '大学生') {
    const u = UNIVERSITIES.find(x => x.id === state.edu.uni);
    state.job = '待业';
    state.classmates = [];
    state.classStage = null;
    pushLog(state, `【毕业】${u ? u.name : '大学'} · ${state.edu.major || ''} 专业。你搬出了宿舍，把学士服叠进了箱底。`, 'money');
    if (state.edu.eduLevel < 5) state.edu.eduLevel = Math.max(state.edu.eduLevel, u ? u.edu : 3);
  }

  // 待业：按学历自动找一份能干的工作（避免长期无业陷入负债螺旋）
  if (state.age >= 17 && (state.job === '待业' || state.job === '无业')) {
    autoEmploy(state);
  }
  // 退休
  if (state.age >= 60 && state.career) {
    const c = careerById(state.career.id);
    state.job = '退休';
    state.career = null;
    pushLog(state, `【退休】你把工牌交了上去。${c ? c.name : ''} 这一行，你干了半辈子。`, 'muted');
  }

  // 收支（未成年：生活与教育费由父母承担，本人不背债、不愁钱）
  if (state.age < 18) {
    const jm = JOBS[state.job] || JOBS[defaultJob(state.age)] || { cost: 1500000 };
    const upkeep = jm.cost || 0;
    const fin = state.family || (state.family = initFamilyFin(state.familyId, state.startYear));
    fin.assets -= upkeep;
    if (fin.assets < 0) { fin.debt += -fin.assets; fin.assets = 0; }
    fin.assets = Math.round(fin.assets * 1.035); // 家庭资产随年代增值
    if (state.age === 17) {
      pushLog(state, `【成年】从明年起，你自己的账要自己背了。家里的账簿：资产 ${fmtMoney(fin.assets)}，负债 ${fmtMoney(fin.debt)}。`, 'muted');
    }
  } else {
    const j = JOBS[state.job] || { salary: 0, cost: 12000000 };
    let income;
    if (state.job === '退休') {
      income = j.salary; // 固定年金，不随工龄膨胀
    } else if (state.career) {
      income = careerIncome(state);
    } else {
      income = Math.round(j.salary * (1 + s.INT / 400) * (1 + s.NET / 800));
    }
    let cost = j.cost;
    if (state.flags.gangnam_owner) cost += 15000000;
    if (state.flags.married) cost += 12000000;
    if (state.childCount) cost += state.childCount * 6000000;
    if (state.job === '大学生') income += 0;
    const net = income - cost;
    s.MONEY += net;
    pushLog(state, `【${fmtYear(state)} 年】${state.job} · 收入 ${fmtMoney(income)}，支出 ${fmtMoney(cost)}，结余 ${net >= 0 ? '+' : ''}${fmtMoney(net)}`, 'money');
  }
  // 声望自然衰减
  if (s.FAME > 0 && state.age > 30 && chance(0.3)) s.FAME -= 1;

  // 净资产峰值
  const w = worthOf(state);
  if (w > (state.peak.NET || 0)) state.peak.NET = w;

  // 学习投入会遗忘：一年不碰书本，之前刷的题就白刷了一半
  if (state.edu && state.age < EXAM_META.gaoAge) {
    state.edu.study = Math.max(0, (state.edu.study || 0) - 3);
  }

  // 晚年自然死亡（健康、心情、年纪共同决定；身体好的人常可活过百岁，但没人能一直活着）
  if (state.age >= 74) {
    const risk = (state.age - 74) * 0.0036
      * (1 + Math.max(0, 60 - s.HP) / 22)
      * (1 + Math.max(0, 50 - (s.MOOD === undefined ? 60 : s.MOOD)) / 60);
    if (chance(risk)) {
      forceEnd(state, {
        id: 'end_elder', rank: 'B', title: '安然离世',
        text: `你在 ${fmtYear(state)} 年 闭上了眼睛。儿孙环绕，窗外是你看了一辈子的那棵树。这一生，值了。`
      });
    }
  }
}

/* ---------- 事件推进 ---------- */
/* 返回下一步要展示的内容对象 */
function step(state) {
  if (state.finished) return { type: 'end' };

  // 1. 队列里还有内容 → 弹出
  if (state.queue && state.queue.length) {
    return state.queue.shift();
  }

  // 2. 新的一年
  if (state.age >= END_AGE) { finish(state); return { type: 'end' }; }
  state.age += 1;
  state.job = state.job || defaultJob(state.age);

  yearBase(state);
  if (state.finished) return { type: 'end' };
  marketTick(state);
  settleInvestments(state);

  const items = [];
  items.push({ type: 'year', age: state.age, year: fmtYear(state) });

  // 升学：15岁中考 / 18岁高考
  const ed = state.edu || (state.edu = { mid: null, gao: null, hs: null, uni: null, eduLevel: 0, study: 0, gradAge: null, major: null, salaryK: 1 });
  if (state.age === EXAM_META.midAge && !ed.hs) items.push(makeExamEvent(state, 'mid'));
  else if (state.age === EXAM_META.gaoAge && !ed.uni) items.push(makeExamEvent(state, 'gao'));

  refreshClassmates(state);
  careerTick(state);
  loveTick(state);
  friendTick(state);
  loanTick(state);

  offerInvestments(state).forEach(o => items.push(o));
  pickEvents(state).forEach(ev => items.push({ type: 'event', ev }));

  state.queue = items;
  parentTick(state); // 父母离世与继承要插到最前面
  if (!state.queue || !state.queue.length) {
    state.queue = [{ type: 'year', age: state.age, year: fmtYear(state) }];
  }
  return state.queue.shift();
}

/* ---------- 升学选择落定 ---------- */
function resolveExam(state, index) {
  const item = state.pending;
  if (!item || item.type !== 'exam') return;
  const opt = item.exam.options[index];
  if (!opt) return;
  applySchool(state, opt.id);
  state.pending = null;
}

/* ---------- 遗产继承 ---------- */
/* 父母离世时生成：全额继承 / 限定继承 / 放弃继承 */
function makeInheritanceEvent(state) {
  const fin = state.family || { assets: 0, debt: 0 };
  const assets = Math.round(fin.assets || 0);
  const debt = Math.round(fin.debt || 0);
  const full = assets - debt; // 遗产与债务一并接下
  const limited = Math.max(0, assets - Math.min(debt, assets)); // 只在遗产范围内还债
  return {
    id: 'inherit_at_' + state.age,
    age: [19, 200],
    w: 0,
    text: `【继承】父母留下的账簿摊在桌上——遗产 ${fmtMoney(assets)}，债务 ${fmtMoney(debt)}。岁：全部接下、只还遗产范围内的、或者什么都不要。`,
    choices: [
      {
        text: ` · 全额继承：遗产与债务一并接下（净 ${fmtMoney(full)}）`,
        risk: 3, eff: { MONEY: full, WILL: 6, STRESS: 12, SEC: -5 }, flags: ['inherit_full']
      },
      {
        text: ` · 限定继承：只还遗产范围内的债（净 ${fmtMoney(limited)}）`,
        risk: 2, eff: { MONEY: limited, WILL: 3, STRESS: 6, FAME: -3 }, flags: ['inherit_limited']
      },
      {
        text: ' · 放弃继承：什么都不要，也什么都不欠',
        risk: 1, eff: { WILL: -4, LOVE: -6, STRESS: -6, SEC: 4 }, flags: ['inherit_none']
      }
    ]
  };
}

function resolveEvent(state, ev, choiceIndex) {
  state.used.push(ev.id);
  const list = eventChoices(state, ev);
  let eff = ev.eff || {};
  let extra = '';
  let ch = null;

  if (list && typeof choiceIndex === 'number' && list[choiceIndex]) {
    ch = list[choiceIndex];
    eff = ch.eff || {};
    applyFlags(state, ch.flags);
    if (ch.pet) {
      state.pet = { type: ch.pet, name: randomPetName(ch.pet), alive: true, since: state.age };
      const t = (ch.pet === 'cat') ? '猫' : '狗';
      pushLog(state, `【领养】你领养了一只${t}，给它取名 ${state.pet.name}。从此多了一个等你回家的生命。`, 'muted');
    }
    extra = ' 【选择 ' + ch.text + '】';
  } else {
    eff = ev.eff || {};
  }
  // 宠物离世
  if ((ev.petDeath || (ch && ch.petDeath)) && state.pet && state.pet.alive) {
    const nm = state.pet.name;
    state.pet.alive = false;
    applyEffects(state, { LOVE: -6, SEC: -4 });
    addGrief(state, `${nm} 走了`, 12);
    pushLog(state, `【永别】陪伴了你多年的 ${nm} 先一步走了。你把它埋在城郊的小山坡，很久没说话。`, 'muted');
  }
  // 慎重处理会错过机会：不触发事件的身份/Flag 变化
  if (!(ch && ch.skipFlags)) {
    if (ev.flags) applyFlags(state, ev.flags);
    if (ev.job) state.job = ev.job;
  }
  if (ch && ch.job) state.job = ch.job;

  applyEffects(state, eff);
  pushLog(state, `[${fmtYear(state)} 年 · ${state.age}岁] ${ev.text}${extra}`, 'story');
  const d = describeEffects(eff);
  if (d.length) pushLog(state, ' → ' + d.join('，'), 'stat');

  // 概率赌注
  if (ch && ch.gamble) {
    const g = ch.gamble;
    const win = chance(g.p);
    const res = win ? (g.win || {}) : (g.lose || {});
    applyEffects(state, res);
    if (win && g.winJob) state.job = g.winJob;
    if (win && g.winFlags) applyFlags(state, g.winFlags);
    if (!win && g.loseFlag) applyFlags(state, [g.loseFlag]);
    // win/lose 对象内联的 flags / job 也要生效（如收购成功接任董事长、赌输丢掉工作）
    if (res.flags) applyFlags(state, res.flags);
    if (res.job) state.job = res.job;
    const rd = describeEffects(res);
    pushLog(state, ` 【${win ? '赌赢了' : '赌输了'} · ${Math.round(g.p * 100)}%】${rd.join('，') || '什么也没发生'}`,
      win ? 'money' : 'warn');
  }

  // 人生关系联动：结婚 / 生子 / 丧亲
  if (state.flags.married && !state.spouseName) {
    state.spouseName = randomSpouseName(state.gender);
    const sp = state.spouseName;
    delete state.flags.dating; // 已成家，结束恋爱阶段
    if (!state.spouse) {
      state.spouse = { name: sp, age: clamp(state.age + randInt(-3, 3), 18, 60), affinity: 65, alive: true, since: state.age, look: randInt(40, 85), tp: 'warm', bg: 'mid' };
    }
    applyEffects(state, { LOVE: 6, SEC: 3 });
    pushLog(state, `【结婚】你与 ${sp} 结为连理。从此，人生不再是你一个人的战场。`, 'muted');
  }
  if ((ev.baby || (ch && ch.baby)) && state.flags.married) {
    state.childCount = (state.childCount || 0) + 1;
    applyEffects(state, { LOVE: 4, GROW: 3 });
    pushLog(state, `【新生命】第 ${state.childCount} 个孩子降生。${state.spouseName || 'TA'} 说：像极了你小时候。`, 'muted');
  }
  if ((ev.grand || (ch && ch.grand)) && state.flags.married && state.childCount > 0) {
    state.grandCount = (state.grandCount || 0) + 1;
    applyEffects(state, { LOVE: 5, GROW: 4 });
    pushLog(state, `【孙辈】你的第 ${state.grandCount} 个孙辈出生了。你抱着那个小家伙，忽然觉得自己这辈子没白活。`, 'muted');
  }
  if (ev.killParents || (ch && ch.killParents)) {
    if (state.flags.parents_alive) {
      state.flags.parents_alive = false;
      if (state.parents) {
        if (state.parents.father) state.parents.father.alive = false;
        if (state.parents.mother) state.parents.mother.alive = false;
      }
      addGrief(state, '父母走了', 22);
      pushLog(state, '【丧亲】父母都已离世。你成了真正意义上的一家之主。', 'muted');
      // 遗产继承：成年则给出三选一，未成年由亲戚处理后事（债务勾销）
      const fin = state.family || (state.family = initFamilyFin(state.familyId, state.startYear));
      if (state.age >= 19) {
        state.queue = state.queue || [];
        state.queue.unshift({ type: 'event', ev: makeInheritanceEvent(state) });
      } else {
        fin.debt = 0;
        pushLog(state, '【继承】你还没成年。亲戚们替你办了后事，债务一笔勾销，遗产由监护人代管。', 'muted');
      }
    }
  }
  // 继承选择落定：家庭账簿结清（钱已进个人口袋，或已放弃）
  if (ev.id && String(ev.id).indexOf('inherit_at_') === 0 && state.family) {
    state.family.debt = 0;
    state.family.assets = 0;
  }
  if ((ev.widow || (ch && ch.widow)) && state.flags.married) {
    if (state.spouse) state.spouse.alive = false;
    addGrief(state, `${state.spouseName || 'TA'} 走了`, 20);
    pushLog(state, `【永别】${state.spouseName || 'TA'} 先你一步走了。余生，你带着两个人的份活着。`, 'muted');
  }

  // 未婚怀孕的三种结局
  if (ev.id && String(ev.id).indexOf('pregnant_at_') === 0) {
    const lv = loveInit(state);
    const l = lv.candidates.find(x => x.name === ev.loverName) || lv.partner;
    if (ch && ch.flags && ch.flags.indexOf('pregnant_keep') >= 0) {
      state.childCount = (state.childCount || 0) + 1;
      if (l) l.pregnant = false;
      pushLog(state, `【生育】孩子出生了。你没有婚礼，只有一张出生证明和一堆学费。`, 'money');
      if (!state.flags.married && l && state.age >= 20 && chance(0.5)) {
        marry(state, l);
      }
    } else if (ch && ch.flags && ch.flags.indexOf('pregnant_marry') >= 0) {
      if (l && !state.flags.married) {
        marry(state, l);
        state.childCount = (state.childCount || 0) + 1;
        pushLog(state, `【奉子成婚】婚礼办得很仓促。亲戚们在背后议论，你们只顾着抱孩子。`, 'money');
      }
    } else if (ch && ch.flags && ch.flags.indexOf('pregnant_drop') >= 0) {
      if (l) { l.pregnant = false; l.affinity = clamp(l.affinity - 15, 0, 100); }
      pushLog(state, `【手术】从医院出来的时候，天已经黑了。你们一路都没有说话。`, 'warn');
    }
  }

  checkDeath(state);
}

function resolveInvest(state, choice) {
  if (choice.act === 'invest') {
    doInvest(state, choice.invId, choice.amount);
  } else {
    const inv = INVESTMENTS.find(i => i.id === choice.invId);
    if (inv) { state.used.push(inv.id); pushLog(state, `【投资】你放过了「${inv.name}」。`, 'muted'); }
  }
}

function checkDeath(state) {
  if (state.stats.HP <= 0 && state.alive) {
    state.alive = false;
    forceEnd(state, {
      id: 'end_dead', rank: 'D', title: '熄灭',
      text: `你在 ${fmtYear(state)} 年 倒下了。医生说是过劳。你最后的念头是：那栋楼，还没画完。`
    });
  }
}

function forceEnd(state, ending) {
  state.finished = true;
  state.alive = false;
  state.ending = ending;
  // 死亡类结局也要有评分/评级，便于结算页与存档保持一致
  state.score = scoreOf(state);
  state.rank = grade(state.score);
  pushLog(state, `【结局】${ending.title} — ${ending.text}`, 'end');
}

/* ---------- 结局 ---------- */
function worthOf(state) {
  return (typeof netWorth === 'function') ? netWorth(state) : state.stats.MONEY;
}

function scoreOf(state) {
  const s = state.stats;
  const worth = worthOf(state);
  let score = 0;
  score += Math.min(38, Math.sqrt(Math.max(0, worth) / 1e8) * 3.2);
  score += Math.min(25, s.FAME * 0.35);
  score += Math.min(15, s.NET * 0.12);
  score += Math.min(10, s.WILL * 0.08);
  score += Math.min(8, s.INT * 0.05);
  score += Math.min(7, s.CHA * 0.05);
  score += Math.min(8, s.LOVE * 0.06);
  score += Math.min(6, s.GROW * 0.06);
  score += Math.min(5, s.SEC * 0.04);
  score += state.flags.took_over ? 15 : 0;
  score += state.flags.exposed ? 8 : 0;
  score += state.flags.gangnam_owner ? 5 : 0;
  score += state.flags.own_house ? 3 : 0;
  score += state.flags.own_car ? 1 : 0;
  score += state.flags.foundation ? 6 : 0;
  score -= state.stats.STRESS > 60 ? 5 : 0;
  if (state.market && state.market.debt > worth * 2 && worth > 0) score -= 6;
  return Math.round(clamp(score, 0, 100));
}

function finish(state) {
  state.alive = false;
  state.finished = true;
  const ending = ENDINGS.find(e => e.cond(state)) || ENDINGS[ENDINGS.length - 1];
  state.ending = ending;
  state.score = scoreOf(state);
  state.rank = grade(state.score);
  pushLog(state, `【${fmtYear(state)} 年 · 人生终章】${ending.title}`, 'end');
  pushLog(state, ending.text, 'end');
}
