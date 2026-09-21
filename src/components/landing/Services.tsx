import { Check } from "lucide-react";
import { landingServices, productionPartnerNote } from "@/content/services";
import { servicesSection } from "@/content/site";
import { Section } from "@/components/ui/section";

export function Services() {
  return (
    <Section
      id={servicesSection.id}
      surface="dark"
      eyebrow={servicesSection.eyebrow}
      heading={servicesSection.heading}
      supporting={servicesSection.supporting}
    >
      <ul className="grid gap-4 lg:grid-cols-3">
        {landingServices.map((service) => (
          <li
            key={service.id}
            className="flex flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-h3 leading-snug text-card-foreground">{service.name}</h3>
              {service.optional ? (
                <span className="shrink-0 rounded-pill border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-eyebrow uppercase text-cyan-400">
                  Optional
                </span>
              ) : null}
            </div>

            <p className="mt-2.5 text-small text-muted-foreground">{service.summary}</p>

            <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
              {service.includes.map((item) => (
                <li key={item} className="flex gap-2.5 text-small text-card-foreground">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-6 rounded-xl border border-border bg-secondary/60 p-4 text-small text-muted-foreground sm:p-5">
        {productionPartnerNote}
      </p>
    </Section>
  );
}
