#!/usr/bin/env bash
# 列出所有已保存的学习主题。用法：scripts/list.sh [--all]
# 扫描 $LEARN_HOME 与当前目录的 ./learn。
set -uo pipefail

LEARN_HOME="${LEARN_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/learn-coach}"
ROOTS=("$LEARN_HOME")
[ -d "./learn-coach" ] && ROOTS+=("./learn-coach")

found=0
for root in "${ROOTS[@]}"; do
  [ -d "$root" ] || continue
  for d in "$root"/*/; do
    [ -f "${d}state.json" ] || continue
    found=$((found + 1))
    python3 - "${d}state.json" <<'PY'
import json, sys, datetime
p = sys.argv[1]
s = json.load(open(p))
ch = s.get("chunks", [])
passed = sum(1 for c in ch if c.get("status") == "passed")
cur = next((c for c in ch if c.get("status") in ("in_progress", "now")), None)
due = sorted({r.get("due") for r in s.get("reviewQueue", []) if r.get("due")})
today = datetime.date.today().isoformat()
overdue = [x for x in due if x <= today]
slug = s.get("slug") or p.split("/")[-2]
now = cur["title"] if cur else "—"
solo = f"（{cur['solo']}）" if cur and cur.get("solo") else ""
gate = s.get("progress", {}).get("gateCount", 0)
line = f"- {slug} · 进度 {passed}/{len(ch)} · 第 {gate} 关 · 当前 {now}{solo}"
if due:
    line += f" · 复习 {due[0]}" + (f"（{len(overdue)} 项到期）" if overdue else "")
if s.get("pending"):
    line += f" · 未完成：{s['pending'].get('task', '?')}"
line += f" · 更新 {s.get('updatedAt', '?')[:10]}"
print(line)
m = s.get("mission", {}).get("goal")
if m:
    print(f"  目标：{m}")
PY
  done
done

if [ "$found" -eq 0 ]; then
  echo "（没有已保存的学习主题）"
fi
