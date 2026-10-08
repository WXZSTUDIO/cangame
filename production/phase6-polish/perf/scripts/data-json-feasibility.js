/* 只读：判断事件池能否 JSON 化 —— 关键是对象里有没有函数 / 不可序列化值 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const ctx = vm.createContext({ console });
['assets/data.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});
const EVENTS = vm.runInContext('EVENTS', ctx);
const out = []; const say = s => { out.push(s); console.log(s); };

say('# 事件池 JSON 化可行性');
say('');
say('生成时间：' + new Date().toISOString());
say('');
say('事件总数：' + EVENTS.length);
say('');

/* 逐条深挖：统计出现过的「键路径」里值类型为 function 的 */
const fnKeys = new Map();      // 键路径 -> 出现次数
const badKeys = new Map();     // 不可 JSON 序列化的值
const keyCount = new Map();
let fnEvents = 0, badEvents = 0;

function walk(obj, p, evId) {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'function') {
      fnKeys.set(p, (fnKeys.get(p) || 0) + 1);
      return true;
    }
    if (typeof obj === 'undefined' || typeof obj === 'symbol' ||
        typeof obj === 'bigint' || (typeof obj === 'number' && !isFinite(obj))) {
      badKeys.set(p + ' <' + typeof obj + '>', (badKeys.get(p) || 0) + 1);
      return true;
    }
    return false;
  }
  if (Array.isArray(obj)) {
    let bad = false;
    for (let i = 0; i < obj.length; i++) bad = walk(obj[i], p + '[]', evId) || bad;
    return bad;
  }
  let bad = false;
  for (const k of Object.keys(obj)) {
    keyCount.set(k, (keyCount.get(k) || 0) + 1);
    bad = walk(obj[k], p ? p + '.' + k : k, evId) || bad;
  }
  return bad;
}

EVENTS.forEach(ev => {
  const bad = walk(ev, '', ev.id);
  if (bad) { badEvents++; }
  // 单独判函数
  let hasFn = false;
  (function w(o) {
    if (o === null || typeof o !== 'object') { if (typeof o === 'function') hasFn = true; return; }
    Object.keys(o).forEach(k => w(o[k]));
  })(ev);
  if (hasFn) fnEvents++;
});

say('## 1. 结论');
say('');
say('- 含**函数**的事件条数：**' + fnEvents + ' / ' + EVENTS.length +
    '**（' + (fnEvents / EVENTS.length * 100).toFixed(1) + '%）');
say('- 含其他不可序列化值的事件条数：**' + badEvents + ' / ' + EVENTS.length + '**');
say('');
say('函数出现的键路径（前 20）：');
say('');
say('| 键路径 | 出现次数 |');
say('|---|---:|');
[...fnKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  .forEach(([k, v]) => say('| `' + k + '` | ' + v + ' |'));
say('');
say('其他不可序列化键路径（前 10）：');
say('');
say('| 键路径 | 出现次数 |');
say('|---|---:|');
[...badKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([k, v]) => say('| `' + k + '` | ' + v + ' |'));
if (badKeys.size === 0) say('| （无） | 0 |');
say('');
say('## 2. 事件对象顶层键频次');
say('');
say('| 键 | 出现次数 |');
say('|---|---:|');
[...keyCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
  .forEach(([k, v]) => say('| `' + k + '` | ' + v + ' |'));
say('');
say('## 3. 判定');
say('');
if (fnEvents === 0 && badKeys.size === 0) {
  say('事件池**可以**无损转 JSON（`JSON.parse(JSON.stringify())` 往返安全）。');
} else {
  say('事件池**不能**无损转 JSON —— 必须保留函数，方案 P3 要么改成'
    + '「函数字符串化 + new Function」（等于手写 eval，且 CSP 下会挂），'
    + '要么把函数留在 JS 里、只把纯数据抽走（收益大幅缩水）。');
}
say('');
/* 实际往返验证 */
let roundTripOK = true, why = '';
try {
  const js = JSON.stringify(EVENTS);
  const back = JSON.parse(js);
  if (back.length !== EVENTS.length) { roundTripOK = false; why = '长度不一致'; }
  const a = JSON.stringify(back), b = JSON.stringify(EVENTS.map(e => JSON.parse(JSON.stringify(e))));
  if (a !== b) { roundTripOK = false; why = '往返内容不一致'; }
} catch (e) { roundTripOK = false; why = e.message; }
say('- JSON 往返实测：**' + (roundTripOK ? '通过' : '失败（' + why + '）') + '**');
say('- 往返后事件池 gzip 体积变化：见 data-size-probe（JSON 化后通常略小，去掉了空白与键引号）');
say('');
fs.writeFileSync(path.join(__dirname, 'data-json-feasibility.out.txt'), out.join('\n') + '\n', 'utf8');
say('[已写出] data-json-feasibility.out.txt');
