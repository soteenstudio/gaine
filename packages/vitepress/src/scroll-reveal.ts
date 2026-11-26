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

import { defineComponent, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vitepress";

export function useScrollReveal() {
  const route = useRoute();
  let observer: IntersectionObserver | undefined;

  function run() {
    observer?.disconnect();
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    targets.forEach((el) => observer?.observe(el));
  }

  onMounted(run);
  watch(
    () => route.path,
    () => nextTick(run),
    { flush: "post" },
  );
  onBeforeUnmount(() => observer?.disconnect());
}

export const ScrollReveal = defineComponent({
  name: "GaineScrollReveal",
  setup() {
    useScrollReveal();
    return () => null;
  },
});
