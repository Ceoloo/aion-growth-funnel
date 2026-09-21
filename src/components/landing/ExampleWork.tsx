import { ArrowRight } from "lucide-react";
import { exampleWork } from "@/content/site";
import { Section } from "@/components/ui/section";

/**
 * Illustrative workflows and deliverables.
 *
 * This exists because we have no client proof to show yet, and showing nothing
 * leaves a visitor guessing what they would actually receive. Every card is
 * explicitly labelled an example — there are no testimonials, no client logos,
 * no metrics and no stock photography passed off as project work. Replace with
 * real, permitted examples when they exist.
 */
export function ExampleWork() {
  return (
    <Section
      surface="tint"
      eyebrow={exampleWork.eyebrow}
      heading={exampleWork.heading}
      supporting={exampleWork.supporting}
    >
      <ul className="grid gap-4 lg:grid-cols-3">
        {exampleWork.items.map((item) => (
          <li
            key={item.title}
            className="flex flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
          >
            <span className="w-fit rounded-pill bg-accent px-2.5 py-1 text-eyebrow uppercase text-accent-foreground">
              Example {item.kind}
            </span>
            <h3 className="mt-3.5 text-h3 leading-snug text-card-foreground">{item.title}</h3>
            <p className="mt-2 text-small text-muted-foreground">{item.body}</p>

            <ol className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-border pt-5">
              {item.steps.map((step, index) => (
                <li key={step} className="flex items-center gap-1.5">
                  <span className="rounded-pill bg-secondary px-2.5 py-1 text-[0.8rem] font-medium text-secondary-foreground">
                    {step}
                  </span>
                  {index < item.steps.length - 1 ? (
                    <ArrowRight aria-hidden="true" className="size-3 text-muted-foreground" />
                  ) : null}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-small text-muted-foreground">{exampleWork.disclaimer}</p>
    </Section>
  );
}
