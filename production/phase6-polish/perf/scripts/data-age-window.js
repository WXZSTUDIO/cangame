/* =========================================================
 * data.js 拆分方案 · 事件「时间窗」分布
 * ---------------------------------------------------------
 * 只读。回答拆分方案的核心问题：
 *   首屏（0 岁）到底需要多少条事件？能推迟多少？推迟到什么时候？
 *
 * 「窗口已开启」= ev.age[0] <= age，即这条事件从这一年起才可能被抽到。
 * 懒加载只需保证「窗口已开启」的事件在用到之前就位即可。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const H = require('./harness.js');
const V = H.loadVM(false);

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

const r = V.run(`(function(){
  function lo(e){ return (e.age && e.age.length) ? e.age[0] : 0; }
  function hi(e){ return (e.age && e.age.length) ? e.age[1] : 200; }

  // ① 各年龄「窗口已开启」的累计条数
  var cum = [];
  for (var age = 0; age <= 100; age++) {
    var n = 0;
    EVENTS.forEach(function(e){ if (lo(e) <= age) n++; });
    cum.push(n);
  }
  // ② 各年龄段「窗口开启」的新增条数
  var bands = [[0,6],[7,12],[13,18],[19,25],[26,40],[41,60],[61,80],[81,100]];
  var add = bands.map(function(b){
    var n = 0;
    EVENTS.forEach(function(e){ var l = lo(e); if (l >= b[0] && l <= b[1]) n++; });
    return { band: b[0] + '-' + b[1], n: n };
  });
  // ③ 关闭时间：窗口最后一年
  var close = bands.map(function(b){
    var n = 0;
    EVENTS.forEach(function(e){ var h = hi(e); if (h >= b[0] && h <= b[1]) n++; });
    return { band: b[0] + '-' + b[1], n: n };
  });
  // ④ 跨段 / 全开窗的条目（无法按阶段切）
  var wide = EVENTS.filter(function(e){ return lo(e) === 0 && hi(e) >= 100; }).length;
  var whole = EVENTS.filter(function(e){ return lo(e) === 0 && hi(e) === 200; }).length;
  // ⑤ 起手的几年各有多少条可用
  var first = [];
  for (var age = 0; age <= 6; age++) {
    first.push(EVENTS.filter(function(e){ return lo(e) <= age && hi(e) >= age; }).length);
  }
  return { total: EVENTS.length, cum: cum, add: add, close: close,
           wide: wide, whole: whole, first: first };
})()`);

say('# 事件「时间窗」分布（懒加载的天花板）');
say('');
say('生成时间：' + new Date().toISOString());
say('');
say('`matchEvent()` 用 `ev.age || [0,200]` 做年龄窗过滤（`engine.js:939`）。');
say('**一条事件只有在「窗口开启」后才可能被抽到** —— 这就是懒加载的理论上限：'
  + '窗口还没开的事件，理论上可以推迟到快开的时候再加载。');
say('');
say('## 1. 各年龄「窗口已开启」的累计条数');
say('');
say('| 年龄 | 已开启条数 | 占比 | 可推迟 |');
say('|---:|---:|---:|---:|');
[0, 1, 3, 6, 7, 10, 12, 13, 16, 18, 19, 22, 25, 30, 40, 50, 60, 61, 70, 80, 100].forEach(a => {
  const n = r.cum[a];
  say('| ' + a + ' 岁 | ' + n + ' | ' + (n / r.total * 100).toFixed(1) + '% | ' +
    (r.total - n) + ' 条（' + ((r.total - n) / r.total * 100).toFixed(1) + '%）|');
});
say('');
say('## 2. 各年龄段新增开启 / 关闭');
say('');
say('| 年龄段 | 本段新开启 | 本段关闭 |');
say('|---|---:|---:|');
r.add.forEach((a, i) => {
  say('| ' + a.band + ' | ' + a.n + ' | ' + r.close[i].n + ' |');
});
say('');
say('## 3. 无法按阶段切开的条目');
say('');
say('- 窗口 `[0, ≥100]`（几乎全程可抽）：**' + r.wide + ' 条**（' + (r.wide / r.total * 100).toFixed(1) + '%）');
say('- 窗口 `[0, 200]`（写死全开，等于没写 age）：**' + r.whole + ' 条**（' +
  (r.whole / r.total * 100).toFixed(1) + '%）');
say('');
say('> 这两类**必须在首屏就位**，它们构成了「按人生阶段拆分」方案不可压缩的下限。');
say('');
say('## 4. 起手 0~6 岁每年有多少条可用');
say('');
say('| 年龄 | 可选事件数 |');
say('|---:|---:|');
r.first.forEach((n, a) => say('| ' + a + ' 岁 | ' + n + ' |'));
say('');
say('> 这是「首屏最小事件集」的实际需求量。注意抽事件还要求 `state.used` 没抽过，'
  + '实际可选会更少 —— 所以首屏只需要 `窗口在 0~6 岁开启` 的那部分。');
say('');

/* 关键结论 */
const at0 = r.cum[0], at18 = r.cum[18], at60 = r.cum[60];
say('## 5. 结论：懒加载的天花板');
say('');
say('- 首屏（0 岁）只需 **' + at0 + ' / ' + r.total + '** 条（' + (at0 / r.total * 100).toFixed(1) + '%）');
say('- 到 18 岁累计 **' + at18 + '** 条（' + (at18 / r.total * 100).toFixed(1) + '%）');
say('- 到 60 岁累计 **' + at60 + '** 条（' + (at60 / r.total * 100).toFixed(1) + '%）');
say('');
say('**可推迟空间**：首屏之后仍有 **' + (r.total - at0) + ' 条（' +
  ((r.total - at0) / r.total * 100).toFixed(1) + '%）** 的事件窗口尚未开启，'
  + '理论上都可以推迟加载。');
say('');

/* ---------- 6. 现有 5 个池 × 年龄段 交叉表 ---------- */
say('## 6. 现有五个池 × 年龄开启段（决定「按池切」还是「按年龄重组」）');
say('');
const cross = V.run(`(function(){
  function lo(e){ return (e.age && e.age.length) ? e.age[0] : 0; }
  function band(l){ return l <= 6 ? '童年 0-6' : (l <= 18 ? '学生 7-18' : (l <= 60 ? '成年 19-60' : '晚年 61+')); }
  var pools = { 'EVENTS(本体)': null, EVENTS_EXTRA: EVENTS_EXTRA, EVENTS_FAMILY: EVENTS_FAMILY,
                EVENTS_FAMILY2: EVENTS_FAMILY2, EVENTS_ERA: EVENTS_ERA };
  // 本体 = EVENTS 里不属于其余四池的部分
  var rest = EVENTS_EXTRA.concat(EVENTS_FAMILY, EVENTS_FAMILY2, EVENTS_ERA);
  var ids = {}; rest.forEach(function(e){ ids[e.id] = 1; });
  pools['EVENTS(本体)'] = EVENTS.filter(function(e){ return !ids[e.id]; });
  var out = {};
  Object.keys(pools).forEach(function(n){
    out[n] = {};
    pools[n].forEach(function(e){ var b = band(lo(e)); out[n][b] = (out[n][b]||0)+1; });
  });
  return out;
})()`);
const bands = ['童年 0-6', '学生 7-18', '成年 19-60', '晚年 61+'];
say('| 池 | ' + bands.join(' | ') + ' | 合计 |');
say('|---|' + bands.map(() => '---:').join('|') + '|---:|');
Object.keys(cross).forEach(n => {
  const row = bands.map(b => cross[n][b] || 0);
  const tot = row.reduce((a, b) => a + b, 0);
  say('| `' + n + '` | ' + row.join(' | ') + ' | ' + tot + ' |');
});
say('');
say('> 若每个池的条目**集中在某一列**，就可以直接「按池切文件」；'
  + '若**铺满四列**，则必须按年龄重新分组，数据要打散重组（改动量与风险都上一个台阶）。');
say('');

fs.writeFileSync(path.join(__dirname, 'data-age-window.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] data-age-window.out.txt');
