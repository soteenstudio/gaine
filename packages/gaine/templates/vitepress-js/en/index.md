---
layout: home
hero:
  name: "{{name}}"
  text: A VitePress site with Gaine theming and i18n
  tagline: Dark mode, language switching, and reveal-on-scroll are wired up.
  actions:
    - theme: brand
      text: Get started
      link: /en/guide/
features:
  - title: Flash-free dark mode
    details: themeInitScript runs in head and ThemeSync keeps the theme across navigation.
  - title: Locale redirect
    details: The root page is redirected to the browser language through gaineHead.
  - title: Robots and sitemap
    details: robots.txt and sitemap.xml are generated at build time by createSeoBuildEnd.
---
