import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processDueSubmissions } from "@/lib/delivery/runner";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { StoreNotConfiguredError } from "@/lib/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Outbox worker.
 *
 * Call this on a schedule — a platform cron (Vercel Cron, Cloud Scheduler), a
 * CI job, or `npm run worker:once` on a box you control. Each invocation
 * claims a bounded batch of due submissions, so several concurrent runs are
 * safe and a slow batch never blocks the lead endpoint.
 *
 * The endpoint is protected by a shared secret. Without
 * `DELIVERY_WORKER_SECRET` set it refuses to run rather than exposing a
 * publicly triggerable job.
 */

function authorised(request: NextRequest): boolean {
  const expected = serverEnv.workerSecret;
  if (!expected) return false;
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-worker-secret") ??
    "";
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function run(request: NextRequest) {
  if (!serverEnv.workerSecret) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_configured",
        message: "DELIVERY_WORKER_SECRET is not set, so the worker endpoint is disabled.",
      },
      { status: 503 },
    );
  }
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 50) : undefined;
    const result = await processDueSubmissions({ limit, budgetMs: 45_000 });
    logger.info("worker.batch_processed", {
      claimed: result.claimed,
      delivered: result.outcomes.filter((o) => o.status === "delivered").length,
    });
    return NextResponse.json({
      ok: true,
      claimed: result.claimed,
      outcomes: result.outcomes.map((o) => ({
        submissionId: o.submissionId,
        status: o.status,
        retryAt: o.retryAt ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof StoreNotConfiguredError) {
      return NextResponse.json(
        { ok: false, code: "not_configured", message: error.message },
        { status: 503 },
      );
    }
    logger.error("worker.batch_failed", { message: (error as Error).message });
    return NextResponse.json(
      { ok: false, code: "worker_error", message: "Batch failed; see server logs." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return run(request);
}

/** GET is supported because most platform schedulers issue GET requests. */
export async function GET(request: NextRequest) {
  return run(request);
}
