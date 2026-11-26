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

import Link from "next/link";
import { cn } from "@gaine/core";

export interface LogoProps {
  href: string;
  label: string;
  mark: string;
  primary: string;
  secondary?: string;
  product?: string;
  className?: string;
}

export function Logo({ href, label, mark, primary, secondary, product, className }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group inline-flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-transform duration-300 group-hover:-rotate-6"
      >
        {mark}
      </span>
      {primary}
      {secondary ? <span className="font-normal text-muted-foreground">{secondary}</span> : null}
      {product ? (
        <>
          <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden text-base font-medium text-muted-foreground sm:block">
            {product}
          </span>
        </>
      ) : null}
    </Link>
  );
}
