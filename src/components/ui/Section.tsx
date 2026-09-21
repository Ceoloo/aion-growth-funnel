import type { ReactNode } from "react";

/** Standard landing-page section wrapper: consistent rhythm and max width. */
export function Section({
  id,
  eyebrow,
  heading,
  supporting,
  children,
  tone = "paper",
  headingLevel = 2,
}: {
  id?: string;
  eyebrow?: string;
  heading?: string;
  supporting?: string;
  children: ReactNode;
  tone?: "paper" | "white" | "navy";
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const surfaces = {
    paper: "bg-paper-100 text-navy-900",
    white: "bg-white text-navy-900",
    navy: "bg-navy-900 text-paper-100",
  } as const;

  return (
    <section
      id={id}
      className={`aion-shell scroll-mt-20 py-14 sm:py-20 lg:py-24 ${surfaces[tone]}`}
    >
      <div className="mx-auto w-full max-w-6xl">
        {eyebrow || heading || supporting ? (
          <div className="mb-8 max-w-2xl sm:mb-12">
            {eyebrow ? (
              <p
                className={`mb-3 text-[0.74rem] font-semibold tracking-[0.2em] uppercase ${
                  tone === "navy" ? "text-cyan-500" : "text-electric-600"
                }`}
              >
                {eyebrow}
              </p>
            ) : null}
            {heading ? (
              <Heading className="text-[1.75rem] leading-[1.15] font-semibold sm:text-[2.25rem] lg:text-[2.6rem]">
                {heading}
              </Heading>
            ) : null}
            {supporting ? (
              <p
                className={`mt-4 text-[1.02rem] leading-relaxed sm:text-[1.1rem] ${
                  tone === "navy" ? "text-paper-300" : "text-charcoal-500"
                }`}
              >
                {supporting}
              </p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
