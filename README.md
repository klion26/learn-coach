# Learn Coach

一个通用的 **SKILL.md 技能**：把"我想学 X"变成一条**可验证**的学习路径——全局骨架 → 单块循环 → 分层测验 → 跨块整合 → 事件驱动复习。

不绑定具体 agent。OpenCode、Claude Code、Codex，以及任何读取 `SKILL.md` 的工具（Cline、workbuddy、自建 agent…）都能用，靠软链接一份内容分发到各处。

它不追求"讲得更清楚"，而是靠三条硬机制：

1. **没有测试就没有进度**：每个知识点要通过分层测验（SOLO）才前进；答案对但理由错不算过。
2. **记录到层级，不记录 pass/fail**：`unistructural → multistructural → relational → extended abstract` 每一跳都落盘，中断后从那一层往上接，不重讲。
3. **复习按事件驱动**：时钟是"过了几关"，不是"过了几天"——节奏断续时不会堆成复习大会。

> **名字对照**：npm 包名 `mastery-loop`（`npx mastery-loop` 安装）；技能 ID `learn-coach`（agent 里 `@learn-coach` 调用）。两者刻意分离：包名只管分发，ID 由目录名决定。

License: [Apache-2.0](LICENSE)

## 支持的 agent

| Agent | 技能目录 | 安装方式 |
| --- | --- | --- |
| 通用（默认源） | `~/.agents/skills/learn-coach` | 总是装在这里 |
| OpenCode | `${XDG_CONFIG_HOME:-~/.config}/opencode/skills` | 检测到目录即自动软链 |
| Claude Code | `~/.claude/skills` | 检测到目录即自动软链 |
| Codex | `${CODEX_HOME:-~/.codex}/skills` | 检测到目录即自动软链 |
| 其他（workbuddy / Cline / 自建） | 由你指定 | `--link <它的技能目录>` |

"检测到"指该 agent 的根目录存在（如 `~/.claude`）。没装的工具不会凭空建目录。

## 依赖

| 依赖 | 说明 |
| --- | --- |
| `bash` + `python3` ≥ 3.8 | 状态读写与复习排序，**无第三方包** |
| Node.js ≥ 18 | 仅安装器需要（`npx` 或 `node bin/install.js`） |

运行时不联网、不调用外部 API。生成的 HTML 交互件是自包含单文件。

## 安装

### npx（推荐）

```sh
npx mastery-loop                       # 装到 ~/.agents/skills，并软链到检测到的 agent
npx mastery-loop --link ~/.workbuddy/skills   # 额外接入其他 agent（可重复）
npx mastery-loop --project             # 装到项目内：./.agents/skills + ./.opencode、./.claude、./.codex
npx mastery-loop --no-link             # 只装一份，不软链
npx mastery-loop --copy                # 用复制代替软链（Windows / 无符号链接权限）
npx mastery-loop --dry-run             # 只看计划
npx mastery-loop --uninstall           # 删除技能与软链（学习数据不动）
```

安装器会做四件事：复制技能文件 → 给脚本加执行位 → 对每个已安装的 agent 建软链 → 打印自测命令。重复执行即升级，软链会保持指向同一份源。

### 不用 Node 的手动安装

```sh
git clone <repo-url> ~/.agents/skills/learn-coach
ln -s ~/.agents/skills/learn-coach ~/.claude/skills/learn-coach
ln -s ~/.agents/skills/learn-coach ~/.codex/skills/learn-coach
ln -s ~/.agents/skills/learn-coach ~/.config/opencode/skills/learn-coach
```

（按需只建你实际用到的那些。）

### 验证

```sh
bash ~/.agents/skills/learn-coach/scripts/selftest.sh
```

## 使用

```text
@learn-coach 教我 Rust 所有权，目标是能自己修编译错误
@learn-coach review
@learn-coach list
```

说"教我 X / 帮我制定学习计划"也会自动触发。不同 agent 的调用语法略有差异（Codex 也用 `$learn-coach` 或直接提名字）。

## 数据放在哪

学习记录与技能本体**分离**，升级/换 agent 都不会丢：

```text
${XDG_DATA_HOME:-~/.local/share}/learn-coach/<slug>/
├── brief.md     学习任务书
├── map.html     全局骨架图
├── state.json   学习者模型（层级、错误概念、复习队列）
├── artifacts/   每节课的交互件
└── notes/       学习者复述、错题
```

可用 `LEARN_HOME` 覆盖根目录。不写系统 tmp（会被清理），不默认写进当前项目（会污染仓库）。

## 目录结构

```text
learn-coach/
├── SKILL.md              主流程与硬性规则（agent 无关）
├── references/
│   ├── theory.md         认知负荷 / 刻意练习 / SOLO / 4C-ID / 范围收敛
│   ├── assessment.md     分层题干模板、交叉验证协议、裁决规则
│   ├── interaction.md    交互件选型与 HTML 约束
│   └── state.md          state.json schema、复习算法、跨会话恢复
├── scripts/
│   ├── list.sh           列出主题、关卡、进度
│   ├── record.py         记录一次已验证的层级（自动写盘）
│   ├── review.py         按优先级挑选复习项
│   └── selftest.sh       自测（临时目录，不碰真实数据）
├── templates/
│   ├── quiz.html         自包含测验组件
│   └── map.html          自包含知识地图组件
├── bin/install.js        跨 agent 安装器
├── index.json            HTTP catalog 清单（OpenCode 用）
└── package.json
```

## 定制

- **目标难度**：`state.json` 的 `mission.targetSolo` 决定"到哪一层算过"。
- **颗粒度**：`SKILL.md` Phase 1 限定 5–9 块、每块 ≤3 个新元素。
- **交互件**：替换 `templates/` 下两个 HTML，流程不用动。
- **语言**：`SKILL.md` 默认中文输出，替换措辞即可换语言。

## 分发

### npm

```sh
npm publish        # 包名 mastery-loop
```

`package.json` 的 `bin` 指向 `bin/install.js`，`npx mastery-loop` 即可用。（仓库地址里的 `CHANGE_ME` 记得替换。）

### HTTP catalog（OpenCode 专属能力）

OpenCode 支持 `skills` 配置指向 HTTP 目录：先取 `<base-url>/index.json`，再按 `<base-url>/<name>/<file>` 下载。其他 agent 没有这个机制，用 npx / git 即可。

**base URL 可以用 GitHub**，三种入口都满足「同源 + 可直接下载」：

| 入口 | 形式 | 注意 |
| --- | --- | --- |
| raw | `https://raw.githubusercontent.com/<owner>/<repo>/<tag>` | 最省事；CDN 有缓存，改动后可能延迟几分钟 |
| Pages | `https://<owner>.github.io/<repo>` | 部署有延迟，但路径干净、可挂自定义域 |
| jsDelivr | `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<tag>` | 按 tag 固定版本，缓存可控 |

仓库必须满足目录层级（`index.json` 在 base 根，技能在 `learn-coach/` 下）：

```text
<repo>/
├── index.json
└── learn-coach/
    ├── SKILL.md
    └── …
```

本仓库根就是技能目录，发 catalog 前先摊平一层：

```sh
mkdir -p /tmp/catalog && cp index.json /tmp/catalog/ && cp -R . /tmp/catalog/learn-coach
```

**每次改动都要递增 `index.json` 里的 `version`**，否则客户端继续用缓存。

## 自测

```sh
bash scripts/selftest.sh
```

在 `mktemp -d` 里构造假主题，验证：未达标也记层级、达标判定、`--result` 覆盖、复习优先级、列表输出、`state.json` 结构。

## 已知限制

- 打开 HTML 用 `open`（macOS）或 `xdg-open`（Linux）；Windows 建议 WSL。
- 脚本依赖 `python3`，无 PowerShell 版本。
- Windows 的目录软链需要开发者模式或管理员权限；安装器失败时会自动回退为复制（`--copy` 可强制）。
- 技能 ID 由目录名决定，必须是 `learn-coach`；改名等于换 ID，各 agent 的调用名也要跟着改。
