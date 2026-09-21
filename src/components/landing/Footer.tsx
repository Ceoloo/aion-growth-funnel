import { brand, footer } from "@/content/site";
import { Wordmark } from "@/components/ui/Wordmark";

export function Footer({ contactEmail }: { contactEmail?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="surface-dark page-gutter border-t border-border bg-navy-950 py-12 text-foreground">
      <div className="container-page flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <Wordmark tone="light" />
          <p className="mt-4 text-small text-muted-foreground">{footer.blurb}</p>
        </div>

        <div>
          <p className="text-small font-semibold text-foreground">Get in touch</p>
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              className="mt-2 inline-flex min-h-[var(--tap-min)] items-center text-small text-primary underline underline-offset-4"
            >
              {contactEmail}
            </a>
          ) : (
            <p className="mt-2 text-small text-muted-foreground">
              Start the assessment and we&rsquo;ll follow up from there.
            </p>
          )}
        </div>
      </div>

      <div className="container-page mt-10 border-t border-border pt-6 text-small text-muted-foreground">
        <p>
          &copy; {year} {brand.name}.
        </p>
      </div>
    </footer>
  );
}
