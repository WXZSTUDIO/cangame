/* =========================================================
 * 红门的「绿端可达性」体检 · gate-distance
 * ---------------------------------------------------------
 * 准入规则管的是红端（缺陷存在时会不会红）。
 * 对称地还有一个风险：**永红门** —— 缺陷修好了它也红，那就永远签不了字。
 * 本脚本给出每条红门「实测值 → 门限」的**倍数距离**，按距离降序排，
 * 距离越大，越该回头问一句「这个门限修复后真能到吗？」
 *
 * 用法：node gate-distance.js [regression 输出文件]
 * 只读产物，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
const file = process.argv[2] || path.join(OUT, 'regression-current.txt');
const txt = fs.readFileSync(file, 'utf8');

/* 带单位换算的取数：万 / 亿 必须折回同一量级，否则「25.77亿 vs 2000万」会算成 25.77 < 2000 */
const UNIT = { '万': 1e4, '亿': 1e8 };
function toNum(s) {
  const m = String(s).trim().match(/^(-?[\d.eE+-]+)\s*([万亿%×岁点]*)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const u = (m[2] || '').replace(/[^万亿]/g, '');
  return u ? n * (UNIT[u] || 1) : n;
}

const rows = [];
let cur = '';
txt.split(/\r?\n/).forEach(raw => {
  const l = raw.trim();
  if (/^REG-\d\d · /.test(l)) { cur = l.split(' ')[0]; return; }
  const m = l.match(/^\[FAIL\]\s+(.*?)\s*<<\s*实测\s*([\d.eE+-]+\s*[万亿%×岁点]*)\s*·\s*目标\s*([<>]=?|\[)\s*(.*)$/);
  if (!m) return;
  const name = m[1].trim();
  const v = toNum(m[2]);
  const op = m[3];
  const rest = m[4] || '';
  let target = null, kind = '';
  if (op === '[') {
    const mm = rest.match(/^([\d.eE+-]+\s*[万亿%×岁点]*)\s*,\s*([\d.eE+-]+\s*[万亿%×岁点]*)/);
    if (mm) {
      const lo = toNum(mm[1]), hi = toNum(mm[2]);
      if (v < lo) { target = lo; kind = '需升'; }
      else { target = hi; kind = '需降'; }
    }
  } else {
    const mm = rest.match(/^([\d.eE+-]+\s*[万亿%×岁点]*)/);
    if (mm) { target = toNum(mm[1]); kind = (op === '>=' ? '需升' : '需降'); }
  }
  if (target == null || !isFinite(v)) return;
  let dist;
  if (kind === '需升') dist = (target === 0) ? Infinity : (target - v) / Math.abs(target);
  else dist = (v === 0) ? Infinity : (v - target) / Math.abs(v);
  rows.push({ id: cur, name, v, target, kind, dist });
});

rows.sort((a, b) => b.dist - a.dist);
console.log('============ 红门的绿端可达性体检（按距离降序）============');
console.log('文件：' + path.basename(file));
console.log('');
console.log('  用例     距离     方向    实测        门限        断言');
console.log('  ' + '-'.repeat(96));
rows.forEach(r => {
  const d = isFinite(r.dist) ? (r.dist * 100).toFixed(0) + '%' : '∞';
  console.log('  ' + r.id.padEnd(8) + d.padStart(6) + '   ' + r.kind + '   ' +
    String(r.v).padEnd(10) + String(r.target).padEnd(11) + r.name);
});
console.log('');
console.log('读法：距离 = 还要走完的剩余比例。>70% 的建议回头确认门限在修复后真能到，否则是永红门。');
