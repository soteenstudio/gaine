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
