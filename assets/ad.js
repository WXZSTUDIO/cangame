// cangame v3.5 · 赞助商合同制广告（替换原“胜负赔钱/固定发钱”模型）
// 表（前端状态字段）：sponsors / adContracts / adRevenueLogs；广告位 = 球场等级 + 球迷/4000
function ad_genSponsors(state) {
  const rng = makeRNG(deriveSeed(state.seed, 909));
  const S = CONFIG.SPONSOR;
  const sponsors = [];
  for (let i = 0; i < S.COUNT; i++) {
    const prefix = S.namePrefix[Math.floor(rng() * S.namePrefix.length)];
    const suffix = S.nameSuffix[Math.floor(rng() * S.nameSuffix.length)];
    const tail = ['体育', '集团', '科技', '控股', '实业', '传媒'][Math.floor(rng() * 6)];
    const basePrice = Math.round((S.basePrice[0] + rng() * (S.basePrice[1] - S.basePrice[0])) / 100) * 100;
    sponsors.push({
      id: 'sp' + i,
      name: prefix + suffix + tail,
      industry: S.industries[Math.floor(rng() * S.industries.length)],
      basePrice: basePrice,
      preferLevel: rng() < 0.5 ? 1 : 2,           // 偏好球队级别（1级更贵）
      fitBias: Math.round((S.FIT_RANGE[0] + rng() * (S.FIT_RANGE[1] - S.FIT_RANGE[0])) * 100) / 100,
      dynamic: 1.0                               // 动态价格系数（签得多降价）
    });
  }
  state.sponsors = sponsors;
  state.adContracts = state.adContracts || [];
  state.adRevenueLogs = state.adRevenueLogs || [];
}

// 广告位数量 = 球场等级 + 球迷/4000
function ad_slotCount(state) {
  const lv = state.stadiumLevel || CONFIG.STADIUM.DEFAULT_LEVEL;
  return lv + Math.floor((state.fans || 0) / 4000);
}

// 当前可签赞助商（未被签且合同位未满）
function ad_available(state) {
  if (!state.sponsors) return [];
  const signed = {};
  (state.adContracts || []).forEach(function (c) { if (c.roundsLeft > 0) signed[c.sponsorId] = true; });
  return state.sponsors.filter(function (s) { return !signed[s.id]; });
}

function ad_sign(state, sponsorId, rounds) {
  if (!state.sponsors) ad_genSponsors(state);
  const S = CONFIG.SPONSOR;
  if (S.roundsOpts.indexOf(rounds) < 0) return { ok: false, msg: '合同轮次不合法' };
  if ((state.adContracts || []).filter(function (c) { return c.roundsLeft > 0; }).length >= ad_slotCount(state)) {
    return { ok: false, msg: '广告位已满' };
  }
  if ((state.adContracts || []).some(function (c) { return c.roundsLeft > 0 && c.sponsorId === sponsorId; })) {
    return { ok: false, msg: '该赞助商已签约' };
  }
  const c = {
    id: 'ac' + Date.now() + '_' + Math.floor((state.seed || 0) % 1000) + '_' + (state.adContracts.length),
    sponsorId: sponsorId, roundsLeft: rounds, totalRounds: rounds,
    signedRound: state.round, paid: 0, bonusPaid: 0
  };
  state.adContracts.push(c);
  return { ok: true, contract: c };
}

function ad_terminate(state, contractId) {
  const S = CONFIG.SPONSOR;
  const c = (state.adContracts || []).find(function (x) { return x.id === contractId; });
  if (!c || c.roundsLeft <= 0) return { ok: false, msg: '合同不存在或已结束' };
  const penalty = Math.round(c.paid * S.BREACH_PENALTY);
  state.finance.cash -= penalty;
  state.finance.expense += penalty;
  c.roundsLeft = 0; // 强制结束
  state.log.push('⚠ 提前解约赞助商，扣款 ¥' + penalty);
  return { ok: true, penalty: penalty };
}

// 每轮结算：收入 = 单价 × 球迷系数 × 上座率系数 × 战绩系数 × 比赛重要性 × 品牌契合度
function ad_settle(state, importance) {
  if (!state.sponsors) return 0;
  const S = CONFIG.SPONSOR;
  const rng = makeRNG(deriveSeed(state.seed, state.season * 6001 + state.round * 311 + 77));
  const human = teamById(state, state.humanTeamId);
  const fanCoef = Math.min(S.FAN_COEF_CAP, (state.fans || 0) / 4000);
  const attCoef = clamp(0.72 + (state.fans || 0) / 200000 + (state.prestige || 0) / 600, 0.6, 0.95);
  const gp = Math.max(1, human.wins + human.losses);
  const winRate = human.wins / gp;
  const streak = Math.min(state.winStreak || 0, 10);
  const recordCoef = 1 + winRate * S.RECORD_WIN_BONUS + streak * S.STREAK_BONUS;
  const impCoef = S.IMPORTANCE[importance] || 1.0;

  let total = 0;
  (state.adContracts || []).forEach(function (c) {
    if (c.roundsLeft <= 0) return;
    const sp = state.sponsors.find(function (s) { return s.id === c.sponsorId; });
    if (!sp) { c.roundsLeft = 0; return; }
    // 品牌契合度：球队级别匹配偏好 → 加成
    const fit = clamp(sp.fitBias * (sp.preferLevel === human.level ? 1.05 : 0.95), 0.7, 1.3);
    const amount = Math.round(sp.basePrice * sp.dynamic * fanCoef * attCoef * recordCoef * impCoef * fit);
    total += amount; c.paid += amount;
    state.adRevenueLogs.push({ round: state.round, sponsorId: sp.id, sponsorName: sp.name, amount: amount, importance: importance });
    c.roundsLeft--;
    if (c.roundsLeft <= 0) {
      // 奖金条款：连胜≥3 发放
      if ((state.winStreak || 0) >= 3) {
        const b = S.bonuses.streak3; c.bonusPaid += b; total += b;
        state.adRevenueLogs.push({ round: state.round, sponsorId: sp.id, sponsorName: sp.name, amount: b, bonus: 'streak3' });
      }
      state.log.push('🤝 赞助合同到期：' + sp.name + '（累计 ¥' + c.paid + '）');
    }
  });
  // 动态价格：签得多降价，没人签回升（每轮微调）
  const signedCount = (state.adContracts || []).filter(function (x) { return x.roundsLeft > 0; }).length;
  const ratio = signedCount / Math.max(1, ad_slotCount(state));
  state.sponsors.forEach(function (s) {
    if (signedCount > 0 && (state.adContracts || []).some(function (x) { return x.roundsLeft > 0 && x.sponsorId === s.id; })) return; // 已签不调
    if (ratio > 0.5) s.dynamic = clamp(s.dynamic * S.DYNAMIC_DOWN, 0.7, 1.3);
    else s.dynamic = clamp(s.dynamic * S.DYNAMIC_UP, 0.7, 1.3);
  });
  if (total > 0) { state.finance.income += total; }
  return total;
}

if (typeof module !== 'undefined') {
  module.exports = { ad_genSponsors, ad_slotCount, ad_available, ad_sign, ad_terminate, ad_settle };
}
