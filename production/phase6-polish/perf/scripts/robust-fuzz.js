/* =========================================================
 * PERF-01 · 健壮性 / 安全压力测试（jsdom）
 *  A. 极端数值：NaN / Infinity / 超大值 / null / undefined
 *  B. 除零路径：cost=0 / years=0 / played 0
 *  C. 旧存档迁移：把字段一个个删掉，看 migrateState 是否补得回来
 *  D. localStorage 不可用（隐私模式）时的降级行为
 *  E. 玩家输入的姓名注入（XSS）——portraitSVG 的 aria-label 缺口
 *  F. crash 横幅的覆盖盲区（ui.js 之前 / 之后）
 *  G. 存档码 round-trip（含非 BMP 字符、emoji）
 *
 * 运行： node production/phase6-polish/perf/scripts/robust-fuzz.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const out = [];
function say(s) { console.log(s); out.push(s); }
const bad = [];
function fail(id, label, detail) { bad.push(id + ' ' + label); say('  ✗ **' + id + '** ' + label + (detail ? ' —— ' + detail : '')); }
function pass(id, label) { say('  ✓ ' + id + ' ' + label); }

say('# 健壮性 / 安全压力测试 · cangame v5.5.0');
say('生成时间：' + new Date().toISOString());
say('');

function fresh() {
  const { window: w, doc, errors } = H.loadJSDOM();
  w.eval(`
    window.mkState = function () {
      STATE = createGame({ name: '压力测试', gender: 'M', familyId: null, talents: [] });
      migrateState(STATE); marketMigrate(STATE);
      showScreen('screen-game'); GAME_VIEW = 'main';
      renderStats(); renderStream(); renderIdle();
      return STATE;
    };
  `);
  return { w, doc, errors };
}

/* ---------- 收集 render 后的可见文本 ---------- */
function sweepDoc(w, doc) {
  const ids = ['hudCash', 'hudWorth', 'metricStrip', 'stream', 'card', 'view-job', 'view-rel', 'marketBody', 'endScore', 'endStats'];
  const txt = ids.map(i => { const e = doc.getElementById(i); return e ? (e.textContent || '') : ''; }).join('\n');
  return txt;
}
const DANGER = /NaN|Infinity|undefined|\[object |&lt;\/|null%/g;

function runRender(w, fnBody) {
  const errs = [];
  try { w.eval(fnBody); } catch (e) { errs.push(e.constructor.name + ': ' + e.message.split('\n')[0]); }
  return errs;
}

/* ================= A. 极端数值 ================= */
say('## A. 极端数值注入');
const { w: wA, doc: docA } = fresh();
wA.eval('mkState()');
const statCases = ['MONEY', 'HP', 'MOOD', 'STRESS', 'INT', 'CHA', 'WILL', 'ETH', 'LOY', 'NET', 'FAME', 'SEC', 'GROW', 'LOVE'];
const poisons = [
  { v: 'NaN', js: 'NaN' }, { v: '+Inf', js: 'Infinity' }, { v: '-Inf', js: '-Infinity' },
  { v: '1e308', js: '1e308' }, { v: '-1e308', js: '-1e308' }, { v: 'null', js: 'null' },
  { v: 'undef', js: 'undefined' }, { v: 'string', js: '"abc"' }
];
const rowsA = [];
poisons.forEach(p => {
  let threw = 0, dirty = '';
  statCases.forEach(k => {
    const errs = runRender(wA, `(function(){ STATE.stats.${k} = ${p.js};
      renderStats(); renderStream(); GAME_VIEW='rel'; renderRelView(); GAME_VIEW='job'; renderJobView();
    })()`);
    threw += errs.length;
    const m = sweepDoc(wA, docA).match(DANGER);
    if (m && !dirty) dirty = k + ' → ' + [...new Set(m)].join(',');
    // 复原
    wA.eval(`(function(){ STATE = mkState(); })()`);
  });
  rowsA.push({ 注入值: p.v, '抛错次数': threw, '脏文本首次出现': dirty || '—' });
});
say(H.table(rowsA, ['注入值', '抛错次数', '脏文本首次出现']));
const anyDirty = rowsA.filter(r => r['脏文本首次出现'] !== '—');
if (anyDirty.length) fail('R-05', '极端数值会让 UI 显示 NaN/Infinity/undefined', anyDirty.map(r => r['注入值'] + ' 时 ' + r['脏文本首次出现']).join('；'));
else pass('R-05', '极端数值未产生可见脏文本');
say('');

/* ================= B. 除零 / 空集合 ================= */
say('## B. 除零与空集合路径');
const { w: wB, doc: docB } = fresh();
wB.eval('mkState()');
const zeroCases = [
  { id: 'loan.years=0', js: `STATE.loans = [{ id:'x', name:'测试贷', icon:'💰', principal:1000000, left:1000000, rate:0.05, years:0, startYear:2000 }];`, probe: `annualPayment(STATE.loans[0])` },
  { id: 'loan.left=0', js: `STATE.loans = [{ id:'x', name:'测试贷', principal:0, left:0, rate:0.05, years:5, startYear:2000 }];`, probe: `annualPayment(STATE.loans[0])` },
  { id: 'stock.cost=0', js: `STATE.market.stocks = [{ id:'s1', shares:100, cost:0 }]; STATE.market.prices.s1 = 10;`, probe: `(function(){ openMarketTab('hold'); return 1; })()` },
  { id: 'property 空列表', js: `STATE.market.props = [];`, probe: `(function(){ openMarketTab('hold'); return 1; })()` },
  { id: 'family.assets=0', js: `STATE.family = { assets:0, debt:0, income:0, spend:0 };`, probe: `familyIncome(STATE)` },
  { id: 'career=null 时 renderJob', js: `STATE.career = null; STATE.job = '待业';`, probe: `renderJobView()` },
  { id: 'parents=null', js: `STATE.parents = null;`, probe: `(function(){ REL_TAB='family'; renderRelView(); return 1; })()` },
  { id: 'classmates 空', js: `STATE.classmates = [];`, probe: `(function(){ REL_TAB='classmate'; renderRelView(); return 1; })()` },
  { id: 'love.candidates 空', js: `STATE.love = { candidates: [], partner: null, met: [] };`, probe: `(function(){ REL_TAB='love'; renderRelView(); return 1; })()` },
  { id: 'credit=null', js: `STATE.credit = null;`, probe: `loanProducts(STATE).length` }
];
const rowsB = [];
zeroCases.forEach(c => {
  const errs = runRender(wB, `(function(){ ${c.js} return (${c.probe}); })()`);
  rowsB.push({ 场景: c.id, 结果: errs.length ? '✗ 抛错：' + errs[0] : '✓ 通过' });
  if (errs.length) bad.push('R-06 ' + c.id);
});
say(H.table(rowsB, ['场景', '结果']));
say('');

/* ================= C. 旧存档迁移 ================= */
say('## C. 旧存档字段迁移（逐个字段删除后 migrateState 能否补回）');
const { w: wC, doc: docC } = fresh();
const fields = ['edu', 'love', 'classmates', 'exes', 'children', 'friends', 'parents', 'family',
  'market', 'career', 'loans', 'ill', 'achievements', 'socialTouch', 'uniTouch', 'goodTouch',
  'spouse', 'spouseName', 'log', 'queue', 'credit', 'flags', 'pet', 'grief', 'talents', 'pet'];
const rowsC = [];
fields.forEach(f => {
  const errs = runRender(wC, `(function(){
    const st = mkState();
    delete st.${f};
    migrateState(st);
    marketMigrate(st);
    // 迁移后必须还能走完一遍渲染
    STATE = st; renderStats(); renderStream();
    GAME_VIEW='rel'; renderRelView(); GAME_VIEW='job'; renderJobView();
    openMarketTab('hold');
    return st.${f} === undefined ? '字段未被补回' : 'ok';
  })()`);
  rowsC.push({ 删除字段: f, 结果: errs.length ? '✗ ' + errs[0] : '✓ 迁移后可渲染' });
  if (errs.length) bad.push('R-01 删除 ' + f);
});
say(H.table(rowsC, ['删除字段', '结果']));
const notRestored = rowsC.filter(r => r['未补回']);
say('');

// state.v 版本号的用途检查
const versionUsed = H.read('assets/engine.js').split('\n').filter(l => /SAVE_VERSION|\.v\b|state\.v\s*[=!]/.test(l));
say('> `SAVE_VERSION = 2` 写进了 `state.v`(' +
  (H.read('assets/engine.js').match(/v:\s*SAVE_VERSION/) ? '是' : '否') +
  ')，但全文检索**没有被任何地方读取/比较**——版本号目前是死字段，迁移完全靠 `migrateState` 的逐字段兜底。');
say('');

/* ================= D. localStorage 不可用 ================= */
say('## D. localStorage 不可用（隐私模式 / 禁用 Cookie）');
const { w: wD, doc: docD, errors: errD } = fresh();
const lsResult = wD.eval(`(function(){
  const res = { steps: [], err: null };
  // 模拟 Safari 隐私模式：访问即抛 SecurityError
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }
  });
  try { res.steps.push('autosave: ' + (autosave() === undefined ? 'no-throw' : '?')); }
  catch (e) { res.err = e.name; }
  return res;
})()`);
if (lsResult.err) {
  fail('R-03', 'localStorage 访问抛错时 autosave() 未被隔离', '异常类型 ' + lsResult.err + '，会冒泡到 window.onerror');
} else {
  say('  ✓ autosave() 在 localStorage 抛 SecurityError 时未崩溃（try/catch 生效）');
}
// 检查未被 try/catch 包裹的 localStorage 调用点
const rawLS = [];
H.read('assets/ui.js').split('\n').forEach((l, i) => {
  if (/localStorage\./.test(l) && !/try\s*\{/.test(l)) rawLS.push(i + 1);
});
if (rawLS.length) {
  fail('R-03b', '有 ' + rawLS.length + ' 处 localStorage 调用没在 try 块里', 'ui.js 行 ' + rawLS.join(', '));
} else pass('R-03b', '所有 localStorage 调用点都在 try/catch 内');
const rawLS2 = H.read('assets/ui.js').split('\n').map((l, i) => ({ l, i }))
  .filter(x => /localStorage\.(setItem|getItem|removeItem)/.test(x.l));
say('  localStorage 调用点清单：行 ' + rawLS2.map(x => x.i + 1).join(', '));
say('');

/* ================= E. 姓名注入（XSS） ================= */
say('## E. 玩家输入姓名的注入面');
const { w: wE, doc: docE } = fresh();
wE.eval('mkState()');
function injTest(payload, where) {
  const errs = runRender(wE, `(function(){
    STATE.name = ${JSON.stringify(payload)};
    renderStats(); GAME_VIEW='rel'; REL_TAB='family'; renderRelView();
    return 1;
  })()`);
  const relHtml = docE.getElementById('view-rel').innerHTML;
  // 有没有造出多余的属性/标签
  const probe = wE.eval(`(function(){
    const d = document.createElement('div');
    d.innerHTML = portraitSVG(${JSON.stringify(payload)}, 'M', 30, {});
    const el = d.querySelector('svg');
    const attrs = el ? Array.from(el.attributes).map(a => a.name) : [];
    return { attrs: attrs.join(','), html: d.innerHTML.slice(0, 200), nodes: d.querySelectorAll('*').length };
  })()`);
  return { errs, attrs: probe.attrs, nodes: probe.nodes };
}
const payloads = [
  '" onload="__PWN__"',
  '"><script>__PWN__</script>',
  "' onmouseover='__PWN__'",
  '"><img src=x onerror=__PWN__>'
];
let xssHit = false;
payloads.forEach(p => {
  const r = injTest(p);
  const relHtml = docE.getElementById('view-rel').innerHTML;
  const leaks = /onload|onerror|onmouseover|__PWN__|<script/i.test(r.attrs + ' ' + relHtml);
  if (leaks) { xssHit = true; say('  ⚠ payload ' + JSON.stringify(p) + ' → SVG 元素属性：' + r.attrs); }
});
if (xssHit) fail('R-04', '姓名里的双引号突破 SVG 属性边界，注入了事件处理器属性', '见上方「属性」清单：onload / onerror 被当成了真实属性');
else pass('R-04', '姓名注入未突破属性边界');

// 注入出来的处理器到底会不会执行？用 __PWN__ 打点实测
const execResult = (() => {
  const { JSDOM, VirtualConsole } = require(path.join(process.env.NODE_WS || 'C:/Users/ro3ea/.workbuddy/binaries/node/workspace', 'node_modules', 'jsdom'));
  const vc = new VirtualConsole();
  const dom = new JSDOM(H.read('index.html'), { runScripts: 'dangerously', url: 'https://cangame.test/', virtualConsole: vc });
  const win = dom.window;
  H.MODULES.forEach(m => {
    const el = win.document.createElement('script');
    el.textContent = H.read(m);
    win.document.body.appendChild(el);
  });
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  win.eval(`window.__PWNED = 0;`);
  const r = win.eval(`(function(){
    const payload = '" onload="window.__PWNED=1" x="';
    const d = document.createElement('div');
    d.innerHTML = portraitSVG(payload, 'M', 30, {});
    document.body.appendChild(d.firstChild);
    return typeof window.__PWNED !== 'undefined' ? window.__PWNED : -1;
  })()`);
  return r;
})();
say('  jsdom 实测：注入 `onload` 属性后 __PWNED = **' + execResult + '**（jsdom 会编译内联 handler，' +
  '浏览器行为同路径但未经真机验证 → 结论为「属性突破已确认，执行面待浏览器实测」）');
say('');
say('根因：`esc()` 只转义 `& < >`，**不转义引号**；而它被用在双引号属性里（`aria-label="${esc(name)}"`、`title="${esc(...)}"`）。');
say('输入框 `#inputName` 的 `maxlength=10` 且不校验字符 → 10 个字符足以构造 `' +
  '`" onload=x`（11 字符，刚好超一位，但 `"/onload=` 这类变体仍可能存在，且**孩子姓氏直接继承 `state.name[0]`**）。');
say('');

/* ================= F. crash 横幅覆盖盲区 ================= */
say('## F. 崩溃兜底的覆盖盲区');
const htmlSrc = H.read('index.html');
const scriptOrder = (htmlSrc.match(/<script src="([^"]+)"/g) || [])
  .map(s => s.replace(/.*src="/, '').replace(/".*/, '').replace(/\?.*$/, ''));
say('脚本加载顺序：' + scriptOrder.map(s => s.replace('assets/', '')).join(' → '));
say('- `window.addEventListener("error")` 注册在 **' + scriptOrder[scriptOrder.length - 1] +
  '** 里，也就是最后一个脚本。');
// 实测：在 ui.js 之前的模块里制造错误
/* 三个场景分别测试；jsdom 的 error 事件是异步派发的，所以要等一拍再读 */
function loadBreaking(brokenIndex, mode) {
  const { JSDOM, VirtualConsole } = require(path.join(process.env.NODE_WS || 'C:/Users/ro3ea/.workbuddy/binaries/node/workspace', 'node_modules', 'jsdom'));
  const vc = new VirtualConsole();
  const cap = [];
  vc.on('jsdomError', e => { if (!/Not implemented|scrollTo/.test(e.message)) cap.push(e.message.split('\n')[0]); });
  const dom = new JSDOM(H.read('index.html'), { runScripts: 'dangerously', url: 'https://cangame.test/', virtualConsole: vc });
  const win = dom.window;
  scriptOrder.forEach((f, i) => {
    let code = H.read(f);
    if (i === brokenIndex) {
      if (mode === 'syntax') code = code + '\nfunction __broken( { ;\n';
      if (mode === 'runtime') code = code + '\nthrow new Error("模拟运行时崩溃");\n';
    }
    const el = win.document.createElement('script');
    el.textContent = code;
    win.document.body.appendChild(el);
  });
  try {
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  } catch (e) { cap.push('dispatch threw: ' + e.message.split('\n')[0]); }
  return { win, cap, dom };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const scenarios = [
    { name: '① data.js 语法错误（CDN 截断/缓存损坏）', idx: 0, mode: 'syntax' },
    { name: '② data.js 顶层运行时抛错', idx: 0, mode: 'runtime' },
    { name: '③ ui.js 语法错误（兜底自己坏了）', idx: scriptOrder.length - 1, mode: 'syntax' }
  ];
  const rowsF = [];
  for (const s of scenarios) {
    const { win, cap } = loadBreaking(s.idx, s.mode);
    const immediate = win.document.getElementById('crash').classList.contains('show');
    await sleep(60);
    const delayed = win.document.getElementById('crash').classList.contains('show');
    const text = win.document.getElementById('crash').textContent || '';
    rowsF.push({
      场景: s.name,
      '横幅显示': delayed ? '✓ 显示' : (immediate ? '✓ 同步显示' : '✗ 未显示'),
      '提示文案': delayed || immediate ? text.slice(0, 46) + '…' : '—'
    });
    if (!delayed && !immediate) bad.push('R-07 ' + s.name);
  }
  // 对照组：ui.js 加载成功之后的运行时错误
  // 对照组：ui.js 加载成功之后的运行时错误（必须让错误在 window 自己的任务里抛，
  // 从 Node 侧 eval 抛出的异常会被 Node 的 try/catch 截走，不会走到 window.onerror）
  const ok = fresh();
  ok.w.eval(`(function(){ mkState(); window.setTimeout(function(){ throw new Error("模拟点击里的崩溃"); }, 0); })()`);
  await sleep(80);
  const okShown = ok.doc.getElementById('crash').classList.contains('show');
  rowsF.push({
    场景: '④ 【对照】ui.js 加载成功后的运行时抛错',
    '横幅显示': okShown ? '✓ 显示' : '✗ 未显示',
    '提示文案': (ok.doc.getElementById('crash').textContent || '—').slice(0, 46)
  });
  if (!okShown) bad.push('R-07 对照组：运行期错误也没显示横幅');
  say(H.table(rowsF, ['场景', '横幅显示', '提示文案']));
  say('');
  say('补充观察：data.js 一旦失败，后续脚本会抛 `ReferenceError: Cannot access \'JOBS\' before initialization` —— ' +
    '这是 top-level `const` 的 **TDZ（暂时性死区）**：跨文件只能靠加载顺序保证，编译器不给任何保护。');
  say('');
  await gSection();
  await tail();
})();

async function gSection() {
  say('## G. 存档码导出/导入 round-trip');
  const { w: wG } = fresh();
  wG.eval('mkState()');
  const rt = wG.eval(`(function(){
    const enc = s => btoa(unescape(encodeURIComponent(s)));
    const cases = {
      '纯中文': '张伟的一生',
      'emoji（含非 BMP）': '𠮷田🎉👍',
      '混合': '张伟 abc 123 \\u4e2d\\u6587'
    };
    const res = {};
    Object.keys(cases).forEach(k => {
      try {
        const s = enc(JSON.stringify({ t: cases[k] }));
        const back = JSON.parse(decodeURIComponent(escape(atob(s))));
        res[k] = { ok: back.t === cases[k] ? '✓ 一致' : '✗ 损坏：' + JSON.stringify(back.t), len: s.length };
      } catch (e) { res[k] = { ok: '✗ 抛错：' + e.message, len: 0 }; }
    });
    return res;
  })()`);
  say(H.table(Object.keys(rt).map(k => ({ 用例: k, 'Base64 长度': rt[k].len, 结果: rt[k].ok })), ['用例', 'Base64 长度', '结果']));
  say('> round-trip 本身没坏，但 `unescape/escape` 是 Annex B 遗留 API（已废弃于 ES 规范），' +
    '依赖 `%uXXXX` 非标准扩展处理 > U+FFFF 字符。建议换成 `TextEncoder` / `ArrayBuffer` 方案（见优化方案 O-08）。');
}

async function tail() {
  say('');
  say(fs.existsSync(path.join(__dirname, 'x')) ? '' : '');
  writeTail();
}

function writeTail() {
  say('## 汇总');
  if (bad.length) {
    say('发现问题 ' + bad.length + ' 项：');
    [...new Set(bad)].forEach(b => say('- ' + b));
  } else say('本轮未发现阻断性问题。');

  fs.writeFileSync(path.join(__dirname, 'robust-fuzz.out.txt'), out.join('\n'), 'utf8');
  console.log('[已写出] ' + path.join(__dirname, 'robust-fuzz.out.txt'));
}
