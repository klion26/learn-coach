#!/usr/bin/env node
/*
 * learn-coach 安装器（跨 agent）
 *
 *   npx mastery-loop                 → 装到 ~/.agents/skills/learn-coach，并软链到已安装的 agent
 *   npx mastery-loop --project       → 装到 ./.agents/skills/learn-coach，并软链到项目内 agent 目录
 *   npx mastery-loop --link <dir>    → 额外软链到指定技能目录（可重复，用于其他 agent）
 *   npx mastery-loop --no-link       → 只装一份，不做任何软链
 *   npx mastery-loop --copy          → 用复制代替软链（Windows / 无符号链接权限时）
 *   npx mastery-loop --dry-run       → 只打印计划
 *   npx mastery-loop --uninstall     → 删除技能与软链（学习数据不动）
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const SKILL_NAME = "learn-coach";
const ITEMS = ["SKILL.md", "README.md", "LICENSE", "NOTICE", "index.json",
               "references", "scripts", "templates"];
const MARKER = "Learn Coach";

const home = () => process.env.HOME || os.homedir();
const configHome = () => process.env.XDG_CONFIG_HOME || path.join(home(), ".config");
const codexHome = () => process.env.CODEX_HOME || path.join(home(), ".codex");

// 已知 agent 及其技能目录；probe 存在才自动软链，避免给没装的工具造目录
const AGENTS = [
  { id: "opencode", skills: () => path.join(configHome(), "opencode", "skills"), probe: () => path.join(configHome(), "opencode") },
  { id: "claude", skills: () => path.join(home(), ".claude", "skills"), probe: () => path.join(home(), ".claude") },
  { id: "codex", skills: () => path.join(codexHome(), "skills"), probe: () => codexHome() },
];

const PROJECT_AGENTS = [
  { id: "opencode", skills: () => path.join(process.cwd(), ".opencode", "skills") },
  { id: "claude", skills: () => path.join(process.cwd(), ".claude", "skills") },
  { id: "codex", skills: () => path.join(process.cwd(), ".codex", "skills") },
];

function parseArgs(argv) {
  const out = { project: false, dry: false, uninstall: false, noLink: false,
                copy: false, force: false, links: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" || a === "-p") out.project = true;
    else if (a === "--dry-run" || a === "-n") out.dry = true;
    else if (a === "--uninstall") out.uninstall = true;
    else if (a === "--no-link") out.noLink = true;
    else if (a === "--copy") out.copy = true;
    else if (a === "--force" || a === "-f") out.force = true;
    else if (a === "--link" || a === "-l") out.links.push(argv[++i]);
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a.startsWith("-")) { console.error(`未知参数：${a}`); process.exit(2); }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`用法：mastery-loop [选项]

  --project        装到项目的 ./.agents/skills/${SKILL_NAME}，并软链项目内 agent 目录
  --link <dir>     额外软链到指定技能目录（可重复）
  --no-link        只安装，不软链
  --copy           用复制代替软链
  --dry-run        只打印计划
  --uninstall      删除技能与软链（~/.local/share/learn-coach 下的学习数据不动）
  --force          目标已存在且不属于本技能时也覆盖`);
  process.exit(0);
}

function sourceDir() {
  return args.project
    ? path.join(process.cwd(), ".agents", "skills", SKILL_NAME)
    : path.join(home(), ".agents", "skills", SKILL_NAME);
}

function plannedLinks() {
  if (args.noLink) return [];
  const agents = args.project ? PROJECT_AGENTS : AGENTS;
  const picked = agents
    .filter((a) => args.project || !a.probe || fs.existsSync(a.probe()))
    .map((a) => ({ id: a.id, dir: path.join(a.skills(), SKILL_NAME) }));

  for (const raw of args.links) {
    if (!raw) continue;
    const dir = path.resolve(raw.replace(/^~(?=$|\/)/, home()));
    // 用户给的可能是技能目录本身，也可能是一级父目录
    picked.push({ id: "custom", dir: path.basename(dir) === SKILL_NAME ? dir : path.join(dir, SKILL_NAME) });
  }
  // 去重
  const seen = new Set();
  return picked.filter((p) => (seen.has(p.dir) ? false : seen.add(p.dir)));
}

function looksLikeMine(dir) {
  const marker = path.join(dir, "SKILL.md");
  return fs.existsSync(marker) && fs.readFileSync(marker, "utf8").includes(MARKER);
}

function copyRecursive(src, dest) {
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === "__pycache__" || entry === ".DS_Store" || entry === ".git") continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else if (st.isSymbolicLink()) {
    console.warn(`跳过符号链接：${src}`);
  } else {
    fs.copyFileSync(src, dest);
    if (src.endsWith(".sh") || src.endsWith(".py")) fs.chmodSync(dest, 0o755);
  }
}

function linkTo(target, source) {
  if (path.resolve(target) === path.resolve(source)) return "same-path";
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });

  if (fs.existsSync(target) || isDanglingLink(target)) {
    if (isLink(target)) {
      const current = fs.readlinkSync(target);
      if (path.resolve(parent, current) === path.resolve(source)) return "already";
      fs.unlinkSync(target);
    } else if (looksLikeMine(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    } else if (!args.force) {
      return "skipped";
    } else {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }

  if (args.copy) {
    copyRecursive(source, target);
    return "copied";
  }
  try {
    fs.symlinkSync(source, target, "dir");
    return "linked";
  } catch (e) {
    console.warn(`软链失败（${e.code}），改用复制：${target}`);
    copyRecursive(source, target);
    return "copied";
  }
}

function isLink(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}
function isDanglingLink(p) {
  try { return fs.lstatSync(p).isSymbolicLink() && !fs.existsSync(p); } catch { return false; }
}

const source = sourceDir();
const links = plannedLinks();

if (args.uninstall) {
  const removed = [];
  for (const l of links.length ? links : [
    ...AGENTS.map((a) => ({ id: a.id, dir: path.join(a.skills(), SKILL_NAME) })),
  ]) {
    if (isLink(l.dir) && path.resolve(path.dirname(l.dir), fs.readlinkSync(l.dir)) === path.resolve(source)) {
      fs.unlinkSync(l.dir); removed.push(l.dir);
    }
  }
  if (fs.existsSync(source)) { fs.rmSync(source, { recursive: true, force: true }); removed.push(source); }
  if (args.dry) { console.log("将删除：\n  " + removed.join("\n  ")); process.exit(0); }
  console.log(removed.length ? `已删除：\n  ${removed.join("\n  ")}` : "没有发现已安装的 learn-coach（mastery-loop）");
  console.log("学习数据仍在：~/.local/share/learn-coach（如不再需要可手动删除）");
  process.exit(0);
}

if (args.dry) {
  console.log(`源目录：${source}`);
  console.log("复制：");
  for (const item of ITEMS) console.log(`  + ${item}`);
  console.log(links.length ? "软链：" : "软链：无（--no-link 或未检测到 agent）");
  for (const l of links) console.log(`  ${l.id}: ${l.dir}`);
  process.exit(0);
}

// 源目录本身就是软链时，继续写入会写到别处
if (isLink(source)) {
  console.error(`源目录是符号链接：${source} → ${fs.readlinkSync(source)}`);
  console.error("请先删掉该链接，避免把文件写回它指向的位置。");
  process.exit(1);
}

const pkgRoot = path.resolve(__dirname, "..");
if (pkgRoot !== source) {
  fs.mkdirSync(source, { recursive: true });
  for (const item of ITEMS) {
    const src = path.join(pkgRoot, item);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(source, item));
  }
} // 在源目录里直接运行时跳过复制，避免自己拷自己

const results = links.map((l) => ({ ...l, result: linkTo(l.dir, source) }));

console.log(`已安装 ${SKILL_NAME}（包 mastery-loop）→ ${source}`);
if (results.length) {
  console.log("\n已接入：");
  for (const r of results) {
    const label = { linked: "软链", copied: "复制", already: "已存在",
                    "same-path": "就是源目录", skipped: "跳过（目标被占用）" }[r.result];
    console.log(`  ${r.id.padEnd(9)} ${label.padEnd(6)} ${r.dir}`);
  }
} else {
  console.log("\n未创建软链（--no-link 或未检测到 agent 目录）。");
  console.log("其他工具可用：--link <它的技能目录>");
}

console.log("\n下一步：");
console.log(`  1) 在任意支持 SKILL.md 的 agent 里输入 @${SKILL_NAME} 教我 <主题>`);
console.log(`  2) 自测：bash "${path.join(source, "scripts", "selftest.sh")}"`);
console.log("  3) 学习数据在 ~/.local/share/learn-coach/（与技能目录分离，升级不丢）");
