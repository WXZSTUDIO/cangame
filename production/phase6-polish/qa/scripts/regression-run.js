/* =========================================================
 * REG-01 · 回归用例集（REG-00 ~ REG-13）
 * 用法：
 *   node regression-run.js              # 跑全部
 *   node regression-run.js REG-05       # 只跑一条
 *   node regression-run.js REG-01 REG-05
 *   node regression-run.js --n=120      # 指定每组样本量（默认 120）
 * 说明：只读 assets/，不修改任何游戏源码。
 *      用例是「修复验收门」，本轮在未修复的 v5.5.0 基线上跑，FAIL 即待修项。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const { loadEngine, exportApi, PERSONAS, makeReport, fmtNum, median, mean, stdev, pct, rnd, withSeededRandom } = require('./reg-lib.js');
const { makeSim } = require('./reg-sim.js');

const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
const only = argv.filter(a => /^REG-/.test(a));
const nArg = (argv.find(a => a.indexOf('--n=') === 0) || '').split('=')[1];
const N = parseInt(nArg || '120', 10);

/* ---------- 引擎 ---------- */
const { ctx } = loadEngine();
const A = exportApi(ctx);
const sim = makeSim(A, ctx, PERSONAS);
const CNY = A.CNY_RATE;                       // 1/180
const rmb = v => (v || 0) * CNY;              // 内部单位 -> 人民币

/* ---------- 资产快照指纹 ---------- */
function fingerprint() {
  return ['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
    'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js']
    .map(f => {
      const st = fs.statSync(path.join(__dirname, '..', '..', '..', '..', f));
      return f.replace('assets/', '') + '@' + st.mtime.toISOString().slice(0, 16);
    }).join('  ');
}

/* ---------- 批量跑 ---------- */
function runs(persona, n, opts) {
  const out = [];
  let crash = 0;
  const errs = [];
  for (let i = 0; i < n; i++) {
    try { out.push(sim.playOne(persona, PERSONAS[persona], opts || {})); }
    catch (e) { crash++; if (errs.length < 3) errs.push(String(e.message) + ' @ ' + String(e.stack || '').split('\n')[1]); }
  }
  return { out, crash, errs };
}

/* =========================================================
 * REG-00  稳定性门：1000+ 局零崩溃，且无 NaN 泄漏进 stats
 * ========================================================= */
/* ---------------- 可复现性自检（REG-00 / REG-13 共用） ----------------
 * B-10：engine.js:1006 choiceTexts() 把 _ct 缓存写在共享的 EVENTS 数据表上，
 * 导致第 2 局起不再消耗随机数 —— 同一份代码跑两次结果不同。
 * 因此每个「确定性样本」开跑前必须清缓存，否则同种子也得不到同结果。 */
function resetChoiceCache() {
  ['EVENTS', 'EVENTS_EXTRA'].forEach(k => {
    const arr = A[k];
    if (Array.isArray(arr)) arr.forEach(e => { if (e && e._ct) delete e._ct; });
  });
}

/* 造一份「玩到 35 岁」的真实存档，作为老存档迁移链路的样本母体 */
function makeRealSave() {
  resetChoiceCache();
  const st = A.createGame({ name: '赵思远', gender: 'M', familyId: 'xiangong', talents: [] });
  let g = 0;
  while (st.age < 35 && g++ < 4000) {
    const item = A.step(st);
    if (!item || item.type === 'end') break;
    if (item.type === 'exam') {
      st.pending = item;
      let q = 0;
      while (item.exam && item.exam.quiz && !item.exam.quiz.done && q++ < 20) A.answerExamQ(st, rnd(4));
      const o = (item.exam.options || []).map((x, i) => ({ x, i })).filter(z => !z.x.locked);
      if (o.length) A.resolveExam(st, o[0].i);
      st.pending = null;
    } else if (item.type === 'event') {
      const list = A.eventChoices(st, item.ev) || [];
      A.resolveEvent(st, item.ev, list.length ? 0 : -1);
    } else if (item.type === 'invest') {
      const cs = item.choices || [];
      if (cs.length) A.resolveInvest(st, cs[0]);
    }
  }
  return JSON.parse(JSON.stringify(st));
}

/* 摘要：seed / createdAt / updatedAt 来自 Date.now()，天然每次不同，比对时归一化 */
function digest(o) {
  const t = JSON.stringify(o, (k, v) => (k === 'seed' || k === 'createdAt' || k === 'updatedAt') ? 0 : v);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16) + ':' + t.length;
}

function REG_00() {
  const R = makeReport('REG-00 · 稳定性门（1000 局零崩溃 + 无 NaN 泄漏 + 可复现）');
  const keys = Object.keys(PERSONAS);
  const perKey = Math.ceil(1000 / keys.length);
  let total = 0, crash = 0;
  const errs = [];
  let nanRuns = 0;
  keys.forEach(k => {
    for (let i = 0; i < perKey; i++) {
      total++;
      try {
        const st = A.createGame({ name: '测试', gender: Math.random() < 0.5 ? 'M' : 'F',
          familyId: A.FAMILIES[rnd(A.FAMILIES.length)].id, talents: [] });
        let g = 0;
        while (!st.finished && g++ < 4000) {
          const item = A.step(st);
          if (!item || item.type === 'end') break;
          if (item.type === 'exam') {
            st.pending = item;
            let q = 0;
            while (item.exam && item.exam.quiz && !item.exam.quiz.done && q++ < 20) A.answerExamQ(st, rnd(4));
            const o = (item.exam.options || []).map((x, i) => ({ x, i })).filter(z => !z.x.locked);
            if (o.length) A.resolveExam(st, o[rnd(o.length)].i);
            st.pending = null;
          } else if (item.type === 'event') {
            const list = A.eventChoices(st, item.ev) || [];
            A.resolveEvent(st, item.ev, list.length ? rnd(list.length) : -1);
          } else if (item.type === 'invest') {
            const cs = item.choices || [];
            if (cs.length) A.resolveInvest(st, cs[rnd(cs.length)]);
          }
        }
        if (!st.finished) A.finish(st);
        // NaN 泄漏检查
        let bad = null;
        for (const key in st.stats) {
          const v = st.stats[key];
          if (typeof v === 'number' && !Number.isFinite(v)) { bad = 'stats.' + key + '=' + v; break; }
        }
        if (!bad && !Number.isFinite(A.netWorth(st))) bad = 'netWorth=' + A.netWorth(st);
        if (!bad && !Number.isFinite(st.score != null ? st.score : A.scoreOf(st))) bad = 'score';
        if (bad) { nanRuns++; if (nanRuns <= 3) errs.push('NaN: ' + bad); }
      } catch (e) { crash++; if (errs.length < 6) errs.push(String(e.message) + ' @ ' + String(e.stack || '').split('\n')[1]); }
    }
  });
  R.ok(crash === 0, '1000 局零崩溃', `崩溃 ${crash} / ${total}`);
  R.ok(nanRuns === 0, '无 NaN / Infinity 泄漏进 stats / netWorth / score', `脏局 ${nanRuns} / ${total}`);
  if (errs.length) console.log('    样例错误：\n      ' + errs.slice(0, 6).join('\n      '));

  /* 可复现性自检（B-10 的哨兵）：同种子两次构造的人生必须逐字节一致。
   * 这条一旦红，说明有跨局状态残留污染了随机序列 —— 上面所有红绿都不可信。 */
  const d1 = withSeededRandom(20251008, () => digest(makeRealSave()));
  const d2 = withSeededRandom(20251008, () => digest(makeRealSave()));
  R.ok(d1 === d2, '可复现性：同种子两次构造的人生摘要逐字节一致（此条红了，上面所有红绿都不可信）',
    d1 + ' / ' + d2);
  return R;
}

/* =========================================================
 * REG-01  S-01 高风险不是自杀按钮
 * ========================================================= */
function REG_01() {
  const R = makeReport('REG-01 · S-01 高风险决策可存活（激进流）');
  const { out, crash } = runs('aggressive', N);
  R.ok(crash === 0, '无崩溃', 'crash=' + crash);
  const life = mean(out.map(r => r.deathAge));
  /* 哨兵断言（防 F-01 复发）：先确认 `endCause` 这个字段还活着。
   * 若哪天 `ending.cause` 被重命名 / 移除 / 改结构，下面的「熄灭占比」会**再次静默归零、门再次假绿**。
   * 覆盖率断言会让它在当天就红，而不是等下次人工审计才发现。
   * 实测覆盖率：aggressive 1.000 / reckless 1.000 / steady 0.883 / explorer 0.900 / baseline 0.967 / slacker 0.850
   * → 门限取 0.70（留足余量，正常波动不会误报；字段失效时必然触红）。 */
  const causeRate = out.filter(r => r.endCause).length / out.length;
  R.atLeast(causeRate, 0.70,
    '哨兵 · 结局死因字段（endCause）覆盖率 —— 此条红了，下面的「熄灭占比」不可信', '');

  /* ⚠️ 必须用 endCause，不能用 endId：S-04 之后 `end_dead` 已不在 ENDINGS 表（16 条正式结局里没有它），
   * 死因改挂 `state.ending.cause`。用 endId 判会导致该指标**结构性恒为 0**、这道门永远绿 ——
   * 已实测确认：全部 6 个画像 × 120 局，endId 的 end_dead 占比全部 0.000。 */
  const dead = out.filter(r => r.endCause === 'end_dead').length / out.length;
  const hp30 = median(out.map(r => r.hpSeries[30] == null ? 0 : r.hpSeries[30]));
  const st30 = median(out.map(r => r.stressSeries[30] == null ? 0 : r.stressSeries[30]));
  R.atLeast(life, 60, '激进流平均寿命', '岁');
  R.atMost(dead, 0.25, '激进流「熄灭」占比', '');
  R.atLeast(hp30, 60, '激进流 30 岁 HP 中位', '');
  R.atMost(st30, 80, '激进流 30 岁压力中位', '');

  /* --- S-01 验收口径（主理人要求提前备好）：亡命流与激进流同属「高风险路径」，
   * 实测两者各有 60~65% 以死亡收场，必须**两条画像各判一遍**，只测激进流会漏掉亡命流。
   * 工程第二批改完 S-01，这四条应立刻可验。 --- */
  const rk = runs('reckless', N);
  const lifeR = mean(rk.out.map(r => r.deathAge));
  const deadR = rk.out.filter(r => r.endCause === 'end_dead').length / rk.out.length;
  const causeRateR = rk.out.filter(r => r.endCause).length / rk.out.length;
  R.atLeast(causeRateR, 0.70, '哨兵 · 亡命流 endCause 覆盖率', '');
  R.atLeast(lifeR, 60, '亡命流平均寿命', '岁');
  R.atMost(deadR, 0.25, '亡命流「熄灭」占比', '');
  return R;
}

/* =========================================================
 * REG-02  S-02 通胀门：终局净资产中位落在 [2000万, 2亿] 人民币
 * ========================================================= */
function REG_02() {
  const R = makeReport('REG-02 · S-02 通胀门（稳健流终局净资产）');
  const { out } = runs('steady', N);
  const m = median(out.map(r => rmb(r.finalNet)));
  const p90 = rmb(out.map(r => r.finalNet).sort((a, b) => a - b)[Math.floor(out.length * 0.9)] || 0);
  R.range(m, 2e7, 2e8, '稳健流终局净资产中位');
  R.ok(true, '（参考）p90 净资产', fmtNum(p90));
  const ratio = median(out.map(r => r.housePriceAt30 && r.incomeAt30 ? rmb(r.housePriceAt30) / rmb(r.incomeAt30) : 0));
  R.range(ratio, 6, 15, '30 岁房价/收入比');
  return R;
}

/* =========================================================
 * REG-03  S-02 劳动门：工资结余占终局净资产 >= 35%
 * ========================================================= */
function REG_03() {
  const R = makeReport('REG-03 · S-02 劳动门（工资结余占比）');
  const { out } = runs('steady', N);
  const vals = out.map(r => {
    const net = r.finalNet;
    if (!net || net <= 0) return 0;
    return r.buckets.salary / net;
  });
  const m = median(vals);
  R.atLeast(m, 0.35, '工资结余 / 终局净资产（中位）', '');
  return R;
}

/* =========================================================
 * REG-04  S-03 区分度门
 * ========================================================= */
function REG_04() {
  const R = makeReport('REG-04 · S-03 评分区分度');
  const { out } = runs('steady', N);
  const scores = out.map(r => r.score);
  const sShare = out.filter(r => r.rank === 'S').length / out.length;
  const sd = stdev(scores);
  const slacker = runs('slacker', Math.max(30, Math.floor(N / 3))).out;
  const sShareSlacker = slacker.filter(r => r.rank === 'S').length / (slacker.length || 1);
  R.atMost(sShare, 0.35, '稳健流 S 级占比', '');
  R.atLeast(sd, 12, '稳健流评分标准差', '');
  R.atMost(sShareSlacker, 0.20, '摆烂流 S 级占比', '');
  return R;
}

/* =========================================================
 * REG-05  S-04 结局门：走 ENDINGS 判定 >= 60%
 * ========================================================= */
function REG_05() {
  const R = makeReport('REG-05 · S-04 结局判定归一');
  const { out } = runs('explorer', N);
  const viaEndings = out.filter(r => r.endSource === 'ENDINGS').length / out.length;
  const uniq = {};
  out.forEach(r => { if (r.endSource === 'ENDINGS') uniq[r.endId] = 1; });
  /* F-02（主理人裁定）：S-04 之后这条**恒为 100%**，已成永真门。
   * 保留作**回归守卫**（若哪天掉下去说明 S-04 被回退），但**不再作为「S-04 已修」的证据** ——
   * S-04 的证据是「forceEnd = 0」+「REG-01 熄灭率」两条。
   * 准入证明（历史反证）：S-04 修复前实测 **10%**（§2.4 复审表），远低于 60% 门限 → 该门当时确实为红。 */
  R.atLeast(viaEndings, 0.60, '走 ENDINGS 判定的比例（守卫 · S-04 后恒 100%，见 F-02）', '');
  /* F-03（主理人裁定）：原来是「种类数 ≥12」，是**计数**且随 N 单调增长
   * → 加大 N 就自动变绿，与修复无关。改为**占 ENDINGS 总数的比例 ≥70%**，
   * 并且**签字时固定 N=300**（比例口径消掉部分 N 依赖，但小 N 下稀有结局本就抽不到，
   * 必须固定 N 才真正可比 —— 两条一起上）。 */
  const END_TOTAL = (A.ENDINGS || []).length || 16;
  const uniqN = Object.keys(uniq).length;
  R.atLeast(uniqN / END_TOTAL, 0.70,
    '单次采样触达的正式结局种类占 ENDINGS 总数的比例（签字须 N=300）', '');
  R.ok(true, '  （参考）触达种类数 / ENDINGS 总数', uniqN + ' / ' + END_TOTAL);
  // forceEnd 三个 id 不应出现（修复后应全部走 ENDINGS）
  const forced = {};
  out.forEach(r => { if (r.endSource === 'forceEnd') forced[r.endId] = (forced[r.endId] || 0) + 1; });
  R.ok(Object.keys(forced).length === 0, 'forceEnd id（end_elder/end_ill/end_dead）不应再作为最终结局',
    Object.keys(forced).map(k => k + '×' + forced[k]).join(' '));
  return R;
}

/* =========================================================
 * REG-06  A-01 晚年内容门：66-100 岁空转率 <= 20%
 * ========================================================= */
function REG_06() {
  const R = makeReport('REG-06 · A-01 晚年内容门（空转率）');
  const { out } = runs('steady', N);
  const idleAll = mean(out.map(r => r.totalYears ? r.idleYears / r.totalYears : 0));
  let idleN = 0, totN = 0;
  out.forEach(r => { idleN += r.idleByBand['66-100']; totN += r.yearsByBand['66-100']; });
  const late = totN ? idleN / totN : 0;
  R.atMost(idleAll, 0.20, '全年龄空转率', '');
  R.atMost(late, 0.20, '66-100 岁空转率', '');
  return R;
}

/* =========================================================
 * REG-07  A-03 阶层流动门
 * ========================================================= */
const MOBILITY = ['rider', 'waiter', 'extra', 'factory', 'guard', 'courier', 'cook',
  'clerk', 'teacher', 'nurse', 'programmer', 'doctor', 'finance', 'ai', 'civil'];

function REG_07() {
  const R = makeReport('REG-07 · A-03 阶层流动性');
  const MN = Math.max(20, Math.floor(N / 3));
  const res = {};
  MOBILITY.forEach(cid => {
    const rr = runs('steady', MN, { forceCareer: cid, familyId: 'xiangong' });
    res[cid] = {
      net: median(rr.out.map(r => r.finalNet)),
      switchRate: mean(rr.out.map(r => (r.jobSwitches > 0 ? 1 : 0)))
    };
  });
  const lo = res['rider'].net, hi = res['ai'].net;
  const gap = lo ? hi / lo : Infinity;
  const sw = mean(Object.keys(res).map(k => res[k].switchRate));
  R.atMost(gap, 150, '骑手 vs AI 终局净资产倍数', '×');
  /* F-04（主理人裁定）：流动性类指标**只设单侧下界** ——
   * 换职业率越高 = 流动性越好，设上界会把「修得比目标更好」判成失败，是结构性错误。
   * 但 35% 这个数承载了真实设计意图（换职业不该变成常态 churn，否则职业阶梯与晋升永远不兑现），
   * 所以**不删**，降级为观察项（只告警、不判定）。 */
  R.atLeast(sw, 0.25, '平均「曾换过职业」比例（单侧下界 · 越高越好）', '');
  R.ok(true, '（观察项·不判定）换职业率 >35% 告警',
    sw.toFixed(3) + (sw > 0.35 ? ' —— ⚠️ 超过 35%，可能已变成常态 churn，职业阶梯与晋升不兑现（此条只告警，不判红）' : '（正常区间）'));
  R.ok(true, '（参考）骑手终局净资产', fmtNum(rmb(lo)));
  R.ok(true, '（参考）AI 终局净资产', fmtNum(rmb(hi)));
  return R;
}

/* =========================================================
 * REG-08  A-04 年代门：早期出生组 18 岁家庭净值
 * ========================================================= */
function REG_08() {
  const R = makeReport('REG-08 · A-04 年代缩放（1955/65/75/85 组 18 岁家庭净值）');
  const EN = Math.max(20, Math.floor(N / 3));
  [1955, 1965, 1975, 1985].forEach(sy => {
    const rr = runs('steady', EN, { startYear: sy, familyId: 'xiangong' });
    const vals = rr.out.map(r => (r.famAt18 ? rmb(r.famAt18.assets - r.famAt18.debt) : 0));
    const m = median(vals);
    R.range(m, -1e5, 5e4, sy + ' 出生组 18 岁家庭净值中位');
  });
  return R;
}

/* =========================================================
 * REG-09  A-06 孤儿职称：在职年份里 state.career 非空 >= 90%
 * ========================================================= */
function REG_09() {
  const R = makeReport('REG-09 · A-06 孤儿职称（在职年份 career 非空率）');
  const { out } = runs('baseline', N);
  let act = 0, nul = 0;
  out.forEach(r => { act += r.activeYears; nul += r.careerNullYears; });
  const rate = act ? 1 - nul / act : 0;
  R.atLeast(rate, 0.90, '在职年份中 state.career 非空的比例', '');
  R.ok(true, '（参考）在职年份总数 / 空 career 年数', act + ' / ' + nul);
  return R;
}

/* =========================================================
 * REG-10  A-07 careerIncome 可解释性 + 年代项
 * ========================================================= */
function REG_10() {
  const R = makeReport('REG-10 · A-07 careerIncome 可解释性与年代项');
  // 10a：静态复现 —— ladder.sal × 工龄 × 学历K × 属性乘子
  const probe = A.createGame({ name: '测试', gender: 'M', familyId: 'xiangong', talents: [] });
  probe.age = 40;
  probe.stats.INT = 180; probe.stats.NET = 160; probe.stats.LOY = 130;
  const rowsA = [], rowsB = [];
  ['rider', 'cook', 'clerk', 'programmer', 'ai'].forEach(cid => {
    const c = A.CAREERS.find(x => x.id === cid);
    const L = c.ladder.length - 1;
    probe.job = c.ladder[L].title;
    probe.career = { id: cid, level: L, years: 18, joinedAge: 22 };
    probe.edu.salaryK = 1;
    const measured = A.careerIncome(probe);
    const expect = c.ladder[L].sal * (1 + Math.max(0, 40 - 22) * 0.028) * 1
      * (1 + probe.stats.INT / 520) * (1 + probe.stats.NET / 1000) * (1 + probe.stats.LOY / 1100);
    const err = Math.abs(measured - expect) / expect;
    rowsA.push({ cid, measured, expect, err });
    // 10b：年代项 —— 同一职业同一职级，2025 vs 1985
    probe.startYear = 1985 - 40; const v1985 = A.careerIncome(probe);
    probe.startYear = 2025 - 40; const v2025 = A.careerIncome(probe);
    rowsB.push({ cid, v1985, v2025, k: v2025 / v1985 });
  });
  const maxErr = Math.max.apply(null, rowsA.map(r => r.err));
  const kMed = median(rowsB.map(r => r.k));
  R.atMost(maxErr, 0.10, 'careerIncome 可被「阶梯表 × 工龄 × 学历K × 属性」静态复现（最大误差）', '');
  rowsA.forEach(r => R.ok(true, '  ' + r.cid + ' 实测/静态', (r.measured / r.expect).toFixed(3) + '×'));
  /* F-05（主理人裁定）：判的是**名义**年薪比，口径用 **SALARY_ERA_INDEX**（不是 FIN_SCALE 的 4.20，
   * 也不是 CPI_INDEX 的 2.80）。A-07 落地后 名义 2025/1985 = 5.50 / 1.00 = **5.50** ≥ 3.5。 */
  R.atLeast(kMed, 3.5, '同一职级 2025 年薪 / 1985 年薪（**名义**比 · 口径 = SALARY_ERA_INDEX）', '×');
  /* 实得门：只判名义会放行一种**假修复** —— 让工资和通胀一起涨，玩家名义年薪翻 5 倍
   * 但购买力原地踏步，年代感是假的。折掉 CPI 才是真实增益。
   * CPI_RATIO 取自 `design/economy-respec.md` §3 的 CPI_INDEX：1985 = 1.00，2025 = 2.80。
   * A-07 落地后 实得比 = 5.50 / 2.80 = **1.96** ≥ 1.5。 */
  const CPI_1985 = 1.00, CPI_2025 = 2.80;          // economy-respec.md §3
  const CPI_RATIO = CPI_2025 / CPI_1985;
  const realK = kMed / CPI_RATIO;
  R.atLeast(realK, 1.5, '同一职级 2025 / 1985 年薪的**实得**比（名义比 ÷ CPI 比，防「工资通胀齐涨」式假修复）', '×');
  R.ok(true, '  （参考）名义 / 实得', kMed.toFixed(2) + '× / ' + realK.toFixed(2) + '×（CPI 比 ' + CPI_RATIO.toFixed(2) + '）');
  return R;
}

/* =========================================================
 * REG-11  A-08 学习投入边际收益不倒挂
 * ========================================================= */
/* 门限语义（主理人授权由测试域自定）：
 *   「学习投入倒挂」的正确度量工具是 **study 直接驱动的下游量**（高考分 → 学历档 → 30 岁收入），
 *   不是终局净资产 —— 净资产被房产/股票/彩票的重尾噪声主导，实测同一份代码 4 次运行在
 *   **0.72× ~ 1.40×** 之间跳，连 3 折中位数都压不住（0.72 / 0.76 / 0.93 / 1.40）。
 *   所以净产比**降级为参考项并标注噪声带**，判定改用三条低方差指标。 */
function REG_11() {
  const R = makeReport('REG-11 · A-08 学习投入边际收益不倒挂');
  /* ============================================================
   * 实验设计（正交）：画像 × 剂量各占一个自由度，互不干扰。
   *
   * 前三版踩过的坑（务必看完再改这里）：
   *   ① 用「终局 study」分档 —— 终局值已被后续事件冲淡，且 41+ 档几乎是另一批人；
   *   ② 按 studyAt18 三分位切档 —— 低投入档几乎全是 slacker / baseline 画像，
   *      它们同时还有 jobTarget=[] / market='none'，收入差 2.8× 主要来自画像不是学习；
   *   ③ 用 `pn = pool[i % 2]` 配 `cap = (i % 2 === 0) ? 0 : 40` —— **pn 与 cap 由同一个
   *      i % 2 决定，完全共线**，注释里却写着「两组画像构成完全相同」。
   *      实测这一版读到的 0.36~0.61 根本不是补习效应，是「steady vs explorer」的画像效应。
   *
   * ⚠️ 教训（主理人要求写在显著位置）：
   *     **实验设计的正确性必须由代码核对，不能由注释核对。**
   *
   * 现在：for (pn) for (cap) 摊平，每格等样本。
   * 剂量取 0 / 10 / 40 —— 10 对应 studyAt18 ≈ 15（第一次跨档），40 对应 ≈ 30，
   * 多出来的这一档是为了能算「边际收益比」（D-1 的验收门，见下）。
   * ============================================================ */
  const CELL = Math.max(150, Math.round(N * 1.25));   // 每格样本（N=120 → 150，共 900 局）
  const POOL = ['steady', 'explorer'];
  const CAPS = [0, 10, 40];
  /* D-1 验收门限：边际(15→31 段) / 边际(0→15 段) ≥ TH_MARGIN。
   * 现状（未修）实测约 0.1 —— 即「提分换不来第二段收益」，这正是 D-1。
   * 修复目标（补 u_key 档 + 档位内 salaryK 连续化）是让这一段从 ≈0 变成 >0。
   * 0.3 是主理人给的初值；用比值而不用绝对值，是因为实测幅度噪声极大
   * （steady 臂两次复跑差 45 个百分点），比值对噪声的敏感度远低于绝对值。 */
  const TH_MARGIN = 0.3;

  const cell = {};
  POOL.forEach(pn => CAPS.forEach(cap => {
    const arr = [];
    for (let k = 0; k < CELL; k++) {
      let r = null;
      try { r = sim.playOne(pn, PERSONAS[pn], { cramCap: cap }); } catch (e) { continue; }
      if (r) arr.push(r);
    }
    cell[pn + '|' + cap] = arr;
  }));

  const pick = (arr, f) => arr.map(f).filter(x => x != null && Number.isFinite(x));
  const med = (arr, f) => { const v = pick(arr, f); return v.length ? median(v) : null; };
  const incOf = arr => med(arr, r => (r.incomeAt30 > 0 ? r.incomeAt30 : null));
  const gkOf = arr => med(arr, r => (r.gaokao != null ? r.gaokao : null));
  const stOf = arr => med(arr, r => (r.studyAt18 || 0));
  /* 画像平衡口径：把两个画像在同一剂量下合并，抵消画像构成差异 */
  const bal = cap => [].concat(cell['steady|' + cap], cell['explorer|' + cap]);

  const st = CAPS.map(c => stOf(bal(c)));
  const ic = CAPS.map(c => incOf(bal(c)));
  const gk = CAPS.map(c => gkOf(bal(c)));

  const minCell = Math.min.apply(null, POOL.flatMap(p => CAPS.map(c => cell[p + '|' + c].length)));
  R.ok(minCell >= 30, '每格样本充足（正交 2 画像 × 3 剂量）',
    '最少一格 ' + minCell + ' 局 / 共 ' + POOL.flatMap(p => CAPS.map(c => cell[p + '|' + c].length)).reduce((a, b) => a + b, 0) + ' 局');
  R.ok(true, '（参考）实验设计', '正交：' + POOL.join('/') + ' × cramCap ' + CAPS.join('/') +
    '，每格 ' + CELL + ' 局；判定用**画像平衡**口径');

  /* --- 自变量有效性 --- */
  R.atLeast(st[2] != null && st[0] != null ? st[2] - st[0] : -1, 20,
    '自变量有效（studyAt18：不补习 → 补到上限）', '点');
  R.ok(true, '  （参考）studyAt18 中位 · 三档剂量', CAPS.map((c, i) => c + '→' + (st[i] == null ? '—' : st[i])).join('  '));

  /* --- 回归守卫：补习不应有害（原门，正交化后语义才成立） --- */
  if (ic[0] > 0 && ic[2] > 0) {
    R.atLeast(ic[2] / ic[0], 0.95, '30 岁收入比（画像平衡 · 补到上限 / 不补习 · 倒挂须 ≤5%）', '×');
    R.ok(true, '  （参考）30 岁收入中位（内部单位）', CAPS.map((c, i) => c + '→' + (ic[i] == null ? '—' : fmtNum(ic[i]))).join('  '));
  } else {
    R.ok(false, '30 岁收入无有效样本');
  }
  /* 分画像口径（参考）：交互作用若存在，这里会看出两臂不一致 */
  R.ok(true, '  （参考）分画像 30 岁收入比',
    POOL.map(p => p + ' ' + (incOf(cell[p + '|40']) / incOf(cell[p + '|0'])).toFixed(2) + '×').join('  '));

  /* --- 高考分数（低噪声下游量） --- */
  R.atLeast(gk[2] != null && gk[0] != null ? gk[2] - gk[0] : -99, -5,
    '高考分数随学习投入单调不减（补到上限 − 不补习）', '分');
  R.ok(true, '  （参考）高考分数中位 · 三档剂量', CAPS.map((c, i) => c + '→' + (gk[i] == null ? '—' : gk[i].toFixed(0))).join('  '));

  /* --- D-1 验收门：边际收益比（逐画像判定，两臂都要过） ---
   * 观测量选 **salaryK 的均值**，不用 30 岁收入的中位：
   *   · salaryK ∈ {0.95, 1.04, 1.20, 1.42}，只有 4 个取值 → n=150 时均值标准误约 0.012；
   *   · 30 岁收入的中位在复跑间摆动可达 40%（实测 3.28 亿 / 4.61 亿两轮），
   *     而待检的边际只有基数的 ~5% → **符号会翻转，不可测**（已实测到 steady 首段 −1.21 亿）。
   * 门限 TH_MARGIN 见函数头注释（主理人初值 0.3，待按实测噪声定稿）。 */
  const meanK = arr => {
    const v = arr.map(r => (r.salaryK > 0 ? r.salaryK : null)).filter(x => x != null);
    return v.length ? mean(v) : null;
  };
  /* 判定用**画像平衡**口径（两画像合并后每剂量 2×CELL 局），不逐画像判定 ——
   * explorer 臂的 salaryK 边际实测 5 次复跑横跨 −0.34× ~ 2.50×，单独判定会把噪声当信号。 */
  const k = CAPS.map(c => meanK(bal(c)));
  const k1 = (k[0] != null && k[1] != null) ? (k[1] - k[0]) : null;   // 0 → 15 段
  const k2 = (k[1] != null && k[2] != null) ? (k[2] - k[1]) : null;   // 15 → 31 段
  const tag = 'D-1 边际收益比（15→31 段 / 0→15 段 · 画像平衡）';
  if (k1 == null || k2 == null) {
    R.ok(false, tag + ' · 样本不足，无法判定',
      'salaryK 均值 ' + k.map(x => x == null ? '—' : x.toFixed(3)).join(' / '));
  } else if (k1 <= 0) {
    R.ok(false, tag + ' · 首段边际 ≤ 0（前 15 点学习投入在 salaryK 上没有任何可测收益）',
      'salaryK 均值 ' + k[0].toFixed(3) + ' → ' + k[1].toFixed(3) + ' → ' + k[2].toFixed(3));
  } else {
    /* ⚠️ 0.3 门限已由主理人作废（2026-10-08）：比值在「分子分母都是小差值」时会叠加两边噪声，
     * 且未修复状态下天然 ≥0.3，抓不住 D-1。D-1 的验收改由**门 A（确定性断言）**承担。 */
    R.ok(true, '（参考·不作判定）' + tag,
      (k2 / k1).toFixed(2) + '×   （salaryK 均值 ' + k[0].toFixed(3) + ' → ' + k[1].toFixed(3) + ' → ' + k[2].toFixed(3) +
      '；0→15 段 ' + k1.toFixed(3) + ' / 15→31 段 ' + k2.toFixed(3) + '）· **全体平均会抹平条件性断层，不作判定**');
  }
  /* 分画像口径降为**参考** —— 交互作用若存在，这里会看出两臂不一致，但不作判定 */
  POOL.forEach(pn => {
    const a = meanK(cell[pn + '|0']), b = meanK(cell[pn + '|10']), c = meanK(cell[pn + '|40']);
    if (a == null || b == null || c == null || (b - a) <= 0) {
      R.ok(true, '  （参考·不作判定）' + pn + ' salaryK 均值 · 首段边际 ≤ 0',
        [a, b, c].map(x => x == null ? '—' : x.toFixed(3)).join(' → '));
      return;
    }
    R.ok(true, '  （参考·不作判定）' + pn + ' salaryK 边际比',
      ((c - b) / (b - a)).toFixed(2) + '×   （' + a.toFixed(3) + ' → ' + b.toFixed(3) + ' → ' + c.toFixed(3) + '）');
  });

  /* --- D-1 门 A（确定性断言 · 零噪声）：档位内 salaryK 连续化 ---
   * 契约：同一档位内，`salaryK` 应是**超线分**的正斜率函数。
   * 现在 `school.js:418` 是 `e.salaryK = u.salaryK`（档位常数）→ 三个超线分拿到同一个值 → **必红**。
   * 修复（招式二 · 档位内连续化）后必然不等、且随超线分递增 → **必绿**。
   * 这是**黑盒契约测试**：不依赖未来实现的任何细节，只调现有入口 `applySchool()`；
   * 也不需要蒙特卡洛 —— 零噪声，不可能假阳性，也不可能被噪声救绿。
   * （设计侧口径由主理人 2026-10-08 给出：D-1 的现象是**条件性**的，
   *   全体平均会把「已锁死子群」的零边际和「未跨线子群」的正边际平均掉。） */
  {
    const TIER = 'u_211';
    const U = (A.UNIVERSITIES || []).find(x => x.id === TIER);
    const need = U ? Math.round((U.minScore || 0) / 100 * 700) : 546;
    const OVERS = [0, 35, 70];                       // 高考分的超线幅度（档位内）
    const ks = withSeededRandom(20251008, () => OVERS.map(over => {
      const st = A.createGame({
        name: 'D1', gender: 'M', familyId: (A.FAMILIES[0] || {}).id,
        priority: 'study', talents: [], startYear: 2000
      });
      st.edu.hs = 'h_ok';                            // 走「高考录取」分支：需要 e.hs && !e.uni
      st.edu.gao = need + over;
      A.applySchool(st, TIER);
      return st.edu.salaryK;
    }));
    const fmt = ks.map(v => v == null ? '—' : Number(v).toFixed(3)).join(' / ');
    const allSame = ks.every(v => v === ks[0]);
    R.ok(!allSame, 'D-1 门 A · 档位内 salaryK 连续化（超线 0 / 35 / 70 分应给出不同值）',
      TIER + '（录取线 ' + need + '）→ salaryK ' + fmt + (allSame ? ' —— 档位内恒等，超线分完全不兑现' : ''));
    if (!allSame) {
      R.ok(ks[2] > ks[0], 'D-1 门 A · 档位内 salaryK 随超线分严格递增（超线 70 > 超线 0）', fmt);
      R.ok(ks[1] >= ks[0], 'D-1 门 A · 档位内 salaryK 单调不减（超线 35 ≥ 超线 0）', fmt);
    }
    R.ok(true, '  （说明）门 A 为确定性断言，零噪声、不需蒙特卡洛；修复前必红、修复后必绿');
  }

  /* --- 参考：30 岁收入的边际比（**不可作门**，实测符号会翻转） --- */
  POOL.forEach(pn => {
    const a = incOf(cell[pn + '|0']), b = incOf(cell[pn + '|10']), c = incOf(cell[pn + '|40']);
    R.ok(true, '（参考·不作判定）' + pn + ' 收入边际比（15→31 段 / 0→15 段）',
      (a != null && b != null && c != null && (b - a) > 0)
        ? ((c - b) / (b - a)).toFixed(2) + '×   （重尾量：' + fmtNum(b - a) + ' → ' + fmtNum(c - b) + '；复跑符号会翻转，**不可作门**）'
        : '首段边际 ' + fmtNum(b - a) + ' ≤ 0 —— 符号不可信（收入中位复跑摆动可达 40%），**不可作门**');
  });

  /* --- 参考：高考分的边际比（低噪声，用于交叉印证 D-1 是否真的在「分数→收益」这一层截断 --- */
  {
    const a = gk[0], b = gk[1], c = gk[2];
    if (a != null && b != null && c != null && (b - a) > 0) {
      R.ok(true, '（参考·不作判定）高考分边际比（15→31 段 / 0→15 段）',
        ((c - b) / (b - a)).toFixed(2) + '×   （低噪声量：' +
        (b - a).toFixed(0) + ' 分 → ' + (c - b).toFixed(0) + ' 分）');
    }
  }
  return R;
}

/* =========================================================
 * REG-12  A-09 保守流健康/压力有张力
 * ========================================================= */
function REG_12() {
  const R = makeReport('REG-12 · A-09 保守流 HP / 压力存在张力');
  const PN = Math.max(40, Math.floor(N / 2));
  const hp40 = [], st50 = [], st60 = [], life = [];
  for (let i = 0; i < PN; i++) {
    let r = null;
    try { r = sim.playOne('steady', PERSONAS.steady, {}); } catch (e) { continue; }
    if (!r) continue;
    if (r.hpSeries[40] != null) hp40.push(r.hpSeries[40]);
    if (r.stressSeries[50] != null) st50.push(r.stressSeries[50]);
    if (r.stressSeries[60] != null) st60.push(r.stressSeries[60]);
    life.push(r.deathAge);
  }
  const h = median(hp40), s5 = median(st50.concat(st60));
  R.range(h, 70, 95, '保守流 40 岁 HP 中位', '');
  R.atLeast(s5, 15, '保守流 50-60 岁压力中位', '');
  /* F-07（主理人裁定）：上界 90 → **100**。
   * 原上界 90 与项目设计冲突 —— 寿命公式的期望值本来就约 **92 岁**（`risk=(age-74)*0.0036*…`），
   * 把上界设在 90 等于让门在设计目标处反对设计想要的结果（实测已在 84~87，再走三步就被自己人判失败）。
   * 100 保留「不该无限延长」的天花板语义，又不跟设计打架。下界 72 不变。 */
  R.range(mean(life), 72, 100, '保守流平均寿命（均值，防止修复过猛把人全修死）', '岁');
  return R;
}

/* =========================================================
 * REG-13  B-08 老存档迁移链路
 * ========================================================= */
/* REG-13 是「零容差」用例：样本是单局存档，随机性会让它 flaky（同一份代码
 * 多次运行 L0/L1 的推进结果会变）。因此整条用例固定种子，保证可复现。 */
function REG_13() { return withSeededRandom(20251008, REG_13_impl); }
function REG_13_impl() {
  const R = makeReport('REG-13 · B-08 老存档迁移（migrateState）');

  // resetChoiceCache / makeRealSave / digest 已提到模块级（REG-00 的可复现性自检复用）
  const ref = A.createGame({ name: '赵思远', gender: 'M', familyId: 'xiangong', talents: [] });
  const REQ = {
    log: 'array', flags: 'object', queue: 'array', used: 'array', investments: 'array',
    loans: 'array', children: 'array', exes: 'array', classmates: 'array', friends: 'array',
    achievements: 'array', talents: 'array', love: 'object', edu: 'object', family: 'object',
    market: 'object', stats: 'object', socialTouch: 'object', uniTouch: 'object', goodTouch: 'object'
  };

  function typeOf(v) {
    if (Array.isArray(v)) return 'array';
    if (v === null) return 'null';
    return typeof v;
  }

  /* 单个种子上的一次完整探测：造档 → 破坏 → 迁移 → 推进 5 年 → 数值体检 */
  function probeOne(mutate) {
    const s = makeRealSave();
    mutate(s);
    let err = null;
    try { ctx.marketMigrate && ctx.marketMigrate(s); } catch (e) { err = 'marketMigrate: ' + e.message; }
    if (!err) { try { A.migrateState(s); } catch (e) { err = 'migrateState: ' + e.message; } }
    if (err) return { err: err };

    // 形状完整性
    const miss = [];
    for (const k in REQ) {
      if (typeOf(s[k]) !== REQ[k]) miss.push(k + '(' + (s[k] === undefined ? 'undefined' : typeOf(s[k])) + ')');
    }

    // 功能：迁移后能继续跑 5 年
    let runErr = null;
    try {
      let g = 0;
      while (g++ < 400) {
        const item = A.step(s);
        if (!item || item.type === 'end') break;
        if (item.type === 'exam') {
          s.pending = item;
          let q = 0;
          while (item.exam && item.exam.quiz && !item.exam.quiz.done && q++ < 20) A.answerExamQ(s, rnd(4));
          const o = (item.exam.options || []).map((x, i) => ({ x, i })).filter(z => !z.x.locked);
          if (o.length) A.resolveExam(s, o[0].i);
          s.pending = null;
        } else if (item.type === 'event') {
          const list = A.eventChoices(s, item.ev) || [];
          A.resolveEvent(s, item.ev, list.length ? 0 : -1);
        } else if (item.type === 'invest') {
          const cs = item.choices || [];
          if (cs.length) A.resolveInvest(s, cs[0]);
        }
        if (s.age >= 40) break;
      }
    } catch (e) { runErr = e.message; }

    // 数值健全
    let bad = null;
    for (const k in (s.stats || {})) {
      if (typeof s.stats[k] === 'number' && !Number.isFinite(s.stats[k])) { bad = 'stats.' + k; break; }
    }
    if (!bad && !Number.isFinite(A.netWorth(s))) bad = 'netWorth';
    return { err: null, miss: miss, runErr: runErr, bad: bad };
  }

  /* 跨种子聚合：老存档迁移的失败与否依赖「抽到哪一局」，单样本证据不可信。
   * 这里固定 5 个种子，只要有 1 个种子炸，就判定该项不通过。 */
  const SEEDS = [20251008, 13579, 24680, 97531, 86420];
  const K = SEEDS.length;

  function checkMany(label, mutate) {
    const errs = [], missAll = [], runAll = [], badAll = [];
    SEEDS.forEach(sd => {
      const r = withSeededRandom(sd, () => probeOne(mutate));
      if (r.err) errs.push('seed' + sd + ': ' + r.err);
      else {
        if (r.miss.length) missAll.push('seed' + sd + ': ' + r.miss.join(','));
        if (r.runErr) runAll.push('seed' + sd + ': ' + r.runErr);
        if (r.bad) badAll.push('seed' + sd + ': ' + r.bad);
      }
    });
    R.ok(errs.length === 0, label + ' · 迁移不抛错（' + K + ' 种子）',
      errs.length ? errs.length + '/' + K + ' 炸：' + errs.slice(0, 2).join(' | ') : '0/' + K);
    if (errs.length) return;
    R.ok(missAll.length === 0, label + ' · 迁移后字段形状完整（' + K + ' 种子）',
      missAll.length ? missAll.length + '/' + K + ' 缺：' + missAll.slice(0, 2).join(' | ') : '0/' + K);
    R.ok(runAll.length === 0, label + ' · 迁移后能继续推进 5 年（' + K + ' 种子）',
      runAll.length ? runAll.length + '/' + K + ' 炸：' + runAll.slice(0, 2).join(' | ') : '0/' + K);
    R.ok(badAll.length === 0, label + ' · 迁移后无 NaN / Infinity（' + K + ' 种子）',
      badAll.length ? badAll.join(' | ') : '0/' + K);
  }

  /* --- 层级样本：按特性组逐级剥离（无 git 历史，形状为合成） --- */
  const strip = (s, keys) => keys.forEach(k => { delete s[k]; });
  // 注：L0 / L1 是**合成压力样本**（按 migrateState 兜底字段反推，删得比任何真实版本都狠），
  // 不代表真实旧存档 —— 真实版本形状见下面 R· 组（已 16/16 通过）。这两条只作加固参考。
  checkMany('L0 合成极简核（压力样本·非真实形状）', s => strip(s, ['market', 'career', 'loans', 'credit', 'ill', 'achievements',
    'children', 'childCount', 'exes', 'love', 'classmates', 'friends', 'socialTouch', 'uniTouch',
    'goodTouch', 'edu', 'parents', 'family', 'log', 'queue', 'used', 'investments', 'grief', 'pet',
    'peak', 'famAskYear', 'lotteryYear', 'grandCount', 'classStage', 'v']));
  checkMany('L1 合成极简核（压力样本·非真实形状）', s => strip(s, ['market', 'career', 'loans', 'credit',
    'ill', 'achievements', 'children', 'exes', 'log', 'queue', 'investments', 'v']));
  checkMany('L2 合成（有 market/career，无 v5.5 新增）', s => strip(s, ['children', 'exes', 'socialTouch',
    'uniTouch', 'goodTouch', 'log', 'queue', 'credit', 'v']));
  checkMany('L3 合成（children 只有数量 / ex 是单体 / 旧专业名）', s => {
    delete s.children; s.childCount = 2;
    delete s.exes; s.ex = { name: '林梅', affinity: 42 };
    s.edu.major = ' comp ';
    delete s.log; delete s.v;
  });
  checkMany('L4 完整当前版（对照）', () => { });
  // 复合缺失：单删不炸、双删才炸的那一类（R-01 的真实触发形态）
  checkMany('L5 孤儿型旧存档（删 parents + 删 flags）', s => { delete s.parents; delete s.flags; });
  checkMany('L6 删 log + 删 queue', s => { delete s.log; delete s.queue; });
  checkMany('L7 删 family + 删 market', s => { delete s.family; delete s.market; });

  /* --- 真实版本形状（**非合成**） ---
   * 来源：远端 GitHub WXZSTUDIO/cangame 各版本 commit 的 createGame() state 字面量
   * （本地不是 git 仓库，但远端有完整提交历史）。抓取脚本：`node fetch-version-shapes.js`。
   * 做法：拿一份当前版真实存档，删掉「该版本还没有的字段」—— 这就是一份真实的旧存档。
   * 上一版 L0/L1 是照 migrateState 的兜底字段反推的合成样本，**删过头了**
   * （真实的 v5.0 存档其实有 career / loans / market），以这一组为准。 */
  const shapesPath = path.join(OUT, 'version-shapes.json');
  if (fs.existsSync(shapesPath)) {
    const shapes = JSON.parse(fs.readFileSync(shapesPath, 'utf8'));
    const cur = shapes[shapes.length - 1];
    shapes.filter(v => v !== cur).forEach(v => {
      const keep = new Set(v.fields);
      checkMany('R·' + v.tag + ' 真实形状（' + v.fields.length + ' 字段）', s => {
        Object.keys(s).forEach(k => { if (!keep.has(k)) delete s[k]; });
      });
    });
  } else {
    R.ok(false, '真实版本形状缺失（先跑 fetch-version-shapes.js）', shapesPath);
  }

  /* --- 逐字段删除（复刻 engineering-lead robustness-review 的 C 组） --- */
  const FIELDS = ['edu', 'love', 'classmates', 'exes', 'children', 'friends', 'parents', 'family',
    'market', 'career', 'loans', 'ill', 'achievements', 'socialTouch', 'uniTouch', 'goodTouch',
    'spouse', 'spouseName', 'log', 'queue', 'credit', 'flags', 'pet', 'grief', 'talents'];
  const fatalA = [];    // 迁移即抛错
  const shapeMiss = []; // 迁移后字段缺失（形状债）
  const fatalC = [];    // 迁移后推进 5 年抛错
  FIELDS.forEach(f => {
    let thr = 0, shp = 0, run = 0;
    SEEDS.forEach(sd => {
      const r = withSeededRandom(sd, () => probeOne(s => { delete s[f]; }));
      if (r.err) { thr++; return; }
      if (r.miss.length) shp++;
      if (r.runErr) run++;
    });
    if (thr) fatalA.push(f + '(' + thr + '/' + K + ')');
    if (shp) shapeMiss.push(f + '(' + shp + '/' + K + ')');
    if (run) fatalC.push(f + '(' + run + '/' + K + ')');
  });
  R.ok(fatalA.length === 0, 'C 组 A 类：删除任一字段后 migrateState 不抛错（' + K + ' 种子）',
    fatalA.length ? fatalA.length + '/25 字段会炸：' + fatalA.join(', ') : '0/25');
  R.ok(fatalC.length === 0, 'C 组 C 类：删除任一字段后仍能推进 5 年（' + K + ' 种子）',
    fatalC.length ? fatalC.length + '/25 字段会炸：' + fatalC.join(', ') : '0/25');
  R.ok(shapeMiss.length === 0, 'C 组 B 类：删除任一字段后字段形状仍完整（形状债）',
    shapeMiss.length ? '缺兜底: ' + shapeMiss.join(', ') : '0/25');
  fs.writeFileSync(path.join(OUT, 'reg-13-migrate.json'),
    JSON.stringify({ seeds: SEEDS, fatalA, fatalC, shapeMiss, fields: FIELDS }, null, 2), 'utf8');

  /* 可复现性自检：同一种子下两次构造的存档必须逐字节一致。
   * 这条一旦 FAIL，说明用例本身 flaky，上面的红/绿都不可信。
   * （同一条哨兵也挂在 REG-00 上，那里每次全量跑都会验一遍。） */
  const d1 = withSeededRandom(20251008, () => digest(makeRealSave()));
  const d2 = withSeededRandom(20251008, () => digest(makeRealSave()));
  R.ok(d1 === d2, '用例可复现（同种子两次构造的存档摘要一致，非 flaky）', d1 + ' / ' + d2);

  return R;
}

/* =========================================================
 * 主流程
 * ========================================================= */
const CASES = {
  'REG-00': REG_00, 'REG-01': REG_01, 'REG-02': REG_02, 'REG-03': REG_03, 'REG-04': REG_04,
  'REG-05': REG_05, 'REG-06': REG_06, 'REG-07': REG_07, 'REG-08': REG_08, 'REG-09': REG_09,
  'REG-10': REG_10, 'REG-11': REG_11, 'REG-12': REG_12, 'REG-13': REG_13
};

const list = only.length ? only : Object.keys(CASES);
console.log('================ REG-01 回归用例集 ================');
console.log('基线指纹：' + fingerprint());
console.log('每组样本量 N = ' + N + '（REG-00 固定 1000 局）');
console.log('用例：' + list.join(', '));
console.log('说明：用例是「修复验收门」。在未修复的 v5.5.0 基线上，FAIL 即待修项。');

const summary = [];
const t0 = Date.now();
list.forEach(id => {
  const fn = CASES[id];
  if (!fn) { console.log('\n未知用例：' + id); return; }
  const t = Date.now();
  let res;
  try { res = fn().print(); }
  catch (e) { console.log('\n' + id + ' 执行异常：' + e.message + '\n' + String(e.stack).split('\n').slice(1, 4).join('\n')); res = { pass: 0, total: 1, allPass: false }; }
  summary.push({ id, pass: res.pass, total: res.total, ms: Date.now() - t, allPass: res.allPass });
});

console.log('\n================ 汇总 ================');
console.log('用例'.padEnd(10) + '结果'.padEnd(8) + '通过'.padEnd(10) + '耗时');
summary.forEach(s => {
  console.log(s.id.padEnd(10) + (s.allPass ? 'PASS' : 'FAIL').padEnd(8) +
    (s.pass + '/' + s.total).padEnd(10) + (s.ms / 1000).toFixed(1) + 's');
});
const allPass = summary.filter(s => s.allPass).length;
console.log('---- ' + allPass + '/' + summary.length + ' 条用例全绿 ----');
console.log('总耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

fs.writeFileSync(path.join(OUT, 'regression-result.json'),
  JSON.stringify({ ts: new Date().toISOString(), N, fingerprint: fingerprint(), summary }, null, 2), 'utf8');
