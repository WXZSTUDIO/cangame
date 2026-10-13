// cangame v3 · 球员生成与评分
var SURNAMES = '王李张刘陈杨黄赵周吴徐孙马朱胡郭何高林郑谢罗梁宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢傅钟姜崔谭廖范汪陆金石戴贾韦夏邱方侯邹熊孟秦白江阎薛尹段雷黎史龙陶贺顾毛郝龚邵万钱严覃武戚莫孔向汤';
var GIVEN = ['伟','强','磊','军','洋','勇','杰','涛','明','超','峰','飞','鹏','华','健','俊','宇','浩','凯','轩','睿','晨','昊','霖','泽','航','阳','宁','博','译','皓','煜','辰','骁','峥','翊','牧','野','川','岩','朔','骁','cedric','霖','骁','擎','曜','屿','澈','屿','桉','珩','栩','琛','旻','骁'];

function genName(rng) {
  const s = SURNAMES[Math.floor(rng() * SURNAMES.length)];
  const g1 = GIVEN[Math.floor(rng() * GIVEN.length)];
  const g2 = rng() < 0.5 ? GIVEN[Math.floor(rng() * GIVEN.length)] : '';
  return s + g1 + g2;
}

function genPlayer(rng, opts) {
  opts = opts || {};
  const P = CONFIG.PLAYER;
  const pos = opts.pos || P.POSITIONS[Math.floor(rng() * P.POSITIONS.length)];
  const age = opts.age != null ? opts.age : randInt(rng, P.AGE_MIN, P.AGE_MAX);
  const tier = opts.tier != null ? opts.tier : 0; // -8 替补 / 0 轮换 / +8 主力 / +15 明星
  const target = clamp(P.BASE_MEAN + tier + randInt(rng, -7, 7), P.ATTR_MIN, P.ATTR_MAX);
  const a = {};
  P.ATTRS.forEach(function (k) {
    let v = target + randInt(rng, -12, 12);
    if (k === 'STA') v = clamp(v + 4, P.ATTR_MIN, P.ATTR_MAX); // 体力偏高更真实
    a[k] = clamp(Math.round(v), P.ATTR_MIN, P.ATTR_MAX);
  });
  const p = {
    id: opts.id || ('p' + Math.floor(rng() * 1e9).toString(36)),
    name: genName(rng), pos: pos, age: age,
    trait: P.TRAITS[Math.floor(rng() * P.TRAITS.length)],
    a: a, overall: 0,
    salary: 0, contractYears: randInt(rng, 1, 4),
    stamina: 100, injury: 0, mood: CONFIG.MOOD.BASE
  };
  p.overall = players_overall(p);
  p.salary = players_salary(p);
  return p;
}

function players_overall(p) {
  const w = CONFIG.PLAYER.POS_WEIGHT[p.pos];
  let sum = 0, tot = 0;
  CONFIG.PLAYER.ATTRS.forEach(function (k) { sum += p.a[k] * (w[k] || 1); tot += (w[k] || 1); });
  return Math.round(sum / tot);
}

function players_salary(p) {
  const F = CONFIG.FINANCE;
  let s = p.overall * p.overall * F.SAL_K + p.a.CLU * F.CLUTCH_SAL_BONUS;
  // 年龄折扣（老将略降，新秀合同低）
  if (p.age >= 33) s *= 0.82;
  else if (p.age <= 21) s *= 0.7;
  return Math.round(s / 10) * 10; // 取整到十
}

// 简单属性端点
function attrEnd(p, k) { return p.a[k]; }

if (typeof module !== 'undefined') {
  module.exports = { genPlayer, players_overall, players_salary, genName };
}
