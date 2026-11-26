---
layout: home
hero:
  name: "{{name}}"
  text: Situs VitePress dengan tema dan i18n Gaine
  tagline: Dark mode, ganti bahasa, dan reveal-on-scroll sudah terpasang.
  actions:
    - theme: brand
      text: Mulai
      link: /id/guide/
features:
  - title: Dark mode tanpa kedipan
    details: themeInitScript dipasang di head, ThemeSync menjaga tema saat pindah halaman.
  - title: Redirect bahasa
    details: Halaman root diarahkan ke bahasa browser lewat gaineHead.
  - title: Robots dan sitemap
    details: robots.txt dan sitemap.xml dibuat saat build oleh createSeoBuildEnd.
---
