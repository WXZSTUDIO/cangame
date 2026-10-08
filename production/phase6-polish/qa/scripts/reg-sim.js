/* =========================================================
 * REG-01 · 单局模拟器（与 QA-01 playtest-run.js 同构，供回归用例复用）
 * makeSim(A, ctx) -> { playOne, MAJOR_OF }
 * 只读，不修改游戏源码。
 * ========================================================= */
const vm = require('vm');
const { rnd } = require('./reg-lib.js');

function makeSim(A, ctx, PERSONAS) {
  const MAJOR_LABEL = vm.runInContext('MAJOR_LABEL', ctx);
  const MAJOR_OF = m => MAJOR_LABEL[m] || '';
  // 正式结局 id 全集：不在其中的就是 forceEnd（end_elder / end_ill / end_dead）
  const ENDING_IDS = {};
  (A.ENDINGS || []).forEach(e => { ENDING_IDS[e.id] = 1; });
  const prioOf = p => (p === PERSONAS.steady ? 'career' : (p === PERSONAS.slacker ? 'balance' : 'success'));

  function evUtility(list) {
    const W = { HP: 2.0, MOOD: 0.6, INT: 1.0, CHA: 0.8, WILL: 0.8, ETH: 0.5, FAME: 1.2, NET: 1.0,
      LOY: 0.8, LOVE: 0.5, SEC: 0.4, STR: 0.4, STRESS: -0.9, MONEY: 1 / 6000000 };
    return list.map(c => {
      let u = 0;
      const acc = (e, w) => { if (!e) return; for (const k in e) u += (e[k] || 0) * (W[k] || 0) * w; };
      acc(c.eff, 1);
      if (c.gamble) { acc(c.gamble.win, c.gamble.p || 0.5); acc(c.gamble.lose, 1 - (c.gamble.p || 0.5)); }
      return u;
    });
  }

  function pickChoiceIdx(p, st, ev, list) {
    const id = String(ev.id || '');
    if (id.indexOf('major_at_') === 0) {
      if (!p.majorPref.length) return rnd(list.length);
      let best = -1, bestRank = 99;
      list.forEach((c, i) => {
        const r = p.majorPref.indexOf(MAJOR_OF(c.major || ''));
        if (r >= 0 && r < bestRank) { bestRank = r; best = i; }
      });
      return best < 0 ? rnd(list.length) : best;
    }
    if (id.indexOf('grad_at_') === 0) return p.gradChoice < 0 ? rnd(list.length) : Math.min(p.gradChoice, list.length - 1);
    if (id.indexOf('kaoyan2_at_') === 0) return p.kaoyan2Choice < 0 ? rnd(list.length) : Math.min(p.kaoyan2Choice, list.length - 1);
    if (id.indexOf('scout_at_') === 0) return p.scoutChoice < 0 ? rnd(list.length) : Math.min(p.scoutChoice, list.length - 1);
    if (id.indexOf('ill_at_') === 0) {
      if (!p.treat) return 0;
      const money = st.stats.MONEY;
      const canHospital = list.length >= 3 && money > 40000000;
      return canHospital ? 2 : (money > 8000000 ? 1 : 0);
    }
    if (p.riskMode === 'first') return 0;
    if (p.riskMode === 'random') return rnd(list.length);
    if (p.riskMode === 'low') {
      let bi = 0, br = 99;
      list.forEach((c, i) => { const r = c.risk || 2; if (r < br) { br = r; bi = i; } });
      return bi;
    }
    if (p.riskMode === 'high') {
      let bi = list.length - 1, br = -1;
      list.forEach((c, i) => { const r = c.risk || 2; if (r >= br) { br = r; bi = i; } });
      return bi;
    }
    const u = evUtility(list);
    let bi = 0, bu = -Infinity;
    list.forEach((c, i) => {
      const v = u[i] + (c.gamble ? 1.5 : 0);
      if (v > bu) { bu = v; bi = i; }
    });
    return bi;
  }

  function trade(p, st, rec, y) {
    if (p.market === 'none') return;
    if (st.stats.MONEY <= 0) return;
    const down = h => Math.round(A.housePrice(st, h) * (h.jeonse ? 1 : p.downRatio));
    if (st.age >= 24 && !st.flags.own_house) {
      const pool = A.HOUSES.filter(h => !h.jeonse && (h.minYear || 1985) <= y);
      let target = null;
      if (p.market === 'house_first') {
        target = pool.filter(h => down(h) <= st.stats.MONEY * 0.9).sort((a, b) => b.base - a.base)[0];
        if (!target && st.age % 5 === 0) rec.buyFail++;
      } else if (p.market === 'stock_first') {
        const cheap = pool.slice().sort((a, b) => a.base - a.base)[0];
        target = (cheap && down(cheap) <= st.stats.MONEY * 0.6) ? cheap : null;
      } else {
        target = pool.filter(h => down(h) <= st.stats.MONEY * 0.7).sort((a, b) => b.base - a.base)[0];
      }
      if (target) {
        const r = A.buyProp(st, 'house', target.id, p.downRatio, 1);
        if (r.ok && rec.firstHouseAge == null) { rec.firstHouseAge = st.age; rec.firstHouse = target.name; }
      }
    }
    if (p.borrowLoan && st.age >= 22 && st.market.debt < A.careerIncome(st) * 3) {
      const prods = A.loanProducts(st).filter(x => x.avail && x.p.danger <= 2);
      if (prods.length) {
        const t = prods.sort((a, b) => b.max - a.max)[0];
        A.borrow(st, t.p.id, Math.round(t.max * 0.5));
      }
    }
    const spendK = p.market === 'stock_first' ? 0.75 : (p.market === 'balanced' ? 0.3 : 0.25);
    const poolS = A.STOCKS.filter(s => (s.minYear || 1985) <= y);
    if (poolS.length && st.stats.MONEY > 2000000) {
      poolS.sort(p.market === 'stock_first' ? (a, b) => b.growth - a.growth : (a, b) => (b.div || 0) - (a.div || 0));
      const s = poolS[0];
      const price = A.stockPrice(st, s.id);
      if (price > 0) {
        const n = Math.floor(st.stats.MONEY * spendK / price);
        if (n > 0) { const r = A.buyStock(st, s.id, n); if (r.ok && rec.firstStockAge == null) rec.firstStockAge = st.age; }
      }
    }
    if (p.market === 'house_first' && st.market.debt > 0 && st.stats.MONEY > st.market.debt * 0.5) {
      A.repayDebt(st, Math.round(st.stats.MONEY * 0.3));
    }
  }

  function doPlayerActions(p, st, rec, cramCap) {
    const y = st.startYear + st.age;
    const cap = cramCap == null ? null : cramCap;
    if (p.cram && st.age >= 13 && st.age < A.EXAM_META.gaoAge &&
      (st.edu.study || 0) < (cap == null ? A.EXAM_META.studyCap : Math.min(cap, A.EXAM_META.studyCap))) {
      A.cramSchool(st);
    }
    if (p.social === 'full' && st.edu.uni && st.edu.uni !== 'u_fail' && st.age <= (st.edu.gradAge || 22)) {
      const acts = ['a_study', 'a_club', 'a_intern', 'a_parttime', 'a_sport', 'a_kaoyan', 'a_love'];
      A.doUniActivity(st, acts[rnd(acts.length)]);
    }
    if (p.social === 'full' && st.classmates && st.classmates.length) A.classmateAct(st, rnd(Math.min(3, st.classmates.length)));
    if (p.doGood && st.age >= 14 && A.GOOD_DEEDS && A.GOOD_DEEDS.length) A.doGoodDeed(st, A.GOOD_DEEDS[rnd(A.GOOD_DEEDS.length)].id);
    if (p.lottery && st.age >= 12 && st.stats.MONEY > 5000000) { try { A.buyLottery(st); } catch (e) { } }
    if (p.treat && st.ill && st.stats.MONEY > 40000000) { try { A.treatIllness && A.treatIllness(st, 'hospital'); } catch (e) { } }

    const gradAge = st.edu.gradAge;
    if (p.jobTarget && p.jobTarget.length && st.age >= 17 && gradAge && st.age >= gradAge &&
      (st.job === '待业' || st.job === '无业')) {
      for (const cid of p.jobTarget) {
        const off = A.jobOffers(st).find(o => o.career.id === cid);
        if (off && off.okEdu && off.okStat && off.okFlag) { A.applyJob(st, cid); break; }
      }
    }
    if (rec.forcedCareer && st.age === 22 && (!st.career || st.career.id !== rec.forcedCareer)) {
      A.applyJob(st, rec.forcedCareer);
      if (!st.career || st.career.id !== rec.forcedCareer) {
        const c = A.CAREERS.find(x => x.id === rec.forcedCareer);
        if (c) { st.career = { id: rec.forcedCareer, level: 0, years: 0, joinedAge: 22 }; st.job = c.ladder[0].title; }
      }
    }
    if (p.social !== 'none' && st.age >= 24 && !st.flags.married && Math.random() < 0.3) {
      const lv = A.loveInit(st);
      const cand = (lv.candidates || []).filter(c => c && c.alive !== false);
      if (cand.length) {
        const l = cand[rnd(cand.length)];
        l.affinity = 82;
        if (st.stats.MONEY < 30000000) st.stats.MONEY = 30000000;
        const r = A.marry(st, l);
        if (r && r.ok && rec.marryAge == null) rec.marryAge = st.age;
      }
    }
    if (p.social !== 'none' && st.flags.married && st.childCount < 2 && Math.random() < 0.4) {
      const b = A.tryBaby(st);
      if (b && b.baby && rec.firstKidAge == null) rec.firstKidAge = st.age;
    }
    if (st.age >= 20 && st.age < 80) trade(p, st, rec, y);
    if (st.age === 30) {
      const h = A.HOUSES.find(x => x.id === 'h_apt_gangbuk') || A.HOUSES[3];
      rec.housePriceAt30 = A.housePrice(st, h);
      rec.incomeAt30 = A.careerIncome(st);
      rec.costAt30 = A.livingCost(st);
    }
  }

  /* 返回一局的完整记录 */
  function playOne(pname, p, opts) {
    opts = opts || {};
    const famId = opts.familyId || A.FAMILIES[rnd(A.FAMILIES.length)].id;
    const st = A.createGame({
      name: '测试',
      gender: Math.random() < 0.5 ? 'M' : 'F',
      familyId: famId,
      priority: prioOf(p),
      talents: [],
      startYear: opts.startYear || undefined
    });

    const rec = {
      persona: pname, familyId: famId, startYear: st.startYear, gender: st.gender,
      netSeries: {}, choicesPerYear: {}, jobs: {}, salaries: {},
      hpSeries: {}, stressSeries: {},
      totalEvents: 0, yearsWithContent: 0, idleYears: 0, totalYears: 0,
      idleByBand: { '0-12': 0, '13-18': 0, '19-25': 0, '26-35': 0, '36-50': 0, '51-65': 0, '66-100': 0 },
      yearsByBand: { '0-12': 0, '13-18': 0, '19-25': 0, '26-35': 0, '36-50': 0, '51-65': 0, '66-100': 0 },
      buckets: { salary: 0, event: 0, carry: 0, trade: 0, loan: 0, medical: 0, lottery: 0, other: 0 },
      firstJobAge: null, firstHouseAge: null, firstStockAge: null, marryAge: null, firstKidAge: null,
      buyFail: 0, housePriceAt30: null, incomeAt30: null, costAt30: null,
      deathAge: null, endId: null, endTitle: null, forcedCareer: opts.forceCareer || null,
      jobSwitches: 0, lastCareerId: null, careerNullYears: 0, activeYears: 0,
      studyAt18: 0, salaryK: null
    };

    let yearMoney0 = st.stats.MONEY;
    let BUCKET = {};
    function closeYear() {
      const d = st.stats.MONEY - yearMoney0;
      let known = 0;
      for (const k in BUCKET) { known += BUCKET[k]; rec.buckets[k] = (rec.buckets[k] || 0) + BUCKET[k]; }
      rec.buckets.salary = (rec.buckets.salary || 0) + (d - known);
      BUCKET = {};
      yearMoney0 = st.stats.MONEY;
    }

    function bandOf(age) {
      if (age <= 12) return '0-12';
      if (age <= 18) return '13-18';
      if (age <= 25) return '19-25';
      if (age <= 35) return '26-35';
      if (age <= 50) return '36-50';
      if (age <= 65) return '51-65';
      return '66-100';
    }

    let guard = 0, contentThisYear = 0;
    let TAG = 'other';
    const origApplyEffects = A.applyEffects;
    // 现金流归因：把 applyEffects 的 MONEY 记到 event 桶，其余（工资/持有/买卖）用差额倒推
    while (!st.finished && guard++ < 4000) {
      const beforeAge = st.age;
      const item = A.step(st);

      if (st.age !== beforeAge) {
        rec.totalYears = Math.max(rec.totalYears, beforeAge);
        const b = bandOf(beforeAge);
        rec.yearsByBand[b]++;
        if (contentThisYear > 0) rec.yearsWithContent++; else { rec.idleYears++; rec.idleByBand[b]++; }
        rec.choicesPerYear[beforeAge] = contentThisYear;
        contentThisYear = 0;
        closeYear();
        rec.netSeries[st.age] = A.netWorth(st);
        rec.jobs[st.age] = st.job;
        rec.salaries[st.age] = A.careerIncome(st);
        rec.hpSeries[st.age] = Math.round(st.stats.HP);
        rec.stressSeries[st.age] = Math.round(st.stats.STRESS);
        if (st.career && rec.lastCareerId && st.career.id !== rec.lastCareerId) rec.jobSwitches++;
        if (st.career) rec.lastCareerId = st.career.id;
        if (st.age >= 18 && st.job !== '无业' && st.job !== '待业') {
          rec.activeYears++;
          if (!st.career) rec.careerNullYears++;
        }
        if (rec.firstJobAge == null && st.age >= 18 && st.career) rec.firstJobAge = st.age;
        if (st.age === 18 && rec.famAt18 == null) {
          rec.famAt18 = { assets: Math.round(st.family ? st.family.assets : 0), debt: Math.round(st.family ? st.family.debt : 0) };
          rec.netAt18 = A.netWorth(st);
        }
        // 「学习投入」的正确度量时机是 18 岁（高中毕业那一刻），不是终局那个已被后续事件冲淡的值
        if (st.age <= 18 && st.edu && st.edu.study != null) {
          rec.studyAt18 = Math.max(rec.studyAt18 || 0, Math.round(st.edu.study));
        }
        // salaryK = 学历档对应的薪资乘子（0.95 / 1.04 / 1.20 / 1.42）。
        // 它是 D-1（"收益一次性跳变、之后归零"）的**直接观测量**：补习的收益全部经由它传导，
        // 且只有 4 个离散取值 —— 相比终局收入（重尾、中位在复跑间可摆动 40%）噪声低一个数量级。
        if (st.edu && st.edu.salaryK) rec.salaryK = st.edu.salaryK;
      }
      if (!item || item.type === 'end') break;

      doPlayerActions(p, st, rec, opts.cramCap);

      if (item.type === 'year') continue;

      if (item.type === 'exam') {
        contentThisYear++;
        st.pending = item;
        let g = 0;
        while (item.exam && item.exam.quiz && !item.exam.quiz.done && g++ < 20) A.answerExamQ(st, rnd(4));
        const o2 = item.exam.options || [];
        if (o2.length) {
          const open = o2.map((o, i) => ({ o, i })).filter(x => !x.o.locked);
          let idx = -1;
          if (open.length) {
            if (p.schoolPick === 'best') { open.sort((a, b) => (b.o.tier || 0) - (a.o.tier || 0)); idx = open[0].i; }
            else if (p.schoolPick === 'first') idx = open[0].i;
            else idx = open[rnd(open.length)].i;
          }
          if (idx >= 0) A.resolveExam(st, idx);
        }
        st.pending = null;
        continue;
      }

      if (item.type === 'event') {
        contentThisYear++;
        const ev = item.ev;
        rec.totalEvents++;
        const list = A.eventChoices(st, ev) || [];
        const idx = list.length ? pickChoiceIdx(p, st, ev, list) : -1;
        A.resolveEvent(st, ev, idx);
        continue;
      }

      if (item.type === 'invest') {
        contentThisYear++;
        const cs = item.choices || [];
        let pick = null;
        if (p.market === 'none') pick = cs[cs.length - 1];
        else {
          const ok = cs.filter(c => !c.disabled && c.act === 'invest');
          pick = ok.length ? (p.riskMode === 'high' || p.market === 'stock_first' ? ok[ok.length - 1]
            : (Math.random() < 0.8 ? ok[0] : ok[ok.length - 1])) : cs[cs.length - 1];
        }
        if (pick) A.resolveInvest(st, pick);
      }
    }
    if (!st.finished) A.finish(st);

    rec.endId = st.ending ? st.ending.id : 'none';
    rec.endTitle = st.ending ? st.ending.title : '—';
    /* ⚠️ 死因单独挂在 ending.cause 上（S-04 之后 end_dead 不在 ENDINGS 表里）。
     * 只记 endId 会让「熄灭占比」结构性恒为 0 —— REG-01 的那道门已因此失效过。 */
    rec.endCause = st.ending ? (st.ending.cause || null) : null;
    rec.endRank = st.ending ? st.ending.rank : '—';
    rec.endSource = st.ending ? (ENDING_IDS[st.ending.id] ? 'ENDINGS' : 'forceEnd') : 'none';
    rec.score = st.score != null ? st.score : A.scoreOf(st);
    rec.rank = st.rank || A.grade(rec.score);
    rec.deathAge = st.age;
    rec.finalNet = A.netWorth(st);
    rec.finalCash = st.stats.MONEY;
    rec.stockValue = A.stockValue(st);
    rec.debt = st.market ? st.market.debt : 0;
    rec.study = Math.round(st.edu.study || 0);
    // 注意：高考分在 st.edu.gao，不是 st.edu.gaokao（后者不存在，导致这一列常年为 null）
    rec.gaokao = st.edu && st.edu.gao != null ? st.edu.gao : null;
    rec.eduLevel = st.edu ? st.edu.eduLevel : 0;
    rec.finalCareer = st.career ? st.career.id : null;
    rec.finalJob = st.job;
    rec.finalHP = Math.round(st.stats.HP);
    rec.finalSTRESS = Math.round(st.stats.STRESS);
    rec.married = !!st.flags.married;
    rec.ownHouse = !!st.flags.own_house;
    rec.childCount = st.childCount || 0;
    return rec;
  }

  return { playOne, MAJOR_OF };
}

module.exports = { makeSim };
