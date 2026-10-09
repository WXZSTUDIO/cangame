/* =========================================================
 * CANGAME · 人生模拟（中国 · 1955-2005）
 * 数据层：天赋 / 出身 / 事件库 / 投资 / 结局
 * ========================================================= */

const GAME_META = {
  title: '人生模拟',
  subtitle: '从城中村到江景大平层',
  version: '5.1.0',
  startYear: 1985,
  endAge: 105
};

/* ---------------- 随机姓名库（中国百家姓） ---------------- */
const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
                  '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗',
                  '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹'];
const GIVEN_NAMES = {
  M: ['浩然', '子轩', '俊杰', '宇航', '思远', '嘉豪', '晨阳', '博文', '一鸣', '天佑',
      '梓睿', '泽宇', '锦程', '家豪', '志强', '建国', '伟', '磊', '鹏', '昊天',
      '书航', '亦凡', '慕白', '长风', '知远', '承宇', '明轩', '昱辰', '星辰', '子墨'],
  F: ['诗涵', '欣怡', '梓萱', '雨欣', '思彤', '梦琪', '嘉怡', '静怡', '子涵', '心怡',
      '晓雪', '雅静', '婉清', '若曦', '雨薇', '佳琪', '慧敏', '小雅', '丽', '婷',
      '知微', '映雪', '南栀', '书瑶', '语汐', '安然', '锦瑟', '灵犀', '未央', '清和']
};

/* ---------------- 出生叙事素材（随机人生故事） ---------------- */
const BIRTH_OPENERS = [
  '那年的雪盖住了整条巷子。你在城中村一间看不见天空的出租屋里，第一次睁开了眼睛。',
  '江上还没有几座桥。母亲说，你哭得很大声，像是不情愿来到这个世界。',
  '父亲的厂子还在运转，家里勉强供得起一盏暖黄色的灯。你就在那盏灯下出生。',
  '稻花香里，你降生在老家的偏房。接生婆说：这孩子命硬，能走出去。',
  '大雨的夜里，你提前三周来到人间。护士把你裹进一条旧毛毯，说活着就好。',
  '福利院的铁门在清晨打开时，你被放在台阶上的襁褓里。没有人知道你的父母是谁。',
  '父亲的书房比客厅还大。你在满墙的书影里出生，第一眼看到的是一架子旧书。',
  '母亲独自把你生了下来。她说，从那天起，她的命就不是自己的了。'
];
const BIRTH_PARENTS = [
  '父亲在走廊里来回踱步，直到护士把你抱出来。这个一辈子没哭过的男人，第一次红了眼眶。',
  '母亲抱着你看了整整一夜，在日记里写：无论多难，你要比妈妈走得远。',
  '爷爷奶奶从乡下寄来一袋米和一封信，信上只有四个字：平安长大。',
  '父亲摸了摸你皱巴巴的脸，对母亲说：咱们这辈子受的苦，到他这里为止。',
  '母亲把仅有的金戒指当了，换来一罐奶粉。她说：你先活，别的以后再说。',
  '养母把你搂在怀里，对院长说：这孩子，我带回去。'
];
const BIRTH_OMENS = [
  '助产士低声说：这孩子安静得不像刚出生，像是见过世面似的。',
  '那夜江上起了雾，老一辈人说：雾里生的人，要么大起，要么大落。',
  '一只黑猫蹲在窗台上看了你很久，母亲说那是好运，父亲说那是野猫。',
  '你出生那天，巷口的广播里正播着第一条地铁通车的消息——一个新世代的开端。',
  '算命的远房亲戚看了你的生辰，只说了一句：此子，命里多水。',
  '没人知道，你在午夜曾睁开眼，盯着虚空看了几秒，又睡了过去。'
];
const BIRTH_BY_FAMILY = {
  chengzhongcun: ['城中村的墙上贴着「拆」字，又被人用红漆划掉。你学会的第一件事，是辨认楼下哪一家的灯泡更亮。'],
  xiangong: ['厂区宿舍的机器声是你童年的白噪音。父亲的手比同龄人粗糙十倍。'],
  nongcun: ['村里小卖部的账本永远是母亲在算。你从小就会在心里给每一包盐标价。'],
  getihu: ['自家饭馆的油烟味从后厨飘到堂屋。你在收银台下面写完了小学六年的作业。'],
  jiaoshi: ['母亲的书架顶到天花板。她常说：穷点没关系，脑子里的东西谁也拿不走。'],
  tizhinei: ['父亲的单位分了这套两居室。家里的电话铃一响，往往是有人求他办事。'],
  chaiqian: ['拆迁协议签下来的那天，家里第一次有人谈论「几百万」这个词。'],
  shangren: ['父亲常年在外跑生意。你从小听着外面的故事长大，总觉得世界比这条巷子大得多。'],
  danqin: ['母亲一个人打三份工。你最早的记忆，是她趴在餐桌上睡着的背影。'],
  fuli: ['福利院的编号比名字来得更早。你学会了不期待，也不失望。'],
  kuangqu: ['矿区广播每天六点放《运动员进行曲》。你学会的第一件事，是辨认父亲的矿灯是不是还亮着。'],
  junshu: ['大院门口的哨兵换了一茬又一茬，你从他手里接过第一颗糖。'],
  tielu: ['父亲跑车回来的那天，行李箱里总有一包别的地方才有的吃的。'],
  linqu: ['林场的冬天，窗户上结着厚厚的霜。你用手指在上面画了一棵树。'],
  yumin: ['潮水退去的滩涂上，你捡到了第一只还能动的小螃蟹。'],
  keyan: ['研究所的走廊很长，深夜还亮着灯。你踮着脚也从窗子里看不见里面在做什么。'],
  yiliao: ['你出生在医院家属院。第一个抱你的人不是母亲，是值夜班的护士。'],
  wenyi: ['后台的镜子前挤满了人。你在角落里学着一板一眼地唱，谁也没发现。'],
  qiaojuan: ['南洋来的汇款单上写着你看不懂的字，母亲把它压在枕头下面。'],
  xiagang: ['厂区的广播停播那天，比过年还安静。父亲蹲在门口抽了一整包烟。'],
  chuzu: ['你的摇篮曲是计价器的滴答声和电台里的老歌。'],
  liushou: ['父母走的那天你没哭。奶奶说：等你长大了就懂了。'],
  dibao: ['街道主任来家里的次数，比亲戚还多。你记住了那个红色封面。'],
  shuxiang: ['书店打烊之后，父亲会把新到的书先给你留一本。']
};

/* ---------------- 数值定义 ---------------- */
const STATS = [
  { key: 'INT', name: '智力', hint: '学习、考试、谋略' },
  { key: 'STR', name: '体魄', hint: '参军、打架、耐力' },
  { key: 'CHA', name: '魅力', hint: '人脉、恋爱、影响力' },
  { key: 'WILL', name: '意志', hint: '抗压、低谷反弹' },
  { key: 'HP', name: '健康', hint: '归零即人生结束' },
  { key: 'STRESS', name: '压力', hint: '过高会损伤健康' }
];

const RESOURCES = [
  { key: 'MONEY', name: '资产', hint: '元 ₩' },
  { key: 'NET', name: '人脉', hint: '关键时刻能调动的人' },
  { key: 'FAME', name: '声望', hint: '社会知名度' },
  { key: 'LOY', name: '职场口碑', hint: '在公司与行业里的信誉' }
];

/* ---------------- 8 项人生指标（主面板） ---------------- */
const LIFE_METRICS = [
  { key: 'HP', name: '健康', hint: '归零即人生结束' },
  { key: 'CUR', name: '好奇心', hint: '探索与学习欲' },
  { key: 'LOVE', name: '关爱', hint: '爱与归属感' },
  { key: 'SEC', name: '安全感', hint: '内心的安稳' },
  { key: 'FAME', name: '声望', hint: '社会知名度' },
  { key: 'AUTO', name: '自主性', hint: '掌控自己的人生' },
  { key: 'CHA', name: '人际关系', hint: '与人相处' },
  { key: 'GROW', name: '成长', hint: '一辈子的积累' }
];

/* ---------------- 擅长领域（开局选择，影响人生倾向） ---------------- */
const PRIORITIES = [
  { key: 'career', name: '事业', desc: '把精力押在学习与事业上，财富与能力滚雪球。' },
  { key: 'relation', name: '关系', desc: '重视爱、家庭与朋友，关爱与安全感更高。' },
  { key: 'balance', name: '平衡', desc: '健康与心境并重，少一点挣扎，稳稳地走。' },
  { key: 'success', name: '成功', desc: '追逐名望与人脉，离聚光灯更近。' }
];

/* ---------------- 天赋 ---------------- */
/* cost > 0 消耗点数，cost < 0 返还点数（负面天赋） */
const TALENTS = [
  { id: 'memory', name: '前世记忆', cost: 4, desc: '你活过两世。前世的记忆让你记得未来三十年的大事件——汇率、房价、危机与风口。',
    eff: { WILL: 6, INT: 3 }, flags: ['past_life'], tag: '核心' },
  { id: 'math', name: '数学天才', cost: 3, desc: '数字在你脑中自己排队。', eff: { INT: 9 } },
  { id: 'iron', name: '钢铁体魄', cost: 2, desc: '从小没打过点滴。', eff: { STR: 9, HP: 10 } },
  { id: 'face', name: '天生丽质', cost: 3, desc: '江南的整形医院以你的脸为模板。', eff: { CHA: 9 } },
  { id: 'will', name: '不屈意志', cost: 2, desc: '被打倒多少次，就站起来多少次。', eff: { WILL: 9 } },
  { id: 'gangnam', name: '城里户口', cost: 3, desc: '户口本上写着城区，哪怕住的是隔断间。', eff: { CHA: 4, MONEY: 8000000 }, flags: ['gangnam'] },
  { id: 'legacy', name: '父亲的遗物', cost: 2, desc: '一只旧铁盒，里面是父亲攒了一辈子的钱。', eff: { MONEY: 6000000, WILL: 2 } },
  { id: 'code', name: '编程天才', cost: 2, desc: '你在 DOS 里写出了第一个中文输入法。', eff: { INT: 5, STR: -2 }, flags: ['coder'] },
  { id: 'speech', name: '辩才无碍', cost: 2, desc: '一张嘴能把黑的说成白的。', eff: { CHA: 5, NET: 5 } },
  { id: 'stock', name: '股神直觉', cost: 2, desc: '你天生懂得恐惧与贪婪的周期。', eff: { INT: 3 }, flags: ['stock_buff'] },
  { id: 'estate', name: '房产直觉', cost: 2, desc: '你总能闻到哪块地要涨价。', eff: { INT: 2 }, flags: ['estate_buff'] },
  { id: 'network', name: '人脉世家', cost: 2, desc: '叔叔的表哥的岳父，总在某个要害部门。', eff: { NET: 10 } },
  { id: 'health', name: '养生达人', cost: 1, desc: '你熟读每一本健康杂志。', eff: { HP: 15, STRESS: -10 } },
  { id: 'revenge', name: '燃烧的野心', cost: 2, desc: '你不甘平庸。这种不甘既是燃料，也是火。', eff: { WILL: 6, STRESS: 12 }, flags: ['ambition'] },
  { id: 'lucky', name: '锦鲤附体', cost: 2, desc: '好事总在你身上多绕一圈。', eff: {}, flags: ['lucky'] },
  { id: 'diligent', name: '勤勉', cost: 1, desc: '你相信一天十四小时的力量。', eff: { INT: 2, STR: 2, CHA: 2, WILL: 2 } },
  { id: 'absolutepitch', name: '绝对音感', cost: 1, desc: '随便一首歌你都能弹出调子。', eff: { CHA: 4 }, flags: ['music'] },
  { id: 'dual', name: '双重国籍', cost: 2, desc: '家里有海外关系，很多事对你来说只是手续。', eff: { CHA: 2 }, flags: ['no_military'] },
  { id: 'flatfoot', name: '扁平足', cost: -2, desc: '体检没过关，倒让你比同龄人早两年进了社会。', eff: { STR: -3 }, flags: ['no_military'] },
  { id: 'debt', name: '负债之子', cost: -3, desc: '父亲的债，写在你的户口本上。', eff: { MONEY: -4000000, WILL: 5 } },
  { id: 'ugly', name: '外貌自卑', cost: -2, desc: '你习惯了被忽略，也因此更懂得观察。', eff: { CHA: -4, INT: 4 } },
  { id: 'sick', name: '病弱', cost: -2, desc: '医院的走廊你比教室还熟。', eff: { HP: -9, INT: 3 } },
  { id: 'country', name: '乡下出身', cost: -2, desc: '老家的稻田，和这座城的霓虹隔着一整个时代。', eff: { CHA: -2, STR: 4, WILL: 2 } },
  { id: 'temper', name: '暴脾气', cost: -2, desc: '拳头总比脑子先动。', eff: { STR: 5, CHA: -3, WILL: 2 } },

  /* ===== 以下 100 种为 v5.2 扩充天赋 ===== */
  /* 脑力 */
  { id: 't_seed', name: '读书种子', cost: 1, tag: '脑力', desc: '字认得比话还早，三岁能背半本《唐诗》。', eff: { INT: 5, GROW: 2 } },
  { id: 't_speedread', name: '一目十行', cost: 2, tag: '脑力', desc: '别人翻一页的时间，你已经看完了三页，还能复述。', eff: { INT: 6, CUR: 3 } },
  { id: 't_mental', name: '心算如飞', cost: 2, tag: '脑力', desc: '菜市场阿姨还没报完价，你已经算出找零。', eff: { INT: 5, LOY: 2 } },
  { id: 't_memory2', name: '过目不忘', cost: 3, tag: '脑力', desc: '看过的题号、走过的路、欠过的人情，你都记得。', eff: { INT: 7, WILL: 1 } },
  { id: 't_smallgenius', name: '小学霸', cost: 1, tag: '脑力', desc: '班里的第一名。代价是别人在玩的时候，你在写卷子。', eff: { INT: 4, STRESS: 3 } },
  { id: 't_why', name: '爱问为什么', cost: 1, tag: '脑力', desc: '你从小把大人问烦，长大后把上司问烦。', eff: { CUR: 8, INT: 2 } },
  { id: 't_chess', name: '棋类天赋', cost: 1, tag: '脑力', desc: '巷口下棋的老头输给你之后，再也不肯跟你下。', eff: { INT: 4, WILL: 2 } },
  { id: 't_olympiad', name: '竞赛苗子', cost: 2, tag: '脑力', desc: '奥数班、物理竞赛、作文比赛，名单上总有你。', eff: { INT: 6, FAME: 3 } },
  { id: 't_ear', name: '外语耳朵', cost: 2, tag: '脑力', desc: '你听两遍就能模仿口音，外语老师视你为得意门生。', eff: { INT: 3, CHA: 3 } },
  { id: 't_pen', name: '写作的手', cost: 2, tag: '脑力', desc: '你写的作文总被当范文念，长大后写方案也一样顺。', eff: { INT: 3, FAME: 4, CUR: 3 } },
  { id: 't_logic-clean', name: '逻辑洁癖', cost: 2, tag: '脑力', desc: '你受不了含糊的表达，也受不了糊涂的人。', eff: { INT: 5, CHA: -2 } },
  { id: 't_takeapart', name: '拆东西的人', cost: 1, tag: '脑力', desc: '家里的闹钟、收音机、自行车，都被你拆过一遍。', eff: { INT: 3, CUR: 4, STR: 1 } },

  /* 体魄 */
  { id: 't_athlete', name: '运动神经', cost: 2, tag: '体魄', desc: '体育课永远是第一个被选走的那个人。', eff: { STR: 8, HP: 5 } },
  { id: 't_runner', name: '跑得快', cost: 1, tag: '体魄', desc: '短跑第一，也是跑腿最快的人。出了事你第一个到。', eff: { STR: 5, HP: 3 } },
  { id: 't_ironstomach', name: '铁胃', cost: 1, tag: '体魄', desc: '路边摊吃十年没闹过肚子。', eff: { HP: 6, STR: 2 } },
  { id: 't_nosick', name: '不生病体质', cost: 3, tag: '体魄', desc: '别人流感你照常上班，医院的门你一年也进不了一次。', eff: { HP: 14 } },
  { id: 't_tall', name: '长得高', cost: 2, tag: '体魄', desc: '你永远坐教室最后一排，也永远被推去搬东西。', eff: { STR: 5, CHA: 4 } },
  { id: 't_handy', name: '手上功夫', cost: 1, tag: '体魄', desc: '什么东西到了你手里都会修好。', eff: { STR: 4, GROW: 2 } },
  { id: 't_lefthand', name: '左撇子', cost: 1, tag: '体魄', desc: '被纠正了六年也没改过来，反倒让你脑子转得快一点。', eff: { INT: 3, CHA: 1 } },
  { id: 't_nightowl', name: '夜里不困', cost: 1, tag: '体魄', desc: '凌晨两点的效率，比你上午十点高一倍。', eff: { INT: 2, STRESS: -6, HP: -2 } },
  { id: 't_lung', name: '好肺活量', cost: 2, tag: '体魄', desc: '爬六楼不带喘，唱歌不跑调也不缺氧。', eff: { STR: 6, HP: 4 } },
  { id: 't_heal', name: '康复奇快', cost: 2, tag: '体魄', desc: '别人躺一周的伤，你三天就能下地。', eff: { HP: 8, WILL: 2 } },

  /* 心性 */
  { id: 't_thick', name: '钝感力', cost: 2, tag: '心性', desc: '别人的冷眼落到你身上，像雨点打在雨衣上。', eff: { STRESS: -12, MOOD: 6 } },
  { id: 't_aq', name: '逆商', cost: 3, tag: '心性', desc: '跌得越狠，反弹得越高。你享受那种「又被我看对了」的感觉。', eff: { WILL: 8, SEC: 3 } },
  { id: 't_slowwarm', name: '慢热', cost: 1, tag: '心性', desc: '刚开始话很少，熟了之后能把桌子掀了。', eff: { WILL: 4, CHA: -1 } },
  { id: 't_unyielding', name: '不服输', cost: 2, tag: '心性', desc: '你宁愿输得难看，也不肯退半步。', eff: { WILL: 6, STRESS: 5, STR: 2 } },
  { id: 't_bluntknife', name: '钝刀', cost: 2, tag: '心性', desc: '不快，但磨一整天也不会崩口。', eff: { WILL: 5, SEC: 3, LOVE: -2 } },
  { id: 't_alone', name: '习惯独处', cost: 1, tag: '心性', desc: '一个人吃饭、一个人看电影，你并不觉得别扭。', eff: { GROW: 4, SEC: 4, CHA: -2 } },
  { id: 't_bigheart', name: '心很大', cost: 1, tag: '心性', desc: '天塌下来先睡一觉再说。', eff: { MOOD: 7, STRESS: -5 } },
  { id: 't_account', name: '记账的人', cost: 2, tag: '心性', desc: '每一笔支出你都记得日子，钱包比谁都清楚。', eff: { SEC: 5, INT: 2, MONEY: 500000 } },
  { id: 't_earlybird', name: '起得早', cost: 2, tag: '心性', desc: '五点半的天你看过很多年，那时候城市还没醒。', eff: { WILL: 4, HP: 3, STRESS: -3 } },
  { id: 't_endure', name: '能忍', cost: 2, tag: '心性', desc: '咽下去的东西，最后都变成了你的底盘。', eff: { STRESS: -10, WILL: 3, ETH: 2 } },
  { id: 't_sunny', name: '天生乐观', cost: 2, tag: '心性', desc: '「会好起来的」是你的口头禅，居然常常被你说中。', eff: { MOOD: 8, LOVE: 3 } },
  { id: 't_noway', name: '不服管', cost: 2, tag: '心性', desc: '有人指使你的时候，你的第一反应是反问一句：凭什么。', eff: { AUTO: 6, WILL: 3, LOY: -4 } },
  { id: 't_superstition', name: '有点迷信', cost: 1, tag: '心性', desc: '出门先看黄历，重要决定要挑日子。信了心里就踏实。', eff: { MOOD: 4, CUR: 2 } },

  /* 人际 */
  { id: 't_outgoing', name: '自来熟', cost: 2, tag: '人际', desc: '火车上坐三站，你就能跟隔壁聊聊他家的事。', eff: { CHA: 7, NET: 5 } },
  { id: 't_sweet', name: '嘴甜', cost: 1, tag: '人际', desc: '一句「阿姨您今天气色真好」，能换来一个橘子。', eff: { CHA: 5 } },
  { id: 't_smooth', name: '会来事', cost: 2, tag: '人际', desc: '什么时候该说话、什么时候该闭嘴，你比谁都清楚。', eff: { CHA: 4, LOY: 6, NET: 3 } },
  { id: 't_read', name: '察言观色', cost: 2, tag: '人际', desc: '你总能在话没说完之前就知道对方要什么。', eff: { INT: 3, CHA: 3, SEC: 2 } },
  { id: 't_popular', name: '有人缘', cost: 2, tag: '人际', desc: '你搬家那天，来帮忙的人比搬家公司还多。', eff: { NET: 9, LOVE: 3 } },
  { id: 't_monitor', name: '班干部体质', cost: 1, tag: '人际', desc: '从小组长到团支书，一路戴着两道杠长大。', eff: { NET: 6, FAME: 3, WILL: 2 } },
  { id: 't_worldly', name: '见过世面', cost: 2, tag: '人际', desc: '你小学就去过省城，谈吐里有一种不慌张的底气。', eff: { CHA: 5, NET: 4, CUR: 3 } },
  { id: 't_loud', name: '嗓门大', cost: 1, tag: '人际', desc: '操场上喊一声，半个学校回头。', eff: { CHA: 3, STR: 3, NET: 2 } },
  { id: 't_laugh', name: '笑点低', cost: 1, tag: '人际', desc: '别人还没讲完你已经在笑，气氛因此松了下来。', eff: { LOVE: 5, MOOD: 4, CHA: 2 } },
  { id: 't_cook', name: '会做饭', cost: 1, tag: '人际', desc: '十岁就站在板凳上炒蛋，朋友都惦记你这一口。', eff: { LOVE: 5, HP: 3, CHA: 1 } },
  { id: 't_loyal', name: '讲义气', cost: 2, tag: '人际', desc: '朋友出事，你半夜也会去。谁都说你傻，谁都有事找你。', eff: { NET: 6, ETH: 4, LOVE: 2 } },
  { id: 't_shameless', name: '厚脸皮', cost: 2, tag: '人际', desc: '被拒绝三次还能笑着敲门——第四次的门往往是开的。', eff: { CHA: 4, FAME: 3, ETH: -3, STRESS: -5 } },
  { id: 't_comfort', name: '会安慰人', cost: 1, tag: '人际', desc: '别人哭的时候，你正好有一句合适的话。', eff: { LOVE: 6, NET: 2 } },

  /* 财运 */
  { id: 't_business', name: '生意头脑', cost: 3, tag: '财运', desc: '你一眼能看出这条街上哪门生意在赔本赚吆喝。', eff: { INT: 4, NET: 4, CHA: 2 }, flags: ['business'] },
  { id: 't_bargain', name: '会砍价', cost: 1, tag: '财运', desc: '老板说三十，你说五块——最后十块成交。', eff: { MONEY: 1500000, INT: 1, CHA: 1 } },
  { id: 't_luckymoney', name: '压岁钱存下来了', cost: 1, tag: '财运', desc: '别人早就花光了，你那本存折还留着。', eff: { MONEY: 3000000 } },
  { id: 't_oldhouse', name: '老屋一间', cost: 3, tag: '财运', desc: '乡下还有一间祖屋，钥匙在你手里。', eff: { SEC: 10, MONEY: 2000000 } },
  { id: 't_lottery', name: '彩票体质', cost: 2, tag: '财运', desc: '刮刮乐总能刮出五块十块——大钱说不定也在路上。', eff: { MOOD: 2 }, flags: ['lucky'] },
  { id: 't_number', name: '数字敏感', cost: 2, tag: '财运', desc: '报表里的一个错数，你扫一眼就能揪出来。', eff: { INT: 4, MONEY: 2000000 } },
  { id: 't_thrift', name: '节俭成癖', cost: 1, tag: '财运', desc: '灯泡要随手关，剩菜要打包，钱是一分一分攒出来的。', eff: { SEC: 5, MONEY: 1000000, CHA: -2 } },
  { id: 't_hoard', name: '会囤东西', cost: 2, tag: '财运', desc: '邮票、旧币、限量款——你囤的那些东西后来都涨了。', eff: { MONEY: 4000000, WILL: 2 } },
  { id: 't_investnose', name: '投资嗅觉', cost: 3, tag: '财运', desc: '别人追涨，你在没人看的时候默默买。', eff: { INT: 4 }, flags: ['stock_buff'] },
  { id: 't_houseeye', name: '看房眼光', cost: 3, tag: '财运', desc: '你走进一间房子就知道它三年后值多少。', eff: { MONEY: 3000000 }, flags: ['estate_buff'] },
  { id: 't_craft', name: '手艺人', cost: 2, tag: '财运', desc: '理发、修表、贴瓷砖——有手艺的人永远饿不着。', eff: { STR: 4, LOY: 6, MONEY: 1000000 } },
  { id: 't_sidejob', name: '闲不住', cost: 1, tag: '财运', desc: '假期从来不闲着，总给自己找点能挣钱的活。', eff: { MONEY: 1200000, WILL: 2, STRESS: 3 } },

  /* 才华与兴趣 */
  { id: 't_draw', name: '会画画', cost: 2, tag: '才华', desc: '板报、海报、涂鸦墙，都出自你这只手。', eff: { CHA: 4, CUR: 4, FAME: 2 } },
  { id: 't_sing', name: '一副好嗓子', cost: 2, tag: '才华', desc: 'KTV 里你一开口，服务员都在门口停下来听。', eff: { CHA: 5, LOVE: 2 }, flags: ['music'] },
  { id: 't_instrument', name: '会乐器', cost: 2, tag: '才华', desc: '二胡、吉他或钢琴，总有一件你拿得出手。', eff: { CHA: 4, WILL: 2 }, flags: ['music'] },
  { id: 't_dance', name: '会跳舞', cost: 2, tag: '才华', desc: '迪厅、广场、舞台，你从不怯场。', eff: { CHA: 5, STR: 3 } },
  { id: 't_game', name: '游戏高手', cost: 2, tag: '才华', desc: '街机厅里没人打得过你，后来你靠直播吃饭。', eff: { INT: 3, CHA: 2, MOOD: 3 } },
  { id: 't_sports', name: '球类专长', cost: 2, tag: '才华', desc: '乒乓、篮球或羽毛球，你总有一项是全场最好的。', eff: { STR: 6, NET: 3, CHA: 2 } },
  { id: 't_write2', name: '网文笔力', cost: 1, tag: '才华', desc: '你在论坛连载的故事，追更的人比想象中多。', eff: { INT: 2, FAME: 3, MOOD: 3 } },
  { id: 't_camera', name: '镜头感', cost: 2, tag: '才华', desc: '同样的场景，你拍出来就是好看。', eff: { CHA: 3, FAME: 4, CUR: 3 } },
  { id: 't_code2', name: '自学过代码', cost: 2, tag: '才华', desc: '照着杂志上的 BASIC 抄了半年，忽然就懂了。', eff: { INT: 5 }, flags: ['coder'] },
  { id: 't_diy', name: '爱折腾', cost: 1, tag: '才华', desc: '改装、越狱、刷机，你从不怕把东西搞坏。', eff: { CUR: 6, GROW: 3, INT: 2 } },
  { id: 't_talk2', name: '演讲的天赋', cost: 2, tag: '才华', desc: '一上台你就不紧张，台下的人也比你安静。', eff: { CHA: 5, FAME: 4, NET: 2 } },
  { id: 't_style', name: '穿得好看', cost: 1, tag: '才华', desc: '同样几十块的衣服，你穿出来就是不一样。', eff: { CHA: 4, LOVE: 2 } },

  /* 时代与背景 */
  { id: 't_grandpa', name: '爷爷的故事', cost: 1, tag: '背景', desc: '老人讲的旧事，让你比同龄人更早懂得什么叫「熬过来」。', eff: { WILL: 3, SEC: 3, GROW: 2 } },
  { id: 't_hukou2', name: '城镇户口', cost: 2, tag: '背景', desc: '粮本和户口本上的那一行，决定了你能进哪所学校。', eff: { SEC: 6, CHA: 2, NET: 3 } },
  { id: 't_canteen', name: '食堂长大的孩子', cost: 1, tag: '背景', desc: '厂区食堂的饭票是你童年的硬通货。', eff: { NET: 4, STR: 2 } },
  { id: 't_bicycle', name: '一辆二八大杠', cost: 1, tag: '背景', desc: '从学会骑那天起，你的活动半径翻了十倍。', eff: { STR: 3, CUR: 4, MOOD: 3 } },
  { id: 't_letter', name: '笔友很多', cost: 1, tag: '背景', desc: '你抽屉里有一沓各地寄来的信，字迹各不相同。', eff: { NET: 5, CUR: 3, LOVE: 2 } },
  { id: 't_homeschool', name: '家里有人教你', cost: 2, tag: '背景', desc: '不用去补习班，饭桌上就是课堂。', eff: { INT: 5, WILL: 2 }, flags: ['prof'] },
  { id: 't_connections', name: '舅舅在单位', cost: 3, tag: '背景', desc: '很多事对你来说，只是一句话的距离。', eff: { NET: 12, LOY: 4, SEC: 4 }, flags: ['tizhinei'] },
  { id: 't_diploma', name: '家里的书箱', cost: 2, tag: '背景', desc: '一箱旧书，比一柜新衣服更能决定你去哪儿。', eff: { INT: 4, CUR: 5 } },
  { id: 't_south', name: '南下过的父母', cost: 2, tag: '背景', desc: '他们在南方的厂里待过，邮回来的汇款单撑起了整个童年。', eff: { WILL: 4, SEC: 3, MONEY: 1500000 } },
  { id: 't_military_family', name: '军属大院', cost: 2, tag: '背景', desc: '哨声、操场、整齐晾着的衣服，你的童年有纪律的形状。', eff: { STR: 4, WILL: 5, ETH: 3 } },

  /* 负面：返还点数 */
  { id: 'n_short', name: '个子矮', cost: -1, tag: '负面', desc: '永远排队伍最前排，也永远够不到最高的那一格。', eff: { STR: -3, CHA: -2, INT: 2 } },
  { id: 'n_stutter', name: '口吃', cost: -2, tag: '负面', desc: '每次开口都是一场战斗，你学会了少说话、多听。', eff: { CHA: -6, INT: 3, WILL: 3 } },
  { id: 'n_shy', name: '极度内向', cost: -2, tag: '负面', desc: '被点名回答问题的时候，你的耳朵是烫的。', eff: { CHA: -5, NET: -5, INT: 4 } },
  { id: 'n_lazy', name: '懒', cost: -2, tag: '负面', desc: '能躺着就不坐着，能明天就不今天。', eff: { WILL: -5, STR: -3, MOOD: 4 } },
  { id: 'n_proud', name: '死要面子', cost: -2, tag: '负面', desc: '宁可借钱也不开口求助，为此吃过不少暗亏。', eff: { ETH: 3, LOVE: -4, SEC: -4, NET: 3 } },
  { id: 'n_gamble', name: '赌性', cost: -3, tag: '负面', desc: '输了想翻本，赢了想再来一把。', eff: { MOOD: 3, WILL: 4, SEC: -8, ETH: -4 } },
  { id: 'n_smoke', name: '很早就学会抽烟', cost: -2, tag: '负面', desc: '十五岁那年的烟，抽掉了你后来的一部分肺。', eff: { HP: -8, STRESS: -4, NET: 4 } },
  { id: 'n_drink', name: '酒量很差', cost: -1, tag: '负面', desc: '一杯就倒，应酬的场合你总是先失守。', eff: { HP: -3, CHA: -2, LOY: -3 } },
  { id: 'n_poorhealth', name: '底子薄', cost: -2, tag: '负面', desc: '冬天一到就咳嗽，体育课永远在请假。', eff: { HP: -10, STR: -4 } },
  { id: 'n_debt2', name: '家里欠着钱', cost: -3, tag: '负面', desc: '催债的人来过家里，母亲把他们送到楼下再回来。', eff: { MONEY: -3000000, WILL: 4, SEC: -6 } },
  { id: 'n_quarrel', name: '家里天天吵架', cost: -2, tag: '负面', desc: '摔碗的声音比电视声还响，你学会了躲进自己心里。', eff: { SEC: -8, LOVE: -5, WILL: 4 } },
  { id: 'n_loss', name: '早逝的至亲', cost: -2, tag: '负面', desc: '很小的时候你就知道了殡仪馆是什么样子。', eff: { LOVE: -6, WILL: 5, GROW: 4, MOOD: -4 } },
  { id: 'n_leftbehind', name: '留守过', cost: -2, tag: '负面', desc: '父母在外打工，你跟着老人长大，一年见两次。', eff: { NET: -4, LOVE: -4, WILL: 6, SEC: -4 } },
  { id: 'n_bully', name: '被欺负过', cost: -2, tag: '负面', desc: '走廊上的嘲笑，让你很早就学会了察言观色。', eff: { CHA: -3, STR: 3, INT: 4, SEC: -5 } },
  { id: 'n_slow', name: '反应慢半拍', cost: -2, tag: '负面', desc: '别人抢答完你才反应过来——但你答的往往更准。', eff: { INT: -4, WILL: 4, GROW: 3 } },
  { id: 'n_ugly2', name: '长得着急', cost: -1, tag: '负面', desc: '十八岁就被叫大叔，你索性不再解释。', eff: { CHA: -3, INT: 2, WILL: 3 } },
  { id: 'n_distract', name: '注意力涣散', cost: -2, tag: '负面', desc: '一节课里有半节在窗外。但窗外的东西你也记住了。', eff: { INT: -3, CUR: 6, GROW: 3 } },
  { id: 'n_poor2', name: '穷习惯了', cost: -2, tag: '负面', desc: '哪怕后来有钱了，你还是会把塑料袋收好叠起来。', eff: { SEC: -6, STR: 4, WILL: 3 } }
];

/* ---------------- 出身（中国国情） ---------------- */
const FAMILIES = [
  { id: 'chengzhongcun', name: '城中村 出租屋', desc: '窗子对着一米宽的握手楼天井，能看见对面邻居的袜子。大城市边缘，一间 12 平的隔断间。',
    eff: { MONEY: 1200000, INT: 3, CHA: 2, WILL: 4 }, flags: ['poor', 'city'] },
  { id: 'xiangong', name: '县城 双职工家庭', desc: '父亲在县纺织厂做机修，母亲在食堂帮工。厂里的广播每天六点准时响。',
    eff: { MONEY: 800000, STR: 5, WILL: 5, INT: 1 }, flags: ['poor', 'town'] },
  { id: 'nongcun', name: '农村 务农家庭', desc: '家里有几亩地和一头牛。交完公粮，剩下的才是自己的。',
    eff: { MONEY: 600000, STR: 7, WILL: 6, CHA: -1, INT: 1 }, flags: ['poor', 'rural'] },
  { id: 'getihu', name: '县城 个体户家庭', desc: '临街一间十几平的小卖部，柜台后面就是全家的饭桌。',
    eff: { MONEY: 1500000, INT: 2, CHA: 4, NET: 3 }, flags: ['town', 'shop'] },
  { id: 'jiaoshi', name: '教师 知识分子家庭', desc: '母亲是中学语文老师，家里的墙都是书架，寒暑假比谁都长。',
    eff: { MONEY: 3000000, INT: 9, CHA: 2, NET: 5 }, flags: ['prof'] },
  { id: 'tizhinei', name: '体制内 干部家庭', desc: '父亲在县里某个局上班，单位分了两居室。家里的电话一响，常是有人求办事。',
    eff: { MONEY: 4000000, INT: 4, CHA: 3, NET: 10, SEC: 8 }, flags: ['tizhinei', 'stable'] },
  { id: 'chaiqian', name: '拆迁户 城中村改造', desc: '老房子拆了，赔了三套房和一笔钱。家里第一次有人谈论「几百万」这个词。',
    eff: { MONEY: 5000000, INT: 2, CHA: 3, NET: 4, SEC: 6 }, flags: ['rentier'] },
  { id: 'shangren', name: '私企 老板家庭', desc: '父亲常年在外跑生意，一年在家不到两个月。他的名片上印着三个公司。',
    eff: { MONEY: 2500000, CHA: 3, NET: 8, WILL: 3 }, flags: ['business'] },
  { id: 'danqin', name: '单亲 母亲带大', desc: '母亲一个人打三份工，把你拉扯大。她从不说累，只是睡得越来越早。',
    eff: { MONEY: 500000, WILL: 8, INT: 3, CHA: 1 }, flags: ['poor', 'single'] },
  { id: 'fuli', name: '福利院 孤儿', desc: '你的档案袋上没有一个亲属的名字，只有一排编号。',
    eff: { MONEY: 200000, WILL: 9, INT: 5, CHA: -2 }, flags: ['poor', 'orphan'] },

  /* ===== v5.2 追加出身 ===== */
  { id: 'kuangqu', name: '矿区 矿工家庭', desc: '父亲每天六点下井，升井时只有眼白是白的。矿区的天总是灰的，澡堂的水总是黑的。',
    eff: { MONEY: 1200000, STR: 9, WILL: 7, HP: -3, CHA: -1 }, flags: ['poor', 'town'] },
  { id: 'junshu', name: '部队大院 军属', desc: '哨声准时响，晾衣绳上的衣服永远一样齐。你从小就知道什么叫纪律，也知道什么叫服从。',
    eff: { MONEY: 2200000, STR: 5, WILL: 7, SEC: 8, ETH: 3 }, flags: ['stable'] },
  { id: 'tielu', name: '铁路职工 家庭', desc: '父亲跑车一走就是三天。你听着铁轨的节奏长大，也早就知道远方是有票才能去的地方。',
    eff: { MONEY: 1800000, WILL: 5, NET: 6, CUR: 4 }, flags: ['town', 'stable'] },
  { id: 'linqu', name: '林场 林业工人家庭', desc: '冬天的雪能没过膝盖，夏天的蚊虫能咬穿衣服。伐木车辆下山时，整条路都在震。',
    eff: { MONEY: 900000, STR: 8, HP: 4, WILL: 4, CHA: -1 }, flags: ['poor', 'rural'] },
  { id: 'yumin', name: '渔村 渔民家庭', desc: '潮水决定你家的作息。台风来的那几天，全村人都不说话，只盯着海面。',
    eff: { MONEY: 1100000, STR: 7, WILL: 6, SEC: -3, MOOD: 2 }, flags: ['poor', 'rural'] },
  { id: 'keyan', name: '科研院所 家庭', desc: '父母在研究所上班，家里的茶几上堆着印着内部字样的资料。他们说：做学问要坐得住冷板凳。',
    eff: { MONEY: 3500000, INT: 11, CUR: 6, CHA: -1 }, flags: ['prof'] },
  { id: 'yiliao', name: '医生世家', desc: '医院的后院就是你童年的游乐场，消毒水的味道比糖果更熟悉。',
    eff: { MONEY: 4200000, INT: 8, HP: 8, NET: 7, SEC: 5 }, flags: ['prof', 'stable'] },
  { id: 'wenyi', name: '文工团 艺人家庭', desc: '母亲在县文工团唱戏，后台的脂粉味混着旧木箱的霉味。你三岁就敢站到灯底下。',
    eff: { MONEY: 1600000, CHA: 9, FAME: 5, CUR: 4 }, flags: ['town'] },
  { id: 'qiaojuan', name: '侨眷 侨乡家庭', desc: '南洋寄来的汇款单撑起了这栋三层小楼。家里人说：要走就得走得出去。',
    eff: { MONEY: 6000000, CHA: 4, NET: 7, SEC: 6, CUR: 4 }, flags: ['business'] },
  { id: 'xiagang', name: '下岗职工 家庭', desc: '1998 年，厂门口贴了名单。父亲在上面，那天家里很安静，只有电视开着。',
    eff: { MONEY: 400000, WILL: 9, STR: 4, SEC: -6, MOOD: -3 }, flags: ['poor', 'town'] },
  { id: 'chuzu', name: '出租车司机 家庭', desc: '父亲的车就是家里的饭碗。你坐在后座的塑料垫上，听他讲一整天遇到的形形色色。',
    eff: { MONEY: 1900000, NET: 7, INT: 3, WILL: 4, CHA: 2 }, flags: ['city'] },
  { id: 'liushou', name: '留守儿童 · 爷爷奶奶带大', desc: '父母在外打工，汇款单一年回来两次。你跟着老人长大，学会了自己做饭、自己签家长名。',
    eff: { MONEY: 500000, WILL: 9, INT: 4, SEC: -5, LOVE: -4 }, flags: ['poor', 'rural'] },
  { id: 'dibao', name: '低保 · 困难家庭', desc: '街道干部认识你家。每个月那个红本本，是一家人一个月不敢出错的理由。',
    eff: { MONEY: 300000, WILL: 6, SEC: -7, MOOD: -3, STR: 3 }, flags: ['poor', 'city'] },
  { id: 'shuxiang', name: '书店老板 家庭', desc: '临街一间旧书店，纸墨味比饭菜味更重。你小时候没玩具，但有整整两面墙的书。',
    eff: { MONEY: 2400000, INT: 7, CUR: 7, NET: 4, CHA: 2 }, flags: ['town', 'shop'] }
];

/* ---------------- 家庭财务（出生时父母的资产 / 负债，1985 年 基准，按年代缩放） ----------------
 * 未成年期间由家庭承担生活与教育费：家庭资产不够，就转成家庭负债。
 * 父母离世时可「全额继承 / 限定继承 / 放弃继承」。
 */
const FAMILY_FIN = {
  chengzhongcun: { assets: 30000000, debt: 45000000 },
  xiangong: { assets: 25000000, debt: 30000000 },
  nongcun: { assets: 18000000, debt: 22000000 },
  getihu: { assets: 60000000, debt: 25000000 },
  jiaoshi: { assets: 180000000, debt: 60000000 },
  tizhinei: { assets: 220000000, debt: 50000000 },
  chaiqian: { assets: 350000000, debt: 120000000 },
  shangren: { assets: 150000000, debt: 40000000 },
  danqin: { assets: 15000000, debt: 38000000 },
  fuli: { assets: 5000000, debt: 0 },
  /* v5.2 追加出身 */
  kuangqu: { assets: 28000000, debt: 35000000 },
  junshu: { assets: 160000000, debt: 30000000 },
  tielu: { assets: 90000000, debt: 25000000 },
  linqu: { assets: 22000000, debt: 18000000 },
  yumin: { assets: 35000000, debt: 30000000 },
  keyan: { assets: 200000000, debt: 55000000 },
  yiliao: { assets: 210000000, debt: 45000000 },
  wenyi: { assets: 70000000, debt: 20000000 },
  qiaojuan: { assets: 280000000, debt: 60000000 },
  xiagang: { assets: 12000000, debt: 50000000 },
  chuzu: { assets: 75000000, debt: 40000000 },
  liushou: { assets: 14000000, debt: 26000000 },
  dibao: { assets: 8000000, debt: 22000000 },
  shuxiang: { assets: 95000000, debt: 35000000 }
};

/* 考研上岸后的起薪系数下限。school.js 与 engine.js 三处考研路径共用这一个常量。
 *
 * 取 1.45 而不是 1.40 的理由：
 *   ① 985 本科的 eduLevel 也是 5，硕士下限必须 ≥ 985 本科的 1.42，否则「读研反而降薪」倒挂；
 *   ② 取 1.40 时，985 压线档（1.42）与 u_key 满分档（1.43）考研收益被 Math.max 精确吃掉，
 *      变成「花两年 + 学费买空气」的负收益陷阱；取 1.45 则至少为正（+1.4% / +2.1%）；
 *   ③ 1.45 < salaryK 上限（economy-respec U-5 提案的 1.60），安全。
 *
 * ⚠ 985 超线档（1.42 × SCORE_K 封顶 1.10 = 1.562）考研仍无收益 ——
 *   高分生直接工作更优，这是设计意图，但 UI 必须提示当前 salaryK，否则玩家白扔两年（E-13）。
 *
 * ⚠ 历史坑：这个值曾有两套（school.js 用 1.4、engine.js 用 1.45），
 *   985 生走不同路径结果差 2.1%。现在只剩这一个常量。 */
const KAOYAN_FLOOR = 1.45;

/* ---------------- S-01 压力棘轮 · 调参入口 ----------------
 * 三件套：① 恢复公式「固定 → 固定 + 比例（带失控阻尼）」② 风险选项不对称化 ③ 成年期减压行动。
 * 三条必须成套上 —— 单独上任何一条都救不回激进流（数学依据见 stress-respec.md §2）。
 *
 * 用对象而不是散常量，是为了让调参可扫：STRESS_TUNE.DAMP_Q = x 可直接改，
 * 不必动代码。若哪天要固定下来，把 DAMP_Q 换成字面量即可。 */
const STRESS_TUNE = {
  /* ① 恢复公式：s.STRESS -= FLAT + s.STRESS * K + max(0, s.STRESS - T) * Q
   * 稳态 S* = (I - FLAT) / (K + Q·(1 - T/S*))；阈值 T 以下与今天逐点相同。 */
  RECOVER_FLAT: 7,     // 固定恢复项，与今天一致（不变）
  RECOVER_K: 0.12,     // 比例恢复项。方案 A 的 0.20 已被否决：会把正常玩家 S* 从 50 削到 30
  DAMP_T: 70,          // 阻尼阈值。低于此值逐点不变，只压失控尾巴
  DAMP_Q: 0.25         // 阻尼系数。拟合式 q = clamp((I_P75 - 34)/30, 0, 0.35)，暂定值待实测标定
                       //   （v1.3 §3.7.3：改用 P75 而非 P90 —— P90 要求 90% 存活，会把熄灭率压到
                       //     ~0.10，亡命流被一起压平，画像分化在拟合阶段就消失）
};

/* ② 风险选项不对称化（engine.js eventChoices 的 risk3）。
 * 只作用于 risk3 —— scaleEff 另有两处调用点（保守 0.6/0.45、中间 1/1），
 * 它们各自带字面量系数，不受这两个常量影响。 */
const RISK_TUNE = {
  GAIN_K: 2.4,         // 原 1.7：让「豁出去」的收益足够大，值得为之承压
  LOSS_K: 1.15,        // 原 1.35：减益只轻微放大（惩罚仍在但不致命）
  STRESS_ADD: 4        // 原 4，**不变**。它不在 scaleEff 管辖内（Object.assign 后写覆盖），
                       //   gainK / lossK 都碰不到它。若改成经 scaleEff 计算必须显式保持 +4
};

/* 年代金额缩放：1955 年 的 1 块钱比 2005 年 值钱得多 */
const FIN_SCALE = [
  [1955, 0.10], [1965, 0.18], [1975, 0.42], [1985, 1.00],
  [1995, 1.85], [2005, 2.70], [2015, 3.40], [2025, 4.20], [2060, 5.00]
];

/* ---------------- 核心属性（面板只露这 6 项，其余折叠进「更多」） ---------------- */
const CORE_STATS = [
  { key: 'HP', name: '健康', hint: '归零即人生结束', warn: v => v < 30 },
  { key: 'MOOD', name: '心情', hint: '长期低落会拖垮身体', warn: v => v < 35 },
  { key: 'INT', name: '智力', hint: '考试、谋略、学习速度' },
  { key: 'CHA', name: '魅力', hint: '人脉、恋爱、影响力' },
  { key: 'WILL', name: '意志', hint: '抗压与低谷反弹' },
  { key: 'ETH', name: '道德', hint: '你的底线，也是别人看你的眼神', warn: v => v < 30 }
];

/* 次要属性：默认折叠，点「＋更多」展开 */
const MORE_STATS = [
  { key: 'STRESS', name: '压力', hint: '过高会持续损伤健康', warn: v => v > 60 },
  { key: 'STR', name: '体魄' }, { key: 'NET', name: '人脉' },
  { key: 'FAME', name: '声望' }, { key: 'LOY', name: '口碑' },
  { key: 'LOVE', name: '关爱' }, { key: 'SEC', name: '安全' },
  { key: 'CUR', name: '好奇' }, { key: 'AUTO', name: '自主' },
  { key: 'GROW', name: '成长' }
];

/* ---------------- 疾病系统 ----------------
 * 健康过低会强制触发；不治疗会逐年恶化（1 轻 → 4 危），到危重时可能直接带走这一生。
 * sev 决定基础伤害与治疗难度；chronic 慢性病不会自己好。
 */
const ILLNESS = [
  { id: 'cold', name: '重感冒转肺炎', minAge: 1, sev: 1, hp: 6, chronic: false,
    desc: '发烧到三十九度，嗓子像吞了碎玻璃。你以为扛两天就过去了。' },
  { id: 'gastritis', name: '胃溃疡', minAge: 16, sev: 1, hp: 5, chronic: true,
    desc: '空腹、加班、白酒。胃开始用疼的方式提醒你。' },
  { id: 'fracture', name: '骨折', minAge: 6, sev: 2, hp: 8, chronic: false,
    desc: '一声脆响之后你躺在地上，先是没感觉，然后全来了。' },
  { id: 'hepatitis', name: '肝炎', minAge: 12, sev: 2, hp: 9, chronic: true,
    desc: '脸色发黄，浑身没劲。医生说：这个病，最怕拖。' },
  { id: 'depress', name: '抑郁症', minAge: 14, sev: 2, hp: 7, chronic: true,
    desc: '你还是每天起床、出门、笑。只是没有任何一件事能让心里亮一下。' },
  { id: 'hbp', name: '高血压 · 糖尿病', minAge: 38, sev: 2, hp: 7, chronic: true,
    desc: '体检报告上多了几个向下的箭头。医生说：这个药要吃一辈子。' },
  { id: 'heart', name: '心脏病', minAge: 45, sev: 3, hp: 12, chronic: true,
    desc: '胸口像被人攥住。你扶着墙站了很久，才敢呼吸。' },
  { id: 'stroke', name: '中风', minAge: 55, sev: 3, hp: 14, chronic: true,
    desc: '半边身子突然不听使唤，杯子在手里碎了。' },
  { id: 'cancer', name: '肿瘤', minAge: 40, sev: 3, hp: 16, chronic: true,
    desc: '报告单上那个字，你看了三遍才认出来。' }
];

/* ---------------- 父母的年度行为：家里也在过日子 ----------------
 * fin: 对家庭账簿的增减（还会再乘年代缩放）  stat: 对主角的影响
 */
const FAMILY_ACTS = [
  { id: 'f_ot', w: 12, text: '父亲这个月加了二十七天班，工资条上多了一笔加班费。', fin: { assets: 4000000 }, stat: { SEC: 1 } },
  { id: 'f_side', w: 10, text: '母亲接了份零活，晚上在灯下缝到很晚。', fin: { assets: 2800000 }, stat: { LOVE: 1, MOOD: -1 } },
  { id: 'f_bonus', w: 8, text: '父亲单位发了奖金，家里那个月吃了三次肉。', fin: { assets: 6000000 }, stat: { MOOD: 2 } },
  { id: 'f_tv', w: 7, text: '家里添了一台彩电，整条胡同的小孩都挤进来看。', fin: { assets: -3000000 }, stat: { MOOD: 3, CHA: 1 } },
  { id: 'f_borrow', w: 8, text: '亲戚上门借钱，母亲把柜子里的存折翻了出来。', fin: { debt: 5000000 }, stat: { STRESS: 3 } },
  { id: 'f_sick', w: 8, text: '母亲住院了。她躺在病床上还在问你吃了没有。', fin: { assets: -7000000 }, stat: { MOOD: -3, STRESS: 4, LOVE: 1 } },
  { id: 'f_layoff', w: 5, text: '厂门口贴了名单，父亲的名字在上面。那天家里很安静。', fin: { debt: 9000000 }, stat: { SEC: -3, WILL: 2, MOOD: -3 }, flag: 'parents_jobless' },
  { id: 'f_stock', w: 5, text: '父亲跟着同事炒股，赔进去半年工资。', fin: { assets: -9000000 }, stat: { MOOD: -2 } },
  { id: 'f_repay', w: 9, text: '家里咬牙还掉了一笔债。母亲说：总算少块石头。', fin: { debt: -6000000 }, stat: { SEC: 2 } },
  { id: 'f_harvest', w: 7, text: '这一年收成／生意不错，家里第一次有余钱。', fin: { assets: 8000000 }, stat: { MOOD: 2 } },
  { id: 'f_quarrel', w: 8, text: '半夜父母的争吵声穿过薄墙。你假装睡着了。', fin: {}, stat: { MOOD: -4, STRESS: 4, SEC: -3 } },
  { id: 'f_scam', w: 4, text: '家里被人骗去一笔钱。父亲坐在门口抽了一整包烟。', fin: { assets: -12000000 }, stat: { MOOD: -3, SEC: -3 } },
  { id: 'f_demolish', w: 2, text: '老房子要拆迁了。家里人第一次在饭桌上谈论「几百万」。', fin: { assets: 60000000, debt: -10000000 }, stat: { MOOD: 5, SEC: 5 } },
  { id: 'f_pocket', w: 9, text: '母亲往你包里塞了钱，用塑料袋包了三层。', fin: { assets: -2500000 }, stat: { MONEY: 2500000, LOVE: 3 } },
  { id: 'f_wedding', w: 6, text: '家里亲戚结婚，随礼随掉半个月工资。', fin: { assets: -3500000 }, stat: { NET: 1 } },
  { id: 'f_move', w: 5, text: '家里搬了一次。新家离学校更远，但窗户朝南。', fin: { assets: -5000000 }, stat: { MOOD: 1, CUR: 2 } },
  { id: 'f_pride', w: 7, text: '父亲在单位受了气，回家一句话没说，只是多喝了两杯。', fin: {}, stat: { MOOD: -2, STRESS: 2 } },
  { id: 'f_grand', w: 6, text: '老家的老人病了，家里开始往老家寄钱。', fin: { assets: -6000000 }, stat: { LOVE: 1, STRESS: 2 } }
];

/* 父母职业（按出身给一个说得通的行当） */
const PARENT_JOBS = {
  F: { poor: '打零工', rural: '务农', town: '工厂工人', city: '临时工', prof: '中学老师',
       business: '跑生意', stable: '单位职工', shop: '看店', default: '工人' },
  M: { poor: '帮工', rural: '务农', town: '食堂帮工', city: '保洁', prof: '医生',
       business: '管账', stable: '单位职工', shop: '看店', default: '工人' }
};

/* ---------------- 成就：达成即弹徽章，结局页汇总 ---------------- */
const ACHIEVEMENTS = [
  { id: 'a_full', icon: '💯', name: '满分', desc: '中考或高考拿到真正的满分',
    cond: s => s.edu && (s.edu.mid === 400 || s.edu.gao === 700) },
  { id: 'a_985', icon: '🎓', name: '金榜题名', desc: '考上 985 重点大学',
    cond: s => !!(s.flags && s.flags.uni_985) },
  { id: 'a_job', icon: '💼', name: '第一份工', desc: '拿到了人生第一份正式工作',
    cond: s => !!s.career },
  { id: 'a_boss', icon: '👔', name: '爬到顶', desc: '在同一条职业阶梯上做到最高职级',
    cond: s => !!s.career && (typeof careerById === 'function') &&
      !!careerById(s.career.id) && s.career.level >= careerById(s.career.id).ladder.length - 1 },
  { id: 'a_house', icon: '🏠', name: '有瓦遮头', desc: '名下有了第一套房',
    cond: s => !!(s.flags && s.flags.own_house) },
  { id: 'a_car', icon: '🚗', name: '四个轮子', desc: '买了第一辆车',
    cond: s => !!(s.flags && s.flags.own_car) },
  { id: 'a_marry', icon: '💍', name: '成家', desc: '和一个人领了证',
    cond: s => !!(s.flags && s.flags.married) },
  { id: 'a_divorce', icon: '💔', name: '一别两宽', desc: '离了一次婚',
    cond: s => !!(s.flags && s.flags.divorced) },
  { id: 'a_child', icon: '👶', name: '为人父母', desc: '有了第一个孩子',
    cond: s => (s.childCount || 0) >= 1 },
  { id: 'a_grand', icon: '👴', name: '抱上孙辈', desc: '家里添了第三代',
    cond: s => (s.grandCount || 0) >= 1 },
  { id: 'a_million', icon: '💰', name: '第一个一百万', desc: '净资产突破 100 万',
    cond: s => (typeof netWorth === 'function' ? netWorth(s) : (s.stats ? s.stats.MONEY : 0)) >= 180000000 },
  { id: 'a_rich', icon: '🏦', name: '财务自由', desc: '净资产突破 1 亿',
    cond: s => (typeof netWorth === 'function' ? netWorth(s) : (s.stats ? s.stats.MONEY : 0)) >= 18000000000 },
  { id: 'a_stock', icon: '📈', name: '老股民', desc: '在股市里赚到过一倍以上',
    cond: s => !!(s.flags && s.flags.stock_win) },
  { id: 'a_pet', icon: '🐶', name: '铲屎官', desc: '养过一只猫或狗',
    cond: s => !!s.pet },
  { id: 'a_travel', icon: '🧳', name: '出过远门', desc: '有过一次间隔年或长期远行',
    cond: s => !!(s.flags && s.flags.gap_year) },
  { id: 'a_survive', icon: '🩺', name: '从鬼门关回来', desc: '熬过了一场重病',
    cond: s => !!(s.flags && s.flags.ill_survived) },
  { id: 'a_century', icon: '🎂', name: '长命百岁', desc: '活到了 100 岁',
    cond: s => s.age >= 100 },
  { id: 'a_lucky', icon: '🎟', name: '天选之子', desc: '中过一次彩票头奖',
    cond: s => !!(s.flags && s.flags.lottery_jackpot) }
];

/* ---------------- 彩票：一年一张，纯运气 ---------------- */
const LOTTERY = {
  cost: 400000,
  prizes: [
    { p: 0.600, k: 0, name: '谢谢参与' },
    { p: 0.240, k: 0.5, name: '五元小奖' },
    { p: 0.110, k: 2, name: '二十元' },
    { p: 0.040, k: 10, name: '两百元' },
    { p: 0.008, k: 200, name: '二等奖' },
    { p: 0.001, k: 6000, name: '头奖', jackpot: true }
  ]
};

/* ---------------- 事件库 ----------------
 * cond: {ageMin,ageMax,gender:'M'/'F',need:[flags],ban:[flags],min:{stat},max:{stat},job:[...]}
 * eff : {STAT:delta, flags:[...], job:'...', edu:'...'}
 * choice: {text, eff:{...}, flags:[...]}
 */
const EVENTS = [
  /* ===== 幼儿 0-6 ===== */
  { id: 'c01', age: [0, 3], w: 10, text: '你出生在这座城的冬天。母亲抱着你，窗外是江对岸尚未点亮的江南。',
    eff: { HP: 2 }, flags: [] },
  { id: 'c02', age: [0, 4], w: 8, text: '城中村隔断间的雨季。墙纸鼓起又脱落，你第一次知道「这座城」有两种：地上的和地下的。',
    cond: { need: ['poor'] }, eff: { WILL: 2, INT: 1 } },
  { id: 'c03', age: [1, 5], w: 7, text: '隔壁姐姐教你念韩文字母。你学得很快，母亲在灯下笑出了眼泪。', eff: { INT: 3, CHA: 1 } },
  { id: 'c04', age: [2, 6], w: 7, text: '你在旧书摊捡到一本破旧的《世界地图册》，翻到「这座城」那一页，用蜡笔画了一个圈。', eff: { INT: 2, WILL: 1 } },
  { id: 'c05', age: [2, 6], w: 6, text: '父亲喝醉回家，把桌子掀翻。你躲在衣柜里，学会了屏住呼吸。',
    cond: { ban: ['single', 'orphan'] }, eff: { WILL: 3, STRESS: 6 } },
  { id: 'c06', age: [3, 6], w: 6, text: '教会发来一箱旧衣服。你穿着不合身的外套去幼儿园，被笑了整整一年。',
    cond: { need: ['poor'] }, eff: { CHA: -2, WILL: 2 } },
  { id: 'c07', age: [1, 6], w: 5, text: '你发高烧到 40 度，母亲背着你跑了三家医院。活下来之后，你的身体似乎更强了。', eff: { HP: 5, WILL: 2 } },
  { id: 'c08', age: [3, 6], w: 5, text: '母亲在你耳边反复说一句话：「, .」再穷，你也得活出个人样。', eff: { WILL: 4 } },
  { id: 'c09', age: [0, 2], w: 4, text: '前世的记忆在午夜涌来：冰冷的江水，和一双擦得发亮的皮鞋。你哭醒了。',
    cond: { need: ['past_life'] }, eff: { INT: 3, WILL: 2, STRESS: 4 } },
  { id: 'c10', age: [4, 6], w: 5, text: '你在纸上画了一栋很高的楼，指着它说：这以后是我的。大人笑作一团。', eff: { WILL: 2, FAME: 1 } },

  /* ===== 小学 7-12 ===== */
  { id: 'p01', age: [7, 12], w: 9, text: '小学入学。老师的名牌上写着「家长职业」一栏，你在上面填了「公司职员」。', eff: { INT: 2 } },
  { id: 'p02', age: [7, 12], w: 8, text: '班里的富家子带了一台 Game Boy。你只远远看过一眼，但记住了它的电路板结构。', eff: { INT: 2, STRESS: 2 } },
  { id: 'p03', age: [8, 12], w: 8, text: '你考了年级第一。母亲把成绩单贴在墙上，那一刻比过年还亮。', eff: { INT: 4, FAME: 2 } },
  { id: 'p04', age: [8, 12], w: 7, text: '补习班。母亲把最后的钱交给了学区的数学学院。', cond: { min: { MONEY: 500000 } },
    eff: { INT: 5, MONEY: -600000 } },
  { id: 'p05', age: [8, 12], w: 7, text: '学区的学院太贵了。你在图书馆自学到闭馆，路灯下背单词。', cond: { max: { MONEY: 500000 } },
    eff: { INT: 4, WILL: 3, HP: -2 } },
  { id: 'p06', age: [9, 12], w: 6, text: '你在操场上被富家子推倒，爬起来把他的鼻子打出了血。第一次明白：道理是讲给有地位的人听的。',
    cond: { min: { STR: 15 } }, eff: { STR: 3, CHA: -2, WILL: 3, STRESS: 4 } },
  { id: 'p07', age: [9, 12], w: 6, text: '你成了班里最会讲故事的人。孩子们围着你，连那个富家子也凑过来。',
    cond: { min: { CHA: 15 } }, eff: { CHA: 3, NET: 3 } },
  { id: 'p08', age: [10, 12], w: 6, text: '父亲失业了。家里的晚饭从三菜一汤变成了咸菜和米饭。你开始去便利店打工。', eff: { WILL: 5, MONEY: 300000, STRESS: 5 } },
  { id: 'p09', age: [10, 12], w: 5, text: '第一次坐地铁穿过江。对岸的公寓灯火通明，你说不出话。', eff: { WILL: 3, INT: 1 } },
  { id: 'p10', age: [11, 12], w: 5, text: '你在作文里写《我的梦想》：我要在江南最高的楼上，看这座城的夜景。老师给了满分。', eff: { INT: 2, FAME: 2, WILL: 2 } },

  /* ===== 中学 13-15 ===== */
  { id: 'm01', age: [13, 15], w: 9, text: '中学。青春期，贫穷第一次变成一种刺在皮肤上的东西。', eff: { STRESS: 4 } },
  { id: 'm02', age: [13, 15], w: 8, text: '你爱上了隔壁班的女孩。你在她课桌里塞了一封没署名的信，然后转学去了别的补习班。', eff: { CHA: 2, INT: -1, WILL: 1 } },
  { id: 'm03', age: [13, 15], w: 8, text: '你在网吧第一次接触到互联网。那一刻你听见了时代转动的声音。', eff: { INT: 4 }, flags: ['net_gen'] },
  { id: 'm04', age: [13, 15], w: 7, text: '你加入了学校的棒球队。汗水是最便宜的解药。', cond: { min: { STR: 20 } }, eff: { STR: 5, HP: 4 } },
  { id: 'm05', age: [14, 15], w: 7, text: '你偷了一本《股票投资入门》。看不懂，但你记住了两个字：复利。', eff: { INT: 3 }, flags: ['stock_interest'] },
  { id: 'm06', age: [13, 15], w: 6, text: '校园霸凌。你被拉进厕所，交出了一周的饭钱。你记住了他们的名字。', cond: { ban: ['lucky'] }, eff: { WILL: 4, STRESS: 8, HP: -3 } },
  { id: 'm07', age: [14, 15], w: 6, text: '你考进了「特目高」的预备班。母亲去学校门口给老师鞠躬。', cond: { min: { INT: 35 } }, eff: { INT: 4, FAME: 3 } },
  { id: 'm08', age: [14, 15], w: 5, text: '你在旧货市场淘到一台 486 电脑，整夜研究 DOS。', cond: { need: ['coder'] }, eff: { INT: 5, STR: -2 }, flags: ['coder'] },

  /* ===== 高中 16-19 ===== */
  { id: 'h01', age: [16, 17], w: 9, text: '高中。最有意思也最累的三年开始了——晚自习的灯亮到十点半。', eff: { STRESS: 6 } },
  { id: 'h02', age: [16, 18], w: 8, text: '你在自习室待到凌晨两点。走廊的灯灭了，你借着应急灯背书。', eff: { INT: 5, HP: -4, STRESS: 5 } },
  { id: 'h03', age: [16, 18], w: 7, text: '你和几个同学组了乐队，在大学城的地下 Live House 演出。台下只有七个人，但他们在鼓掌。',
    cond: { need: ['music'] }, eff: { CHA: 4, FAME: 3 } },
  { id: 'h04', age: [17, 19], w: 9, text: '高考日。考点外站满了家长，旗袍与向日葵挤了一路。你走出考场时，手在抖。',
    cond: { min: { INT: 45 } }, eff: {}, flags: ['suneung_good'] },
  { id: 'h05', age: [17, 19], w: 8, text: '高考 失利。你在江边坐了一整夜，江水很冷，但你没有跳下去。',
    cond: { max: { INT: 45 } }, eff: { WILL: 5, STRESS: 10 } },
  { id: 'h06', age: [17, 19], w: 6, text: '你拿到了顶尖大学的录取通知书。整个巷子都知道了，父亲把它复印了五份分给亲戚。',
    cond: { need: ['suneung_good'], min: { INT: 55 } }, eff: { INT: 4, FAME: 8, NET: 5 }, flags: ['sky'], job: '大学生' },
  { id: 'h07', age: [17, 19], w: 6, text: '你进了地方大学。学费是母亲借来的，但你发誓不会浪费。',
    cond: { ban: ['sky'] }, eff: { INT: 2, NET: 2 }, job: '大学生' },
  { id: 'h08', age: [17, 19], w: 5, text: '你放弃了大学，去工厂上班。流水线上的噪音盖过了所有关于未来的想象。',
    cond: { max: { MONEY: 1000000 } }, eff: { STR: 5, MONEY: 1200000, WILL: 3, INT: -3 }, job: '工厂工人' },
  { id: 'h09', age: [18, 19], w: 5, text: '你在便利店打夜班，遇到一个醉醺醺的大叔。他是一家大公司的部长，说了一句你记了一辈子的话。',
    eff: { NET: 4, WILL: 2 }, flags: ['met_mentor'] },

  /* ===== 早恋 · 中学与高中 13-18 ===== */
  { id: 'hl1', age: [14, 18], w: 7, t: 'love', text: '同桌每天多带一份早餐放在你抽屉里。全班都看出来了，只有老师没看出来。',
    eff: { LOVE: 5, CHA: 2, STRESS: -3 }, flags: ['in_love'] },
  { id: 'hl2', age: [15, 18], w: 6, t: 'love', text: '晚自习传纸条被班主任截获。她当着全班念了半句就停了，你的脸一直烧到脖子根。',
    cond: { need: ['in_love'] }, eff: { STRESS: 8, WILL: 2, FAME: -2 } },
  { id: 'hl3', age: [14, 18], w: 6, t: 'love', text: '运动会的接力赛，TA 在终点线递给你一瓶水。看台上有人起哄，你没敢抬头。',
    eff: { LOVE: 4, STR: 2, MOOD: 4 }, flags: ['in_love'] },
  { id: 'hl4', age: [15, 18], w: 5, t: 'love', text: '你们在天台上约定：考同一座城市的大学。那晚的晚霞你记到现在。',
    cond: { need: ['in_love'] }, eff: { WILL: 6, INT: 3, LOVE: 4 } },
  { id: 'hl5', age: [13, 16], w: 5, t: 'love', text: '你在她课桌里塞了人生第一封情书。第二天她回了一封，比你写得更长。',
    eff: { LOVE: 6, CHA: 2, STRESS: 3 }, flags: ['in_love'] },
  { id: 'hl6', age: [14, 18], w: 5, t: 'love', text: '家长被请到了学校。回家的路上谁都没说话，父亲最后只说了一句：别耽误前程。',
    cond: { need: ['in_love'] }, eff: { STRESS: 7, SEC: -3, WILL: 3 } },
  { id: 'hl7', age: [15, 18], w: 4, t: 'love', text: '雨天只有一把伞。你们肩并肩走了四站地，谁也没有伞往那边挪一点。',
    eff: { LOVE: 5, MOOD: 5, HP: -1 }, flags: ['in_love'] },
  { id: 'hl8', age: [14, 18], w: 4, t: 'love', text: 'TA 中途转学了。你在 TA 旧课本的夹层里发现一张字条，写着你的名字。',
    cond: { need: ['in_love'] }, eff: { LOVE: -6, WILL: 2, MOOD: -5 } },

  /* ===== 大学 / 参军 19-24 ===== */
  { id: 'u01', age: [19, 23], w: 9, text: '大学。你第一次和江南出身的同学坐在同一间教室里，听懂了什么叫「差距」。', cond: { job: ['大学生'] }, eff: { INT: 3, NET: 3 } },
  { id: 'u02', age: [19, 23], w: 7, text: '你加入了投资社团，第一次买入股票——然后亏掉了一半。', cond: { need: ['stock_interest'] }, eff: { INT: 3, MONEY: -500000 } },
  { id: 'u03', age: [19, 23], w: 7, text: '你在自习室认识了一个家住 滨江的同学。他随手借你的两万块，够你吃一个月。', cond: { min: { CHA: 30 } }, eff: { NET: 8, CHA: 2 } },
  { id: 'u04', age: [19, 23], w: 6, text: '你拿到了美国大学的交换名额。机场里，母亲塞给你一袋咸菜。', cond: { min: { INT: 60 } }, eff: { INT: 5, CHA: 3, FAME: 4 }, flags: ['exchange'] },
  { id: 'u05', age: [20, 24], w: 9, text: '参军通知书来了。两年，是你欠这个国家的。', cond: { gender: 'M', ban: ['no_military'] }, eff: { STR: 4, WILL: 3, HP: 3 }, flags: ['military'], job: '军人' },
  { id: 'u06', age: [20, 24], w: 7, text: '部队里你学会了两件事：服从，以及观察谁在真正发号施令。', cond: { need: ['military'] }, eff: { STR: 3, WILL: 3, NET: 3 } },
  { id: 'u07', age: [20, 24], w: 6, text: '你在部队考上了「部队考学」，美军基地里的英语让你的世界大了一圈。', cond: { need: ['military'], min: { INT: 55 } }, eff: { INT: 4, CHA: 3, NET: 5 } },
  { id: 'u08', age: [20, 24], w: 5, text: '免役。你比同龄人多了两年，但少了军营里的人脉。', cond: { need: ['no_military'] }, eff: { INT: 3, WILL: 2 } },
  { id: 'u09', age: [21, 24], w: 6, text: '你在大学创业社团做的小程序，被一家小公司用 3000 万元买走。',
    cond: { need: ['coder'] }, eff: { MONEY: 30000000, FAME: 5, INT: 3 }, flags: ['first_exit'] },

  /* ===== 社会初期 23-32 ===== */
  { id: 's01', age: [23, 32], w: 9, text: '求职季。你穿上人生第一套西装，在金融街的招聘会上排了四个小时。', eff: { STRESS: 6 } },
  { id: 's02', age: [23, 32], w: 8, text: '你通过了一家大公司的公开招聘。入职那天，你在大厅的集团标志前站了很久。',
    cond: { min: { INT: 50 } }, eff: { MONEY: 35000000, NET: 6, LOY: 10 }, job: '大企业职员', flags: ['bigco_staff'] },
  { id: 's03', age: [23, 32], w: 7, text: '你进了一家中小企业。加班到十一点是常态，团建聚餐是必修课。', eff: { MONEY: 26000000, STR: -3, STRESS: 7 }, job: '公司职员' },
  { id: 's04', age: [23, 32], w: 6, text: '你考上了公务员。母亲在电话那头哭了。', cond: { min: { INT: 60 } }, eff: { MONEY: 24000000, NET: 6, FAME: 4 }, job: '公务员' },
  { id: 's05', age: [24, 32], w: 7, text: '江南的房价每天都在涨。中介说：再不买就永远买不起了。', eff: { STRESS: 5 }, flags: ['house_pressure'] },
  { id: 's06', age: [24, 32], w: 6, text: '你在滨江的酒桌上替上司挡了一杯酒。从此他记得你的名字。', cond: { min: { CHA: 40 } }, eff: { NET: 8, LOY: 5, HP: -3 } },
  { id: 's07', age: [25, 32], w: 6, text: '你和相恋三年的女友分手了。她说：你什么都好，就是没有「房子」。', eff: { STRESS: 10, WILL: 4 } },
  { id: 's08', age: [25, 32], w: 5, text: '你结婚了。婚礼在江南的小型礼堂，礼金刚好够付半年的房租。', cond: { min: { CHA: 35 } }, eff: { WILL: 4, NET: 5, MONEY: 5000000 }, flags: ['married'] },
  { id: 's09', age: [24, 30], w: 6, text: '你被派到中国的分公司。两年的海外经历，换来了别人没有的视野。', cond: { need: ['bigco_staff'] }, eff: { INT: 5, NET: 8, LOY: 6 } },
  { id: 's10', age: [26, 33], w: 6, text: '部门结构调整，你被列入「优化 名誉退职」名单。三十岁，你第一次失业。',
    cond: { ban: ['lucky'] }, eff: { MONEY: 20000000, STRESS: 12, WILL: 4 }, job: '无业' },
  { id: 's11', age: [26, 34], w: 6, text: '你在酒吧街开了第一家店：一间只有八平米的咖啡馆。', cond: { min: { MONEY: 30000000 } }, eff: { MONEY: -30000000, NET: 6, CHA: 4 }, job: '个体户', flags: ['own_shop'] },
  { id: 's12', age: [27, 35], w: 6, text: '你辞职创业。办公室在九老区的数字园，六个工位，四个人。',
    cond: { min: { WILL: 40, INT: 50 } }, eff: { MONEY: -20000000, WILL: 5, STRESS: 10 }, job: '创业者', flags: ['startup'] },

  /* ===== 经济事件（时代） ===== */
  { id: 'e1997', age: [8, 60], w: 12, once: true, era: true, text: '1997 年，亚洲金融风暴。周边国家的货币一个接一个崩，出口订单说没就没。工厂开始裁员，下岗的名单贴在公告栏上。',
    cond: { yearMin: 1997, yearMax: 1998 },
    eff: { WILL: 6, STRESS: 10, MONEY: -2000000 }, flags: ['imf'], log: '亚洲金融风暴：出口断崖，国企改制，下岗潮开始。' },
  { id: 'e1998gold', age: [9, 70], w: 8, once: true, era: true, text: '全民献金运动。人们把金首饰放进街头的募捐箱，有人说：国家也是家。',
    cond: { need: ['imf'], yearMin: 1998, yearMax: 1999 }, eff: { WILL: 4, FAME: 2 } },
  { id: 'e2002', age: [10, 70], w: 8, once: true, era: true, text: '2002 世界杯。整个韩国变成了红色的海。你在光化门前和几十万人一起喊「中国」。',
    cond: { yearMin: 2002, yearMax: 2003 },
    eff: { WILL: 3, CHA: 2, STRESS: -8 } },
  { id: 'e2008', age: [16, 75], w: 11, once: true, era: true, text: '2008 金融海啸。大盘 单日暴跌，办公室里没有人说话。有人在楼下抽烟，抽完就上楼辞职了。',
    cond: { yearMin: 2008, yearMax: 2009 },
    eff: { STRESS: 8, WILL: 3 }, flags: ['crisis2008'], log: '2008 金融危机：资产大幅缩水，但也是抄底之年。' },
  { id: 'e2012gangnam', age: [14, 70], w: 8, once: true, era: true, text: '《江南 Style》火遍全球。全世界的综艺都在跳骑马舞，而江南的房价又涨了一倍。',
    cond: { yearMin: 2012, yearMax: 2013 },
    eff: { FAME: 2 }, flags: ['kpop_boom'] },
  { id: 'e2020', age: [10, 75], w: 10, once: true, era: true, text: '2020 疫情。股市熔断，但流动性洪水随后而来。有人破产，有人在一年里赚到了一辈子的钱。',
    cond: { yearMin: 2020, yearMax: 2021 },
    eff: { STRESS: 6 }, flags: ['covid'], log: '2020 疫情冲击：资产剧烈波动，机会与风险同在。' },

  /* ===== 事业期 30-45 ===== */
  { id: 'b01', age: [30, 45], w: 9, text: '你的公司拿到了第一轮投资。投资人在合同上签字那一刻，你的手是凉的。',
    cond: { need: ['startup'] }, eff: { MONEY: 500000000, FAME: 10, NET: 8 } },
  { id: 'b02', age: [30, 45], w: 7, text: '你被一家大公司挖角，成为战略室的次长。你终于走进了那栋楼的顶层。',
    cond: { min: { INT: 70 } }, eff: { MONEY: 120000000, LOY: 20, NET: 10, FAME: 8 }, job: '大公司战略次长', flags: ['bigco_core'] },
  { id: 'b03', age: [30, 45], w: 7, text: '你在江南买下了第一套属于自己的公寓。签约那天，你在空房子里坐到天黑。',
    cond: { min: { MONEY: 800000000 } }, eff: { MONEY: -800000000, WILL: 6, CHA: 4, FAME: 5 }, flags: ['gangnam_owner'] },
  { id: 'b04', age: [32, 45], w: 6, text: '你的公司被大企业以极低的价格强行收购。你明白了：在这里，做大就会被吃掉。',
    cond: { need: ['startup'], ban: ['lucky'] }, eff: { MONEY: 300000000, STRESS: 14, WILL: 5 } },
  { id: 'b05', age: [32, 46], w: 6, text: '你出版了自传《市中心》。签售会排了三百人。',
    cond: { min: { FAME: 40 } }, eff: { FAME: 15, MONEY: 150000000 } },
  { id: 'b06', age: [33, 45], w: 6, text: '体检报告上写着「过劳」和三个红色箭头。医生说：你再这样会死。', eff: { HP: -8, STRESS: 10 } },
  { id: 'b07', age: [34, 48], w: 6, text: '你在海岛休假两周。海风吹过来的时候，你第一次觉得活着是件好事。', eff: { HP: 8, STRESS: -15 } },
  { id: 'b08', age: [35, 46], w: 6, text: '你成立了基金，开始做真正的资本运作。钱第一次开始为你工作。',
    cond: { min: { MONEY: 3000000000, INT: 70 } }, eff: { MONEY: 500000000, NET: 12, FAME: 10 }, flags: ['fund'] },
  { id: 'b09', age: [33, 45], w: 5, text: '检察机关上门调查。你坐在审讯室里，第一次看清了这个国家真正的权力结构。',
    cond: { min: { FAME: 30 } }, eff: { STRESS: 12, WILL: 4, NET: 5 }, flags: ['probed'] },

  /* ===== 大企业线 36-60 ===== */
  { id: 't01', age: [36, 60], w: 10, text: '董事长召见你。老人的手指敲着桌面：「我听说过你。你很像年轻时的我。」',
    cond: { min: { LOY: 30, FAME: 30 } }, eff: { LOY: 15, NET: 10 }, flags: ['bigco_inner'] },
  { id: 't02', age: [36, 60], w: 9, text: '公司高层的斗争开始了。保守派元老、实干派专务、以及一位空降的太子党，三方都在拉拢你。',
    cond: { need: ['bigco_inner'] }, eff: {}, flags: ['war_start'],
    choices: [
      { text: '站在元老一边（稳，但天花板低）', eff: { LOY: 12, NET: 8, WILL: -3 }, flags: ['side_elder'] },
      { text: '站在实干派专务一边（她的眼光最准）', eff: { LOY: 14, INT: 4, NET: 10 }, flags: ['side_second'] },
      { text: '谁也不站，做自己的局', eff: { WILL: 8, STRESS: 10, INT: 5 }, flags: ['side_self'] }
    ] },
  { id: 't04', age: [38, 60], w: 8, text: '你注意到一家老牌上市集团被严重低估。你开始在市场里悄悄吸纳它的流通股。3%，5%，7.4%……每一次都踩在披露线以下。',
    cond: { min: { MONEY: 5000000000 } }, eff: { MONEY: -2000000000, INT: 5, STRESS: 8 }, flags: ['buying_stake'] },
  { id: 't05', age: [38, 62], w: 7, text: '股东大会那天，你走进会场。闪光灯亮起的瞬间，你想起了很多年前那间城中村隔断间的窗。',
    cond: { need: ['buying_stake'] }, eff: { FAME: 25, LOY: -20, WILL: 8 }, flags: ['showdown'] },
  { id: 't06', age: [40, 62], w: 7, text: '一场突如其来的税务调查。你的对手比你想象的更不体面。',
    cond: { min: { FAME: 60 } }, eff: { STRESS: 14, MONEY: -300000000, WILL: 5 }, flags: ['tax_raid'] },
  { id: 't07', age: [40, 62], w: 6, text: '你成了大公司的副董事长。江对岸的灯，终于有一盏是你点亮的。',
    cond: { need: ['side_second'], min: { LOY: 70 } }, eff: { MONEY: 2000000000, FAME: 20, LOY: 10 }, job: '大公司副董事长' },

  /* ===== 通用 / 随机小事件 ===== */
  { id: 'r01', age: [20, 60], w: 6, text: '你在地铁里给一位老人让座。他递给你一张名片——那是你此后十年最重要的一通电话。',
    cond: { need: ['lucky'] }, eff: { NET: 12, CHA: 3 } },
  { id: 'r02', age: [22, 55], w: 5, text: '朋友拉你入伙一个「稳赚」的项目。你嗅到了骗局的味道。', eff: {},
    choices: [
      { text: '投进去（万一呢）', eff: { MONEY: -8000000, STRESS: 6, INT: 2 } },
      { text: '拒绝，并拉黑他', eff: { INT: 3, WILL: 2, NET: -3 } }
    ] },
  { id: 'r03', age: [25, 55], w: 5, text: '你连续三个月每天只睡四小时。身体开始抗议。', eff: { HP: -6, STRESS: 8 } },
  { id: 'r04', age: [25, 55], w: 5, text: '你开始跑步。清晨六点的江公园，跑着跑着就想通了很多事。', eff: { HP: 8, STR: 3, STRESS: -8 } },
  { id: 'r05', age: [26, 50], w: 5, text: '你参加了一场婚礼，认识了某个人。命运有时候就藏在一句客套话里。', cond: { min: { CHA: 40 } }, eff: { NET: 7 } },
  { id: 'r06', age: [28, 55], w: 4, text: '你的名字第一次出现在报纸上。不是讣告，是新闻。', cond: { min: { FAME: 25 } }, eff: { FAME: 6, CHA: 2 } },
  { id: 'r07', age: [30, 60], w: 5, text: '母亲病了。你在病房外走廊里签了一大堆单据，忽然发现自己是家里唯一能做决定的人。', eff: { WILL: 5, STRESS: 8, MONEY: -6000000 } },
  { id: 'r08', age: [30, 60], w: 4, text: '你资助了一个老家的孩子读书。没人知道，也不需要知道。', cond: { min: { MONEY: 100000000 } }, eff: { WILL: 4, FAME: 3, MONEY: -5000000 } },
  { id: 'r09', age: [35, 70], w: 5, text: '你在江南的一家清吧遇到了一个说真话的老记者。他告诉你的东西，比任何财报都有用。', eff: { INT: 5, NET: 6 } },
  { id: 'r10', age: [40, 75], w: 6, text: '你有了孩子。你把那个从小就画在纸上的高塔故事，讲给了他听。', cond: { need: ['married'] }, eff: { WILL: 5, STRESS: -6, HP: 3 } },
  { id: 'r11', age: [45, 75], w: 5, text: '你去医院做了全面体检。医生说：你比你看起来老十岁。', eff: { HP: -5, STRESS: 5 } },
  { id: 'r12', age: [55, 80], w: 6, text: '你开始写回忆录。第一句话是：我出生在一个看不见天空的房间里。', eff: { INT: 3, FAME: 5 } },
  { id: 'r13', age: [60, 80], w: 6, text: '你回到老家的巷子。城中村隔断间还在，只是换了人家。', eff: { WILL: 3, STRESS: -5 } },
  { id: 'r14', age: [50, 80], w: 5, text: '有人在电视节目里提到你的名字，说你是「从泥沟里飞出的龙」。', cond: { min: { FAME: 50 } }, eff: { FAME: 8, WILL: 4 } },
  { id: 'r15', age: [20, 50], w: 4, text: '你在书店站着看完了《资本论》。合上书时，你对自己的人生有了另一种解释。', cond: { min: { INT: 55 } }, eff: { INT: 4, WILL: 3 } },

  /* ===== 晚年 60+ ===== */
  { id: 'o01', age: [60, 80], w: 8, text: '你退休了，或者说被退休了。名誉董事长，一个没有实权的头衔。', eff: { STRESS: 6, WILL: -2 } },
  { id: 'o02', age: [62, 80], w: 7, text: '你在江边的长椅上坐了一下午。江水还是那个江水。', eff: { STRESS: -12, WILL: 3 } },
  { id: 'o03', age: [65, 80], w: 6, text: '你把大部分财产捐了出去，成立了一个帮助城中村城中村孩子的基金。', cond: { min: { MONEY: 10000000000 } }, eff: { MONEY: -5000000000, FAME: 15, WILL: 6 } },
  { id: 'o04', age: [70, 80], w: 6, text: '医生把你叫到一边，说了那个词。你反而很平静。', eff: { HP: -12, STRESS: 8 } }
];

/* ---------------- 投资机会（前世记忆核心玩法） ---------------- */
/* year: 触发年份；hold: 持有到哪年结算；base: 基准倍率；vol: 波动 */
const INVESTMENTS = [
  { id: 'inv_imf_usd', year: 1997, name: '1997 · 危机中的黄金', hold: 2, cost: 2000000,
    hint: '元会崩。你记得那一年，一美元从 900 元涨到了近 2000。',
    base: 2.6, vol: 0.5, kind: 'macro' },
  { id: 'inv_imf_junk', year: 1998, name: '1998 · 收购破产企业债券', hold: 3, cost: 5000000,
    hint: '一堆企业的债券被打到面值的两成。有人说：国家不会让它倒。', base: 4.2, vol: 1.2, kind: 'macro' },
  { id: 'inv_dotcom', year: 1999, name: '1999 · 互联网概念股', hold: 2, cost: 5000000,
    hint: '。它会在 2000 年 3 月破裂，但在那之前会涨到荒唐的高度。', base: 2.4, vol: 1.0, kind: 'stock' },
  { id: 'inv_gangnam_apt', year: 2001, name: '2001 · 市中心公寓', hold: 6, cost: 20000000,
    hint: '市中心学区的「」。你记得它后来涨了十倍。', base: 3.2, vol: 0.4, kind: 'estate' },
  { id: 'inv_china', year: 2004, name: '2004 · 中国制造概念', hold: 3, cost: 10000000,
    hint: '。韩国的中间材会跟着中国的工厂一起起飞。', base: 2.0, vol: 0.6, kind: 'stock' },
  { id: 'inv_2008', year: 2008, name: '2008 危机 · 抄底 大盘', hold: 3, cost: 30000000,
    hint: '所有人都恐慌的十月，是你一生中最好的买点。', base: 3.4, vol: 0.8, kind: 'stock' },
  { id: 'inv_kpop', year: 2011, name: '2011 · 娱乐公司股票', hold: 4, cost: 20000000,
    hint: '。你知道明年会有一个骑马的胖子让全世界认识江南。', base: 4.0, vol: 1.1, kind: 'stock' },
  { id: 'inv_btc', year: 2013, name: '2013 · 比特币', hold: 4, cost: 10000000,
    hint: '一个叫 的东西，现在几百美元，你记得它后来能买一辆车。', base: 8.0, vol: 2.5, kind: 'crypto' },
  { id: 'inv_rebuild', year: 2015, name: '2015 · 江南再建筑', hold: 5, cost: 50000000,
    hint: '。三十年老公寓拆掉重建的那几年，是韩国最稳的暴利。', base: 2.8, vol: 0.5, kind: 'estate' },
  { id: 'inv_covid', year: 2020, name: '2020 · 疫情熔断抄底', hold: 2, cost: 100000000,
    hint: '三月的熔断，所有人都在抛。然后流动性来了。', base: 2.5, vol: 0.7, kind: 'stock' },
  { id: 'inv_semicon', year: 2022, name: '2022 · 半导体超级周期', hold: 3, cost: 200000000,
    hint: 'AI 会吃掉全世界的高带宽内存。你记得那家公司叫什么。', base: 2.2, vol: 0.6, kind: 'stock' }
];

/* ---------------- 结局 ---------------- */
/* cond: 判定函数 (s) => bool；rank: S/A/B/C/D */
const ENDINGS = [
  { id: 'end_king', rank: 'S', title: '企业之主',
    text: '你从城中村隔断间走进了董事长办公室的落地窗前。江在你脚下。当年那个看不见天空的起点，终于被你亲手改写。',
    cond: s => s.flags.took_over },
  { id: 'end_avenger', rank: 'S', title: '锋利的规则',
    text: '你没有拿走谁的名字，你只是让规则锋利了一次。那家集团的招牌换下的那天，你在江大桥上站了很久。',
    cond: s => s.flags.exposed && s.stats.FAME >= 60 },
  { id: 'end_stock', rank: 'A', title: '股神',
    text: '你在金融街有一间没有招牌的办公室。屏幕上的曲线你看了四十年，最后它们都变成了你的名字。',
    cond: s => (s.market && s.market.stocks.length >= 1 ? stockValue(s) : 0) >= 100000000000 },
  { id: 'end_landlord', rank: 'A', title: '收租的房东',
    text: '你名下的收租物业排到了第十九号。每个月的第一天，手机会准时响起——那是租金到账的声音。',
    cond: s => (s.market ? s.market.props.filter(p => {
      const r = propRef(p); return r && (r.rent || 0) > 0;
    }).length : 0) >= 2 && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 30000000000 },
  { id: 'end_tycoon', rank: 'A', title: '亿万富豪',
    text: '你不属于任何家族，你只属于你自己。报纸称你为「土勺子的叛乱」。',
    cond: s => (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 150000000000 },
  { id: 'end_vice', rank: 'A', title: '董事长之右臂',
    text: '你一生都在别人的影子里，但那个影子覆盖了整个韩国的天际线。',
    cond: s => s.flags.side_second && s.stats.LOY >= 60 },
  { id: 'end_politician', rank: 'A', title: '金融街之星',
    text: '你走进了国会议事堂。韩国最锋利的权力不在江南的办公室，而在这里的一张票上。',
    cond: s => s.stats.FAME >= 95 && s.stats.NET >= 150 },
  { id: 'end_legend', rank: 'A', title: '传说',
    text: '你的名字被写进了教科书。孩子们不知道你出生在哪儿，只知道你做过什么。',
    cond: s => s.stats.FAME >= 160 },
  { id: 'end_escape', rank: 'B', title: '远走他乡',
    text: '你在仁川机场的贵宾室里等着最后一班航班。钱还在，名声臭了。这也是一种活法。',
    cond: s => s.flags.tax_raid && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 1000000000 && s.flags.took_bribe },
  { id: 'end_fund', rank: 'B', title: '退休投资人',
    text: '你在海岛有一栋房子和一片橘子园。钱够用，故事也够讲。',
    cond: s => (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 3000000000 },
  { id: 'end_shop', rank: 'B', title: '温暖的店',
    text: '你的咖啡馆还在酒吧街的巷子里。老顾客来了一茬又一茬，你记得每个人的口味。',
    cond: s => s.flags.own_shop && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) > 0
      && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) < 3000000000 && s.stats.FAME < 40 },
  { id: 'end_family', rank: 'A', title: '家族绵延',
    text: '你儿孙满堂。年夜饭的桌上，三代人抢着给你夹菜。你这辈子没当上大老板，但你种下的根，扎得很深。',
    cond: s => s.grandCount > 0 && s.stats.LOVE >= 45 },
  { id: 'end_salary', rank: 'C', title: '平凡的公司职员',
    text: '你按时上下班，按时退休。回这座城的夜景时，你还是会想起小时候画的那个圈。',
    // A-06 之后「公司职员」等孤儿职称会被映射进 CAREERS 阶梯，state.job 变成阶梯职称，
    // 所以这里改成先按「所在阶梯」判（这是「平凡打工人」的真正定义），再按旧职称兜底（照顾旧存档）
    cond: s => (
      (s.career ? ['clerk', 'civil', 'factory', 'startup'].indexOf(s.career.id) >= 0 : false)
      || ['公司职员', '公务员', '大企业职员', '工厂工人', '个体户'].indexOf(s.job) >= 0
    ) && s.stats.FAME < 40 && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) < 3000000000 },
  { id: 'end_broken', rank: 'D', title: '负债者',
    text: '你奋斗了一辈子，最后只剩下一张催缴单和城中村隔断间的钥匙。',
    cond: s => (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) < 0 },
  { id: 'end_lonely', rank: 'C', title: '独行者',
    text: '你爬得不算高，但每一步都是自己的。天黑了，你给自己倒了一杯白酒。',
    cond: s => s.stats.WILL >= 60 },
  { id: 'end_normal', rank: 'C', title: '普通的人生',
    text: '你的一生没有奇迹，也没有崩塌。像江的水，平稳地流过。',
    cond: () => true }
];

/* =========================================================
 * 死因表（IMP-01 · S-04）
 * ---------------------------------------------------------
 * 只回答「怎么走的」，**不替代** ENDINGS 对「这一生是什么」的判定。
 * 原先 end_elder / end_ill / end_dead 三个 forceEnd 直接把 state.ending
 * 写成「某某死法」，16 条正式结局一条都不参与 —— 88% 的局看不到自己
 * 走出的人生是什么样。现在死亡也先跑 ENDINGS.find()，再把死因叠在标题与正文前。
 *
 * 消费方式：state.ending.cause === 'end_elder' | 'end_ill' | 'end_dead' | null
 *  · 结局页标题：`${ending.title}`（形如「普通的人生 · 安然离世」）
 *  · 音频 / 埋点请直接读 ending.cause，不要再去找 forceEnd 的调用时机
 * ========================================================= */
const DEATH_CAUSES = [
  {
    id: 'end_elder',
    label: '安然离世',
    text: s => `你在 ${typeof fmtYear === 'function' ? fmtYear(s) : s.age} 年闭上了眼睛。儿孙环绕，窗外是你看了一辈子的那棵树。`
  },
  {
    id: 'end_ill',
    label: '病逝',
    // ctx: { illness: 病名, years: 拖了几年 }
    text: (s, ctx) => `${typeof fmtYear === 'function' ? fmtYear(s) : s.age} 年，${s.age}岁，你没能撑过去。` +
      (ctx && ctx.illness ? `${ctx.illness}拖了 ${ctx.years || 0} 年——你总说「等忙完这一阵就去」。` : '你总说「等忙完这一阵就去」。')
  },
  {
    id: 'end_dead',
    label: '熄灭',
    text: s => `你在 ${typeof fmtYear === 'function' ? fmtYear(s) : s.age} 年倒下了。医生说是过劳。你最后的念头是：那件事，还没做完。`
  }
];

/* =========================================================
 * 扩展事件库 · 每个事件 3 个选项，风险与回报各不相同
 * risk: 1 低 / 2 中 / 3 高 gamble: {p, win, lose} 概率赌注
 * ========================================================= */
const EVENTS_EXTRA = [

  /* ===== 居住 / 房产 ===== */
  { id: 'x_h01', age: [23, 45], w: 8, text: '租约到期，房东说要涨三成。你在城中村隔断间的墙前站了很久——这里是你的起点，也是你最想逃离的地方。',
    choices: [
      { text: '续租，忍一年', eff: { MONEY: -3000000, STRESS: 5 }, risk: 1 },
      { text: '搬到城郊，通勤两小时', eff: { MONEY: -1200000, STR: -3, STRESS: 8, WILL: 3 }, risk: 2 },
      { text: '咬牙凑齐押金，一次性解决', eff: { MONEY: -18000000, WILL: 4, STRESS: 10 }, risk: 3,
        gamble: { p: 0.45, win: { MONEY: 6000000, WILL: 3 }, lose: { MONEY: -8000000, STRESS: 8 } } }
    ] },
  { id: 'x_h02', age: [25, 50], w: 8, text: '中介打来电话：学区有一套 24 坪，业主急售，比市价低一成。首付要在三天内到位。',
    cond: { min: { MONEY: 60000000 } },
    choices: [
      { text: '再等等，也许还有更便宜的', eff: { STRESS: 4 }, risk: 1 },
      { text: '付三成首付，剩下的贷款', eff: { MONEY: -42000000, STRESS: 10, WILL: 4 }, flags: ['mortgage'], risk: 2 },
      { text: '借遍所有能借的人，全款拿下', eff: { MONEY: -140000000, WILL: 8, STRESS: 16 }, flags: ['own_house', 'allin_house'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 80000000, CHA: 5, FAME: 3 }, lose: { MONEY: -30000000, HP: -5 } } }
    ] },
  { id: 'x_h03', age: [27, 55], w: 7, text: '房价连续三年上涨。办公室里所有人不谈工作，只谈房子。你手里有一笔钱，也有一个判断。',
    cond: { min: { MONEY: 50000000 } },
    choices: [
      { text: '不追高，把钱留在手里', eff: { INT: 2, WILL: 2 }, risk: 1 },
      { text: '买一套江北的小户型收租', eff: { MONEY: -50000000, NET: 3 }, risk: 2 },
      { text: '加杠杆，同时吃下两套', eff: { MONEY: -80000000, STRESS: 14 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.42, win: { MONEY: 260000000, CHA: 4 }, lose: { MONEY: -60000000, HP: -6, STRESS: 10 } } }
    ] },
  { id: 'x_h04', age: [30, 60], w: 6, text: '政府出台了新的房产税。你持有的房产，每年的持有成本会明显上升。',
    cond: { need: ['own_house'] },
    choices: [
      { text: '卖掉一套，降低负担', eff: { MONEY: 40000000, STRESS: -6 }, risk: 1 },
      { text: '硬扛，赌长期还是涨的', eff: { MONEY: -12000000, WILL: 4 }, risk: 2 },
      { text: '全部换成商铺，转收租模式', eff: { MONEY: -20000000, NET: 6, INT: 3 }, risk: 3,
        gamble: { p: 0.5, win: { MONEY: 70000000 }, lose: { MONEY: -25000000 } } }
    ] },
  { id: 'x_h05', age: [33, 58], w: 6, text: '你所住的那片老公寓贴出了「重建」公告。业主大会要投票，你的一票很关键。',
    cond: { need: ['own_house'] },
    choices: [
      { text: '反对，重建期间没地方住', eff: { STRESS: 4, WILL: -2 }, risk: 1 },
      { text: '赞成，等五年', eff: { MONEY: -15000000, WILL: 5, STRESS: 8 }, risk: 2 },
      { text: '赞成，并低价收购邻居的份额', eff: { MONEY: -90000000, INT: 5, STRESS: 12 }, flags: ['rebuild_player'], risk: 3,
        gamble: { p: 0.48, win: { MONEY: 420000000, FAME: 5 }, lose: { MONEY: -40000000, STRESS: 10 } } }
    ] },
  { id: 'x_h06', age: [40, 70], w: 6, text: '你在中介那里看到一套滨江的房子。价格是你十年前想都不敢想的数字，而你居然买得起了。',
    cond: { min: { MONEY: 2000000000 } },
    choices: [
      { text: '买，这是给自己一个交代', eff: { MONEY: -1800000000, CHA: 10, FAME: 8, WILL: 6 }, flags: ['own_house'], risk: 2 },
      { text: '不买，钱应该继续生钱', eff: { INT: 4, WILL: 3 }, risk: 1 },
      { text: '买两套，一套住一套租', eff: { MONEY: -2600000000, CHA: 12, NET: 8 }, flags: ['own_house'], risk: 3,
        gamble: { p: 0.5, win: { MONEY: 900000000 }, lose: { MONEY: -400000000, STRESS: 10 } } }
    ] },
  { id: 'x_h07', age: [24, 40], w: 6, text: '母亲从老家来这座城看你。她在城中村隔断间里坐了一晚，第二天说：这地方，怎么住人。',
    cond: { need: ['poor'] },
    choices: [
      { text: '笑着说，快了', eff: { WILL: 4, STRESS: 5 }, risk: 1 },
      { text: '带她去看江南的样板房', eff: { MONEY: -500000, WILL: 6, INT: 2 }, risk: 2 },
      { text: '当场签下一套首付合同', eff: { MONEY: -60000000, WILL: 8, STRESS: 14 }, flags: ['own_house', 'mortgage'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 50000000, CHA: 4 }, lose: { MONEY: -20000000, HP: -5 } } }
    ] },
  { id: 'x_h08', age: [28, 50], w: 5, text: '老家传来消息：那条规划了十年的地铁线，终于要动工了。你手里有一块城郊的地。',
    cond: { min: { MONEY: 30000000 } },
    choices: [
      { text: '不折腾，继续持有', eff: { INT: 2 }, risk: 1 },
      { text: '追加买入周边的地', eff: { MONEY: -60000000, STRESS: 8 }, risk: 2 },
      { text: '抵押房子，把整条线吃下来', eff: { MONEY: -150000000, WILL: 6, STRESS: 16 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.4, win: { MONEY: 620000000, NET: 8 }, lose: { MONEY: -90000000, HP: -7 } } }
    ] },

  /* ===== 汽车 ===== */
  { id: 'x_c01', age: [23, 40], w: 7, text: '你攒够了第一辆车的钱。销售员说：在这座城，车不是交通工具，是名片。',
    cond: { min: { MONEY: 15000000 } },
    choices: [
      { text: '买一辆二手小排量，能开就行', eff: { MONEY: -8000000, STR: 1 }, flags: ['own_car'], risk: 1 },
      { text: '买国产中型车，体面且够用', eff: { MONEY: -22000000, CHA: 3, NET: 2 }, flags: ['own_car'], risk: 2 },
      { text: '贷款上进口车，先像那个人', eff: { MONEY: -30000000, CHA: 7, NET: 3, STRESS: 10 }, flags: ['own_car', 'car_loan'], risk: 3,
        gamble: { p: 0.4, win: { NET: 10, CHA: 4 }, lose: { MONEY: -12000000, STRESS: 8 } } }
    ] },
  { id: 'x_c02', age: [28, 50], w: 6, text: '客户在电话里问：「你开什么车来？」你看着窗外的旧车，停顿了三秒。',
    cond: { min: { NET: 30 } },
    choices: [
      { text: '如实说，靠方案说话', eff: { WILL: 3, INT: 2 }, risk: 1 },
      { text: '租一辆好车去见他', eff: { MONEY: -1500000, CHA: 4, NET: 5 }, risk: 2 },
      { text: '直接换车，一次到位', eff: { MONEY: -95000000, CHA: 9, NET: 8 }, flags: ['own_car'], risk: 3,
        gamble: { p: 0.5, win: { NET: 14, MONEY: 60000000 }, lose: { MONEY: -20000000, STRESS: 6 } } }
    ] },
  { id: 'x_c03', age: [30, 55], w: 5, text: '你在酒吧街的红灯前停着，隔壁车道是一辆和你同款的车。对方摇下车窗，是那家大公司的人。',
    cond: { min: { MONEY: 120000000 } },
    choices: [
      { text: '点头示意，各自开走', eff: { WILL: 2 }, risk: 1 },
      { text: '递上名片，说一句久仰', eff: { NET: 8, LOY: 4, CHA: 2 }, risk: 2 },
      { text: '摇下车窗，问他要不要喝一杯', eff: { NET: 12, LOY: 8, HP: -4, STRESS: 6 }, risk: 3,
        gamble: { p: 0.45, win: { LOY: 15, NET: 10 }, lose: { LOY: -8, CHA: -3 } } }
    ] },
  { id: 'x_c04', age: [35, 65], w: 5, text: '你终于买下了那辆小时候贴在墙上的车。钥匙放在手里，比想象中轻。',
    cond: { min: { MONEY: 180000000 } },
    choices: [
      { text: '买下，但不开去公司', eff: { MONEY: -190000000, WILL: 5, CHA: 5 }, flags: ['own_car'], risk: 1 },
      { text: '买下，并开去所有该去的地方', eff: { MONEY: -190000000, CHA: 10, NET: 6, FAME: 4 }, flags: ['own_car'], risk: 2 },
      { text: '一次买两辆，一辆给母亲', eff: { MONEY: -340000000, CHA: 12, WILL: 8, FAME: 5 }, flags: ['own_car'], risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, NET: 8 }, lose: { MONEY: -40000000, STRESS: 8 } } }
    ] },
  { id: 'x_c05', age: [26, 45], w: 5, text: '同事聚会，大家都在谈股票和车。有人说：没贷款买车的人，是没野心的人。',
    choices: [
      { text: '笑而不语', eff: { INT: 3, WILL: 2 }, risk: 1 },
      { text: '附和几句，混个脸熟', eff: { NET: 4, CHA: 2 }, risk: 2 },
      { text: '当场宣布：我今年要买两辆', eff: { CHA: 5, NET: 6, STRESS: 10 }, risk: 3,
        gamble: { p: 0.35, win: { NET: 12, FAME: 6 }, lose: { CHA: -6, NET: -5, STRESS: 8 } } }
    ] },

  /* ===== 股市 ===== */
  { id: 'x_s01', age: [20, 40], w: 9, text: '你在证券公司开了户。营业厅的屏幕上全是红绿数字，客户经理递给你一杯速溶咖啡。',
    choices: [
      { text: '只买大盘 ETF，慢慢来', eff: { INT: 3, MONEY: -5000000 }, flags: ['investor'], risk: 1 },
      { text: '买一只你研究过的行业龙头', eff: { INT: 4, MONEY: -15000000, STRESS: 5 }, flags: ['investor'], risk: 2 },
      { text: '全部押在当下最火的那只', eff: { INT: 3, MONEY: -30000000, STRESS: 12 }, flags: ['investor', 'degen'], risk: 3,
        gamble: { p: 0.38, win: { MONEY: 60000000, INT: 5 }, lose: { MONEY: -18000000, STRESS: 10 } } }
    ] },
  { id: 'x_s02', age: [21, 45], w: 7, text: '你买的第一只股票连跌三天。论坛里全是「死扛」和「止损」的声音。',
    cond: { need: ['investor'] },
    choices: [
      { text: '死扛，等它回来', eff: { WILL: 4, STRESS: 8 }, risk: 2 },
      { text: '止损，认赔离场', eff: { INT: 4, STRESS: -5, WILL: 2 }, risk: 1 },
      { text: '越跌越买，摊平成本', eff: { MONEY: -20000000, WILL: 6, STRESS: 14 }, risk: 3,
        gamble: { p: 0.42, win: { MONEY: 90000000, INT: 6 }, lose: { MONEY: -40000000, HP: -5 } } }
    ] },
  { id: 'x_s03', age: [22, 50], w: 7, text: '一个在券商工作的学长偷偷告诉你：有家公司下周会有大消息。他说完就后悔了，让你当没听过。',
    choices: [
      { text: '当没听过，合规性第一', eff: { WILL: 3, INT: 2 }, risk: 1 },
      { text: '买一点点，试一试', eff: { MONEY: -10000000, NET: 5, STRESS: 6 }, flags: ['insider'], risk: 2 },
      { text: '重仓，这是改变命运的消息', eff: { MONEY: -80000000, WILL: 6, STRESS: 16 }, flags: ['insider', 'degen'], risk: 3,
        gamble: { p: 0.4, win: { MONEY: 400000000, INT: 8 }, lose: { MONEY: -60000000, FAME: -10, STRESS: 14 }, loseFlag: 'insider_risk' } }
    ] },
  { id: 'x_s04', age: [23, 55], w: 7, text: '你的账户在一年内翻了一倍。你开始觉得自己懂市场了——这是最危险的时候。',
    cond: { need: ['investor'], min: { MONEY: 100000000 } },
    choices: [
      { text: '取出本金，只留利润在场上', eff: { INT: 6, WILL: 4 }, risk: 1 },
      { text: '继续按照原来的节奏', eff: { INT: 3, STRESS: 4 }, risk: 2 },
      { text: '加大仓位，用信用融资再上杠杆', eff: { WILL: 6, STRESS: 18 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.35, win: { MONEY: 500000000, FAME: 6 }, lose: { MONEY: -280000000, HP: -8, STRESS: 16 } } }
    ] },
  { id: 'x_s05', age: [24, 60], w: 6, text: '市场暴跌，你的账户一天少了三成。手机屏幕上的绿色，比任何颜色都刺眼。',
    cond: { min: { MONEY: 30000000 } },
    choices: [
      { text: '关掉软件，去跑步', eff: { HP: 6, STRESS: -10, WILL: 3 }, risk: 1 },
      { text: '减仓一半，保留子弹', eff: { INT: 4, STRESS: -4 }, risk: 2 },
      { text: '别人恐惧我贪婪，全仓抄底', eff: { WILL: 8, STRESS: 18 }, flags: ['bottom_fisher'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 320000000, INT: 8 }, lose: { MONEY: -150000000, HP: -7 } } }
    ] },
  { id: 'x_s06', age: [25, 60], w: 6, text: '你手里那只股票一年涨了四倍。办公室的人开始问你买了什么。',
    cond: { min: { MONEY: 200000000 } },
    choices: [
      { text: '卖掉一半，落袋为安', eff: { INT: 5, WILL: 3, STRESS: -6 }, risk: 1 },
      { text: '一股不卖，让它继续跑', eff: { WILL: 5, STRESS: 8 }, risk: 2 },
      { text: '追加买入，把胜利推到极致', eff: { WILL: 8, STRESS: 16 }, flags: ['degen'], risk: 3,
        gamble: { p: 0.38, win: { MONEY: 700000000, FAME: 8 }, lose: { MONEY: -220000000, STRESS: 14 } } }
    ] },
  { id: 'x_s07', age: [26, 58], w: 6, text: '有人在论坛贴出一张截图：他做空了整个市场，赚了十倍。评论区一半在膜拜，一半在骂。',
    choices: [
      { text: '关掉，继续上班', eff: { INT: 3 }, risk: 1 },
      { text: '小仓位试一次做空', eff: { MONEY: -20000000, INT: 4, STRESS: 8 }, risk: 2 },
      { text: '跟着他，全仓做空', eff: { MONEY: -100000000, WILL: 6, STRESS: 20 }, flags: ['short_player'], risk: 3,
        gamble: { p: 0.3, win: { MONEY: 580000000, FAME: 10 }, lose: { MONEY: -260000000, HP: -8 } } }
    ] },
  { id: 'x_s08', age: [22, 45], w: 6, text: '一个「股票直播间」的主播说：跟着我操作，一个月翻倍，不赚包赔。',
    choices: [
      { text: '举报，然后关掉', eff: { INT: 4, WILL: 2 }, risk: 1 },
      { text: '进群看看，一分钱不投', eff: { INT: 5, NET: 3 }, risk: 2 },
      { text: '交了两百万的会员费', eff: { MONEY: -2000000, STRESS: 10 }, risk: 3,
        gamble: { p: 0.15, win: { MONEY: 30000000 }, lose: { MONEY: -12000000, INT: -4 } } }
    ] },
  { id: 'x_s09', age: [28, 60], w: 6, text: '你被拉进一个「江南投资俱乐部」。入场条件是：账户里至少要有十亿。',
    cond: { min: { MONEY: 1000000000 } },
    choices: [
      { text: '婉拒，圈子是有代价的', eff: { INT: 4, WILL: 3 }, risk: 1 },
      { text: '加入，只听不出手', eff: { NET: 10, INT: 6, MONEY: -20000000 }, risk: 2 },
      { text: '加入，并参与他们的联合建仓', eff: { MONEY: -500000000, NET: 18, LOY: 8, STRESS: 12 }, flags: ['club_member'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 1400000000, NET: 12 }, lose: { MONEY: -350000000, NET: -8 } } }
    ] },
  { id: 'x_s10', age: [30, 62], w: 6, text: '你重仓的那家公司爆出会计造假，股价开盘跌停。新闻里，你的名字出现在「受害个人股东」名单中。',
    cond: { min: { MONEY: 200000000 } },
    choices: [
      { text: '认赔，永远记住这一课', eff: { INT: 8, WILL: 5, STRESS: 10 }, risk: 1 },
      { text: '联合其他散户发起集体诉讼', eff: { FAME: 8, NET: 10, WILL: 6, STRESS: 12 }, flags: ['lawsuit'], risk: 2 },
      { text: '反向加仓，赌它不会退市', eff: { MONEY: -150000000, WILL: 8, STRESS: 20 }, risk: 3,
        gamble: { p: 0.28, win: { MONEY: 900000000, FAME: 12 }, lose: { MONEY: -300000000, HP: -8 } } }
    ] },
  { id: 'x_s11', age: [32, 65], w: 6, text: '你开始写投资专栏。第一篇的题目是《我如何在五年内把一千万变成十亿》。',
    cond: { min: { MONEY: 1000000000, INT: 60 } },
    choices: [
      { text: '只写方法，不写标的', eff: { FAME: 8, INT: 4 }, risk: 1 },
      { text: '公开你的持仓', eff: { FAME: 15, NET: 8, STRESS: 8 }, risk: 2 },
      { text: '顺势发行自己的基金', eff: { FAME: 20, NET: 14, MONEY: 300000000, STRESS: 14 }, flags: ['fund'], risk: 3,
        gamble: { p: 0.48, win: { MONEY: 2200000000, FAME: 15 }, lose: { FAME: -12, MONEY: -400000000, STRESS: 12 } } }
    ] },
  { id: 'x_s12', age: [20, 35], w: 6, text: '朋友在用一款新的海外券商 App，可以做空、可以加二十倍杠杆、可以买美股。他给你看了他的收益率。',
    choices: [
      { text: '不碰，看不懂的东西不碰', eff: { INT: 5, WILL: 3 }, risk: 1 },
      { text: '开个户，只放一点点钱', eff: { MONEY: -10000000, INT: 4 }, risk: 2 },
      { text: '二十倍杠杆，一把定生死', eff: { MONEY: -30000000, STRESS: 22, WILL: 6 }, flags: ['degen', 'leveraged'], risk: 3,
        gamble: { p: 0.25, win: { MONEY: 900000000, FAME: 10 }, lose: { MONEY: -30000000, HP: -9, STRESS: 18 } } }
    ] },
  { id: 'x_s13', age: [30, 60], w: 5, text: '你在股东大会上第一次举手发言。会场很小，麦克风很凉，你的声音在抖。',
    cond: { min: { MONEY: 500000000, INT: 60 } },
    choices: [
      { text: '问一个温和的问题', eff: { NET: 6, FAME: 4 }, risk: 1 },
      { text: '当众质疑管理层', eff: { FAME: 12, NET: 8, LOY: -6, WILL: 5 }, risk: 2 },
      { text: '提案罢免一名董事', eff: { FAME: 22, WILL: 8, LOY: -18, STRESS: 14 }, flags: ['activist'], risk: 3,
        gamble: { p: 0.35, win: { MONEY: 600000000, FAME: 15 }, lose: { LOY: -15, MONEY: -200000000 } } }
    ] },
  { id: 'x_s14', age: [26, 50], w: 5, text: '你在金融街的券商大厅遇见一个老人。他看了你一眼，说：小伙子，你是来赚钱的，还是来证明什么的？',
    choices: [
      { text: '赚钱', eff: { INT: 4 }, risk: 1 },
      { text: '都有', eff: { INT: 3, WILL: 4, NET: 4 }, risk: 2 },
      { text: '证明一些事', eff: { WILL: 8, INT: 2, STRESS: 8 }, flags: ['prove_self'], risk: 3,
        gamble: { p: 0.4, win: { WILL: 10, INT: 6, MONEY: 80000000 }, lose: { WILL: -4, STRESS: 12 } } }
    ] },
  { id: 'x_s15', age: [24, 55], w: 5, text: '同事都在买同一只「国民股」。有人说不买就落伍了。',
    choices: [
      { text: '不买，落伍就落伍', eff: { INT: 4, WILL: 2 }, risk: 1 },
      { text: '买一点，随大流', eff: { MONEY: -10000000, NET: 3 }, risk: 2 },
      { text: '反向思考，做空它', eff: { MONEY: -30000000, INT: 6, STRESS: 12 }, risk: 3,
        gamble: { p: 0.32, win: { MONEY: 260000000, INT: 8 }, lose: { MONEY: -120000000, NET: -5 } } }
    ] },

  /* ===== 职场 ===== */
  { id: 'x_w01', age: [23, 45], w: 8, text: '上司把一份不属于你的错误，压到了你头上。会议室里所有人都在看你。',
    choices: [
      { text: '认下来，记在心里', eff: { WILL: 5, STRESS: 8, NET: 4 }, risk: 1 },
      { text: '当场解释清楚', eff: { INT: 4, WILL: 3, NET: -4, STRESS: 6 }, risk: 2 },
      { text: '把证据发给董事长的秘书', eff: { WILL: 8, INT: 6, LOY: 6, STRESS: 16 }, risk: 3,
        gamble: { p: 0.35, win: { NET: 15, LOY: 15, MONEY: 60000000 }, lose: { NET: -12, STRESS: 14, job: '无业' } } }
    ] },
  { id: 'x_w02', age: [25, 50], w: 7, text: '一家竞争对手开出两倍的薪水挖你。合同就在邮箱里，回信期限是今晚十二点。',
    cond: { min: { INT: 45 } },
    choices: [
      { text: '拒绝，忠诚也是有价的', eff: { LOY: 8, WILL: 3, NET: 4 }, risk: 1 },
      { text: '谈一个更好的价，留下来', eff: { MONEY: 30000000, NET: 6, INT: 3 }, risk: 2 },
      { text: '跳过去，并把团队一起带走', eff: { MONEY: 80000000, NET: 10, LOY: -12, WILL: 6 }, risk: 3,
        gamble: { p: 0.45, win: { MONEY: 200000000, FAME: 8 }, lose: { LOY: -20, NET: -10, STRESS: 12 } } }
    ] },
  { id: 'x_w03', age: [26, 48], w: 7, text: '部门要选一个人去海外分公司。那里有机会，也有两年回不来的代价。',
    choices: [
      { text: '不去，守住眼前的位置', eff: { WILL: 2, STRESS: 3 }, risk: 1 },
      { text: '去，见识比安稳重要', eff: { INT: 6, NET: 8, CHA: 4, STRESS: 6 }, risk: 2 },
      { text: '主动请缨去最苦的那个市场', eff: { INT: 10, WILL: 8, NET: 12, HP: -6, STRESS: 12 }, risk: 3,
        gamble: { p: 0.5, win: { MONEY: 180000000, FAME: 10, LOY: 10 }, lose: { HP: -8, STRESS: 14 } } }
    ] },
  { id: 'x_w04', age: [28, 52], w: 7, text: '团建聚餐。上司把一杯白酒推到你面前，说：喝了这杯，这个单子就是你的。',
    choices: [
      { text: '以身体为由，换成水', eff: { WILL: 3, CHA: -3, STRESS: 5 }, risk: 1 },
      { text: '喝了，然后去洗手间吐掉', eff: { NET: 6, HP: -4, CHA: 2 }, risk: 2 },
      { text: '连干三杯，把气氛推到最高', eff: { NET: 12, LOY: 6, CHA: 4, HP: -7, STRESS: 6 }, risk: 3,
        gamble: { p: 0.42, win: { NET: 14, MONEY: 70000000 }, lose: { HP: -9, STRESS: 10 } } }
    ] },
  { id: 'x_w05', age: [30, 50], w: 6, text: '一个供应商塞给你一个信封。他说：这是行业规矩，大家都这样。',
    choices: [
      { text: '当场退回去', eff: { WILL: 5, INT: 3, NET: -3 }, risk: 1 },
      { text: '收下，但原样上缴公司', eff: { INT: 4, LOY: 6, FAME: 3 }, risk: 2 },
      { text: '收下，装进自己的口袋', eff: { MONEY: 40000000, WILL: -3, STRESS: 10 }, flags: ['took_bribe'], risk: 3,
        gamble: { p: 0.25, win: { MONEY: 150000000 }, lose: { MONEY: -200000000, FAME: -20, STRESS: 18 }, loseFlag: 'bribe_risk' } }
    ] },
  { id: 'x_w06', age: [30, 55], w: 6, text: '公司要裁掉十分之一的人。名单由你所在的部门出，而你的名字也在候选里。',
    choices: [
      { text: '保住下属，自己走', eff: { WILL: 8, NET: 10, MONEY: -20000000, FAME: 6 }, job: '无业', risk: 2 },
      { text: '按绩效如实上报', eff: { INT: 4, WILL: 3, NET: -4 }, risk: 1 },
      { text: '把对手的名字写上去', eff: { WILL: 5, INT: 5, NET: -8, LOY: 4 }, risk: 3,
        gamble: { p: 0.4, win: { MONEY: 90000000, LOY: 10 }, lose: { NET: -14, FAME: -8 } } }
    ] },
  { id: 'x_w07', age: [27, 45], w: 6, text: '你连续三个月睡在办公室。体检报告出来了，医生用红笔圈了四项。',
    choices: [
      { text: '休假两周，好好睡觉', eff: { HP: 12, STRESS: -12, MONEY: -3000000 }, risk: 1 },
      { text: '继续，但开始吃药', eff: { HP: -4, STRESS: 4, MONEY: 20000000 }, risk: 2 },
      { text: '什么都不管，项目必须上线', eff: { MONEY: 120000000, FAME: 8, HP: -11, STRESS: 16 }, risk: 3,
        gamble: { p: 0.42, win: { MONEY: 400000000, FAME: 15, LOY: 10 }, lose: { HP: -14, STRESS: 20 } } }
    ] },
  { id: 'x_w08', age: [29, 48], w: 6, text: '你有一个创业的想法，写在笔记本的第 47 页。问题是：要不要真的辞掉工作。',
    cond: { min: { WILL: 35 } },
    choices: [
      { text: '先做副业，验证一下', eff: { INT: 4, MONEY: 8000000, STRESS: 6 }, risk: 1 },
      { text: '辞职，给自己一年', eff: { MONEY: -30000000, WILL: 6, STRESS: 12 }, job: '创业者', flags: ['startup'], risk: 2 },
      { text: '抵押房子创业，不留退路', eff: { MONEY: -120000000, WILL: 10, STRESS: 20 }, job: '创业者', flags: ['startup', 'allin_startup'], risk: 3,
        gamble: { p: 0.32, win: { MONEY: 1800000000, FAME: 20, NET: 15 }, lose: { MONEY: -200000000, HP: -8, STRESS: 18 } } }
    ] },
  { id: 'x_w09', age: [33, 55], w: 6, text: '你带的一个后辈犯了致命错误。他跪在你办公室门口，说家里还有生病的母亲。',
    choices: [
      { text: '让他自己承担后果', eff: { INT: 3, WILL: -2, NET: -3 }, risk: 1 },
      { text: '替他扛下来', eff: { WILL: 5, NET: 10, STRESS: 8, MONEY: -10000000 }, risk: 2 },
      { text: '让他承担，但私下把他的母亲安排好', eff: { INT: 6, WILL: 6, NET: 12, MONEY: -30000000 }, risk: 3,
        gamble: { p: 0.5, win: { NET: 16, WILL: 8 }, lose: { NET: -6, MONEY: -20000000 } } }
    ] },
  { id: 'x_w10', age: [35, 58], w: 6, text: '你的名字出现在理事的候选名单上。要上去，还得再跨过一个人。',
    cond: { min: { LOY: 20 } },
    choices: [
      { text: '等，等到该轮到你', eff: { WILL: 4, INT: 3 }, risk: 1 },
      { text: '主动向董事长汇报一次', eff: { LOY: 10, FAME: 6, NET: 6 }, risk: 2 },
      { text: '把对手的问题整理成一份材料', eff: { LOY: 14, INT: 6, WILL: 5, STRESS: 14 }, flags: ['backstab'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 300000000, LOY: 15 }, lose: { LOY: -20, FAME: -10, NET: -12 } } }
    ] },

  /* ===== / 关系与家庭 ===== */
  { id: 'x_f01', age: [24, 45], w: 7, text: '相恋三年的女友坐下来认真地说：我们要不要先买房，再结婚？房价每天都在变。',
    cond: { min: { CHA: 30 } },
    choices: [
      { text: '说再等等，我不想负债', eff: { WILL: 3, STRESS: 8, CHA: -2 }, risk: 1 },
      { text: '答应，一起去银行', eff: { MONEY: -60000000, WILL: 5, STRESS: 12 }, flags: ['married', 'mortgage'], risk: 2 },
      { text: '当场签下一套江南的合约', eff: { MONEY: -200000000, CHA: 10, WILL: 8, STRESS: 18 }, flags: ['married', 'own_house'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 300000000, WILL: 8 }, lose: { MONEY: -80000000, STRESS: 14 } } }
    ] },
  { id: 'x_f02', age: [26, 50], w: 6, text: '母亲住院了。缴费单上的数字，比你第一次买房的首付还让人心慌。',
    choices: [
      { text: '用最好的药，钱可以再赚', eff: { MONEY: -40000000, WILL: 5, HP: -4, STRESS: 8 }, risk: 2 },
      { text: '选普通方案，能治就行', eff: { MONEY: -15000000, WILL: 3, STRESS: 12 }, risk: 1 },
      { text: '把房子抵押出去，请国外专家', eff: { MONEY: -120000000, WILL: 8, STRESS: 18 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.42, win: { WILL: 12, HP: 8, NET: 6 }, lose: { MONEY: -60000000, HP: -7 } } }
    ] },
  { id: 'x_f03', age: [28, 48], w: 6, text: '孩子的补习班。妻子说：别人都在上，我们不能不上。账单是每月两百万。',
    cond: { need: ['married'] },
    choices: [
      { text: '只上一个，其他的自己教', eff: { INT: 4, WILL: 3, MONEY: -12000000 }, risk: 1 },
      { text: '上全套，砸进去', eff: { MONEY: -48000000, WILL: 5, STRESS: 10 }, risk: 2 },
      { text: '直接送进国际学校', eff: { MONEY: -200000000, CHA: 6, NET: 8, FAME: 5 }, risk: 3,
        gamble: { p: 0.45, win: { NET: 16, FAME: 10 }, lose: { MONEY: -100000000, STRESS: 12 } } }
    ] },
  { id: 'x_f04', age: [30, 55], w: 6, text: '老家的弟弟打电话来借钱创业。他说：哥，你是我唯一的希望。',
    choices: [
      { text: '拒绝，钱救不了所有人', eff: { WILL: -2, INT: 4, NET: -4 }, risk: 1 },
      { text: '给一小笔，量力而行', eff: { MONEY: -10000000, WILL: 4, NET: 4 }, risk: 2 },
      { text: '给他一大笔，并帮他写商业计划', eff: { MONEY: -80000000, NET: 8, WILL: 6, STRESS: 10 }, risk: 3,
        gamble: { p: 0.4, win: { MONEY: 260000000, NET: 12 }, lose: { MONEY: -50000000, NET: -6 } } }
    ] },
  { id: 'x_f05', age: [32, 58], w: 5, text: '你在孩子的家长会上迟到。其他家长在用一种你熟悉的眼神看你——那是当年看你母亲的眼神。',
    cond: { need: ['married'] },
    choices: [
      { text: '坦然坐下', eff: { WILL: 4, CHA: 2 }, risk: 1 },
      { text: '主动赞助一场活动', eff: { MONEY: -20000000, NET: 8, FAME: 4 }, risk: 2 },
      { text: '站起来做自我介绍，把生意谈成', eff: { NET: 14, CHA: 6, FAME: 6, MONEY: 60000000 }, risk: 3,
        gamble: { p: 0.42, win: { NET: 18, MONEY: 300000000 }, lose: { CHA: -6, NET: -5 } } }
    ] },
  { id: 'x_f06', age: [34, 60], w: 5, text: '妻子说，你已经三年没有在家吃过晚饭了。她没有哭，只是很平静。',
    cond: { need: ['married'] },
    choices: [
      { text: '答应这个周末一定回来', eff: { WILL: 2, STRESS: -4 }, risk: 1 },
      { text: '把周末全空出来，带她去海岛', eff: { MONEY: -8000000, WILL: 5, HP: 5, STRESS: -10 }, risk: 2 },
      { text: '什么也不说，关掉手机陪她一整天', eff: { WILL: 8, HP: 8, STRESS: -16, MONEY: -50000000 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, HP: 10 }, lose: { MONEY: -120000000, STRESS: 8 } } }
    ] },
  { id: 'x_f07', age: [35, 62], w: 5, text: '你在父亲坟前站了很久。他一辈子没离开过那条巷子，而你走得太远了。',
    choices: [
      { text: '说一句：我过得不错', eff: { WILL: 4, STRESS: -6 }, risk: 1 },
      { text: '说：我会让他们都知道你的名字', eff: { WILL: 8, FAME: 4 }, risk: 2 },
      { text: '什么也不说，把那栋楼的照片烧给他', eff: { WILL: 10, HP: -4, STRESS: -12 }, risk: 3,
        gamble: { p: 0.45, win: { WILL: 12, FAME: 8 }, lose: { HP: -7, STRESS: 10 } } }
    ] },

  /* ===== / 风险金钱 ===== */
  { id: 'x_g01', age: [24, 55], w: 6, text: '朋友带你去了一间地下赌场。他说：就玩一把，输赢都不超过十万。',
    choices: [
      { text: '转身就走', eff: { WILL: 4, INT: 3 }, risk: 1 },
      { text: '玩一把就走', eff: { MONEY: -2000000, STRESS: 6 }, risk: 2 },
      { text: '越玩越大，直到天亮', eff: { STRESS: 16, WILL: -3 }, flags: ['gambler'], risk: 3,
        gamble: { p: 0.28, win: { MONEY: 280000000 }, lose: { MONEY: -180000000, HP: -8, STRESS: 18 } } }
    ] },
  { id: 'x_g02', age: [26, 55], w: 6, text: '一个「稳赚不赔」的海外项目找上门，年化 30%，合同很厚，印章很红。',
    choices: [
      { text: '不看，直接拉黑', eff: { INT: 5, WILL: 3 }, risk: 1 },
      { text: '投一小笔试试', eff: { MONEY: -20000000, INT: 4 }, risk: 2 },
      { text: '全押，并拉朋友一起', eff: { MONEY: -200000000, NET: 6, STRESS: 16 }, risk: 3,
        gamble: { p: 0.18, win: { MONEY: 900000000 }, lose: { MONEY: -260000000, NET: -20, FAME: -10 } } }
    ] },
  { id: 'x_g03', age: [25, 50], w: 5, text: '大学同学找你做担保人。他说只是走个流程，不会真的要你还。',
    choices: [
      { text: '拒绝，担保就是负债', eff: { INT: 5, NET: -3 }, risk: 1 },
      { text: '只担保一个很小的额度', eff: { MONEY: -10000000, NET: 4 }, risk: 2 },
      { text: '签了，朋友就该这样', eff: { NET: 8, WILL: 4, STRESS: 12 }, flags: ['guarantor'], risk: 3,
        gamble: { p: 0.3, win: { NET: 14, MONEY: 50000000 }, lose: { MONEY: -300000000, NET: -10 } } }
    ] },
  { id: 'x_g04', age: [27, 52], w: 5, text: '急用钱。银行的门关着，街边的「小额贷款」招牌亮着，月息三分。',
    cond: { max: { MONEY: 20000000 } },
    choices: [
      { text: '去找朋友借', eff: { MONEY: 15000000, NET: -4, WILL: 3 }, risk: 1 },
      { text: '找正规银行的小额贷', eff: { MONEY: 20000000, STRESS: 8 }, risk: 2 },
      { text: '借高利贷，先过这关', eff: { MONEY: 40000000, STRESS: 20, WILL: -4 }, flags: ['loan_shark'], risk: 3,
        gamble: { p: 0.3, win: { MONEY: 120000000 }, lose: { MONEY: -90000000, HP: -7, STRESS: 20 } } }
    ] },
  { id: 'x_g05', age: [24, 45], w: 5, text: '共同基金的申购日。销售说这是「国民理财产品」，闭着眼买都不会错。',
    choices: [
      { text: '不买，先看说明书', eff: { INT: 5, WILL: 2 }, risk: 1 },
      { text: '买一点点', eff: { MONEY: -10000000, INT: 2 }, risk: 2 },
      { text: '重仓，反正是「国民」级别', eff: { MONEY: -60000000, STRESS: 10 }, risk: 3,
        gamble: { p: 0.35, win: { MONEY: 180000000 }, lose: { MONEY: -40000000 } } }
    ] },
  { id: 'x_g06', age: [28, 50], w: 5, text: '你发现公司账上有笔说不清的支出。查下去，可能会查到自己人。',
    cond: { min: { INT: 50 } },
    choices: [
      { text: '装作没看见', eff: { WILL: -2, LOY: 6 }, risk: 1 },
      { text: '匿名举报', eff: { FAME: 6, WILL: 4, LOY: -8, STRESS: 8 }, risk: 2 },
      { text: '把材料握在手里，等到需要那天', eff: { INT: 8, WILL: 6, STRESS: 12 }, flags: ['blackmail'], risk: 3,
        gamble: { p: 0.42, win: { MONEY: 400000000, LOY: 12 }, lose: { MONEY: -100000000, FAME: -14, HP: -6 } } }
    ] },

  /* ===== 企业线 ===== */
  { id: 'x_t10', age: [34, 58], w: 7, text: '你重仓的龙头股价异动。你在屏幕上看到那条曲线——它和你多年经验里的某个形态重合了。',
    cond: { min: { MONEY: 300000000 } },
    choices: [
      { text: '不动，看着', eff: { INT: 4, WILL: 2 }, risk: 1 },
      { text: '买入一部分，跟着判断走', eff: { MONEY: -150000000, INT: 5 }, risk: 2 },
      { text: '满仓买入，这是你等了半辈子的机会', eff: { MONEY: -600000000, WILL: 8, STRESS: 18 }, flags: ['big_bet'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 3200000000, LOY: 8, INT: 8 }, lose: { MONEY: -300000000, STRESS: 16 } } }
    ] },
  { id: 'x_t11', age: [36, 60], w: 7, text: '社长的亲信约你喝酒。他推过来一份文件，说：签了，你就是自己人。',
    cond: { min: { LOY: 25 } },
    choices: [
      { text: '不签，我谁的账都不买', eff: { WILL: 6, LOY: -8, INT: 4 }, risk: 2 },
      { text: '签，先站进去再说', eff: { LOY: 14, NET: 10, MONEY: 80000000, WILL: -3 }, flags: ['side_elder'], risk: 1 },
      { text: '签，但把文件多复印一份', eff: { LOY: 12, INT: 8, NET: 12, STRESS: 12 }, flags: ['side_elder', 'has_copy'], risk: 3,
        gamble: { p: 0.48, win: { LOY: 18, MONEY: 600000000 }, lose: { LOY: -25, FAME: -10, HP: -6 } } }
    ] },
  { id: 'x_t12', age: [38, 62], w: 7, text: '公司里最被看好的接班人在美术馆闭馆后见你。她只说了一句：那个位置，不会传给废物。',
    cond: { min: { LOY: 30 } },
    choices: [
      { text: '保持距离', eff: { INT: 4, WILL: 3 }, risk: 1 },
      { text: '表示支持', eff: { LOY: 14, NET: 12, INT: 4 }, flags: ['side_second'], risk: 2 },
      { text: '当场承诺：我会让你坐上那个位置', eff: { LOY: 22, WILL: 10, NET: 14, STRESS: 14 }, flags: ['side_second', 'oath'], risk: 3,
        gamble: { p: 0.5, win: { LOY: 25, MONEY: 900000000, NET: 12 }, lose: { LOY: -20, STRESS: 16 } } }
    ] },
  { id: 'x_t13', age: [40, 64], w: 7, text: '股东大会前夜。你手里有 7.4% 的股份，还差最后一点点，就能改写这家公司的历史。',
    cond: { min: { MONEY: 3000000000 } },
    choices: [
      { text: '收手，把股份卖掉落袋', eff: { MONEY: 800000000, WILL: -4 }, risk: 1 },
      { text: '再买 2%，站到台前', eff: { MONEY: -2000000000, FAME: 20, WILL: 8, LOY: -15 }, flags: ['buying_stake'], risk: 2 },
      { text: '全押，明天之后不再有退路', eff: { MONEY: -6000000000, FAME: 30, WILL: 12, LOY: -25, STRESS: 20 }, flags: ['buying_stake', 'showdown'], risk: 3,
        gamble: { p: 0.42, win: { FAME: 40, MONEY: 3000000000, flags: ['took_over'], job: '企业董事长' }, lose: { MONEY: -3000000000, LOY: -30, HP: -8 } } }
    ] },
  { id: 'x_t14', age: [40, 65], w: 6, text: '检察官请你喝了一杯茶。他说：我们知道一些事，也想知道一些事。',
    cond: { min: { FAME: 40 } },
    choices: [
      { text: '什么也不说', eff: { WILL: 5, STRESS: 10, LOY: 6 }, risk: 1 },
      { text: '只说别人的', eff: { LOY: -6, NET: -6, WILL: -3, STRESS: 6 }, flags: ['snitch'], risk: 2 },
      { text: '把手里的材料交出去', eff: { FAME: 25, LOY: -40, WILL: 8, STRESS: 16 }, flags: ['exposed'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 30, WILL: 10, NET: 10 }, lose: { MONEY: -800000000, HP: -8 } } }
    ] },

  /* ===== 时代 ===== */
  { id: 'x_e01', age: [10, 65], w: 10, once: true, era: true, text: '1997 年。街头的电视都在放同一条新闻：亚洲金融风暴蔓延。工厂在裁员，金店的队伍排到了拐角。',
    cond: { yearMin: 1997, yearMax: 1998 },
    choices: [
      { text: '把零花钱全部交给母亲', eff: { WILL: 6, MONEY: -100000, STRESS: 6 }, risk: 1 },
      { text: '跟着父亲去街头摆摊', eff: { WILL: 8, CHA: 3, MONEY: 800000, STRESS: 10 }, risk: 2 },
      { text: '把家里最后一点钱拿去买美元', eff: { MONEY: -500000, INT: 8, WILL: 6, STRESS: 14 }, flags: ['imf_buyer'], risk: 3,
        gamble: { p: 0.6, win: { MONEY: 12000000, INT: 6 }, lose: { MONEY: -400000, STRESS: 8 } } }
    ] },
  { id: 'x_e02', age: [18, 70], w: 9, once: true, era: true, text: '2008 年。雷曼兄弟倒下的那个秋天，办公室里没人说话。账户每天少掉一个月的工资。',
    cond: { yearMin: 2008, yearMax: 2009 },
    choices: [
      { text: '清仓，保住剩下的', eff: { INT: 5, WILL: 3, STRESS: -6 }, risk: 1 },
      { text: '不动，等它过去', eff: { WILL: 6, STRESS: 12 }, risk: 2 },
      { text: '借钱抄底，赌国运', eff: { WILL: 10, STRESS: 20 }, flags: ['bottom_fisher', 'leveraged'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 700000000, INT: 10 }, lose: { MONEY: -220000000, HP: -8 } } }
    ] },
  { id: 'x_e03', age: [18, 75], w: 9, once: true, era: true, text: '2020 年。三月，股市熔断两次。四月，所有人都在家里打开证券 App。你的手机也在推送开户广告。',
    cond: { yearMin: 2020, yearMax: 2021 },
    choices: [
      { text: '关掉推送，去阳台上透气', eff: { HP: 6, STRESS: -8 }, risk: 1 },
      { text: '小仓位进场', eff: { MONEY: -30000000, INT: 4 }, risk: 2 },
      { text: '满仓，这是十年一次的价钱', eff: { MONEY: -200000000, WILL: 8, STRESS: 18 }, flags: ['bottom_fisher'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 1200000000, INT: 8 }, lose: { MONEY: -120000000, HP: -7 } } }
    ] },
  { id: 'x_e04', age: [10, 65], w: 8, once: true, era: true, text: '2002 年 世界杯。整个这座城变成了红色的海，你在光化门前和几十万人一起喊「中国」。',
    cond: { yearMin: 2002, yearMax: 2003 },
    choices: [
      { text: '喊到嗓子哑，然后回家背书', eff: { WILL: 4, INT: 3, STRESS: -10 }, risk: 1 },
      { text: '跟着人群跑遍整座城市', eff: { CHA: 5, NET: 6, WILL: 4, HP: -3 }, risk: 2 },
      { text: '在街头摆摊卖国旗，赚第一桶金', eff: { MONEY: 1200000, CHA: 4, INT: 4, NET: 3 }, risk: 3,
        gamble: { p: 0.5, win: { MONEY: 5000000, CHA: 5 }, lose: { MONEY: -300000, STRESS: 5 } } }
    ] },
  { id: 'x_e05', age: [16, 65], w: 7, once: true, era: true, text: '《江南 Style》火遍全球。全世界的综艺都在跳骑马舞，江南的房价在半年里又涨了一成。',
    cond: { yearMin: 2012, yearMax: 2013 },
    choices: [
      { text: '笑一笑，继续上班', eff: { STRESS: -5 }, risk: 1 },
      { text: '买一点娱乐股', eff: { MONEY: -20000000, INT: 4 }, risk: 2 },
      { text: '重仓韩流概念，赌它还能再翻倍', eff: { MONEY: -80000000, WILL: 6, STRESS: 12 }, risk: 3,
        gamble: { p: 0.45, win: { MONEY: 400000000 }, lose: { MONEY: -50000000 } } }
    ] },
  { id: 'x_e06', age: [25, 75], w: 7, once: true, era: true, text: 'AI 的时代来了。所有公司都在谈算力，而你手里的钱，第一次变成了「入场券」。',
    cond: { min: { MONEY: 500000000 }, yearMin: 2023, yearMax: 2027 },
    choices: [
      { text: '观望，等技术落地', eff: { INT: 5, WILL: 2 }, risk: 1 },
      { text: '买行业龙头', eff: { MONEY: -200000000, INT: 6 }, risk: 2 },
      { text: 'all in，这是最后一场大周期', eff: { MONEY: -800000000, WILL: 10, STRESS: 18 }, flags: ['ai_bet'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 4000000000, FAME: 15 }, lose: { MONEY: -500000000, HP: -7 } } }
    ] },

  /* ===== 年 晚年 ===== */
  { id: 'x_o05', age: [58, 72], w: 7, text: '你开始考虑交接。把公司交给职业经理人，还是留给自己的孩子？',
    cond: { min: { MONEY: 3000000000 } },
    choices: [
      { text: '交给职业经理人', eff: { INT: 5, NET: 8, WILL: -2 }, risk: 1 },
      { text: '交给孩子，血脉优先', eff: { WILL: 6, NET: 4, FAME: 4 }, risk: 2 },
      { text: '成立财团，谁也拿不走', eff: { FAME: 15, NET: 10, WILL: 8, MONEY: -500000000 }, flags: ['foundation'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 20, WILL: 10 }, lose: { FAME: -8, MONEY: -1200000000 } } }
    ] },
  { id: 'x_o06', age: [60, 76], w: 6, text: '一个年轻人写信给你，说他在城中村隔断间里读完了你的自传。他问：我还有机会吗？',
    cond: { min: { FAME: 30 } },
    choices: [
      { text: '回一句：有', eff: { WILL: 4, FAME: 3 }, risk: 1 },
      { text: '资助他读完大学', eff: { MONEY: -30000000, WILL: 6, FAME: 6 }, risk: 2 },
      { text: '成立一个资助城中村城中村孩子的基金', eff: { MONEY: -2000000000, FAME: 20, WILL: 10 }, flags: ['foundation'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 25, WILL: 12 }, lose: { MONEY: -1000000000, STRESS: 8 } } }
    ] },
  { id: 'x_o07', age: [62, 80], w: 6, text: '医生给了你两个选择：手术，或者剩下的时间。',
    choices: [
      { text: '不做手术，回家', eff: { HP: -11, WILL: 6, STRESS: -10 }, risk: 2 },
      { text: '做手术，赌一把', eff: { MONEY: -80000000, HP: 10, STRESS: 10 }, risk: 2 },
      { text: '去国外找最好的医生', eff: { MONEY: -500000000, HP: 20, STRESS: 6 }, risk: 3,
        gamble: { p: 0.45, win: { HP: 28, WILL: 8 }, lose: { MONEY: -300000000, HP: -7 } } }
    ] },
  { id: 'x_o08', age: [65, 80], w: 6, text: '你回到那条巷子。城中村隔断间还在，只是换了人家。门口晒着别人的鞋。',
    choices: [
      { text: '站一会儿就走', eff: { WILL: 3, STRESS: -5 }, risk: 1 },
      { text: '敲开门，和里面的人聊几句', eff: { WILL: 5, CHA: 3, NET: 3, STRESS: -8 }, risk: 2 },
      { text: '买下整条巷子，改成青年公寓', eff: { MONEY: -3000000000, FAME: 20, WILL: 12, NET: 10 }, flags: ['foundation'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 25, WILL: 14 }, lose: { MONEY: -800000000, STRESS: 10 } } }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_EXTRA);

/* =========================================================
 * 扩展事件库 · 父母 / 亲人 / 妻子 互动线
 * 童年事件自带三选项（不受年龄限制）；成年事件用 need/ban 控制出现时机
 * ========================================================= */
const EVENTS_FAMILY = [

  /* ===== · 童年与父母 ===== */
  { id: 'f_c1', age: [4, 10], w: 7, text: '父亲把你扛在肩上去看金融街的烟花。你问：爸爸，我们以后能住进那种大楼吗？',
    choices: [
      { text: '说：能，爸爸会努力', eff: { WILL: 2, CHA: 1 }, risk: 1 },
      { text: '沉默，把脸埋进他的衣领', eff: { WILL: 4, STRESS: 3 }, risk: 2 },
      { text: '大声说：我以后要买下它', eff: { WILL: 6, FAME: 1, STRESS: 5 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 6, CHA: 3 }, lose: { STRESS: 6 } } }
    ] },
  { id: 'f_c2', age: [5, 11], w: 7, text: '母亲在灯下给你缝补校服。她说：衣服旧没关系，人要新。',
    choices: [
      { text: '乖乖点头', eff: { WILL: 3, INT: 1 }, risk: 1 },
      { text: '说：妈，我以后给你买新的', eff: { WILL: 5, CHA: 2 }, risk: 2 },
      { text: '把攒的零钱塞给母亲', eff: { MONEY: -50000, WILL: 6, NET: 2 }, risk: 3,
        gamble: { p: 0.55, win: { WILL: 4, NET: 3 }, lose: { STRESS: 5 } } }
    ] },
  { id: 'f_c3', age: [6, 12], w: 6, text: '你拿了邻居孩子的玩具，被母亲发现。她让你在墙角跪了一晚。',
    choices: [
      { text: '认错，再也不拿别人的东西', eff: { WILL: 4, INT: 1 }, risk: 1 },
      { text: '嘴硬，说别人也有', eff: { CHA: -3, WILL: 2, STRESS: 4 }, risk: 2 },
      { text: '半夜把玩具还回去并道歉', eff: { WILL: 6, CHA: 2, INT: 2 }, risk: 3,
        gamble: { p: 0.55, win: { WILL: 4, NET: 3 }, lose: { STRESS: 5 } } }
    ] },
  { id: 'f_c4', age: [3, 8], w: 5, text: '爷爷从乡下寄来一箱苹果和一张旧照片。照片背面写着一个你叫不出名字的人。',
    choices: [
      { text: '把照片收进抽屉', eff: { INT: 2 }, risk: 1 },
      { text: '问母亲那是谁', eff: { INT: 4, WILL: 2 }, risk: 2 },
      { text: '偷偷寄回一封信', eff: { WILL: 3, CHA: 1 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 4, NET: 3 }, lose: { STRESS: 4 } } }
    ] },
  { id: 'f_c5', age: [7, 12], w: 6, text: '父母为了你的补习费吵架。父亲摔门而出，母亲抱着你哭。',
    choices: [
      { text: '发誓努力，不让母亲再哭', eff: { WILL: 6, INT: 2, STRESS: 5 }, risk: 1 },
      { text: '装睡，什么都不想听', eff: { STRESS: 6, WILL: 2 }, risk: 2 },
      { text: '站起来对父亲说：别吵了', eff: { WILL: 5, CHA: 2, STRESS: 8 }, risk: 3,
        gamble: { p: 0.45, win: { WILL: 6, NET: 3 }, lose: { STRESS: 10 } } }
    ] },

  /* ===== · 成年后与父母 ===== */
  { id: 'f_p1', age: [18, 30], w: 6, text: '母亲第一次打电话让你别太累。你说好，然后继续熬夜。',
    cond: { need: ['parents_alive'] },
    choices: [
      { text: '周末回家一趟', eff: { WILL: 4, STRESS: -5, MONEY: -500000 }, risk: 1 },
      { text: '寄钱回去', eff: { MONEY: -3000000, WILL: 3, NET: 2 }, risk: 2 },
      { text: '接她来这座城住一阵', eff: { MONEY: -8000000, CHA: 3, WILL: 5 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 6, CHA: 4, NET: 4 }, lose: { MONEY: -4000000, STRESS: 6 } } }
    ] },
  { id: 'f_p2', age: [22, 35], w: 5, text: '父亲第一次认真问你：你到底想成为什么样的人？',
    cond: { need: ['parents_alive'] },
    choices: [
      { text: '照实说：我想不再穷', eff: { WILL: 5, INT: 2 }, risk: 1 },
      { text: '说：想让您骄傲', eff: { WILL: 6, CHA: 2, FAME: 1 }, risk: 2 },
      { text: '闭口不答', eff: { STRESS: 5, WILL: -2 }, risk: 3 }
    ] },
  { id: 'f_p3', age: [24, 40], w: 5, text: '父亲退休了。他把手表摘下来给你：这辈子我就这一块，给你吧。',
    cond: { need: ['parents_alive'] },
    choices: [
      { text: '收下，戴在手上', eff: { WILL: 5, CHA: 1, NET: 2, STRESS: -4 }, risk: 1 },
      { text: '说您留着', eff: { WILL: 3 }, risk: 2 },
      { text: '把表卖了换启动资金', eff: { MONEY: 15000000, WILL: -3, NET: -2 }, risk: 3,
        gamble: { p: 0.4, win: { MONEY: 10000000, WILL: -2 }, lose: { WILL: -6, STRESS: 8 } } }
    ] },
  { id: 'f_p4', age: [26, 45], w: 5, text: '母亲开始催婚。她说：邻居家孩子都上小学了。',
    cond: { need: ['parents_alive'], ban: ['married'] },
    choices: [
      { text: '说会考虑的', eff: { STRESS: 5 }, risk: 1 },
      { text: '认真去相亲一次', eff: { NET: 4, CHA: 2, STRESS: 6 }, risk: 2 },
      { text: '带一个假对象回家', eff: { CHA: 4, STRESS: 10 }, risk: 3,
        gamble: { p: 0.3, win: { CHA: 6, NET: 5 }, lose: { STRESS: 12, NET: -3 } } }
    ] },
  { id: 'f_p6', age: [35, 55], w: 5, text: '你买了大房子，把父母接来住。母亲在阳台上站了很久：这窗户，比我们城中村隔断间大。',
    cond: { need: ['parents_alive', 'own_house'] },
    choices: [
      { text: '说：以后这就是家', eff: { WILL: 6, CHA: 3, FAME: 2, MONEY: -2000000 }, risk: 1 },
      { text: '默默把另一间收拾好', eff: { WILL: 4, STRESS: -6 }, risk: 2 },
      { text: '给父母各开一张卡', eff: { MONEY: -30000000, WILL: 6, NET: 4 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 8, NET: 6 }, lose: { MONEY: -10000000, STRESS: 6 } } }
    ] },
  { id: 'f_p7', age: [40, 62], w: 5, text: '父亲走了。你整理他的遗物，发现一沓没寄出的信——都是写给你却没说出口的话。',
    cond: { need: ['parents_alive'] },
    choices: [
      { text: '在坟前读完它们', eff: { WILL: 5, STRESS: -6 }, risk: 1, killParents: true },
      { text: '把信烧给他', eff: { WILL: 8, FAME: 2, STRESS: -8 }, risk: 2, killParents: true },
      { text: '把公司改名，纪念他', eff: { WILL: 6, FAME: 4, STRESS: -4, flags: ['memorial_father'] }, risk: 3, killParents: true }
    ] },
  { id: 'f_p8', age: [45, 66], w: 5, text: '母亲也走了。你成了那个再没人叫你回家吃饭的人。',
    cond: { need: ['parents_alive'] },
    choices: [
      { text: '把老家的房子留着，不卖', eff: { WILL: 5, STRESS: -6 }, risk: 1, killParents: true },
      { text: '每年回去扫墓', eff: { WILL: 4, INT: 2 }, risk: 2, killParents: true },
      { text: '成立基金，帮助孤寡老人', eff: { MONEY: -50000000, WILL: 8, FAME: 6, flags: ['foundation'] }, risk: 3, killParents: true }
    ] },

  /* ===== · 亲人 ===== */
  { id: 'f_r1', age: [16, 25], w: 6, text: '表哥从美国回来，带你去见了他的几个朋友。你第一次知道世界不止这座城。',
    choices: [
      { text: '默默听着', eff: { INT: 3, NET: 2 }, risk: 1 },
      { text: '主动交换联系方式', eff: { NET: 6, CHA: 2 }, risk: 2 },
      { text: '当场谈起自己的计划', eff: { NET: 8, FAME: 3, STRESS: 6 }, risk: 3,
        gamble: { p: 0.5, win: { NET: 12, CHA: 4 }, lose: { STRESS: 8, NET: -3 } } }
    ] },
  { id: 'f_r2', age: [20, 32], w: 6, text: '姑姑介绍了一份工作，但要在她朋友的店里当学徒。',
    choices: [
      { text: '拒绝，想走自己的路', eff: { WILL: 4, INT: 2 }, risk: 1 },
      { text: '去试试，权当积累', eff: { NET: 6, MONEY: 10000000, INT: 3 }, risk: 2 },
      { text: '借机学技术，之后单干', eff: { INT: 6, NET: 4, WILL: 5, STRESS: 8 }, risk: 3,
        gamble: { p: 0.45, win: { MONEY: 60000000, INT: 5 }, lose: { STRESS: 10, NET: -3 } } }
    ] },
  { id: 'f_r3', age: [24, 40], w: 5, text: '弟弟/妹妹要结婚了，家里让你出份子钱。',
    choices: [
      { text: '按能力给一点', eff: { MONEY: -5000000, WILL: 3, NET: 2 }, risk: 1 },
      { text: '多给一些，帮衬家里', eff: { MONEY: -20000000, WILL: 5, NET: 4 }, risk: 2 },
      { text: '顺便把婚礼包办了', eff: { MONEY: -80000000, WILL: 8, NET: 8, FAME: 3 }, risk: 3,
        gamble: { p: 0.5, win: { NET: 12, FAME: 5 }, lose: { MONEY: -30000000, NET: -4 } } }
    ] },
  { id: 'f_r4', age: [26, 45], w: 5, text: '叔叔在政府部门，他暗示可以帮你的公司「行个方便」。',
    choices: [
      { text: '婉拒，路要自己走', eff: { WILL: 5, INT: 2 }, risk: 1 },
      { text: '接受，记在心里', eff: { NET: 10, STRESS: 6, flags: ['uncle_help'] }, risk: 2 },
      { text: '把这件事写成证据留着', eff: { INT: 6, NET: 6, WILL: 4, STRESS: 10, flags: ['uncle_evidence'] }, risk: 3,
        gamble: { p: 0.45, win: { NET: 14, FAME: 4 }, lose: { NET: -8, STRESS: 12 } } }
    ] },
  { id: 'f_r5', age: [30, 50], w: 5, text: '家族聚会，亲戚们轮流问你赚了多少。你突然很想念小时候那箱苹果。',
    choices: [
      { text: '含糊带过', eff: { STRESS: 5, WILL: 2 }, risk: 1 },
      { text: '如实说，不卑不亢', eff: { WILL: 4, CHA: 3 }, risk: 2 },
      { text: '当场把单买了', eff: { MONEY: -10000000, WILL: 6, NET: 5, CHA: 3 }, risk: 3,
        gamble: { p: 0.5, win: { NET: 8, CHA: 4 }, lose: { MONEY: -5000000, STRESS: 6 } } }
    ] },
  { id: 'f_r6', age: [22, 38], w: 5, text: '堂姐是电视台主持人，她想请你去上一档节目聊聊「逆袭」。',
    choices: [
      { text: '拒绝，低调做人', eff: { WILL: 3 }, risk: 1 },
      { text: '去，讲自己的故事', eff: { FAME: 10, NET: 5, CHA: 3, STRESS: 6 }, risk: 2 },
      { text: '借机宣传自己的事业', eff: { FAME: 15, NET: 8, MONEY: 50000000, STRESS: 10 }, risk: 3,
        gamble: { p: 0.5, win: { FAME: 10, NET: 8 }, lose: { STRESS: 12, FAME: -5 } } }
    ] },

  /* ===== / · 恋爱与妻子 ===== */
  { id: 'f_s1', age: [19, 26], w: 8, text: '大学社团里，有个人总在你画图时递来一杯咖啡。你们开始一起走夜路回宿舍。',
    cond: { ban: ['married'] },
    choices: [
      { text: '保持朋友距离', eff: { WILL: 2, INT: 1 }, risk: 1 },
      { text: '主动约TA周末出去', eff: { CHA: 4, NET: 3, WILL: 3 }, flags: ['dating'], risk: 2 },
      { text: '直接表白', eff: { CHA: 6, NET: 4, WILL: 5, STRESS: 6 }, flags: ['dating'], risk: 3,
        gamble: { p: 0.5, win: { CHA: 8, NET: 6, WILL: 6 }, lose: { STRESS: 10, CHA: -2 } } }
    ] },
  { id: 'f_s2', age: [21, 28], w: 7, text: '你们交往了一年。TA说：要么更进一步，要么就到这里。',
    cond: { need: ['dating'], ban: ['married'] },
    choices: [
      { text: '说再等等', eff: { STRESS: 6, CHA: -2 }, risk: 1 },
      { text: '同居，一起打拼', eff: { WILL: 5, CHA: 3, NET: 4 }, flags: ['cohabit'], risk: 2 },
      { text: '求婚', eff: { WILL: 8, CHA: 5, NET: 5, STRESS: 10 }, flags: ['married'], risk: 3,
        gamble: { p: 0.5, win: { WILL: 8, NET: 8 }, lose: { STRESS: 14, CHA: -4 } } }
    ] },
  { id: 'f_s3', age: [22, 30], w: 6, text: '婚礼很简单，但TA的父母不太满意你「看不见天花板」的出身。',
    cond: { need: ['married'] },
    choices: [
      { text: '用行动证明', eff: { WILL: 6, NET: 3, STRESS: 6 }, risk: 1 },
      { text: '尽量迎合岳父母', eff: { NET: 5, CHA: 3, STRESS: 8 }, flags: ['in_laws_ok'], risk: 2 },
      { text: '坚持自己的方式', eff: { WILL: 7, CHA: 2, STRESS: 10 }, flags: ['in_law_conflict'], risk: 3,
        gamble: { p: 0.45, win: { WILL: 8, NET: 8 }, lose: { STRESS: 12, NET: -5 } } }
    ] },
  { id: 'f_s4', age: [24, 35], w: 7, text: '你们的第一个孩子出生了。你抱着那个小东西，忽然懂了父亲当年的肩膀。',
    cond: { need: ['married'] }, baby: true,
    choices: [
      { text: '请陪产假，好好陪', eff: { WILL: 5, HP: 5, STRESS: -8, MONEY: -3000000 }, risk: 1 },
      { text: '请月嫂，自己继续拼', eff: { MONEY: -8000000, STRESS: 6 }, risk: 2 },
      { text: '把工作暂停半年，亲自带', eff: { MONEY: -20000000, WILL: 8, HP: 6, STRESS: -12 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, HP: 8 }, lose: { MONEY: -10000000, STRESS: 8 } } }
    ] },
  { id: 'f_s5', age: [26, 40], w: 6, text: '孩子上学了。TA想让上国际学校，你想让上普通小学。',
    cond: { need: ['married'], min: { MONEY: 50000000 } },
    choices: [
      { text: '听TA的，上国际学校', eff: { MONEY: -20000000, NET: 4, CHA: 2 }, risk: 1 },
      { text: '各退一步，上好的公立', eff: { MONEY: -8000000, WILL: 3 }, risk: 2 },
      { text: '自己辅导，不花那份钱', eff: { INT: 4, WILL: 4, MONEY: -2000000 }, risk: 3,
        gamble: { p: 0.5, win: { INT: 6, WILL: 4 }, lose: { STRESS: 6 } } }
    ] },
  { id: 'f_s6', age: [28, 45], w: 5, text: 'TA说也想创业/回去工作，不想只做谁的太太/先生。',
    cond: { need: ['married'] },
    choices: [
      { text: '全力支持', eff: { WILL: 4, NET: 4, STRESS: -4 }, risk: 1 },
      { text: '担心钱，劝再想想', eff: { STRESS: 6, WILL: -2 }, risk: 2 },
      { text: '给TA一笔启动资金', eff: { MONEY: -30000000, WILL: 6, NET: 6, CHA: 3 }, flags: ['spouse_biz'], risk: 3,
        gamble: { p: 0.5, win: { MONEY: 150000000, NET: 10 }, lose: { MONEY: -20000000, STRESS: 8 } } }
    ] },
  { id: 'f_s7', age: [30, 48], w: 5, text: '一次出差，旧情人加回了你的联系方式。对方说：要是当年选的是我就好了。',
    cond: { need: ['married'] },
    choices: [
      { text: '礼貌拉黑', eff: { WILL: 5, INT: 2 }, risk: 1 },
      { text: '聊了几句，止于分寸', eff: { STRESS: 8, CHA: 2, NET: 3 }, risk: 2 },
      { text: '真的见了面', eff: { STRESS: 14, WILL: -4, CHA: -3, flags: ['cheat'] }, risk: 3,
        gamble: { p: 0.3, win: { NET: 8, CHA: 5 }, lose: { MONEY: -10000000, CHA: -8, FAME: -6, NET: -10 } } }
    ] },
  { id: 'f_s8', age: [32, 50], w: 5, text: 'TA生病住院，你第一次在医院陪了整夜。TA说：没想到你也会慌。',
    cond: { need: ['married'] },
    choices: [
      { text: '请假全程陪护', eff: { MONEY: -5000000, HP: 3, WILL: 5, STRESS: -6 }, risk: 1 },
      { text: '请护工，自己忙事业', eff: { MONEY: -8000000, STRESS: 8, WILL: -2 }, risk: 2 },
      { text: '把公司交给副手，专心陪TA康复', eff: { MONEY: -30000000, WILL: 8, HP: 5, STRESS: -12, NET: 4 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, HP: 8 }, lose: { MONEY: -10000000, STRESS: 8 } } }
    ] },
  { id: 'f_s9', age: [35, 55], w: 5, text: '你们结婚十周年。TA翻出当年的旧照片，说：那时候我们连婚纱都租不起。',
    cond: { need: ['married'] },
    choices: [
      { text: '补一场婚礼', eff: { MONEY: -15000000, WILL: 5, CHA: 4, STRESS: -8 }, risk: 1 },
      { text: '安静吃顿饭', eff: { WILL: 3, STRESS: -5 }, risk: 2 },
      { text: '送TA一座以TA名字命名的楼', eff: { MONEY: -500000000, WILL: 10, CHA: 8, FAME: 8, STRESS: -10, flags: ['named_building'] }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 12, FAME: 10 }, lose: { MONEY: -200000000, STRESS: 10 } } }
    ] },
  { id: 'f_s10', age: [38, 58], w: 5, text: '孩子要出国留学。TA和你在钱和距离上吵了一架。',
    cond: { need: ['married'], min: { MONEY: 80000000 } },
    choices: [
      { text: '尊重孩子的选择', eff: { WILL: 4, STRESS: -4, MONEY: -50000000 }, risk: 1 },
      { text: '让孩子留在身边', eff: { STRESS: 8, WILL: -2 }, risk: 2 },
      { text: '卖一套房支持TA追梦', eff: { MONEY: -300000000, WILL: 8, NET: 6, STRESS: -6 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, NET: 8 }, lose: { MONEY: -100000000, STRESS: 8 } } }
    ] },
  { id: 'f_s11', age: [40, 60], w: 5, text: 'TA的父母年纪大了，搬来和你们同住。两代人挤在一个屋檐下。',
    cond: { need: ['married'] },
    choices: [
      { text: '尽量包容', eff: { WILL: 5, STRESS: -4 }, risk: 1 },
      { text: '把楼下让给他们住', eff: { MONEY: -20000000, WILL: 4, STRESS: -6 }, risk: 2 },
      { text: '另买一套相邻的公寓', eff: { MONEY: -400000000, WILL: 8, NET: 6, STRESS: -10 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, NET: 8 }, lose: { MONEY: -150000000, STRESS: 8 } } }
    ] },
  { id: 'f_s12', age: [45, 65], w: 5, text: '你们一起回到城中村隔断间旧址。TA笑着说：还好没听我妈的，不然哪有今天。',
    cond: { need: ['married'] },
    choices: [
      { text: '说：是你撑住了我', eff: { WILL: 6, STRESS: -8 }, risk: 1 },
      { text: '默默握紧TA的手', eff: { WILL: 5, STRESS: -6 }, risk: 2 },
      { text: '把那片地买下来留念', eff: { MONEY: -200000000, WILL: 8, FAME: 5, STRESS: -8 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, FAME: 6 }, lose: { MONEY: -80000000, STRESS: 6 } } }
    ] },
  { id: 'f_s13', age: [50, 70], w: 5, text: 'TA先你一步走了。你坐在空荡荡的客厅，第一次觉得别墅太大。',
    cond: { need: ['married'] },
    choices: [
      { text: '把TA的遗物好好收着', eff: { WILL: 5, STRESS: -6 }, risk: 1, widow: true },
      { text: '独自旅行一年', eff: { MONEY: -30000000, WILL: 6, STRESS: -10, HP: 5 }, risk: 2, widow: true },
      { text: '成立以TA命名的奖学金', eff: { MONEY: -300000000, WILL: 8, FAME: 10, flags: ['foundation'] }, risk: 3, widow: true }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_FAMILY);

/* ===== 亲友/孩子/孙辈/宠物/人生（第二波，强化关系与8项指标） ===== */
const EVENTS_FAMILY2 = [
  /* ---- 兄弟姐妹的婚事：替他们选伴侣、张罗 ---- */
  { id: 'f2_sib1', age: [22, 40], w: 5, text: '你的哥哥要结婚了。对方家庭你只见过一次，总觉得门第差得有点远。',
    choices: [
      { text: '劝哥哥再想想', eff: { WILL: 3, SEC: 2 }, risk: 1 },
      { text: '帮忙张罗婚礼', eff: { MONEY: -10000000, LOVE: 3 }, risk: 2 },
      { text: '出面替哥哥把关', eff: { CHA: 4, NET: 3, AUTO: 4 }, risk: 3,
        gamble: { p: 0.5, win: { CHA: 6, NET: 5 }, lose: { STRESS: 8, CHA: -2 } } }
    ] },
  { id: 'f2_sib2', age: [24, 42], w: 4, text: '妹妹交了个你很不放心的男朋友，她说「你别管」。',
    choices: [
      { text: '尊重她的选择', eff: { AUTO: 3, LOVE: 2 }, risk: 1 },
      { text: '旁敲侧击提醒', eff: { WILL: 3, LOVE: -1, SEC: 1 }, risk: 2 },
      { text: '直接摊牌反对', eff: { WILL: 5, LOVE: -4, STRESS: 6 }, risk: 3,
        gamble: { p: 0.45, win: { WILL: 6, SEC: 4 }, lose: { LOVE: -6, STRESS: 10 } } }
    ] },
  { id: 'f2_sib3', age: [26, 45], w: 4, text: '姐姐一家搬去了澳洲，临走前把老家的钥匙交给了你。',
    choices: [
      { text: '收下，常回去看看', eff: { SEC: 4, LOVE: 2 }, risk: 1 },
      { text: '把老屋租出去', eff: { MONEY: 8000000, NET: 2 }, risk: 2 },
      { text: '卖了分钱', eff: { MONEY: 40000000, LOVE: -3, AUTO: 3 }, risk: 3 }
    ] },

  /* ---- 亲戚往来 ---- */
  { id: 'f2_rel1', age: [25, 48], w: 4, text: '表弟要创业，红着脸问你能不能投一点。',
    choices: [
      { text: '婉拒，但送他几句实话', eff: { WILL: 2, NET: 1 }, risk: 1 },
      { text: '借一小笔当启动', eff: { MONEY: -15000000, LOVE: 3 }, risk: 2 },
      { text: '大方入股', eff: { MONEY: -60000000, NET: 4 }, risk: 3,
        gamble: { p: 0.5, win: { MONEY: 180000000, NET: 8 }, lose: { MONEY: -20000000, STRESS: 8 } } }
    ] },
  { id: 'f2_rel2', age: [22, 55], w: 4, text: '远房舅舅做生意失败，找你周转。',
    choices: [
      { text: '量力而行帮一点', eff: { MONEY: -8000000, LOVE: 2 }, risk: 1 },
      { text: '介绍他去别的亲戚那', eff: { NET: 2, AUTO: 1 }, risk: 2 },
      { text: '装作没听见', eff: { STRESS: 4, AUTO: 2 }, risk: 3 }
    ] },
  { id: 'f2_rel3', age: [30, 55], w: 3, text: '家族团聚，二叔当众说你「忘本」。',
    choices: [
      { text: '一笑而过', eff: { WILL: 3, STRESS: -2 }, risk: 1 },
      { text: '私下请二叔喝酒化解', eff: { NET: 3, LOVE: 2 }, risk: 2 },
      { text: '当场回怼', eff: { WILL: 5, CHA: 2, FAME: 2, STRESS: 6 }, risk: 3 }
    ] },

  /* ---- 朋友 ---- */
  { id: 'f2_fr1', age: [22, 36], w: 5, text: '你最好的朋友要结婚，非要你当伴郎/伴娘。',
    choices: [
      { text: '一口答应', eff: { LOVE: 4, CHA: 2 }, risk: 1 },
      { text: '忙，但尽力到场', eff: { LOVE: 1 }, risk: 2 },
      { text: '随个厚礼就算了', eff: { MONEY: -5000000, LOVE: -2 }, risk: 3 }
    ] },
  { id: 'f2_fr2', age: [26, 50], w: 4, text: '朋友离婚，半夜敲开你的门哭了一宿。',
    choices: [
      { text: '陪他熬过这一夜', eff: { LOVE: 4, SEC: 2 }, risk: 1 },
      { text: '帮他找律师', eff: { NET: 3, MONEY: -3000000 }, risk: 2 },
      { text: '劝他想开点', eff: { WILL: 2 }, risk: 3 }
    ] },
  { id: 'f2_fr3', age: [24, 42], w: 4, text: '你给单身的闺蜜/兄弟牵了条线，俩人居然看对眼了。',
    choices: [
      { text: '乐见其成', eff: { LOVE: 3, CHA: 3 }, risk: 1 },
      { text: '暗中帮他们制造机会', eff: { CHA: 4, NET: 2 }, risk: 2 },
      { text: '提醒彼此慢点', eff: { WILL: 2, SEC: 1 }, risk: 3 }
    ] },
  { id: 'f2_fr4', age: [28, 52], w: 3, text: '老同学群里有人发起「毕业二十周年」聚会，AA 制。',
    choices: [
      { text: '去，见见老熟人', eff: { CHA: 3, NET: 2, MONEY: -2000000 }, risk: 1 },
      { text: '转钱但不去', eff: { MONEY: -1000000, NET: 1 }, risk: 2 },
      { text: '假装没看见', eff: { AUTO: 2, STRESS: 1 }, risk: 3 }
    ] },

  /* ---- 孩子的成长里程碑 ---- */
  { id: 'f2_ch1', age: [30, 46], w: 5, cond: { need: ['married'] }, text: '孩子上小学第一天，背着比你当年大十倍的书包。',
    choices: [
      { text: '亲手送进校门', eff: { LOVE: 4, WILL: 2 }, risk: 1 },
      { text: '请家教提前补', eff: { MONEY: -8000000, CUR: 3 }, risk: 2 },
      { text: '放养，让他自己闯', eff: { AUTO: 4, GROW: 3 }, risk: 3,
        gamble: { p: 0.5, win: { GROW: 6, AUTO: 4 }, lose: { STRESS: 6 } } }
    ] },
  { id: 'f2_ch2', age: [38, 54], w: 5, cond: { need: ['married'] }, text: '孩子到了叛逆期，把你的话当耳旁风，门一摔就是一整天。',
    choices: [
      { text: '耐心沟通', eff: { LOVE: 3, WILL: 2, STRESS: 2 }, risk: 1 },
      { text: '立规矩', eff: { WILL: 4, LOVE: -1, AUTO: 1 }, risk: 2 },
      { text: '干脆不理，等他撞墙', eff: { WILL: 5, LOVE: -3, STRESS: 8 }, risk: 3,
        gamble: { p: 0.45, win: { WILL: 7, AUTO: 5 }, lose: { LOVE: -6, STRESS: 12 } } }
    ] },
  { id: 'f2_ch3', age: [40, 56], w: 5, cond: { need: ['married'], min: { MONEY: 30000000 } }, text: '孩子面临高考/升学，补习班的账单像雪片。',
    choices: [
      { text: '砸钱上最好的', eff: { MONEY: -30000000, CUR: 4, STRESS: 4 }, risk: 1 },
      { text: '量力而行', eff: { MONEY: -10000000, WILL: 2 }, risk: 2 },
      { text: '相信孩子自己', eff: { AUTO: 4, GROW: 3, LOVE: 2 }, risk: 3 }
    ] },
  { id: 'f2_ch4', age: [42, 58], w: 4, cond: { need: ['married'] }, text: '孩子第一次带对象回家，你偷偷打量对方的家庭。',
    choices: [
      { text: '热情款待', eff: { LOVE: 3, CHA: 2 }, risk: 1 },
      { text: '保持观察', eff: { WILL: 2, SEC: 1 }, risk: 2 },
      { text: '事后悄悄打听', eff: { NET: 3, STRESS: 2 }, risk: 3 }
    ] },
  { id: 'f2_ch5', age: [45, 66], w: 5, cond: { need: ['married'] }, grand: true, text: '你的孩子结婚了。你站在礼堂最后一排，忽然想起自己当年的那场简陋婚礼。',
    choices: [
      { text: '体面地办一场', eff: { MONEY: -40000000, LOVE: 5, FAME: 2 }, risk: 1 },
      { text: '简简单单', eff: { LOVE: 4, AUTO: 2 }, risk: 2 },
      { text: '倾尽全力撑场面', eff: { MONEY: -120000000, FAME: 4, STRESS: 8 }, risk: 3,
        gamble: { p: 0.5, win: { FAME: 8, NET: 6 }, lose: { MONEY: -30000000, STRESS: 12 } } }
    ] },
  { id: 'f2_ch6', age: [48, 68], w: 3, cond: { need: ['married'] }, text: '孩子事业受挫，拖着行李回来了，说「想在家住一阵」。',
    choices: [
      { text: '敞开家门', eff: { LOVE: 5, SEC: 3 }, risk: 1 },
      { text: '让他先想清楚', eff: { WILL: 3, AUTO: 2 }, risk: 2 },
      { text: '趁机催婚', eff: { LOVE: -2, STRESS: 4 }, risk: 3 }
    ] },

  /* ---- 孙辈 ---- */
  { id: 'f2_gr1', age: [55, 80], w: 5, cond: { need: ['married'], grand: true }, text: '孙辈扑进你怀里，奶声奶气叫了声「爷爷/奶奶」。',
    choices: [
      { text: '高兴地抱起来', eff: { LOVE: 6, SEC: 4, GROW: 2 }, risk: 1 },
      { text: '偷偷塞零花钱', eff: { MONEY: -3000000, LOVE: 3 }, risk: 2 },
      { text: '教他认字', eff: { CUR: 4, GROW: 3 }, risk: 3 }
    ] },
  { id: 'f2_gr2', age: [58, 85], w: 3, cond: { need: ['married'], grand: true }, text: '你带着孙辈去公园喂鸽子，路过的年轻人喊你「好福气」。',
    choices: [
      { text: '享受这天伦', eff: { LOVE: 5, SEC: 3, STRESS: -4 }, risk: 1 },
      { text: '拍张照发朋友圈', eff: { FAME: 2, CHA: 1 }, risk: 2 },
      { text: '顺便讲讲你年轻时的狠事', eff: { WILL: 3, FAME: 1 }, risk: 3 }
    ] },

  /* ---- 岳父母 / 婆媳 ---- */
  { id: 'f2_il1', age: [28, 50], w: 4, cond: { need: ['married'] }, text: '岳母想搬来同住「帮忙带孩子」，你妻子也点头了。',
    choices: [
      { text: '欣然同意', eff: { LOVE: 3, SEC: 2, STRESS: 5 }, risk: 1 },
      { text: '婉拒，说请保姆', eff: { MONEY: -10000000, AUTO: 3, STRESS: -2 }, risk: 2 },
      { text: '坚持分房住', eff: { AUTO: 4, LOVE: -2, STRESS: 4 }, risk: 3 }
    ] },
  { id: 'f2_il2', age: [35, 62], w: 3, cond: { need: ['married'] }, text: '岳父/家公中风住院，治疗和陪护的重担落了下来。',
    choices: [
      { text: '全程守着', eff: { LOVE: 5, SEC: 3, MONEY: -15000000 }, risk: 1 },
      { text: '出钱请护工', eff: { MONEY: -30000000, LOVE: 2 }, risk: 2 },
      { text: '和兄弟姐妹分摊', eff: { NET: 3, STRESS: 4 }, risk: 3 }
    ] },

  /* ---- 宠物 ---- */
  { id: 'f2_pet1', age: [8, 16], w: 6, text: '你在巷口捡到一只瑟瑟发抖的小家伙，眼睛还没睁开。',
    choices: [
      { text: '领养小狗回家', pet: 'dog', eff: { LOVE: 3, SEC: 2 }, risk: 1 },
      { text: '领养小猫回家', pet: 'cat', eff: { LOVE: 3, SEC: 2 }, risk: 1 },
      { text: '送给动物保护协会', eff: { WILL: 3, LOVE: 1 }, risk: 2 }
    ] },
  { id: 'f2_pet2', age: [10, 32], w: 4, cond: { pet: true }, text: '你家的毛孩子趁门缝溜了出去，一整天没回来。',
    choices: [
      { text: '满街贴寻宠启事', eff: { MONEY: -2000000, LOVE: 3, STRESS: 4 }, risk: 1,
        gamble: { p: 0.6, win: { LOVE: 4, SEC: 3 }, lose: { LOVE: -4, STRESS: 6 } } },
      { text: '在门口放碗水和粮', eff: { WILL: 2, LOVE: 1 }, risk: 2 },
      { text: '认命，不再等', eff: { WILL: 2, LOVE: -3, STRESS: 4 }, risk: 3 }
    ] },
  { id: 'f2_pet3', age: [42, 78], w: 4, cond: { pet: true }, petDeath: true, text: '陪了你大半辈子的老伙伴，这阵子连楼梯都爬不动了。',
    choices: [
      { text: '陪它走完最后一程', eff: { WILL: 4, STRESS: -2, LOVE: 2 }, risk: 1 },
      { text: '请医生让它少受苦', eff: { MONEY: -5000000, WILL: 3, STRESS: -4 }, risk: 2 },
      { text: '不敢面对，交给别人', eff: { WILL: -2, STRESS: 6, LOVE: -2 }, risk: 3 }
    ] },

  /* ---- 一般人生（强化新指标） ---- */
  { id: 'f2_lf1', age: [18, 42], w: 5, text: '你报了个夜校的插花/编程班，下班后多了一处去处。',
    choices: [
      { text: '认真学一门', eff: { CUR: 5, AUTO: 3 }, risk: 1 },
      { text: '随便听听', eff: { CUR: 2 }, risk: 2 },
      { text: '拉着同事一起', eff: { NET: 3, CHA: 2, CUR: 2 }, risk: 3 }
    ] },
  { id: 'f2_lf2', age: [20, 60], w: 4, text: '社区招募志愿者，去敬老院陪老人说话。',
    choices: [
      { text: '每周去一次', eff: { LOVE: 4, SEC: 2, GROW: 2 }, risk: 1 },
      { text: '偶尔参加', eff: { LOVE: 2 }, risk: 2 },
      { text: '捐钱了事', eff: { MONEY: -3000000, LOVE: 1 }, risk: 3 }
    ] },
  { id: 'f2_lf3', age: [22, 55], w: 4, text: '你请了年假，一个人去了没去过的城市。',
    choices: [
      { text: '随性漫游', eff: { AUTO: 4, CUR: 4, STRESS: -4 }, risk: 1 },
      { text: '做足攻略', eff: { CUR: 3, WILL: 2 }, risk: 2 },
      { text: '报个高端团', eff: { MONEY: -20000000, FAME: 2, STRESS: -2 }, risk: 3 }
    ] },
  { id: 'f2_lf4', age: [40, 56], w: 4, text: '人到中年，你忽然不知道自己这些年到底在追什么。',
    choices: [
      { text: '找老友深谈', eff: { LOVE: 3, SEC: 3, STRESS: -3 }, risk: 1 },
      { text: '去做心理咨询', eff: { MONEY: -5000000, SEC: 4, STRESS: -4 }, risk: 2 },
      { text: '硬扛过去', eff: { WILL: 4, STRESS: 6 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 6, AUTO: 4 }, lose: { STRESS: 10, HP: -3 } } }
    ] },
  { id: 'f2_lf5', age: [30, 60], w: 3, text: '你决定原谅一个多年前伤害过你的人。',
    choices: [
      { text: '当面握手言和', eff: { LOVE: 4, SEC: 4, CHA: 2 }, risk: 1 },
      { text: '在心里放下', eff: { WILL: 4, SEC: 3, STRESS: -3 }, risk: 2 },
      { text: '装作没事，其实没忘', eff: { WILL: 1, STRESS: 2 }, risk: 3 }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_FAMILY2);

/* =========================================================
 * 年代事件库 · 按「公历年份窗口」触发
 * 出生年份决定你在什么年纪遇到它们——1955 年 生的人童年在废墟与农田基建里，
 * 1995 年 生的人童年在智能手机与韩流里。每个人生都是独一份的年代切片。
 * ========================================================= */
const EVENTS_ERA = [
  { id: 'y1960', age: [3, 18], w: 10, once: true, era: true, text: '战后的这座城还在重建。你排队领过救济面粉，也在废墟边上放过风筝。大人们说：熬过这段就好了。',
    cond: { yearMin: 1958, yearMax: 1963 },
    eff: { WILL: 5, SEC: -3 } },
  { id: 'y1970', age: [5, 65], w: 9, once: true, era: true, text: '农田基建。家乡的土路变成了柏油路，村口立起了「勤劳 · 自强」的牌子。母亲说：路通了，人就活了。',
    cond: { yearMin: 1968, yearMax: 1973 },
    eff: { SEC: 4, WILL: 2 } },
  { id: 'y1973', age: [8, 65], w: 9, once: true, era: true, text: '第一次石油危机。加油站排起长队，工厂的烟囱矮了一半。家里的灯，入夜后只准开一盏。',
    cond: { yearMin: 1973, yearMax: 1975 },
    eff: { SEC: -5, INT: 3, WILL: 3 } },
  { id: 'y1979', age: [14, 65], w: 8, once: true, era: true, text: '那个冬天，电视里频繁出现「戒严」「更迭」的字样。大人们压低声音说话，你在写作业的间隙抬头看了一眼。',
    cond: { yearMin: 1979, yearMax: 1981 },
    eff: { INT: 5, SEC: -6, WILL: 3 } },
  { id: 'y1988', age: [5, 60], w: 10, once: true, era: true, text: '奥运。江上的桥一座接一座地通车，老师在黑板上写下四个字：江奇迹。',
    cond: { yearMin: 1988, yearMax: 1989 },
    eff: { FAME: 3, WILL: 4, SEC: 5 } },
  { id: 'y1995', age: [8, 65], w: 8, once: true, era: true, text: '1995年，这座城的一场大坍塌让整个国家沉默。电视里循环播放着救援画面。你第一次意识到：钢筋水泥也会说谎。',
    cond: { yearMin: 1994, yearMax: 1996 },
    eff: { SEC: -5, WILL: 5, LOVE: 3 } },
  { id: 'y2000', age: [16, 55], w: 8, once: true, era: true, text: '新千年的钟声。风险投资的钱像潮水一样涌进滨江的写字楼，随便一份 PPT 就能换到几亿元。',
    cond: { yearMin: 2000, yearMax: 2001 },
    eff: { INT: 4, CUR: 6, AUTO: 3 } },
  { id: 'y2010', age: [14, 65], w: 8, once: true, era: true, text: '智能手机元年。地铁里的人忽然都低下了头。你也不例外——但你比别人多看见了一层：注意力，就是钱。',
    cond: { yearMin: 2010, yearMax: 2012 },
    eff: { INT: 4, CUR: 5, AUTO: 2 } },
  { id: 'y2016', age: [10, 80], w: 7, once: true, era: true, text: '一个会下棋的 AI 赢了人类世界冠军。棋院里的老人们直摇头，而你听见的，是另一个时代开门的声音。',
    cond: { yearMin: 2016, yearMax: 2017 },
    eff: { INT: 4, CUR: 6 } },
  { id: 'y2024', age: [10, 85], w: 7, once: true, era: true, text: '又一个春天。江边的樱花照常开，人们在讨论 AI、利率和房价。你发现：每个时代，都有属于它的下一场。',
    cond: { yearMin: 2024, yearMax: 2026 },
    eff: { CUR: 4, WILL: 3, SEC: 2 } }
];
EVENTS.push.apply(EVENTS, EVENTS_ERA);

/* ---------------- 善事：道德不是只能往下掉，也可以主动攒 ---------------- */
const GOOD_DEEDS = [
  {
    id: 'g_return', name: '把捡到的钱包还回去', icon: '👛', minAge: 10,
    desc: '里面有现金和身份证。你在原地等了四十分钟。',
    eff: { ETH: 7, WILL: 2, MOOD: 4, LOVE: 2 }, cost: 0
  },
  {
    id: 'g_elder', name: '去福利院陪老人半天', icon: '🏛', minAge: 10,
    desc: '有个奶奶一直拉着你的手，说你像她孙子。',
    eff: { ETH: 4, LOVE: 4, MOOD: 3, SEC: 2, NET: 1 }, cost: 0
  },
  {
    id: 'g_apology', name: '向被你亏欠的人道歉', icon: '🙏', minAge: 12,
    desc: '那条消息写了删、删了写。发出去之后，你反而轻松了。',
    eff: { ETH: 6, WILL: 3, MOOD: 5, STRESS: -5, LOVE: -1 }, cost: 0
  },
  {
    id: 'g_volunteer', name: '周末去做志愿者', icon: '🧡', minAge: 14,
    desc: '红马甲、地铁站、一天站八小时。你说的「谢谢」比这辈子都多。',
    eff: { ETH: 5, NET: 3, LOVE: 2, MOOD: 3, HP: -2 }, cost: 0
  },
  {
    id: 'g_quit', name: '戒掉一个坏习惯', icon: '🚭', minAge: 14,
    desc: '烟、酒、熬夜、刷短视频。最难的不是第一天，是第七天。',
    eff: { ETH: 3, WILL: 5, HP: 4, STRESS: -6 }, cost: 0
  },
  {
    id: 'g_blood', name: '去献一次血', icon: '🩸', minAge: 18,
    desc: '护士说：你这血型最近很缺。你躺在那儿，觉得这半天没白活。',
    eff: { ETH: 4, HP: -3, MOOD: 3, FAME: 1 }, cost: 0
  },
  {
    id: 'g_donate', name: '匿名捐一笔钱', icon: '💰', minAge: 18,
    desc: '汇款单上「捐赠人」那一栏，你写了「一个路过的人」。',
    eff: { ETH: 6, LOVE: 3, MOOD: 4, SEC: 1, FAME: 1 }, cost: 6000000
  },
  {
    id: 'g_teach', name: '去山区支教一学期', icon: '📚', minAge: 20,
    desc: '四十个学生，两个年级，一间教室。你第一次知道「老师」两个字有多重。',
    eff: { ETH: 8, INT: 2, FAME: 3, LOVE: 4, WILL: 4, STRESS: 5 }, cost: 3000000
  }
];

/* ---------------- 减压行动：压力只能进不能出，是「压力棘轮」这个比喻成立的地方 ----------------
 *
 * 与 GOOD_DEEDS 同构（id/name/icon/minAge/desc/eff/cost），可直接复用卡片 UI，但三处刻意不同：
 *
 *   1. **三条共享一个年度额度**（state.relaxUsedYear），而善事是「每件各一次」（goodTouch）。
 *      若各一次，理论年减压 −38，叠加恢复公式会把 STRESS 打到 0，压力系统失去意义。
 *      共享额度下理论最优 −16，且玩家必须在「社交 / 身体 / 专业帮助」之间做选择 —— 这个选择本身就是设计内容。
 *
 *   2. **socialAct 与 GOOD_DEEDS 都不占这个额度**。语义切分：
 *        socialAct  = 维护一段**具体关系**（有对象、有反馈）
 *        GOOD_DEEDS = **对外付出**（攒道德）
 *        RELAX_ACTS = **照顾自己**（无对象、即时生效）
 *
 *   3. **r_court 有 55+ 分支**（羽毛球 → 公园太极/广场舞），且 55+ 免费。
 *      硬约束：穷人永远要有一件能做的事，否则减压就成了付费功能。
 *
 * 金额口径：内部量级，÷180 为人民币（与全局一致）。
 *
 * ⚠ 三条减压量（−12 / −10 / −16）是 stress-respec.md §2.③ 的定稿值，
 *   与 §3 的稳态推演（B = 22 = 7 恢复 + 12 减压 + 3 自住房）绑定。改这里必须同步重跑 S-1 / S-2。
 */
const RELAX_ACTS = [
  {
    id: 'r_friends', name: '攒一个老友饭局', icon: '🍲', minAge: 20,
    desc: '八个人，一张圆桌，一半的人你三年没见了。酒过三巡，有人说起当年，所有人都在笑，笑完又安静了。',
    eff: { STRESS: -12, LOVE: 4, MOOD: 4, HP: 2, NET: 2 },
    cost: 3000000,                       // ≈1.7 万 RMB
    cond: { min: { NET: 20 } },          // 得叫得出人来
    condMsg: '你现在叫不出八个人'         // E-4：这句话本身就是叙事，不要换成「人脉不足」
  },
  {
    id: 'r_court', name: '出一身汗', icon: '🏸', minAge: 16,
    desc: '羽毛球馆的下午场，四十块一人。打到第三局你什么也不想了，只听见球拍破空的声音。',
    eff: { STRESS: -10, HP: 6, STR: 2, MOOD: 3 },
    cost: 800000,                        // ≈0.44 万 RMB
    lateAge: 55,                         // 55 岁起：文案与开销切换为公园里的那套
    descLate: '公园的空地上，第七套广播体操的音乐准时响起。你站在第二排，动作比谁都标准。',
    lateEff: { STRESS: -10, HP: 5, STR: 1, LOVE: 3, NET: 2 },
    lateCost: 0                          // ⚠ 免费是硬约束：保证穷人永远有一件能做的事（E-2）
  },
  {
    id: 'r_counsel', name: '去看一次心理门诊', icon: '🫂', minAge: 18,
    desc: '挂号单上写着「临床心理科」。候诊区坐满了人，有穿校服的，有抱孩子的，也有和你一样穿着上班的衣服。你忽然不那么紧张了——原来这里不是只有「有问题的人」才来。走出去的时候，你第一次把那件事完整地说给了一个人听。',
    eff: { STRESS: -16, HP: 2, MOOD: 5, INT: 2, SEC: 2 },
    cost: 12000000,                      // ≈6.7 万 RMB（自费心理咨询的真实量级）
    flags: ['counseled']                 // 可在晚年事件 / 遗嘱里回收为叙事线索
  }
];

/* ⚠ A-06 的 `JOB_ALIAS` 映射表**不在这里** —— 它在 `career.js:392`，与 `setJob()` 放在一起
 * （IMP-01 就实现了）。曾经有人（包括我）想把它挪到 data.js，那是错的：
 * 它引用的 `careerById()` 在 career.js，且 `setJob()` 才是唯一写入口。别再复制一份。 */

/* ---------------- 朋友圈类型（人际关系卡片） ---------------- */
/* ageGap：相对「你」的年龄差区间。恩师必须年长一辈，同事/生意伙伴跨度更大 */
const FRIEND_TYPES = [
  { key: 'childhood', avatar: '🧑‍🤝‍🧑', label: '发小', pass: { LOVE: 0.5 }, line: '每年关爱 +', from: 5, ageGap: [-1, 2] },
  { key: 'colleague', avatar: '👔', label: '同事', pass: { LOY: 0.5 }, line: '每年职场口碑 +', from: 17, needCareer: true, ageGap: [-7, 9] },
  { key: 'biz', avatar: '🤝', label: '生意伙伴', pass: { MONEY: 250000 }, line: '每年现金 +', from: 24, needCareer: true, ageGap: [-9, 13] },
  { key: 'neighbor', avatar: '🏘', label: '老友', pass: { HP: 0.4 }, line: '每年健康 +', from: 38, ageGap: [-5, 8] },
  { key: 'teacher', avatar: '👩‍🏫', label: '恩师', pass: { INT: 0.4 }, line: '每年智力 +', from: 7, to: 23, ageGap: [16, 30] }
];

/* ---------------- 称号（按人生阶段显示身份） ---------------- */
const TITLES = [
  { min: 0, max: 6, name: '婴儿' },
  { min: 7, max: 12, name: '小学生' },
  { min: 13, max: 15, name: '初中生' },
  { min: 16, max: 18, name: '高中生' },
  { min: 19, max: 200, name: '' }
];

/* =========================================================
 * 三选一文案模板 · 按事件语义生成，不再千篇一律
 * 事件可用 t:'tag' 显式指定语义；未指定时由 engine 依据 eff 主属性推断。
 * 每组三句依次对应：低风险 / 中风险 / 高风险
 * ========================================================= */
const CHOICE_TEMPLATES = {
  study: [
    ['沉下心把它啃明白', '照常上课，按部就班', '熬夜突击，赌一次大的'],
    ['去问老师，别装懂', '自己再想想', '通宵硬刚，眼睛红了也不停'],
    ['借同学的笔记补一补', '就这样吧，明天再说', '把整本书撕成三份，一天背完'],
    ['报个辅导班补短板', '照常刷题', '押题，押中就是天堂']
  ],
  work: [
    ['稳妥推进，先交差', '按流程做完', '通宵赶工，抢在所有人前面'],
    ['先请示一下上级', '照常处理', '越级汇报，赌一把赏识'],
    ['把风险写进邮件里', '做好自己这份', '全揽下来，出事我担'],
    ['推给更合适的人', '自己干完', '主动请缨，干不好就走人']
  ],
  love: [
    ['把话说清楚', '随缘，慢慢来', '直接表白，不管结果'],
    ['先做朋友，再看看', '保持现状', '今晚就去找 TA'],
    ['送点不贵但用心的东西', '照常联系', '倾其所有，办一场大的'],
    ['克制一点，别越界', '照常相处', '豁出去，说出那句话']
  ],
  money: [
    ['先留够过冬的钱', '照常花销', '把能动的都押上去'],
    ['只投一小笔试试', '按计划来', '梭哈，成王败寇'],
    ['货比三家再决定', '照常买', '刷卡，不看价格'],
    ['找人合伙分摊风险', '自己承担', '借钱也要拿下']
  ],
  health: [
    ['去医院好好查一次', '扛一扛，应该没事', '不管它，先把事做完'],
    ['请假休息两天', '照常上班', '硬撑，谁劝跟谁急'],
    ['开始锻炼，慢慢养', '维持现状', '猛练一把，疼也要练'],
    ['把酒局推了', '照常赴约', '喝到天亮，反正还年轻']
  ],
  family: [
    ['坐下来好好说', '照常过日子', '摊牌，把话全说出来'],
    ['先退一步', '维持原样', '据理力争，寸步不让'],
    ['多陪陪他们', '照常联系', '放下一切，立刻回家'],
    ['托亲戚从中说和', '等着看情况', '当面把旧账算清楚']
  ],
  social: [
    ['礼貌地应下来', '照常相处', '主动凑上去，搏个脸熟'],
    ['保持距离，先观察', '顺其自然', '当场表态，站到明面上'],
    ['请对方吃顿饭', '照常来往', '把人脉一次性用足'],
    ['婉拒，留个好印象', '照常应付', '硬着头皮接下这活']
  ],
  risk: [
    ['先看看再说', '照常应对', '赌一把，赢了就翻身'],
    ['退到安全线外', '硬着头皮上', '把所有筹码推上桌'],
    ['找人一起分担', '自己扛', '单挑，谁怕谁'],
    ['留一条退路', '走一步看一步', '不留退路，才有活路']
  ],
  moral: [
    ['按规矩办', '照常处理', '打擦边球，快一点'],
    ['公开透明地做', '闷声做完', '走捷径，反正没人看见'],
    ['拒绝这笔好处', '拿了，但不声张', '照单全收，先落袋为安'],
    ['把话挑明，宁可吃亏', '睁一只眼闭一只眼', '既然都这样，那就别怪我']
  ],
  default: [
    ['谨慎一点', '照常应对', '豁出去'],
    ['先稳住局面', '按部就班', '赌一把大的'],
    ['留三分余地', '照常走下去', '把一切押上'],
    ['低调度过', '照常', '冲一次，不留遗憾']
  ]
};

/* ---------------- v6.2.2 未成年选项文案池 ----------------
 * 13-17 岁还在读书，「先请示上级」「照常上班」这类成人口吻会瞬间出戏。
 * 未成年走这套学生口吻；work/money 标签在未成年期重映射（见 engine.choiceTexts）。 */
const CHOICE_TEMPLATES_MINOR = {
  family: [
    ['乖乖写作业，听爸妈的话', '照常过日子', '把心里话全说出来'],
    ['主动帮家里干活', '装作没听见', '当面把委屈讲清楚'],
    ['放学就往家跑，多陪陪他们', '照常', '攒零花钱给他们买点东西'],
    ['听爷爷奶奶的话', '随他们去', '缠着他们讲过去的故事']
  ],
  love: [
    ['把这份心动写进日记', '照常做同学', '鼓起勇气递纸条'],
    ['先当好朋友', '保持距离', '放学绕远路，就为多看一眼'],
    ['借笔记制造说话的机会', '默默关注', '在毕业册上写下名字'],
    ['克制住，别影响学习', '顺其自然', '约对方一起自习']
  ],
  social: [
    ['礼貌地问好', '照常相处', '主动约放学一起走'],
    ['分享零食和漫画', '点头之交', '把秘密告诉 TA'],
    ['帮 TA 补功课', '各玩各的', '组队参加比赛'],
    ['婉拒，回教室写作业', '应付两句', '硬着头皮答应下来']
  ],
  health: [
    ['告诉爸妈，去医院', '扛一扛应该没事', '偷偷藏起来不说'],
    ['请假在家休息', '继续上课', '咬着牙跑完全程'],
    ['听医生的话好好养', '该吃吃该玩玩', '拆了线就去打球'],
    ['早点睡觉', '熬夜看小说', '通宵打游戏']
  ],
  moral: [
    ['交给老师处理', '装作没看见', '偷偷留下'],
    ['说实话，挨骂也认', '含糊过去', '撒一个圆不回来的谎'],
    ['把多找的钱还回去', '揣进兜里', '请全班吃辣条'],
    ['拉被抄作业的同学一把', '睁一只眼闭一只眼', '把答案卖给他们']
  ],
  default: [
    ['先想想后果', '照常', '豁出去'],
    ['听爸妈的话', '按自己的想法来', '赌一把大的'],
    ['跟老师商量', '自己拿主意', '不鸣则已，一鸣惊人'],
    ['安稳度过', '照常上学', '干一件大事']
  ]
};

/* ---------------- 考试常识题库（中考/高考各抽 5 题） ---------------- */
/* a: 正确选项下标（0-3） */
const EXAM_QUIZ = [
  { q: '水的化学式是？', opts: ['CO₂', 'H₂O', 'O₂', 'NaCl'], a: 1 },
  { q: '一年中白昼最长的那天叫？', opts: ['冬至', '夏至', '春分', '秋分'], a: 1 },
  { q: '《静夜思》的作者是？', opts: ['杜甫', '白居易', '李白', '王维'], a: 2 },
  { q: '光在真空中的速度约为？', opts: ['3×10⁵ km/s', '3×10³ km/s', '3×10⁸ km/s', '3×10⁶ km/s'], a: 0 },
  { q: '中国面积最大的省级行政区是？', opts: ['西藏', '内蒙古', '青海', '新疆'], a: 3 },
  { q: '「负荆请罪」的主角是谁？', opts: ['廉颇', '韩信', '岳飞', '荆轲'], a: 0 },
  { q: '人体最大的器官是？', opts: ['肝脏', '肺', '皮肤', '大脑'], a: 2 },
  { q: '圆周率 π 精确到小数点后两位是？', opts: ['3.14', '3.41', '2.14', '3.12'], a: 0 },
  { q: '《红楼梦》的作者是？', opts: ['罗贯中', '曹雪芹', '吴承恩', '施耐庵'], a: 1 },
  { q: '地球上含量最多的气体是？', opts: ['氧气', '二氧化碳', '氮气', '氢气'], a: 2 },
  { q: '世界上最高的山峰是？', opts: ['乔戈里峰', '珠穆朗玛峰', '富士山', '阿尔卑斯山'], a: 1 },
  { q: '「纸上得来终觉浅」的下一句是？', opts: ['绝知此事要躬行', '病树前头万木春', '柳暗花明又一村', '一览众山小'], a: 0 },
  { q: '植物进行光合作用主要吸收哪种光？', opts: ['红光和蓝紫光', '绿光', '紫外光', '红外光'], a: 0 },
  { q: '中国第一个统一王朝是？', opts: ['商朝', '周朝', '秦朝', '汉朝'], a: 2 },
  { q: '声音在哪种介质中传播最快？', opts: ['空气', '水', '钢铁', '真空'], a: 2 },
  { q: '勾股定理中，直角边为 3 和 4 时斜边是？', opts: ['6', '5', '7', '4.5'], a: 1 },
  { q: '「卧薪尝胆」说的是哪位君王？', opts: ['夫差', '勾践', '刘邦', '李世民'], a: 1 },
  { q: ' DNA 的中文全称是？', opts: ['蛋白质', '脱氧核糖核酸', '核糖核酸', '氨基酸'], a: 1 },
  { q: '长江流入的海是？', opts: ['黄海', '渤海', '东海', '南海'], a: 2 },
  { q: '一光年是什么单位？', opts: ['时间', '距离', '速度', '亮度'], a: 1 },
  { q: '「四面楚歌」与哪位人物有关？', opts: ['项羽', '曹操', '荆轲', '赵括'], a: 0 },
  { q: '摄氏 0 度时水会？', opts: ['沸腾', '结冰', '蒸发', '不变'], a: 1 },
  { q: '中国首位进入太空的航天员是？', opts: ['聂海胜', '杨利伟', '翟志刚', '景海鹏'], a: 1 },
  { q: '正方体有几条棱？', opts: ['8', '10', '12', '16'], a: 2 },
  { q: '「但愿人长久，千里共婵娟」写的是哪个节日？', opts: ['清明', '重阳', '中秋', '元宵'], a: 2 },
  { q: '血液中运输氧气的细胞是？', opts: ['白细胞', '血小板', '红细胞', '淋巴细胞'], a: 2 },
  { q: '四大发明不包括？', opts: ['造纸术', '火药', '地动仪', '指南针'], a: 2 },
  { q: '地球自转一圈大约是？', opts: ['12 小时', '24 小时', '30 小时', '365 天'], a: 1 },
  { q: '「背水一战」的典故出自哪场战役？', opts: ['井陉之战', '赤壁之战', '官渡之战', '巨鹿之战'], a: 0 },
  { q: '太阳系中体积最大的行星是？', opts: ['土星', '木星', '天王星', '海王星'], a: 1 },
  { q: '「之乎者也」中的「之」常作什么词？', opts: ['动词', '代词或助词', '量词', '叹词'], a: 1 },
  { q: '三角形内角和是多少度？', opts: ['90°', '180°', '270°', '360°'], a: 1 },
  { q: '《史记》的作者是？', opts: ['司马光', '班固', '司马迁', '陈寿'], a: 2 },
  { q: '光合作用释放的气体主要是？', opts: ['二氧化碳', '氧气', '氮气', '甲烷'], a: 1 },
  { q: '五岳中位于陕西省的是？', opts: ['华山', '泰山', '衡山', '恒山'], a: 0 },
  { q: '「破釜沉舟」出自谁的故事？', opts: ['韩信', '项羽', '刘邦', '孙膑'], a: 1 },
  { q: '维生素 C 含量最高的通常是？', opts: ['新鲜蔬果', '大米', '猪肉', '食用油'], a: 0 },
  { q: '中国最长的河流是？', opts: ['黄河', '长江', '珠江', '黑龙江'], a: 1 },
  { q: '牛顿第一定律也叫？', opts: ['万有引力定律', '惯性定律', '作用力定律', '能量守恒'], a: 1 },
  { q: '「三顾茅庐」请的是谁？', opts: ['庞统', '诸葛亮', '司马懿', '周瑜'], a: 1 },
  { q: '水的密度约为多少克/立方厘米？', opts: ['0.5', '1', '1.5', '2'], a: 1 },
  { q: '「完璧归赵」中「璧」指的是？', opts: ['和氏璧', '夜明珠', '玉玺', '铜镜'], a: 0 },
  { q: '中国海拔最高的高原叫？', opts: ['云贵高原', '黄土高原', '青藏高原', '内蒙古高原'], a: 2 },
  { q: '键盘上 Ctrl+C 的功能是？', opts: ['粘贴', '复制', '剪切', '撤销'], a: 1 },
  { q: '「床前明月光」的下一句是？', opts: ['疑是地上霜', '低头思故乡', '举头望明月', '对影成三人'], a: 0 },
  { q: '人体正常体温大约是？', opts: ['35℃', '36.5℃', '38℃', '39.5℃'], a: 1 },
  { q: '十二生肖排在第一的是？', opts: ['牛', '虎', '鼠', '龙'], a: 2 },
  { q: '鸦片战争的起止年份是？', opts: ['1839-1842', '1840-1842', '1856-1860', '1894-1895'], a: 1 },
  { q: '声音的音调高低取决于？', opts: ['振幅', '频率', '音色', '响度'], a: 1 },
  { q: '奥运会五环的颜色不包括？', opts: ['蓝色', '黑色', '紫色', '黄色'], a: 2 },
  { q: '中国第一部诗歌总集是？', opts: ['《楚辞》', '《诗经》', '《乐府诗集》', '《全唐诗》'], a: 1 }
];

/* =========================================================
 * v6.0.0 扩展包（内容追加，不改动既有结构）
 *  - EVENTS_FEST   节日主题事件（fest: true，每年可重复触发，权重加成）
 *  - EVENTS_NEWS   突发新闻事件（eff.newsK 联动次年股市/楼市情绪）
 *  - EVENTS_CRIME  违法与监狱事件（监狱系统）
 *  - EVENTS_PRISON 服刑期间专属事件
 *  - SUPER_QUIZ    超级大脑高难度题库
 *  - GIFT_CATALOG  礼物目录（走亲访友送礼）
 *  - TOMBSTONES    多款式墓碑结算页
 * ========================================================= */

/* ---------------- 节日事件（fest: 可重复触发） ---------------- */
const EVENTS_FEST = [
  { id: 'ft_cny_kid', fest: true, age: [3, 14], w: 9, text: '过年了。鞭炮声从凌晨响到天亮，你攥着压岁钱数了三遍，一分都没舍得花。',
    eff: { MOOD: 6, LOVE: 3, SEC: 2 } },
  { id: 'ft_cny_home', fest: true, age: [20, 58], w: 9, cond: {}, text: '除夕。你抢到（或没抢到）回家的票，挤在人潮里往家赶。桌上的饺子永远是妈妈包的那个味道。',
    eff: { LOVE: 5, MOOD: 5, STRESS: -6 } },
  { id: 'ft_cny_old', fest: true, age: [59, 120], w: 8, text: '又是除夕。孩子们都回来了，屋里好久没这么吵过。你坐在主位上，看着满桌的人，忽然想起很多年前的自己。',
    eff: { MOOD: 6, LOVE: 4 } },
  { id: 'ft_cny_cost', fest: true, age: [26, 55], w: 6, text: '过年=过关：给长辈的、给孩子的、同学聚会的份子钱……年过完了，钱包也空了。',
    eff: { MONEY: -1200000, NET: 3, LOVE: 3, STRESS: 4 } },
  { id: 'ft_lantern', fest: true, age: [5, 15], w: 6, text: '元宵节的灯会。你举着兔子灯在人群里钻来钻去，差点走丢。',
    eff: { MOOD: 5, CUR: 2 } },
  { id: 'ft_qingming', fest: true, age: [16, 120], w: 7, text: '清明。你跟家里人回乡扫墓。山上的风很凉，父亲指着碑上的名字，给你讲你没见过的人的故事。',
    eff: { WILL: 2, LOVE: 3, STRESS: -3 } },
  { id: 'ft_duanwu', fest: true, age: [6, 18], w: 6, text: '端午节。外婆包的粽子一打开满屋芦叶香，你在江边看龙舟，嗓子都喊哑了。',
    eff: { MOOD: 5, HP: 2, LOVE: 2 } },
  { id: 'ft_qixi_s', fest: true, age: [18, 40], w: 6, cond: { ban: ['married'] }, text: '七夕。街上的花店排起长队，你一个人走过去，假装在等一条消息。',
    eff: { MOOD: -3, CHA: 1 } },
  { id: 'ft_qixi_c', fest: true, age: [20, 60], w: 6, cond: { need: ['married'] }, text: '七夕。你和另一半挤出时间吃了顿饭，老夫老妻了，还是要过一过这种日子。',
    eff: { MOOD: 4, LOVE: 3 } },
  { id: 'ft_mid_autoon', fest: true, age: [22, 55], w: 6, text: '中秋你在加班/堵在回家的路上。月亮升起来的时候，你抬头看了一眼，把没说完的祝福发给了家人。',
    eff: { STRESS: 4, LOVE: 3, MOOD: 2 } },
  { id: 'ft_mid_moon', fest: true, age: [8, 16], w: 6, text: '中秋。全家人在阳台上分一块月饼，你抢到了蛋黄的那一块。',
    eff: { MOOD: 6, LOVE: 4 } },
  { id: 'ft_national', fest: true, age: [6, 22], w: 6, text: '十一黄金周。阅兵（或旅行人潮）刷了满屏，你为国家骄傲，也为抢不到的火车票发愁。',
    eff: { MOOD: 4, FAME: 1 } },
  { id: 'ft_double11', fest: true, age: [18, 45], w: 5, text: '双十一。零点你守着购物车清空了它，第二天看着账单陷入沉思。',
    eff: { MONEY: -500000, MOOD: 4 } },
  { id: 'ft_winter', fest: true, age: [10, 30], w: 5, text: '冬至。北方吃饺子，南方喝汤圆。你吃到了自己那一份，胃和心都暖了。',
    eff: { MOOD: 4, HP: 2 } },
  { id: 'ft_birthday', fest: true, age: [4, 120], w: 5, text: '你的生日。有人记得，有人忘了。吹蜡烛之前你许了一个愿望，没告诉任何人。',
    eff: { MOOD: 5, WILL: 1 } }
];
EVENTS.push.apply(EVENTS, EVENTS_FEST);

/* ---------------- 突发新闻事件（newsK：联动次年股市情绪） ---------------- */
const EVENTS_NEWS = [
  { id: 'nw_bull', age: [18, 90], w: 5, text: '财经新闻：监管释放重大利好，分析师集体上调目标价，全城的营业部又热闹了起来。',
    eff: { newsK: 0.12, MOOD: 3 } },
  { id: 'nw_crash', age: [18, 90], w: 5, text: '突发：外围市场深夜暴跌，避险情绪蔓延。你盯着开盘倒计时，手心全是汗。',
    eff: { newsK: -0.13, STRESS: 5 } },
  { id: 'nw_rate', age: [20, 90], w: 4, text: '央行宣布降息。存款利息变薄了，房贷压力轻了一点，售楼处的人多起来了。',
    eff: { newsK: 0.08 } },
  { id: 'nw_housetight', age: [22, 80], w: 4, text: '新一轮楼市调控出台：限购加码、房贷收紧。中介的电话一夜之间全变了语气。',
    eff: { newsK: -0.06, houseK: -0.08 } },
  { id: 'nw_ai', age: [22, 90], w: 4, text: '科技新闻：国产大模型发布会刷屏，「下一个时代」这个词又出现了。算力板块集体涨停。',
    eff: { newsK: 0.10, CUR: 2 } },
  { id: 'nw_chip', age: [20, 90], w: 4, text: '国际新闻：芯片出口管制升级。新闻联播用了很长的篇幅，半导体人的朋友圈一夜白头。',
    eff: { newsK: -0.09, WILL: 2 } },
  { id: 'nw_ev', age: [22, 90], w: 4, text: '产业新闻：新能源车渗透率过半，加油站开始改充电桩。时代换挡的声音，你听得清清楚楚。',
    eff: { newsK: 0.07, CUR: 1 } },
  { id: 'nw_aging', age: [30, 90], w: 4, text: '人口新闻：养老产业五年规划发布。你在新闻里看到了自己几十年后的样子，和它的万亿市场。',
    eff: { newsK: 0.05, WILL: 1 } },
  { id: 'nw_epidemic', age: [16, 90], w: 3, text: '突发公共卫生事件：确诊病例上升，口罩和退烧药又抢断了货。你囤了两周的菜。',
    eff: { newsK: -0.11, HP: -3, STRESS: 6 } },
  { id: 'nw_gold', age: [20, 90], w: 4, text: '金价创历史新高。金店门口排起长队，大妈们又一次赢了。',
    eff: { newsK: 0.04, MOOD: 2 } },
  { id: 'nw_boom', age: [18, 90], w: 4, text: '利好出尽：前期涨太猛的板块集体回调，「专家」们开始改口。你学到了一课。',
    eff: { newsK: -0.07, INT: 1 } },
  { id: 'nw_trade', age: [24, 90], w: 4, text: '国际经贸摩擦升级，出口企业订单承压。沿海的工厂放慢了机器的转速。',
    eff: { newsK: -0.10, STRESS: 3 } }
];
EVENTS.push.apply(EVENTS, EVENTS_NEWS);

/* ---------------- 违法与监狱事件（监狱系统入口） ---------------- */
const EVENTS_CRIME = [
  { id: 'cm_scam', age: [18, 70], w: 4, text: '老同学深夜来电：有个「内部渠道」的生意，一单抵一年工资，就缺你这份本钱。',
    choices: [
      { text: '报警，这不对劲', eff: { WILL: 3, ETH: 4, NET: 1 }, flags: ['good_citizen'] },
      { text: '入伙，干一票', eff: { MONEY: 3000000, ETH: -12 }, flags: ['crime_suspect'], risk: 1 },
      { text: '拒绝但保密', eff: { ETH: -2, STRESS: 2 } }
    ] },
  { id: 'cm_tax', age: [24, 80], w: 4, cond: { min: { MONEY: 20000000 } }, text: '会计建议你「做点税务筹划」——说白了，就是两套账。',
    choices: [
      { text: '依法纳税，一分不少', eff: { MONEY: -800000, ETH: 5, FAME: 2 } },
      { text: '做两套账', eff: { MONEY: 2500000, ETH: -10 }, flags: ['crime_suspect'], risk: 1 }
    ] },
  { id: 'cm_fight', age: [16, 40], w: 4, text: '深夜大排档，隔壁桌的人指着你骂了个难听的词。朋友们都在看你。',
    choices: [
      { text: '忍了，带朋友走', eff: { WILL: 2, STRESS: 3 } },
      { text: '掀桌子动手', eff: { STR: 2, ETH: -8, HP: -4 }, flags: ['crime_suspect'], risk: 1 }
    ] },
  { id: 'cm_speed', age: [18, 60], w: 3, cond: {}, text: '凌晨的环路空得像赛道。你把油门踩了下去，时速表的数字在跳。',
    choices: [
      { text: '收敛一点，安全回家', eff: { WILL: 1 } },
      { text: '再快一点', eff: { MOOD: 5, HP: -2, ETH: -4 }, flags: ['crime_suspect'], risk: 1 }
    ] },
  { id: 'cm_insider', age: [24, 80], w: 3, cond: { min: { NET: 30 } }, text: '酒桌上有人压低声音：「这只票，下周就有消息。」你听得懂他的意思。',
    choices: [
      { text: '装作没听见', eff: { ETH: 4, WILL: 2 } },
      { text: '重仓跟进', eff: { MONEY: 4000000, ETH: -12 }, flags: ['crime_suspect'], risk: 1 }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_CRIME);

/* ---------------- 服刑期间专属事件（prison > 0 时进入高频池） ---------------- */
const EVENTS_PRISON = [
  { id: 'pr_in', once: true, age: [16, 90], w: 30, text: '铁门在身后关上。编号取代了你的名字。你开始学着一分钟之内吃完一顿饭。', eff: { WILL: 4, STRESS: 10, MOOD: -10, FAME: -8 } },
  { id: 'pr_work', age: [16, 90], w: 10, text: '车间里的活不难，难的是日复一日。你因为手艺好被减了刑。', eff: { WILL: 3, STR: 2, MOOD: 2 } },
  { id: 'pr_read', age: [16, 90], w: 10, text: '你在监狱图书室读完了半架子的书。高墙圈得住人，圈不住字。', eff: { INT: 4, WILL: 2, MOOD: 3 } },
  { id: 'pr_fight', age: [16, 60], w: 6, text: '有人抢你的被子。这里讲道理没用，讲拳头也别想赢太多。', eff: { STR: 2, HP: -5, STRESS: 5 } },
  { id: 'pr_visit', age: [16, 90], w: 8, text: '探视日。玻璃对面是来看你的人。你说了十分钟「我挺好的」，挂了电话才发现自己攥了一路的听筒。', eff: { LOVE: 5, MOOD: 6, STRESS: -6 } },
  { id: 'pr_regret', age: [16, 90], w: 8, text: '夜里你把这件事从头到尾想了一遍。如果能重来——没有如果。把刑期一天一天过完，就是唯一的路。', eff: { WILL: 5, ETH: 6, MOOD: -4 } }
];
EVENTS.push.apply(EVENTS, EVENTS_PRISON);

/* ---------------- 超级大脑高难度题库（超级大脑大赛 / 图书馆深修用） ---------------- */
const SUPER_QUIZ = [
  { q: '量子力学中描述粒子状态的函数叫？', opts: ['波函数', '哈密顿量', '拉格朗日量', '张量'], a: 0 },
  { q: '哥德尔不完备定理针对的数学分支是？', opts: ['几何学', '算术公理系统', '概率论', '拓扑学'], a: 1 },
  { q: 'DNA 复制发生在细胞周期的哪个阶段？', opts: ['G1 期', 'S 期', 'G2 期', 'M 期'], a: 1 },
  { q: '「拉曼效应」与什么有关？', opts: ['光的散射', '电磁感应', '热传导', '放射性衰变'], a: 0 },
  { q: '《九章算术》成书于哪个朝代？', opts: ['秦', '汉', '唐', '宋'], a: 1 },
  { q: '图灵机理论属于哪一门学科的基础？', opts: ['生物学', '计算理论', '热力学', '光学'], a: 1 },
  { q: '黎曼猜想关心的是哪个函数的零点？', opts: ['Γ 函数', 'ζ 函数', 'β 函数', 'Bessel 函数'], a: 1 },
  { q: '人类基因组大约包含多少对碱基？', opts: ['30 亿', '3 亿', '300 亿', '3000 万'], a: 0 },
  { q: '「薛定谔的猫」最初是为了说明什么？', opts: ['猫的九条命', '量子叠加的荒谬性', '放射性半衰期', '生物电'], a: 1 },
  { q: '陈景润证明了哥德巴赫猜想的哪个部分？', opts: ['1+1', '1+2', '2+2', '1+3'], a: 1 },
  { q: 'FFT 快速傅里叶变换的复杂度是？', opts: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], a: 1 },
  { q: '宇宙微波背景辐射的发现者中不包括？', opts: ['彭齐亚斯', '威尔逊', '伽莫夫', '哈勃'], a: 3 },
  { q: '「杨-米尔斯理论」属于哪个领域？', opts: ['规范场论', '经典力学', '流体力学', '凝聚态'], a: 0 },
  { q: ' RSA 加密的安全性基于哪个数学难题？', opts: ['大数分解', '离散对数', '椭圆曲线', '哈希碰撞'], a: 0 },
  { q: '《梦溪笔谈》的作者是？', opts: ['沈括', '宋应星', '徐光启', '李时珍'], a: 0 },
  { q: '贝叶斯公式中先验概率是指？', opts: ['观测后的概率', '观测前的概率', '联合概率', '边缘概率'], a: 1 },
  { q: '相对论中「同时性的相对性」由什么引起？', opts: ['光速不变', '引力红移', '时间膨胀', '长度收缩'], a: 0 },
  { q: '黑洞的「事件视界」半径与什么成正比？', opts: ['质量', '电荷', '自转', '温度'], a: 0 },
  { q: 'CPU 缓存层级中 L1 的特点是？', opts: ['容量最大', '速度最快', '共享核间', '持久保存'], a: 1 },
  { q: '《天工开物》记载的核心内容是？', opts: ['农业手工业技术', '天文历法', '军事阵法', '医药方剂'], a: 0 },
  { q: '发现青蒿素的药学家是？', opts: ['屠呦呦', '钟南山', '陈薇', '李兰娟'], a: 0 },
  { q: 'P 与 NP 问题的核心是？', opts: ['并行计算', '验证是否等同求解', '随机算法', '加密强度'], a: 1 }
];

/* ---------------- 礼物目录（走亲访友 · 价格影响关系值） ---------------- */
const GIFT_CATALOG = [
  { id: 'gift_small', name: '一箱牛奶水果', icon: '🎁', cost: 600000, gain: [3, 5], desc: '拎进门说「随便买的」，但谁都看得出来你挑过。' },
  { id: 'gift_mid', name: '烟酒茶礼盒', icon: '🍷', cost: 2600000, gain: [6, 9], desc: '体面的硬通货。长辈嘴上说「乱花钱」，手已经收下了。' },
  { id: 'gift_big', name: '金饰 / 高端保健品', icon: '💎', cost: 12000000, gain: [10, 14], desc: '打开盒子的那一秒，屋子里安静了一下。' },
  { id: 'gift_huge', name: '一套房的首付 / 大额红包', icon: '🏰', cost: 60000000, gain: [16, 22], desc: '这不是礼物，这是改变一个家庭命运走向的东西。' }
];

/* ---------------- 墓碑款式（结局结算页 · 按人生评级解锁） ---------------- */
const TOMBSTONES = [
  { id: 'tb_plain', name: '青石碑', minRank: 'D', desc: '一方青石，一行名字。来过，就好。' },
  { id: 'tb_flower', name: '花环绕身碑', minRank: 'C', desc: '碑前常年有花。来看你的人，都记得你的好。' },
  { id: 'tb_arch', name: '功德碑', minRank: 'B', desc: '碑文很长，写满了你做过的事。' },
  { id: 'tb_grand', name: '家族纪念碑', minRank: 'A', desc: '碑上刻着整个家族的姓。你是那个起点。' },
  { id: 'tb_legend', name: '城市传记碑', minRank: 'S', desc: '你的名字进了教科书。碑立在江边，面朝你长大的地方。' }
];

/* ---------------- v6 新增成就 ---------------- */
ACHIEVEMENTS.push(
  { id: 'a_zoo', icon: '🦎', name: '异宠达人', desc: '养过爬宠或鸟类等异宠',
    cond: s => !!(s.pets || []).some(p => p.alive && ['snake', 'spider', 'lizard', 'bird', 'pig'].indexOf(p.type) >= 0) },
  { id: 'a_beauty', icon: '👑', name: '选美冠军', desc: '宠物在选美大赛中拿了冠军',
    cond: s => !!(s.flags && s.flags.pet_beauty_win) },
  { id: 'a_horse', icon: '🐎', name: '伯乐', desc: '赛马在比赛中夺冠',
    cond: s => !!(s.flags && s.flags.horse_race_win) },
  { id: 'a_pilot', icon: '✈️', name: '云端之上', desc: '成为民航飞行员',
    cond: s => !!s.career && typeof careerById === 'function' && s.career.id === 'pilot' },
  { id: 'a_astro', icon: '🚀', name: '叩问苍穹', desc: '入选航天员',
    cond: s => !!(s.flags && s.flags.astronaut) },
  { id: 'a_jail', icon: '⛓', name: '铁窗生涯', desc: '经历过一次刑期并走出高墙',
    cond: s => !!(s.flags && s.flags.ex_prisoner) },
  { id: 'a_lux', icon: '🛥', name: '顶奢人生', desc: '同时拥有游艇与私人飞机',
    cond: s => (s.market && s.market.props || []).some(p => p.kind === 'good' && p.id === 'g_yacht') &&
               (s.market && s.market.props || []).some(p => p.kind === 'good' && p.id === 'g_jet') },
  { id: 'a_brain', icon: '🧠', name: '超级大脑', desc: '在超级大脑大赛中夺冠',
    cond: s => !!(s.flags && s.flags.superbrain_win) },
  { id: 'a_heir', icon: '👪', name: '薪火相传', desc: '以继承人的身份开启下一段人生',
    cond: s => !!(s.flags && s.flags.inheritor) }
);

/* ---------------- 度假系统（一年一次，价格与恢复量成正比） ---------------- */
const VACATIONS = [
  { id: 'vac_hotspring', name: '周边温泉二日游', icon: '♨️', cost: 2500000,
    eff: { STRESS: -14, HP: 5, MOOD: 6 }, desc: '高铁一小时，泡进热汤里。手机在保险柜，你在池子边。' },
  { id: 'vac_sanya', name: '海岛度假一周', icon: '🏖', cost: 18000000,
    eff: { STRESS: -22, HP: 8, MOOD: 10, CHA: 1 }, desc: '防晒霜、潜水课、晚上的烧烤摊。你晒黑了一个色号。' },
  { id: 'vac_europe', name: '欧洲深度一个月', icon: '🏰', cost: 90000000,
    eff: { STRESS: -30, HP: 6, MOOD: 14, CUR: 4, INT: 2, CHA: 2 }, desc: '卢浮宫的下午、阿尔卑斯的小镇。见过世界之后，很多事就小事了。' }
];

/* =========================================================
 * v6.1.0 · 时代浪潮事件（按年份解锁新赛道）+ 银发事件池
 * ========================================================= */
const EVENTS_WAVE = [
  /* ---- 科技大爆炸时代 ---- */
  { id: 'w_crypto', yearMin: 2018, yearMax: 2042, w: 7, youth: true, elderly: true,
    text: '【浪潮】网上有个戴墨镜的年轻人天天喊「财富自由」。一种叫虚拟货币的东西，去年涨了四倍，上个月腰斩了一次，这周又翻倍了。交易所的 APP 排名第一。',
    choices: [
      { text: ' · 全仓杀入：富贵险中求', risk: 3, eff: {}, gamble: { p: 0.42, win: { MONEY: 26000000, MOOD: 12 }, lose: { MONEY: -9000000, MOOD: -18, STRESS: 10 } } },
      { text: ' · 定投一成仓：当个虔诚的信徒', risk: 2, eff: { MONEY: -2000000, CUR: 3 }, gamble: { p: 0.62, win: { MONEY: 6000000, CUR: 2 }, lose: { MONEY: -1500000 } } },
      { text: ' · 不碰：看不懂的钱不赚', risk: 1, eff: { SEC: 3, WILL: 2 } }
    ] },
  { id: 'w_ai', yearMin: 2028, w: 8, elderly: true, youth: true,
    text: '【浪潮】AI 把写字楼翻了个底朝天。咖啡店里人人都在聊智能体、算力、大模型。有人三个月做出了十亿估值，也有人的公司一夜之间变成了「落后的生产力」。',
    choices: [
      { text: ' · 押上积蓄做 AI 应用', risk: 3, eff: { MONEY: -15000000, STRESS: 10 }, gamble: { p: 0.36, win: { MONEY: 120000000, FAME: 12, NET: 8 }, lose: { MONEY: -8000000, MOOD: -10 } } },
      { text: ' · 进大厂 AI 部门打工，稳稳地站在浪里', risk: 1, eff: { INT: 3, NET: 3, MONEY: 3000000 } },
      { text: ' · 用 AI 给自己提效，不创业也不内卷', risk: 1, eff: { INT: 4, STRESS: -4 } }
    ] },
  { id: 'w_tsunami', yearMin: 1990, w: 3,
    text: '【海啸】隔洋传来的坏消息一夜之间砸到了每张报纸头条：全球金融海啸。楼盘售楼处灯火通明——是打折的灯。股市的曲线像跳楼的人坠落时划出的弧线。',
    choices: [
      { text: ' · 现金为王，谁劝也不动', risk: 1, eff: { SEC: 4, STRESS: 4, newsK: -0.20, houseK: -0.30 } },
      { text: ' · 别人恐惧我贪婪：抄底楼市与蓝筹', risk: 3, eff: { MONEY: -20000000, newsK: 0.14, houseK: 0.08, WILL: 4 }, gamble: { p: 0.5, win: { MONEY: 45000000, NET: 5 }, lose: { MONEY: -12000000, MOOD: -12 } } },
      { text: ' · 减仓自保，先让家里人安心', risk: 2, eff: { newsK: -0.08, houseK: -0.18, MOOD: 3, STRESS: -6 } }
    ] },
  { id: 'w_techboom', yearMin: 2005, w: 3,
    text: '【黑天鹅 · 喜】某实验室凌晨两点发了一篇论文，三天后整个科技板块疯了。半导体、AI、新能源全线暴涨，交易软件的服务器挤到崩溃。',
    choices: [
      { text: ' · 这波科技行情，吃下', risk: 2, eff: { techK: 0.60, MOOD: 6 } },
      { text: ' · 涨成这样，落袋为安先', risk: 1, eff: { techK: 0.3, SEC: 3 } }
    ] },
  { id: 'w_techcrash', yearMin: 2005, w: 3,
    text: '【黑天鹅 · 灾】吹了很久的「技术泡沫」今天破了。科技股集体跳水，市值蒸发以万亿计。财经频道的主播语速快得像在逃命。',
    choices: [
      { text: ' · 技术的终局没变，越跌越买', risk: 3, eff: { techK: -0.45, MONEY: -5000000, WILL: 3 }, gamble: { p: 0.55, win: { MONEY: 30000000, NET: 3 }, lose: { MONEY: -8000000 } } },
      { text: ' · 清仓科技股，钱不能陪着一起殉葬', risk: 1, eff: { techK: -0.6, SEC: 4, STRESS: 5 } }
    ] },
  /* ---- 赛博 / 未来时代 ---- */
  { id: 'w_bodymod', yearMin: 2058, w: 8, elderly: true,
    text: '【未来】私立诊所的海报印着「细胞重编程 · 器官再生 · 表观遗传逆转」。衰老第一次被官方定义为「可治疗的疾病」——标价也印得很诚实。',
    choices: [
      { text: ' · 做全套基因修复与再生疗程', risk: 2, eff: { MONEY: -180000000, HP: 18, MOOD: 10, FAME: 3 } },
      { text: ' · 只做基础保养套餐', risk: 1, eff: { MONEY: -30000000, HP: 8 } },
      { text: ' · 生老病死是自然，不掺这些', risk: 1, eff: { ETH: 3, WILL: 3, MOOD: 2 } }
    ] },
  { id: 'w_space', yearMin: 2075, w: 6, elderly: true, youth: true,
    text: '【未来】近地轨道旅游正式民用化。发射中心排起了队，朋友圈里一半人在晒失重自拍，另一半在转发「票价」。',
    choices: [
      { text: ' · 买一张近地轨道票，上去看看', risk: 2, eff: { MONEY: -80000000, MOOD: 18, CUR: 6, FAME: 5, HP: -2 } },
      { text: ' · 先买张候补票排着', risk: 1, eff: { MONEY: -8000000, MOOD: 4 } },
      { text: ' · 地球挺好，哪儿也不去', risk: 1, eff: { MOOD: 2 } }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_WAVE);

/* ---- 银发事件池（60+ 高频：夕阳红不是等死，是另一段人生） ---- */
const EVENTS_ELDERLY = [
  { id: 'e_gateball', age: [60, 105], w: 9, elderly: true,
    text: '【门球】社区门球队缺人，队长把球杆塞进你手里：「就缺你这根定海神针。」全市联赛下个月开打。',
    choices: [
      { text: ' · 入队，练他个昏天黑地', risk: 2, eff: { MOOD: 8, HP: 4, STR: 2 }, gamble: { p: 0.4, win: { MONEY: 8000000, FAME: 4, MOOD: 8 }, lose: { MOOD: 3 } } },
      { text: ' · 只打野球，不掺比赛', risk: 1, eff: { MOOD: 6, HP: 3 } },
      { text: ' · 婉拒：这腰经不起弯', risk: 1, eff: { MOOD: 1 } }
    ] },
  { id: 'e_taichi', age: [60, 105], w: 8, elderly: true,
    text: '【太极】公园的陈师傅说要收你做徒弟：「你这骨架，是练太极的料。」市里每年还有全球太极拳锦标赛——对，太极拳也有「全球锦标赛」。',
    choices: [
      { text: ' · 拜师，晨练不辍', risk: 1, eff: { HP: 6, WILL: 3, MOOD: 4, STR: 2 } },
      { text: ' · 报名锦标赛，去会会天下高手', risk: 2, eff: { HP: 3 }, gamble: { p: 0.32, win: { FAME: 6, MONEY: 12000000, MOOD: 10 }, lose: { MOOD: 2, WILL: 2 } } },
      { text: ' · 站边上跟着比划比划就好', risk: 1, eff: { HP: 3, MOOD: 2 } }
    ] },
  { id: 'e_sunsetmeet', age: [60, 105], w: 7, elderly: true, ban: ['married'],
    text: '【夕阳红】老年大学的手工课上，有人总坐在你旁边。今天TA递来一张纸条，字写得很端正：「下周的合唱班，缺个男中音/女低音，来吗？」',
    choices: [
      { text: ' · 去合唱班，也去看看这个人', risk: 2, eff: { MOOD: 10, LOVE: 4, CHA: 1 } },
      { text: ' · 只去合唱班，歌是真好听', risk: 1, eff: { MOOD: 6, HP: 2 } },
      { text: ' · 婉拒：一个人的日子也挺好', risk: 1, eff: { WILL: 2, MOOD: 1 } }
    ] },
  { id: 'e_silveruni', age: [60, 105], w: 8, elderly: true,
    text: '【老年大学】招生处的年轻姑娘问你报什么专业。课程表上有书法、摄影、智能手机、还有一门「短视频创作」。你恍惚了一下——这辈子还能再选一次专业？',
    choices: [
      { text: ' · 报短视频创作，当银发博主', risk: 2, eff: { MOOD: 8, FAME: 3, INT: 2 }, gamble: { p: 0.25, win: { FAME: 8, MONEY: 20000000, MOOD: 8 }, lose: { MOOD: 3 } } },
      { text: ' · 报书法与摄影，修身养性', risk: 1, eff: { INT: 3, MOOD: 6, CUR: 3 } },
      { text: ' · 都试试，学费反正不贵', risk: 1, eff: { MOOD: 5, INT: 2, MONEY: -1000000 } }
    ] },
  { id: 'e_grandstory', age: [60, 105], w: 7, elderly: true, grand: true,
    text: '【孙辈】小家伙放学回来趴在你腿边：「爷爷奶奶，再讲讲你年轻时候的事嘛。」你讲了讲那年考上大学、第一次发的工资、还有那场说走就走的旅行。',
    choices: [
      { text: ' · 把最得意的都讲给TA听', risk: 1, eff: { MOOD: 8, ETH: 2, LOVE: 3 } },
      { text: ' · 讲完故事，再把当年的教训也讲了', risk: 1, eff: { MOOD: 5, ETH: 4, WILL: 2 } },
      { text: ' · 讲到一半带TA去吃了顿好的', risk: 1, eff: { MOOD: 7, LOVE: 4, MONEY: -800000 } }
    ] },
  { id: 'e_silvertrip', age: [62, 105], w: 8, elderly: true,
    text: '【旅居】老朋友发来组队邀请：「云南住三个月，大理的院子都看好了，去不去？」你看着日历——这辈子的日历，从来没有像现在这么空过。',
    choices: [
      { text: ' · 收拾行李，一住三个月', risk: 1, eff: { MOOD: 14, HP: 4, CUR: 4, MONEY: -12000000 } },
      { text: ' · 去一个月，住完就回', risk: 1, eff: { MOOD: 8, CUR: 2, MONEY: -5000000 } },
      { text: ' · 家里挺好，视频里看他们的照片', risk: 1, eff: { MOOD: 2 } }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_ELDERLY);

/* ---- 太空度假（2075+ 民用化后解锁） ---- */
VACATIONS.push(
  { id: 'vac_space', name: '近地轨道三日游', icon: '🚀', cost: 80000000, minYear: 2075,
    eff: { STRESS: -35, MOOD: 20, CUR: 6, FAME: 4, HP: -2 }, desc: '舷窗外，日出每九十分钟一次。你在失重里想起小时候攒钱买的塑料火箭。' },
  { id: 'vac_livestay', name: '大理旅居一个月', icon: '⛰', cost: 6000000,
    eff: { STRESS: -26, MOOD: 10, HP: 5, CUR: 3 }, desc: '院子、洱海、晒不完的太阳。邻居问你做什么工作的，你说「退休的」。' }
);

/* ---- v6.1 新成就 ---- */
ACHIEVEMENTS.push(
  { id: 'a_trust', icon: '🏦', name: '家族信托', desc: '设立家族信托，让血脉世代不受穷',
    cond: s => !!(s.flags && s.flags.trust_founder) },
  { id: 'a_cryo', icon: '🧊', name: '穿越者', desc: '冷冻休眠后在未来苏醒',
    cond: s => !!(s.flags && s.flags.cryonaut) },
  { id: 'a_prof', icon: '🎓', name: '银发教授', desc: '退休后受聘客座教授',
    cond: s => (s.profYear || 0) > 0 },
  { id: 'a_club', icon: '🥂', name: '圈层名流', desc: '加入任何一个顶级圈层',
    cond: s => (s.clubs || []).length > 0 },
  { id: 'a_fund', icon: '❤️', name: '泽被后世', desc: '创办个人慈善基金会',
    cond: s => !!(s.flags && s.flags.foundation) }
);

/* ---- v6.2 新成就：越轨与代价 ---- */
ACHIEVEMENTS.push(
  { id: 'a_bastard', icon: '🤫', name: '私生子', desc: '有一个没名分的孩子',
    cond: s => (s.children || []).some(c => c.illegit && !c.ack) },
  { id: 'a_ack', icon: '📄', name: '认祖归宗', desc: '把非婚生子女认领入户',
    cond: s => (s.children || []).some(c => c.illegit && c.ack) },
  { id: 'a_exposed', icon: '📸', name: '东窗事发', desc: '出轨 / 私生子被配偶撞破',
    cond: s => !!(s.flags && s.flags.exposed) },
  { id: 'a_sued', icon: '⚖️', name: '被起诉离婚', desc: '被配偶起诉，财产被法院强行分割',
    cond: s => !!(s.flags && s.flags.sued) },
  { id: 'a_cuckoo', icon: '🧬', name: '亲子鉴定', desc: '鼓起勇气做了一次亲子鉴定',
    cond: s => !!(s.flags && s.flags.paternity_done) },
  { id: 'a_twins', icon: '👯', name: '双喜临门', desc: '一次生了两个',
    cond: s => !!(s.flags && s.flags.twins) },
  { id: 'a_landlord', icon: '🏘', name: '包租公 / 包租婆', desc: '名下同时持有 5 套以上房产',
    cond: s => (s.market && s.market.props || []).filter(p => p.kind === 'house').length >= 5 },
  { id: 'a_blacklist', icon: '🚫', name: '社会性死亡', desc: '被圈子彻底除名',
    cond: s => !!(s.flags && s.flags.blacklisted) }
);

/* =========================================================
 * v6.2.1 · 天赋语义搜索
 * 玩家记不住 124 个天赋的名字，但记得住自己想要什么：
 * 搜「魅力」就该把所有带魅力的天赋都列出来（哪怕名字和描述里都没有「魅力」两个字）。
 * 所以匹配范围 = 名字 + 描述 + 分类 + 效果属性的中文名与别名。
 * ========================================================= */
const STAT_CN = {
  INT: '智力', STR: '体魄', CHA: '魅力', WILL: '意志',
  HP: '健康', STRESS: '压力', MONEY: '现金',
  NET: '人脉', FAME: '声望', LOY: '口碑',
  CUR: '好奇', LOVE: '关爱', SEC: '安全', AUTO: '自主', GROW: '成长',
  ETH: '道德', MOOD: '心情'
};

/* 搜索别名：玩家嘴里说的词 → 属性键 */
const STAT_ALIAS = {
  INT: ['智力', '智商', '聪明', '脑子', '学习', '读书', '考试', '记忆力'],
  STR: ['体魄', '体质', '力量', '身体', '强壮', '体育', '运动', '体力'],
  CHA: ['魅力', '颜值', '长相', '好看', '外貌', '吸引力', '气质', '漂亮'],
  WILL: ['意志', '毅力', '抗压', '坚持', '韧性'],
  HP: ['健康', '寿命', '生病', '养生', '体格', '活久', '长寿'],
  STRESS: ['压力', '减压', '轻松', '焦虑'],
  MONEY: ['钱', '现金', '财富', '存款', '资产', '有钱', '收入', '资金'],
  NET: ['人脉', '关系', '社交', '圈子', '朋友'],
  FAME: ['声望', '名望', '名气', '出名', '有名'],
  LOY: ['口碑', '信誉', '职场'],
  CUR: ['好奇', '探索'],
  LOVE: ['关爱', '感情', '温情'],
  SEC: ['安全', '安全感'],
  GROW: ['成长', '发育'],
  ETH: ['道德', '善良', '底线', '良心', '好人'],
  MOOD: ['心情', '快乐', '开心', '情绪']
};

/* 空格分词：每个词都要命中（命中名字/描述/分类，或命中效果属性） */
function talentSearchHit(t, q) {
  const terms = String(q || '').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = [t.name || '', t.desc || '', t.tag || '', (t.flags || []).join(' ')].join(' ');
  const eff = [];
  for (const k in (t.eff || {})) {
    const v = t.eff[k];
    if (typeof v === 'number' && v !== 0) {
      eff.push(STAT_CN[k] || k);
      (STAT_ALIAS[k] || []).forEach(a => eff.push(a));
    }
  }
  const effText = eff.join(' ');
  return terms.every(w => text.indexOf(w) >= 0 || effText.indexOf(w) >= 0);
}

/* 命中的是哪一项属性（用于在卡片上标注「为什么被搜出来」） */
function talentHitStats(t, q) {
  const terms = String(q || '').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out = [];
  for (const k in (t.eff || {})) {
    const v = t.eff[k];
    if (typeof v !== 'number' || v === 0) continue;
    const words = [STAT_CN[k] || k].concat(STAT_ALIAS[k] || []);
    if (terms.some(w => words.some(x => x.indexOf(w) >= 0 || w.indexOf(x) >= 0))) out.push(k);
  }
  return out;
}

/* ---------------- v6.2.2 未成年专属事件池 ----------------
 * 以前未成年阶段靠成人事件池兜底，会抽出「上班/看望父母」这类违和内容。
 * 这一批全部是校园与童年视角：小学→初中→高中，年龄窗严格锁死。 */
const EVENTS_YOUTH = [
  { id: 'yv_transfer', age: [7, 12], w: 8,
    text: '转学第一天。全班四十双眼睛齐刷刷看过来，老师在黑板上写下你的名字，最后一笔翘得很高。',
    eff: { STRESS: 5, NET: 3, GROW: 3 },
    choices: [
      { text: '主动介绍自己', eff: { CHA: 4, NET: 5, MOOD: 3 }, risk: 1 },
      { text: '低头坐下，安静一整天', eff: { STRESS: -3, NET: -2 }, risk: 2 }
    ] },
  { id: 'yv_olympiad', age: [10, 15], w: 8,
    text: '数学老师把你叫到办公室：市里有奥数竞赛，班里想去只有你能去。每周三节课，作业会翻倍。',
    eff: { STRESS: 6 },
    choices: [
      { text: '去！刷题刷到深夜', eff: { INT: 7, GROW: 5, STRESS: 8, MOOD: -3 }, risk: 2 },
      { text: '去，但正常节奏', eff: { INT: 4, GROW: 3, STRESS: 3 }, risk: 1 },
      { text: '婉拒，兴趣不在数学', eff: { MOOD: 4, CUR: 3 }, risk: 2 }
    ] },
  { id: 'yv_sports', age: [9, 15], w: 8,
    text: '秋季运动会。班长把 4×100 接力的最后一棒塞给了你——前一棒摔了，交棒时已经落后半个操场。',
    eff: {},
    choices: [
      { text: '咬牙追！风声灌进耳朵', eff: { STR: 6, MOOD: 5, HP: -3 }, risk: 2,
        gamble: { p: 0.55, win: { MOOD: 8, FAME: 3, NET: 4 }, lose: { MOOD: -4, STR: 1 } } },
      { text: '稳稳跑完就好', eff: { STR: 2, MOOD: 2 }, risk: 1 }
    ] },
  { id: 'yv_spring', age: [8, 14], w: 7,
    text: '春游。大巴上有人带头唱歌，从《孤勇者》跑调跑到了《两只老虎》。你把辣条分给了后排哭鼻子的同学。',
    eff: { MOOD: 6, LOVE: 2, NET: 2 } },
  { id: 'yv_netbar', age: [13, 16], w: 7,
    text: '网吧的烟雾里，同学把一副耳机扣在你头上：「就一把，五块钱我出。」门外隐约有班主任的身影。',
    eff: { STRESS: 3 },
    choices: [
      { text: '拔腿就跑，从后门走', eff: { WILL: 4, STR: 2 }, risk: 1 },
      { text: '就玩一把，这点运气还行', eff: { MOOD: 6, CUR: 3, INT: -1 }, risk: 3,
        gamble: { p: 0.4, win: { MOOD: 8, NET: 3 }, lose: { STRESS: 8, ETH: -3, FAME: -2 } } },
      { text: '回教室写卷子', eff: { INT: 3, WILL: 3, MOOD: -2 }, risk: 1 }
    ] },
  { id: 'yv_idol', age: [12, 16], w: 7,
    text: '你攒了三个月零花钱，买到了那张专辑。海报贴满床头，同学笑你幼稚——可那首歌唱到副歌，你整个人都在发光。',
    eff: { MOOD: 7, CUR: 3, MONEY: -800000 },
    choices: [
      { text: '把歌词抄进摘抄本', eff: { MOOD: 4, GROW: 2 }, risk: 1 },
      { text: '省吃俭用去看演唱会', eff: { MOOD: 9, MONEY: -6000000, CHA: 2 }, risk: 2 }
    ] },
  { id: 'yv_manga', age: [9, 14], w: 7,
    text: '那本借来的漫画在课桌肚里被班主任没收了。她说期末考完来拿。整整四个月，你梦里都是下一话。',
    eff: { MOOD: -4, STRESS: 3, WILL: 2 } },
  { id: 'yv_radio', age: [12, 16], w: 6,
    text: '校园广播站招新。面试的老师说你的声音「适合傍晚的栏目」，比如念一些别人写来的信。',
    eff: {},
    choices: [
      { text: '报名，每周三下午播音', eff: { CHA: 5, NET: 4, FAME: 3, STRESS: 3 }, risk: 1 },
      { text: '算了，声音会紧张', eff: { MOOD: -1 }, risk: 2 }
    ] },
  { id: 'yv_visit', age: [8, 13], w: 6,
    text: '老师家访。你提前把房间收拾了三遍，妈妈把藏了很久的糖拿出来待客。老师说：这孩子心里有光。',
    eff: { SEC: 4, LOVE: 3, GROW: 2 } },
  { id: 'yv_blackout', age: [13, 17], w: 6,
    text: '晚自习停电。整栋楼先是死寂，然后爆发出欢呼。蜡烛在教室里一盏盏亮起来，有人开始讲鬼故事。',
    eff: { MOOD: 6, NET: 3, CUR: 2 } },
  { id: 'yv_cards', age: [7, 11], w: 7,
    text: '小卖部干脆面。为了那张稀有的闪卡，你连吃了一周，最后和同桌用三十张普通卡换了它。',
    eff: { MOOD: 5, NET: 3, MONEY: -500000 } },
  { id: 'yv_art', age: [16, 18], w: 6,
    text: '画室老师看了你的速写，沉默很久：「走艺考这条路吧。贵，累，但你手里有东西。」',
    eff: { STRESS: 5 },
    choices: [
      { text: '集训。画到手指起茧', eff: { CHA: 5, INT: 2, CUR: 4, MONEY: -20000000, STRESS: 8 }, risk: 2 },
      { text: '留在文化课赛道', eff: { WILL: 3, MOOD: -2 }, risk: 1 }
    ] },
  { id: 'yv_summerjob', age: [16, 17], w: 7,
    text: '暑假，你在奶茶店打工。站了九个小时，手被封口机烫了个泡。下班那杯员工价的杨枝甘露，是你喝过最甜的。',
    eff: { MONEY: 5000000, STR: -3, WILL: 4, GROW: 4, STRESS: 4 } },
  { id: 'yv_camp', age: [10, 14], w: 6,
    text: '夏令营。你第一次自己叠被子、自己洗袜子。熄灯后大家在被窝里交换零食和心事，你发现胆小的人那么多。',
    eff: { GROW: 5, SEC: -2, NET: 4, WILL: 3 } },
  { id: 'yv_deskmate', age: [10, 15], w: 6,
    text: '同桌要转学了。他把最喜欢的钢笔塞给你，说「帮我记着咱俩的座位」。那天放学，你在座位上坐了很久。',
    eff: { MOOD: -5, LOVE: 4, GROW: 3, NET: -2 } },
  { id: 'yv_sprint', age: [17, 18], w: 8,
    text: '高考百日誓师。操场上口号震天，横幅写着「多考一分，干掉千人」。你把准考证号抄在手心，攥紧了。',
    eff: { STRESS: 9, WILL: 5, INT: 2, MOOD: -3 } },
  { id: 'yv_letter', age: [14, 17], w: 6,
    text: '课本里夹着一封没有署名的信，字迹娟秀，只有一句：「你解物理题的样子很认真。」你盯着一整节自习课。',
    eff: { MOOD: 7, CUR: 5, LOVE: 3 } },
  { id: 'yv_console', age: [11, 15], w: 6,
    text: '游戏机藏在床垫下面。晚饭后你心虚地摸向床底，摸了个空——妈妈站在门口，表情平静得可怕。',
    eff: { STRESS: 6, MOOD: -4 },
    choices: [
      { text: '承认，保证期末前不碰', eff: { WILL: 5, ETH: 3, SEC: 2, MOOD: -2 }, risk: 1 },
      { text: '说是借给同学了', eff: { ETH: -4, STRESS: 4 }, risk: 3,
        gamble: { p: 0.35, win: { SEC: 1 }, lose: { SEC: -5, LOVE: -3, STRESS: 6 } } }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_YOUTH);
