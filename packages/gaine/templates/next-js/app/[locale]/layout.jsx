import { notFound } from "next/navigation";
import "../globals.css";
import "@gaine/core/reveal.css";
import "@gaine/core/speed.css";
import { themeInitScript } from "@gaine/core";
import { GaineRuntime } from "@gaine/nextjs/speed";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { siteName } from "@/site.config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: { default: siteName, template: `%s | ${siteName}` }, description: t.metaDescription };
}

export default async function RootLayout({ children, params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <GaineRuntime menu locales={locales} />
      </body>
    </html>
  );
}
