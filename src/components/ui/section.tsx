import * as React from "react";
import { cn } from "@/lib/utils";

export type Surface = "light" | "tint" | "dark";

const surfaceClass: Record<Surface, string> = {
  light: "surface-light",
  tint: "surface-tint",
  dark: "surface-dark",
};

/**
 * A landing-page band.
 *
 * `surface` swaps the semantic tokens for everything inside, which is how the
 * page alternates light and dark without any component needing to know where
 * it sits.
 */
export function Section({
  id,
  surface = "light",
  eyebrow,
  heading,
  supporting,
  headingLevel = 2,
  className,
  children,
}: {
  id?: string;
  surface?: Surface;
  eyebrow?: string;
  heading?: string;
  supporting?: string;
  headingLevel?: 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      id={id}
      className={cn(
        surfaceClass[surface],
        "page-gutter scroll-mt-24 bg-background py-16 text-foreground sm:py-20 lg:py-28",
        className,
      )}
    >
      <div className="container-page">
        {eyebrow || heading || supporting ? (
          <header className="mb-10 max-w-2xl sm:mb-14">
            {eyebrow ? (
              <p
                className={cn(
                  "mb-3 text-eyebrow uppercase",
                  surface === "dark" ? "text-cyan-400" : "text-electric-600",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            {heading ? <Heading className="text-h1 text-balance">{heading}</Heading> : null}
            {supporting ? (
              <p className="mt-4 text-lead text-muted-foreground">{supporting}</p>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </section>
  );
}
