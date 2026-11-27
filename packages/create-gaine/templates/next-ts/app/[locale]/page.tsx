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

import { notFound } from "next/navigation";
import { Badge, Button, Logo, SectionHeading, reveal } from "@gaine/nextjs/ui";
import { LanguageSwitcherLite, ThemeToggleLite } from "@gaine/nextjs/speed";
import { isLocale, localeLabels, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { siteName } from "@/site.config";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Logo
            href={`/${locale}`}
            label={t.homeLabel}
            mark={siteName.charAt(0).toUpperCase()}
            primary={siteName}
          />
          <div className="flex items-center gap-2">
            <LanguageSwitcherLite
              locale={locale}
              label={t.languageLabel}
              locales={locales}
              localeLabels={localeLabels}
            />
            <ThemeToggleLite label={t.themeLabel} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-24">
          <div {...reveal()}>
            <Badge>{t.badge}</Badge>
          </div>
          <h1
            className="mt-6 max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
            {...reveal(80)}
          >
            {t.heroTitle}
          </h1>
          <p
            className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
            {...reveal(160)}
          >
            {t.heroDescription}
          </p>
          <div className="mt-8" {...reveal(240)}>
            <Button variant="brand" size="lg" asChild>
              <a href="https://github.com/">{t.cta}</a>
            </Button>
          </div>
        </section>

        <section className="pb-24">
          <SectionHeading
            eyebrow={t.eyebrow}
            title={t.featuresTitle}
            description={t.featuresDescription}
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {t.features.map((feature, i) => (
              <li
                key={feature}
                className="rounded-lg border p-6 text-sm font-medium"
                {...reveal(i * 100)}
              >
                {feature}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
