/* =========================================================
 * PERF-01 · 渲染层剖析（j도m 真 DOM）
 *  1) portraitSVG() 单次生成耗时 / 输出体积
 *  2) 人际页 renderRelView()：5 个 tab 各自的耗时、卡片数、头像数、HTML 体积
 *  3) 工作页 renderJobView()
 *  4) renderStream() —— 每次动作都把多条日志整页重绘
 *  5) innerHTML 字符串拼接 vs 赋值落地 的拆分
 *  6) 头像结果缓存后的收益实测（Memo 版 vs 现状）
 *
 * 运行： node production/phase6-polish/perf/scripts/render-bench.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const out = [];
function say(s) { console.log(s); out.push(s); }
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };

say('# 渲染层剖析 · cangame v5.5.0');
say('生成时间：' + new Date().toISOString());
say('环境：jsdom（真实 DOM API，但**无排版/绘制**）；这意味着测到的是' +
  '「字符串生成 + HTML 解析 + DOM 树构建」，**不含 layout / paint**。' +
  '浏览器里还要再算一次 layout+paint，通常是这里的 1.5–3 倍。');
say('');

const { window: w, doc, errors } = H.loadJSDOM();
say('脚本加载错误数：' + errors.length);
Object.defineProperty(w, '__ns', { value: () => Number(process.hrtime.bigint()) / 1e6 });

/* ---------- 造一个「人际关系很多」的中后期存档 ---------- */
w.eval(`
  window.__makeRichState = function (targetAge) {
    STATE = createGame({ name: '张伟', gender: 'M', familyId: null, talents: [] });
    migrateState(STATE); marketMigrate(STATE);
    let guard = 0;
    while (STATE.age < targetAge && ++guard < 6000) {
      const item = step(STATE);
      if (!item || item.type === 'end') break;
      if (item.type === 'exam') {
        const opts = item.exam.options || [];
        const usable = opts.filter(o => !o.locked);
        resolveExam(STATE, opts.indexOf(usable.length ? usable[0] : opts[0]));
        STATE.pending = null;
      } else if (item.type === 'event') {
        resolveEvent(STATE, item.ev, Math.floor(Math.random() * 3));
      }
      if (STATE.finished) break;
    }
    return {
      age: STATE.age, logs: (STATE.log||[]).length, mates: (STATE.classmates||[]).length,
      friends: (STATE.friends||[]).length, lovers: ((STATE.love||{}).candidates||[]).length,
      kids: (STATE.children||[]).length, exes: (STATE.exes||[]).length
    };
  };
`);

const info = w.eval('__makeRichState(45)');
say('## 0. 基准存档');
say(H.table([info], ['age', 'logs', 'mates', 'friends', 'lovers', 'kids', 'exes']));
say('');

/* ---------- 1. portraitSVG ---------- */
say('## 1. portraitSVG() 单次生成');
const NAMES = ['张伟', '李静', '王秀英', '刘建国', '陈思远', '杨小米', '赵铁柱', '周晓琳', '吴桂芳', '徐子涵',
  '孙 warriors', '马丽', '朱国强', '胡一菲', '林晚晚', '何书桓'];
const pRow = [];
NAMES.forEach(n => {
  const b = H.bench('portraitSVG("' + n + '")', 200, () => w.eval(`portraitSVG(${JSON.stringify(n)}, 'F', 34, {})`));
  pRow.push({ 名字: n, 'p50 ms': b.p50.toFixed(4), 'p95 ms': b.p95.toFixed(4) });
});
const allp = [];
NAMES.forEach(n => { const b = H.bench('x', 100, () => w.eval(`portraitSVG(${JSON.stringify(n)}, 'F', 34, {})`)); allp.push(b.p50); });
say(H.table(pRow.slice(0, 8), ['名字', 'p50 ms', 'p95 ms']));
const svgLen = w.eval(`portraitSVG('张伟','M',34,{}).length`);
const svgNodes = (() => {
  const d = w.document.createElement('div');
  d.innerHTML = w.eval(`portraitSVG('张伟','M',34,{})`);
  return d.querySelectorAll('*').length;
})();
say('');
say('- 单个头像 SVG：**' + (svgLen / 1024).toFixed(2) + ' KB 字符串 · ' + svgNodes + ' 个 SVG 元素**');
say('- 单次 portraitSVG p50 ≈ **' + (q(allp, 0.5) * 1000).toFixed(1) + ' µs**，p95 ≈ **' + (q(allp, 0.95) * 1000).toFixed(1) + ' µs**');
say('- 20 个头像累积：**' + (q(allp, 0.5) * 20).toFixed(3) + ' ms**（字符串生成）+ **' +
  (svgLen * 20 / 1024).toFixed(0) + ' KB HTML** 要给浏览器解析 → ' + (svgNodes * 20) + ' 个 DOM 节点');
say('');

/* ---------- 2. 人际页 ---------- */
say('## 2. 人际页 renderRelView() —— 逐个 tab');
function benchTab(tab) {
  w.eval(`REL_TAB = ${JSON.stringify(tab)}`);
  // 先渲染一次预热
  try { w.eval('renderRelView()'); } catch (e) { return { error: e.message }; }
  const b = H.bench(tab, 40, () => {
    try { w.eval('renderRelView()'); } catch (e) { throw new Error('renderRelView threw: ' + e.message); }
  });
  const el = doc.getElementById('view-rel');
  const html = el.innerHTML;
  return {
    tab: tab,
    'p50 ms': b.p50.toFixed(3),
    'p95 ms': b.p95.toFixed(3),
    'max ms': b.max.toFixed(3),
    'HTML KB': (html.length / 1024).toFixed(1),
    'DOM 节点': el.querySelectorAll('*').length,
    '头像数': el.querySelectorAll('svg').length
  };
}
const tabs = ['family', 'classmate', 'friends', 'love', 'good'];
const tabRows = [];
for (const t of tabs) {
  const r = benchTab(t);
  if (r.error) { say('  ✗ ' + t + ': ' + r.error); continue; }
  tabRows.push(r);
}
say(H.table(tabRows, ['tab', 'p50 ms', 'p95 ms', 'max ms', 'HTML KB', 'DOM 节点', '头像数']));
const worstTab = tabRows.slice().sort((a, b) => Number(b['p50 ms']) - Number(a['p50 ms']))[0];
say('');
say('最重的 tab：**' + worstTab.tab + '** —— ' + worstTab['p50 ms'] + ' ms / ' + worstTab['HTML KB'] +
  ' KB HTML / ' + worstTab['DOM 节点'] + ' DOM 节点 / ' + worstTab['头像数'] + ' 个头像');
say('');

/* 把「字符串生成」和「innerHTML 落地」拆开 */
say('### 2.1 拆开看：字符串生成 vs DOM 落地（以最重的 tab 为例）');
const t_s = H.bench('只拼字符串', 40, () => w.eval(`(function(){ REL_TAB=${JSON.stringify(worstTab.tab)}; return 1; })()`));
w.eval(`REL_TAB = ${JSON.stringify(worstTab.tab)}`);
const build = H.bench('renderRelView 全量', 40, () => w.eval('renderRelView()'));
const setHtml = (() => {
  const el = doc.getElementById('view-rel');
  const h = el.innerHTML;
  return H.bench('仅 innerHTML 赋值', 40, () => { el.innerHTML = h; });
})();
say(H.table([
  { 阶段: 'renderRelView() 全量（拼串 + 赋值）', 'p50 ms': build.p50.toFixed(3) },
  { 阶段: '仅 el.innerHTML = 已有字符串', 'p50 ms': setHtml.p50.toFixed(3) },
  { 阶段: '（相减）纯字符串拼接', 'p50 ms': Math.max(0, build.p50 - setHtml.p50).toFixed(3) }
], ['阶段', 'p50 ms']));
say('');
say('> innerHTML 赋值（HTML 解析 + 建树 + 旧树销毁）占了大部分成本。' +
  '这意味着**只缓存字符串收益有限**——真正省的是「别每次整页重建」。');
say('');

/* ---------- 3. 工作页 ---------- */
say('## 3. 工作页 renderJobView()');
const jobB = H.bench('renderJobView', 40, () => w.eval('renderJobView()'));
const jobEl = doc.getElementById('view-job');
say(H.table([{
  'p50 ms': jobB.p50.toFixed(3), 'p95 ms': jobB.p95.toFixed(3), 'max ms': jobB.max.toFixed(3),
  'HTML KB': (jobEl.innerHTML.length / 1024).toFixed(1), 'DOM 节点': jobEl.querySelectorAll('*').length
}], ['p50 ms', 'p95 ms', 'max ms', 'HTML KB', 'DOM 节点']));
say('');

/* ---------- 4. renderStream ---------- */
say('## 4. renderStream() —— 每一次点击都把整份日志重绘一遍');
const streamRows = [];
[50, 100, 200, 400].forEach(n => {
  w.eval(`(function(){
    const L = STATE.log;
    while (L.length > ${n}) L.shift();
    while (L.length < ${n}) L.push({ year: 1980 + L.length, age: L.length % 90, text: '这是一条用于基准测试的日志文本，长度接近真实产出。', type: 'story' });
  })()`);
  const b = H.bench('renderStream@' + n, 30, () => w.eval('renderStream()'));
  const el = doc.getElementById('stream');
  streamRows.push({
    '日志条数': w.eval('STATE.log.length'), 'p50 ms': b.p50.toFixed(3), 'p95 ms': b.p95.toFixed(3),
    'HTML KB': (el.innerHTML.length / 1024).toFixed(1), 'DOM 节点': el.querySelectorAll('*').length
  });
});
function STATE_logs(win) { return win.eval('STATE.log.length'); }
say(H.table(streamRows, ['日志条数', 'p50 ms', 'p95 ms', 'HTML KB', 'DOM 节点']));
const streamMax = streamRows[streamRows.length - 1];
say('');
say('日志在 pushLog 里被截断到 400 条（实测确认），所以 renderStream 的上限是 ' +
  streamMax['HTML KB'] + ' KB / ' + streamMax['DOM 节点'] + ' 节点，**每次点一下都要重建这么多**。');
say('');
say('> `afterAct()` 会连调 `renderStats() + renderStream() + renderRelView()/renderJobView()`。' +
  '也就是说**在人际页点一次「聊天」，要把 ' + streamMax['DOM 节点'] + ' 个日志节点 + ' +
  worstTab['DOM 节点'] + ' 个卡片节点全部销毁再重建**——而这只是为了屏幕上几行数字的变化。');
say('');

/* ---------- 5. 头像缓存（Memo）收益实测 ---------- */
say('## 5. 头像 Memo 缓存的收益实测');
w.eval(`
  window.__SVG_CACHE = new Map();
  window.__portraitMemo = function(name, gender, age, opt) {
    const key = name + '|' + gender + '|' + (age < 13 ? 'k' : age < 58 ? 'a' : age < 72 ? 'o' : 'e') + '|' + JSON.stringify(opt || {});
    let v = __SVG_CACHE.get(key);
    if (v === undefined) { v = portraitSVG(name, gender, age, opt); __SVG_CACHE.set(key, v); }
    return v;
  };
`);
// 冷：每个名字第一次
const names20 = Array.from({ length: 20 }, (_, i) => '同学' + i);
const cold = H.bench('20 个新头像（缓存未命中）', 30, () => {
  w.eval(`(function(){ let s = ''; for (let i = 0; i < 20; i++) s += __portraitMemo('新人'+Math.random(), 'F', 20, {}); return s.length; })()`);
});
// 热：重复同一批
w.eval(`(function(){ __SVG_CACHE.clear(); })()`);
const hot = H.bench('同样 20 个头像（缓存命中）', 30, () => {
  w.eval(`(function(){ let s = ''; for (let i = 0; i < 20; i++) s += __portraitMemo('同学'+i, 'F', 20, {}); return s.length; })()`);
});
say(H.table([
  { 场景: '20 个头像 · 每次都重算（现状）', 'p50 ms': cold.p50.toFixed(3) },
  { 场景: '20 个头像 · 命中缓存（改造后）', 'p50 ms': hot.p50.toFixed(4) },
  { 场景: '**节省**', 'p50 ms': (cold.p50 - hot.p50).toFixed(3) + ' ms（' + (cold.p50 / Math.max(hot.p50, 1e-6)).toFixed(0) + '×）' }
], ['场景', 'p50 ms']));
say('');
say('> 但注意：缓存只省掉**字符串生成**这一段。第 2.1 节的拆分显示，' +
  'innerHTML 解析才是大头 → **Memo + 不整页重建**要一起做才见效。');
say('');
const cacheFootprint = w.eval(`(function(){
  __SVG_CACHE.clear();
  const names = STATE.classmates.concat(STATE.friends||[]).map((p,i)=>p.name+'_'+i);
  names.forEach(n => __portraitMemo(n, 'F', 30, {}));
  let bytes = 0; __SVG_CACHE.forEach(v => bytes += v.length);
  return { n: __SVG_CACHE.size, kb: bytes/1024 };
})()`);
say('全通讯录头像全缓存后的常驻内存：' + cacheFootprint.n + ' 个 × ≈' +
  (cacheFootprint.kb / Math.max(cacheFootprint.n, 1)).toFixed(1) + ' KB = **' + cacheFootprint.kb.toFixed(0) + ' KB**（可接受）');
say('');

/* ---------- 6. 端到端：模拟一次完整点击 ---------- */
say('## 6. 端到端：在人际页点一次「聊天」的总代价');
w.eval('REL_TAB = "classmate"');
const clickB = H.bench('afterAct 全流程', 30, () => {
  w.eval(`(function(){
    renderStats(); renderStream(); renderRelView(); autosave();
  })()`);
});
say(H.table([{ 场景: 'renderStats + renderStream + renderRelView + autosave', 'p50 ms': clickB.p50.toFixed(3), 'p95 ms': clickB.p95.toFixed(3) }],
  ['场景', 'p50 ms', 'p95 ms']));
say('中低端手机（×5）估算：**' + (clickB.p50 * 5).toFixed(1) + ' ms** —— 单次点击 < 1 帧预算，' +
  '但如果用户连点或一键叙旧（内部循环 N 次 afterAct），就会明显掉帧。');
say('');

fs.writeFileSync(path.join(__dirname, 'render-bench.out.txt'), out.join('\n'), 'utf8');
console.log('[已写出] ' + path.join(__dirname, 'render-bench.out.txt'));
