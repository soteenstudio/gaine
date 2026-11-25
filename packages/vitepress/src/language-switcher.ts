import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import { useRoute, withBase } from "vitepress";
import { CheckIcon, GlobeIcon } from "./icons.js";

export interface LanguageSwitcherProps {
  /** Locale aktif. Default: segmen pertama path jika cocok, selain itu `defaultLocale`. */
  locale?: string;
  label: string;
  locales: readonly string[];
  localeLabels: Record<string, string>;
  defaultLocale?: string;
}

/**
 * Dropdown ganti bahasa untuk struktur path `/{locale}/...` (semua locale berprefiks,
 * sama seperti versi Next.js). Item berupa <a> biasa sehingga navigasi SPA VitePress
 * tetap menangani base path dan prefetch.
 */
export const LanguageSwitcher = defineComponent({
  name: "GaineLanguageSwitcher",
  props: {
    locale: String as PropType<string | undefined>,
    label: { type: String, required: true },
    locales: { type: Array as PropType<readonly string[]>, required: true },
    localeLabels: { type: Object as PropType<Record<string, string>>, required: true },
    defaultLocale: String as PropType<string | undefined>,
  },
  setup(props) {
    const route = useRoute();
    const open = ref(false);
    const root = ref<HTMLElement | null>(null);

    const segments = computed(() => route.path.split("/"));
    const current = computed(() => {
      if (props.locale) return props.locale;
      const first = segments.value[1] ?? "";
      return props.locales.includes(first) ? first : (props.defaultLocale ?? props.locales[0] ?? "");
    });

    function pathFor(target: string) {
      const parts = segments.value.slice();
      if (props.locales.includes(parts[1] ?? "")) parts[1] = target;
      else parts.splice(1, 0, target);
      return parts.join("/") || `/${target}/`;
    }

    function onDocClick(e: MouseEvent) {
      if (root.value && !root.value.contains(e.target as Node)) open.value = false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") open.value = false;
    }
    onMounted(() => {
      document.addEventListener("click", onDocClick);
      document.addEventListener("keydown", onKey);
    });
    onBeforeUnmount(() => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    });

    return () =>
      h("div", { ref: root, class: "relative inline-block" }, [
        h(
          "button",
          {
            type: "button",
            "aria-label": props.label,
            "aria-haspopup": "menu",
            "aria-expanded": open.value ? "true" : "false",
            "data-state": open.value ? "open" : "closed",
            onClick: () => (open.value = !open.value),
            class:
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent",
          },
          [GlobeIcon("size-3.5"), current.value],
        ),
        open.value
          ? h(
              "div",
              {
                role: "menu",
                "data-state": "open",
                class:
                  "absolute right-0 top-full z-50 mt-2.5 min-w-[11rem] overflow-hidden rounded-2xl border bg-popover p-2 text-popover-foreground shadow-xl shadow-black/5",
              },
              props.locales.map((l) =>
                h(
                  "a",
                  {
                    key: l,
                    role: "menuitem",
                    lang: l,
                    href: withBase(pathFor(l)),
                    // pertahankan #hash saat pindah bahasa (dibaca router VitePress setelah ini)
                    onClick: (e: MouseEvent) => {
                      const a = e.currentTarget as HTMLAnchorElement;
                      a.href = withBase(pathFor(l)) + window.location.hash;
                      open.value = false;
                    },
                    class:
                      "flex cursor-pointer select-none flex-row items-center justify-between rounded-xl px-3 py-2.5 text-sm no-underline text-popover-foreground outline-none transition-colors hover:bg-accent focus:bg-accent",
                  },
                  [props.localeLabels[l] ?? l, l === current.value ? CheckIcon("size-4 text-brand") : null],
                ),
              ),
            )
          : null,
      ]);
  },
});
