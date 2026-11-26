import type { Config } from "tailwindcss";
import { gaineContent, gainePreset } from "@gaine/core/tailwind";

const config: Config = {
  presets: [gainePreset()], // ganti brand: gainePreset({ light: { brand: "250 80% 55%" } })
  corePlugins: { preflight: false }, // jangan merusak styling tema default VitePress
  content: ["./.vitepress/theme/**/*.ts", "./*.md", "./id/**/*.md", "./en/**/*.md", ...gaineContent],
};

export default config;
