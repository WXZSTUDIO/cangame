/* =========================================================
 * CANGAME · 职业与晋升系统
 * 学历决定门槛，学校决定起步职级，绩效决定升迁
 * salary / cost 为年度名义值（与全局货币同单位）
 * ========================================================= */

const CAREER_META = {
  minWorkAge: 16,
  retireAge: 60,
  promoMinYears: 3
};

/* cat: 行业；edu: 最低学历等级；need: 属性门槛；risk: 职业风险（0-3） */
const CAREERS = [
  /* ===== 无门槛 / 体力 ===== */
  {
    id: 'rider', name: '外卖骑手', cat: '服务业', edu: 0, risk: 2, need: {},
    desc: '电动车、保温箱、超时罚款。时间就是钱，这句话在这里是字面意思。',
    ladder: [
      { title: '外卖骑手', sal: 12000000, cost: 8000000 },
      { title: '金牌骑手', sal: 17000000, cost: 8500000 },
      { title: '站点组长', sal: 23000000, cost: 9500000 },
      { title: '区域承包商', sal: 34000000, cost: 13000000 }
    ],
    tick: { STR: -1, HP: -1, STRESS: 2, NET: 1 }
  },
  {
    id: 'extra', name: '群众演员', cat: '演艺', edu: 0, risk: 2, need: {},
    desc: '一天八十块，盒饭管饱。躺在地上演死尸，一躺就是六个小时。',
    ladder: [
      { title: '群演', sal: 8000000, cost: 7000000 },
      { title: '特约演员', sal: 15000000, cost: 9000000 },
      { title: '配角演员', sal: 28000000, cost: 13000000 },
      { title: '有名气的演员', sal: 70000000, cost: 22000000 },
      { title: '主演 / 艺人', sal: 180000000, cost: 40000000 }
    ],
    tick: { CHA: 1, FAME: 2, SEC: -1, STRESS: 2 }
  },
  {
    id: 'waiter', name: '餐饮服务员', cat: '服务业', edu: 0, risk: 1, need: {},
    desc: '端盘子、擦桌子、被骂。第一份工作大多是这样开始的。',
    ladder: [
      { title: '服务员', sal: 9000000, cost: 7000000 },
      { title: '领班', sal: 14000000, cost: 8000000 },
      { title: '店长', sal: 24000000, cost: 10000000 },
      { title: '区域店长', sal: 40000000, cost: 14000000 }
    ],
    tick: { CHA: 1, NET: 1, STR: -1 }
  },
  {
    id: 'anchor', name: '主播 / 网红', cat: '新媒体', edu: 0, risk: 3, need: { CHA: 30 },
    desc: '直播间里只有你和一个补光灯。能不能火，谁也说不准。',
    ladder: [
      { title: '小主播', sal: 14000000, cost: 8000000 },
      { title: '签约主播', sal: 40000000, cost: 13000000 },
      { title: '头部主播', sal: 120000000, cost: 28000000 },
      { title: '机构老板', sal: 300000000, cost: 60000000 }
    ],
    tick: { CHA: 2, FAME: 2, NET: 2, STRESS: 3, HP: -1 }
  },
  {
    id: 'streamer', name: '自媒体博主', cat: '新媒体', edu: 2, risk: 2, need: { INT: 30 },
    desc: '一个人、一台电脑。流量是可以被设计出来的，也可以一夜归零。',
    ladder: [
      { title: '兼职博主', sal: 10000000, cost: 7000000 },
      { title: '全职博主', sal: 26000000, cost: 10000000 },
      { title: '百万粉账号', sal: 70000000, cost: 20000000 },
      { title: '内容公司老板', sal: 180000000, cost: 42000000 }
    ],
    tick: { INT: 1, FAME: 2, NET: 1, STRESS: 2 }
  },

  /* ===== 高中 / 职高 ===== */
  {
    id: 'factory', name: '工厂工人', cat: '制造业', edu: 1, risk: 1, need: {},
    desc: '流水线、两班倒、白班夜班。厂里包吃住，也包住你十年。',
    ladder: [
      { title: '流水线工人', sal: 26000000, cost: 14000000 },
      { title: '熟练工', sal: 34000000, cost: 15000000 },
      { title: '班组长', sal: 46000000, cost: 17000000 },
      { title: '车间主任', sal: 68000000, cost: 22000000 }
    ],
    tick: { STR: -1, HP: -1, WILL: 1 }
  },
  {
    id: 'courier', name: '快递员', cat: '物流', edu: 1, risk: 1, need: {},
    desc: '片区、三轮车、双十一。爬楼的时候你会想起当年没做的那道题。',
    ladder: [
      { title: '快递员', sal: 18000000, cost: 10000000 },
      { title: '片区骨干', sal: 26000000, cost: 11000000 },
      { title: '网点承包人', sal: 42000000, cost: 15000000 },
      { title: '区域加盟商', sal: 80000000, cost: 26000000 }
    ],
    tick: { STR: -1, NET: 2, CHA: 1 }
  },
  {
    id: 'driver', name: '网约车司机', cat: '服务业', edu: 1, risk: 1, need: {},
    desc: '方向盘后面是十二个小时。你听了一整座城市的故事。',
    ladder: [
      { title: '网约车司机', sal: 20000000, cost: 11000000 },
      { title: '五星司机', sal: 28000000, cost: 12000000 },
      { title: '车队长', sal: 40000000, cost: 15000000 },
      { title: '小车队老板', sal: 70000000, cost: 24000000 }
    ],
    tick: { NET: 1, HP: -1, STRESS: 1 }
  },
  {
    id: 'guard', name: '保安 / 物业', cat: '服务业', edu: 1, risk: 0, need: {},
    desc: '门岗、监控室、一杯茶。稳定，也容易把人坐懒。',
    ladder: [
      { title: '保安', sal: 14000000, cost: 8000000 },
      { title: '保安队长', sal: 20000000, cost: 9000000 },
      { title: '物业主管', sal: 30000000, cost: 11000000 },
      { title: '物业经理', sal: 45000000, cost: 15000000 }
    ],
    tick: { STR: -1, SEC: 2, WILL: -1 }
  },
  {
    id: 'sales', name: '销售 / 中介', cat: '商业', edu: 1, risk: 2, need: { CHA: 25 },
    desc: '底薪三千，提成上不封顶。脸皮厚一点，收入高一点。',
    ladder: [
      { title: '销售专员', sal: 22000000, cost: 12000000 },
      { title: '高级销售', sal: 42000000, cost: 16000000 },
      { title: '销售主管', sal: 70000000, cost: 22000000 },
      { title: '销售总监', sal: 130000000, cost: 35000000 }
    ],
    tick: { CHA: 2, NET: 2, STRESS: 3, ETH: -1 }
  },
  {
    id: 'cook', name: '厨师', cat: '服务业', edu: 1, risk: 1, need: {},
    desc: '后厨四十度。颠勺三年，手腕比同龄人粗一圈。',
    ladder: [
      { title: '学徒', sal: 12000000, cost: 7500000 },
      { title: '炒锅师傅', sal: 24000000, cost: 9500000 },
      { title: '厨师长', sal: 45000000, cost: 14000000 },
      { title: '餐饮合伙人', sal: 90000000, cost: 26000000 }
    ],
    tick: { STR: -1, CHA: 1, NET: 1 }
  },
  {
    id: 'idol', name: '偶像练习生', cat: '演艺', edu: 1, risk: 3, need: { CHA: 45 },
    desc: '练习室的镜子和体脂秤。出道位是几百个人抢的九个位置。',
    ladder: [
      { title: '练习生', sal: 9000000, cost: 9000000 },
      { title: '出道艺人', sal: 40000000, cost: 16000000 },
      { title: '人气成员', sal: 110000000, cost: 30000000 },
      { title: '顶流偶像', sal: 320000000, cost: 60000000 },
      { title: '国际艺人', sal: 800000000, cost: 90000000 }
    ],
    tick: { CHA: 2, FAME: 3, HP: -2, STRESS: 4, WILL: 1 },
    needFlag: ['music']
  },
  {
    id: 'gamer', name: '电竞选手', cat: '电竞', edu: 1, risk: 3, need: { INT: 35 },
    desc: '每天训练十四小时。黄金年龄只有四年，之后呢？',
    ladder: [
      { title: '青训队员', sal: 12000000, cost: 8000000 },
      { title: '职业选手', sal: 40000000, cost: 13000000 },
      { title: '明星选手', sal: 120000000, cost: 26000000 },
      { title: '俱乐部股东 / 教练', sal: 200000000, cost: 40000000 }
    ],
    tick: { INT: 1, FAME: 2, HP: -2, STRESS: 3 }
  },

  /* ===== 专科 ===== */
  {
    id: 'clerk', name: '公司文员', cat: '职场', edu: 2, risk: 0, need: {},
    desc: '打印、报销、订会议室。写字楼里最不起眼，也最不能缺的岗位。',
    ladder: [
      { title: '前台 / 文员', sal: 20000000, cost: 10000000 },
      { title: '行政主管', sal: 32000000, cost: 12000000 },
      { title: '行政经理', sal: 48000000, cost: 16000000 },
      { title: '办公室主任', sal: 70000000, cost: 22000000 }
    ],
    tick: { LOY: 1, NET: 1, STRESS: 1 }
  },
  {
    id: 'accountant', name: '会计', cat: '财务', edu: 2, risk: 1, need: { INT: 30 }, major: ['金融'],
    desc: '凭证、报表、汇算清缴。账面干净，睡觉才踏实。',
    ladder: [
      { title: '出纳 / 会计助理', sal: 24000000, cost: 10000000 },
      { title: '会计', sal: 38000000, cost: 12000000 },
      { title: '财务主管', sal: 60000000, cost: 17000000 },
      { title: '财务总监', sal: 110000000, cost: 28000000 }
    ],
    tick: { INT: 1, LOY: 2, STRESS: 2 }
  },
  {
    id: 'nurse', name: '护士', cat: '医疗', edu: 2, risk: 1, need: {}, major: ['医学'],
    desc: '夜班、扎针、被家属骂。你见过太多生离死别。',
    ladder: [
      { title: '实习护士', sal: 18000000, cost: 9000000 },
      { title: '护士', sal: 30000000, cost: 11000000 },
      { title: '护师', sal: 44000000, cost: 14000000 },
      { title: '护士长', sal: 68000000, cost: 20000000 }
    ],
    tick: { HP: -1, LOVE: 1, WILL: 1, STRESS: 2 }
  },
  {
    id: 'ecom', name: '电商运营', cat: '互联网', edu: 2, risk: 2, need: { INT: 28 }, major: ['金融', '理工'],
    desc: '详情页、投流、大促。GMV 就是你这一年的墓志铭。',
    ladder: [
      { title: '运营助理', sal: 22000000, cost: 10000000 },
      { title: '店铺运营', sal: 40000000, cost: 13000000 },
      { title: '运营主管', sal: 70000000, cost: 19000000 },
      { title: '品牌操盘手', sal: 140000000, cost: 32000000 }
    ],
    tick: { INT: 1, NET: 1, STRESS: 3 }
  },

  /* ===== 本科 ===== */
  {
    id: 'programmer', name: '程序员', cat: '互联网', edu: 3, risk: 1, need: { INT: 40 }, major: ['理工'],
    desc: '需求、排期、线上事故。三十五岁是哪道坎，你早晚会知道。',
    ladder: [
      { title: '实习程序员', sal: 30000000, cost: 11000000 },
      { title: '初级开发', sal: 48000000, cost: 14000000 },
      { title: '中级工程师', sal: 78000000, cost: 18000000 },
      { title: '高级工程师', sal: 120000000, cost: 24000000 },
      { title: '技术专家 / 架构师', sal: 190000000, cost: 34000000 },
      { title: '技术总监', sal: 320000000, cost: 48000000 }
    ],
    tick: { INT: 2, STR: -1, HP: -1, STRESS: 2 }
  },
  {
    id: 'pm', name: '产品经理', cat: '互联网', edu: 3, risk: 2, need: { INT: 35, CHA: 30 },
    desc: '需求文档写不完，锅也背不完。产品是妥协的艺术。',
    ladder: [
      { title: '产品助理', sal: 28000000, cost: 11000000 },
      { title: '产品经理', sal: 52000000, cost: 15000000 },
      { title: '高级产品经理', sal: 88000000, cost: 21000000 },
      { title: '产品总监', sal: 160000000, cost: 32000000 },
      { title: '事业部负责人', sal: 300000000, cost: 46000000 }
    ],
    tick: { INT: 1, CHA: 1, NET: 2, STRESS: 3 }
  },
  {
    id: 'designer', name: 'UI / 视觉设计师', cat: '互联网', edu: 3, risk: 1, need: { INT: 30 }, major: ['艺术'],
    desc: '改稿第十七版。甲方说，还是第一版好。',
    ladder: [
      { title: '设计助理', sal: 24000000, cost: 10000000 },
      { title: '设计师', sal: 42000000, cost: 13000000 },
      { title: '资深设计师', sal: 70000000, cost: 18000000 },
      { title: '设计负责人', sal: 120000000, cost: 26000000 }
    ],
    tick: { INT: 1, CHA: 1, HP: -1, STRESS: 2 }
  },
  {
    id: 'hacker', name: '黑客 / 安全研究员', cat: '灰色', edu: 3, risk: 3, need: { INT: 55 }, major: ['理工'],
    desc: '灰色地带的技术活。一念是白帽子，一念是铁窗。',
    ladder: [
      { title: '脚本小子', sal: 36000000, cost: 12000000 },
      { title: '安全工程师', sal: 70000000, cost: 17000000 },
      { title: '顶级白帽子', sal: 140000000, cost: 26000000 },
      { title: '灰色操盘手', sal: 300000000, cost: 42000000 }
    ],
    tick: { INT: 2, ETH: -2, STRESS: 3, SEC: -2, WILL: 1 }
  },
  {
    id: 'teacher', name: '中小学教师', cat: '教育', edu: 3, risk: 0, need: { INT: 40 }, major: ['师范'],
    desc: '编制、寒暑假、一群永远记不住你生日的孩子。',
    ladder: [
      { title: '代课老师', sal: 22000000, cost: 9000000 },
      { title: '正式教师', sal: 36000000, cost: 12000000 },
      { title: '骨干教师', sal: 52000000, cost: 15000000 },
      { title: '年级组长', sal: 70000000, cost: 19000000 },
      { title: '副校长 / 校长', sal: 110000000, cost: 26000000 }
    ],
    tick: { INT: 1, LOVE: 1, SEC: 2, STRESS: 2 }
  },
  {
    id: 'lawyer', name: '律师', cat: '法律', edu: 3, risk: 2, need: { INT: 50 }, major: ['法律'],
    desc: '法考、实习、案源。前三年穷，后面看命。',
    ladder: [
      { title: '实习律师', sal: 18000000, cost: 10000000 },
      { title: '执业律师', sal: 48000000, cost: 15000000 },
      { title: '资深律师', sal: 100000000, cost: 24000000 },
      { title: '合伙人', sal: 220000000, cost: 40000000 },
      { title: '律所主任', sal: 420000000, cost: 60000000 }
    ],
    tick: { INT: 2, NET: 2, FAME: 1, STRESS: 3 }
  },
  {
    id: 'civil', name: '公务员 / 事业编', cat: '体制内', edu: 3, risk: 0, need: { INT: 45 },
    desc: '千军万马过独木桥。考上那天，母亲在电话那头哭了。',
    ladder: [
      { title: '科员', sal: 30000000, cost: 11000000 },
      { title: '副科级', sal: 42000000, cost: 13000000 },
      { title: '正科级', sal: 58000000, cost: 16000000 },
      { title: '副处级', sal: 82000000, cost: 21000000 },
      { title: '处级', sal: 120000000, cost: 28000000 },
      { title: '厅局级', sal: 200000000, cost: 40000000 }
    ],
    tick: { LOY: 2, SEC: 3, NET: 2, ETH: -1 }
  },

  /* ===== 名校 ===== */
  {
    id: 'doctor', name: '医生', cat: '医疗', edu: 4, risk: 1, need: { INT: 55 }, major: ['医学'],
    desc: '五年本科、三年规培、无数个夜班。白大褂穿上是责任。',
    ladder: [
      { title: '规培医生', sal: 22000000, cost: 11000000 },
      { title: '住院医师', sal: 45000000, cost: 14000000 },
      { title: '主治医师', sal: 80000000, cost: 20000000 },
      { title: '副主任医师', sal: 140000000, cost: 29000000 },
      { title: '主任医师 / 科室主任', sal: 240000000, cost: 42000000 }
    ],
    tick: { INT: 1, FAME: 1, HP: -2, STRESS: 3, ETH: 1 }
  },
  {
    id: 'finance', name: '投行 / 券商', cat: '金融', edu: 4, risk: 2, need: { INT: 55, CHA: 35 }, major: ['金融'],
    desc: '路演、尽调、凌晨三点的 Excel。钱在这里流动得比任何地方都快。',
    ladder: [
      { title: '分析师', sal: 50000000, cost: 18000000 },
      { title: '高级经理', sal: 100000000, cost: 28000000 },
      { title: '业务董事', sal: 200000000, cost: 42000000 },
      { title: '部门负责人', sal: 400000000, cost: 65000000 },
      { title: '合伙人 / 高管', sal: 800000000, cost: 90000000 }
    ],
    tick: { INT: 2, NET: 3, FAME: 1, HP: -2, STRESS: 4 }
  },
  {
    id: 'ai', name: 'AI 算法工程师', cat: '互联网', edu: 5, risk: 2, need: { INT: 65 }, major: ['理工'],
    desc: '算力、模型、论文。这个时代最贵的一批大脑，就坐在这些工位上。',
    ladder: [
      { title: '算法工程师', sal: 70000000, cost: 20000000 },
      { title: '高级算法专家', sal: 140000000, cost: 30000000 },
      { title: '首席科学家', sal: 280000000, cost: 48000000 },
      { title: 'AI 业务负责人', sal: 500000000, cost: 70000000 }
    ],
    tick: { INT: 3, FAME: 1, HP: -1, STRESS: 3 }
  },
  {
    id: 'startup', name: '创业者', cat: '创业', edu: 1, risk: 3, need: { WILL: 40 },
    desc: '六个工位、四个人的团队。融资 BP 改了三十版。',
    ladder: [
      { title: '初创者', sal: 12000000, cost: 14000000 },
      { title: '拿到天使轮', sal: 40000000, cost: 20000000 },
      { title: 'A 轮创始人', sal: 100000000, cost: 32000000 },
      { title: '独角兽创始人', sal: 300000000, cost: 60000000 },
      { title: '上市公司创始人', sal: 900000000, cost: 100000000 }
    ],
    tick: { WILL: 2, NET: 2, INT: 1, HP: -2, STRESS: 4 }
  }
];

/* ---------- 把职业阶梯展开进 JOBS，保持旧逻辑（JOBS[job]）可用 ---------- */
function buildJobTable() {
  CAREERS.forEach(c => {
    c.ladder.forEach(l => {
      JOBS[l.title] = { salary: l.sal, cost: l.cost, career: c.id };
    });
  });
  return JOBS;
}

function careerById(id) { return CAREERS.find(c => c.id === id); }
function careerOfJob(jobName) {
  const j = JOBS[jobName];
  if (!j || !j.career) return null;
  return careerById(j.career);
}

/* ---------- 可应聘列表：学历与属性门槛 ---------- */
function jobOffers(state) {
  const lv = (state.edu && state.edu.eduLevel) || 0;
  const myMajor = majorCatOf(state);
  return CAREERS.map(c => {
    const okEdu = lv >= c.edu;
    let okStat = true, miss = '';
    for (const k in (c.need || {})) {
      if ((state.stats[k] || 0) < c.need[k]) {
        okStat = false;
        miss = `${k} 需 ${c.need[k]}`;
      }
    }
    let okFlag = true;
    if (c.needFlag && !c.needFlag.some(f => state.flags[f])) okFlag = false;
    // 专业对口：只约束本科及以上的对口职业（没上过大学的人不受限）
    let majorOk = true;
    if (c.major && lv >= 3 && myMajor && c.major.indexOf(myMajor) === -1) {
      majorOk = false;
      okFlag = false;
    }
    const entry = entryLevelFor(state, c);
    return { career: c, okEdu, okStat, okFlag, majorOk, miss, entry, title: c.ladder[entry].title };
  });
}

/* 起步职级：学校越好，起点越高；社会经验（工龄）也能顶一点 */
function entryLevelFor(state, c) {
  let lv = 0;
  const lv5 = state.flags.uni_985 || state.flags.kaoyan_ok;
  const lv4 = state.flags.uni_211;
  if (lv5) lv = 1;
  else if (lv4) lv = 1;
  else if ((state.edu && state.edu.eduLevel) >= 4) lv = 1;
  if ((state.career && state.career.years >= 4) || state.age >= 30) lv += 1;
  return clamp(lv, 0, c.ladder.length - 1);
}

/* ---------- 入职 ---------- */
function applyJob(state, careerId) {
  const c = careerById(careerId);
  if (!c) return { ok: false, msg: '没有这个岗位' };
  const offer = jobOffers(state).find(o => o.career.id === careerId);
  if (!offer) return { ok: false, msg: '没有这个岗位' };
  if (!offer.okEdu) return { ok: false, msg: `学历不够（需 ${EDU_LEVELS[c.edu]}）` };
  if (!offer.okStat) return { ok: false, msg: `能力不够：${offer.miss}` };
  if (!offer.okFlag) return { ok: false, msg: offer.majorOk ? '你缺少进入这行的机缘' : '专业不对口（HR 筛简历就刷掉了）' };
  if (state.age < CAREER_META.minWorkAge) return { ok: false, msg: `${CAREER_META.minWorkAge}岁才能正式工作` };
  const lv = offer.entry;
  state.career = { id: c.id, level: lv, years: 0, joinedAge: state.age };
  state.job = c.ladder[lv].title;
  pushLog(state, `【入职】${c.name} · ${c.ladder[lv].title}。${c.desc}`, 'money');
  return { ok: true, title: state.job };
}

/* ---------- 年度职业结算：绩效 → 升职 / 降职 / 裁员 ---------- */
function careerTick(state) {
  if (!state.career) return null;
  const c = careerById(state.career.id);
  if (!c) return null;
  const s = state.stats;
  if (c.tick) applyEffects(state, c.tick);
  state.career.years += 1;

  const lv = state.career.level;
  const salaryK = (state.edu && state.edu.salaryK) || 1;
  let score = 30
    + s.LOY * 0.35
    + s.INT * 0.22
    + s.NET * 0.16
    + s.WILL * 0.14
    + state.career.years * 2.2
    + (salaryK - 1) * 22
    + rand(-11, 13)
    - s.STRESS * 0.18
    - (state.stats.ETH < 35 ? 6 : 0)
    - (c.risk * 2);
  const need = 50 + lv * 16;

  let result = null;
  if (score >= need && lv < c.ladder.length - 1 && state.career.years >= CAREER_META.promoMinYears) {
    state.career.level += 1;
    state.job = c.ladder[state.career.level].title;
    applyEffects(state, { LOY: 6, MONEY: Math.round(c.ladder[state.career.level].sal * 0.08), NET: 3, STRESS: 4 });
    pushLog(state, `【晋升】${c.name} → ${state.job}。这一年你没有白熬。`, 'money');
    result = 'promote';
  } else if (score < need * 0.42 && lv > 0 && state.age < CAREER_META.retireAge) {
    state.career.level -= 1;
    state.job = c.ladder[state.career.level].title;
    applyEffects(state, { LOY: -8, STRESS: 8, WILL: -2, SEC: -4 });
    pushLog(state, `【降职】你被调到了 ${state.job}。工位换到了靠门的位置。`, 'warn');
    result = 'demote';
  } else if (score < need * 0.28 && c.risk >= 1 && chance(0.35) && state.age < CAREER_META.retireAge) {
    state.career = null;
    state.job = '待业';
    applyEffects(state, { LOY: -15, STRESS: 12, SEC: -8, WILL: 3 });
    pushLog(state, `【失业】公司让你走人了。你抱着纸箱站在写字楼门口，不知道该给谁打电话。`, 'warn');
    result = 'fire';
  }
  return result;
}

/* ---------- 初始化：把职业阶梯展开进 JOBS ---------- */
buildJobTable();

/* ---------- 职业收入（含学历加成与工龄） ---------- */
function careerIncome(state) {
  const j = JOBS[state.job] || { salary: 0, cost: 12000000 };
  const s = state.stats;
  const salaryK = (state.edu && state.edu.salaryK) || 1;
  // 工龄与属性的放大倍数收窄：赚钱应该是一辈子慢慢变快，而不是指数起飞
  let income = j.salary * (1 + Math.max(0, state.age - 22) * 0.028) * salaryK;
  income = Math.round(income * (1 + s.INT / 520) * (1 + s.NET / 1000) * (1 + s.LOY / 1100));
  return Math.max(0, Math.round(income));
}
