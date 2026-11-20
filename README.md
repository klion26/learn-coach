# Learn Coach

一个 OpenCode Skill：把"我想学 X"变成一条**可验证**的学习路径——全局骨架 → 单块循环 → 分层测验 → 跨块整合 → 事件驱动复习。

它不追求"讲得更清楚"，而是靠三条硬机制：

1. **没有测试就没有进度**：每个知识点要通过分层测验（SOLO）才前进；答案对但理由错不算过。
2. **记录到层级，不记录 pass/fail**：`unistructural → multistructural → relational → extended abstract` 每一跳都落盘，中断后从那一层往上接，不重讲。
3. **复习按事件驱动**：时钟是"过了几关"，不是"过了几天"——节奏断续时不会堆成复习大会。

License: [Apache-2.0](LICENSE)

## 依赖

| 依赖 | 说明 |
| --- | --- |
| OpenCode V2 | 技能以目录形式提供（`SKILL.md`） |
| `bash` + `python3` ≥ 3.8 | 状态读写与复习排序，**无第三方包** |
| Node.js ≥ 18 | 仅安装器需要（`npx` 或 `node bin/install.js`） |

运行时不联网、不调用外部 API。生成的 HTML 交互件是自包含单文件。

## 安装

### 方式一：npx（推荐）

```sh
npx learn-coach                 # 装到 ~/.config/opencode/skills/learn-coach
npx learn-coach --project       # 装到当前项目的 .opencode/skills/learn-coach
npx learn-coach --dir ~/skills/learn-coach
npx learn-coach --uninstall
```

安装器会复制技能文件、给脚本加执行位，并打印自测命令。升级就是再跑一次（学习数据不受影响）。

### 方式二：git clone

```sh
git clone <repo-url> ~/.config/opencode/skills/learn-coach
```

OpenCode 也会扫描兼容目录：`~/.claude/skills`、`~/.agents/skills`。

### 方式三：本地路径登记

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "skills": ["~/team-skills/learn-coach"]
}
```

相对路径按**当前工作目录**解析，不是按配置文件。

### 验证安装

```sh
bash <skill-dir>/scripts/selftest.sh
```

## 使用

```text
@learn-coach 教我 Rust 所有权，目标是能自己修编译错误
@learn-coach review
@learn-coach list
```

说"教我 X / 帮我制定学习计划"也会自动触发。

## 数据放在哪

学习记录与技能本体**分离**，升级/卸载都不会丢：

```text
${XDG_DATA_HOME:-~/.local/share}/learn-coach/<slug>/
├── brief.md     学习任务书
├── map.html     全局骨架图
├── state.json   学习者模型（层级、错误概念、复习队列）
├── artifacts/   每节课的交互件
└── notes/       学习者复述、错题
```

可通过 `LEARN_HOME` 覆盖根目录。不写系统 tmp（会被清理），不默认写进当前项目（会污染仓库）。

## 目录结构

```text
learn-coach/
├── SKILL.md              主流程与硬性规则
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
├── bin/install.js        npx 安装器
├── index.json            HTTP catalog 清单
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
npm publish        # 包名 learn-coach，发布前请先确认 npm 上是否可用
```

`package.json` 里的 `bin` 指向 `bin/install.js`，所以 `npx learn-coach` 直接可用。仓库地址里的 `CHANGE_ME` 记得替换。

### HTTP catalog

OpenCode 支持 `skills` 配置指向一个 HTTP 目录：它会先取 `<base-url>/index.json`，再按 `<base-url>/<name>/<file>` 下载文件。本仓库的 `index.json` 已按此格式写好。

**base URL 可以用 GitHub，但要用能直接返回文件内容的入口**，三种都满足「同源 + 可下载」：

| 入口 | 形式 | 特点 |
| --- | --- | --- |
| `raw.githubusercontent.com` | `https://raw.githubusercontent.com/<owner>/<repo>/<ref>` | 最简单；CDN 有缓存，改动后可能延迟几分钟，建议用 tag 或递增 `version` |
| GitHub Pages | `https://<owner>.github.io/<repo>` | 有构建/部署延迟，但路径干净、可加自定义域 |
| jsDelivr | `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<tag>` | 按 tag 固定版本，缓存可控 |

注意协议要求 **`index.json` 与技能文件同源**，所以不要把 `index.json` 放一个域名、文件放另一个。示例（raw）：

```jsonc
{
  "skills": ["https://raw.githubusercontent.com/<owner>/<repo>/v1.0.0"]
}
```

对应仓库内布局：

```text
<repo>/
├── index.json
└── learn-coach/
    ├── SKILL.md
    ├── references/…
    └── scripts/…
```

也就是把本目录整体放在 `learn-coach/` 子目录下。**每次改动必须递增 `index.json` 里的 `version`**，否则客户端继续用缓存。

## 自测

```sh
bash scripts/selftest.sh
```

在 `mktemp -d` 里构造假主题，验证：未达标也记层级、达标判定、`--result` 覆盖、复习优先级、列表输出、`state.json` 结构。

## 已知限制

- 打开 HTML 用 `open`（macOS）或 `xdg-open`（Linux）；Windows 建议 WSL。
- 脚本依赖 `python3`；无 PowerShell/批处理版本。
- 技能 ID 由目录名决定，必须是 `learn-coach`；改名等于换 ID，调用名也要跟着改。
