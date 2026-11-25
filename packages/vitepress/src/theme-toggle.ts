import { defineComponent, h } from "vue";
import { toggleTheme } from "@gaine/core/theme";
import { MoonIcon, SunIcon } from "./icons.js";

export const ThemeToggle = defineComponent({
  name: "GaineThemeToggle",
  props: { label: { type: String, required: true } },
  setup(props) {
    return () =>
      h(
        "button",
        {
          type: "button",
          onClick: toggleTheme,
          "aria-label": props.label,
          title: props.label,
          class:
            "inline-flex size-9 items-center justify-center rounded-full border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        },
        [SunIcon("hidden size-4 dark:block"), MoonIcon("size-4 dark:hidden")],
      );
  },
});
