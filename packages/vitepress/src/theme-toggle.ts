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

import { defineComponent, h } from "vue";
import { toggleTheme } from "@gaine/core";
import { MoonIcon, SunIcon } from "./icons.js";

export const ThemeToggle = defineComponent({
  name: "GaineThemeToggle",
  props: { label: { type: String, required: true } },
  setup(props) {
    return () =>
      h(
        "button",
        {
          type: "button",
          onClick: toggleTheme,
          "aria-label": props.label,
          title: props.label,
          class:
            "inline-flex size-9 items-center justify-center rounded-full border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        },
        [SunIcon("hidden size-4 dark:block"), MoonIcon("size-4 dark:hidden")],
      );
  },
});
