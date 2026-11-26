export interface OptimizeHtmlOptions {
  eagerImages?: number;
  lazyImages?: boolean;
  lazyIframes?: boolean;
  head?: string;
  bodyEnd?: string;
}

const PROTECTED = /<(script|style|textarea|pre)\b[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi;
const IMG = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const IFRAME = /<iframe\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const hasAttr = (tag: string, name: string) =>
  new RegExp(`\\s${name}(?:\\s|=|/|>)`, "i").test(tag.replace(/"[^"]*"|'[^']*'/g, '""'));
const addAttrs = (tag: string, attrs: string) => tag.replace(/\s*\/?>$/, (end) => ` ${attrs}${end.trim() === "/>" ? " />" : ">"}`);

export function optimizeHtml(html: string, options: OptimizeHtmlOptions = {}): string {
  const stash: string[] = [];
  let out = html.replace(PROTECTED, (m) => `\u0000G${stash.push(m) - 1}\u0000`);

  const eager = options.eagerImages ?? 2;
  let seen = 0;
  if (options.lazyImages !== false) {
    out = out.replace(IMG, (tag) => {
      seen += 1;
      const add: string[] = [];
      if (!hasAttr(tag, "decoding")) add.push('decoding="async"');
      if (seen > eager && !hasAttr(tag, "loading")) add.push('loading="lazy"');
      return add.length ? addAttrs(tag, add.join(" ")) : tag;
    });
  }
  if (options.lazyIframes !== false) {
    out = out.replace(IFRAME, (tag) => (hasAttr(tag, "loading") ? tag : addAttrs(tag, 'loading="lazy"')));
  }
  if (options.head) out = out.replace(/<\/head\s*>/i, () => `${options.head}</head>`);
  if (options.bodyEnd) out = out.replace(/<\/body\s*>/i, () => `${options.bodyEnd}</body>`);

  return out.replace(/\u0000G(\d+)\u0000/g, (_, i: string) => stash[Number(i)] ?? "");
}
