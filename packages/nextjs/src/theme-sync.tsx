"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { applyTheme } from "@gaine/core";

export function ThemeSync() {
  const pathname = usePathname();
  React.useLayoutEffect(() => {
    applyTheme();
  }, [pathname]);
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, []);
  return null;
}
