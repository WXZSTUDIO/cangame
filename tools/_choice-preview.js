const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js',
 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
const A = vm.runInContext('({createGame, EVENTS, eventChoices, inferEventTag})', ctx);
const st = A.createGame({ name: '预览', gender: 'M', familyId: 'chengzhongcun', talents: [] });
st.age = 30;
const auto = A.EVENTS.filter(e => !e.choices || !e.choices.length).filter(e => (e.age || [0, 200])[1] >= 30 && (e.age || [0, 200])[0] <= 30);
console.log('可自动生成选项的事件数：' + auto.length + '\n');
auto.slice(0, 10).forEach(e => {
  const tag = A.inferEventTag(st, e);
  const list = A.eventChoices(st, e) || [];
  console.log('[' + tag + '] ' + String(e.text).slice(0, 34) + '…');
  list.forEach(c => console.log('   · ' + c.text));
  console.log('');
});
