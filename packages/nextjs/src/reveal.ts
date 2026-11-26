import type { CSSProperties } from "react";
import { reveal as coreReveal, type RevealVariant } from "@gaine/core";

export type { RevealVariant };

/** `reveal` from @gaine/core + `suppressHydrationWarning` (the `is-visible` class is added before hydration). */
export function reveal(delay = 0, variant: RevealVariant = "up") {
  const { style, ...rest } = coreReveal(delay, variant);
  return {
    ...rest,
    style: style as CSSProperties,
    suppressHydrationWarning: true as const,
  };
}
