# 状态文件与跨会话恢复

## 1. `state.json`

```json
{
  "slug": "rust-ownership",
  "home": "/Users/me/.local/share/learn-coach/rust-ownership",
  "updatedAt": "2026-11-18T10:00:00Z",
  "mode": "system",
  "mission": {
    "goal": "能解释并修复所有权/借用编译错误",
    "targetSolo": "relational",
    "level": "novice",
    "outOfScope": ["unsafe", "async 运行时"]
  },
  "route": ["c1", "c2", "c3", "c5", "c6", "c4", "c7", "c8"],
  "progress": { "gateCount": 12 },
  "chunks": [
    {
      "id": "c1",
      "title": "栈与堆、移动语义",
      "status": "passed",
      "solo": "relational",
      "evidence": "GATE1 4/5，迁移题通过",
      "levels": [
        { "solo": "multistructural", "at": "2026-11-18T02:00:00Z", "evidence": "能列举三种 loan，但混淆了 place 粒度" },
        { "solo": "relational", "at": "2026-11-18T03:10:00Z", "evidence": "E0505 三处 span 全部预测正确" }
      ],
      "artifacts": ["artifacts/01-stack-heap.html"]
    }
  ],
  "pending": {
    "chunk": "c3",
    "task": "任务 3-A · region 标注",
    "code": "let r = &v[0];",
    "questions": ["r 的 region 从哪行到哪行？", "L4 报错吗？"],
    "note": "恢复时先重贴这组题，不要重讲"
  },
  "misconceptions": [
    { "id": "m1", "claim": "认为复制指针就是复制数据", "status": "open", "probe": "Vec 移动后原变量还能用吗？", "resolvedAt": null }
  ],
  "reviewQueue": [
    { "chunk": "c1", "concept": "c1 三要素 + place 粒度",
      "intervalGates": 2, "lastSeenGate": 9, "nextGate": 11,
      "fails": 0, "lastResult": "pass", "due": "2026-12-03" }
  ],
  "capabilities": [
    "能指出一段代码里所有权转移发生在哪一行"
  ],
  "log": [
    { "at": "2026-11-18T09:30:00Z", "event": "record", "chunk": "c1", "level": "relational", "gate": 3, "result": "pass" }
  ]
}
```

字段规则：
- `progress.gateCount`：已发生的**验证次数**，是复习的时钟。每次 `record.py` 自增。
- `status`：`todo | in_progress | passed`。`passed` 只表示"达到 `mission.targetSolo`"，不代表层级已满。
- `solo`：该块**已达成**的最高层级，不是目标层级。
- `levels`：**只追加**的层级流水，由 `record.py` 写入。这是"到达某个水平就记一次"的载体——恢复时从这里判断从哪一层往上接。
- `evidence`：一句话证据，必须来自实际作答，不许写"已掌握"。
- `capabilities`：行为动词描述，供 Phase 4/5 收尾使用。
- `route`：本轮实际采用的教学顺序（可以和 `chunks` 的定义顺序不同）。
- `pending`：**暂停时必写**。当前未答完的任务原文 + 问题清单。存在 `pending` 时，恢复会话的第一件事是重贴它，不是继续推进。
- `deferred`：学习者提出"现在先记下、之后再讲"的问题，带 `answerAfter`，讲完置 `status: answered`。
- `log` 只追加，用 `event: record`，用于分析"反复卡在哪一层"。

## 2. 复习：事件驱动 + 优先级

**时钟是关卡数（`gateCount`），不是天数。** 理由：学习节奏不规律，"三天后"经常变成"三周后一次性刷 20 题"；"又过了几关"才是真实的遗忘风险。

每个概念一条：

| 字段 | 含义 |
| --- | --- |
| `lastSeenGate` | 上次被验证时的 gate 序号 |
| `intervalGates` | 事件间隔：通过则翻倍（2→4→8…封顶 32），失败归 1 |
| `nextGate` | `lastSeenGate + intervalGates`，到点即"该复习了" |
| `fails` | 累计失败次数，用于优先级 |
| `due` | **日历保底**：通过 +14 天，失败 +1 天。只防"永久不复习"，不作为主时钟 |

`scripts/review.py <slug> --n 2` 按优先级挑选并打印理由：

```text
1. open 的错误概念        必须考，且换情境
2. fails > 0             上次没过
3. nextGate <= gateCount 事件到期
4. due <= today          日历保底
5. 最久未见              维持交错
```

**换表征**（不得重复上次题面）：

- 原题是选择题 → 改成"解释为什么"或"找错"。
- 原题是定义 → 改成"给一个新情境判断"。
- 原题是单点 → 改成与另一概念的对比。

**退役规则**：连续两次事件到期都答对、且无 open 错误概念 → 从 `reviewQueue` 删除。否则队列只涨不落。

## 3. 写盘时机

**原则：验证一发生就写，不等用户开口。** 一律用脚本，不手改 JSON：

```sh
"<skill-dir>/scripts/record.py" <slug> --chunk c3 --level relational --evidence "…"
```

必写的时刻：

1. Phase 0 结束（写 `brief.md` + `state.json` 初始结构）。
2. **任何一次验证之后**——GATE、补考、乃至热身里确认的层级，一次一条。
3. 出现新错误概念时（`misconceptions` 追加）。
4. Phase 4 通过后（`integrate` 字段）。
5. 用户说"先停一下` / 保存进度"：补 `pending`（脚本不管这个字段，需手写）。
6. 会话结束前：补 `capabilities` 与 `updatedAt`。

`record.py` 已保证"读-改-写"合并，不会覆盖 `log` 与其他 chunk。

## 4. 会话恢复流程

新会话第一件事：跑列表。

```sh
"<skill-dir>/scripts/list.sh"
```

输出形如：

```text
- rust-ownership · 进度 2/8 · 当前 region 怎么算（NLL） · 复习 2026-11-19 · 未完成：任务 3-A · region 标注 · 更新 2026-11-18
  目标：对任意借用/生命周期报错写出最小复现……
```

- **多个主题 → 把列表原样给用户，让他选**，不要猜。
- 单一主题 → 不用列表，直接一句话汇报。
- 无 → 新主题，走 Phase 0。

命中一个之后：

1. 读 `brief.md` + `state.json`，用 `state.json.home` 的绝对路径。
2. 一句话汇报：`上次到 c3（region），任务 3-A 未答；今天有 2 个到期复习项`。
3. 有 `pending` → **先重贴原题**，不要重讲概念。
4. 无 `pending` 但有到期复习 → 先考 ≤3 题，再继续 `in_progress` 的块。
5. 不要重问 Phase 0 的问题；只有目标明显变化时才修订 `brief.md`。

## 5. 收尾（会话结束或暂停）

固定四行：

```
本轮进度：{chunk} → {solo 层级}
下次开始：{重贴 pending 的任务 / 下一个 chunk}
仍未解释：{open 的错误概念，若有}
现在能做：{一条行为化能力声明}
```

外加一次写盘：`updatedAt`、`pending`、`reviewQueue`、新增 `log` 条目（`event: "pause"`）。
