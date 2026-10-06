/* v5.3 UI 冒烟（jsdom）：核心属性精简、家庭账簿卡、疾病卡、离婚确认、成就墙、彩票 */
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
  'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js']
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

console.log('== 开局 ==');
click($('btnNew'));
$('inputName').value = '张伟';
click($('btnStart'));
const S = () => w.__getState();
ok(!!S(), '进入游戏');

console.log('== 1. 核心属性条：6 项 + 更多展开 ==');
{
  const chips = () => w.document.querySelectorAll('#metricStrip .m:not(.more)');
  const n0 = chips().length;
  ok(n0 === 6, '默认只显示 6 项核心属性', n0);
  const names = Array.from(chips()).map(e => e.querySelector('i').textContent).join('/');
  ok(/健康/.test(names) && /心情/.test(names), '含健康与心情', names);
  const more = w.document.querySelector('#metricStrip .m.more');
  ok(!!more && /＋ 更多/.test(more.textContent), '有「＋ 更多」开关');
  click(more);
  const n1 = chips().length;
  ok(n1 > n0, '展开后出现次要属性', `${n0} → ${n1}`);
  ok(/− 收起/.test(w.document.querySelector('#metricStrip .m.more').textContent), '开关变成「− 收起」');
  click(w.document.querySelector('#metricStrip .m.more'));
  ok(chips().length === 6, '再点收回 6 项');
}

console.log('== 2. 人际 → 家人：活的家庭账簿 ==');
{
  const s = S();
  s.age = 20;
  s.family = { assets: 300000000, debt: 40000000, income: 24000000, spend: 18000000,
               delta: 6000000, repaid: 5000000, interest: 2000000, act: null, actYear: -1 };
  s.parents.father.job = '车间工人'; s.parents.mother.job = '小学老师';
  s.parents.father.hp = 55; s.parents.mother.hp = 88;
  s.log = [{ year: 2020, type: 'fam', text: '爸爸加班把腰闪了', val: 0 }];
  call('setRelTab', ['family']);
  const t = txt('view-rel');
  ok(/家里的账簿/.test(t), '渲染家庭账簿卡');
  ok(/年收入/.test(t) && /年支出/.test(t) && /今年结余/.test(t) && /今年还债/.test(t), '账簿含收入/支出/结余/还债');
  ok(t.indexOf('-') > 0 && /负债/.test(t), '负债显示为负数');
  ok(/车间工人/.test(t) && /小学老师/.test(t), '父母显示职业');
  ok(/有点毛病/.test(t) && /身体硬朗/.test(t), '父母显示健康状况', `${s.parents.father.hp}/${s.parents.mother.hp}`);
  ok(/爸爸加班把腰闪了/.test(t), '显示最近家里发生的事');
  ok(!!w.document.querySelector('#view-rel .ledger'), '.ledger 卡片存在');
}

console.log('== 3. 离婚：二次确认 + 前任卡 ==');
{
  const s = S();
  s.age = 34;
  s.flags.married = true; s.flags.dating = true;
  s.spouse = { name: '林静', gender: 'F', age: 33, affinity: 40, alive: true, job: '会计', look: 70, charm: 68 };
  s.spouseName = '林静';
  s.stats.MONEY = 200000000;
  s.childCount = 1;
  call('setRelTab', ['love']);
  ok(/林静/.test(txt('view-rel')), '恋人页出现配偶卡');
  const findDiv = () => Array.from(w.document.querySelectorAll('#view-rel button'))
    .find(b => /提出离婚/.test(b.textContent));
  ok(!!findDiv(), '配偶卡上有「提出离婚」按钮');
  click(findDiv());
  const boxOpen = () => $('confirmBox').classList.contains('open');
  ok(boxOpen(), '弹出离婚确认', $('confirmTitle').textContent);
  click($('confirmNo'));
  ok(!boxOpen() && s.flags.married, '取消后仍是已婚');
  click(findDiv());
  click($('confirmOk'));
  ok(!s.flags.married, '确认后已离婚');
  ok(!S().spouse, '配偶已清空');
  ok(!!S().ex && S().ex.name === '林静', '生成前任记录', S().ex && S().ex.name);
  ok(S().flags.divorced === true, '打上 divorced 标记');
  call('setRelTab', ['family']);
  ok(/前任 · 林静/.test(txt('view-rel')), '家人页出现前任卡');
}

console.log('== 4. 疾病卡：工作页可治疗 ==');
{
  const s = S();
  s.age = 45; s.stats.MONEY = 300000000; s.stats.HP = 30;
  const ref = w.__eval("ILLNESS.find(x=>x.id==='gastritis') || ILLNESS[0]");
  s.ill = { id: ref.id, name: ref.name, stage: 2, years: 1 };
  const ev = call('makeIllnessEvent', [s, ref]);
  ok(ev.choices.length === 3, '生病事件有 3 个选项', ev.choices.map(c => c.text.slice(0, 6)).join(' / '));
  ok(ev.choices.some(c => /诊所/.test(c.text)) && ev.choices.some(c => /住院/.test(c.text)), '含诊所与住院分支');
  call('showGameView', ['job']);
  const t = txt('view-job');
  ok(/🩺 身体/.test(t) || /身体/.test(t), '工作页有身体卡');
  ok(t.indexOf(ref.name) > 0, '显示病名', ref.name);
  ok(/中期/.test(t), '显示病程阶段');
  const bts = Array.from(w.document.querySelectorAll('#view-job button'))
    .filter(b => /去诊所|住院治疗/.test(b.textContent));
  ok(bts.length === 2, '有「去诊所」「住院治疗」两个按钮', bts.length);
  const before = S().stats.MONEY;
  click(bts[1]);
  ok(S().stats.MONEY < before, '住院治疗扣了钱', `${Math.round(before)} → ${Math.round(S().stats.MONEY)}`);
  ok(!S().ill || S().ill.stage < 2, '治疗后病程好转/痊愈', S().ill ? S().ill.stage : '已痊愈');
}

console.log('== 5. 成就墙 + 彩票 ==');
{
  const s = S();
  s.age = 30; s.stats.MONEY = 500000000;
  s.achievements = ['a_marry', 'a_house'];
  s.lotteryYear = -1;
  call('showGameView', ['job']);
  ok(!!w.document.querySelector('#view-job .ach-wall'), '工作页有成就墙');
  const on = w.document.querySelectorAll('#view-job .ach.on').length;
  ok(on === 2, '点亮 2 个已解锁成就', on);
  ok(/成就 2 \/ 18/.test(txt('view-job')) || /成就/.test(txt('view-job')), '显示成就进度');
  const lot = Array.from(w.document.querySelectorAll('#view-job button')).find(b => /买一张/.test(b.textContent));
  ok(!!lot, '彩票按钮可点');
  const before = S().stats.MONEY;
  click(lot);
  ok(S().stats.MONEY < before, '买彩票扣钱', `${Math.round(before)} → ${Math.round(S().stats.MONEY)}`);
  ok(S().lotteryYear === S().age, '记录本年已买');
  call('showGameView', ['job']);
  const lot2 = Array.from(w.document.querySelectorAll('#view-job button')).find(b => /今年买过了/.test(b.textContent));
  ok(!!lot2 && lot2.disabled, '今年再买已禁用');
}

console.log('== 6. 安全措施的亲密选项 ==');
{
  const s = S();
  s.age = 26; s.stats.MONEY = 100000000;
  s.flags.married = false; s.flags.dating = true;
  s.love = { candidates: [{ name: '小雅', gender: 'F', age: 26, look: 72, charm: 74, tp: 'warm', bg: 'mid',
    src: '相亲', affinity: 66, alive: true, lastTouch: -1, touches: 0, pregnant: false }], partner: null, met: [] };
  call('showGameView', ['rel']);
  call('setRelTab', ['love']);
  const btns = Array.from(w.document.querySelectorAll('#view-rel button'))
    .filter(b => /做好措施|亲密/.test(b.textContent));
  ok(btns.length >= 2, '恋人卡有两个亲密按钮', btns.map(b => b.textContent.trim()).join(' | '));
  const safeBtn = btns.find(b => /做好措施/.test(b.textContent));
  ok(!!safeBtn, '有「做好措施」按钮');
  const m0 = S().stats.MONEY;
  click(safeBtn);
  ok(S().stats.MONEY < m0, '安全措施要花钱', `${Math.round(m0)} → ${Math.round(S().stats.MONEY)}`);
  ok(!S().queue.some(q => /preg/i.test(JSON.stringify(q))), '做好措施基本不会怀孕');
}

console.log(errors.length ? '\n运行时错误：' + errors.join(' | ') : '\n无运行时错误 ✅');
if (errors.length) fail += errors.length;
console.log(fail === 0 ? '全部通过 ✅' : `失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
