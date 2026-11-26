/**
 * Counterpart of `@gaine/nextjs/og`. Next ships `ImageResponse`; in VitePress the same layout
 * is rendered through `satori` (SVG) + `@resvg/resvg-js` (PNG) and written at build time.
 * Both are optional peer dependencies loaded dynamically. Fonts are required because satori
 * does not ship a default font.
 */
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export interface OgFont {
  name: string;
  data: ArrayBuffer | Uint8Array;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: "normal" | "italic";
}

export interface OgRenderOptions {
  fonts: readonly OgFont[];
}

export interface OgCoverProps {
  brand: string;
  title: string;
  description: string;
  footerStart: string;
  footerEnd?: string;
}

type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; children?: Node | string | Array<Node | string> };
}

const div = (style: Style, ...children: Array<Node | string | null | undefined | false>): Node => {
  const kids = children.filter((c): c is Node | string => !!c);
  return { type: "div", props: { style, children: kids.length === 1 ? kids[0] : kids } };
};

async function toPng(tree: Node, { fonts }: OgRenderOptions): Promise<Uint8Array> {
  if (fonts.length === 0) throw new Error("@gaine/vitepress/og: at least one font is required.");
  const [{ default: satori }, { Resvg }] = await Promise.all([import("satori"), import("@resvg/resvg-js")]);
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    ...ogSize,
    fonts: fonts.map((f) => ({
      name: f.name,
      weight: f.weight ?? 400,
      style: f.style ?? "normal",
      data:
        f.data instanceof ArrayBuffer
          ? f.data
          : (f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength) as ArrayBuffer),
    })),
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: ogSize.width } }).render().asPng();
}

export function renderOgCover(
  { brand, title, description, footerStart, footerEnd }: OgCoverProps,
  options: OgRenderOptions,
): Promise<Uint8Array> {
  const fontFamily = options.fonts[0]?.name ?? "sans-serif";
  const tree = div(
    {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      backgroundColor: "#09090b",
      color: "#fafafa",
      padding: "72px 80px",
      fontFamily,
    },
    div(
      { display: "flex", alignItems: "center", gap: "16px", fontSize: 28, fontWeight: 600, color: "#a1a1aa" },
      div({ width: 18, height: 18, borderRadius: 999, backgroundColor: "#fafafa" }),
      div({ display: "flex" }, brand),
    ),
    div(
      { display: "flex", flexDirection: "column", gap: "24px" },
      div(
        {
          display: "flex",
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
          maxWidth: "960px",
        },
        title,
      ),
      div({ display: "flex", fontSize: 26, color: "#a1a1aa", lineHeight: 1.4, maxWidth: "880px" }, description),
    ),
    div(
      {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid #27272a",
        paddingTop: "28px",
        fontSize: 24,
        color: "#71717a",
      },
      div({ display: "flex" }, footerStart),
      div({ display: "flex" }, footerEnd ?? ""),
    ),
  );
  return toPng(tree, options);
}

export function renderOgFallback(brand: string, options: OgRenderOptions): Promise<Uint8Array> {
  const tree = div(
    {
      height: "100%",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#09090b",
      color: "#fafafa",
      fontSize: 48,
      fontWeight: 700,
      fontFamily: options.fonts[0]?.name ?? "sans-serif",
    },
    brand,
  );
  return toPng(tree, options);
}
