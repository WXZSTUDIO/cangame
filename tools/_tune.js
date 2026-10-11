/* 临时调参沙盒：在 vm 内覆盖 CONFIG 后跑全 AI 对局，比较各阵营胜率。
 * 用法：node tools/_tune.js
 * 非交付物，仅用于平衡扫描；校准完成后删除。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const ctx = {
  console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }; },
    body: null, documentElement: null },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, alert: function () {}
};
vm.createContext(ctx);
['assets/config.js','assets/rng.js','assets/state.js','assets/factions.js','assets/resource.js',
 'assets/ai.js','assets/leader.js','assets/production.js','assets/economy.js','assets/war.js',
 'assets/settle.js','assets/engine.js','assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const M = vm.runInContext('({createGameState, advancePhase, endDay, CONFIG})', ctx);
const FIDS = ['white','blue','red','black'];

function runConfig(name, overrides, N) {
  // 应用覆盖（深一层：PRODUCTION/INITIAL/PERSONALITY_WEIGHTS 等对象）
  function apply(obj, ov) {
    Object.keys(ov).forEach(k => {
      if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) && ov[k] && typeof ov[k] === 'object' && !Array.isArray(ov[k])) {
        apply(obj[k], ov[k]);
      } else obj[k] = ov[k];
    });
  }
  apply(M.CONFIG, overrides);

  const st = {}; FIDS.forEach(id => st[id] = { wins: 0, fn: 0, surv: 0, survN: 0 });
  let ended = 0, endDay = 0;
  for (let i = 0; i < N; i++) {
    const s = M.createGameState((i * 2654435761) >>> 0);
    s.humanFactionId = null;
    const initPop = {}; FIDS.forEach(id => initPop[id] = s.factions.find(f => f.id === id).popAlive);
    let guard = 0, firstDone = false; const sd = {}; FIDS.forEach(id => sd[id] = null);
    while (s.status === 'PLAYING' && guard < 1000) {
      const db = s.day;
      for (let k = 0; k < 4 && s.status === 'PLAYING'; k++) M.advancePhase(s);
      if (s.status !== 'PLAYING') break;
      M.endDay(s); guard++;
      if (db === 1) { FIDS.forEach(id => { if (s.factions.find(f => f.id === id).popAlive < initPop[id]) st[id].fn++; }); firstDone = true; }
      FIDS.forEach(id => { const f = s.factions.find(x => x.id === id); if (!f.alive && sd[id] == null) sd[id] = db; });
    }
    if (s.status !== 'ENDED') continue;
    ended++; endDay += s.result.endedDay;
    FIDS.forEach(id => { const f = s.factions.find(x => x.id === id); if (s.result.winner === id) st[id].wins++; if (sd[id] != null) { st[id].surv += sd[id]; st[id].survN++; } });
  }
  const wr = id => (100 * st[id].wins / ended).toFixed(1) + '%';
  const fnr = id => (100 * st[id].fn / ended).toFixed(0) + '%';
  const av = (x, n) => n ? (x / n).toFixed(1) : '—';
  console.log(name.padEnd(22) + ' ended=' + ended + ' avgDay=' + av(endDay, ended) +
    ' | W:' + wr('white') + '(首夜' + fnr('white') + ',生' + av(st.white.surv, st.white.survN) + ')' +
    ' B:' + wr('blue') + ' R:' + wr('red') + ' K:' + wr('black'));
  return st;
}

const N = 200;
console.log('--- 扫描（N=' + N + '）---');
runConfig('base(生命药交易)', {}, N);
runConfig('白产药1-2/初药4', { INITIAL: { white: { life: 4 } }, PRODUCTION: { white: { lifeMin: 1, lifeMax: 2 } } }, N);
runConfig('白产药2-3/初药4', { INITIAL: { white: { life: 4 } }, PRODUCTION: { white: { lifeMin: 2, lifeMax: 3 } } }, N);
runConfig('白产药1-2/初药6', { INITIAL: { white: { life: 6 } }, PRODUCTION: { white: { lifeMin: 1, lifeMax: 2 } } }, N);
runConfig('蓝药产3-4(减垄断)', { PRODUCTION: { blue: { lifeMin: 3, lifeMax: 4 } } }, N);
runConfig('白产1-2+蓝药3-4', { INITIAL: { white: { life: 4 } }, PRODUCTION: { white: { lifeMin: 1, lifeMax: 2 }, blue: { lifeMin: 3, lifeMax: 4 } } }, N);
runConfig('白产2-3+蓝药3-4+专利.10', { INITIAL: { white: { life: 4 } }, PRODUCTION: { white: { lifeMin: 2, lifeMax: 3 }, blue: { lifeMin: 3, lifeMax: 4 } }, PATENT_ROYALTY: 0.10 }, N);
