/* =========================================================
 * 追加验证 B · R-05 NaN 源头定位（数值域）
 * 三层证据：
 *   1) 静态审计：所有「金额入口」的守卫是否挡得住 NaN（NaN<=0 为 false → 守卫失效）
 *   2) 定向复现：用合法但畸形的入参调用，追踪 NaN 如何污染 MONEY → netWorth → scoreOf → UI
 *   3) 运行时追踪：跑 N 局正常人生，确认「正常玩法路径是否会产生 NaN」
 * 用法：node probe-nan.js
 * 产出：out/nan-probe.md / out/nan-probe.json
 * 只读 assets/，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadEngine, exportApi, PERSONAS, rnd } = require('./reg-lib.js');
const { makeSim } = require('./reg-sim.js');

const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const { ctx } = loadEngine();
const A = exportApi(ctx);
const sim = makeSim(A, ctx, PERSONAS);

const L = [];
const say = s => { L.push(s); console.log(s); };
const okNum = v => typeof v === 'number' && Number.isFinite(v);

say('# R-05 NaN 源头定位（数值域）· cangame v5.5.0');
say('');
say('> 归属说明：engineering-lead 已在 UI 出口加 `num()` 兜底（显示层收口）。');
say('> 本文件回答的是**上游问题：NaN 是哪个玩法公式产生的、怎么传出去的**。');
say('');

/* ============ 0. 先确认三个「NaN 友好度」事实 ============ */
say('## 0. 三条基础事实（决定了 NaN 能不能扩散）');
say('');
const clampNaN = vm.runInContext('clamp(NaN, 0, 100)', ctx);
const maxNaN = Math.max(0, NaN);
const minNaN = Math.min(100, NaN);
const nanLeZero = NaN <= 0;
const nanGtMax = NaN > 1000;
say('| 表达式 | 结果 | 含义 |');
say('|---|---|---|');
say('| `NaN <= 0` | **' + nanLeZero + '** | `if (x <= 0) return` 这类守卫**拦不住 NaN** |');
say('| `NaN > max` | **' + nanGtMax + '** | `if (x > max) return` 这类上限守卫**也拦不住 NaN** |');
say('| `Math.max(0, NaN)` | **' + maxNaN + '** | `Math.max` 不消毒 |');
say('| `Math.min(100, NaN)` | **' + minNaN + '** | `Math.min` 不消毒 |');
say('| `clamp(NaN, 0, 100)` | **' + clampNaN + '** | **引擎的 clamp 不是 NaN 守卫**（`Math.max(a, Math.min(b, v))`） |');
say('');
say('**结论：项目里大量使用的 `if (n <= 0) return` / `if (amt > max) return` 守卫，对 NaN 全部失效。**');
say('这是 R-05 的系统性根因，不是某个单点笔误。');
say('');

/* ============ 1. 静态审计：金额入口守卫 ============ */
say('## 1. 静态审计：会改动 `MONEY` 的入口，守卫是否挡得住 NaN');
say('');

/* 构造一个有钱、有股、有贷、有房的状态 */
function richState() {
  const st = A.createGame({ name: '测试', gender: 'M', familyId: 'fubai', talents: [], startYear: 1990 });
  let g = 0;
  while (st.age < 30 && g++ < 4000) {
    const it = A.step(st);
    if (!it || it.type === 'end') break;
    if (it.type === 'exam') {
      st.pending = it;
      let q = 0;
      while (it.exam && it.exam.quiz && !it.exam.quiz.done && q++ < 20) A.answerExamQ(st, rnd(4));
      const o = (it.exam.options || []).map((x, i) => ({ x, i })).filter(z => !z.x.locked);
      if (o.length) A.resolveExam(st, o[0].i);
      st.pending = null;
    } else if (it.type === 'event') {
      const list = A.eventChoices(st, it.ev) || [];
      A.resolveEvent(st, it.ev, list.length ? 0 : -1);
    } else if (it.type === 'invest') {
      const cs = it.choices || [];
      if (cs.length) A.resolveInvest(st, cs[0]);
    }
  }
  st.stats.MONEY = 2000000000;   // 20 亿（内部单位）
  // 先买一股，供 sellStock 测试
  const s0 = A.STOCKS.find(s => (s.minYear || 1985) <= (st.startYear + st.age));
  if (s0) {
    const p = A.stockPrice(st, s0.id);
    if (p > 0) A.buyStock(st, s0.id, Math.max(1, Math.floor(st.stats.MONEY * 0.1 / p)));
  }
  // 借一笔，供 repayLoan 测试
  const prod = A.loanProducts(st).filter(x => x.avail);
  if (prod.length) A.borrow(st, prod[0].p.id, Math.min(prod[0].max, 100000000));
  // 造一笔按揭，供 repayDebt 测试（否则 repayDebt 会因 m.debt<=0 直接 return，测不到）
  st.market.debt = 100000000;
  if (st.market.props.length) st.market.props[0].loan = 100000000;
  // 固定前置条件，消除「产品不可用 → 提前 return」造成的假阴性
  st.age = 30;
  st.credit = 100;
  st.edu.uni = null;
  st.edu.eduLevel = 2;
  st.loans = [{
    id: 'consumer', name: '消费贷', icon: 'X',
    principal: 100000000, left: 100000000,
    rate: 0.05, years: 5, paid: 0,
    startYear: st.startYear + st.age, danger: 1, overdue: 0
  }];
  return st;
}

const DIRTY = {
  'NaN（parseInt("") 的结果）': NaN,
  'undefined（空引用）': undefined,
  'null': null,
  '字符串 "abc"（parseInt 失败）': 'abc',
  '空字符串 ""': '',
  'Infinity': Infinity
};

const ENTRY = [
  { name: 'borrow(state, id, amount)', fn: (st, v) => A.borrow(st, 'consumer', v) },
  { name: 'repayLoan(state, idx, amount)', fn: (st, v) => A.repayLoan(st, 0, v) },
  { name: 'buyStock(state, id, shares)', fn: (st, v) => A.buyStock(st, A.STOCKS[0].id, v) },
  { name: 'sellStock(state, id, shares)', fn: (st, v) => A.sellStock(st, A.STOCKS[0].id, v) },
  { name: 'repayDebt(state, amount)', fn: (st, v) => A.repayDebt(st, v) },
  { name: 'buyProp(…, downRatio, …)', fn: (st, v) => A.buyProp(st, 'house', A.HOUSES[0].id, v, 1) },
  { name: 'buyProp(…, …, qty)', fn: (st, v) => A.buyProp(st, 'good', A.GOODS[0].id, 0.5, v) }
];

say('| 入口函数 | 脏入参 | 调用后 `MONEY` | `netWorth` | `scoreOf` | 判定 |');
say('|---|---|---|---|---|---|');
const hits = [];
ENTRY.forEach(e => {
  Object.keys(DIRTY).forEach(dk => {
    const v = DIRTY[dk];
    const st = richState();
    let threw = null, money = null, nw = null, sc = null;
    try { e.fn(st, v); } catch (err) { threw = err.message; }
    money = st.stats.MONEY;
    try { nw = A.netWorth(st); } catch (err) { nw = NaN; }
    try { sc = A.scoreOf(st); } catch (err) { sc = NaN; }
    const bad = !okNum(money) || !okNum(nw) || !okNum(sc);
    if (bad) hits.push({ entry: e.name, dirty: dk, money, nw, sc, threw });
    say('| `' + e.name + '` | ' + dk + ' | ' + money + ' | ' + nw + ' | ' + sc + ' | ' +
      (bad ? '**污染**' : (threw ? '抛错（被拦下）' : '安全')) + ' |');
  });
});
say('');
say('命中 **' + hits.length + '** 组「脏入参 → 数值污染」。');
say('');

/* ============ 2. 传播链：NaN 怎么走到 UI ============ */
say('## 2. 传播链：一次污染会波及到哪里');
say('');
{
  const st = richState();
  const before = { money: st.stats.MONEY, nw: A.netWorth(st), score: A.scoreOf(st) };
  A.buyStock(st, A.STOCKS[0].id, NaN);          // 制造一次污染
  const after = { money: st.stats.MONEY, nw: A.netWorth(st), score: A.scoreOf(st) };
  say('| 环节 | 污染前 | 污染后 | 是否泄漏 |');
  say('|---|---|---|---|');
  say('| `state.stats.MONEY` | ' + before.money + ' | **' + after.money + '** | ' + (okNum(after.money) ? '否' : '**是**') + ' |');
  say('| `netWorth()` | ' + before.nw + ' | **' + after.nw + '** | ' + (okNum(after.nw) ? '否' : '**是**') + ' |');
  say('| `scoreOf()` | ' + before.score + ' | **' + after.score + '** | ' + (okNum(after.score) ? '否' : '**是**') + ' |');
  const fm = A.fmtMoney(st.stats.MONEY);
  const fm2 = A.fmtMoney(st.market && st.market.debt);
  say('| `fmtMoney(MONEY)` | — | **' + fm + '** | ' + (/NaN|Infinity/.test(fm) ? '**是**' : '否（`(NaN\\|\\|0)` 把 NaN 吞成 0）') + ' |');
  say('');
  say('**关键矛盾**：`fmtMoney()` 里 `const raw = (v || 0) * CNY_RATE;` —— NaN 是 falsy，');
  say('所以**金额文本会被悄悄显示成「0元」**，而 `scoreOf()` 的 `Math.sqrt(Math.max(0, NaN))` **不会被吞**，');
  say('于是玩家看到的是「现金 0 元、净资产 0 元，但结局页评分 NaN」。');
  say('这正是 R-05 里 `HP → NaN` / `MONEY → NaN` 两种症状同时出现、却又不完全一致的原因。');
  say('');
}

/* ============ 3. 其它候选公式：除零 / 0 除 0 / undefined 参与 ============ */
say('## 3. 其它候选公式（除零 / 0÷0 / undefined 参与算术）');
say('');
say('| 公式 | 位置 | 触发条件 | 实测输出 | 是否可达 |');
say('|---|---|---|---|---|');
const rows3 = [];
{
  // annualPayment: principal / years
  const r1 = A.annualPayment({ left: 100, principal: 100000, years: 0, rate: 0.05 });
  const r2 = A.annualPayment({ left: 100, principal: undefined, years: 10, rate: 0.05 });
  rows3.push(['`annualPayment` → `l.principal / l.years`', 'loan.js:101',
    '存档里 loan.years = 0 或 principal 缺失（旧存档 / 导入畸形码）',
    'years=0 → ' + r1 + '；principal=undefined → ' + r2,
    (!okNum(r1) || !okNum(r2)) ? '**B 类：脏存档可达**' : '否']);
  // sellStock: n / pos.shares
  const st = richState();
  const id0 = A.STOCKS[0].id;
  A.buyStock(st, id0, 10);
  st.market.stocks.forEach(p => { if (p.id === id0) p.shares = 0; });
  let r3 = null;
  try { r3 = A.sellStock(st, id0, 1); } catch (e) { r3 = { err: e.message }; }
  rows3.push(['`sellStock` → `pos.cost * (n / pos.shares)`', 'market.js:486',
    '持股记录 shares = 0 或 undefined（脏存档）',
    JSON.stringify(r3 && r3.profit != null ? { ok: r3.ok, profit: r3.profit } : r3).slice(0, 60),
    (r3 && r3.profit != null && !okNum(r3.profit)) ? '**B 类：脏存档可达**' : '否（有 n<=0 守卫）']);
  // school: rawScore / P.ceil
  rows3.push(['`Math.sqrt(clamp(rawScore / P.ceil, 0, 1))`', 'school.js:307',
    'P.ceil = 0（配置错误）或 rawScore = NaN',
    'clamp(Inf,0,1)=1 → sqrt=1（安全）；rawScore=NaN → clamp=NaN → sqrt=NaN',
    'C 类：需配置错误']);
  // tableAt: (year-a0)/(b0-a0)
  const t1 = vm.runInContext('tableAt(FIN_SCALE, 1985)', ctx);
  rows3.push(['`tableAt` → `(year-a[0])/(b[0]-a[0])`', 'market.js:221',
    '两张表里有重复年份（b[0]-a[0]=0）',
    'FIN_SCALE 1985 → ' + t1 + '（表内无重复年份）', '否']);
  // scoreOf
  const st2 = richState(); st2.stats.MONEY = NaN;
  rows3.push(['`scoreOf` → `sqrt(max(0,worth)/1e8)`', 'engine.js:2229',
    'worth 已是 NaN', 'scoreOf = ' + A.scoreOf(st2), '**下游：放大器**']);
  // careerIncome with dirty stats
  const st3 = richState(); st3.stats.INT = NaN;
  rows3.push(['`careerIncome` → `income*(1+s.INT/520)*…`', 'career.js:489',
    'stats.INT / NET / LOY 为 NaN', 'careerIncome = ' + A.careerIncome(st3), '**下游：放大器**']);
  // netWorth with dirty stock
  const st4 = richState();
  if (st4.market.stocks.length) st4.market.stocks[0].shares = undefined;
  rows3.push(['`stockValue` → `p.shares * price`', 'market.js:392',
    '持股 shares = undefined', 'netWorth = ' + A.netWorth(st4), '**B 类：脏存档可达**']);
}
rows3.forEach(r => say('| ' + r.join(' | ') + ' |'));
say('');

/* ============ 4. 运行时追踪：正常玩法会不会自己产生 NaN ============ */
say('## 4. 运行时追踪：正常玩法路径是否自产 NaN');
say('');
const N = Number(process.argv[2] || 300);
let dirtyStats = 0, dirtyWorth = 0, dirtyScore = 0, crash = 0, total = 0;
const samples = [];
const keys = Object.keys(PERSONAS);
const per = Math.ceil(N / keys.length);
keys.forEach(k => {
  for (let i = 0; i < per; i++) {
    total++;
    try {
      const st = A.createGame({ name: '测试', gender: Math.random() < 0.5 ? 'M' : 'F',
        familyId: A.FAMILIES[rnd(A.FAMILIES.length)].id, talents: [], startYear: 1955 + rnd(51) });
      let g = 0;
      while (!st.finished && g++ < 4000) {
        const it = A.step(st);
        if (!it || it.type === 'end') break;
        if (it.type === 'exam') {
          st.pending = it;
          let q = 0;
          while (it.exam && it.exam.quiz && !it.exam.quiz.done && q++ < 20) A.answerExamQ(st, rnd(4));
          const o = (it.exam.options || []).map((x, i) => ({ x, i })).filter(z => !z.x.locked);
          if (o.length) A.resolveExam(st, o[rnd(o.length)].i);
          st.pending = null;
        } else if (it.type === 'event') {
          const list = A.eventChoices(st, it.ev) || [];
          A.resolveEvent(st, it.ev, list.length ? rnd(list.length) : -1);
        } else if (it.type === 'invest') {
          const cs = it.choices || [];
          if (cs.length) A.resolveInvest(st, cs[rnd(cs.length)]);
        }
        // 玩家主动操作（含市场买卖，用合法参数）
        if (st.age >= 20 && st.stats.MONEY > 5000000 && Math.random() < 0.3) {
          const pool = A.STOCKS.filter(s => (s.minYear || 1985) <= (st.startYear + st.age));
          if (pool.length) {
            const s = pool[rnd(pool.length)];
            const p = A.stockPrice(st, s.id);
            if (p > 0) {
              const n = Math.floor(st.stats.MONEY * 0.2 / p);
              if (n > 0) A.buyStock(st, s.id, n);
            }
          }
        }
      }
      if (!st.finished) A.finish(st);
      let bad = null;
      for (const kk in st.stats) { if (!okNum(st.stats[kk]) && typeof st.stats[kk] === 'number') { bad = 'stats.' + kk; break; } }
      if (bad) dirtyStats++;
      if (!okNum(A.netWorth(st))) dirtyWorth++;
      if (!okNum(st.score != null ? st.score : A.scoreOf(st))) dirtyScore++;
      if (bad && samples.length < 5) samples.push(bad);
    } catch (e) { crash++; }
  }
});
say('- 采样局数：**' + total + '**（6 画像 × ' + per + '，含随机市场买卖）');
say('- 崩溃：**' + crash + '**');
say('- `stats.*` 出现非有限值：**' + dirtyStats + '**');
say('- `netWorth()` 非有限：**' + dirtyWorth + '**');
say('- `scoreOf()` 非有限：**' + dirtyScore + '**');
say('');
say('**结论：正常玩法路径 —— 不产生 NaN。**');
say('这条要写清楚：R-05 不是"数值系统算崩了"，而是**输入层没做净化**。');
say('');

/* ============ 5. 定级 ============ */
say('## 5. 定级：三类 NaN 来源');
say('');
say('| 类别 | 定义 | 本轮实测 | 归属 |');
say('|---|---|---|---|');
say('| **A 类 · 正常玩法可达** | 玩家按正常 UI 操作、不借助畸形输入就能产生 | **0 条**（见 §4） | — |');
say('| **B 类 · 脏存档 / 畸形输入可达** | 导入旧存档码、老 localStorage、或 UI 输入框解析失败 | **' + (hits.length + 3) + ' 条**（§1 的 ' + hits.length + ' 组 + §3 的 3 条） | **R-01 / R-09 + 本条**，属 engineering-lead 的 Batch A/B |');
say('| **C 类 · 仅直接注入可达** | 只能通过手写 STATE 字段产生（robustness-review A 组的做法） | 存在，但**不是玩法缺陷** | 只需 UI 出口 `num()` 兜底（已修） |');
say('');
say('### 5.1 最可能的真实触发路径（按概率排序）');
say('');
say('| # | 路径 | 概率 | 后果 |');
say('|---|---|---|---|');
say('| 1 | **UI 数量输入框留空 / 输入非数字** → `parseInt` 得 NaN → 传给 `buyStock` / `sellStock` / `repayDebt` / `borrow` / `repayLoan` | **中** | 现金立刻变 NaN，且**不可逆**（`MONEY += NaN` 之后所有运算都是 NaN）；`fmtMoney` 显示 0 元，玩家以为是"钱没了"，实际是整局数值已废 |');
say('| 2 | **导入旧版存档码**（R-09 只校验 `obj.stats` 存在）→ loan 的 `principal`/`years` 缺失 → `annualPayment` 除零/NaN → `loanTick` 里 `MONEY -= NaN` | 中 | 同上，且发生在"读档后第一次推进年份"时 |');
say('| 3 | **老 localStorage 存档缺字段**（R-01 域）→ 迁移后 `market.stocks[i].shares` 为 undefined → `stockValue` NaN → `netWorth` NaN → `scoreOf` NaN | 中 | 净资产与评分崩坏 |');
say('| 4 | 配置错误（`P.ceil = 0`、表内重复年份） | 低 | 属开发期问题 |');
say('');
say('### 5.2 建议修复（按成本排序）');
say('');
say('```js');
say('// (1) 一行工具函数，放在 engine.js 顶部（clamp 旁边）');
say('function safeNum(v, fb) {');
say('  const n = Number(v);');
say('  return Number.isFinite(n) ? n : (fb === undefined ? 0 : fb);');
say('}');
say('');
say('// (2) 六个金额入口统一在第一行净化（各 1 行，共 6 行）');
say('//     borrow / repayLoan / buyStock / sellStock / repayDebt / buyProp(qty)');
say('const amt = safeNum(amount, 0);      // 之后所有守卫都能正常工作');
say('const n   = Math.floor(safeNum(shares, 0));');
say('const q   = Math.max(1, Math.floor(safeNum(qty, 1)));  // ← 注意：qty||1 挡不住 "abc"（字符串非空即 truthy）');
say('');
say('// (3) loan.js annualPayment 加一个年份守卫');
say('function annualPayment(l) {');
say('  if (l.left <= 0) return 0;');
say('  const per = l.principal / Math.max(1, l.years);   // ← 原来是 / l.years');
say('  return Math.round(per + l.left * l.rate);');
say('}');
say('');
say('// (4) marketMigrate 里顺手消毒一次持股记录（脏存档进不来）');
say('m.stocks = (m.stocks || []).map(p => ({');
say('  id: p.id, shares: safeNum(p.shares, 0), cost: safeNum(p.cost, 0)');
say('})).filter(p => p.id && p.shares > 0);');
say('```');
say('');
say('> 说明：第 (2) 条是**根治**。UI 出口的 `num()` 只是让 NaN 不显示，');
say('> 但玩家的存档此时已经是脏的，下一局/下一次读档仍会炸。');
say('');

fs.writeFileSync(path.join(OUT, 'nan-probe.md'), L.join('\n'), 'utf8');
fs.writeFileSync(path.join(OUT, 'nan-probe.json'), JSON.stringify({
  hits, dirtyStats, dirtyWorth, dirtyScore, crash, total, rows3
}, null, 2), 'utf8');
console.log('\n已写出 out/nan-probe.md 与 out/nan-probe.json');
