import { defineComponent, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vitepress";
import { applyTheme } from "@gaine/core";

/**
 * Syncs the `dark` class on <html> with localStorage / prefers-color-scheme
 * on every page navigation and when the OS preference changes.
 * Use together with `appearance: false` in the VitePress config.
 */
export function useThemeSync() {
  const route = useRoute();
  let media: MediaQueryList | undefined;

  onMounted(() => {
    applyTheme();
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
  });
  watch(() => route.path, () => applyTheme(), { flush: "post" });
  onBeforeUnmount(() => media?.removeEventListener("change", applyTheme));
}

export const ThemeSync = defineComponent({
  name: "GaineThemeSync",
  setup() {
    useThemeSync();
    return () => null;
  },
});
