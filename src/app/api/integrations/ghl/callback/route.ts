import { NextResponse, type NextRequest } from "next/server";
import {
  callbackEventSchema,
  isForwardTransition,
  verifyCallback,
  type StageKey,
} from "@/lib/ghl/callback";
import { logger } from "@/lib/logger";
import { getStore } from "@/lib/store";
import { StoreNotConfiguredError } from "@/lib/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound events from GoHighLevel.
 *
 * Deliberately separate from `/api/leads`: that endpoint is public and
 * unauthenticated by design, this one rejects anything it cannot authenticate.
 * The two mechanisms (marketplace Ed25519 signature, workflow shared secret)
 * are checked independently — see `src/lib/ghl/callback.ts`.
 *
 * Events are deduplicated by `eventId` against durable storage, so a redelivery
 * is acknowledged without being applied twice, and a stage is only ever moved
 * forward.
 */

const MAX_BODY_BYTES = 64_000;

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, code: "payload_too_large" }, { status: 413 });
  }

  const verification = verifyCallback(request.headers, raw);
  if (!verification.ok) {
    logger.warn("ghl.callback_rejected", { reason: verification.reason });
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json" }, { status: 400 });
  }

  const parsed = callbackEventSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("ghl.callback_schema_invalid", {
      mechanism: verification.mechanism,
      issues: parsed.error.issues.map((i) => i.path.join(".")),
    });
    return NextResponse.json({ ok: false, code: "invalid_event" }, { status: 400 });
  }
  const event = parsed.data;

  let store;
  try {
    store = await getStore();
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) {
      return NextResponse.json(
        { ok: false, code: "not_configured", message: error.message },
        { status: 503 },
      );
    }
    // Retryable: ask the sender to redeliver rather than silently dropping.
    return NextResponse.json({ ok: false, code: "storage_unavailable" }, { status: 503 });
  }

  const fresh = await store.markCallbackSeen(event.eventId, new Date());
  if (!fresh) {
    logger.info("ghl.callback_duplicate", { eventId: event.eventId });
    return NextResponse.json({ ok: true, deduplicated: true }, { status: 200 });
  }

  // A booking is the one event allowed to advance the opportunity stage, and
  // only when the calendar provider reports it as actually booked. A click on
  // the booking link never reaches here and never counts.
  let stageTransition: { to: StageKey; applied: boolean } | null = null;
  if (event.eventType === "AppointmentCreate" || event.eventType === "aion.appointment.booked") {
    const confirmed =
      event.appointment !== undefined &&
      ["booked", "confirmed", "showed"].includes(
        (event.appointment.status ?? "booked").toLowerCase(),
      );
    if (confirmed) {
      // Stage history is not tracked locally yet, so `from` is unknown and the
      // guard is conservative: the transition is recorded, not pushed back
      // into GoHighLevel, until an authenticated stage read is wired up.
      stageTransition = {
        to: "strategy-call-booked",
        applied: isForwardTransition(null, "strategy-call-booked"),
      };
    }
  }

  logger.info("ghl.callback_accepted", {
    eventId: event.eventId,
    eventType: event.eventType,
    mechanism: verification.mechanism,
    stageTransition: stageTransition?.to ?? null,
  });

  // 202: the event was accepted. It does not assert that every downstream
  // action has finished.
  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      eventId: event.eventId,
      mechanism: verification.mechanism,
      stageTransition,
    },
    { status: 202 },
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, code: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
