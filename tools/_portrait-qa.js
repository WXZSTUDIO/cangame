/* 头像视觉 QA：把 portraitSVG 渲染成 PNG 网格，人工检查 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { Resvg } = require(path.join('C:/Users/ro3ea/.workbuddy/binaries/node/workspace', 'node_modules', '@resvg', 'resvg-js'));
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} }, document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({ portraitSVG })`, ctx);

const OUT = path.join(__dirname, '_shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

function svgOf(name, gender, age, style) {
  return A.portraitSVG(name, gender, age, style == null ? {} : { forceStyle: style });
}

function renderGrid(items, cols, cell, file) {
  const rows = Math.ceil(items.length / cols);
  let body = '';
  items.forEach((it, i) => {
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    body += `<g transform="translate(${x},${y})"><rect width="${cell}" height="${cell}" fill="#fff"/>` +
      it.svg.replace(/<svg [^>]*>/, `<svg x="6" y="6" width="${cell - 12}" height="${cell - 12}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">`) +
      `<text x="${cell / 2}" y="${cell - 14}" font-size="9" text-anchor="middle" fill="#333" font-family="sans-serif">${it.cap}</text></g>`;
  });
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}">${body}</svg>`;
  if (process.env.DBG) console.log(JSON.stringify(sheet.slice(0, 420)));
  const png = new Resvg(sheet, { fitTo: { mode: 'width', value: cols * cell * 2 } }).render().asPng();
  fs.writeFileSync(path.join(OUT, file), png);
  console.log('rendered', file, items.length, 'portraits');
}

// 结构检查：所有组合不允许 NaN / undefined
let bad = 0, n = 0;
const NAMES = ['王磊', '李淑芬', '张伟', '金智媛', '刘思远', '陈嘉怡', '赵敏', '孙浩然', '周雨薇', '吴建国', '郑秀英', '林志强'];
NAMES.forEach(nm => ['F', 'M'].forEach(g => [6, 12, 17, 25, 32, 45, 60, 75].forEach(age => {
  const s = svgOf(nm, g, age);
  n++;
  if (s.indexOf('NaN') >= 0 || s.indexOf('undefined') >= 0) { bad++; console.log('BAD', nm, g, age); }
  if (!/^<svg viewBox="0 0 100 100"/.test(s)) { bad++; console.log('MALFORMED', nm, g, age); }
})));
// 所有发型强制枚举
for (let st = 0; st < 10; st++) {
  ['F', 'M'].forEach(g => { n++; const s = svgOf('测试人', g, 28, st); if (s.indexOf('NaN') >= 0) { bad++; console.log('STYLE BAD', g, st); } });
}
console.log(`structure: ${n - bad}/${n} clean`);

// 网格 1：女性 10 种发型（25 岁）
renderGrid(Array.from({ length: 10 }, (_, st) => ({ svg: svgOf('金智媛', 'F', 25, st), cap: 'F style ' + st })), 5, 120, 'grid-f-styles.png');
// 网格 2：男性 10 种发型（28 岁）
renderGrid(Array.from({ length: 10 }, (_, st) => ({ svg: svgOf('刘思远', 'M', 28, st), cap: 'M style ' + st })), 5, 120, 'grid-m-styles.png');
// 网格 3：同一批人 8 岁到 75 岁的变化（自然哈希，不强制发型）
renderGrid(NAMES.slice(0, 8).map(nm => ({ svg: svgOf(nm, 'F', 24), cap: nm + ' 24' })).concat(NAMES.slice(0, 4).map(nm => ({ svg: svgOf(nm, 'F', 66), cap: nm + ' 66' }))), 4, 120, 'grid-people.png');
// 网格 4：年龄轴（同一个人 6/12/17/25/40/58/72/85）
renderGrid([6, 12, 17, 25, 40, 58, 72, 85].map(age => ({ svg: svgOf('陈嘉怡', 'F', age), cap: 'age ' + age })).concat([6, 12, 17, 25, 40, 58, 72, 85].map(age => ({ svg: svgOf('孙浩然', 'M', age), cap: 'age ' + age }))), 8, 110, 'grid-ages.png');
console.log('done');
