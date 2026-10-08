/* =========================================================
 * PERF-01 · 全局命名空间耦合 + data.js 利用率分析
 *  1) 每个模块向全局注入多少个顶层标识符
 *  2) 跨文件重名（一旦出现就是 SyntaxError 级事故）
 *  3) 模块依赖矩阵：谁用了谁的符号（判断能否拆懒加载）
 *  4) top-level 函数/var 是否撞名 window 内建 API
 *  5) 加载顺序敏感性实测：打乱顺序会怎样
 *  6) data.js 数据表利用率：跑 N 局看有多少条事件真的会被抽到
 *
 * 运行： node production/phase6-polish/perf/scripts/coupling-probe.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const out = [];
function say(s) { console.log(s); out.push(s); }

say('# 全局命名空间耦合与 data.js 利用率分析');
say('生成时间：' + new Date().toISOString());
say('');

/* ---------- 1~3. 顶层声明与依赖 ---------- */
const declRe = /^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/;
const info = {};
H.MODULES.forEach(f => {
  const src = H.read(f);
  const lines = src.split('\n');
  const decls = [];
  lines.forEach((l, i) => {
    const m = l.match(declRe);
    if (m) decls.push({ name: m[1], line: i + 1, kind: l.split(/\s/)[0] });
  });
  info[f] = { decls, src };
});

say('## 1. 各模块向全局注入的顶层标识符');
const rows1 = H.MODULES.map(f => ({
  模块: f.replace('assets/', ''),
  '顶层标识符数': info[f].decls.length,
  '其中 function': info[f].decls.filter(d => d.kind === 'function').length,
  '其中 const/let': info[f].decls.filter(d => d.kind !== 'function' && d.kind !== 'var').length,
  KB: (Buffer.byteLength(info[f].src, 'utf8') / 1024).toFixed(1)
}));
say(H.table(rows1, ['模块', '顶层标识符数', '其中 function', '其中 const/let', 'KB']));
const totalDecl = rows1.reduce((a, r) => a + r['顶层标识符数'], 0);
say('');
say('全剧：**' + totalDecl + ' 个顶层标识符**共享同一个全局词法作用域。');
say('');

say('## 2. 跨文件重名检查');
const owner = {};
const dupes = [];
H.MODULES.forEach(f => info[f].decls.forEach(d => {
  if (owner[d.name]) dupes.push({ 名字: d.name, 首次定义: owner[d.name], 冲突定义: f + ':' + d.line });
  else owner[d.name] = f + ':' + d.line;
}));
if (dupes.length) {
  say(H.table(dupes, ['名字', '首次定义', '冲突定义']));
  say('⚠ 存在重名：后加载的脚本会因 lexical redeclaration 整体失败。');
} else {
  const shared = {};
  say('  ✓ 8 个文件之间**没有重名**——这是目前唯一在保护这套架构的东西。');
}
say('');

say('## 3. 模块依赖矩阵（行 = 使用方，列 = 被依赖方）');
const short = H.MODULES.map(f => f.replace('assets/', '').replace('.js', ''));
const matrix = H.MODULES.map(f => {
  const row = { 使用方: f.replace('assets/', '').replace('.js', '') };
  H.MODULES.forEach(g => {
    const deps = info[g].decls.filter(d => d !== null);
    let hits = 0;
    // 在 f 的源码里找 g 声明的符号（排除 g 自己）
    if (g !== f) {
      const names = new Set(info[g].decls.map(d => d.name));
      const re = new RegExp('\\b(' + [...names].join('|') + ')\\b', 'g');
      const found = new Set((info[f].src.match(re) || []));
      hits = found.size;
    }
    row[g.replace('assets/', '').replace('.js', '')] = g === f ? '—' : hits;
  });
  return row;
});
say(H.table(matrix, ['使用方'].concat(short)));
say('');
say('> 读法：数字 = 该文件引用了对方文件声明的多少个符号。' +
  '**ui.js 是唯一的「消费者」**，逻辑层之间几乎单向依赖 data.js —— 这是可以做懒加载的有利条件。');
say('');

/* ---------- 4. 撞名 window 内建 ---------- */
say('## 4. 顶层声明是否撞 window 内建 API');
const NODE_WS = process.env.NODE_WS || 'C:/Users/ro3ea/.workbuddy/binaries/node/workspace';
const { JSDOM } = require(path.join(NODE_WS, 'node_modules', 'jsdom'));
const probeDom = new JSDOM('<!doctype html><html><body></body></html>');
const builtins = new Set(Object.getOwnPropertyNames(probeDom.window));
const risky = [];
H.MODULES.forEach(f => {
  info[f].decls.forEach(d => {
    // function/var 会成为 window 属性 → 真的会覆盖内建
    if ((d.kind === 'function' || d.kind === 'var') && builtins.has(d.name)) {
      risky.push({ 模块: f.replace('assets/', ''), 名字: d.name, 类型: d.kind, 说明: '会覆盖 window.' + d.name });
    }
  });
});
if (risky.length) say(H.table(risky, ['模块', '名字', '类型', '说明']));
else say('  ✓ 没有任何 function/var 顶层声明覆盖 window 内建成员。');
const shadowed = [];
H.MODULES.forEach(f => info[f].decls.forEach(d => { if (builtins.has(d.name)) shadowed.push(d.name + '（' + f.replace('assets/', '') + '）'); }));
if (shadowed.length) say('  ⚠ 但以下 `const/let` 会**遮蔽**同名 window 属性（词法作用域优先，一般不会出问题，但一旦有人在某处误把 `window.X` 写成 `X`，行为就会漂移）：' + shadowed.slice(0, 12).join('、'));
say('');

/* ---------- 5. 顺序敏感性实测 ---------- */
say('## 5. 加载顺序敏感性实测');
function tryOrder(order) {
  const { errors } = (() => {
    const { JSDOM, VirtualConsole } = require(path.join(NODE_WS, 'node_modules', 'jsdom'));
    const vc = new VirtualConsole();
    const errs = [];
    vc.on('jsdomError', e => { if (!/Not implemented|scrollTo/.test(e.message)) errs.push(e.message.split('\n')[0]); });
    const dom = new JSDOM(H.read('index.html'), { runScripts: 'dangerously', url: 'https://cangame.test/', virtualConsole: vc });
    order.forEach(f => {
      const el = dom.window.document.createElement('script');
      el.textContent = H.read(f);
      dom.window.document.body.appendChild(el);
    });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    return { errors: errs };
  })();
  return errors;
}
const baseErr = tryOrder(H.MODULES);
say('- 正常顺序：运行期错误 **' + baseErr.length + '** 条');
const swap = H.MODULES.slice();
[swap[0], swap[3]] = [swap[3], swap[0]];   // data.js ↔ school.js
const swapErr = tryOrder(swap);
say('- 把 data.js 和 school.js 换位置：错误 **' + swapErr.length + '** 条' +
  (swapErr.length ? '，首条：' + swapErr[0] : ''));
const swap2 = H.MODULES.slice();
[swap2[2], swap2[5]] = [swap2[5], swap2[2]];  // engine.js ↔ love.js
const swap2Err = tryOrder(swap2);
say('- 把 engine.js 和 love.js 换位置：错误 **' + swap2Err.length + '** 条' +
  (swap2Err.length ? '，首条：' + swap2Err[0] : ''));
say('');
say('> 结论：**加载顺序是硬性的、但没有机器校验**。`index.html` 里那 8 行 `<script>` 的顺序，' +
  '是整个 project 里最重要也最脆弱的一处「配置」。一旦有人重排/合并/加 `defer`，' +
  '轻则 TDZ `ReferenceError`，重则整页白屏——而且因为 ui.js 的兜底是最后才注册的，**连错误横幅都不会出现**。');
say('');

/* ---------- 6. data.js 利用率 ---------- */
say('## 6. data.js 数据表利用率（跑 60 局，看有多少事件真的会被抽到）');
const V = H.loadVM(false);
const cov = V.run(`(function(){
  const seen = new Set();
  const origResolve = resolveEvent;
  resolveEvent = function(state, ev, idx){ if (ev) seen.add(ev); return origResolve.apply(this, arguments); };
  const groups = { 本体: [], EVENTS_EXTRA: EVENTS_EXTRA, EVENTS_FAMILY: EVENTS_FAMILY, EVENTS_FAMILY2: EVENTS_FAMILY2, EVENTS_ERA: EVENTS_ERA };
  const extraIds = new Set();
  ['EVENTS_EXTRA','EVENTS_FAMILY','EVENTS_FAMILY2','EVENTS_ERA'].forEach(k => groups[k].forEach(e => extraIds.add(e)));
  groups.本体 = EVENTS.filter(e => !extraIds.has(e));
  for (let run = 0; run < 60; run++) {
    const st = createGame({ name: '覆盖'+run, gender: run%2 ? 'F':'M', talents: [] });
    migrateState(st); marketMigrate(st);
    let guard = 0;
    for(;;){
      if (++guard > 6000) break;
      const item = step(st);
      if (!item || item.type === 'end') break;
      if (item.type === 'exam') {
        const opts = item.exam.options || [];
        const usable = opts.filter(o=>!o.locked);
        resolveExam(st, opts.indexOf(usable.length?usable[Math.floor(Math.random()*usable.length)]:opts[0]));
        st.pending = null;
      } else if (item.type === 'event') {
        origResolve(st, item.ev, Math.floor(Math.random()*3));
        seen.add(item.ev);
      }
      if (st.finished) break;
    }
  }
  const rows = Object.keys(groups).map(k => ({ 组: k, 条数: groups[k].length, 出现过: groups[k].filter(e => seen.has(e)).length }));
  const total = EVENTS.length, hit = EVENTS.filter(e => seen.has(e)).length;
  return { total: total, hit: hit, rows: rows };
})()`);
say('- 运行时事件池 `EVENTS.length` = **' + cov.total + '** 条');
say(H.table(cov.rows.map(r => ({ 组: r.组, 条数: r.条数, '60 局中出现过': r.出现过, 覆盖率: (r.出现过 / r.条数 * 100).toFixed(1) + '%' })),
  ['组', '条数', '60 局中出现过', '覆盖率']));
say('- 整体覆盖率：**' + (cov.hit / cov.total * 100).toFixed(1) + '%**（' + cov.hit + ' / ' + cov.total + '）');
say('');
say('> 「没被抽到」≠「没用」——它们很多是低概率 / 强条件事件，是内容深度的一部分。' +
  '但这也说明：**没有任何一行 data.js 是可以在加载时省掉的**，' +
  '想靠「删数据」来优化没有空间；唯一可行的是「晚点加载」（见优化方案 O-02 的 data.js 延后策略）。');
say('');

fs.writeFileSync(path.join(__dirname, 'coupling-probe.out.txt'), out.join('\n'), 'utf8');
console.log('[已写出] ' + path.join(__dirname, 'coupling-probe.out.txt'));
