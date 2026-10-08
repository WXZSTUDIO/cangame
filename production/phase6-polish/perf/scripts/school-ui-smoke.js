/* 冒烟：确认 E-13「起薪系数」tag 在高考放榜时能渲染出来，且不抛错
 * 注意：顶层 const（SCORE_K / UNIVERSITIES / KAOYAN_FLOOR）进入的是
 * **全局词法环境**而不是 window 对象 —— 后续脚本能直接引用，但 window.X 拿不到。
 * 所以这里用 w.eval() 取，不要用 w.X。 */
const H = require('./harness.js');
const fs = require('fs'), path = require('path');
const { window: w } = H.loadJSDOM();
const out=[]; const say=s=>{out.push(s);console.log(s);};
let fail=0;
const ok=(c,n,e)=>{ if(c) say('  ✓ '+n+(e==null?'':' '+e)); else { say('  ✗ '+n+(e==null?'':' '+e)); fail++; } };
const ev = expr => w.eval(expr);

say('# E-13 起薪系数 tag 冒烟');
say('');
ok(typeof w.salaryKFor === 'function', 'salaryKFor 在 UI 上下文可用');
ok(typeof w.uniNeed === 'function', 'uniNeed 在 UI 上下文可用');
ok(ev('typeof SCORE_K') === 'object' && ev('SCORE_K.max') === 0.10,
   'SCORE_K 在 UI 上下文可见（全局词法环境）', 'max=' + ev('SCORE_K.max'));
ok(ev('typeof KAOYAN_FLOOR') === 'number' && ev('KAOYAN_FLOOR') === 1.45,
   'KAOYAN_FLOOR 在 UI 上下文可见', ev('KAOYAN_FLOOR'));

const k476 = ev('salaryKFor(UNIVERSITIES.find(u=>u.id==="u_yiben"), 476)');
const k475 = ev('salaryKFor(UNIVERSITIES.find(u=>u.id==="u_erben"), 475)');
const kFail = ev('salaryKFor(UNIVERSITIES.find(u=>u.id==="u_fail"), 700)');
say('  一本@476 = ' + k476.toFixed(4) + ' ；二本@475(封顶) = ' + k475.toFixed(4) +
    ' ；落榜档@700 = ' + kFail.toFixed(4));
ok(k476 > k475, 'UI 展示值满足 D-1 单调性（476 > 475）');
ok(Math.abs(kFail - 0.8) < 1e-9, 'E-12 生效：落榜档恒为 0.80（UI 侧也拿不到 0.880）', kFail.toFixed(4));

/* 真正渲染一次高考放榜卡片。
 * 两个坑：① ui.js 的 STATE 是顶层 `let`，只能用 w.eval 赋值，w.STATE = x 改不到；
 *        ② makeExamEvent 返回的是 { type, exam }，考试对象在 .exam 里，不是 .ev。 */
try {
  w.eval('STATE = createGame({name:"T",gender:"M",familyId:"chengzhongcun",priority:"balance",talents:[]});');
  w.eval('STATE.age = 18; STATE.edu = STATE.edu || {}; STATE.edu.hs = "hs_key"; STATE.edu.uni = null;');
  w.eval('STATE.queue = STATE.queue || []; STATE.queue.unshift(makeExamEvent(STATE));');
  w.eval('STATE.pending = STATE.queue[0];');   // answerExamQ 读的是 state.pending，不是 queue[0]
  ok(w.eval('STATE.queue[0].type') === 'exam', '高考事件入队', w.eval('STATE.queue[0].type'));
  /* 五道常识题全部作答 → 触发放榜（options 回填） */
  for (let i = 0; i < 7; i++) {
    const done = w.eval('(STATE.queue[0] && STATE.queue[0].type==="exam" && STATE.queue[0].exam.quiz) ? STATE.queue[0].exam.quiz.done : true');
    if (done) break;
    w.eval('answerExamQ(STATE, 0)');   // 签名是 (state, optIdx)
  }
  const n = w.eval('(STATE.queue[0] && STATE.queue[0].exam.options) ? STATE.queue[0].exam.options.length : 0');
  ok(n === 6, '放榜后 options 已回填', n + ' 条');
  w.eval('renderItem(STATE.queue[0])');   // 渲染入口是 renderItem(item)，不是 renderGame
  const html = w.document.getElementById('actions').innerHTML;
  const m = html.match(/起薪 ×[\d.]+/g);
  ok(!!m, '放榜卡片渲染出「起薪 ×」tag');
  say('  渲染出的 tag：' + (m ? m.join(' / ') : '（无）'));
  ok(!!m && m.length === 6, '六档全部显示起薪系数', m ? m.length + ' 档' : '0 档');
  ok(html.indexOf('×0.800') >= 0, '落榜档显示 ×0.800（未被连续化抬高成 0.880）');
} catch (e) {
  ok(false, '高考放榜渲染无异常', e.message);
}

say('');
say(fail===0 ? '冒烟通过 ✅' : '冒烟失败 '+fail+' 项 ❌');
fs.writeFileSync(path.join(__dirname,'school-ui-smoke.out.txt'), out.join('\n')+'\n','utf8');
process.exit(fail?1:0);
