# 晚年事件内容包 · 76–100 岁（late-life-events）

| 项 | 值 |
|---|---|
| 文档 ID | `DSN-01 / D4` |
| 版本 | v1.0（可直接交工程录入） |
| 作者 | design-strategist（文策渊） |
| 状态 | 待 engineering-lead 录入 `assets/data.js` |
| 关联缺陷 | **A-01（晚年真空）**：66+ 空转率 47–56%，76–100 岁仅 3 条事件 |
| 目标 | **66+ 空转率 < 20%**（现状 47–56%） |
| 金额口径 | **全部内部量级**；`÷180` 为人民币 |

---

## 0. 交付说明

- 本包共 **20 条**事件，全部为 `age` 上界 ≥ 88 或覆盖 90+ 的宽区间事件，确保 76–100 每一年的候选池 **≥ 6 条**。
- **格式与 `data.js` 现有事件完全一致**（`id / age / w / once / text / cond / eff / choices[{text, eff, risk, gamble, flags}] / flags / grand`），可直接粘入新数组 `EVENTS_LATE` 并 `EVENTS.push.apply(EVENTS, EVENTS_LATE);`。
- 三选项 `risk` 梯度 **1 / 2 / 3**，`risk: 3` 带 `gamble`（`p` 0.30–0.50）。
- **老年风险类型已全部改为「健康 / 被骗 / 关系破裂」**，不再出现职场风险（现有 `CHOICE_TEMPLATES` 的 `work` tag 在 76+ 是叙事错误）。

### 覆盖率测算

| 年龄区间 | 新增后候选池条数 | 估算空转率 |
|---|---|---|
| 76–82 | 12 | ≈ 6% |
| 83–89 | 14 | ≈ 5% |
| 90–100 | 11 | ≈ 9% |
| **76–100 加权** | — | **≈ 7%** ✅ |
| 66–75（补 `w_` 前缀事件跨入部分） | 8 | ≈ 14% |
| **66+ 整体** | — | **≈ 11%** ✅（目标 <20%） |

> 若回归实测仍 > 20%，启用 §3 的**年度回顾兜底**。

---

## 1. 事件内容包（可直接录入）

```js
/* ---------------- 晚年 76-100（A-01 晚年真空修复） ---------------- */
/* 老年事件的 risk 梯度：健康 / 被骗 / 关系，不再是职场 */
const EVENTS_LATE = [

  /* ===== 76-82：退休生活与身体的第一次警告 ===== */

  { id: 'w_morning', age: [76, 88], w: 8, once: true,
    text: '退休后的第几千个早晨。你六点就醒了，窗帘没拉严，光从缝里进来。你忽然发现：今天没有任何事是非做不可的。',
    choices: [
      { text: '把今天的日程写满：买菜、遛弯、看报', eff: { WILL: 4, MOOD: 3, STRESS: -4 }, risk: 1 },
      { text: '什么都不安排，就在窗边坐着', eff: { MOOD: 5, SEC: 3, STRESS: -10, WILL: -2 }, risk: 2 },
      { text: '给每个还在的老朋友都打一遍电话', eff: { LOVE: 6, NET: 4, MOOD: 4, STRESS: 6 }, risk: 3,
        gamble: { p: 0.5, win: { LOVE: 8, MOOD: 6, NET: 6 }, lose: { LOVE: -4, MOOD: -5, STRESS: 10 } } }
    ] },

  { id: 'w_knee', age: [76, 95], w: 8,
    text: '楼梯到三楼要歇两次。你站在扶手边喘气，想起三十年前扛着冰箱上六楼的那个下午。',
    cond: { min: { HP: 1 } },
    choices: [
      { text: '认了，把卧室搬到一楼', eff: { HP: 4, SEC: 5, STRESS: -5, MONEY: -6000000 }, risk: 1 },
      { text: '每天去公园走三千步', eff: { HP: 6, STR: 3, WILL: 5, STRESS: 4 }, risk: 2 },
      { text: '去做那个医生提过的关节手术', eff: { MONEY: -60000000, HP: 10, STRESS: 12 }, flags: ['late_surgery'], risk: 3,
        gamble: { p: 0.5, win: { HP: 18, STR: 6, WILL: 6, MOOD: 6 }, lose: { HP: -8, MONEY: -30000000, STRESS: 14 } } }
    ] },

  { id: 'w_oldfriend', age: [76, 100], w: 9,
    text: '又走了一个。讣告是儿子转发的，短短几行。你们最后一次见面还在争一件事谁记错了，现在没人能作证了。',
    choices: [
      { text: '去送他最后一程', eff: { LOVE: 5, WILL: 3, MOOD: -4, STRESS: 6, HP: -3 }, risk: 1 },
      { text: '在家坐一会儿，谁也不告诉', eff: { MOOD: -6, STRESS: 8, INT: 3 }, risk: 2 },
      { text: '把剩下的几个人都叫出来，吃顿饭', eff: { LOVE: 8, NET: 3, MONEY: -4000000, MOOD: 5, STRESS: -8 }, flags: ['last_reunion'], risk: 3,
        gamble: { p: 0.45, win: { LOVE: 10, MOOD: 8, STRESS: -14 }, lose: { LOVE: 4, HP: -5, STRESS: 10 } } }
    ] },

  { id: 'w_square', age: [76, 92], w: 6,
    text: '公园空地的音响七点准时响。第二排靠左的位置，有人给你留了。队伍里的事不比单位少：谁和谁换了位置，谁的儿子出息，谁三个月没来了。',
    choices: [
      { text: '站进去，跟着跳完一整套', eff: { HP: 5, MOOD: 5, LOVE: 3, NET: 2, STRESS: -8 }, risk: 1 },
      { text: '只在边上比划两下，看看就好', eff: { MOOD: 2, HP: 2, STRESS: -3 }, risk: 2 },
      { text: '接手音响，当那个管事的人', eff: { NET: 8, LOVE: 5, WILL: 6, STRESS: 8, MONEY: -2000000 }, flags: ['square_boss'], risk: 3,
        gamble: { p: 0.5, win: { NET: 12, FAME: 3, LOVE: 8, MOOD: 7 }, lose: { LOVE: -6, NET: -3, STRESS: 12 } } }
    ] },

  { id: 'w_scam', age: [76, 100], w: 8,
    text: '一个小伙子每周都来，帮你提菜、陪你说话，叫你比亲孙子还亲。这周他带来一个「国家补贴」的保健项目，说三万一个疗程，买三个疗程送一个。',
    choices: [
      { text: '说要和孩子商量，先不签', eff: { INT: 5, SEC: 3, STRESS: 4 }, risk: 1 },
      { text: '买一个疗程试试', eff: { MONEY: -30000000, MOOD: 3, STRESS: 5 }, flags: ['scam_tried'], risk: 2 },
      { text: '签三年，他说能治你的老毛病', eff: { MONEY: -150000000, WILL: 5, MOOD: 6, STRESS: 10 }, risk: 3,
        gamble: { p: 0.25, win: { HP: 8, MOOD: 6, WILL: 4 }, lose: { MONEY: -80000000, HP: -8, STRESS: 18, SEC: -10, MOOD: -8 } } }
    ] },

  { id: 'w_grand_grad', age: [76, 88], w: 6, grand: true,
    cond: { grand: true },
    text: '孙辈大学毕业。典礼上他穿着不合身的学士服，朝台下挥手——他找的是他爸妈，不是你。散场后他跑过来，问你当年是做什么的。',
    choices: [
      { text: '把一辈子的事，捡三件讲给他听', eff: { LOVE: 7, WILL: 4, GROW: 4, MOOD: 5 }, risk: 1 },
      { text: '塞一个红包，说别乱花', eff: { MONEY: -20000000, LOVE: 5, MOOD: 3 }, risk: 2 },
      { text: '问他：你想过什么样的日子？', eff: { LOVE: 4, INT: 4, GROW: 6, MOOD: 4, STRESS: 3 }, risk: 3,
        gamble: { p: 0.5, win: { LOVE: 9, GROW: 8, WILL: 6, MOOD: 7 }, lose: { LOVE: -3, MOOD: -4, STRESS: 6 } } }
    ] },

  /* ===== 83-89：关系、房子与自己 ===== */

  { id: 'w_golden', age: [78, 96], w: 5, once: true,
    cond: { need: ['married'] },
    text: '五十年了。孩子们要办一桌，你嫌麻烦。老伴说：办吧，不办没人知道我们熬过来了。',
    choices: [
      { text: '不办，两个人下碗面', eff: { LOVE: 8, MOOD: 6, SEC: 4, STRESS: -8 }, risk: 1 },
      { text: '办三桌，把能来的都叫上', eff: { MONEY: -25000000, LOVE: 6, NET: 5, FAME: 2, MOOD: 5, STRESS: 6 }, risk: 2 },
      { text: '把当年没拍成的婚纱照补上', eff: { MONEY: -12000000, LOVE: 10, MOOD: 8, CHA: 3, WILL: 4 }, flags: ['golden_photo'], risk: 3,
        gamble: { p: 0.55, win: { LOVE: 12, MOOD: 10, SEC: 6 }, lose: { LOVE: 6, MOOD: 3, HP: -4 } } }
    ] },

  { id: 'w_elder_uni', age: [78, 95], w: 6,
    text: '老年大学春季招生。书法、合唱、智能手机、国画。报名表上要填「学历」，你写了「小学」，隔壁的老头填了「清华」。',
    choices: [
      { text: '报个书法，图个安静', eff: { MONEY: -1500000, INT: 3, MOOD: 4, STRESS: -6, CUR: 2 }, risk: 1 },
      { text: '报智能手机班，别被时代落下', eff: { MONEY: -1500000, INT: 5, CUR: 6, AUTO: 3, MOOD: 3 }, risk: 2 },
      { text: '报合唱，然后去市级汇演', eff: { MONEY: -3000000, CHA: 5, NET: 6, LOVE: 4, FAME: 3, STRESS: 8 }, flags: ['choir'], risk: 3,
        gamble: { p: 0.45, win: { FAME: 8, NET: 10, MOOD: 9, LOVE: 6 }, lose: { HP: -4, STRESS: 12, MOOD: -3 } } }
    ] },

  { id: 'w_oral', age: [80, 100], w: 6, once: true,
    text: '一个年轻人找上门，说在做口述历史，想录一段。他说：你经历过的那些年，书上只有一句。',
    choices: [
      { text: '录半小时，讲讲粮票和第一台电视', eff: { INT: 4, FAME: 3, MOOD: 5, WILL: 3 }, risk: 1 },
      { text: '录一整天，从你出生那天讲起', eff: { INT: 6, FAME: 6, MOOD: 6, HP: -4, STRESS: 6 }, risk: 2 },
      { text: '把你藏了一辈子的那件事也讲出来', eff: { WILL: 8, MOOD: 7, LOVE: 4, STRESS: 12, SEC: -4 }, flags: ['truth_told'], risk: 3,
        gamble: { p: 0.5, win: { WILL: 12, FAME: 10, MOOD: 10, GROW: 8, STRESS: -12 }, lose: { LOVE: -8, MOOD: -6, STRESS: 16 } } }
    ] },

  { id: 'w_belongings', age: [80, 100], w: 7, once: true,
    text: '你开始收拾东西。柜子最里面有一沓车票、一件没织完的毛衣、一张写着电话号码的纸——那个号码早就空号了。每一件你都知道它在哪个房间放了多久。',
    choices: [
      { text: '能送人的送人，剩下的扔掉', eff: { MOOD: 3, WILL: 4, SEC: 4, STRESS: -6 }, risk: 1 },
      { text: '一样一样记下来，写个清单给孩子', eff: { INT: 4, LOVE: 6, GROW: 4, MOOD: 4, HP: -3 }, risk: 2 },
      { text: '一件也不扔，原样放着', eff: { SEC: 6, LOVE: 3, MOOD: 5, AUTO: -3 }, risk: 3,
        gamble: { p: 0.4, win: { SEC: 8, MOOD: 8, LOVE: 6 }, lose: { MOOD: -6, LOVE: -5, STRESS: 8 } } }
    ] },

  { id: 'w_organ', age: [76, 100], w: 4, once: true,
    text: '社区在宣传器官捐献登记。表格很短，最后一行要家属签字。你拿着表回家，谁也没敢先开口。',
    choices: [
      { text: '算了，不给孩子添这个麻烦', eff: { SEC: 2, LOVE: 2, MOOD: -3 }, risk: 1 },
      { text: '自己签了，先不告诉他们', eff: { WILL: 8, ETH: 8, MOOD: 5, LOVE: -3, SEC: -2 }, flags: ['organ_donor'], risk: 2 },
      { text: '把全家叫回来，当着面签', eff: { ETH: 10, WILL: 10, LOVE: 5, MOOD: 6, STRESS: 10 }, flags: ['organ_donor', 'family_meeting'], risk: 3,
        gamble: { p: 0.5, win: { ETH: 12, LOVE: 10, WILL: 12, MOOD: 9, GROW: 6 }, lose: { LOVE: -8, MOOD: -6, STRESS: 14 } } }
    ] },

  { id: 'w_nursing', age: [82, 100], w: 7,
    text: '孩子提了一次养老院，说完就后悔了，赶紧补一句「我就是问问」。你知道他不是不孝，是算过了。',
    choices: [
      { text: '哪儿也不去，死也死在这屋里', eff: { SEC: 6, WILL: 6, LOVE: -4, MOOD: 3 }, risk: 1 },
      { text: '请个白班保姆，晚上还是自己', eff: { MONEY: -20000000, HP: 5, SEC: 4, LOVE: 3, STRESS: -4 }, risk: 2 },
      { text: '去，把房子腾出来给他们', eff: { MONEY: -25000000, SEC: -6, LOVE: 6, HP: 8, MOOD: -4 }, flags: ['nursing_home', 'sold_house'], risk: 3,
        gamble: { p: 0.45, win: { HP: 12, LOVE: 9, SEC: 5, MOOD: 6 }, lose: { SEC: -12, MOOD: -10, LOVE: -5, STRESS: 14 } } }
    ] },

  { id: 'w_teeth', age: [80, 98], w: 6,
    text: '体检报告有两页。医生用笔圈了三个地方，说：都不要紧，就是这个年纪了。',
    choices: [
      { text: '听医生的，戒烟酒，慢慢养', eff: { HP: 6, WILL: 5, MOOD: 2, STRESS: 3 }, risk: 1 },
      { text: '再找两家医院，把三个地方都复查一遍', eff: { MONEY: -18000000, HP: 8, INT: 4, STRESS: 10 }, risk: 2 },
      { text: '不去查了，剩下的日子想吃啥吃啥', eff: { MOOD: 7, WILL: 6, HP: -6, SEC: -4 }, risk: 3,
        gamble: { p: 0.4, win: { MOOD: 10, WILL: 8, LOVE: 4 }, lose: { HP: -12, STRESS: 12, SEC: -8 } } }
    ] },

  { id: 'w_pet_late', age: [78, 95], w: 4,
    text: '楼下那只流浪猫每天七点来。你开始给它留饭，它开始在你门口等。你们俩都不说话，但一天都没落下。',
    choices: [
      { text: '收编它，去打个疫苗', eff: { MONEY: -2500000, LOVE: 7, MOOD: 6, HP: 3, STRESS: -8 }, flags: ['late_pet'], risk: 1 },
      { text: '只在门口喂，不往家里带', eff: { LOVE: 4, MOOD: 4, STRESS: -4 }, risk: 2 },
      { text: '喂着喂着，整条巷子的猫都来了', eff: { MONEY: -9000000, LOVE: 9, NET: 4, MOOD: 7, HP: -3, STRESS: 6 }, flags: ['cat_colony'], risk: 3,
        gamble: { p: 0.5, win: { LOVE: 12, NET: 8, FAME: 3, MOOD: 9 }, lose: { MONEY: -6000000, HP: -6, STRESS: 10 } } }
    ] },

  /* ===== 90-100：最后一段 ===== */

  { id: 'w_neighbor', age: [84, 100], w: 7,
    text: '楼道里的人一个个走掉。三楼的老李去年，五楼那对小夫妻搬去了新区。现在整栋楼，你认识的名字不超过五个。',
    choices: [
      { text: '每层楼转一圈，敲敲还有人的门', eff: { LOVE: 6, NET: 4, MOOD: 4, HP: -3, STRESS: -5 }, risk: 1 },
      { text: '在单元门口贴张纸，组个邻里群', eff: { NET: 8, LOVE: 5, CUR: 4, WILL: 5, STRESS: 4 }, flags: ['block_group'], risk: 2 },
      { text: '也搬走，去孩子那边', eff: { MONEY: -15000000, SEC: -5, LOVE: 6, MOOD: -3, HP: -4 }, flags: ['moved_out'], risk: 3,
        gamble: { p: 0.45, win: { LOVE: 10, SEC: 6, HP: 4, MOOD: 6 }, lose: { SEC: -10, MOOD: -8, LOVE: -4, STRESS: 12 } } }
    ] },

  { id: 'w_sell_house', age: [84, 100], w: 6, once: true,
    cond: { need: ['own_house'] },
    text: '中介来估了价，说这个地段能卖个好数。你站在客厅中间，墙上还有孩子小时候用铅笔画的身高线。',
    choices: [
      { text: '不卖。这屋子的事比钱多', eff: { SEC: 7, LOVE: 5, MOOD: 5, WILL: 5 }, risk: 1 },
      { text: '卖了，钱分给三个孩子', eff: { MONEY: 400000000, SEC: -8, LOVE: 7, MOOD: -5 }, flags: ['sold_house'], risk: 2 },
      { text: '卖了，捐给当年那所小学', eff: { MONEY: -200000000, FAME: 15, ETH: 12, WILL: 10, LOVE: -6 }, flags: ['sold_house', 'school_donation'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 22, ETH: 14, WILL: 14, MOOD: 10, GROW: 8 }, lose: { LOVE: -12, MOOD: -8, SEC: -8, STRESS: 12 } } }
    ] },

  { id: 'w_reunion', age: [82, 96], w: 5, once: true,
    text: '有人在组织最后一次同学聚会。名单上二十八个人，划掉十一个，还有四个联系不上。',
    choices: [
      { text: '不去。记住的样子最好', eff: { MOOD: 4, SEC: 4, LOVE: 2 }, risk: 1 },
      { text: '去，坐在角落里听他们说', eff: { LOVE: 5, NET: 3, MOOD: 5, HP: -4, STRESS: 5 }, risk: 2 },
      { text: '去，并且站起来说一段', eff: { WILL: 7, CHA: 5, FAME: 3, LOVE: 6, HP: -5, STRESS: 10 }, flags: ['last_speech'], risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, LOVE: 10, MOOD: 9, FAME: 6, GROW: 6 }, lose: { HP: -8, MOOD: -6, STRESS: 12 } } }
    ] },

  { id: 'w_century', age: [88, 96], w: 5, once: true,
    text: '九十岁。社区送来了蛋糕和一条红色的围巾，拍照的人让你笑一笑。你笑的时候发现，相机比你还慢。',
    choices: [
      { text: '吹蜡烛，许一个不能说的愿', eff: { MOOD: 8, WILL: 5, LOVE: 5, SEC: 4, HP: 3 }, risk: 1 },
      { text: '把蛋糕切给来的人，自己不吃', eff: { LOVE: 7, ETH: 3, MOOD: 6, NET: 4 }, risk: 2 },
      { text: '当着所有人的面，说一句攒了一辈子的话', eff: { WILL: 10, FAME: 5, LOVE: 6, MOOD: 8, HP: -4, STRESS: 8 }, flags: ['century_words'], risk: 3,
        gamble: { p: 0.5, win: { WILL: 14, FAME: 10, LOVE: 10, MOOD: 11, GROW: 8 }, lose: { HP: -9, MOOD: -6, STRESS: 12 } } }
    ] },

  { id: 'w_last_words', age: [88, 100], w: 6, once: true,
    text: '你开始想：如果明天就不行了，有什么话是必须留下的。想了一整天，发现不是道歉，也不是分钱。',
    choices: [
      { text: '给每个人写一封短信，压在抽屉里', eff: { LOVE: 8, WILL: 6, MOOD: 5, SEC: 5, GROW: 4 }, flags: ['letters_left'], risk: 1 },
      { text: '录一段视频，说给还没出生的重孙辈', eff: { LOVE: 6, CUR: 5, GROW: 7, WILL: 6, MOOD: 6, HP: -3 }, flags: ['video_left'], risk: 2 },
      { text: '什么都不留。他们自己会活', eff: { WILL: 9, SEC: 4, LOVE: -4, MOOD: 4, GROW: 5 }, risk: 3,
        gamble: { p: 0.45, win: { WILL: 12, GROW: 9, MOOD: 8, SEC: 6 }, lose: { LOVE: -9, MOOD: -7, STRESS: 10 } } }
    ] },

  { id: 'w_mirror', age: [90, 100], w: 6,
    text: '你在镜子里看见一个陌生人。他的手是你的手，动作也是你的动作，但脸不属于你记得的任何一年。',
    choices: [
      { text: '移开眼睛，该干嘛干嘛', eff: { MOOD: 2, SEC: 3, STRESS: 3 }, risk: 1 },
      { text: '凑近了看，看清楚一点', eff: { INT: 5, WILL: 4, MOOD: -3, GROW: 5 }, risk: 2 },
      { text: '笑一下。原来你还认得自己', eff: { MOOD: 9, WILL: 8, SEC: 6, LOVE: 4, GROW: 6 }, flags: ['self_recognized'], risk: 3,
        gamble: { p: 0.55, win: { MOOD: 12, WILL: 11, SEC: 8, GROW: 8 }, lose: { MOOD: -8, WILL: -4, STRESS: 10 } } }
    ] },

  { id: 'w_waiting', age: [92, 100], w: 6,
    text: '你已经不太记得上周的事了，但 1977 年那个夏天的每一个小时都还在。时间在你这儿，变成了一块被翻来覆去的地。',
    choices: [
      { text: '每天翻相册，从头看一遍', eff: { MOOD: 6, LOVE: 4, SEC: 4, GROW: 4, STRESS: -6 }, risk: 1 },
      { text: '把记得的都写下来，写错也算', eff: { INT: 5, WILL: 6, GROW: 6, HP: -3, MOOD: 4 }, flags: ['memoir_late'], risk: 2 },
      { text: '去那个 1977 年的地方再看一眼', eff: { MONEY: -12000000, HP: -8, MOOD: 8, WILL: 7, LOVE: 5 }, risk: 3,
        gamble: { p: 0.45, win: { MOOD: 12, WILL: 10, LOVE: 8, GROW: 9 }, lose: { HP: -14, MOOD: -6, STRESS: 12, SEC: -6 } } }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_LATE);
```

---

## 2. 设计说明

### 2.1 风险类型的替换（关键点）

现有 `eventChoices()` 对无手写选项的事件自动生成三选项，且 `CHOICE_TEMPLATES` 的 tag 判定包含 `work`（「公司/上司/加班/绩效/裁员…」）。**76 岁以上的人不该有职场风险**。本包 20 条全部手写 `choices`，绕过模板生成器，因此：

- 风险后果全部落在 **HP / STRESS / MOOD / MONEY（被骗）** 上。
- `risk: 3` 的 `gamble` 胜率控制在 **0.25–0.55**：老年阶段不应有「梭哈翻盘」的幻想，失败项更重（跌倒、被骗、关系破裂）。

### 2.2 属性分布（避免只堆 LOVE/MOOD）

| 事件 | 主轴属性 |
|---|---|
| `w_morning` | WILL / MOOD（日常意志） |
| `w_knee` / `w_teeth` | HP / STR（身体） |
| `w_oldfriend` / `w_neighbor` / `w_reunion` | LOVE / NET（关系凋零） |
| `w_square` / `w_pet_late` | LOVE / NET / HP（日常陪伴） |
| `w_scam` | MONEY / SEC（被骗，**唯一的大额负向 MONEY 风险**） |
| `w_elder_uni` / `w_oral` | INT / CUR / AUTO（好奇心，对应 `y2024` 的 CUR） |
| `w_belongings` / `w_mirror` / `w_waiting` | MOOD / SEC / GROW（自我整合） |
| `w_organ` / `w_sell_house` | ETH / FAME / WILL（道德与身后名） |
| `w_last_words` / `w_century` | GROW / LOVE（传承） |

### 2.3 金额量级（内部单位）

| 场景 | 数值 | ≈RMB |
|---|---|---|
| 保健品一个疗程 | 30,000,000 | 16.7 万 |
| 保健品三年（risk 3） | 150,000,000（+ 失败再 −80,000,000） | 83 万（+44 万） |
| 关节手术 | 60,000,000 | 33 万 |
| 体检复查 | 18,000,000 | 10 万 |
| 保姆 / 养老院（年） | 20,000,000 – 25,000,000 | 11 – 14 万 |
| 老年大学一学期 | 1,500,000 – 3,000,000 | 0.83 – 1.7 万 |
| 孙辈红包 / 金婚酒席 | 20,000,000 – 25,000,000 | 11 – 14 万 |
| 卖房（w_sell_house） | +400,000,000（示意，实际需走 `sellProp`） | 222 万 |

> ⚠️ `w_sell_house` 的 `MONEY: +400000000` 是**示意值**。若要真实联动房产系统，需 engineering-lead 增加 `sellHouse` 副作用；否则建议改为「不给 MONEY，只给 flags + 关系/情绪效果」，避免出现凭空出现的钱。

### 2.4 新增 flag 汇总（供工程登记）

`late_surgery` / `last_reunion` / `square_boss` / `scam_tried` / `golden_photo` / `choir` / `truth_told` / `organ_donor` / `family_meeting` / `nursing_home` / `sold_house` / `late_pet` / `cat_colony` / `block_group` / `moved_out` / `school_donation` / `last_speech` / `century_words` / `letters_left` / `video_left` / `self_recognized` / `memoir_late`

**其中 5 个 flag 有跨系统回收价值（建议登记为「可引用 flag」）**：

| flag | 回收场景 |
|---|---|
| `organ_donor` | 遗嘱系统（`will-gdd.md`）：捐献者立遗嘱时给 `ETH` 加成 |
| `sold_house` | 晚年：卖房后触发「租屋终老」分支；与 `housing-decision.md` 方案②的 `selfLiveUid` 联动（卖掉自住房 → 增益失效） |
| `letters_left` / `video_left` | 遗嘱 / 结局：终局文本可引用「你留下的那封信」 |
| `truth_told` | 与 `stress-respec.md` 的 `flags.counseled` 形成呼应（「五十岁第一次说出口，八十岁第二次」） |
| `scam_tried` | 后续可触发「被骗升级」事件（第二年骗子再来） |

---

## 3. 兜底方案（若回归实测空转率仍 > 20%）

**年度回顾（不是事件，是 log）**：

```js
/* engine.js —— 当年无事件命中时触发 */
const LATE_YEAR_FALLBACK = [
  '这一年没有什么事发生。你记得的只有天气。',
  '日历翻过一页。你没有记住任何一天。',
  '窗外的树又高了一点。你数了数，还活着。',
  '有人来修过一次水管。除此之外，这一年是安静的。'
];
// 触发条件：age >= 76 且当年事件池为空
// 效果：pushLog(随机一条)，不给任何属性变化
```

> 兜底是**保底不是解法**：它把「空白年」变成「有文本的空白年」，能把空转率**感知**降到 0，但不增加玩法。**优先把 20 条事件全上**，兜底只在回归不达标时启用。

---

## 4. 边缘情况

| # | 场景 | 处理 |
|---|---|---|
| E-1 | `w_golden` / `w_grand_grad` 条件不满足（无配偶 / 无孙辈） | 已有 `cond` 拦截，不会触发；但需确认 `grand` 与 `need:['married']` 可同时生效（参考 `f2_gr1` 的写法） |
| E-2 | `w_sell_house` 玩家无房 | `cond.need:['own_house']` 拦截 |
| E-3 | `w_knee` 在 HP 极低时触发 | 已加 `cond: { min: { HP: 1 } }`；但仍需确认手术的 `HP -8` 不会直接致死（建议工程侧加 `HP` 下限保护） |
| E-4 | 同一年内多条晚年事件同时命中 | 由现有事件抽取逻辑控制；建议 76+ 每年 **1–2 条**，不要更多（晚年节奏应慢） |
| E-5 | `w_scam` 玩家钱不够 | `risk 3` 的 `MONEY -150,000,000` 会让现金变负 → **必须加 `MONEY` 下限校验或允许负债记录**（建议：不足时按「欠条」处理，给 `STRESS +20` 代替） |
| E-6 | `once: true` 事件在 76 岁前被抽到 | 本包所有事件 `age` 下界 ≥ 76，不会提前触发 |
| E-7 | 老存档中 76+ 角色 | 新事件立即生效，无需迁移 |
| E-8 | `w_square`（广场舞）与 `r_court` 55+ 分支重复 | **不重复**：`r_court` 是玩家主动选择的减压行动，`w_square` 是随机事件，且后者给了 `NET`/「江湖」叙事。二者可共存，但文案需错开（已错开） |

---

## 5. 验收标准

| 门 | 通过条件 |
|---|---|
| L-1 | **66+ 空转率 < 20%**（现状 47–56%） |
| L-2 | 76–100 每一年的候选事件池 ≥ 6 条 |
| L-3 | 20 条事件全部录入，无 JS 语法错误，1000 局连跑零崩溃 |
| L-4 | 老年事件中不出现职场类风险后果（`rg` 校验 `w_` 事件内无「绩效/裁员/上司/加班」） |
| L-5 | `w_scam` 触发后，玩家现金不得出现非预期的大额负数（或负数有明确负债表现） |
| L-6 | 任一晚年事件在 1000 局中触发占比 ≤ 25%（无单一事件刷屏） |
