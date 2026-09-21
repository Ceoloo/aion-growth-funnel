import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/Wordmark";

export default function NotFound() {
  return (
    <main
      className="surface-light page-gutter flex flex-col items-center justify-center bg-background text-center"
      style={{ minHeight: "var(--app-height)" }}
    >
      <Wordmark />
      <h1 className="mt-8 text-h1 text-foreground">
        That page doesn&rsquo;t exist.
      </h1>
      <p className="mt-3 max-w-md text-lead text-muted-foreground">
        The link may be out of date. You can head back to the homepage or start the growth
        assessment.
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:flex-row">
        <Button asChild variant="secondary" size="action" full className="sm:w-auto">
          <Link href="/">Back to the homepage</Link>
        </Button>
        <Button asChild size="action" full className="sm:w-auto">
          <Link href="/assessment">Find My Growth Plan</Link>
        </Button>
      </div>
    </main>
  );
}
