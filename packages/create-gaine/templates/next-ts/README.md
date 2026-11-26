# {{name}}

Created with `npx create-gaine@latest` (Next.js + TypeScript).

```bash
npm install
npm run dev
```

- `i18n/config.ts`: the list of locales. `proxy.ts` redirects `/` to a locale based on `Accept-Language`.
- `tailwind.config.ts`: change the brand color through the `gainePreset()` options.
- `app/[locale]/page.tsx`: example page.
- Fonts (`next/font`) are intentionally not included; add them in `app/[locale]/layout.tsx` and set the `--font-sans` variable.
