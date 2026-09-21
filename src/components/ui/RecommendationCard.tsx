import { services } from "@/content/services";
import type { Recommendation } from "@/lib/recommendation";

/**
 * The suggested starting point.
 *
 * Everything shown here is traceable to an answer or to a fixed service
 * definition. There is no score, no forecast and no claim about results.
 */
export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const production = services["content-production"];

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-card)]">
      <div className="border-b border-line bg-navy-900 px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-cyan-500 uppercase">
          Suggested starting point
        </p>
        <h2 className="mt-2 text-[1.35rem] leading-tight font-semibold text-paper-50 sm:text-[1.65rem]">
          {recommendation.service.name}
        </h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-paper-300">
          {recommendation.service.summary}
        </p>
        {recommendation.productionIsAddOn ? (
          <p className="mt-3.5 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-[0.84rem] font-medium text-paper-100">
            <span aria-hidden="true">+</span>
            <span>{production.name}</span>
            <span className="text-paper-300">— optional add-on</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7 sm:py-7">
        <section>
          <h3 className="text-[0.74rem] font-semibold tracking-[0.18em] text-charcoal-400 uppercase">
            Why this matches your answers
          </h3>
          <ul className="mt-3 space-y-2.5">
            {recommendation.reasons.map((reason) => (
              <li key={reason} className="flex gap-3 text-[0.95rem] leading-relaxed text-charcoal-700">
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-electric-500"
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-[0.74rem] font-semibold tracking-[0.18em] text-charcoal-400 uppercase">
            Three priorities we&rsquo;d start with
          </h3>
          <ol className="mt-3 space-y-3">
            {recommendation.priorities.map((priority, index) => (
              <li key={priority} className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-electric-100 text-[0.82rem] font-bold text-electric-600"
                >
                  {index + 1}
                </span>
                <span className="pt-0.5 text-[0.95rem] leading-relaxed text-charcoal-700">
                  {priority}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-line bg-paper-50 p-4 sm:p-5">
          <h3 className="text-[0.74rem] font-semibold tracking-[0.18em] text-charcoal-400 uppercase">
            What you said you want
          </h3>
          <p className="mt-2 text-[1.05rem] font-semibold text-navy-900">
            {recommendation.goalLabel}
          </p>
        </section>

        <p className="border-t border-line pt-5 text-[0.88rem] leading-relaxed text-charcoal-500">
          {recommendation.scopeNote}
        </p>
      </div>
    </article>
  );
}
