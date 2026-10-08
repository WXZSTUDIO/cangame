/* =========================================================
 * CANGAME v5.5.0 · 脚本化 Playtest 引擎（QA-01）
 * 用法：node playtest-run.js [每人局数]
 * 产出：out/playtest-raw.json / out/event-tally.json / out/experiments.json
 * 说明：只读取 assets/ 引擎，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', '..');   // cangame/
const OUT = path.join(__dirname, 'out');

/* ---------- 注入引擎 ---------- */
function makeCtx() {
  const ctx = {
    console, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat,
    Number, String, Array, Object, Boolean, RegExp, Error, Map, Set,
    setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent,
    window: { addEventListener() {}, innerWidth: 1280 },
    document: {
      addEventListener() {}, getElementById() { return null; },
      querySelectorAll() { return []; }, querySelector() { return null; },
      createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
      body: { appendChild() {}, classList: { add() {}, remove() {} } }
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  };
  vm.createContext(ctx);
  ['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
    'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return ctx;
}

const ctx = makeCtx();

/* ---------- 现金流归因：必须在导出 API 之前包裹 ---------- */
let TAG = 'other';
let BUCKET = null;
function addB(k, v) { if (!BUCKET) return; BUCKET[k] = (BUCKET[k] || 0) + (v || 0); }

function wrapCash(fn, key) {
  if (typeof ctx[fn] !== 'function') return;
  const o = ctx[fn];
  ctx[fn] = function (state) {
    const m0 = state && state.stats ? state.stats.MONEY : 0;
    const prevTag = TAG;
    if (key) TAG = key;
    const r = o.apply(this, arguments);
    TAG = prevTag;
    const m1 = state && state.stats ? state.stats.MONEY : 0;
    addB(key || 'other', m1 - m0);
    return r;
  };
}
const origApplyEffects = ctx.applyEffects;
ctx.applyEffects = function (state, eff, silent) {
  if (eff && typeof eff.MONEY === 'number' && eff.MONEY) addB(TAG, eff.MONEY);
  return origApplyEffects.apply(this, arguments);
};
wrapCash('marketTick', 'carry');
['buyProp', 'sellProp', 'buyStock', 'sellStock', 'repayDebt'].forEach(f => wrapCash(f, 'trade'));
['borrow', 'repayLoan'].forEach(f => wrapCash(f, 'loan'));
['treatIllness'].forEach(f => wrapCash(f, 'medical'));
['buyLottery'].forEach(f => wrapCash(f, 'lottery'));

/* ---------- 导出 API（必须在包裹之后） ---------- */
const A = vm.runInContext(`({
  createGame, step, resolveEvent, eventChoices, resolveExam, answerExamQ, resolveInvest,
  finish, scoreOf, netWorth, careerIncome, livingCost, jobOffers, applyJob, cramSchool,
  doUniActivity, classmateAct, buyProp, sellProp, buyStock, sellStock, repayDebt,
  marketTick, housePrice, carPrice, goodPrice, stockPrice, borrow, loanProducts,
  repayLoan, loanTotal, migrateState, tryBaby, marry, propose, loveInit, loveAct,
  doGoodDeed, buyLottery, fmtMoney, majorCatOf, schoolStageOf, applyEffects,
  HOUSES, CARS, GOODS, STOCKS, CAREERS, FAMILIES, ENDINGS, EVENTS, TALENTS,
  UNIVERSITIES, HIGH_SCHOOLS, EDU_LEVELS, FAMILY_FIN, FIN_SCALE, HOUSE_INDEX,
  MARKET_META, CNY_RATE, JOBS, EXAM_META, GOOD_DEEDS, worthOf, ILLNESS, INVESTMENTS
})`, ctx);

const MAJOR_LABEL = vm.runInContext('MAJOR_LABEL', ctx);
const MAJOR_OF = m => MAJOR_LABEL[m] || '';

const rnd = n => Math.floor(Math.random() * n);
const EV_TALLY = {};
const EV_BY_PERSONA = {};
const CHOICE_COUNT = { 1: 0, 2: 0, 3: 0, 4: 0 };   // 事件选项数分布

/* ---------- 玩家画像 ---------- */
const PERSONAS = {
  steady: {
    cn: '稳健流', desc: '升学 → 对口好工作 → 存钱买房 → 定投高股息。规避风险，优先低风险选项。',
    cram: true, schoolPick: 'best',
    majorPref: ['理工', '金融', '医学', '法律', '师范'],
    gradChoice: 1, kaoyan2Choice: 1, scoutChoice: 2,
    riskMode: 'low',
    jobTarget: ['ai', 'doctor', 'finance', 'programmer', 'civil', 'teacher', 'accountant', 'lawyer', 'pm', 'designer', 'nurse', 'ecom', 'clerk'],
    market: 'house_first', downRatio: 0.5, borrowLoan: false,
    social: 'moderate', doGood: true, lottery: true, treat: true
  },
  aggressive: {
    cn: '激进流', desc: '理性投机：优先赌注与高回报，加杠杆炒股/创业/借贷，但会治病保命。',
    cram: false, schoolPick: 'best',
    majorPref: ['金融', '艺术', '传媒', '理工'],
    gradChoice: 0, kaoyan2Choice: 0, scoutChoice: 1,
    riskMode: 'ev',                     // 期望收益最大化（偏好 gamble）
    jobTarget: ['startup', 'finance', 'hacker', 'anchor', 'ai', 'sales', 'programmer'],
    market: 'stock_first', downRatio: 0.1, borrowLoan: true,
    social: 'moderate', doGood: false, lottery: true, treat: true
  },
  reckless: {
    cn: '亡命流', desc: '盲目地永远点「风险高」的那一个（含生病硬扛），用于验证风险-回报是否失衡。',
    cram: false, schoolPick: 'best', majorPref: [],
    gradChoice: 0, kaoyan2Choice: 0, scoutChoice: 0,
    riskMode: 'high',
    jobTarget: ['startup', 'hacker', 'anchor', 'gamer', 'idol', 'athlete'],
    market: 'stock_first', downRatio: 0.1, borrowLoan: true,
    social: 'none', doGood: false, lottery: true, treat: false
  },
  slacker: {
    cn: '摆烂流', desc: '不刷题、升学随缘走最低门槛、不理财不投资、不主动社交，永远选最省事的那个。',
    cram: false, schoolPick: 'first', majorPref: [],
    gradChoice: 2, kaoyan2Choice: 1, scoutChoice: 0,
    riskMode: 'first',
    jobTarget: [], market: 'none', downRatio: 1, borrowLoan: false,
    social: 'none', doGood: false, lottery: false, treat: true
  },
  explorer: {
    cn: '探索流', desc: '把每个系统都点一遍：校园活动 / 同学互动 / 恋爱 / 向善 / 市场 / 彩票，选项随机。',
    cram: true, schoolPick: 'best', majorPref: [],
    gradChoice: 1, kaoyan2Choice: 1, scoutChoice: 1,
    riskMode: 'random',
    jobTarget: [], market: 'balanced', downRatio: 0.35, borrowLoan: false,
    social: 'full', doGood: true, lottery: true, treat: true
  },
  baseline: {
    cn: '随机基线', desc: '所有选项纯随机，作为内容消耗与稳定性基线对照。',
    cram: false, schoolPick: 'random', majorPref: [], gradChoice: -1, kaoyan2Choice: -1,
    scoutChoice: -1, riskMode: 'random', jobTarget: [], market: 'none',
    downRatio: 0.5, borrowLoan: false, social: 'none', doGood: false, lottery: false, treat: true
  }
};

/* ---------- 选项选择策略 ---------- */
function evUtility(list) {
  // 粗略效用：属性正向加权，压力/钱按重要性折算
  const W = { HP: 2.0, MOOD: 0.6, INT: 1.0, CHA: 0.8, WILL: 0.8, ETH: 0.5, FAME: 1.2, NET: 1.0,
    LOY: 0.8, LOVE: 0.5, SEC: 0.4, STR: 0.4, STRESS: -0.9, MONEY: 1 / 6000000 };
  return list.map(c => {
    let u = 0;
    const acc = (e, w) => { if (!e) return; for (const k in e) u += (e[k] || 0) * (W[k] || 0) * w; };
    acc(c.eff, 1);
    if (c.gamble) { acc(c.gamble.win, c.gamble.p || 0.5); acc(c.gamble.lose, 1 - (c.gamble.p || 0.5)); }
    return u;
  });
}

function pickChoiceIdx(p, st, ev, list) {
  const id = String(ev.id || '');
  if (id.indexOf('major_at_') === 0) {
    if (!p.majorPref.length) return rnd(list.length);
    let best = -1, bestRank = 99;
    list.forEach((c, i) => {
      const r = p.majorPref.indexOf(MAJOR_OF(c.major || ''));
      if (r >= 0 && r < bestRank) { bestRank = r; best = i; }
    });
    return best < 0 ? rnd(list.length) : best;
  }
  if (id.indexOf('grad_at_') === 0) return p.gradChoice < 0 ? rnd(list.length) : Math.min(p.gradChoice, list.length - 1);
  if (id.indexOf('kaoyan2_at_') === 0) return p.kaoyan2Choice < 0 ? rnd(list.length) : Math.min(p.kaoyan2Choice, list.length - 1);
  if (id.indexOf('scout_at_') === 0) return p.scoutChoice < 0 ? rnd(list.length) : Math.min(p.scoutChoice, list.length - 1);
  if (id.indexOf('ill_at_') === 0) {
    if (!p.treat) return 0;                       // 硬扛
    const money = st.stats.MONEY;
    const canHospital = list.length >= 3 && money > 40000000;
    return canHospital ? 2 : (money > 8000000 ? 1 : 0);
  }
  if (p.riskMode === 'first') return 0;
  if (p.riskMode === 'random') return rnd(list.length);
  if (p.riskMode === 'low') {
    let bi = 0, br = 99;
    list.forEach((c, i) => { const r = c.risk || 2; if (r < br) { br = r; bi = i; } });
    return bi;
  }
  if (p.riskMode === 'high') {
    let bi = list.length - 1, br = -1;
    list.forEach((c, i) => { const r = c.risk || 2; if (r >= br) { br = r; bi = i; } });
    return bi;
  }
  // ev：期望效用最大，并偏好带赌注的选项（激进偏好方差）
  const u = evUtility(list);
  let bi = 0, bu = -Infinity;
  list.forEach((c, i) => {
    let v = u[i] + (c.gamble ? 1.5 : 0);
    if (v > bu) { bu = v; bi = i; }
  });
  return bi;
}

/* ---------- 单局模拟 ---------- */
function playOne(pname, p, opts) {
  opts = opts || {};
  const famId = opts.familyId || A.FAMILIES[rnd(A.FAMILIES.length)].id;
  const st = A.createGame({
    name: '测试',
    gender: Math.random() < 0.5 ? 'M' : 'F',
    familyId: famId,
    priority: p === PERSONAS.steady ? 'career' : (p === PERSONAS.slacker ? 'balance' : 'success'),
    talents: [],
    startYear: opts.startYear || undefined
  });

  const rec = {
    persona: pname, familyId: famId, familyName: st.familyName,
    startYear: st.startYear, gender: st.gender,
    netSeries: {}, cashSeries: {}, choicesPerYear: {}, jobs: {}, salaries: {},
    uniqSet: {},
    totalEvents: 0, yearsWithContent: 0, idleYears: 0, totalYears: 0,
    buckets: { salary: 0, event: 0, carry: 0, trade: 0, loan: 0, medical: 0, lottery: 0, other: 0 },
    firstJobAge: null, firstJob: null, firstHouseAge: null, firstHouse: null,
    firstStockAge: null, marryAge: null, firstKidAge: null,
    buyFail: 0, housePriceAt30: null, incomeAt30: null, costAt30: null,
    deathAge: null, end: null, forcedCareer: opts.forceCareer || null,
    jobSwitches: 0, lastCareerId: null
  };

  let yearMoney0 = st.stats.MONEY;
  BUCKET = {};

  function closeYear() {
    const d = st.stats.MONEY - yearMoney0;
    let known = 0;
    for (const k in BUCKET) { known += BUCKET[k]; rec.buckets[k] = (rec.buckets[k] || 0) + BUCKET[k]; }
    rec.buckets.salary = (rec.buckets.salary || 0) + (d - known);
    BUCKET = {};
    yearMoney0 = st.stats.MONEY;
  }

  let guard = 0, contentThisYear = 0;

  while (!st.finished && guard++ < 4000) {
    const beforeAge = st.age;
    const item = A.step(st);

    if (st.age !== beforeAge) {
      rec.totalYears = Math.max(rec.totalYears, beforeAge);
      if (contentThisYear > 0) rec.yearsWithContent++; else rec.idleYears++;
      rec.choicesPerYear[beforeAge] = contentThisYear;
      contentThisYear = 0;
      closeYear();
      rec.netSeries[st.age] = A.netWorth(st);
      rec.cashSeries[st.age] = st.stats.MONEY;
      rec.jobs[st.age] = st.job;
      rec.salaries[st.age] = A.careerIncome(st);
      if (st.career && rec.lastCareerId && st.career.id !== rec.lastCareerId) rec.jobSwitches++;
      if (st.career) rec.lastCareerId = st.career.id;
      if (rec.firstJobAge == null && st.age >= 18 && st.career) { rec.firstJobAge = st.age; rec.firstJob = st.job; }
      if (st.age === 18 && rec.famAt18 == null) {
        rec.famAt18 = { assets: Math.round(st.family ? st.family.assets : 0), debt: Math.round(st.family ? st.family.debt : 0) };
        rec.netAt18 = A.netWorth(st);
      }
    }
    if (!item || item.type === 'end') break;

    doPlayerActions(p, st, rec);

    if (item.type === 'year') continue;

    if (item.type === 'exam') {
      contentThisYear++;
      st.pending = item;
      let g = 0;
      while (item.exam && item.exam.quiz && !item.exam.quiz.done && g++ < 20) A.answerExamQ(st, rnd(4));
      const o2 = item.exam.options || [];
      if (o2.length) {
        const open = o2.map((o, i) => ({ o, i })).filter(x => !x.o.locked);
        let idx = -1;
        if (open.length) {
          if (p.schoolPick === 'best') { open.sort((a, b) => (b.o.tier || 0) - (a.o.tier || 0)); idx = open[0].i; }
          else if (p.schoolPick === 'first') idx = open[0].i;
          else idx = open[rnd(open.length)].i;
        }
        if (idx >= 0) A.resolveExam(st, idx);
      }
      st.pending = null;
      continue;
    }

    if (item.type === 'event') {
      contentThisYear++;
      const ev = item.ev;
      const base = String(ev.id || '?').replace(/_\d+_\w+$/, '_at').replace(/_\d+$/, '_at');
      rec.totalEvents++;
      rec.uniqSet[base] = 1;
      EV_TALLY[base] = (EV_TALLY[base] || 0) + 1;
      (EV_BY_PERSONA[pname] || (EV_BY_PERSONA[pname] = {}))[base] =
        ((EV_BY_PERSONA[pname] || {})[base] || 0) + 1;
      const list = A.eventChoices(st, ev) || [];
      const n = list.length;
      if (n >= 1 && n <= 4) CHOICE_COUNT[n] = (CHOICE_COUNT[n] || 0) + 1;
      const idx = list.length ? pickChoiceIdx(p, st, ev, list) : -1;
      TAG = 'event';
      A.resolveEvent(st, ev, idx);
      TAG = 'other';
      continue;
    }

    if (item.type === 'invest') {
      contentThisYear++;
      const cs = item.choices || [];
      let pick = null;
      if (p.market === 'none') pick = cs[cs.length - 1];
      else {
        const ok = cs.filter(c => !c.disabled && c.act === 'invest');
        pick = ok.length ? (p.riskMode === 'high' || p.market === 'stock_first' ? ok[ok.length - 1]
          : (Math.random() < 0.8 ? ok[0] : ok[ok.length - 1])) : cs[cs.length - 1];
      }
      TAG = 'event';
      if (pick) A.resolveInvest(st, pick);
      TAG = 'other';
    }
  }
  if (!st.finished) A.finish(st);

  /* ⚠️ cause 必须单独记：S-04 之后 `end_dead` 已**不在** ENDINGS 表里（16 条正式结局里没有它），
   * 死因改挂在 `state.ending.cause` 上。若只记 `id === 'end_dead'`，该指标会结构性恒为 0。 */
  rec.end = {
    id: st.ending ? st.ending.id : 'none',
    title: st.ending ? st.ending.title : '—',
    rank: st.ending ? st.ending.rank : '—',
    cause: st.ending ? (st.ending.cause || null) : null
  };
  rec.score = st.score != null ? st.score : A.scoreOf(st);
  rec.rank = st.rank || '—';
  rec.deathAge = st.age;
  rec.finalNet = A.netWorth(st);
  rec.finalCash = st.stats.MONEY;
  rec.peakNet = st.peak ? st.peak.NET : 0;
  rec.props = (st.market && st.market.props || []).map(x => ({ kind: x.kind, name: x.name, value: x.value }));
  rec.stockValue = ctx.stockValue(st);
  rec.debt = st.market ? st.market.debt : 0;
  rec.edu = { hs: st.edu.hs, uni: st.edu.uni, level: st.edu.eduLevel, major: st.edu.major, mid: st.edu.mid, gao: st.edu.gao, study: Math.round(st.edu.study || 0) };
  rec.childCount = st.childCount || 0;
  rec.married = !!st.flags.married;
  rec.achievements = (st.achievements || []).length;
  rec.ownHouse = !!st.flags.own_house;
  rec.finalCareer = st.career ? st.career.id : null;
  rec.finalJob = st.job;
  rec.finalStats = {
    HP: Math.round(st.stats.HP), MOOD: Math.round(st.stats.MOOD), INT: Math.round(st.stats.INT),
    CHA: Math.round(st.stats.CHA), WILL: Math.round(st.stats.WILL), ETH: Math.round(st.stats.ETH),
    FAME: Math.round(st.stats.FAME), NET: Math.round(st.stats.NET), STRESS: Math.round(st.stats.STRESS),
    LOY: Math.round(st.stats.LOY), LOVE: Math.round(st.stats.LOVE)
  };
  rec.uniqEvents = Object.keys(rec.uniqSet).length;
  delete rec.uniqSet;
  return rec;
}

/* ---------- 玩家年度行为 ---------- */
function doPlayerActions(p, st, rec) {
  const y = st.startYear + st.age;
  if (p.cram && st.age >= 13 && st.age < A.EXAM_META.gaoAge && (st.edu.study || 0) < A.EXAM_META.studyCap) A.cramSchool(st);
  if (p.social === 'full' && st.edu.uni && st.edu.uni !== 'u_fail' && st.age <= (st.edu.gradAge || 22)) {
    const acts = ['a_study', 'a_club', 'a_intern', 'a_parttime', 'a_sport', 'a_kaoyan', 'a_love'];
    A.doUniActivity(st, acts[rnd(acts.length)]);
  }
  if (p.social === 'full' && st.classmates && st.classmates.length) A.classmateAct(st, rnd(Math.min(3, st.classmates.length)));
  if (p.doGood && st.age >= 14 && A.GOOD_DEEDS && A.GOOD_DEEDS.length) A.doGoodDeed(st, A.GOOD_DEEDS[rnd(A.GOOD_DEEDS.length)].id);
  if (p.lottery && st.age >= 12 && st.stats.MONEY > 5000000) { TAG = 'lottery'; try { A.buyLottery(st); } catch (e) { } TAG = 'other'; }
  // 主动就医
  if (p.treat && st.ill && st.stats.MONEY > 40000000) { TAG = 'medical'; try { A.treatIllness ? A.treatIllness(st, 'hospital') : null; } catch (e) { } TAG = 'other'; }

  // 求职
  const gradAge = st.edu.gradAge;
  if (p.jobTarget && p.jobTarget.length && st.age >= 17 && gradAge && st.age >= gradAge &&
    (st.job === '待业' || st.job === '无业')) {
    for (const cid of p.jobTarget) {
      const off = A.jobOffers(st).find(o => o.career.id === cid);
      if (off && off.okEdu && off.okStat && off.okFlag) { A.applyJob(st, cid); break; }
    }
  }
  // 强制职业（阶层流动实验）
  if (rec.forcedCareer && st.age === 22 && (!st.career || st.career.id !== rec.forcedCareer)) {
    A.applyJob(st, rec.forcedCareer);
    if (!st.career || st.career.id !== rec.forcedCareer) {
      st.career = { id: rec.forcedCareer, level: 0, years: 0, joinedAge: 22 };
      st.job = A.CAREERS.find(c => c.id === rec.forcedCareer).ladder[0].title;
    }
  }

  // 恋爱 / 生育
  if (p.social !== 'none' && st.age >= 24 && !st.flags.married && Math.random() < 0.3) {
    const lv = A.loveInit(st);
    const cand = (lv.candidates || []).filter(c => c && c.alive !== false);
    if (cand.length) {
      const l = cand[rnd(cand.length)];
      l.affinity = 82;
      if (st.stats.MONEY < 30000000) st.stats.MONEY = 30000000;
      const r = A.marry(st, l);
      if (r && r.ok && rec.marryAge == null) rec.marryAge = st.age;
    }
  }
  if (p.social !== 'none' && st.flags.married && st.childCount < 2 && Math.random() < 0.4) {
    const b = A.tryBaby(st);
    if (b && b.baby && rec.firstKidAge == null) rec.firstKidAge = st.age;
  }
  if (st.age >= 20 && st.age < 80) trade(p, st, rec, y);
  if (st.age === 30) {
    const h = A.HOUSES.find(x => x.id === 'h_apt_gangbuk') || A.HOUSES[3];
    rec.housePriceAt30 = A.housePrice(st, h);
    rec.incomeAt30 = A.careerIncome(st);
    rec.costAt30 = A.livingCost(st);
  }
}

function trade(p, st, rec, y) {
  if (p.market === 'none') return;
  if (st.stats.MONEY <= 0) return;
  const down = h => Math.round(A.housePrice(st, h) * (h.jeonse ? 1 : p.downRatio));

  if (st.age >= 24 && !st.flags.own_house) {
    const pool = A.HOUSES.filter(h => !h.jeonse && (h.minYear || 1985) <= y);
    let target = null;
    if (p.market === 'house_first') {
      const ok = pool.filter(h => down(h) <= st.stats.MONEY * 0.9).sort((a, b) => b.base - a.base);
      target = ok[0];
      if (!target && st.age % 5 === 0) rec.buyFail++;
    } else if (p.market === 'stock_first') {
      const cheap = pool.slice().sort((a, b) => a.base - b.base)[0];
      target = (cheap && down(cheap) <= st.stats.MONEY * 0.6) ? cheap : null;
    } else {
      target = pool.filter(h => down(h) <= st.stats.MONEY * 0.7).sort((a, b) => b.base - a.base)[0];
    }
    if (target) {
      const r = A.buyProp(st, 'house', target.id, p.downRatio, 1);
      if (r.ok && rec.firstHouseAge == null) { rec.firstHouseAge = st.age; rec.firstHouse = target.name; }
    }
  }

  if (p.borrowLoan && st.age >= 22 && st.market.debt < A.careerIncome(st) * 3) {
    const prods = A.loanProducts(st).filter(x => x.avail && x.p.danger <= 2);
    if (prods.length) {
      const t = prods.sort((a, b) => b.max - a.max)[0];
      A.borrow(st, t.p.id, Math.round(t.max * 0.5));
    }
  }

  const spendK = p.market === 'stock_first' ? 0.75 : (p.market === 'balanced' ? 0.3 : 0.25);
  const poolS = A.STOCKS.filter(s => (s.minYear || 1985) <= y);
  if (poolS.length && st.stats.MONEY > 2000000) {
    poolS.sort(p.market === 'stock_first' ? (a, b) => b.growth - a.growth : (a, b) => (b.div || 0) - (a.div || 0));
    const s = poolS[0];
    const price = A.stockPrice(st, s.id);
    if (price > 0) {
      const n = Math.floor(st.stats.MONEY * spendK / price);
      if (n > 0) { const r = A.buyStock(st, s.id, n); if (r.ok && rec.firstStockAge == null) rec.firstStockAge = st.age; }
    }
  }
  if (p.market === 'house_first' && st.market.debt > 0 && st.stats.MONEY > st.market.debt * 0.5) {
    A.repayDebt(st, Math.round(st.stats.MONEY * 0.3));
  }
}

/* =========================================================
 * 主流程
 * ========================================================= */
const N = parseInt(process.argv[2] || '200', 10);
const all = {};
const start = Date.now();
for (const key of Object.keys(PERSONAS)) {
  const runs = [];
  let crash = 0;
  for (let i = 0; i < N; i++) {
    try { runs.push(playOne(key, PERSONAS[key])); }
    catch (e) { crash++; if (crash < 3) console.log('CRASH', key, e.message, String(e.stack).split('\n')[1]); }
  }
  all[key] = runs;
  console.log('done', key, runs.length, 'crash=' + crash);
}
fs.writeFileSync(path.join(OUT, 'playtest-raw.json'), JSON.stringify(all), 'utf8');
fs.writeFileSync(path.join(OUT, 'event-tally.json'),
  JSON.stringify({ all: EV_TALLY, byPersona: EV_BY_PERSONA, choiceCount: CHOICE_COUNT }, null, 1), 'utf8');

/* ---------- 实验 A：阶层流动性（强制职业 + 稳健理财策略） ---------- */
const MOBILITY = ['rider', 'waiter', 'extra', 'factory', 'guard', 'courier', 'cook',
  'clerk', 'teacher', 'nurse', 'programmer', 'doctor', 'finance', 'ai', 'civil'];
const mob = {};
MOBILITY.forEach(cid => {
  const runs = [];
  for (let i = 0; i < 60; i++) {
    try { runs.push(playOne('mob_' + cid, PERSONAS.steady, { forceCareer: cid, familyId: 'xiangong' })); }
    catch (e) { }
  }
  mob[cid] = runs;
  console.log('mobility', cid, runs.length);
});
fs.writeFileSync(path.join(OUT, 'mobility.json'), JSON.stringify(mob), 'utf8');

/* ---------- 实验 B：年代缩放失真（固定画像 + 固定出身，扫出生年） ---------- */
const ERA = {};
[1955, 1965, 1975, 1985, 1995, 2005].forEach(sy => {
  const runs = [];
  for (let i = 0; i < 60; i++) {
    try { runs.push(playOne('era_' + sy, PERSONAS.steady, { startYear: sy, familyId: 'xiangong' })); }
    catch (e) { }
  }
  ERA[sy] = runs;
  console.log('era', sy, runs.length);
});
fs.writeFileSync(path.join(OUT, 'era.json'), JSON.stringify(ERA), 'utf8');

/* ---------- 职业名表（供分析脚本用） ---------- */
const CN_CAREER = {};
A.CAREERS.forEach(c => {
  CN_CAREER[c.id] = { name: c.name, l0: c.ladder[0].title, sal0: c.ladder[0].sal,
    ln: c.ladder[c.ladder.length - 1].title, saln: c.ladder[c.ladder.length - 1].sal };
});
fs.writeFileSync(path.join(__dirname, 'career-names.json'), JSON.stringify(CN_CAREER), 'utf8');

console.log('elapsed', ((Date.now() - start) / 1000).toFixed(1) + 's');
