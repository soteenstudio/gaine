# gaine

Scaffold a Gaine project.

```bash
npx gaine@latest
```

Interactive menu (up/down arrows or `j`/`k`, Enter; digits 1-9 pick directly):

1. Project name (`.` for the current folder)
2. Framework: **Next.js** or **VitePress**
3. Language: **TypeScript** or **JavaScript**

Without the menu:

```bash
npx gaine@latest my-app --framework next --lang ts
npx gaine@latest my-docs -f vitepress -l js
```

| Template | Contents |
| --- | --- |
| `next-ts`, `next-js` | Next 16 App Router, `@gaine/core` + `@gaine/nextjs`, i18n (`id`/`en`), `proxy.ts`, robots, sitemap, an example page |
| `vitepress-ts`, `vitepress-js` | VitePress 1.x, `@gaine/core` + `@gaine/vitepress`, i18n (`id`/`en`), a language switcher + theme toggle in the navbar, robots/sitemap at build time |

No runtime dependencies; the menu is written with Node's built-in `readline`. Templates live in `templates/` and are copied
as-is (`_gitignore` is renamed to `.gitignore`, `{{name}}` is replaced with the project name).

## Releasing

Publish in this order: `@gaine/core`, then `@gaine/nextjs` and `@gaine/vitepress`, and finally `gaine`
(the templates reference `^0.1.0` of all three). Run `pnpm -r build`, then `pnpm publish --access public` per package.
