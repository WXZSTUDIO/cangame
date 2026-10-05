/* =========================================================
 *  CANGAME · 引擎层
 *  状态 / 年份推进 / 事件抽取 / 投资 / 结局判定
 * ========================================================= */

const SAVE_VERSION = 2;
const END_AGE = GAME_META.endAge;
const START_YEAR = GAME_META.startYear;

/* ---------- 工具 ---------- */
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function chance(p) { return Math.random() < p; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function fmtMoney(v) {
  const s = Math.round(v || 0);
  const sign = s < 0 ? '-' : '';
  const n = Math.abs(s);
  if (n >= 1e12) return sign + (n / 1e12).toFixed(2) + '조원';
  if (n >= 1e8) return sign + (n / 1e8).toFixed(n >= 1e10 ? 0 : 2) + '억원';
  if (n >= 1e4) return sign + (n / 1e4).toFixed(0) + '만원';
  return sign + n + '원';
}
function fmtYear(state) { return START_YEAR + state.age; }
function grade(score) {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  if (score >= 35) return 'C';
  return 'D';
}

/* ---------- 职业与收支 ---------- */
const JOBS = {
  '婴儿': { salary: 0, cost: 800000 },
  '小学生': { salary: 0, cost: 1500000 },
  '初中生': { salary: 0, cost: 2500000 },
  '高中生': { salary: 0, cost: 4000000 },
  '大学生': { salary: 0, cost: 9000000 },
  '军人': { salary: 1500000, cost: 0 },
  '无业': { salary: 0, cost: 12000000 },
  '工厂工人': { salary: 26000000, cost: 16000000 },
  '会社员': { salary: 42000000, cost: 20000000 },
  '公务员': { salary: 38000000, cost: 19000000 },
  '个体户': { salary: 55000000, cost: 24000000 },
  '创业者': { salary: 20000000, cost: 22000000 },
  '太星集团社员': { salary: 52000000, cost: 22000000 },
  '太星战略室次长': { salary: 95000000, cost: 30000000 },
  '太星集团副会长': { salary: 320000000, cost: 60000000 },
  '太星集团会长': { salary: 900000000, cost: 90000000 }
};

function defaultJob(age) {
  if (age <= 6) return '婴儿';
  if (age <= 12) return '小学生';
  if (age <= 15) return '初中生';
  if (age <= 18) return '高中生';
  if (age <= 22) return '大学生';
  return '无业';
}

/* ---------- 创建角色 ---------- */
function rollTalents(n) {
  const pool = TALENTS.slice();
  const out = [];
  n = n || 10;
  while (out.length < n && pool.length) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
}

function talentById(id) { return TALENTS.find(t => t.id === id); }
function familyById(id) { return FAMILIES.find(f => f.id === id); }

function createGame(opt) {
  const family = familyById(opt.familyId) || FAMILIES[0];
  const state = {
    v: SAVE_VERSION,
    seed: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: opt.name || '김민준',
    gender: opt.gender || 'M',
    age: 0,
    familyId: family.id,
    familyName: family.name,
    talents: opt.talents || [],
    stats: { INT: 5, STR: 5, CHA: 5, WILL: 5, HP: 60, STRESS: 10, MONEY: 0, NET: 0, FAME: 0, LOY: 0 },
    flags: {},
    job: '婴儿',
    log: [],
    used: [],
    queue: [],
    pending: null,
    investments: [],
    alive: true,
    finished: false,
    ending: null,
    peak: { MONEY: 0, FAME: 0, NET: 0 }
  };
  marketInit(state);
  // 出身
  applyEffects(state, family.eff, true);
  if (family.flags) family.flags.forEach(f => state.flags[f] = true);
  // 天赋
  (opt.talents || []).forEach(id => {
    const t = talentById(id);
    if (!t) return;
    if (t.eff) applyEffects(state, t.eff, true);
    if (t.flags) t.flags.forEach(f => state.flags[f] = true);
  });
  state.stats.HP = clamp(state.stats.HP, 20, 100);
  state.stats.STRESS = clamp(state.stats.STRESS, 0, 100);
  pushLog(state, `1985년 겨울 · 你出生在${family.name.split(' ')[1] || family.name}。`, 'system');
  pushLog(state, family.desc, 'story');
  return state;
}

function pushLog(state, text, type) {
  state.log.push({ age: state.age, year: START_YEAR + state.age, text, type: type || 'story' });
  if (state.log.length > 400) state.log.shift();
}

/* ---------- 效果结算 ---------- */
function applyEffects(state, eff, silent) {
  if (!eff) return;
  const s = state.stats;
  for (const k in eff) {
    const v = eff[k];
    if (typeof v !== 'number') continue;
    if (s[k] === undefined) { s[k] = 0; }
    s[k] += v;
  }
  s.HP = clamp(s.HP, 0, 120);
  s.STRESS = clamp(s.STRESS, 0, 120);
  s.INT = clamp(s.INT, 0, 200); s.STR = clamp(s.STR, 0, 200);
  s.CHA = clamp(s.CHA, 0, 200); s.WILL = clamp(s.WILL, 0, 200);
  s.NET = clamp(s.NET, 0, 200); s.FAME = clamp(s.FAME, 0, 200);
  s.LOY = clamp(s.LOY, -50, 150);
  s.MONEY = Math.round(s.MONEY);
  // 记录峰值
  if (s.MONEY > state.peak.MONEY) state.peak.MONEY = s.MONEY;
  if (s.FAME > state.peak.FAME) state.peak.FAME = s.FAME;
}

function applyFlags(state, flags) {
  if (!flags) return;
  flags.forEach(f => state.flags[f] = true);
}

function describeEffects(eff) {
  const names = {
    INT: '지력', STR: '체력', CHA: '매력', WILL: '의지',
    HP: '건강', STRESS: '스트레스', MONEY: '자산',
    NET: '인맥', FAME: '명성', LOY: '太星好感'
  };
  const parts = [];
  for (const k in eff || {}) {
    const v = eff[k];
    if (typeof v !== 'number' || v === 0) continue;
    if (k === 'MONEY') parts.push(`${v > 0 ? '+' : ''}${fmtMoney(v)}`);
    else parts.push(`${names[k] || k} ${v > 0 ? '+' : ''}${v}`);
  }
  return parts;
}

/* ---------- 条件判定 ---------- */
function matchCond(state, ev) {
  const c = ev.cond;
  if (!c) return true;
  if (c.ageMin !== undefined && state.age < c.ageMin) return false;
  if (c.ageMax !== undefined && state.age > c.ageMax) return false;
  if (c.gender && state.gender !== c.gender) return false;
  if (c.job && c.job.indexOf(state.job) === -1) return false;
  if (c.need && !c.need.every(f => state.flags[f])) return false;
  if (c.need2 && !c.need2.every(f => state.flags[f])) return false;
  if (c.ban && c.ban.some(f => state.flags[f])) return false;
  if (c.min) for (const k in c.min) if (state.stats[k] < c.min[k]) return false;
  if (c.max) for (const k in c.max) if (state.stats[k] > c.max[k]) return false;
  return true;
}

function matchEvent(state, ev) {
  const a = ev.age || [0, 200];
  if (state.age < a[0] || state.age > a[1]) return false;
  if (ev.once && state.used.indexOf(ev.id) >= 0) return false;
  if (state.used.indexOf(ev.id) >= 0) return false; // 所有事件每人只发生一次
  return matchCond(state, ev);
}

/* ---------- 三选项系统 ---------- */
/* 无手写选项的事件（成年后）自动生成：慎重 / 照常 / 豁出去 */
function scaleEff(eff, gainK, lossK) {
  const o = {};
  for (const k in eff || {}) {
    const v = eff[k];
    if (typeof v !== 'number') continue;
    o[k] = v >= 0 ? Math.round(v * gainK) : -Math.round(-v * lossK);
  }
  return o;
}

function eventChoices(state, ev) {
  if (ev.choices && ev.choices.length) {
    return ev.choices.map(c => Object.assign({ risk: c.risk || 2 }, c));
  }
  if (state.age < 13) return null;             // 童年叙事事件保持单按钮
  const base = ev.eff || {};
  const hasMoney = typeof base.MONEY === 'number' && base.MONEY !== 0;
  const risk3 = Object.assign(scaleEff(base, 1.7, 1.35), { STRESS: (base.STRESS || 0) + 4 });
  return [
    {
      text: '신중하게 · 慎重处理', risk: 1, skipFlags: true,
      eff: Object.assign(scaleEff(base, 0.6, 0.45), { STRESS: -2 })
    },
    { text: '평소대로 · 按部就班', risk: 2, eff: scaleEff(base, 1, 1) },
    {
      text: '모든 걸 걸다 · 豁出去', risk: 3, eff: risk3,
      gamble: {
        p: 0.45,
        win: hasMoney
          ? { MONEY: Math.round(Math.abs(base.MONEY) * 1.5), WILL: 4, INT: 3 }
          : { WILL: 5, INT: 4, NET: 5, FAME: 3 },
        lose: hasMoney
          ? { MONEY: -Math.round(Math.abs(base.MONEY) * 0.7), HP: -2, STRESS: 5 }
          : { HP: -2, STRESS: 6, CHA: -3 }
      }
    }
  ];
}

function riskLabel(r) {
  return ['', '低', '中', '高'][r] || '中';
}

function pickEvents(state) {
  const pool = EVENTS.filter(ev => matchEvent(state, ev));
  if (!pool.length) return [];
  const lucky = !!state.flags.lucky;
  const weighted = [];
  pool.forEach(ev => {
    let w = ev.w || 5;
    if (lucky) w *= 1.35;
    weighted.push({ ev, w });
  });
  const count = state.age <= 12 ? 1 : (chance(0.35) ? 2 : 1);
  const picked = [];
  for (let i = 0; i < count && weighted.length; i++) {
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < weighted.length; j++) {
      r -= weighted[j].w;
      if (r <= 0) { idx = j; break; }
    }
    picked.push(weighted[idx].ev);
    weighted.splice(idx, 1);
  }
  return picked;
}

/* ---------- 投资系统 ---------- */
function settleInvestments(state) {
  const done = [];
  state.investments = state.investments.filter(inv => {
    inv.yearsLeft -= 1;
    if (inv.yearsLeft > 0) return true;
    // 结算
    let mult = inv.base + (Math.random() * 2 - 1) * inv.vol;
    if (state.flags.past_life) mult = inv.base * 0.7 + mult * 0.3 + 0.3; // 前世记忆：下限更高
    if (state.flags.stock_buff && inv.kind === 'stock') mult *= 1.3;
    if (state.flags.estate_buff && inv.kind === 'estate') mult *= 1.5;
    if (state.flags.lucky) mult *= 1.1;
    mult = Math.max(0.2, mult);
    const payout = Math.round(inv.amount * mult);
    const profit = payout - inv.amount;
    state.stats.MONEY += payout;
    done.push({ inv, payout, profit, mult });
    return false;
  });
  done.forEach(d => {
    pushLog(state,
      `【投资结算】${d.inv.name} · ${fmtYear(state)}년 · 回报 ${d.mult.toFixed(2)}倍，到手 ${fmtMoney(d.payout)}（净 ${d.profit >= 0 ? '+' : ''}${fmtMoney(d.profit)}）`,
      d.profit >= 0 ? 'money' : 'warn');
  });
  return done;
}

function offerInvestments(state) {
  const year = fmtYear(state);
  const offers = INVESTMENTS.filter(inv => inv.year === year && state.used.indexOf(inv.id) < 0);
  return offers.map(inv => ({
    type: 'invest',
    inv,
    text: `【投资机会 · ${year}년】${inv.name}\n最低入场 ${fmtMoney(inv.cost)}，持有约 ${inv.hold} 年后一次性结算。\n${state.flags.past_life ? '전생의 기억：' + inv.hint : '（你没有关于这件事的记忆，只能赌。）'}`,
    choices: buildInvestChoices(state, inv)
  }));
}

function buildInvestChoices(state, inv) {
  const c = [];
  const m = state.stats.MONEY;
  [0.3, 0.6, 1].forEach(ratio => {
    const amt = Math.max(inv.cost, Math.floor(m * ratio));
    c.push({
      text: `投入身家的 ${Math.round(ratio * 100)}% · ${fmtMoney(amt)}`,
      disabled: m < amt || m <= 0,
      act: 'invest',
      invId: inv.id,
      amount: amt
    });
  });
  c.push({ text: '放过这次机会', act: 'skip', invId: inv.id });
  return c;
}

function doInvest(state, invId, amount) {
  const inv = INVESTMENTS.find(i => i.id === invId);
  if (!inv) return;
  const need = Math.max(inv.cost, Math.round(amount));
  if (state.stats.MONEY < need) return;
  state.stats.MONEY -= need;
  state.investments.push({
    id: inv.id, name: inv.name, amount: need,
    base: inv.base, vol: inv.vol, kind: inv.kind,
    yearsLeft: inv.hold, startYear: fmtYear(state)
  });
  state.used.push(inv.id);
  pushLog(state, `【投资】买入 ${inv.name}，投入 ${fmtMoney(need)}。`, 'money');
}

/* ---------- 年度基础结算 ---------- */
function yearBase(state) {
  const s = state.stats;
  // 自然成长
  if (state.age <= 12) { s.INT += rand(1, 3); s.STR += rand(1, 2); s.HP += 2; }
  else if (state.age <= 18) { s.INT += rand(1, 2); s.CHA += rand(0, 2); s.STR += rand(0, 1); }
  else if (state.age <= 35) { s.INT += rand(0, 1); s.HP += s.STRESS < 55 ? rand(0, 2) : rand(-1, 1); }
  else if (state.age <= 55) { s.HP += s.STRESS < 45 ? rand(0, 1) : rand(-2, 0); s.STR += -1; }
  else { s.HP += s.STRESS < 35 ? rand(0, 1) : rand(-2, 0); s.STR += -1; }

  // 压力伤害
  if (s.STRESS > 70) { s.HP -= Math.round((s.STRESS - 70) / 6); }
  s.STRESS = Math.max(0, s.STRESS - 7);

  // 病重时自动就医（有钱才能买回时间）
  if (s.HP < 35 && s.MONEY >= 20000000 && state.age >= 20) {
    const fee = Math.min(Math.max(20000000, Math.round(s.MONEY * 0.1)), 500000000);
    s.MONEY -= fee;
    s.HP += 20; s.STRESS -= 10;
    pushLog(state, `【입원 住院】你在医院躺了两周，花了 ${fmtMoney(fee)}。医生说：再晚一个月就晚了。`, 'warn');
  }

  // 成年后自动求职（避免长期无业陷入负债螺旋）
  if (state.age >= 23 && (state.job === '无业' || state.job === '大学生')) {
    const r = Math.random();
    let j = '会社员';
    if (state.stats.INT >= 65 && r < 0.45) j = '公务员';
    else if (state.stats.STR >= 45 && r < 0.4) j = '工厂工人';
    else if (state.stats.CHA >= 50 && r < 0.35) j = '个体户';
    state.job = j;
    pushLog(state, `【求职】你终于找到了一份工作：${j}。`, 'muted');
  }

  // 收支
  const j = JOBS[state.job] || { salary: 0, cost: 12000000 };
  let income = j.salary * (1 + Math.max(0, state.age - 23) * 0.06);
  income = Math.round(income * (1 + s.INT / 400) * (1 + s.NET / 800));
  let cost = j.cost;
  if (state.flags.gangnam_owner) cost += 15000000;
  if (state.flags.married) cost += 12000000;
  const net = income - cost;
  s.MONEY += net;
  if (state.age >= 23) {
    pushLog(state, `【${fmtYear(state)}년】${state.job} · 收入 ${fmtMoney(income)}，支出 ${fmtMoney(cost)}，结余 ${net >= 0 ? '+' : ''}${fmtMoney(net)}`, 'money');
  }
  // 声望自然衰减
  if (s.FAME > 0 && state.age > 30 && chance(0.3)) s.FAME -= 1;

  // 净资产峰值
  const w = worthOf(state);
  if (w > (state.peak.NET || 0)) state.peak.NET = w;
}

/* ---------- 事件推进 ---------- */
/* 返回下一步要展示的内容对象 */
function step(state) {
  if (state.finished) return { type: 'end' };

  // 1. 队列里还有内容 → 弹出
  if (state.queue && state.queue.length) {
    return state.queue.shift();
  }

  // 2. 新的一年
  if (state.age >= END_AGE) { finish(state); return { type: 'end' }; }
  state.age += 1;
  state.job = state.job || defaultJob(state.age);

  yearBase(state);
  marketTick(state);
  settleInvestments(state);

  const items = [];
  items.push({ type: 'year', age: state.age, year: fmtYear(state) });
  offerInvestments(state).forEach(o => items.push(o));
  pickEvents(state).forEach(ev => items.push({ type: 'event', ev }));

  state.queue = items;
  if (!state.queue.length) return { type: 'year', age: state.age, year: fmtYear(state) };
  return state.queue.shift();
}

function resolveEvent(state, ev, choiceIndex) {
  state.used.push(ev.id);
  const list = eventChoices(state, ev);
  let eff = ev.eff || {};
  let extra = '';
  let ch = null;

  if (list && typeof choiceIndex === 'number' && list[choiceIndex]) {
    ch = list[choiceIndex];
    eff = ch.eff || {};
    applyFlags(state, ch.flags);
    extra = ' 【선택 ' + ch.text + '】';
  } else {
    eff = ev.eff || {};
  }
  // 慎重处理会错过机会：不触发事件的身份/Flag 变化
  if (!(ch && ch.skipFlags)) {
    if (ev.flags) applyFlags(state, ev.flags);
    if (ev.job) state.job = ev.job;
  }
  if (ch && ch.job) state.job = ch.job;

  applyEffects(state, eff);
  pushLog(state, `[${fmtYear(state)}년 · ${state.age}세] ${ev.text}${extra}`, 'story');
  const d = describeEffects(eff);
  if (d.length) pushLog(state, '  → ' + d.join('，'), 'stat');

  // 概率赌注
  if (ch && ch.gamble) {
    const g = ch.gamble;
    const win = chance(g.p);
    const res = win ? (g.win || {}) : (g.lose || {});
    applyEffects(state, res);
    if (win && g.winJob) state.job = g.winJob;
    if (win && g.winFlags) applyFlags(state, g.winFlags);
    if (!win && g.loseFlag) applyFlags(state, [g.loseFlag]);
    const rd = describeEffects(res);
    pushLog(state, `  【${win ? '성공 赌赢了' : '실패 赌输了'} · ${Math.round(g.p * 100)}%】${rd.join('，') || '什么也没发生'}`,
      win ? 'money' : 'warn');
  }
  checkDeath(state);
}

function resolveInvest(state, choice) {
  if (choice.act === 'invest') {
    doInvest(state, choice.invId, choice.amount);
  } else {
    const inv = INVESTMENTS.find(i => i.id === choice.invId);
    if (inv) { state.used.push(inv.id); pushLog(state, `【投资】你放过了「${inv.name}」。`, 'muted'); }
  }
}

function checkDeath(state) {
  if (state.stats.HP <= 0 && state.alive) {
    state.alive = false;
    forceEnd(state, {
      id: 'end_dead', rank: 'D', title: '과로사 熄灭',
      text: `你在 ${fmtYear(state)}년 倒下了。医生说是过劳。你最后的念头是：那栋楼，还没画完。`
    });
  }
}

function forceEnd(state, ending) {
  state.finished = true;
  state.alive = false;
  state.ending = ending;
  pushLog(state, `【结局】${ending.title} — ${ending.text}`, 'end');
}

/* ---------- 结局 ---------- */
function worthOf(state) {
  return (typeof netWorth === 'function') ? netWorth(state) : state.stats.MONEY;
}

function scoreOf(state) {
  const s = state.stats;
  const worth = worthOf(state);
  let score = 0;
  score += Math.min(38, Math.sqrt(Math.max(0, worth) / 1e8) * 3.2);
  score += Math.min(25, s.FAME * 0.35);
  score += Math.min(15, s.NET * 0.12);
  score += Math.min(10, s.WILL * 0.08);
  score += Math.min(8, s.INT * 0.05);
  score += Math.min(7, s.CHA * 0.05);
  score += state.flags.took_over ? 15 : 0;
  score += state.flags.exposed ? 8 : 0;
  score += state.flags.gangnam_owner ? 5 : 0;
  score += state.flags.own_house ? 3 : 0;
  score += state.flags.own_car ? 1 : 0;
  score += state.flags.foundation ? 6 : 0;
  score -= state.stats.STRESS > 60 ? 5 : 0;
  if (state.market && state.market.debt > worth * 2 && worth > 0) score -= 6;
  return Math.round(clamp(score, 0, 100));
}

function finish(state) {
  state.alive = false;
  state.finished = true;
  const ending = ENDINGS.find(e => e.cond(state)) || ENDINGS[ENDINGS.length - 1];
  state.ending = ending;
  state.score = scoreOf(state);
  state.rank = grade(state.score);
  pushLog(state, `【${fmtYear(state)}년 · 人生终章】${ending.title}`, 'end');
  pushLog(state, ending.text, 'end');
}
