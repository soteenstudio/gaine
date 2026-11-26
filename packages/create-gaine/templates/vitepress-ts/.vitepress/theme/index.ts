import { h } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { LanguageSwitcherLite, ThemeToggleLite } from "@gaine/vitepress";
import { defaultLocale, localeLabels, locales } from "../i18n";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "nav-bar-content-after": () =>
        h("div", { class: "ml-3 flex items-center gap-2" }, [
          h(LanguageSwitcherLite, { label: "Language", locales, localeLabels, defaultLocale }),
          h(ThemeToggleLite, { label: "Toggle theme" }),
        ]),
    }),
} satisfies Theme;
