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

import { createLocaleProxy } from "@gaine/nextjs/proxy";
import { defaultLocale, locales } from "@/i18n/config";

export default createLocaleProxy({ locales, defaultLocale });

// Skip the proxy entirely for URLs that already carry a locale (`/id`, `/en/...`): no
// middleware hop on the hot path, so those requests go straight to the prerendered page.
// Keep this list in sync with `locales` in i18n/config (the proxy itself stays correct either way).
export const config = {
  matcher: ["/((?!_next|api|id/|id$|en/|en$|.*\\..*).*)"],
};
