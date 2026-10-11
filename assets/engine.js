/* =========================================================
 * cangame v2 · engine.js
 * 引擎 = 编排层：仅驱动 5 阶段流转 + 「结束阶段→批量跑 AI」钩子；
 *          业务全在各 system 文件。Sprint 1 仅 settlement 真算，
 *          生产/贸易/战争/AI 用空桩占位（钩子预留）。
 * 依赖：config.js(rng/settle) / state.js / factions.js / resource.js / settle.js。
 * 加载顺序：settle.js → engine.js（最后业务模块，ui.js 之后加载）。
 * ========================================================= */

var PHASES = CONFIG.PHASES;

// 早间 AI 编排（Sprint 4）：领袖选举 + 背叛评估。
// 守卫：仅当 leader.js / ai.js 已加载才触发（旧 verify-s1/s2/s3 不加载 → no-op，零回归影响）。
function runMorningAI(state) {
  if (!state) return state;
  if (typeof leader !== 'undefined' && leader.runAll) leader.runAll(state);
  if (typeof ai !== 'undefined' && ai.decideAll) ai.decideAll(state, 'MORNING');
  return state;
}

// AI 批量决议（Sprint 2+）：在「结束阶段」后同步跑完各系统。
// 按当前阶段分派（避免重复结算）：
//   - MORNING                 → leader.runAll（选举）+ ai.decideAll（背叛评估）
//   - 离开生产阶段（TRADING）  → production.runAll（AI 自动产出）+ ai.decideAll（TRADING，no-op 占位）
//   - 离开贸易阶段（WAR）     → economy.runAll（AI 性格化挂单/撮合）+ war.runAll（AI 宣战并结算）
//                               + ai.decideAll（WAR，no-op 占位）
//   - 进入结算阶段（SETTLEMENT）→ war.runAll（结算人类 pending 战争）+ ai.decideAll（生存裁决由 settle.chooseVictims→ai 完成）
// 各 system 的 runAll 内部再咨询 ai.* 做性格化决策（ai.js 未加载时回退原逻辑，见各 system 守卫）。
// 完整 AI 行为树(ai.decideAll) 于 Sprint 4 接入：MORNING 做背叛评估，其余场景决策内嵌于对应 system。
// 顺序关键：战争掠夺（WAR 阶段 AI 战 / SETTLEMENT 结算人类战）早于阶段5 settle 扣药。
function runAIDecisions(state) {
  if (!state) return state;
  if (state.phase === 'MORNING') {
    runMorningAI(state);
  } else if (state.phase === 'TRADING') {
    if (typeof production !== 'undefined' && production.runAll) production.runAll(state);
    if (typeof ai !== 'undefined' && ai.decideAll) ai.decideAll(state, 'TRADING');
  } else if (state.phase === 'WAR') {
    if (typeof economy !== 'undefined' && economy.runAll) economy.runAll(state);
    if (typeof war !== 'undefined' && war.runAll) war.runAll(state);   // Sprint 3：AI 宣战 + 结算
    if (typeof ai !== 'undefined' && ai.decideAll) ai.decideAll(state, 'WAR');
  } else if (state.phase === 'SETTLEMENT') {
    if (typeof war !== 'undefined' && war.runAll) war.runAll(state);   // Sprint 3：结算人类 pending 战争
    if (typeof ai !== 'undefined' && ai.decideAll) ai.decideAll(state, 'SETTLEMENT');
  }
  return state;
}

// 终局判定：≤1 阵营存活 或 day > MAX_DAY。
function isEndgame(state) {
  var aliveFactions = state.factions.filter(function (f) { return f.alive && f.popAlive > 0; });
  if (aliveFactions.length <= 1) return true;
  if (state.day >= CONFIG.MAX_DAY) return true;
  return false;
}

// 推进一个阶段（MORNING→…→SETTLEMENT）。在 SETTLEMENT 时请改用 endDay()。
// 每个阶段切换都会批量跑 AI（当前空桩），并置 isResolving 标志。
function advancePhase(state) {
  if (state.status !== 'PLAYING') return { ok: false, reason: 'ended' };
  var i = PHASES.indexOf(state.phase);
  if (i < 0 || i >= PHASES.length - 1) {
    return { ok: false, reason: 'at-last-phase-call-endDay' };
  }
  state.phase = PHASES[i + 1];
  state.phaseStep = 0;
  state.isResolving = true;
  runAIDecisions(state);
  state.isResolving = false;
  pushLog(state, '进入阶段：' + (CONFIG.PHASE_LABELS[state.phase] || state.phase), 'phase');
  return { ok: true, phase: state.phase };
}

// 结束当日（在 SETTLEMENT 阶段点击「结束今日」时调用）：
// ① 跑结算（扣药/淘汰）② 判终局 ③ 否则 day++ 回 MORNING。
function endDay(state) {
  if (state.status !== 'PLAYING') return { ok: false, reason: 'ended' };

  state.isResolving = true;
  settleDay(state);              // ★ Sprint 1 唯一真算的系统
  runAIDecisions(state);         // 空桩
  state.isResolving = false;

  if (isEndgame(state)) {
    endGame(state);
    return { ok: true, ended: true, day: state.day };
  }

  state.day += 1;
  state.phase = 'MORNING';
  state.phaseStep = 0;
  // 新一天：重置各玩家行动力（供当日生产小游戏使用）。
  if (typeof production !== 'undefined' && production.resetDailyAP) production.resetDailyAP(state);
  // 早间 AI 编排：领袖选举 + 背叛评估（Sprint 4；leader/ai 未加载时守卫为 no-op）。
  runMorningAI(state);
  pushLog(state, '第 ' + state.day + ' 天开始', 'day');
  return { ok: true, ended: false, day: state.day };
}

// 便捷入口：UI 的「结束本阶段 ▶」按钮统一调用。
// 非结算阶段 → 推进；结算阶段 → 结束当日。
function endPhase(state) {
  if (state.phase === 'SETTLEMENT') return endDay(state);
  return advancePhase(state);
}

// 引擎对象（绑定单一 state，供 ui.js 使用）。
function createEngine(state) {
  return {
    state: state,
    advance: function () { return advancePhase(state); },
    endDay: function () { return endDay(state); },
    endPhase: function () { return endPhase(state); },
    isEnded: function () { return state.status === 'ENDED'; },
    isLastPhase: function () { return state.phase === 'SETTLEMENT'; },
    phaseIndex: function () { return PHASES.indexOf(state.phase); },
    totalPhases: PHASES.length
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.PHASES = PHASES;
  globalThis.runAIDecisions = runAIDecisions;
  globalThis.isEndgame = isEndgame;
  globalThis.advancePhase = advancePhase;
  globalThis.endDay = endDay;
  globalThis.endPhase = endPhase;
  globalThis.createEngine = createEngine;
}
