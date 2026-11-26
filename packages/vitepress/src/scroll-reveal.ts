import { defineComponent, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vitepress";

/** Observes `[data-reveal]` elements (see `reveal()`), re-run on every page navigation. */
export function useScrollReveal() {
  const route = useRoute();
  let observer: IntersectionObserver | undefined;

  function run() {
    observer?.disconnect();
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    targets.forEach((el) => observer?.observe(el));
  }

  onMounted(run);
  watch(() => route.path, () => nextTick(run), { flush: "post" });
  onBeforeUnmount(() => observer?.disconnect());
}

export const ScrollReveal = defineComponent({
  name: "GaineScrollReveal",
  setup() {
    useScrollReveal();
    return () => null;
  },
});
