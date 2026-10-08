/* =========================================================
 * v6.0.0 · 传承模块（legacy.js）
 * 依赖：engine.js（createGame/applyEffects/pushLog/clamp/fmtMoney…）与 market.js（netWorth）
 * 加载顺序：data → market → engine → school → career → love → pet → legacy → loan → ui
 *
 * 三条线：
 *   1) 遗嘱 will    —— 老年（≥60）或病危（HP<25）时确立继承人（子女 / 孙辈）与份额
 *   2) 传承 heir    —— 死亡后可「以子女 / 孙辈之名继续」，继承资产与部分家风加成
 *   3) 重生 rebirth —— 人生重来：完整重置，上一世的阅历化为 +3 智力 +3 意志的先天记忆
 * ========================================================= */

const WILL_MIN_AGE = 60;       // 老年可立遗嘱
const WILL_HP_GATE = 25;       // 病危可提前立遗嘱
const HEIR_ASSET_CAP = 0.55;   // 子女最多继承净资产的 55%（游戏性：别让传承变印钞机）
const HEIR_GRAND_CAP = 0.40;   // 孙辈最多 40%
const REBIRTH_BONUS = { INT: 3, WILL: 3 };

function canMakeWill(state) {
  return !!state && !state.finished && (state.age >= WILL_MIN_AGE || (state.stats.HP || 0) < WILL_HP_GATE);
}

function willHeirOptions(state) {
  const opts = [];
  (state.children || []).forEach((c, i) => {
    if (c.alive !== false) opts.push({ kind: 'child', idx: i, label: `${c.name}（${c.gender === 'F' ? '女儿' : '儿子'} · ${childAge(state, c)} 岁）` });
  });
  if (state.grandCount > 0) {
    opts.push({ kind: 'grand', idx: 0, label: `孙辈（${state.grandCount} 人中你最看好的那一个）` });
  }
  return opts;
}

/* 立遗嘱 / 改遗嘱：heirKey = 'child:i' | 'grand' */
function makeWill(state, heirKey, share) {
  if (!canMakeWill(state)) return { ok: false, msg: '还不到立遗嘱的时候（60 岁 / 病危）' };
  const opts = willHeirOptions(state);
  const o = opts.find(x => (x.kind === 'child' ? `child:${x.idx}` : 'grand') === heirKey);
  if (!o) return { ok: false, msg: '继承人不存在' };
  state.will = {
    heir: { kind: o.kind, idx: o.idx, name: o.kind === 'grand' ? '孙辈' : state.children[o.idx].name },
    share: clamp(share === undefined ? 1 : share, 0.3, 1),
    at: state.age
  };
  pushLog(state, `【遗嘱】你在公证处签了字：${state.will.share * 100}% 的家产留给 ${state.will.heir.name}。落笔的时候，屋里安静得能听见空调声。`, 'muted');
  return { ok: true };
}

/* 死亡后的可继承人选（结局页用） */
function successionOptions(state) {
  if (!state || !state.childCount) return [];
  const opts = [];
  (state.children || []).forEach((c, i) => {
    if (c.alive !== false) opts.push({ kind: 'child', idx: i, name: c.name, gender: c.gender, label: `以${c.gender === 'F' ? '女儿' : '儿子'} ${c.name} 之名继续` });
  });
  if (state.grandCount > 0) opts.push({ kind: 'grand', idx: 0, name: '孙辈', gender: undefined, label: '以孙辈之名继续（隔代传承）' });
  return opts;
}

/* 计算可继承现金：净资产 × 遗嘱份额（未立遗嘱按法定 35%） */
function inheritanceWorth(state, opt) {
  const worth = Math.max(0, netWorth(state));
  let share = 0.35;
  if (state.will) {
    const same = (state.will.heir.kind === opt.kind) && (opt.kind === 'grand' || state.will.heir.idx === opt.idx);
    share = same ? state.will.share : Math.max(0, state.will.share * 0.25); // 遗嘱指定之外的人只拿零头
  }
  const cap = opt.kind === 'grand' ? HEIR_GRAND_CAP : HEIR_ASSET_CAP;
  return Math.round(Math.min(worth, worth * cap) * Math.min(1, share));
}

/* 以继承人之名开新局：返回 opt 交给 ui.confirmCreate 同款流程
 * 实现方式：先把继承包挂到 window 级别的暂存（HEIR_PENDING），新局创建后由 applyHeirBoost 注入 */
let HEIR_PENDING = null;

function prepareSuccession(state, opt) {
  const money = inheritanceWorth(state, opt);
  HEIR_PENDING = { money, from: state.name, kind: opt.kind, heirName: opt.name };
  return { money, from: state.name, heirName: opt.name };
}

function takeHeirPending() { const p = HEIR_PENDING; HEIR_PENDING = null; return p; }

/* 新局创建后立即调用：注入资产与家风加成 */
function applyHeirBoost(state) {
  const p = takeHeirPending();
  if (!p) return false;
  state.stats.MONEY += p.money;
  // 家风加成：上一代的教养化为初始属性
  applyEffects(state, { INT: 2, WILL: 2, CHA: 1, NET: 5 }, true);
  state.flags.inheritor = true;
  state.heirFrom = p.from;
  pushLog(state, `【传承】你是 ${p.from} 的${p.kind === 'grand' ? '孙辈' : '子女'}。公证处的信封里，是上一代人留下的 ${fmtMoney(p.money)}，和一句「日子要过得比我们好」。`, 'story');
  pushLog(state, '【家风】更好的教养、更宽的起点。但人生的路，还是你自己一步一步走。', 'muted');
  return true;
}

/* ---------------- 重生：人生重来 ---------------- */
let REBIRTH_PENDING = false;

function prepareRebirth() { REBIRTH_PENDING = true; }
function takeRebirthPending() { const r = REBIRTH_PENDING; REBIRTH_PENDING = false; return r; }

function applyRebirthBoost(state) {
  if (!takeRebirthPending()) return false;
  applyEffects(state, REBIRTH_BONUS, true);
  state.flags.reborn = true;
  pushLog(state, '【前世记忆】你带着一点说不清的熟悉感醒来。有些坑，你好像在哪一世已经踩过。（智力 +3 · 意志 +3）', 'story');
  return true;
}
