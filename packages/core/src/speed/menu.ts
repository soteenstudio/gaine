const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const svg = (cls: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls}">${body}</svg>`;

const GLOBE = (c: string) =>
  svg(c, '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>');
const CHECK = (c: string) => svg(c, '<path d="M20 6 9 17l-5-5"/>');
const SUN = (c: string) =>
  svg(
    c,
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  );
const MOON = (c: string) => svg(c, '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>');

export function renderThemeToggle(label: string): string {
  const l = esc(label);
  return (
    `<button type="button" data-gaine-theme aria-label="${l}" title="${l}" class="inline-flex size-9 items-center justify-center rounded-full border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">` +
    SUN("hidden size-4 dark:block") +
    MOON("size-4 dark:hidden") +
    `</button>`
  );
}

export interface LanguageMenuOptions<L extends string> {
  locale: L;
  label: string;
  locales: readonly L[];
  labels: Record<L, string>;
  base?: string;
  trailingSlash?: boolean;
  path?: string;
}

export function renderLanguageMenu<L extends string>(o: LanguageMenuOptions<L>): string {
  const base = (o.base ?? "/").replace(/^\/+|\/+$/g, "");
  const prefix = base ? `/${base}` : "";
  const tail = o.trailingSlash ? "/" : "";
  const items = o.locales
    .map((l) => {
      const href = o.path ? `${prefix}/${l}${o.path}` : `${prefix}/${l}${tail}`;
      return (
        `<a role="menuitem" lang="${esc(l)}" href="${esc(href)}" data-gaine-locale="${esc(l)}" class="flex cursor-pointer select-none flex-row items-center justify-between rounded-xl px-3 py-2.5 text-sm no-underline text-popover-foreground outline-none transition-colors hover:bg-accent focus:bg-accent">` +
        esc(o.labels[l] ?? l) +
        (l === o.locale ? CHECK("size-4 text-brand") : "") +
        `</a>`
      );
    })
    .join("");
  return (
    `<div data-gaine-menu class="relative inline-block">` +
    `<button type="button" data-gaine-menu-trigger aria-label="${esc(o.label)}" aria-haspopup="menu" aria-expanded="false" data-state="closed" class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent">` +
    GLOBE("size-3.5") +
    esc(o.locale) +
    `</button>` +
    `<div role="menu" data-gaine-menu-content hidden class="absolute right-0 top-full z-50 mt-2.5 min-w-[11rem] overflow-hidden rounded-2xl border bg-popover p-2 text-popover-foreground shadow-xl shadow-black/5">` +
    items +
    `</div></div>`
  );
}
