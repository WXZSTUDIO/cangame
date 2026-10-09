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
    if (c.alive !== false) {
      // v6.2：没认领的私生子在法律上还不是你的孩子——写不进遗嘱（但他们会在你死后出现）
      if (c.illegit && !c.ack) return;
      opts.push({
        kind: 'child', idx: i,
        label: `${c.name}（${c.gender === 'F' ? '女儿' : '儿子'} · ${childAge(state, c)} 岁${c.illegit ? ' · 非婚生' : ''}）`
      });
    }
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
    if (c.alive !== false) {
      if (c.illegit && !c.ack) return;   // v6.2：没名分的孩子，进不了继承人名单
      opts.push({ kind: 'child', idx: i, name: c.name, gender: c.gender, label: `以${c.gender === 'F' ? '女儿' : '儿子'} ${c.name} 之名继续` });
    }
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

/* =========================================================
 * v6.1.0 · 家族系统：家族信托 / 门阀声望 / 冷冻休眠
 * 跨局持久化走 localStorage（vm 测试沙箱自动降级为内存）。
 * ========================================================= */
let _KV_MEM = {};
function kvGet(k) {
  try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { }
  return _KV_MEM[k] !== undefined ? JSON.parse(_KV_MEM[k]) : null;
}
function kvSet(k, v) {
  const s = JSON.stringify(v);
  _KV_MEM[k] = s;
  try { localStorage.setItem(k, s); } catch (e) { }
}

const FAM_KEY = 'cangame_family_v1';
function famVault() {
  const v = kvGet(FAM_KEY);
  return (v && typeof v === 'object') ? v : { prestige: 0, gen: 0, trust: null, cryo: null, perk: null };
}
function famSave(v) { kvSet(FAM_KEY, v); }

/* ---------------- 家族信托 ----------------
 * 富裕世代锁定一部分资金进「永不取出的保险柜」。
 * 本金取不出来——但只要姓这个姓，每一代都能按本金 0.6% 领年度给付，
 * 败家子也饿不死，家族香火不断。 */
const TRUST_MIN_NET = 50000000;   // 净资产 0.5 亿起可设
const TRUST_MIN_IN = 20000000;    // 单次存入下限 2000 万

function trustInfo() { return famVault().trust; }

function canSetupTrust(state) {
  return !!state && !state.finished && state.age >= 40 && netWorth(state) >= TRUST_MIN_NET;
}

function setupTrust(state, amount) {
  if (!canSetupTrust(state)) return { ok: false, msg: `年满 40 岁、净资产 ${fmtMoney(TRUST_MIN_NET)} 以上才能设立家族信托` };
  amount = Math.round(amount);
  const net = Math.max(0, netWorth(state));
  if (!(amount >= TRUST_MIN_IN) || amount > net * 0.6) {
    return { ok: false, msg: `本金需在 ${fmtMoney(TRUST_MIN_IN)} 与净资产六成之间` };
  }
  state.stats.MONEY -= amount;
  const v = famVault();
  v.trust = { money: ((v.trust && v.trust.money) || 0) + amount, founder: state.name, sinceYear: fmtYear(state) };
  famSave(v);
  state.flags.trust_founder = true;
  pushLog(state, `【家族信托】你在信托合同上签了字。${fmtMoney(amount)} 从此锁进家族的保险柜——它不再属于你，它属于这个姓。`, 'story');
  return { ok: true };
}

/* 年度信托给付：未成年由监护人代领一半 */
function trustTick(state) {
  const t = famVault().trust;
  if (!t || !t.money || !state || state.finished || state.prison > 0) return;
  if (state.age < 6) return;
  let pay = Math.round(t.money * 0.006);
  if (state.age < 18) pay = Math.round(pay * 0.5);
  if (pay <= 0) return;
  state.stats.MONEY += pay;
  state.flags.trust_beneficiary = true;
  if (state.age === 6 || state.age === 18 || chance(0.3)) {
    pushLog(state, `【信托】家族办公室的转账准时到账：${fmtMoney(pay)}。` +
      (state.age < 18 ? '这笔钱由监护人代管，但条款上印着你的名字。' : '信托条款的第一条写着：只要还姓这个姓，就饿不死。'), 'money');
  }
}

/* ---------------- 门阀声望（Legacy Tier） ----------------
 * 每一代的成就换算成声望点，局外永久保留；
 * 出生时可以花声望点买「投胎特权」。 */
const RANK_PTS = { S: 120, A: 80, B: 45, C: 20, D: 6 };
const RICH_FAMILIES = ['qiaojuan', 'chaiqian', 'yiliao', 'tizhinei', 'keyan', 'jiaoshi'];
const PRESTIGE_PERKS = [
  { id: 'perk_rich', icon: '🍼', name: '含着金汤匙', cost: 60, desc: '下一世必定出生在侨眷 / 拆迁 / 医生世家这类殷实人家' },
  { id: 'perk_stat', icon: '🧬', name: '天资卓越', cost: 30, desc: '下一世先天资质 +8（智力 / 体魄 / 魅力 / 意志）' },
  { id: 'perk_talent', icon: '🎴', name: '命格有余', cost: 20, desc: '下一世天赋点 +6（10 → 16）' },
  { id: 'perk_cash', icon: '🧧', name: '出生红包', cost: 10, desc: '下一世出生时家里塞给你一笔启动资金' }
];

/* 一代人生结束（结局页）调用：把成就折成声望点 */
function settlePrestige(state) {
  if (!state) return 0;
  const v = famVault();
  let pts = RANK_PTS[state.rank] || 6;
  const peakNet = (state.peak && (state.peak.NET || state.peak.MONEY)) || 0;
  pts += Math.min(60, Math.floor(Math.log10(Math.max(1, peakNet / 10000000)) * 8));
  pts += (state.achievements || []).length * 4;
  if (state.flags.astronaut) pts += 30;
  if (state.flags.superbrain_win) pts += 15;
  if (state.flags.trust_founder) pts += 10;
  if (state.flags.foundation) pts += 8;
  if (state.flags.cryonaut) pts += 20;
  /* v6.3.0：家族企业顺利交接 —— 门阀再添一笔 */
  if (state.flags.fam_biz_ok) pts += 25;
  if (state.flags.fam_biz && !state.flags.fam_biz_ok) pts += 6;
  if (state.career && state.career.lv >= 5) pts += 10;
  pts = Math.min(200, Math.round(pts));
  v.prestige += pts;
  famSave(v);
  return pts;
}

function buyPerk(id) {
  const p = PRESTIGE_PERKS.find(x => x.id === id);
  if (!p) return { ok: false, msg: '没有这个特权' };
  const v = famVault();
  if (v.perk === id) return { ok: false, msg: '这个特权已经买好，等着下一世生效' };
  if (v.perk) return { ok: false, msg: '已有一个待生效的特权（一次只能带一个进产房）' };
  if (v.prestige < p.cost) return { ok: false, msg: `声望点不够（还差 ${p.cost - v.prestige} 点）` };
  v.prestige -= p.cost;
  v.perk = id;
  famSave(v);
  return { ok: true };
}

function takeBirthPerk() {
  const v = famVault();
  const p = v.perk || null;
  v.perk = null;
  famSave(v);
  return p;
}

/* 出生页展示用：当前声望与待生效特权 */
function prestigeInfo() {
  const v = famVault();
  return { prestige: v.prestige || 0, gen: v.gen || 0, perk: v.perk || null, trust: v.trust || null, cryo: v.cryo || null };
}

/* ---------------- 冷冻休眠（Cryonics） ----------------
 * 绝症 / 病危且现金充足：清算全部资产支付巨额费用，把整个人冻起来。
 * 冷冻消耗一代；等 2 代之后医学进步，可以「解冻苏醒」重新接管家族。 */
const CRYO_COST = 300000000;   // 3 亿冷冻费
const CRYO_THAW_GENS = 2;      // 冷冻 2 代后可唤醒

function canCryo(state) {
  return !!state && !state.finished && state.age >= 25 &&
    ((state.ill && state.ill.stage >= 3) || (state.stats.HP || 0) < 15) &&
    state.stats.MONEY >= CRYO_COST;
}

function prepareCryo(state) {
  if (!canCryo(state)) {
    return { ok: false, msg: `需要：绝症或病危 · 现金 ${fmtMoney(CRYO_COST)} · 年满 25 岁` };
  }
  const carry = Math.max(0, Math.round(netWorth(state) * 0.8));
  const v = famVault();
  v.cryo = {
    name: state.name, gender: state.gender,
    money: carry,
    frozenYear: fmtYear(state), frozenAge: state.age,
    stats: { INT: state.stats.INT, STR: state.stats.STR, CHA: state.stats.CHA, WILL: state.stats.WILL, ETH: state.stats.ETH },
    thawGen: (v.gen || 0) + CRYO_THAW_GENS + 1
  };
  v.gen = (v.gen || 0) + 1; // 冷冻本身算一代
  famSave(v);
  state.stats.MONEY = 0;
  finish(state);
  state.ending = {
    id: 'cryo', rank: state.rank, title: '冷冻休眠',
    text: `${fmtYear(state)} 年，你在同意书上签了字。液氮舱合拢的瞬间，你听见医生说：睡吧，让未来替你治病。你把整个家族托付给了时间和下一代。`
  };
  pushLog(state, '【冷冻】舱门合拢。温度一点点往下走，你的心跳从每分钟七十次，走向每分钟零次。', 'story');
  return { ok: true };
}

function cryoReady() {
  const v = famVault();
  return !!(v.cryo && (v.gen || 0) >= v.cryo.thawGen);
}

/* 新局创建后调用：若是冷冻人苏醒，覆盖人物设定 */
function applyCryoRevive(state) {
  const v = famVault();
  if (!v.cryo || (v.gen || 0) < v.cryo.thawGen) return false;
  const c = v.cryo;
  v.cryo = null;
  famSave(v);
  state.name = c.name;
  state.gender = c.gender;
  state.startYear = 2005;                       // 一觉醒来，世界已经是新一代人的
  state.age = Math.max(32, (c.frozenAge || 40) - 10);
  if (c.stats) {
    state.stats.INT = c.stats.INT; state.stats.STR = c.stats.STR;
    state.stats.CHA = c.stats.CHA; state.stats.WILL = c.stats.WILL;
    state.stats.ETH = c.stats.ETH;
  }
  state.stats.MONEY = c.money;
  state.stats.HP = 46;
  state.stats.MOOD = 50;
  state.job = '苏醒者';
  state.ill = null;                              // 当年的不治之症，如今社区医院就能治
  state.flags.cryonaut = true;
  state.log = [];
  pushLog(state, `【解冻】舱门打开时，护士用一种你听不懂的口音说：欢迎回来。你冻进去那年是 ${c.frozenYear} 年——现在，你当年的病，一支针剂就能治。`, 'story');
  pushLog(state, `【家族】托管账户里的 ${fmtMoney(c.money)} 静静滚了几十年复利，等你回来签字。`, 'money');
  return true;
}

/* =========================================================
 * v6.2.0 · 非婚生子女的继承权（权利与义务对称）
 *
 * 现实常识：民法典第 1071 条——非婚生子女享有与婚生子女同等的权利。
 * 所以：
 *   · 认领过的私生子 → 与婚生子女一样，能进遗嘱、能继承
 *   · 没认领过的     → 活着时进不了名单，但你一死，他们会带着亲子鉴定来分家
 * ========================================================= */

/* 还没名分的孩子（活着时藏着的那些） */
function bastardClaims(state) {
  return (state.children || [])
    .filter(c => c.illegit && !c.ack && c.alive !== false)
    .map(c => ({ name: c.name, mother: c.mother, age: childAge(state, c), gender: c.gender }));
}

/* 死亡结算：他们会在葬礼上出现 */
function settleBastardClaims(state) {
  const claims = bastardClaims(state);
  if (!claims.length) return null;
  const worth = Math.max(0, netWorth(state));
  const share = clamp(0.12 * claims.length, 0, 0.35);
  const take = Math.min(Math.round(worth * share), Math.max(0, state.stats.MONEY));
  state.stats.MONEY -= take;
  applyEffects(state, { FAME: -18, ETH: -6 });
  pushLog(state, `【争产】葬礼上来了 ${claims.length} 个你生前不曾公开承认的孩子。\n` +
    `亲子鉴定、律师函、调解书——最后 ${fmtMoney(take)} 划到了他们名下。` +
    `${claims[0] && claims[0].mother ? `他们的母亲是 ${claims[0].mother}。` : ''}\n` +
    `法律不问你愿不愿意：你留下来的血脉，人人有份。`, 'warn');
  state.bastardClaim = { n: claims.length, take: take, names: claims.map(c => c.name) };
  return { n: claims.length, take: take };
}

/* 出生页 / 结局页展示用 */
function bastardInfo(state) {
  const hid = bastardClaims(state);
  const ack = (state.children || []).filter(c => c.illegit && c.ack && c.alive !== false);
  return { hidden: hid.length, ack: ack.length, names: hid.map(c => c.name) };
}
