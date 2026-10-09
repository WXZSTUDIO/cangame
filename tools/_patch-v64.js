/* =========================================================
 * v6.4.0 数值重平衡补丁
 *  规则：所有属性上限统一 100。为保证「相对位置」不变（原尺度下的
 *        p50 ≈ 满值的 50%，新尺度下也应是 50 左右），成长量与门槛
 *        按各自旧上限等比缩放：
 *          INT/STR/CHA/WILL/NET/FAME  旧上限 200 → ×0.5
 *          HP/STRESS                  旧上限 120 → ×(100/120)
 *          LOY                        旧区间 -50..150 → ×(100/200)；阈值 (v+50)/2
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const A = f => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');
const W = (f, s) => fs.writeFileSync(path.join(ROOT, 'assets', f), s);

const HALF = { INT: 1, STR: 1, CHA: 1, WILL: 1, NET: 1, FAME: 1 };
const UNIT = {};
['INT', 'STR', 'CHA', 'WILL', 'NET', 'FAME'].forEach(k => UNIT[k] = 0.5);
['HP', 'STRESS'].forEach(k => UNIT[k] = 100 / 120);
UNIT.LOY = 100 / 200;

function scaleThreshold(k, v) {
  if (HALF[k]) return Math.round(v * 0.5);
  if (k === 'HP' || k === 'STRESS') return Math.round(v * 100 / 120);
  if (k === 'LOY') return Math.round((v + 50) / 2);
  return v;
}

let report = [];
function rep(file, re, fn, label) {
  let n = 0;
  const out = re[Symbol.replace] ? null : null;
  report.push(`${file}  ${label}: ${n}`);
}

/* ---------- 1. engine.js ---------- */
let e = A('engine.js');

// 1.1 初始属性
e = e.replace(
  /stats: \{ INT: 5, STR: 5, CHA: 5, WILL: 5, HP: 60, STRESS: 10, MONEY: 0, NET: 0, FAME: 0, LOY: 0,/,
  'stats: { INT: 3, STR: 3, CHA: 3, WILL: 3, HP: 50, STRESS: 8, MONEY: 0, NET: 0, FAME: 0, LOY: 0,');

// 1.2 applyEffects：成长量按 STAT_UNIT 缩放 + 上限统一 100
const OLD_CLAMP = `  s.HP = clamp(s.HP, 0, 120);
  s.STRESS = clamp(s.STRESS, 0, 120);
  s.INT = clamp(s.INT, 0, 200); s.STR = clamp(s.STR, 0, 200);
  s.CHA = clamp(s.CHA, 0, 200); s.WILL = clamp(s.WILL, 0, 200);
  s.NET = clamp(s.NET, 0, 200); s.FAME = clamp(s.FAME, 0, 200);
  s.LOY = clamp(s.LOY, -50, 150);
  s.CUR = clamp(s.CUR, 0, 100); s.LOVE = clamp(s.LOVE, 0, 100);
  s.SEC = clamp(s.SEC, 0, 100); s.AUTO = clamp(s.AUTO, 0, 100);
  s.GROW = clamp(s.GROW, 0, 100);
  s.ETH = clamp(s.ETH === undefined ? 60 : s.ETH, 0, 100);
  s.MOOD = clamp(s.MOOD === undefined ? 60 : s.MOOD, 0, 100);`;
const NEW_CLAMP = `  /* v6.4：所有属性上限统一 100。旧尺度（INT/FAME 等 200、HP/STRESS 120、
   * LOY -50..150）下的成长量在上方已按 STAT_UNIT 缩放，这里只做封顶。 */
  s.HP = clamp(s.HP, 0, STAT_CAP.HP);
  s.STRESS = clamp(s.STRESS, 0, STAT_CAP.STRESS);
  s.INT = clamp(s.INT, 0, STAT_CAP.INT); s.STR = clamp(s.STR, 0, STAT_CAP.STR);
  s.CHA = clamp(s.CHA, 0, STAT_CAP.CHA); s.WILL = clamp(s.WILL, 0, STAT_CAP.WILL);
  s.NET = clamp(s.NET, 0, STAT_CAP.NET); s.FAME = clamp(s.FAME, 0, STAT_CAP.FAME);
  s.LOY = clamp(s.LOY, 0, STAT_CAP.LOY);
  s.CUR = clamp(s.CUR, 0, 100); s.LOVE = clamp(s.LOVE, 0, 100);
  s.SEC = clamp(s.SEC, 0, 100); s.AUTO = clamp(s.AUTO, 0, 100);
  s.GROW = clamp(s.GROW, 0, 100);
  s.ETH = clamp(s.ETH === undefined ? 60 : s.ETH, 0, 100);
  s.MOOD = clamp(s.MOOD === undefined ? 60 : s.MOOD, 0, 100);
  for (const q in s) if (q !== 'MONEY' && typeof s[q] === 'number') s[q] = Math.round(s[q] * 100) / 100;`;
if (e.indexOf(OLD_CLAMP) < 0) throw new Error('engine clamp block not found');
e = e.replace(OLD_CLAMP, NEW_CLAMP);

// 1.3 applyEffects 里的成长量缩放
const OLD_ADD = `    if (s[k] === undefined) { s[k] = 0; }
    s[k] += v;`;
const NEW_ADD = `    if (s[k] === undefined) { s[k] = 0; }
    /* v6.4：成长量按新尺度缩放（见文件尾 STAT_UNIT 注释） */
    s[k] += (k === 'MONEY') ? v : v * (STAT_UNIT[k] || 1);`;
if (e.indexOf(OLD_ADD) < 0) throw new Error('applyEffects add block not found');
e = e.replace(OLD_ADD, NEW_ADD);

// 1.4 阈值常量
const E_TH = [
  [/stats\.STRESS > 60/g, 'STRESS', 60],
  [/s\.STRESS > 70/g, 'STRESS', 70],
  [/s\.STRESS > 60/g, 'STRESS', 60],
  [/s\.STRESS < 55/g, 'STRESS', 55],
  [/s\.STRESS < 45/g, 'STRESS', 45],
  [/s\.STRESS < 35/g, 'STRESS', 35],
  [/s\.INT >= 70/g, 'INT', 70],
  [/s\.HP >= 52/g, 'HP', 52],
  [/s\.HP < 70/g, 'HP', 70],
  [/s\.HP < 55/g, 'HP', 55],
  [/s\.HP < 45/g, 'HP', 45],
  [/s\.HP < 40/g, 'HP', 40],
  [/s\.HP < 28/g, 'HP', 28],
  [/s\.HP < 25/g, 'HP', 25],
  [/s\.CHA >= 52/g, 'CHA', 52],
  [/stats\.CHA >= 52/g, 'CHA', 52]
];
E_TH.forEach(([re, k, v]) => {
  const nv = scaleThreshold(k, v);
  e = e.replace(re, m => m.replace(String(v), String(nv)));
});

// 1.5 公式系数
e = e.replace('score += Math.min(25, s.FAME * 0.35);', 'score += Math.min(25, s.FAME * 0.70);');
e = e.replace('score += Math.min(15, s.NET * 0.12);', 'score += Math.min(15, s.NET * 0.24);');
e = e.replace('(s.STR || 0) / 500', '(s.STR || 0) / 250');
e = e.replace('clamp(b.cha / 320, 0, 0.12)', 'clamp(b.cha / 160, 0, 0.12)');
e = e.replace('p -= (state.stats.STRESS || 0) / 500;', 'p -= (state.stats.STRESS || 0) / 417;');
e = e.replace('clamp((s.LOY || 0) * 0.0008, 0, 0.06)', 'clamp((s.LOY || 0) * 0.0012, 0, 0.06)');
e = e.replace('clamp((s.LOY || 0) * 0.2, 0, 15)', 'clamp((s.LOY || 0) * 0.3, 0, 15)');

// 1.6 直接赋值式成长（绕过 applyEffects 的那些）
const KEYS = 'INT|STR|CHA|WILL|NET|FAME|HP|STRESS|LOY';
const before = e;
e = e.replace(new RegExp('((?:state\\.)?stats\\.(' + KEYS + ')\\s*([+-]?=)\\s*\\(?\\s*(?:state\\.)?stats\\.\\2\\s*\\|\\|\\s*0\\s*\\)?\\s*([+-])\\s*)(\\d+(?:\\.\\d+)?)', 'g'),
  (m, pre, k, eq, op, num) => pre + (Math.round(parseFloat(num) * (UNIT[k] || 1) * 100) / 100));
report.push('engine direct-assign growth: ' + (before !== e ? 'patched' : 'none'));
e = e.replace(new RegExp('(\\bs\\.(' + KEYS + ')\\s*([+-]?=)\\s*\\(?\\s*(?:state\\.)?stats\\.\\2\\s*\\|\\|\\s*0\\s*\\)?\\s*([+-])\\s*)(\\d+(?:\\.\\d+)?)', 'g'),
  (m, pre, k, eq, op, num) => pre + (Math.round(parseFloat(num) * (UNIT[k] || 1) * 100) / 100));
e = e.replace(new RegExp('(\\bs\\.(' + KEYS + ')\\s*([+-])=\\s*)(\\d+(?:\\.\\d+)?)', 'g'),
  (m, pre, k, op, num) => pre + (Math.round(parseFloat(num) * (UNIT[k] || 1) * 100) / 100));

W('engine.js', e);

/* ---------- 2. career.js ---------- */
let c = A('career.js');
c = c.replace('+ s.LOY * 0.35', '+ s.LOY * 0.525');
c = c.replace('+ s.INT * 0.22', '+ s.INT * 0.44');
c = c.replace('+ s.NET * 0.16', '+ s.NET * 0.32');
c = c.replace('+ s.WILL * 0.14', '+ s.WILL * 0.28');
c = c.replace('stats: { INT: 520, NET: 1000, LOY: 1100 }', 'stats: { INT: 260, NET: 500, LOY: 733 }');
c = c.replace('freelance: { INT: 400, NET: 800 }', 'freelance: { INT: 200, NET: 400 }');
// need 门槛
c = c.replace(/need: \{([^}]*)\}/g, (m, inner) => {
  return 'need: {' + inner.replace(/(\b(?:INT|STR|CHA|WILL|NET|FAME|HP|STRESS|LOY)\s*:\s*)(-?\d+)/g,
    (mm, kk, v) => {
      const key = kk.split(':')[0].trim();
      return kk.replace(v, String(scaleThreshold(key, parseInt(v, 10))));
    }) + '}';
});
// 重复职称改名，避免 JOBS 表互相覆盖（旧表是「后者覆盖前者」）
c = c.replace("{ title: '青训队员', sal: 7500000, cost: 8000000 }", "{ title: '电竞青训生', sal: 7500000, cost: 8000000 }");
c = c.replace("{ title: '住院医师', sal: 22000000, cost: 18000000 }", "{ title: '精神科住院医师', sal: 22000000, cost: 18000000 }");
c = c.replace("{ title: '主治医师', sal: 42000000, cost: 26000000 }", "{ title: '精神科主治医师', sal: 42000000, cost: 26000000 }");
c = c.replace("{ title: '副主任医师', sal: 70000000, cost: 34000000 }", "{ title: '精神科副主任医师', sal: 70000000, cost: 34000000 }");
// buildJobTable() 调用挪到文件末尾（原来在 CAREERS.push 之前，导致 v6.0+ 全部职业没进工资表）
c = c.replace('/* ---------- 初始化：把职业阶梯展开进 JOBS ---------- */\nbuildJobTable();\n',
  '/* ---------- 初始化：把职业阶梯展开进 JOBS（见文件末尾 buildJobTable()） ---------- */\n');
// careerIncome 兜底：JOBS 缺项时回落到职业阶梯
c = c.replace(`  const j = JOBS[state.job] || { salary: 0, cost: 12000000 };
  const s = state.stats || {};
  const S = CAREER_MULT.seniority, St = CAREER_MULT.stats;`,
  `  const j = jobEntry(state, state.job);
  const s = state.stats || {};
  const S = CAREER_MULT.seniority, St = CAREER_MULT.stats;`);
c = c.replace(`function freelanceIncome(state) {
  const j = JOBS[state.job] || { salary: 0, cost: 12000000 };`,
  `function freelanceIncome(state) {
  const j = jobEntry(state, state.job);`);
W('career.js', c);

/* ---------- 3. data.js ---------- */
let d = A('data.js');
const D_TH = [
  [/stats\.FAME >= 160/g, 'FAME', 160],
  [/stats\.FAME >= 95/g, 'FAME', 95],
  [/stats\.FAME >= 60/g, 'FAME', 60],
  [/stats\.FAME < 40/g, 'FAME', 40],
  [/stats\.NET >= 150/g, 'NET', 150],
  [/stats\.LOY >= 60/g, 'LOY', 60],
  [/stats\.WILL >= 60/g, 'WILL', 60]
];
D_TH.forEach(([re, k, v]) => {
  const nv = scaleThreshold(k, v);
  d = d.replace(re, m => m.replace(String(v), String(nv)));
});
W('data.js', d);

/* ---------- 4. love.js ---------- */
let l = A('love.js');
const L_TH = [
  [/(s\.CHA \|\| 40) \/ 340/g, 'CHA', 340],
  [/state\.stats\.CHA \/ 500/g, 'CHA', 500],
  [/state\.stats\.CHA \/ 320/g, 'CHA', 320]
];
L_TH.forEach(([re, k, v]) => l = l.replace(re, m => m.replace(String(v), String(Math.round(v * 0.5)))));
l = l.replace('state.stats.FAME * 0.3', 'state.stats.FAME * 0.6');
l = l.replace(/fameK: [\d.]+/, 'fameK: 0.0048');
W('love.js', l);

/* ---------- 5. legacy.js ---------- */
let g = A('legacy.js');
g = g.replace(/stats\.HP = 55/, 'stats.HP = 46');
W('legacy.js', g);

/* ---------- 6. ui.js ---------- */
let u = A('ui.js');
u = u.replace('(STATE.stats.INT || 0) >= 70', '(STATE.stats.INT || 0) >= 35');
W('ui.js', u);

console.log('v6.4 数值重平衡补丁已应用');
console.log(report.join('\n'));
