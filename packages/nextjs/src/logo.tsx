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
