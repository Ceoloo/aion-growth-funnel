import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "error" | "warning" | "info" | "success";

const tones: Record<Tone, { wrap: string; icon: string; Icon: typeof Info }> = {
  error: {
    wrap: "border-danger-500/35 bg-danger-100",
    icon: "text-danger-600",
    Icon: XCircle,
  },
  warning: {
    wrap: "border-warning-600/30 bg-warning-100",
    icon: "text-warning-600",
    Icon: AlertTriangle,
  },
  info: { wrap: "border-border bg-muted/60", icon: "text-primary", Icon: Info },
  success: {
    wrap: "border-success-600/30 bg-success-100",
    icon: "text-success-600",
    Icon: CheckCircle2,
  },
};

/**
 * Error, warning and confirmation states.
 *
 * Errors use `role="alert"` so a failure is announced immediately; everything
 * else uses `role="status"`, which is polite and does not interrupt.
 */
export function Alert({
  tone = "info",
  title,
  children,
  actions,
  className,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const { wrap, icon, Icon } = tones[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-xl border p-4 text-charcoal-900 sm:p-5", wrap, className)}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", icon)} />
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-semibold">{title}</p>
          {children ? (
            <div className="mt-1.5 space-y-2 text-small text-charcoal-700">{children}</div>
          ) : null}
          {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
