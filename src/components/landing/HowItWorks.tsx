import { howItWorks } from "@/content/site";
import { Section } from "@/components/ui/Section";

export function HowItWorks() {
  return (
    <Section tone="navy" eyebrow={howItWorks.eyebrow} heading={howItWorks.heading}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {howItWorks.steps.map((step, index) => (
          <li
            key={step.name}
            className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 sm:p-6"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-[0.85rem] font-bold text-cyan-500"
            >
              {index + 1}
            </span>
            <h3 className="mt-4 text-[1.1rem] font-semibold text-paper-50">{step.name}</h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-paper-300">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 border-t border-white/12 pt-6 text-[0.92rem] leading-relaxed text-paper-300">
        {howItWorks.scopeNote}
      </p>
    </Section>
  );
}
