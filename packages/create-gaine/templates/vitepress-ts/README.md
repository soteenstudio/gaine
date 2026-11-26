# {{name}}

Created with `npx create-gaine@latest` (VitePress + TypeScript).

```bash
npm install
npm run dev
```

- `.vitepress/i18n.ts`: the list of locales. Per-language content lives in `id/` and `en/`.
- `.vitepress/theme/index.ts`: the default VitePress theme + Gaine components in the navbar.
- `tailwind.config.ts`: change the brand color through the `gainePreset()` options.
- Set `SITE_URL` at build time so `robots.txt` and `sitemap.xml` use the correct domain.
