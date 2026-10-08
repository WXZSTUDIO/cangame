/* =========================================================
 * tools/ 三条概率性断言 · 独立诊断（quality-lead）
 * engineering-lead 已给归因，这里**不照抄**，自己把机制跑一遍再下结论。
 * 只读 assets/，不改游戏源码。
 * ========================================================= */
const vm = require('vm');
const { loadEngine, exportApi, median } = require('./reg-lib.js');

const { ctx } = loadEngine();
const A = exportApi(ctx);
const X = vm.runInContext(`({
  friendGrowth, friendTick, illnessTick, treatIllness, rekindle, remarryEx,
  exList, loveInit, FRIEND_TYPES, ILLNESS, GAME_META, END_AGE
})`, ctx);

const mk = o => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));

console.log('================ tools/ 三条 flaky 断言 · 独立诊断 ================\n');
console.log('END_AGE =', X.END_AGE, ' | GAME_META.endAge =', X.GAME_META && X.GAME_META.endAge, '\n');

/* ---------------------------------------------------------
 * ① _verify-v54「恩师至少比你大 14 岁」
 * ------------------------------------------------------- */
console.log('---- ① 恩师年龄：friendGrowth vs friendTick ----');
function teacherGap(driver, n) {
  const gaps = []; let noTeacher = 0;
  for (let i = 0; i < n; i++) {
    const s = mk(); s.age = 12; s.friends = [];
    for (let y = 0; y < 6; y++) { driver(s); s.age++; }
    const t = (s.friends || []).find(f => f.key === 'teacher');
    if (!t) { noTeacher++; continue; }
    gaps.push(t.age - s.age);
  }
  gaps.sort((a, b) => a - b);
  return {
    n: n, noTeacher: noTeacher,
    min: gaps[0], max: gaps[gaps.length - 1], med: median(gaps),
    fail: gaps.filter(g => g < 14).length,
    failRate: +(gaps.filter(g => g < 14).length / n).toFixed(4)
  };
}
const g1 = teacherGap(s => X.friendGrowth(s), 400);
const g2 = teacherGap(s => X.friendTick(s), 400);
const cfgT = (X.FRIEND_TYPES || []).find(x => x.key === 'teacher');
console.log('  FRIEND_TYPES.teacher.ageGap 配置 =', JSON.stringify(cfgT && cfgT.ageGap));
console.log('  friendGrowth（测试现状）:', JSON.stringify(g1));
console.log('  friendTick （产品真实路径）:', JSON.stringify(g2));
console.log('  → 结论：' + (g1.fail > 0 && g2.fail === 0
  ? '确认。friendGrowth 不给朋友增龄 → 恩师年龄被冻结在相遇那年，6 年后差距被吃掉 6 岁。测试调错驱动函数，产品代码没问题。'
  : '与预期不符，需重新分析。'));

/* ---------------------------------------------------------
 * ② _verify-v53「未能触发疾病用于治疗验证」
 * ------------------------------------------------------- */
console.log('\n---- ② 疾病触发：失败样本的特征到底是什么 ----');
const N2 = 300;
let fail2 = 0;
const failAges = {}, failFinished = {}, failAlive = {}, failHP = [];
let anyFinished = 0;
for (let i = 0; i < N2; i++) {
  const s3 = mk({ name: 'T3', familyId: 'yiliao' });
  s3.startYear = 2000; s3.age = 45; s3.stats.HP = 60; s3.stats.MONEY = 5000000000;
  let g3 = 0;
  while (!s3.ill && g3++ < 60) { s3.age++; X.illnessTick(s3); }
  if (s3.finished) anyFinished++;
  if (!s3.ill) {
    fail2++;
    failAges[s3.age] = (failAges[s3.age] || 0) + 1;
    failFinished[String(s3.finished)] = (failFinished[String(s3.finished)] || 0) + 1;
    failAlive[String(s3.alive)] = (failAlive[String(s3.alive)] || 0) + 1;
    failHP.push(Math.round(s3.stats.HP));
  }
}
console.log('  失败率 = ' + (fail2 / N2 * 100).toFixed(1) + '% (' + fail2 + '/' + N2 + ')');
console.log('  失败样本的终龄分布 =', JSON.stringify(failAges));
console.log('  失败样本的 finished =', JSON.stringify(failFinished), ' alive =', JSON.stringify(failAlive));
console.log('  失败样本 HP 中位 =', median(failHP), '（起始 60）');
console.log('  整轮里出现 finished=true 的次数 =', anyFinished);
console.log('  → 若 finished 全为 false，说明「没判 finished」不是原因：只调 illnessTick 的循环里');
console.log('    finish() 根本不会被触发（finish 在 step() 里，且需 age>=END_AGE）。');

// 对照：每年得病概率是多少？
function riskProbe() {
  const s = mk({ familyId: 'yiliao' }); s.startYear = 2000; s.age = 45; s.stats.HP = 60;
  let hits = 0;
  for (let i = 0; i < 4000; i++) {
    const t = mk({ familyId: 'yiliao' }); t.startYear = 2000; t.age = 45 + (i % 60);
    t.stats.HP = 60; t.ill = null;
    X.illnessTick(t);
    if (t.ill) hits++;
  }
  return hits / 4000;
}
const perYear = riskProbe();
console.log('  每年得病概率实测 ≈ ' + (perYear * 100).toFixed(2) + '%');
console.log('  60 年全不中的理论概率 ≈ ' + (Math.pow(1 - perYear, 60) * 100).toFixed(1) + '%  ← 与实测失败率对照');
console.log('  → 结论：根因是「60 次伯努利试验，样本量不足」，不是 finished。');

// 修复方案验证：多开几局（每局 45→75 岁）
function fixedTrigger(maxRuns) {
  for (let r = 0; r < maxRuns; r++) {
    const s = mk({ name: 'T3', familyId: 'yiliao' });
    s.startYear = 2000; s.age = 45; s.stats.HP = 60; s.stats.MONEY = 5000000000;
    let g = 0;
    while (!s.ill && !s.finished && s.age < 75 && g++ < 40) { s.age++; X.illnessTick(s); }
    if (s.ill) return { ok: true, runs: r + 1 };
  }
  return { ok: false, runs: maxRuns };
}
let f2fail = 0;
for (let i = 0; i < 300; i++) if (!fixedTrigger(12).ok) f2fail++;
console.log('  修复方案「最多开 12 局 / 每局 ≤75 岁」实测失败率 = ' + (f2fail / 300 * 100).toFixed(2) + '% (' + f2fail + '/300)');

/* ---------------------------------------------------------
 * ③ _verify-v55「前任能复合」
 * ------------------------------------------------------- */
console.log('\n---- ③ 前任复合：60 连试到底为什么还会全败 ----');
const N3 = 300;
let fail3 = 0;
const msgs = {}, tries = [];
const affTrack = [];
for (let i = 0; i < N3; i++) {
  const s2 = mk({ gender: 'F' }); s2.age = 27;
  s2.exes = [{ name: '张远', gender: 'M', age: 28, met: 22, at: 25, reason: '分手', wasSpouse: false, affinity: 70, look: 60, lastTouch: -1 }];
  let rk = null, k = 0;
  const track = [];
  for (; k < 60 && !(rk && rk.ok); k++) {
    rk = X.rekindle(s2, 0);
    if (track.length < 4) track.push(Math.round((X.exList(s2)[0] || {}).affinity));
  }
  tries.push(k);
  if (!(rk && rk.ok)) {
    fail3++;
    msgs[rk ? rk.msg.replace(/\d+/, 'N') : 'null'] = (msgs[rk ? rk.msg.replace(/\d+/, 'N') : 'null'] || 0) + 1;
    if (affTrack.length < 5) affTrack.push(track.join('→'));
  }
}
console.log('  失败率 = ' + (fail3 / N3 * 100).toFixed(1) + '% (' + fail3 + '/' + N3 + ')');
console.log('  失败样本的最终 msg =', JSON.stringify(msgs));
console.log('  失败样本前 4 次尝试后的 affinity 轨迹样例 =', JSON.stringify(affTrack, null, 0));
console.log('  成功所需尝试次数 中位 =', median(tries));

// 机制验证：单次成功率 + 失败是否扣好感
const s = mk({ gender: 'F' }); s.age = 27;
s.exes = [{ name: '张远', gender: 'M', age: 28, wasSpouse: false, affinity: 70, look: 60, lastTouch: -1 }];
console.log('  机制探针：初始 affinity=70，CHA=' + s.stats.CHA);
let p1 = null;
for (let i = 0; i < 8; i++) {
  const r = X.rekindle(s, 0);
  const cur = (X.exList(s)[0] || {}).affinity;
  if (i < 4) console.log('    第' + (i + 1) + '次 → ok=' + r.ok + '  msg="' + r.msg + '"  affinity=' + cur);
  if (r.ok) break;
}

// 修复方案 A：循环内每次重置 affinity（与同文件 remarryEx 那段一致）
function fixedRekindle() {
  const s2 = mk({ gender: 'F' }); s2.age = 27;
  s2.exes = [{ name: '张远', gender: 'M', age: 28, wasSpouse: false, affinity: 70, look: 60, lastTouch: -1 }];
  let rk = null;
  for (let i = 0; i < 60 && !(rk && rk.ok); i++) {
    const e = X.exList(s2)[0]; if (e) e.affinity = 70;   // ← 每次重置，抵消失败惩罚
    rk = X.rekindle(s2, 0);
  }
  return !!(rk && rk.ok);
}
let f3fail = 0;
for (let i = 0; i < 300; i++) if (!fixedRekindle()) f3fail++;
console.log('  修复方案「循环内每次重置 affinity=70」实测失败率 = ' + (f3fail / 300 * 100).toFixed(2) + '% (' + f3fail + '/300)');

/* ---------------------------------------------------------
 * ④ _verify-v53「健康过低会强制得病」（普查发现的第四条）
 * ------------------------------------------------------- */
console.log('\n---- ④ 健康过低（HP=20）时 illnessTick 的单次命中率 ----');
{
  let hit = 0; const N4 = 2000;
  for (let i = 0; i < N4; i++) {
    const s = mk({ familyId: 'kuangqu' });
    s.startYear = 1990; s.age = 50; s.stats.HP = 20; s.stats.MONEY = 10;
    if (X.illnessTick(s)) hit++;
  }
  const p = hit / N4;
  console.log('  单次命中率 ≈ ' + (p * 100).toFixed(1) + '%');
  console.log('  原上限 12 次全不中概率 ≈ ' + (Math.pow(1 - p, 12) * 100).toFixed(2) + '%  ← 与普查到的 5% 对照');
  console.log('  上限提到 60 次全不中概率 ≈ ' + (Math.pow(1 - p, 60) * 100).toExponential(2) + '%');
}

/* ---------------------------------------------------------
 * ⑤ _verify-v53「不治会一路恶化到重度以上」（普查发现的第六条）
 * ------------------------------------------------------- */
console.log('\n---- ⑤ 不治恶化到 stage>=3 的单次成功率 ----');
{
  // 复刻 _verify-v53.js 第 171-185 行的采样方式
  let hit = 0, dead = 0; const N5 = 600;
  for (let n = 0; n < N5; n++) {
    // 严格复刻 _verify-v53.js:179-190 的参数（age=58 / HP=50 / MONEY=5）
    const s2 = mk({ name: 'T2', gender: 'F', familyId: 'kuangqu' });
    s2.startYear = 1990; s2.age = 58; s2.stats.HP = 50; s2.stats.MONEY = 5;
    const stages = [];
    let g2 = 0;
    while (!s2.ill && g2++ < 20) X.illnessTick(s2);
    for (let i = 0; i < 30 && !s2.finished; i++) {
      s2.age++;
      if (s2.ill) stages.push(s2.ill.stage);
      X.illnessTick(s2);
    }
    if (stages.some(x => x >= 3)) hit++;
    if (s2.finished) dead++;
  }
  const q = hit / N5;
  console.log('  单次成功率 q ≈ ' + (q * 100).toFixed(1) + '%   病死率 ≈ ' + (dead / N5 * 100).toFixed(1) + '%');
  [12, 40, 60].forEach(n => {
    [0.75, 0.7, 0.6].forEach(ratio => {
      const th = Math.ceil(n * ratio);
      // 正态近似算 P(X < th)
      const mu = n * q, sd = Math.sqrt(n * q * (1 - q));
      const z = (th - 0.5 - mu) / sd;
      const p = 0.5 * (1 + erf(z / Math.SQRT2));
      console.log('  n=' + n + ' 门限≥' + th + '（' + (ratio * 100) + '%）→ 失败概率 ≈ ' + (p * 100).toFixed(3) + '%');
    });
  });
}
function erf(x) {
  // Abramowitz & Stegun 7.1.26
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

console.log('\n================ 诊断结束 ================');
