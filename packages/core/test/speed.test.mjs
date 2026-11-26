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
import vm from "node:vm";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  speculationRules,
  speculationRulesJson,
  gaineRuntimeScript,
  resourceHints,
  hintsToHtml,
  hintsToLinkHeader,
  fontPreload,
  speedHeaders,
  toHeadersFile,
  toNextHeaders,
  optimizeHtml,
  renderLanguageMenu,
  renderThemeToggle,
} from "../dist/speed/index.js";
import { measureBuild, checkBudget } from "../dist/speed/node.js";

class ClassList {
  s = new Set();
  add(c) {
    this.s.add(c);
  }
  contains(c) {
    return this.s.has(c);
  }
  toggle(c, f) {
    const on = f ?? !this.s.has(c);
    on ? this.s.add(c) : this.s.delete(c);
    return on;
  }
}
class El {
  constructor(tag, attrs = {}, parent = null) {
    this.tag = tag;
    this.attrs = { ...attrs };
    this.parent = parent;
    this.children = [];
    this.classList = new ClassList();
    this.nodeType = 1;
    this.hidden = attrs.hidden !== undefined;
    if (parent) parent.children.push(this);
  }
  get href() {
    return this.attrs.href;
  }
  set href(v) {
    this.attrs.href = v;
  }
  get target() {
    return this.attrs.target;
  }
  hasAttribute(n) {
    return n in this.attrs;
  }
  getAttribute(n) {
    return this.attrs[n] ?? null;
  }
  setAttribute(n, v) {
    this.attrs[n] = v;
  }
  matches(sel) {
    if (sel.endsWith(":not(.is-visible)"))
      return this.matches(sel.slice(0, -17)) && !this.classList.contains("is-visible");
    const m = /^([a-z]*)\[([a-z-]+)\]$/.exec(sel);
    return !!m && (!m[1] || m[1] === this.tag) && m[2] in this.attrs;
  }
  closest(sel) {
    for (let e = this; e; e = e.parent) if (e.matches(sel)) return e;
    return null;
  }
  descendants() {
    return this.children.flatMap((c) => [c, ...c.descendants()]);
  }
  querySelector(sel) {
    return this.descendants().find((e) => e.matches(sel)) ?? null;
  }
  focus() {
    env.focused = this;
  }
}

let env;
function makeEnv({ path = "/id/guide/", stored = null, dark = false, speculation = false } = {}) {
  const listeners = {};
  const store = new Map(stored ? [["theme", stored]] : []);
  const root = new El("html");
  const body = new El("body", {}, root);
  const head = new El("head", {}, root);
  head.appendChild = (e) => {
    head.children.push(e);
  };
  const io = { observed: new Set(), cb: null };
  const mo = { cb: null };
  const sandbox = {
    setTimeout,
    clearTimeout,
    URL,
    WeakSet,
    console,
    navigator: {},
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    matchMedia: () => ({ matches: dark, addEventListener() {} }),
    location: {
      pathname: path,
      search: "?q=1",
      hash: "#h",
      origin: "https://x.test",
      assigned: null,
      assign(u) {
        this.assigned = u;
      },
    },
    requestAnimationFrame: (f) => f(),
    IntersectionObserver: class {
      constructor(cb) {
        io.cb = cb;
      }
      observe(e) {
        io.observed.add(e);
      }
      unobserve(e) {
        io.observed.delete(e);
      }
    },
    MutationObserver: class {
      constructor(cb) {
        mo.cb = cb;
      }
      observe() {}
    },
    HTMLScriptElement: { supports: (t) => speculation && t === "speculationrules" },
    fetch: () => Promise.resolve(),
    addEventListener() {},
    document: {
      documentElement: root,
      readyState: "complete",
      head,
      addEventListener(t, f) {
        (listeners[t] ??= []).push(f);
      },
      querySelectorAll: (sel) => root.descendants().filter((e) => e.matches(sel)),
      createElement: (tag) => {
        const e = new El(tag);
        e.relList = { supports: () => true };
        Object.defineProperty(e, "rel", { value: "", writable: true });
        return e;
      },
    },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const fire = (type, ev) => (listeners[type] ?? []).forEach((f) => f(ev));
  env = {
    root,
    body,
    head,
    io,
    mo,
    store,
    sandbox,
    listeners,
    fire,
    ctx,
    run: (s) => vm.runInContext(s, ctx),
  };
  return env;
}
const click = (target, extra = {}) => ({
  target,
  button: 0,
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
  ...extra,
});

test("speculationRules: structure, base and escaping", () => {
  const r = speculationRules({ base: "/docs/" });
  const and = r.prerender[0].where.and;
  assert.deepEqual(and[0], { href_matches: "/docs/*" });
  assert.ok(and.some((c) => c.not?.href_matches === "/docs/api/*"));
  assert.ok(and.some((c) => c.not?.selector_matches === "[download]"));
  assert.equal(r.prerender[0].eagerness, "moderate");
  assert.ok(speculationRules({ action: "prefetch", eagerness: "eager" }).prefetch);
  assert.ok(!speculationRulesJson({ exclude: ["/</script>"] }).includes("</script>"));
});

test("runtime: every option combination is syntactically valid", () => {
  const combos = [
    {},
    { theme: false },
    { reveal: false },
    { menu: true },
    { locales: ["id", "en"], base: "/x" },
    { prefetch: { delay: 10, fallbackOnly: true } },
    { menu: true, locales: ["id"], prefetch: {} },
  ];
  for (const c of combos) {
    const s = gaineRuntimeScript(c);
    assert.ok(s.length > 0);
    new vm.Script(s);
  }
  assert.equal(gaineRuntimeScript({ theme: false, reveal: false }), "");
  assert.ok(gaineRuntimeScript({}).length < 2200, "default runtime stays small");
  assert.ok(!gaineRuntimeScript({ locales: ["</script>"] }).includes("</script>"));
});

test("runtime: theme toggle, storage and idempotence", () => {
  const e = makeEnv();
  const btn = new El("button", { "data-gaine-theme": "" }, e.body);
  e.run(gaineRuntimeScript());
  e.fire("click", click(btn));
  assert.ok(e.root.classList.contains("dark"));
  assert.equal(e.store.get("theme"), "dark");
  e.fire("click", click(btn));
  assert.ok(!e.root.classList.contains("dark"));
  assert.equal(e.store.get("theme"), "light");
  e.run(gaineRuntimeScript());
  assert.equal(e.listeners.click.length, 1, "second run is ignored");
});

test("runtime: reveal observes, reveals, and picks up nodes added later", () => {
  const e = makeEnv();
  const a = new El("div", { "data-reveal": "up" }, e.body);
  e.run(gaineRuntimeScript({ theme: false }));
  assert.ok(e.io.observed.has(a));
  e.io.cb([{ isIntersecting: true, target: a }]);
  assert.ok(a.classList.contains("is-visible"));
  assert.ok(!e.io.observed.has(a));
  const b = new El("div", { "data-reveal": "fade" }, e.body);
  e.mo.cb([{ addedNodes: [b] }]);
  assert.ok(e.io.observed.has(b));
  const noise = new El("p", {}, e.body);
  const before = e.io.observed.size;
  e.mo.cb([{ addedNodes: [noise] }]);
  assert.equal(e.io.observed.size, before);
});

test("runtime: menu open/close, outside click and Escape", () => {
  const e = makeEnv();
  const menu = new El("div", { "data-gaine-menu": "" }, e.body);
  const trig = new El("button", { "data-gaine-menu-trigger": "" }, menu);
  const content = new El("div", { "data-gaine-menu-content": "", hidden: "" }, menu);
  const item = new El("a", { href: "/en" }, content);
  const outside = new El("div", {}, e.body);
  e.run(gaineRuntimeScript({ theme: false, reveal: false, menu: true }));
  e.fire("click", click(trig));
  assert.equal(content.hidden, false);
  assert.equal(trig.attrs["aria-expanded"], "true");
  e.fire("click", click(outside));
  assert.equal(content.hidden, true);
  e.fire("click", click(trig));
  e.fire("click", click(item));
  assert.equal(content.hidden, true);
  e.fire("click", click(trig));
  e.fire("keydown", { key: "Escape" });
  assert.equal(content.hidden, true);
  assert.equal(env.focused, trig);
});

test("runtime: locale switching keeps path, query, hash and base", () => {
  const cases = [
    ["/id/guide/", "", "/en/guide/"],
    ["/", "", "/en/"],
    ["/id", "", "/en"],
    ["/docs/id/guide/", "/docs", "/docs/en/guide/"],
    ["/guide/", "", "/en/guide/"],
  ];
  for (const [path, base, expected] of cases) {
    const e = makeEnv({ path });
    const a = new El("a", { "data-gaine-locale": "en", href: "/en" }, e.body);
    e.run(gaineRuntimeScript({ theme: false, reveal: false, locales: ["id", "en"], base }));
    const ev = click(a);
    e.fire("click", ev);
    assert.equal(e.sandbox.location.assigned, `${expected}?q=1#h`, path);
    assert.ok(ev.defaultPrevented);
  }
  const e = makeEnv();
  const a = new El("a", { "data-gaine-locale": "en" }, e.body);
  e.run(gaineRuntimeScript({ theme: false, reveal: false, locales: ["id", "en"] }));
  e.fire("click", click(a, { ctrlKey: true }));
  assert.equal(e.sandbox.location.assigned, null);
});

test("runtime: hover-intent prefetch, same-origin only, deduped", async () => {
  const e = makeEnv({ path: "/a/" });
  const ok = new El("a", { href: "https://x.test/b/#frag" }, e.body);
  const far = new El("a", { href: "https://other.test/" }, e.body);
  const same = new El("a", { href: "https://x.test/a/?q=1#top" }, e.body);
  const dl = new El("a", { href: "https://x.test/f.zip", download: "" }, e.body);
  e.run(gaineRuntimeScript({ theme: false, reveal: false, prefetch: { delay: 5 } }));
  for (const t of [far, same, dl]) {
    e.fire("mouseover", { target: t });
  }
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(e.head.children.length, 0);
  e.fire("mouseover", { target: ok });
  await new Promise((r) => setTimeout(r, 30));
  e.fire("mouseover", { target: ok });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(e.head.children.length, 1);
  assert.equal(e.head.children[0].href, "https://x.test/b/");
  e.fire("mouseover", { target: ok });
  e.fire("mouseout", {});
  await new Promise((r) => setTimeout(r, 30));
  const n = makeEnv({ speculation: true });
  n.run(gaineRuntimeScript({ theme: false, reveal: false, prefetch: { fallbackOnly: true } }));
  assert.equal(n.listeners.mouseover, undefined, "native speculation rules take over");
});

test("hints: html, Link header, validation", () => {
  const hints = [
    ...resourceHints({
      preconnect: ["https://fonts.gstatic.com"],
      fonts: ["/f/inter.woff2"],
      images: ["/hero.avif"],
    }),
  ];
  assert.equal(hints[1].type, "font/woff2");
  assert.equal(
    hintsToHtml([fontPreload("/a.woff2")]),
    '<link rel="preload" href="/a.woff2" as="font" type="font/woff2" crossorigin="anonymous">',
  );
  assert.ok(
    hintsToLinkHeader(hints).startsWith("<https://fonts.gstatic.com>; rel=preconnect; crossorigin"),
  );
  assert.throws(() => hintsToHtml([{ rel: "preload", href: "/x\r\nSet-Cookie: a=b" }]));
});

test("headers: rules map to _headers and Next formats", () => {
  const rules = speedHeaders({
    base: "/docs",
    immutable: ["assets"],
    preload: [fontPreload("/docs/a.woff2")],
  });
  assert.equal(rules[0].path, "/docs/*");
  assert.equal(rules[1].path, "/docs/assets/*");
  assert.ok(rules[0].headers.Link.includes("rel=preload"));
  assert.match(
    toHeadersFile(rules),
    /\/docs\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/,
  );
  assert.equal(toNextHeaders(rules)[1].source, "/docs/assets/:path*");
  assert.deepEqual(speedHeaders({ security: false }), []);
});

test("optimizeHtml: lazy images safely", () => {
  const html = `<html><head></head><body><img src="a.png"><img src="b.png" alt="x>y"/><img src="c.png" alt="loading screen"><img src="d.png" loading="eager"><script>var s='<img src="no.png">'</script><pre><img src="p.png"></pre><iframe src="v"></iframe></body></html>`;
  const out = optimizeHtml(html, { head: "<link rel=x>" });
  assert.match(out, /<img src="a.png" decoding="async">/);
  assert.match(out, /<img src="b.png" alt="x>y" decoding="async" \/>/);
  assert.match(out, /<img src="c.png" alt="loading screen" decoding="async" loading="lazy">/);
  assert.match(out, /<img src="d.png" loading="eager" decoding="async">/);
  assert.ok(out.includes(`var s='<img src="no.png">'`));
  assert.ok(out.includes('<pre><img src="p.png"></pre>'));
  assert.match(out, /<iframe src="v" loading="lazy">/);
  assert.ok(out.includes("<link rel=x></head>"));
  assert.equal(optimizeHtml(out), optimizeHtml(optimizeHtml(out)), "idempotent");
});

test("menu markup: contract with the runtime", () => {
  const h = renderLanguageMenu({
    locale: "id",
    label: "Lang",
    locales: ["id", "en"],
    labels: { id: "Indonesia", en: "English <b>" },
    trailingSlash: true,
  });
  assert.ok(
    h.includes("data-gaine-menu ") &&
      h.includes("data-gaine-menu-trigger") &&
      h.includes("data-gaine-menu-content hidden"),
  );
  assert.ok(h.includes('href="/en/" data-gaine-locale="en"'));
  assert.ok(h.includes("English &lt;b&gt;"));
  assert.ok(
    renderLanguageMenu({
      locale: "id",
      label: "L",
      locales: ["id", "en"],
      labels: { id: "a", en: "b" },
      base: "/docs",
      path: "/guide/",
    }).includes('href="/docs/en/guide/"'),
  );
  assert.ok(
    renderThemeToggle('T"').includes("data-gaine-theme") &&
      renderThemeToggle('T"').includes("&quot;"),
  );
});

test("measureBuild + checkBudget", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gaine-"));
  try {
    await mkdir(join(dir, "assets"), { recursive: true });
    await writeFile(join(dir, "assets", "app.js"), "console.log(1);".repeat(400));
    await writeFile(join(dir, "assets", "app.css"), "a{color:red}".repeat(300));
    await writeFile(
      join(dir, "index.html"),
      `<html><head><link rel="stylesheet" href="/docs/assets/app.css"><link rel="modulepreload" href="/docs/assets/app.js"><script type="module" src="/docs/assets/app.js"></script><script>var a=1</script><script type="speculationrules">{}</script></head><body>hi</body></html>`,
    );
    const r = await measureBuild(dir, { base: "/docs" });
    assert.equal(r.pages.length, 1);
    const p = r.pages[0];
    assert.deepEqual(p.files.sort(), ["/assets/app.css", "/assets/app.js"]);
    assert.ok(p.js > 0 && p.css > 0 && p.inline > 0 && p.total === p.html + p.js + p.css);
    assert.equal(checkBudget(r, { js: 1_000_000 }).length, 0);
    assert.equal(checkBudget(r, { js: 1, total: 1 }).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
