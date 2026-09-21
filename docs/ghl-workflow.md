# Workflow configuration guide

How to build the GoHighLevel workflow that receives the assessment event.

A sample payload is in [`fixtures/assessment-event.sample.json`](./fixtures/assessment-event.sample.json).
It is synthetic — the contact does not exist.

---

## 1. Create the inbound webhook

**Automation → Workflows → Create Workflow → Start from scratch.**

Add the **Inbound Webhook** trigger, copy the generated URL, and set it as
`GHL_INBOUND_WEBHOOK_URL`.

Post the sample fixture to it once so GoHighLevel learns the payload shape and
the fields become selectable in later actions:

```bash
curl -X POST "$GHL_INBOUND_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d @docs/fixtures/assessment-event.sample.json
```

### Authenticating the event

Every outbound event carries `X-AION-Signature: <GHL_CALLBACK_SECRET>`. If your
workflow trigger supports a header condition, require that header and value —
an inbound webhook URL is otherwise callable by anyone who learns it.

---

## 2. Resolve the contact — this is the step that prevents duplicates

Branch on `ghl.recordOwner`. Getting this wrong is the single most likely cause
of duplicate records.

| `ghl.recordOwner` | Mode | What the workflow must do |
|---|---|---|
| `"api"` | `hybrid` | AION **already created** the contact, tags, opportunity and note. Use `ghl.contactId` to resolve the existing contact. **Do not create a contact. Do not create an opportunity.** |
| `"workflow"` | `webhook` | The workflow **owns** every CRM write: create/update the contact from `contact.*`, apply `tags`, create the opportunity, add `summary` as a note. |

In `hybrid` mode `ghl.contactId`, `ghl.opportunityId` and `ghl.noteId` are
populated. In `webhook` mode they are `null`.

---

## 3. Notify the assigned owner

Add an **Internal Notification** action (email or in-app) to the AION owner.

A subject line that is useful at a glance:

```
New assessment — {{inboundWebhookRequest.assessment.audienceLabel}}: {{inboundWebhookRequest.recommendation.coreServiceName}}
```

Use `summary` for the body. It is a pre-formatted, readable version of the whole
assessment, so no field-by-field template is needed.

---

## 4. Create a follow-up task

Add a **Create Task** action assigned to the AION owner.

Suggested due dates, driven by `assessment.timing`:

| `assessment.timing` | Due |
|---|---|
| `asap` | Same day |
| `within-30-days` | 2 business days |
| `one-to-three-months` | 5 business days |
| `exploring` | 10 business days |

---

## 5. Branch messaging by audience and service

Use an **If/Else** on `assessment.audience`:

- `contractor-builder` — estimate requests and site visits
- `home-services` — speed of first response
- `local-business` — visibility and an easy next step
- `real-estate` — buyer/seller inquiry handling and agent marketing

Then branch on `recommendation.coreServiceId` (`sales-follow-up`,
`marketing-growth`, `content-production`, `foundation-review`) so the first
message speaks to what was actually recommended.

---

## 6. Flag production interest for internal review

When `contentProductionInterest` is `true`, or `internalReviewRequired` is
`true` (which also covers "help us decide"):

- add an internal task: *"Scope content production with the client"*;
- notify the AION owner.

**Do not share the lead's details with Daniel automatically.** Daniel is a
creative production partner, not an owner of AION and not a recipient of the
lead list. Production interest is flagged so **AION** can scope and coordinate
it, and only AION decides what gets shared and when.

---

## 7. Respect consent and existing restrictions

Before any marketing email step, add an If/Else requiring
`consent.marketingEmail = true`. The version of the wording they agreed to is in
`consent.copyVersion`.

- **Transactional replies** to the request are fine either way — that is what
  the person asked for.
- **Marketing sequences** require `consent.marketingEmail = true`.
- **Never enrol the phone number in SMS campaigns.** Submitting the form is not
  SMS consent.
- Leave GoHighLevel's own DND and opt-out settings alone. The API integration
  never sends `dnd` or `dndSettings`, so an existing opt-out survives a new
  submission — the workflow must not undo that.

---

## 8. What a 200 actually means

A successful HTTP response from the inbound webhook means GoHighLevel
**accepted the event**. It is not proof that every workflow action ran.

The funnel records the workflow step as *"event accepted"*, never as
*"workflow completed"*. If you need confirmation that actions completed, add a
final webhook action in the workflow that calls back to
`POST /api/integrations/ghl/callback` with the shared secret header.

---

## 9. Testing the workflow safely

Use a sandbox or test location until end-to-end testing has been authorised.

1. Post the fixture with `curl` (above) and confirm the trigger fires.
2. Walk the workflow in GoHighLevel's test mode.
3. Confirm no duplicate contact is created when `ghl.recordOwner` is `"api"`.
4. Confirm marketing branches are skipped when `consent.marketingEmail` is
   `false`.
5. Only then point a real submission at it.

Do not publish workflows or send messages from a production location during
development.
