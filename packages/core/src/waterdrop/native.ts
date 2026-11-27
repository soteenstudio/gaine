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

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { WaterdropOptions, WaterdropReport, WaterdropResult } from "./types.js";

const EXE = process.platform === "win32" ? "waterdrop.exe" : "waterdrop";

function pathCandidates(): string[] {
  const fromEnv = process.env.GAINE_WATERDROP_BIN ?? process.env.WATERDROP_BIN;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    fromEnv,
    resolve(here, "../../bin", EXE),
    resolve(here, "../../../../target/release", EXE),
    resolve(here, "../../../../target/debug", EXE),
    resolve(process.cwd(), "target/release", EXE),
    resolve(process.cwd(), "target/debug", EXE),
  ];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir) candidates.push(join(dir, EXE));
  }
  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

export function resolveWaterdropBinary(): string | undefined {
  const override = process.env.GAINE_WATERDROP_BIN ?? process.env.WATERDROP_BIN;
  if (override) return existsSync(override) ? override : undefined;
  return pathCandidates().find((candidate) => existsSync(candidate));
}

function parseReport(stdout: string): WaterdropReport {
  const report = JSON.parse(stdout) as WaterdropReport;
  if (!report || typeof report !== "object" || !report.summary || !Array.isArray(report.pages)) {
    throw new Error("Waterdrop returned an invalid JSON report");
  }
  return report;
}

export async function runNative(
  options: WaterdropOptions,
  binary: string,
): Promise<WaterdropResult | undefined> {
  const mode = options.mode ?? "build";
  const dir = await mkdtemp(join(tmpdir(), "gaine-waterdrop-"));
  const configPath = join(dir, "config.json");
  await writeFile(configPath, JSON.stringify(options), "utf8");
  try {
    return await new Promise<WaterdropResult | undefined>((resolvePromise, reject) => {
      const child = spawn(binary, [mode, "--config", configPath, "--json"], {
        cwd: options.root ?? process.cwd(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") finish(() => resolvePromise(undefined));
        else finish(() => reject(error));
      });
      child.on("close", (code) => {
        if (code !== 0 && code !== 2) {
          finish(() =>
            reject(
              new Error(
                `Waterdrop exited with code ${code ?? "unknown"}${stderr ? `: ${stderr.trim()}` : ""}`,
              ),
            ),
          );
          return;
        }
        try {
          const report = parseReport(stdout);
          finish(() =>
            resolvePromise({
              report,
              code: code ?? 0,
              native: true,
              changes: [],
              stdout,
              stderr,
            }),
          );
        } catch (error) {
          finish(() => reject(error));
        }
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
