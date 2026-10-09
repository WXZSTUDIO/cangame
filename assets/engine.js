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
function elderGiven(gender) {
  // 父母辈用更年长一代的名字
  const old = { M: ['建国', '志强', '国平', '伟民', '建军', '德胜', '长海', '永年'],
                F: ['秀英', '桂芳', '玉兰', '淑珍', '丽华', '春梅', '素芬', '月娥'] };
  const pool = (gender === 'F') ? old.F : old.M;
  return pool[randInt(0, pool.length - 1)];
}
function randomParentName(gender) {
  // 母亲随自己的姓；父亲应当随孩子姓——要生成父亲请用 parentNameFor
  return SURNAMES[randInt(0, SURNAMES.length - 1)] + elderGiven(gender);
}
function parentNameFor(state, gender) {
  // 父亲跟孩子同姓（户口本上写得明明白白）
  if (gender === 'M' && state && state.name) return state.name[0] + elderGiven('M');
  return randomParentName(gender);
}
function randomPetName(type) {
  const dog = ['旺财', '大黄', '豆豆', '可乐', '布丁', '团子', '闪电', '土豆'];
  const cat = ['咪咪', '橘子', '雪球', '芝麻', '汤圆', '年糕', '毛豆', '小花'];
  const pool = (type === 'cat') ? cat : dog;
  return pool[randInt(0, pool.length - 1)];
}

/* ---------- 孩子：有名有姓，随你姓 ---------- */
function addChild(state, opt) {
  opt = opt || {};
  const g = opt.gender || (chance(0.5) ? 'M' : 'F');
  const pool = GIVEN_NAMES[g];
  const sn = (state && state.name) ? state.name[0] : SURNAMES[randInt(0, SURNAMES.length - 1)];
  state.children = state.children || [];
  const c = { name: opt.name || (sn + pool[randInt(0, pool.length - 1)]), gender: g, born: state.age, alive: true };
  state.children.push(c);
  state.childCount = (state.childCount || 0) + 1;
  return c;
}
function childAge(state, c) { return Math.max(0, (state.age || 0) - (c.born || 0)); }

/* ---------- 朋友圈 ---------- */
/* 出生时一个朋友都没有——朋友是活出来的，不是生下来就配好的 */
function makeFriends() { return []; }

/* ---------- 求学 与 工作 互斥 ---------- */
const STUDENT_JOBS = { '小学生': 1, '初中生': 1, '高中生': 1, '大学生': 1, '研究生': 1 };

/* 是否还在学制里（中考/高考/毕业都还没走完） */
function isEnrolled(state) {
  const e = state.edu;
  if (!e || e.stopped) return false;
  if (STUDENT_JOBS[state.job]) return true;
  if (state.age < EXAM_META.midAge) return true;
  if (e.hs && e.hs !== 'hs_none' && !e.uni && state.age < EXAM_META.gaoAge) return true;
  if (e.uni && e.uni !== 'u_fail' && e.gradAge && state.age < e.gradAge) return true;
  return false;
}

/* 在读状态的人话描述 */
function enrolledText(state) {
  if (STUDENT_JOBS[state.job]) return state.job;
  if (state.edu && state.edu.uni && state.edu.uni !== 'u_fail') return '在读大学';
  if (state.edu && state.edu.hs && state.edu.hs !== 'hs_none') return '在读高中';
  return '还在念书';
}

/* 退学去上班：之后不会再有中考 / 高考 */
function dropOut(state, jobName) {
  const e = state.edu || (state.edu = {});
  e.stopped = true;
  e.gradAge = null;
  if (!e.hs) e.hs = 'hs_none';
  if (!e.uni) e.uni = 'u_fail';
  state.flags.dropout = true;
  applyEffects(state, { WILL: 4, STRESS: 8, SEC: -4, CHA: 1 });
  pushLog(state, `【退学】你办了离校手续，不再是学生了。往后的日子里不会再有中考或高考——${jobName ? '你成了' + jobName + '。' : '你得自己找出路了。'}`, 'warn');
}

/* 辞掉工作去读书 */
function quitForSchool(state, schoolName) {
  if (state.career) {
    const c = careerById(state.career.id);
    if (c) pushLog(state, `【离职】你在 ${c.name} 的工牌交了回去。${schoolName ? '为了去' + schoolName + '报到。' : ''}`, 'warn');
  }
  state.career = null;
  state.job = '待业';
  applyEffects(state, { LOY: -6, STRESS: 5, MOOD: 3 });
}

/* 每年按人生阶段认识新朋友：类型必须匹配年龄与身份 */
function friendGrowth(state) {
  if (!state.friends) state.friends = [];
  const alive = state.friends.filter(f => f.alive !== false);
  if (alive.length >= 5) return;
  const has = (k) => state.friends.some(f => f.key === k && f.alive !== false);
  const stage = schoolStageOf(state);
  const candidates = [];
  FRIEND_TYPES.forEach(t => {
    if (state.age < (t.from || 0)) return;
    if (t.to && state.age > t.to) return;
    if (t.needCareer && !state.career) return;
    if (t.key === 'teacher' && !stage) return;      // 恩师只在读书阶段出现
    if (t.key === 'childhood' && state.age > 14) return; // 发小要趁小
    if (has(t.key)) return;
    candidates.push(t);
  });
  if (!candidates.length) return;
  // 朋友不是每年都交得到的
  if (!chance(state.age <= 6 ? 0.25 : 0.35)) return;
  const t = candidates[randInt(0, candidates.length - 1)];
  // 年龄差按关系类型来：恩师永远比你大一辈，同事则上下浮动
  const gp = t.ageGap || [-1, 2];
  const gap = randInt(gp[0], gp[1]);
  const fg = chance(0.5) ? 'F' : 'M';
  const f = {
    key: t.key,
    gender: fg,
    name: randomKoreanName(fg),
    affinity: randInt(12, 30),
    lastTouch: -1,
    age: clamp(state.age + gap, 3, 92),
    since: state.age
  };
  state.friends.push(f);
  pushLog(state, `【新朋友】你认识了 ${f.name}（${t.label}，${f.age} 岁）。${t.line.replace('每年', '以后')}。`, 'muted');
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
    /* 婚姻/恋爱都要经营：idx 0=陪伴 1=约会 2=送礼，好感真的会涨 */
    const married = !!state.flags.married;
    const lv = loveInit(state);
    const l = married ? state.spouse : lv.partner;
    if (married) {
      if (!l || l.alive === false) { delete touch[key]; return { ok: false, msg: 'TA 已经不在了' }; }
    } else if (!l) { delete touch[key]; return { ok: false, msg: '你现在没有恋人' }; }
    const mode = idx === 1 ? 'date' : (idx === 2 ? 'gift' : 'chat');
    let gain = 0, spend = 0;
    if (mode === 'date') {
      const c = Math.round(LOVE_META.dateCost * (married ? 0.7 : 1));
      if (s.MONEY < c) { delete touch[key]; return { ok: false, msg: '钱不够约会' }; }
      s.MONEY -= c; spend = c;
      gain = randInt(9, 14) + Math.round(s.CHA / 16);
      s.LOVE += 4; s.STRESS -= 6; s.MOOD = (s.MOOD || 60) + 4; s.SEC += 2;
    } else if (mode === 'gift') {
      const c = Math.round(LOVE_META.giftCost * (married ? 0.6 : 1));
      if (s.MONEY < c) { delete touch[key]; return { ok: false, msg: '钱不够买礼物' }; }
      s.MONEY -= c; spend = c;
      gain = randInt(12, 17) + Math.round(s.CHA / 14);
      s.LOVE += 4; s.CHA += 1; s.MOOD = (s.MOOD || 60) + 3;
    } else {
      gain = randInt(5, 9) + Math.round(s.CHA / 24);
      s.LOVE += 3; s.STRESS -= 4; s.SEC += 2; s.MOOD = (s.MOOD || 60) + 3;
    }
    touch.spouse = state.age; // 让年度结算知道：今年你经营过这段关系
    l.affinity = clamp((l.affinity || 60) + gain, 0, 100);
    const nm = l.name || state.spouseName || '爱人';
    const tail = spend ? `（花了 ${fmtMoney(spend)}）` : '';
    pushLog(state, married
      ? `【夫妻】你和 ${nm} ${mode === 'date' ? '出去吃了一顿饭，像谈恋爱那会儿' : mode === 'gift' ? '挑了一份礼物，TA 嘴上嫌贵，手却没松开' : '过了一个普通的晚上'}。感情 ${Math.round(l.affinity)}%${tail}。`
      : `【约会】你和 ${nm} ${mode === 'date' ? '去看了一场电影' : mode === 'gift' ? '送了一份礼物' : '聊到很晚'}。好感 ${Math.round(l.affinity)}%${tail}。`, 'muted');
    return { ok: true, affinity: l.affinity };
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
    /* S-01 ③ 去重边界：socialAct 是「维护一段具体关系」，RELAX_ACTS 才是「系统性减压」。
     * 朋友项与 r_friends（老友饭局，−12）功能重叠，故降权为轻量维护：STRESS −2 → −1，
     * 文案也从「聚了聚」改为「发条消息」，明确它不是减压手段。
     * ⚠ spec 原文写的是「−3 → −1」，实测现值是 −2 —— spec 的输入值有误，按意图取 −1。 */
    s.NET += 2; s.LOVE += 2; s.STRESS -= 1;
    const t = FRIEND_TYPES.find(x => x.key === f.key);
    pushLog(state, `【问候】你给 ${f.name}（${t ? t.label : '朋友'}）发了条消息。他回得很快，虽然只聊了几句。`, 'muted');
  } else { delete touch[key]; return { ok: false }; }
  applyEffects(state, {}); // 触发数值夹取
  return { ok: true };
}

/* 一键互动：把今年还没互动过的目标一次性走完（家人/同学/朋友/恋人全覆盖） */
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
    if (n) pushLog(state, `【走动】你和同学（连同还在联系的老同学）都聊了一遍（${n} 位）。`, 'muted');
    return { ok: n > 0, n };
  }
  if (kind === 'family') {
    let n = 0;
    ['father', 'mother', 'spouse', 'child', 'pet'].forEach(k => {
      if (socialAct(state, k).ok) n++;
    });
    if (n) pushLog(state, `【团圆】这一年你把家里人挨个陪了一遍（${n} 位）。`, 'muted');
    return { ok: n > 0, n };
  }
  if (kind === 'lover') {
    let n = 0;
    (loveInit(state).candidates || []).forEach((l, i) => {
      if (!l.alive) return;
      const r = loveAct(state, i, 'chat');   // 一键走一轮聊天（每人每年有 3 次额度）
      if (r.ok) n++;
    });
    if (n) pushLog(state, `【问候】这一年你把在意的人都问候了一遍（${n} 位）。`, 'muted');
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
  n = n || 12;
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
    startDebt: Math.round(base.debt * k),
    income: 0, spend: 0, delta: 0, repaid: 0, interest: 0, act: null, actYear: -1
  };
}

/* 父母的职业：按出身给一个说得通的行当 */
function parentJob(gender, family) {
  const table = (gender === 'F') ? (PARENT_JOBS.F || {}) : (PARENT_JOBS.M || {});
  const fl = (family && family.flags) || [];
  const order = ['prof', 'business', 'stable', 'shop', 'rural', 'town', 'poor', 'city'];
  for (let i = 0; i < order.length; i++) {
    if (fl.indexOf(order[i]) >= 0 && table[order[i]]) return table[order[i]];
  }
  return table.default || '工人';
}

/* 家庭年收入：与出身、家底、父母是否还在上班 / 是否退休挂钩 */
function familyIncome(state) {
  const fin = state.family || { assets: 0 };
  const scale = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, fmtYear(state)) : 1;
  const fam = familyById(state.familyId) || { flags: [] };
  let k = clamp(0.55 + Math.sqrt(Math.max(0, fin.assets || 0) / 220000000) * 0.85, 0.55, 2.4);
  const fl = fam.flags || [];
  if (fl.indexOf('poor') >= 0) k *= 0.72;
  if (fl.indexOf('prof') >= 0) k *= 1.15;
  if (fl.indexOf('business') >= 0) k *= 1.35;
  if (fl.indexOf('stable') >= 0) k *= 1.08;
  if (state.flags.parents_jobless) k *= 0.4;
  const ps = state.parents;
  if (ps) {
    const fOld = !ps.father || !ps.father.alive || ps.father.age >= 60;
    const mOld = !ps.mother || !ps.mother.alive || ps.mother.age >= 55;
    if (fOld && mOld) k *= 0.55;
  }
  return Math.round(12000000 * scale * k);
}

function pickFamilyAct(state) {
  const ps = state.parents || {};
  const hasF = !!(ps.father && ps.father.alive);
  const hasM = !!(ps.mother && ps.mother.alive);
  const pool = FAMILY_ACTS.filter(a => {
    const t = a.text || '';
    if (t.indexOf('父亲') >= 0 && !hasF) return false;
    if (t.indexOf('母亲') >= 0 && !hasM) return false;
    return true;
  });
  const use = pool.length ? pool : FAMILY_ACTS;
  const total = use.reduce((a, b) => a + (b.w || 1), 0);
  let r = Math.random() * total;
  for (let i = 0; i < use.length; i++) { r -= (use[i].w || 1); if (r <= 0) return use[i]; }
  return use[use.length - 1];
}

/* 家庭年度结算：父母也在挣钱、花钱、还债、出事（账簿每年都在动） */
function familyTick(state) {
  const fin = state.family || (state.family = initFamilyFin(state.familyId, state.startYear));
  const ps = state.parents;
  const aliveN = ps ? ['father', 'mother'].filter(k => ps[k] && ps[k].alive).length : 0;
  if (!aliveN) { fin.income = 0; fin.spend = 0; fin.delta = 0; fin.act = null; return null; }
  const scale = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, fmtYear(state)) : 1;
  const aliveK = 0.6 + aliveN * 0.2;
  const income = Math.round(familyIncome(state) * aliveK);
  // 父母的日常开销（未成年时的学费由 yearBase 走家庭账簿，这里不重复计）
  let spend = Math.round(6000000 * scale * aliveK);
  const interest = Math.round((fin.debt || 0) * 0.07);
  let delta = income - spend - interest;
  let repaid = 0;
  if (fin.debt > 0 && delta > 0) {
    repaid = Math.min(fin.debt, Math.round(delta * 0.5));
    fin.debt -= repaid;
    delta -= repaid;
  }
  fin.assets = Math.round((fin.assets || 0) + delta);
  if (fin.assets < 0) { fin.debt = Math.round((fin.debt || 0) - fin.assets); fin.assets = 0; }
  fin.assets = Math.round(fin.assets * 1.03);   // 资产随年代增值
  fin.income = income; fin.spend = spend + interest + repaid;
  fin.delta = delta; fin.repaid = repaid; fin.interest = interest;

  // 这一年家里发生了什么（父母是活的，会做事）
  let act = null;
  if (state.age >= 1 && chance(0.62)) {
    act = pickFamilyAct(state);
    const dA = Math.round((act.fin.assets || 0) * scale);
    const dD = Math.round((act.fin.debt || 0) * scale);
    fin.assets += dA;
    if (fin.assets < 0) { fin.debt = Math.round((fin.debt || 0) - fin.assets); fin.assets = 0; }
    fin.debt = Math.max(0, Math.round((fin.debt || 0) + dD));
    if (act.flag) state.flags[act.flag] = true;
    const eff = {};
    for (const kk in (act.stat || {})) {
      let v = act.stat[kk];
      if (kk === 'MONEY') v = Math.round(v * scale);
      eff[kk] = v;
    }
    applyEffects(state, eff);
    pushLog(state, `【家里】${act.text}`, 'fam');
    fin.act = { id: act.id, text: act.text };
    fin.actYear = state.age;
  }
  if (state.age % 5 === 0 || fin.delta < -15000000) {
    pushLog(state, `【家里的账】${fmtYear(state)} 年：收入 ${fmtMoney(income)}，支出 ${fmtMoney(spend)}` +
      `${interest ? `，利息 ${fmtMoney(interest)}` : ''}${repaid ? `，还债 ${fmtMoney(repaid)}` : ''}` +
      ` → 资产 ${fmtMoney(fin.assets)}，负债 ${fmtMoney(fin.debt)}。`, 'fam');
  }
  // 家里撑不住了：会开口找你要钱（成年后，且不会年年要）
  if (state.age >= 18 && (fin.debt || 0) > 40000000 && (fin.debt || 0) > (fin.assets || 0) * 1.5
      && state.stats.MONEY > 8000000 && (state.famAskYear || 0) + 4 <= state.age && chance(0.4)) {
    state.famAskYear = state.age;
    state.extraQueue = state.extraQueue || [];
    state.extraQueue.push({ type: 'event', ev: makeFamilyAskEvent(state) });
  }
  return { income, spend, delta, act };
}

function makeFamilyAskEvent(state) {
  const fin = state.family || { debt: 0, assets: 0 };
  const need = Math.max(3000000, Math.round((fin.debt || 0) * 0.25));
  const scale = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, fmtYear(state)) : 1;
  const amt = Math.round(need * scale * 0.2);
  return {
    id: 'famask_at_' + state.age,
    age: [18, 200], w: 0,
    askAmt: amt,
    text: `【家里开口】母亲在电话里绕了很久，最后才说出来：家里还欠着 ${fmtMoney(fin.debt)}，这个月过不去了。\n` +
      `你握着手机，想起很多年前她往你包里塞钱的那个下午。`,
    choices: [
      { text: `把 ${fmtMoney(amt * 3)} 打回去`, risk: 2, eff: { MONEY: -amt * 3, LOVE: 8, SEC: 4, STRESS: -3, ETH: 2 }, flags: ['helped_family'] },
      { text: `先寄 ${fmtMoney(amt)}，剩下的再说`, risk: 2, eff: { MONEY: -amt, LOVE: 3, SEC: 1, STRESS: 2 } },
      { text: '说自己也不容易，挂了电话', risk: 3, eff: { LOVE: -10, SEC: -5, STRESS: 8, ETH: -6, MOOD: -6 } }
    ]
  };
}

function createGame(opt) {
  const family = familyById(opt.familyId) || FAMILIES[0];
  const startYear = opt.startYear || randInt(1955, 2005);
  const isOrphan = family.id === 'fuli';
  const isSingle = family.id === 'danqin';
  const pname = opt.name || randomPersonName(opt.gender || 'M'); // 先把名字定下来：父亲要跟你同姓
  const parents = isOrphan ? null : {
    father: isSingle ? null : {
      name: parentNameFor({ name: pname }, 'M'), alive: true, affinity: randInt(42, 68),
      age: randInt(25, 38), bond: '父', job: parentJob('M', family), hp: randInt(72, 96)
    },
    mother: {
      name: randomParentName('F'), alive: true, affinity: randInt(52, 76),
      age: randInt(23, 36), bond: '母', job: parentJob('F', family), hp: randInt(72, 96)
    }
  };
  const state = {
    v: SAVE_VERSION,
    seed: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: pname,
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
    pets: [],
    horse: null,
    prison: 0,
    clubs: [],
    retirePlan: null,
    profYear: 0,
    bookYear: 0,
    medGeneYear: 0,
    medOrganYear: 0,
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
    ill: null,
    achievements: [],
    famAskYear: 0,
    lotteryYear: -1,
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
  /* ---- IMP-01 · R-01：这两个字段被漏兜，缺了会在渲染第一行就抛 TypeError ----
   * log   缺 → `log.map` of undefined（推流渲染第一行）
   * flags 缺 → `flags.past_life` of undefined（出身/前世判定）
   * 必须放在最前面：下面第 600 行起就有 `state.flags.orphan` 在用 flags。
   * 默认值照 mkState() 的形状给，不要拍脑袋填。 */
  if (!Array.isArray(state.log)) state.log = [];
  if (!Array.isArray(state.queue)) state.queue = [];
  if (!state.flags || typeof state.flags !== 'object') state.flags = { parents_alive: true };
  if (state.flags.parents_alive === undefined) state.flags.parents_alive = true;
  /* ---- v6.0：宠物数组 / 监狱 / 遗嘱 / 市场情绪兜底 ---- */
  if (!Array.isArray(state.pets)) {
    state.pets = (state.pet && state.pet.alive) ? [state.pet] : [];
  }
  if (state.pets.length && !state.pet) state.pet = state.pets[0];
  if (state.prison === undefined) state.prison = 0;
  if (state.horse === undefined) state.horse = null;
  if (state.market && state.market.newsBias === undefined) { state.market.newsBias = 0; state.market.houseBias = 0; }
  /* ---- v6.1：圈层 / 养老 / 银发经济兜底 ---- */
  if (state.clubs == null) state.clubs = [];
  if (state.retirePlan === undefined) state.retirePlan = null;
  if (state.profYear === undefined) state.profYear = 0;
  if (state.bookYear === undefined) state.bookYear = 0;
  // v6.2.1：旧存档没有关系阶段字段——现任补 dating，其余按好感补
  if (state.love && state.love.candidates) {
    state.love.candidates.forEach(l => {
      if (!l || l.stage !== undefined) return;
      l.stage = (state.love.partner === l && state.flags.dating) ? 'dating'
        : ((l.affinity || 0) >= LOVE_META.closeAffinity ? 'close' : 'met');
    });
  }
  if (state.medGeneYear === undefined) state.medGeneYear = 0;
  if (state.medOrganYear === undefined) state.medOrganYear = 0;
  if (state.market && state.market.techK === undefined) state.market.techK = 0;
  if (!state.edu) {
    state.edu = { mid: null, gao: null, hs: null, uni: null, eduLevel: 0, study: 0, gradAge: null, major: null, salaryK: 1 };
  }
  if (state.edu.eduLevel == null) state.edu.eduLevel = 0;
  if (!state.parents && !state.flags.orphan) {
    const single = !!state.flags.single;
    state.parents = {
      father: single ? null : { name: parentNameFor(state, 'M'), alive: !!state.flags.parents_alive, affinity: 55, age: clamp(state.age + randInt(24, 34), 30, 70), bond: '父' },
      mother: { name: randomParentName('F'), alive: !!state.flags.parents_alive, affinity: 62, age: clamp(state.age + randInt(22, 30), 28, 68), bond: '母' }
    };
  }
  // v5.4：专业名改过一批，老存档自动换到新名
  if (state.edu && state.edu.major && MAJOR_LEGACY[state.edu.major]) {
    state.edu.major = MAJOR_LEGACY[state.edu.major];
  }
  if (!state.love) state.love = { candidates: [], partner: null, met: [] };
  if (state.goodTouch == null) state.goodTouch = {};
  // v6.0 S-01 ③：减压行动的年度额度。老存档没有这个字段 → 视为今年没用过
  if (state.relaxUsedYear == null) state.relaxUsedYear = 0;
  // v5.5：孩子要有名字（老存档只记了数量，按现有年龄倒推补齐）
  if (state.children == null) state.children = [];
  if ((state.childCount || 0) > state.children.length) {
    for (let i = state.children.length; i < state.childCount; i++) {
      const g = chance(0.5) ? 'M' : 'F';
      const pool = GIVEN_NAMES[g];
      state.children.push({
        name: (state.name ? state.name[0] : SURNAMES[0]) + pool[randInt(0, pool.length - 1)],
        gender: g, born: Math.max(1, (state.age || 20) - (state.childCount - i) * 3), alive: true, guess: true
      });
    }
  }
  // v5.5：前任改成列表（离过婚的标记为前配偶——能联系，感情够了还能复婚）
  if (state.exes == null) {
    state.exes = [];
    if (state.ex) {
      state.exes.push(Object.assign(
        { wasSpouse: true, gender: state.gender === 'M' ? 'F' : 'M', affinity: 42, lastTouch: -1, look: 60 },
        state.ex
      ));
      delete state.ex;
    }
  }
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
  if (state.ill === undefined) state.ill = null;
  if (!state.achievements) state.achievements = [];
  if (state.famAskYear == null) state.famAskYear = 0;
  if (state.lotteryYear == null) state.lotteryYear = -1;
  if (state.family) {
    const f = state.family;
    if (f.income == null) f.income = 0;
    if (f.spend == null) f.spend = 0;
    if (f.delta == null) f.delta = 0;
    if (f.repaid == null) f.repaid = 0;
    if (f.interest == null) f.interest = 0;
    if (f.act === undefined) f.act = null;
    if (f.actYear == null) f.actYear = -1;
  }
  // 父母补上职业与健康（老存档没有这两个字段）
  if (state.parents) {
    const fam = familyById(state.familyId) || { flags: [] };
    ['father', 'mother'].forEach(k => {
      const p = state.parents[k];
      if (!p) return;
      if (!p.job) p.job = parentJob(k === 'father' ? 'M' : 'F', fam);
      if (p.hp == null) p.hp = clamp(90 - Math.max(0, (p.age || 40) - 35), 25, 100);
    });
  }
  return state;
}

/* ---------- 疾病：健康过低会强制生病，不治会一路恶化到死亡 ---------- */
function illStageCn(n) {
  return ['', '初期', '中期', '重度', '危重'][clamp(n, 0, 4)] || '初期';
}

function illnessRisk(state) {
  const s = state.stats;
  let p;
  if (s.HP < 25) p = 0.28;
  else if (s.HP < 40) p = 0.15;
  else if (s.HP < 55) p = 0.055;
  else if (s.HP < 70) p = 0.018;
  else p = 0.007;
  p *= 1 + Math.max(0, s.STRESS - 50) / 90;
  p *= 1 + Math.max(0, state.age - 55) / 90;
  if (state.flags.smoke || state.flags.drink) p *= 1.15;
  return clamp(p, 0.005, 0.6);
}

function illTreatCost(state, ref, stage, level) {
  const scale = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, fmtYear(state)) : 1;
  const base = (ref.sev || 1) * 6000000 * scale;
  return Math.round(base * (1 + (stage - 1) * 0.55) * (level === 'hospital' ? 2.6 : 1));
}

function makeIllnessEvent(state, ref) {
  if (!ref) ref = (typeof ILLNESS !== 'undefined' && ILLNESS.length) ? ILLNESS[0] : { id: 'cold', name: '感冒', sev: 1, desc: '发热、咳嗽。', chronic: false };
  const ill = state.ill || { stage: 1 };
  const c1 = illTreatCost(state, ref, ill.stage, 'clinic');
  const c2 = illTreatCost(state, ref, ill.stage, 'hospital');
  return {
    id: 'ill_at_' + state.age + '_' + ref.id,
    age: [1, 200], w: 0,
    illId: ref.id,
    text: `【生病 · ${ref.name}】${ref.desc}\n医生的话很平静：现在是${illStageCn(ill.stage)}，` +
      `治要花钱，扛会拖。拖到最重的时候，钱也不一定买得回来。`,
    choices: [
      {
        text: '硬扛：不去医院，过阵子就好了',
        risk: 3, eff: { HP: -(3 + (ref.sev || 1) * 2), STRESS: 6, WILL: 2 },
        flags: ['ill_ignore'], illAct: 'ignore'
      },
      {
        text: `去诊所拿药 · ${fmtMoney(c1)}`,
        risk: 2, eff: { MONEY: -c1, STRESS: -2 }, illAct: 'clinic', illCost: c1
      },
      {
        text: `住院治疗 · ${fmtMoney(c2)}`,
        risk: 1, eff: { MONEY: -c2, STRESS: -6, HP: 4 }, illAct: 'hospital', illCost: c2
      }
    ]
  };
}

/* 主动就医（工作页 / 人际页的按钮也走这里） */
function treatIllness(state, level) {
  if (!state.ill) return { ok: false, msg: '你没病' };
  const ref = ILLNESS.find(x => x.id === state.ill.id) || ILLNESS[0];
  const cost = illTreatCost(state, ref, state.ill.stage, level);
  if (state.stats.MONEY < cost) return { ok: false, msg: `钱不够（需要 ${fmtMoney(cost)}）` };
  state.stats.MONEY -= cost;
  const p = cureChance(state.ill.stage, ref, level);
  if (chance(p)) {
    const st = state.ill.stage;
    state.ill = null;
    if (st >= 3) state.flags.ill_survived = true;
    applyEffects(state, { HP: 10 + (level === 'hospital' ? 8 : 0), STRESS: -5, MOOD: 3 });
    pushLog(state, `【就医】${ref.name} 治好了，花了 ${fmtMoney(cost)}。走出医院时你觉得阳光有点刺眼。`, 'money');
    return { ok: true, cured: true, cost };
  }
  state.ill.stage = clamp(state.ill.stage, 1, 4);
  applyEffects(state, { HP: 4, STRESS: -2 });
  pushLog(state, `【就医】${ref.name} 还没好透，花了 ${fmtMoney(cost)}。医生说：再来一个疗程。`, 'warn');
  return { ok: true, cured: false, cost };
}

function cureChance(stage, ref, level) {
  const sev = (ref && ref.sev) || 1;
  const chronic = ref && ref.chronic;
  let p = (level === 'hospital')
    ? 0.97 - (stage - 1) * 0.08 - (sev - 1) * 0.05
    : 0.92 - (stage - 1) * 0.14 - (sev - 1) * 0.08;
  if (chronic) p -= 0.12;
  return clamp(p, 0.12, 0.97);
}

function illnessTick(state) {
  if (state.finished || !state.alive) return null;
  const s = state.stats;
  if (state.ill) {
    const ill = state.ill;
    const ref = ILLNESS.find(x => x.id === ill.id) || ILLNESS[0];
    ill.years = (ill.years || 0) + 1;
    // 身体底子还行、又不是慢性病时，也有可能自己好转
    if (!ill.chronic && ill.stage <= 2 && s.HP >= 52 && chance(0.3)) {
      ill.stage -= 1;
      if (ill.stage <= 0) {
        state.ill = null;
        applyEffects(state, { HP: 5, MOOD: 2 });
        pushLog(state, `【好转】${ref.name} 慢慢好了。你这才想起来，自己已经很久没病过了。`, 'money');
        return null;
      }
    } else if (ill.stage < 4 && (ill.chronic || chance(0.42))) {
      ill.stage += 1;
    }
    const drain = Math.round(((ref.hp || 5) + ill.stage * 2) * 0.6);
    s.HP -= drain;
    applyEffects(state, {});
    pushLog(state, `【病】${ref.name} · 第 ${ill.years} 年 · ${illStageCn(ill.stage)}。健康 -${drain}。` +
      (ill.stage >= 3 ? '再这么拖下去，就真的来不及了。' : ''), 'warn');
    // 只有拖到危重、身体又真的撑不住时才会要命
    if (ill.stage >= 4 && s.HP < 45) {
      const p = clamp(0.15 + Math.max(0, 40 - s.HP) / 60, 0.12, 0.6);
      if (chance(p)) {
        // 走 ENDINGS 正式判定，病名与病程作为死因的补充信息传进去
        endBy(state, 'end_ill', { illness: ref.name, years: ill.years });
        return ill;
      }
    }
    if (s.HP <= 0) checkDeath(state);
    return ill;
  }
  if (chance(illnessRisk(state))) {
    const pool = ILLNESS.filter(x => state.age >= x.minAge);
    const ref = pool[randInt(0, pool.length - 1)] || ILLNESS[0];
    state.ill = { id: ref.id, name: ref.name, stage: 1, since: state.age, years: 0, chronic: !!ref.chronic };
    state.extraQueue = state.extraQueue || [];
    state.extraQueue.push({ type: 'event', ev: makeIllnessEvent(state, ref) });
    return state.ill;
  }
  return null;
}

/* ---------- 成就：达成即时弹徽章 ---------- */
function checkAchievements(state) {
  if (!state.achievements) state.achievements = [];
  let got = null;
  (typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS : []).forEach(a => {
    if (state.achievements.indexOf(a.id) >= 0) return;
    let hit = false;
    try { hit = !!(a.cond && a.cond(state)); } catch (e) { hit = false; }
    if (hit) {
      state.achievements.push(a.id);
      pushLog(state, `【成就】${a.icon} ${a.name} — ${a.desc}`, 'money');
      if (!got) got = a;
    }
  });
  return got;
}

/* ---------- 彩票：一年一张，纯运气 ---------- */
function buyLottery(state) {
  const scale = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, fmtYear(state)) : 1;
  const cost = Math.round(LOTTERY.cost * scale);
  if (state.lotteryYear === state.age) return { ok: false, msg: '今年已经买过了' };
  if (state.stats.MONEY < cost) return { ok: false, msg: '连张彩票都买不起' };
  state.stats.MONEY -= cost;
  state.lotteryYear = state.age;
  let r = Math.random(), prize = LOTTERY.prizes[LOTTERY.prizes.length - 1];
  for (let i = 0; i < LOTTERY.prizes.length; i++) {
    r -= LOTTERY.prizes[i].p;
    if (r <= 0) { prize = LOTTERY.prizes[i]; break; }
  }
  const win = Math.round(cost * prize.k);
  if (win > 0) {
    state.stats.MONEY += win;
    if (prize.jackpot) state.flags.lottery_jackpot = true;
    pushLog(state, `【彩票】${prize.name}！花了 ${fmtMoney(cost)}，到手 ${fmtMoney(win)}。` +
      (prize.jackpot ? '彩票站的老板盯着你看了一整分钟。' : ''), 'money');
  } else {
    pushLog(state, `【彩票】谢谢参与。${fmtMoney(cost)} 换了一张废纸。`, 'muted');
  }
  applyEffects(state, {});
  return { ok: true, win: win, name: prize.name };
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
  // v6.0：新闻/事件的市场情绪（newsK→股市、houseK→楼市），由 marketTick 消费后清零
  if (eff.newsK && state.market) state.market.newsBias = clamp((state.market.newsBias || 0) + eff.newsK, -0.55, 0.80);
  if (eff.houseK && state.market) state.market.houseBias = clamp((state.market.houseBias || 0) + eff.houseK, -0.55, 0.60);
  // v6.1：科技浪潮情绪（techK→半导体/AI/通信/新能源板块）
  if (eff.techK && state.market) state.market.techK = clamp((state.market.techK || 0) + eff.techK, -0.65, 1.20);
  // 事件效果里带的职称（eff.job）统一走 setJob()，孤儿职称会被映射回阶梯
  if (eff.job) setJob(state, eff.job);
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
/* 顺序即优先级：越靠前越先判定（避免「酒」把职场局判成健康问题） */
const TAG_KEYWORDS = [
  ['study', ['考试', '成绩', '老师', '上课', '自习', '笔记', '复习', '作业', '补习', '图书馆', '年级', '班里', '读书', '课本', '保研', '考研', '绩点', '招生']],
  ['work', ['公司', '上司', '同事', '加班', '项目', '职场', '部门', '领导', '客户', '甲方', '绩效', '裁员', '汇报', '会议',
            '招聘', '面试', '入职', '简历', 'offer', '工资', '月薪', '年终', '跳槽', '公务员', '编制', '工位', '上班', '进修', '职称']],
  ['money', ['钱', '投资', '股票', '房价', '买房', '贷款', '欠债', '融资', '生意', '股价', '收入', '存款', '比特币', '基金',
             '首付', '房租', '理财', '涨停', '分红', '开业', '成本']],
  ['love', ['喜欢', '心动', '表白', '恋爱', '牵手', '暗恋', '分手', '结婚', '相亲', '约会', '好感', '恋人', '追求',
            '女友', '男友', '婚礼', '怀孕', '求婚', '备孕']],
  ['health', ['医院', '生病', '体检', '身体', '发烧', '失眠', '过劳', '跑步', '锻炼', '住院', '抑郁', '病房', '手术',
              '养生', '戒酒', '戒烟', '受伤', '康复', '熬']],
  ['family', ['父亲', '母亲', '爸爸', '妈妈', '家里', '父母', '家人', '孩子', '女儿', '儿子', '祖父母', '亲人', '爷爷', '奶奶', '老家', '年夜饭']],
  ['social', ['朋友', '聚会', '饭局', '人脉', '认识', '饭桌', '应酬', '帮忙', '搭话', '圈子', '邻居', '同学', '老乡']],
  ['moral', ['回扣', '好处', '规矩', '举报', '造假', '走后门', '灰色', '行贿', '底线', '良心', '偷', '骗', '虚报']]
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
    let tag = inferEventTag(state, ev);
    /* v6.2.2 未成年重映射：学生没有上级与股票——work 回到课堂，money 归入中性叙事 */
    if (state.age < 18) {
      if (tag === 'work') tag = 'study';
      if (tag === 'money') tag = 'default';
    }
    const pool = (state.age < 18 && typeof CHOICE_TEMPLATES_MINOR !== 'undefined')
      ? (CHOICE_TEMPLATES_MINOR[tag] || CHOICE_TEMPLATES_MINOR.default)
      : (CHOICE_TEMPLATES[tag] || CHOICE_TEMPLATES.default);
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
  const risk3 = Object.assign(scaleEff(base, RISK_TUNE.GAIN_K, RISK_TUNE.LOSS_K),
    { STRESS: (base.STRESS || 0) + RISK_TUNE.STRESS_ADD });
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
  /* 监狱系统：服刑期间只走监狱事件池，外面的世界暂停 */
  if (state.prison > 0) {
    const pool = EVENTS.filter(ev => ev.id.indexOf('pr_') === 0 && matchEvent(state, ev));
    if (!pool.length) return [];
    return [pool[randInt(0, pool.length - 1)]];
  }
  const pool = EVENTS.filter(ev => matchEvent(state, ev));
  if (!pool.length) return [];
  const lucky = !!state.flags.lucky;
  const weighted = [];
  pool.forEach(ev => {
    let w = ev.w || 5;
    if (lucky) w *= 1.35;
    if (ev.fest) w *= 2.6;               // 节日主题：节日期间高频出现
    // 年龄段高频池：老年偏健康/家庭、青年偏职场/恋爱（按事件标签粗调）
    if (state.age >= 60 && ev.elderly) w *= 2.2;
    if (state.age <= 30 && ev.youth) w *= 1.6;
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
  // 节日事件：每年最多一个，60% 概率出现（fest 池本身权重已加成）
  const fests = weighted.filter(x => x.ev.fest);
  if (fests.length && chance(0.6)) {
    const f = fests[randInt(0, fests.length - 1)].ev;
    picked.push(f);
    weighted.splice(weighted.findIndex(x => x.ev === f), 1);
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
  friendGrowth(state); // 按人生阶段认识新朋友
  // 同学也在长大：十年后再见，他们也不再是教室里的那张脸
  (state.classmates || []).forEach(c => { c.age = (c.age || state.age) + 1; });
  (state.friends || []).forEach(f => {
    if (f.alive === false) return;
    f.age = (f.age || state.age) + 1;
    if (state.age >= 55 && chance(0.004 + Math.max(0, state.age - 60) * 0.0016)) {
      f.alive = false;
      const t = FRIEND_TYPES.find(x => x.key === f.key);
      addGrief(state, `老友 ${f.name} 走了`, 14);
      pushLog(state, `【永别】${f.name}（${t ? t.label : '朋友'}）走了。葬礼上你想起很多年前的那个夏天。`, 'warn');
    }
  });
}

/* =========================================================
 * 主动互动：不是你单方面去敲门，他们也会来找你
 * 父母 / 配偶 / 恋人 / 朋友 / 同学 —— 每年可能有人主动发起一次
 * ========================================================= */
const INBOUND_LINES = {
  parents: [
    '周末回不回来？我炖了汤，凉了就不好喝了。',
    '你爸这两天血压有点高，你抽空打个电话给他。',
    '钱够不够用？家里不用你操心，你自己别省着。',
    '院子里的月季开了，你要是回来，还能赶上看一眼。',
    '你张阿姨问起你了，我说你在外头挺好的。'
  ],
  spouse: [
    '我订了你爱吃的那家，七点。你能不能准时？',
    '孩子一直在问，爸爸/妈妈什么时候回来。',
    '我们多久没一起出门了？就这个周末。',
    '你今天回来吃饭吗？我多做一份。'
  ],
  lover: [
    '周末有空吗？我想见你。',
    '我路过你公司楼下，要不要一起吃个饭。',
    '那家新开的店，你不是说想去吗。'
  ],
  friend: [
    '出来喝一杯，老地方。就我们几个。',
    '好久没见了，聚一下？',
    '我这边出了点事，能跟你说说话吗。'
  ],
  classmate: [
    '班长在群里喊了：毕业这些年，聚一次吧。',
    '我结婚，你来不来？',
    '翻到咱们班那张合照了，突然想找你聊聊。'
  ]
};

function inboundPick(state) {
  const list = [];
  const ps = state.parents;
  if (ps && ((ps.father && ps.father.alive) || (ps.mother && ps.mother.alive)) && state.age >= 7) list.push('parents');
  if (state.flags.married && state.spouse && state.spouse.alive !== false) list.push('spouse');
  const cands = (state.love && state.love.candidates || []).filter(l => l.alive !== false);
  if (cands.length) list.push('lover');
  if ((state.friends || []).some(f => f.alive !== false)) list.push('friend');
  if (state.age >= 14 && (state.classmates || []).length) list.push('classmate');
  return list;
}

function inboundTarget(state, kind) {
  if (kind === 'parents') {
    const ps = state.parents || {};
    const alive = [ps.mother, ps.father].filter(p => p && p.alive);
    return alive.length ? alive[randInt(0, alive.length - 1)] : null;
  }
  if (kind === 'spouse') return state.spouse;
  if (kind === 'lover') {
    const c = (state.love && state.love.candidates || []).filter(l => l.alive !== false);
    return c.length ? c[randInt(0, c.length - 1)] : null;
  }
  if (kind === 'friend') {
    const f = (state.friends || []).filter(x => x.alive !== false);
    return f.length ? f[randInt(0, f.length - 1)] : null;
  }
  if (kind === 'classmate') {
    const c = state.classmates || [];
    return c.length ? c[randInt(0, c.length - 1)] : null;
  }
  return null;
}

function makeInboundEvent(state, kind) {
  const p = inboundTarget(state, kind);
  if (!p) return null;
  const lines = INBOUND_LINES[kind] || ['有空吗？'];
  const line = lines[randInt(0, lines.length - 1)];
  const who = p.name || 'TA';
  const ib = { kind: kind, name: who };
  const head = kind === 'parents' ? `【${who} 的电话】`
    : kind === 'spouse' ? `【${who} 的消息】`
      : kind === 'lover' ? `【${who} 找你】`
        : kind === 'friend' ? `【${who} 的邀约】` : `【来自 ${who}】`;
  const tip = kind === 'parents' ? '手机在桌上震了很久。'
    : kind === 'spouse' ? '屏幕亮了，是家里发来的。'
      : kind === 'lover' ? '对话框弹出来的时候，你愣了一下。'
        : kind === 'friend' ? '微信群里跳出一条 @ 你的消息。' : '群里忽然热闹起来了。';
  const text = `${head}${tip}\n「${line}」`;

  let choices;
  if (kind === 'parents') {
    choices = [
      { text: '回去，陪他们吃顿饭', risk: 1, ibGain: 7, eff: { LOVE: 6, SEC: 5, MOOD: 4, STRESS: -5, MONEY: -800000 } },
      { text: '回个电话，寄点钱回去', risk: 1, ibGain: 3, eff: { LOVE: 2, SEC: 2, MONEY: -3000000 } },
      { text: '说加班，下次一定', risk: 2, ibGain: -6, eff: { LOVE: -4, STRESS: 3, LOY: 3 } }
    ];
  } else if (kind === 'spouse') {
    choices = [
      { text: '推掉应酬，回家', risk: 1, ibGain: 8, eff: { LOVE: 6, SEC: 4, MOOD: 4, STRESS: -4, MONEY: -1200000 } },
      { text: '加班，这几年都这样', risk: 2, ibGain: -5, eff: { LOY: 4, LOVE: -5, STRESS: 5 } },
      { text: '带 TA 出去，把周末还给你们', risk: 1, ibGain: 12, eff: { LOVE: 9, SEC: 5, MOOD: 6, MONEY: -5000000 } }
    ];
  } else if (kind === 'lover') {
    choices = [
      { text: '去，把时间空出来', risk: 1, ibGain: 10, eff: { LOVE: 6, CHA: 1, MOOD: 3, MONEY: -1500000 } },
      { text: '改天吧，最近有点忙', risk: 2, ibGain: -3, eff: { LOVE: -2, STRESS: 2 } },
      { text: '现在就把话说清楚', risk: 3, ibGain: -10, eff: { LOVE: -6, WILL: 3, STRESS: 6 } }
    ];
  } else if (kind === 'friend') {
    choices = [
      { text: '去，老地方见', risk: 1, ibGain: 7, eff: { NET: 4, LOVE: 3, STRESS: -5, MONEY: -1200000, HP: -2 } },
      { text: '推了，最近不太想出门', risk: 2, ibGain: -4, eff: { LOVE: -2, MOOD: -2 } },
      { text: '去了，但提前走', risk: 1, ibGain: 2, eff: { NET: 2, STRESS: -2, MONEY: -500000 } }
    ];
  } else {
    choices = [
      { text: '去，看看他们都变成什么样了', risk: 2, ibGain: 8, eff: { NET: 6, CHA: 2, LOVE: 3, MONEY: -2500000, STRESS: -3 } },
      { text: '不去，各有各的生活', risk: 1, ibGain: -3, eff: { MOOD: -1, SEC: 1 } },
      { text: '只跟几个还聊得来的聚', risk: 1, ibGain: 4, eff: { NET: 3, LOVE: 2, MONEY: -1000000 } }
    ];
  }
  return {
    id: 'inb_' + kind + '_' + state.age,
    age: [7, 200], w: 0,
    ib: ib,
    text: text,
    choices: choices.map(c => Object.assign({}, c, { ibGain: c.ibGain }))
  };
}

/* 主动互动的结果要落到「那个人」身上，而不是只改你的属性 */
function applyInbound(state, ib, gain) {
  if (!ib || !gain) return;
  let p = null;
  if (ib.kind === 'parents') {
    const ps = state.parents || {};
    p = [ps.father, ps.mother].filter(x => x && x.alive).find(x => x.name === ib.name) || null;
  } else if (ib.kind === 'spouse') {
    p = state.spouse && state.spouse.name === ib.name ? state.spouse : state.spouse;
  } else if (ib.kind === 'lover') {
    const c = (state.love && state.love.candidates) || [];
    p = c.find(x => x.name === ib.name) || null;
  } else if (ib.kind === 'friend') {
    p = (state.friends || []).find(x => x.name === ib.name) || null;
  } else if (ib.kind === 'classmate') {
    p = (state.classmates || []).find(x => x.name === ib.name) || null;
  }
  if (!p) return;
  p.affinity = clamp((p.affinity || 40) + gain, 0, 100);
  if (ib.kind === 'spouse') {
    const touch = state.socialTouch = state.socialTouch || {};
    touch.spouse = state.age; // 回应了配偶的主动，也算经营过
  }
}

/* ---------- 主动做件好事：道德是能攒回来的 ---------- */
function doGoodDeed(state, id) {
  const d = GOOD_DEEDS.find(x => x.id === id);
  if (!d) return { ok: false, msg: '没有这件事' };
  if (state.age < (d.minAge || 0)) return { ok: false, msg: `${d.minAge} 岁以后才做得到` };
  const touch = state.goodTouch = state.goodTouch || {};
  if (touch[id] === state.age) return { ok: false, msg: '今年做过了' };
  const cost = d.cost || 0;
  if (cost && state.stats.MONEY < cost) return { ok: false, msg: '钱不够' };
  if (cost) state.stats.MONEY -= cost;
  touch[id] = state.age;
  applyEffects(state, d.eff);
  pushLog(state, `【善事】${d.name}。${d.desc}${cost ? `（花了 ${fmtMoney(cost)}）` : ''}`, 'money');
  return { ok: true, name: d.name };
}

/* ---------- 主动减压：压力必须有出口，否则「棘轮」这个比喻就成真了（S-01 ③） ----------
 *
 * 与 doGoodDeed 的关键差别：**三条共享一个年度额度**（relaxUsedYear），
 * 而善事是「每件各一次」（goodTouch）。理由是若各一次，理论年减压 −38，
 * 叠加恢复公式会把 STRESS 打到 0，压力系统直接失去意义；共享额度下理论最优 −16，
 * 且玩家必须在「社交 / 身体 / 专业帮助」之间做选择 —— 这个选择本身就是设计内容。
 *
 * ⚠ 年度额度用 `relaxUsedYear === state.age` 判定，**不需要在 yearBase 里重置**。
 *   这与 inboundYear / socialTouch / goodTouch 的既有写法一致：年龄每 +1 自动失效。
 *   （spec 落地清单写的是「每年重置为 0」，那是等价的另一种写法；我取与代码库一致的那种，
 *     少一处状态维护就少一处漏改。）
 */

/* 取当前年龄下生效的分支：r_court 55 岁起切成公园太极/广场舞，且免费 */
function relaxBranch(r, age) {
  if (r.lateAge != null && age >= r.lateAge) {
    return {
      desc: r.descLate || r.desc,
      eff: r.lateEff || r.eff,
      cost: r.lateCost != null ? r.lateCost : (r.cost || 0)
    };
  }
  return { desc: r.desc, eff: r.eff, cost: r.cost || 0 };
}

function doRelaxAct(state, id) {
  const r = RELAX_ACTS.find(x => x.id === id);
  if (!r) return { ok: false, msg: '没有这件事' };
  if (state.finished || state.alive === false) return { ok: false, msg: '这一世已经结束了' };
  if (state.age < (r.minAge || 0)) return { ok: false, msg: `${r.minAge} 岁以后才做得到` };
  if (state.relaxUsedYear === state.age) return { ok: false, msg: '今年已经放过自己一次了' };
  const b = relaxBranch(r, state.age);
  if (b.cost && (state.stats.MONEY || 0) < b.cost) return { ok: false, msg: '钱不够' };
  // 条件门槛（NET ≥ 20 才叫得出八个人）—— 不满足时给的是叙事文案，不是「条件不足」
  if (r.cond && r.cond.min) {
    for (const k in r.cond.min) {
      if ((state.stats[k] || 0) < r.cond.min[k]) return { ok: false, msg: r.condMsg || '现在还做不到' };
    }
  }
  /* ⚠ 顺序：先记账、后扣款、最后才生效。
   * 反过来写（先扣钱再记额度）在目前没有 early return 时不会被利用，
   * 但只要将来有人在中间插一个 return，就会变成「扣了钱没记额度」→ 一年无限刷。
   * 按「禁止项守在源头」的原则，额度必须先落。tools/_verify-relax.js 的 RA-8 守着这个顺序。 */
  state.relaxUsedYear = state.age;
  if (b.cost) state.stats.MONEY -= b.cost;
  applyEffects(state, b.eff);
  if (r.flags && r.flags.length) {
    state.flags = state.flags || {};
    r.flags.forEach(f => { state.flags[f] = true; });
  }
  pushLog(state, `【减压】${r.name}。${b.desc}${b.cost ? `（花了 ${fmtMoney(b.cost)}）` : ''}`, 'money');
  return { ok: true, name: r.name, cost: b.cost };
}

/* 每年最多一次「有人来找你」，避免刷屏 */
function inboundTick(state) {
  if (state.age < 7) return;
  if (state.inboundYear === state.age) return;
  const kinds = inboundPick(state);
  if (!kinds.length) return;
  if (!chance(kinds.indexOf('parents') >= 0 ? 0.34 : 0.26)) return;
  const kind = kinds[randInt(0, kinds.length - 1)];
  const ev = makeInboundEvent(state, kind);
  if (!ev) return;
  state.inboundYear = state.age;
  state.extraQueue = state.extraQueue || [];
  state.extraQueue.push({ type: 'event', ev: ev });
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
  // 专业对口优先，其次才看钱：学什么干什么，不是一句空话
  const myMajor = majorCatOf(state);
  const ranked = offers.map(o => ({
    o: o,
    match: (myMajor && o.career.major && o.career.major.indexOf(myMajor) >= 0) ? 1 : 0,
    sal: o.career.ladder[o.entry].sal
  }));
  ranked.sort((a, b) => (b.match - a.match) || (b.sal - a.sal));
  const pool = ranked.filter(x => x.match);
  const list = pool.length ? pool : ranked;
  const pick = list[randInt(0, Math.min(2, list.length - 1))].o;
  const hit = pool.length > 0;
  applyJob(state, pick.career.id);
  if (hit && myMajor) {
    pushLog(state, `【对口】${myMajor}方向出身，第一份工作落在了 ${pick.career.name}。简历上的那一行专业，终于有了去处。`, 'money');
  }
}

/* ---------- 年度基础结算 ---------- */
/* 年支出（工作页与结算共用同一套口径，避免两处不一致）
 *
 * ⚠ A-07 硬连带 4b：支出必须与收入**同一条年代曲线**（`kEra_eff`），否则「谁先落谁先炸」。
 *   收入随年代涨、支出固定 30M → 1980–2002 出身玩家约 **45% 年度结余为负**（实测，
 *   与 design-strategist 的独立推演一致）。
 *   同缩放后：`年结余 = kEra_eff × (名义收入 − 名义支出)` ——
 *   「收入/支出」比值回到与今天完全一致，`norm` 只影响「结余 / 房价」这一个比值。
 *
 * ⚠ 这里调用的是 `eraK(state)`（career.js 的**函数声明**）。
 *   engine.js 在 career.js 之前加载，但函数声明会挂到全局对象，运行时调用没问题；
 *   写成顶层 const 就会踩 TDZ。
 */
function livingCost(state) {
  const j = JOBS[state.job] || { cost: 12000000 };
  let cost = j.cost || 0;
  if (state.flags.gangnam_owner) cost += 15000000;
  if (state.flags.married) cost += 12000000;
  if (state.childCount) cost += state.childCount * 6000000;
  if (state.flags.divorced && state.childCount) cost += state.childCount * 3000000; // 抚养费
  // v6.2：养在外面的孩子也要吃饭（生活费 + 封口费，藏起来是有成本的）
  if (typeof illegitSupportCost === 'function') cost += illegitSupportCost(state);
  return Math.round(cost * (typeof eraK === 'function' ? eraK(state) : 1));
}

function yearBase(state) {
  const s = state.stats;
  // v6 监狱：服刑结算——收入中断在收支段处理；刑满当年出狱
  if (state.prison > 0) {
    state.prison -= 1;
    s.STR += 1; s.WILL += 1; s.MOOD = (s.MOOD || 60) - 3; s.STRESS = (s.STRESS || 0) + 5;
    if (state.prison === 0) {
      state.flags.ex_prisoner = true;
      state.job = '无业';
      state.noAutoJobYear = state.age; // 出狱当年不自动塞工作，让玩家自己决定
      pushLog(state, '【出狱】铁门在身后打开。世界换了几轮，手机屏幕变大了，你口袋里只有一张释放证明和一张车票。', 'warn');
    }
  }
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

  /* 压力恢复（S-01 方案 D）：固定 −7 → 「固定 + 比例 + 失控阻尼」
   *
   * 原公式 S_{t+1} = S_t + I − 7 是**无稳态的线性衰减**：只要年流入 I > 7，
   * 压力就一路涨到 120 上限撞死。这是「激进流平均寿命 36.9 岁、熄灭率 67%」的根因。
   *
   * 新公式给系统一个稳态：
   *     I ≤ 30.4  →  S* = (I − 22) / 0.12        ← 与今天**逐点相同**
   *     I >  30.4 →  S* = (I − 4.5) / 0.37       ← 只压失控尾巴
   * （B = 22 = 7 固定恢复 + 12 减压行动 + 3 自住房）
   *
   * ⚠ 函数形式必须是 hinge（分段线性），**不能**用 S² 之类的平滑项：
   *   团队要保住的核心性质是「阈值以下完全不动」，只有 hinge 能精确做到；
   *   任何平滑项都会在阈值以下引入额外恢复，等于重犯「方案 A 用全局参数修局部失控」的错。
   *   代价是 S = 70 处斜率不连续 —— 这不会造成病态：恢复量对 S 单调递增，
   *   故 S_{t+1} − S_t 对 S 单调递减 → 不动点唯一且稳定，不会振荡。
   *
   * ⚠ 三个参数中只有 DAMP_Q 未定稿，按 stress-respec.md §3.7.3 的
   *   q = clamp((I_P75 − 34)/30, 0, 0.35) 待 quality-lead 实测后覆盖；
   *   RECOVER_K = 0.12 与 DAMP_T = 70 已定稿，不再改动。 */
  const _sOver = Math.max(0, s.STRESS - STRESS_TUNE.DAMP_T);
  s.STRESS = Math.max(0, s.STRESS - (STRESS_TUNE.RECOVER_FLAT
    + s.STRESS * STRESS_TUNE.RECOVER_K
    + _sOver * STRESS_TUNE.DAMP_Q));

  // 病重时的自动就医只是一个兜底：真得了病要走疾病事件（不治会一路恶化）
  if (!state.ill && s.HP < 28 && s.MONEY >= 60000000 && state.age >= 20) {
    const fee = Math.min(Math.max(30000000, Math.round(s.MONEY * 0.12)), 500000000);
    s.MONEY -= fee;
    s.HP += 14; s.STRESS -= 8;
    pushLog(state, `【体检住院】你在医院躺了两周，花了 ${fmtMoney(fee)}。医生说：再晚一个月就晚了。`, 'warn');
  }

  // 大学毕业：先别急着散伙，先决定去哪条路（考研 / 找工作 / 休整）
  if (state.edu && state.edu.gradAge && state.age >= state.edu.gradAge && state.job === '大学生') {
    const u = UNIVERSITIES.find(x => x.id === state.edu.uni);
    state.job = '待业';
    state.noAutoJobYear = state.age;  // 毕业当年绝不自动塞工作：先走毕业三选一
    state.classStage = null;   // 毕业了：同学不再是同班，但人还在人脉里
    const mates = (state.classmates || []).filter(c => c.stage === 'uni').length;
    pushLog(state, `【毕业】${u ? u.name : '大学'} · ${state.edu.major || ''} 专业。你搬出了宿舍，把学士服叠进了箱底。${mates ? `这一班的 ${mates} 个人散到各地，以后要见只能约。` : ''}`, 'money');
    if (state.edu.eduLevel < 5) state.edu.eduLevel = Math.max(state.edu.eduLevel, u ? u.edu : 3);
    // 毕业去哪条路：考研不是稳的，找工作也不是只有一个选项
    state.extraQueue = state.extraQueue || [];
    state.extraQueue.push({ type: 'event', ev: makeGradEvent(state) });
  }

  // 待业：按学历自动找一份能干的工作（避免长期无业陷入负债螺旋）
  // 毕业当年与间隔年除外——那一年要先把「考研 / 就业 / 再等一年」选完
  if (state.age >= 17 && (state.job === '待业' || state.job === '无业') && state.noAutoJobYear !== state.age) {
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
      income = freelanceIncome(state);   // 散工口径，见 career.js 的 CAREER_MULT.freelance
    }
    if (state.prison > 0) income = 0; // v6：服刑期间收入中断
    const cost = livingCost(state);
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
      endBy(state, 'end_elder');
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

  let items = [];
  items.push({ type: 'year', age: state.age, year: fmtYear(state) });

  // 升学：15岁中考 / 18岁高考
  const ed = state.edu || (state.edu = { mid: null, gao: null, hs: null, uni: null, eduLevel: 0, study: 0, gradAge: null, major: null, salaryK: 1 });
  if (!ed.stopped) {
    if (state.age === EXAM_META.midAge && !ed.hs) items.push(makeExamEvent(state, 'mid'));
    else if (state.age === EXAM_META.gaoAge && !ed.uni) items.push(makeExamEvent(state, 'gao'));
  }

  refreshClassmates(state);
  scoutTick(state);
  careerTick(state);
  loveTick(state);
  friendTick(state);
  inboundTick(state);   // 别人也会主动来找你
  familyTick(state);
  illnessTick(state);
  prisonTick(state);    // v6 监狱系统：案发 / 宣判
  petTick(state);       // v6 宠物生态：喂养 / 寿命 / 流浪 / 赛马变老
  luxTick(state);       // v6 顶奢载具隐藏加成
  raceSeasonTick(state); // v6 赛车线年度赛季
  flirtTick(state);     // v6 搭讪系统：毕业后的街头偶遇
  trustTick(state);     // v6.1 家族信托：年度给付（败家子也饿不死）
  retireTick(state);    // v6.1 养老服务：年费与照护
  clubTick(state);      // v6.1 圈层：年费 / 赞助商 / 内幕消息 / 联合投资
  crisisTick(state);    // v6.2 动态情感危机：偷情与私生子的年度曝光判定
  propertyTaxTick(state); // v6.2 房产税 / 空置税：房子越多越痛
  npcTick(state);       // v6.2 NPC 对等：配偶与子女也会主动做事
  if (state.finished) return { type: 'end' };
  loanTick(state);
  checkAchievements(state);

  offerInvestments(state).forEach(o => items.push(o));
  pickEvents(state).forEach(ev => items.push({ type: 'event', ev }));

  // 毕业季等年度结算里产生的选择，要排在最前面
  if (state.extraQueue && state.extraQueue.length) {
    items = state.extraQueue.concat(items);
    state.extraQueue = [];
  }
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
  if (opt.locked) return; // 分数不够的学校点不动
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

/* ---------- 毕业季：考研还是找工作 ---------- */
function makeGradEvent(state) {
  const p = clamp(0.3 + state.stats.INT * 0.004 + (state.edu.study || 0) * 0.003 + (state.flags.uni_985 ? 0.08 : 0), 0.15, 0.85);
  return {
    id: 'grad_at_' + state.age,
    age: [18, 200], w: 0,
    kaoyanP: p,
    text: `【毕业季】辅导员把三方协议放在你面前。同宿舍的人有人签了字，有人租了考研自习室的座位。\n` +
      `考研成功率约 ${Math.round(p * 100)}%（智力 ${Math.round(state.stats.INT)} · 学习投入 ${Math.round(state.edu.study || 0)}）。你怎么选？`,
    choices: [
      {
        text: '考研：给自己再搏一次学历（成功率约 ' + Math.round(p * 100) + '%）',
        risk: 3, flags: ['kaoyan_try'], eff: { STRESS: 6 }, study: true
      },
      {
        text: '放弃考研，把简历投出去',
        risk: 1, flags: ['job_now'], eff: { NET: 3, WILL: 2, STRESS: 3 }
      },
      {
        text: '休整一年：先去看看这个世界再说话',
        risk: 2, flags: ['gap_year'], eff: { MOOD: 8, MONEY: -3000000, STRESS: -8, CUR: 3 }
      }
    ]
  };
}

/* 考研落榜：是二战还是认了（不会再被直接塞进一份工作） */
function makeKaoyanFailEvent(state) {
  return {
    id: 'kaoyan2_at_' + state.age,
    age: [18, 200], w: 0,
    kaoyanP: clamp(0.26 + state.stats.INT * 0.004 + (state.edu.study || 0) * 0.003 + (state.flags.kaoyan_fail ? -0.06 : 0.04), 0.12, 0.8),
    text: '【落榜】分数出来了，差的那几分像一道门缝。\n' +
      '自习室的座位还留着你的水杯。再坐一年要钱，也要命；投出去的简历，也可能石沉大海。',
    choices: [
      {
        text: '二战：再来一年，就一年',
        risk: 3, flags: ['kaoyan_again'], eff: { STRESS: 10, WILL: 4, INT: 2, MONEY: -6000000 }, study: true
      },
      {
        text: '认了，去投简历找工作',
        risk: 1, flags: ['job_after_fail'], eff: { NET: 2, WILL: 1, STRESS: 4 }
      }
    ]
  };
}

/* ---------- 星探：初中 / 高中被发掘，要不要放弃学业去当练习生 ---------- */
function makeScoutEvent(state) {
  const cha = Math.round(state.stats.CHA);
  const look = Math.round(state.stats.CHA * 0.7 + (state.stats.HP || 60) * 0.3);
  return {
    id: 'scout_at_' + state.age,
    age: [12, 19], w: 0,
    scout: true,
    text: `【星探】放学路上，一个人拦住你，递了张名片。\n` +
      `「我们公司在招练习生。你这张脸——」他比划了一下，「不试试可惜。」\n` +
      `你的条件：魅力 ${cha}（颜值评估 ${look}）。签约意味着退学，也意味着每天十小时的练习室。`,
    choices: [
      {
        text: '签。书什么时候都能念，机会只有一次', risk: 3,
        flags: ['scout_sign', 'music', 'idol_signed'],
        eff: { CHA: 4, FAME: 6, WILL: 4, STRESS: 8, SEC: -6, INT: -2 }
      },
      {
        text: '要一笔签约金才肯签：开口赌一把', risk: 3,
        flags: ['scout_money'],
        eff: { CHA: 2, STRESS: 4 },
        gamble: {
          p: 0.42,
          win: { MONEY: 25000000, CHA: 3, FAME: 4, WILL: 2, flags: ['music', 'idol_signed'] },
          lose: { MONEY: -1000000, MOOD: -5, FAME: -2 }
        }
      },
      {
        text: '把书念完再说：这不是我该走的路', risk: 1,
        flags: ['scout_refuse'],
        eff: { INT: 3, WILL: 3, ETH: 2, SEC: 3, FAME: 1 }
      }
    ]
  };
}

/* 每年一次判定：长得好看 / 念艺术学校的人，初高中就可能被拦下来 */
function scoutTick(state) {
  if (state.flags.idol_signed || state.flags.scout_sign) return;
  if (state.scoutYear === state.age) return;
  const st = schoolStageOf(state);
  if (st !== 'mid' && st !== 'high') return;
  if (state.age < 13 || state.age > 18) return;
  const art = state.edu && state.edu.hs === 'hs_art';
  const pretty = state.stats.CHA >= 52 || art;
  if (!pretty) return;
  // 长得越好看，被拦下的概率越高
  const p = clamp(0.10 + (state.stats.CHA - 45) * 0.012 + (art ? 0.18 : 0) + (state.flags.talent_pretty ? 0.12 : 0), 0.08, 0.55);
  if (!chance(p)) return;
  state.scoutYear = state.age;
  state.extraQueue = state.extraQueue || [];
  state.extraQueue.push({ type: 'event', ev: makeScoutEvent(state) });
}

/* 星探签约落定：退学 + 进 idol 线（未成年也进得去，只是没工资） */
function signAsIdol(state) {
  state.flags.idol_signed = true;
  state.flags.idol_contract = true;
  state.flags.music = true;
  dropOut(state, '练习生');
  if (state.age >= CAREER_META.minWorkAge) {
    const r = applyJob(state, 'idol');
    if (!r.ok) {
      state.job = '练习生';
      state.career = { id: 'idol', level: 0, years: 0, joinedAge: state.age };
    }
  } else {
    state.job = '练习生';
    state.career = { id: 'idol', level: 0, years: 0, joinedAge: state.age };
    pushLog(state, '【签约】你成了练习生。年纪还小，工资没有，只有练习室的镜子。', 'warn');
  }
}

/* ---------- 录取后选专业 ---------- */
function makeMajorEvent(state, u) {
  const majors = (u.major || []).slice(0, 6);
  return {
    id: 'major_at_' + state.age,
    age: [15, 200], w: 0,
    uniId: u.id,
    text: `【填志愿】${u.name} 的录取系统亮了。招生简章摊在桌上——这几个专业你都能报。\n` +
      `专业的名字，会在往后的每一份简历上跟着你。`,
    choices: majors.map((m, i) => ({
      text: `${m}（${majorCatCn(MAJOR_LABEL[m])}方向 · 出路：${majorCareerHint(m)}）`,
      major: m,
      risk: i === 0 ? 2 : (i === 1 ? 2 : 1),
      eff: i === 0 ? { INT: 2 } : (i === 1 ? { CHA: 2 } : { WILL: 2 })
    }))
  };
}

/* 专业方向归类：决定哪些职业对口（52 个专业 / 9 个方向） */
const MAJOR_LABEL = {
  /* 理工 */
  '计算机': '理工', '软件工程': '理工', '电子信息': '理工', '人工智能': '理工',
  '自动化': '理工', '通信工程': '理工', '机械': '理工', '车辆工程': '理工',
  '土木工程': '理工', '机电': '理工', '环境工程': '理工', '材料成型': '理工',
  '数学': '理工', '物理学': '理工', '电气工程': '理工',
  /* 经管 */
  '金融学': '金融', '会计学': '金融', '经济学': '金融', '财务管理': '金融',
  '工商管理': '金融', '市场营销': '金融', '电子商务': '金融', '物流管理': '金融',
  '人力资源管理': '金融', '国际经济与贸易': '金融',
  /* 医学 */
  '临床医学': '医学', '护理学': '医学', '口腔医学': '医学', '药学': '医学',
  '公共卫生': '医学', '中医学': '医学',
  /* 法律 */
  '法学': '法律', '知识产权': '法律', '政治学与行政学': '法律',
  /* 教育 */
  '教育学': '师范', '小学教育': '师范', '学前教育': '师范', '英语': '师范',
  '汉语言文学': '师范', '历史学': '师范', '心理学': '师范',
  /* 艺术 */
  '视觉传达设计': '艺术', '环境设计': '艺术', '动画': '艺术', '数字媒体艺术': '艺术',
  '美术学': '艺术', '服装设计': '艺术', '音乐表演': '艺术', '舞蹈编导': '艺术',
  '表演': '艺术', '播音与主持艺术': '艺术',
  /* 传媒 */
  '新闻学': '传媒', '传播学': '传媒', '广告学': '传媒',
  '广播电视编导': '传媒', '网络与新媒体': '传媒',
  /* 体育 */
  '体育教育': '体育', '运动训练': '体育',
  /* 农林 */
  '农学': '农林', '动物医学': '农林', '林学': '农林'
};
/* 旧存档兼容：v5.4 改过一批专业名，老档能自动对上新名 */
const MAJOR_LEGACY = {
  '金融': '金融学', '会计': '会计学', '设计': '视觉传达设计', '广告设计': '广告学',
  '护理': '护理学', '新闻传播': '新闻学', '汉语言': '汉语言文学', '旅游管理': '国际经济与贸易'
};
function majorCanonical(m) { return MAJOR_LEGACY[m] || m; }

/* 方向 → 中文名（UI 与提示用） */
const MAJOR_CAT_CN = {
  '理工': '理工', '金融': '经管', '医学': '医学', '法律': '法律',
  '师范': '教育', '艺术': '艺术', '传媒': '传媒', '体育': '体育', '农林': '农林'
};
/* 方向 → 主要对口职业（填志愿时告诉玩家出路） */
const MAJOR_CAREER_HINT = {
  '理工': '程序员 / AI 算法 / 产品经理 / 电商运营',
  '金融': '会计 / 投行券商 / 销售 / 电商运营',
  '医学': '医生 / 护士',
  '法律': '律师',
  '师范': '中小学教师',
  '艺术': '设计师 / 偶像练习生 / 自媒体 / 演员',
  '传媒': '自媒体博主 / 产品经理 / 电商运营',
  '体育': '偶像练习生 / 演员',
  '农林': '创业者 / 工厂管理'
};
function majorCatOf(state) {
  const m = state.edu && state.edu.major;
  if (!m) return null;
  return MAJOR_LABEL[m] || MAJOR_LABEL[MAJOR_LEGACY[m]] || null;
}
function majorCatCn(cat) { return MAJOR_CAT_CN[cat] || cat || '通用'; }
function majorCareerHint(m) { return MAJOR_CAREER_HINT[MAJOR_LABEL[m]] || '各行各业都要'; }

function resolveEvent(state, ev, choiceIndex) {
  if (!ev.fest) state.used.push(ev.id); // 节日事件（fest）每年可重复，不进 once 池
  const list = eventChoices(state, ev);
  let eff = ev.eff || {};
  let extra = '';
  let ch = null;

  if (list && typeof choiceIndex === 'number' && list[choiceIndex]) {
    ch = list[choiceIndex];
    eff = ch.eff || {};
    applyFlags(state, ch.flags);
    if (ev.ib && ch.ibGain) applyInbound(state, ev.ib, ch.ibGain);
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
    if (ev.job) setJob(state, ev.job);
  }
  if (ch && ch.job) setJob(state, ch.job);

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
    if (win && g.winJob) setJob(state, g.winJob);
    if (win && g.winFlags) applyFlags(state, g.winFlags);
    if (!win && g.loseFlag) applyFlags(state, [g.loseFlag]);
    // win/lose 对象内联的 flags / job 也要生效（如收购成功接任董事长、赌输丢掉工作）
    if (res.flags) applyFlags(state, res.flags);
    if (res.job) setJob(state, res.job);
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
    const kid = addChild(state);
    applyEffects(state, { LOVE: 4, GROW: 3 });
    pushLog(state, `【新生命】${kid.gender === 'M' ? '儿子' : '女儿'} ${kid.name} 降生。${state.spouseName || 'TA'} 说：像极了你小时候。`, 'muted');
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
  if (ev.id && String(ev.id).indexOf('pregnant_at_') === 0) {    const lv = loveInit(state);
    const l = lv.candidates.find(x => x.name === ev.loverName) || lv.partner;
    if (ch && ch.flags && ch.flags.indexOf('pregnant_keep') >= 0) {
      const kid = addChild(state);
      if (kid) {
        // v6.2：没领证就生下来的，是非婚生子女——法律上权利同等，现实里要自己扛
        kid.illegit = !state.flags.married;
        kid.mother = l ? l.name : undefined;
        kid.ack = true;
      }
      if (l) l.pregnant = false;
      pushLog(state, `【生育】${kid.gender === 'M' ? '儿子' : '女儿'} ${kid.name} 出生了。你没有婚礼，只有一张出生证明和一堆学费。`, 'money');
      if (kid && kid.illegit) {
        pushLog(state, `【非婚生】出生医学证明「父亲」那一栏写着你的名字，但你们没有结婚证。\n` +
          `法律说 TA 和别的孩子权利同等；街坊的嘴不这么说。`, 'muted');
      }
      if (!state.flags.married && l && state.age >= 20 && chance(0.5)) {
        marry(state, l);
        if (kid) kid.illegit = false;   // 婚后补证：孩子跟着变成了婚生
      }
    } else if (ch && ch.flags && ch.flags.indexOf('pregnant_marry') >= 0) {
      if (l && !state.flags.married) {
        marry(state, l);
        const kid = addChild(state);
        pushLog(state, `【奉子成婚】婚礼办得很仓促。${kid.name} 的名字还是满月酒上才定下来的。亲戚们在背后议论，你们只顾着抱孩子。`, 'money');
      }
    } else if (ch && ch.flags && ch.flags.indexOf('pregnant_drop') >= 0) {
      if (l) { l.pregnant = false; l.affinity = clamp(l.affinity - 15, 0, 100); }
      pushLog(state, `【手术】从医院出来的时候，天已经黑了。你们一路都没有说话。`, 'warn');
    }
  }

  // 生病：治不治，决定这条命还能不能留住
  if (ev.id && String(ev.id).indexOf('ill_at_') === 0) {
    const ref = ILLNESS.find(x => x.id === ev.illId) || ILLNESS[0];
    let act = ch && ch.illAct;
    if (act && ch.illCost && state.stats.MONEY < ch.illCost) {
      state.stats.MONEY += ch.illCost;   // 钱已经扣过了，掏不出来就退回去
      pushLog(state, `【没钱】${fmtMoney(ch.illCost)} 的医药费你掏不出来。你只能回家躺着，喝热水。`, 'warn');
      act = 'ignore';
    }
    if (state.ill) {
      if (act === 'ignore') {
        if (!ref.chronic && state.ill.stage <= 1 && chance(0.45)) {
          const nm = ref.name;
          state.ill = null;
          applyEffects(state, { HP: 6, WILL: 2 });
          pushLog(state, `【硬扛】${nm}居然自己好了。你烧了三天，然后活了过来。`, 'money');
        } else {
          state.ill.stage = clamp(state.ill.stage + 1, 1, 4);
          pushLog(state, `【硬扛】没扛过去。${ref.name} 更重了：${illStageCn(state.ill.stage)}。`, 'warn');
        }
      } else if (act === 'clinic' || act === 'hospital') {
        const p = cureChance(state.ill.stage, ref, act);
        if (chance(p)) {
          const st = state.ill.stage;
          state.ill = null;
          if (st >= 3) state.flags.ill_survived = true;
          applyEffects(state, { HP: 10 + (act === 'hospital' ? 8 : 0), STRESS: -4, MOOD: 3 });
          pushLog(state, `【治疗】${ref.name} 治好了。走出医院时你觉得阳光有点刺眼。`, 'money');
        } else {
          if (ref.chronic && chance(0.4)) state.ill.stage = clamp(state.ill.stage + 1, 1, 4);
          applyEffects(state, { HP: 4, STRESS: -2 });
          pushLog(state, `【治疗】${ref.name} 还没断根，${illStageCn(state.ill.stage)}。医生说：再来一个疗程。`, 'warn');
        }
      }
    }
  }

  // 婚外情东窗事发
  if (ev.id && String(ev.id).indexOf('affair_at_') === 0) {
    const lv = loveInit(state);
    const l = lv.candidates.find(x => x.name === ev.loverName);
    const fl = (ch && ch.flags) || [];
    const drop = () => { if (l) lv.candidates = lv.candidates.filter(x => x !== l); };
    if (fl.indexOf('affair_cut') >= 0) {
      drop();
      if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 8, 0, 100);
      pushLog(state, `【断了】你把 ${l ? l.name : 'TA'} 的所有联系方式删了。回家路上买了菜，装作什么都没发生。`, 'muted');
    } else if (fl.indexOf('affair_confess') >= 0) {
      drop();
      if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 24, 0, 100);
      pushLog(state, `【坦白】你说了。${state.spouse ? state.spouse.name : 'TA'} 坐在沙发上，很久没有说话。`, 'warn');
      if (chance(0.38)) divorce(state, '出轨被撞破');
    } else if (fl.indexOf('affair_divorce') >= 0) {
      divorce(state, '为了另一个人');
      drop();
      if (l) {
        lv.candidates.push(l);
        if (state.age >= LOVE_META.marryAge && l.affinity >= LOVE_META.marryAffinity) marry(state, l);
        else { l.stage = 'dating'; lv.partner = l; state.flags.dating = true; }
      }
    }
  }

  // v6.2 · 私生子的三条出路：认 / 养在外面 / 断干净
  if (ev.id && String(ev.id).indexOf('illegit_at_') === 0) {
    const lv = loveInit(state);
    const l = lv.candidates.find(x => x.name === ev.loverName) || lv.partner;
    const fl = (ch && ch.flags) || [];
    if (fl.indexOf('illegit_ack') >= 0) {
      const kid = bearIllegitimate(state, l, true);
      pushLog(state, `【认领】${kid ? (kid.gender === 'M' ? '儿子 ' : '女儿 ') + kid.name : '这个孩子'} 落在了你的户口本上。` +
        `从今天起，TA 与婚生子女享有同等的权利——包括将来分这个家。`, 'story');
      if (state.flags.married && state.spouse) {
        bumpSuspicion(state, 40, '户口本上多了一个人');
        state.spouse.affinity = clamp((state.spouse.affinity || 60) - 16, 0, 100);
      }
    } else if (fl.indexOf('illegit_hide') >= 0) {
      const kid = bearIllegitimate(state, l, false);
      pushLog(state, `【养在外面】${kid ? kid.name : '这个孩子'} 有了一个你给的名字，却没有你家的姓。\n` +
        `每个月都有一笔钱要打过去。这笔账，你记在只有你自己知道的那一栏里。`, 'warn');
    } else if (fl.indexOf('illegit_drop') >= 0) {
      if (l) { l.pregnant = false; l.illegitPreg = false; l.affinity = clamp(l.affinity - 25, 0, 100); }
      pushLog(state, `【断干净】钱转过去了，人也删了。你告诉自己这件事从来没发生过——\n` +
        `但有些夜晚，你会想起那张化验单。`, 'warn');
    }
  }

  // v6.2 · 东窗事发：你怎么应对，配偶怎么处置
  if (ev.id && String(ev.id).indexOf('expose_at_') === 0) {
    const fl = (ch && ch.flags) || [];
    const sp = state.spouse;
    if (fl.indexOf('expose_leave') >= 0) {
      divorce(state, '出轨败露，先提的那个人');
    } else if (fl.indexOf('expose_buy') >= 0) {
      const buy = ev.exposeBuy || 0;
      if (state.stats.MONEY >= buy && buy > 0) {
        state.stats.MONEY -= buy;
        if (sp) { sp.suspicion = 72; sp.affinity = clamp((sp.affinity || 60) - 10, 0, 100); }
        state.flags.spouse_paid = true;
        pushLog(state, `【摆平】你转了 ${fmtMoney(buy)}。${sp ? sp.name : 'TA'} 收下了，什么也没再说。\n` +
          `钱能买来沉默，买不回信任。从这天起，家里每一笔账都要过 TA 的手。`, 'warn');
      } else {
        pushLog(state, `【摆不平】你掏不出 ${fmtMoney(buy)}。${sp ? sp.name : 'TA'} 看着手机笑了一下：` +
          `「你连这个都拿不出来，还敢在外面有人？」`, 'warn');
        spouseSue(state, '婚外情 · 且试图用钱封口');
      }
    } else if (fl.indexOf('expose_deny') >= 0) {
      const smooth = chance(clamp(0.5 - suspicionOf(state) / 200, 0.08, 0.5));
      if (smooth) {
        if (sp) sp.suspicion = clamp((sp.suspicion || 0) + 25, 0, 100);
        pushLog(state, `【抵赖】你把话说得滴水不漏。${sp ? sp.name : 'TA'} 没再追问——但从此家里的空气更冷了。\n` +
          `你赢了一次。下一次不一定。`, 'muted');
      } else {
        pushLog(state, `【抵赖失败】证据摊在桌上：开房记录、转账、还有你删掉又恢复的聊天。\n` +
          `抵赖在法庭上只会让法官更不喜欢你。`, 'warn');
        spouseSue(state, '婚外情 · 事发后拒不承认');
      }
    } else if (fl.indexOf('expose_admit') >= 0) {
      const v = spouseVerdict(state);
      if (v === 'sue') spouseSue(state, ev.exposeVia === 'child' ? '私生子曝光' : '婚外情');
      else if (v === 'forgive') spouseForgive(state);
      else if (v === 'coexist') spouseCoexist(state);
      else spouseBlacklist(state);
    }
  }

  // v6.2 · 配偶在外面也有人（NPC 对等：你会的，TA 也会）
  if (ev.id && String(ev.id).indexOf('spouseaffair_at_') === 0) {
    const fl = (ch && ch.flags) || [];
    if (fl.indexOf('sa_ignore') >= 0) {
      if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 6, 0, 100);
      pushLog(state, '【装不知道】你什么都没说。夜里背对着背，你们都很清醒。', 'muted');
    } else if (fl.indexOf('sa_confront') >= 0) {
      const v = Math.random();
      if (v < 0.45) {
        pushLog(state, `【摊牌】${state.spouse ? state.spouse.name : 'TA'} 承认了，也说了那句你听过的话：「最后一次。」\n` +
          `你们谁也没有资格审判谁。`, 'warn');
        if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 10, 0, 100);
      } else {
        divorce(state, '对方也有别人了');
      }
    } else if (fl.indexOf('sa_paternity') >= 0) {
      // 亲子鉴定：孩子到底是不是你的
      state.flags.paternity_done = true;
      const kids = (state.children || []).filter(c => c.alive !== false && !c.illegit);
      const kid = kids.length ? kids[kids.length - 1] : null;
      if (kid && chance(0.35)) {
        kid.cuckoo = true;
        applyEffects(state, { LOVE: -20, SEC: -18, MOOD: -14, STRESS: 16, ETH: -6 });
        pushLog(state, `【亲子鉴定】报告上写着「排除生物学父亲」。\n` +
          `${kid.name} 不是你的孩子。这些年你供的学费、抱过的每一次发烧——都是替别人养的。`, 'warn');
        state.extraQueue = state.extraQueue || [];
        state.extraQueue.push({ type: 'event', ev: makeCuckooEvent(state, kid) });
      } else {
        applyEffects(state, { MOOD: -4, STRESS: 6 });
        pushLog(state, `【亲子鉴定】报告写着「支持生物学父亲」。你松了一口气，然后为自己的这个念头羞耻了很久。`, 'muted');
        state.stats.MONEY -= 3000000;
      }
    }
  }

  // v6.2 · 配偶先提的离婚
  if (ev.id && String(ev.id).indexOf('spousediv_at_') === 0) {
    const fl = (ch && ch.flags) || [];
    if (fl.indexOf('sd_yes') >= 0) {
      divorce(state, `${state.spouseName || '对方'} 先提的`);
    } else if (fl.indexOf('sd_beg') >= 0) {
      if (chance(0.5)) {
        if (state.spouse) {
          state.spouse.affinity = clamp((state.spouse.affinity || 60) + 25, 0, 100);
          state.spouse.suspicion = Math.max(0, (state.spouse.suspicion || 0) - 30);
        }
        pushLog(state, `【挽留】你把这几年欠的都补上了。${state.spouse ? state.spouse.name : 'TA'} 没走。\n` +
          `但你也明白，这是最后一次机会。`, 'money');
      } else {
        pushLog(state, `【挽留不成】钱能摆平很多事，摆平不了「不想再过了」这四个字。`, 'warn');
        divorce(state, '挽留无效');
      }
    } else if (fl.indexOf('sd_stall') >= 0) {
      if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 8, 0, 100);
      pushLog(state, '【拖着】谁也没再提这件事。这个家就这么悬着——悬着也是一种过法。', 'warn');
    }
  }

  // v6.2 · 孩子不是你的
  if (ev.id && String(ev.id).indexOf('cuckoo_at_') === 0) {
    const fl = (ch && ch.flags) || [];
    if (fl.indexOf('ck_divorce') >= 0) divorce(state, '孩子不是自己的');
    else if (fl.indexOf('ck_sue') >= 0) pushLog(state, '【判决】法院判了。钱要回来了，但判决书上写着你的名字，和那三个字。', 'warn');
    else if (fl.indexOf('ck_keep') >= 0) pushLog(state, '【还是你的孩子】你把报告烧了。有些真相，知道了就得替它付一辈子的账。', 'story');
  }

  // v6.2 · 私生子争产（你死了，他们才会出现）
  if (ev.id && String(ev.id).indexOf('bastardclaim_at_') === 0) {
    const fl = (ch && ch.flags) || [];
    if (fl.indexOf('bc_fight') >= 0) {
      applyEffects(state, { ETH: -8, MOOD: -6, STRESS: 10 });
      pushLog(state, '【争产】你把律师费付了。法庭上那个年轻人看着你，眉眼像极了二十岁的自己。', 'warn');
    } else {
      applyEffects(state, { ETH: 6, WILL: 4, SEC: -4 });
      pushLog(state, '【认了】你没有打这个官司。血缘这种东西，法庭不判，它自己会找上门。', 'story');
    }
  }

  // 婚姻危机
  if (ev.id && String(ev.id).indexOf('marry_at_') === 0) {
    const fl = (ch && ch.flags) || [];
    if (fl.indexOf('m_fix') >= 0) {
      if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) + 20, 0, 100);
      pushLog(state, `【补救】你们请了一次假，去了年轻时常去的那条街。有些话终于说出口了。`, 'money');
    } else if (fl.indexOf('m_talk') >= 0) {
      if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) + 8, 0, 100);
      pushLog(state, `【摊牌】吵了一整夜，最后两个人都累了。日子还得过。`, 'warn');
    } else if (fl.indexOf('m_split') >= 0) {
      divorce(state, '过不下去了');
    }
  }

  // 专业选择落定
  if (ev.id && String(ev.id).indexOf('major_at_') === 0) {
    if (ch && ch.major) {
      state.edu.major = ch.major;
      pushLog(state, `【专业】你的专业定了：${ch.major}。以后简历上那一行，就是它了。`, 'money');
    }
  }
  // 毕业选择落定：考研可能落榜，落榜就进社会
  if (ev.id && String(ev.id).indexOf('grad_at_') === 0) {
    const e = state.edu;
    if (ch && ch.flags && ch.flags.indexOf('kaoyan_try') >= 0) {
      if (chance(ev.kaoyanP || 0.4)) {
        e.eduLevel = 5;
        e.salaryK = Math.max(e.salaryK || 1, KAOYAN_FLOOR);
        e.gradAge = state.age + 3;
        state.job = '大学生';
        state.flags.kaoyan_ok = true;
        applyEffects(state, { INT: 3, FAME: 4, WILL: 3 });
        pushLog(state, '【上岸】考研成绩出来了，你考上了。接下来三年，又是自习室的灯。', 'money');
      } else {
        state.flags.kaoyan_fail = true;
        applyEffects(state, { STRESS: 10, WILL: 3, MOOD: -6 });
        pushLog(state, '【落榜】考研分数出来了，差了几分。路要自己再选一次。', 'warn');
        // 落榜不等于立刻被安排一份工作：二战还是就业，交给玩家
        state.extraQueue = state.extraQueue || [];
        state.extraQueue.push({ type: 'event', ev: makeKaoyanFailEvent(state) });
      }
    } else if (ch && ch.flags && ch.flags.indexOf('job_now') >= 0) {
      autoEmploy(state);
      pushLog(state, '【求职】你更新了简历开始投递。等通知的日子里，你把这座城市又走了一遍。', 'muted');
    } else if (ch && ch.flags && ch.flags.indexOf('gap_year') >= 0) {
      state.job = '待业';
      pushLog(state, '【间隔年】你背着包走了很远。有些答案不在自习室里。回来之后，简历还得投。', 'muted');
    }
  }
  // 落榜后的二战 / 就业：二战也不是稳的
  if (ev.id && String(ev.id).indexOf('kaoyan2_at_') === 0) {
    const e = state.edu;
    if (ch && ch.flags && ch.flags.indexOf('kaoyan_again') >= 0) {
      if (chance(ev.kaoyanP || 0.35)) {
        e.eduLevel = 5;
        e.salaryK = Math.max(e.salaryK || 1, KAOYAN_FLOOR);
        e.gradAge = state.age + 3;
        state.job = '大学生';
        state.flags.kaoyan_ok = true;
        applyEffects(state, { INT: 4, FAME: 4, WILL: 4 });
        pushLog(state, '【二战上岸】第二年，名字终于出现在拟录取名单上。你坐在台阶上，哭得像个小孩。', 'money');
      } else {
        state.job = '待业';
        applyEffects(state, { STRESS: 12, MOOD: -8, WILL: 2 });
        pushLog(state, '【二战落榜】又一次差了几分。你把书卖了，第二天去了招聘会。', 'warn');
      }
    } else if (ch && ch.flags && ch.flags.indexOf('job_after_fail') >= 0) {
      autoEmploy(state);
    }
  }

  // 有人向你表白：接住 / 装傻 / 说清楚
  if (ev.id && String(ev.id).indexOf('confess_at_') === 0) {
    const lv = loveInit(state);
    let l = (lv.candidates || []).find(x => x.name === ev.confessName);
    if (ch && ch.flags && ch.flags.indexOf('confess_yes') >= 0) {
      if (!l) {
        l = makeLover(state, '表白');
        l.name = ev.confessName;
        lv.candidates.push(l);
      }
      l.affinity = clamp((l.affinity || 40) + 14, 0, 100);
      if (state.flags.married) {
        l.outside = true; l.secret = true; l.affairSince = state.age;
        if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 6, 0, 100);
        pushLog(state, `【偷情】你接住了 ${l.name} 的那句话。从此手机有了第二个密码。`, 'warn');
      } else {
        l.stage = 'dating';      // v6.2.1：答应别人的表白 = 确定关系
        lv.partner = l;
        state.flags.dating = true; state.flags.in_love = true;
        pushLog(state, `【在一起】你和 ${l.name} 在一起了。${state.age} 岁这年，有人先说了那句话。`, 'money');
      }
    } else if (ch && ch.flags && ch.flags.indexOf('confess_no') >= 0) {
      if (l) l.affinity = clamp(l.affinity - 12, 0, 100);
      pushLog(state, `【回绝】你把话回得很体面。${ev.confessName} 说：我明白。`, 'muted');
    } else if (ch && ch.flags && ch.flags.indexOf('confess_ignore') >= 0) {
      pushLog(state, `【沉默】你把手机扣了过去。那条消息，你后来再也没点开过。`, 'muted');
    }
  }

  // 星探签约：真的会退学，真的会去练习室
  if (ev.id && String(ev.id).indexOf('scout_at_') === 0) {
    // 注意：applyFlags 已经把 scout_sign 打上了，所以这里用「是否已签约」来判断
    const signed = state.flags.idol_signed || !!(ch && ch.flags && ch.flags.indexOf('scout_sign') >= 0);
    if (signed && !state.flags.idol_contract) {
      signAsIdol(state);
    } else if (ch && ch.flags && ch.flags.indexOf('scout_refuse') >= 0) {
      pushLog(state, '【星探】你把名片夹在了课本里，后来再没翻到过。', 'muted');
    }
  }

  // 家里开口要钱：替家里还掉一部分债
  if (ev.id && String(ev.id).indexOf('famask_at_') === 0 && state.family) {
    const pay = (ch && ch.eff && ch.eff.MONEY < 0) ? -ch.eff.MONEY : 0;
    if (pay > 0) {
      state.family.debt = Math.max(0, Math.round(state.family.debt - pay * 0.6));
      pushLog(state, '【家里】钱打过去了，家里那本账上少了一块石头。', 'money');
    }
  }

  checkDeath(state);
  checkAchievements(state);
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
    endBy(state, 'end_dead');
  }
}

/* ---------- 结局判定：全项目唯一入口（IMP-01 · S-04） ----------
 * 以前有两条互不相通的路径：
 *   ① finish()   → ENDINGS.find() 正式判定（16 条结局）
 *   ② forceEnd() → 直接写「某某死法」的自定义 ending，一条正式判定都不走
 * 死亡占了全部结局的 88% 以上，等于 16 条结局在绝大多数局里根本不参与。
 * 现在合并成一条：**死亡也先走 ENDINGS.find()，死因只作为叠加层**。
 *
 * 产物形状：{ id, baseId, cause, rank, title, text }
 *  · baseId / id  = ENDINGS 判出来的「这一生是什么」（如 end_normal）
 *  · cause        = 死因 id（end_elder / end_ill / end_dead），正常收尾为 null
 *  · title        = 「普通的人生 · 安然离世」这样两段式
 *  ⚠ 返回的是 ENDINGS 条目的副本，不再把共享对象直接挂到 state 上。 */
function endingFor(state) {
  return ENDINGS.find(e => e.cond(state)) || ENDINGS[ENDINGS.length - 1];
}

function resolveEnding(state, causeId, ctx) {
  const base = endingFor(state);
  const cause = causeId ? (DEATH_CAUSES.find(c => c.id === causeId) || null) : null;
  return {
    id: base.id,
    baseId: base.id,
    cause: cause ? cause.id : null,
    rank: base.rank,
    title: cause ? base.title + ' · ' + cause.label : base.title,
    text: cause ? cause.text(state, ctx) + '　' + base.text : base.text
  };
}

/* 带死因的收尾（原 forceEnd 的三个调用点改走这里） */
function endBy(state, causeId, ctx) {
  state.finished = true;
  state.alive = false;
  // v6.2：非婚生子女的继承权——死亡也是同一个结算口
  if (typeof settleBastardClaims === 'function') settleBastardClaims(state);
  const ending = resolveEnding(state, causeId, ctx);
  state.ending = ending;
  // 死亡类结局也要有评分/评级，便于结算页与存档保持一致
  state.score = scoreOf(state);
  state.rank = grade(state.score);
  // v6.2.2 一生碑文（结算页展示，随存档持久化）
  if (typeof lifeEpitaph === 'function') state.epitaph = lifeEpitaph(state);
  pushLog(state, `【结局】${ending.title} — ${ending.text}`, 'end');
  return ending;
}

/* 兼容旧名：保留 forceEnd 是为了不打断外部（如音频接入方案里的埋点描述）。
 * ⚠ 语义已变：第二个参数现在是「死因 id 字符串」，不再是自定义 ending 对象。 */
function forceEnd(state, causeId, ctx) { return endBy(state, causeId, ctx); }

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
  score += Math.min(8, (state.achievements || []).length * 0.5); // 成就也是人生的一部分
  score -= state.stats.STRESS > 60 ? 5 : 0;
  if (state.market && state.market.debt > worth * 2 && worth > 0) score -= 6;
  return Math.round(clamp(score, 0, 100));
}

/* =========================================================
 * v6.2.2 动态一生大结局文本生成器（碑文 · 平生总结）
 * 三条轴 + 总评，拼出 ~300 字沧桑叙事：
 *   ① 职业与社会地位  ② 情感与家庭  ③ 财富与晚景  ④ 一句总评
 * 数据全部来自真实人生（job/flags/配偶/子女/前任/巅峰净资产/成就…）。
 * 生成一次后写进 state.epitaph 随存档持久化，重开结算页不会变脸。
 * ========================================================= */
function lifeEpitaph(state) {
  const s = state.stats, f = state.flags || {};
  const worth = worthOf(state);
  const peak = Math.max((state.peak && (state.peak.NET || state.peak.MONEY)) || 0, worth);
  const y1 = state.startYear || (typeof START_YEAR !== 'undefined' ? START_YEAR : 2000);
  const y2 = y1 + (state.age || 0);
  const sp = state.spouse;
  const kids = (state.children || []).filter(c => c.alive !== false).length;
  const bastards = (state.children || []).filter(c => c.illegit).length;
  const exN = (state.exes || []).length;
  const ach = state.achievements || [];
  const job = String(state.job || '');
  const fame = s.FAME || 0;
  const eth = s.ETH || 0;
  const love = s.LOVE || 0;
  const pick = arr => arr[randInt(0, arr.length - 1)];

  /* 开篇 */
  const opener = pick([
    `${y1} 年，你哭着来到这个世界；${y2} 年，世界安静地送你离开。${state.age} 年，就这么过去了。`,
    `从 ${y1} 到 ${y2}，${state.age} 年。掌声与嘘声都停了，幕布缓缓落下。`,
    `${y2} 年，讣告只有短短一行。可这一行字背后，是 ${state.age} 年的鸡毛与星光。`
  ]);

  /* ① 职业与社会地位 */
  let career;
  if (ach.indexOf('a_astro') >= 0 || /宇航|航天/.test(job)) {
    career = pick([
      '你曾替这个时代仰望星空。返回舱划破夜空的那一晚，无数人仰起头，在光里找你的名字。',
      '从发射场的烈焰到失重中的寂静，你走过的路，比大多数人想象的一生都远。'
    ]);
  } else if (ach.indexOf('a_jail') >= 0 || f.ex_prisoner || state.prison > 0) {
    career = pick([
      '你的名字更多出现在卷宗里，而不是光荣榜上。铁窗内那几年，给后半生都染上了颜色。',
      '出狱那天没有人接你。后来的每个黄昏，你都在证明自己不止是档案上的那个编号。'
    ]);
  } else if (/教师|教授|老师/.test(job)) {
    career = pick([
      '三尺讲台，一站几十年。毕业的学生散在世界各地，提起你，都叫一声「先生」。',
      '粉笔灰落满了袖口，也落出了桃李满天下。你没大富大贵，却改写了无数人的命运走向。'
    ]);
  } else if (/医生|大夫|院士|科研|工程师/.test(job)) {
    career = pick([
      '无影灯与实验室的白炽灯，照亮了同一个执念：让人活得更好一点，再好一点。',
      '你的名字印在论文的角注里，却在无数陌生人的生命里续着章节。'
    ]);
  } else if (peak >= 100e8 || /董事长|总裁|主席/.test(job)) {
    career = pick([
      '你缔造了一个商业帝国。谈判桌上的每一次沉默，都曾让对面的城市彻夜灯火通明。',
      '从第一桶金到千亿帝国，你在刀锋上走了半生。传说里有你，骂声里也有你。'
    ]);
  } else if (peak >= 10e8) {
    career = pick([
      '你发过财，也守过财。行情软件里的账户曲线，就是你这半生心电图。',
      '没人知道你到底多有钱——你只说「够用」。只有账本知道，那些数字惊心动魄过。'
    ]);
  } else if (fame >= 55 || /演员|歌手|导演|明星/.test(job)) {
    career = pick([
      '海报会褪色，胶片会泛黄，但那个角色永远定格在时代的放映机里。',
      '聚光灯追了你半生。你谢幕时，整个时代的观众都站了起来。'
    ]);
  } else if (fame < 12 && peak < 2e8) {
    career = pick([
      '你这一生安静得像一滴水落进江里。没有人给你写传记，可你把身边人的人生都焐热了。',
      '世界不记得你的名字，但你修好的那台机器、帮过的那个人，都还记得。'
    ]);
  } else {
    career = pick([
      '你在平凡的岗位上把一件事做了几十年。不出彩，也从没让相信你的人失望。',
      '一辈子没站上过什么大舞台，可生活给你的每一个角色，你都演得认真。'
    ]);
  }

  /* ② 情感与家庭 */
  let family;
  const affSp = sp ? (sp.affinity || 60) : 0;
  if (sp && sp.alive !== false && affSp >= 78 && exN <= 1 && bastards === 0 && (kids >= 3 || f.grand)) {
    family = pick([
      `你这一生只爱过一个人，也只牵过一双手。膝下 ${kids} 个孩子，孙辈绕床——痴情与兴旺，你占全了。`,
      `从青丝到白发，同一双手握了一辈子。膝下 ${kids} 个孩子，逢年过节一屋子人喊你的名号，你在闹声里眯着眼笑。`
    ]);
  } else if (sp && sp.alive !== false && affSp >= 78 && exN <= 1 && bastards === 0) {
    family = pick([
      '这一生你只爱过一个人。从青丝到白发，同一双手握了一辈子——这大概是人间最奢侈的胜利。',
      '你们的婚姻熬过了穷日子、病榻和漫长的争吵，最后连吵架都变成了舍不得。金婚那天，你说：下辈子还找她。'
    ]);
  } else if (bastards >= 2 || (bastards >= 1 && f.exposed)) {
    family = pick([
      `葬礼那天来了两拨人：灵堂里的，和灵堂外替孩子争产的。${bastards} 个私生子的名字，是你留给世界的注脚，也是你带不走的骂名。`,
      `你藏了一辈子的私生子，最后都站在了你的墓前。血缘是躲不掉的债，骂名是还不清的账。`
    ]);
  } else if (f.exposed || f.spouse_sued || f.blacklisted) {
    family = pick([
      '那段被报纸头条撕开的婚姻，成了你人生里最响的一声耳光。体面这东西，碎过就拼不回原样。',
      '晚年的饭桌上永远空着一把椅子。你赢过很多东西，唯独没赢回那扇为你关上的门。'
    ]);
  } else if (kids >= 3 || (kids >= 1 && f.grand)) {
    family = pick([
      `膝下 ${kids} 个孩子，孙辈绕床。逢年过节一屋子人喊你的名号，你在闹声里眯着眼笑——这就是你的江山。`,
      '你把一个家的火种传了下去。后代未必都成器，但每逢清明，坟前总是满的。'
    ]);
  } else if (kids === 0 && exN >= 2) {
    family = pick([
      `你爱过 ${exN} 个人，也弄丢过 ${exN} 个人。浪子的一生自由得像风，也孤单得像风。`,
      '每一段感情开始时都像烟花，结束时都像退潮。最后陪你的是一只猫，和满墙的旧照片。'
    ]);
  } else if (!f.married) {
    family = pick([
      '你一个人吃饭、一个人看病、一个人过节。自由是真的，深夜里那点空也是真的。',
      '没有婚礼，没有子女。可你把独身的日子过成了自己的形态，不求人懂。'
    ]);
  } else {
    family = pick([
      '婚姻谈不上轰轰烈烈，柴米油盐里两个人互相撑着走完了。这就够难，也够好了。',
      '你们没说过一句「爱」，却把一辈子过成了彼此的托底。'
    ]);
  }

  /* ③ 财富与晚景 */
  let wealth;
  if (f.foundation) {
    wealth = pick([
      '生命的最后几年，你把名下资产几乎全部转进了以自己名字命名的慈善基金。签完最后一份文件那晚，你睡得格外沉。',
      '散尽千金的那一天，你反而觉得自己从未如此富有。被你帮过的人会替你，继续活很多次。'
    ]);
  } else if (peak >= 100e8) {
    wealth = pick([
      '千亿身家，财经版头条的常客。可再贵的病床，也买不回一次普通的散步。',
      '数字后面的零多到数不清，遗嘱却改了又改。你终于明白，财富能安排一切，唯独安排不了告别。'
    ]);
  } else if (peak >= 10e8) {
    wealth = pick([
      '家业足够荫及三代。你晚年最大的爱好，是在阳台上算那些已经不需要算的账。',
      '你给后人留下了房子、股份和一句家训：钱要挣得睡得着觉。'
    ]);
  } else if (peak >= 1e8) {
    wealth = pick([
      '不算大富大贵，但这一生没为钱弯过腰。房子是自己的，晚年是自己做主的。',
      '存折上的数字不算惊人，却撑起了你全部的体面与从容。'
    ]);
  } else if (peak >= 2e7) {
    wealth = pick([
      '小康一生。有惊无险，有盈有亏，年终的账本总能勉强画上一个平局。',
      '你把日子过成了一条平稳的均线——没有奇迹，也没有崩盘。'
    ]);
  } else {
    wealth = pick([
      `你这一生与财富无缘${state.retirePlan ? '，晚年住进养老院，却把海钓鱼竿玩成了院子里最靓的风景' : ''}。清贫，但账目清白，走得坦然。`,
      '最后几年的日子过得紧巴巴，可你总说：穷人有穷人的过法，眼泪解决不了的事，笑可以。'
    ]);
  }

  /* ④ 一句总评 */
  let verdict;
  if (eth >= 75) {
    verdict = pick([
      '认识你的人都说：你这辈子最难得的，是干净。',
      '你没做过亏心事。这五个字，很多人一辈子都挣不来。'
    ]);
  } else if (eth <= 30) {
    verdict = pick([
      '提起你，人们先沉默，再叹气。功过交给碑文，骂声留给风。',
      '你一生精明，唯独没算明白「良心」这笔账。'
    ]);
  } else if (love >= 70 || (s.MOOD || 0) >= 65) {
    verdict = pick([
      '你把温柔给了身边每一个人。被你暖过的人，很多。',
      '认识你的人提起你，都会先笑一下——这就够了。'
    ]);
  } else {
    verdict = pick([
      '你算不上什么大人物，也绝不是无名之辈。',
      '一半是烟火，一半是清欢——这就是你的一生的注脚。'
    ]);
  }

  /* 收尾 */
  const closer = pick([
    '碑上的字会被风雨磨平，但有些夜晚，永远留在了活着的人心里。',
    '一生很长，长到足够原谅一切；一生也很短，短到来不及好好告别。',
    '世界不会记得大多数人的名字，但爱过你的人，记得你的全部。',
    '谢幕不是结束——你改变过的、爱过的、坚持过的，都在继续生长。',
    '尘埃落定，潮水退去，沙滩上留下的形状，就是你。',
    '往后的每一年，仍会有人记得你的生日，只是蜡烛少了一支。',
    '墓志铭写不下一生。一生，也不需要谁来打分。'
  ]);

  return [opener, career, family, wealth, verdict, closer].join('');
}

function finish(state) {
  state.alive = false;
  state.finished = true;
  // v6.2：藏了一辈子的孩子，会在葬礼上出现——法律给他们的权利，和你认不认无关
  if (typeof settleBastardClaims === 'function') settleBastardClaims(state);
  const ending = resolveEnding(state, null);   // 同一条判定路径，只是没有死因
  state.ending = ending;
  state.score = scoreOf(state);
  state.rank = grade(state.score);
  // v6.2.2 一生碑文（结算页展示，随存档持久化）
  if (typeof lifeEpitaph === 'function') state.epitaph = lifeEpitaph(state);
  pushLog(state, `【${fmtYear(state)} 年 · 人生终章】${ending.title}`, 'end');
  pushLog(state, ending.text, 'end');
  return ending;
}

/* =========================================================
 * v6.0.0 引擎挂钩：监狱 / 顶奢 / 赛车 / 搭讪 / 走亲访友送礼 / 图书馆
 * 依赖：pet.js（petTick 在 step 中调用，此处不重复）
 * ========================================================= */

/* ---------- 监狱系统 ---------- */
/* crime_suspect 旗子由违法事件产生；案发 → 宣判 → 服刑（pickEvents 切监狱池，收入中断） */
function prisonTick(state) {
  const f = state.flags;
  if (f.crime_suspect) {
    delete f.crime_suspect;
    if (chance(0.45)) {
      state.prison = randInt(1, 3);
      state.career = null;
      state.job = '服刑中';
      state.courtMsg = true;
      pushLog(state, `【宣判】那天早上，手铐比想象中凉。证据链完整，律师摇头。你被判 ${state.prison} 年。`, 'warn');
      applyEffects(state, { FAME: -10, STRESS: 12, MOOD: -12 });
    } else if (chance(0.6)) {
      pushLog(state, '【风声】那件事最后不了了之。你把相关的人脉悄悄清理了一遍，夜里还是会惊醒。', 'muted');
      applyEffects(state, { STRESS: 5 });
    } else {
      f.crime_suspect = true; // 悬而未决，明年再审
    }
  }
  /* 服刑最后一年在 yearBase 结算出狱（见 yearBase 尾部 v6 段） */
}

/* ---------- 顶奢载具隐藏加成（游艇 / 潜艇 / 公务机 / 飞行汽车） ----------
 * 明面是消费品，暗面是社交杠杆：每年按 perk 给属性，8% 概率带来「饭局机会」变现 */
function luxTick(state) {
  if (typeof LUX_ITEMS === 'undefined' || !state.market || !state.market.props) return;
  let perks = {};
  let hasLux = false;
  // 汇总 perk（车在 CARS，货在 GOODS）
  state.market.props.forEach(p => {
    let ref = null;
    if (p.kind === 'car') ref = (typeof CARS !== 'undefined') ? CARS.find(x => x.id === p.id) : null;
    else if (p.kind === 'good') ref = (typeof GOODS !== 'undefined') ? GOODS.find(x => x.id === p.id) : null;
    if (ref && ref.lux && ref.perk) {
      hasLux = true;
      for (const k in ref.perk) perks[k] = (perks[k] || 0) + ref.perk[k];
    }
  });
  if (!hasLux) return;
  const s = state.stats;
  for (const k in perks) { if (s[k] !== undefined) s[k] += perks[k]; }
  if (chance(0.08)) {
    const deal = randInt(30000000, 260000000);
    s.MONEY += deal;
    s.NET = (s.NET || 0) + 2;
    pushLog(state, `【顶奢局】游艇（或机舱）里的那顿饭，聊成了一笔 ${fmtMoney(deal)} 的生意。船票和机票，从来不只是交通费。`, 'money');
  }
}

/* ---------- 赛车线年度赛季 ----------
 * 拥有赛车（CARS 里带 race 等级）才有比赛；等级越高奖金池越大 */
function raceSeasonTick(state) {
  if (!state.market || !state.market.props) return;
  let best = 0;
  state.market.props.forEach(p => {
    if (p.kind !== 'car') return;
    const ref = (typeof CARS !== 'undefined') ? CARS.find(x => x.id === p.id) : null;
    if (ref && ref.race) best = Math.max(best, ref.race);
  });
  if (!best || state.age < 16 || state.prison > 0) return;
  if (!chance(0.5)) return;
  const s = state.stats;
  const winP = clamp(0.10 + best * 0.05 + (s.STR || 0) / 500, 0.08, 0.55);
  const prize = [0, 12000000, 40000000, 120000000, 400000000][best];
  if (chance(winP)) {
    s.MONEY += prize;
    s.FAME = (s.FAME || 0) + 3 + best * 2;
    state.flags.race_win = true;
    pushLog(state, `【赛车】${['', '卡丁车', '拉力', 'GT 耐力赛', '方程式'][best]}分站冠军！奖金 ${fmtMoney(prize)}。领奖台上的香槟，喷得比油钱还多。`, 'money');
  } else if (chance(0.06)) {
    s.HP -= randInt(3, 9);
    s.MOOD = (s.MOOD || 60) - 4;
    pushLog(state, '【赛车】弯道失控，车转了两圈停在缓冲区。你从驾驶舱爬出来，腿是软的。人没事，就是最大的胜利。', 'warn');
  } else {
    s.MOOD = (s.MOOD || 60) + 2;
    pushLog(state, '【赛车】这个赛季成绩中游。车队的工程师说：调校再好一点，能上领奖台。', 'muted');
  }
}

/* ---------- 搭讪系统（毕业后全年龄段） ----------
 * 单身且非在校生时，每年有概率在街上遇到心动的人：魅力决定搭讪成功率 */
function flirtTick(state) {
  if (state.age < 22 || state.age > 75) return;
  if (isEnrolled(state)) return;
  if (state.flags.married || state.flags.dating) return;
  if (state.prison > 0) return;
  if (!chance(0.30)) return;
  const s = state.stats;
  const lv = loveInit(state);
  // 街头偶遇生成新对象，魅力高的人能要到场联系方式
  const l = makeLover(state, 'street');
  if (!l) return;
  const p = clamp(0.25 + s.CHA / 150, 0.2, 0.85);
  if (chance(p)) {
    lv.candidates.push(l);
    s.CHA = (s.CHA || 0) + 1;
    s.MOOD = (s.MOOD || 60) + 4;
    pushLog(state, `【搭讪】街角的书店门口，你和 ${l.name} 同时伸手拿了同一本书。你开口了——这次没有结巴。要到了联系方式。`, 'muted');
  } else {
    s.MOOD = (s.MOOD || 60) - 2;
    s.WILL = (s.WILL || 0) + 1;
    pushLog(state, `【搭讪】你在咖啡店门口鼓起勇气叫住了 ${l.name}，但对方戴着耳机没有停下。没关系，下一个街口还有下一个人。`, 'muted');
  }
}

/* ---------- 走亲访友送礼（GIFT_CATALOG · 价格显著影响关系值） ----------
 * who: 'father' | 'mother' | 'spouse' | 'child' | 'friend'（friend 带 idx）
 * 一年每人限送一次；礼越重涨得越多，但太贵重也会让人觉得「生分」 */
function familyGift(state, who, giftId, idx) {
  if (!state || state.finished) return { ok: false, msg: '' };
  const g = (typeof GIFT_CATALOG !== 'undefined') ? GIFT_CATALOG.find(x => x.id === giftId) : null;
  if (!g) return { ok: false, msg: '没有这件礼物' };
  const s = state.stats;
  const touch = state.giftTouch = state.giftTouch || {};
  const key = who + (idx != null ? ':' + idx : '');
  if (touch[key] === state.age) return { ok: false, msg: '今年已经送过了' };
  if (s.MONEY < g.cost) return { ok: false, msg: '这份礼太重了，钱包撑不住' };
  s.MONEY -= g.cost;
  touch[key] = state.age;
  const gain = randInt(g.gain[0], g.gain[1]);
  let name = '';
  if (who === 'father' || who === 'mother') {
    const p = parentOf(state, who);
    if (!p || !p.alive) { delete touch[key]; return { ok: false, msg: '已经不在了' }; }
    p.affinity = clamp((p.affinity || 50) + gain, 0, 100);
    name = (who === 'father' ? '父亲 ' : '母亲 ') + p.name;
    s.LOVE = (s.LOVE || 0) + 2; s.SEC = (s.SEC || 0) + 1;
  } else if (who === 'spouse') {
    const married = !!state.flags.married;
    const lv = loveInit(state);
    const l = married ? state.spouse : lv.partner;
    if (!l || l.alive === false) { delete touch[key]; return { ok: false, msg: '身边没有那个人' }; }
    l.affinity = clamp((l.affinity || 60) + gain + 2, 0, 100);
    name = l.name;
    s.LOVE = (s.LOVE || 0) + 3; s.MOOD = (s.MOOD || 60) + 3;
  } else if (who === 'child') {
    if (!state.childCount) { delete touch[key]; return { ok: false, msg: '你还没有孩子' }; }
    s.LOVE = (s.LOVE || 0) + 3; s.GROW = (s.GROW || 0) + 2;
    name = '孩子们';
  } else if (who === 'friend') {
    const fr = state.friends && state.friends[idx];
    if (!fr) { delete touch[key]; return { ok: false, msg: '没有这位朋友' }; }
    fr.affinity = clamp(fr.affinity + gain, 0, 100);
    name = fr.name;
    s.NET = (s.NET || 0) + 2;
  } else { delete touch[key]; return { ok: false, msg: '' }; }
  pushLog(state, `【送礼】你给 ${name} 备了${g.name}。${g.desc}（好感 +${gain}）`, 'muted');
  applyEffects(state, {});
  return { ok: true, gain };
}

/* ---------- 图书馆系统 ----------
 * 一年一次：泡图书馆 → 智力成长；智力够高会触发「超级大脑」电视赛邀请 */
function libraryStudy(state) {
  if (!state || state.finished) return { ok: false, msg: '' };
  if (state.prison > 0) return { ok: false, msg: '高墙里只有监狱图书室' };
  const touch = state.socialTouch = state.socialTouch || {};
  if (touch.library === state.age) return { ok: false, msg: '今年已经泡过图书馆了' };
  touch.library = state.age;
  const s = state.stats;
  s.INT = (s.INT || 0) + randInt(2, 4);
  s.WILL = (s.WILL || 0) + 1;
  s.CUR = (s.CUR || 0) + 2;
  s.STRESS = Math.max(0, (s.STRESS || 0) - 3);
  pushLog(state, '【图书馆】你占了靠窗的老位置，读完了一直想读的那本书。闭馆音乐响起时，天已经黑透了。', 'muted');
  // 超级大脑大赛：智力门槛 70，答对率跟智力走
  if (s.INT >= 70 && chance(0.25)) {
    const p = clamp((s.INT - 60) / 60, 0.15, 0.8);
    if (chance(p)) {
      s.MONEY += 60000000;
      s.FAME = (s.FAME || 0) + 10;
      state.flags.superbrain_win = true;
      pushLog(state, '【超级大脑】电视台的邀请函是真的。直播里你顶住了压力答完最后一题，奖杯和 3333 万奖金一起递了过来。', 'money');
      return { ok: true, superbrain: true };
    }
    pushLog(state, '【超级大脑】你也上了那档节目，可惜在一道天文题上卡了壳。全国人民记住了你的遗憾，也记住了你的名字。', 'muted');
    s.FAME = (s.FAME || 0) + 3;
  }
  return { ok: true };
}

/* =========================================================
 * v6.1.0 引擎挂钩：银发经济 / 养老服务 / 圈层系统
 * ========================================================= */

/* ---------- 养老服务（58 岁起可入住，按档位年费+属性） ----------
 * 扣不起年费自动退宿——晚年也要面对账本 */
const RETIRE_PLANS = [
  { id: 'ret_home', name: '居家养老', icon: '🏠', fee: 3000000, eff: { HP: 2, MOOD: 2 }, desc: '请一位住家阿姨，老屋里的日子照旧过。' },
  { id: 'ret_community', name: '社区养老院', icon: '🏘', fee: 12000000, eff: { HP: 4, MOOD: 5 }, desc: '楼下就是活动室，老伙计们凑一桌就是一天。' },
  { id: 'ret_lux', name: '顶奢颐养中心', icon: '🏦', fee: 60000000, eff: { HP: 7, MOOD: 8, CHA: 1 }, desc: '江景套房、私人医生、米其林主厨的老年餐桌。' },
  { id: 'ret_space', name: '轨道养老站', icon: '🛰', fee: 400000000, minYear: 2075, eff: { HP: 10, MOOD: 12, FAME: 3 }, desc: '头顶是缓缓转动的星河。在这里老去的人，是人类的第一批。' }
];

function setRetirePlan(state, id) {
  if (!state || state.finished) return { ok: false, msg: '' };
  if (state.age < 58) return { ok: false, msg: '58 岁起才能入住养老机构' };
  const p = RETIRE_PLANS.find(x => x.id === id);
  if (!p) return { ok: false, msg: '没有这个养老服务' };
  if (p.minYear && fmtYear(state) < p.minYear) return { ok: false, msg: `${p.minYear} 年之后才有这个技术` };
  if (state.retirePlan === id) return { ok: false, msg: '已经住在这里了' };
  if (state.stats.MONEY < p.fee) return { ok: false, msg: '首付不够' };
  state.retirePlan = id;
  pushLog(state, `【养老】你搬进了${p.name}。${p.desc}`, 'muted');
  return { ok: true };
}

function retireTick(state) {
  if (!state.retirePlan) return;
  const p = RETIRE_PLANS.find(x => x.id === state.retirePlan);
  if (!p || state.age < 58) { state.retirePlan = null; return; }
  if (state.stats.MONEY < p.fee) {
    state.retirePlan = null;
    applyEffects(state, { MOOD: -8, HP: -3 });
    pushLog(state, '【养老】账上的钱付不起这个月的养老账单。你收拾了行李，从中心搬了出来。', 'warn');
    return;
  }
  state.stats.MONEY -= p.fee;
  applyEffects(state, p.eff);
}

/* ---------- 银发再就业（60+ 的第二春，每年各一次） ---------- */

/* 客座教授：学历或智力够高的老人，回大学讲课 */
function silverProfessor(state) {
  if (!state || state.finished) return { ok: false, msg: '' };
  if (state.age < 60) return { ok: false, msg: '60 岁以后再来' };
  if (prisonCheck(state)) return { ok: false, msg: '高墙里没有讲台' };
  if ((state.edu.eduLevel || 0) < 3 && (state.stats.INT || 0) < 70) return { ok: false, msg: '需要本科学历或智力 70 以上' };
  if (state.profYear === state.age) return { ok: false, msg: '今年已经讲过课了' };
  state.profYear = state.age;
  const pay = Math.round((2000000 + (state.stats.INT || 0) * 60000) * (1 + (state.edu.eduLevel || 0) * 0.25));
  state.stats.MONEY += pay;
  state.stats.FAME = (state.stats.FAME || 0) + 2;
  state.stats.MOOD = (state.stats.MOOD || 60) + 3;
  pushLog(state, `【客座教授】商学院请你讲了一学期的「人生的账」。课酬 ${fmtMoney(pay)}，但台下那些眼睛亮起来的年轻人，才是真正的报酬。`, 'money');
  return { ok: true };
}

/* 写自传：把一生的故事卖成版税（按巅峰净资产与成就结算） */
function silverBook(state) {
  if (!state || state.finished) return { ok: false, msg: '' };
  if (state.age < 60) return { ok: false, msg: '故事还不够下酒，60 岁再写' };
  if (prisonCheck(state)) return { ok: false, msg: '高墙里只写得出忏悔录' };
  if (state.bookYear === state.age) return { ok: false, msg: '今年已经写过了' };
  state.bookYear = state.age;
  const peakNet = (state.peak && (state.peak.NET || state.peak.MONEY)) || 0;
  const royalty = Math.round(clamp(peakNet * 0.003, 2000000, 80000000) + (state.achievements || []).length * 1500000);
  state.stats.MONEY += royalty;
  state.stats.FAME = (state.stats.FAME || 0) + 3;
  state.stats.MOOD = (state.stats.MOOD || 60) + 5;
  pushLog(state, `【自传】你花了一年把这一生写在纸上。首印五十万册，版税 ${fmtMoney(royalty)}。有读者说：这本书比成功学好读，比小说疼。`, 'money');
  return { ok: true };
}

/* 慈善基金会：一次性大额出资，买不来的道德与声望 */
const FUND_COST = 100000000;
function silverFund(state) {
  if (!state || state.finished) return { ok: false, msg: '' };
  if (state.flags.foundation) return { ok: false, msg: '基金会已经跑起来了' };
  if (state.age < 50) return { ok: false, msg: '50 岁以后再说——做慈善不急于一时，但得先有得捐' };
  if (state.stats.MONEY < FUND_COST) return { ok: false, msg: `需要现金 ${fmtMoney(FUND_COST)}` };
  if (prisonCheck(state)) return { ok: false, msg: '高墙里做不了慈善' };
  state.stats.MONEY -= FUND_COST;
  state.flags.foundation = true;
  applyEffects(state, { ETH: 12, FAME: 12, MOOD: 8 });
  pushLog(state, '【基金会】以你名字命名的慈善基金会成立了。第一批款项打向了山区的一百间教室。发布会上你没提钱，只说了句「该还的」。', 'story');
  return { ok: true };
}

/* ---------- 圈层系统（俱乐部 / 商会） ----------
 * 入会看身家与身份，年费自动扣；扣不起会被「劝退」。
 * 圈层每年有专属事件：赞助商 / 内幕消息（可能是假的）/ 联合投资。 */
const CLUBS = [
  { id: 'club_race', name: '赛车手俱乐部', icon: '🏁', fee: 8000000, desc: '技师、调校师、赞助商。轮胎还热着，酒就端上来了。' },
  { id: 'club_yacht', name: '游艇会', icon: '🛥', fee: 30000000, desc: '甲板上的话题只有两个：船，和下一笔大钱。' },
  { id: 'club_chamber', name: '商会', icon: '🏛', fee: 15000000, desc: '乡贤、行长、老钱。圆桌上的座位按身家排。' }
];

function clubJoinable(state, id) {
  if (!state || state.finished) return false;
  const net = netWorth(state);
  if (id === 'club_race') {
    const hasRace = (state.market && state.market.props || []).some(p => {
      if (p.kind !== 'car') return false;
      const ref = (typeof CARS !== 'undefined') ? CARS.find(x => x.id === p.refId) : null;
      return !!(ref && ref.race);
    });
    return state.age >= 18 && (hasRace || !!(state.career && ['racer_k', 'racer_pro', 'jockey'].indexOf(state.career.id) >= 0));
  }
  if (id === 'club_yacht') return state.age >= 25 && net >= 300000000;
  if (id === 'club_chamber') return state.age >= 25 && net >= 80000000;
  return false;
}

function clubJoin(state, id) {
  const c = CLUBS.find(x => x.id === id);
  if (!c) return { ok: false, msg: '' };
  if ((state.clubs || []).indexOf(id) >= 0) return { ok: false, msg: '你已经是会员了' };
  if (!clubJoinable(state, id)) return { ok: false, msg: '圈层的门槛还没够到（身家 / 身份不够）' };
  if (state.stats.MONEY < c.fee) return { ok: false, msg: `入会费 ${fmtMoney(c.fee)} 不够` };
  state.clubs = state.clubs || [];
  state.clubs.push(id);
  state.stats.MONEY -= c.fee;
  state.stats.NET = (state.stats.NET || 0) + 3;
  pushLog(state, `【圈层】你交了 ${fmtMoney(c.fee)} 入会费，${c.name}的名册上多了你的名字。${c.desc}`, 'story');
  return { ok: true };
}

function clubTick(state) {
  if (!state.clubs || !state.clubs.length || state.prison > 0) return;
  // 年费：扣不起则被劝退
  state.clubs = state.clubs.filter(id => {
    const c = CLUBS.find(x => x.id === id);
    if (!c) return false;
    if (state.stats.MONEY < c.fee) {
      pushLog(state, `【圈层】会费拖了一期又一期，秘书处「非常遗憾」地暂停了你的会员资格。人走茶凉，茶还没凉透。`, 'warn');
      return false;
    }
    state.stats.MONEY -= c.fee;
    return true;
  });
  state.clubs.forEach(id => {
    const s = state.stats;
    if (id === 'club_race' && chance(0.35)) {
      const deal = randInt(20000000, 100000000);
      s.MONEY += deal;
      s.FAME = (s.FAME || 0) + 2;
      pushLog(state, `【赞助商】俱乐部的老朋友把涂装位卖了：车身印上对方的 logo，赞助费 ${fmtMoney(deal)} 到账。你从此跑的不是车，是广告位。`, 'money');
    } else if (id === 'club_yacht' && chance(0.3)) {
      // 内幕消息：指定一只股票明年的行情。22% 概率消息是假的——圈层也会割圈层
      const stk = STOCKS.filter(x => x.sector.indexOf('指数') < 0);
      const t = stk[randInt(0, stk.length - 1)];
      const wrong = chance(0.22);
      state.market.tip = { id: t.id, name: t.name, k: wrong ? -(randInt(30, 55) / 100) : (randInt(25, 70) / 100), wrong: wrong };
      pushLog(state, `【内幕】香槟过三巡，有人压低声音：「${t.name}，里面有动作，明年这个时候见分晓。」你端着杯子没说话，把这句话咽了下去。`, 'muted');
    } else if (id === 'club_chamber' && chance(0.25)) {
      const put = Math.round(clamp(s.MONEY * 0.15, 10000000, 500000000));
      if (put >= 10000000) {
        s.MONEY -= put;
        state.investments.push({ name: '商会联合体项目', amount: put, yearsLeft: 2, base: 1.55, vol: 0.6, kind: 'venture' });
        pushLog(state, `【联合投资】圆桌上的几个老钱凑了个盘子，你按身家出了 ${fmtMoney(put)}。商会会长说：这次的项目，亏了算大家的，赚了……也是大家的。`, 'money');
      }
    }
  });
}

/* 监狱检查的小工具：服刑中禁止对外活动 */
function prisonCheck(state) { return (state.prison || 0) > 0; }

/* =========================================================
 * v6.2.0 · 常识自洽四象限（权利对称 / 因果闭环 / NPC 对等 / 尺度自洽）
 * ========================================================= */

/* ---------- 象限一：房产税与空置税（有其利，必有其弊） ----------
 * 第一套自住免征；从第二套起累进；有租金收益的商业地产税率减半；
 * 住宅没有租金收入 → 视为空置，额外加空置税。买房越多，每年越痛。 */
const PROP_TAX = {
  freeCount: 1,
  baseRate: 0.006,
  stepRate: 0.0035,
  capRate: 0.045,
  vacantRate: 0.010
};

function propertyTaxTick(state) {
  if (!state.market || !state.market.props) return 0;
  const houses = state.market.props.filter(p => p.kind === 'house');
  if (houses.length <= PROP_TAX.freeCount) return 0;
  // 最值钱的一套算自住，其余从第二套起累进
  const sorted = houses.slice().sort((a, b) => (b.value || 0) - (a.value || 0));
  let tax = 0;
  for (let i = PROP_TAX.freeCount; i < sorted.length; i++) {
    const p = sorted[i];
    const ref = (typeof HOUSES !== 'undefined') ? HOUSES.find(h => h.id === p.refId) : null;
    const v = p.value || 0;
    let rate = Math.min(PROP_TAX.capRate, PROP_TAX.baseRate + PROP_TAX.stepRate * (i - PROP_TAX.freeCount));
    const rented = !!(ref && (ref.rent || 0) > 0);
    if (rented) rate *= 0.5; else rate += PROP_TAX.vacantRate;   // 有租抵一半，没租算空置
    tax += Math.round(v * rate);
  }
  if (tax <= 0) return 0;
  // 年代缩放：80 年代的税基和 2030 年代不是一回事
  tax = Math.round(tax * (typeof eraK === 'function' ? eraK(state) : 1));
  state.stats.MONEY -= tax;
  state.market.propTax = tax;
  pushLog(state, `【房产税】你名下 ${houses.length} 套房产，今年缴了 ${fmtMoney(tax)}。` +
    `（自住一套免征，其余累进；空置的房子还要多交一笔空置税）`, 'warn');
  return tax;
}

/* ---------- 象限二：顶奢载具的连锁反应（有输入，必有输出） ----------
 * 以前买了顶奢车只在资产表上躺着一个数字；现在它会在该出现的地方说话：
 * 相亲的排面、求婚的底气、度假的体验、搭讪的成功率。 */
function luxCarBonus(state) {
  if (!state.market || !state.market.props) return { cha: 0, net: 0, tier: 0, name: '' };
  let cha = 0, net = 0, tier = 0, name = '';
  state.market.props.forEach(p => {
    let ref = null;
    if (p.kind === 'car') ref = (typeof CARS !== 'undefined') ? CARS.find(x => x.id === p.refId) : null;
    else if (p.kind === 'good') ref = (typeof GOODS !== 'undefined') ? GOODS.find(x => x.id === p.refId) : null;
    if (!ref) return;
    const c = ref.cha || 0, n = ref.net || 0;
    if (ref.lux) { cha += c * 1.0; net += n * 1.0; if (tier < 3) { tier = 3; name = ref.name; } }
    else if (ref.race) { cha += c * 0.8; net += n * 0.6; if (tier < 2) { tier = 2; name = ref.name; } }
    else if (c >= 9) { cha += c * 0.7; net += n * 0.5; if (tier < 1) { tier = 1; name = ref.name; } }
  });
  return { cha: Math.round(cha), net: Math.round(net), tier, name };
}

/* 座驾加成：相亲对象质量 / 求婚成功率 / 度假体验 / 搭讪成功率 都吃这一份 */
function rideBonus(state) {
  const b = luxCarBonus(state);
  return {
    tier: b.tier, name: b.name, cha: b.cha, net: b.net,
    matchQ: Math.round(b.cha * 0.35),                 // 相亲对象质量
    proposeP: clamp(b.cha / 320, 0, 0.12),            // 求婚成功率
    vacMood: b.tier >= 3 ? 6 : (b.tier === 2 ? 3 : 1),// 度假心情加成
    flirtP: clamp(b.cha / 420, 0, 0.10)               // 搭讪成功率
  };
}

/* ---------- 象限二：案底封杀（坐过牢，就当不了老师） ---------- */
const RECORD_BLOCKED_CATS = ['体制内', '教育', '医疗', '法律'];
const RECORD_BLOCKED_IDS = ['pilot', 'cabincrew', 'astronaut', 'sforce', 'civil', 'teacher', 'doctor', 'nurse', 'lawyer', 'psychiatrist', 'mortician'];

function recordBlocked(state, c) {
  if (!state.flags || !state.flags.ex_prisoner || !c) return null;
  if (RECORD_BLOCKED_IDS.indexOf(c.id) >= 0) return '有案底，政审过不去';
  if (RECORD_BLOCKED_CATS.indexOf(c.cat) >= 0) return '有案底，这一行要开无犯罪记录证明';
  return null;
}

/* ---------- 象限三：NPC 行为对等 ---------- */

/* 配偶在外面也有人：从「共处」那天起，TA 就不是省油的灯了 */
function makeSpouseAffairEvent(state) {
  const sp = state.spouse || { name: '你爱人' };
  const hasKid = (state.children || []).some(c => c.alive !== false && !c.illegit);
  return {
    id: 'spouseaffair_at_' + state.age,
    age: [22, 200], w: 0,
    text: `【TA 也有别人了】${sp.name} 的手机亮在床头，备注是「张总」。\n` +
      `你忽然想起自己这一年删掉的那些聊天记录——原来这个家里，不只有你一个人在撒谎。`,
    choices: [
      { text: '装不知道：把手机放回去', risk: 2, eff: { LOVE: -6, SEC: -6, MOOD: -4, ETH: -2 }, flags: ['sa_ignore'] },
      { text: '摊牌：把话挑明', risk: 3, eff: { LOVE: -10, SEC: -8, STRESS: 12 }, flags: ['sa_confront'] },
      ...(hasKid ? [{ text: `做一次亲子鉴定（${fmtMoney(3000000)}）`, risk: 3, eff: { MONEY: -3000000, STRESS: 10 }, flags: ['sa_paternity'] }] : [])
    ]
  };
}

function makeCuckooEvent(state, kid) {
  return {
    id: 'cuckoo_at_' + state.age,
    age: [22, 200], w: 0,
    text: `【不是你的孩子】${kid ? kid.name : '这个孩子'} 的鉴定报告压在抽屉最底层。\n` +
      `你可以打官司要回这些年花掉的抚养费，也可以继续当 TA 的爸爸——` +
      `只是每次 TA 喊你的时候，你都会想起那张纸。`,
    choices: [
      { text: '起诉：把抚养费要回来（名声与亲情一起赔进去）', risk: 3, eff: { MONEY: 40000000, ETH: -10, LOVE: -20, FAME: -10, MOOD: -10 }, flags: ['ck_sue'] },
      { text: '当没发生过：TA 还是你的孩子', risk: 2, eff: { ETH: 6, LOVE: 4, MOOD: -6, WILL: 4 }, flags: ['ck_keep'] },
      { text: '离婚，什么都别说了', risk: 3, eff: { LOVE: -24, SEC: -16, ETH: -6 }, flags: ['ck_divorce'] }
    ]
  };
}

/* 配偶主动提离婚：不是只有玩家能掀桌子 */
function spouseInitiateDivorce(state) {
  const sp = state.spouse;
  if (!sp || !sp.alive) return false;
  const aff = sp.affinity || 60;
  let p = 0;
  if (aff <= 18) p = 0.30;
  else if (aff <= 30) p = 0.14;
  else if (aff <= 42) p = 0.05;
  if (state.flags.spouse_terms && aff <= 50) p += 0.10;
  if ((sp.suspicion || 0) >= 85) p += 0.12;
  if (p <= 0 || !chance(p)) return false;
  state.extraQueue = state.extraQueue || [];
  state.extraQueue.push({ type: 'event', ev: {
    id: 'spousediv_at_' + state.age,
    age: [22, 200], w: 0,
    text: `【${sp.name} 提的】「我们离婚吧。」\n话是 TA 先说出口的。你张了张嘴，发现这些年自己也没准备过别的答案。`,
    choices: [
      { text: '答应：好聚好散', risk: 2, eff: { LOVE: -18, SEC: -12, MOOD: -8, STRESS: 12 }, flags: ['sd_yes'] },
      { text: '挽留：把这几年欠的都补上（要花钱，也不一定有用）', risk: 3, eff: { MONEY: -30000000, STRESS: 8 }, flags: ['sd_beg'] },
      { text: '拖着不离：就这么耗下去', risk: 2, eff: { LOVE: -10, MOOD: -10, SEC: -10, ETH: -4 }, flags: ['sd_stall'] }
    ]
  } });
  return true;
}

/* 配偶藏私房钱：家里的钱不都在你账上 */
function spouseFundTick(state) {
  if (!state.flags.married || !state.spouse || !state.spouse.alive) return 0;
  const sp = state.spouse;
  sp.fund = sp.fund || 0;
  if (state.stats.MONEY < 5000000) return 0;
  let rate = 0.02;
  if ((sp.suspicion || 0) >= 60) rate = 0.06;               // 不信你的时候，先给自己留后路
  if (sp.affair) rate += 0.03;
  if (state.flags.spouse_terms) rate += 0.02;
  const amt = Math.round(state.stats.MONEY * rate);
  if (amt <= 0) return 0;
  state.stats.MONEY -= amt;
  sp.fund += amt;
  // 偶尔会露馅
  if (chance(0.10)) {
    pushLog(state, `【私房钱】你翻存折的时候发现少了一笔。${sp.name} 说：「给孩子存的。」\n` +
      `你没追问。这个家里，谁都在给自己留一条退路。`, 'warn');
  }
  return amt;
}

/* 配偶主动买东西：TA 也是会花钱的社会人 */
function spouseBuyTick(state) {
  if (!state.flags.married || !state.spouse || !state.spouse.alive) return null;
  if (state.stats.MONEY < 30000000 || !chance(0.12)) return null;
  const sp = state.spouse;
  const BUYS = [
    { name: '一台新车', cost: 25000000, eff: { MOOD: 3, CHA: 2 } },
    { name: '一套小户型（写的 TA 自己名字）', cost: 120000000, eff: { MOOD: 4, SEC: -2 } },
    { name: '一块表', cost: 18000000, eff: { MOOD: 2, CHA: 1 } },
    { name: '给孩子报的补习班', cost: 9000000, eff: { MOOD: 2, LOVE: 3 } },
    { name: '一次说走就走的旅行', cost: 12000000, eff: { MOOD: 5, STRESS: -4 } }
  ];
  const b = BUYS[randInt(0, BUYS.length - 1)];
  if (state.stats.MONEY < b.cost) return null;
  state.stats.MONEY -= b.cost;
  applyEffects(state, b.eff);
  pushLog(state, `【${sp.name} 买的】家里多了一笔支出：${b.name}，${fmtMoney(b.cost)}。\n` +
    `TA 没有问过你。你想了想，这些年你也没问过 TA。`, 'muted');
  return b;
}

/* 子女不是摆设：成年后会啃老、会忤逆、会争产 */
function childRevoltTick(state) {
  const kids = (state.children || []).filter(c => c.alive !== false && childAge(state, c) >= 18);
  if (!kids.length) return null;
  if ((state.childRevoltYear || 0) + 4 > state.age) return null;
  if (!chance(0.16)) return null;
  const kid = kids[randInt(0, kids.length - 1)];
  const ca = childAge(state, kid);
  state.childRevoltYear = state.age;
  const scroll = Math.round(Math.max(3000000, Math.min(60000000, (state.stats.MONEY || 0) * 0.08)));
  const ask = [
    {
      id: 'cr_mooch', title: `${kid.name} 要钱`,
      text: `【啃老】${kid.name}（${ca} 岁）把筷子一放：「爸/妈，我这个月房租……」\n` +
        `你已经数不清这是第几次了。TA 有手有脚，也有一份简历。`,
      choices: [
        { text: `给 ${fmtMoney(scroll)}`, risk: 2, eff: { MONEY: -scroll, LOVE: 4, MOOD: -2 }, flags: ['cr_give'] },
        { text: '不给：让 TA 自己想办法', risk: 2, eff: { LOVE: -6, WILL: 3, MOOD: -4, ETH: 2 }, flags: ['cr_no'] },
        { text: `给钱，但要 TA 搬出去住（一次性 ${fmtMoney(scroll * 3)}）`, risk: 3, eff: { MONEY: -scroll * 3, LOVE: -2, SEC: 4, WILL: 4 }, flags: ['cr_kick'] }
      ]
    },
    {
      id: 'cr_fight', title: `${kid.name} 要分家产`,
      text: `【争产】${kid.name}（${ca} 岁）把一份打印好的东西放在你面前：《关于家庭财产明晰化的几点想法》。\n` +
        `你的孩子请了律师，来跟你谈「你还没死的时候」。`,
      choices: [
        { text: '分：现在就把名下的一部分划过去', risk: 3, eff: { MONEY: -Math.round(scroll * 6), LOVE: -4, SEC: -8, MOOD: -8 }, flags: ['cr_split'] },
        { text: '不分：这个家还没到分的时候', risk: 3, eff: { LOVE: -14, MOOD: -10, WILL: 4, SEC: -4 }, flags: ['cr_deny'] },
        { text: '立个规矩：钱可以留，但 TA 得回来接手生意', risk: 2, eff: { LOVE: 3, LOY: 4, NET: 3 }, flags: ['cr_deal'] }
      ]
    },
    {
      id: 'cr_cut', title: `${kid.name} 说不认你了`,
      text: `【忤逆】${kid.name}（${ca} 岁）最后一句话是：「你们从来没问过我想要什么。」\n` +
        `门关上的声音不大，但整个屋子都空了。`,
      choices: [
        { text: '追出去，把话说清楚', risk: 2, eff: { LOVE: 4, MOOD: -4, STRESS: 6 }, flags: ['cr_chase'] },
        { text: '让 TA 走：翅膀硬了就自己飞', risk: 3, eff: { LOVE: -10, WILL: 2, SEC: -3 }, flags: ['cr_letgo'] },
        { text: '什么也不做，坐在原地很久', risk: 1, eff: { LOVE: -6, MOOD: -12, STRESS: 8 }, flags: ['cr_silent'] }
      ]
    }
  ];
  const ev = ask[randInt(0, ask.length - 1)];
  ev.id = ev.id + '_at_' + state.age;
  ev.age = [40, 200]; ev.w = 0;
  state.extraQueue = state.extraQueue || [];
  state.extraQueue.push({ type: 'event', ev: ev });
  return ev;
}

/* ---------- 象限四：时间与精力的尺度自洽 ---------- */

/* 生育力：男女都有窗口，不是只有女的会老 */
function fertility(state, gender, age) {
  const g = gender || state.gender;
  const a = age === undefined ? state.age : age;
  let p = 0, why = '';
  if (g === 'F') {
    if (a < 18) { p = 0.12; why = '身体还没长开，医生不建议'; }
    else if (a <= 30) p = 0.46;
    else if (a <= 35) p = 0.40;
    else if (a <= 39) p = 0.27;
    else if (a <= 43) p = 0.13;
    else if (a <= 45) p = 0.05;
    else { p = 0; why = '医学上已经不可能了'; }
  } else {
    if (a < 18) { p = 0.12; why = '再大一点吧'; }
    else if (a <= 40) p = 0.44;
    else if (a <= 50) p = 0.37;
    else if (a <= 60) p = 0.25;
    else if (a <= 68) p = 0.12;
    else if (a <= 75) p = 0.04;
    else { p = 0; why = '这个年纪，医生只会笑着摇头'; }
  }
  p -= (state.stats.STRESS || 0) / 500;
  if ((state.stats.HP || 60) < 40) p *= 0.6;
  return { p: Math.max(0, p), why: why };
}

/* 高龄产妇：不是生不生得出的问题，是拿命换不换的问题 */
function maternityRisk(state, age) {
  const a = age === undefined ? state.age : age;
  if (state.gender !== 'F') return 0;
  if (a <= 34) return 0;
  if (a <= 38) return 0.04;
  if (a <= 42) return 0.10;
  return 0.18;
}

/* 职业精力冲突：有些行当是全勤的，没有第二职业 */
const FULLTIME_CAREERS = ['astronaut', 'sforce', 'pilot', 'racer_pro', 'racer_k'];
function careerConflictTick(state) {
  if (!state.career) return null;
  if (FULLTIME_CAREERS.indexOf(state.career.id) < 0) return null;
  const hasRaceCar = (state.market && state.market.props || []).some(p => {
    if (p.kind !== 'car') return false;
    const ref = (typeof CARS !== 'undefined') ? CARS.find(x => x.id === p.refId) : null;
    return !!(ref && ref.race);
  });
  const inRaceClub = (state.clubs || []).indexOf('club_race') >= 0;
  if (!hasRaceCar && !inRaceClub) return null;
  if ((state.conflictYear || 0) + 3 > state.age) return null;
  state.conflictYear = state.age;
  applyEffects(state, { LOY: -8, STRESS: 8, MOOD: -4 });
  pushLog(state, `【分身乏术】单位找你谈了一次话：${hasRaceCar ? '车库里那台赛车' : '赛车俱乐部的会员卡'}，` +
    `和你的岗位是两件不能同时做的事。人只有一份精力，这个道理到多大都得认。`, 'warn');
  return true;
}

/* ---------- 四象限年度总闸 ---------- */
function npcTick(state) {
  if (state.prison > 0) return;
  spouseFundTick(state);
  spouseBuyTick(state);
  if (state.flags.married) {
    const sp = state.spouse;
    // 配偶在外面有人 → 迟早会被发现
    if (sp && sp.affair && sp.alive && (sp.affairSince || 0) + 1 <= state.age && chance(0.22)) {
      state.spouseAffairYear = state.age;
      state.extraQueue = state.extraQueue || [];
      state.extraQueue.push({ type: 'event', ev: makeSpouseAffairEvent(state) });
      sp.affairSince = state.age + randInt(1, 3);
    }
    spouseInitiateDivorce(state);
  }
  childRevoltTick(state);
  careerConflictTick(state);
}
