const fs = require('fs');
const path = require('path');
const map = {
  "'orphan'": "'fuli'",
  "'banjiha'": "'chengzhongcun'",
  "'factory'": "'xiangong'",
  "'province'": "'getihu'",
  "'single'": "'danqin'",
  "'rentier'": "'chaiqian'",
  "'prof'": "'jiaoshi'",
  "'chaebol_edge'": "'shangren'",
  "'가계'": "'家庭账簿'"
};
['tools/family-fin-test.js', 'tools/browser-parity-test.js', 'tools/family-test.js',
 'tools/life-test.js', 'tools/era-test.js', 'tools/power-test.js'].forEach(f => {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  Object.keys(map).forEach(k => { s = s.split(k).join(map[k]); });
  fs.writeFileSync(p, s);
  console.log(f);
});
const pp = path.join(__dirname, '..', 'tools/power-test.js');
let p2 = fs.readFileSync(pp, 'utf8');
p2 = p2.replace("['assets/data.js', 'assets/engine.js'", "['assets/data.js', 'assets/market.js', 'assets/engine.js'");
fs.writeFileSync(pp, p2);
console.log('power-test patched');
