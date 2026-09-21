import "server-only";
import { createPublicKey, timingSafeEqual, verify as cryptoVerify } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "../env";

/**
 * Verification for inbound events from GoHighLevel.
 *
 * Two mechanisms exist and they do NOT share authentication:
 *
 *  1. Marketplace webhooks are signed by HighLevel. Current deliveries carry
 *     `X-GHL-Signature`: a base64 Ed25519 signature over the raw request body,
 *     verified with HighLevel's published public key. The older RSA
 *     `X-WH-Signature` header was retired on 1 September 2026 and is not
 *     accepted here.
 *  2. Workflow custom-webhook callbacks are configured by the operator and are
 *     not signed by HighLevel at all. They are authenticated with a shared
 *     secret header that the workflow is configured to send, compared in
 *     constant time against `GHL_CALLBACK_SECRET`.
 *
 * A request is accepted only if it satisfies exactly one of these, and the
 * mechanism used is recorded so a workflow callback can never be mistaken for
 * a platform-signed event.
 */

/** HighLevel's published Ed25519 webhook public key. Override if it rotates. */
export const DEFAULT_GHL_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=\n" +
  "-----END PUBLIC KEY-----";

export const SIGNATURE_HEADER = "x-ghl-signature";
export const SHARED_SECRET_HEADER = "x-aion-callback-secret";

export type VerificationResult =
  | { ok: true; mechanism: "marketplace-signature" | "shared-secret" }
  | { ok: false; reason: string };

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyMarketplaceSignature(
  rawBody: string,
  signatureB64: string,
  publicKeyPem: string = serverEnv.ghlMarketplacePublicKey ?? DEFAULT_GHL_PUBLIC_KEY,
): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    const payload = Buffer.from(rawBody, "utf8");
    const signature = Buffer.from(signatureB64, "base64");
    if (signature.length === 0) return false;
    // `null` algorithm: Ed25519 is determined by the key itself.
    return cryptoVerify(null, payload, key, signature);
  } catch {
    return false;
  }
}

export function verifyCallback(headers: Headers, rawBody: string): VerificationResult {
  const signature = headers.get(SIGNATURE_HEADER);
  if (signature) {
    return verifyMarketplaceSignature(rawBody, signature)
      ? { ok: true, mechanism: "marketplace-signature" }
      : { ok: false, reason: "Invalid marketplace signature" };
  }

  const provided = headers.get(SHARED_SECRET_HEADER);
  const expected = serverEnv.ghlCallbackSecret;
  if (!expected) {
    return {
      ok: false,
      reason:
        "No signature header present and GHL_CALLBACK_SECRET is not configured, so the request cannot be authenticated",
    };
  }
  if (!provided) return { ok: false, reason: "Missing authentication header" };
  return constantTimeEquals(provided, expected)
    ? { ok: true, mechanism: "shared-secret" }
    : { ok: false, reason: "Invalid shared secret" };
}

/**
 * Schema for the callbacks this application acts on.
 *
 * Unknown event types are accepted with a 202 and ignored rather than
 * rejected, so adding a workflow step in GoHighLevel does not start failing
 * deliveries here.
 */
export const callbackEventSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  eventType: z.string().trim().min(1).max(120),
  locationId: z.string().trim().min(1).max(120),
  occurredAt: z.iso.datetime().optional(),
  submissionId: z.uuid().optional(),
  opportunityId: z.string().trim().max(120).optional(),
  contactId: z.string().trim().max(120).optional(),
  /** Present on booking events. Only a verified booking may advance a stage. */
  appointment: z
    .object({
      id: z.string().trim().max(120),
      status: z.string().trim().max(60).optional(),
      startTime: z.iso.datetime().optional(),
    })
    .optional(),
});

export type CallbackEvent = z.infer<typeof callbackEventSchema>;

/**
 * Opportunity stages, most advanced last. Used to refuse a regression: an
 * out-of-order or replayed event must never drag an opportunity backwards.
 */
export const STAGE_ORDER = [
  "new-assessment",
  "contacted",
  "strategy-call-booked",
  "qualified",
  "proposal-sent",
] as const;

export type StageKey = (typeof STAGE_ORDER)[number];

export function isForwardTransition(from: StageKey | null, to: StageKey): boolean {
  if (from === null) return true;
  return STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(from);
}
