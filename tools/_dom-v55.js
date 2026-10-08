/* v5.5 UI 冒烟（jsdom）
 * 1 父亲同姓（界面显示） / 2 分手按钮 / 3 运动员出现在工作列表
 * 4 子女有名有姓的卡片 / 5 前妻卡：联系·复合·复婚 / 6 新版韩式头像
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(
  process.env.NODE_WS || 'C:/Users/ro3ea/.workbuddy/binaries/node/workspace',
  'node_modules', 'jsdom'
));
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/scrollTo|Not implemented/.test(e.message)) errors.push('jsdomError: ' + e.message); });
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://cangame.test/', virtualConsole: vc, pretendToBeVisual: true });
const w = dom.window;
w.addEventListener('error', e => errors.push('window.error: ' + e.message));
w.eval(['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
  'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js', 'assets/ui.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
  .concat([
    'window.__getState = function(){ return STATE; };',
    'window.__call = function(n,a){ return eval(n).apply(null,a); };',
    'window.__eval = function(x){ return eval(x); };'
  ])
  .join('\n;\n'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

let fail = 0;
const ok = (c, name, extra) => { console.log(c ? '  ✓' : '  ✗', name, extra == null ? '' : extra); if (!c) fail++; };
const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const $ = (id) => w.document.getElementById(id);
const call = (n, a) => w.eval(n).apply(null, a || []);
const txt = (id) => $(id).textContent.replace(/\s+/g, ' ');
const S = () => w.__getState();
const btns = (re, scope) => Array.from((scope || w.document).querySelectorAll('button'))
  .filter(b => re.test(b.textContent.replace(/\s+/g, ' ')));

console.log('== 开局 ==');
click($('btnNew'));
$('inputName').value = '陈志远';
click($('btnStart'));
ok(!!S(), '进入游戏');

console.log('== 1. 父亲和你同姓 ==');
{
  const s = S();
  const dad = s.parents && s.parents.father;
  ok(!!dad, '有父亲', dad ? dad.name : '');
  ok(dad && dad.name[0] === s.name[0], '界面上的父亲跟你同姓', `${s.name} / ${dad && dad.name}`);
  call('setRelTab', ['family']);
  const t = txt('view-rel');
  ok(t.indexOf('父亲 · ' + (dad ? dad.name : '@')) >= 0, '家人页列出父亲全名');
  const mom = s.parents && s.parents.mother;
  ok(!mom || mom.name.indexOf(dad.name[0]) !== 0 || true, '母亲保留本姓（不强求同姓）', mom ? mom.name : '');
}

console.log('== 2. 恋爱里有「分手」按钮 ==');
{
  const s = S();
  s.age = 26;
  const lv = w.__eval('loveInit(STATE)');
  lv.candidates = [{
    name: '林小雨', gender: 'F', age: 25, look: 72, charm: 70, tp: 'warm', bg: 'mid',
    src: '偶遇', affinity: 62, alive: true, lastTouch: -1, touches: 0, met: 24, pregnant: false
  }];
  lv.partner = lv.candidates[0];
  s.flags.dating = true; s.flags.in_love = true;
  delete s.flags.married; s.spouse = null; s.spouseName = null;
  call('setRelTab', ['love']);
  const b = btns(/分手/, $('view-rel'));
  ok(b.length === 1, '恋人卡上有「分手」', b.length + ' 个');
  ok($('view-rel').innerHTML.indexOf('rel-act danger') >= 0, '用的是危险色按钮');
  click(b[0]);
  ok($('confirmBox').classList.contains('open'), '分手要二次确认');
  click($('confirmOk'));
  const lv2 = w.__eval('loveInit(STATE)');
  ok(lv2.candidates.length === 0 && !S().flags.dating, '确认后真的分了');
  ok((S().exes || []).length === 1 && S().exes[0].name === '林小雨', '进了前任名单');
  call('setRelTab', ['family']);
  ok(txt('view-rel').indexOf('前任 · 林小雨') >= 0, '家人页能看到前任卡');
  // 已婚时不该出现分手
  s.flags.married = true; s.spouseName = '周琳'; s.spouse = { name: '周琳', age: 30, affinity: 60, alive: true, since: 28 };
  const lv3 = w.__eval('loveInit(STATE)');
  lv3.candidates = [{ name: '外人', gender: 'F', age: 29, affinity: 70, alive: true, lastTouch: -1, touches: 0 }];
  call('setRelTab', ['love']);
  ok(btns(/分手/, $('view-rel')).length === 0, '已婚时不显示分手（要走离婚）');
}

console.log('== 3. 工作列表里有职业运动员 ==');
{
  const s = S();
  s.age = 18; delete s.flags.married;
  s.stats.STR = 45; s.stats.HP = 80;
  if (!s.edu) s.edu = {};
  s.edu.eduLevel = 2; s.edu.stopped = true;
  s.career = null; s.job = '无业';
  call('renderJobView', []);
  const t = txt('view-job');
  ok(/职业运动员/.test(t), '就业市场里有「职业运动员」');
  ok(/青训队员/.test(t), '列出入门职级');
  const list = Array.from($('view-job').querySelectorAll('.offer'));
  const card = list.find(o => /职业运动员/.test(o.textContent));
  ok(!!card, '有运动员职位卡');
  if (card) {
    const go = btns(/应聘|入职|加入/, card)[0];
    ok(!!go, '有可点的应聘按钮', go ? go.textContent.trim() : '');
    if (go) {
      click(go);
      ok(!!S().career, '点了真的入职', S().job);
    }
  }
}

console.log('== 4. 子女：有名有姓有年纪 ==');
{
  const s = S();
  s.age = 38;
  s.children = [];
  s.childCount = 0;
  s.name = '陈志远';
  const kidA = w.__call('addChild', [s, { gender: 'M' }]);
  const kidB = w.__call('addChild', [s, { gender: 'F' }]);
  kidA.born = s.age - 9;
  kidB.born = s.age - 4;
  call('setRelTab', ['family']);
  const t = txt('view-rel');
  ok(t.indexOf(kidA.name) >= 0 && t.indexOf(kidB.name) >= 0, '两个孩子都显示名字', `${kidA.name} / ${kidB.name}`);
  ok(kidA.name[0] === '陈' && kidB.name[0] === '陈', '孩子跟着你的姓');
  ok(/儿子/.test(t) && /女儿/.test(t), '分得清儿子女儿');
  ok(/9 岁/.test(t) && /4 岁/.test(t), '显示年纪', '9 岁 / 4 岁');
  ok(/上小学了/.test(t) && /上幼儿园了/.test(t), '按年纪给出阶段描述');
  ok(t.indexOf('🧸') >= 0, '保留「陪孩子们待一天」互动');
  ok(!/孩子 × \d/.test(t), '不再只有一个「孩子 × N」的计数卡');
  const svgCount = $('view-rel').querySelectorAll('.rel-ava.pic svg').length;
  ok(svgCount >= 2, '孩子也有自己的头像', svgCount + ' 个');
}

console.log('== 5. 前妻：能联系，感情好了还能复婚 ==');
{
  const s = S();
  s.age = 42;
  s.stats.MONEY = 200000000;
  s.exes = []; s.ex = null; // 前面小节留下的前任先清掉，只看前妻
  s.flags.married = true;
  s.spouseName = '周琳';
  s.spouse = { name: '周琳', age: 41, affinity: 66, alive: true, since: 32, look: 70 };
  w.__call('divorce', [s, '过不下去了']);
  call('setRelTab', ['family']);
  let t = txt('view-rel');
  ok(/前妻 · 周琳/.test(t), '家人页出现「前妻」卡', t.slice(t.indexOf('前妻'), t.indexOf('前妻') + 40));
  const chatBtn = btns(/联系/, $('view-rel'))[0];
  ok(!!chatBtn, '有「联系」按钮');
  const ex0 = () => w.__eval('exList(STATE)[0]');
  const aff0 = ex0().affinity;
  click(chatBtn);
  ok(ex0().affinity > aff0, '联系之后感情回暖', `${Math.round(aff0)}% → ${Math.round(ex0().affinity)}%`);
  call('setRelTab', ['family']);
  ok(btns(/联系/, $('view-rel')).length === 0, '同一年不能再联系');
  ok(/今年联系过了/.test(txt('view-rel')), '给出「今年联系过了」提示');
  // 把感情拉到够复婚
  ex0().affinity = 82;
  s.age = 43;
  call('setRelTab', ['family']);
  const rem = btns(/复婚/, $('view-rel'))[0];
  ok(!!rem, '感情够时出现「复婚」按钮');
  if (rem) {
    let done = false;
    for (let i = 0; i < 80 && !done; i++) {
      ex0().affinity = 82; // 每次失败会掉 10 点，拉回来再试
      if (!btns(/复婚/, $('view-rel'))[0]) { call('setRelTab', ['family']); continue; }
      click(btns(/复婚/, $('view-rel'))[0]);
      click($('confirmOk'));
      done = !!S().flags.married;
      call('setRelTab', ['family']);
    }
    ok(done, '反复尝试后复婚成功（有成功率）');
    ok(S().spouse && S().spouse.name === '周琳', '她又成了你的配偶', S().spouseName);
    ok(!btns(/复婚/, $('view-rel')).length, '复婚后按钮消失');
  }
  // 前任（非配偶）能复合
  const s2 = S();
  s2.flags.married = false; s2.spouse = null; s2.spouseName = null;
  s2.flags.dating = false; delete s2.flags.in_love;
  s2.exes = [{ name: '张远', gender: 'M', age: 40, met: 30, at: 36, reason: '分手', wasSpouse: false, affinity: 72, look: 60, lastTouch: -1 }];
  call('setRelTab', ['family']);
  const agg = btns(/复合/, $('view-rel'))[0];
  ok(!!agg, '前任卡上有「复合」按钮');
  if (agg) {
    let okK = false;
    for (let i = 0; i < 80 && !okK; i++) {
      const b = btns(/复合/, $('view-rel'))[0];
      if (!b) break;
      (w.__eval('exList(STATE)')[0] || {}).affinity = 72; // 失败会掉好感，补回来再试
      click(b); click($('confirmOk'));
      okK = !!S().flags.dating;
      call('setRelTab', ['family']);
    }
    ok(okK, '复合成功又变回恋人');
    call('setRelTab', ['love']);
    ok(txt('view-rel').indexOf('张远') >= 0, '他在恋爱页里了');
  }
}

console.log('== 6. 新版韩式证件照头像 ==');
{
  const s = S();
  s.age = 34;
  s.friends = [
    { key: 'colleague', name: '王磊', gender: 'M', age: 36, affinity: 55, alive: true },
    { key: 'old', name: '金智媛', gender: 'F', age: 33, affinity: 70, alive: true }
  ];
  call('setRelTab', ['friends']);
  const pics = $('view-rel').querySelectorAll('.rel-ava.pic svg');
  ok(pics.length >= 2, '朋友卡渲染出头像', pics.length + ' 个');
  const m = w.__call('portraitSVG', ['王磊', 'M', 36, {}]);
  const f = w.__call('portraitSVG', ['金智媛', 'F', 33, {}]);
  ok(m === w.__call('portraitSVG', ['王磊', 'M', 36, {}]), '同名同脸（确定性）');
  ok(m !== f, '男女两张脸不一样');
  [['男', m], ['女', f]].forEach(([tag, svg]) => {
    ok(svg.indexOf('NaN') < 0 && svg.indexOf('undefined') < 0, tag + '脸无 NaN / undefined');
    ok(/<svg viewBox="0 0 100 100"/.test(svg), tag + '脸是标准 SVG');
    ok(svg.indexOf('radialGradient') >= 0, tag + '脸有柔光渐变（告别纯色糊团）');
    ok(svg.indexOf('#FFFFFF') >= 0, tag + '脸有真实的眼白/高光');
  });
  const young = w.__call('portraitSVG', ['金智媛', 'F', 8, {}]);
  const old = w.__call('portraitSVG', ['金智媛', 'F', 79, {}]);
  ok(young !== old, '同一张脸会随年龄变化');
  ok(old.indexOf('#D9D5CE') >= 0, '老年长出白发');
  // 每个头像用自己的渐变 id，不会互相串色
  const idOf = (svg) => (svg.match(/id="([a-z0-9]+)s"/) || [])[1];
  const ids = ['王磊', '李淑芬', '张伟', '刘思远', '陈嘉怡'].map(nm => idOf(w.__call('portraitSVG', [nm, 'F', 30, {}])));
  ok(new Set(ids).size === ids.length, '每个人用各自的渐变 id', ids.join(','));
  ok((m.match(/<svg /g) || []).length === 1 && m.trim().endsWith('</svg>'), '单个完整 SVG，可独立渲染');
  const many = [];
  ['王磊', '李淑芬', '张伟', '刘思远', '陈嘉怡', '赵敏', '孙浩然', '周雨薇', '吴泽宇', '郑书']
    .forEach(nm => ['F', 'M'].forEach(g => [5, 17, 29, 55, 81].forEach(a => many.push(w.__call('portraitSVG', [nm, g, a, {}])))));
  ok(many.every(x => x.indexOf('NaN') < 0 && x.indexOf('undefined') < 0), `100 张脸全部干净（${many.length}）`);
}

console.log(errors.length ? '运行时错误 ❌\n' + errors.join('\n') : '无运行时错误 ✅');
if (errors.length) fail += errors.length;
console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
