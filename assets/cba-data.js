// cangame v3.5 · CBA 真实队名数据骨架（阶段3）
// 重要：队名为公开可核实的真实球队（CBA 历史队 + 次级/NBL/ABL 真实队）。
// 球员为占位数据（AI 生成），标记 todoVerify=true，须人工核对真实名单后再启用。
// 2000-2025 逐季真实球员名单 AI 无法准确编造，本文件仅搭骨架 + 真实队名 + 占位球员。

// 1级联赛：14 支历史 CBA 球队（2000 年前后存在的稳定队名）
var CBA_L1_TEAMS = [
  { city: '八一', nick: '火箭' },     // 八一双鹿 / 八一男篮
  { city: '上海', nick: '大鲨鱼' },   // 上海东方大鲨鱼
  { city: '广东', nick: '宏远' },
  { city: '北京', nick: '首钢' },
  { city: '辽宁', nick: '盼盼' },     // 辽宁衡业 / 辽宁
  { city: '江苏', nick: '南钢' },     // 江苏龙
  { city: '山东', nick: '黄金' },     // 山东火牛 / 山东高速
  { city: '浙江', nick: '万马' },     // 浙江稠州
  { city: '吉林', nick: '东北虎' },
  { city: '新疆', nick: '广汇' },
  { city: '陕西', nick: '东盛' },     // 陕西盖天力
  { city: '北京', nick: '奥神' },     // 北京奥神
  { city: '沈部', nick: '雄狮' },     // 沈部
  { city: '福建', nick: '浔兴' }      // 福建中华鲟
];

// 2级联赛：28 支真实次级 / 历史队名（NBL / ABL / 历史 CBA）
var CBA_L2_TEAMS = [
  { city: '石家庄', nick: '翔蓝' }, { city: '合肥', nick: '狂风' }, { city: '长沙', nick: '勇胜' },
  { city: '武汉', nick: '锟鹏' }, { city: '广西', nick: '威壮' }, { city: '陕西', nick: '信达' },
  { city: '安徽', nick: '文一' }, { city: '河南', nick: '赊店老酒' }, { city: '贵州', nick: '森航' },
  { city: '重庆', nick: '华熙' }, { city: '佛山', nick: '功夫小子' }, { city: '东莞', nick: '麻涌' },
  { city: '拉萨', nick: '净土' }, { city: '江苏', nick: '国立' }, { city: '江西', nick: '鑫业' },
  { city: '河北', nick: '翔蓝' }, { city: '山西', nick: '国投' }, { city: '宁夏', nick: '哈纳斯' },
  { city: '天津', nick: '雄狮' }, { city: '北京', nick: '东方雄鹿' }, { city: '香港', nick: '飞龙' },
  { city: '云南', nick: '红河' }, { city: '四川', nick: '金强' }, { city: '广州', nick: '龙狮' },
  { city: '青岛', nick: '双星' }, { city: '浙江', nick: '广厦' }, { city: '江苏', nick: '同曦' },
  { city: '深圳', nick: '马可波罗' }
];

// 将真实队名套用到当前联赛（保留 team.id / 球员结构，仅改名 + 标记球员待核对）
function cba_apply(state) {
  function assign(leagueId, names) {
    const ids = state.leagues[leagueId].teamIds;
    ids.forEach(function (id, i) {
      const t = teamById(state, id);
      const nm = names[i % names.length];
      t.city = nm.city; t.nick = nm.nick; t.name = nm.city + nm.nick;
      // 占位球员：标记待人工核对（非真实名单）
      t.players.forEach(function (p) { p.todoVerify = true; });
    });
  }
  assign('L1', CBA_L1_TEAMS);
  assign('L2a', CBA_L2_TEAMS.slice(0, 14));
  assign('L2b', CBA_L2_TEAMS.slice(14, 28));
  state.usingCBA = true;
}

if (typeof module !== 'undefined') {
  module.exports = { CBA_L1_TEAMS, CBA_L2_TEAMS, cba_apply };
}
