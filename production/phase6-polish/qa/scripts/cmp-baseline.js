const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
const a = JSON.parse(fs.readFileSync(path.join(OUT, 'baseline-reg-preF.json.bak'), 'utf8'));
const b = JSON.parse(fs.readFileSync(path.join(OUT, 'baseline-reg.json'), 'utf8'));
console.log('旧基线 ts = ' + a.ts + '   新基线 ts = ' + b.ts);
console.log('用例        旧        新        门数变化');
Object.keys(b.cases).forEach(k => {
  const x = a.cases[k], y = b.cases[k];
  const xs = x ? x.pass + '/' + x.total : '—';
  const ys = y.pass + '/' + y.total;
  const d = x && x.total !== y.total ? ('门数 ' + x.total + '→' + y.total) : '';
  console.log('  ' + k + '    ' + xs.padEnd(9) + ys.padEnd(9) + d);
});
