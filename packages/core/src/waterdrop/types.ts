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

export const WATERDROP_VERSION = "0.1.2";

export type WaterdropMode = "build" | "analyze";
export type WaterdropMinifyMode = "auto" | "always" | "never";

export interface WaterdropHtmlOptions {
  enabled?: boolean;
  minify?: boolean;
  removeComments?: boolean;
  lazyImages?: boolean;
  lazyIframes?: boolean;
  eagerImages?: number;
  priorityImages?: number;
  decodeAsync?: boolean;
  dropNomodule?: boolean;
  pruneMissingHints?: boolean;
  modulePreload?: boolean;
  maxModulePreloads?: number;
  minifyInlineJs?: boolean;
  minifyInlineCss?: boolean;
}

export interface WaterdropJsOptions {
  minify?: WaterdropMinifyMode;
  analyze?: boolean;
  dropSourceMaps?: boolean;
}

export interface WaterdropCssOptions {
  minify?: WaterdropMinifyMode;
  purge?: boolean;
  analyze?: boolean;
}

export interface WaterdropPruneOptions {
  orphans?: boolean;
  duplicates?: boolean;
}

export interface WaterdropBudget {
  js?: number;
  css?: number;
  total?: number;
}

export interface WaterdropReportOptions {
  path?: string;
  pretty?: boolean;
}

export interface WaterdropOptions {
  mode?: WaterdropMode;
  root?: string;
  outDir?: string;
  base?: string;
  dryRun?: boolean;
  exclude?: string[];
  protected?: string[];
  html?: boolean | WaterdropHtmlOptions;
  js?: boolean | WaterdropJsOptions;
  css?: boolean | WaterdropCssOptions;
  prune?: boolean | WaterdropPruneOptions;
  pruneOrphans?: boolean;
  budget?: WaterdropBudget;
  report?: string | WaterdropReportOptions;
}

export type WaterdropBuildOptions = Omit<WaterdropOptions, "mode" | "root" | "outDir"> & {
  failOnBudget?: boolean;
  quiet?: boolean;
};

export interface WaterdropSummary {
  assets: number;
  bytes: number;
  compressed: number;
  js: number;
  css: number;
  html: number;
  images: number;
  fonts: number;
  orphans: number;
  orphanBytes: number;
  duplicateGroups: number;
  duplicateBytes: number;
  unusedExports: number;
  missing: number;
  budgetOk: boolean;
}

export interface WaterdropPage {
  page: string;
  html: number;
  js: number;
  css: number;
  inline: number;
  total: number;
  files: string[];
}

export interface WaterdropFile {
  path: string;
  kind: string;
  bytes: number;
  compressed: number;
  hash: string;
  entry: boolean;
  unusedExports: string[];
  bloat: string[];
}

export interface WaterdropDuplicate {
  hash: string;
  bytes: number;
  wasted: number;
  paths: string[];
}

export interface WaterdropUnusedExport {
  module: string;
  name: string;
}

export interface WaterdropMissing {
  from: string;
  reference: string;
}

export interface WaterdropDiagnostic {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  file?: string | null;
}

export interface WaterdropPruned {
  orphans: string[];
  bytes: number;
}

export interface WaterdropReport {
  version: string;
  mode: WaterdropMode;
  root: string;
  outDir: string;
  base: string;
  summary: WaterdropSummary;
  pages: WaterdropPage[];
  files: WaterdropFile[];
  orphans: string[];
  duplicates: WaterdropDuplicate[];
  unusedExports: WaterdropUnusedExport[];
  missing: WaterdropMissing[];
  diagnostics: WaterdropDiagnostic[];
  pruned: WaterdropPruned;
  budgetOk: boolean;
  budgetFailures: string[];
  timings: {
    totalMs: number;
  };
}

export interface WaterdropChange {
  path: string;
  kind: "html" | "js" | "css";
  before: number;
  after: number;
}

export interface WaterdropResult {
  report: WaterdropReport;
  code: number;
  native: boolean;
  changes: WaterdropChange[];
  stdout: string;
  stderr: string;
}
