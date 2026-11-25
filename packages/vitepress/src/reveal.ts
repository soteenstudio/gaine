import type { RevealVariant } from "@gaine/core/reveal";

export type { RevealVariant };

/**
 * Atribut untuk elemen yang muncul saat di-scroll. Pakai dengan `v-bind`:
 * `<div v-bind="reveal(120, 'left')">`.
 */
export function reveal(delay = 0, variant: RevealVariant = "up") {
  return {
    "data-reveal": variant,
    style: { "--reveal-delay": `${delay}ms` },
  };
}
