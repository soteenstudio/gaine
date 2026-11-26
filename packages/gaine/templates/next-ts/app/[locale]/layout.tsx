import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import "@gaine/core/reveal.css";
import { themeInitScript } from "@gaine/core";
import { ScrollReveal, ThemeSync } from "@gaine/nextjs";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { siteName } from "@/site.config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: { default: siteName, template: `%s | ${siteName}` }, description: t.metaDescription };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ThemeSync />
        <ScrollReveal />
      </body>
    </html>
  );
}
