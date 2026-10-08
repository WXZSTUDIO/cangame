/* =========================================================
 * 验收门准入矩阵 · 汇总 fault-inject 的产物
 * ---------------------------------------------------------
 * 对每一条「当前为绿」的断言，回答一个问题：
 *     造一个缺陷出来，它会红吗？
 *   会 → 红端证明成立，可作验收门
 *   不会 → 永绿门，降级为观察项
 *
 * 输入：out/fi-none.json（无故障基线）+ out/fi-<fault>.json（各故障）
 * 输出：out/admission-matrix.md
 * 只读产物，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');

const read = f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const base = read('fi-none.json');
const bmap = {};
base.assertions.forEach(a => { bmap[a.case + ' | ' + a.name] = a; });

const files = fs.readdirSync(OUT).filter(f => /^fi-.*\.json$/.test(f) && f !== 'fi-none.json');
const faults = files.map(read);

/* 断言 -> 已被哪些故障打红 */
const flipped = {};   // key -> [fault...]
const seen = {};      // key -> [fault...]（参与过对照的故障）
faults.forEach(f => {
  f.assertions.forEach(a => {
    const k = a.case + ' | ' + a.name;
    const b = bmap[k];
    if (!b) return;
    (seen[k] = seen[k] || []).push(f.fault);
    if (b.pass && !a.pass) (flipped[k] = flipped[k] || []).push(f.fault);
  });
});

/* 只关心「基线为绿」的断言 */
const greens = base.assertions.filter(a => a.pass);
const isRef = n => /参考|观察项|（说明）/.test(n);

const L = [];
L.push('# 验收门准入矩阵 · 绿门红端证明');
L.push('');
L.push('> 规则（主理人 10-08 立）：**任何门在进入门集之前，必须附一条「它在缺陷存在时会红」的证明。**');
L.push('> 证明不了的，不配叫验收门，只能标为观察项。');
L.push('');
L.push('- 生成时间：' + new Date().toISOString());
L.push('- 基线：`out/fi-none.json`（N=60，无故障）· 绿断言 **' + greens.length + '** 条');
L.push('- 注入故障：' + faults.map(f => '`' + f.fault + '`').join(' / '));
L.push('');

const real = greens.filter(a => !isRef(a.name));
const ref = greens.filter(a => isRef(a.name));

L.push('## 一、判定项（真实门）· ' + real.length + ' 条');
L.push('');
L.push('| 用例 | 断言 | 基线 | 注入后翻红的故障 | 判定 |');
L.push('|---|---|---|---|---|');
let proved = 0, unproved = 0;
real.forEach(a => {
  const k = a.case + ' | ' + a.name;
  const fl = flipped[k] || [];
  const tested = (seen[k] || []).length;
  let verdict;
  if (fl.length) { verdict = '✅ 有判定力（' + fl.length + ' 个故障打红）'; proved++; }
  else if (tested) { verdict = '❌ **注入后仍绿 —— 永绿门**'; unproved++; }
  else { verdict = '⚪ 未注入（需另证）'; unproved++; }
  L.push('| ' + a.case + ' | ' + a.name.replace(/\|/g, '\\|') + ' | ' +
    (a.detail ? a.detail.split('·')[0].trim() : '—') + ' | ' +
    (fl.length ? fl.map(x => '`' + x + '`').join(' ') : '—') + ' | ' + verdict + ' |');
});
L.push('');
L.push('- 已证明有判定力：**' + proved + '** 条；未证明（永绿 / 未注入）：**' + unproved + '** 条');
L.push('');

L.push('## 二、声明为「参考 / 观察项」的绿断言 · ' + ref.length + ' 条');
L.push('');
L.push('> 这些按构造就是 `R.ok(true, ...)`，永远绿。它们**不是门**，不参与判定，');
L.push('> 因此不适用准入规则 —— 但**名字必须写清「参考 / 观察项」**，否则会被误读成门。');
L.push('');
L.push('| 用例 | 断言名 | 标注是否清晰 |');
L.push('|---|---|---|');
let badName = 0;
ref.forEach(a => {
  const clear = /参考|观察项|（说明）/.test(a.name);
  if (!clear) badName++;
  L.push('| ' + a.case + ' | ' + a.name.replace(/\|/g, '\\|') + ' | ' + (clear ? '✅' : '❌ **未标注，易被误读为门**') + ' |');
});
L.push('');
L.push('- 标注不清：' + badName + ' 条');
L.push('');

fs.writeFileSync(path.join(OUT, 'admission-matrix.md'), L.join('\n'), 'utf8');
console.log('已写出 out/admission-matrix.md');
console.log('判定项 ' + real.length + ' 条：已证明 ' + proved + ' / 未证明 ' + unproved);
console.log('参考观察项 ' + ref.length + ' 条：标注不清 ' + badName);
console.log('');
real.filter(a => !(flipped[a.case + ' | ' + a.name] || []).length).forEach(a => {
  console.log('  [未证明] ' + a.case + ' | ' + a.name + '   (参与对照的故障数 ' + ((seen[a.case + ' | ' + a.name] || []).length) + ')');
});
