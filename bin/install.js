#!/usr/bin/env node
/*
 * learn-coach 安装器
 *   npx learn-coach                    → 装到 ~/.config/opencode/skills/learn-coach
 *   npx learn-coach --project          → 装到 ./.opencode/skills/learn-coach
 *   npx learn-coach --dir <path>       → 装到指定目录（目录本身即为技能目录）
 *   npx learn-coach --dry-run          → 只打印将要写入的文件
 *   npx learn-coach --uninstall        → 删除已安装的技能目录（学习数据不动）
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const SKILL_NAME = "learn-coach";
const ITEMS = ["SKILL.md", "README.md", "LICENSE", "NOTICE", "index.json",
               "references", "scripts", "templates"];

function parseArgs(argv) {
  const out = { project: false, dry: false, uninstall: false, dir: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" || a === "-p") out.project = true;
    else if (a === "--dry-run" || a === "-n") out.dry = true;
    else if (a === "--uninstall") out.uninstall = true;
    else if (a === "--force" || a === "-f") out.force = true;
    else if (a === "--dir" || a === "-d") out.dir = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a.startsWith("-")) {
      console.error(`未知参数：${a}`);
      process.exit(2);
    }
  }
  return out;
}

function defaultTarget() {
  if (args.project) return path.join(process.cwd(), ".opencode", "skills", SKILL_NAME);
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdg, "opencode", "skills", SKILL_NAME);
}

function copyRecursive(src, dest) {
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === "__pycache__" || entry === ".DS_Store") continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else if (st.isSymbolicLink()) {
    console.warn(`跳过符号链接：${src}`);
  } else {
    fs.copyFileSync(src, dest);
    if (src.endsWith(".sh") || src.endsWith(".py")) fs.chmodSync(dest, 0o755);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`用法：learn-coach [--project] [--dir <path>] [--dry-run] [--uninstall] [--force]

  --project       装到当前项目的 .opencode/skills/${SKILL_NAME}
  --dir <path>    装到指定目录
  --dry-run       只显示计划，不写文件
  --uninstall     删除技能目录（${path.join("~", ".local", "share", "learn-coach")} 下的学习数据不动）
  --force         目标已存在且不像本技能时，仍然覆盖`);
  process.exit(0);
}

const target = args.dir ? path.resolve(args.dir) : defaultTarget();
const root = path.resolve(__dirname, "..");

if (args.uninstall) {
  if (!fs.existsSync(target)) {
    console.log(`未安装：${target}`);
    process.exit(0);
  }
  if (args.dry) {
    console.log(`将删除：${target}`);
    process.exit(0);
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`已删除 ${target}`);
  console.log("学习数据仍在，如需清理：rm -rf ~/.local/share/learn-coach");
  process.exit(0);
}

// 目标是符号链接时不要往里写（会写回源目录）
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
  const real = fs.realpathSync(target);
  console.error(`目标是符号链接：${target} → ${real}`);
  console.error("它已经指向一份安装好的技能，无需重复安装；要覆盖请先删掉该链接。");
  process.exit(1);
}

// 目标已存在但不是我方安装的，默认不覆盖
if (fs.existsSync(target) && !args.force) {
  const marker = path.join(target, "SKILL.md");
  const mine = fs.existsSync(marker) &&
    fs.readFileSync(marker, "utf8").includes("Learn Coach");
  if (!mine) {
    console.error(`目标已存在且不是 learn-coach：${target}`);
    console.error("确认要覆盖就加 --force");
    process.exit(1);
  }
}

if (args.dry) {
  console.log(`将安装到：${target}`);
  for (const item of ITEMS) console.log(`  + ${item}`);
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });
let count = 0;
for (const item of ITEMS) {
  const src = path.join(root, item);
  if (!fs.existsSync(src)) continue;
  copyRecursive(src, path.join(target, item));
  count++;
}

console.log(`已安装 ${SKILL_NAME} → ${target}`);
console.log(`项目数量：${count}\n`);
console.log("下一步：");
console.log(`  1) 在 OpenCode 里输入 @${SKILL_NAME} 教我 <主题>，或说"教我 X"自动触发`);
console.log(`  2) 自测：bash "${path.join(target, "scripts", "selftest.sh")}"`);
console.log("  3) 学习数据保存在 ~/.local/share/learn-coach/（与技能目录分离，升级不丢）");
