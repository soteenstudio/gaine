# {{name}}

Created with `npx gaine@latest` (Next.js + JavaScript).

```bash
npm install
npm run dev
```

- `i18n/config.js`: the list of locales. `proxy.js` redirects `/` to a locale based on `Accept-Language`.
- `tailwind.config.mjs`: change the brand color through the `gainePreset()` options.
- `app/[locale]/page.jsx`: example page.
- Fonts (`next/font`) are intentionally not included; add them in `app/[locale]/layout.jsx` and set the `--font-sans` variable.
