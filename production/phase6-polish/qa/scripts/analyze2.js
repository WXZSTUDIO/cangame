/* 分层分析：学历 / 出身 / 出生年代 / 职业 对收入与财富的影响
 * 用法：node analyze2.js -> out/strata.md
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
const all = JSON.parse(fs.readFileSync(path.join(OUT, 'playtest-raw.json'), 'utf8'));
const mob = JSON.parse(fs.readFileSync(path.join(OUT, 'mobility.json'), 'utf8'));
const era = JSON.parse(fs.readFileSync(path.join(OUT, 'era.json'), 'utf8'));
const careers = JSON.parse(fs.readFileSync(path.join(__dirname, 'career-names.json'), 'utf8'));
const RATE = 1 / 180;
const f = v => { const n = (v || 0) * RATE; const s = n < 0 ? '-' : ''; const a = Math.abs(n); if (a >= 1e8) return s + (a / 1e8).toFixed(2) + '亿'; if (a >= 1e4) return s + (a / 1e4).toFixed(1) + '万'; return s + Math.round(a) + '元'; };
const med = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

const L = []; const w = s => L.push(s);
w('# 分层分析：学历 / 出身 / 年代 / 职业 的影响\n');

/* 合并全部画像（除强制职业实验） */
const pool = [].concat(all.steady, all.explorer, all.baseline, all.slacker, all.aggressive, all.reckless);

/* 1 学历 */
w('\n## 1. 学历 → 收入与财富（全画像合并，n=' + pool.length + '）\n');
const UN = { u_985: '985', u_211: '211', u_yiben: '一本', u_erben: '二本', u_zhuanke: '专科', u_fail: '落榜', none: '未参加/无记录' };
w('| 学历 | 人数 | 30岁年收入 | 40岁年收入 | 终局净资产 | 买房率 | 平均寿命 | 平均分 |');
w('|---|---|---|---|---|---|---|---|');
Object.keys(UN).forEach(k => {
  const rs = pool.filter(r => (r.edu.uni || 'none') === k);
  if (rs.length < 8) return;
  w(`| ${UN[k]} | ${rs.length} | ${f(med(rs.map(r => r.incomeAt30).filter(Boolean)))} | ${f(med(rs.map(r => r.salaries[40]).filter(Boolean)))} | ${f(med(rs.map(r => r.finalNet)))} | ${Math.round(rs.filter(r => r.firstHouseAge != null).length / rs.length * 100)}% | ${avg(rs.map(r => r.deathAge)).toFixed(0)} | ${avg(rs.map(r => r.score)).toFixed(1)} |`);
});

/* 2 出身 */
w('\n\n## 2. 出身 → 起点与终局（全画像合并）\n');
w('| 出身 | 人数 | 18岁个人净资产 | 30岁年收入 | 终局净资产 | 买房率 | 平均寿命 |');
w('|---|---|---|---|---|---|---|');
const byFam = {};
pool.forEach(r => { (byFam[r.familyName] || (byFam[r.familyName] = [])).push(r); });
Object.entries(byFam).sort((a, b) => med(b[1].map(x => x.finalNet)) - med(a[1].map(x => x.finalNet)))
  .forEach(([k, rs]) => {
    if (rs.length < 8) return;
    w(`| ${k} | ${rs.length} | ${f(med(rs.map(r => r.netAt18).filter(x => x != null)))} | ${f(med(rs.map(r => r.incomeAt30).filter(Boolean)))} | ${f(med(rs.map(r => r.finalNet)))} | ${Math.round(rs.filter(r => r.firstHouseAge != null).length / rs.length * 100)}% | ${avg(rs.map(r => r.deathAge)).toFixed(0)} |`);
  });

/* 3 年代 */
w('\n\n## 3. 出生年代 × 家庭账簿（稳健流，出身=县城双职工；18 岁时的家庭资产/负债）\n');
w('| 出生年 | 18岁家庭资产 | 18岁家庭负债 | 家庭净值 | 18岁个人净资产 | 30岁年收入 | 终局净资产 |');
w('|---|---|---|---|---|---|---|');
Object.keys(era).forEach(sy => {
  const rs = era[sy];
  const a = med(rs.map(r => r.famAt18 ? r.famAt18.assets : null).filter(x => x != null));
  const d = med(rs.map(r => r.famAt18 ? r.famAt18.debt : null).filter(x => x != null));
  w(`| ${sy} | ${f(a)} | ${f(d)} | ${f(a - d)} | ${f(med(rs.map(r => r.netAt18).filter(x => x != null)))} | ${f(med(rs.map(r => r.incomeAt30).filter(Boolean)))} | ${f(med(rs.map(r => r.finalNet)))} |`);
});

/* 4 职业天花板 */
w('\n\n## 4. 职业天花板（强制入职实验；终局净资产按升序）\n');
w('| 职业 | 入职年薪 | 40岁年薪 | 终局净资产 | 与骑手之比 | 买房率 | 首套年龄 |');
w('|---|---|---|---|---|---|---|');
const rows = Object.keys(mob).map(cid => {
  const rs = mob[cid];
  return { cid, name: (careers[cid] || {}).name || cid, sal0: (careers[cid] || {}).sal0 || 0,
    inc40: med(rs.map(r => r.salaries[40]).filter(Boolean)),
    net: med(rs.map(r => r.finalNet)),
    house: Math.round(rs.filter(r => r.firstHouseAge != null).length / rs.length * 100),
    age: med(rs.map(r => r.firstHouseAge).filter(x => x != null)) };
}).sort((a, b) => a.net - b.net);
const base = rows[0].net || 1;
rows.forEach(r => w(`| ${r.name} | ${f(r.sal0)} | ${f(r.inc40)} | ${f(r.net)} | ${(r.net / base).toFixed(0)}× | ${r.house}% | ${r.age || '—'} |`));

/* 5 努力的边际收益 */
w('\n\n## 5. 「努力」的边际收益：刷题投入 vs 高考去向 vs 收入\n');
const st = pool.filter(r => r.edu.gao != null);
w(`有效样本（有高考成绩）：${st.length}\n`);
w('\n| 学习投入(study) 分档 | 人数 | 高考分数中位 | 30岁年收入 | 终局净资产 |');
w('|---|---|---|---|---|');
[['0-20', 0, 20], ['21-40', 21, 40], ['41-60', 41, 60], ['61-80', 61, 80], ['81-100', 81, 100]].forEach(b => {
  const rs = pool.filter(r => (r.edu.study || 0) >= b[1] && (r.edu.study || 0) <= b[2]);
  if (rs.length < 8) return;
  w(`| ${b[0]} | ${rs.length} | ${med(rs.map(r => r.edu.gao).filter(Boolean)) || '—'} | ${f(med(rs.map(r => r.incomeAt30).filter(Boolean)))} | ${f(med(rs.map(r => r.finalNet)))} |`);
});

/* 6 财富集中度 */
w('\n\n## 6. 财富集中度（稳健流 200 局）\n');
const nets = all.steady.map(r => r.finalNet).sort((a, b) => a - b);
const tot = nets.reduce((a, b) => a + b, 0);
const top10 = nets.slice(-20).reduce((a, b) => a + b, 0);
w(`- 中位 ${f(nets[100])}，p10 ${f(nets[20])}，p90 ${f(nets[180])}，最高 ${f(nets[199])}`);
w(`- 前 10%（20 局）占有总财富：${(top10 / tot * 100).toFixed(0)}%`);
w(`- 最高 / 中位 = ${(nets[199] / nets[100]).toFixed(0)}×`);

/* 7 评分区分度 */
w('\n\n## 7. 评分区分度\n');
w('| 画像 | 平均分 | 最低 | 最高 | 标准差 | S 级占比 | 分数 ≥90 占比 |');
w('|---|---|---|---|---|---|---|');
Object.keys(all).forEach(k => {
  const sc = all[k].map(r => r.score);
  const m = avg(sc);
  const sd = Math.sqrt(avg(sc.map(x => (x - m) * (x - m))));
  w(`| ${k} | ${m.toFixed(1)} | ${Math.min.apply(null, sc)} | ${Math.max.apply(null, sc)} | ${sd.toFixed(1)} | ${Math.round(sc.filter(x => x >= 90).length / sc.length * 100)}% | ${Math.round(sc.filter(x => x >= 90).length / sc.length * 100)}% |`);
});

fs.writeFileSync(path.join(OUT, 'strata.md'), L.join('\n'), 'utf8');
console.log('written strata.md', L.length, 'lines');
