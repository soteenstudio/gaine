# Panduan

Edit file di folder `id/` dan `en/`. Tambah locale di `.vitepress/i18n.ts` dan `.vitepress/config.ts`.

Elemen dengan animasi saat di-scroll:

<script setup>
import { reveal } from "@gaine/vitepress";
</script>

<div v-bind="reveal(120)" class="rounded-lg border p-6">Muncul saat di-scroll.</div>
