import { gaineContent, gainePreset } from "@gaine/core/tailwind";

/** @type {import("tailwindcss").Config} */
export default {
  presets: [gainePreset()], // ganti brand: gainePreset({ light: { brand: "250 80% 55%" } })
  corePlugins: { preflight: false }, // jangan merusak styling tema default VitePress
  content: ["./.vitepress/theme/**/*.js", "./*.md", "./id/**/*.md", "./en/**/*.md", ...gaineContent],
};
