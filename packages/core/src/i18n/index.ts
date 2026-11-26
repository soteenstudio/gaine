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

export interface LocaleKit<L extends string> {
  locales: readonly L[];
  defaultLocale: L;
  localeLabels: Record<L, string>;
  isLocale: (value: string) => value is L;
}

export function defineLocales<const T extends readonly string[]>(input: {
  locales: T;
  defaultLocale: T[number];
  labels: Record<T[number], string>;
}): LocaleKit<T[number]> {
  const list = input.locales as readonly string[];
  return {
    locales: input.locales,
    defaultLocale: input.defaultLocale,
    localeLabels: input.labels,
    isLocale: (value: string): value is T[number] => list.includes(value),
  };
}

export function detectLocale<L extends string>(
  acceptLanguage: string | null | undefined,
  locales: readonly L[],
  defaultLocale: L,
): L {
  const list = locales as readonly string[];
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().split(";")[0]?.toLowerCase().slice(0, 2) ?? "";
    if (list.includes(code)) return code as L;
  }
  return defaultLocale;
}
