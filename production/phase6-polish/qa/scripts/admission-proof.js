/* =========================================================
 * 验收门准入证明器 · admission-proof
 * ---------------------------------------------------------
 * 规则（主理人 10-08 立）：
 *   任何门在进入门集之前，必须附一条「它在缺陷存在时会红」的证明。
 *   证明不了的，不配叫验收门，只能标为观察项。
 *
 * 本脚本给出**双侧证明**：
 *   红端 — 在缺陷未修复的快照上，该判据必须判红（否则是永绿门）
 *   绿端 — 在同一判据下，必须存在真实数据能判绿（否则是永红门）
 * 只有两端都成立，这道门才算「有判定力」。
 *
 * 用法：
 *   node admission-proof.js                        # 读 out/playtest-raw.json
 *   node admission-proof.js out/playtest-raw-pre-imp01.json
 *   node admission-proof.js --all                  # 逐个跑 out/ 下所有 playtest-raw*.json
 * 只读产物，不修改 assets/。
 * ========================================================= */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const OUT = path.join(HERE, 'out');
const argv = process.argv.slice(2);
const ALL = argv.includes('--all');

/* ---- REG-01 现行判据（与 regression-run.js REG_01 保持一致） ---- */
const CRIT = {
  lifeMin: 60,      // 平均寿命 ≥ 60
  deadMax: 0.25,    // 「熄灭」占比 ≤ 0.25
  coverMin: 0.70    // 哨兵：endCause 覆盖率 ≥ 0.70
};

const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

function load(p) {
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const byP = {};
  if (Array.isArray(raw)) raw.forEach(r => { const k = r.persona || '?'; (byP[k] = byP[k] || []).push(r); });
  else Object.keys(raw).forEach(k => { byP[k] = raw[k] || []; });
  return byP;
}

function judge(g) {
  const n = g.length;
  const hasCause = g.filter(r => r.end && r.end.cause).length;
  const cover = hasCause / n;
  // 旧判据（F-01 前）：读 end.id —— S-04 之后 end_dead 已不在 ENDINGS 表，结构性恒 0
  const byId = g.filter(r => r.end && r.end.id === 'end_dead').length / n;
  // 新判据（F-01 后）：读 end.cause
  const byCause = g.filter(r => r.end && r.end.cause === 'end_dead').length / n;
  const life = mean(g.map(r => num(r.deathAge)));
  return {
    n, cover,
    byId, byCause, life,
    sentinel: cover >= CRIT.coverMin ? 'PASS' : 'FAIL',
    lifeV: life >= CRIT.lifeMin ? 'PASS' : 'FAIL',
    deadV: byCause <= CRIT.deadMax ? 'PASS' : 'FAIL',
    red: !(life >= CRIT.lifeMin && byCause <= CRIT.deadMax)
  };
}

const F3 = v => v.toFixed(3);
const F1 = v => v.toFixed(1);

function report(file) {
  const p = path.isAbsolute(file) ? file : path.join(OUT, file);
  if (!fs.existsSync(p)) { console.log('  [缺失] ' + file); return null; }
  const byP = load(p);
  const stat = fs.statSync(p);
  console.log('');
  console.log('──────── ' + path.basename(p) + '  (' + stat.mtime.toISOString() + ') ────────');
  console.log('判据：平均寿命 ≥ ' + CRIT.lifeMin + ' 岁   且   「熄灭」占比（end.cause）≤ ' + CRIT.deadMax);
  console.log('');
  console.log('  画像         n    哨兵   旧判据    新判据   寿命    寿命门  熄灭门   总判定');
  console.log('                        end.id   end.cause         ≥60     ≤0.25');
  console.log('  ' + '-'.repeat(76));
  const rows = [];
  Object.keys(byP).sort().forEach(k => {
    const j = judge(byP[k]);
    rows.push({ p: k, j });
    console.log('  ' + k.padEnd(11) + String(j.n).padStart(4) + '   ' +
      j.sentinel.padEnd(6) + F3(j.byId).padStart(7) + '  ' + F3(j.byCause).padStart(9) + '  ' +
      F1(j.life).padStart(6) + '   ' + j.lifeV.padEnd(6) + j.deadV.padEnd(8) +
      (j.red ? '🔴 RED' : '🟢 GREEN'));
  });
  const reds = rows.filter(r => r.j.red).map(r => r.p);
  const greens = rows.filter(r => !r.j.red).map(r => r.p);
  console.log('  ' + '-'.repeat(76));
  console.log('');
  console.log('  红端证明（缺陷存在时必须红）：' +
    (reds.length ? '✅ 成立 —— ' + reds.join(' / ') + ' 判红' : '❌ 不成立 —— 无任何画像判红，永绿门'));
  console.log('  绿端证明（修复后必须能绿）：' +
    (greens.length ? '✅ 成立 —— ' + greens.join(' / ') + ' 已可达绿' : '⚠️ 未达 —— 现存数据下无画像可达绿（永红门风险）'));
  const oldAllZero = rows.every(r => r.j.byId === 0);
  if (oldAllZero) {
    console.log('  ⚠️ 旧判据 end.id 在全部画像上恒为 0 —— 这正是 F-01「永绿门」的形态，已作废。');
  }
  return { file: path.basename(p), reds, greens, rows };
}

function main() {
  console.log('================ 验收门准入证明 · REG-01 ================');
  const files = ALL
    ? fs.readdirSync(OUT).filter(f => /^playtest-raw.*\.json$/.test(f))
    : (argv.filter(a => !a.startsWith('--')).length
      ? argv.filter(a => !a.startsWith('--'))
      : ['playtest-raw.json']);
  const res = files.map(report).filter(Boolean);
  console.log('');
  console.log('================ 结论 ================');
  res.forEach(r => {
    const ok = r.reds.length > 0 && r.greens.length > 0;
    console.log('  ' + r.file + '  →  ' + (ok
      ? '✅ 双侧证明成立，REG-01 是有判定力的验收门'
      : (r.reds.length === 0 ? '❌ 红端不成立（永绿门）' : '❌ 绿端不成立（永红门）')));
  });
}
main();
