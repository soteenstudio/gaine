# Guide

Edit the files in `id/` and `en/`. Add locales in `.vitepress/i18n.ts` and `.vitepress/config.ts`.

An element that animates on scroll:

<script setup>
import { reveal } from "@gaine/vitepress";
</script>

<div v-bind="reveal(120)" class="rounded-lg border p-6">Revealed on scroll.</div>
