/* =========================================================
 *  CANGAME · 江南逆袭 (강남 역습)
 *  数据层：天赋 / 出身 / 事件库 / 投资 / 结局
 * ========================================================= */

const GAME_META = {
  title: '江南逆袭',
  subtitle: '강남 역습 · 从半地下室到财阀之巅',
  version: '1.0.0',
  startYear: 1985,
  endAge: 80
};

/* ---------------- 数值定义 ---------------- */
const STATS = [
  { key: 'INT',  name: '지력 智力',  hint: '学习、考试、谋略' },
  { key: 'STR',  name: '체력 体魄',  hint: '兵役、打架、耐力' },
  { key: 'CHA',  name: '매력 魅力',  hint: '人脉、恋爱、影响力' },
  { key: 'WILL', name: '의지 意志',  hint: '抗压、低谷反弹' },
  { key: 'HP',   name: '건강 健康',  hint: '归零即人生结束' },
  { key: 'STRESS', name: '스트레스 压力', hint: '过高会损伤健康' }
];

const RESOURCES = [
  { key: 'MONEY', name: '자산 资产', hint: '韩元 ₩' },
  { key: 'NET',   name: '인맥 人脉', hint: '关键时刻能调动的人' },
  { key: 'FAME',  name: '명성 声望', hint: '社会知名度' },
  { key: 'LOY',   name: '太星好感', hint: '与太星家族的关系' }
];

/* ---------------- 天赋 ---------------- */
/* cost > 0 消耗点数，cost < 0 返还点数（负面天赋） */
const TALENTS = [
  { id: 'memory',   name: '전생의 기억 前世记忆', cost: 4, desc: '你死过一次。前世作为太星集团底层职员被灭口，却带回了未来三十年的大事件。',
    eff: { WILL: 6, INT: 3 }, flags: ['past_life'], tag: '核心' },
  { id: 'math',     name: '수학천재 数学天才', cost: 3, desc: '数字在你脑中自己排队。', eff: { INT: 9 } },
  { id: 'iron',     name: '철강체력 钢铁体魄', cost: 2, desc: '从小没打过点滴。', eff: { STR: 9, HP: 10 } },
  { id: 'face',     name: '얼굴천재 天生丽质', cost: 3, desc: '江南的整形医院以你的脸为模板。', eff: { CHA: 9 } },
  { id: 'will',     name: '불굴의 의지 不屈意志', cost: 2, desc: '被打倒多少次，就站起来多少次。', eff: { WILL: 9 } },
  { id: 'gangnam',  name: '강남 토박이 江南土著', cost: 3, desc: '户口本上写着江南区，哪怕只是半地下室。', eff: { CHA: 4, MONEY: 8000000 }, flags: ['gangnam'] },
  { id: 'legacy',   name: '아버지의 유산 父亲的遗物', cost: 2, desc: '一只旧铁盒，里面是父亲攒了一辈子的钱。', eff: { MONEY: 6000000, WILL: 2 } },
  { id: 'code',     name: '천재 프로그래머 编程天才', cost: 2, desc: '你在 DOS 里写出了第一个韩文输入法。', eff: { INT: 5, STR: -2 }, flags: ['coder'] },
  { id: 'speech',   name: '언변의 달인 辩才无碍', cost: 2, desc: '一张嘴能把黑的说成白的。', eff: { CHA: 5, NET: 5 } },
  { id: 'stock',    name: '주식 귀재 股神直觉', cost: 2, desc: '你天生懂得恐惧与贪婪的周期。', eff: { INT: 3 }, flags: ['stock_buff'] },
  { id: 'estate',   name: '미래의 집 房产直觉', cost: 2, desc: '你总能闻到哪块地要涨价。', eff: { INT: 2 }, flags: ['estate_buff'] },
  { id: 'network',  name: '인맥世家 人脉世家', cost: 2, desc: '叔叔的表哥的岳父，总在某个要害部门。', eff: { NET: 10 } },
  { id: 'health',   name: '건강염려증 养生达人', cost: 1, desc: '你熟读每一本健康杂志。', eff: { HP: 15, STRESS: -10 } },
  { id: 'revenge',  name: '복수심 复仇之心', cost: 2, desc: '那个雨夜，是谁把你推下了汉江大桥。你记得。', eff: { WILL: 6, STRESS: 12 }, flags: ['revenge'] },
  { id: 'lucky',    name: '운빨 锦鲤附体', cost: 2, desc: '好事总在你身上多绕一圈。', eff: {}, flags: ['lucky'] },
  { id: 'diligent', name: '성실 勤勉', cost: 1, desc: '你相信一天十四小时的力量。', eff: { INT: 2, STR: 2, CHA: 2, WILL: 2 } },
  { id: 'absolutepitch', name: '절대음감 绝对音感', cost: 1, desc: '随便一首歌你都能弹出调子。', eff: { CHA: 4 }, flags: ['music'] },
  { id: 'dual',     name: '이중국적 双重国籍', cost: 2, desc: '一本美国护照，让兵役成为别人的故事。', eff: { CHA: 2 }, flags: ['no_military'] },
  { id: 'flatfoot', name: '평발 扁平足', cost: -2, desc: '免除兵役的唯一好处，是你能早两年进入社会。', eff: { STR: -3 }, flags: ['no_military'] },
  { id: 'debt',     name: '빚더미 负债之子', cost: -3, desc: '父亲的债，写在你的户口本上。', eff: { MONEY: -4000000, WILL: 5 } },
  { id: 'ugly',     name: '외모 콤플렉스 外貌自卑', cost: -2, desc: '你习惯了被忽略，也因此更懂得观察。', eff: { CHA: -4, INT: 4 } },
  { id: 'sick',     name: '허약체질 病弱', cost: -2, desc: '医院的走廊你比教室还熟。', eff: { HP: -15, INT: 3 } },
  { id: 'country',  name: '시골 출신 乡下出身', cost: -2, desc: '庆尚北道的稻田，和首尔的霓虹隔着一整个时代。', eff: { CHA: -2, STR: 4, WILL: 2 } },
  { id: 'temper',   name: '다혈질 暴脾气', cost: -2, desc: '拳头总比脑子先动。', eff: { STR: 5, CHA: -3, WILL: 2 } }
];

/* ---------------- 出身 ---------------- */
const FAMILIES = [
  { id: 'banjiha', name: '반지하 江南半地下室', desc: '窗子与地面齐平，能看见路人的鞋。首尔江南区，一间 12 平的半地下室。',
    eff: { MONEY: 1200000, INT: 3, CHA: 2, WILL: 4 }, flags: ['poor', 'seoul'] },
  { id: 'factory', name: '공장노동자 京畿道工厂家庭', desc: '父亲在安山的工厂做冲压工，母亲在食堂洗碗。',
    eff: { MONEY: 800000, STR: 5, WILL: 5, INT: 1 }, flags: ['poor'] },
  { id: 'province', name: '지방 大邱小商人家庭', desc: '家里开着一间文具店，账本永远差几百块。',
    eff: { MONEY: 1500000, INT: 2, CHA: 4, NET: 3 }, flags: ['province'] },
  { id: 'single',   name: '한부모 单亲家庭', desc: '母亲一个人打三份工，把你拉扯大。',
    eff: { MONEY: 500000, WILL: 8, INT: 3, CHA: 1 }, flags: ['poor', 'single'] },
  { id: 'orphan',   name: '고아 教会孤儿院', desc: '你没有户口本上的父母，只有一排编号。',
    eff: { MONEY: 200000, WILL: 9, INT: 5, CHA: -2 }, flags: ['poor', 'orphan'] },
  { id: 'rentier',  name: '임대업 月收家庭', desc: '家里有几间考试院在收租，不算富，但饿不死。',
    eff: { MONEY: 5000000, INT: 2, CHA: 3, NET: 4 }, flags: ['rentier'] },
  { id: 'prof',     name: '교수 教授家庭', desc: '父亲是地方大学的讲师，家里的墙都是书架。',
    eff: { MONEY: 3000000, INT: 9, CHA: 2, NET: 5 }, flags: ['prof'] },
  { id: 'chaebol_edge', name: '먼 친척 太星远亲', desc: '母亲那边的远房亲戚，据说在太星集团门口当过保安。',
    eff: { MONEY: 2500000, CHA: 3, NET: 6, LOY: 5 }, flags: ['chaebol_tie'] }
];

/* ---------------- 事件库 ----------------
 * cond: {ageMin,ageMax,gender:'M'/'F',need:[flags],ban:[flags],min:{stat},max:{stat},job:[...]}
 * eff : {STAT:delta, flags:[...], job:'...', edu:'...'}
 * choice: {text, eff:{...}, flags:[...]}
 */
const EVENTS = [
  /* ===== 幼儿 0-6 ===== */
  { id: 'c01', age: [0, 3], w: 10, text: '你出生在首尔的冬天。母亲抱着你，窗外是汉江对岸尚未点亮的江南。',
    eff: { HP: 2 }, flags: [] },
  { id: 'c02', age: [0, 4], w: 8, text: '半地下室的雨季。墙纸鼓起又脱落，你第一次知道「首尔」有两种：地上的和地下的。',
    cond: { need: ['poor'] }, eff: { WILL: 2, INT: 1 } },
  { id: 'c03', age: [1, 5], w: 7, text: '隔壁姐姐教你念韩文字母。你学得很快，母亲在灯下笑出了眼泪。', eff: { INT: 3, CHA: 1 } },
  { id: 'c04', age: [2, 6], w: 7, text: '你在旧书摊捡到一本破旧的《世界地图册》，翻到「首尔」那一页，用蜡笔画了一个圈。', eff: { INT: 2, WILL: 1 } },
  { id: 'c05', age: [2, 6], w: 6, text: '父亲喝醉回家，把桌子掀翻。你躲在衣柜里，学会了屏住呼吸。',
    cond: { ban: ['single', 'orphan'] }, eff: { WILL: 3, STRESS: 6 } },
  { id: 'c06', age: [3, 6], w: 6, text: '教会发来一箱旧衣服。你穿着不合身的外套去幼儿园，被笑了整整一年。',
    cond: { need: ['poor'] }, eff: { CHA: -2, WILL: 2 } },
  { id: 'c07', age: [1, 6], w: 5, text: '你发高烧到 40 度，母亲背着你跑了三家医院。活下来之后，你的身体似乎更强了。', eff: { HP: 5, WILL: 2 } },
  { id: 'c08', age: [3, 6], w: 5, text: '母亲在你耳边反复说一句话：「우리는 못 살아도, 너는 살아야 한다.」再穷，你也得活出个人样。', eff: { WILL: 4 } },
  { id: 'c09', age: [0, 2], w: 4, text: '前世的记忆在午夜涌来：冰冷的江水，和一双擦得发亮的皮鞋。你哭醒了。',
    cond: { need: ['past_life'] }, eff: { INT: 3, WILL: 2, STRESS: 4 } },
  { id: 'c10', age: [4, 6], w: 5, text: '你在纸上画了一栋很高的楼，指着它说：这以后是我的。大人笑作一团。', eff: { WILL: 2, FAME: 1 } },

  /* ===== 小学 7-12 ===== */
  { id: 'p01', age: [7, 12], w: 9, text: '小学入学。老师的名牌上写着「학부모 직업」一栏，你在上面填了「会社员」。', eff: { INT: 2 } },
  { id: 'p02', age: [7, 12], w: 8, text: '班里的富家子带了一台 Game Boy。你只远远看过一眼，但记住了它的电路板结构。', eff: { INT: 2, STRESS: 2 } },
  { id: 'p03', age: [8, 12], w: 8, text: '你考了年级第一。母亲把成绩单贴在墙上，那一刻比过年还亮。', eff: { INT: 4, FAME: 2 } },
  { id: 'p04', age: [8, 12], w: 7, text: '학원 补习班。母亲把最后的钱交给了大峙洞的数学学院。', cond: { min: { MONEY: 500000 } },
    eff: { INT: 5, MONEY: -600000 } },
  { id: 'p05', age: [8, 12], w: 7, text: '大峙洞的学院太贵了。你在图书馆自学到闭馆，路灯下背单词。', cond: { max: { MONEY: 500000 } },
    eff: { INT: 4, WILL: 3, HP: -2 } },
  { id: 'p06', age: [9, 12], w: 6, text: '你在操场上被富家子推倒，爬起来把他的鼻子打出了血。第一次明白：道理是讲给有地位的人听的。',
    cond: { min: { STR: 15 } }, eff: { STR: 3, CHA: -2, WILL: 3, STRESS: 4 } },
  { id: 'p07', age: [9, 12], w: 6, text: '你成了班里最会讲故事的人。孩子们围着你，连那个富家子也凑过来。',
    cond: { min: { CHA: 15 } }, eff: { CHA: 3, NET: 3 } },
  { id: 'p08', age: [10, 12], w: 6, text: '父亲失业了。家里的晚饭从三菜一汤变成了泡菜和饭。你开始去便利店打工。', eff: { WILL: 5, MONEY: 300000, STRESS: 5 } },
  { id: 'p09', age: [10, 12], w: 5, text: '第一次坐地铁穿过汉江。对岸的公寓灯火通明，你说不出话。', eff: { WILL: 3, INT: 1 } },
  { id: 'p10', age: [11, 12], w: 5, text: '你在作文里写《나의 꿈 我的梦想》：我要在江南最高的楼上，看首尔的夜景。老师给了满分。', eff: { INT: 2, FAME: 2, WILL: 2 } },

  /* ===== 中学 13-15 ===== */
  { id: 'm01', age: [13, 15], w: 9, text: '中学。青春期，贫穷第一次变成一种刺在皮肤上的东西。', eff: { STRESS: 4 } },
  { id: 'm02', age: [13, 15], w: 8, text: '你爱上了隔壁班的女孩。你在她课桌里塞了一封没署名的信，然后转学去了别的补习班。', eff: { CHA: 2, INT: -1, WILL: 1 } },
  { id: 'm03', age: [13, 15], w: 8, text: '你在网吧第一次接触到互联网。那一刻你听见了时代转动的声音。', eff: { INT: 4 }, flags: ['net_gen'] },
  { id: 'm04', age: [13, 15], w: 7, text: '你加入了学校的棒球队。汗水是最便宜的解药。', cond: { min: { STR: 20 } }, eff: { STR: 5, HP: 4 } },
  { id: 'm05', age: [14, 15], w: 7, text: '你偷了一本《주식투자 입문 股票投资入门》。看不懂，但你记住了两个字：复利。', eff: { INT: 3 }, flags: ['stock_interest'] },
  { id: 'm06', age: [13, 15], w: 6, text: '校园霸凌。你被拉进厕所，交出了一周的饭钱。你记住了他们的名字。', cond: { ban: ['lucky'] }, eff: { WILL: 4, STRESS: 8, HP: -3 } },
  { id: 'm07', age: [14, 15], w: 6, text: '你考进了「特目高」的预备班。母亲去学校门口给老师鞠躬。', cond: { min: { INT: 35 } }, eff: { INT: 4, FAME: 3 } },
  { id: 'm08', age: [14, 15], w: 5, text: '你在旧货市场淘到一台 486 电脑，整夜研究 DOS。', cond: { need: ['coder'] }, eff: { INT: 5, STR: -2 }, flags: ['coder'] },

  /* ===== 高中 16-19 ===== */
  { id: 'h01', age: [16, 17], w: 9, text: '高中。韩国最残酷的三年开始了——有人把它叫做「지옥 地狱」。', eff: { STRESS: 6 } },
  { id: 'h02', age: [16, 18], w: 8, text: '你在自习室待到凌晨两点。走廊的灯灭了，你借着应急灯背书。', eff: { INT: 5, HP: -4, STRESS: 5 } },
  { id: 'h03', age: [16, 18], w: 7, text: '你和几个同学组了乐队，在弘大的地下 Live House 演出。台下只有七个人，但他们在鼓掌。',
    cond: { need: ['music'] }, eff: { CHA: 4, FAME: 3 } },
  { id: 'h04', age: [17, 19], w: 9, text: '수능 高考日。全韩国的飞机为你们停飞十五分钟。你走出考场时，手在抖。',
    cond: { min: { INT: 45 } }, eff: {}, flags: ['suneung_good'] },
  { id: 'h05', age: [17, 19], w: 8, text: '수능 失利。你在汉江边坐了一整夜，江水很冷，但你没有跳下去。',
    cond: { max: { INT: 45 } }, eff: { WILL: 5, STRESS: 10 } },
  { id: 'h06', age: [17, 19], w: 6, text: '你拿到了 SKY（首尔大/高丽/延世）的录取通知书。整个巷子都知道了。',
    cond: { need: ['suneung_good'], min: { INT: 55 } }, eff: { INT: 4, FAME: 8, NET: 5 }, flags: ['sky'], job: '大学生' },
  { id: 'h07', age: [17, 19], w: 6, text: '你进了地方大学。学费是母亲借来的，但你发誓不会浪费。',
    cond: { ban: ['sky'] }, eff: { INT: 2, NET: 2 }, job: '大学生' },
  { id: 'h08', age: [17, 19], w: 5, text: '你放弃了大学，去工厂上班。流水线上的噪音盖过了所有关于未来的想象。',
    cond: { max: { MONEY: 1000000 } }, eff: { STR: 5, MONEY: 1200000, WILL: 3, INT: -3 }, job: '工厂工人' },
  { id: 'h09', age: [18, 19], w: 5, text: '你在便利店打夜班，遇到一个醉醺醺的大叔。他是太星集团的科长，说了一句你记了一辈子的话。',
    eff: { NET: 4, LOY: 3 }, flags: ['met_taeseong'] },

  /* ===== 大学 / 兵役 19-24 ===== */
  { id: 'u01', age: [19, 23], w: 9, text: '大学。你第一次和江南出身的同学坐在同一间教室里，听懂了什么叫「격차 差距」。', cond: { job: ['大学生'] }, eff: { INT: 3, NET: 3 } },
  { id: 'u02', age: [19, 23], w: 7, text: '你加入了投资社团，第一次买入股票——然后亏掉了一半。', cond: { need: ['stock_interest'] }, eff: { INT: 3, MONEY: -500000 } },
  { id: 'u03', age: [19, 23], w: 7, text: '你在自习室认识了一个家住 압구정 狎鸥亭的同学。他随手借你的两万块，够你吃一个月。', cond: { min: { CHA: 30 } }, eff: { NET: 8, CHA: 2 } },
  { id: 'u04', age: [19, 23], w: 6, text: '你拿到了美国大学的交换名额。机场里，母亲塞给你一袋辣白菜。', cond: { min: { INT: 60 } }, eff: { INT: 5, CHA: 3, FAME: 4 }, flags: ['exchange'] },
  { id: 'u05', age: [20, 24], w: 9, text: '병역 兵役通知书来了。两年，是你欠这个国家的。', cond: { gender: 'M', ban: ['no_military'] }, eff: { STR: 4, WILL: 3, HP: 3 }, flags: ['military'], job: '军人' },
  { id: 'u06', age: [20, 24], w: 7, text: '部队里你学会了两件事：服从，以及观察谁在真正发号施令。', cond: { need: ['military'] }, eff: { STR: 3, WILL: 3, NET: 3 } },
  { id: 'u07', age: [20, 24], w: 6, text: '你在部队考上了「카투사 KATUSA」，美军基地里的英语让你的世界大了一圈。', cond: { need: ['military'], min: { INT: 55 } }, eff: { INT: 4, CHA: 3, NET: 5 } },
  { id: 'u08', age: [20, 24], w: 5, text: '免役。你比同龄人多了两年，但少了军营里的人脉。', cond: { need: ['no_military'] }, eff: { INT: 3, WILL: 2 } },
  { id: 'u09', age: [21, 24], w: 6, text: '你在大学创业社团做的小程序，被一家小公司用 3000 万韩元买走。',
    cond: { need: ['coder'] }, eff: { MONEY: 30000000, FAME: 5, INT: 3 }, flags: ['first_exit'] },

  /* ===== 社会初期 23-32 ===== */
  { id: 's01', age: [23, 32], w: 9, text: '취업 求职季。你穿上人生第一套西装，在汝矣岛的招聘会上排了四个小时。', eff: { STRESS: 6 } },
  { id: 's02', age: [23, 32], w: 8, text: '你通过了太星集团的公开招聘。入职那天，你在大厅的集团标志前站了很久。',
    cond: { min: { INT: 50 } }, eff: { MONEY: 35000000, NET: 6, LOY: 10 }, job: '太星集团社员', flags: ['taeseong_staff'] },
  { id: 's03', age: [23, 32], w: 7, text: '你进了一家中小企业。加班到十一点是常态，회식 聚餐是必修课。', eff: { MONEY: 26000000, STR: -3, STRESS: 7 }, job: '会社员' },
  { id: 's04', age: [23, 32], w: 6, text: '你考上了公务员。母亲在电话那头哭了。', cond: { min: { INT: 60 } }, eff: { MONEY: 24000000, NET: 6, FAME: 4 }, job: '公务员' },
  { id: 's05', age: [24, 32], w: 7, text: '江南的房价每天都在涨。中介说：再不买就永远买不起了。', eff: { STRESS: 5 }, flags: ['house_pressure'] },
  { id: 's06', age: [24, 32], w: 6, text: '你在狎鸥亭的酒桌上替上司挡了一杯酒。从此他记得你的名字。', cond: { min: { CHA: 40 } }, eff: { NET: 8, LOY: 5, HP: -3 } },
  { id: 's07', age: [25, 32], w: 6, text: '你和相恋三年的女友分手了。她说：你什么都好，就是没有「집 房子」。', eff: { STRESS: 10, WILL: 4 } },
  { id: 's08', age: [25, 32], w: 5, text: '你结婚了。婚礼在江南的小型礼堂，礼金刚好够付半年的房租。', cond: { min: { CHA: 35 } }, eff: { WILL: 4, NET: 5, MONEY: 5000000 }, flags: ['married'] },
  { id: 's09', age: [24, 30], w: 6, text: '你被派到中国的分公司。两年的海外经历，换来了别人没有的视野。', cond: { need: ['taeseong_staff'] }, eff: { INT: 5, NET: 8, LOY: 6 } },
  { id: 's10', age: [26, 33], w: 6, text: '部门结构调整，你被列入「명예퇴직 名誉退职」名单。三十岁，你第一次失业。',
    cond: { ban: ['lucky'] }, eff: { MONEY: 20000000, STRESS: 12, WILL: 4 }, job: '无业' },
  { id: 's11', age: [26, 34], w: 6, text: '你在清潭洞开了第一家店：一间只有八平米的咖啡馆。', cond: { min: { MONEY: 30000000 } }, eff: { MONEY: -30000000, NET: 6, CHA: 4 }, job: '个体户', flags: ['own_shop'] },
  { id: 's12', age: [27, 35], w: 6, text: '你辞职创业。办公室在九老区的数字园，六个工位，四个人。',
    cond: { min: { WILL: 40, INT: 50 } }, eff: { MONEY: -20000000, WILL: 5, STRESS: 10 }, job: '创业者', flags: ['startup'] },

  /* ===== 经济事件（时代） ===== */
  { id: 'e1997', age: [12, 13], w: 12, once: true, text: '1997년 IMF。电视里总理说国家破产了。父亲把金戒指交给母亲，让她去排队换米。街头到处是「IMF 빚」的标语。',
    eff: { WILL: 6, STRESS: 10, MONEY: -2000000 }, flags: ['imf'], log: 'IMF 外汇危机：全国进入紧缩。' },
  { id: 'e1998gold', age: [13, 14], w: 8, once: true, text: '全民献金运动。母亲把结婚戒指放进了募捐箱，她说：国家也是家。',
    cond: { need: ['imf'] }, eff: { WILL: 4, FAME: 2 } },
  { id: 'e2002', age: [17, 18], w: 8, once: true, text: '2002 世界杯。整个首尔变成了红色的海。你在光化门前和几十万人一起喊「대한민국」。',
    eff: { WILL: 3, CHA: 2, STRESS: -8 } },
  { id: 'e2008', age: [23, 24], w: 11, once: true, text: '2008 金融海啸。KOSPI 单日暴跌，办公室里没有人说话。有人在楼下抽烟，抽完就上楼辞职了。',
    eff: { STRESS: 8, WILL: 3 }, flags: ['crisis2008'], log: '2008 金融危机：资产大幅缩水，但也是抄底之年。' },
  { id: 'e2012gangnam', age: [27, 28], w: 8, once: true, text: '《江南 Style》火遍全球。全世界的综艺都在跳骑马舞，而江南的房价又涨了一倍。',
    eff: { FAME: 2 }, flags: ['kpop_boom'] },
  { id: 'e2020', age: [35, 36], w: 10, once: true, text: '2020 疫情。股市熔断，但流动性洪水随后而来。有人破产，有人在一年里赚到了一辈子的钱。',
    eff: { STRESS: 6 }, flags: ['covid'], log: '2020 疫情冲击：资产剧烈波动，机会与风险同在。' },

  /* ===== 事业期 30-45 ===== */
  { id: 'b01', age: [30, 45], w: 9, text: '你的公司拿到了第一轮投资。投资人在合同上签字那一刻，你的手是凉的。',
    cond: { need: ['startup'] }, eff: { MONEY: 500000000, FAME: 10, NET: 8 } },
  { id: 'b02', age: [30, 45], w: 7, text: '你被太星集团挖角，成为战略室的次长。你终于走进了那栋楼的顶层。',
    cond: { min: { INT: 70 } }, eff: { MONEY: 120000000, LOY: 20, NET: 10, FAME: 8 }, job: '太星战略室次长', flags: ['taeseong_core'] },
  { id: 'b03', age: [30, 45], w: 7, text: '你在江南买下了第一套属于自己的公寓。签约那天，你在空房子里坐到天黑。',
    cond: { min: { MONEY: 800000000 } }, eff: { MONEY: -800000000, WILL: 6, CHA: 4, FAME: 5 }, flags: ['gangnam_owner'] },
  { id: 'b04', age: [32, 45], w: 6, text: '你的公司被大企业以极低的价格强行收购。你明白了：在这里，做大就会被吃掉。',
    cond: { need: ['startup'], ban: ['lucky'] }, eff: { MONEY: 300000000, STRESS: 14, WILL: 5 } },
  { id: 'b05', age: [32, 46], w: 6, text: '你出版了自传《반지하에서 강남까지》。签售会排了三百人。',
    cond: { min: { FAME: 40 } }, eff: { FAME: 15, MONEY: 150000000 } },
  { id: 'b06', age: [33, 45], w: 6, text: '体检报告上写着「과로 过劳」和三个红色箭头。医生说：你再这样会死。', eff: { HP: -12, STRESS: 10 } },
  { id: 'b07', age: [34, 48], w: 6, text: '你在济州岛休假两周。海风吹过来的时候，你第一次觉得活着是件好事。', eff: { HP: 8, STRESS: -15 } },
  { id: 'b08', age: [35, 46], w: 6, text: '你成立了基金，开始做真正的资本运作。钱第一次开始为你工作。',
    cond: { min: { MONEY: 3000000000, INT: 70 } }, eff: { MONEY: 500000000, NET: 12, FAME: 10 }, flags: ['fund'] },
  { id: 'b09', age: [33, 45], w: 5, text: '检察机关上门调查。你坐在审讯室里，第一次看清了这个国家真正的权力结构。',
    cond: { min: { FAME: 30 } }, eff: { STRESS: 12, WILL: 4, NET: 5 }, flags: ['probed'] },

  /* ===== 财阀线 36-60 ===== */
  { id: 't01', age: [36, 60], w: 10, text: '太星集团会长召见。老人的手指敲着桌面：「我听说过你。你很像年轻时的我。」',
    cond: { min: { LOY: 30, FAME: 30 } }, eff: { LOY: 15, NET: 10 }, flags: ['taeseong_inner'] },
  { id: 't02', age: [36, 60], w: 9, text: '继承之争开始。长子、二女儿、以及一个不被承认的私生子，三方都在拉拢你。',
    cond: { need: ['taeseong_inner'] }, eff: {}, flags: ['war_start'],
    choices: [
      { text: '站在长子一边（稳，但被架空）', eff: { LOY: 12, NET: 8, WILL: -3 }, flags: ['side_elder'] },
      { text: '站在二女儿一边（她的眼光最准）', eff: { LOY: 14, INT: 4, NET: 10 }, flags: ['side_second'] },
      { text: '谁也不站，做自己的局', eff: { WILL: 8, STRESS: 10, INT: 5 }, flags: ['side_self'] }
    ] },
  { id: 't03', age: [36, 60], w: 8, text: '你拿到了那份前世让你送命的文件：太星的秘密资金账本。这一次，你知道该怎么用。',
    cond: { need: ['past_life'], need2: ['taeseong_inner'] }, eff: { INT: 5, WILL: 6, STRESS: 8 }, flags: ['ledger'] },
  { id: 't04', age: [38, 60], w: 8, text: '你开始在市场上悄悄收购太星集团的流通股。3%，5%，7.4%……每一次都踩在披露线以下。',
    cond: { min: { MONEY: 5000000000 } }, eff: { MONEY: -2000000000, INT: 5, STRESS: 8 }, flags: ['buying_stake'] },
  { id: 't05', age: [38, 62], w: 7, text: '股东大会那天，你走进会场。闪光灯亮起的瞬间，你想起前世自己站在门外撑伞的那场雨。',
    cond: { need: ['buying_stake'] }, eff: { FAME: 25, LOY: -20, WILL: 8 }, flags: ['showdown'] },
  { id: 't06', age: [40, 62], w: 7, text: '一场突如其来的税务调查。你的对手比你想象的更不体面。',
    cond: { min: { FAME: 60 } }, eff: { STRESS: 14, MONEY: -300000000, WILL: 5 }, flags: ['tax_raid'] },
  { id: 't07', age: [40, 62], w: 6, text: '你成了太星集团的副会长。汉江对岸的灯，终于有一盏是你点亮的。',
    cond: { need: ['side_second'], min: { LOY: 70 } }, eff: { MONEY: 2000000000, FAME: 20, LOY: 10 }, job: '太星集团副会长' },
  { id: 't08', age: [42, 65], w: 6, text: '你把当年的那份账本交给了记者。三天后，太星集团的股价开盘跌停。',
    cond: { need: ['ledger'], need2: ['revenge'] }, eff: { FAME: 20, LOY: -40, WILL: 6, STRESS: 10 }, flags: ['exposed'] },
  { id: 't09', age: [45, 65], w: 6, text: '你在汝矣岛的办公室里签下收购协议。太星，从此改姓。',
    cond: { need: ['showdown'], min: { MONEY: 20000000000 } }, eff: { MONEY: -5000000000, FAME: 40, NET: 20 }, job: '太星集团会长', flags: ['took_over'] },

  /* ===== 通用 / 随机小事件 ===== */
  { id: 'r01', age: [20, 60], w: 6, text: '你在地铁里给一位老人让座。他递给你一张名片——那是你此后十年最重要的一通电话。',
    cond: { need: ['lucky'] }, eff: { NET: 12, CHA: 3 } },
  { id: 'r02', age: [22, 55], w: 5, text: '朋友拉你入伙一个「稳赚」的项目。你嗅到了骗局的味道。', eff: {},
    choices: [
      { text: '投进去（万一呢）', eff: { MONEY: -8000000, STRESS: 6, INT: 2 } },
      { text: '拒绝，并拉黑他', eff: { INT: 3, WILL: 2, NET: -3 } }
    ] },
  { id: 'r03', age: [25, 55], w: 5, text: '你连续三个月每天只睡四小时。身体开始抗议。', eff: { HP: -8, STRESS: 8 } },
  { id: 'r04', age: [25, 55], w: 5, text: '你开始跑步。清晨六点的汉江公园，跑着跑着就想通了很多事。', eff: { HP: 8, STR: 3, STRESS: -8 } },
  { id: 'r05', age: [26, 50], w: 5, text: '你参加了一场婚礼，认识了某个人。命运有时候就藏在一句客套话里。', cond: { min: { CHA: 40 } }, eff: { NET: 7 } },
  { id: 'r06', age: [28, 55], w: 4, text: '你的名字第一次出现在报纸上。不是讣告，是新闻。', cond: { min: { FAME: 25 } }, eff: { FAME: 6, CHA: 2 } },
  { id: 'r07', age: [30, 60], w: 5, text: '母亲病了。你在病房外走廊里签了一大堆单据，忽然发现自己是家里唯一能做决定的人。', eff: { WILL: 5, STRESS: 8, MONEY: -6000000 } },
  { id: 'r08', age: [30, 60], w: 4, text: '你资助了一个老家的孩子读书。没人知道，也不需要知道。', cond: { min: { MONEY: 100000000 } }, eff: { WILL: 4, FAME: 3, MONEY: -5000000 } },
  { id: 'r09', age: [35, 70], w: 5, text: '你在江南的一家清吧遇到了一个说真话的老记者。他告诉你的东西，比任何财报都有用。', eff: { INT: 5, NET: 6 } },
  { id: 'r10', age: [40, 75], w: 6, text: '你有了孩子。你把那个从小就画在纸上的高塔故事，讲给了他听。', cond: { need: ['married'] }, eff: { WILL: 5, STRESS: -6, HP: 3 } },
  { id: 'r11', age: [45, 75], w: 5, text: '你去医院做了全面体检。医生说：你比你看起来老十岁。', eff: { HP: -6, STRESS: 5 } },
  { id: 'r12', age: [55, 80], w: 6, text: '你开始写回忆录。第一句话是：我出生在一个看不见天空的房间里。', eff: { INT: 3, FAME: 5 } },
  { id: 'r13', age: [60, 80], w: 6, text: '你回到老家的巷子。半地下室还在，只是换了人家。', eff: { WILL: 3, STRESS: -5 } },
  { id: 'r14', age: [50, 80], w: 5, text: '有人在电视节目里提到你的名字，说你是「개천에서 용 난 사나이 从泥沟里飞出的龙」。', cond: { min: { FAME: 50 } }, eff: { FAME: 8, WILL: 4 } },
  { id: 'r15', age: [20, 50], w: 4, text: '你在书店站着看完了《자본론》。合上书时，你对自己的人生有了另一种解释。', cond: { min: { INT: 55 } }, eff: { INT: 4, WILL: 3 } },

  /* ===== 晚年 60+ ===== */
  { id: 'o01', age: [60, 80], w: 8, text: '你退休了，或者说被退休了。名誉会长，一个没有实权的头衔。', eff: { STRESS: 6, WILL: -2 } },
  { id: 'o02', age: [62, 80], w: 7, text: '你在汉江边的长椅上坐了一下午。江水还是那个江水。', eff: { STRESS: -12, WILL: 3 } },
  { id: 'o03', age: [65, 80], w: 6, text: '你把大部分财产捐了出去，成立了一个帮助半地下室孩子的基金。', cond: { min: { MONEY: 10000000000 } }, eff: { MONEY: -5000000000, FAME: 15, WILL: 6 } },
  { id: 'o04', age: [70, 80], w: 6, text: '医生把你叫到一边，说了那个词。你反而很平静。', eff: { HP: -20, STRESS: 8 } }
];

/* ---------------- 投资机会（前世记忆核心玩法） ---------------- */
/* year: 触发年份；hold: 持有到哪年结算；base: 基准倍率；vol: 波动 */
const INVESTMENTS = [
  { id: 'inv_imf_usd', year: 1997, name: '1997 IMF · 美元与黄金', hold: 2, cost: 2000000,
    hint: '원화는 무너진다 韩元会崩。你记得那一年，一美元从 900 韩元涨到了近 2000。',
    base: 2.6, vol: 0.5, kind: 'macro' },
  { id: 'inv_imf_junk', year: 1998, name: '1998 · 收购破产企业债券', hold: 3, cost: 5000000,
    hint: '大宇、起亚的债券被打到面值的两成。国家会兜底。', base: 4.2, vol: 1.2, kind: 'macro' },
  { id: 'inv_dotcom', year: 1999, name: '1999 · 互联网概念股', hold: 2, cost: 5000000,
    hint: '닷컴 버블。它会在 2000 年 3 月破裂，但在那之前会涨到荒唐的高度。', base: 2.4, vol: 1.0, kind: 'stock' },
  { id: 'inv_gangnam_apt', year: 2001, name: '2001 · 江南区公寓', hold: 6, cost: 20000000,
    hint: '江南区大峙洞的「은마아파트」。你记得它后来涨了十倍。', base: 3.2, vol: 0.4, kind: 'estate' },
  { id: 'inv_china', year: 2004, name: '2004 · 中国制造概念', hold: 3, cost: 10000000,
    hint: '중국 특수。韩国的中间材会跟着中国的工厂一起起飞。', base: 2.0, vol: 0.6, kind: 'stock' },
  { id: 'inv_2008', year: 2008, name: '2008 危机 · 抄底 KOSPI', hold: 3, cost: 30000000,
    hint: '所有人都恐慌的十月，是你一生中最好的买点。', base: 3.4, vol: 0.8, kind: 'stock' },
  { id: 'inv_kpop', year: 2011, name: '2011 · 娱乐公司股票', hold: 4, cost: 20000000,
    hint: '한류。你知道明年会有一个骑马的胖子让全世界认识江南。', base: 4.0, vol: 1.1, kind: 'stock' },
  { id: 'inv_btc', year: 2013, name: '2013 · 比特币', hold: 4, cost: 10000000,
    hint: '一个叫 비트코인 的东西，现在几百美元，你记得它后来能买一辆车。', base: 8.0, vol: 2.5, kind: 'crypto' },
  { id: 'inv_rebuild', year: 2015, name: '2015 · 江南再建筑', hold: 5, cost: 50000000,
    hint: '재건축。三十年老公寓拆掉重建的那几年，是韩国最稳的暴利。', base: 2.8, vol: 0.5, kind: 'estate' },
  { id: 'inv_covid', year: 2020, name: '2020 · 疫情熔断抄底', hold: 2, cost: 100000000,
    hint: '三月的熔断，所有人都在抛。然后流动性来了。', base: 2.5, vol: 0.7, kind: 'stock' },
  { id: 'inv_semicon', year: 2022, name: '2022 · 半导体超级周期', hold: 3, cost: 200000000,
    hint: 'AI 会吃掉全世界的高带宽内存。你记得那家公司叫什么。', base: 2.2, vol: 0.6, kind: 'stock' }
];

/* ---------------- 结局 ---------------- */
/* cond: 判定函数 (s) => bool；rank: S/A/B/C/D */
const ENDINGS = [
  { id: 'end_king', rank: 'S', title: '재벌의 주인 财阀之主',
    text: '你从半地下室走到了太星集团会长办公室的落地窗前。汉江在你脚下。前世的雨夜，终于被你亲手改写。',
    cond: s => s.flags.took_over },
  { id: 'end_avenger', rank: 'S', title: '복수의 설계자 复仇的设计者',
    text: '你没有拿走他们的钱，你拿走了他们的名字。太星集团的招牌被摘下那天，你在汉江大桥上站了很久。',
    cond: s => s.flags.exposed && s.stats.FAME >= 60 },
  { id: 'end_tycoon', rank: 'A', title: '자수성가亿万富豪',
    text: '你不属于任何家族，你只属于你自己。报纸称你为「흙수저의 반란 土勺子的叛乱」。',
    cond: s => s.stats.MONEY >= 50000000000 },
  { id: 'end_vice', rank: 'A', title: '회장의 오른팔 会长之右臂',
    text: '你一生都在别人的影子里，但那个影子覆盖了整个韩国的天际线。',
    cond: s => s.flags.side_second && s.stats.LOY >= 60 },
  { id: 'end_politician', rank: 'A', title: '여의도의 별 汝矣岛之星',
    text: '你走进了国会议事堂。韩国最锋利的权力不在江南的办公室，而在这里的一张票上。',
    cond: s => s.stats.FAME >= 85 && s.stats.NET >= 110 },
  { id: 'end_legend', rank: 'A', title: '전설 传说',
    text: '你的名字被写进了教科书。孩子们不知道你出生在哪儿，只知道你做过什么。',
    cond: s => s.stats.FAME >= 120 },
  { id: 'end_escape', rank: 'B', title: '해외 도피 远走他乡',
    text: '你在仁川机场的贵宾室里等着最后一班航班。钱还在，名字臭了。这也是一种活法。',
    cond: s => s.flags.tax_raid && s.stats.MONEY >= 1000000000 && s.stats.LOY < 0 },
  { id: 'end_fund', rank: 'B', title: '은퇴한 투자자 退休投资人',
    text: '你在济州岛有一栋房子和一片橘子园。钱够用，故事也够讲。',
    cond: s => s.stats.MONEY >= 3000000000 },
  { id: 'end_shop', rank: 'B', title: '따뜻한 가게 温暖的店',
    text: '你的咖啡馆还在清潭洞的巷子里。老顾客来了一茬又一茬，你记得每个人的口味。',
    cond: s => s.flags.own_shop && s.stats.MONEY > 0 && s.stats.MONEY < 3000000000 && s.stats.FAME < 40 },
  { id: 'end_salary', rank: 'C', title: '평범한 회사원 平凡的会社员',
    text: '你按时上下班，按时退休。回首尔的夜景时，你还是会想起小时候画的那个圈。',
    cond: s => ['会社员', '公务员', '太星集团社员', '工厂工人', '个体户'].indexOf(s.job) >= 0 && s.stats.FAME < 40 && s.stats.MONEY < 3000000000 },
  { id: 'end_broken', rank: 'D', title: '빚 负债者',
    text: '你奋斗了一辈子，最后只剩下一张催缴单和半地下室的钥匙。',
    cond: s => s.stats.MONEY < 0 },
  { id: 'end_lonely', rank: 'C', title: '혼자 独行者',
    text: '你爬得不算高，但每一步都是自己的。天黑了，你给自己倒了一杯烧酒。',
    cond: s => s.stats.WILL >= 60 },
  { id: 'end_normal', rank: 'C', title: '보통의 인생 普通的人生',
    text: '你的一生没有奇迹，也没有崩塌。像汉江的水，平稳地流过。',
    cond: () => true }
];

/* ---------------- 称号（按人生阶段显示身份） ---------------- */
const TITLES = [
  { min: 0,   max: 6,   name: '갓난아이 婴儿' },
  { min: 7,   max: 12,  name: '초등학생 小学生' },
  { min: 13,  max: 15,  name: '중학생 初中生' },
  { min: 16,  max: 18,  name: '고등학생 高中生' },
  { min: 19,  max: 200, name: '' }
];
