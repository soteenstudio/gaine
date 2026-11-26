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

import { h, type VNode } from "vue";

function icon(className: string, children: VNode[]): VNode {
  return h(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      class: className,
    },
    children,
  );
}

const path = (d: string) => h("path", { d });

export const SunIcon = (className: string) =>
  icon(className, [
    h("circle", { cx: 12, cy: 12, r: 4 }),
    path("M12 2v2"),
    path("M12 20v2"),
    path("m4.93 4.93 1.41 1.41"),
    path("m17.66 17.66 1.41 1.41"),
    path("M2 12h2"),
    path("M20 12h2"),
    path("m6.34 17.66-1.41 1.41"),
    path("m19.07 4.93-1.41 1.41"),
  ]);

export const MoonIcon = (className: string) =>
  icon(className, [path("M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z")]);

export const GlobeIcon = (className: string) =>
  icon(className, [
    h("circle", { cx: 12, cy: 12, r: 10 }),
    path("M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"),
    path("M2 12h20"),
  ]);

export const CheckIcon = (className: string) => icon(className, [path("M20 6 9 17l-5-5")]);
