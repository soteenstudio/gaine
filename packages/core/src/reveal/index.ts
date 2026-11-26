export type RevealVariant = "up" | "left" | "right" | "scale" | "fade";

/**
 * Atribut `data-reveal` + delay, berupa objek polos tanpa tipe framework.
 * React: lihat `reveal` di @gaine/nextjs (menambah suppressHydrationWarning).
 * Vue: `v-bind="reveal(120)"`.
 */
export function reveal(delay = 0, variant: RevealVariant = "up") {
  return {
    "data-reveal": variant,
    style: { "--reveal-delay": `${delay}ms` } as Record<string, string>,
  };
}

export const revealInitScript = `(function(){var t=document.querySelectorAll("[data-reveal]:not(.is-visible)"),i;if(!("IntersectionObserver" in window)){for(i=0;i<t.length;i++)t[i].classList.add("is-visible");return}var o=new IntersectionObserver(function(e){for(var j=0;j<e.length;j++){if(!e[j].isIntersecting)continue;e[j].target.classList.add("is-visible");o.unobserve(e[j].target)}},{threshold:0.12,rootMargin:"0px 0px -6% 0px"});for(i=0;i<t.length;i++)o.observe(t[i])})();`;
