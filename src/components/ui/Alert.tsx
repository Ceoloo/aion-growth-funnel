import type { ReactNode } from "react";

type Tone = "error" | "info" | "success" | "warning";

const tones: Record<Tone, { wrap: string; title: string; icon: string }> = {
  error: {
    wrap: "border-red-200 bg-red-50",
    title: "text-red-900",
    icon: "text-red-600",
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50",
    title: "text-amber-900",
    icon: "text-amber-600",
  },
  info: {
    wrap: "border-line bg-paper-50",
    title: "text-navy-900",
    icon: "text-electric-500",
  },
  success: {
    wrap: "border-cyan-100 bg-cyan-100/40",
    title: "text-navy-900",
    icon: "text-cyan-500",
  },
};

const paths: Record<Tone, string> = {
  error: "M12 8v5m0 3h.01M10.3 3.9 2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z",
  warning:
    "M12 8v5m0 3h.01M10.3 3.9 2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 16v-5m0-3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  success: "M8 12.5l2.5 2.5L16 9m5 3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

/**
 * Error, warning and confirmation states.
 *
 * `role="alert"` is applied to errors only, so an assistive technology
 * announces a failure immediately without also interrupting for routine
 * confirmations.
 */
export function Alert({
  tone = "info",
  title,
  children,
  actions,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const style = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border p-4 sm:p-5 ${style.wrap}`}
    >
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={paths[tone]} />
        </svg>
        <div className="min-w-0 flex-1">
          <p className={`text-[0.98rem] font-semibold ${style.title}`}>{title}</p>
          {children ? (
            <div className="mt-1.5 space-y-2 text-[0.92rem] leading-relaxed text-charcoal-700">
              {children}
            </div>
          ) : null}
          {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
