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

import type { Locale } from "./config";

const dictionaries = {
  id: {
    metaTitle: "Beranda",
    metaDescription: "Starter Gaine untuk Next.js.",
    badge: "Starter",
    heroTitle: "Situs Next.js dengan tema, i18n, dan animasi siap pakai",
    heroDescription:
      "Token warna, dark mode, ganti bahasa, dan reveal-on-scroll sudah terpasang lewat Gaine.",
    cta: "Baca dokumentasi",
    eyebrow: "Fitur",
    featuresTitle: "Sudah termasuk",
    featuresDescription: "Edit app/[locale]/page.tsx untuk mulai membangun.",
    features: [
      "Dark mode tanpa kedipan",
      "Redirect bahasa lewat proxy.ts",
      "Robots, sitemap, dan komponen UI",
    ],
    homeLabel: "Beranda",
    languageLabel: "Ganti bahasa",
    themeLabel: "Ganti tema",
  },
  en: {
    metaTitle: "Home",
    metaDescription: "Gaine starter for Next.js.",
    badge: "Starter",
    heroTitle: "A Next.js site with theming, i18n, and animations out of the box",
    heroDescription:
      "Color tokens, dark mode, language switching, and reveal-on-scroll are wired up through Gaine.",
    cta: "Read the docs",
    eyebrow: "Features",
    featuresTitle: "What's included",
    featuresDescription: "Edit app/[locale]/page.tsx to start building.",
    features: [
      "Flash-free dark mode",
      "Locale redirect via proxy.ts",
      "Robots, sitemap, and UI components",
    ],
    homeLabel: "Home",
    languageLabel: "Change language",
    themeLabel: "Toggle theme",
  },
} satisfies Record<Locale, unknown>;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
