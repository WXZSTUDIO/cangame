// 一次性补丁：重写 lifeEpitaph（长度加厚 + 分档用巅峰值 + 私生子点名 + 总评段）
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '../assets/engine.js');
let s = fs.readFileSync(P, 'utf8');
const START = '/* =========================================================\n * v6.2.2 动态一生大结局文本生成器';
const END = 'function finish(state) {';
const i = s.indexOf(START), j = s.indexOf(END, i);
if (i < 0 || j < 0) { console.error('markers not found'); process.exit(1); }

const BLOCK = `/* =========================================================
 * v6.2.2 动态一生大结局文本生成器（碑文 · 平生总结）
 * 三条轴 + 总评，拼出 ~300 字沧桑叙事：
 *   ① 职业与社会地位  ② 情感与家庭  ③ 财富与晚景  ④ 一句总评
 * 数据全部来自真实人生（job/flags/配偶/子女/前任/巅峰净资产/成就…）。
 * 生成一次后写进 state.epitaph 随存档持久化，重开结算页不会变脸。
 * ========================================================= */
function lifeEpitaph(state) {
  const s = state.stats, f = state.flags || {};
  const worth = worthOf(state);
  const peak = Math.max((state.peak && (state.peak.NET || state.peak.MONEY)) || 0, worth);
  const y1 = state.startYear || (typeof START_YEAR !== 'undefined' ? START_YEAR : 2000);
  const y2 = y1 + (state.age || 0);
  const sp = state.spouse;
  const kids = (state.children || []).filter(c => c.alive !== false).length;
  const bastards = (state.children || []).filter(c => c.illegit).length;
  const exN = (state.exes || []).length;
  const ach = state.achievements || [];
  const job = String(state.job || '');
  const fame = s.FAME || 0;
  const eth = s.ETH || 0;
  const love = s.LOVE || 0;
  const pick = arr => arr[randInt(0, arr.length - 1)];

  /* 开篇 */
  const opener = pick([
    \`\${y1} 年，你哭着来到这个世界；\${y2} 年，世界安静地送你离开。\${state.age} 年，就这么过去了。\`,
    \`从 \${y1} 到 \${y2}，\${state.age} 年。掌声与嘘声都停了，幕布缓缓落下。\`,
    \`\${y2} 年，讣告只有短短一行。可这一行字背后，是 \${state.age} 年的鸡毛与星光。\`
  ]);

  /* ① 职业与社会地位 */
  let career;
  if (ach.indexOf('a_astro') >= 0 || /宇航|航天/.test(job)) {
    career = pick([
      '你曾替这个时代仰望星空。返回舱划破夜空的那一晚，无数人仰起头，在光里找你的名字。',
      '从发射场的烈焰到失重中的寂静，你走过的路，比大多数人想象的一生都远。'
    ]);
  } else if (ach.indexOf('a_jail') >= 0 || f.ex_prisoner || state.prison > 0) {
    career = pick([
      '你的名字更多出现在卷宗里，而不是光荣榜上。铁窗内那几年，给后半生都染上了颜色。',
      '出狱那天没有人接你。后来的每个黄昏，你都在证明自己不止是档案上的那个编号。'
    ]);
  } else if (/教师|教授|老师/.test(job)) {
    career = pick([
      '三尺讲台，一站几十年。毕业的学生散在世界各地，提起你，都叫一声「先生」。',
      '粉笔灰落满了袖口，也落出了桃李满天下。你没大富大贵，却改写了无数人的命运走向。'
    ]);
  } else if (/医生|大夫|院士|科研|工程师/.test(job)) {
    career = pick([
      '无影灯与实验室的白炽灯，照亮了同一个执念：让人活得更好一点，再好一点。',
      '你的名字印在论文的角注里，却在无数陌生人的生命里续着章节。'
    ]);
  } else if (peak >= 100e8 || /董事长|总裁|主席/.test(job)) {
    career = pick([
      '你缔造了一个商业帝国。谈判桌上的每一次沉默，都曾让对面的城市彻夜灯火通明。',
      '从第一桶金到千亿帝国，你在刀锋上走了半生。传说里有你，骂声里也有你。'
    ]);
  } else if (peak >= 10e8) {
    career = pick([
      '你发过财，也守过财。行情软件里的账户曲线，就是你这半生心电图。',
      '没人知道你到底多有钱——你只说「够用」。只有账本知道，那些数字惊心动魄过。'
    ]);
  } else if (fame >= 55 || /演员|歌手|导演|明星/.test(job)) {
    career = pick([
      '海报会褪色，胶片会泛黄，但那个角色永远定格在时代的放映机里。',
      '聚光灯追了你半生。你谢幕时，整个时代的观众都站了起来。'
    ]);
  } else if (fame < 12 && peak < 2e8) {
    career = pick([
      '你这一生安静得像一滴水落进江里。没有人给你写传记，可你把身边人的人生都焐热了。',
      '世界不记得你的名字，但你修好的那台机器、帮过的那个人，都还记得。'
    ]);
  } else {
    career = pick([
      '你在平凡的岗位上把一件事做了几十年。不出彩，也从没让相信你的人失望。',
      '一辈子没站上过什么大舞台，可生活给你的每一个角色，你都演得认真。'
    ]);
  }

  /* ② 情感与家庭 */
  let family;
  const affSp = sp ? (sp.affinity || 60) : 0;
  if (sp && sp.alive !== false && affSp >= 78 && exN <= 1 && bastards === 0) {
    family = pick([
      '这一生你只爱过一个人。从青丝到白发，同一双手握了一辈子——这大概是人间最奢侈的胜利。',
      '你们的婚姻熬过了穷日子、病榻和漫长的争吵，最后连吵架都变成了舍不得。金婚那天，你说：下辈子还找她。'
    ]);
  } else if (bastards >= 2 || (bastards >= 1 && f.exposed)) {
    family = pick([
      \`葬礼那天来了两拨人：灵堂里的，和灵堂外替孩子争产的。\${bastards} 个私生子的名字，是你留给世界的注脚，也是你带不走的骂名。\`,
      \`你藏了一辈子的私生子，最后都站在了你的墓前。血缘是躲不掉的债，骂名是还不清的账。\`
    ]);
  } else if (f.exposed || f.spouse_sued || f.blacklisted) {
    family = pick([
      '那段被报纸头条撕开的婚姻，成了你人生里最响的一声耳光。体面这东西，碎过就拼不回原样。',
      '晚年的饭桌上永远空着一把椅子。你赢过很多东西，唯独没赢回那扇为你关上的门。'
    ]);
  } else if (kids >= 3 || (kids >= 1 && f.grand)) {
    family = pick([
      \`膝下 \${kids} 个孩子，孙辈绕床。逢年过节一屋子人喊你的名号，你在闹声里眯着眼笑——这就是你的江山。\`,
      '你把一个家的火种传了下去。后代未必都成器，但每逢清明，坟前总是满的。'
    ]);
  } else if (kids === 0 && exN >= 2) {
    family = pick([
      \`你爱过 \${exN} 个人，也弄丢过 \${exN} 个人。浪子的一生自由得像风，也孤单得像风。\`,
      '每一段感情开始时都像烟花，结束时都像退潮。最后陪你的是一只猫，和满墙的旧照片。'
    ]);
  } else if (!f.married) {
    family = pick([
      '你一个人吃饭、一个人看病、一个人过节。自由是真的，深夜里那点空也是真的。',
      '没有婚礼，没有子女。可你把独身的日子过成了自己的形态，不求人懂。'
    ]);
  } else {
    family = pick([
      '婚姻谈不上轰轰烈烈，柴米油盐里两个人互相撑着走完了。这就够难，也够好了。',
      '你们没说过一句「爱」，却把一辈子过成了彼此的托底。'
    ]);
  }

  /* ③ 财富与晚景 */
  let wealth;
  if (f.foundation) {
    wealth = pick([
      '生命的最后几年，你把名下资产几乎全部转进了以自己名字命名的慈善基金。签完最后一份文件那晚，你睡得格外沉。',
      '散尽千金的那一天，你反而觉得自己从未如此富有。被你帮过的人会替你，继续活很多次。'
    ]);
  } else if (peak >= 100e8) {
    wealth = pick([
      '千亿身家，财经版头条的常客。可再贵的病床，也买不回一次普通的散步。',
      '数字后面的零多到数不清，遗嘱却改了又改。你终于明白，财富能安排一切，唯独安排不了告别。'
    ]);
  } else if (peak >= 10e8) {
    wealth = pick([
      '家业足够荫及三代。你晚年最大的爱好，是在阳台上算那些已经不需要算的账。',
      '你给后人留下了房子、股份和一句家训：钱要挣得睡得着觉。'
    ]);
  } else if (peak >= 1e8) {
    wealth = pick([
      '不算大富大贵，但这一生没为钱弯过腰。房子是自己的，晚年是自己做主的。',
      '存折上的数字不算惊人，却撑起了你全部的体面与从容。'
    ]);
  } else if (peak >= 2e7) {
    wealth = pick([
      '小康一生。有惊无险，有盈有亏，年终的账本总能勉强画上一个平局。',
      '你把日子过成了一条平稳的均线——没有奇迹，也没有崩盘。'
    ]);
  } else {
    wealth = pick([
      \`你这一生与财富无缘\${state.retirePlan ? '，晚年住进养老院，却把海钓鱼竿玩成了院子里最靓的风景' : ''}。清贫，但账目清白，走得坦然。\`,
      '最后几年的日子过得紧巴巴，可你总说：穷人有穷人的过法，眼泪解决不了的事，笑可以。'
    ]);
  }

  /* ④ 一句总评 */
  let verdict;
  if (eth >= 75) {
    verdict = pick([
      '认识你的人都说：你这辈子最难得的，是干净。',
      '你没做过亏心事。这五个字，很多人一辈子都挣不来。'
    ]);
  } else if (eth <= 30) {
    verdict = pick([
      '提起你，人们先沉默，再叹气。功过交给碑文，骂声留给风。',
      '你一生精明，唯独没算明白「良心」这笔账。'
    ]);
  } else if (love >= 70 || (s.MOOD || 0) >= 65) {
    verdict = pick([
      '你把温柔给了身边每一个人。被你暖过的人，很多。',
      '认识你的人提起你，都会先笑一下——这就够了。'
    ]);
  } else {
    verdict = pick([
      '你算不上什么大人物，也绝不是无名之辈。',
      '一半是烟火，一半是清欢——这就是你的一生的注脚。'
    ]);
  }

  /* 收尾 */
  const closer = pick([
    '碑上的字会被风雨磨平，但有些夜晚，永远留在了活着的人心里。',
    '一生很长，长到足够原谅一切；一生也很短，短到来不及好好告别。',
    '世界不会记得大多数人的名字，但爱过你的人，记得你的全部。',
    '谢幕不是结束——你改变过的、爱过的、坚持过的，都在继续生长。',
    '尘埃落定，潮水退去，沙滩上留下的形状，就是你。',
    '往后的每一年，仍会有人记得你的生日，只是蜡烛少了一支。',
    '墓志铭写不下一生。一生，也不需要谁来打分。'
  ]);

  return [opener, career, family, wealth, verdict, closer].join('');
}

`;
s = s.slice(0, i) + BLOCK + s.slice(j);
fs.writeFileSync(P, s);
console.log('patched, new size', s.length);
