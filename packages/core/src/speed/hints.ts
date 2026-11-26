export interface ResourceHint {
  rel: "preload" | "preconnect" | "dns-prefetch" | "prefetch" | "modulepreload";
  href: string;
  as?: "font" | "style" | "script" | "image" | "fetch" | "document";
  type?: string;
  crossorigin?: boolean | "anonymous" | "use-credentials";
  fetchpriority?: "high" | "low" | "auto";
  media?: string;
}

function assertSafe(value: string, what: string) {
  if (/[\r\n<>"\s]/.test(value)) throw new Error(`Gaine: invalid ${what}: ${JSON.stringify(value)}`);
}

export function fontPreload(href: string, type = "font/woff2"): ResourceHint {
  return { rel: "preload", href, as: "font", type, crossorigin: "anonymous" };
}

export interface ResourceHintInput {
  preconnect?: readonly string[];
  dnsPrefetch?: readonly string[];
  fonts?: readonly string[];
  styles?: readonly string[];
  images?: readonly string[];
}

export function resourceHints(input: ResourceHintInput): ResourceHint[] {
  const hints: ResourceHint[] = [];
  for (const href of input.preconnect ?? []) hints.push({ rel: "preconnect", href, crossorigin: true });
  for (const href of input.dnsPrefetch ?? []) hints.push({ rel: "dns-prefetch", href });
  for (const href of input.fonts ?? []) hints.push(fontPreload(href, fontType(href)));
  for (const href of input.styles ?? []) hints.push({ rel: "preload", href, as: "style" });
  for (const href of input.images ?? []) hints.push({ rel: "preload", href, as: "image", fetchpriority: "high" });
  return hints;
}

function fontType(href: string): string {
  const ext = href.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase();
  return ext === "woff" ? "font/woff" : ext === "ttf" ? "font/ttf" : ext === "otf" ? "font/otf" : "font/woff2";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function hintAttrs(hint: ResourceHint): Record<string, string> {
  assertSafe(hint.href, "hint href");
  const attrs: Record<string, string> = { rel: hint.rel, href: hint.href };
  if (hint.as) attrs.as = hint.as;
  if (hint.type) attrs.type = hint.type;
  if (hint.crossorigin) attrs.crossorigin = hint.crossorigin === true ? "" : hint.crossorigin;
  if (hint.fetchpriority) attrs.fetchpriority = hint.fetchpriority;
  if (hint.media) attrs.media = hint.media;
  return attrs;
}

export function hintsToHtml(hints: readonly ResourceHint[]): string {
  return hints
    .map((hint) => {
      const attrs = hintAttrs(hint);
      const body = Object.entries(attrs)
        .map(([k, v]) => (v === "" ? k : `${k}="${esc(v)}"`))
        .join(" ");
      return `<link ${body}>`;
    })
    .join("");
}

export function hintsToLinkHeader(hints: readonly ResourceHint[]): string {
  return hints
    .map((hint) => {
      const attrs = hintAttrs(hint);
      const params = [`rel=${attrs.rel}`];
      if (attrs.as) params.push(`as=${attrs.as}`);
      if (attrs.type) params.push(`type="${attrs.type}"`);
      if (attrs.crossorigin !== undefined) params.push("crossorigin");
      if (attrs.fetchpriority) params.push(`fetchpriority=${attrs.fetchpriority}`);
      return `<${attrs.href}>; ${params.join("; ")}`;
    })
    .join(", ");
}
