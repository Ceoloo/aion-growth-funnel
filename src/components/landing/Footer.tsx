import { brand, footer } from "@/content/site";
import { publicConfig } from "@/lib/public-config";
import { Wordmark } from "@/components/ui/Wordmark";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="aion-shell border-t border-white/10 bg-navy-950 py-10 text-paper-300 sm:py-12"
      style={{ paddingBottom: "max(2.5rem, var(--safe-bottom))" }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <Wordmark tone="light" />
          <p className="mt-4 text-[0.92rem] leading-relaxed">{footer.blurb}</p>
        </div>

        <div className="text-[0.9rem]">
          <p className="font-semibold text-paper-100">Get in touch</p>
          {publicConfig.contactEmail ? (
            <a
              href={`mailto:${publicConfig.contactEmail}`}
              className="aion-target mt-2 inline-flex items-center text-electric-400 underline underline-offset-4"
            >
              {publicConfig.contactEmail}
            </a>
          ) : (
            <p className="mt-2 text-paper-300">
              Start the assessment and we&rsquo;ll follow up from there.
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-6xl border-t border-white/10 pt-6 text-[0.82rem] text-charcoal-400">
        <p>
          &copy; {year} {brand.name}.
        </p>
      </div>
    </footer>
  );
}
