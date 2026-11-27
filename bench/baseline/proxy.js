import { NextResponse } from "next/server";
import { defaultLocale, locales } from "./i18n/config";

function detect(header) {
  if (!header) return defaultLocale;
  const prefs = header
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return prefs.find((p) => locales.includes(p.tag))?.tag ?? defaultLocale;
}

export default function proxy(request) {
  const { pathname } = request.nextUrl;
  if (locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)))
    return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${detect(request.headers.get("accept-language"))}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };
