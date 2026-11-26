import { computed, defineComponent, h, type PropType } from "vue";
import { useRoute, withBase } from "vitepress";
import { renderLanguageMenu, renderThemeToggle } from "@gaine/core/speed";

export const ThemeToggleLite = defineComponent({
  name: "GaineThemeToggleLite",
  props: { label: { type: String, required: true } },
  setup(props) {
    return () => h("div", { class: "contents", innerHTML: renderThemeToggle(props.label) });
  },
});

export const LanguageSwitcherLite = defineComponent({
  name: "GaineLanguageSwitcherLite",
  props: {
    locale: String as PropType<string | undefined>,
    label: { type: String, required: true },
    locales: { type: Array as PropType<readonly string[]>, required: true },
    localeLabels: { type: Object as PropType<Record<string, string>>, required: true },
    defaultLocale: String as PropType<string | undefined>,
  },
  setup(props) {
    const route = useRoute();
    const current = computed(() => {
      if (props.locale) return props.locale;
      const first = route.path.split("/")[1] ?? "";
      return props.locales.includes(first) ? first : (props.defaultLocale ?? props.locales[0] ?? "");
    });
    return () =>
      h("div", {
        class: "contents",
        innerHTML: renderLanguageMenu({
          locale: current.value,
          label: props.label,
          locales: props.locales,
          labels: props.localeLabels,
          base: withBase("/"),
          trailingSlash: true,
        }),
      });
  },
});
