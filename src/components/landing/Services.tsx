import { landingServices, productionPartnerNote } from "@/content/services";
import { servicesSection } from "@/content/site";
import { Section } from "@/components/ui/Section";

export function Services() {
  return (
    <Section
      id={servicesSection.id}
      tone="white"
      eyebrow={servicesSection.eyebrow}
      heading={servicesSection.heading}
      supporting={servicesSection.supporting}
    >
      <ul className="grid gap-4 lg:grid-cols-3">
        {landingServices.map((service) => (
          <li
            key={service.id}
            className="flex flex-col rounded-2xl border border-line bg-paper-50 p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[1.15rem] leading-snug font-semibold text-navy-900">
                {service.name}
              </h3>
              {service.optional ? (
                <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-100/50 px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide text-navy-800 uppercase">
                  Optional
                </span>
              ) : null}
            </div>

            <p className="mt-2.5 text-[0.95rem] leading-relaxed text-charcoal-500">
              {service.summary}
            </p>

            <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
              {service.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-[0.91rem] leading-relaxed text-charcoal-700">
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className="mt-[0.3em] h-3.5 w-3.5 shrink-0 text-electric-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5l3 3 7-8" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-6 rounded-2xl border border-line bg-paper-100 p-4 text-[0.9rem] leading-relaxed text-charcoal-500 sm:p-5">
        {productionPartnerNote}
      </p>
    </Section>
  );
}
