import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin.js";
import animate from "tailwindcss-animate";

export type GaineToken =
  | "background"
  | "foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "popover"
  | "popover-foreground"
  | "border"
  | "input"
  | "ring"
  | "brand"
  | "brand-foreground";

export type GaineTokens = Record<GaineToken, string>;

export interface GainePresetOptions {
  light?: Partial<GaineTokens>;
  dark?: Partial<GaineTokens>;
  radius?: string;
}

export const defaultLightTokens: GaineTokens = {
  background: "0 0% 100%",
  foreground: "222 47% 9%",
  primary: "222 47% 11%",
  "primary-foreground": "0 0% 100%",
  secondary: "220 14% 96%",
  "secondary-foreground": "222 47% 11%",
  muted: "220 14% 96%",
  "muted-foreground": "220 9% 38%",
  accent: "220 14% 95%",
  "accent-foreground": "222 47% 11%",
  popover: "0 0% 100%",
  "popover-foreground": "222 47% 9%",
  border: "220 13% 90%",
  input: "220 13% 90%",
  ring: "172 66% 36%",
  brand: "172 66% 38%",
  "brand-foreground": "0 0% 100%",
};

export const defaultDarkTokens: GaineTokens = {
  background: "222 47% 6%",
  foreground: "210 40% 96%",
  primary: "210 40% 96%",
  "primary-foreground": "222 47% 8%",
  secondary: "222 30% 12%",
  "secondary-foreground": "210 40% 96%",
  muted: "222 30% 12%",
  "muted-foreground": "215 18% 68%",
  accent: "222 30% 15%",
  "accent-foreground": "210 40% 96%",
  popover: "222 40% 8%",
  "popover-foreground": "210 40% 96%",
  border: "222 25% 18%",
  input: "222 25% 18%",
  ring: "172 66% 45%",
  brand: "172 66% 45%",
  "brand-foreground": "222 47% 8%",
};

function toCssVars(tokens: GaineTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) vars[`--${name}`] = value;
  return vars;
}

export const gaineContent = [
  "./node_modules/@gaine/core/dist/**/*.js",
  "./node_modules/@gaine/nextjs/dist/**/*.js",
  "./node_modules/@gaine/vitepress/dist/**/*.js",
];

export function gainePreset(options: GainePresetOptions = {}): Partial<Config> {
  const light = { ...defaultLightTokens, ...options.light };
  const dark = { ...defaultDarkTokens, ...options.dark };
  const radius = options.radius ?? "0.875rem";

  const base = plugin(({ addBase, addUtilities }) => {
    addBase({
      ":root": { ...toCssVars(light), "--radius": radius },
      ".dark": { "color-scheme": "dark", ...toCssVars(dark) },
      "*": { "border-color": "hsl(var(--border))" },
      html: { "scroll-behavior": "smooth" },
      body: {
        "background-color": "hsl(var(--background))",
        "font-family": "var(--font-sans), system-ui, sans-serif",
        color: "hsl(var(--foreground))",
        "-webkit-font-smoothing": "antialiased",
        "-moz-osx-font-smoothing": "grayscale",
      },
      "::selection": { background: "hsl(var(--brand) / 0.2)" },
      "@media (prefers-reduced-motion: reduce)": {
        html: { "scroll-behavior": "auto" },
        "*": {
          "animation-duration": "0.01ms !important",
          "transition-duration": "0.01ms !important",
        },
      },
    });
    addUtilities({
      ".bg-dots": {
        "background-image": "radial-gradient(hsl(var(--foreground) / 0.18) 1px, transparent 1px)",
        "background-size": "14px 14px",
      },
    });
  });

  return {
    darkMode: ["class"],
    theme: {
      extend: {
        fontFamily: {
          sans: ["var(--font-sans)", "system-ui", "sans-serif"],
          display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        },
        colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input))",
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: {
            DEFAULT: "hsl(var(--primary))",
            foreground: "hsl(var(--primary-foreground))",
          },
          secondary: {
            DEFAULT: "hsl(var(--secondary))",
            foreground: "hsl(var(--secondary-foreground))",
          },
          muted: {
            DEFAULT: "hsl(var(--muted))",
            foreground: "hsl(var(--muted-foreground))",
          },
          accent: {
            DEFAULT: "hsl(var(--accent))",
            foreground: "hsl(var(--accent-foreground))",
          },
          popover: {
            DEFAULT: "hsl(var(--popover))",
            foreground: "hsl(var(--popover-foreground))",
          },
          brand: {
            DEFAULT: "hsl(var(--brand))",
            foreground: "hsl(var(--brand-foreground))",
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
        },
      },
    },
    plugins: [animate, base],
  };
}
