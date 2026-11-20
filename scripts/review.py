#!/usr/bin/env python3
"""挑出「现在该复习什么」，按优先级排序，默认给 2 条。

用法：
  review.py <slug> [--n 2] [--today YYYY-MM-DD]

优先级（高→低）：
  1. open 的错误概念（misconceptions）——必须考，且要换情境
  2. 上次没过的复习项（fails>0）
  3. 事件到期：nextGate <= 当前 gateCount（学了几关，而不是过了几天）
  4. 日历保底：due <= 今天（防止长期不学导致永久不复习）
  5. 最久没见的老概念

设计意图：学习节奏不规律时，"几天后"没有意义；用"又过了几关"才有。
"""
import argparse
import datetime
import json
import os
import sys

LEVELS = ["prestructural", "unistructural", "multistructural", "relational", "extended_abstract"]


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
    sys.exit(f"找不到 {slug} 的 state.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--today", default=None)
    a = ap.parse_args()

    s = json.load(open(find_state(a.slug)))
    today = datetime.date.fromisoformat(a.today) if a.today else datetime.date.today()
    gate = s.get("progress", {}).get("gateCount", 0)

    cands = []
    for m in s.get("misconceptions", []):
        if m.get("status") == "open":
            cands.append((0, m.get("id"), m.get("probe") or m.get("claim"),
                          f"错误概念 {m['id']}（未关）"))

    for r in s.get("reviewQueue", []):
        key = r.get("chunk") or r.get("concept")
        if r.get("lastResult") == "fail" or r.get("fails", 0) > 0:
            cands.append((1, key, r.get("concept"), f"上次未过（fail×{r.get('fails', 0)}）"))
        if r.get("nextGate") is not None and r["nextGate"] <= gate:
            cands.append((2, key, r.get("concept"), f"事件到期：gate#{r['nextGate']} ≤ 当前 {gate}"))
        due = r.get("due")
        if due and due <= today.isoformat():
            cands.append((3, key, r.get("concept"), f"日历保底到期 {due}"))

    seen, out = set(), []
    for pr, key, concept, why in sorted(cands, key=lambda x: x[0]):
        if key in seen:
            continue
        seen.add(key)
        out.append((pr, concept, why))
        if len(out) >= a.n:
            break

    if not out:
        # 没有到期项：从最早见过的概念里抽，维持交错
        pool = sorted(s.get("reviewQueue", []), key=lambda r: r.get("lastSeenGate", 0))
        out = [(4, r.get("concept"), f"最久未见（gate#{r.get('lastSeenGate', 0)}）") for r in pool[:a.n]]

    if not out:
        print("（没有可复习项：state.json 里 reviewQueue 为空）")
        return

    for pr, concept, why in out:
        print(f"[{pr}] {concept} —— {why}")
    print("\n提醒：复习题必须换表征（原为选择→改解释；原为定义→改新情境），"
          "并且要命中当时答错的那个维度。")


if __name__ == "__main__":
    main()
