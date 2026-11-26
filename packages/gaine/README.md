# gaine

Scaffold proyek Gaine.

```bash
npx gaine@latest
```

Menu interaktif (panah atas/bawah atau `j`/`k`, Enter; angka 1-9 memilih langsung):

1. Nama proyek (`.` untuk folder saat ini)
2. Framework: **Next.js** atau **VitePress**
3. Bahasa: **TypeScript** atau **JavaScript**

Tanpa menu:

```bash
npx gaine@latest my-app --framework next --lang ts
npx gaine@latest my-docs -f vitepress -l js
```

| Template | Isi |
| --- | --- |
| `next-ts`, `next-js` | Next 16 App Router, `@gaine/core` + `@gaine/nextjs`, i18n (`id`/`en`), `proxy.ts`, robots, sitemap, halaman contoh |
| `vitepress-ts`, `vitepress-js` | VitePress 1.x, `@gaine/core` + `@gaine/vitepress`, i18n (`id`/`en`), switcher bahasa + toggle tema di navbar, robots/sitemap saat build |

Tidak ada dependensi runtime; menu ditulis dengan `readline` bawaan Node. Template ada di `templates/` dan disalin apa adanya
(`_gitignore` diganti nama menjadi `.gitignore`, `{{name}}` diganti nama proyek).

## Rilis

Publish urut: `@gaine/core`, lalu `@gaine/nextjs` dan `@gaine/vitepress`, terakhir `gaine`
(template mengacu ke `^0.1.0` ketiganya). `pnpm -r build` lalu `pnpm publish --access public` per package.
