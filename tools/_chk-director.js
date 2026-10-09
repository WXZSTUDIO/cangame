const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = {
  console, Math, JSON, Date,
  window: { addEventListener() { } },
  document: { addEventListener() { }, getElementById() { return null }, querySelectorAll() { return [] } },
  localStorage: { getItem() { return null }, setItem() { }, removeItem() { } }
};
vm.createContext(ctx);
['data', 'market', 'engine', 'school', 'career', 'love', 'pet', 'legacy', 'loan', 'ui']
  .forEach(m => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', m + '.js'), 'utf8'), ctx, { filename: m }));
const r = vm.runInContext(`(function(){
  const dir = CAREERS.find(c=>c.id==='director');
  const s = createGame({name:'导',gender:'M',familyId:'zhishi',startYear:1990,priority:'balance',talents:[]});
  s.career = {id:'director',level:1,years:3,joinedAge:28};
  s.job = '新锐导演'; s.age = 32; s.stats.INT = 55;
  return {
    dirJobs: dir.ladder.map(l=>[l.title, JOBS[l.title] && JOBS[l.title].salary]),
    dirNeed: dir.need,
    income: careerIncome(s),
    parts: careerIncomeParts(s),
    astro: CAREERS.find(c=>c.id==='astronaut').need,
    pilot: CAREERS.find(c=>c.id==='pilot').need,
    zero: CAREERS.filter(c=>c.ladder.every(l=>!JOBS[l.title])).map(c=>c.id)
  };
})()`, ctx);
console.log(JSON.stringify(r, null, 1));
