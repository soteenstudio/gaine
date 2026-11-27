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

import { appendFileSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES_DIR = join(ROOT, "packages");
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, data) => {
  const eol = readFileSync(file, "utf8").includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(file, JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol);
};

function publicPackages() {
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(PACKAGES_DIR, e.name, "package.json")))
    .map((e) => {
      const dir = join(PACKAGES_DIR, e.name);
      const file = join(dir, "package.json");
      return { dir, file, name: e.name, json: readJson(file) };
    })
    .filter((p) => !p.json.private);
}

function parse(v) {
  const m = SEMVER.exec(v);
  if (!m) throw new Error(`Invalid version: "${v}"`);
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null };
}

function cmp(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (const k of ["major", "minor", "patch"]) if (x[k] !== y[k]) return x[k] - y[k];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

function nextVersion(current, input) {
  if (SEMVER.test(input)) return input;
  const { major, minor, patch, pre } = parse(current);
  switch (input) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return pre ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(
        `Unknown bump "${input}". Use patch, minor, major or an explicit x.y.z[-pre.n].`,
      );
  }
}

function templateManifests() {
  const root = join(PACKAGES_DIR, "create-gaine", "templates");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(root, e.name, "package.json"))
    .filter(existsSync);
}

function bump(input) {
  if (!input) throw new Error("Usage: release.mjs bump <patch|minor|major|x.y.z>");
  const pkgs = publicPackages();
  const current = pkgs
    .map((p) => p.json.version)
    .sort(cmp)
    .at(-1);
  const version = nextVersion(current, input);
  if (cmp(version, current) <= 0)
    throw new Error(`New version ${version} must be greater than ${current}`);
  const names = new Set(pkgs.map((p) => p.json.name));

  for (const p of pkgs) {
    p.json.version = version;
    writeJson(p.file, p.json);
  }
  for (const file of templateManifests()) {
    const json = readJson(file);
    let changed = false;
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const dep of Object.keys(json[field] ?? {})) {
        if (names.has(dep)) {
          json[field][dep] = `^${version}`;
          changed = true;
        }
      }
    }
    if (changed) writeJson(file, json);
  }
  return version;
}

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function prepare(tag) {
  if (!tag?.startsWith("v")) throw new Error("Usage: release.mjs prepare vX.Y.Z");
  const version = tag.slice(1);
  const { pre } = parse(version);
  const pkgs = publicPackages();
  const wrong = pkgs.filter((p) => p.json.version !== version);
  if (wrong.length) {
    throw new Error(
      `Tag ${tag} does not match package versions: ` +
        wrong.map((p) => `${p.json.name}@${p.json.version}`).join(", "),
    );
  }

  const names = new Set(pkgs.map((p) => p.json.name));
  const stale = [];
  for (const file of templateManifests()) {
    const json = readJson(file);
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const [dep, range] of Object.entries(json[field] ?? {})) {
        if (names.has(dep) && range !== `^${version}`)
          stale.push(`${relative(ROOT, file)}: ${dep}@${range} (expected ^${version})`);
      }
    }
  }
  if (stale.length) {
    throw new Error(
      `Template manifests are out of sync with ${tag}:\n  ${stale.join("\n  ")}\n` +
        `Run \`node scripts/release.mjs bump ${version}\` or update them by hand.`,
    );
  }

  const slug = process.env.GITHUB_REPOSITORY;
  if (slug) {
    const url = `git+https://github.com/${slug}.git`;
    for (const p of pkgs) {
      p.json.repository = { type: "git", url, directory: `packages/${p.name}` };
      p.json.homepage ??= `https://github.com/${slug}#readme`;
      p.json.bugs ??= { url: `https://github.com/${slug}/issues` };
      writeJson(p.file, p.json);
    }
  }

  const distTag = pre ? pre.split(".")[0] || "next" : "latest";
  setOutput("version", version);
  setOutput("dist_tag", distTag);
  setOutput("prerelease", pre ? "true" : "false");
  console.log(`version=${version} dist_tag=${distTag} prerelease=${Boolean(pre)}`);
}

function npm(...args) {
  try {
    return {
      ok: true,
      out: execFileSync("npm", args, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}`.trim() };
  }
}

function preflight(tag, flags) {
  if (!tag?.startsWith("v"))
    throw new Error("Usage: release.mjs preflight vX.Y.Z [--strict] [--dry-run]");
  const version = tag.slice(1);
  parse(version);
  const strict = flags.includes("--strict");
  const dry = flags.includes("--dry-run");
  const problems = [];

  if (!process.env.NODE_AUTH_TOKEN) {
    (dry ? console.warn : (m) => problems.push(m))(
      "NPM_TOKEN secret is empty or not exposed as NODE_AUTH_TOKEN",
    );
  } else {
    const who = npm("whoami");
    if (!who.ok) problems.push(`npm authentication failed: ${who.out.split("\n")[0]}`);
    else console.log(`npm user: ${who.out}`);
  }

  for (const p of publicPackages()) {
    if (p.json.version !== version) {
      problems.push(`${p.json.name}@${p.json.version} does not match ${tag}`);
      continue;
    }
    const res = npm("view", `${p.json.name}@${version}`, "version");
    if (res.ok && res.out) {
      const msg = `${p.json.name}@${version} is already published`;
      if (strict) problems.push(msg);
      else console.log(`notice: ${msg} (will be skipped by pnpm publish)`);
    } else if (!res.ok && !/E404|404 Not Found/i.test(res.out)) {
      problems.push(`could not query registry for ${p.json.name}: ${res.out.split("\n")[0]}`);
    }
  }
  if (problems.length) throw new Error(`Preflight failed:\n  ${problems.join("\n  ")}`);
  console.log(`preflight OK for ${tag}`);
}

const SECTIONS = [
  ["breaking", "⚠️ Breaking Changes"],
  ["feat", "✨ Features"],
  ["fix", "🐛 Bug Fixes"],
  ["perf", "⚡ Performance"],
  ["refactor", "♻️ Refactors"],
  ["docs", "📚 Documentation"],
  ["deps", "📦 Dependencies"],
  ["build", "🏗️ Build System"],
  ["ci", "🤖 CI"],
  ["test", "✅ Tests"],
  ["chore", "🧹 Chores"],
  ["other", "🔧 Other Changes"],
];
const TYPE_ALIAS = { style: "chore", revert: "other" };
const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

function previousTag(tag) {
  const tags = git("tag", "--list", "v*", "--sort=-v:refname")
    .split("\n")
    .filter((t) => t && t !== tag && SEMVER.test(t.slice(1)));
  const isPre = Boolean(parse(tag.slice(1)).pre);
  return (
    (isPre ? tags : tags.filter((t) => !parse(t.slice(1)).pre)).sort((a, b) =>
      cmp(b.slice(1), a.slice(1)),
    )[0] ?? null
  );
}

function loginFrom(email, name) {
  const m = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/.exec(email);
  return m ? m[1] : null;
}

function notes(tag, opts) {
  const end = git("rev-parse", "--verify", "--quiet", `${tag}^{commit}`) ? tag : "HEAD";
  const prev = opts.prev ?? previousTag(tag);
  const range = prev ? `${prev}..${end}` : end;
  const SEP = "\x1e";
  const raw = git("log", "--no-merges", `--format=%H%x1f%an%x1f%ae%x1f%s%x1f%b${SEP}`, range);
  const commits = raw
    .split(SEP)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [hash, author, email, subject, body = ""] = c.split("\x1f");
      return { hash, author, email, subject, body };
    });

  const repo = opts.repo ?? process.env.GITHUB_REPOSITORY;
  const server = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const grouped = new Map(SECTIONS.map(([k]) => [k, []]));
  const authors = new Map();

  for (const c of commits) {
    if (/^chore\(release\):/.test(c.subject)) continue;
    const m = CONVENTIONAL.exec(c.subject);
    let type = "other";
    let scope = "";
    let text = c.subject;
    let bang = false;
    if (m) {
      type = TYPE_ALIAS[m[1].toLowerCase()] ?? m[1].toLowerCase();
      scope = m[2] ?? "";
      bang = Boolean(m[3]);
      text = m[4];
      if (!grouped.has(type)) type = "other";
      if (scope === "deps" || /^bump\b/i.test(text)) type = "deps";
    }
    const breaking = bang || /^BREAKING[ -]CHANGE:/m.test(c.body);

    let pr = null;
    text = text.replace(/\s*\(#(\d+)\)\s*$/, (_, n) => ((pr = n), ""));
    const login = loginFrom(c.email, c.author);
    const who = login ? `@${login}` : c.author;
    authors.set(login ?? c.author, { who, email: c.email });

    const link = repo
      ? pr
        ? `[#${pr}](${server}/${repo}/pull/${pr})`
        : `[\`${c.hash.slice(0, 7)}\`](${server}/${repo}/commit/${c.hash})`
      : pr
        ? `#${pr}`
        : `\`${c.hash.slice(0, 7)}\``;
    const line = `- ${scope ? `**${scope}:** ` : ""}${text} (${link}) — ${who}`;

    grouped.get(breaking ? "breaking" : type).push(line);
    if (breaking && type !== "breaking") {
      const detail = /^BREAKING[ -]CHANGE:\s*([\s\S]+)/m
        .exec(c.body)?.[1]
        ?.split("\n\n")[0]
        ?.trim();
      if (detail) grouped.get("breaking").push(`  - ${detail.replace(/\n/g, " ")}`);
    }
  }

  const out = [];
  const version = tag.slice(1);
  const pkgs = publicPackages();
  out.push(`## What's Changed`, "");
  let any = false;
  for (const [key, title] of SECTIONS) {
    const items = grouped.get(key);
    if (!items.length) continue;
    any = true;
    out.push(`### ${title}`, "", ...items, "");
  }
  if (!any) out.push("_No user-facing changes in this release._", "");

  out.push(`### 📦 Packages`, "", "| Package | Version |", "| --- | --- |");
  for (const p of pkgs) {
    out.push(
      `| [\`${p.json.name}\`](https://www.npmjs.com/package/${p.json.name}/v/${version}) | \`${version}\` |`,
    );
  }
  out.push("");

  const newcomers = [];
  if (prev) {
    for (const [, a] of authors) {
      const earlier = git(
        "log",
        "-1",
        "--format=%H",
        `--author=${a.email}`,
        "--fixed-strings",
        prev,
      );
      if (!earlier) newcomers.push(a.who);
    }
  }
  if (newcomers.length) {
    out.push(
      `### 🎉 New Contributors`,
      "",
      ...newcomers.map((w) => `- ${w} made their first contribution`),
      "",
    );
  }
  if (authors.size) {
    out.push(`### 👥 Contributors`, "", [...authors.values()].map((a) => a.who).join(", "), "");
  }
  if (repo && prev) {
    out.push(`**Full Changelog**: ${server}/${repo}/compare/${prev}...${tag}`);
  } else if (repo) {
    out.push(`**Full Changelog**: ${server}/${repo}/commits/${tag}`);
  }
  return out.join("\n").trimEnd() + "\n";
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "bump") console.log(bump(rest[0]));
  else if (cmd === "prepare") prepare(rest[0]);
  else if (cmd === "preflight") preflight(rest[0], rest.slice(1));
  else if (cmd === "notes") {
    const opts = {};
    for (let i = 1; i < rest.length; i++) {
      if (rest[i] === "--prev") opts.prev = rest[++i];
      else if (rest[i] === "--repo") opts.repo = rest[++i];
    }
    process.stdout.write(notes(rest[0], opts));
  } else {
    console.error("Usage: release.mjs <bump|prepare|preflight|notes> ...");
    process.exit(2);
  }
} catch (err) {
  console.error(`release: ${err.message}`);
  process.exit(1);
}
