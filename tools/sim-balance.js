/* cangame v2 · Sprint 5 平衡校准模拟器（tools/sim-balance.js）
 * 全 AI 对局（无人类）：createGameState(seed) → 置 humanFactionId=null（让所有阵营均以 AI 运行）
 *   → advancePhase×4 + endDay 循环至 status==='ENDED'。
 * 对 N（默认 200）个不同 seed 统计：
 *   - 各阵营胜率（result.winner = 人均最高）
 *   - 平均存活天数（阵营灭绝日；若终局仍存活记为终局日）
 *   - 平均人均奖金（仅统计该阵营终局仍存活的对局）
 *   - 首夜（第 1 天）淘汰分布（尤其白队是否必死）
 * 输出汇总表 + 写 tools/sim-balance.last.json 供参考。
 *
 * 用法：node tools/sim-balance.js [N=200] [seedBase=1]
 * 依赖：vm 沙箱加载 13 个 assets/*.js（顺序遵循 ADR-3）。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const N = parseInt(process.argv[2], 10) || 200;
const SEED_BASE = parseInt(process.argv[3], 10) || 1;

const ctx = {
  console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }; },
    body: null, documentElement: null },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  alert: function () {}
};
vm.createContext(ctx);

['assets/config.js', 'assets/rng.js', 'assets/state.js', 'assets/factions.js', 'assets/resource.js',
 'assets/ai.js', 'assets/leader.js', 'assets/production.js', 'assets/economy.js', 'assets/war.js',
 'assets/settle.js', 'assets/engine.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const M = vm.runInContext('({' +
  'createGameState, advancePhase, endDay, CONFIG, PHASES' +
 '})', ctx);

const FIDS = ['white', 'blue', 'red', 'black'];

// —— 指标累积 ——
const stat = {};
FIDS.forEach(id => {
  stat[id] = { wins: 0, survivalSum: 0, survivalN: 0, perPersonSum: 0, perPersonN: 0,
    firstNightElim: 0, totalGoodsSum: 0, totalGoodsN: 0 };
});
let endedCount = 0, prizePoolSum = 0, endDaySum = 0, whiteExtinctDaySum = 0, whiteExtinctN = 0;

// 单局：全 AI 跑到 ENDED
function runOne(seed) {
  const s = M.createGameState(seed >>> 0);
  s.humanFactionId = null;          // 关键：所有阵营均按 AI 运行（否则“人类”阵营被动）
  const initPop = {};
  FIDS.forEach(id => { initPop[id] = s.factions.find(f => f.id === id).popAlive; });

  let guard = 0;
  let firstNightDone = false;
  const survivalDay = {};           // 阵营灭绝日（completed day）
  FIDS.forEach(id => { survivalDay[id] = null; });

  while (s.status === 'PLAYING' && guard < 1000) {
    const dayBefore = s.day;
    for (let i = 0; i < 4 && s.status === 'PLAYING'; i++) M.advancePhase(s);
    if (s.status !== 'PLAYING') break;
    M.endDay(s);
    guard++;
    const completedDay = dayBefore;   // endDay 完成的始终是 dayBefore 这一天

    // 首夜淘汰（completedDay===1）
    if (completedDay === 1) {
      firstNightDone = true;
      FIDS.forEach(id => {
        const f = s.factions.find(x => x.id === id);
        if (f.popAlive < initPop[id]) stat[id].firstNightElim++;
      });
    }
    // 存活天数：记录阵营首次灭绝的那一天
    FIDS.forEach(id => {
      const f = s.factions.find(x => x.id === id);
      if (!f.alive && survivalDay[id] == null) survivalDay[id] = completedDay;
    });
  }

  if (s.status !== 'ENDED') { console.error('WARN seed', seed, '未终局（guard 耗尽）'); return null; }
  endedCount++;
  const r = s.result;
  prizePoolSum += (r.prizePool || 0);
  endDaySum += (r.endedDay || s.day);

  FIDS.forEach(id => {
    const f = s.factions.find(x => x.id === id);
    const st = stat[id];
    if (r.winner === id) st.wins++;
    // 存活天数
    const sd = (survivalDay[id] != null) ? survivalDay[id] : (r.endedDay || s.day);
    st.survivalSum += sd; st.survivalN++;
    // 人均奖金（仅该阵营终局仍存活）
    if (f.alive && f.popAlive > 0) {
      st.perPersonSum += (r.perPerson[id] || 0); st.perPersonN++;
      st.totalGoodsSum += f.goods; st.totalGoodsN++;
    }
    if (id === 'white' && !f.alive) { whiteExtinctDaySum += sd; whiteExtinctN++; }
  });
  return s;
}

for (let i = 0; i < N; i++) runOne(SEED_BASE + i * 2654435761);

// —— 汇总 ——
const pct = (x, n) => n > 0 ? (100 * x / n).toFixed(1) + '%' : '—';
const avg = (x, n) => n > 0 ? (x / n).toFixed(1) : '—';

console.log('\n===== cangame 全 AI 平衡模拟（N=' + N + '）=====');
console.log('平均终局日=' + avg(endDaySum, endedCount) + '  平均奖金池=' + avg(prizePoolSum, endedCount) +
  '  白队灭绝局数=' + whiteExtinctN + '/' + endedCount);
console.log('');
console.log('阵营   胜率     平均存活天  平均人均奖金  首夜淘汰率   终局存活均货');
console.log('--------------------------------------------------------------------------');
FIDS.forEach(id => {
  const st = stat[id];
  console.log(
    id.padEnd(7) +
    pct(st.wins, endedCount).padStart(7) + '  ' +
    avg(st.survivalSum, st.survivalN).padStart(8) + '  ' +
    avg(st.perPersonSum, st.perPersonN).padStart(10) + '  ' +
    pct(st.firstNightElim, endedCount).padStart(8) + '  ' +
    avg(st.totalGoodsSum, st.totalGoodsN).padStart(10)
  );
});

//  dominance 提示
const winRates = FIDS.map(id => stat[id].wins / endedCount);
const maxWR = Math.max.apply(null, winRates);
const whiteWR = stat.white.wins / endedCount;
console.log('--------------------------------------------------------------------------');
console.log('最高胜率阵营 = ' + FIDS[winRates.indexOf(maxWR)] + ' (' + (100 * maxWR).toFixed(1) + '%)' +
  (maxWR > 0.40 ? '  ⚠ 超过 40% 阈值（dominance）' : '  ✓ 在 40% 内'));
console.log('白队胜率 = ' + (100 * whiteWR).toFixed(1) + '%' +
  (whiteWR <= 0.001 ? '  ⚠ 白队几乎无胜算（需校准）' : '  ✓ 非必败'));
console.log('白队首夜淘汰率 = ' + pct(stat.white.firstNightElim, endedCount) +
  (stat.white.firstNightElim / endedCount > 0.8 ? '  ⚠ 首夜几乎必崩（需校准）' : '  ✓ 仍可翻盘'));

const summary = {
  N: N, seedBase: SEED_BASE, endedCount: endedCount,
  avgEndDay: Number(avg(endDaySum, endedCount)),
  avgPrizePool: Number(avg(prizePoolSum, endedCount)),
  factions: {}
};
FIDS.forEach(id => {
  const st = stat[id];
  summary.factions[id] = {
    winRate: st.wins / endedCount,
    avgSurvivalDays: Number(avg(st.survivalSum, st.survivalN)),
    avgPerPerson: Number(avg(st.perPersonSum, st.perPersonN)),
    firstNightElimRate: st.firstNightElim / endedCount,
    avgEndGoods: Number(avg(st.totalGoodsSum, st.totalGoodsN))
  };
});
fs.writeFileSync(path.join(__dirname, 'sim-balance.last.json'), JSON.stringify(summary, null, 2));
console.log('\n（已写 tools/sim-balance.last.json）');
