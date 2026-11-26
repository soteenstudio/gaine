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

import { defineComponent, h, type PropType } from "vue";
import { withBase } from "vitepress";
import { cn } from "@gaine/core";

export interface LogoProps {
  href: string;
  label: string;
  mark: string;
  primary: string;
  secondary?: string;
  product?: string;
}

export const Logo = defineComponent({
  name: "GaineLogo",
  inheritAttrs: false,
  props: {
    href: { type: String, required: true },
    label: { type: String, required: true },
    mark: { type: String, required: true },
    primary: { type: String, required: true },
    secondary: String as PropType<string | undefined>,
    product: String as PropType<string | undefined>,
  },
  setup(props, { attrs }) {
    return () =>
      h(
        "a",
        {
          ...attrs,
          href: withBase(props.href),
          "aria-label": props.label,
          class: cn(
            "group inline-flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight no-underline text-foreground",
            attrs.class as Parameters<typeof cn>[0],
          ),
        },
        [
          h(
            "span",
            {
              "aria-hidden": "true",
              class:
                "grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-transform duration-300 group-hover:-rotate-6",
            },
            props.mark,
          ),
          props.primary,
          props.secondary
            ? h("span", { class: "font-normal text-muted-foreground" }, props.secondary)
            : null,
          props.product
            ? [
                h("span", { "aria-hidden": "true", class: "hidden h-5 w-px bg-border sm:block" }),
                h(
                  "span",
                  { class: "hidden text-base font-medium text-muted-foreground sm:block" },
                  props.product,
                ),
              ]
            : null,
        ],
      );
  },
});
