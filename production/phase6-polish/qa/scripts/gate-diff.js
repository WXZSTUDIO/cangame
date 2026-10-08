/* =========================================================
 * REG-01 第二棒 · 修复前后对照门禁（gate-diff）
 *   --snapshot    把「当前结果」存为基线（out/baseline-reg.json / baseline-play.json）
 *   （默认）      跑一遍套件并与基线比对，输出 out/gate-diff.md
 *   --n=120       回归套件每组样本量
 *   --pn=200      playtest 每组样本量
 *   --only-reg / --only-play   只跑一边
 *   --rerun=0     不重跑，只读已有 out/ 产物做比对
 * 只读 assets/，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const OUT = path.join(HERE, 'out');
const NODE = process.env.NODE_BIN ||
  'C:/Users/ro3ea/.workbuddy/binaries/node/versions/22.22.2-3/node.exe';
const CNY_RATE = 1 / 180;

const arg = (k, d) => {
  const m = process.argv.slice(2).find(s => s.startsWith('--' + k + '='));
  return m ? m.split('=')[1] : d;
};
const has = k => process.argv.slice(2).includes('--' + k);

const N = parseInt(arg('n', '120'), 10);
const PN = parseInt(arg('pn', '200'), 10);
const RERUN = parseInt(arg('rerun', '1'), 10) === 1;
const DO_REG = !has('only-play');
const DO_PLAY = !has('only-reg');
const SNAP = has('snapshot');

function run(file, args, tag) {
  console.log('>> ' + tag + ' ...');
  const r = spawnSync(NODE, [file].concat(args), { cwd: HERE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return r.stdout || '';
}

/* ---------------- 1. 回归套件 ---------------- */
function snapReg() {
  const p = path.join(OUT, 'regression-result.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cases = {};
  (j.summary || []).forEach(c => { cases[c.id] = { pass: c.pass, total: c.total, allPass: !!c.allPass }; });
  return { ts: j.ts, N: j.N, fingerprint: j.fingerprint, cases };
}

/* ---------------- 2. Playtest 头条指标 ---------------- */
const median = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : 0;

function snapPlay() {
  const p = path.join(OUT, 'playtest-raw.json');
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  // playtest-raw.json 既可能是数组，也可能是 { persona: [rec...] }
  const byP = {};
  let total = 0;
  if (Array.isArray(raw)) {
    raw.forEach(r => { const k = r.persona || '?'; (byP[k] = byP[k] || []).push(r); });
    total = raw.length;
  } else {
    Object.keys(raw).forEach(k => { byP[k] = raw[k] || []; total += byP[k].length; });
  }
  const out = {};
  Object.keys(byP).sort().forEach(k => {
    const g = byP[k];
    const nets = g.map(r => num(r.finalNet) * CNY_RATE);
    const idle = g.map(r => (num(r.totalYears) ? num(r.idleYears) / num(r.totalYears) : 0));
    const salShare = g.map(r => (num(r.finalNet) !== 0 ? num(r.buckets && r.buckets.salary) / Math.abs(num(r.finalNet)) : 0));
    const pir = g.filter(r => r.housePriceAt30 != null && r.incomeAt30 > 0)
      .map(r => num(r.housePriceAt30) / num(r.incomeAt30));
    const house = g.filter(r => r.firstHouseAge != null).map(r => num(r.firstHouseAge));
    out[k] = {
      n: g.length,
      crash: g.filter(r => r.crash).length,
      lifeMean: +mean(g.map(r => num(r.deathAge))).toFixed(2),
      netMedCNY: Math.round(median(nets)),
      scoreMed: +median(g.map(r => num(r.score))).toFixed(1),
      sShare: +(g.filter(r => r.rank === 'S').length / g.length).toFixed(4),
      salaryShareMed: +median(salShare).toFixed(4),
      idleShareMean: +mean(idle).toFixed(4),
      pir30Med: pir.length ? +median(pir).toFixed(2) : null,
      firstHouseAgeMed: house.length ? +median(house).toFixed(1) : null,
      /* ⚠️ 必须读 end.cause：S-04 之后 end_dead 不在 ENDINGS 表里，读 end.id 会结构性恒为 0 */
      endDeadShare: +(g.filter(r => r.end && r.end.cause === 'end_dead').length / g.length).toFixed(4)
    };
  });
  return { ts: new Date().toISOString(), n: total, byPersona: out };
}

/* ---------------- 3. 比对 ---------------- */
const f2 = v => (v == null ? '—' : String(v));

function diffReg(base, now) {
  const rows = [];
  const ids = Object.keys(now && now.cases || {});
  ids.forEach(id => {
    const b = base && base.cases ? base.cases[id] : null;
    const n = now.cases[id];
    const bp = b ? b.pass : null, np = n.pass;
    let verdict = '—';
    if (b) {
      if (n.allPass && !b.allPass) verdict = 'FIXED ✅';
      else if (!n.allPass && b.allPass) verdict = 'REGRESSED ❌';
      else if (n.allPass && b.allPass) verdict = 'STAY GREEN';
      else if (np > bp) verdict = 'IMPROVED ↑';
      else if (np < bp) verdict = 'WORSE ↓';
      else verdict = 'STAY RED';
    } else verdict = 'NEW';
    rows.push({ id, base: b ? bp + '/' + b.total : '—', now: np + '/' + n.total, verdict });
  });
  return rows;
}

const DIFF_FIELDS = [
  ['lifeMean', '平均寿命', 1, 'higher'],
  ['netMedCNY', '终局净资产中位(元)', 0, 'lower'],
  ['scoreMed', '评分中位', 1, 'neutral'],
  ['sShare', 'S 评价占比', 2, 'neutral'],
  ['salaryShareMed', '工资结余占比中位', 2, 'higher'],
  ['idleShareMean', '空转年份占比', 2, 'lower'],
  ['pir30Med', '30岁房价/收入中位', 1, 'higher'],
  ['firstHouseAgeMed', '首次购房年龄中位', 1, 'neutral'],
  ['endDeadShare', '「熄灭」结局占比', 2, 'lower'],
  ['crash', '崩溃局数', 0, 'lower']
];

function diffPlay(base, now) {
  const rows = [];
  const ps = Object.keys((now && now.byPersona) || {});
  ps.forEach(p => {
    DIFF_FIELDS.forEach(([f, cn, dp, dir]) => {
      const b = base && base.byPersona && base.byPersona[p] ? base.byPersona[p][f] : null;
      const n = now.byPersona[p][f];
      let arrow = '';
      if (b != null && n != null && b !== n) {
        const better = dir === 'lower' ? (n < b) : (dir === 'higher' ? (n > b) : false);
        arrow = (n > b ? '↑' : '↓') + (dir === 'neutral' ? '' : (better ? ' 好' : ' 坏'));
      }
      rows.push({
        persona: p, field: cn,
        base: b == null ? '—' : (dp ? Number(b).toFixed(dp) : f2(b)),
        now: n == null ? '—' : (dp ? Number(n).toFixed(dp) : f2(n)),
        arrow
      });
    });
  });
  return rows;
}

/* ---------------- main ---------------- */
function main() {
  if (RERUN) {
    if (DO_REG) run('regression-run.js', ['--n=' + N], '回归套件 REG-00..REG-13');
    if (DO_PLAY) {
      run('playtest-run.js', [String(PN)], 'Playtest 六画像');
      run('analyze.js', [], 'Playtest 汇总');
      run('analyze2.js', [], 'Playtest 分层');
    }
  }
  const regNow = DO_REG ? snapReg() : null;
  const playNow = DO_PLAY ? snapPlay() : null;

  if (SNAP) {
    if (regNow) fs.writeFileSync(path.join(OUT, 'baseline-reg.json'), JSON.stringify(regNow, null, 2), 'utf8');
    if (playNow) fs.writeFileSync(path.join(OUT, 'baseline-play.json'), JSON.stringify(playNow, null, 2), 'utf8');
    console.log('\n已写入基线：out/baseline-reg.json / out/baseline-play.json');
    return;
  }

  const regBase = fs.existsSync(path.join(OUT, 'baseline-reg.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT, 'baseline-reg.json'), 'utf8')) : null;
  const playBase = fs.existsSync(path.join(OUT, 'baseline-play.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT, 'baseline-play.json'), 'utf8')) : null;

  const L = [];
  L.push('# 修复前后对照门禁 · gate-diff');
  L.push('');
  L.push('- 生成时间：' + new Date().toISOString());
  L.push('- 当前基线指纹：' + ((regNow && regNow.fingerprint) || '—'));
  L.push('- 对照基线时间：' + ((regBase && regBase.ts) || '—'));
  L.push('');

  if (regNow) {
    L.push('## 一、回归用例（REG-00 ~ REG-13）');
    L.push('');
    L.push('| 用例 | 基线 | 当前 | 判定 |');
    L.push('|---|---|---|---|');
    diffReg(regBase, regNow).forEach(r => {
      L.push('| ' + r.id + ' | ' + r.base + ' | ' + r.now + ' | ' + r.verdict + ' |');
    });
    const fixed = diffReg(regBase, regNow).filter(r => r.verdict.startsWith('FIXED')).length;
    const regressed = diffReg(regBase, regNow).filter(r => r.verdict.startsWith('REGRESSED')).length;
    L.push('');
    L.push('- 新转绿：' + fixed + ' 条；新转红（回归）：' + regressed + ' 条');
    L.push('');
  }

  if (playNow) {
    L.push('## 二、Playtest 头条指标');
    L.push('');
    L.push('| 画像 | 指标 | 基线 | 当前 | 变化 |');
    L.push('|---|---|---|---|---|');
    diffPlay(playBase, playNow).forEach(r => {
      L.push('| ' + r.persona + ' | ' + r.field + ' | ' + r.base + ' | ' + r.now + ' | ' + r.arrow + ' |');
    });
    L.push('');
  }

  fs.writeFileSync(path.join(OUT, 'gate-diff.md'), L.join('\n'), 'utf8');

  console.log('\n=========== 回归套件对照 ===========');
  if (regNow) diffReg(regBase, regNow).forEach(r =>
    console.log('  ' + r.id + '  基线 ' + r.base + '  →  当前 ' + r.now + '   ' + r.verdict));
  if (playNow && playBase) {
    console.log('\n=========== Playtest 头条（稳健流 / 激进流）===========');
    diffPlay(playBase, playNow).filter(r => /稳健|激进/.test(r.persona)).forEach(r =>
      console.log('  ' + r.persona + ' · ' + r.field + '   ' + r.base + ' → ' + r.now + '  ' + r.arrow));
  }
  console.log('\n已写出 out/gate-diff.md');
}

main();
