import { gaineContent, gainePreset } from "@gaine/core/tailwind";

/** @type {import("tailwindcss").Config} */
export default {
  presets: [gainePreset()], // change the brand color: gainePreset({ light: { brand: "250 80% 55%" } })
  corePlugins: { preflight: false }, // do not break the default VitePress theme styling
  content: ["./.vitepress/theme/**/*.js", "./*.md", "./id/**/*.md", "./en/**/*.md", ...gaineContent],
};
