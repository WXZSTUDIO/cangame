/* =========================================================
 * CANGAME · 升学系统
 * 中考（15）→ 高中分档 → 高考（18）→ 大学分档
 * 学历决定求职门槛，学校质量决定起薪与晋升速度
 * ========================================================= */

/* 学历等级：0 初中以下 / 1 高中·职高 / 2 专科 / 3 二本·三本 / 4 一本·211 / 5 985·研究生 */
const EDU_LEVELS = ['初中以下', '高中 / 职高', '专科', '二本 / 三本', '一本 / 211', '985 / 研究生'];

const EXAM_META = {
  midAge: 15, // 初三结束，参加中考
  gaoAge: 18, // 高三，参加高考
  gaoRestoreYear: 1977,
  studyCap: 100
};

/* ---------------- 高中（中考录取） ---------------- */
const HIGH_SCHOOLS = [
  {
    id: 'hs_key', name: '市重点高中', tier: 3, minScore: 78, years: 3,
    desc: '全市掐尖的那两所。走廊里贴着去年的红榜，晚自习到十点半。',
    eff: { INT: 6, WILL: 4, FAME: 5, STRESS: 8, NET: 4 },
    flags: ['hs_key'], gaoBonus: 12
  },
  {
    id: 'hs_ord', name: '普通高中', tier: 2, minScore: 58, years: 3,
    desc: '县城或区里的一中二中。考上本科要靠自己，没人替你安排。',
    eff: { INT: 4, WILL: 3, STRESS: 6, NET: 3 },
    flags: ['hs_ord'], gaoBonus: 5
  },
  {
    id: 'hs_vo', name: '职业高中 / 中专', tier: 1, minScore: 40, years: 3,
    desc: '学一门手艺：汽修、烹饪、电商、幼师。三年后直接进厂或开店。',
    eff: { STR: 4, CHA: 3, WILL: 2, STRESS: 2, NET: 5 },
    flags: ['hs_vo'], gaoBonus: -4
  },
  {
    id: 'hs_none', name: '辍学 · 进社会', tier: 0, minScore: 0, years: 0,
    desc: '分数线以下。家里说：念不下去就别念了，出去挣口饭吃。',
    eff: { WILL: 6, STR: 5, INT: -3, STRESS: 8, SEC: -6 },
    flags: ['dropout'], gaoBonus: -20
  }
];

/* ---------------- 大学（高考录取） ---------------- */
const UNIVERSITIES = [
  {
    id: 'u_985', name: '985 重点大学', edu: 5, minScore: 92, years: 4, tier: 5,
    major: ['计算机', '金融', '临床医学', '法学', '电子信息'],
    desc: '录取通知书是红色的。村里或小区门口，会贴一张大红榜。',
    eff: { INT: 8, NET: 10, FAME: 10, CHA: 3, WILL: 4 },
    flags: ['uni_985'], salaryK: 1.55
  },
  {
    id: 'u_211', name: '211 大学', edu: 4, minScore: 80, years: 4, tier: 4,
    major: ['软件工程', '会计', '新闻传播', '机械', '师范'],
    desc: '也是好学校。校招的时候，简历能过第一道机器筛选。',
    eff: { INT: 6, NET: 8, FAME: 7, CHA: 2, WILL: 3 },
    flags: ['uni_211'], salaryK: 1.28
  },
  {
    id: 'u_yiben', name: '普通一本', edu: 4, minScore: 68, years: 4, tier: 3.5,
    major: ['工商管理', '土木工程', '英语', '市场营销', '设计'],
    desc: '省里的好学校。能不能出头，看这四年你怎么过。',
    eff: { INT: 5, NET: 6, FAME: 4, CHA: 2, WILL: 2 },
    flags: ['uni_bk'], salaryK: 1.1
  },
  {
    id: 'u_erben', name: '二本 / 民办本科', edu: 3, minScore: 56, years: 4, tier: 3,
    major: ['电子商务', '旅游管理', '环境工程', '汉语言', '动画'],
    desc: '学费是家里咬牙凑的。毕业证上写着本科，剩下的看你自己。',
    eff: { INT: 3, NET: 5, CHA: 2, WILL: 3 },
    flags: ['uni_bk'], salaryK: 0.95
  },
  {
    id: 'u_zhuanke', name: '专科院校', edu: 2, minScore: 42, years: 3, tier: 2,
    major: ['护理', '机电', '广告设计', '物流管理', '学前教育'],
    desc: '三年制。技术性更强，也更容易在毕业那年就找到活干。',
    eff: { STR: 3, NET: 5, CHA: 2, WILL: 3 },
    flags: ['uni_zk'], salaryK: 0.85
  },
  {
    id: 'u_fail', name: '落榜 · 直接进入社会', edu: 1, minScore: 0, years: 0, tier: 1,
    major: [],
    desc: '分数不够。复读一年要钱，也可能还是不够。你决定先出去看看。',
    eff: { WILL: 7, STR: 4, STRESS: 10, SEC: -5, INT: -2 },
    flags: ['gaokao_fail'], salaryK: 0.8
  }
];

/* ---------------- 校园活动（大学期间每年可选一项） ---------------- */
const UNI_ACTIVITIES = [
  { id: 'a_study', name: '📚 泡图书馆', desc: '绩点、奖学金、保研名额，都从这里开始。',
    eff: { INT: 6, WILL: 2, GROW: 3, STRESS: 3 }, need: null },
  { id: 'a_drink', name: '🍺 聚餐喝酒', desc: '烧烤摊、KTV、散场后的马路牙子。你交到了朋友，也伤了身体。',
    eff: { NET: 6, CHA: 3, HP: -4, STRESS: -6, LOVE: 2 }, cost: 300000 },
  { id: 'a_club', name: '🎸 社团活动', desc: '吉他社、辩论队、街舞团。有人在这里找到了一辈子的事。',
    eff: { CHA: 5, NET: 4, LOVE: 3, GROW: 2 }, need: null },
  { id: 'a_intern', name: '💼 出去实习', desc: '大三那年你进了家公司，每天通勤两小时，月薪三千。',
    eff: { INT: 3, NET: 5, LOY: 6, MONEY: 1800000, STRESS: 5 }, need: null },
  { id: 'a_parttime', name: '🍜 兼职打工', desc: '家教、奶茶店、展会礼仪。你第一次自己挣钱。',
    eff: { MONEY: 2600000, WILL: 3, STR: -2, STRESS: 4 }, need: null },
  { id: 'a_game', name: '🎮 通宵打游戏', desc: '宿舍熄灯后，键盘声一直响到天亮。爽，然后挂了两科。',
    eff: { LOVE: 2, STRESS: -8, HP: -5, INT: -2 }, need: null },
  { id: 'a_kaoyan', name: '🎓 准备考研', desc: '每天早上六点的自习室。考上就是另一条路。',
    condMinAge: 20,
    eff: { INT: 7, WILL: 4, STRESS: 8, GROW: 4 }, need: null },
  { id: 'a_startup', name: '🚀 校园创业', desc: '宿舍里的四个工位，一份没人看的商业计划书。',
    eff: { WILL: 5, NET: 4, INT: 2, MONEY: -1500000, STRESS: 7 }, need: null },
  { id: 'a_love', name: '💘 谈恋爱', desc: '操场、图书馆、校外的小旅馆。你把整颗心都交出去了。',
    eff: { LOVE: 9, CHA: 3, SEC: 3, STRESS: 3 }, need: null },
  { id: 'a_sport', name: '🏀 运动与健身', desc: '操场十圈，器械区一小时。身体是本钱，这时候你还不信。',
    eff: { STR: 6, HP: 6, STRESS: -5 }, need: null }
];

/* ---------------- 同学生成 ---------------- */
const CLASSMATE_TYPES = [
  { key: 'nerd', ava: '🤓', label: '学霸', line: '年级第一，笔记被全班传抄' },
  { key: 'sport', ava: '🏀', label: '体育生', line: '操场上的风头人物' },
  { key: 'art', ava: '🎨', label: '文艺委员', line: '画板报的那个人' },
  { key: 'rich', ava: '🕶', label: '富二代', line: '校门口总有人开车来接' },
  { key: 'quiet', ava: '👤', label: '安静的人', line: '坐在最后一排，从不举手' },
  { key: 'funny', ava: '😄', label: '开心果', line: '班里最有梗的那张嘴' },
  { key: 'bad', ava: '🖤', label: '校霸', line: '走廊尽头抽烟的那几个' },
  { key: 'transfer',ava:'🧳', label: '转学生', line: '学期中途来的，谁也不熟' }
];

function makeClassmates(state, stage) {
  const pool = CLASSMATE_TYPES.slice();
  const n = stage === 'uni' ? 5 : 4;
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const t = pool.splice(randInt(0, pool.length - 1), 1)[0];
    out.push({
      key: t.key,
      name: randomPersonName(state.gender === 'M' ? 'F' : 'M'),
      gender: state.gender === 'M' ? 'F' : 'M',
      affinity: randInt(8, 26),
      charm: clamp(Math.round(rand(20, 70) + (t.key === 'rich' ? 15 : 0)), 5, 100),
      stage: stage,
      lastTouch: -1,
      dating: false
    });
  }
  // 至少有一半是同性，避免全班都是异性
  out.forEach((c, i) => { if (i % 2 === 1) { c.gender = state.gender; c.name = randomPersonName(state.gender); } });
  return out;
}

function refreshClassmates(state) {
  const st = schoolStageOf(state);
  if (!st) { state.classmates = []; return; }
  if (state.classStage === st) return;
  state.classStage = st;
  state.classmates = makeClassmates(state, st);
  pushLog(state, st === 'mid' ? '【开学】初中。新的教室，新的同学，新的排名。'
    : st === 'high' ? '【开学】高中。分班榜前挤满了家长，你在名单上找到了自己。'
      : '【开学】大学报到。宿舍四人间，上铺的同学来自一个你没听过的城市。', 'muted');
}

function schoolStageOf(state) {
  if (!state.edu) return null;
  const e = state.edu;
  if (e.uni && e.uni !== 'u_fail' && state.age >= EXAM_META.gaoAge && state.age <= (e.gradAge || 22)) return 'uni';
  if (state.age >= 13 && state.age < EXAM_META.midAge) return 'mid';
  if (state.age >= EXAM_META.midAge && state.age < EXAM_META.gaoAge) return 'high';
  return null;
}

/* ---------------- 分数计算 ---------------- */
/* 分数以「基准线 + 相对偏差」构成：属性一般的人刚好落在中位，极端的人才会拉开差距 */
function midExamScore(state) {
  const s = state.stats;
  const e = state.edu;
  const fam = state.family || { assets: 0 };
  const tutor = fam.assets > 200000000 ? 7 : (fam.assets > 60000000 ? 4 : 0);
  const poor = (fam.debt || 0) > (fam.assets || 0) ? 5 : 0;   // 家里欠着债，补习班是奢望
  let sc = 50
    + (s.INT - 45) * 0.26
    + (s.WILL - 30) * 0.10
    + (e.study || 0) * 0.16
    + tutor
    + (state.flags.tizhinei || state.flags.prof ? 4 : 0)
    + rand(-9, 9)
    - Math.max(0, s.STRESS - 40) * 0.28
    - poor
    - (state.flags.in_love ? 5 : 0);
  return Math.round(clamp(sc, 0, 100));
}

function gaoExamScore(state) {
  const s = state.stats;
  const e = state.edu;
  const hs = HIGH_SCHOOLS.find(h => h.id === e.hs) || HIGH_SCHOOLS[1];
  const fam = state.family || { assets: 0 };
  const tutor = fam.assets > 250000000 ? 7 : (fam.assets > 80000000 ? 4 : 0);
  const poor = (fam.debt || 0) > (fam.assets || 0) ? 6 : 0;
  let sc = 52
    + (s.INT - 55) * 0.40
    + (s.WILL - 35) * 0.12
    + (e.study || 0) * 0.20
    + (hs.gaoBonus || 0)
    + tutor
    + rand(-11, 11)
    - Math.max(0, s.STRESS - 45) * 0.30
    - poor
    - (state.flags.in_love ? 8 : 0);
  return Math.round(clamp(sc, 0, 110));
}

/* ---------------- 高考恢复前：推荐制 ---------------- */
function recommendUni(state) {
  const year = fmtYear(state);
  if (year >= EXAM_META.gaoRestoreYear) return null;
  if (state.flags.tizhinei || state.flags.prof) return UNIVERSITIES[3];
  if (chance(0.25)) return UNIVERSITIES[4];
  return UNIVERSITIES[5];
}

/* ---------------- 生成考试事件 ---------------- */
function makeExamEvent(state, kind) {
  const e = state.edu;
  const year = fmtYear(state);
  if (kind === 'mid') {
    const score = midExamScore(state);
    e.mid = score;
    const list = HIGH_SCHOOLS.filter(h => score >= h.minScore);
    return {
      type: 'exam',
      exam: {
        kind: 'mid',
        title: '中考放榜',
        score: score,
        full: 100,
        text: `${year}夏天，中考成绩出来了。校门口的红纸上写满了名字，你在榜上找到了自己：${score} 分。\n` +
          `智力 ${Math.round(state.stats.INT)} · 意志 ${Math.round(state.stats.WILL)} · 这三年你投入的学习 ${Math.round(e.study || 0)}。\n` +
          `接下来三年，你想去哪儿？`,
        options: list
      }
    };
  }
  // 高考
  const rec = recommendUni(state);
  if (rec) {
    e.gao = null;
    return {
      type: 'exam',
      exam: {
        kind: 'gao', title: '推荐制 · 那一年没有高考', score: null, full: null,
        text: `${year}。高考还没有恢复，大学名额是「推荐」来的。\n` +
          `家里能说上话的人，决定了你能不能走进那扇校门。`,
        options: [rec]
      }
    };
  }
  const score = gaoExamScore(state);
  e.gao = score;
  const list = UNIVERSITIES.filter(u => score >= u.minScore);
  const hs = HIGH_SCHOOLS.find(h => h.id === e.hs);
  return {
    type: 'exam',
    exam: {
      kind: 'gao',
      title: '高考放榜',
      score: score,
      full: 110,
      text: `${year}六月。查分系统卡了三个小时，你刷新了二十七次。\n` +
        `${score} 分。${hs ? hs.name : '高中'} 出身，智力 ${Math.round(state.stats.INT)}，这三年你投入的学习 ${Math.round(e.study || 0)}。\n` +
        `分数就摆在这里。你想报哪里？`,
      options: list
    }
  };
}

/* ---------------- 录取落定 ---------------- */
function applySchool(state, id) {
  const e = state.edu;
  if (e.hs && !e.uni) {
    // 高考录取
    const u = UNIVERSITIES.find(x => x.id === id);
    if (!u) return;
    e.uni = u.id;
    e.eduLevel = u.edu;
    e.gradAge = state.age + u.years;
    e.major = u.major.length ? u.major[randInt(0, u.major.length - 1)] : null;
    e.salaryK = u.salaryK;
    applyEffects(state, u.eff || {});
    (u.flags || []).forEach(f => state.flags[f] = true);
    if (u.id === 'u_fail') {
      state.job = '待业';
      pushLog(state, `【落榜】${u.name}。你把课本装进纸箱，第二天去了劳务市场。`, 'warn');
    } else {
      state.job = '大学生';
      pushLog(state, `【录取】${u.name}${e.major ? ' · ' + e.major + ' 专业' : ''}。${u.desc}`, 'money');
    }
    return;
  }
  // 中考录取
  const h = HIGH_SCHOOLS.find(x => x.id === id);
  if (!h) return;
  e.hs = h.id;
  applyEffects(state, h.eff || {});
  (h.flags || []).forEach(f => state.flags[f] = true);
  state.job = h.id === 'hs_none' ? '待业' : '高中生';
  pushLog(state, `【中考】${h.name}。${h.desc}`, h.tier >= 2 ? 'money' : 'warn');
}

/* ---------------- 校园活动 ---------------- */
function doUniActivity(state, actId) {
  if (!state.edu || !state.edu.uni || state.edu.uni === 'u_fail') return { ok: false, msg: '你现在不在大学里' };
  const a = UNI_ACTIVITIES.find(x => x.id === actId);
  if (!a) return { ok: false, msg: '没有这个活动' };
  if (a.condMinAge && state.age < a.condMinAge) return { ok: false, msg: `${a.condMinAge}之后才行` };
  const touch = state.uniTouch = state.uniTouch || {};
  if (touch[actId] === state.age) return { ok: false, msg: '今年已经做过了' };
  if (a.cost && state.stats.MONEY < a.cost) return { ok: false, msg: '钱不够' };
  touch[actId] = state.age;
  applyEffects(state, a.eff || {});
  if (a.id === 'a_study') state.edu.study = clamp((state.edu.study || 0) + 12, 0, EXAM_META.studyCap);
  if (a.id === 'a_kaoyan' && chance(0.45) && state.edu.eduLevel < 5) {
    state.edu.eduLevel = 5;
    state.edu.salaryK = Math.max(state.edu.salaryK || 1, 1.4);
    state.edu.gradAge = (state.edu.gradAge || 22) + 2;
    state.flags.kaoyan_ok = true;
    pushLog(state, '【上岸】考研成绩出来了。你考上了。研究生三年，又是一段没有人问结果的路。', 'money');
  }
  if (a.id === 'a_love') {
    state.flags.in_love = true;
    if (!state.flags.dating) { state.flags.dating = true; ensureLover(state, '同学'); }
  }
  pushLog(state, `【校园】${a.name} — ${a.desc}`, 'muted');
  return { ok: true };
}

/* ---------------- 刷题 / 补习（初中·高中每年一次） ---------------- */
function cramSchool(state) {
  if (state.age >= EXAM_META.gaoAge || state.age < 7) return { ok: false, msg: '现在不用刷题' };
  const touch = state.uniTouch = state.uniTouch || {};
  if (touch.cram === state.age) return { ok: false, msg: '今年已经刷过了' };
  touch.cram = state.age;
  state.edu.study = clamp((state.edu.study || 0) + randInt(6, 11), 0, EXAM_META.studyCap);
  applyEffects(state, { INT: randInt(2, 4), HP: -3, STRESS: 5, GROW: 2 });
  pushLog(state, `【刷题】这一年的晚自习，你把错题本翻烂了。学习投入 ${Math.round(state.edu.study)}。`, 'stat');
  return { ok: true };
}

/* ---------------- 同学互动 ---------------- */
function classmateAct(state, idx) {
  const c = (state.classmates || [])[idx];
  if (!c) return { ok: false, msg: '没有这位同学' };
  if (c.lastTouch === state.age) return { ok: false, msg: '今年已经互动过了' };
  c.lastTouch = state.age;
  const gain = randInt(4, 8) + Math.round(state.stats.CHA / 22);
  c.affinity = clamp(c.affinity + gain, 0, 100);
  applyEffects(state, { NET: 2, LOVE: 2, CHA: 1, STRESS: -2 });
  pushLog(state, `【同学】你${c.stage === 'uni' ? '和' : '课间和'} ${c.name}（${(CLASSMATE_TYPES.find(t => t.key === c.key) || {}).label || '同学'}）聊了很久。好感 ${Math.round(c.affinity)}%。`, 'muted');
  return { ok: true, gain };
}
