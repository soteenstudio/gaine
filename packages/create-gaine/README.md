# gaine

Scaffold a Gaine project with zero runtime dependencies (the interactive menu uses Node's built-in `readline`).

Docs: [https://gaine.soteenstudio.my.id](https://gaine.soteenstudio.my.id)

```bash
npx create-gaine@latest
```

It'll ask for:

1. Project name (use `.` for here)
2. Framework (**Next.js** or **VitePress**)
3. Language (**TypeScript** or **JavaScript**)

Skip the menu with flags:

```bash
npx create-gaine@latest my-app --framework next --lang ts

# or
npx create-gaine@latest my-docs -f vitepress -l js
```

## Templates

| Template | Included |
| --- | --- |
| `next-ts`, `next-js` | Next.js 16 App Router, React 19, Tailwind CSS 3, `@gaine/core` + `@gaine/nextjs`, bilingual i18n (`id`/`en`), locale-aware routing via `proxy.ts` / `proxy.js`, Gaine theme system (dark/light mode), lightweight runtime (theme, reveal, menu, language switching, hover-intent prefetch), UI components (`Button`, `Badge`, `SectionHeading`, `Logo`), scroll reveal, optimized Next.js configuration (`withGaineSpeed`), metadata, `robots.txt`, `sitemap.xml`, and example landing page. |
| `vitepress-ts`, `vitepress-js` | VitePress 1.x, Vue 3, Tailwind CSS 3, `@gaine/core` + `@gaine/vitepress`, bilingual i18n (`id`/`en`), localized documentation structure (`id/`, `en/`), Gaine theme system (dark/light mode), navbar language switcher + theme toggle, lightweight runtime (theme, reveal, menu, language switching), scroll reveal, SEO metadata, build-time `robots.txt` + `sitemap.xml`, optimized HTML and asset caching, and example documentation pages. |