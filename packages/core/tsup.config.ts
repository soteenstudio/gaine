import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "tailwind/index": "src/tailwind/index.ts",
    "speed/index": "src/speed/index.ts",
    "speed/node": "src/speed/node.ts",
  },
  format: ["esm"],
  target: "es2020",
  platform: "neutral",
  splitting: true,
  treeshake: true,
  minify: true,
  sourcemap: true,
  clean: true,
  dts: false,
});
