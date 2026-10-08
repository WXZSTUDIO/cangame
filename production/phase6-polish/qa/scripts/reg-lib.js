/* =========================================================
 * REG-01 回归用例 · 共用库
 *  - loadEngine() : 把 8 个模块按线上 <script> 顺序灌进 vm 沙箱（含 ui.js 所需的 DOM 桩）
 *  - PERSONAS     : 6 个玩家画像（与 QA-01 playtest-run.js 保持一致）
 *  - playOne()    : 跑完整一局，返回结构化记录
 *  - assert 工具  : ok() / eq() / range()，失败输出可读
 * 只读 assets/，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', '..');   // cangame/
const MODULES = ['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
  'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js'];

function loadEngine() {
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
  const per = [];
  MODULES.forEach(f => {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
    per.push(f);
  });
  return { ctx, per };
}

function exportApi(ctx) {
  return vm.runInContext(`({
    createGame, step, resolveEvent, eventChoices, resolveExam, answerExamQ, resolveInvest,
    pickEvents, matchEvent, matchCond, pushLog,
    applySchool, UNIVERSITIES,
    finish, scoreOf, netWorth, worthOf, careerIncome, livingCost, jobOffers, applyJob, cramSchool,
    doUniActivity, classmateAct, buyProp, sellProp, buyStock, sellStock, repayDebt,
    marketTick, housePrice, carPrice, goodPrice, stockPrice, stockValue, propValue,
    borrow, loanProducts, repayLoan, loanTotal, annualPayment, loanTick,
    migrateState, tryBaby, marry, propose, loveInit, loveAct,
    doGoodDeed, buyLottery, fmtMoney, applyEffects, grade,
    HOUSES, CARS, GOODS, STOCKS, CAREERS, FAMILIES, ENDINGS, EVENTS, TALENTS,
    FIN_SCALE, HOUSE_INDEX, MARKET_META, CNY_RATE, JOBS, EXAM_META, GOOD_DEEDS, ILLNESS,
    INVESTMENTS, ACHIEVEMENTS, SAVE_VERSION
  })`, ctx);
}

/* ---------------- 玩家画像（与 QA-01 一致） ---------------- */
const PERSONAS = {
  steady: {
    cn: '稳健流', cram: true, schoolPick: 'best',
    majorPref: ['理工', '金融', '医学', '法律', '师范'],
    gradChoice: 1, kaoyan2Choice: 1, scoutChoice: 2, riskMode: 'low',
    jobTarget: ['ai', 'doctor', 'finance', 'programmer', 'civil', 'teacher', 'accountant', 'lawyer', 'pm', 'designer', 'nurse', 'ecom', 'clerk'],
    market: 'house_first', downRatio: 0.5, borrowLoan: false,
    social: 'moderate', doGood: true, lottery: true, treat: true
  },
  aggressive: {
    cn: '激进流', cram: false, schoolPick: 'best',
    majorPref: ['金融', '艺术', '传媒', '理工'],
    gradChoice: 0, kaoyan2Choice: 0, scoutChoice: 1, riskMode: 'ev',
    jobTarget: ['startup', 'finance', 'hacker', 'anchor', 'ai', 'sales', 'programmer'],
    market: 'stock_first', downRatio: 0.1, borrowLoan: true,
    social: 'moderate', doGood: false, lottery: true, treat: true
  },
  reckless: {
    cn: '亡命流', cram: false, schoolPick: 'best', majorPref: [],
    gradChoice: 0, kaoyan2Choice: 0, scoutChoice: 0, riskMode: 'high',
    jobTarget: ['startup', 'hacker', 'anchor', 'gamer', 'idol', 'athlete'],
    market: 'stock_first', downRatio: 0.1, borrowLoan: true,
    social: 'none', doGood: false, lottery: true, treat: false
  },
  slacker: {
    cn: '摆烂流', cram: false, schoolPick: 'first', majorPref: [],
    gradChoice: 2, kaoyan2Choice: 1, scoutChoice: 0, riskMode: 'first',
    jobTarget: [], market: 'none', downRatio: 1, borrowLoan: false,
    social: 'none', doGood: false, lottery: false, treat: true
  },
  explorer: {
    cn: '探索流', cram: true, schoolPick: 'best', majorPref: [],
    gradChoice: 1, kaoyan2Choice: 1, scoutChoice: 1, riskMode: 'random',
    jobTarget: [], market: 'balanced', downRatio: 0.35, borrowLoan: false,
    social: 'full', doGood: true, lottery: true, treat: true
  },
  baseline: {
    cn: '随机基线', cram: false, schoolPick: 'random', majorPref: [], gradChoice: -1,
    kaoyan2Choice: -1, scoutChoice: -1, riskMode: 'random', jobTarget: [], market: 'none',
    downRatio: 0.5, borrowLoan: false, social: 'none', doGood: false, lottery: false, treat: true
  }
};

/* ---------------- 断言工具 ---------------- */
function makeReport(title) {
  const rows = [];
  const R = {
    rows,
    ok(cond, name, detail) {
      rows.push({ pass: !!cond, name, detail: detail == null ? '' : String(detail) });
      return !!cond;
    },
    range(v, lo, hi, name, unit) {
      const u = unit || '';
      return R.ok(v >= lo && v <= hi, name,
        `实测 ${fmtNum(v)}${u} · 目标 [${fmtNum(lo)}${u}, ${fmtNum(hi)}${u}]`);
    },
    atLeast(v, lo, name, unit) {
      const u = unit || '';
      return R.ok(v >= lo, name, `实测 ${fmtNum(v)}${u} · 目标 >= ${fmtNum(lo)}${u}`);
    },
    atMost(v, hi, name, unit) {
      const u = unit || '';
      return R.ok(v <= hi, name, `实测 ${fmtNum(v)}${u} · 目标 <= ${fmtNum(hi)}${u}`);
    },
    print() {
      console.log('\n' + title);
      rows.forEach(r => console.log(r.pass ? '  [PASS] ' : '  [FAIL] ', r.name, r.detail ? '  << ' + r.detail : ''));
      const p = rows.filter(r => r.pass).length;
      console.log('  ---- ' + title + ' : ' + p + '/' + rows.length + ' PASS ----');
      return { pass: p, total: rows.length, allPass: p === rows.length };
    }
  };
  return R;
}

function fmtNum(v) {
  if (v == null || Number.isNaN(v)) return String(v);
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (a >= 1e4) return (v / 1e4).toFixed(1) + '万';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}
const median = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const stdev = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
const pct = (a, q) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * q))]; };

/* ---------------- 确定性 RNG（供零容差的用例固定种子，消除 flaky） ----------------
 * 用法：withSeededRandom(seed, fn) —— 期间覆盖宿主 Math.random（vm 沙箱共用同一个 Math），
 * 结束后必定还原。仅用于「必须可复现」的用例（如 REG-13 迁移链路）。
 * 统计型用例不要用：固定种子会让样本失去独立性。
 */
function withSeededRandom(seed, fn) {
  const orig = Math.random;
  let s = (seed >>> 0) || 1;
  Math.random = function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  try { return fn(); } finally { Math.random = orig; }
}

module.exports = {
  ROOT, MODULES, loadEngine, exportApi, PERSONAS,
  makeReport, fmtNum, median, mean, stdev, pct, withSeededRandom,
  rnd: n => Math.floor(Math.random() * n)
};
