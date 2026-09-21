import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqItems, faqSection } from "@/content/faq";
import { Section, type Surface } from "@/components/ui/section";

/**
 * FAQ on the Radix accordion: keyboard operable, correct ARIA, and no hover
 * dependency. `type="multiple"` lets someone keep several answers open while
 * comparing them.
 */
export function Faq({ surface = "tint" }: { surface?: Surface }) {
  return (
    <Section surface={surface} eyebrow={faqSection.eyebrow} heading={faqSection.heading}>
      <Accordion
        type="multiple"
        className="max-w-3xl divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
      >
        {faqItems.map((item, index) => (
          <AccordionItem
            key={item.question}
            value={`faq-${index}`}
            className="border-b-0 px-5 sm:px-6"
          >
            <AccordionTrigger className="min-h-[var(--tap-min)] py-4 text-left text-h3 text-card-foreground hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-body text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}
