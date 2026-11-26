import type { Config } from "tailwindcss";
import { gaineContent, gainePreset } from "@gaine/core/tailwind";

const config: Config = {
  presets: [gainePreset()], // ganti brand: gainePreset({ light: { brand: "250 80% 55%" } })
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", ...gaineContent],
};

export default config;
