import { defineConfig } from "tsup";

// Not a single bundle on purpose: Next.js needs each "use client" file to stay its own module
// so the client boundary survives. Each file is minified; ESM + sideEffects:false keeps it tree-shakeable.
export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  bundle: false,
  format: ["esm"],
  target: "es2020",
  minify: true,
  sourcemap: true,
  clean: true,
  dts: false,
});
