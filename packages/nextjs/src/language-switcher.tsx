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

"use client";

import { Check, Globe } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.js";

export interface LanguageSwitcherProps<L extends string> {
  locale: L;
  label: string;
  locales: readonly L[];
  localeLabels: Record<L, string>;
}

export function LanguageSwitcher<L extends string>({
  locale,
  label,
  locales,
  localeLabels,
}: LanguageSwitcherProps<L>) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(target: L) {
    if (target === locale) return;
    const segments = pathname.split("/");
    segments[1] = target;
    router.push(`${segments.join("/")}${window.location.hash}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent"
      >
        <Globe className="size-3.5" />
        {locale}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => switchTo(l)}
            className="flex-row items-center justify-between"
          >
            {localeLabels[l]}
            {l === locale ? <Check className="size-4 text-brand" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
