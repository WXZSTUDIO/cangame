/* v6.2.2 冒烟验证：头像重切 / 未成年事件池 / 一生碑文生成器
 *  1 未成年不再抽出成人向事件（上班/加班/看望父母…）
 *  2 未成年三选项文案是学生口吻（不出现 上级/公司/上班/股票）
 *  3 新增少年事件池可触发、效果合法
 *  4 碑文生成器：长度合理、随存档持久化、三个极端人生示范
 *  5 端到端：完整活到终局，结局页数据齐备
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} }, document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  createGame, step, resolveEvent, matchEvent, eventChoices, choiceTexts, EVENTS, EVENTS_YOUTH,
  lifeEpitaph, finish, endBy, scoreOf, grade, worthOf, applyEffects, pushLog, randInt, chance
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));

console.log('== 1. 未成年不抽成人向事件 ==');
{
  // 成人向词汇：作为「事件文本主体」出现即违和（时代新闻里的『裁员』等旁观测不算）
  const BAD = [/你(去|在)?(公司|工厂|单位)/, /你开始上班/, /你的(上司|同事|领导|部门|客户|甲方)/,
    /你(加|上)班/, /看望父母/, /回家看望/, /跳槽/, /你的月薪/, /发工资/, /绩效/, /裁员名单上有你/];
  const minorEv = A.EVENTS.filter(ev => (ev.age || [0, 200])[0] <= 17);
  const bad = [];
  for (const ev of minorEv) {
    const t = String(ev.text || '');
    if (t.indexOf('你') < 0) continue;
    for (const re of BAD) if (re.test(t)) { bad.push(ev.id + ': ' + t.slice(0, 40)); break; }
  }
  ok(bad.length === 0, '未成年可达事件里没有「你上班/你同事/看望父母」类文本', bad.length ? bad.join(' | ') : '');
  ok(A.EVENTS_YOUTH.length >= 15, '少年专属事件池已挂载', A.EVENTS_YOUTH.length + ' 条');
  // 全部少年事件年龄窗在 6-18
  ok(A.EVENTS_YOUTH.every(ev => ev.age[0] >= 6 && ev.age[1] <= 18), '少年事件年龄窗全部 ≤18');
}

console.log('== 2. 未成年三选项是学生口吻 ==');
{
  const FORBID = ['上级', '公司', '上班', '加班', '股票', '投资', '房贷', '客户', '项目', '汇报'];
  let violations = [];
  for (let i = 0; i < 40; i++) {
    const s = mk({}); s.age = 10 + (i % 8);
    // 走几步，遇到带选项的事件就检查文案
    for (let k = 0; k < 14; k++) {
      A.step(s);
      if (s.finished) break;
      if (s.pending && s.pending.ev) {
        const ev = s.pending.ev;
        if (s.age < 18 && ev.choices) {
          for (const c of ev.choices) {
            for (const w of FORBID) {
              if (String(c.text).indexOf(w) >= 0) violations.push(`${s.age}岁 [${ev.id}] 「${c.text}」含「${w}」`);
            }
          }
        }
        A.resolveEvent(s, ev, 0);
      }
    }
  }
  ok(violations.length === 0, '40 局抽样：未成年选项无成人口吻', violations.length ? violations.slice(0, 3).join(' / ') : '');
}

console.log('== 3. 少年事件可触发且效果合法 ==');
{
  const s = mk({});
  let hit = 0;
  for (const ev of A.EVENTS_YOUTH) {
    const st = mk({}); st.age = ev.age[0];
    if (A.matchEvent(st, ev)) hit++;
    // eff 数值合法性（不做无限大）
    for (const k in (ev.eff || {})) {
      if (typeof ev.eff[k] !== 'number' || !isFinite(ev.eff[k])) { ok(false, 'eff 非法', ev.id); break; }
    }
  }
  ok(hit === A.EVENTS_YOUTH.length, '每条少年事件在窗口起点都可触发', `${hit}/${A.EVENTS_YOUTH.length}`);
}

console.log('== 4. 碑文生成器 · 三个极端人生示范 ==');
{
  // 示例 A：科技巨擘的落寞晚年（百亿、3 婚、私生子争产、孤独死在顶奢养老院）
  const a = mk({ name: '沈明远', gender: 'M' });
  a.age = 88; a.startYear = 1945;
  a.job = '董事长'; a.peak = { NET: 680e8 }; a.stats.FAME = 82;
  a.flags.married = true; a.flags.exposed = true;
  a.spouse = { name: '赵', gender: 'F', alive: false, affinity: 20 };
  a.children = [
    { name: '沈一', gender: 'M', born: 40, alive: true },
    { name: '沈二', gender: 'M', born: 50, alive: true },
    { name: '私生子·南', gender: 'M', born: 60, alive: true, illegit: true, ack: false },
    { name: '私生子·北', gender: 'F', born: 62, alive: true, illegit: true, ack: false },
    { name: '私生子·港', gender: 'M', born: 65, alive: true, illegit: true, ack: true }
  ];
  a.exes = [{ name: '林' }, { name: '苏' }];
  a.retirePlan = 'p_top'; a.stats.ETH = 38;
  const epA = A.lifeEpitaph(a);
  console.log('\n  ┌─ 示例 A · 科技巨擘的落寞晚年 ────');
  console.log('  ' + epA.split('。').join('。\n  '));
  console.log('  └──────────────────────\n');
  ok(epA.length >= 180 && epA.length <= 460, 'A 碑文长度合理', epA.length + ' 字');
  ok(/私生子|骂名|争产/.test(epA) && /千亿|帝国|头条|財|资产|身家/.test(epA), 'A 含「私生子/骂名」与「帝国」要素');

  // 示例 B：平凡但伟大的传承（建筑师、金婚、子孙满堂）
  const b = mk({ name: '陈守拙', gender: 'M' });
  b.age = 93; b.startYear = 1952;
  b.job = '建筑师'; b.peak = { NET: 0.9e8 }; b.stats.FAME = 26;
  b.flags.married = true; b.flags.grand = true;
  b.spouse = { name: '周', gender: 'F', alive: true, affinity: 92 };
  b.children = [
    { name: '陈大', gender: 'M', born: 26, alive: true },
    { name: '陈二', gender: 'F', born: 29, alive: true },
    { name: '陈三', gender: 'M', born: 33, alive: true }
  ];
  const epB = A.lifeEpitaph(b);
  console.log('  ┌─ 示例 B · 平凡但伟大的传承 ────');
  console.log('  ' + epB.split('。').join('。\n  '));
  console.log('  └──────────────────────\n');
  ok(epB.length >= 180 && epB.length <= 460, 'B 碑文长度合理', epB.length + ' 字');
  ok(/只爱过一个人|一辈子|白发|握/.test(epB), 'B 含「一生挚爱一人」要素');
  ok(/孩子|孙辈|坟前|火种/.test(epB), 'B 含「子孙满堂」要素');

  // 示例 C：逆袭与救赎（孤儿院出身、落榜、海钓炒股暴富、晚年转赠慈善）
  const c = mk({ name: '吴天亮', gender: 'M', familyId: 'fuliyuan' });
  c.age = 85; c.startYear = 1960;
  c.job = '个体户'; c.peak = { NET: 46e8 }; c.stats.FAME = 44;
  c.flags.foundation = true;
  c.children = []; c.exes = [];
  const epC = A.lifeEpitaph(c);
  console.log('  ┌─ 示例 C · 逆袭与救赎 ────');
  console.log('  ' + epC.split('。').join('。\n  '));
  console.log('  └──────────────────────\n');
  ok(epC.length >= 180 && epC.length <= 460, 'C 碑文长度合理', epC.length + ' 字');
  ok(/慈善|散尽|帮助过的人/.test(epC), 'C 含「转赠慈善」要素');
}

console.log('== 5. 端到端：完整一生 + 碑文持久化 ==');
{
  let done = 0, withEp = 0, lenOk = 0;
  for (let i = 0; i < 8; i++) {
    const s = mk({ name: 'E' + i, gender: i % 2 ? 'F' : 'M' });
    let guard = 0;
    while (!s.finished && guard++ < 130) A.step(s);
    if (!s.finished) { A.finish(s); }
    if (s.finished) done++;
    if (s.epitaph) {
      withEp++;
      if (s.epitaph.length >= 160 && s.epitaph.length <= 480) lenOk++;
      if (i === 0) console.log('  样例碑文（E0, ' + s.age + ' 岁, ' + s.job + '）：', s.epitaph.slice(0, 60) + '…');
    }
  }
  ok(done === 8, '8 局全部走到终局', done + '/8');
  ok(withEp === 8, '每局都有碑文', withEp + '/8');
  ok(lenOk === 8, '碑文长度全部合理', lenOk + '/8');
}

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✅ v6.2.2 全部通过');
process.exit(fail ? 1 : 0);
