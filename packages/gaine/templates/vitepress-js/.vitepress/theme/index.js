import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import { LanguageSwitcher, ScrollReveal, ThemeSync, ThemeToggle } from "@gaine/vitepress";
import { defaultLocale, localeLabels, locales } from "../i18n";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "nav-bar-content-after": () =>
        h("div", { class: "ml-3 flex items-center gap-2" }, [
          h(LanguageSwitcher, { label: "Language", locales, localeLabels, defaultLocale }),
          h(ThemeToggle, { label: "Toggle theme" }),
        ]),
      "layout-bottom": () => [h(ThemeSync), h(ScrollReveal)],
    }),
};
