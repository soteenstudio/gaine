export interface LocaleKit<L extends string> {
  locales: readonly L[];
  defaultLocale: L;
  localeLabels: Record<L, string>;
  isLocale: (value: string) => value is L;
}

export function defineLocales<const T extends readonly string[]>(input: {
  locales: T;
  defaultLocale: T[number];
  labels: Record<T[number], string>;
}): LocaleKit<T[number]> {
  const list = input.locales as readonly string[];
  return {
    locales: input.locales,
    defaultLocale: input.defaultLocale,
    localeLabels: input.labels,
    isLocale: (value: string): value is T[number] => list.includes(value),
  };
}

export function detectLocale<L extends string>(
  acceptLanguage: string | null | undefined,
  locales: readonly L[],
  defaultLocale: L,
): L {
  const list = locales as readonly string[];
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().split(";")[0]?.toLowerCase().slice(0, 2) ?? "";
    if (list.includes(code)) return code as L;
  }
  return defaultLocale;
}
