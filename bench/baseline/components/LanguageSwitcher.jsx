"use client";
import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { localeLabels, locales } from "../i18n/config";

export default function LanguageSwitcher({ locale, label }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || `/${locale}`;
  const rest = pathname.replace(new RegExp(`^/${locale}`), "");
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
      >
        <Languages size={16} />
        {locale.toUpperCase()}
      </button>
      {open && (
        <ul className="absolute right-0 z-10 mt-2 min-w-40 rounded-md border bg-background p-1 shadow">
          {locales.map((l) => (
            <li key={l}>
              <Link
                href={`/${l}${rest}`}
                onClick={() => setOpen(false)}
                className="block rounded px-3 py-2 text-sm hover:bg-muted"
              >
                {localeLabels[l]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
