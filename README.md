# AION Growth Funnel

Landing page and guided assessment funnel for **AION Systems**, built to turn
contractors, home-service businesses, local business owners and real estate
professionals into qualified strategy-call bookings.

> **Better marketing. Faster follow-up. More opportunities to grow.**

Not deployed. Not connected to a live CRM. See
[`docs/launch-checklist.md`](./docs/launch-checklist.md) for what has to happen
before this accepts real leads.

---

## What's here

| Route | What it is |
|---|---|
| `/` | Landing page — hero, audience selector, pain points, services, how it works, FAQ, final CTA |
| `/assessment` | Seven-step guided funnel, then a recommendation, contact capture and confirmation |
| `POST /api/leads` | Public lead endpoint: validates, durably stores, then attempts delivery |
| `GET/POST /api/jobs/process-deliveries` | Outbox worker (shared-secret protected) |
| `POST /api/integrations/ghl/callback` | Authenticated inbound events from GoHighLevel |
| `GET /api/health` | Operator readiness check — what is configured, what is missing |

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · Zod · Vitest. Postgres or SQLite for durable storage.

---

## Running it locally

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

The landing page and the whole funnel work immediately with no configuration.
Submitting the contact form returns an honest *"we can't accept requests right
now"* state until durable storage is configured — it never pretends a lead was
saved.

### Accepting submissions locally

Add to `.env.local`:

```bash
LEAD_STORE_DRIVER=sqlite
LEAD_STORE_SQLITE_PATH=./data/leads.sqlite
NEXT_PUBLIC_CONTACT_EMAIL=you@example.com
```

Then:

```bash
npm run db:init        # creates the schema and confirms the store works
npm run dev
```

Submissions are now stored durably. With no CRM configured, delivery is flagged
`needs_operator` and the submission stays on record — nothing is discarded.

### Checks

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest
npm run check          # all three
npm run build          # production build
```

### Worker

```bash
npm run worker:once             # drain one batch
npm run worker:once -- --limit 25
```

---

## Environment variables

Full annotated list in [`.env.example`](./.env.example). The ones that matter
most:

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | Accepting leads | Postgres. Required on serverless. |
| `LEAD_STORE_SQLITE_PATH` | Accepting leads | Alternative to Postgres, for a single long-running process. |
| `GHL_INTEGRATION_MODE` | CRM delivery | `api` \| `webhook` \| `hybrid`. Never switches automatically. |
| `GHL_ACCESS_TOKEN` | `api`, `hybrid` | Location-scoped Private Integration token. Server-side only. |
| `GHL_LOCATION_ID` | `api`, `hybrid` | Sub-account id. |
| `GHL_PIPELINE_ID` | Opportunities | Unset ⇒ the opportunity step is skipped, nothing breaks. |
| `GHL_NEW_ASSESSMENT_STAGE_ID` | Opportunities | Stage new submissions land in. |
| `GHL_ASSIGNED_USER_ID` | Optional | Owner for new opportunities and notes. |
| `GHL_INBOUND_WEBHOOK_URL` | `webhook`, `hybrid` | Workflow inbound webhook. |
| `GHL_CALLBACK_SECRET` | Callbacks | Shared secret for workflow callbacks. Not how marketplace webhooks are verified. |
| `GHL_CUSTOM_FIELD_MAP_JSON` | Custom fields | `{"internal_key": "ghl_field_id"}`. Unmapped fields are not sent. |
| `LEAD_WEBHOOK_URL` / `LEAD_WEBHOOK_SECRET` | Optional | Second destination for the same event, HMAC-signed. |
| `DELIVERY_WORKER_SECRET` | Worker | Without it the worker endpoint refuses to run. |
| `LEAD_IP_HASH_SALT` | Rate limiting | Raw IPs are never stored. |
| `NEXT_PUBLIC_BOOKING_URL` | Booking | Unset ⇒ an honest "we'll reach out" message, never an invented URL. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Fallback | Shown when a submission cannot be accepted. |
| `NEXT_PUBLIC_SITE_URL` | Metadata | Canonical URL for social cards and the sitemap. |

`NEXT_PUBLIC_*` values are inlined into the browser bundle. Everything else is
server-only, enforced by the `server-only` import guard and asserted by
`tests/client-safety.test.ts`, which scans both the source and the built client
chunks.

---

## Where to edit things

Everything a non-developer is likely to change lives in `src/content/`.

| File | Contains |
|---|---|
| `src/content/site.ts` | Landing page copy — hero, pain points, how it works, final CTA, metadata |
| `src/content/faq.ts` | FAQ questions and answers (also feeds the FAQ structured data) |
| `src/content/audiences.ts` | The four audiences, their blurbs and content examples |
| `src/content/assessment.ts` | Every question and answer option, and the progress labels |
| `src/content/services.ts` | Service definitions and what each one includes |
| `src/content/recommendation-rules.ts` | **Which answers map to which service**, and the priority library |
| `src/content/consent.ts` | Consent wording and its version string |

### Changing the recommendation logic

The rules live in two places:

- `src/content/recommendation-rules.ts` — which answers count as a sales-process
  gap, a demand gap, a content gap, or unclear; plus the priorities offered per
  service.
- `src/lib/recommendation.ts` — the evaluation order (first match wins) and the
  wording of the explanations.

The order encodes a deliberate view: **a leaking process is worth fixing before
more traffic is added.** If you change it, update
`tests/recommendation.test.ts`, which pins every rule.

Adding an answer option means updating `src/content/assessment.ts`,
`src/content/types.ts` and the matching enum in `src/lib/lead-schema.ts` — the
server rejects anything outside the known vocabulary.

Changing the consent wording means bumping `MARKETING_CONSENT_VERSION` in
`src/content/consent.ts`, so stored consent records stay traceable to the exact
wording that was agreed to.

---

## How the funnel behaves

- **Mobile first.** Designed at 360px and enhanced upward. Heights use
  `100dvh` with a `100vh` fallback; safe-area insets are respected; sticky
  action bars sit in flow so they never cover the last option or a focused
  input; every interactive target is at least 44px.
- **One question per screen**, with real progress against the active branch
  rather than a hard-coded total.
- **Back navigation preserves answers.** The only answer ever cleared is the
  goal, and only when switching to or from real estate, which uses a different
  set of goals — keeping it would leave an invisible option selected.
- **The result comes before the ask.** The recommendation is shown in full
  before any contact details are requested.
- **Accessible.** Options are real radios and checkboxes, so keyboard and
  screen-reader behaviour is native. Nothing depends on hover. Reduced motion
  is honoured.
- **Answers persist in `sessionStorage`; contact details never do.** Only
  answer ids from a closed vocabulary are stored, and they are cleared after a
  successful submission. Nothing uses `localStorage`.

---

## How a lead is handled

```
validate  →  durably store  →  attempt delivery  →  respond
```

The confirmation screen is shown **only** when the server confirmed it stored
the submission. Storage failure produces a retryable error, not a success
screen. A queued-but-undelivered lead is reported as *received*, never as
*synced*.

Delivery runs as tracked steps — contact, custom fields, tags, opportunity,
note, workflow event — so a retry resumes at the first incomplete one instead of
replaying work. Transient failures and rate limits back off exponentially with
full jitter and honour `Retry-After`; authentication and configuration failures
stop and are flagged for an operator rather than retried into a wall.

Protections on the public endpoint: schema validation with explicit length
limits, a honeypot, a minimum form dwell time, submission-id uniqueness for
duplicate-submit protection, per-IP rate limiting on a hashed address, and
bounded timeouts on every outbound call.

Full detail: [`docs/ghl-integration.md`](./docs/ghl-integration.md).

---

## Analytics

`src/lib/analytics.ts` is a vendor-neutral adapter. Register a sink to send
events anywhere:

```ts
registerAnalyticsSink({
  track: (event, props) => window.gtag?.("event", event, props),
});
```

Events: `landing_cta_clicked`, `assessment_started`,
`assessment_step_completed`, `assessment_completed`, `recommendation_viewed`,
`lead_submission_succeeded`, `lead_submission_failed`, `booking_link_clicked`.

Properties are restricted to an allow-list of non-identifying keys, and any
value containing whitespace or an `@` is dropped — so names, emails, phone
numbers and free text cannot reach analytics even by mistake. This is enforced
in `sanitiseProps` and asserted in `tests/analytics.test.ts`.

A booking-link click is recorded as a **click**. It is never treated as a
confirmed appointment; only a verified booking event can establish that.

---

## Documentation

| Document | Covers |
|---|---|
| [`docs/ghl-integration.md`](./docs/ghl-integration.md) | Setup, modes, scopes, endpoints, reliability, recovery |
| [`docs/ghl-field-mapping.md`](./docs/ghl-field-mapping.md) | Custom-field table, tags, consent handling |
| [`docs/ghl-workflow.md`](./docs/ghl-workflow.md) | Workflow build guide and ownership rules |
| [`docs/fixtures/assessment-event.sample.json`](./docs/fixtures/assessment-event.sample.json) | Synthetic sample event |
| [`docs/launch-checklist.md`](./docs/launch-checklist.md) | What is still required before going live |

---

## Design

Original AION identity: a type-led wordmark where the "O" becomes a ring with a
single connecting node. Deep navy and charcoal for structure, warm white for
reading surfaces, electric blue for action, restrained cyan for detail. Large
type, generous spacing, rounded cards, subtle borders, light motion. No
third-party branding or assets are used anywhere.

Premium photography and videography are described as an **optional** service
delivered with AION's creative production partner, Daniel. Daniel does not own
AION, and production is never presented as required.

There are no testimonials, client logos, performance metrics or guarantees in
the copy — none were invented, and none should be added unless they are real and
attributable.
