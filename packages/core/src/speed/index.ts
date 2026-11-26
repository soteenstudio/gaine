export {
  speculationRules,
  speculationRulesJson,
  normalizeBase,
  type SpeculationOptions,
  type SpeculationRules,
  type SpeculationEagerness,
} from "./speculation.js";
export { gaineRuntimeScript, type RuntimeOptions } from "./runtime.js";
export {
  fontPreload,
  resourceHints,
  hintAttrs,
  hintsToHtml,
  hintsToLinkHeader,
  type ResourceHint,
  type ResourceHintInput,
} from "./hints.js";
export {
  speedHeaders,
  toHeadersFile,
  toNextHeaders,
  IMMUTABLE_CACHE,
  type HeaderRule,
  type NextHeaderRule,
  type SpeedHeaderOptions,
} from "./headers.js";
export { optimizeHtml, type OptimizeHtmlOptions } from "./html.js";
export { renderLanguageMenu, renderThemeToggle, type LanguageMenuOptions } from "./menu.js";
