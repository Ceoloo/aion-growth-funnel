import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text input.
 *
 * 48px tall and 16px text, so it is a comfortable target and iOS Safari never
 * zooms the viewport on focus. Invalid state is driven by `aria-invalid`, so
 * the visual and the accessible state cannot drift apart.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-[var(--tap-min)] w-full min-w-0 rounded-md border border-input bg-card px-4 py-3",
        "text-[1rem] text-foreground shadow-subtle outline-none",
        "transition-[color,border-color,box-shadow] duration-[var(--duration-feedback)]",
        "placeholder:text-muted-foreground/80",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
