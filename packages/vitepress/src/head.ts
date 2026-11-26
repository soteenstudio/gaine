import type { HeadConfig } from "vitepress";
import { themeInitScript } from "@gaine/core";

export interface LocaleRedirectOptions {
  locales: readonly string[];
  defaultLocale: string;
  /** Same as `base` in the VitePress config. Defaults to `/`. */
  base?: string;
  /** Path prefixes that are not redirected, e.g. `["/api/"]`. */
  exclude?: readonly string[];
}

/**
 * Counterpart of `createLocaleProxy` for static sites: VitePress has no server,
 * so the redirect happens in the browser based on `navigator.languages`.
 * Paths without a locale prefix are redirected to `/{locale}{path}`.
 */
export function localeRedirectScript({
  locales,
  defaultLocale,
  base = "/",
  exclude = [],
}: LocaleRedirectOptions): string {
  const b = `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  return (
    `(function(){try{var L=${JSON.stringify(locales)},D=${JSON.stringify(defaultLocale)},B=${JSON.stringify(b)},X=${JSON.stringify(exclude)},i,p=location.pathname;` +
    `if(B!=="/"){if(p+"/"===B)p="/";else if(p.indexOf(B)===0)p="/"+p.slice(B.length);else return}` +
    `for(i=0;i<L.length;i++){if(p==="/"+L[i]||p.indexOf("/"+L[i]+"/")===0)return}` +
    `for(i=0;i<X.length;i++){if(p.indexOf(X[i])===0)return}` +
    `var g=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""],c=D;` +
    `for(i=0;i<g.length;i++){var k=String(g[i]).toLowerCase().slice(0,2);if(L.indexOf(k)>-1){c=k;break}}` +
    `location.replace(B.slice(0,-1)+"/"+c+(p==="/"?"/":p)+location.search+location.hash)}catch(e){}})();`
  );
}

export interface GaineHeadOptions extends Partial<LocaleRedirectOptions> {
  /** Provide together with `defaultLocale` to enable the locale redirect. */
  locales?: readonly string[];
}

/**
 * `head` entries for the VitePress config: `themeInitScript` (`js` + `dark` classes before paint)
 * and, when `locales`/`defaultLocale` are given, the locale redirect.
 * The initial reveal script is not used here because `head` runs before <body>;
 * `<ScrollReveal />` handles it on mount.
 */
export function gaineHead(options: GaineHeadOptions = {}): HeadConfig[] {
  const head: HeadConfig[] = [["script", {}, themeInitScript]];
  if (options.locales && options.defaultLocale) {
    head.push([
      "script",
      {},
      localeRedirectScript({ ...options, locales: options.locales, defaultLocale: options.defaultLocale }),
    ]);
  }
  return head;
}
