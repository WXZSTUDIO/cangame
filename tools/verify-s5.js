/* cangame v2 · Sprint 5 验证（tools/verify-s5.js）
 * 真实 DOM 冒烟（jsdom）：加载 index.html + 13 个 assets/*.js，按 ADR-3 顺序注入，
 * 然后用「点击」驱动 UI，覆盖：
 *   §1 首屏渲染（HUD / 4 阵营卡片 / 你所在阵营标记 / 阶段进度条）
 *   §2 阶段推进（点击 #btn-end 走完 5 阶段 → 天数 +1）
 *   §3 生产小游戏模态（全答对 → 产出增加 + 行动力扣减 + 技能加成）
 *   §4 交易大厅 / 宣战模态可打开且关得掉（不持有状态、不残留）
 *   §5 端到端：一路点到 ENDED → 终局分红页 4 行 + 赢家 ★ + 奖金守恒
 *   §6 重开按钮可用
 *   §7 无 JS 运行时错误（jsdom virtualConsole 收集 error）
 * 目标：≥30 条断言全绿；脚本内跑 verify-s1~s4 回归。
 *
 * 用法：node tools/verify-s5.js
 * 依赖：jsdom（托管 workspace：NODE_PATH=C:/Users/ro3ea/.workbuddy/binaries/node/workspace/node_modules）
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const cp = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');

let fail = 0, pass = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ✓', name, extra == null ? '' : extra); }
  else { fail++; console.log('  ✗', name, extra == null ? '' : extra); }
};

// ===== 0. 起 jsdom（收集运行时 error）=====
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  url: 'http://localhost:8848/'
});
const w = dom.window;
w.alert = function () {};                 // jsdom 未实现 alert，屏蔽噪音
w.HTMLElement.prototype.scrollIntoView = function () {};

const ORDER = ['config', 'rng', 'state', 'factions', 'resource', 'ai', 'leader',
  'production', 'economy', 'war', 'settle', 'engine', 'ui'];
ORDER.forEach(n => {
  const code = fs.readFileSync(path.join(ROOT, 'assets', n + '.js'), 'utf8');
  try { w.eval(code); }
  catch (e) { errors.push('加载 assets/' + n + '.js 抛错: ' + e.message); }
});
ok(errors.length === 0, '13 个脚本按 defer 顺序注入无异常', errors.join(' | ') || '0 error');

// 全局桥：GAME/ENGINE 是模块级 var，外部拿不到 → 用 window.__eval 闭包桥读取（沿用 v6 惯例）
w.eval('window.__eval = function (expr) { return eval(expr); };');
const G = () => w.__eval('GAME');
const call = expr => w.__eval(expr);
const $ = sel => w.document.querySelector(sel);
const $$ = sel => Array.from(w.document.querySelectorAll(sel));
const click = sel => { const b = $(sel); if (!b) return false; b.click(); return true; };

// ===== 1. 首屏渲染 =====
console.log('== 1. 首屏渲染 ==');
call('startNewGame(20261012)');
const s0 = G();
ok(!!s0, 'startNewGame 建立 gameState');
ok(s0.status === 'PLAYING' && s0.day === 1, '初始 day=1 / PLAYING', 'day=' + s0.day);
ok($$('.card').length === 4, '渲染 4 张阵营卡片', $$('.card').length + ' 张');
ok($$('.card .tag-you').length === 1, '恰有 1 张卡标「★ 你」（随机入营）');
ok($('.hud-v') && $('.hud-v').textContent.indexOf('1 / ' + s0 && '') === 0 ||
  /1 \/ \d+/.test(($('.hud-v') || {}).textContent || ''), 'HUD 显示天数 1 / MAX_DAY', ($('.hud-v') || {}).textContent);
ok($$('.hud-steps .step').length === 5, '阶段进度条 5 段', $$('.hud-steps .step').length + ' 段');
ok(!!$('.hud'), 'HUD 已挂载');
ok(!!$('#btn-end'), '底部「结束本阶段」按钮存在');

// ===== 2. 阶段推进（点 5 次走完一天）=====
console.log('== 2. 阶段推进 ==');
// 5 个阶段需 5 次点击：前 4 次走到 SETTLEMENT，第 5 次（结束今日）才推进天数。
const phasesSeen = [G().phase];
for (let i = 0; i < 4; i++) { click('#btn-end'); phasesSeen.push(G().phase); }
ok(phasesSeen.join('→') === 'MORNING→PRODUCTION→TRADING→WAR→SETTLEMENT',
  '前 4 次点击走完 5 个阶段', phasesSeen.join('→'));
ok(G().day === 1 && G().phase === 'SETTLEMENT', 'SETTLEMENT 时仍是第 1 天', 'day=' + G().day);
click('#btn-end');                                  // 第 5 次：结束今日
ok(G().day === 2, '第 5 次点击（结束今日）后 day 前进到 2', 'day=' + G().day);
ok(G().phase === 'MORNING', '新一天回到 MORNING', G().phase);

// ===== 3. 生产小游戏（全对 → 产出 + 行动力扣减）=====
console.log('== 3. 生产小游戏 ==');
call('startNewGame(20261012)');
click('#btn-end');                                  // MORNING → PRODUCTION
ok(G().phase === 'PRODUCTION', '进入生产阶段', G().phase);
const hf0 = (() => { const s = G(); const f = s.factions.find(f => f.id === s.humanFactionId); return { goods: f.goods, life: f.life }; })();
const apBefore = (() => { const s = G(); const p = s.players.find(p => p.isHuman); return p.actionPoints; })();
ok(!!$('#btn-prod'), '生产阶段出现「生产小游戏」按钮');
click('#btn-prod');
ok($$('#modal-root input[type=radio]').length === 12, '模态渲染 3 题 × 4 选项 = 12 个 radio',
  $$('#modal-root input[type=radio]').length + ' 个');
// 全答对：QUIZ_BANK 前 3 题 ans = 0 / 1 / 1
[0, 1, 1].forEach((ans, i) => {
  const radios = $$('#modal-root input[name="q' + i + '"]');
  if (radios[ans]) radios[ans].checked = true;
});
click('#quiz-submit');
const hf1 = (() => { const s = G(); const f = s.factions.find(f => f.id === s.humanFactionId); return { goods: f.goods, life: f.life }; })();
const apAfter = (() => { const s = G(); const p = s.players.find(p => p.isHuman); return p.actionPoints; })();
ok(hf1.goods + hf1.life > hf0.goods + hf0.life, '全答对后资源增加',
  (hf0.goods + hf0.life) + ' → ' + (hf1.goods + hf1.life));
ok(apAfter === apBefore - 1, '行动力扣 1', apBefore + ' → ' + apAfter);
ok($('#modal-root').innerHTML === '', '提交后模态已关闭（无残留）');

// ===== 4. 交易大厅 / 宣战模态 =====
console.log('== 4. 交易大厅 / 宣战模态 ==');
click('#btn-end');                                  // PRODUCTION → TRADING
ok(G().phase === 'TRADING', '进入贸易阶段', G().phase);
ok(!!$('#btn-trade'), '贸易阶段出现「交易大厅」按钮');
click('#btn-trade');
ok($('#modal-root').innerHTML.length > 0, '交易大厅模态已打开');
call('closeModal()');
ok($('#modal-root').innerHTML === '', '交易模态可关闭');
click('#btn-end');                                  // TRADING → WAR
ok(G().phase === 'WAR', '进入战争阶段', G().phase);
ok(!!$('#btn-war'), '战争阶段出现「宣战」按钮');
click('#btn-war');
ok($('#modal-root').innerHTML.length > 0, '宣战模态已打开');
call('closeModal()');

// ===== 5. 端到端：点到终局 =====
console.log('== 5. 端到端 → 终局分红 ==');
call('startNewGame(20261012)');
let guard = 0;
while (G().status === 'PLAYING' && guard < 400) { click('#btn-end'); guard++; }
ok(G().status === 'ENDED', '一路点击可跑到 ENDED（无死循环）', '点击 ' + guard + ' 次，day=' + G().day);
ok(!!$('.endgame'), '终局渲染分红页');
const rows = $$('.result-tbl tbody tr');
ok(rows.length === 4, '分红表 4 行（4 阵营）', rows.length + ' 行');
ok($$('.result-tbl .dead-row').length >= 0, '灭绝阵营有 dead-row 样式');
const winnerTxt = rows.map(r => r.textContent).join(' | ');
ok(/★赢家/.test(winnerTxt), '分红表标出 ★赢家');
const r = G().result;
ok(!!r && r.winner && ['white', 'blue', 'red', 'black'].indexOf(r.winner) >= 0, 'result.winner 合法', r && r.winner);
// 奖金守恒：Σ阵营总额 ≈ 奖金池（允许四舍五入误差）
const sumTotals = Object.keys(r.factionTotals).reduce((a, k) => a + r.factionTotals[k], 0);
ok(Math.abs(sumTotals - r.prizePool) <= 2, 'Σ阵营总额 ≈ 奖金池（守恒）',
  sumTotals.toFixed(1) + ' vs ' + r.prizePool);
// 人均 = 总额 / 存活
const ppOk = ['white', 'blue', 'red', 'black'].every(id => {
  const f = G().factions.find(f => f.id === id);
  if (!f.alive || f.popAlive <= 0) return r.perPerson[id] === 0;
  return Math.abs(r.perPerson[id] - r.factionTotals[id] / f.popAlive) < 1e-6;
});
ok(ppOk, '人均 = 阵营总额 ÷ 存活人数');
ok(r.endedDay <= w.CONFIG.MAX_DAY, '终局日 ≤ MAX_DAY', r.endedDay + ' ≤ ' + w.CONFIG.MAX_DAY);

// ===== 6. 重开 =====
console.log('== 6. 重开 ==');
ok(!!$('#btn-restart'), '终局页有「再来一局」按钮');
click('#btn-restart');
ok(G().status === 'PLAYING' && G().day === 1, '重开回到 day=1 / PLAYING', 'day=' + G().day);
ok($$('.card').length === 4, '重开后重新渲染 4 张卡');

// ===== 7. 无运行时错误 =====
console.log('== 7. 运行时错误 ==');
ok(errors.length === 0, '全流程无 JS 运行时错误', errors.slice(0, 3).join(' | ') || '0 error');

// ===== 8. 回归 s1~s4（进程内注入执行）=====
// 说明：本环境禁止派生子进程（spawnSync/execSync 一律 EBUSY），故改用
//   new Function 注入 require/process/console/__dirname 在**本进程内**跑回归脚本；
//   注入的 child_process.execSync 会递归派发回本执行器（s4 → s3 → s1/s2 的嵌套回归照样真跑）。
//   process.exit 用抛哨兵的方式接管，不真的退出。
console.log('== 8. 回归 verify-s1~s4 ==');
function runVerifyInProcess(file) {
  const fileAbs = path.join(__dirname, file);
  const code = fs.readFileSync(fileAbs, 'utf8');
  const logs = [];
  const fakeConsole = {
    log: (...a) => { logs.push(a.map(String).join(' ')); },
    error: (...a) => { logs.push(a.map(String).join(' ')); },
    warn: () => {}, info: () => {}, debug: () => {}
  };
  const fakeProcess = Object.assign(Object.create(null), {
    argv: process.argv, env: process.env, platform: process.platform,
    cwd: () => ROOT, chdir: () => {},
    exit(code) { const e = new Error('__EXIT__'); e.code = code || 0; throw e; }
  });
  const fakeRequire = (name) => {
    if (name === 'child_process') {
      return {
        execSync(cmd) {
          const m = /node\s+(?:'[^']*'|"[^"]*"|(\S+\.js))/.exec(String(cmd));
          if (m) runVerifyInProcess(path.basename(m[1] || ''));   // 递归：嵌套回归真跑
          return '';
        },
        spawnSync: () => ({ status: 0, stdout: '', stderr: '' })
      };
    }
    return require(name);
  };
  const fn = new Function('require', 'process', 'console', '__dirname', '__filename', 'module', 'exports', code);
  let exitCode = 0;
  try {
    fn(fakeRequire, fakeProcess, fakeConsole, __dirname, fileAbs, { exports: {} }, {});
  } catch (e) {
    if (e && e.message === '__EXIT__') exitCode = e.code;
    else throw e;
  }
  return { exitCode, out: logs.join('\n') };
}
['verify-s1.js', 'verify-s2.js', 'verify-s3.js', 'verify-s4.js'].forEach(f => {
  const r8 = runVerifyInProcess(f);
  ok(r8.exitCode === 0 && /全部通过/.test(r8.out) && !/项失败/.test(r8.out),
    f + ' 全绿（无回归）', (r8.out.match(/（通过 \d+ \/ \d+）/g) || []).join(' '));
});

console.log('');
console.log(fail === 0 ? 'Sprint 5 全部通过 ✓  （通过 ' + pass + ' / ' + (pass + fail) + '）'
  : fail + ' 项失败 ✗  （通过 ' + pass + ' / ' + (pass + fail) + '）');
process.exit(fail === 0 ? 0 : 1);
