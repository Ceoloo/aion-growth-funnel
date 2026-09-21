import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { describeConfiguration } from "@/lib/ghl/config";
import { getStore } from "@/lib/store";
import { StoreNotConfiguredError } from "@/lib/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator-facing readiness check.
 *
 * Reports what is configured and what is missing, by variable name only.
 * No secret values are echoed — only whether each one is present.
 */
export async function GET() {
  const integration = describeConfiguration();

  let storage: { ready: boolean; driver: string | null; error: string | null };
  try {
    const store = await getStore();
    storage = { ready: true, driver: store.driver, error: null };
  } catch (error) {
    storage = {
      ready: false,
      driver: null,
      error:
        error instanceof StoreNotConfiguredError
          ? error.message
          : "Durable store could not be initialised.",
    };
  }

  const ready = storage.ready && integration.ready;

  return NextResponse.json(
    {
      ok: ready,
      acceptingLeads: storage.ready,
      storage,
      integration: {
        provider: "gohighlevel",
        mode: integration.mode,
        ready: integration.ready,
        missing: integration.missing,
        warnings: integration.warnings,
      },
      worker: { enabled: Boolean(serverEnv.workerSecret) },
      booking: { configured: Boolean(serverEnv.bookingUrl) },
      contactFallback: { configured: Boolean(serverEnv.contactEmail) },
    },
    { status: ready ? 200 : 503 },
  );
}
