/* =========================================================
 * CANGAME · 恋爱 / 婚姻 / 生育系统
 * 偶遇 · 追同学 · 相亲三条来源；好感、颜值、家境、道德都会真正起作用
 * ========================================================= */

const LOVE_META = {
  marryAge: 22,
  marryAffinity: 80,
  touchAffinity: 70, // 好感到此才可能发生亲密关系
  pregnantBase: 0.16,
  dateCost: 800000,
  giftCost: 2500000,
  matchCost: 6000000
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
    affinity: src === '同学' ? randInt(10, 30) : randInt(6, 22),
    alive: true,
    lastTouch: -1,
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
  if (state.age < 16 || state.flags.married) return null;
  const lv = loveInit(state);
  if (lv.candidates.length >= 4) return null;
  if (!chance(0.35)) return null;
  const l = makeLover(state, '偶遇');
  lv.candidates.push(l);
  pushLog(state, `【偶遇】${l.srcText || ''}你遇见了 ${l.name}。${l.age}，${(TEMPERAMENTS.find(t => t.key === l.tp) || {}).label}。这世界很大，但有些人只擦肩一次。`, 'story');
  return l;
}

function meetFromClassmate(state, idx) {
  const c = (state.classmates || [])[idx];
  if (!c) return { ok: false, msg: '没有这位同学' };
  if (state.flags.married) return { ok: false, msg: '你已经结婚了' };
  const lv = loveInit(state);
  const gender = state.gender === 'M' ? 'F' : 'M';
  if (c.gender === state.gender) return { ok: false, msg: '你们只是好朋友' };
  if (lv.candidates.some(x => x.name === c.name)) return { ok: false, msg: 'TA 已经在你的名单里了' };
  const tp = TEMPERAMENTS[randInt(0, TEMPERAMENTS.length - 1)];
  const bg = MATCH_BACKGROUNDS[randInt(0, MATCH_BACKGROUNDS.length - 1)];
  const l = {
    name: c.name, gender: gender, age: state.age + randInt(-2, 2),
    look: c.charm, charm: c.charm, tp: tp.key, bg: bg.key, src: '同学',
    affinity: c.affinity, alive: true, lastTouch: -1, met: state.age, pregnant: false
  };
  lv.candidates.push(l);
  pushLog(state, `【心动】你开始在意 ${l.name} 了。早恋这件事，老师和家长都反对，但你控制不了自己。`, 'story');
  return { ok: true, lover: l };
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
  l.affinity = randInt(18, 34);
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

/* ---------- 互动 ---------- */
function loveAct(state, idx, kind) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (!l.alive) return { ok: false, msg: 'TA 已经不在了' };
  if (l.lastTouch === state.age) return { ok: false, msg: '今年已经见过面了' };
  const s = state.stats;
  if (kind === 'date') {
    if (s.MONEY < LOVE_META.dateCost) return { ok: false, msg: '钱不够约会' };
    s.MONEY -= LOVE_META.dateCost;
    l.lastTouch = state.age;
    const g = randInt(5, 9) + Math.round(s.CHA / 18);
    l.affinity = clamp(l.affinity + g, 0, 100);
    applyEffects(state, { LOVE: 3, STRESS: -4, CHA: 1 });
    pushLog(state, `【约会】你和 ${l.name} 吃了一顿饭，看了场电影。好感 ${Math.round(l.affinity)}%。`, 'muted');
  } else if (kind === 'gift') {
    if (s.MONEY < LOVE_META.giftCost) return { ok: false, msg: '钱不够买礼物' };
    s.MONEY -= LOVE_META.giftCost;
    l.lastTouch = state.age;
    const g = randInt(8, 14) + Math.round(s.CHA / 20);
    l.affinity = clamp(l.affinity + g, 0, 100);
    applyEffects(state, { LOVE: 2, CHA: 1 });
    pushLog(state, `【送礼】你给 ${l.name} 挑了一份礼物。好感 ${Math.round(l.affinity)}%。`, 'muted');
  } else {
    l.lastTouch = state.age;
    const g = randInt(3, 6) + Math.round(s.CHA / 30);
    l.affinity = clamp(l.affinity + g, 0, 100);
    applyEffects(state, { LOVE: 1, NET: 1 });
    pushLog(state, `【聊天】你和 ${l.name} 聊到很晚。好感 ${Math.round(l.affinity)}%。`, 'muted');
  }
  return { ok: true, affinity: l.affinity };
}

/* ---------- 亲密关系与怀孕 ---------- */
function loveIntimate(state, idx) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (state.flags.married) return { ok: false, msg: '你已经结婚了' };
  if (l.affinity < LOVE_META.touchAffinity) return { ok: false, msg: `好感还不够（需 ${LOVE_META.touchAffinity}%）` };
  if (state.age < 16) return { ok: false, msg: '太早了' };
  lv.partner = l;
  state.flags.dating = true;
  state.flags.in_love = true;
  applyEffects(state, { LOVE: 6, SEC: 3, STRESS: 2 });
  const p = LOVE_META.pregnantBase + (l.look / 400) + (state.stats.CHA / 500);
  if (chance(p)) {
    l.pregnant = true;
    return { ok: true, pregnant: true, lover: l };
  }
  pushLog(state, `【亲密】你和 ${l.name} 走到了一起。${state.age < 22 ? '老师要是知道了，会把你叫去办公室。' : ''}`, 'story');
  return { ok: true, pregnant: false };
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
  const need = bg.need * (1 + l.look / 160);
  let p = 0.5 + (l.affinity - LOVE_META.marryAffinity) / 60 + state.stats.CHA / 400
    + (worth >= need ? 0.28 : -0.22) + state.stats.ETH / 600
    + (state.flags.own_house ? 0.12 : 0);
  p = clamp(p, 0.05, 0.95);
  if (!chance(p)) {
    l.affinity = clamp(l.affinity - 12, 0, 100);
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
  state.flags.married = true;
  state.flags.in_love = true;
  state.spouseName = l.name;
  state.spouse = { name: l.name, age: l.age, affinity: l.affinity, alive: true, since: state.age, look: l.look, tp: l.tp, bg: l.bg };
  delete state.flags.dating;
  lv.candidates = lv.candidates.filter(x => x !== l);
  applyEffects(state, { LOVE: 10, SEC: 8, WILL: 3, STRESS: 5, MONEY: -8000000 });
  pushLog(state, `【结婚】你和 ${l.name} 领了证。${state.age}，${fmtYear(state)}。从此人生不再是一个人的战场。`, 'money');
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
  state.childCount = (state.childCount || 0) + 1;
  applyEffects(state, { LOVE: 5, GROW: 3, MONEY: -9000000, STRESS: 6 });
  pushLog(state, `【出生】第 ${state.childCount} 个孩子。${state.spouseName || '伴侣'} 说：像极了你小时候。`, 'money');
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
    }
  }
  // 候选人冷却：长期不联系，好感自然流失
  lv.candidates.forEach(l => {
    if (l.lastTouch !== state.age) l.affinity = clamp(l.affinity - randInt(2, 5), 0, 100);
  });
  // 偶遇
  if (!state.flags.married && state.age >= 17) meetByChance(state);
}
