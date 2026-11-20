#!/usr/bin/env bash
# 自测：在临时目录里跑一遍 record / review / list，不碰真实学习数据。
# 用法：scripts/selftest.sh    退出码 0 表示通过。
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export XDG_DATA_HOME="$TMP"

command -v python3 >/dev/null || { echo "需要 python3"; exit 1; }

D="$TMP/learn-coach/demo"
mkdir -p "$D/artifacts" "$D/notes"
cat > "$D/state.json" <<'JSON'
{
  "slug": "demo",
  "home": "TMP_PLACEHOLDER",
  "updatedAt": "2026-01-01T00:00:00Z",
  "mode": "system",
  "mission": { "goal": "selftest", "targetSolo": "relational", "level": "novice", "outOfScope": [] },
  "chunks": [
    { "id": "c1", "title": "第一块", "status": "in_progress", "solo": null, "core": true },
    { "id": "c2", "title": "第二块", "status": "todo", "solo": null, "core": false }
  ],
  "progress": { "gateCount": 0 },
  "misconceptions": [],
  "reviewQueue": [],
  "capabilities": [],
  "log": []
}
JSON
python3 - "$D/state.json" "$D" <<'PY'
import json, sys
p, home = sys.argv[1], sys.argv[2]
s = json.load(open(p)); s["home"] = home
json.dump(s, open(p, "w"), ensure_ascii=False, indent=2)
PY

fail() { echo "✗ $1"; exit 1; }
ok()   { echo "✓ $1"; }

out1="$(python3 "$HERE/record.py" demo --chunk c1 --level multistructural --evidence "selftest: 未达标")"
echo "$out1" | grep -q "未达标" || fail "首个层级应判为未达标：$out1"
ok "未达标也记录（层级粒度）"

out2="$(python3 "$HERE/record.py" demo --chunk c1 --level relational --evidence "selftest: 达标")"
echo "$out2" | grep -q "达标" || fail "达到目标层级应判为达标：$out2"
echo "$out2" | grep -q "gate#2" || fail "gate 计数应为 2：$out2"
ok "达到 targetSolo 即通过，且 gate 自增"

out3="$(python3 "$HERE/record.py" demo --chunk c1 --level relational --result fail --evidence "selftest: 复习未过")"
echo "$out3" | grep -q "未达标" || fail "--result fail 应覆盖层级判定：$out3"
ok "--result 覆盖判定（复习场景）"

python3 "$HERE/review.py" demo --n 2 | grep -q "上次未过" || fail "review 应优先给出 fail 项"
ok "review 优先级（fail 项排最前）"

"$HERE/list.sh" | grep -q "demo" || fail "list.sh 应列出主题"
ok "list.sh 能列出主题"

python3 - "$D/state.json" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))
c1 = next(c for c in s["chunks"] if c["id"] == "c1")
assert s["progress"]["gateCount"] == 3, s["progress"]
assert len(c1["levels"]) == 3, c1["levels"]
assert c1["solo"] == "relational", c1
assert c1["status"] == "passed", c1
item = next(r for r in s["reviewQueue"] if r["chunk"] == "c1")
assert item["fails"] >= 1 and item["intervalGates"] == 1, item
PY
ok "state.json 结构符合 references/state.md"

echo "全部通过"
