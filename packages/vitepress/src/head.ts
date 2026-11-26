import type { HeadConfig } from "vitepress";
import { themeInitScript } from "@gaine/core";

export interface LocaleRedirectOptions {
  locales: readonly string[];
  defaultLocale: string;
  /** Sama dengan `base` di config VitePress. Default `/`. */
  base?: string;
  /** Prefix path yang tidak ikut diarahkan, mis. `["/api/"]`. */
  exclude?: readonly string[];
}

/**
 * Padanan `createLocaleProxy` untuk situs statis: VitePress tidak punya server,
 * jadi redirect dilakukan di browser berdasarkan `navigator.languages`.
 * Path yang belum berprefiks locale diarahkan ke `/{locale}{path}`.
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
  /** Isi bersama `locales` + `defaultLocale` untuk mengaktifkan redirect locale. */
  locales?: readonly string[];
}

/**
 * Entri `head` untuk config VitePress: `themeInitScript` (class `js` + `dark` sebelum paint)
 * dan, bila `locales`/`defaultLocale` diberikan, redirect locale.
 * Script reveal awal tidak dipakai di sini karena `head` dieksekusi sebelum <body>;
 * `<ScrollReveal />` menanganinya saat mount.
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
