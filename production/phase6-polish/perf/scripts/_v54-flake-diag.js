/* 诊断 _verify-v54 「恩师至少比你大 14 岁」flake 的根因。
 *
 * 假设：测试调的是 A.friendGrowth(s)（只负责结识新朋友），
 *       而产品里真正每年跑的是 friendTick(s)（含全员 +1 岁 + 老友离世）。
 *       于是恩师年龄被冻结在「相遇那年」，6 年后差距被吃掉 6 岁 → 偶发失败。
 *
 * 验证：同一段测试逻辑，分别用 friendGrowth / friendTick 跑 N 轮，比对失败率。
 * 循环整个塞进 VM 里跑，避免几千次跨界调用。
 */
const H = require('./harness');
const V = H.loadVM(false);

const out = V.run(`(function(){
  function once(useTick){
    var teacher = null;
    for (var i = 0; i < 400 && !teacher; i++) {
      var s = createGame({ name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: [] });
      s.age = 12; s.friends = [];
      for (var y = 0; y < 6; y++) {
        if (useTick) friendTick(s); else friendGrowth(s);
        s.age++;
      }
      var t = (s.friends || []).find(function(f){ return f.key === 'teacher'; });
      if (t) teacher = { age: t.age, me: s.age, since: t.since, gapAtMeet: t.age - t.since };
    }
    return teacher;
  }
  var N = 400, res = {};
  [['friendGrowth（v54 现在的写法）', false], ['friendTick（产品真实路径）', true]].forEach(function(pair){
    var miss = 0, gapMin = 1e9, gapMax = -1e9, snMin = 1e9, snMax = -1e9, sample = null;
    for (var i = 0; i < N; i++) {
      var t = once(pair[1]);
      if (!t) continue;
      var d = t.age - t.me;
      if (d < 14) { miss++; if (!sample) sample = t; }
      if (d < gapMin) gapMin = d;
      if (d > gapMax) gapMax = d;
      if (t.since < snMin) snMin = t.since;
      if (t.since > snMax) snMax = t.since;
    }
    res[pair[0]] = {
      miss: miss, N: N, gapMin: gapMin, gapMax: gapMax, snMin: snMin, snMax: snMax,
      sample: sample ? ('相遇于 ' + sample.since + ' 岁（师 ' + (sample.since + sample.gapAtMeet) + ' 岁，差 ' + sample.gapAtMeet + '）→ 六年后你 ' + sample.me + ' 岁、师仍记 ' + sample.age + ' 岁，差只剩 ' + (sample.age - sample.me)) : '无'
    };
  });
  return res;
})()`);

console.log('# _verify-v54 「恩师年龄」flake 根因诊断');
console.log('');
console.log('| 驱动函数 | 样本局数 | 差不足 14 岁的局数 | 失败率 | 实测年龄差区间 | 相遇年龄区间 |');
console.log('|---|---:|---:|---:|---|---|');
Object.keys(out).forEach(k => {
  const r = out[k];
  console.log('| ' + k + ' | ' + r.N + ' | ' + r.miss + ' | ' +
    (r.miss / r.N * 100).toFixed(1) + '% | ' + r.gapMin + ' ~ ' + r.gapMax + ' | ' + r.snMin + ' ~ ' + r.snMax + ' |');
});
console.log('');
Object.keys(out).forEach(k => console.log('- **' + k + '** 反例：' + out[k].sample));
console.log('');
console.log('FRIEND_TYPES.teacher = ' + V.run(`JSON.stringify(FRIEND_TYPES.find(function(x){return x.key==='teacher';}))`));
