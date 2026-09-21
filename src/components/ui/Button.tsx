import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "transition-[transform,background-color,border-color,box-shadow] duration-200 " +
  "disabled:cursor-not-allowed disabled:opacity-55 active:translate-y-[1px] " +
  "text-center leading-tight";

const variants: Record<Variant, string> = {
  primary:
    "bg-electric-500 text-white shadow-[0_8px_24px_-12px_rgba(23,80,216,0.9)] " +
    "hover:bg-electric-600 focus-visible:bg-electric-600",
  secondary:
    "bg-white text-navy-900 border border-line-strong hover:border-charcoal-400 " +
    "shadow-[0_1px_2px_rgba(10,23,38,0.04)]",
  ghost: "bg-transparent text-navy-900 hover:bg-paper-200",
  inverse: "bg-paper-50 text-navy-900 hover:bg-white",
};

const sizes: Record<Size, string> = {
  // min-h keeps every target at or above 44px, including on 360px screens.
  md: "min-h-[44px] px-5 py-3 text-[0.95rem]",
  lg: "min-h-[52px] px-7 py-3.5 text-base sm:text-[1.05rem]",
};

function classes(variant: Variant, size: Size, fullWidth: boolean, extra?: string) {
  return [base, variants[variant], sizes[size], fullWidth ? "w-full" : "", extra ?? ""]
    .filter(Boolean)
    .join(" ");
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...rest
}: CommonProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button className={classes(variant, size, fullWidth, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  href,
  ...rest
}: CommonProps & { href: string } & Omit<ComponentPropsWithoutRef<"a">, "href">) {
  const isExternal = /^https?:/i.test(href);
  if (isExternal) {
    return (
      <a
        href={href}
        className={classes(variant, size, fullWidth, className)}
        rel="noopener noreferrer"
        target="_blank"
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes(variant, size, fullWidth, className)} {...rest}>
      {children}
    </Link>
  );
}
