import { X } from "lucide-react";
import { painPoints } from "@/content/site";
import { Section } from "@/components/ui/section";

export function PainPoints() {
  return (
    <Section surface="light" eyebrow={painPoints.eyebrow} heading={painPoints.heading}>
      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {painPoints.items.map((item) => (
          <li key={item.title} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
              >
                <X className="size-3.5" />
              </span>
              <div>
                <p className="text-h3 leading-snug text-card-foreground">{item.title}</p>
                <p className="mt-2 text-small text-muted-foreground">{item.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
