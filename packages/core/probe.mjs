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

import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWaterdropFallback } from "./dist/waterdrop/index.js";

const dir = await mkdtemp(join(tmpdir(), "wd-"));
await mkdir(join(dir, "assets"));
await writeFile(
  join(dir, "index.html"),
  '<!doctype html><html><head><!-- drop --><link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script></head><body><div class="hero"></div><img src="/assets/a.png"><p>hello    world</p><script>const inline = 1; // drop</script></body></html>',
);
await writeFile(join(dir, "assets", "app.js"), "// c\nconst a=1;\n");
await writeFile(join(dir, "assets", "app.css"), "/* c */\n.hero { color: red; }\n");
const r = await runWaterdropFallback({ root: dir, outDir: dir });
console.log(JSON.stringify(r.changes, null, 2));
console.log(await readFile(join(dir, "index.html"), "utf8"));
await rm(dir, { recursive: true, force: true });
