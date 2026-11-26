import { THEME_STORAGE_KEY } from "../theme/index.js";
import { normalizeBase } from "./speculation.js";

export interface RuntimeOptions {
  theme?: boolean;
  reveal?: boolean;
  menu?: boolean;
  locales?: readonly string[];
  base?: string;
  prefetch?: false | { delay?: number; fallbackOnly?: boolean };
}

const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const THEME = (key: string) =>
  `var K=${json(key)},R=d.documentElement;` +
  `function ap(){var s;try{s=localStorage.getItem(K)}catch(e){}R.classList.toggle("dark",s==="dark"||(s!=="light"&&w.matchMedia("(prefers-color-scheme: dark)").matches))}` +
  `d.addEventListener("click",function(e){var t=e.target,b=t&&t.closest&&t.closest("[data-gaine-theme]");if(!b)return;` +
  `var n=R.classList.contains("dark")?"light":"dark";R.classList.toggle("dark",n==="dark");try{localStorage.setItem(K,n)}catch(e){}});` +
  `try{w.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",ap)}catch(e){}` +
  `w.addEventListener("storage",ap);`;

const REVEAL =
  `var S=new WeakSet,io,q=0;` +
  `function sc(){q=0;var n=d.querySelectorAll("[data-reveal]:not(.is-visible)"),i,el;` +
  `if(!("IntersectionObserver" in w)){for(i=0;i<n.length;i++)n[i].classList.add("is-visible");return}` +
  `io=io||new IntersectionObserver(function(es){for(var j=0;j<es.length;j++){if(es[j].isIntersecting){es[j].target.classList.add("is-visible");io.unobserve(es[j].target)}}},{threshold:.12,rootMargin:"0px 0px -6% 0px"});` +
  `for(i=0;i<n.length;i++){el=n[i];if(!S.has(el)){S.add(el);io.observe(el)}}}` +
  `function sd(){if(!q){q=1;(w.requestAnimationFrame||setTimeout)(sc)}}` +
  `sc();if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",sc);` +
  `if("MutationObserver" in w)new MutationObserver(function(ms){for(var i=0,j,a,x;i<ms.length;i++){a=ms[i].addedNodes;for(j=0;j<a.length;j++){x=a[j];` +
  `if(x.nodeType===1&&(x.hasAttribute("data-reveal")||x.querySelector("[data-reveal]"))){sd();return}}}}).observe(d.documentElement,{childList:true,subtree:true});`;

const MENU =
  `function sm(m,o){var t=m.querySelector("[data-gaine-menu-trigger]"),c=m.querySelector("[data-gaine-menu-content]");if(!t||!c)return;` +
  `c.hidden=!o;t.setAttribute("aria-expanded",o?"true":"false");t.setAttribute("data-state",o?"open":"closed")}` +
  `d.addEventListener("click",function(e){var t=e.target,m=t&&t.closest&&t.closest("[data-gaine-menu]"),g=m&&t.closest("[data-gaine-menu-trigger]"),a=d.querySelectorAll("[data-gaine-menu]"),i,c;` +
  `for(i=0;i<a.length;i++){c=a[i].querySelector("[data-gaine-menu-content]");if(a[i]===m&&g&&c)sm(a[i],c.hidden);else sm(a[i],false)}});` +
  `d.addEventListener("keydown",function(e){if(e.key!=="Escape")return;var a=d.querySelectorAll("[data-gaine-menu]"),i,c;` +
  `for(i=0;i<a.length;i++){c=a[i].querySelector("[data-gaine-menu-content]");if(c&&!c.hidden){sm(a[i],false);var t=a[i].querySelector("[data-gaine-menu-trigger]");if(t)t.focus()}}});`;

const LOCALE = (locales: readonly string[], base: string) =>
  `var LC=${json(locales)},BS=${json(base)};` +
  `d.addEventListener("click",function(e){var t=e.target,a=t&&t.closest&&t.closest("[data-gaine-locale]");` +
  `if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;` +
  `var l=a.getAttribute("data-gaine-locale"),p=w.location.pathname,r=p;` +
  `if(BS&&(p===BS||p.indexOf(BS+"/")===0))r=p.slice(BS.length)||"/";` +
  `var s=r.split("/");if(LC.indexOf(s[1])>-1)s[1]=l;else s.splice(1,0,l);` +
  `e.preventDefault();w.location.assign(BS+s.join("/")+w.location.search+w.location.hash)});`;

const PREFETCH = (delay: number, fallbackOnly: boolean) =>
  `var PD=${delay},PF=${fallbackOnly ? "true" : "false"},PS={},PT;` +
  `var NA=w.HTMLScriptElement&&HTMLScriptElement.supports&&HTMLScriptElement.supports("speculationrules");` +
  `if(!(PF&&NA)){` +
  `var pu=function(a){if(!a||!a.href||a.target==="_blank"||a.hasAttribute("download")||a.hasAttribute("data-no-prefetch"))return;var u;try{u=new URL(a.href)}catch(e){return}` +
  `if(u.origin!==w.location.origin||(u.pathname===w.location.pathname&&u.search===w.location.search))return;u.hash="";return u.href};` +
  `var pf=function(h){if(!h||PS[h])return;var c=navigator.connection;if(c&&(c.saveData||/2g/.test(c.effectiveType||"")))return;PS[h]=1;var l=d.createElement("link");` +
  `if(l.relList&&l.relList.supports&&l.relList.supports("prefetch")){l.rel="prefetch";l.href=h;l.as="document";d.head.appendChild(l)}else if(w.fetch){w.fetch(h,{credentials:"same-origin",priority:"low"}).catch(function(){})}};` +
  `var an=function(e){var t=e.target;return t&&t.closest&&t.closest("a[href]")};` +
  `d.addEventListener("mouseover",function(e){var h=pu(an(e));if(!h)return;clearTimeout(PT);PT=setTimeout(function(){pf(h)},PD)},{passive:true});` +
  `d.addEventListener("mouseout",function(){clearTimeout(PT)},{passive:true});` +
  `d.addEventListener("touchstart",function(e){pf(pu(an(e)))},{passive:true})}`;

export function gaineRuntimeScript(options: RuntimeOptions = {}): string {
  const parts: string[] = [];
  if (options.theme !== false) parts.push(THEME(THEME_STORAGE_KEY));
  if (options.reveal !== false) parts.push(REVEAL);
  if (options.menu) parts.push(MENU);
  if (options.locales?.length) parts.push(LOCALE(options.locales, normalizeBase(options.base)));
  if (options.prefetch) {
    parts.push(PREFETCH(options.prefetch.delay ?? 65, options.prefetch.fallbackOnly ?? false));
  }
  if (!parts.length) return "";
  return `(function(w,d){if(w.__gaine)return;w.__gaine=1;` + parts.join("") + `})(window,document);`;
}
