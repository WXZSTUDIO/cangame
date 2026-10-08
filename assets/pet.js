/* =========================================================
 * v6.0.0 · 宠物生态模块（pet.js）
 * 依赖：engine.js 的 rand/randInt/chance/clamp/fmtMoney/pushLog/applyEffects/addGrief/randomPetName
 * 加载顺序：data → market → engine → school → career → love → pet → legacy → loan → ui
 *
 * 结构：
 *   state.pets[]  所有宠物（含主宠）  { type, name, age, alive, bond, groom, since }
 *   state.pet     主宠别名 = state.pets[0]（兼容旧事件系统的 cond.pet / petDeath）
 *   state.horse   赛马（单独通道）    { name, age, alive, train, wins }
 * ========================================================= */

/* type: key / shop 名 / price 购入价 / feed 年喂养费 / life 预期寿命 / charm 选美系数 / exotic 异宠 */
const PET_TYPES = {
  dog:     { name: '中华田园犬', icon: '🐶', price: 800000,    feed: 600000,   life: 15, charm: 1.0 },
  cat:     { name: '狸花猫',     icon: '🐱', price: 900000,    feed: 550000,   life: 16, charm: 1.1 },
  pig:     { name: '小香猪',     icon: '🐷', price: 2000000,   feed: 700000,   life: 12, charm: 0.9, exotic: true },
  spider:  { name: '捕鸟蛛',     icon: '🕷', price: 1500000,   feed: 200000,   life: 10, charm: 0.6, exotic: true },
  snake:   { name: '玉米蛇',     icon: '🐍', price: 2200000,   feed: 250000,   life: 14, charm: 0.6, exotic: true },
  lizard:  { name: '鬃狮蜥',     icon: '🦎', price: 2600000,   feed: 300000,   life: 11, charm: 0.7, exotic: true },
  rabbit:  { name: '安哥拉兔',   icon: '🐰', price: 1200000,   feed: 350000,   life: 10, charm: 1.2 },
  bird:    { name: '玄凤鹦鹉',   icon: '🦜', price: 1800000,   feed: 250000,   life: 18, charm: 1.0, exotic: true },
  chow:    { name: '松狮犬',     icon: '🐕', price: 6000000,   feed: 900000,   life: 13, charm: 1.3 },
  lioncat: { name: '狮子猫',     icon: '🐈', price: 5500000,   feed: 700000,   life: 15, charm: 1.4 }
};

/* v6：异宠与赛马的名字池（不覆盖 engine 的 randomPetName，避免串名） */
function petNameV6(type) {
  const pools = {
    pig: ['包子', '粉团', '哼哼', '年糕'],
    spider: ['八筒', '毛栗', '影子'],
    snake: ['小弯', '麻花', '线团'],
    lizard: ['刺猬头', '小霸', '石头'],
    rabbit: ['雪球', '跳跳', '团子'],
    bird: ['啾啾', '小哨', '云雀'],
    chow: ['狮子头', '墩墩', '毛球'],
    lioncat: ['小狮', '绒绒', '奶油'],
    horse: ['追风', '踏雪', '赤兔', '青云', '闪电'],
    dog: ['旺财', '大黄', '豆豆'],
    cat: ['咪咪', '橘子', '雪球']
  };
  const pool = pools[type] || pools.dog;
  return pool[randInt(0, pool.length - 1)];
}

const PET_CAP = 4;                 // 同时最多养 4 只
const PET_MAX_AGE_FLEX = 4;        // 寿命浮动 ±4 年
const HORSE_PRICE = 30000000;      // 赛马购入价
const HORSE_TRAIN_COST = 6000000;  // 一次系统训练
const HORSE_RACE_FEE = 3000000;    // 报名费
const HORSE_PRIZE = [0, 80000000, 25000000, 8000000]; // 冠军/亚军/季军 奖金
const BEAUTY_FEE = 2000000;        // 选美报名费
const BEAUTY_PRIZE = 22000000;
const GROOM_COST = 800000;         // 美容一次

function petsInit(state) {
  if (!state.pets) {
    state.pets = [];
    // 旧存档迁移：state.pet 并入 pets
    if (state.pet && state.pet.alive) {
      state.pets.push(state.pet);
      state.pet = state.pets[0];
    }
  }
  return state.pets;
}

function petsMigrate(state) { return petsInit(state); }

function petBuy(state, type) {
  const t = PET_TYPES[type];
  if (!t) return { ok: false, msg: '没有这种宠物' };
  const pets = petsInit(state);
  if (pets.filter(p => p.alive).length >= PET_CAP) return { ok: false, msg: `最多同时养 ${PET_CAP} 只` };
  const s = state.stats;
  if (s.MONEY < t.price) return { ok: false, msg: '钱不够' };
  s.MONEY -= t.price;
  const pet = { type, name: petNameV6(type), age: 0, alive: true, bond: 55, groom: 0, since: state.age };
  pets.push(pet);
  state.pet = pets[0];
  pushLog(state, `【新成员】你把 ${t.name} 接回了家，取名 ${pet.name}。家里多了一个等你开门的生命。`, 'muted');
  return { ok: true, pet };
}

function petByName(state, idx) {
  const pets = petsInit(state).filter(p => p.alive);
  return pets[idx] || null;
}

/* 喂养：花小钱，涨 bond 与 LO/心情；宠物不会因为没喂而死，但 bond 会掉 */
function petFeed(state, idx) {
  const p = petByName(state, idx);
  if (!p) return { ok: false, msg: '没有这只宠物' };
  const t = PET_TYPES[p.type];
  const s = state.stats;
  if (s.MONEY < t.feed) return { ok: false, msg: '连口粮钱都不够了' };
  s.MONEY -= t.feed;
  p.bond = clamp(p.bond + randInt(5, 9), 0, 100);
  s.LOVE = (s.LOVE || 0) + 2; s.MOOD = (s.MOOD || 60) + 3; s.SEC = (s.SEC || 0) + 1;
  pushLog(state, `【喂养】你给 ${p.name} 换了新口粮。它围着你的脚边转了三圈。`, 'muted');
  return { ok: true };
}

/* 美容：选美的前置养成 */
function petGroom(state, idx) {
  const p = petByName(state, idx);
  if (!p) return { ok: false, msg: '没有这只宠物' };
  const s = state.stats;
  if (s.MONEY < GROOM_COST) return { ok: false, msg: '钱不够' };
  s.MONEY -= GROOM_COST;
  p.groom = Math.min(5, (p.groom || 0) + 1);
  p.bond = clamp(p.bond + 2, 0, 100);
  s.MOOD = (s.MOOD || 60) + 2;
  pushLog(state, `【美容】宠物店给 ${p.name} 做了全套造型。出门时回头率明显高了一截。（美容 ${p.groom}/5）`, 'muted');
  return { ok: true };
}

/* 繁育：两只同类型成年宠物，一年一次机会 */
function petBreed(state, i, j) {
  const pets = petsInit(state);
  const a = petByName(state, i), b = petByName(state, j);
  if (!a || !b || a === b) return { ok: false, msg: '选两只不同的宠物' };
  if (a.type !== b.type) return { ok: false, msg: '只有同类才能繁育' };
  if (pets.filter(p => p.alive).length >= PET_CAP) return { ok: false, msg: `最多同时养 ${PET_CAP} 只` };
  if (!chance(0.55 + (a.bond + b.bond) / 400)) return { ok: false, msg: '今年没有怀上，明年再试试' };
  const baby = { type: a.type, name: petNameV6(a.type), age: 0, alive: true, bond: 70, groom: 0, since: state.age, baby: true };
  pets.push(baby);
  state.stats.MOOD = (state.stats.MOOD || 60) + 5;
  pushLog(state, `【新生】${a.name} 当妈妈了！一窝小崽子里你留了一只，叫 ${baby.name}。`, 'muted');
  return { ok: true, baby };
}

/* 宠物选美：美容次数 + bond + 类型 charm 决定胜率 */
function petBeautyContest(state, idx) {
  const p = petByName(state, idx);
  if (!p) return { ok: false, msg: '没有这只宠物' };
  const t = PET_TYPES[p.type];
  const s = state.stats;
  if (s.MONEY < BEAUTY_FEE) return { ok: false, msg: '报名费都不够了' };
  s.MONEY -= BEAUTY_FEE;
  const winP = clamp(0.08 + (p.groom || 0) * 0.09 + p.bond / 300 * t.charm, 0.05, 0.6);
  if (chance(winP)) {
    s.MONEY += BEAUTY_PRIZE;
    s.FAME = (s.FAME || 0) + 6;
    s.MOOD = (s.MOOD || 60) + 6;
    state.flags.pet_beauty_win = true;
    pushLog(state, `【选美】${p.name} 拿了宠物选美冠军！奖杯比它本人（本猫/本狗）还高。奖金 ${fmtMoney(BEAUTY_PRIZE)}。`, 'money');
    return { ok: true, win: true };
  }
  pushLog(state, `【选美】${p.name} 进了决赛但只拿了参与奖。评委说它的状态「差一次美容」（美容 ${p.groom || 0}/5）。`, 'muted');
  return { ok: true, win: false };
}

/* ---------------- 赛马线：捕捉 / 购买 / 培养 / 比赛 ---------------- */
function horseOwn(state) { return !!(state.horse && state.horse.alive); }

function horseAcquire(state, how) {
  if (horseOwn(state)) return { ok: false, msg: '你已经有一匹赛马了' };
  const s = state.stats;
  if (how === 'catch') {
    // 草原之行捕捉：便宜但要赌
    if (s.MONEY < 5000000) return { ok: false, msg: '路费都不够' };
    s.MONEY -= 5000000;
    if (!chance(0.45)) {
      pushLog(state, '【草原】你在草原上追了七天，只带回一身马鞍味和半卷照片。马没看上你。', 'muted');
      return { ok: true, got: false };
    }
  } else {
    if (s.MONEY < HORSE_PRICE) return { ok: false, msg: '买马的钱不够' };
    s.MONEY -= HORSE_PRICE;
  }
  state.horse = { name: petNameV6('horse'), age: 3, alive: true, train: 0, wins: 0 };
  pushLog(state, `【赛马】${how === 'catch' ? '你终于在坡顶套住了它。' : '马商把缰绳交到你手上。'}这是一匹三岁的青骢马，你给它取名 ${state.horse.name}。`, 'money');
  return { ok: true, got: true };
}

function horseTrain(state) {
  if (!horseOwn(state)) return { ok: false, msg: '你还没有赛马' };
  const s = state.stats;
  if (s.MONEY < HORSE_TRAIN_COST) return { ok: false, msg: '训练费不够' };
  s.MONEY -= HORSE_TRAIN_COST;
  state.horse.train = Math.min(10, state.horse.train + 1);
  s.STR = (s.STR || 0) + 1; s.MOOD = (s.MOOD || 60) + 2;
  pushLog(state, `【训练】凌晨五点的马场，你陪着 ${state.horse.name} 跑了二十圈。（训练度 ${state.horse.train}/10）`, 'muted');
  return { ok: true };
}

function horseRace(state) {
  if (!horseOwn(state)) return { ok: false, msg: '你还没有赛马' };
  const h = state.horse;
  const s = state.stats;
  if (s.MONEY < HORSE_RACE_FEE) return { ok: false, msg: '报名费不够' };
  s.MONEY -= HORSE_RACE_FEE;
  const winP = clamp(0.06 + h.train * 0.055 + (s.STR || 0) / 600, 0.05, 0.62);
  const r = Math.random();
  if (r < winP) {
    h.wins += 1;
    s.MONEY += HORSE_PRIZE[1];
    s.FAME = (s.FAME || 0) + 8; s.MOOD = (s.MOOD || 60) + 8;
    state.flags.horse_race_win = true;
    pushLog(state, `【赛马】${h.name} 一路领先冲过终点！头马奖金 ${fmtMoney(HORSE_PRIZE[1])}。看台上的你在吼什么自己都听不见。`, 'money');
    return { ok: true, place: 1 };
  } else if (r < winP + 0.18) {
    s.MONEY += HORSE_PRIZE[2];
    s.FAME = (s.FAME || 0) + 3;
    pushLog(state, `【赛马】${h.name} 拿了亚军，奖金 ${fmtMoney(HORSE_PRIZE[2])}。差半个马身，明年再来。`, 'money');
    return { ok: true, place: 2 };
  } else if (r < winP + 0.32) {
    s.MONEY += HORSE_PRIZE[3];
    pushLog(state, `【赛马】${h.name} 拿了季军，奖金 ${fmtMoney(HORSE_PRIZE[3])}。`, 'money');
    return { ok: true, place: 3 };
  }
  if (chance(0.04)) {
    h.alive = false;
    applyEffects(state, { MOOD: -10, LOVE: -3 });
    addGrief(state, `赛马 ${h.name} 在比赛中受了重伤`, 10);
    pushLog(state, `【赛马】意外：${h.name} 在弯道失蹄，再也没能站起来。兽医的建议写在一张你没敢细看的单子上。`, 'warn');
    return { ok: true, place: 0, dead: true };
  }
  pushLog(state, `【赛马】${h.name} 今天状态不佳，名次在末尾。老骑师拍拍你：「回去加练。」`, 'muted');
  return { ok: true, place: 0 };
}

/* ---------------- 年度结算：petTick ---------------- */
function petTick(state) {
  const pets = petsInit(state);
  // 主宠别名保持有效
  if (pets.length) state.pet = pets[0];

  pets.forEach(p => {
    if (!p.alive) return;
    const t = PET_TYPES[p.type];
    p.age += 1;
    // 喂养：自动扣钱，没钱则 bond 掉
    if (state.stats.MONEY >= t.feed) {
      state.stats.MONEY -= t.feed;
      p.bond = clamp(p.bond + 1, 0, 100);
    } else {
      p.bond = clamp(p.bond - 8, 0, 100);
    }
    p.baby = false;
    // 寿命判定
    const dieAge = t.life + randInt(-PET_MAX_AGE_FLEX, PET_MAX_AGE_FLEX);
    if (p.age >= dieAge || chance(p.age > t.life ? 0.25 : 0.012)) {
      p.alive = false;
      applyEffects(state, { LOVE: -5, SEC: -3 });
      addGrief(state, `${t.name} ${p.name} 走了`, 12);
      pushLog(state, `【离别】${p.name} 在睡梦中走了。它这一生很短，但它把所有的都给了你。`, 'warn');
    }
  });

  // 赛马变老
  if (horseOwn(state)) {
    const h = state.horse;
    h.age += 1;
    if (h.age > 18 && chance(0.18)) {
      h.alive = false;
      applyEffects(state, { MOOD: -6 });
      pushLog(state, `【老马】${h.name} 十八岁了，跑不动了。你把它送去了牧场的养老马厩。`, 'muted');
    }
  }

  // 流浪动物敲门（有宠物且 bond 高时的小概率温情事件）
  const alive = pets.filter(p => p.alive);
  if (alive.length && chance(0.05) && pets.length < PET_CAP) {
    const types = Object.keys(PET_TYPES);
    const tp = types[randInt(0, types.length - 1)];
    const stray = { type: tp, name: petNameV6(tp), age: 0, alive: true, bond: 65, groom: 0, since: state.age, stray: true };
    pets.push(stray);
    pushLog(state, `【收留】门口纸箱里有一只被遗弃的 ${PET_TYPES[tp].name}。你叹了口气，把它抱了进来，取名 ${stray.name}。`, 'muted');
  }
}
