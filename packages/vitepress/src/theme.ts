import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { ScrollReveal } from "./scroll-reveal.js";
import { ThemeSync } from "./theme-sync.js";
import { LanguageSwitcher } from "./language-switcher.js";
import { Logo } from "./logo.js";
import { ThemeToggle } from "./theme-toggle.js";

/**
 * Tema siap pakai: tema default VitePress + ThemeSync + ScrollReveal, dan komponen Gaine
 * terdaftar global (`<GaineLogo>`, `<GaineThemeToggle>`, `<GaineLanguageSwitcher>`).
 *
 * `.vitepress/theme/index.ts`:
 *   export { gaineTheme as default } from "@gaine/vitepress/theme";
 */
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
