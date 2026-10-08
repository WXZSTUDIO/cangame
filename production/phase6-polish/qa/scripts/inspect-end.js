/* 只读探针：检查 playtest 产物里 end 字段的实际形状，以及 ENDINGS 表是否含 end_dead */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const HERE = __dirname;
const OUT = path.join(HERE, 'out');

function peek(file) {
  const p = path.join(OUT, file);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const arr = Array.isArray(raw) ? raw : (raw[Object.keys(raw)[0]] || []);
  console.log('=== ' + file + ' ===');
  console.log('  top-level: ' + (Array.isArray(raw) ? 'Array(' + raw.length + ')' : 'Object keys=' + Object.keys(raw).join(',')));
  const counts = {};
  arr.forEach(r => {
    const e = r.end || {};
    const k = (e.id || '?') + ' | cause=' + (e.cause === undefined ? '<undef>' : e.cause);
    counts[k] = (counts[k] || 0) + 1;
  });
  Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 12)
    .forEach(k => console.log('    ' + String(counts[k]).padStart(5) + '  ' + k));
  const hasCauseKey = arr.length ? Object.prototype.hasOwnProperty.call(arr[0].end || {}, 'cause') : null;
  console.log('  首条 end 对象含 cause 键？ ' + hasCauseKey);
  console.log('');
}

['playtest-raw-pre-imp01.json', 'playtest-raw.json'].forEach(peek);

/* ENDINGS 表：end_dead 在不在？ */
const ROOT = path.join(HERE, '..', '..', '..', '..');   // cangame/
const ctx = { console, Math, Date, JSON, Object, Array, String, Number, Boolean, Error, isNaN, isFinite, parseInt, parseFloat };
ctx.window = ctx; ctx.globalThis = ctx;
ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, createElement: () => ({ style: {}, classList: { add(){}, remove(){} }, appendChild(){}, setAttribute(){} }) };
ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
vm.createContext(ctx);
['data.js', 'market.js', 'engine.js', 'school.js', 'career.js', 'love.js', 'loan.js', 'ui.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'), ctx, { filename: f });
});
const A = ctx.window.CangameAssets || ctx.CangameAssets || ctx.A;
const END = (A && A.ENDINGS) || [];
console.log('=== assets ENDINGS ===');
console.log('  总数 ' + END.length + '；含 end_dead？ ' + (END.some(e => e.id === 'end_dead') ? 'YES' : 'NO'));
console.log('  ids: ' + END.map(e => e.id).join(', '));
const FE = A && A.FORCE_END_IDS ? A.FORCE_END_IDS : null;
console.log('  FORCE_END_IDS = ' + JSON.stringify(FE));
