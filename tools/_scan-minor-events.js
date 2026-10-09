// 扫描未成年可触发的事件，找违和工作/成人向内容
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const A = p => fs.readFileSync(path.join(__dirname, '../assets', p), 'utf8');
const ctx = { window: {}, console, setTimeout };
vm.createContext(ctx);
vm.runInContext(A('data.js'), ctx);
const EVENTS = vm.runInContext('EVENTS', ctx);
const KW = ['公司','上班','加班','同事','领导','上司','职场','工资','月薪','跳槽','年终','绩效','裁员','工位','看父母','看望','回家看','老家','探亲','酒局','应酬','饭局','客户','甲方','项目','汇报','出差','创业','合伙人','融资','房贷','贷款','房租','买房','股票','投资','健身卡','体检报告','社保','公积金'];
const rows = [];
for (const ev of EVENTS) {
  const age = ev.age || [0, 200];
  if (age[0] > 17) continue;
  const minA = Math.max(age[0], 0), hits = [];
  const txt = String(ev.text || '');
  for (const k of KW) if (txt.indexOf(k) >= 0) hits.push(k);
  if (hits.length) rows.push({ id: ev.id, age: age.join('-'), hits: hits.join(','), text: txt.slice(0, 72) });
}
console.log('未成年可触发且含成人关键词的事件数:', rows.length);
rows.forEach(r => console.log(`[${r.id}] age=${r.age} hits=${r.hits}\n   ${r.text}`));
console.log('EVENTS total:', EVENTS.length);
