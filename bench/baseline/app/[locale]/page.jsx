import { notFound } from "next/navigation";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import Reveal from "../../components/Reveal";
import ThemeToggle from "../../components/ThemeToggle";
import { isLocale } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { siteName } from "../../site.config";

export default async function Page({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <a href={`/${locale}`} aria-label={t.homeLabel} className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
              {siteName.charAt(0).toUpperCase()}
            </span>
            {siteName}
          </a>
          <div className="flex items-center gap-2">
            <LanguageSwitcher locale={locale} label={t.languageLabel} />
            <ThemeToggle label={t.themeLabel} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-24">
          <Reveal>
            <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">{t.badge}</span>
          </Reveal>
          <Reveal as="h1" delay={80} className="mt-6 max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {t.heroTitle}
          </Reveal>
          <Reveal as="p" delay={160} className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {t.heroDescription}
          </Reveal>
          <Reveal delay={240} className="mt-8">
            <a href="https://github.com/" className="inline-flex h-12 items-center rounded-md bg-brand px-6 font-medium text-brand-foreground">
              {t.cta}
            </a>
          </Reveal>
        </section>

        <section className="pb-24">
          <Reveal>
            <p className="text-sm font-medium text-brand">{t.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t.featuresTitle}</h2>
            <p className="mt-3 text-muted-foreground">{t.featuresDescription}</p>
          </Reveal>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {t.features.map((feature, i) => (
              <Reveal as="li" key={feature} delay={i * 100} className="rounded-lg border p-6 text-sm font-medium">
                {feature}
              </Reveal>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
