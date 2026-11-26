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
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withGaineSpeed } from "../dist/speed.js";

const heads = (cfg) => cfg.head.map((h) => `${h[0]}:${h[1].type ?? h[1].rel ?? ""}`);

test("withGaineSpeed (VitePress, spa): runtime, metaChunk, no speculation", async () => {
  const user = [];
  const cfg = withGaineSpeed(
    {
      head: [["meta", { name: "a" }]],
      locales: { root: {}, id: {}, en: {} },
      buildEnd: async () => void user.push("buildEnd"),
      transformHtml: (c) => c.replace("A", "B"),
    },
    { hints: [{ rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true }] },
  );
  assert.equal(cfg.mpa, undefined);
  assert.equal(cfg.metaChunk, true);
  assert.deepEqual(heads(cfg), ["meta:", "link:preconnect", "script:"]);
  const runtime = cfg.head.at(-1)[2];
  assert.ok(
    runtime.includes('["id","en"]') &&
      !runtime.includes("speculationrules") &&
      !runtime.includes("PD="),
  );
  assert.deepEqual(cfg.vite.build.target.slice(0, 1), ["es2022"]);
  const html = await cfg.transformHtml(
    '<head></head><img src="1"><img src="2"><img src="3"><p>A</p>',
    "x.html",
    {},
  );
  assert.ok(html.includes("<p>B</p>") && html.includes('src="3" decoding="async" loading="lazy"'));

  const dir = await mkdtemp(join(tmpdir(), "gaine-vp-"));
  try {
    await writeFile(join(dir, "_headers"), "/old/*\n  X-Old: 1\n");
    await cfg.buildEnd({ outDir: dir });
    const file = await readFile(join(dir, "_headers"), "utf8");
    assert.ok(
      file.startsWith("/old/*") &&
        file.includes("/assets/*\n  Cache-Control: public, max-age=31536000, immutable"),
    );
    assert.deepEqual(user, ["buildEnd"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("withGaineSpeed (VitePress, mpa): zero-JS mode with speculation and prefetch fallback", () => {
  const cfg = withGaineSpeed({ base: "/docs/" }, { mode: "mpa", locales: ["id", "en"] });
  assert.equal(cfg.mpa, true);
  assert.equal(cfg.metaChunk, undefined);
  const spec = cfg.head.find((h) => h[1].type === "speculationrules");
  assert.ok(spec && JSON.parse(spec[2]).prerender[0].where.and[0].href_matches === "/docs/*");
  const runtime = cfg.head.at(-1)[2];
  assert.ok(runtime.includes("PF=true") && runtime.includes('BS="/docs"'));
});

test("withGaineSpeed (VitePress): opt-outs and user config precedence", async () => {
  const cfg = withGaineSpeed(
    { vite: { build: { target: "es2019" } }, metaChunk: false },
    { optimizeHtml: false, headersFile: false, modernTarget: true },
  );
  assert.equal(cfg.vite.build.target, "es2019");
  assert.equal(cfg.metaChunk, false);
  assert.equal(await cfg.transformHtml('<img src="a">', "x"), '<img src="a">');
  await cfg.buildEnd({ outDir: "/nonexistent/should-not-be-written" });
});
