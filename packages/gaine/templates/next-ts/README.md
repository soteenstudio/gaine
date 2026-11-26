# {{name}}

Dibuat dengan `npx gaine@latest` (Next.js + TypeScript).

```bash
npm install
npm run dev
```

- `i18n/config.ts`: daftar locale. `proxy.ts` mengarahkan `/` ke locale dari `Accept-Language`.
- `tailwind.config.ts`: ganti warna brand lewat opsi `gainePreset()`.
- `app/[locale]/page.tsx`: halaman contoh.
- Font (`next/font`) sengaja tidak disertakan; pasang di `app/[locale]/layout.tsx` dan set variabel `--font-sans`.
