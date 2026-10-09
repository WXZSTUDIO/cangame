/* v6.2.1 冒烟验证：天赋语义搜索 / 前任移出家庭页 / 认识 ≠ 交往
 *  1 天赋语义搜索（搜「魅力」列出所有带魅力的）
 *  2 关系阶段机（met → close → dating）
 *  3 表白：门槛、失败冷却、成功后才在一起
 *  4 亲密关系必须已确定关系
 *  5 前任不进家庭页（源码级 + 渲染级）
 *  6 旧存档迁移补 stage
 *  7 端到端：认识 → 几次见面 → 表白 → 在一起
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
  createGame, step, resolveEvent, TALENTS, STAT_CN, STAT_ALIAS, talentSearchHit, talentHitStats,
  loveInit, makeLover, loverStage, stageText, syncStage, confessTo, dropAcquaintance,
  loveAct, loveIntimate, breakup, propose, marry, LOVE_META, STAGE_LABEL,
  meetOutside, meetByMatchmaker, ensureLover, migrateState, exList
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));

console.log('== 1. 天赋语义搜索 ==');
{
  const all = A.TALENTS;
  const hitCha = all.filter(t => A.talentSearchHit(t, '魅力'));
  const nameCha = all.filter(t => (t.name || '').indexOf('魅力') >= 0 || (t.desc || '').indexOf('魅力') >= 0 || (t.tag || '').indexOf('魅力') >= 0);
  const effCha = all.filter(t => t.eff && typeof t.eff.CHA === 'number' && t.eff.CHA !== 0);
  ok(hitCha.length > nameCha.length, '搜「魅力」比只搜名字/描述找到的更多',
    `语义 ${hitCha.length} vs 文本 ${nameCha.length}`);
  ok(effCha.every(t => A.talentSearchHit(t, '魅力')), '所有带魅力加成的天赋都能被搜到', `CHA 类 ${effCha.length} 种`);
  // 反例：名字和描述里都没有「魅力」、但确实加魅力的天赋
  const silent = effCha.filter(t => (t.name + t.desc + (t.tag || '')).indexOf('魅力') < 0);
  ok(silent.length > 0 && silent.every(t => A.talentSearchHit(t, '魅力')),
    '名字里没有「魅力」的也能搜出来', silent.slice(0, 4).map(t => t.name).join('/'));

  ok(A.TALENTS.filter(t => A.talentSearchHit(t, '钱')).length >= 5, '搜「钱」有结果',
    A.TALENTS.filter(t => A.talentSearchHit(t, '钱')).length + ' 种');
  ok(A.TALENTS.filter(t => A.talentSearchHit(t, '长寿')).length >= 1, '搜「长寿」命中健康类');
  ok(A.TALENTS.filter(t => A.talentSearchHit(t, '考试')).length >= 1, '搜「考试」命中智力类');
  ok(A.TALENTS.filter(t => A.talentSearchHit(t, '魅力 钱')).length >= 1, '空格分词：两个词都要命中');
  ok(A.TALENTS.filter(t => A.talentSearchHit(t, '这个词不可能出现')).length === 0, '没有噪声匹配');
  ok(A.talentSearchHit({ name: 'x' }, ''), '空搜索不过滤');

  // 命中标注：搜魅力时，CHA 天赋要被标出来
  const t = A.TALENTS.find(x => x.eff && x.eff.CHA > 0);
  ok(A.talentHitStats(t, '魅力').indexOf('CHA') >= 0, '命中项能被标注到 CHA', t.name);
}

console.log('== 2. 关系阶段：认识 ≠ 交往 ==');
{
  const s = mk({}); s.age = 24;
  const l = A.makeLover(s, '偶遇');
  A.loveInit(s).candidates.push(l);
  ok(A.loverStage(s, l) === 'met', '刚认识的人只是「刚认识」', A.stageText(s, l));
  ok(!s.flags.dating, '认识一个人不会直接进入交往状态');

  l.affinity = 40; A.syncStage(s, l);
  ok(A.loverStage(s, l) === 'close', '好感上来后变「有点意思」', A.stageText(s, l));
  ok(!s.flags.dating, '「有点意思」仍然不是交往');

  // ensureLover 不再自动交往
  const s2 = mk({}); s2.age = 20;
  const l2 = A.ensureLover(s2, '同学');
  ok(!s2.flags.dating && !A.loveInit(s2).partner, 'ensureLover 只负责认识，不置交往');
  ok(A.loverStage(s2, l2) !== 'dating', 'ensureLover 造出来的人不是恋人', A.stageText(s2, l2));
}

console.log('== 3. 表白 ==');
{
  const s = mk({}); s.age = 24; s.stats.CHA = 70;
  const l = A.makeLover(s, '邂逅');
  l.affinity = 30;
  A.loveInit(s).candidates.push(l);
  const lv = A.loveInit(s);
  ok(!A.confessTo(s, 0).ok, '好感不够表白不了', A.confessTo(s, 0).msg);

  l.affinity = 60;
  let win = 0, tried = 0;
  for (let i = 0; i < 30; i++) {
    const t = mk({}); t.age = 24; t.stats.CHA = 80;
    const x = A.makeLover(t, '邂逅'); x.affinity = 72; x.look = 80;
    A.loveInit(t).candidates.push(x);
    const r = A.confessTo(t, 0);
    tried++;
    if (r.ok) {
      win++;
      ok(A.loverStage(t, x) === 'dating', '表白成功后进入交往', A.stageText(t, x));
      ok(!!t.flags.dating && A.loveInit(t).partner === x, '成功后 flags.dating 与 partner 才置位');
      break;
    }
  }
  ok(win > 0, `${tried} 次里至少成功过一次`);

  // 失败冷却：一年不能再开口
  const s3 = mk({}); s3.age = 24; s3.stats.CHA = 20;
  const l3 = A.makeLover(s3, '邂逅'); l3.affinity = 55; l3.look = 20; l3.tp = 'cool';
  A.loveInit(s3).candidates.push(l3);
  let rejected = false;
  for (let i = 0; i < 40 && !rejected; i++) {
    const t = mk({}); t.age = 24; t.stats.CHA = 20;
    const x = A.makeLover(t, '邂逅'); x.affinity = 55; x.look = 20; x.tp = 'cool';
    A.loveInit(t).candidates.push(x);
    const r = A.confessTo(t, 0);
    if (!r.ok && /被拒绝/.test(r.msg || '')) {
      rejected = true;
      ok(!A.confessTo(t, 0).ok, '被拒后一年内不能再开口', A.confessTo(t, 0).msg);
    }
  }
  ok(rejected, '表白确实可能被拒（不是必成）');

  // 已婚不能表白
  const s4 = mk({}); s4.age = 30;
  const sp = A.makeLover(s4, '偶遇'); sp.affinity = 80;
  A.loveInit(s4).candidates.push(sp); A.marry(s4, sp);
  const other = A.makeLover(s4, '邂逅'); other.affinity = 80;
  A.loveInit(s4).candidates.push(other);
  ok(!A.confessTo(s4, 0).ok, '已婚不能对别人表白', A.confessTo(s4, 0).msg);
}

console.log('== 4. 亲密关系必须先确定关系 ==');
{
  const s = mk({}); s.age = 24;
  const l = A.makeLover(s, '邂逅'); l.affinity = 70;
  A.loveInit(s).candidates.push(l);
  const r = A.loveIntimate(s, 0, true);
  ok(!r.ok, '没在一起就亲密会被拦下', r.msg);
  ok(!s.flags.dating, '被拦下时不会顺手置为交往');

  l.affinity = 80;
  let done = false;
  for (let i = 0; i < 30 && !done; i++) {
    const t = mk({}); t.age = 24; t.stats.CHA = 80;
    const x = A.makeLover(t, '邂逅'); x.affinity = 85; x.look = 80;
    A.loveInit(t).candidates.push(x);
    if (A.confessTo(t, 0).ok) {
      const r2 = A.loveIntimate(t, 0, true);
      ok(r2.ok, '确定关系后可以亲密', r2.ok ? '' : r2.msg);
      done = true;
    }
  }
  ok(done, '端到端：表白 → 亲密 走通');
}

console.log('== 5. 前任不在家庭页 ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets/ui.js'), 'utf8');
  const famStart = src.indexOf("if (REL_TAB === 'family') {");
  const clsStart = src.indexOf("} else if (REL_TAB === 'classmate') {");
  const loveStart = src.indexOf("} else if (REL_TAB === 'love') {");
  const goodStart = src.indexOf("} else if (REL_TAB === 'good') {");
  const famBlock = src.slice(famStart, clsStart);
  const loveBlock = src.slice(loveStart, goodStart);
  ok(famBlock.indexOf('exList') < 0, 'family 分支不再渲染前任');
  ok(loveBlock.indexOf('exList(STATE)') > 0, '前任卡挪到了恋爱页');
  ok(/旧人/.test(loveBlock), '恋爱页有「旧人」分组');
}

console.log('== 6. 旧存档迁移 ==');
{
  const s = mk({}); s.age = 30; s.flags.dating = true;
  const lv = A.loveInit(s);
  const a = A.makeLover(s, '偶遇'); delete a.stage; a.affinity = 80;
  const b = A.makeLover(s, '偶遇'); delete b.stage; b.affinity = 20;
  lv.candidates = [a, b]; lv.partner = a;
  A.migrateState(s);
  ok(a.stage === 'dating', '旧存档的现任补成 dating', a.stage);
  ok(b.stage === 'met', '旧存档的陌生人补成 met', b.stage);
}

console.log('== 7. 端到端：认识 → 见面 → 表白 → 在一起 ==');
{
  let okCount = 0, crash = null;
  for (let seed = 0; seed < 25; seed++) {
    const s = mk({ name: 'X' + seed, startYear: 1990 });
    s.age = 22; s.stats.MONEY = 30000000; s.stats.CHA = 60;
    const r = A.meetOutside(s);
    if (!r.ok) continue;
    const lv = A.loveInit(s);
    const l = lv.candidates[0];
    if (!l) continue;
    const stage0 = A.loverStage(s, l);
    let steps = 0;
    for (let k = 0; k < 40 && A.loverStage(s, l) !== 'dating'; k++) {
      const ra = A.loveAct(s, 0, 'chat');
      if (!ra.ok) { s.age++; lv.candidates.forEach(x => { x.lastTouch = -1; x.touches = 0; }); continue; }
      steps++;
      if (A.loverStage(s, l) !== 'met' && l.affinity >= A.LOVE_META.confessAffinity) A.confessTo(s, 0);
      s.age++;
      lv.candidates.forEach(x => { x.lastTouch = -1; x.touches = 0; });
    }
    if (A.loverStage(s, l) === 'dating') okCount++;
    if (stage0 === 'dating') crash = '一认识就是交往';
  }
  ok(!crash, '认识一个人不会一上来就是交往状态');
  ok(okCount >= 15, '多次见面后表白能在一起', `25 局里 ${okCount} 局走到交往`);
}

console.log(fail ? `\n❌ ${fail} 项未通过` : '\n✅ 全部通过');
process.exit(fail ? 1 : 0);
