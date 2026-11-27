const v = (name) => `hsl(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: v("background"),
        foreground: v("foreground"),
        border: v("border"),
        muted: v("muted"),
        "muted-foreground": v("muted-foreground"),
        brand: v("brand"),
        "brand-foreground": v("brand-foreground"),
      },
      fontFamily: { display: ["ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
};
