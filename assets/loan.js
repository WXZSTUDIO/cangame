/* =========================================================
 * CANGAME · 贷款系统
 * 助学贷 / 消费贷 / 信用贷 / 经营贷 / 网贷
 * 借得到，也要还得起；逾期会打穿信用与名声
 * ========================================================= */

const LOAN_META = {
  minAge: 18,
  baseCredit: 100,
  overdueStress: 9,
  overdueFame: 6
};

const LOAN_PRODUCTS = [
  {
    id: 'student', name: '助学贷款', icon: '🎓', minAge: 17, years: 10, rateK: 0.45, mult: 3,
    desc: '国家贴息，利息最低的一种。只有读书的时候能申请。',
    needEduStage: true, danger: 0
  },
  {
    id: 'consumer', name: '消费贷', icon: '🛍', minAge: 18, years: 5, rateK: 1.0, mult: 8,
    desc: '手机、家电、装修。审批快，代价是利息。',
    danger: 1
  },
  {
    id: 'credit', name: '信用贷', icon: '💳', minAge: 22, years: 8, rateK: 0.75, mult: 14,
    desc: '凭工作和征信。职场口碑越好，额度越高。',
    need: { LOY: 25 }, danger: 0
  },
  {
    id: 'biz', name: '经营贷', icon: '🏪', minAge: 24, years: 10, rateK: 1.15, mult: 22,
    desc: '给生意人的杠杆。赚的时候是翅膀，亏的时候是绞索。',
    needJob: ['创业者', '个体户'], danger: 2
  },
  {
    id: 'mortgage2', name: '抵押贷', icon: '🏠', minAge: 25, years: 20, rateK: 0.6, mult: 30,
    desc: '用名下房产做抵押。利率最低，但押的是你的家。',
    needFlag: ['own_house'], danger: 1
  },
  {
    id: 'p2p', name: '网贷 / 套路贷', icon: '🕳', minAge: 18, years: 3, rateK: 4.2, mult: 6,
    desc: '三分钟到账，不需要任何材料。你不知道的是：他们也不需要任何底线。',
    danger: 3
  }
];

function loanInit(state) {
  if (!state.loans) state.loans = [];
  if (state.credit == null) state.credit = LOAN_META.baseCredit;
  return state.loans;
}

function loanProducts(state) {
  const yearIncome = (typeof careerIncome === 'function') ? careerIncome(state) : 0;
  const scale = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, fmtYear(state)) : 1;
  const inc = Math.max(yearIncome, 6000000 * scale);
  const creditK = clamp((state.credit == null ? 100 : state.credit) / 100, 0.15, 1.25);
  return LOAN_PRODUCTS.map(p => {
    let avail = state.age >= p.minAge;
    let why = '';
    if (p.needEduStage && !(state.edu && state.edu.uni && state.edu.uni !== 'u_fail')) {
      avail = false; why = '只有在校大学生能申请';
    }
    if (p.need) {
      for (const k in p.need) {
        if ((state.stats[k] || 0) < p.need[k]) { avail = false; why = `${k} 需 ${p.need[k]}`; }
      }
    }
    if (p.needJob && p.needJob.indexOf(state.job) < 0) { avail = false; why = '需要经营中的生意'; }
    if (p.needFlag && !p.needFlag.some(f => state.flags[f])) { avail = false; why = '需要抵押物'; }
    const rate = rateAt(fmtYear(state)) * p.rateK;
    const max = Math.round(inc * p.mult * creditK);
    return { p, avail, why, rate, max };
  });
}

function borrow(state, id, amount) {
  const list = loanProducts(state);
  const item = list.find(x => x.p.id === id);
  if (!item) return { ok: false, msg: '没有这个产品' };
  if (!item.avail) return { ok: false, msg: item.why || '暂不符合条件' };
  const amt = Math.round(amount);
  if (amt <= 0) return { ok: false, msg: '金额不对' };
  if (amt > item.max) return { ok: false, msg: `最多能借 ${fmtMoney(item.max)}` };
  const p = item.p;
  const loan = {
    id: p.id, name: p.name, icon: p.icon,
    principal: amt, left: amt,
    rate: item.rate, years: p.years, paid: 0,
    startYear: fmtYear(state), danger: p.danger, overdue: 0
  };
  loanInit(state).push(loan);
  state.stats.MONEY += amt;
  applyEffects(state, { STRESS: 3 + p.danger * 2, SEC: -2 - p.danger });
  pushLog(state, `【贷款】${p.name} 到账 ${fmtMoney(amt)}，年利率 ${(loan.rate * 100).toFixed(1)}%，${p.years} 年还清。`, 'money');
  return { ok: true, loan };
}

function annualPayment(l) {
  if (l.left <= 0) return 0;
  const per = l.principal / l.years;
  return Math.round(per + l.left * l.rate);
}

function repayLoan(state, idx, amount) {
  const loans = loanInit(state);
  const l = loans[idx];
  if (!l) return { ok: false, msg: '没有这笔贷款' };
  const pay = Math.min(l.left, Math.max(0, Math.round(amount)));
  if (state.stats.MONEY < pay) return { ok: false, msg: '现金不足' };
  state.stats.MONEY -= pay;
  l.left -= pay; l.paid += pay;
  state.credit = clamp((state.credit || 100) + 3, 0, 120);
  if (l.left <= 0) {
    loans.splice(idx, 1);
    pushLog(state, `【还清】${l.name} 结清了。你把那张合同撕掉，扔进了垃圾桶。`, 'money');
  } else {
    pushLog(state, `【还款】${l.name} 还了 ${fmtMoney(pay)}，剩余 ${fmtMoney(l.left)}。`, 'money');
  }
  return { ok: true, pay };
}

/* ---------- 年度结算 ---------- */
function loanTick(state) {
  const loans = loanInit(state);
  if (!loans.length) {
    state.credit = clamp((state.credit || 100) + 1, 0, 120);
    return null;
  }
  let due = 0, overdue = false;
  const lines = [];
  loans.forEach(l => {
    if (l.left <= 0) return;
    const pay = annualPayment(l);
    due += pay;
    if (state.stats.MONEY >= pay) {
      state.stats.MONEY -= pay;
      l.left = Math.max(0, l.left - (pay - Math.round(l.left * l.rate)));
      l.paid += pay;
      lines.push(`${l.name} 还款 ${fmtMoney(pay)}`);
    } else {
      // 逾期
      const canPay = Math.max(0, state.stats.MONEY);
      state.stats.MONEY -= canPay;
      l.overdue += 1;
      overdue = true;
      l.left = Math.round(l.left * (1 + l.rate * (1 + l.danger * 0.5)));
      lines.push(`${l.name} 逾期！欠款滚到 ${fmtMoney(l.left)}`);
    }
  });
  if (overdue) {
    state.credit = clamp((state.credit || 100) - (LOAN_META.baseCredit * 0.22), 0, 120);
    applyEffects(state, {
      STRESS: LOAN_META.overdueStress,
      FAME: -LOAN_META.overdueFame,
      SEC: -6,
      ETH: -2
    });
    pushLog(state, `【催收】电话从早响到晚。你的名字上了征信。信用分 ${Math.round(state.credit)}。`, 'warn');
  } else {
    state.credit = clamp((state.credit || 100) + 4, 0, 120);
  }
  pushLog(state, `【贷款 · ${fmtYear(state)}】${lines.join(' · ')}${overdue ? '' : ` · 信用分 ${Math.round(state.credit)}`}`, overdue ? 'warn' : 'money');
  return { due, overdue };
}

function loanTotal(state) {
  return loanInit(state).reduce((a, l) => a + Math.max(0, l.left), 0);
}
