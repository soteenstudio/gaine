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

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXE = process.platform === "win32" ? "waterdrop.exe" : "waterdrop";
const SOURCE = resolve(ROOT, "target", "release", EXE);
const DEST = resolve(ROOT, "packages", "core", "bin", EXE);

const result = spawnSync("cargo", ["build", "--release", "-p", "waterdrop-cli"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync(SOURCE)) {
  console.error(`waterdrop binary was not built: ${SOURCE}`);
  process.exit(1);
}
mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SOURCE, DEST);
if (process.platform !== "win32") chmodSync(DEST, 0o755);
console.log(`Waterdrop binary copied to ${DEST}`);
