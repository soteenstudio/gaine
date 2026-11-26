/*
 * Copyright 2026 SoTeen Studio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { HeadConfig } from "vitepress";
import { themeInitScript } from "@gaine/core";

export interface LocaleRedirectOptions {
  locales: readonly string[];
  defaultLocale: string;
  base?: string;
  exclude?: readonly string[];
}

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
  locales?: readonly string[];
}

export function gaineHead(options: GaineHeadOptions = {}): HeadConfig[] {
  const head: HeadConfig[] = [["script", {}, themeInitScript]];
  if (options.locales && options.defaultLocale) {
    head.push([
      "script",
      {},
      localeRedirectScript({
        ...options,
        locales: options.locales,
        defaultLocale: options.defaultLocale,
      }),
    ]);
  }
  return head;
}
