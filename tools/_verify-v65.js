/* v6.5.0 验收 · 九项修复与调整
 *   ① 婴儿身份不再冻结（7 岁起切成学生）
 *   ② 头像回归 emoji（不再用真人精灵图）
 *   ③ 选择事件 / 中高考 / 投资：弹窗呈现，必须选择才能「下一年」
 *   ④ 未成年不会出现成人向选项
 *   ⑤ 中考 / 高考五题全对 → 满分
 *   ⑥ 大学专业扩容 + 同学变多
 *   ⑦ 一键互动覆盖兄弟姐妹
 *   ⑧ 兄弟姐妹随家姓 + 离异再育标注（同母异父 / 同父异母）
 *   ⑨ 朋友栏改为「同事」（工作后结识）
 *   ⑩ 版本号与资源串
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const A = f => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');

const ENGINE = A('engine.js'), SCHOOL = A('school.js'), DATA = A('data.js');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const UI = A('ui.js'), CSS = A('style.css');

const ctx = {
  console, Math, JSON, Date,
  window: { addEventListener() { }, __eval: null },
  document: { addEventListener() { }, getElementById() { return null }, querySelectorAll() { return [] } },
  localStorage: { getItem() { return null }, setItem() { }, removeItem() { } }
};
vm.createContext(ctx);
['data', 'market', 'engine', 'school', 'career', 'love', 'pet', 'legacy', 'loan', 'ui']
  .forEach(m => vm.runInContext(A(m + '.js'), ctx, { filename: m }));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + extra : '')); }
};
const sec = t => console.log('\n== ' + t + ' ==');
const R = code => vm.runInContext('(function(){' + code + '})()', ctx);

const mk = opts => `createGame(Object.assign({name:'王二',gender:'M',familyId:'nongcun',
  startYear:1990,priority:'balance',talents:[]}, ${JSON.stringify(opts || {})}))`;

/* =========================================================
 * 1 · 婴儿身份不再冻结
 * ========================================================= */
sec('1 · 婴儿阶段修正（8 岁还在显示「婴儿」）');

const r1 = R(`
  const s = ${mk({ name: '王小明', familyId: 'nongcun', startYear: 1990 })};
  const seen = {};                 // age -> 最后一次观测到的身份
  let g = 0;
  while (s.age < 13 && g++ < 400) {
    let it;
    try { it = step(s); } catch (e) { break; }
    if (!it || it.type === 'end') break;
    if (it.type === 'event' && it.ev) { try { resolveEvent(s, it.ev, 0); } catch (e) { break; } }
    seen[s.age] = s.job;
  }
  const rows = [];
  for (let a = 1; a <= 12; a++) rows.push({ age: a, job: seen[a] || null });
  return { rows: rows, maxAge: s.age, lastJob: s.job };
`);
const jobs1 = r1.rows;
ok(jobs1.some(r => r.age <= 6 && r.job === '婴儿'),
  '6 岁及以下身份是「婴儿」', jobs1.filter(r => r.age <= 6).map(r => r.age + ':' + r.job).join(' '));

const stuck7to12 = jobs1.filter(r => r.age >= 7 && r.job === '婴儿');
ok(stuck7to12.length === 0,
  '7–12 岁不再有任何一个身份是「婴儿」（本次修复的核心）',
  stuck7to12.map(r => r.age + '岁').join(','));

ok(jobs1.filter(r => r.age >= 7 && r.job === '小学生').length >= 4,
  '7–12 岁按年显示「小学生」等学籍身份',
  jobs1.filter(r => r.age >= 7).map(r => r.age + ':' + r.job).join(' '));

/* 回归根因：即使 job 被外部写成 '婴儿'，下一年也必须被重算（不得用 || 短路） */
const r1b = R(`
  const s = ${mk({ name: '王小明', familyId: 'nongcun', startYear: 1990 })};
  let g = 0;
  while (s.age < 9 && g++ < 300) {
    let it; try { it = step(s); } catch (e) { break; }
    if (!it || it.type === 'end') break;
    if (it.type === 'event' && it.ev) { try { resolveEvent(s, it.ev, 0); } catch (e) { break; } }
  }
  s.job = '婴儿';                       // 人为把身份写死成婴儿
  s.queue = [];                          // 清空队列，强制走「新的一年」分支
  let it = null; try { it = step(s); } catch (e) { }
  return { age: s.age, jobAfterStep: s.job, got: !!it };
`);
ok(r1b.jobAfterStep !== '婴儿',
  '身份每年重算：即便 job 被写成「婴儿」，推进一年后也会被修正（' + r1b.age + ' 岁 → ' + r1b.jobAfterStep + '）',
  r1b.jobAfterStep);

/* livingCost 对婴儿不再 NaN */
const r1c = R(`
  const s = ${mk({ name: '王小明', familyId: 'nongcun', startYear: 1990 })};
  s.age = 4; s.job = '婴儿';
  const v = livingCost(s);
  return { v: v, ok: typeof v === 'number' && !isNaN(v) && v > 0 };
`);
ok(r1c.ok, '婴儿年纪的生活开销是合法数字（不会 NaN）', r1c.v);

/* =========================================================
 * 2 · 头像回归 emoji
 * ========================================================= */
sec('2 · 头像回归 emoji（不再用真人精灵图）');
const r2 = R(`
  const cases = [[1,'M'],[1,'F'],[6,'M'],[9,'F'],[15,'M'],[25,'F'],[45,'M'],[80,'F']];
  const avs = cases.map(c => ageAvatar(c[0], c[1]));
  return {
    avs: avs,
    pav: personAvatar('李梅','F',25,'green'),
    pavEmpty: personAvatar('张','M',7)
  };
`);
const EMOJI = /\p{Extended_Pictographic}/u;
ok(r2.avs.every(a => a && EMOJI.test(a)), '各年龄段 ageAvatar 都返回 emoji', JSON.stringify(r2.avs));
ok(r2.avs[0] === '👶', '婴儿 kitten 用 👶', r2.avs[0]);
ok(r2.pav.indexOf('class="rel-ava emoji') >= 0, '关系卡头像带 emoji 类：' + r2.pav.replace(/</g, '‹'));
ok(r2.pav.indexOf('background-position') < 0 && r2.pav.indexOf('avatars.jpg') < 0,
  '关系卡头像不再使用精灵图（无 background-position / avatars.jpg）');

/* HUD 头像走 textContent 而非背景图 */
ok(/hudAva\.textContent\s*=\s*ageAvatar\(STATE\.age,\s*STATE\.gender\)/.test(UI),
  'HUD 头像改为直接用 emoji 字符渲染');
ok(!/hudAva[\s\S]{0,120}avaStyle/.test(UI), 'HUD 头像不再引用 avaStyle 精灵图');
ok((UI.match(/avaStyle\(/g) || []).length === 1,
  'avaStyle 只剩定义、无任何渲染调用点（已成死代码）',
  (UI.match(/avaStyle\(/g) || []).length);
ok(/\.rel-ava\.emoji\s*\{/.test(CSS), 'style.css 为 emoji 头像补了样式');

/* =========================================================
 * 3 · 选择事件弹窗 + 未选择不能下一年
 * ========================================================= */
sec('3 · 选弹窗阻断（不选择无法进入下一年）');
ok(/let\s+POP_OPEN\s*=\s*false/.test(UI), '存在弹窗状态位 POP_OPEN');
ok(/id="popModal"/.test(HTML) && /id="popHead"/.test(HTML) && /id="popBody"/.test(HTML) && /id="popActions"/.test(HTML),
  'index.html 里有 #popModal 及 头部/正文/操作三个槽位');
ok(/\.pop-box\s*\{/.test(CSS), 'style.css 有弹窗容器样式 .pop-box');

const advGuard = UI.match(/function advance\(\)[\s\S]{0,320}?POP_OPEN[\s\S]{0,160}?return/);
ok(!!advGuard, 'advance() 开头有 POP_OPEN 守卫：弹窗未关闭直接 return',
  advGuard ? advGuard[0].replace(/\s+/g, ' ').slice(0, 120) : '未找到');
ok(/请先做出选择/.test(UI), '有「请先做出选择」的提示文案');

ok(/function renderItem\(item\)[\s\S]{0,260}?item\.type === 'event'[\s\S]{0,120}?showPop\(item\)/.test(UI),
  'renderItem：事件一律走 showPop 弹窗');
ok(/function renderItem[\s\S]{0,300}?item\.type === 'exam'[\s\S]{0,10}?\s*\|\|[\s\S]{0,10}?item\.type === 'invest'[\s\S]{0,80}?showPop/.test(UI)
  || /item\.type === 'event' \|\| item\.type === 'exam' \|\| item\.type === 'invest'\s*\{\s*showPop/.test(UI),
  'renderItem：中考/高考/投资同样走弹窗');
ok(/function continueFlow\(\)[\s\S]{0,320}?closePop\(\);[\s\S]{0,60}?renderIdle\(\)/.test(UI),
  'continueFlow：非交互内容时关闭弹窗并回到空闲态');
ok(/\$\('card'\)\.innerHTML = ''/.test(UI) && /\$\('actions'\)\.innerHTML = ''/.test(UI),
  '弹窗打开时清空背后内联区，避免误触「下一年」');
ok((UI.match(/continueFlow\(\);/g) || []).length >= 3, '三处事件收尾都改为 continueFlow()',
  (UI.match(/continueFlow\(\);/g) || []).length);

/* =========================================================
 * 4 · 未成年不得出现成人向选项
 * ========================================================= */
sec('4 · 未成年（<18）不出现成人向选项');
const r4 = R(`
  const POOLS = ['EVENTS','EVENTS_EXTRA','EVENTS_FAMILY','EVENTS_YOUTH','EVENTS_ERA','EVENTS_CHILD','EVENTS_V63'];
  const pools = {};
  POOLS.forEach(n => { try { const v = eval(n); if (Array.isArray(v)) pools[n] = v; } catch (e) { } });
  const KW = ['公司','上班','加班','同事','领导','上司','职场','工资','月薪','跳槽','年终','绩效','裁员','工位',
    '看父母','看望','回家看','老家','探亲','酒局','应酬','饭局','客户','甲方','项目','汇报','出差','创业',
    '合伙人','融资','房贷','贷款','房租','买房','股票','投资','社保','公积金'];
  function win(ev){
    let a = ev.age;
    if (a == null && ev.cond) {
      if (ev.cond.age != null) a = ev.cond.age;
      else if (ev.cond.ageMin != null || ev.cond.ageMax != null) a = [ev.cond.ageMin||0, ev.cond.ageMax||200];
    }
    if (a == null) return [0,200];
    if (typeof a === 'number') return [a,a];
    if (Array.isArray(a)) return [a[0]==null?0:a[0], a[1]==null?200:a[1]];
    return [0,200];
  }
  const ages = [6,9,12,15,17];
  const offenders = [];
  let scanned = 0, choiceTotal = 0;
  for (const name in pools) {
    for (const ev of pools[name]) {
      const w = win(ev);
      if (w[0] > 17) continue;                       // 成年后才可能触发
      for (const age of ages) {
        if (age < w[0] || age > Math.min(w[1], 17)) continue;
        const s = ${mk({ name: '王二', startYear: 1990 })};
        s.age = age;
        let list = [];
        try { list = eventChoices(s, ev) || []; } catch (e) { continue; }
        if (!list.length) continue;
        scanned++;
        for (const c of list) {
          choiceTotal++;
          const t = String(c.text || '');
          const hit = KW.filter(k => t.indexOf(k) >= 0);
          if (hit.length) offenders.push(age + '岁 [' + ev.id + '] 「' + t + '」 hits=' + hit.join(','));
        }
      }
    }
  }
  const dedup = {}; offenders.forEach(o => dedup[o] = 1);
  return { pools: Object.keys(pools), scanned: scanned, choiceTotal: choiceTotal,
           offenders: Object.keys(dedup) };
`);
ok(r4.scanned > 0, '扫描到未成年可触发的选择型事件（' + r4.scanned + ' 个事件×年龄组合，覆盖 ' + r4.pools.join('/') + '）');
ok(r4.choiceTotal > 100, '共检查了 ' + r4.choiceTotal + ' 条未成年可见的选项文案');
ok(r4.offenders.length === 0,
  '未成年可见选项中没有「回家看看 / 工作应酬 / 客户 / 老板」这类成人向措辞',
  r4.offenders.slice(0, 6).join(' ｜ '));

/* 运行时兜底：同一个成人事件，未成年看到的是同龄人口吻；成年后仍是原本的选项 */
const r4b = R(`
  const ev = EVENTS.find(x => x.id === 'w_ai');
  const a = ${mk({ name: '王二', startYear: 1990 })}; a.age = 10;
  const minor = (eventChoices(a, ev) || []).map(c => c.text);
  const b = ${mk({ name: '王二', startYear: 1990 })}; b.age = 30;
  const adult = (eventChoices(b, ev) || []).map(c => c.text);
  const KW2 = ['创业','上班','公司','积蓄','大厂','打工','估值'];
  return { has: !!ev, minor: minor, adult: adult,
           minorHits: minor.filter(t => KW2.filter(k => t.indexOf(k) >= 0).length > 0),
           adultKeeps: adult.some(t => t.indexOf('押上积蓄') >= 0) };
`);
ok(r4b.has, '存在「AI 浪潮」事件（此前无年龄限制，可被 6 岁触发）');
ok(r4b.minorHits.length === 0,
  '10 岁看到的是同龄人口吻：' + JSON.stringify(r4b.minor),
  r4b.minorHits.join(' / '));
ok(r4b.minor.length === r4b.adult.length, '未成年仍有同样数量的选项可点（只换了说法）',
  r4b.minor.length + ' vs ' + r4b.adult.length);
ok(r4b.adultKeeps, '成年后仍是原本的选项文案（未被误伤）：' + JSON.stringify(r4b.adult));

/* 数据侧：明确不该给未成年人看的事件都补了年龄下限 */
const r4c = R(`
  const ids = ['w_crypto','w_ai','w_tsunami','w_techboom','w_techcrash','w_bodymod','w_space','x_e05'];
  return ids.map(id => {
    const ev = EVENTS.find(x => x.id === id);
    return { id: id, lo: ev && ev.age ? ev.age[0] : null };
  });
`);
ok(r4c.every(x => x.lo !== null && x.lo >= 18),
  '投资/职场类浪潮事件与 x_e05 均已限制到 18 岁以后',
  r4c.map(x => x.id + ':' + x.lo).join(' '));
ok(/const ADULT_CHOICE_KW = \[/.test(DATA), '数据侧提供了成人向措辞黑名单 ADULT_CHOICE_KW');
ok(/function minorSafeChoices/.test(ENGINE), 'engine 侧提供 minorSafeChoices 兜底过滤');
ok(/return minorSafeChoices\(state, ev, list\);/.test(ENGINE),
  'eventChoices 对自带 choices 的事件也走了一遍未成年过滤');

/* =========================================================
 * 5 · 中高考五题全对 → 满分
 * ========================================================= */
sec('5 · 中考 / 高考全答对 → 满分');
const r5 = R(`
  function run(kind, allCorrect){
    const s = ${mk({ name: '赵四', startYear: 1990 })};
    s.stats.INT = 20; s.stats.WILL = 20;
    s.edu = s.edu || {}; s.edu.study = 0;
    s.edu.hs = HIGH_SCHOOLS[0].id;
    s.age = (kind === 'mid') ? 15 : 18;
    const item = makeExamEvent(s, kind);
    if (!item || item.type !== 'exam' || !item.exam || !item.exam.quiz) return null;
    s.pending = item;
    const qs = item.exam.quiz.qs;
    for (let i = 0; i < qs.length; i++) answerExamQ(s, allCorrect ? qs[i].a : (qs[i].a + 1) % qs[i].opts.length);
    return {
      n: qs.length, full: item.exam.full, score: item.exam.score,
      text: item.exam.text, correct: item.exam.quiz.correct
    };
  }
  return { midAll: run('mid', true), midNone: run('mid', false),
           gaoAll: run('gao', true), gaoNone: run('gao', false) };
`);
ok(r5.midAll && r5.midAll.n === 5, '中考常识统考是 5 道题', r5.midAll && r5.midAll.n);
ok(r5.midAll.score === r5.midAll.full,
  '中考五题全对 → 卷面就是满分 ' + (r5.midAll && r5.midAll.full) + ' 分',
  r5.midAll && r5.midAll.score);
ok(/五题全对，满分/.test(r5.midAll.text), '中考放榜文案写明「五题全对，满分！」');
ok(r5.gaoAll && r5.gaoAll.score === r5.gaoAll.full,
  '高考五题全对 → 卷面就是满分 ' + (r5.gaoAll && r5.gaoAll.full) + ' 分',
  r5.gaoAll && r5.gaoAll.score);
ok(/五题全对，满分/.test(r5.gaoAll.text), '高考放榜文案写明「五题全对，满分！」');
ok(r5.midNone.score < r5.midNone.full && !/满分/.test(r5.midNone.text),
  '对照：一题没答对就不是满分（' + r5.midNone.score + '/' + r5.midNone.full + '，且文案不含「满分」）');

/* =========================================================
 * 6 · 大学专业扩容 + 同学变多
 * ========================================================= */
sec('6 · 专业扩容 / 同学变多');
const r6 = R(`
  const real = UNIVERSITIES.filter(u => u.id !== 'u_fail');
  return {
    lens: real.map(u => ({ id: u.id, n: u.major.length })),
    total: real.reduce((a, u) => a + u.major.length, 0),
    has: {
      m985: UNIVERSITIES.find(u => u.id === 'u_985').major.indexOf('经济学') >= 0,
      m211: UNIVERSITIES.find(u => u.id === 'u_211').major.indexOf('财务管理') >= 0,
      yiben: UNIVERSITIES.find(u => u.id === 'u_yiben').major.indexOf('汉语言文学') >= 0,
      erben: UNIVERSITIES.find(u => u.id === 'u_erben').major.indexOf('金融工程') >= 0,
      zk: UNIVERSITIES.find(u => u.id === 'u_zhuanke').major.indexOf('烹饪工艺') >= 0
    },
    cap: CLASSMATE_CAP,
    uniBatch: makeClassmates(${mk({ startYear: 1990 })}, 'uni').length,
    highBatch: makeClassmates(${mk({ startYear: 1990 })}, 'high').length
  };
`);
ok(r6.lens.every(x => x.n >= 10), '每所大学的专业都不少于 10 个（原 6 个）',
  r6.lens.map(x => x.id + ':' + x.n).join(' '));
ok(r6.total >= 50, '五所院校合计 ' + r6.total + ' 个专业（原 27 个）');
ok(Object.keys(r6.has).every(k => r6.has[k]), '新增专业都已在位（经济学/财务管理/汉语言文学/金融工程/烹饪工艺）',
  JSON.stringify(r6.has));
ok(r6.cap === 22, '同学上限 CLASSMATE_CAP 提到 22（原 14）', r6.cap);
ok(r6.uniBatch === 8, '大学阶段一次认识 8 位同学（原 6）', r6.uniBatch);
ok(r6.highBatch === 6, '中学阶段维持 6 位同学', r6.highBatch);

const r6b = R(`
  const s = ${mk({ name: '孙七', startYear: 1990 })};
  s.edu = { hs: null, uni: null, eduLevel: 0, study: 0, gradAge: null };
  const seen = [];
  ['pri','mid','high','uni'].forEach(st => {
    s.classStage = null;
    if (st === 'uni') { s.edu.hs = HIGH_SCHOOLS[0].id; s.edu.uni = 'u_985'; s.edu.gradAge = s.age + 4; s.age = 19; }
    else if (st === 'high') s.age = 16; else if (st === 'mid') s.age = 13; else s.age = 8;
    refreshClassmates(s);
    seen.push((s.classmates || []).length);
  });
  return { seen: seen, final: (s.classmates || []).length };
`);
ok(r6b.final === 22, '小学+初中+高中+大学累积后稳定在上限 22 人：' + r6b.seen.join(' → '), r6b.final);
ok(Math.max.apply(null, r6b.seen) > 14, '同学总数明显多于此前的 14 人上限');

/* =========================================================
 * 7 · 一键互动覆盖兄弟姐妹
 * ========================================================= */
sec('7 · 一键互动（家里有兄弟姐妹时必须生效）');
const r7 = R(`
  const s = ${mk({ name: '周八', startYear: 1990 })};
  s.age = 20;
  s.parents = null; s.spouse = null; s.children = []; s.pet = null;   // 只留兄弟姐妹
  s.siblings = [
    { name:'周甲', gender:'M', born: 1988, affinity: 60, alive: true,  married:false, touchYear: -1 },
    { name:'周乙', gender:'F', born: 1992, affinity: 55, alive: true,  married:false, touchYear: -1 },
    { name:'周丙', gender:'M', born: 1994, affinity: 50, alive: false, married:false, touchYear: -1 }
  ];
  const res = socialActAll(s, 'family');
  return {
    ok: res.ok, n: res.n,
    touch: s.siblings.map(x => x.touchYear),
    age: s.age,
    logHas: (s.log || []).some(l => String(l.text || '').indexOf('家里人挨个陪了一遍') >= 0)
  };
`);
ok(r7.ok === true && r7.n === 2, '一键团圆触达了 2 位在世兄弟姐妹（返回 ok=true / n=2）',
  JSON.stringify({ ok: r7.ok, n: r7.n }));
ok(r7.touch[0] === r7.age && r7.touch[1] === r7.age,
  '在世兄弟姐妹都被走动到了（touchYear 记为当年）', JSON.stringify(r7.touch));
ok(r7.touch[2] === -1, '已故兄弟姐妹不会被走动', r7.touch[2]);
ok(r7.logHas, '日志写入「家里人挨个陪了一遍」');

/* 再跑一次：同年重复点击应当全部跳过 */
const r7b = R(`
  const s = ${mk({ name: '周八', startYear: 1990 })};
  s.age = 20; s.parents = null; s.spouse = null; s.children = []; s.pet = null;
  s.siblings = [{ name:'周甲', gender:'M', born:1988, affinity:60, alive:true, married:false, touchYear:-1 }];
  socialActAll(s, 'family');
  const second = socialActAll(s, 'family');
  return { second: second };
`);
ok(r7b.second.ok === false && r7b.second.n === 0, '同一年再点一次不会重复计数', JSON.stringify(r7b.second));

/* =========================================================
 * 8 · 兄弟姐妹随家姓 + 离异再育标注
 * ========================================================= */
sec('8 · 兄弟姐妹姓氏 / 离异再育标注');
const r8 = R(`
  const FAMS = ['chengzhongcun','xiangong','nongcun','getihu','jiaoshi','tizhinei','chaiqian','shangren','kuangqu','junshu'];
  let total = 0, same = 0, bad = [], females = 0, femaleBad = 0;
  for (let i = 0; i < 60; i++) {
    const s = ${mk({ name: '李甲', startYear: 1955, familyId: 'nongcun' })};
    s.familyId = FAMS[i % FAMS.length];
    s.startYear = 1955 + (i % 24);
    s.name = '李' + (i % 7);
    const sibs = makeSiblings(s);
    for (const b of sibs) {
      total++;
      if (b.name[0] === s.name[0]) same++; else bad.push(b.name + '(家姓' + s.name[0] + ')');
      if (b.gender === 'F') { females++; if (b.name[0] !== s.name[0]) femaleBad++; }
    }
  }
  return { total: total, same: same, bad: bad.slice(0,5), females: females, femaleBad: femaleBad,
           direct: sibName({ name: '陈九九' }, 'F'), directM: sibName({ name: '陈九九' }, 'M') };
`);
ok(r8.total >= 40, '生成了足够的兄弟姐妹样本（' + r8.total + ' 位）');
ok(r8.same === r8.total, '所有兄弟姐妹都与父亲（家姓）同姓', r8.bad.join(' '));
ok(r8.females > 0 && r8.femaleBad === 0,
  '姐妹也随家姓（此前女性被误用了随机姓氏）：检查了 ' + r8.females + ' 位姐妹');
ok(r8.direct[0] === '陈' && r8.directM[0] === '陈', 'sibName 直接调用同样取家姓：' + r8.direct + ' / ' + r8.directM);

/* f_divorce → 离异后再育的半个手足 */
const r8b = R(`
  const s = ${mk({ name: '李雷', startYear: 1990 })};
  s.age = 12; s.siblings = [];
  s.flags.parents_alive = true; delete s.flags.parents_divorced;
  const ev = EVENTS_FAMILY.find(x => x.id === 'f_divorce');
  resolveEvent(s, ev, 0);                                  // 跟着父亲 → 母亲再嫁，同母异父
  const sibs = s.siblings || [];
  const half = sibs.filter(x => x.half);
  const label = half.length ? sibRelLabel(s, half[0]) : '';
  const before = sibs.length;
  resolveEvent(s, ev, 1);                                  // 再触发一次
  const after = (s.siblings || []).filter(x => x.half).length;
  return { has: !!ev, before: before, after: after,
           rel: half[0] && half[0].rel, name: half[0] && half[0].name,
           homeName: s.name[0], label: label,
           queued: (s.queue || []).some(q => q.ev && String(q.ev.text || '').indexOf('又添了个') >= 0),
           flags: s.flags.parents_divorced === true };
`);
ok(r8b.has, '存在离异事件 f_divorce');
ok(r8b.before === 1 && r8b.rel === '异父', '跟着父亲 → 母亲再育，生成半个手足（rel=异父）', JSON.stringify(r8b));
ok(r8b.after === 1, '整局只标注一次，不会反复刷出同父/同母手足', r8b.after);
ok(r8b.name && r8b.name[0] !== r8b.homeName, '半个手足随新伴侣的姓，与家姓不同（便于识别）',
  r8b.name + ' vs 家姓 ' + r8b.homeName);
ok(/（同母异父）/.test(r8b.label), '家族图谱/家人页标注：（同母异父）', r8b.label);
ok(r8b.queued, '当场推送一条「又添了个弟弟/妹妹」的叙事事件');
ok(r8b.flags, '同时写入 parents_divorced 标记');

/* 反向：跟着母亲 → 父亲再娶，同父异母 */
const r8c = R(`
  const s = ${mk({ name: '韩梅梅', startYear: 1990 })};
  s.age = 11; s.siblings = [];
  s.flags.parents_alive = true; delete s.flags.parents_divorced;
  const ev = EVENTS_FAMILY.find(x => x.id === 'f_divorce');
  resolveEvent(s, ev, 1);                                  // 跟着母亲 → 父亲再娶
  const h = (s.siblings || []).filter(x => x.half)[0];
  return { rel: h && h.rel, label: h ? sibRelLabel(s, h) : '' };
`);
ok(r8c.rel === '异母' && /（同父异母）/.test(r8c.label), '跟着母亲 → 父亲再娶，标注（同父异母）', r8c.label);
ok(/function sibRelLabel/.test(UI), 'ui.js 提供统一的 sibRelLabel 标注函数');

/* =========================================================
 * 9 · 朋友栏 → 同事（工作后结识）
 * ========================================================= */
sec('9 · 朋友栏改为「同事」（工作后遇到的人）');
const r9 = R(`
  return {
    types: COLLEAGUE_TYPES.map(t => ({ key: t.key, label: t.label, from: t.from, needCareer: t.needCareer })),
    allNeedCareer: COLLEAGUE_TYPES.every(t => t.needCareer === true),
    oldFriendGone: (typeof FRIEND_TYPES === 'undefined')
  };
`);
ok(r9.allNeedCareer, '三种同事关系全部要求「已上班」才会生成', JSON.stringify(r9.types));
ok(r9.types.length === 3 && r9.types.map(t => t.label).join('/') === '同事/客户/合作伙伴',
  '关系类型为：同事 / 客户 / 合作伙伴');
ok(r9.types.every(t => t.from >= 20), '最早也要 20 岁以后才可能结识（' + r9.types.map(t => t.from).join('/') + '）');

const r9b = R(`
  // 没上班 → 无论如何都不会结识同事
  const a = ${mk({ name: '吴九', startYear: 1990 })};
  a.age = 30; a.career = null; a.friends = [];
  for (let i = 0; i < 40; i++) friendGrowth(a);
  const nA = (a.friends || []).length;

  // 上班后 → 会结识同事
  const b = ${mk({ name: '郑十', startYear: 1990 })};
  b.age = 30; b.career = { id: 'office', level: 0, years: 1, joinedAge: 29 }; b.friends = [];
  let tries = 0;
  while (!(b.friends || []).length && tries++ < 60) friendGrowth(b);
  const f = (b.friends || [])[0];
  const t = f && COLLEAGUE_TYPES.find(x => x.key === f.key);
  return { nA: nA, nB: (b.friends || []).length, tries: tries,
           key: f && f.key, label: t && t.label, name: f && f.name,
           logHas: (b.log || []).some(l => String(l.text || '').indexOf('【新同事】') >= 0),
           nameIsCn: f ? /^[\\u4e00-\\u9fa5]{2,4}$/.test(f.name) : false };
`);
ok(r9b.nA === 0, '没工作时一个同事都遇不到（40 次抽样全为 0）', r9b.nA);
ok(r9b.nB === 1, '上班后会结识到同事（第 ' + r9b.tries + ' 次抽样命中）');
ok(!!r9b.label, '新关系带正确的身份标签：' + r9b.name + '（' + r9b.label + '）');
ok(r9b.nameIsCn, '同事使用中文姓名', r9b.name);
ok(r9b.logHas, '日志写明「【新同事】…认识了谁」');
ok(/💼 同事/.test(UI), '人际关系面板 tab 文案改为「💼 同事」');
ok(/一键和所有同事聚一次/.test(UI), '一键按钮文案改为「一键和所有同事聚一次」');
ok(/新同事/.test(ENGINE), 'engine 侧文案已切到「新同事」口径');

/* =========================================================
 * 10 · 版本与资源串
 * ========================================================= */
sec('10 · 版本与资源串');
const n65 = (HTML.match(/\?v=6\.5\.0/g) || []).length;
ok(n65 >= 11, 'index.html 资源串全部升到 6.5.0（' + n65 + ' 处）', n65);
ok(/v6\.5\.0/.test(HTML), '页脚标注 v6.5.0');
ok(!/\?v=6\.4\.0/.test(HTML), '没有遗留 6.4.0 的资源串');

console.log('\n' + (fail ? '✗ ' : '✓ ') + 'v6.5.0：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
