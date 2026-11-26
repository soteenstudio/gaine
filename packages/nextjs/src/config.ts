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

import type { NextConfig } from "next";
import { speedHeaders, toNextHeaders, type ResourceHint } from "@gaine/core/speed";

export interface GaineNextSpeedOptions {
  inlineCss?: boolean;
  reactCompiler?: boolean;
  cacheComponents?: boolean;
  viewTransition?: boolean;
  images?: boolean;
  optimizePackages?: readonly string[];
  immutable?: readonly string[];
  preload?: readonly ResourceHint[];
  security?: boolean;
}

const GAINE_PACKAGES = ["@gaine/core", "@gaine/nextjs"];
const OPTIMIZED_IMPORTS = ["lucide-react", "@radix-ui/react-dropdown-menu", ...GAINE_PACKAGES];
const unique = (list: readonly string[]) => [...new Set(list)];

export function withGaineSpeed(
  config: NextConfig = {},
  options: GaineNextSpeedOptions = {},
): NextConfig {
  const experimental: Record<string, unknown> = {
    ...(config.experimental as Record<string, unknown> | undefined),
  };
  experimental.optimizePackageImports = unique([
    ...((experimental.optimizePackageImports as string[] | undefined) ?? []),
    ...OPTIMIZED_IMPORTS,
    ...(options.optimizePackages ?? []),
  ]);
  if (options.inlineCss !== false && experimental.inlineCss === undefined)
    experimental.inlineCss = true;
  if (options.viewTransition && experimental.viewTransition === undefined)
    experimental.viewTransition = true;

  const next: Record<string, unknown> = {
    ...config,
    poweredByHeader: config.poweredByHeader ?? false,
    transpilePackages: unique([...(config.transpilePackages ?? []), ...GAINE_PACKAGES]),
    experimental,
  };
  if (options.reactCompiler && next.reactCompiler === undefined) next.reactCompiler = true;
  if (options.cacheComponents && next.cacheComponents === undefined) next.cacheComponents = true;
  if (options.images !== false && !config.images?.formats) {
    next.images = { ...config.images, formats: ["image/avif", "image/webp"] };
  }

  const rules = toNextHeaders(
    speedHeaders({
      base: config.basePath,
      immutable: options.immutable,
      preload: options.preload,
      security: options.security ?? false,
    }),
  );
  if (rules.length) {
    next.headers = async () => [...rules, ...((await config.headers?.()) ?? [])];
  }
  return next as NextConfig;
}
