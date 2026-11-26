import type { Config } from "tailwindcss";
import { gaineContent, gainePreset } from "@gaine/core/tailwind";

const config: Config = {
  presets: [gainePreset()], // change the brand color: gainePreset({ light: { brand: "250 80% 55%" } })
  corePlugins: { preflight: false }, // do not break the default VitePress theme styling
  content: ["./.vitepress/theme/**/*.ts", "./*.md", "./id/**/*.md", "./en/**/*.md", ...gaineContent],
};

export default config;
