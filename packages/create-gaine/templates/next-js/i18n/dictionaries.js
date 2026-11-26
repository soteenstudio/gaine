const dictionaries = {
  id: {
    metaTitle: "Beranda",
    metaDescription: "Starter Gaine untuk Next.js.",
    badge: "Starter",
    heroTitle: "Situs Next.js dengan tema, i18n, dan animasi siap pakai",
    heroDescription: "Token warna, dark mode, ganti bahasa, dan reveal-on-scroll sudah terpasang lewat Gaine.",
    cta: "Baca dokumentasi",
    eyebrow: "Fitur",
    featuresTitle: "Sudah termasuk",
    featuresDescription: "Edit app/[locale]/page.jsx untuk mulai membangun.",
    features: ["Dark mode tanpa kedipan", "Redirect bahasa lewat proxy.js", "Robots, sitemap, dan komponen UI"],
    homeLabel: "Beranda",
    languageLabel: "Ganti bahasa",
    themeLabel: "Ganti tema",
  },
  en: {
    metaTitle: "Home",
    metaDescription: "Gaine starter for Next.js.",
    badge: "Starter",
    heroTitle: "A Next.js site with theming, i18n, and animations out of the box",
    heroDescription: "Color tokens, dark mode, language switching, and reveal-on-scroll are wired up through Gaine.",
    cta: "Read the docs",
    eyebrow: "Features",
    featuresTitle: "What's included",
    featuresDescription: "Edit app/[locale]/page.jsx to start building.",
    features: ["Flash-free dark mode", "Locale redirect via proxy.js", "Robots, sitemap, and UI components"],
    homeLabel: "Home",
    languageLabel: "Change language",
    themeLabel: "Toggle theme",
  },
};

export function getDictionary(locale) {
  return dictionaries[locale];
}
