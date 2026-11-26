#!/usr/bin/env node
/*
 * Copyright 2026 SoTeen Studio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { argv, cwd, exit, stdin, env } from "node:process";
import { fileURLToPath } from "node:url";
import { Cancelled, color, select, text } from "./prompt.js";

type Framework = "next" | "vitepress";
type Lang = "ts" | "js";

const FRAMEWORKS: readonly { value: Framework; label: string; hint: string }[] = [
  { value: "next", label: "Next.js", hint: "App Router, Next 16, @gaine/nextjs" },
  { value: "vitepress", label: "VitePress", hint: "Vue 3, @gaine/vitepress" },
];
const LANGS: readonly { value: Lang; label: string; hint?: string }[] = [
  { value: "ts", label: "TypeScript" },
  { value: "js", label: "JavaScript" },
];

const HELP = `
${color.bold("gaine")}: scaffold a Gaine project

${color.bold("Usage")}
  npx gaine@latest [project-name] [options]

${color.bold("Options")}
  -f, --framework <next|vitepress>   framework
  -l, --lang <ts|js>                 language
  -h, --help                         show help
  -v, --version                      show version

Without options, an interactive menu is shown. Use "." as the name for the current folder.
`;

const pkgRoot = resolve(fileURLToPath(import.meta.url), "../..");

function parseArgs(args: string[]) {
  const out: {
    dir?: string;
    framework?: string;
    lang?: string;
    help?: boolean;
    version?: boolean;
  } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const [flag, inline] = a.startsWith("--") ? a.split("=", 2) : [a, undefined];
    const value = () => inline ?? args[++i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "-v" || a === "--version") out.version = true;
    else if (flag === "-f" || flag === "--framework") out.framework = value();
    else if (flag === "-l" || flag === "--lang" || flag === "--language") out.lang = value();
    else if (a.startsWith("-")) fail(`Unknown option: ${a}`);
    else if (!out.dir) out.dir = a;
    else fail(`Unexpected argument: ${a}`);
  }
  return out;
}

function fail(message: string): never {
  console.error(`${color.red("✖")} ${message}`);
  exit(1);
}

const NAME_RE = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const validateName = (v: string) =>
  v === "." || NAME_RE.test(v)
    ? undefined
    : "Name must be lowercase letters, digits, or - . _ (a valid npm package name).";

function isEmptyDir(dir: string) {
  return !existsSync(dir) || readdirSync(dir).every((f) => f === ".git");
}

function copyDir(from: string, to: string, vars: Record<string, string>, written: string[]) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dest = join(to, entry === "_gitignore" ? ".gitignore" : entry);
    if (statSync(src).isDirectory()) {
      copyDir(src, dest, vars, written);
      continue;
    }
    if (/\.(json|md|ts|tsx|js|jsx|mjs|mts|css|vue)$/.test(entry)) {
      let body = readFileSync(src, "utf8");
      for (const [k, v] of Object.entries(vars)) body = body.replaceAll(`{{${k}}}`, v);
      writeFileSync(dest, body);
    } else {
      copyFileSync(src, dest);
    }
    written.push(dest);
  }
}

function packageManager() {
  const ua = env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) return console.log(HELP);
  if (args.version) {
    return console.log(JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version);
  }

  if (args.framework && !FRAMEWORKS.some((f) => f.value === args.framework)) {
    fail(`Invalid framework: ${args.framework} (choose next or vitepress)`);
  }
  if (args.lang && !LANGS.some((l) => l.value === args.lang)) {
    fail(`Invalid language: ${args.lang} (choose ts or js)`);
  }
  const interactive = Boolean(stdin.isTTY);
  if (!interactive && !(args.dir && args.framework && args.lang)) {
    fail("Terminal is not interactive: provide a project name, --framework, and --lang.");
  }

  console.log(`\n${color.bold(color.cyan("gaine"))} ${color.dim("· project scaffolder")}\n`);

  const target = args.dir ?? (await text("Project name?", "gaine-app", validateName));
  const framework = (args.framework as Framework) ?? (await select("Pick a framework", FRAMEWORKS));
  const lang = (args.lang as Lang) ?? (await select("Pick a language", LANGS));

  const dir = resolve(cwd(), target);
  const name = basename(dir).toLowerCase();
  if (validateName(name)) fail(`Folder name "${basename(dir)}" is not a valid package name.`);
  if (!isEmptyDir(dir)) fail(`Folder ${relative(cwd(), dir) || "."} is not empty.`);

  const template = join(pkgRoot, "templates", `${framework}-${lang}`);
  if (!existsSync(template)) fail(`Template not found: ${framework}-${lang}`);

  const written: string[] = [];
  copyDir(template, dir, { name }, written);

  const pm = packageManager();
  const rel = relative(cwd(), dir);
  const run = pm === "npm" ? "npm run" : pm;
  console.log(
    `\n${color.green("✔")} Project created in ${color.bold(rel || ".")} (${written.length} files)\n`,
  );
  console.log("Next steps:\n");
  if (rel) console.log(`  cd ${rel}`);
  console.log(`  ${pm} install`);
  console.log(`  ${run} dev\n`);
}

main().catch((err) => {
  if (err instanceof Cancelled) {
    console.log(`${color.red("✖")} Cancelled`);
    exit(130);
  }
  console.error(err);
  exit(1);
});
