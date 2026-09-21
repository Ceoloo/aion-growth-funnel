import { Suspense } from "react";
import type { Metadata } from "next";
import { AssessmentFlow } from "@/components/funnel/AssessmentFlow";
import { MotionProvider } from "@/components/ui/motion";

export const metadata: Metadata = {
  title: "Growth assessment",
  description:
    "Seven short questions. You'll see a suggested starting point before we ask for any contact details.",
  alternates: { canonical: "/assessment" },
  // The funnel is a tool, not a page we want indexed as content.
  robots: { index: false, follow: true },
};

function Fallback() {
  return (
    <div
      className="surface-light flex items-center justify-center bg-background"
      style={{ minHeight: "var(--app-height)" }}
    >
      <p className="text-small text-muted-foreground">Loading your assessment…</p>
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <MotionProvider>
      <Suspense fallback={<Fallback />}>
        <AssessmentFlow />
      </Suspense>
    </MotionProvider>
  );
}
