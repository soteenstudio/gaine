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

export type RevealVariant = "up" | "left" | "right" | "scale" | "fade";

export function reveal(delay = 0, variant: RevealVariant = "up") {
  return {
    "data-reveal": variant,
    style: { "--reveal-delay": `${delay}ms` } as Record<string, string>,
  };
}

export const revealInitScript = `(function(){var t=document.querySelectorAll("[data-reveal]:not(.is-visible)"),i;if(!("IntersectionObserver" in window)){for(i=0;i<t.length;i++)t[i].classList.add("is-visible");return}var o=new IntersectionObserver(function(e){for(var j=0;j<e.length;j++){if(!e[j].isIntersecting)continue;e[j].target.classList.add("is-visible");o.unobserve(e[j].target)}},{threshold:0.12,rootMargin:"0px 0px -6% 0px"});for(i=0;i<t.length;i++)o.observe(t[i])})();`;
