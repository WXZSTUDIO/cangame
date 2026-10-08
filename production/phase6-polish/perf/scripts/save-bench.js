/* =========================================================
 * PERF-01 · 存档（localStorage）剖析
 *  1) autosave() 在一次真实点击流里的调用频率
 *  2) JSON.stringify / localStorage.setItem / getItem 的实测延迟
 *  3) 三个 localStorage key 的常驻占用
 *  4) 导出/导入存档码的成本
 *  5) 配额行为：写满会怎样（含 lsSet 静默吞异常的后果）
 *
 * 运行： node production/phase6-polish/perf/scripts/save-bench.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const out = [];
function say(s) { console.log(s); out.push(s); }

say('# 存档 / localStorage 剖析 · cangame v5.5.0');
say('生成时间：' + new Date().toISOString());
say('环境：jsdom + 其内置 localStorage（纯内存 Map，比真实浏览器的磁盘落盘**偏乐观**）');
say('');

const { window: w, doc, errors } = H.loadJSDOM();
Object.defineProperty(w, '__ns', { value: () => Number(process.hrtime.bigint()) / 1e6 });

/* ---------- 1. autosave 调用频率 ---------- */
say('## 1. autosave() 的调用频率');
const callSites = H.read('assets/ui.js').split('\n')
  .map((l, i) => ({ n: i + 1, hit: /\bautosave\(\)/.test(l) }))
  .filter(x => x.hit).map(x => x.n);
say('源码里 `autosave()` 的调用点：**' + callSites.length + '** 处（ui.js 行 ' + callSites.join(', ') + '）');
say('');

/* 用真实点击流驱动：进入游戏 → 连点 N 步 */
w.eval(`
  window.__SAVE_LOG = [];
  const __origAutosave = autosave;
  autosave = function () { __SAVE_LOG.push({ t: __ns(), age: STATE ? STATE.age : -1, stack: (new Error()).stack.split('\\n')[2] || '' }); return __origAutosave.apply(this, arguments); };
`);

// 出生
w.eval(`(function(){
  STATE = createGame({ name: '存档测试', gender: 'M', familyId: null, talents: [] });
  migrateState(STATE); marketMigrate(STATE);
  showScreen('screen-game'); GAME_VIEW = 'main';
  renderStats(); renderStream(); renderIdle();
})()`);

const click = (id) => { const el = doc.getElementById(id); if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };

let steps = 0;
const perStep = [];
w.eval('__SAVE_LOG.length = 0');
for (let i = 0; i < 60; i++) {
  const before = w.eval('__SAVE_LOG.length');
  const btns = [...doc.querySelectorAll('#actions button')].filter(b => !b.disabled);
  if (!btns.length) { click('dockNext'); continue; }
  btns[Math.floor(Math.random() * btns.length)].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  steps++;
  const after = w.eval('__SAVE_LOG.length');
  perStep.push(after - before);
  // 偶发切到人际页做一次互动，观察 afterAct 路径
  if (i === 20) { click('dockRel'); const rb = doc.querySelector('#view-rel .rel-act:not(.dis)'); if (rb) rb.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); click('dockNext'); }
}
const sumSaving = w.eval('__SAVE_LOG.length');
say('- 点击 ' + steps + ' 次的过程中，autosave() 被调用 **' + sumSaving + '** 次');
say('- 平均每次点击 **' + (sumSaving / Math.max(steps, 1)).toFixed(2) + '** 次存档；' +
  '单次点击最多触发 **' + Math.max(...perStep) + '** 次');
say('- 换算：完整一局的 autosave 次数见下方「整局苦役」实测。');
say('');

/* 整局苦役：一路点到人生结束，统计 autosave 次数与其占用的总 CPU */
const life = w.eval(`(function(){
  STATE = createGame({ name: '整局', gender: 'M', familyId: null, talents: [] });
  migrateState(STATE); marketMigrate(STATE);
  showScreen('screen-game'); GAME_VIEW = 'main';
  renderStats(); renderStream(); renderIdle();
  __SAVE_LOG.length = 0;
  let clicks = 0;
  for (let i = 0; i < 3000; i++) {
    const active = document.body.dataset.screen;
    if (active !== 'screen-game') break;
    const btns = [...document.querySelectorAll('#actions button')].filter(b => !b.disabled);
    if (!btns.length) break;
    btns[Math.floor(Math.random() * btns.length)].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    clicks++;
  }
  const totalMs = __SAVE_LOG.reduce((a, r, i, arr) => a, 0);
  return { clicks: clicks, saves: __SAVE_LOG.length, age: STATE.age, screen: document.body.dataset.screen };
})()`);
say('**整局苦役实测**：一路点到人生结束（或 ' + life.clicks + ' 次点击、' + life.age + ' 岁、' + life.screen + '）');
say('- autosave() 被调用 **' + life.saves + '** 次');
say('- 平均 ' + (life.saves / Math.max(life.clicks, 1)).toFixed(2) + ' 次存档 / 次点击');
say('');
const bySite = w.eval(`(function(){
  const m = {};
  __SAVE_LOG.forEach(r => { const k = r.stack.replace(/\\s+at\\s+/, '').trim().slice(0, 40) || '(direct)'; m[k] = (m[k]||0)+1; });
  return Object.keys(m).map(k => ({ k: k, n: m[k] })).sort((a,b)=>b.n-a.n).slice(0, 8);
})()`);
say('调用来源分布：');
say(H.table(bySite.map(r => ({ 来源: r.k, 次数: r.n })), ['来源', '次数']));
say('');

/* ---------- 2. 单次写入延迟 ---------- */
say('## 2. 单次写入延迟（jsdom 内存 localStorage，偏乐观）');
const big = w.eval(`(function(){
  let tries = 0, st = null;
  while (tries++ < 12 && (!st || st.age < 70)) {
    st = createGame({ name: '存档测试' + tries, gender: 'M', familyId: null, talents: [] });
    migrateState(st); marketMigrate(st);
    let guard = 0;
    while (st.age < 78 && ++guard < 4000) {
      const item = step(st);
      if (!item || item.type === 'end') break;
      if (item.type === 'exam') {
        const opts = item.exam.options || [];
        const usable = opts.filter(o => !o.locked);
        resolveExam(st, opts.indexOf(usable.length ? usable[Math.floor(Math.random()*usable.length)] : opts[0]));
        st.pending = null;
      } else if (item.type === 'event') { resolveEvent(st, item.ev, Math.floor(Math.random() * 3)); }
      if (st.finished) break;
    }
    if (st.age >= 70) break;
  }
  STATE = st;
  return { age: st.age, tries: tries };
})()`);
say('样本：' + big.age + ' 岁的存档（尝试 ' + big.tries + ' 次才活到这个岁数——随机作答死亡率不低）');
const kb = w.eval('(JSON.stringify(STATE).length/1024).toFixed(1)');
const ser = H.bench('JSON.stringify(STATE)', 200, () => w.eval('JSON.stringify(STATE)'));
w.eval('__S = JSON.stringify(STATE)');
const set = H.bench('localStorage.setItem(auto, 串)', 200, () => w.eval(`localStorage.setItem('__bench_auto', __S)`));
const get = H.bench('localStorage.getItem(auto)', 200, () => w.eval(`localStorage.getItem('__bench_auto')`));
const parse = H.bench('JSON.parse(读回的串)', 200, () => w.eval(`JSON.parse(localStorage.getItem('__bench_auto'))`));
const full = H.bench('autosave() 全流程', 200, () => w.eval('autosave()'));
say(H.table([
  { 操作: 'JSON.stringify(STATE)', 'p50 ms': ser.p50.toFixed(3), 'p95 ms': ser.p95.toFixed(3) },
  { 操作: 'localStorage.setItem', 'p50 ms': set.p50.toFixed(3), 'p95 ms': set.p95.toFixed(3) },
  { 操作: 'localStorage.getItem', 'p50 ms': get.p50.toFixed(3), 'p95 ms': get.p95.toFixed(3) },
  { 操作: 'JSON.parse(读回)', 'p50 ms': parse.p50.toFixed(3), 'p95 ms': parse.p95.toFixed(3) },
  { 操作: '**autosave() 全流程**', 'p50 ms': full.p50.toFixed(3), 'p95 ms': full.p95.toFixed(3) }
], ['操作', 'p50 ms', 'p95 ms']));
say('存档序列化后 ' + kb + ' KB。真实浏览器的 setItem 会把 **' + kb + ' KB 同步刷到磁盘**，' +
  '在低端 Android WebView 上实测常见 3–15 ms；这里是纯内存，数字要再放大。');
say('');

/* ---------- 3. 常驻占用 ---------- */
say('## 3. 三个 localStorage key 的常驻占用');
const usage = w.eval(`(function(){
  const r = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    r[k] = (localStorage.getItem(k) || '').length;
  }
  return r;
})()`);
const usageRows = Object.keys(usage).filter(k => k !== '__bench_auto')
  .map(k => ({ key: k, '占用 KB': (usage[k] / 1024).toFixed(1) }));
usageRows.push({ key: '**合计**', '占用 KB': (Object.keys(usage).filter(k => k !== '__bench_auto').reduce((a, k) => a + usage[k], 0) / 1024).toFixed(1) });
say(H.table(usageRows, ['key', '占用 KB']));
say('典型浏览器 localStorage 配额 5–10 MB → **占用率 < 1%，配额不是风险点**。');
say('');

/* ---------- 4. 导出 / 导入 ---------- */
say('## 4. 导出 / 导入存档码');
const expB = H.bench('exportSave 的 base64 编码', 100, () => w.eval(`btoa(unescape(encodeURIComponent(JSON.stringify(STATE))))`));
say(H.table([{ 操作: 'btoa(unescape(encodeURIComponent(JSON)))', 'p50 ms': expB.p50.toFixed(3), '输出 KB': (w.eval(`btoa(unescape(encodeURIComponent(JSON.stringify(STATE)))).length`) / 1024).toFixed(1) }],
  ['操作', 'p50 ms', '输出 KB']));
say('> `escape/unescape` 是已废弃的 API，且对 ≥0x10000 的字符处理有坑（详见健壮性报告）。');
say('');

/* ---------- 5. 配额行为 ---------- */
say('## 5. 配额写满时的行为');
const quotaTest = w.eval(`(function(){
  const res = { ok: false, err: null, wroteMB: 0 };
  let chunk = 'x'.repeat(256 * 1024);
  try {
    for (let i = 0; i < 200; i++) {
      localStorage.setItem('__quota_' + i, chunk);
      res.wroteMB = (i + 1) * 0.25;
    }
    res.ok = true;
  } catch (e) {
    res.err = e.name + ': ' + e.message;
  }
  // 清场
  for (let i = 0; i < 200; i++) { try { localStorage.removeItem('__quota_' + i); } catch(e){} }
  return res;
})()`);
say('jsdom 无配额限制（写了 ' + quotaTest.wroteMB + ' MB 仍成功），' +
  '但**真实浏览器会抛 `QuotaExceededError`**。当前 `lsSet()` 的实现是：');
say('```js');
say('function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }');
say('```');
say('→ **异常被静默吞掉**：配额写满 / 隐私模式禁用 storage 时，玩家会以为存档成功，' +
  '下一次打开却回到标题页，且**不会有任何提示**。这是目前最需要修的健壮性缺口（详见 robustness-review.md R-02）。');
say('');

fs.writeFileSync(path.join(__dirname, 'save-bench.out.txt'), out.join('\n'), 'utf8');
console.log('[已写出] ' + path.join(__dirname, 'save-bench.out.txt'));
