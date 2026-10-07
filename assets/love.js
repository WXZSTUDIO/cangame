/* =========================================================
 * CANGAME · 恋爱 / 婚姻 / 生育系统
 * 偶遇 · 追同学 · 相亲三条来源；好感、颜值、家境、道德都会真正起作用
 * ========================================================= */

const LOVE_META = {
  marryAge: 22,
  marryAffinity: 70,   // 求婚门槛
  touchAffinity: 58,   // 到此才可能发生亲密关系
  touchesPerYear: 3,   // 同一个人一年最多见 3 次（原来一年只有一次，关系根本推不动）
  pregnantBase: 0.16,
  safePregnant: 0.008, // 做好措施后的怀孕概率（几乎为零，但不是绝对）
  safeCost: 27000,     // 措施的成本（原来 50 万，贵得没人用；现在约合 150 元）
  affairRisk: 0.34,    // 婚内越界被撞破的概率
  divorceMinYears: 1,  // 结婚满一年才能离
  dateCost: 600000,
  giftCost: 1800000,
  matchCost: 4000000
};

const TEMPERAMENTS = [
  { key: 'warm', label: '温柔', eff: { LOVE: 2, SEC: 2 } },
  { key: 'fire', label: '要强', eff: { WILL: 2, STRESS: 2 } },
  { key: 'fun', label: '有趣', eff: { CHA: 2, STRESS: -2 } },
  { key: 'cool', label: '冷淡', eff: { SEC: -1, INT: 1 } },
  { key: 'practical', label: '务实', eff: { MONEY: 400000, LOVE: -1 } },
  { key: 'romantic', label: '浪漫', eff: { LOVE: 3, MONEY: -300000 } }
];

const MATCH_BACKGROUNDS = [
  { key: 'poor', label: '家境一般', need: 0, mult: 0.9 },
  { key: 'mid', label: '小康之家', need: 60000000, mult: 1.0 },
  { key: 'rich', label: '条件优渥', need: 300000000, mult: 1.25 },
  { key: 'top', label: '家世显赫', need: 1200000000, mult: 1.6 }
];

function loveInit(state) {
  if (!state.love) state.love = { candidates: [], partner: null, met: [] };
  return state.love;
}

function makeLover(state, src) {
  const gender = state.gender === 'M' ? 'F' : 'M';
  const tp = TEMPERAMENTS[randInt(0, TEMPERAMENTS.length - 1)];
  const bg = MATCH_BACKGROUNDS[randInt(0, MATCH_BACKGROUNDS.length - 1)];
  const look = clamp(Math.round(rand(35, 90)), 5, 100);
  return {
    name: randomPersonName(gender),
    gender: gender,
    age: clamp(state.age + randInt(-4, 4), 16, 70),
    look: look,
    charm: clamp(Math.round(rand(30, 90)), 5, 100),
    tp: tp.key, bg: bg.key, src: src || '偶遇',
    affinity: src === '同学' ? randInt(18, 34) : randInt(12, 28),
    alive: true,
    lastTouch: -1,
    touches: 0,
    met: state.age,
    pregnant: false
  };
}

function loverLabel(l) {
  const t = TEMPERAMENTS.find(x => x.key === l.tp) || { label: '' };
  const b = MATCH_BACKGROUNDS.find(x => x.key === l.bg) || { label: '' };
  return `${l.name} · ${l.age} · ${t.label} · ${b.label} · 颜值 ${l.look}`;
}

/* ---------- 三条来源 ---------- */
function meetByChance(state) {
  if (state.age < 16) return null;
  const lv = loveInit(state);
  if (lv.candidates.length >= 5) return null;
  // 已婚也能遇上别人——只是那不叫恋爱，叫出轨
  if (!chance(state.flags.married ? 0.18 : 0.5)) return null;
  const l = makeLover(state, '偶遇');
  l.outside = !!state.flags.married;
  lv.candidates.push(l);
  pushLog(state, `【偶遇】${l.srcText || ''}你遇见了 ${l.name}。${l.age}岁，${(TEMPERAMENTS.find(t => t.key === l.tp) || {}).label}。` +
    (state.flags.married ? `你低头看了一眼手上的戒指。` : '这世界很大，但有些人只擦肩一次。'), 'story');
  return l;
}

function meetFromClassmate(state, idx) {
  const c = (state.classmates || [])[idx];
  if (!c) return { ok: false, msg: '没有这位同学' };
  const lv = loveInit(state);
  const gender = state.gender === 'M' ? 'F' : 'M';
  if (c.gender === state.gender) return { ok: false, msg: '你们只是好朋友' };
  if (lv.candidates.some(x => x.name === c.name)) return { ok: false, msg: 'TA 已经在你的名单里了' };
  const tp = TEMPERAMENTS[randInt(0, TEMPERAMENTS.length - 1)];
  const bg = MATCH_BACKGROUNDS[randInt(0, MATCH_BACKGROUNDS.length - 1)];
  const l = {
    name: c.name, gender: gender, age: c.age || (state.age + randInt(-2, 2)),
    look: c.charm, charm: c.charm, tp: tp.key, bg: bg.key, src: '同学', stage: c.stage,
    affinity: clamp(c.affinity + randInt(2, 8), 5, 100),
    alive: true, lastTouch: -1, touches: 0, met: state.age, pregnant: false,
    outside: !!state.flags.married
  };
  lv.candidates.push(l);
  pushLog(state, `【心动】你开始在意 ${l.name} 了。早恋这件事，老师和家长都反对，但你控制不了自己。`, 'story');
  return { ok: true, lover: l };
}

/* 主动在外面认识一个人：已婚叫外遇，未婚叫邂逅 */
function meetOutside(state) {
  if (state.age < 18) return { ok: false, msg: '再大一点再说' };
  const lv = loveInit(state);
  if (lv.candidates.length >= 6) return { ok: false, msg: '已经够乱了' };
  const married = !!state.flags.married;
  const l = makeLover(state, married ? '外遇' : '邂逅');
  l.outside = married;   // 只是「婚外认识的人」，要不要越线是下一步的事
  l.affinity = randInt(22, 40);
  lv.candidates.push(l);
  pushLog(state, married
    ? `【外遇】${l.srcText || ''}你认识了 ${l.name}。${l.age}岁。${loverLabel(l)}。\n你知道自己在做什么——也知道一旦被发现，要还的东西不止一句道歉。`
    : `【邂逅】你在一次无关紧要的场合遇见了 ${l.name}。${loverLabel(l)}。有些人出现在你生活里，是没有预告的。`, 'story');
  return { ok: true, lover: l };
}

/* 偷情 / 长期外遇：不是一夜，是维持一段见不得光的关系 */
function startAffair(state, idx) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (l.alive === false) return { ok: false, msg: 'TA 已经不在了' };
  if (!state.flags.married && !state.flags.dating) return { ok: false, msg: '你现在一个人，谈不上偷情' };
  if (l.affinity < LOVE_META.touchAffinity) return { ok: false, msg: `好感还不够（需 ${LOVE_META.touchAffinity}%）` };
  if (l.secret) return { ok: false, msg: '你们已经是这种关系了' };
  l.secret = true;
  l.outside = true;
  l.affairSince = state.age;
  applyEffects(state, { ETH: -10, LOVE: 3, SEC: -4, STRESS: 6, MOOD: 2 });
  if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 3, 0, 100);
  pushLog(state, `【偷情】你和 ${l.name} 开始了见不得光的那部分。\n` +
    `你删掉了聊天记录，学会了一个新密码。被发现的概率，比你想的要高。`, 'warn');
  return { ok: true, lover: l };
}

/* 断掉这段关系 */
function endAffair(state, idx) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (!l.secret) return { ok: false, msg: '你们不是这种关系' };
  delete l.secret;
  l.affinity = clamp(l.affinity - 18, 0, 100);
  applyEffects(state, { ETH: 4, LOVE: -6, MOOD: -4, STRESS: 4, SEC: 2 });
  pushLog(state, `【收手】你和 ${l.name} 说清楚了。删掉了号码，也删掉了一部分自己。`, 'muted');
  return { ok: true };
}

/* 有人主动向你表白——不是你单方面追人（恋爱中 / 已婚也会遇到） */
function makeConfessEvent(state, l) {
  const married = !!state.flags.married;
  const dating = !!state.flags.dating;
  const who = l ? l.name : '有人';
  const head = married ? '【婚外的表白】' : (dating ? '【有人向你表白】' : '【被表白】');
  return {
    id: 'confess_at_' + state.age,
    age: [16, 200], w: 0,
    confessName: who,
    text: `${head}${who} 把话说得很直：「我知道你有${married ? '家庭' : (dating ? '对象' : '你的生活')}，但我还是想让你知道。」\n` +
      `手机屏幕暗下去之前，那行字一直亮着。`,
    choices: [
      {
        text: married ? '接住它：开始一段见不得光的关系' : (dating ? '接住它：和现在的 TA 说清楚，转向这个人' : '答应：那就在一起吧'),
        risk: 3, flags: ['confess_yes'],
        eff: married ? { ETH: -10, LOVE: 5, SEC: -5, STRESS: 6, MOOD: 3 }
          : (dating ? { ETH: -8, LOVE: 4, STRESS: 6, CHA: 2 } : { LOVE: 8, MOOD: 6, SEC: 3, CHA: 2 })
      },
      {
        text: '装作没看见：把手机扣过去', risk: 1, flags: ['confess_ignore'],
        eff: { ETH: 2, MOOD: -3, LOVE: -2, WILL: -1 }
      },
      {
        text: '认真回绝：把话说清楚，谁都别难堪', risk: 1, flags: ['confess_no'],
        eff: { ETH: 4, WILL: 3, LOVE: -3, SEC: 3, MOOD: -1 }
      }
    ]
  };
}

/* 每年都可能有人先开口 */
function confessTick(state) {
  if (state.age < 16) return;
  if (state.confessYear === state.age) return;
  const lv = loveInit(state);
  const married = !!state.flags.married;
  // 频率：单身最高，已婚也有（只是性质不同）
  const p = married ? 0.09 : (state.flags.dating ? 0.11 : 0.20);
  if (!chance(p)) return;
  let l = null;
  const pool = (lv.candidates || []).filter(x => x.alive !== false && x.affinity >= 34);
  if (pool.length && chance(0.55)) {
    l = pool[randInt(0, pool.length - 1)];
  } else {
    l = makeLover(state, '表白');
    l.outside = married;
    l.affinity = randInt(38, 58);
    lv.candidates.push(l);
    pushLog(state, `【表白】${l.name} 找了个机会把话说了出口。${loverLabel(l)}。`, 'story');
  }
  if (!l) return;
  state.confessYear = state.age;
  state.extraQueue = state.extraQueue || [];
  state.extraQueue.push({ type: 'event', ev: makeConfessEvent(state, l) });
}

function meetByMatchmaker(state) {
  if (state.age < LOVE_META.marryAge - 2) return { ok: false, msg: `${LOVE_META.marryAge - 2}之后才有人给你介绍` };
  if (state.flags.married) return { ok: false, msg: '你已经结婚了' };
  if (state.stats.MONEY < LOVE_META.matchCost) return { ok: false, msg: '介绍费不够' };
  const lv = loveInit(state);
  state.stats.MONEY -= LOVE_META.matchCost;
  const l = makeLover(state, '相亲');
  // 相亲对象质量与你的条件挂钩：钱、名望、道德都会影响
  const worth = netWorth ? netWorth(state) : state.stats.MONEY;
  const q = clamp(Math.round((state.stats.CHA * 0.4 + state.stats.FAME * 0.3 + Math.sqrt(Math.max(0, worth) / 1e8) * 6 + state.stats.ETH * 0.2) / 2), 10, 95);
  l.look = clamp(Math.round((l.look + q) / 2), 10, 98);
  l.charm = clamp(Math.round((l.charm + q) / 2), 10, 98);
  l.affinity = randInt(26, 42);
  lv.candidates.push(l);
  pushLog(state, `【相亲】媒人安排了一次见面：${loverLabel(l)}。你付了介绍费 ${fmtMoney(LOVE_META.matchCost)}。`, 'story');
  return { ok: true, lover: l };
}

function ensureLover(state, src) {
  const lv = loveInit(state);
  if (lv.partner) return lv.partner;
  const l = makeLover(state, src || '偶遇');
  l.affinity = randInt(35, 55);
  lv.candidates.push(l);
  lv.partner = l;
  state.flags.dating = true;
  return l;
}

/* 每年跟同一个人见过几次了 */
function touchLeft(state, l) {
  if (l.lastTouch !== state.age) { l.lastTouch = state.age; l.touches = 0; }
  return LOVE_META.touchesPerYear - (l.touches || 0);
}

/* ---------- 互动 ---------- */
function loveAct(state, idx, kind) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (!l.alive) return { ok: false, msg: 'TA 已经不在了' };
  const left = touchLeft(state, l);
  if (left <= 0) return { ok: false, msg: `今年跟 ${l.name} 已经见过 ${LOVE_META.touchesPerYear} 次了` };
  const s = state.stats;
  let gain = 0, spend = 0, label = '聊天';
  if (kind === 'date') {
    if (s.MONEY < LOVE_META.dateCost) return { ok: false, msg: '钱不够约会' };
    s.MONEY -= LOVE_META.dateCost; spend = LOVE_META.dateCost; label = '约会';
    gain = randInt(8, 13) + Math.round(s.CHA / 16);
    applyEffects(state, { LOVE: 3, STRESS: -5, CHA: 1 });
  } else if (kind === 'gift') {
    if (s.MONEY < LOVE_META.giftCost) return { ok: false, msg: '钱不够买礼物' };
    s.MONEY -= LOVE_META.giftCost; spend = LOVE_META.giftCost; label = '送礼';
    gain = randInt(11, 16) + Math.round(s.CHA / 14);
    applyEffects(state, { LOVE: 2, CHA: 1 });
  } else {
    gain = randInt(4, 8) + Math.round(s.CHA / 20);
    applyEffects(state, { LOVE: 1, NET: 1, STRESS: -1 });
  }
  l.touches = (l.touches || 0) + 1;
  l.affinity = clamp(l.affinity + gain, 0, 100);
  const n = LOVE_META.touchesPerYear - l.touches;
  pushLog(state, `【${label}】你和 ${l.name} ${kind === 'date' ? '吃了一顿饭，看了场电影' : kind === 'gift' ? '挑了一份礼物，TA 收下了' : '聊到很晚'}。好感 ${Math.round(l.affinity)}%${spend ? `（花了 ${fmtMoney(spend)}）` : ''}。今年还能再约 ${n} 次。`, 'muted');
  return { ok: true, affinity: l.affinity, left: n };
}

/* ---------- 亲密关系与怀孕 ---------- */
/* safe=true：做好措施，几乎不会怀孕（要花一点钱，且少了点兴致） */
function loveIntimate(state, idx, safe) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (!l.alive) return { ok: false, msg: 'TA 已经不在了' };
  if (l.affinity < LOVE_META.touchAffinity) return { ok: false, msg: `好感还不够（需 ${LOVE_META.touchAffinity}%）` };
  if (state.age < 16) return { ok: false, msg: '太早了' };
  const married = !!state.flags.married;
  if (safe) {
    const cost = LOVE_META.safeCost;
    if (state.stats.MONEY < cost) return { ok: false, msg: '连这个钱都拿不出来' };
    state.stats.MONEY -= cost;
  }
  lv.partner = l;
  if (!married) { state.flags.dating = true; state.flags.in_love = true; }
  applyEffects(state, { LOVE: safe ? 5 : 6, SEC: married ? -4 : 3, STRESS: married ? 6 : 2 });

  if (married) {
    // 婚内出轨：道德、名声与家庭一起付出代价，还有被发现的风险
    applyEffects(state, { ETH: -12, FAME: -4 });
    if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 5, 0, 100);
    l.outside = true;
    pushLog(state, `【越界】你和 ${l.name} 走到了一起。回家时你在楼下站了很久才敢上楼。`, 'warn');
    if (chance(LOVE_META.affairRisk)) {
      state.queue = state.queue || [];
      state.extraQueue = state.extraQueue || [];
      state.extraQueue.push({ type: 'event', ev: makeAffairEvent(state, l) });
      return { ok: true, pregnant: false, affair: true, caught: true };
    }
    return { ok: true, pregnant: false, affair: true, caught: false };
  }

  const p = safe ? LOVE_META.safePregnant : (LOVE_META.pregnantBase + (l.look / 400) + (state.stats.CHA / 500));
  if (chance(p)) {
    l.pregnant = true;
    return { ok: true, pregnant: true, lover: l };
  }
  pushLog(state, `【亲密】你和 ${l.name} 走到了一起。${safe ? '这一次你们做足了措施。' : ''}${state.age < 22 ? '老师要是知道了，会把你叫去办公室。' : ''}`, 'story');
  return { ok: true, pregnant: false };
}

/* ---------- 东窗事发 ---------- */
function makeAffairEvent(state, l) {
  const sp = state.spouse || { name: '你爱人' };
  return {
    id: 'affair_at_' + state.age,
    loverName: l ? l.name : null,
    age: [16, 200], w: 0,
    text: `【东窗事发】${sp.name} 看到了那条消息。TA 没有吵，只是把手机放在桌上，屏幕朝上。\n` +
      `「${l ? l.name : '那个人'}是谁。」——这句话不是问句。`,
    choices: [
      {
        text: '断了，回家好好过日子', risk: 2,
        eff: { LOVE: -4, STRESS: 6, ETH: -3, MONEY: -3000000 }, flags: ['affair_cut']
      },
      {
        text: '坦白，把话说清楚', risk: 3,
        eff: { LOVE: -10, STRESS: 10, MOOD: -6, SEC: -6 }, flags: ['affair_confess']
      },
      {
        text: '离婚，和 TA 在一起', risk: 3,
        eff: { LOVE: -14, SEC: -14, STRESS: 12, ETH: -10, MOOD: -5 }, flags: ['affair_divorce']
      }
    ]
  };
}

/* ---------- 婚姻危机（长期不经营会自己找上门） ---------- */
function makeMarriageEvent(state) {
  const sp = state.spouse || { name: '你爱人' };
  return {
    id: 'marry_at_' + state.age,
    age: [22, 200], w: 0,
    text: `【婚姻危机】${sp.name} 把碗放进水池，背对着你说：「我们多久没一起吃过饭了。」\n` +
      `这些年你把所有力气都给了外面，家里只剩下冰箱的灯亮着。`,
    choices: [
      { text: '请一次假，把时间还给他们', risk: 1, eff: { MONEY: -6000000, LOVE: 8, STRESS: -6, MOOD: 4 }, flags: ['m_fix'] },
      { text: '今晚摊开来说清楚', risk: 2, eff: { LOVE: 3, STRESS: 6, MOOD: -2 }, flags: ['m_talk'] },
      { text: '离婚吧，这样对谁都好', risk: 3, eff: { LOVE: -18, SEC: -12, STRESS: 10 }, flags: ['m_split'] }
    ]
  };
}

/* ---------- 离婚 ---------- */
function divorce(state, reason) {
  if (!state.flags.married) return { ok: false, msg: '你还没有结婚' };
  const lv = loveInit(state);
  const sp = state.spouse || { name: state.spouseName || '爱人', affinity: 40, age: state.age, since: state.age };
  const worth = (typeof netWorth === 'function') ? netWorth(state) : state.stats.MONEY;
  const kids = state.childCount || 0;
  const keep = kids > 0 ? (chance(0.5) ? kids : Math.floor(kids / 2)) : 0;
  const lost = kids - keep;
  // 分家产：优先从现金里走，钱不够就按现有现金分
  const want = Math.round(Math.max(0, worth) * rand(0.25, 0.4));
  const paid = Math.min(want, Math.max(0, state.stats.MONEY));
  state.stats.MONEY -= paid;
  state.childCount = keep;
  if (state.children && state.children.length > keep) state.children.length = keep;
  delete state.flags.married;
  delete state.flags.in_love;
  state.flags.divorced = true;
  state.exes = state.exes || [];
  state.exes.unshift({
    name: sp.name, gender: state.gender === 'M' ? 'F' : 'M', age: sp.age,
    met: sp.since || state.age, at: state.age, reason: reason || '过不下去了',
    wasSpouse: true, affinity: clamp(sp.affinity || 40, 20, 62), look: sp.look || 60, lastTouch: -1
  });
  if (state.exes.length > 5) state.exes.length = 5;
  state.spouse = null;
  state.spouseName = null;
  applyEffects(state, { LOVE: -22, SEC: -14, MOOD: -10, STRESS: 14, ETH: -8, FAME: -6, HP: -4 });
  pushLog(state, `【离婚】你和 ${sp.name} 把证换成了另一本${reason ? '（' + reason + '）' : ''}。` +
    `分走了 ${fmtMoney(paid)}${lost ? `，${lost} 个孩子跟着对方走了` : ''}。房子空了一半，你花了很久才习惯。`, 'warn');
  if (typeof addGrief === 'function') addGrief(state, `和 ${sp.name} 离婚`, 10);
  return { ok: true, paid: paid, lost: lost, ex: (state.exes || [])[0] };
}

/* ---------- 分手：恋爱关系可以主动结束 ---------- */
function breakup(state, idx) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  const isPartner = lv.partner === l;
  // 只有当这个人就是配偶本人时才必须走离婚（领证时配偶已移出候选列表，
  // 所以这里按名字比对，避免「已婚 + 旧引用」把情人也误锁起来）
  const spName = state.flags.married ? ((state.spouse && state.spouse.name) || state.spouseName) : null;
  if (spName && l.name === spName) return { ok: false, msg: '结婚的人要走离婚流程' };
  lv.candidates.splice(idx, 1);
  if (isPartner) {
    lv.partner = null;
    delete state.flags.dating;
    delete state.flags.in_love;
  } else if (state.flags.dating && !lv.partner) {
    delete state.flags.dating;
  }
  delete l.secret;
  delete l.pregnant;
  l.affinity = clamp(l.affinity - 12, 15, 62);
  state.exes = state.exes || [];
  state.exes.unshift({
    name: l.name, gender: l.gender || (state.gender === 'M' ? 'F' : 'M'), age: l.age,
    met: l.met || state.age, at: state.age, reason: '分手', wasSpouse: false,
    affinity: l.affinity, look: l.look || 60, lastTouch: -1
  });
  if (state.exes.length > 5) state.exes.length = 5;
  applyEffects(state, { LOVE: -8, MOOD: -7, STRESS: 5 });
  pushLog(state, `【分手】你和 ${l.name} 把话说开了，然后就再也没说别的。通讯录里少了一个置顶。`, 'warn');
  return { ok: true };
}

/* ---------- 前任：还能来往，感情够了能复合，前配偶甚至能复婚 ---------- */
function exList(state) {
  if (state.exes == null) {
    state.exes = [];
    if (state.ex) {
      state.exes.push(Object.assign(
        { wasSpouse: true, gender: state.gender === 'M' ? 'F' : 'M', affinity: 42, lastTouch: -1, look: 60 },
        state.ex
      ));
      delete state.ex;
    }
  }
  return state.exes;
}

function exChat(state, i) {
  const ex = exList(state)[i];
  if (!ex) return { ok: false, msg: '没有这个人' };
  if (ex.lastTouch === state.age) return { ok: false, msg: '今年已经联系过了' };
  ex.lastTouch = state.age;
  const gain = randInt(3, 8) + Math.round((state.stats.CHA || 40) / 25);
  ex.affinity = clamp((ex.affinity || 30) + gain, 0, 96);
  applyEffects(state, { LOVE: 1, MOOD: -1 });
  pushLog(state, `【旧火】你和 ${ex.name} 好好聊了一次。有些话隔了这些年，反而说得出口。好感 ${Math.round(ex.affinity)}%。`, 'muted');
  return { ok: true, affinity: ex.affinity };
}

/* 复合：前任重新变成恋人 */
function rekindle(state, i) {
  const ex = exList(state)[i];
  if (!ex) return { ok: false, msg: '没有这个人' };
  if (state.flags.married) return { ok: false, msg: '你已经结婚了' };
  if ((ex.affinity || 0) < 55) return { ok: false, msg: `感情还不够（现在 ${Math.round(ex.affinity || 0)}%，需 55%）` };
  const p = clamp(0.4 + (ex.affinity - 55) / 120 + (state.stats.CHA || 40) / 400, 0.15, 0.9);
  if (!chance(p)) {
    ex.affinity = clamp(ex.affinity - 10, 0, 100);
    applyEffects(state, { MOOD: -5, STRESS: 4 });
    pushLog(state, `【复合未成】${ex.name} 想了很久，说：「算了吧，回不去了。」`, 'warn');
    return { ok: false, msg: '被拒绝了' };
  }
  const lv = loveInit(state);
  const l = {
    name: ex.name, gender: ex.gender || (state.gender === 'M' ? 'F' : 'M'), age: ex.age || state.age,
    look: ex.look || 60, charm: 60, tp: 'warm', bg: 'mid', src: '旧情复燃',
    affinity: clamp(ex.affinity, 50, 88), alive: true, lastTouch: state.age, touches: 1,
    met: ex.met || state.age, pregnant: false
  };
  lv.candidates.push(l);
  lv.partner = l;
  state.flags.dating = true;
  state.flags.in_love = true;
  exList(state).splice(i, 1);
  applyEffects(state, { LOVE: 8, MOOD: 6 });
  pushLog(state, `【复合】兜兜转转，你又和 ${l.name} 走到了一起。这一次要好好走。`, 'money');
  return { ok: true };
}

/* 复婚：前配偶感情足够就能把证领回来 */
function remarryEx(state, i) {
  const ex = exList(state)[i];
  if (!ex) return { ok: false, msg: '没有这个人' };
  if (state.flags.married) return { ok: false, msg: '你已经结婚了' };
  if (!ex.wasSpouse) return { ok: false, msg: '你们没结过婚，先处着吧' };
  if (state.age < LOVE_META.marryAge) return { ok: false, msg: `${LOVE_META.marryAge} 岁才能领证` };
  if ((ex.affinity || 0) < LOVE_META.marryAffinity) return { ok: false, msg: `感情还不够（需 ${LOVE_META.marryAffinity}%）` };
  const p = clamp(0.5 + (ex.affinity - LOVE_META.marryAffinity) / 60 + (state.stats.CHA || 40) / 350
    + (state.flags.own_house ? 0.1 : 0), 0.15, 0.92);
  if (!chance(p)) {
    ex.affinity = clamp(ex.affinity - 8, 0, 100);
    applyEffects(state, { MOOD: -6, STRESS: 5 });
    pushLog(state, `【复婚未成】${ex.name} 说：「我们都试着往前走吧。」证没领成，饭倒是吃完了。`, 'warn');
    return { ok: false, msg: 'TA 没答应' };
  }
  exList(state).splice(i, 1);
  state.flags.married = true;
  state.flags.in_love = true;
  state.spouseName = ex.name;
  state.spouse = {
    name: ex.name, age: ex.age || state.age, affinity: clamp(ex.affinity, 60, 92),
    alive: true, since: state.age, look: ex.look || 60, tp: 'warm', bg: 'mid'
  };
  delete state.flags.dating;
  applyEffects(state, { LOVE: 10, SEC: 6, MOOD: 8, MONEY: -6000000 });
  pushLog(state, `【复婚】绕了一大圈，你和 ${ex.name} 又把证领了回来。这一次，都学会了低头。`, 'money');
  return { ok: true };
}

/* 未婚怀孕：三选一 */
function makePregnantEvent(state, l) {
  return {
    id: 'pregnant_at_' + state.age,
    loverName: l ? l.name : null,
    age: [16, 200], w: 0,
    text: `【未婚怀孕】验孕棒上的两条杠，你看了足足十分钟。${l.name} 没有说话。\n` +
      `你们还没结婚。这件事一旦传出去，议论、指指点点、双方父母——都会来。`,
    choices: [
      {
        text: '生下来，两个人一起扛',
        risk: 3,
        eff: { ETH: -12, FAME: -8, SEC: -8, LOVE: 8, WILL: 6, STRESS: 12, MONEY: -6000000 },
        flags: ['pregnant_keep']
      },
      {
        text: '奉子成婚，把证领了',
        risk: 2,
        eff: { ETH: -4, LOVE: 6, SEC: -3, WILL: 3, STRESS: 8, MONEY: -4000000 },
        flags: ['pregnant_marry']
      },
      {
        text: '去医院，把这件事结束掉',
        risk: 1,
        eff: { ETH: -14, LOVE: -8, HP: -6, STRESS: 10, SEC: -2, MONEY: -3000000 },
        flags: ['pregnant_drop']
      }
    ]
  };
}

/* ---------- 求婚 ---------- */
function propose(state, idx) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (state.flags.married) return { ok: false, msg: '你已经结婚了' };
  if (state.age < LOVE_META.marryAge) return { ok: false, msg: `${LOVE_META.marryAge}才能领证` };
  if (l.affinity < LOVE_META.marryAffinity) return { ok: false, msg: `好感不够（需 ${LOVE_META.marryAffinity}%）` };
  const bg = MATCH_BACKGROUNDS.find(x => x.key === l.bg) || MATCH_BACKGROUNDS[0];
  const worth = (typeof netWorth === 'function') ? netWorth(state) : state.stats.MONEY;
  const need = bg.need * (1 + l.look / 220);
  let p = 0.62 + (l.affinity - LOVE_META.marryAffinity) / 50 + state.stats.CHA / 320
    + (worth >= need ? 0.26 : -0.14) + state.stats.ETH / 500
    + (state.flags.own_house ? 0.12 : 0);
  p = clamp(p, 0.12, 0.96);
  if (!chance(p)) {
    l.affinity = clamp(l.affinity - 8, 0, 100);
    applyEffects(state, { LOVE: -5, STRESS: 8, WILL: -2 });
    pushLog(state, `【求婚被拒】${l.name} 摇了摇头。${worth < need ? 'TA 家里要的东西，你现在给不起。' : 'TA 说：我们再想想。'}`, 'warn');
    return { ok: false, msg: '被拒绝了', p };
  }
  marry(state, l);
  return { ok: true, p };
}

function marry(state, l) {
  const lv = loveInit(state);
  lv.partner = l;
  if (l) delete l.outside;
  state.flags.married = true;
  state.flags.in_love = true;
  state.spouseName = l.name;
  state.spouse = { name: l.name, age: l.age, affinity: l.affinity, alive: true, since: state.age, look: l.look, tp: l.tp, bg: l.bg };
  delete state.flags.dating;
  lv.candidates = lv.candidates.filter(x => x !== l);
  applyEffects(state, { LOVE: 10, SEC: 8, WILL: 3, STRESS: 5, MONEY: -8000000 });
  pushLog(state, `【结婚】你和 ${l.name} 领了证。${state.age}，${fmtYear(state)}。从此人生不再是一个人的战场。`, 'money');
  return { ok: true, spouse: state.spouse };
}

/* ---------- 婚姻生活 ---------- */
function spouseAct(state) {
  if (!state.flags.married) return { ok: false, msg: '你还没有结婚' };
  const sp = state.spouse || (state.spouse = { name: state.spouseName || '爱人', affinity: 60, alive: true });
  if (!sp.alive) return { ok: false, msg: 'TA 已经不在了' };
  const touch = state.socialTouch = state.socialTouch || {};
  if (touch.spouse === state.age) return { ok: false, msg: '今年已经互动过了' };
  touch.spouse = state.age;
  sp.affinity = clamp((sp.affinity || 60) + randInt(3, 7), 0, 100);
  applyEffects(state, { LOVE: 4, STRESS: -5, SEC: 2, MONEY: -400000 });
  pushLog(state, `【夫妻】你和 ${sp.name} 过了一个普通的晚上。婚姻就是把普通的晚上过上几千个。`, 'muted');
  return { ok: true };
}

/* 已婚生育 */
function tryBaby(state) {
  if (!state.flags.married) return { ok: false, msg: '未婚' };
  if (state.age > 45 && state.gender === 'F') return { ok: false, msg: '年纪太大了' };
  if (state.childCount >= 4) return { ok: false, msg: '已经够热闹了' };
  const p = 0.42 - Math.max(0, state.age - 34) * 0.02 - state.stats.STRESS / 500;
  if (!chance(Math.max(0.08, p))) {
    pushLog(state, `【备孕】这一年月子中心又没排上。你们决定顺其自然。`, 'muted');
    return { ok: true, baby: false };
  }
  const kid = (typeof addChild === 'function')
    ? addChild(state)
    : (state.childCount = (state.childCount || 0) + 1, null);
  applyEffects(state, { LOVE: 5, GROW: 3, MONEY: -9000000, STRESS: 6 });
  pushLog(state, `【出生】${kid ? (kid.gender === 'M' ? '儿子 ' : '女儿 ') + kid.name : '第 ' + state.childCount + ' 个孩子'}来到这个世界。${state.spouseName || '伴侣'} 说：像极了你小时候。`, 'money');
  return { ok: true, baby: true };
}

/* ---------- 年度恋爱结算 ---------- */
function loveTick(state) {
  const lv = loveInit(state);
  // 伴侣不在了
  if (state.flags.married && state.spouse && state.spouse.alive) {
    const deathRisk = 0.0012 + Math.max(0, state.spouse.age - 62) * 0.004;
    if (chance(deathRisk)) {
      state.spouse.alive = false;
      state.flags.widowed = true;
      applyEffects(state, { LOVE: -18, SEC: -12 });
      if (typeof addGrief === 'function') addGrief(state, `${state.spouse.name} 走了`, 24);
      pushLog(state, `【永别】${state.spouse.name} 先你一步走了。你们说好要一起变老的。`, 'warn');
    } else {
      state.spouse.age += 1;
      // 婚姻是要经营的：一年到头不闻不问，感情会冷下来
      const touch = state.socialTouch || {};
      if (touch.spouse !== state.age) {
        // 冷落一年才掉一点；好好经营就能稳住（原来是 -2~5，怎么互动都补不回来）
        state.spouse.affinity = clamp((state.spouse.affinity || 60) - randInt(1, 3), 0, 100);
        if (state.spouse.affinity <= 22 && (state.marryCrisisYear || 0) + 3 <= state.age && chance(0.3)) {
          state.marryCrisisYear = state.age;
          state.extraQueue = state.extraQueue || [];
          state.extraQueue.push({ type: 'event', ev: makeMarriageEvent(state) });
        }
      }
    }
  }
  // 候选人：人也在一年年变老
  const dropped = [];
  lv.candidates.forEach(l => {
    l.age = (l.age || state.age) + 1;
    // 偷情 / 长期外遇：每一年都在被发现的风险里
    if (l.secret) {
      const risk = LOVE_META.affairRisk * 0.62 + Math.min(0.18, (state.age - (l.affairSince || state.age)) * 0.02);
      if (chance(risk)) {
        delete l.secret;
        state.extraQueue = state.extraQueue || [];
        state.extraQueue.push({ type: 'event', ev: makeAffairEvent(state, l) });
      }
    }
    // 候选人冷却：长期不联系，好感自然流失
    l.touches = 0;
    if (l.lastTouch !== state.age) l.affinity = clamp(l.affinity - randInt(1, 4), 0, 100);
    // 太多年没见的人，就真的走丢了
    if (l.lastTouch >= 0 && state.age - l.lastTouch > 8 && chance(0.25)) {
      dropped.push(l);
      pushLog(state, `【失联】${l.name} 的消息再也没有出现过。有些人，是你亲自弄丢的。`, 'muted');
    }
  });
  if (dropped.length) {
    lv.candidates = lv.candidates.filter(x => dropped.indexOf(x) < 0);
    if (lv.partner && dropped.indexOf(lv.partner) >= 0) lv.partner = null;
  }
  // 前任：也在一年年变老；不联系就慢慢淡，但比陌生人淡得慢
  exList(state).forEach(ex => {
    ex.age = (ex.age || state.age) + 1;
    if (ex.lastTouch !== state.age) ex.affinity = clamp((ex.affinity || 30) - 1, 0, 100);
  });
  // 偶遇（已婚也会遇上——那是另一回事）
  if (state.age >= 17) meetByChance(state);
  // 别人也会先开口：不是永远只有你在追
  confessTick(state);
}
