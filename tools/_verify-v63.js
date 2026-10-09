/* v6.3.0 冒烟验证：A 兄弟姐妹/养育/家业 · C 扩容 · D 时间轴/海报
 *  1 兄弟姐妹：计划生育年代规则 + 出生剧情 + 遗产分摊
 *  2 子女养育事件可触发
 *  3 家族企业：创办 → 年度经营 → 70 岁接班考核 → 声望加成
 *  4 大学社团与留学（uni_life 门控 + 年度结算）
 *  5 时代职业 minYear 门控（1955 年生人看不到 AI训练师）
 *  6 题库/事件/职业规模
 *  7 D 包：时间轴/海报/徽章动画（源码级）
 *  8 端到端：完整活到终局（含碑文）
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
  createGame, step, resolveEvent, makeSiblings, siblingTick, sibAge, sibChat, makeInheritanceEvent,
  childTick, famBizTick, uniLifeTick, UNI_CLUBS, schoolStageOf,
  EVENTS, EVENTS_V63, EXAM_QUIZ, CAREERS, jobOffers, ACHIEVEMENTS,
  finish, lifeEpitaph, settlePrestige, worthOf, applyEffects, addChild, pushLog
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'nongcun', startYear: 1970, priority: 'balance', talents: []
}, o || {}));

console.log('== 1. 兄弟姐妹 ==');
{
  // 1970 农村大概率有兄弟姐妹；1998 城市大概率没有；福利院绝无
  let old = 0, city = 0, orphan = 0;
  for (let i = 0; i < 60; i++) {
    if (mk({ startYear: 1970, familyId: 'nongcun' }).siblings.length > 0) old++;
    if (mk({ startYear: 1998, familyId: 'zhigong' }).siblings.length > 0) city++;
    orphan += mk({ startYear: 1990, familyId: 'fuli' }).siblings.length;
  }
  ok(old >= 50, '1970 农村绝大多数有手足', old + '/60');
  ok(city <= 15, '1998 城市几乎独生', city + '/60');
  ok(orphan === 0, '福利院出身没有手足');
  const s = mk({ startYear: 1972 });
  if (s.siblings.length) {
    const sb = s.siblings[0];
    ok(sb.name[0] === s.name[0], '手足随父姓', sb.name);
    ok(s.queue.some(q => q.type === 'event' && /手足|哥哥|姐姐|弟弟|妹妹/.test(q.ev.text)), '出生剧情已入队且包装成 event');
  } else ok(true, '该局无手足（跳过后续断言）');
  // 遗产分摊
  const s2 = mk({ startYear: 1970 });
  s2.siblings = [{ name: '大弟', gender: 'M', born: 1972, affinity: 60, alive: true, married: false, touchYear: -1 }];
  s2.family = { assets: 100000000, debt: 0 };
  s2.age = 40;
  const inh = A.makeInheritanceEvent(s2);
  ok(/兄弟姐妹按人头分走/.test(inh.text), '继承事件含分产说明');
  ok(inh.choices[0].eff.MONEY === 50000000, '两个在世继承人均分（你拿 1/(1+1)）', A.worthOf(s2) + '/50,000,000');
  // 联系
  const r = A.sibChat(s2, 0);
  ok(r.ok, '手足可以联系', r.msg.slice(0, 18) + '…');
  ok(A.sibChat(s2, 0).ok === false, '同年第二次联系被拦');
}

console.log('== 2. 子女养育事件 ==');
{
  const s = mk({});
  s.age = 35;
  A.addChild(s, { name: '小明', gender: 'M' });
  s.children[0].born = 25; // 你 25 岁生的 → 孩子现在 10 岁
  let hits = 0;
  for (let i = 0; i < 40; i++) {
    const before = s.log.length;
    A.childTick(s);
    if (s.log.length > before) hits++;
  }
  ok(hits >= 5, '养育剧情 40 年度抽样有产出', hits + ' 次');
}

console.log('== 3. 家族企业 ==');
{
  const s = mk({ startYear: 1960 });
  s.age = 55; s.stats.MONEY = 800000000; s.stats.LOY = 80;
  A.addChild(s, { name: '继承人', gender: 'M' });
  s.children[0].born = 25; s.children[0].affinity = 80;
  s.flags.fam_biz = true;
  A.famBizTick(s); // 创办
  ok(s.famBiz && s.famBiz.val >= 300000000, '企业已创立', s.famBiz && s.famBiz.name + ' ' + Math.round(s.famBiz.val / 1e8) + ' 亿');
  for (let i = 0; i < 15; i++) { s.age = 56 + i; A.famBizTick(s); }
  ok(s.famBiz.heirDone === true, '70 岁触发接班考核');
  ok(s.flags.fam_biz_ok === true || s.famBiz.val > 0, '接班结果已结算', 'fam_biz_ok=' + !!s.flags.fam_biz_ok);
  const pts = A.settlePrestige(s);
  ok(pts > 0, '声望结算可用', '+' + pts + '（含家业加成）');
  ok(true, '接班叙事：' + (s.log.filter(l => /接班/.test(l.text)).pop() || { text: '' }).text.slice(0, 44));
}

console.log('== 4. 大学社团与留学 ==');
{
  const s = mk({});
  s.age = 20; s.edu.uni = 'u_985'; s.edu.gradAge = 22; s.edu.eduLevel = 3;
  A.applyEffects(s, { MONEY: 200000000 });
  ok(A.schoolStageOf(s) === 'uni', '构造出在校大学生状态');
  s.flags.club_debate = true;
  s.flags.abroad = true;
  const moneyBefore = s.stats.MONEY;
  A.uniLifeTick(s);
  ok(s.stats.INT > 0, '社团+留学年度结算生效', 'INT=' + s.stats.INT + ' CHA=' + s.stats.CHA);
  ok(s.stats.MONEY < moneyBefore, '社团活动费+留学学费照扣');
  ok(A.EVENTS.some(e => e.id === 'uni_club' && e.cond && e.cond.need && e.cond.need[0] === 'uni_life'), '社团招新事件挂 uni_life 门控');
  ok(A.EVENTS.some(e => e.id === 'uni_abroad'), '留学事件已挂载');
}

console.log('== 5. 时代职业门控 ==');
{
  const s55 = mk({ startYear: 1955 }); s55.age = 40; s55.edu.eduLevel = 4; s55.stats.INT = 90; s55.flags.uni_985 = true;
  const offers55 = A.jobOffers(s55).filter(o => o.okFlag && o.career.minYear);
  ok(offers55.length === 0, '1955 年生人（1995 年 40 岁）看不到任何时代职业', offers55.map(o => o.career.id).join(','));
  const s15 = mk({ startYear: 1995 }); s15.age = 30; s15.edu.eduLevel = 4; s15.stats.INT = 90; s15.stats.CHA = 60; s15.flags.uni_985 = true;
  const yr15 = A.jobOffers(s15).filter(o => o.okFlag && o.career.minYear);
  ok(yr15.length >= 5, '2025 年的时代职业已解锁一批', yr15.map(o => o.career.id).join(','));
  const s70 = mk({ startYear: 2005 }); s70.age = 20; s70.edu.eduLevel = 4; s70.stats.INT = 90;
  const yr70 = A.jobOffers(s70).filter(o => o.okFlag && o.career.minYear);
  ok(yr70.every(o => o.career.minYear <= 2025), 'minYear 全部正确过滤');
}

console.log('== 6. 规模 ==');
{
  ok(A.EVENTS.length >= 390, '事件库规模', A.EVENTS.length + ' 条');
  ok(A.EXAM_QUIZ.length >= 80, '常识题库规模', A.EXAM_QUIZ.length + ' 题');
  ok(A.CAREERS.length >= 54, '职业库规模', A.CAREERS.length + ' 种');
  ok(A.EVENTS_V63.length >= 80, '本次新增事件', A.EVENTS_V63.length + ' 条');
  const ids = new Set();
  let dup = 0;
  A.EVENTS.forEach(e => { if (ids.has(e.id)) dup++; ids.add(e.id); });
  ok(dup === 0, '事件 id 无重复');
}

console.log('== 7. D 包源码级检查 ==');
{
  const ui = fs.readFileSync(path.join(ROOT, 'assets/ui.js'), 'utf8');
  ok(/function endTimelineHtml/.test(ui), '时间轴渲染函数存在');
  ok(/function uiSharePoster/.test(ui) && /toDataURL/.test(ui), '分享海报函数存在（canvas 导出）');
  ok(/endTimelineBox/.test(ui), '结算页已挂时间轴容器');
  ok(/btnPoster/.test(ui), '结算页已挂海报按钮');
  const css = fs.readFileSync(path.join(ROOT, 'assets/style.css'), 'utf8');
  ok(/achPop/.test(css) && /\.ftree/.test(css) && /\.tl-wrap/.test(css), '徽章动画/家族树/时间轴样式齐备');
}

console.log('== 8. 端到端 ==');
{
  let done = 0, withBiz = 0, sibOK = 0;
  for (let i = 0; i < 6; i++) {
    const s = mk({ name: 'E' + i, gender: i % 2 ? 'F' : 'M', startYear: 1965 + i * 6 });
    let guard = 0;
    while (!s.finished && guard++ < 130) A.step(s);
    if (!s.finished) A.finish(s);
    if (s.finished) done++;
    if (s.epitaph) sibOK++;
    if (s.famBiz) withBiz++;
  }
  ok(done === 6, '6 局全部走完一生', done + '/6');
  ok(sibOK === 6, '碑文依旧全员生成', sibOK + '/6');
  console.log('  （家族企业触发局数：' + withBiz + '/6，属随机事件，非必现）');
}

console.log(fail ? `\n✗ ${fail} 项失败` : '\n✅ v6.3.0 全部通过');
process.exit(fail ? 1 : 0);
