import { brand } from "@/content/site";

/**
 * AION Systems wordmark.
 *
 * Original type-led mark: the "O" is replaced by a ring with a single
 * connecting node, a plain reference to linking one stage to the next. No
 * third-party assets are used.
 */
export function Wordmark({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const primary = tone === "light" ? "text-paper-50" : "text-navy-900";
  const secondary = tone === "light" ? "text-paper-300" : "text-charcoal-400";
  const ring = tone === "light" ? "#e6e0d4" : "#0a1726";

  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span
        className={`inline-flex items-baseline text-[1.35rem] font-semibold tracking-[0.18em] ${primary}`}
      >
        <span>AI</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="mx-[0.06em] h-[0.72em] w-[0.72em] translate-y-[0.02em]"
        >
          <circle cx="12" cy="12" r="8.5" fill="none" stroke={ring} strokeWidth="3" />
          <circle cx="20.5" cy="12" r="3" fill="var(--color-electric-500)" />
        </svg>
        <span>N</span>
      </span>
      <span className={`text-[0.66rem] font-medium tracking-[0.34em] ${secondary}`}>
        {brand.wordmark.secondary}
      </span>
    </span>
  );
}
