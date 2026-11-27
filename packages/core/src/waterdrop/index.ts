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

import { normalizeBase } from "../speed/speculation.js";
import { runFallback, renderWaterdropReport } from "./fallback.js";
import { resolveWaterdropBinary, runNative } from "./native.js";
import {
  WATERDROP_VERSION,
  type WaterdropOptions,
  type WaterdropPruneOptions,
  type WaterdropReport,
  type WaterdropResult,
} from "./types.js";

type IntegrationOptions = WaterdropOptions & {
  failOnBudget?: boolean;
  quiet?: boolean;
};

export function normalizeWaterdropOptions(input: WaterdropOptions = {}): WaterdropOptions {
  const { failOnBudget: _failOnBudget, quiet: _quiet, ...rest } = input as IntegrationOptions;
  const root = rest.root ?? process.cwd();
  const outDir = rest.outDir ?? root;
  const base = rest.base && rest.base !== "/" ? normalizeBase(rest.base) || "/" : "/";

  let html = rest.html;
  if (html === true) html = {};
  else if (html === false) html = { enabled: false };

  let js = rest.js;
  if (js === true) js = {};
  else if (js === false) js = { minify: "never", analyze: false, dropSourceMaps: false };

  let css = rest.css;
  if (css === true) css = {};
  else if (css === false) css = { minify: "never", purge: false, analyze: false };

  let prune: boolean | WaterdropPruneOptions | undefined = rest.prune;
  if (prune === true) prune = { orphans: true };
  else if (prune === false) prune = { orphans: false, duplicates: false };

  return {
    ...rest,
    mode: rest.mode ?? "build",
    root,
    outDir,
    base,
    html,
    js,
    css,
    prune,
  };
}

export function waterdropAvailable(): boolean {
  return Boolean(resolveWaterdropBinary());
}

export async function runWaterdrop(input: WaterdropOptions = {}): Promise<WaterdropResult> {
  const options = normalizeWaterdropOptions(input);
  const binary = resolveWaterdropBinary();
  if (binary) {
    try {
      const result = await runNative(options, binary);
      if (result) return result;
    } catch {}
  }
  return runFallback(options);
}

export const runWaterdropFallback = runFallback;

export function waterdropBudgetFailures(report: WaterdropReport): string[] {
  return report.budgetFailures ?? [];
}

export const formatWaterdropReport = renderWaterdropReport;

export { resolveWaterdropBinary, WATERDROP_VERSION };
export type {
  WaterdropBuildOptions,
  WaterdropBudget,
  WaterdropChange,
  WaterdropCssOptions,
  WaterdropDiagnostic,
  WaterdropDuplicate,
  WaterdropFile,
  WaterdropHtmlOptions,
  WaterdropJsOptions,
  WaterdropMinifyMode,
  WaterdropMissing,
  WaterdropMode,
  WaterdropOptions,
  WaterdropPage,
  WaterdropPruneOptions,
  WaterdropReport,
  WaterdropReportOptions,
  WaterdropResult,
  WaterdropSummary,
} from "./types.js";
