import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AION button.
 *
 * Sizing is thumb-first rather than desktop-first: the default size already
 * clears the 48px minimum target, and `action` is the 52px primary used in
 * bottom action areas. Every variant carries explicit hover, focus, active,
 * disabled and loading treatments.
 *
 * Colours come from the semantic tokens, so the same button is correct on a
 * warm-white section and inside `.surface-dark` with no extra classes.
 */
const buttonVariants = cva(
  [
    "press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-pill font-semibold outline-none select-none",
    "focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.1em]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-action hover:bg-electric-600 active:bg-electric-700",
        secondary:
          "border border-border bg-card text-foreground shadow-subtle hover:border-charcoal-400 active:bg-secondary",
        ghost: "text-foreground hover:bg-secondary active:bg-muted",
        quiet:
          "text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-danger-600 focus-visible:ring-destructive/40",
        link: "rounded-xs text-primary underline underline-offset-4 hover:text-electric-600",
      },
      size: {
        /* 52px — the primary action in a bottom action area. */
        action: "min-h-[var(--action-min)] px-7 text-[1.0625rem]",
        /* 48px — the minimum interactive target anywhere else. */
        default: "min-h-[var(--tap-min)] px-5 text-[1rem]",
        /* Still 48px tall; only the horizontal padding tightens. */
        compact: "min-h-[var(--tap-min)] px-4 text-[0.9375rem]",
        icon: "size-[var(--tap-min)] rounded-pill px-0",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "default", full: false },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner, disables the button and announces the busy state. */
  loading?: boolean;
  loadingLabel?: string;
}

function Button({
  className,
  variant,
  size,
  full,
  asChild = false,
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, full }), className)}
      {...props}
    >
      {loading ? (
        <>
          {/* The spinner is decorative; the label carries the state. */}
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
