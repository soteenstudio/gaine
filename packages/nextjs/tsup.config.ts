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

import { relative, resolve } from "node:path";
import { defineConfig, type Options } from "tsup";

const CLIENT = [
  "theme-sync",
  "scroll-reveal",
  "language-switcher",
  "ui/dropdown-menu",
  "ui/theme-toggle",
];
const SRC = resolve(process.cwd(), "src");

const keepClientExternal = {
  name: "keep-client-external",
  setup(build: { onResolve: (o: { filter: RegExp }, cb: (a: any) => any) => void }) {
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      if (args.kind === "entry-point") return undefined;
      const rel = relative(SRC, resolve(args.resolveDir, args.path))
        .replace(/\\/g, "/")
        .replace(/\.(?:[mc]?js|tsx?)$/, "");
      return CLIENT.includes(rel) ? { path: `./${rel}.js`, external: true } : undefined;
    });
  },
};

const common: Options = {
  format: ["esm"],
  target: "es2020",
  bundle: true,
  splitting: false,
  minify: true,
  sourcemap: false,
  clean: false,
  dts: false,
};

export default defineConfig([
  {
    ...common,
    entry: {
      index: "src/index.ts",
      proxy: "src/proxy.ts",
      metadata: "src/metadata.ts",
      og: "src/og.tsx",
      config: "src/config.ts",
      speed: "src/speed.tsx",
    },
    esbuildPlugins: [keepClientExternal],
  },
  {
    ...common,
    entry: Object.fromEntries(CLIENT.map((name) => [name, `src/${name}.tsx`])),
    banner: { js: '"use client";' },
  },
]);
