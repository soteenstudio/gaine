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

import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { ScrollReveal } from "./scroll-reveal.js";
import { ThemeSync } from "./theme-sync.js";
import { LanguageSwitcher } from "./language-switcher.js";
import { Logo } from "./logo.js";
import { ThemeToggle } from "./theme-toggle.js";
import { LanguageSwitcherLite, ThemeToggleLite } from "./lite.js";

export const gaineTheme: Theme = {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "layout-bottom": () => [h(ThemeSync), h(ScrollReveal)],
    }),
  enhanceApp({ app }) {
    app.component("GaineLogo", Logo);
    app.component("GaineThemeToggle", ThemeToggle);
    app.component("GaineLanguageSwitcher", LanguageSwitcher);
  },
};

export default gaineTheme;

export const gaineLiteTheme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("GaineLogo", Logo);
    app.component("GaineThemeToggle", ThemeToggleLite);
    app.component("GaineLanguageSwitcher", LanguageSwitcherLite);
  },
};
