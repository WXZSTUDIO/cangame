/* 内容体量统计 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
const g = n => vm.runInContext(n, ctx);
const names = ['EVENTS', 'TALENTS', 'FAMILIES', 'ENDINGS', 'INVESTMENTS',
  'HOUSES', 'CARS', 'GOODS', 'STOCKS'];
const out = {};
names.forEach(n => {
  try { out[n] = (g(n) || []).length; } catch (e) { out[n] = 'N/A'; }
});
const ev = g('EVENTS') || [];
const three = ev.filter(e => e.choices && e.choices.length === 3).length;
const gamble = ev.filter(e => e.choices && e.choices.some(c => c.gamble)).length;
console.log('事件', out.EVENTS, '| 天赋', out.TALENTS, '| 出身', out.FAMILIES,
  '| 结局', out.ENDINGS, '| 投资机会', out.INVESTMENTS);
console.log('房产', out.HOUSES, '| 汽车', out.CARS, '| 资产', out.GOODS, '| 股票', out.STOCKS);
console.log('自带三选项事件', three, '| 含概率赌注事件', gamble,
  '| 自动生成三选项', out.EVENTS - three);
