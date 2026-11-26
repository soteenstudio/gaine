import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  treeshake: true,
  minify: true,
  sourcemap: false,
  clean: true,
  dts: false,
});
