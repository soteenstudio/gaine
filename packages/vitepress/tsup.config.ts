import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    theme: "src/theme.ts",
    head: "src/head.ts",
    metadata: "src/metadata.ts",
    og: "src/og.ts",
    speed: "src/speed.ts",
  },
  format: ["esm"],
  target: "es2020",
  platform: "node",
  splitting: true,
  treeshake: true,
  minify: true,
  sourcemap: true,
  clean: true,
  dts: false,
});
