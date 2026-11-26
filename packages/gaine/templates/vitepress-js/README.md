# {{name}}

Dibuat dengan `npx gaine@latest` (VitePress + JavaScript).

```bash
npm install
npm run dev
```

- `.vitepress/i18n.js`: daftar locale. Konten per bahasa ada di `id/` dan `en/`.
- `.vitepress/theme/index.js`: tema default VitePress + komponen Gaine di navbar.
- `tailwind.config.js`: ganti warna brand lewat opsi `gainePreset()`.
- Set `SITE_URL` saat build agar `robots.txt` dan `sitemap.xml` memakai domain yang benar.
