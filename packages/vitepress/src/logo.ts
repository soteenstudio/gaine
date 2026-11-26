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
