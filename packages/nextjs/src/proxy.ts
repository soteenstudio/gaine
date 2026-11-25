import { NextResponse, type NextRequest } from "next/server";
import { detectLocale } from "@gaine/core";

export interface LocaleProxyOptions<L extends string> {
  locales: readonly L[];
  defaultLocale: L;
}

export function createLocaleProxy<L extends string>({
  locales,
  defaultLocale,
}: LocaleProxyOptions<L>) {
  return function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasLocale = locales.some(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    );
    if (hasLocale) return NextResponse.next();

    const url = request.nextUrl.clone();
    const locale = detectLocale(request.headers.get("accept-language"), locales, defaultLocale);
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  };
}
