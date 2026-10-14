// 临时标定：打印每位置 sum/cnt/avg 与人数，以及每队总篮板
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const FILES = ['config', 'rng', 'players', 'transfer', 'league', 'tactics', 'match', 'season', 'training', 'cup', 'bet', 'championship', 'alliance', 'ad', 'cba-data', 'engine'];
const ctx = { console, Math, Date, JSON, Array, Object, String, Number, isNaN, parseInt, parseFloat, setTimeout: () => {}, clearTimeout: () => {} };
vm.createContext(ctx);
for (const f of FILES) {
  const code = fs.readFileSync(path.join(root, 'assets', f + '.js'), 'utf8');
  vm.runInContext(code + '\n//# ' + f, ctx, { filename: f + '.js' });
}
const M = ctx;
const RNG = (seed) => { let s = seed >>> 0; return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const deriveSeed = M.deriveSeed;
const s = M.engine_newGame(12345, 't0');
let totalReb = 0, nGames = 0;
const sum = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }, cnt = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
for (let i = 0; i < 1000; i++) {
  const a = s.teams[i % s.teams.length], b = s.teams[(i + 3) % s.teams.length];
  const g = M.simulateGame(s, a.id, b.id, 2000 + i);
  nGames++;
  totalReb += g.hBox.teamReb + g.aBox.teamReb;
  [a, b].forEach(team => {
    const box = team.id === a.id ? g.hBox : g.aBox;
    team.lineup.forEach(id => {
      const row = box.players[id];
      if (row) { sum[row.pos] += row.reb; cnt[row.pos]++; }
    });
  });
}
console.log('avg team reb/game =', (totalReb / nGames).toFixed(1));
['PG', 'SG', 'SF', 'PF', 'C'].forEach(p => {
  console.log(p, 'sum=', sum[p], 'cnt=', cnt[p], 'avg=', cnt[p] ? (sum[p] / cnt[p]).toFixed(2) : 0);
});
