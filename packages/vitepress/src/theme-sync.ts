/*
 * Copyright 2026 SoTeen Studio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineComponent, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vitepress";
import { applyTheme } from "@gaine/core";

export function useThemeSync() {
  const route = useRoute();
  let media: MediaQueryList | undefined;

  onMounted(() => {
    applyTheme();
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
  });
  watch(
    () => route.path,
    () => applyTheme(),
    { flush: "post" },
  );
  onBeforeUnmount(() => media?.removeEventListener("change", applyTheme));
}

export const ThemeSync = defineComponent({
  name: "GaineThemeSync",
  setup() {
    useThemeSync();
    return () => null;
  },
});
