import { howItWorks } from "@/content/site";
import { Section } from "@/components/ui/section";

export function HowItWorks() {
  return (
    <Section surface="light" eyebrow={howItWorks.eyebrow} heading={howItWorks.heading}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {howItWorks.steps.map((step, index) => (
          <li key={step.name} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <span
              aria-hidden="true"
              className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-[0.85rem] font-bold text-accent-foreground"
            >
              {index + 1}
            </span>
            <h3 className="mt-4 text-h3 text-card-foreground">{step.name}</h3>
            <p className="mt-2 text-small text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 border-t border-border pt-6 text-small text-muted-foreground">
        {howItWorks.scopeNote}
      </p>
    </Section>
  );
}
