import { defineComponent, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vitepress";
import { applyTheme } from "@gaine/core";

/**
 * Menyamakan class `dark` di <html> dengan localStorage/prefers-color-scheme
 * setiap pindah halaman dan saat preferensi OS berubah.
 * Pasangkan dengan `appearance: false` di config VitePress.
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
