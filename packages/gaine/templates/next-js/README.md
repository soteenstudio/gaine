# {{name}}

Dibuat dengan `npx gaine@latest` (Next.js + JavaScript).

```bash
npm install
npm run dev
```

- `i18n/config.js`: daftar locale. `proxy.js` mengarahkan `/` ke locale dari `Accept-Language`.
- `tailwind.config.mjs`: ganti warna brand lewat opsi `gainePreset()`.
- `app/[locale]/page.jsx`: halaman contoh.
- Font (`next/font`) sengaja tidak disertakan; pasang di `app/[locale]/layout.jsx` dan set variabel `--font-sans`.
