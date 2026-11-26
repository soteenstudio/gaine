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

import { defineConfig } from "vitepress";
import { gaineHead } from "@gaine/vitepress/head";
import { withGaineSpeed } from "@gaine/vitepress/speed";
import { createSeoBuildEnd } from "@gaine/vitepress/metadata";
import { defaultLocale, locales } from "./i18n";

const baseUrl = process.env.SITE_URL ?? "http://localhost:5173";

const config = defineConfig({
  title: "{{name}}",
  cleanUrls: true,
  appearance: false,
  head: gaineHead({ locales, defaultLocale }),
  buildEnd: createSeoBuildEnd({
    baseUrl,
    locales,
    pages: [
      { path: "/", priority: 1 },
      { path: "/guide/", priority: 0.8 },
    ],
  }),
  locales: {
    root: { label: "Bahasa Indonesia", lang: "id" },
    id: {
      label: "Bahasa Indonesia",
      lang: "id",
      link: "/id/",
      description: "Starter Gaine untuk VitePress.",
      themeConfig: { nav: [{ text: "Panduan", link: "/id/guide/" }] },
    },
    en: {
      label: "English",
      lang: "en",
      link: "/en/",
      description: "Gaine starter for VitePress.",
      themeConfig: { nav: [{ text: "Guide", link: "/en/guide/" }] },
    },
  },
});

export default withGaineSpeed(config, { locales });
