import { painPoints } from "@/content/site";
import { Section } from "@/components/ui/Section";

export function PainPoints() {
  return (
    <Section eyebrow={painPoints.eyebrow} heading={painPoints.heading}>
      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {painPoints.items.map((item) => (
          <li
            key={item.title}
            className="rounded-2xl border border-line bg-white p-5 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-charcoal-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </span>
              <div>
                <p className="text-[1rem] leading-snug font-semibold text-navy-900">{item.title}</p>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-charcoal-500">{item.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
