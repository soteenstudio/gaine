import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { ScrollReveal } from "./scroll-reveal.js";
import { ThemeSync } from "./theme-sync.js";
import { LanguageSwitcher } from "./language-switcher.js";
import { Logo } from "./logo.js";
import { ThemeToggle } from "./theme-toggle.js";
import { LanguageSwitcherLite, ThemeToggleLite } from "./lite.js";

/**
 * Ready-made theme: the default VitePress theme + ThemeSync + ScrollReveal, with Gaine components
 * registered globally (`<GaineLogo>`, `<GaineThemeToggle>`, `<GaineLanguageSwitcher>`).
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

/**
 * Lightweight theme: the default VitePress theme with the Gaine components rendered as static HTML.
 * Theme toggling, reveal-on-scroll, the language menu, and locale switching are handled by the inline
 * runtime that `withGaineSpeed` adds to <head>, so no Vue components are hydrated for them.
 *
 * `.vitepress/theme/index.ts`:
 *   export { gaineLiteTheme as default } from "@gaine/vitepress/theme";
 */
export const gaineLiteTheme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("GaineLogo", Logo);
    app.component("GaineThemeToggle", ThemeToggleLite);
    app.component("GaineLanguageSwitcher", LanguageSwitcherLite);
  },
};
