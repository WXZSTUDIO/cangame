/* =========================================================
 * data.js 拆分方案 · 体积台账
 * ---------------------------------------------------------
 * 只读。把 data.js 按「顶层 const 声明」切成段，逐段量
 * raw / gzip / brotli 体积。拆分方案的所有收益估算都基于这张表。
 * ========================================================= */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
const br = (b) => zlib.brotliCompressSync(b, {
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
}).length;
const kb = (n) => (n / 1024).toFixed(1);

/* ---------- 1. 全站体积 ---------- */
const MODULES = ['data.js', 'market.js', 'engine.js', 'school.js', 'career.js',
  'love.js', 'loan.js', 'ui.js'];
say('# data.js 体积台账（拆分方案的事实基础）');
say('');
say('生成时间：' + new Date().toISOString());
say('');
say('## 1. 全站脚本体积');
say('');
say('| 文件 | raw (KB) | gzip (KB) | brotli (KB) |');
say('|---|---:|---:|---:|');
let totR = 0, totG = 0, totB = 0;
MODULES.forEach(m => {
  const b = fs.readFileSync(path.join(ROOT, 'assets', m));
  totR += b.length; totG += gz(b); totB += br(b);
  say('| ' + m + ' | ' + kb(b.length) + ' | ' + kb(gz(b)) + ' | ' + kb(br(b)) + ' |');
});
say('| **合计** | **' + kb(totR) + '** | **' + kb(totG) + '** | **' + kb(totB) + '** |');
say('');

/* ---------- 2. data.js 分段 ---------- */
const src = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const L = src.split('\n');

// 抓取所有「顶格 const」的起止行
const marks = [];
L.forEach((l, i) => {
  const m = l.match(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/);
  if (m) marks.push({ name: m[1], start: i });
});
// 抓取所有 push 合并语句
const pushes = [];
L.forEach((l, i) => { if (/EVENTS\.push\.apply/.test(l)) pushes.push({ line: i + 1, text: l.trim() }); });

say('## 2. `EVENTS` 是怎么组装的');
say('');
pushes.forEach(p => say('- `data.js:' + p.line + '` → `' + p.text + '`'));
say('');
say('> 每个子池在**声明之后立刻**被 `push.apply` 合并进 `EVENTS`。'
  + '这意味着只要合并语句还在，`EVENTS` 就是一个「加载期就完整」的数组 —— '
  + '任何懒加载方案都必须处理这个合并时机。');
say('');

// 事件池的边界：从声明行到下一个顶层声明（或 push 语句之后）
function sliceOf(name) {
  const i = marks.findIndex(m => m.name === name);
  if (i < 0) return null;
  const start = marks[i].start;
  const end = (i + 1 < marks.length) ? marks[i + 1].start : L.length;
  return { start: start + 1, end: end, bytes: Buffer.byteLength(L.slice(start, end).join('\n'), 'utf8') };
}

const H = require('./harness.js');
const V = H.loadVM(false);
/* 条数直接问运行时要，别在源码上数正则 —— 事件对象里 id 的写法不止一种。
 * EVENTS 此时已是合并后的 241，本体条数 = 241 − 其余四池。 */
const POOL_N = V.run(`(function(){
  var o = { EVENTS_EXTRA: EVENTS_EXTRA.length, EVENTS_FAMILY: EVENTS_FAMILY.length,
            EVENTS_FAMILY2: EVENTS_FAMILY2.length, EVENTS_ERA: EVENTS_ERA.length };
  o.EVENTS = EVENTS.length - o.EVENTS_EXTRA - o.EVENTS_FAMILY - o.EVENTS_FAMILY2 - o.EVENTS_ERA;
  return o;
})()`);

const POOLS = ['EVENTS', 'EVENTS_EXTRA', 'EVENTS_FAMILY', 'EVENTS_FAMILY2', 'EVENTS_ERA'];
say('## 3. 五个事件池的体积');
say('');
say('| 池 | 起止行 | 条数 | raw (KB) | gzip (KB) | 占 data.js gzip |');
say('|---|---|---:|---:|---:|---:|');
const dataGz = gz(Buffer.from(src, 'utf8'));
let poolR = 0, poolG = 0;
POOLS.forEach(p => {
  const s = sliceOf(p);
  if (!s) return;
  const seg = L.slice(s.start - 1, s.end - 1).join('\n');
  const b = Buffer.from(seg, 'utf8');
  poolR += b.length; poolG += gz(b);
  say('| `' + p + '` | ' + s.start + '–' + s.end + ' | ' + (POOL_N[p] == null ? '—' : POOL_N[p]) + ' | ' +
    kb(b.length) + ' | ' + kb(gz(b)) + ' | ' + (gz(b) / dataGz * 100).toFixed(1) + '% |');
});
say('| **事件池合计** | — | **241** | **' + kb(poolR) + '** | **' + kb(poolG) + '** | **' +
  (poolG / dataGz * 100).toFixed(1) + '%** |');
say('');
say('> `data.js` 整体：raw **' + kb(Buffer.byteLength(src, 'utf8')) + ' KB** / gzip **' +
  kb(dataGz) + ' KB**。');
say('> 事件池之外的「常量表」（姓氏/家庭/疾病/成就/职业/大学/专业/头衔/题库…）'
  + '占 gzip **' + (kb(dataGz - poolG)) + ' KB**（' + ((dataGz - poolG) / dataGz * 100).toFixed(1) + '%）。');
say('');

/* ---------- 3. 按人生阶段分组：事件池能切开吗 ---------- */
say('## 4. 关键问题：事件池能不能按「人生阶段」切开');
say('');
say('按 `age` / `minAge` / `maxAge` 字段统计现有 241 条的年龄分布，'
  + '判断「童年 / 学生 / 成年 / 晚年」四段的体积是否均衡（不均衡的话拆了也白拆）。');
say('');

const stat = V.run(`(function(){
  function bandOf(e){
    var a = e.age;
    var lo = a ? a[0] : (e.minAge != null ? e.minAge : null);
    var hi = a ? a[1] : (e.maxAge != null ? e.maxAge : null);
    if (lo == null && hi == null) return '不限年龄';
    if (hi != null && hi <= 6) return '0-6 童年';
    if (lo != null && lo >= 61) return '61+ 晚年';
    if (hi != null && hi <= 18) return '7-18 学生';
    if (lo != null && lo >= 19) return '19-60 成年';
    return '跨段';
  }
  var out = {};
  EVENTS.forEach(function(e){ var k = bandOf(e); out[k] = (out[k]||0)+1; });
  return out;
})()`);
say('| 年龄段 | 条数 | 占比 |');
say('|---|---:|---:|');
const tot = Object.keys(stat).reduce((a, k) => a + stat[k], 0);
Object.keys(stat).sort((a, b) => stat[b] - stat[a]).forEach(k => {
  say('| ' + k + ' | ' + stat[k] + ' | ' + (stat[k] / tot * 100).toFixed(1) + '% |');
});
say('');
say('> 「跨段」与「不限年龄」的条目**无法归入单一阶段文件**，'
  + '它们必须在首屏就可用 —— 这直接决定了拆分方案的天花板。');
say('');

/* ---------- 4. 事件在启动期是否被读取 ---------- */
say('## 5. 启动期到底读不读事件池');
say('');
const boot = V.run(`(function(){
  return {
    eventsLen: EVENTS.length,
    hasMakeEvent: typeof makeEvent === 'function',
    // 引擎里引用 EVENTS 的地方
    refs: null
  };
})()`);
say('- `EVENTS.length` = **' + boot.eventsLen + '**');
say('');
const refs = [];
['engine.js', 'school.js', 'career.js', 'love.js', 'loan.js', 'ui.js', 'market.js'].forEach(m => {
  const t = fs.readFileSync(path.join(ROOT, 'assets', m), 'utf8').split('\n');
  t.forEach((l, i) => {
    if (/\bEVENTS\b/.test(l)) refs.push({ f: m, i: i + 1, l: l.trim().slice(0, 88) });
  });
});
say('**`EVENTS` 在逻辑层 / UI 层的全部引用点（' + refs.length + ' 处）**：');
say('');
say('| 文件 | 行 | 代码 |');
say('|---|---:|---|');
refs.forEach(r => say('| ' + r.f + ' | ' + r.i + ' | `' + r.l.replace(/\|/g, '\\|') + '` |'));
say('');

fs.writeFileSync(path.join(__dirname, 'data-size-probe.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] data-size-probe.out.txt');
