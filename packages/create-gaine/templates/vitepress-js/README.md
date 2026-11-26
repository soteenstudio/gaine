# {{name}}

Created with `npx create-gaine@latest` (VitePress + JavaScript).

```bash
npm install
npm run dev
```

- `.vitepress/i18n.js`: the list of locales. Per-language content lives in `id/` and `en/`.
- `.vitepress/theme/index.js`: the default VitePress theme + Gaine components in the navbar.
- `tailwind.config.js`: change the brand color through the `gainePreset()` options.
- Set `SITE_URL` at build time so `robots.txt` and `sitemap.xml` use the correct domain.
