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

import test from "node:test";
import assert from "node:assert/strict";
import { withGaineSpeed } from "../dist/config.js";

test("withGaineSpeed (Next): safe merge, user options win", async () => {
  const out = withGaineSpeed(
    {
      transpilePackages: ["foo"],
      experimental: { optimizePackageImports: ["bar"], inlineCss: false },
      headers: async () => [{ source: "/x", headers: [] }],
    },
    { immutable: ["fonts"], viewTransition: true, reactCompiler: true },
  );
  assert.deepEqual(out.transpilePackages, ["foo", "@gaine/core", "@gaine/nextjs"]);
  assert.ok(
    out.experimental.optimizePackageImports.includes("bar") &&
      out.experimental.optimizePackageImports.includes("lucide-react"),
  );
  assert.equal(out.experimental.inlineCss, false, "explicit user value is kept");
  assert.equal(out.experimental.viewTransition, true);
  assert.equal(out.reactCompiler, true);
  assert.equal(out.poweredByHeader, false);
  assert.deepEqual(out.images.formats, ["image/avif", "image/webp"]);
  const headers = await out.headers();
  assert.equal(headers[0].source, "/fonts/:path*");
  assert.equal(headers.at(-1).source, "/x", "user headers kept");
});

test("withGaineSpeed (Next): defaults and opt-outs", () => {
  const d = withGaineSpeed();
  assert.equal(d.experimental.inlineCss, true);
  assert.equal(d.reactCompiler, undefined);
  assert.equal(d.cacheComponents, undefined);
  assert.equal(d.headers, undefined, "no header rules unless asked");
  const o = withGaineSpeed(
    { images: { formats: ["image/webp"] } },
    { inlineCss: false, images: false },
  );
  assert.equal(o.experimental.inlineCss, undefined);
  assert.deepEqual(o.images.formats, ["image/webp"]);
});
