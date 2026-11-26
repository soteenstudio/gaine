import { gaineContent, gainePreset } from "@gaine/core/tailwind";

/** @type {import("tailwindcss").Config} */
export default {
  presets: [gainePreset()], // ganti brand: gainePreset({ light: { brand: "250 80% 55%" } })
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", ...gaineContent],
};
