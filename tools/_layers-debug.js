/* 分层渲染：逐层累加，定位是哪一层画出了奇怪的形状 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { Resvg } = require(path.join('C:/Users/ro3ea/.workbuddy/binaries/node/workspace', 'node_modules', '@resvg', 'resvg-js'));
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} }, document: { addEventListener() {}, getElementById() { return null; } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const A = vm.runInContext(`({ portraitSVG })`, ctx);

const svg = A.portraitSVG('金智媛', 'F', 25, { forceStyle: 1 });
// 取出 <svg ...> 之后的所有顶层元素
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
// 粗分顶层元素（defs 整块算一层）
const parts = [];
let i = 0;
while (i < inner.length) {
  if (inner.startsWith('<defs>', i)) {
    const j = inner.indexOf('</defs>', i) + 7;
    parts.push(inner.slice(i, j)); i = j;
  } else {
    const m = /^<(rect|path|circle|ellipse|g|line)\b/.exec(inner.slice(i));
    if (!m) { i++; continue; }
    // 找匹配的结束（g 需要配对）
    if (m[1] === 'g') {
      let depth = 0, j = i;
      while (j < inner.length) {
        const open = inner.indexOf('<g', j); const close = inner.indexOf('</g>', j);
        if (open >= 0 && (open < close || close < 0)) { depth++; j = inner.indexOf('>', open) + 1; }
        else if (close >= 0) { depth--; j = close + 4; if (depth === 0) break; }
        else break;
      }
      parts.push(inner.slice(i, j)); i = j;
    } else {
      const j = inner.indexOf('>', i) + 1;
      parts.push(inner.slice(i, j)); i = j;
    }
  }
}
console.log('layers:', parts.length);
parts.forEach((p, k) => console.log(k, p.slice(0, 90).replace(/\n/g, ' ')));

// 累加渲染
let acc = '';
const cols = Math.ceil(parts.length / 4);
const cell = 150;
let body = '';
parts.forEach((p, k) => {
  acc += p;
  const sheetInner = acc;
  const x = (k % cols) * cell, y = Math.floor(k / cols) * cell;
  body += `<g transform="translate(${x},${y})"><rect width="${cell}" height="${cell}" fill="#ddd"/>` +
    `<svg x="10" y="10" width="${cell - 20}" height="${cell - 20}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${sheetInner}</svg>` +
    `<text x="${cell / 2}" y="${cell - 8}" font-size="11" text-anchor="middle" fill="#000" font-family="sans-serif">layer ${k}</text></g>`;
});
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${Math.ceil(parts.length / cols) * cell}" viewBox="0 0 ${cols * cell} ${Math.ceil(parts.length / cols) * cell}">${body}</svg>`;
fs.writeFileSync(path.join(__dirname, '_shots', 'layers.png'), new Resvg(sheet, { fitTo: { mode: 'width', value: cols * cell * 2 } }).render().asPng());
console.log('layers.png written');
