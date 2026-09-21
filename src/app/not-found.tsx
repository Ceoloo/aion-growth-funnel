import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";

export default function NotFound() {
  return (
    <main
      className="aion-shell flex flex-col items-center justify-center bg-paper-100 text-center"
      style={{ minHeight: "var(--app-height)" }}
    >
      <Wordmark />
      <h1 className="mt-8 text-[1.75rem] font-semibold text-navy-900 sm:text-[2.25rem]">
        That page doesn&rsquo;t exist.
      </h1>
      <p className="mt-3 max-w-md text-[1rem] leading-relaxed text-charcoal-500">
        The link may be out of date. You can head back to the homepage or start the growth
        assessment.
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-line-strong bg-white px-6 text-[0.98rem] font-semibold text-navy-900"
        >
          Back to the homepage
        </Link>
        <Link
          href="/assessment"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-electric-500 px-6 text-[0.98rem] font-semibold text-white"
        >
          Find My Growth Plan
        </Link>
      </div>
    </main>
  );
}
