# GoHighLevel integration — setup guide

This document is the operator's guide to connecting the funnel to a real
GoHighLevel location.

**Nothing in this repository has been run against a live GoHighLevel account.**
Every behaviour described here is verified by automated tests against a mocked
API (`tests/ghl-delivery.test.ts`). Verification against an authorised test
location is still outstanding — see [Before accepting live
leads](#before-accepting-live-leads).

---

## 1. How a lead travels

```
Browser  ──POST /api/leads──▶  AION server
                                   │
                                   ├─ 1. validate (zod)
                                   ├─ 2. write to durable store  ◀── the point of no loss
                                   │      status: received
                                   │
                                   ├─ 3. bounded inline delivery attempt
                                   │
                                   └─ respond { ok: true, delivery: "pending" | "complete" }

Scheduled worker ──▶ claim due submissions ──▶ resume from last completed step
```

The browser never calls GoHighLevel. It only ever talks to `/api/leads`, which
is public and unauthenticated by design; every authenticated call happens
server-side with a token the browser cannot see.

The durable write in step 2 is what lets the confirmation screen say *"Your
request has been received."* If that write fails, the visitor gets a retryable
error instead of a success screen.

---

## 2. Integration modes

Set `GHL_INTEGRATION_MODE` explicitly. The application never switches modes on
its own, including after a partial failure — a failed API delivery is retried
as an API delivery, so records keep a consistent shape.

| Mode | Who writes to the CRM | Requires |
|---|---|---|
| `api` | This server: contact, custom fields, tags, opportunity, note. | `GHL_ACCESS_TOKEN`, `GHL_LOCATION_ID` |
| `webhook` | The GoHighLevel workflow. This server only posts an event. | `GHL_INBOUND_WEBHOOK_URL` |
| `hybrid` **(preferred)** | This server writes the records; the workflow then receives an event carrying the resulting ids, for notifications and follow-up only. | all of the above |

In `hybrid` mode the event is posted **only after** the API steps succeed, and
carries `ghl.recordOwner: "api"` plus the real `contactId`, `opportunityId` and
`noteId`. Your workflow must use those ids to resolve the existing contact. If
it creates a contact instead, you will get duplicates.

In `webhook` mode the event carries `ghl.recordOwner: "workflow"` and null ids;
there the workflow is responsible for every CRM write.

---

## 3. Authentication

The funnel uses **location-scoped authentication**: a Private Integration token
for a single sub-account, set as `GHL_ACCESS_TOKEN`.

In GoHighLevel: **Settings → Private Integrations → Create new integration**,
then grant the scopes below and copy the token.

### Required scopes

| Operation | Scope |
|---|---|
| Create / update the contact | `contacts.write` |
| Read a contact (reconciliation) | `contacts.readonly` |
| Add tags, add and list notes | covered by the contacts scopes above |
| Search opportunities | `opportunities.readonly` |
| Create an opportunity | `opportunities.write` |

Grant only what is listed. If your token is missing a scope, delivery fails
with a `configuration` error and the submission is flagged `needs_operator`
rather than retried in a loop — check `/api/health` and the server logs.

> Multi-location OAuth is **not** implemented. It does not need to be for a
> single-location deployment. The client takes an `AuthProvider`
> (`src/lib/ghl/client.ts`); adding marketplace OAuth later means writing a new
> provider that exchanges and refreshes tokens, not rewriting the funnel.

### API version

Requests send a single `Version` header, taken from `GHL_API_VERSION`
(default `v3`). HighLevel documents `v3` as current and keeps the older
date-based versions (`2021-07-28`, `2023-02-21`, `2021-04-15`) supported as
legacy. One value is used for every call so versions are never mixed.

Confirm the value against the version selector on
<https://marketplace.gohighlevel.com/docs/> before changing it, and re-check
the request and response shapes in `src/lib/ghl/client.ts` if you switch.

---

## 4. Endpoints used

All against `https://services.leadconnectorhq.com`.

| Step | Method & path | Why this one |
|---|---|---|
| Contact | `POST /contacts/upsert` | Idempotent by email within a location, so a retry after a timeout updates rather than duplicates. |
| Tags | `POST /contacts/{id}/tags` | **Additive.** The upsert endpoint *replaces* the whole tag array, which would strip tags set by other sources, so tags are never sent on the upsert. |
| Opportunity lookup | `GET /opportunities/search` | Checked before creating, so a repeat submission reuses the existing opportunity. |
| Opportunity | `POST /opportunities/` | Created with `status: "open"` and no monetary value. |
| Note lookup | `GET /contacts/{id}/notes` | Used to reconcile an ambiguous write before creating a second note. |
| Note | `POST /contacts/{id}/notes` | Carries an `[aion-submission:<id>]` marker for that reconciliation. |

### What the integration deliberately does not do

- **Never sends `tags` on the contact upsert** — that would overwrite tags.
- **Never sends `dnd` or `dndSettings`** — an existing opt-out is preserved.
- **Never sends an empty value** for an unanswered field, so a blank answer
  cannot clear a populated CRM field.
- **Never sets a monetary value** or marks an opportunity won.
- **Never moves an existing opportunity backwards.** If the contact already has
  one in the configured pipeline, its id is adopted and its stage and status are
  left exactly as they are — including when a salesperson has advanced it.
- **Never shares the lead with the production partner.** Production interest is
  flagged with `interest:content-production` for AION to scope and coordinate.

---

## 5. Pipeline setup

Create a pipeline in GoHighLevel and copy the real ids into the environment.
The application resolves configured ids; it does not assume these resources
exist and will not create them.

Suggested pipeline: **AION Growth Services**

| Stage | Set by |
|---|---|
| New Assessment | `GHL_NEW_ASSESSMENT_STAGE_ID` — where funnel submissions land |
| Contacted | your team |
| Strategy Call Booked | only a verified booking event or an authenticated API confirmation |
| Qualified | your team |
| Proposal Sent | your team |

Won and lost are GoHighLevel's opportunity **status**, not stages.

A click on the booking link is tracked as `booking_link_clicked` and nothing
more. It never advances a stage and is never counted as an appointment.

If `GHL_PIPELINE_ID` is unset, the opportunity step is skipped and the rest of
the delivery still runs.

---

## 6. Reliability

### Steps are tracked separately

Each submission records the state of `contact`, `custom_fields`, `tags`,
`opportunity`, `note`, `workflow_event` and `generic_webhook` independently,
with the resulting provider id. A retry resumes at the first step that is not
`done` — completed work is never replayed.

### Retry schedule

Transient failures and rate limits are retried with exponential backoff and
**full jitter** (a uniform random delay in `[0, cap]`), so a batch of
submissions failing together does not retry in lockstep. Base delay 2s,
doubling per attempt, capped at 6 hours. A `Retry-After` header is treated as a
floor and always honoured.

`DELIVERY_MAX_ATTEMPTS` (default 8) bounds the total.

### Failure classes

| Class | Examples | What happens |
|---|---|---|
| `transient` | 5xx, network error | Retried with backoff |
| `rate_limited` | 429 | Retried, honouring `Retry-After` |
| `ambiguous` | a write that timed out | Retried, but **reconciled first** |
| `configuration` | 401, 403 | `needs_operator`, no retry — a bad token does not fix itself |
| `permanent` | 400, 404, 422 | `failed_permanent` |

### Ambiguous timeouts

A write that times out may or may not have been applied. Before retrying:

- **Contact** — the upsert is idempotent by email, so replaying is safe.
- **Opportunity** — searched by contact and pipeline before creating.
- **Note** — the contact's notes are listed and matched on the
  `[aion-submission:<id>]` marker before a new one is written.

### Exactly-once is not claimed

GoHighLevel cannot guarantee exactly-once delivery and neither can this
integration. What is guaranteed is that an ambiguous failure is reconciled
before a second write is attempted, and that a submission is never silently
dropped.

### Running the worker

The outbox is drained by a scheduled invocation. There are no in-memory queues
and no promises left running after a serverless response.

**HTTP (platform schedulers):**

```
GET|POST /api/jobs/process-deliveries
Authorization: Bearer $DELIVERY_WORKER_SECRET
```

Vercel Cron — add to `vercel.json`:

```json
{ "crons": [{ "path": "/api/jobs/process-deliveries", "schedule": "*/5 * * * *" }] }
```

**CLI (a box you control):**

```bash
npm run worker:once -- --limit 25
```

Without `DELIVERY_WORKER_SECRET` set, the HTTP endpoint returns 503 and
refuses to run, rather than being publicly triggerable.

### Recovering a stuck submission

1. `GET /api/health` — shows the configured mode and every missing variable.
2. Fix the configuration (usually a token or an id).
3. Reset the record so the worker picks it up again:

```sql
UPDATE lead_submissions
   SET status = 'received', attempts = 0, next_attempt_at = NULL, locked_until = NULL
 WHERE status = 'needs_operator';
```

4. Run the worker. Completed steps are skipped automatically.

---

## 7. Inbound callbacks

`POST /api/integrations/ghl/callback` — deliberately separate from the public
lead endpoint, and it rejects anything it cannot authenticate.

**The two mechanisms do not share authentication.**

| Source | Header | Verification |
|---|---|---|
| Marketplace webhooks | `X-GHL-Signature` | Base64 Ed25519 signature over the raw body, checked against HighLevel's published public key. |
| Workflow custom webhooks | `X-AION-Callback-Secret` | Constant-time comparison against `GHL_CALLBACK_SECRET`. GoHighLevel does not sign these. |

A request carrying a signature header is verified *as a signature*; a shared
secret cannot be used to satisfy it.

> The legacy RSA `X-WH-Signature` header was retired by HighLevel on
> 1 September 2026 and is not accepted.

Events are deduplicated by `eventId` in durable storage, so a redelivery is
acknowledged (200, `deduplicated: true`) without being applied twice. Stage
transitions are guarded by `isForwardTransition`, so a replayed or out-of-order
event can never drag an opportunity backwards.

A 202 from this endpoint means the event was **accepted**. It does not assert
that every downstream action completed.

---

## 8. Before accepting live leads

Blocking, in order:

1. **Configure durable storage.** Without `DATABASE_URL` (or a SQLite path),
   `/api/leads` returns 503 and accepts nothing.
2. **Create the GoHighLevel resources** and copy the real ids: location,
   pipeline, New Assessment stage, custom fields.
3. **Fill in `GHL_CUSTOM_FIELD_MAP_JSON`.** Unmapped fields are not sent; the
   assessment would then reach the CRM only via the contact note.
4. **Schedule the worker.** Without it, anything that fails its inline attempt
   sits in the outbox untouched.
5. **Verify against an authorised test location.** Everything in this repo is
   tested against mocks. Run one submission end to end per audience and confirm
   the contact, tags, opportunity and note look right in the CRM.
6. **Publish a privacy policy and link it.** The form collects personal data
   and there is currently no policy URL — see `docs/launch-checklist.md`.

Do not publish workflows, send messages, or write production CRM records during
development. Use a sandbox location until step 5 is authorised.
