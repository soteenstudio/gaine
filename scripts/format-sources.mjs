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

/**
 * Source formatter for the Gaine monorepo.
 *
 * For every code file it:
 *   1. removes all comments (a few functional ones are kept, see KEEP_PATTERNS),
 *   2. formats the code with Prettier (indentation, quotes, trailing commas, ...),
 *   3. prepends the Apache-2.0 copyright header.
 * JSON files are only formatted. Markdown files are left alone.
 *
 * Usage:
 *   node scripts/format-sources.mjs [paths...] [options]
 *
 * Options:
 *   --check               report files that would change and exit with code 1 (no writes)
 *   --strict              also remove functional comments (@ts-ignore, @type, eslint-*, ...)
 *   --include-templates   also process packages/create-gaine/templates (scaffolded projects)
 *   --no-header           strip comments and format, but do not add the license header
 *   --holder <name>       copyright holder (default: format.config.json)
 *   --year <year>         copyright year (default: format.config.json, then current year)
 *   -h, --help            show this help
 */
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { argv, cwd, exit } from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const CSS_EXT = new Set([".css"]);
const JSON_EXT = new Set([".json"]);

const IGNORED_DIRS = new Set(["node_modules", "dist", ".next", ".git", "coverage", "cache"]);
const TEMPLATES_DIR = join(ROOT, "packages", "create-gaine", "templates");

const KEEP_PATTERNS = [
  /^\/\/\/\s*<(reference|amd-)/,
  /@ts-(ignore|expect-error|nocheck|check)\b/,
  /eslint-(disable|enable)/,
  /prettier-ignore/,
  /@type\b/,
  /@jsx(Import)?Source\b|@jsx\b/,
  /[@#]__PURE__/,
  /webpackChunkName/,
];

function parseArgs(args) {
  const out = { paths: [], check: false, strict: false, templates: false, header: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--check") out.check = true;
    else if (a === "--strict") out.strict = true;
    else if (a === "--include-templates") out.templates = true;
    else if (a === "--no-header") out.header = false;
    else if (a === "--holder") out.holder = args[++i];
    else if (a === "--year") out.year = Number(args[++i]);
    else if (a === "-h" || a === "--help") out.help = true;
    else if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
    else out.paths.push(resolve(cwd(), a));
  }
  return out;
}

async function loadDeps() {
  try {
    const ts = (await import("typescript")).default;
    const prettier = await import("prettier");
    return { ts, prettier };
  } catch {
    throw new Error(
      "Missing dependencies. Run `pnpm install` first (needs typescript and prettier).",
    );
  }
}

async function loadConfig() {
  const file = join(ROOT, "format.config.json");
  const config = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  return {
    holder: config.holder ?? "The Gaine Authors",
    year: config.year ?? new Date().getFullYear(),
  };
}

function licenseHeader(year, holder) {
  return [
    "/*",
    ` * Copyright ${year} ${holder}`,
    " *",
    ' * Licensed under the Apache License, Version 2.0 (the "License");',
    " * you may not use this file except in compliance with the License.",
    " * You may obtain a copy of the License at",
    " *",
    " *     http://www.apache.org/licenses/LICENSE-2.0",
    " *",
    " * Unless required by applicable law or agreed to in writing, software",
    ' * distributed under the License is distributed on an "AS IS" BASIS,',
    " * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.",
    " * See the License for the specific language governing permissions and",
    " * limitations under the License.",
    " */",
    "",
  ].join("\n");
}

function removeRanges(text, ranges) {
  const sorted = [...ranges].sort((a, b) => b.pos - a.pos);
  let out = text;
  for (const { pos, end } of sorted) {
    let start = pos;
    let stop = end;
    while (start > 0 && (out[start - 1] === " " || out[start - 1] === "\t")) start--;
    const ownsLineStart = start === 0 || out[start - 1] === "\n";
    let after = stop;
    while (after < out.length && (out[after] === " " || out[after] === "\t")) after++;
    const lineEnds = after >= out.length || out[after] === "\n" || out[after] === "\r";
    if (ownsLineStart && lineEnds) {
      if (out[after] === "\r") after++;
      if (out[after] === "\n") after++;
      stop = after;
    }
    out = out.slice(0, start) + out.slice(stop);
  }
  return out;
}

function stripScriptComments(ts, text, file, strict) {
  const ext = extname(file);
  const kind =
    ext === ".tsx"
      ? ts.ScriptKind.TSX
      : ext === ".jsx"
        ? ts.ScriptKind.JSX
        : [".js", ".mjs", ".cjs"].includes(ext)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  if (sf.parseDiagnostics?.length) {
    throw new Error(`syntax error, skipped (${sf.parseDiagnostics[0].messageText})`);
  }

  const found = new Map();
  const jsxText = [];
  const jsxEmpty = [];
  const collect = (list) => list?.forEach((r) => found.set(r.pos, r));

  const walk = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode)
      return;
    if (node.kind === ts.SyntaxKind.JsxText) {
      jsxText.push([node.getFullStart(), node.getEnd()]);
      return;
    }
    if (ts.isJsxExpression(node) && !node.expression) {
      jsxEmpty.push({ pos: node.getStart(sf), end: node.getEnd() });
      return;
    }
    collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(text, node.getEnd()));
    node.getChildren(sf).forEach(walk);
  };
  walk(sf);

  const ranges = [];
  for (const r of found.values()) {
    if (jsxText.some(([a, b]) => r.pos >= a && r.end <= b)) continue;
    const body = text.slice(r.pos, r.end);
    if (!strict && KEEP_PATTERNS.some((p) => p.test(body))) continue;
    ranges.push(r);
  }
  return removeRanges(text, [...ranges, ...jsxEmpty]);
}

function stripCssComments(text) {
  const ranges = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i++;
      while (i < text.length && text[i] !== ch) i += text[i] === "\\" ? 2 : 1;
      i++;
    } else if (ch === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      const end = close === -1 ? text.length : close + 2;
      ranges.push({ pos: i, end });
      i = end;
    } else {
      i++;
    }
  }
  return removeRanges(text, ranges);
}

async function listFiles(entry, options, files = []) {
  const info = await stat(entry);
  if (info.isDirectory()) {
    if (!options.templates && entry === TEMPLATES_DIR) return files;
    for (const name of await readdir(entry)) {
      if (IGNORED_DIRS.has(name)) continue;
      await listFiles(join(entry, name), options, files);
    }
  } else if (
    CODE_EXT.has(extname(entry)) ||
    CSS_EXT.has(extname(entry)) ||
    JSON_EXT.has(extname(entry))
  ) {
    if (options.templates || !entry.startsWith(TEMPLATES_DIR + sep)) files.push(entry);
  }
  return files;
}

async function processFile(file, ctx) {
  const { ts, prettier, options, config } = ctx;
  const ext = extname(file);
  const original = await readFile(file, "utf8");
  const prettierOptions = { ...(await prettier.resolveConfig(file)), filepath: file };

  if (JSON_EXT.has(ext)) return prettier.format(original, prettierOptions);

  let shebang = "";
  let body = original;
  if (body.startsWith("#!")) {
    const nl = body.indexOf("\n");
    shebang = body.slice(0, nl + 1);
    body = body.slice(nl + 1);
  }

  const stripped = CSS_EXT.has(ext)
    ? stripCssComments(body)
    : stripScriptComments(ts, body, file, options.strict);
  const formatted = await prettier.format(stripped, prettierOptions);
  const header = options.header ? licenseHeader(config.year, config.holder) + "\n" : "";
  return shebang + header + formatted;
}

async function main() {
  const options = parseArgs(argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/format-sources.mjs [paths...] [--check] [--strict] [--include-templates] [--no-header] [--holder <name>] [--year <year>]",
    );
    return;
  }
  const { ts, prettier } = await loadDeps();
  const config = await loadConfig();
  if (options.holder) config.holder = options.holder;
  if (options.year) config.year = options.year;

  const targets = options.paths.length ? options.paths : [ROOT];
  const files = [];
  for (const target of targets) await listFiles(target, options, files);

  const changed = [];
  const failed = [];
  for (const file of files.sort()) {
    try {
      const next = await processFile(file, { ts, prettier, options, config });
      const current = await readFile(file, "utf8");
      if (next === current) continue;
      changed.push(file);
      if (!options.check) await writeFile(file, next);
    } catch (error) {
      failed.push([file, error.message]);
    }
  }

  const rel = (f) => relative(ROOT, f) || f;
  for (const file of changed)
    console.log(`${options.check ? "would change" : "updated"}  ${rel(file)}`);
  for (const [file, message] of failed) console.error(`failed   ${rel(file)}: ${message}`);
  console.log(
    `\n${files.length} files checked, ${changed.length} ${options.check ? "need changes" : "updated"}, ${failed.length} failed.`,
  );
  if (failed.length || (options.check && changed.length)) exit(1);
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
