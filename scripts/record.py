#!/usr/bin/env python3
"""记录一次已验证的进度（层级粒度），并自动推进复习队列。

用法：
  record.py <slug> --chunk c3 --level relational --evidence "GATE3 四问全对"
  可选：--target extended_abstract（默认取 state.json 里的 mission.targetSolo）
        --force-fail    强制标记本次未达标（层级照记）

做的事：
  1. 给该 chunk 追加一条层级记录（levels 数组），更新 solo 为历史最高
  2. 达到目标层级 → status=passed；否则保持 in_progress（进度不丢）
  3. gateCount += 1，并按事件间隔推进该概念的复习项
  4. 写 updatedAt 与 log

不打印“已掌握”这类话：只打印机械事实，供对话里引用。
"""
import argparse
import datetime
import json
import os
import sys

LEVELS = ["prestructural", "unistructural", "multistructural", "relational", "extended_abstract"]
MAX_INTERVAL_GATES = 32
FALLBACK_DAYS = 14


def learn_home():
    override = os.environ.get("LEARN_HOME")
    if override:
        return os.path.expanduser(override)
    base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    return os.path.join(base, "learn-coach")


def find_state(slug):
    for root in (learn_home(), "./learn-coach"):
        p = os.path.join(root, slug, "state.json")
        if os.path.exists(p):
            return p
    sys.exit(f"找不到 {slug} 的 state.json（查过 {learn_home()} 和 ./learn-coach）")


def rank(level):
    return LEVELS.index(level) if level in LEVELS else -1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--chunk", required=True)
    ap.add_argument("--level", required=True, choices=LEVELS)
    ap.add_argument("--evidence", required=True)
    ap.add_argument("--target", default=None, choices=LEVELS)
    ap.add_argument("--result", default=None, choices=["pass", "fail"],
                    help="复习时直接指定结果，不按目标层级判定")
    ap.add_argument("--force-fail", action="store_true", help="（旧参数）等同 --result fail")
    a = ap.parse_args()

    path = find_state(a.slug)
    s = json.load(open(path))
    today = datetime.date.today()
    now = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    prog = s.setdefault("progress", {})
    gate = prog.get("gateCount", 0) + 1
    prog["gateCount"] = gate

    target = a.target or s.get("mission", {}).get("targetSolo") or "relational"
    chunk = next((c for c in s.get("chunks", []) if c["id"] == a.chunk), None)
    if chunk is None:
        sys.exit(f"chunk {a.chunk} 不在 chunks 里")

    chunk.setdefault("levels", []).append({"solo": a.level, "at": now, "evidence": a.evidence})
    if rank(a.level) > rank(chunk.get("solo") or "prestructural"):
        chunk["solo"] = a.level
    if a.result:
        reached = a.result == "pass"
    elif a.force_fail:
        reached = False
    else:
        reached = rank(a.level) >= rank(target)
    if reached:
        chunk["status"] = "passed"
        chunk["evidence"] = a.evidence
    elif chunk.get("status") != "passed":
        chunk["status"] = "in_progress"

    # 复习项：事件驱动推进
    key = a.chunk
    item = next((r for r in s.get("reviewQueue", []) if r.get("chunk") == key), None)
    if item is None:
        item = {"chunk": key, "concept": chunk["title"], "intervalGates": 1,
                "lastSeenGate": gate, "fails": 0, "lastResult": None}
        s.setdefault("reviewQueue", []).append(item)
    if reached:
        item["intervalGates"] = min(max(item.get("intervalGates", 1) * 2, 2), MAX_INTERVAL_GATES)
        item["lastResult"] = "pass"
        item["failTotal"] = item.get("failTotal", 0) + item.get("fails", 0)
        item["fails"] = 0
    else:
        item["intervalGates"] = 1
        item["fails"] = item.get("fails", 0) + 1
        item["lastResult"] = "fail"
    item["lastSeenGate"] = gate
    item["nextGate"] = gate + item["intervalGates"]
    item["due"] = (today + datetime.timedelta(days=FALLBACK_DAYS if reached else 1)).isoformat()

    s["updatedAt"] = now
    s.setdefault("log", []).append({
        "at": now, "event": "record", "chunk": a.chunk,
        "level": a.level, "gate": gate, "result": "pass" if reached else "fail"})
    json.dump(s, open(path, "w"), ensure_ascii=False, indent=2)

    total = len(s.get("chunks", []))
    done = sum(1 for c in s.get("chunks", []) if c.get("status") == "passed")
    print(f"gate#{gate} {a.chunk} {a.level} → {'达标' if reached else '未达标'}｜"
          f"进度 {done}/{total}｜下次复习 gate#{item['nextGate']}（保底 {item['due']}）")


if __name__ == "__main__":
    main()
