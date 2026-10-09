
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

/* 家庭账簿：把配偶那一半也算进来（netWorth / 结算 / UI 共用同一个口径） */
function householdNet(state) {
  const h = state.household;
  if (!h) return 0;
  return Math.round((h.spAssets || 0) + (h.joint || 0) - (h.spDebt || 0));
}
function householdInit(state) {
  if (state.household) return state.household;
  state.household = { spAssets: 0, spDebt: 0, spIncome: 0, joint: 0, since: state.age, spAssets0: 0, spDebt0: 0 };
  return state.household;
}

/* 婚后每一年的家庭财务结算 */
function spouseFinTick(state) {
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
        h.spAssets -= gift; h.joint += gift;
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
