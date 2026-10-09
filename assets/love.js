/* =========================================================
 * CANGAME · 恋爱 / 婚姻 / 生育系统
 * 偶遇 · 追同学 · 相亲三条来源；好感、颜值、家境、道德都会真正起作用
 * ========================================================= */

const LOVE_META = {
  marryAge: 22,
  marryAffinity: 70,   // 求婚门槛
  touchAffinity: 58,   // 到此才可能发生亲密关系
  closeAffinity: 38,   // v6.2.1：到此才算「有点意思」（仍不是交往）
  confessAffinity: 55, // v6.2.1：到此才够开口表白——认识 ≠ 在一起
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
  const aff = src === '同学' ? randInt(18, 34) : randInt(12, 28);
  const age = clamp(state.age + randInt(-4, 4), 16, 70);
  return {
    name: randomPersonName(gender),
    gender: gender,
    age: age,
    /* v6.4：这个人不是一张空名片 —— TA 有自己的资产、负债和收入 */
    fin: (typeof makeSpouseFin === 'function') ? makeSpouseFin(state, bg.key, age) : null,
    look: look,
    charm: clamp(Math.round(rand(30, 90)), 5, 100),
    tp: tp.key, bg: bg.key, src: src || '偶遇',
    affinity: aff,
    alive: true,
    lastTouch: -1,
    touches: 0,
    met: state.age,
    pregnant: false,
    // v6.2.1：认识一个人 ≠ 在交往。关系要一步步走：met → close → dating
    stage: aff >= LOVE_META.closeAffinity ? 'close' : 'met'
  };
}

function loverLabel(l) {
  const t = TEMPERAMENTS.find(x => x.key === l.tp) || { label: '' };
  const b = MATCH_BACKGROUNDS.find(x => x.key === l.bg) || { label: '' };
  return `${l.name} · ${l.age} · ${t.label} · ${b.label} · 颜值 ${l.look}`;
}

/* ---------- v6.2.1 关系阶段：刚认识 / 有点意思 / 交往中 ----------
 * 现实常识：认识一个人，和跟一个人在一起，是两件事。
 * 中间隔着好几次见面、几次试探，和一句得由谁先开口的话。 */
const STAGE_LABEL = { met: '刚认识', close: '有点意思', dating: '交往中', secret: '见不得光' };

function loverStage(state, l) {
  if (!l) return 'met';
  if (l.secret) return 'secret';
  if (l.stage === 'dating') return 'dating';
  // 旧存档兼容：没有 stage 字段时，按「是不是现任 + 好感」推断
  if (l.stage === undefined || l.stage === null) {
    const lv = loveInit(state);
    if (lv.partner === l && state.flags.dating) return 'dating';
    if (lv.partner === l) return 'close';
  }
  return (l.affinity || 0) >= LOVE_META.closeAffinity ? 'close' : 'met';
}

function stageText(state, l) { return STAGE_LABEL[loverStage(state, l)] || '刚认识'; }

/* 表白：把「有点意思」变成「在一起」。不一定成功，失败要等一年 */
function confessTo(state, idx) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (l.alive === false) return { ok: false, msg: 'TA 已经不在了' };
  if (state.flags.married) return { ok: false, msg: '你已经结婚了——那不叫表白，叫越界' };
  if (loverStage(state, l) === 'dating') return { ok: false, msg: '你们已经在一起了' };
  if (state.flags.dating && lv.partner && lv.partner !== l) return { ok: false, msg: '你已经有人了，先和 TA 说清楚' };
  if (state.age < 16) return { ok: false, msg: '再大一点再说' };
  if ((l.confessFailYear || 0) + 1 > state.age) return { ok: false, msg: '上次被拒还没缓过来，明年再开口吧' };
  if ((l.affinity || 0) < LOVE_META.confessAffinity) {
    return { ok: false, msg: `还不到开口的时候（现在 ${Math.round(l.affinity || 0)}%，需 ${LOVE_META.confessAffinity}%）——多见几次面` };
  }
  const s = state.stats;
  const rb = (typeof rideBonus === 'function') ? rideBonus(state) : { flirtP: 0 };
  let p = 0.30 + ((l.affinity || 0) - LOVE_META.confessAffinity) / 95
    + (s.CHA || 40) / 340 + ((l.look || 60) - 60) / 500 + (rb.flirtP || 0);
  if (l.tp === 'romantic') p += 0.06;
  if (l.tp === 'cool') p -= 0.06;
  if ((s.ETH || 60) < 30) p -= 0.05;   // 名声太差，别人家里会拦
  p = clamp(p, 0.12, 0.92);
  if (!chance(p)) {
    l.confessFailYear = state.age;
    l.affinity = clamp((l.affinity || 0) - 12, 0, 100);
    applyEffects(state, { MOOD: -6, STRESS: 5, LOVE: -3, WILL: -1 });
    pushLog(state, `【表白被拒】你把话说出口了。${l.name} 沉默了一会儿，说：「我们……还是这样比较好吧。」\n` +
      `你笑着说没事，然后把手机放回了口袋。有些话一年只能说一次。`, 'warn');
    return { ok: false, msg: '被拒绝了', p: p };
  }
  l.stage = 'dating';
  lv.partner = l;
  state.flags.dating = true;
  state.flags.in_love = true;
  applyEffects(state, { LOVE: 8, MOOD: 6, SEC: 3, STRESS: -3 });
  pushLog(state, `【在一起】${state.age} 岁这年，你先开的口。${l.name} 说：「好啊。」\n` +
    `从今往后，通讯录里多了一个置顶。`, 'money');
  return { ok: true, p: p };
}

/* 断联：还没在一起的人，走了就走了，不算前任 */
function dropAcquaintance(state, idx) {
  const lv = loveInit(state);
  const l = lv.candidates[idx];
  if (!l) return { ok: false, msg: '没有这个人' };
  if (loverStage(state, l) === 'dating') return { ok: false, msg: '你们在一起了——要走就走分手流程' };
  if (l.pregnant) return { ok: false, msg: 'TA 怀着你的孩子，这时候走不掉' };
  lv.candidates.splice(idx, 1);
  if (lv.partner === l) { lv.partner = null; delete state.flags.dating; }
  delete l.secret;
  pushLog(state, `【断联】你和 ${l.name} 慢慢就不联系了。通讯录里那个名字还在，只是再也没拨过。`, 'muted');
  return { ok: true };
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
    outside: !!state.flags.married,
    stage: 'met'   // v6.2.1：开始在意 ≠ 在一起
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
  l.stage = l.affinity >= LOVE_META.closeAffinity ? 'close' : 'met';
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
  bumpSuspicion(state, 8, '你最近心不在焉');
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
    l.stage = 'close';
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
  const q = clamp(Math.round((state.stats.CHA * 0.4 + state.stats.FAME * 0.6 + Math.sqrt(Math.max(0, worth) / 1e8) * 6 + state.stats.ETH * 0.2) / 2), 10, 95);
  l.look = clamp(Math.round((l.look + q) / 2), 10, 98);
  l.charm = clamp(Math.round((l.charm + q) / 2), 10, 98);
  l.affinity = randInt(26, 42);
  l.stage = l.affinity >= LOVE_META.closeAffinity ? 'close' : 'met';
  lv.candidates.push(l);
  pushLog(state, `【相亲】媒人安排了一次见面：${loverLabel(l)}。你付了介绍费 ${fmtMoney(LOVE_META.matchCost)}。` +
    `介绍人临走时说：「处着看，别着急。」`, 'story');
  return { ok: true, lover: l };
}

/* v6.2.1：这个函数以前叫「确保有个对象」——认识一个人就直接置为交往，
 * 太跳了。现在它只负责「让你认识一个人」，后面的路要自己走。 */
function ensureLover(state, src) {
  const lv = loveInit(state);
  const l = makeLover(state, src || '偶遇');
  l.affinity = randInt(30, 46);
  l.stage = l.affinity >= LOVE_META.closeAffinity ? 'close' : 'met';
  lv.candidates.push(l);
  return l;
}

/* 好感涨上来之后，关系自动从「刚认识」推进到「有点意思」（但不会自动交往） */
function syncStage(state, l) {
  if (!l || l.secret || l.stage === 'dating') return;
  l.stage = (l.affinity || 0) >= LOVE_META.closeAffinity ? 'close' : 'met';
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
  const before = loverStage(state, l);
  l.affinity = clamp(l.affinity + gain, 0, 100);
  syncStage(state, l);
  const n = LOVE_META.touchesPerYear - l.touches;
  // 阶段跨越要有一句叙事，不然玩家不知道关系推进了
  if (before === 'met' && loverStage(state, l) === 'close') {
    pushLog(state, `【有点意思】你发现 ${l.name} 回消息的速度变快了。\n` +
      `你们还没说破什么，但每次见面的时间都在变长。`, 'story');
  }
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
  // v6.2.1：没确定关系之前，这一步走不过去——除了已婚状态下的越界（那是另一回事）
  if (!married && !l.secret && loverStage(state, l) !== 'dating') {
    return { ok: false, msg: `你们还没在一起。先开口把关系定下来（好感 ${LOVE_META.confessAffinity}% 就能表白）` };
  }
  if (safe) {
    const cost = LOVE_META.safeCost;
    if (state.stats.MONEY < cost) return { ok: false, msg: '连这个钱都拿不出来' };
    state.stats.MONEY -= cost;
  }
  // 已婚时不要把情人设成「现任」——现任另有其人
  if (!married) { l.stage = 'dating'; lv.partner = l; state.flags.dating = true; state.flags.in_love = true; }
  applyEffects(state, { LOVE: safe ? 5 : 6, SEC: married ? -4 : 3, STRESS: married ? 6 : 2 });

  if (married) {
    // 婚内出轨：道德、名声与家庭一起付出代价，还有被发现的风险
    applyEffects(state, { ETH: -12, FAME: -4 });
    if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 5, 0, 100);
    l.outside = true;
    bumpSuspicion(state, randInt(6, 14), '深夜没回家');
    pushLog(state, `【越界】你和 ${l.name} 走到了一起。回家时你在楼下站了很久才敢上楼。`, 'warn');
    // v6.2：婚外情也会怀孕——这一步是有后果的，不是只有道德扣分的过场动画
    const pp = safe ? LOVE_META.safePregnant * 3
      : (LOVE_META.pregnantBase * 0.85 + (l.look / 450) + (state.stats.CHA / 600));
    if (chance(pp)) {
      l.pregnant = true;
      l.illegitPreg = true;
      pushLog(state, `【出事了】${l.name} 说她怀孕了。你们都清楚，这个孩子不能姓你家的姓——至少现在还不能。`, 'warn');
      return { ok: true, pregnant: true, illegit: true, affair: true, lover: l };
    }
    if (chance(LOVE_META.affairRisk)) {
      state.queue = state.queue || [];
      state.extraQueue = state.extraQueue || [];
      state.extraQueue.push({ type: 'event', ev: makeAffairEvent(state, l) });
      return { ok: true, pregnant: false, affair: true, caught: true };
    }
    return { ok: true, pregnant: false, affair: true, caught: false };
  }

  const p = safe ? LOVE_META.safePregnant : (LOVE_META.pregnantBase + (l.look / 400) + (state.stats.CHA / 250));
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
  // v6.4：家庭账簿清算——共同积累对半分，婚前财产与婚前债务各归各
  const hset = (typeof settleHouseholdOnDivorce === 'function')
    ? settleHouseholdOnDivorce(state, reason === '不忠' || reason === '家暴' || !!(state.flags && state.flags.exposed))
    : null;
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
  if (hset) {
    pushLog(state, `【清算】婚后共同积累 ${fmtMoney(hset.joint)}，你拿回 ${fmtMoney(hset.got)}；` +
      `${sp.name} 婚前的资产和 TA 名下那笔债，都跟着 TA 走了。`, 'money');
  }
  if (typeof addGrief === 'function') addGrief(state, `和 ${sp.name} 离婚`, 10);
  return { ok: true, paid: paid, lost: lost, hset: hset, ex: (state.exes || [])[0] };
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
  delete l.stage;
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
    met: ex.met || state.age, pregnant: false, stage: 'dating'
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
  let p = 0.62 + (l.affinity - LOVE_META.marryAffinity) / 50 + state.stats.CHA / 160
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
  const fin = (l && l.fin) || makeSpouseFin(state, l ? l.bg : 'mid', l ? l.age : state.age);
  state.spouse = {
    name: l.name, age: l.age, affinity: l.affinity, alive: true, since: state.age,
    look: l.look, tp: l.tp, bg: l.bg, fin: fin
  };
  delete state.flags.dating;
  lv.candidates = lv.candidates.filter(x => x !== l);
  applyEffects(state, { LOVE: 10, SEC: 8, WILL: 3, STRESS: 5, MONEY: -8000000 });

  /* v6.4：结婚 = 两个人的账簿合成一本。婚前财产仍归各自，但从此一起过日子 */
  const h = householdInit(state);
  h.spAssets = fin.assets; h.spDebt = fin.debt; h.spIncome = fin.income;
  h.spAssets0 = fin.assets; h.spDebt0 = fin.debt; h.joint = 0; h.since = state.age;
  delete h.settled;

  pushLog(state, `【结婚】你和 ${l.name} 领了证。${state.age}，${fmtYear(state)}。从此人生不再是一个人的战场。`, 'money');
  pushLog(state, `【两家并一家】${l.name} 带过来名下资产 ${fmtMoney(fin.assets)}` +
    `${fin.debt > 0 ? `，以及一笔 ${fmtMoney(fin.debt)} 的婚前债务——法律上算 TA 自己的，可日子是两个人过` : '，没有负债'}` +
    `。TA 一年挣 ${fmtMoney(fin.income)}。`, 'money');
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

/* 已婚生育
 * v6.2：男女都有生育窗口——不是只有女人才会老，男人过了 68 也很勉强；
 * 高龄产妇有真实的身体代价；小概率双胞胎。 */
function tryBaby(state) {
  if (!state.flags.married) return { ok: false, msg: '未婚' };
  if (state.childCount >= 5) return { ok: false, msg: '已经够热闹了' };
  const me = (typeof fertility === 'function') ? fertility(state, state.gender, state.age) : { p: 0.42, why: '' };
  if (me.p <= 0) return { ok: false, msg: me.why || '这个年纪已经不可能了' };
  const spAge = (state.spouse && state.spouse.age) || state.age;
  const spG = state.gender === 'M' ? 'F' : 'M';
  const ta = (typeof fertility === 'function') ? fertility(state, spG, spAge) : { p: 0.42, why: '' };
  if (ta.p <= 0) return { ok: false, msg: `对方${ta.why ? '：' + ta.why : '也已经不行了'}` };
  const p = Math.max(0, Math.min(me.p, ta.p));
  if (!chance(p)) {
    pushLog(state, `【备孕】这一年月子中心又没排上。你们决定顺其自然。`, 'muted');
    return { ok: true, baby: false, p: p };
  }
  // 高龄产妇：能生，但要拿身体换
  const risk = (typeof maternityRisk === 'function') ? maternityRisk(state, state.age) : 0;
  if (risk > 0 && chance(risk)) {
    applyEffects(state, { HP: -14, STRESS: 14, MOOD: -6 });
    pushLog(state, `【高龄产褥】产后大出血，抢救室的灯亮了一整夜。母子平安——但医生说，你的身体从此不一样了。`, 'warn');
  }
  const kid = (typeof addChild === 'function')
    ? addChild(state)
    : (state.childCount = (state.childCount || 0) + 1, null);
  applyEffects(state, { LOVE: 5, GROW: 3, MONEY: -9000000, STRESS: 6 });
  pushLog(state, `【出生】${kid ? (kid.gender === 'M' ? '儿子 ' : '女儿 ') + kid.name : '第 ' + state.childCount + ' 个孩子'}来到这个世界。${state.spouseName || '伴侣'} 说：像极了你小时候。`, 'money');
  // 双胞胎：年纪越轻概率越高
  const twinP = state.age <= 32 ? 0.014 : (state.age <= 38 ? 0.008 : 0.002);
  if (chance(twinP)) {
    const kid2 = (typeof addChild === 'function') ? addChild(state, { gender: kid && kid.gender === 'M' ? 'F' : 'M' }) : null;
    if (kid2) {
      applyEffects(state, { LOVE: 4, MONEY: -6000000, STRESS: 4 });
      state.flags.twins = true;
      pushLog(state, `【双胞胎】B 超室里医生说：「两个心跳。」\n` +
        `${kid ? kid.name : ''} 和 ${kid2.name}，从此你们家的开销也要乘二。`, 'money');
      return { ok: true, baby: true, twins: true };
    }
  }
  return { ok: true, baby: true, p: p };
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
      // v6.4：限定继承——遗产范围内还债，超出部分不用你扛
      const hs = (typeof settleHouseholdOnDeath === 'function') ? settleHouseholdOnDeath(state) : null;
      if (hs && (hs.estate > 0 || hs.debt > 0)) {
        pushLog(state, `【继承】${state.spouse.name} 留下的账簿：遗产 ${fmtMoney(hs.estate)}，债务 ${fmtMoney(hs.debt)}。` +
          (hs.limited ? '按限定继承，超出的部分你不用替 TA 还。' : '') + `你实际接手 ${fmtMoney(hs.got)}。`, 'money');
      }
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
    // 偷情 / 长期外遇：v6.2 起不再在这里单独摇骰——
    // 曝光统一交给 crisisTick() 按「社会地位 + 圈层 + 私生子 + 怀疑度」算出来的曝光率判定，
    // 否则两条线会重复触发，玩家会觉得「怎么年年被抓」。这里只负责让关系继续留下痕迹。
    if (l.secret && state.flags.married) {
      bumpSuspicion(state, 2 + Math.min(4, Math.max(0, state.age - (l.affairSince || state.age))), null);
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

/* =========================================================
 * v6.2.0 · 非婚生子女与动态情感危机系统
 *
 * 设计原则（常识自洽）：
 *   1) 有其利必有其弊 —— 婚外情能生孩子，孩子就要吃穿、要名分、要继承权
 *   2) 因果闭环       —— 越有名、圈层越高、秘密越多，越藏不住
 *   3) NPC 行为对等   —— 配偶不是数据：会起诉、会原谅、会记仇、也会反过来出轨
 * ========================================================= */

const CRISIS_META = {
  exposureBase: 0.09,     // 有秘密在身时的年度基础曝光率
  fameK: 0.0048,          // 每点名望推高的曝光率（名人没有隐私）
  clubK: 0.045,           // 每个圈层（圈子里人多嘴杂）
  secretK: 0.05,          // 每段偷情关系
  childK: 0.06,           // 每个未认领的私生子（孩子在长大，纸包不住火）
  houseK: 0.03,           // 名下有豪宅（物业、司机、邻居都在看）
  richK: 0.05,            // 净资产 10 亿以上
  suspicionDecay: 9,      // 没有秘密时，配偶的怀疑每年自然回落
  suspicionMax: 100,
  supportCost: 9000000,   // 每个「养在外面」的孩子一年要花的钱
  ackCost: 60000000       // 认领入户的一次性代价（户口、抚养费、场面上的账）
};

/* ---------- 配偶的怀疑度：不是随机雷，是你一点点堆出来的 ---------- */
function suspicionOf(state) {
  const sp = state.spouse;
  if (!sp) return 0;
  return clamp(sp.suspicion || 0, 0, CRISIS_META.suspicionMax);
}

function bumpSuspicion(state, n, why) {
  if (!state.spouse) return 0;
  state.spouse.suspicion = clamp((state.spouse.suspicion || 0) + n, 0, CRISIS_META.suspicionMax);
  const s = state.spouse.suspicion;
  if (s >= 70 && (state.suspectWarnYear || 0) !== state.age) {
    state.suspectWarnYear = state.age;
    pushLog(state, `【察觉】${state.spouse.name} 没有问你什么，但最近家里的空气不一样了。` +
      `${why ? '（' + why + '）' : ''}怀疑这种东西，攒够了就会变成结论。`, 'warn');
  }
  return s;
}

/* ---------- 年度曝光率：社会地位越高，越藏不住 ---------- */
function exposureRate(state) {
  const lv = loveInit(state);
  const secrets = (lv.candidates || []).filter(x => x.secret || x.illegitPreg).length;
  const illegits = illegitChildren(state).filter(c => !c.ack).length;
  const clubs = (state.clubs || []).length;
  const fame = Math.max(0, state.stats.FAME || 0);
  const net = (typeof netWorth === 'function') ? netWorth(state) : (state.stats.MONEY || 0);
  let p = CRISIS_META.exposureBase;
  p += fame * CRISIS_META.fameK;
  p += secrets * CRISIS_META.secretK;
  p += illegits * CRISIS_META.childK;
  p += clubs * CRISIS_META.clubK;
  if (state.flags.gangnam_owner) p += CRISIS_META.houseK;
  if (net >= 1000000000) p += CRISIS_META.richK;
  const sp = state.spouse || {};
  if (sp.tp === 'fire') p += 0.05;          // 要强的人会盯着你
  else if (sp.tp === 'cool') p -= 0.03;     // 冷淡的人懒得管
  else if (sp.tp === 'warm') p -= 0.01;
  p -= clamp(((sp.affinity || 60) - 60) / 500, -0.04, 0.04);   // 感情好就更信你
  p += (suspicionOf(state) / 100) * 0.18;                       // 怀疑本身会变成证据
  return clamp(p, 0.01, 0.88);
}

/* ---------- 非婚生子女 ---------- */
function illegitChildren(state) {
  return (state.children || []).filter(c => c.illegit && c.alive !== false);
}
/* 养在外面、没名分的孩子 */
function hiddenChildren(state) {
  return illegitChildren(state).filter(c => !c.ack);
}

/* 生下私生子：ack=true 立刻认领入户；否则养在外面，年年要钱，年年有风险 */
function bearIllegitimate(state, l, ack) {
  const kid = (typeof addChild === 'function') ? addChild(state, {}) : null;
  if (kid) {
    kid.illegit = true;
    kid.outside = true;                 // 婚外所生（生母不是配偶）
    kid.mother = l ? l.name : '生母不详';
    kid.ack = !!ack;
    kid.hidden = !ack;
  }
  if (l) { l.pregnant = false; l.illegitPreg = false; l.hiddenChild = !ack; }
  return kid;
}

/* 私生子三选一 */
function makeIllegitEvent(state, l) {
  const sp = state.spouse || { name: '你爱人' };
  return {
    id: 'illegit_at_' + state.age,
    loverName: l ? l.name : null,
    age: [16, 200], w: 0,
    text: `【私生子】${l ? l.name : '那个人'} 把化验单推到你面前，手一直在抖。\n` +
      `你算了一下日子——这个孩子，进不了${sp.name === '你爱人' ? '你家' : sp.name + '家'}的门。\n` +
      `你可以认，可以不认，也可以让它从来没来过。三条路，都要用一辈子去还。`,
    choices: [
      {
        text: '认下来：给孩子一个名分（户口、抚养费、家里的风浪）', risk: 3,
        eff: { ETH: 4, WILL: 6, SEC: -10, STRESS: 14, FAME: -6, MONEY: -CRISIS_META.ackCost },
        flags: ['illegit_ack']
      },
      {
        text: '瞒着：在外面养着，每月打钱', risk: 3,
        eff: { ETH: -8, SEC: -5, STRESS: 10, MONEY: -8000000 },
        flags: ['illegit_hide']
      },
      {
        text: '断干净：给一笔钱，从此两清', risk: 2,
        eff: { ETH: -22, LOVE: -10, MOOD: -8, WILL: -4, MONEY: -60000000 },
        flags: ['illegit_drop']
      }
    ]
  };
}

/* 认领 / 补办认领手续 */
function acknowledgeChild(state, i) {
  const c = (state.children || [])[i];
  if (!c) return { ok: false, msg: '没有这个孩子' };
  if (!c.illegit) return { ok: false, msg: '这个孩子本来就在户口本上' };
  if (c.ack) return { ok: false, msg: '已经认过了' };
  if (state.stats.MONEY < CRISIS_META.ackCost) return { ok: false, msg: `认领要花的钱不够（需 ${fmtMoney(CRISIS_META.ackCost)}）` };
  state.stats.MONEY -= CRISIS_META.ackCost;
  c.ack = true;
  c.hidden = false;
  applyEffects(state, { ETH: 5, WILL: 4, SEC: -6, STRESS: 10, FAME: -4 });
  pushLog(state, `【认领】你在派出所门口站了一个上午。${c.name} 的户口落到了你的名下——` +
    `从此 TA 与婚生子女享有同等权利，包括将来分这个家。${c.mother ? `生母是 ${c.mother}。` : ''}`, 'story');
  // 家里那位不会不知道
  if (state.flags.married && state.spouse) {
    bumpSuspicion(state, 45, '户口本上多了一个人');
    state.spouse.affinity = clamp((state.spouse.affinity || 60) - 18, 0, 100);
    pushLog(state, `【风浪】${state.spouse.name} 迟早会知道。户口本这种东西，藏不住。`, 'warn');
  }
  return { ok: true, child: c };
}

/* 每个「养在外面」的孩子每年要花的钱（生活费 + 封口费） */
function illegitSupportCost(state) {
  return hiddenChildren(state).length * CRISIS_META.supportCost;
}

/* ---------- 动态情感危机：年度曝光判定 ---------- */
function crisisTick(state) {
  if (!state.flags.married || !state.spouse || !state.spouse.alive) return null;
  if (state.prison > 0) return null;
  if (state.crisisYear === state.age) return null;   // 一年只炸一次
  const lv = loveInit(state);
  const secrets = (lv.candidates || []).filter(x => x.secret);
  const hid = hiddenChildren(state);
  const pending = (lv.candidates || []).filter(x => x.illegitPreg);
  if (!secrets.length && !hid.length && !pending.length) {
    if (state.spouse.suspicion) state.spouse.suspicion = Math.max(0, state.spouse.suspicion - CRISIS_META.suspicionDecay);
    return null;
  }
  // 秘密每多存在一年，就多一年的痕迹
  bumpSuspicion(state, randInt(3, 9) + secrets.length * 3 + hid.length * 5, null);
  const p = exposureRate(state);
  if (!chance(p)) return null;
  // 从哪条线炸的：偷情关系，还是那个藏了很久的孩子
  const viaChild = hid.length > 0 && (chance(0.4) || !secrets.length);
  const ctx = viaChild
    ? { via: 'child', name: hid[0] ? hid[0].name : '那个孩子', childIdx: state.children.indexOf(hid[0]) }
    : { via: 'lover', name: secrets.length ? secrets[0].name : (pending[0] ? pending[0].name : '那个人') };
  state.crisisYear = state.age;
  state.flags.exposed = true;
  state.extraQueue = state.extraQueue || [];
  state.extraQueue.push({ type: 'event', ev: makeExposureEvent(state, ctx) });
  return ctx;
}

/* 东窗事发：先由你决定怎么应对，再由配偶决定怎么处置你 */
function makeExposureEvent(state, ctx) {
  const sp = state.spouse || { name: '你爱人' };
  const via = ctx && ctx.via;
  const who = ctx && ctx.name;
  const head = via === 'child'
    ? `【曝光 · 孩子】一个孩子站在门口，长得和你小时候一模一样。${sp.name} 看了很久，问：「这是谁家的？」\n纸包不住火——${who} 的事，终于有人说了出来。`
    : `【曝光 · 偷情】${sp.name} 把一叠打印出来的聊天记录放在餐桌上，按时间排好了序。\n「${who} 是谁。」这不是问句。`;
  const buy = Math.round(Math.max(0, ((typeof netWorth === 'function') ? netWorth(state) : state.stats.MONEY)) * 0.15);
  return {
    id: 'expose_at_' + state.age,
    age: [16, 200], w: 0,
    exposeVia: via || 'lover',
    exposeName: who || null,
    exposeBuy: buy,
    text: head + `\n外面的门关着，里面的门也关上了。你只有三分钟决定怎么开口。`,
    choices: [
      { text: '全部承认：任 TA 处置', risk: 3, eff: { ETH: 3, WILL: 4, SEC: -8, STRESS: 14 }, flags: ['expose_admit'] },
      { text: '抵赖到底：死不认账', risk: 3, eff: { ETH: -10, WILL: -3, SEC: -4, STRESS: 16 }, flags: ['expose_deny'] },
      { text: `用钱摆平：${fmtMoney(buy)} 买一个「算了」`, risk: 2, eff: {}, flags: ['expose_buy'] },
      { text: '先下手为强：是我不想过了，离吧', risk: 3, eff: { LOVE: -16, SEC: -12, STRESS: 12, ETH: -6 }, flags: ['expose_leave'] }
    ]
  };
}

/* 配偶的裁决：按性格、感情、你的名声、有没有私生子，动态决定走哪条路 */
function spouseVerdict(state, force) {
  const sp = state.spouse || {};
  const tp = sp.tp || 'warm';
  const aff = sp.affinity || 60;
  const fame = Math.max(0, state.stats.FAME || 0);
  const hid = hiddenChildren(state).length;
  const net = (typeof netWorth === 'function') ? netWorth(state) : (state.stats.MONEY || 0);
  const w = { sue: 1.0, forgive: 1.0, coexist: 1.0, blacklist: 1.0 };
  if (tp === 'fire') { w.sue *= 2.2; w.forgive *= 0.5; }
  if (tp === 'cool') { w.sue *= 1.4; w.coexist *= 1.6; w.forgive *= 0.7; }
  if (tp === 'warm') { w.forgive *= 2.0; w.sue *= 0.6; }
  if (tp === 'practical') { w.coexist *= 1.9; w.sue *= 0.9; }
  if (tp === 'romantic') { w.forgive *= 1.4; w.coexist *= 1.2; }
  if (tp === 'fun') { w.blacklist *= 1.5; w.coexist *= 1.2; }
  if (aff >= 78) { w.forgive *= 1.8; w.sue *= 0.45; }
  else if (aff <= 40) { w.sue *= 2.0; w.forgive *= 0.4; }
  if (hid > 0) { w.sue *= 1.8; w.forgive *= 0.6; }              // 有私生子，几乎没有原谅可言
  if (fame >= 60 || net >= 2000000000) w.blacklist *= 2.0;      // 你越有名，TA 越能用舆论
  if ((state.stats.ETH || 60) >= 78) { w.forgive *= 1.3; w.sue *= 0.85; }
  if (state.flags.spouse_terms) { w.forgive *= 0.35; w.sue *= 2.0; }  // 再犯一次，就没有第二次机会
  if (force) return force;
  let total = 0; for (const k in w) total += w[k];
  let r = Math.random() * total;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'sue';
}

/* ① 起诉离婚 + 财产强行分割 + 名誉封杀 */
function spouseSue(state, why) {
  const sp = state.spouse || { name: state.spouseName || '爱人', affinity: 30 };
  const worth = Math.max(0, (typeof netWorth === 'function') ? netWorth(state) : state.stats.MONEY);
  const ratio = clamp(0.5 + (state.stats.FAME || 0) / 400 + hiddenChildren(state).length * 0.06, 0.5, 0.72);
  const want = Math.round(worth * ratio);
  const paid = Math.min(want, Math.max(0, state.stats.MONEY));
  state.stats.MONEY -= paid;
  // 起诉离婚：财产分割之外，还有名誉
  applyEffects(state, { LOVE: -30, SEC: -22, MOOD: -14, STRESS: 18, FAME: -22, ETH: -12, HP: -5 });
  state.clubs = [];                      // 圈层把你除名了
  state.flags.sued = true;
  state.flags.blacklisted = true;
  delete state.flags.married;
  delete state.flags.in_love;
  state.flags.divorced = true;
  state.exes = state.exes || [];
  state.exes.unshift({
    name: sp.name, gender: state.gender === 'M' ? 'F' : 'M', age: sp.age,
    met: sp.since || state.age, at: state.age, reason: why || '起诉离婚',
    wasSpouse: true, affinity: clamp((sp.affinity || 40) - 45, 0, 30), look: sp.look || 60, lastTouch: -1
  });
  if (state.exes.length > 5) state.exes.length = 5;
  state.spouse = null; state.spouseName = null;
  // 偷情对象：法院的卷宗里也有名字了
  const lv = loveInit(state);
  lv.candidates = lv.candidates.filter(x => !x.secret);
  lv.partner = null;
  pushLog(state, `【起诉离婚】${sp.name} 请了律师。财产分割 ${fmtMoney(paid)}（约为你净资产的 ${Math.round(ratio * 100)}%）——` +
    `这不是「分一半」，这是法院判的。你要付的还不止钱：圈层除名、名声扫地，${why ? '事由写着「' + why + '」' : ''}。`, 'warn');
  if (typeof addGrief === 'function') addGrief(state, `被 ${sp.name} 起诉离婚`, 16);
  return { ok: true, paid: paid, ratio: ratio };
}

/* ② 原谅：留在这个家，但要带条件 */
function spouseForgive(state) {
  const sp = state.spouse;
  applyEffects(state, { ETH: 4, LOVE: -6, SEC: -6, MOOD: -6, STRESS: 10 });
  sp.affinity = clamp((sp.affinity || 60) - 22, 8, 100);
  sp.suspicion = 55;
  state.flags.spouse_terms = true;
  state.spouseTermsYear = state.age;
  pushLog(state, `【原谅】${sp.name} 哭了一整夜，最后说：「最后一次。」\n` +
    `条件是：家里的账本归 TA 管，你每月的生活费要报账，手机不许设密码。你们还住在一起，但这个家从此有了规矩。`, 'warn');
  return { ok: true };
}

/* ③ 睁一只眼闭一只眼：婚姻名存实亡——而 TA 也不是省油的灯 */
function spouseCoexist(state) {
  const sp = state.spouse;
  applyEffects(state, { LOVE: -12, SEC: -14, MOOD: -8, ETH: -4 });
  sp.affinity = clamp((sp.affinity || 60) - 12, 5, 100);
  sp.suspicion = 40;
  sp.affair = true;              // NPC 对等：你会的，TA 也会
  sp.affairSince = state.age;
  state.flags.open_marriage = true;
  pushLog(state, `【共处】${sp.name} 什么都没说，只是从那天起不再问你几点回家。\n` +
    `你们像两个合租的陌生人，客气、疏远、互不干涉。你想：这样也好。\n` +
    `——直到你也开始好奇，TA 那些晚归的晚上去了哪里。`, 'warn');
  return { ok: true };
}

/* ④ 社会名誉封杀：婚不离婚，但你在社会意义上已经死了 */
function spouseBlacklist(state) {
  const sp = state.spouse;
  const before = Math.round(state.stats.FAME || 0);
  const cut = Math.max(12, Math.round(before * 0.55));
  applyEffects(state, { FAME: -cut, NET: -14, LOY: -16, MOOD: -10, SEC: -8, STRESS: 14 });
  state.clubs = [];
  state.flags.blacklisted = true;
  if (state.spouse) state.spouse.affinity = clamp((state.spouse.affinity || 60) - 16, 5, 100);
  pushLog(state, `【封杀】${sp.name} 没有提离婚，只是把该说的都说了出去。\n` +
    `圈子里没人再接你电话，商会撤销了你的席位，合作方在合同上按了手印又抽回去。\n` +
    `名望 ${before} → ${Math.round(state.stats.FAME || 0)}。你还活着，只是没人再提你的名字。`, 'warn');
  return { ok: true, cut: cut };
}


/* =========================================================
 * v6.4.0 配偶资产 / 负债并入家庭
 * ---------------------------------------------------------
 * 以前结婚只是「多了一个人」：配偶没有钱、没有债、没有收入，
 * 于是「娶了个家世显赫的人」和「娶了个家境一般的人」在账簿上
 * 完全等价 —— 婚姻这件事在数值上是空的。
 *
 * 现在每个可婚对象在生成时就带着一份自己的资产负债表：
 *   · 名下资产（婚前个人财产，离婚时 TA 带走）
 *   · 婚前债务（法律上是个人债，但日子是两个人过 —— 用共同收入逐年还）
 *   · 年收入（婚后按 55% 进家庭现金，剩下的 TA 自己支配）
 * 婚后每年结算一次（spouseFinTick），离婚 / 身故各有清算规则。
 * ========================================================= */
const SPOUSE_FIN = {
  poor: { assets: [0, 5000000], debtP: 0.34, debt: [1000000, 10000000], income: [2000000, 4000000] },
  mid: { assets: [5000000, 25000000], debtP: 0.24, debt: [3000000, 20000000], income: [3500000, 6000000] },
  rich: { assets: [30000000, 120000000], debtP: 0.20, debt: [10000000, 80000000], income: [5000000, 9000000] },
  top: { assets: [150000000, 800000000], debtP: 0.18, debt: [30000000, 200000000], income: [8000000, 15000000] }
};

function makeSpouseFin(state, bgKey, age) {
  const t = SPOUSE_FIN[bgKey] || SPOUSE_FIN.mid;
  const scale = (typeof tableAt === 'function' && typeof FIN_SCALE !== 'undefined') ? tableAt(FIN_SCALE, fmtYear(state)) : 1;
  // 年纪越大，攒下的越多；22 岁是基准，50 岁约为 1.8 倍
  const ageK = clamp(0.55 + Math.max(0, (age || 24) - 22) * 0.035, 0.55, 1.9);
  const assets = Math.round(rand(t.assets[0], t.assets[1]) * scale * ageK);
  const debt = chance(t.debtP) ? Math.round(rand(t.debt[0], t.debt[1]) * scale) : 0;
  const income = Math.round(rand(t.income[0], t.income[1]) * scale);
  return { assets: assets, debt: debt, income: income, scale: scale };
}

/* 家庭账簿口径：
 *  · spAssets 是配偶**名下**的资产 —— 不在你的现金里，但也是这个家的一部分，
 *    算进净资产（离婚时 TA 带走，身故时按限定继承结给你）；
 *  · joint 只是「婚后共同积累了多少」的流水账，钱早已进过现金，
 *    **不能**再算一次净资产，否则就是重复计数。 */
function householdNet(state) {
  const h = state.household;
  if (!h) return 0;
  return Math.round((h.spAssets || 0) - (h.spDebt || 0));
}
function householdInit(state) {
  if (state.household) return state.household;
  state.household = { spAssets: 0, spDebt: 0, spIncome: 0, joint: 0, since: state.age, spAssets0: 0, spDebt0: 0 };
  return state.household;
}

/* 婚后每一年的家庭财务结算 */
function spouseFinTick(state) {
  /* 老存档 / 事件直接塞进来的配偶没有账簿：按 TA 的家境补一份，别让婚姻在数值上是空的 */
  if (!state.household && state.flags && state.flags.married && state.spouse && state.spouse.alive !== false) {
    const fin = state.spouse.fin || makeSpouseFin(state, state.spouse.bg || 'mid', state.spouse.age || state.age);
    state.spouse.fin = fin;
    const h = householdInit(state);
    h.spAssets = fin.assets; h.spDebt = fin.debt; h.spIncome = fin.income;
    h.spAssets0 = fin.assets; h.spDebt0 = fin.debt; h.since = state.age;
  }
  const h = state.household;
  if (!h) return null;
  const sp = state.spouse;
  if (!sp || sp.alive === false) return null;   // 人不在了，账先冻着（清算走离婚 / 继承）

  h.spIncome = Math.round((h.spIncome || 0) * (1 + rand(0.01, 0.05)));   // 涨薪
  let cash = Math.round((h.spIncome || 0) * 0.55);                       // 进家庭现金的部分
  let repaid = 0;
  // 婚前债务：法律上是 TA 自己的，但日子是两个人过 —— 从共同收入里挤
  if (h.spDebt > 0 && cash > 0) {
    repaid = Math.min(h.spDebt, Math.round(cash * 0.45));
    h.spDebt -= repaid;
    cash -= repaid;
  }
  h.joint = Math.round((h.joint || 0) + cash);          // 剩下的进共同储蓄
  h.spAssets = Math.round((h.spAssets || 0) * 1.03);    // 名下资产随年代增值
  if (cash > 0) state.stats.MONEY += cash;
  h.lastIncome = cash; h.lastRepaid = repaid;

  // 娘家 / 婆家：一年里可能发生的一件与钱有关的事
  if (chance(0.07) && state.age >= 24) {
    const bg = sp.bg || (sp.fin && sp.fin.bg) || 'mid';
    if (bg === 'top' || bg === 'rich') {
      const gift = Math.round((h.spAssets || 0) * rand(0.02, 0.06));
      if (gift > 0) {
        h.spAssets -= gift; h.joint += gift; state.stats.MONEY += gift;
        pushLog(state, `【家里】岳家把一笔 ${fmtMoney(gift)} 转到了你们共同的账户上。${sp.name} 说：爸妈给的，别推。`, 'money');
      }
    } else if (h.spDebt > 0 && chance(0.35)) {
      const boom = Math.round(h.spDebt * rand(0.2, 0.5));
      h.spDebt += boom;
      applyEffects(state, { STRESS: 7, MOOD: -5, LOVE: -3 });
      pushLog(state, `【家里】${sp.name} 婚前那笔债出了岔子，滚到了 ${fmtMoney(h.spDebt)}。你们关着灯吵了一晚上。`, 'warn');
    }
  }
  return { income: cash, repaid: repaid };
}

/* 离婚清算：婚前财产各归各，婚后共同积累对半分，婚前债务 TA 带走 */
function settleHouseholdOnDivorce(state, fault) {
  const h = state.household;
  if (!h) return null;
  const joint = Math.round(h.joint || 0);
  // 有过错方少分（出轨被抓 / 家暴 之类）；无过错四六开
  const mine = fault ? Math.round(joint * 0.35) : Math.round(joint * 0.5);
  state.stats.MONEY += mine;
  h.joint = 0; h.spAssets = 0; h.spDebt = 0; h.settled = state.age;
  return { got: mine, joint: joint, tookDebt: 0 };
}

/* 配偶身故：限定继承 —— 只在遗产范围内承担债务 */
function settleHouseholdOnDeath(state) {
  const h = state.household;
  if (!h) return null;
  const estate = Math.round((h.spAssets || 0) + (h.joint || 0));
  const debt = Math.round(h.spDebt || 0);
  const net = Math.max(0, estate - Math.min(debt, estate));
  state.stats.MONEY += net;
  h.joint = 0; h.spAssets = 0; h.spDebt = 0; h.settled = state.age;
  return { got: net, estate: estate, debt: debt, limited: debt > estate };
}
