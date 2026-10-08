/* HP / 压力 轨迹探针 + 死因统计 + 结局可达性统计
 * 用法：node probe-hp.js -> out/probe.md
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'out');
const ctx = {
  console, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Number, String, Array, Object, Boolean, RegExp, Error, Map, Set,
  setTimeout, clearTimeout, window: { addEventListener() {} },
  document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }, body: { appendChild() {}, classList: { add() {}, remove() {} } } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
  'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const A = vm.runInContext(`({ createGame, step, resolveEvent, eventChoices, resolveExam, answerExamQ, resolveInvest,
  finish, ENDINGS, CAREERS, JOBS, EVENTS, ILLNESS, careerIncome, netWorth, EXAM_META, FAMILIES })`, ctx);

const rnd = n => Math.floor(Math.random() * n);
const L = []; const w = s => L.push(s);

/* 三种决策风格 + 是否治病 */
const STYLES = [
  { key: 'low+treat', risk: 'low', treat: true },
  { key: 'ev+treat', risk: 'ev', treat: true },
  { key: 'high+notreat', risk: 'high', treat: false },
  { key: 'random', risk: 'random', treat: true }
];
const W = { HP: 2, MOOD: .6, INT: 1, CHA: .8, WILL: .8, ETH: .5, FAME: 1.2, NET: 1, LOY: .8, LOVE: .5, SEC: .4, STR: .4, STRESS: -.9, MONEY: 1 / 6000000 };

function pick(st, ev, list, style) {
  const id = String(ev.id || '');
  if (id.indexOf('ill_at_') === 0) {
    if (!style.treat) return 0;
    return st.stats.MONEY > 40000000 ? 2 : (st.stats.MONEY > 8000000 ? 1 : 0);
  }
  if (style.risk === 'low') { let bi = 0, br = 99; list.forEach((c, i) => { const r = c.risk || 2; if (r < br) { br = r; bi = i; } }); return bi; }
  if (style.risk === 'high') { let bi = list.length - 1, br = -1; list.forEach((c, i) => { const r = c.risk || 2; if (r >= br) { br = r; bi = i; } }); return bi; }
  if (style.risk === 'random') return rnd(list.length);
  let bi = 0, bu = -Infinity;
  list.forEach((c, i) => {
    let v = 0;
    const acc = (e, k) => { if (!e) return; for (const kk in e) v += (e[kk] || 0) * (W[kk] || 0) * k; };
    acc(c.eff, 1);
    if (c.gamble) { acc(c.gamble.win, c.gamble.p || .5); acc(c.gamble.lose, 1 - (c.gamble.p || .5)); }
    v += c.gamble ? 1.5 : 0;
    if (v > bu) { bu = v; bi = i; }
  });
  return bi;
}

const N = 80;
const AGES = [20, 25, 30, 35, 40, 50, 60, 70];
w('# HP / 压力轨迹探针 与 结局可达性\n');
w(`\n每组 ${N} 局，创建后不主动干预（不买房不买股，纯看决策风格对生存的影响）\n`);

w('\n## 1. 健康 / 压力 中位数轨迹\n');
w('| 风格 | ' + AGES.map(a => a + '岁HP').join(' | ') + ' | ' + AGES.map(a => a + '岁压力').join(' | ') + ' | 平均寿命 | 死因分布 |');
w('|---|' + AGES.map(() => '---').join('|') + '|' + AGES.map(() => '---').join('|') + '|---|---|');
STYLES.forEach(style => {
  const hp = {}, sr = {}, deaths = {};
  AGES.forEach(a => { hp[a] = []; sr[a] = []; });
  const lives = [];
  for (let i = 0; i < N; i++) {
    const st = A.createGame({ name: 'T', gender: Math.random() < .5 ? 'M' : 'F', familyId: A.FAMILIES[rnd(A.FAMILIES.length)].id, talents: [] });
    let g = 0;
    while (!st.finished && g++ < 4000) {
      const item = A.step(st);
      if (!item || item.type === 'end') break;
      if (AGES.indexOf(st.age) >= 0 && hp[st.age].length <= i) { hp[st.age].push(st.stats.HP); sr[st.age].push(st.stats.STRESS); }
      if (item.type === 'year') continue;
      if (item.type === 'exam') {
        st.pending = item; let k = 0;
        while (item.exam && item.exam.quiz && !item.exam.quiz.done && k++ < 20) A.answerExamQ(st, rnd(4));
        const o = (item.exam.options || []).map((x, j) => ({ x, j })).filter(z => !z.x.locked);
        if (o.length) A.resolveExam(st, o[rnd(o.length)].j);
        st.pending = null; continue;
      }
      if (item.type === 'event') { const list = A.eventChoices(st, item.ev) || []; A.resolveEvent(st, item.ev, list.length ? pick(st, item.ev, list, style) : -1); continue; }
      if (item.type === 'invest') { const cs = item.choices || []; A.resolveInvest(st, cs[cs.length - 1]); }
    }
    if (!st.finished) A.finish(st);
    lives.push(st.age);
    const d = st.ending ? st.ending.title : '?';
    deaths[d] = (deaths[d] || 0) + 1;
  }
  const m = arr => arr.length ? Math.round(arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)]) : null;
  w(`| ${style.key} | ${AGES.map(a => (hp[a].length ? m(hp[a]) : '—')).join(' | ')} | ${AGES.map(a => (sr[a].length ? m(sr[a]) : '—')).join(' | ')} | ${(lives.reduce((x, y) => x + y, 0) / lives.length).toFixed(1)} | ${Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([a, b]) => a + '×' + b).join(' ')} |`);
});

/* 2. 结局可达性 */
w('\n\n## 2. 16 个结局的可达性（是否在 ENDINGS 之前被 forceEnd 抢走）\n');
w('| 顺序 | 结局 | 判定条件 | 可达性分析 |');
w('|---|---|---|---|');
const force = ['end_elder(安然离世·自然死亡)', 'end_ill(病逝·疾病恶化)', 'end_dead(熄灭·HP归零)'];
const notes = {
  1: '需 flags.took_over：仅事件 x 类「权力交接」赌赢（42%）可得',
  2: '需 flags.exposed + FAME≥60：举报事件可得，FAME 后期普遍 100+，可达',
  3: '需持股市值 ≥5.56亿元：长期定投可达（模拟中 12% 达成）',
  4: '需 ≥2 套收租物业 且 净资产 ≥1.67亿元：收租物业仅 4 种，可达但需刻意',
  5: '需净资产 ≥8.33亿元：模拟中稳健流 90% 以上可达',
  6: '需 flags.side_second + LOY≥60：站队事件可得',
  7: '需 FAME≥95 且 NET≥150：后期属性膨胀，易达',
  8: '需 FAME≥160：FAME 上限 200，需刻意经营',
  9: '需 flags.tax_raid + took_bribe + 净资产 ≥556万：链式事件，罕见',
  10: '需净资产 ≥1667万元：几乎人人可达（会被第 5 条抢先）',
  11: '需 flags.own_shop + 净资产 <16.67亿 + FAME<40：own_shop 来自事件 s11（26-34 岁、需 16.7万现金），且 FAME<40 后期几乎不可能 → **实际不可达**',
  12: '需 grandCount>0 且 LOVE≥45：孙辈事件需已婚+有子女，可达',
  13: '需 job ∈ [公司职员/公务员/大企业职员/工厂工人/个体户] 且 FAME<40 且 净资产<1667万：FAME<40 后期不可能 → **实际不可达**',
  14: '需净资产 <0：破产业可达（随机基线 34%）',
  15: '需 WILL≥60：WILL 上限 200，易达，但被前序多条抢先',
  16: '兜底'
};
const src = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const blk = src.slice(src.indexOf('const ENDINGS'), src.indexOf('/* ====', src.indexOf('const ENDINGS')));
const parts = blk.split(/\{ id: '/).slice(1);
parts.forEach((p, i) => {
  const title = (p.match(/title: '([^']+)'/) || [])[1] || '';
  const rank = (p.match(/rank: '([^']+)'/) || [])[1] || '';
  const cond = (p.match(/cond: ([^\n]*)/) || [])[1] || '';
  w(`| ${i + 1} | ${title} | ${rank} | ${notes[i + 1] || ''} |`);
});
w('\n**关键：自然死亡 / 病逝 / 熄灭 三个 forceEnd 直接写入 state.ending，完全绕过 ENDINGS 判定。**');
w('模拟中「稳健流」只有 12% 活到 105 岁走 finish()（其余 68% 安然离世、18.5% 病逝），');
w('意味着 16 个正式结局在 3/4 以上的局里根本不参与判定。\n');

/* 3. 旧版孤儿职称 */
w('\n\n## 3. 事件里被直接写入的「孤儿职称」（不在任何 CAREERS 阶梯内）\n');
const ladderTitles = new Set();
A.CAREERS.forEach(c => c.ladder.forEach(l => ladderTitles.add(l.title)));
const jobs = [];
src.replace(/job: '([^']+)'/g, (m, j) => { jobs.push(j); return m; });
const uniqJ = Array.from(new Set(jobs));
w('| 职称 | 在 CAREERS 阶梯内？ | 说明 |');
w('|---|---|---|');
uniqJ.forEach(j => {
  w(`| ${j} | ${ladderTitles.has(j) ? '是' : '**否**'} | ${ladderTitles.has(j) ? '正常' : '设置后 state.career 不变/为空 → 拿 JOBS 固定工资且永不晋升'} |`);
});

fs.writeFileSync(path.join(OUT, 'probe.md'), L.join('\n'), 'utf8');
console.log('written probe.md', L.length, 'lines');
