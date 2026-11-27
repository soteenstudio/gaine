import { cp, mkdir, readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectBuild, run } from "./util.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BENCH = resolve(HERE, "..");
export const ROOT = resolve(BENCH, "..");

const TEXT = /\.(jsx?|tsx?|mjs|json|css|md|ya?ml)$/;

async function copyTemplate(from, to, name) {
  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const src = join(dir, e.name);
      const rel = relative(from, src);
      if (e.isDirectory()) {
        await walk(src);
        continue;
      }
      const outRel = e.name === "_gitignore" ? join(dirname(rel), ".gitignore") : rel;
      const dest = join(to, outRel);
      await mkdir(dirname(dest), { recursive: true });
      if (TEXT.test(e.name)) {
        await writeFile(dest, (await readFile(src, "utf8")).replaceAll("{{name}}", name));
      } else await cp(src, dest);
    }
  };
  await walk(from);
}

export async function scaffoldBaseline(workDir) {
  const dir = join(workDir, "baseline");
  await copyTemplate(join(BENCH, "baseline"), dir, "bench-baseline");
  return dir;
}

export async function scaffoldGaine(workDir, { source, lang }) {
  const dir = join(workDir, "gaine");
  await copyTemplate(
    join(ROOT, "packages", "create-gaine", "templates", `next-${lang}`),
    dir,
    "bench-gaine",
  );
  if (source === "local") await linkLocalTarballs(dir);
  return dir;
}

/** Point @gaine/* at tarballs packed from this checkout (same logic as scripts/install-local.mjs). */
async function linkLocalTarballs(dir) {
  const tarballs = join(ROOT, ".tarball");
  if (!existsSync(tarballs)) {
    console.log("› Packing local Gaine packages (pnpm pack:local)…");
    run("pnpm", ["pack:local"], { cwd: ROOT });
  }
  const files = {};
  for (const lib of ["core", "nextjs"]) {
    const pkg = JSON.parse(await readFile(join(ROOT, "packages", lib, "package.json"), "utf8"));
    const file = join(tarballs, `${pkg.name.replace("@", "").replace("/", "-")}-${pkg.version}.tgz`);
    if (!existsSync(file)) throw new Error(`Missing tarball ${file}. Run \`pnpm pack:local\` first.`);
    files[pkg.name] = "file:" + relative(dir, file).split("\\").join("/");
  }
  const manifestPath = join(dir, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  Object.assign(manifest.dependencies, files);
  manifest.overrides = { ...manifest.overrides, ...files };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

export async function installDeps(dir, { force } = {}) {
  if (!force && existsSync(join(dir, "node_modules", "next"))) return;
  const pm = existsSync(join(dir, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(dir, "yarn.lock")) ? "yarn" : "npm";
  const args = pm === "npm" ? ["install", "--no-audit", "--no-fund"] : ["install"];
  run(pm, args, { cwd: dir });
}

/** Clean production build; returns build time and output stats. */
export async function buildApp(dir, { runs = 1 } = {}) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    await rm(join(dir, ".next"), { recursive: true, force: true });
    const t0 = performance.now();
    run(process.execPath, [join(dir, "node_modules", "next", "dist", "bin", "next"), "build"], {
      cwd: dir,
      env: { NEXT_TELEMETRY_DISABLED: "1", CI: "1" },
      quiet: true,
    });
    times.push((performance.now() - t0) / 1000);
  }
  const info = await inspectBuild(dir);
  return { buildSec: times, ...info };
}

export const isDir = async (p) => {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
};
