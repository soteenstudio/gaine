#!/usr/bin/env node
/**
 * Sanity-checks the built output: entries from every "exports" map exist, "use client" survived
 * minification, the CLI keeps its shebang, and nothing was left unminified or bundled wrongly.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function targets(value) {
  if (typeof value === "string") return [value];
  return Object.values(value ?? {}).flatMap(targets);
}

for (const name of ["core", "nextjs", "vitepress", "gaine"]) {
  const dir = join(ROOT, "packages", name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const wanted = new Set([...targets(pkg.exports), ...targets(pkg.bin)]);
  for (const rel of wanted) {
    if (rel.endsWith("package.json")) continue;
    if (!existsSync(join(dir, rel))) fail(`${pkg.name}: missing ${rel}`);
  }
}

const client = ["theme-sync", "scroll-reveal", "language-switcher", "ui/dropdown-menu", "ui/theme-toggle"];
for (const f of client) {
  const file = join(ROOT, "packages/nextjs/dist", `${f}.js`);
  if (!existsSync(file)) continue;
  if (!/^["']use client["']/.test(readFileSync(file, "utf8").trimStart())) fail(`@gaine/nextjs: "use client" lost in dist/${f}.js`);
}

const cli = join(ROOT, "packages/gaine/dist/cli.js");
if (existsSync(cli) && !readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node")) fail("gaine: shebang missing in dist/cli.js");

for (const name of ["core", "nextjs", "vitepress", "gaine"]) {
  const dist = join(ROOT, "packages", name, "dist");
  if (!existsSync(dist)) continue;
  for (const file of walk(dist).filter((f) => f.endsWith(".js"))) {
    const text = readFileSync(file, "utf8");
    if (text.length > 500 && text.split("\n").length > text.length / 400) fail(`${name}: looks unminified: ${file.slice(ROOT.length + 1)}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("dist OK");
