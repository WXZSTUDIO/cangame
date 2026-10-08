/* =========================================================
 * IMP-01 · Sprint 1 第一批修复的验收脚本
 *  A-06 孤儿职称 → CAREERS 阶梯映射
 *  A-07 careerIncome() 隐藏乘子 → 显式 CAREER_MULT
 *  S-04 forceEnd 绕过 ENDINGS → 单一结局路径
 *
 * 运行： node production/phase6-polish/perf/scripts/imp-verify.js [每组局数]
 * 产出： imp-verify.out.txt
 *
 * 设计原则：**不依赖被测实现的内部结构**。
 *  · A-07 的乘子用「消融法」实测（把某一项因子清零看收入掉多少），
 *   而不是去读常量——这样改前改后同一份脚本都能用。
 *  · S-04 的「走 ENDINGS 比例」用「结算后再跑一次 ENDINGS.find() 比对 id」
 *    来判定，改前改后同一份脚本都能用。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const N = Number(process.argv[2]) || 300;          // 每组默认 300 局
const N_END = Number(process.argv[3]) || 1000;     // 结局扫描默认 1000 局

const out = [];
const say = s => { console.log(s); out.push(String(s)); };
const pct = n => (n * 100).toFixed(1) + '%';
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

say('# IMP-01 · Sprint 1 第一批验收');
say('生成时间：' + new Date().toISOString());
say('运行时：Node ' + process.version + ' / ' + process.platform + ' ' + process.arch);
say('局数：A-06/A-07 每组 ' + N + ' 局 · S-04 结局扫描 ' + N_END + ' 局');
say('');

const V = H.loadVM(false);   // 只灌逻辑层 7 个模块（与线上顺序一致）

/* ---------- 通用：跑一局人生 ---------- */
V.run(`
/* ---------- 社考 two-phase exam: 先答 5 道常识题，放榜后才出 options ----------
 * 注意：v5.5 的 exam 分两段。第一段 exam.options === null、exam.quiz 存在，
 *       必须逐题 answerExamQ()，答满 5 题才会回填 options、quz.done = true。
 *       直接调 resolveExam() 会静默失败 —— 角色永远不入学期罢。
 *       （PERF-01 的 step-bench 早期版本踩过这个坑，已同步修正） */
function __imp_playExam(st, item) {
  const ex = item && item.exam;
  if (!ex) return;
  st.pending = item;                 // ← 关键：answerExamQ / resolveExam 都读 state.pending
  let g = 0;
  while (ex.quiz && !ex.quiz.done) {
    if (++g > 20) break;
    const q = ex.quiz.qs[ex.quiz.i];
    const n = q && q.opts ? q.opts.length : 0;
    answerExamQ(st, n ? Math.floor(Math.random() * n) : 0);
  }
  const opts = ex.options || [];
  const usable = opts.filter(o => !o.locked);
  if (usable.length) resolveExam(st, opts.indexOf(usable[Math.floor(Math.random() * usable.length)]));
  st.pending = null;
}

function __imp_play(gender, stopAge) {
  const st = createGame({ gender: gender || 'M', talents: [] });
  migrateState(st); marketMigrate(st);
  let guard = 0, prevAge = -1, snap30 = null;
  for (;;) {
    if (++guard > 6000) break;
    const item = step(st);
    if (snap30 === null && st.age >= 30) {
      snap30 = { job: st.job, hasCareer: !!st.career, careerId: st.career ? st.career.id : null,
                 level: st.career ? st.career.level : null, income: careerIncome(st) };
    }
    if (stopAge && st.age >= stopAge) break;
    prevAge = st.age;
    if (!item || item.type === 'end' || st.finished) break;
    if (item.type === 'exam') {
      __imp_playExam(st, item);
    } else if (item.type === 'event') {
      resolveEvent(st, item.ev, Math.floor(Math.random() * 3));
    }
    if (st.finished) break;
  }
  return { state: st, snap30: snap30, steps: guard };
}

/* 结算后重跑一次 ENDINGS.find()，用来判定这一局到底走没走正式判定 */
function __imp_endingAudit(st) {
  const e = st.ending || {};
  let judge = null;
  try { const f = ENDINGS.find(x => x.cond(st)); judge = f ? f.id : null; } catch (err) { judge = 'THROW:' + err.message; }
  const baseId = e.baseId || e.id;
  return {
    id: e.id || null,
    baseId: baseId || null,
    cause: e.cause || null,
    judgeId: judge,
    viaEndings: !!(judge && baseId && judge === baseId)
  };
}
`);

/* =========================================================
 * A-06 · 孤儿职称
 * ========================================================= */
say('## A-06 · 孤儿职称 → CAREERS 阶梯映射');
say('');

/* 收集所有会写进 state.job 的职称
 *  ① 源码静态扫描（data/engine/school/career/love/loan 六个文件的 job 字面量）—— 不漏
 *  ② 运行时实际观测（跑 N 局，记录出现过的每一个 state.job）—— 不假 */
/* market.js 必须带上：tableAt() 定义在那里，缺了它所有 tableAt 调用都会走
 * `(typeof tableAt === 'function') ? ... : 1` 的静默兜底 —— 测试会绿而生产不同。
 * 年代薪资项 kEra 上线后这条尤其致命（兜底 1 = 整张年代表被绕过）。 */
const SRC_FILES = ['assets/data.js', 'assets/market.js', 'assets/engine.js',
  'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js'];
const jobHits = {};
SRC_FILES.forEach(f => {
  const src = fs.readFileSync(path.join(H.ROOT, f), 'utf8');
  // 兼容 `job: 'x'` 与 `job:'x'`，排除 .job / _job 等成员访问
  const re = /(^|[^A-Za-z0-9_.$])job\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[2] === '...') continue;              // 注释里的占位符，不是真职称
    jobHits[m[2]] = (jobHits[m[2]] || 0) + 1;
  }
});

const hasCareer = title => V.run(`(function(){ var j = JOBS[${JSON.stringify(title)}]; return !!(j && j.career); })()`);

const rows = Object.keys(jobHits).sort().map(t => ({
  职称: t, 源码出现次数: jobHits[t], 在阶梯内: hasCareer(t) ? '✓' : '✗'
}));
say(H.table(rows, ['职称', '源码出现次数', '在阶梯内']));
const orphans = rows.filter(r => r.在阶梯内 === '✗');
say('');
say('- 源码里总共会写入 `' + rows.length + '` 种职称，其中 **' + orphans.length + '** 种不在任何 CAREERS 阶梯内：' +
  (orphans.length ? orphans.map(r => '`' + r.职称 + '`').join('、') : '（无）'));
say('');

/* 随机基线：30 岁时的职业状态 */
const baseline = [];
for (let i = 0; i < N; i++) {
  const r = V.run(`(function(){ var p = __imp_play(${i % 2 ? "'F'" : "'M'"}); var s30 = p.snap30 || {job:null,hasCareer:false}; return { job: s30.job, hasCareer: s30.hasCareer, careerId: s30.careerId }; })()`);
  baseline.push(r);
}
const careerRatio = baseline.filter(b => b.hasCareer).length / baseline.length;
const jobTally = {};
baseline.forEach(b => { jobTally[b.job || '—'] = (jobTally[b.job || '—'] || 0) + 1; });
const topJobs = Object.keys(jobTally).sort((a, b) => jobTally[b] - jobTally[a]).slice(0, 8);
say('**' + N + ' 局随机基线 · 30 岁时快照**');
say('');
say(H.table(topJobs.map(j => ({
  '30岁职业': j, '局数': jobTally[j], '占比': pct(jobTally[j] / baseline.length),
  '在阶梯内': hasCareer(j) ? '✓' : '✗'
})), ['30岁职业', '局数', '占比', '在阶梯内']));
say('');
say('- **众数职业**：`' + topJobs[0] + '`（' + pct(jobTally[topJobs[0]] / baseline.length) + '）');
say('- **`state.career !== null` 比例**：**' + pct(careerRatio) + '**（验收阈值 ≥ 90%）→ ' +
  (careerRatio >= 0.9 ? '✓ 通过' : '✗ 未达标'));

/* =========================================================
 * A-07 · careerIncome 乘子构成（消融法实测）
 * ========================================================= */
say('');
say('## A-07 · `careerIncome()` 隐藏乘子 → 显式 `CAREER_MULT`');
say('');
say('方法：**消融法**。对每个星座一点也不改，只把某一项因子清零 / 归 1，看收入掉多少 —— 掉的那部分就是那个乘子。乘子之间相乘应还原出总倍数。');
say('');

V.run(`
function __imp_clonePatch(st, patch) {
  const c = JSON.parse(JSON.stringify(st));
  if (patch.stats) Object.keys(patch.stats).forEach(k => { c.stats[k] = patch.stats[k]; });
  if (patch.edu) { c.edu = c.edu || {}; Object.keys(patch.edu).forEach(k => { c.edu[k] = patch.edu[k]; }); }
  if (patch.age !== undefined) c.age = patch.age;
  if (patch.career) { c.career = c.career || {}; Object.keys(patch.career).forEach(k => { c.career[k] = patch.career[k]; }); }
  if (patch.job) { c.job = patch.job; }
  return c;
}
`);

/* 基线状态：40 岁、本硕、中等偏上的属性 */
const ids = V.run('CAREERS.map(c => c.id)');
const multRows = [];
let multErrMax = 0;

for (const id of ids) {
  const r = V.run(`(function(){
    const c = CAREERS.find(x => x.id === ${JSON.stringify(id)});
    if (!c) return null;
    const topLevel = c.ladder.length - 1;
    const st = createGame({ gender: 'M', talents: [] });
    migrateState(st); marketMigrate(st);
    st.age = 40;
    st.edu = { eduLevel: c.edu, salaryK: 1.42, uni: 'u_985', mid:null,gao:null,hs:null,major:null,gradAge:22,study:0 };
    st.career = { id: c.id, level: topLevel, years: 15, joinedAge: 25 };
    st.job = c.ladder[topLevel].title;
    st.stats.INT = 90; st.stats.NET = 80; st.stats.LOY = 70;
    const base = c.ladder[topLevel].sal;
    const full = careerIncome(st);

    const noAge  = careerIncome(__imp_clonePatch(st, { age: 22 }));
    const noK    = careerIncome(__imp_clonePatch(st, { edu: { salaryK: 1 } }));
    const noInt  = careerIncome(__imp_clonePatch(st, { stats: { INT: 0 } }));
    const noNet  = careerIncome(__imp_clonePatch(st, { stats: { NET: 0 } }));
    const noLoy  = careerIncome(__imp_clonePatch(st, { stats: { LOY: 0 } }));

    return {
      id: c.id, name: c.name, title: c.ladder[topLevel].title, base: base, full: full,
      total: full / base, mAge: full / noAge, mK: full / noK,
      mInt: full / noInt, mNet: full / noNet, mLoy: full / noLoy
    };
  })()`);
  if (!r) continue;
  const prod = r.mAge * r.mK * r.mInt * r.mNet * r.mLoy;
  const err = Math.abs(prod - r.total) / r.total;
  if (err > multErrMax) multErrMax = err;
  multRows.push({
    职业: r.name, 顶级职称: r.title,
    '阶梯年薪(元)': r.base, '实测年薪(元)': r.full, '总倍数': r.total.toFixed(3),
    '×资历': r.mAge.toFixed(3), '×学历': r.mK.toFixed(3), '×智力': r.mInt.toFixed(3),
    '×人脉': r.mNet.toFixed(3), '×忠诚': r.mLoy.toFixed(3),
    '连乘校验': err < 0.005 ? '✓' : '✗ ' + (err * 100).toFixed(2) + '%'
  });
}

say('合成样本：40 岁 · salaryK=1.42 · INT=90 · NET=80 · LOY=70 · 顶级职级');
say('');
say(H.table(multRows, ['职业', '顶级职称', '阶梯年薪(元)', '实测年薪(元)', '总倍数',
  '×资历', '×学历', '×智力', '×人脉', '×忠诚', '连乘校验']));
say('');
const totals = multRows.map(r => Number(r['总倍数'])).sort((a, b) => a - b);
say('- 总倍数区间：**' + totals[0].toFixed(3) + '× ~ ' + totals[totals.length - 1].toFixed(3) +
  '×**，中位 **' + med(totals).toFixed(3) + '×**');
say('- 五个乘子**连乘是否还原总倍数**：最大相对误差 **' + (multErrMax * 100).toFixed(3) + '%** → ' +
  (multErrMax < 0.005 ? '✓ 乘子清单完整（没有漏掉的隐藏项）' : '✗ 仍有未解释的隐藏项'));
say('');

/* 配置表是否存在（改后才有） */
const hasCfg = V.run(`(typeof CAREER_MULT !== 'undefined')`);
say('- 显式配置表 `CAREER_MULT`：**' + (hasCfg ? '✓ 已存在' : '✗ 尚不存在（改造前）') + '**');
if (hasCfg) {
  const cfg = V.run('JSON.parse(JSON.stringify(CAREER_MULT))');
  say('  ```json');
  say('  ' + JSON.stringify(cfg, null, 2).split('\n').join('\n  '));
  say('  ```');
}

/* =========================================================
 * S-04 · 结局路径
 * ========================================================= */
say('');
say('## S-04 · 结局路径：`forceEnd` 是否绕过 `ENDINGS`');
say('');
say('方法：每局结算后**重跑一次 `ENDINGS.find()`**，把得到的 id 和 `state.ending` 比对。一致 = 走了正式判定；不一致 = 被 forceEnd 直写覆盖。');
say('');

const endTally = {};
const causeTally = {};
let viaEndings = 0, played = 0;
const distinct = new Set();

for (let i = 0; i < N_END; i++) {
  const a = V.run(`(function(){ var p = __imp_play(${i % 2 ? "'F'" : "'M'"}); return __imp_endingAudit(p.state); })()`);
  played++;
  if (a.viaEndings) viaEndings++;
  const key = a.cause ? (a.baseId + '←' + a.cause) : a.baseId;
  endTally[key] = (endTally[key] || 0) + 1;
  if (a.baseId && a.baseId.indexOf('THROW') !== 0) distinct.add(a.baseId);
  if (a.cause) causeTally[a.cause] = (causeTally[a.cause] || 0) + 1;
}

const endRows = Object.keys(endTally).sort((a, b) => endTally[b] - endTally[a]).map(k => ({
  结局: k, 局数: endTally[k], 占比: pct(endTally[k] / played)
}));
say(H.table(endRows, ['结局', '局数', '占比']));
say('');
say('- **走 ENDINGS 判定的比例**：**' + pct(viaEndings / played) + '**（验收阈值 ≥ 60%）→ ' +
  (viaEndings / played >= 0.6 ? '✓ 通过' : '✗ 未达标'));
say('- **结局可达种类**：**' + distinct.size + ' / ' + V.run('ENDINGS.length') + '**（验收阈值 ≥ 12）→ ' +
  (distinct.size >= 12 ? '✓ 通过' : '✗ 未达标'));
const legacyIds = ['end_elder', 'end_ill', 'end_dead'];
const legacyCount = Object.keys(endTally).filter(k => legacyIds.indexOf(k) >= 0)
  .reduce((a, k) => a + endTally[k], 0);
say('- **`forceEnd` 直写 `state.ending` 的局数**（id 仍为 end_elder/end_ill/end_dead）：**' + legacyCount + '** → ' +
  (legacyCount === 0 ? '✓ 已归零' : '✗ 仍有 ' + legacyCount + ' 局'));
if (Object.keys(causeTally).length) {
  say('- 死因叠加层分布：' + Object.keys(causeTally).map(k => '`' + k + '` × ' + causeTally[k]).join('、'));
}

say('');
say('---');
say('脚本退出。若要与基线对比，请把本次 out 文件另存后再改代码重跑。');

fs.writeFileSync(path.join(__dirname, 'imp-verify.out.txt'), out.join('\n'), 'utf8');
console.log('[已写出] ' + path.join(__dirname, 'imp-verify.out.txt'));
