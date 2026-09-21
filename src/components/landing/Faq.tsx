import { faqItems, faqSection } from "@/content/faq";
import { Section } from "@/components/ui/Section";

/**
 * FAQ built on native <details>. It works without JavaScript, is keyboard
 * operable by default, and needs no hover.
 */
export function Faq() {
  return (
    <Section eyebrow={faqSection.eyebrow} heading={faqSection.heading}>
      <div className="max-w-3xl divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {faqItems.map((item) => (
          <details key={item.question} className="group">
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[1rem] font-semibold text-navy-900 marker:content-none sm:px-6">
              <span>{item.question}</span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-charcoal-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="px-5 pb-5 text-[0.95rem] leading-relaxed text-charcoal-500 sm:px-6">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}
