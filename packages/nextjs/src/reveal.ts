import type { CSSProperties } from "react";
import { reveal as coreReveal, type RevealVariant } from "@gaine/core";

export type { RevealVariant };

/** `reveal` dari @gaine/core + `suppressHydrationWarning` (class `is-visible` ditambah sebelum hydrate). */
export function reveal(delay = 0, variant: RevealVariant = "up") {
  const { style, ...rest } = coreReveal(delay, variant);
  return {
    ...rest,
    style: style as CSSProperties,
    suppressHydrationWarning: true as const,
  };
}
