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

export type SpeculationEagerness = "immediate" | "eager" | "moderate" | "conservative";

export interface SpeculationOptions {
  action?: "prefetch" | "prerender";
  eagerness?: SpeculationEagerness;
  base?: string;
  exclude?: readonly string[];
  excludeSelectors?: readonly string[];
}

type Condition =
  | { href_matches: string }
  | { selector_matches: string }
  | { not: Condition }
  | { and: Condition[] };

export type SpeculationRules = Record<
  string,
  Array<{ where: Condition; eagerness: SpeculationEagerness }>
>;

const DEFAULT_EXCLUDE = ["/api/*", "/_next/*", "/assets/*"] as const;
const DEFAULT_SELECTORS = [
  "[rel~=nofollow]",
  "[rel~=external]",
  "[target=_blank]",
  "[download]",
  "[data-no-prefetch]",
] as const;

export function normalizeBase(base = "/"): string {
  const trimmed = base.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

export function speculationRules(options: SpeculationOptions = {}): SpeculationRules {
  const base = normalizeBase(options.base);
  const and: Condition[] = [{ href_matches: `${base}/*` }];
  const exclude = options.exclude ?? DEFAULT_EXCLUDE.map((p) => `${base}${p}`);
  for (const pattern of exclude) and.push({ not: { href_matches: pattern } });
  for (const selector of options.excludeSelectors ?? DEFAULT_SELECTORS) {
    and.push({ not: { selector_matches: selector } });
  }
  return {
    [options.action ?? "prerender"]: [
      { where: { and }, eagerness: options.eagerness ?? "moderate" },
    ],
  };
}

export function speculationRulesJson(options: SpeculationOptions = {}): string {
  return JSON.stringify(speculationRules(options)).replace(/</g, "\\u003c");
}
