/* 读取 out/*.json，产出 out/summary.md（UTF-8） */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
const all = JSON.parse(fs.readFileSync(path.join(OUT, 'playtest-raw.json'), 'utf8'));
const tally = JSON.parse(fs.readFileSync(path.join(OUT, 'event-tally.json'), 'utf8'));
const mob = JSON.parse(fs.readFileSync(path.join(OUT, 'mobility.json'), 'utf8'));
const era = JSON.parse(fs.readFileSync(path.join(OUT, 'era.json'), 'utf8'));
const RATE = 1 / 180;
const cny = v => (v || 0) * RATE;

function fmt(v) {
  const n = cny(v); const s = n < 0 ? '-' : ''; const a = Math.abs(n);
  if (a >= 1e8) return s + (a / 1e8).toFixed(2) + '亿';
  if (a >= 1e4) return s + (a / 1e4).toFixed(1) + '万';
  return s + Math.round(a) + '元';
}
const med = arr => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const pct = (arr, p) => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };

const L = []; const w = s => L.push(s);
const KEYS = Object.keys(all);
const CN = { steady: '稳健流', aggressive: '激进流', reckless: '亡命流', slacker: '摆烂流', explorer: '探索流', baseline: '随机基线' };

w('# Playtest 原始数据汇总（自动生成 · QA-01）\n');
w('每组局数：' + all[KEYS[0]].length + '；金额已换算为人民币元（引擎内部单位 ÷180）\n');

/* 1 */
w('\n## 1. 结局分布与评分\n');
w('| 画像 | 局数 | 平均分 | 评级 S/A/B/C/D | 中位净资产 | p10 | p90 | 最高 | 负资产率 | 平均寿命 |');
w('|---|---|---|---|---|---|---|---|---|---|');
KEYS.forEach(k => {
  const rs = all[k];
  const rank = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  rs.forEach(r => { rank[r.rank] = (rank[r.rank] || 0) + 1; });
  const nets = rs.map(r => r.finalNet);
  w(`| ${CN[k]} | ${rs.length} | ${avg(rs.map(r => r.score)).toFixed(1)} | ${rank.S}/${rank.A}/${rank.B}/${rank.C}/${rank.D} | ${fmt(med(nets))} | ${fmt(pct(nets, 0.1))} | ${fmt(pct(nets, 0.9))} | ${fmt(Math.max.apply(null, nets))} | ${(rs.filter(r => r.finalNet < 0).length / rs.length * 100).toFixed(0)}% | ${avg(rs.map(r => r.deathAge)).toFixed(1)} |`);
});
KEYS.forEach(k => {
  const t = {}; all[k].forEach(r => { t[r.end.title] = (t[r.end.title] || 0) + 1; });
  w(`\n- **${CN[k]}**：` + Object.entries(t).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ×${b}`).join(' · '));
});

/* 2 */
w('\n\n## 2. 净资产曲线（中位数）\n');
const AGES = [18, 25, 30, 35, 40, 45, 50, 60, 70, 80];
w('| 画像 | ' + AGES.map(a => a + '岁').join(' | ') + ' | 终局 | 峰值中位 |');
w('|---|' + AGES.map(() => '---').join('|') + '|---|---|');
KEYS.forEach(k => {
  const row = AGES.map(a => {
    const v = all[k].map(r => r.netSeries[a]).filter(x => x != null);
    return v.length ? fmt(med(v)) : '—';
  });
  w(`| ${CN[k]} | ${row.join(' | ')} | ${fmt(med(all[k].map(r => r.finalNet)))} | ${fmt(med(all[k].map(r => r.peakNet)))} |`);
});

/* 3 */
w('\n\n## 3. 关键人生节点\n');
const HS = { hs_key: '市重点', hs_ord: '普高', hs_art: '艺校', hs_vo: '职高', hs_none: '辍学' };
const UN = { u_985: '985', u_211: '211', u_yiben: '一本', u_erben: '二本', u_zhuanke: '专科', u_fail: '落榜' };
w('| 画像 | 中考去向 | 高考去向 | 30岁职业(众数) | 30岁年收入中位 | 30岁生活支出 | 结婚率 | 有娃率 | 首次买房年龄 | 买房率 | 首次买股年龄 | 终局持股率 |');
w('|---|---|---|---|---|---|---|---|---|---|---|---|');
KEYS.forEach(k => {
  const rs = all[k];
  const dist = (map, src) => {
    const t = {}; rs.forEach(r => { const v = r.edu[src] || 'none'; const n = map[v] || v; t[n] = (t[n] || 0) + 1; });
    return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a}${Math.round(b / rs.length * 100)}%`).join(' ');
  };
  const jt = {}; rs.map(r => r.jobs[30]).filter(Boolean).forEach(j => { jt[j] = (jt[j] || 0) + 1; });
  const topJob = Object.entries(jt).sort((a, b) => b[1] - a[1])[0] || ['—'];
  const inc = med(rs.map(r => r.incomeAt30).filter(Boolean));
  const cost = med(rs.map(r => r.costAt30).filter(Boolean));
  w(`| ${CN[k]} | ${dist(HS, 'hs')} | ${dist(UN, 'uni')} | ${topJob[0]} | ${fmt(inc)} | ${fmt(cost)} | ${Math.round(rs.filter(r => r.married).length / rs.length * 100)}% | ${Math.round(rs.filter(r => r.childCount > 0).length / rs.length * 100)}% | ${med(rs.map(r => r.firstHouseAge).filter(x => x != null)) || '—'} | ${Math.round(rs.filter(r => r.firstHouseAge != null).length / rs.length * 100)}% | ${med(rs.map(r => r.firstStockAge).filter(x => x != null)) || '—'} | ${Math.round(rs.filter(r => r.stockValue > 0).length / rs.length * 100)}% |`);
});

/* 4 */
w('\n\n## 4. 空转率与内容消耗\n');
w('| 画像 | 平均寿命 | 总年数 | 空转年数 | 空转率 | 人均事件数 | 人均去重事件 | 事件重复率 | 人均选项数/年 |');
w('|---|---|---|---|---|---|---|---|---|');
KEYS.forEach(k => {
  const rs = all[k];
  const idle = avg(rs.map(r => r.idleYears)), tot = avg(rs.map(r => r.totalYears));
  const ev = avg(rs.map(r => r.totalEvents)), uq = avg(rs.map(r => r.uniqEvents));
  const perYear = avg(rs.map(r => r.totalEvents / Math.max(1, r.totalYears)));
  w(`| ${CN[k]} | ${avg(rs.map(r => r.deathAge)).toFixed(1)} | ${tot.toFixed(1)} | ${idle.toFixed(1)} | ${(idle / Math.max(1, tot) * 100).toFixed(1)}% | ${ev.toFixed(1)} | ${uq.toFixed(1)} | ${(100 - uq / Math.max(1, ev) * 100).toFixed(1)}% | ${perYear.toFixed(2)} |`);
});

/* 5 */
w('\n\n## 5. 各年龄段空转率（该年无任何考试/事件/投资机会）\n');
const BANDS = [[0, 12], [13, 18], [19, 25], [26, 35], [36, 50], [51, 65], [66, 100]];
w('| 画像 | ' + BANDS.map(b => b[0] + '-' + b[1] + '岁').join(' | ') + ' |');
w('|---|' + BANDS.map(() => '---').join('|') + '|');
KEYS.forEach(k => {
  const row = BANDS.map(b => {
    let idle = 0, tot = 0;
    all[k].forEach(r => { for (let a = b[0]; a <= b[1]; a++) { if (r.choicesPerYear[a] === undefined) continue; tot++; if (r.choicesPerYear[a] === 0) idle++; } });
    return tot ? Math.round(idle / tot * 100) + '%' : '—';
  });
  w(`| ${CN[k]} | ${row.join(' | ')} |`);
});

/* 6 */
w('\n\n## 6. 现金流归因（人均累计）\n');
w('| 画像 | 工资结余 | 事件/选择 | 资产持有净额(分红+租金-维护-利息) | 买卖净现金流 | 贷款净额 | 医疗 | 彩票 |');
w('|---|---|---|---|---|---|---|---|');
KEYS.forEach(k => {
  const rs = all[k], n = rs.length;
  const b = {};
  rs.forEach(r => { for (const kk in r.buckets) b[kk] = (b[kk] || 0) + r.buckets[kk]; });
  w(`| ${CN[k]} | ${fmt((b.salary || 0) / n)} | ${fmt((b.event || 0) / n)} | ${fmt((b.carry || 0) / n)} | ${fmt((b.trade || 0) / n)} | ${fmt((b.loan || 0) / n)} | ${fmt((b.medical || 0) / n)} | ${fmt((b.lottery || 0) / n)} |`);
});

/* 7 */
w('\n\n## 7. 买房可负担性（30 岁截面）\n');
w('| 画像 | 30岁年收入 | 30岁「市区老破小」总价 | 房价/收入比 | 30岁生活支出 | 年结余 | 攒够 50% 首付所需年数 | 实际首套年龄 | 买房率 |');
w('|---|---|---|---|---|---|---|---|---|');
KEYS.forEach(k => {
  const rs = all[k];
  const inc = med(rs.map(r => r.incomeAt30).filter(Boolean));
  const hp = med(rs.map(r => r.housePriceAt30).filter(Boolean));
  const cost = med(rs.map(r => r.costAt30).filter(Boolean));
  const save = inc - cost;
  w(`| ${CN[k]} | ${fmt(inc)} | ${fmt(hp)} | ${inc ? (hp / inc).toFixed(1) : '—'}× | ${fmt(cost)} | ${fmt(save)} | ${save > 0 ? ((hp * 0.5) / save).toFixed(1) + ' 年' : '—'} | ${med(rs.map(r => r.firstHouseAge).filter(x => x != null)) || '—'} | ${Math.round(rs.filter(r => r.firstHouseAge != null).length / rs.length * 100)}% |`);
});

/* 8 */
w('\n\n## 8. 出生年代 × 买房能力（稳健流，出身固定为县城双职工，每组 60 局）\n');
w('| 出生年 | 30岁年份 | 30岁年收入 | 30岁房价 | 房价/收入 | 买房率 | 首套年龄 | 终局净资产中位 | 平均寿命 |');
w('|---|---|---|---|---|---|---|---|---|');
Object.keys(era).forEach(sy => {
  const rs = era[sy];
  const inc = med(rs.map(r => r.incomeAt30).filter(Boolean));
  const hp = med(rs.map(r => r.housePriceAt30).filter(Boolean));
  w(`| ${sy} | ${+sy + 30} | ${fmt(inc)} | ${fmt(hp)} | ${inc ? (hp / inc).toFixed(1) : '—'}× | ${Math.round(rs.filter(r => r.firstHouseAge != null).length / rs.length * 100)}% | ${med(rs.map(r => r.firstHouseAge).filter(x => x != null)) || '—'} | ${fmt(med(rs.map(r => r.finalNet)))} | ${avg(rs.map(r => r.deathAge)).toFixed(0)} |`);
});

/* 9 阶层流动 */
w('\n\n## 9. 阶层流动性实验（22 岁强制入职指定职业，之后统一执行稳健理财策略，每组 60 局）\n');
w('| 职业 | 入职职级 | 入职年薪 | 30岁年薪 | 40岁年薪 | 终局净资产中位 | 买房率 | 首套年龄 | 平均寿命 | 曾换过职业比例 |');
w('|---|---|---|---|---|---|---|---|---|---|');
const careers = JSON.parse(fs.readFileSync(path.join(__dirname, 'career-names.json'), 'utf8'));
Object.keys(mob).forEach(cid => {
  const rs = mob[cid];
  const inc30 = med(rs.map(r => r.incomeAt30).filter(Boolean));
  const inc40 = med(rs.map(r => r.salaries[40]).filter(Boolean));
  const entry = careers[cid] || {};
  w(`| ${entry.name || cid} | ${entry.l0 || '—'} | ${fmt(entry.sal0 || 0)} | ${fmt(inc30)} | ${fmt(inc40)} | ${fmt(med(rs.map(r => r.finalNet)))} | ${Math.round(rs.filter(r => r.firstHouseAge != null).length / rs.length * 100)}% | ${med(rs.map(r => r.firstHouseAge).filter(x => x != null)) || '—'} | ${avg(rs.map(r => r.deathAge)).toFixed(0)} | ${Math.round(rs.filter(r => r.jobSwitches > 0).length / rs.length * 100)}% |`);
});

/* 10 事件库 */
w('\n\n## 10. 事件库消耗\n');
const ev = Object.entries(tally.all).sort((a, b) => b[1] - a[1]);
w(`- 本次模拟触及去重事件 id：**${ev.length}** 个（EVENTS 常量共 241 条）`);
w(`- 总触发次数：${ev.reduce((a, b) => a + b[1], 0)}`);
w(`- 只被触发 1-2 次的冷门事件：${ev.filter(x => x[1] <= 2).length} 个（${Math.round(ev.filter(x => x[1] <= 2).length / ev.length * 100)}%）`);
w(`- Top10 事件占总触发量：${(ev.slice(0, 10).reduce((a, b) => a + b[1], 0) / ev.reduce((a, b) => a + b[1], 0) * 100).toFixed(1)}%`);
w(`- 事件选项数分布（1/2/3/4 选项）：${tally.choiceCount[1] || 0} / ${tally.choiceCount[2] || 0} / ${tally.choiceCount[3] || 0} / ${tally.choiceCount[4] || 0}`);
w('\n| # | 事件 id | 触发次数 |');
w('|---|---|---|');
ev.slice(0, 25).forEach(([k, v], i) => w(`| ${i + 1} | ${k} | ${v} |`));

/* 11 终局结构 */
w('\n\n## 11. 终局资产结构与属性\n');
w('| 画像 | 现金 | 房产/资产 | 股票 | 负债 | 净资产 | 健康 | 心情 | 智力 | 声望 | 人脉 | 成就 |');
w('|---|---|---|---|---|---|---|---|---|---|---|---|');
KEYS.forEach(k => {
  const rs = all[k];
  const props = avg(rs.map(r => (r.props || []).reduce((a, b) => a + b.value, 0)));
  const S = f => avg(rs.map(r => r.finalStats[f])).toFixed(0);
  w(`| ${CN[k]} | ${fmt(avg(rs.map(r => r.finalCash)))} | ${fmt(props)} | ${fmt(avg(rs.map(r => r.stockValue)))} | ${fmt(avg(rs.map(r => r.debt)))} | ${fmt(avg(rs.map(r => r.finalNet)))} | ${S('HP')} | ${S('MOOD')} | ${S('INT')} | ${S('FAME')} | ${S('NET')} | ${avg(rs.map(r => r.achievements)).toFixed(1)} |`);
});

fs.writeFileSync(path.join(OUT, 'summary.md'), L.join('\n'), 'utf8');
console.log('written summary.md', L.length, 'lines');
