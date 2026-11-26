import {
  gaineRuntimeScript,
  hintAttrs,
  renderLanguageMenu,
  renderThemeToggle,
  speculationRulesJson,
  type ResourceHint,
  type RuntimeOptions,
  type SpeculationOptions,
} from "@gaine/core/speed";

export type { ResourceHint, RuntimeOptions, SpeculationOptions };

export interface GaineHeadProps {
  hints?: readonly ResourceHint[];
  speculation?: boolean | SpeculationOptions;
}

function linkProps(hint: ResourceHint) {
  const a = hintAttrs(hint);
  return {
    rel: a.rel,
    href: a.href,
    as: a.as,
    type: a.type,
    crossOrigin: a.crossorigin === undefined ? undefined : ((a.crossorigin || "anonymous") as "anonymous" | "use-credentials"),
    fetchPriority: a.fetchpriority as "high" | "low" | "auto" | undefined,
    media: a.media,
  };
}

export function GaineHead({ hints = [], speculation }: GaineHeadProps) {
  const rules = speculation ? speculationRulesJson(speculation === true ? {} : speculation) : null;
  return (
    <>
      {hints.map((hint) => (
        <link key={`${hint.rel}:${hint.href}`} {...linkProps(hint)} />
      ))}
      {rules ? <script type="speculationrules" dangerouslySetInnerHTML={{ __html: rules }} /> : null}
    </>
  );
}

export function GaineRuntime(props: RuntimeOptions) {
  const script = gaineRuntimeScript(props);
  return script ? <script dangerouslySetInnerHTML={{ __html: script }} /> : null;
}

const contents = { display: "contents" } as const;

export function ThemeToggleLite({ label }: { label: string }) {
  return <div style={contents} dangerouslySetInnerHTML={{ __html: renderThemeToggle(label) }} />;
}

export interface LanguageSwitcherLiteProps<L extends string> {
  locale: L;
  label: string;
  locales: readonly L[];
  localeLabels: Record<L, string>;
  base?: string;
  trailingSlash?: boolean;
  path?: string;
}

export function LanguageSwitcherLite<L extends string>({
  localeLabels,
  ...rest
}: LanguageSwitcherLiteProps<L>) {
  return (
    <div
      style={contents}
      dangerouslySetInnerHTML={{ __html: renderLanguageMenu({ ...rest, labels: localeLabels }) }}
    />
  );
}
