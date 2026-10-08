#!/usr/bin/env bash
# tools/ 全套回归串行执行，逐条打印退出码。
# 子进程 execFileSync 在沙箱下会被信号杀掉 → 改由 bash 直接串行跑。
cd "/c/Users/ro3ea/WorkBuddy/作品集/cangame" || exit 1
# 硬编码的 node.exe 路径会随版本目录升级失效（22.22.2-3 → -6），用 PATH 里的 node。
NODE="${NODE:-node}"
CASES="_verify-v52.js _verify-v53.js _verify-v54.js _verify-v55.js _verify-school.js _verify-relax.js dom-test.js browser-parity-test.js v5-test.js"
bad=0
for f in $CASES; do
  out=$("$NODE" "tools/$f" 2>&1)
  code=$?
  p=$(printf '%s' "$out" | grep -o '✓' | wc -l)
  x=$(printf '%s' "$out" | grep -o '✗' | wc -l)
  [ "$code" -ne 0 ] && bad=$((bad+1))
  printf '%-24s exit=%s  pass=%s  fail=%s  %s\n' "$f" "$code" "$p" "$x" "$([ $code -eq 0 ] && echo PASS || echo FAIL)"
  if [ "$code" -ne 0 ]; then
    printf '%s\n' "$out" | grep -E '✗|FAIL|Error|error' | head -20
  fi
  printf '%s\n' "$out" | tail -3
  echo "------------------------------------------------------------"
done
echo "FAIL 总数：$bad"

# ---- 经济数值链（F 盘产物，team-lead 2026-10-08 要求进常规验证链）----
# 改任何经济数值（era table / norm / HOUSE_INDEX / SCORE_K / ladder.sal / livingCost）后必跑。
ENG="F:/2.project/cangame-v6/engineering/scripts"
echo "============================================================"
for f in p2-verify.js ew5-spectrum.js; do
  out=$("$NODE" "$ENG/$f" 2>&1)
  code=$?
  p=$(printf '%s' "$out" | grep -o '✓' | wc -l)
  x=$(printf '%s' "$out" | grep -o '✗' | wc -l)
  w=$(printf '%s' "$out" | grep -c 'WARN')
  [ "$code" -ne 0 ] && bad=$((bad+1))
  printf '%-24s exit=%s  pass=%s  fail=%s  warn=%s  %s\n' "$f" "$code" "$p" "$x" "$w" "$([ $code -eq 0 ] && echo PASS || echo FAIL)"
  if [ "$code" -ne 0 ]; then
    printf '%s\n' "$out" | grep -E '✗|FAIL|Error|error' | head -20
  fi
  printf '%s\n' "$out" | grep -E '⚠|WARN|ℹ|→' | head -20
  echo "------------------------------------------------------------"
done
echo "FAIL 总数（含经济链）：$bad"
