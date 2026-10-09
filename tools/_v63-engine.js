/* =========================================================
 * v6.3.0 人生图谱与亲情深化（A 包）
 *   A1 兄弟姐妹：出生生成 / 年度互动 / 遗产分摊 / 家人页
 *   A2 子女养育事件：未成年子女年度小剧情
 *   A4 家族企业：创办 / 年度经营 / 70 岁接班考核
 *   C3 大学社团与留学（引擎侧：旗标与年度加成）
 * 挂点：createGame / migrateState / npcTick / yearBase /
 *       makeInheritanceEvent（兄弟分产）/ settlePrestige（legacy）
 * ========================================================= */

/* ---------- A1 兄弟姐妹 ---------- */
/* 计划生育语境：1980 前随便生，1980-97 农村宽松，1998 后极少；单亲减半，福利院无 */
function makeSiblings(state) {
  const y = state.startYear;
  const fid = state.familyId;
  if (fid === 'fuli' || state.flags.orphan) return [];
  let maxN = 0, pAny = 1;
  if (y < 1980) { maxN = 3; }
  else if (y < 1998) { maxN = (fid === 'nongcun') ? 2 : 1; pAny = (fid === 'nongcun') ? 0.85 : 0.55; }
  else { maxN = 1; pAny = 0.14; }
  if (fid === 'danqin') { maxN = Math.min(maxN, 1); pAny *= 0.5; }
  const n = (maxN === 0 || !chance(pAny)) ? 0 : randInt(1, maxN);
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = chance(0.5) ? 'M' : 'F';
    const older = chance(0.55);
    const diff = randInt(1, 6);
    const sib = {
      name: parentNameFor({ name: state.name }, g),
      gender: g,
      born: older ? y - diff : y + diff,   // 出生年份（相对你）
      affinity: randInt(45, 80),
      alive: true,
      married: false,
      touchYear: -1
    };
    out.push(sib);
    state.queue.push({
      id: 'sib_birth_' + i, w: 0, age: [0, 200],
      text: older
        ? `你出生时，家里已经有个 ${diff} 岁的${g === 'M' ? '哥哥' : '姐姐'}——${sib.name}。据说是 TA 先摸了摸你的脸，才肯让别人抱的。`
        : `${diff} 岁那年，家里添了个${g === 'M' ? '弟弟' : '妹妹'}——${sib.name}。你第一次抱 TA，胳膊都在抖。`
    });
  }
  return out;
}

function sibAge(state, s) { return state.startYear + state.age - s.born; }

function sibAliveN(state) { return (state.siblings || []).filter(s => s.alive).length; }

/* 年度兄弟姐妹剧情（挂 npcTick） */
function siblingTick(state) {
  if (!state.siblings || !state.siblings.length) return;
  for (const s of state.siblings) {
    if (!s.alive) continue;
    const a = sibAge(state, s);
    if (a > 72 && chance(0.035)) {
      s.alive = false;
      pushLog(state, `【白事】${s.name} 走了。你翻出小时候两个人的合影，站了很久。`, 'warn');
      applyEffects(state, { MOOD: -8, STRESS: 4 });
      continue;
    }
    if (a < 4) continue;
    const roll = Math.random();
    if (roll < 0.10) {
      s.affinity = clamp((s.affinity || 50) + 3, 0, 100);
      if (a <= 16) pushLog(state, `【手足】你和${s.name}把攒了很久的零花钱凑在一起，买了全校最气派的陀螺。`, 'story');
      else pushLog(state, `【手足】${s.name}深夜打来电话，什么大事也没有，就是聊了两个小时。`, 'story');
    } else if (roll < 0.16 && a <= 18) {
      s.affinity = clamp((s.affinity || 50) - 4, 0, 100);
      applyEffects(state, { MOOD: -2 });
      pushLog(state, `【手足】你和${s.name}为了最后一块排骨大吵一架，三天没说话。`, 'muted');
    } else if (roll < 0.22 && a >= 18) {
      /* 成年后互助：TA 帮你，或你帮 TA */
      if ((s.affinity || 0) >= 60) {
        const amt = randInt(2, 8) * 1000000;
        state.stats.MONEY += amt;
        pushLog(state, `【手足】${s.name}生意上周转不开又缓过来了，执意塞给你一个信封：${fmtMoney(amt)}。「一家人别说这个。」`, 'money');
        applyEffects(state, { LOVE: 2, SEC: 2 });
      } else if (state.stats.MONEY > 20000000 && chance(0.5)) {
        const amt = randInt(3, 10) * 1000000;
        state.stats.MONEY -= amt;
        s.affinity = clamp((s.affinity || 50) + 8, 0, 100);
        pushLog(state, `【手足】${s.name}家里出了事开口借钱。你二话没说转了 ${fmtMoney(amt)}。亲戚都说你仗义。`, 'money');
        applyEffects(state, { FAME: 2, LOVE: 3 });
      }
    } else if (roll < 0.24 && a >= 24 && a <= 38 && !s.married) {
      s.married = true;
      pushLog(state, `【手足】${s.name}结婚了。婚宴上你作为${s.born < state.startYear ? '兄' : '姐'}${state.gender === 'M' ? '' : '妹'}致辞，说到一半哽住了。`, 'story');
      applyEffects(state, { NET: 3, MOOD: 4 });
    }
  }
}

/* 家人页「联系」入口（ui.js 调用） */
function sibChat(state, i) {
  const s = (state.siblings || [])[i];
  if (!s || !s.alive) return { ok: false, msg: 'TA 已经不在了' };
  if (s.touchYear === state.age) return { ok: false, msg: '今年已经见过面了' };
  s.touchYear = state.age;
  s.affinity = clamp((s.affinity || 50) + randInt(3, 7), 0, 100);
  applyEffects(state, { MOOD: 3, LOVE: 1 });
  const lines = [
    `你和${s.name}约了顿饭。从爸妈聊到孩子，临走时 TA 把剩菜全塞给了你。`,
    `你和${s.name}打了一下午牌。输的人请客，最后你俩抢着买单。`,
    `你帮${s.name}看了半天房。意见不合吵了两句，但出门时 TA 还是把你的外套搭好了。`
  ];
  return { ok: true, msg: lines[randInt(0, lines.length - 1)] };
}

/* ---------- A2 子女养育事件（未成年子女年度小剧情） ---------- */
const CHILD_STORIES = [
  { t: c => `【孩子】${c.name}拿了年级第一，奖状贴满了半面墙。你嘴上说「别骄傲」，转身把它拍进了家庭相册。`, eff: { MOOD: 5, GROW: 2 } },
  { t: c => `【孩子】${c.name}半夜发烧。你和${c.gender === 'F' ? '她' : '他'}在医院坐到天亮，小手一直攥着你的手指。`, eff: { MOOD: -3, STRESS: 4, LOVE: 3 } },
  { t: c => `【孩子】${c.name}开始叛逆了，房门上挂了块「闲人免进」。你在门口站了一会儿，把唠叨咽了回去。`, eff: { STRESS: 3, MOOD: -2 } },
  { t: c => `【孩子】${c.name}迷上了画画，课本边角全是小人。你没撕，报了个周末班。`, eff: { MONEY: -2000000, CUR: 2, MOOD: 3 } },
  { t: c => `【孩子】${c.name}在学校跟人打架了。对方家长来找，你先道了歉，回家才问缘由——原来是对方先动的手。`, eff: { STRESS: 5 } },
  { t: c => `【孩子】${c.name}第一次主动做了一桌菜，咸得发苦。你吃完了三碗饭。`, eff: { MOOD: 6, LOVE: 4 } },
  { t: c => `【孩子】${c.name}期中考砸了，把自己关在房间里。你隔着门讲了个自己小时候考砸的故事。`, eff: { MOOD: -2, LOVE: 3 } },
  { t: c => `【孩子】${c.name}在运动会上跑了第一棒。你在看台上喊到嗓子哑。`, eff: { MOOD: 5, STR: 1 } },
  { t: c => `【孩子】${c.name}把攒的零花钱捐给了灾区。你什么也没说，只是把 TA 抱了一下。`, eff: { MOOD: 6, ETH: 3 } },
  { t: c => `【孩子】${c.name}养了只流浪猫回来，眼神里全是「求求了」。你叹了口气，去买了猫粮。`, eff: { MONEY: -800000, MOOD: 4, LOVE: 2 } },
  { t: c => `【孩子】${c.name}问了你一个关于死亡的问题。你第一次发现，TA 已经会思考这么远的事了。`, eff: { GROW: 3, CUR: 2 } },
  { t: c => `【孩子】${c.name}的家长会。老师夸${c.gender === 'F' ? '她' : '他'}「心里有光」。你走出校门时腰杆挺得笔直。`, eff: { MOOD: 6, FAME: 1 } }
];

function childTick(state) {
  if (!state.children || !state.children.length) return;
  for (const c of state.children) {
    if (c.alive === false) continue;
    const a = childAge(state, c);
    if (a < 3 || a >= 18) continue;
    if (!chance(0.26)) continue;
    const st = CHILD_STORIES[randInt(0, CHILD_STORIES.length - 1)];
    pushLog(state, st.t(c), 'story');
    applyEffects(state, st.eff);
  }
}

/* ---------- A4 家族企业 ---------- */
/* 创办：data.js 事件 biz_fam（52-62 岁，MONEY ≥ 5 亿）给 flags.fam_biz；
 * 这里负责落实体、年度经营、70 岁接班考核。 */
function famBizTick(state) {
  if (!state.flags.fam_biz) return;
  if (!state.famBiz) {
    state.famBiz = {
      name: (state.name[0] || '家') + '氏集团',
      val: Math.max(300000000, Math.round(worthOf(state) * 0.5)),
      foundYear: state.startYear + state.age,
      heirDone: false
    };
    pushLog(state, `【家业】「${state.famBiz.name}」挂牌那天，你在门口站了很久。从今天起，这不只是一门生意，是一个姓。`, 'money');
    return;
  }
  const biz = state.famBiz;
  const s = state.stats;
  const g = 0.035 + clamp((s.LOY || 0) * 0.0008, 0, 0.06) + rand(-0.055, 0.085);
  biz.val = Math.max(50000000, Math.round(biz.val * (1 + g)));
  const div = Math.round(biz.val * 0.015);
  s.MONEY += div;
  if (chance(0.07)) {
    const hit = Math.round(biz.val * (0.08 + Math.random() * 0.1));
    biz.val -= hit;
    s.STRESS += 6;
    pushLog(state, `【家业】行业寒冬，${biz.name}一笔大单黄了。你连夜开会，砍掉了一条产线。`, 'warn');
  } else if (g > 0.09 && chance(0.5)) {
    pushLog(state, `【家业】${biz.name}今年拿下了行业大奖。庆功宴上，老臣们敬你的酒一杯接一杯。`, 'story');
  }
  /* 接班考核：70 岁一次性结算 */
  if (state.age >= 70 && !biz.heirDone) {
    biz.heirDone = true;
    const heirs = (state.children || []).filter(c => c.alive !== false);
    const nHeir = heirs.length;
    const heirScore = nHeir === 0 ? 0
      : heirs.reduce((acc, c) => acc + clamp((c.affinityForBiz != null ? c.affinityForBiz : 55) + (state.age - (c.born || 20) >= 0 && childAge(state, c) >= 22 && childAge(state, c) <= 48 ? 18 : 0), 0, 100), 0) / nHeir;
    const spouseBonus = (state.spouse && state.spouse.alive !== false && (state.spouse.affinity || 0) >= 60) ? 8 : 0;
    const final = heirScore + spouseBonus + clamp((s.LOY || 0) * 0.2, 0, 15);
    if (nHeir === 0) {
      state.flags.fam_biz_ok = false;
      const sell = Math.round(biz.val * 0.7);
      s.MONEY += sell;
      pushLog(state, `【接班】你没有子女。${biz.name}最终作价 ${fmtMoney(sell)} 售予同行。签字那天，你在会议室坐到保洁来赶人。`, 'warn');
      applyEffects(state, { MOOD: -12 });
    } else if (final >= 62) {
      state.flags.fam_biz_ok = true;
      const keep = Math.round(biz.val * 0.45);
      s.MONEY += keep;
      pushLog(state, `【接班】「${biz.name}」的交接完成得很漂亮——${heirs[0].name}接得住。你把办公室的钥匙交出去那天，只带走了桌上那张全家福。家族的下一代会记得你今天的安排。`, 'money');
      applyEffects(state, { FAME: 8, MOOD: 10 });
    } else {
      state.flags.fam_biz_ok = false;
      biz.val = Math.round(biz.val * 0.5);
      pushLog(state, `【接班】败家子们接管了${biz.name}。三年，市值腰斩。你在董事会上拍了桌子，但时代已经不是你的了。`, 'warn');
      applyEffects(state, { MOOD: -10, STRESS: 8 });
    }
  }
}

/* ---------- C3 大学社团与留学（引擎侧年度结算） ---------- */
const UNI_CLUBS = {
  club_debate: { name: '辩论队', pass: { CHA: 2, INT: 1, NET: 1 }, cost: 1000000 },
  club_bball: { name: '篮球队', pass: { STR: 2, HP: 1, NET: 1 }, cost: 1000000 },
  club_photo: { name: '摄影社', pass: { CUR: 2, CHA: 1, MOOD: 1 }, cost: 2200000 }
};

function uniLifeTick(state) {
  const inUni = (typeof schoolStageOf === 'function') && schoolStageOf(state) === 'uni';
  if (inUni && !state.flags.uni_life) {
    state.flags.uni_life = true;
  } else if (!inUni && state.flags.uni_life) {
    delete state.flags.uni_life;
  }
  /* 社团年度加成与活动费 */
  if (inUni) {
    for (const k in UNI_CLUBS) {
      if (!state.flags[k]) continue;
      const cb = UNI_CLUBS[k];
      applyEffects(state, cb.pass);
      state.stats.MONEY -= cb.cost;
      if (chance(0.15)) {
        pushLog(state, `【社团】${cb.name}拿了市级奖。聚餐时社长举着杯子说：我们这届，值了。`, 'story');
        applyEffects(state, { MOOD: 5, NET: 3 });
      }
    }
  }
  /* 留学：烧钱 + 视野 */
  if (state.flags.abroad && inUni) {
    state.stats.MONEY -= 26000000;
    applyEffects(state, { INT: 2, GROW: 3, CUR: 2, NET: 1 });
    if (chance(0.2)) {
      pushLog(state, `【留学】小组作业拿了全系第一，教授说你的思路「很有东方的狡黠」。你请全组吃了顿火锅。`, 'story');
      applyEffects(state, { NET: 3, MOOD: 4 });
    }
  }
}
