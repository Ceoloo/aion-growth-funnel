import { Suspense } from "react";
import type { Metadata } from "next";
import { AssessmentFlow } from "@/components/funnel/AssessmentFlow";

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
      className="flex items-center justify-center bg-paper-100"
      style={{ minHeight: "var(--app-height)" }}
    >
      <p className="text-[0.95rem] text-charcoal-400">Loading your assessment…</p>
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <AssessmentFlow />
    </Suspense>
  );
}
