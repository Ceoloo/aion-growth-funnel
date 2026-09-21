# Measurement plan

What we count, what we deliberately do not count, and where each number comes
from.

Nothing in this document is a claim about performance. These are the
measurements to take — the conversion hypotheses below are hypotheses until
there is data.

---

## The numbers that actually matter

A funnel that maximises form submissions is easy to build and easy to regret.
The point is qualified calls and customers, so the front-end numbers are only
useful read next to the downstream ones.

| Stage | Metric | Source |
|---|---|---|
| Interest | Hero CTA clicks | `landing_cta_clicked` |
| Start | Assessment starts | `assessment_started` |
| Progress | Step completion and exit rate | `assessment_step_completed` / `assessment_step_exited` |
| Value | Recommendation views | `recommendation_viewed` |
| Intent | Contact submissions | `lead_submission_succeeded` |
| Booking intent | Booking-link clicks | `booking_link_clicked` |
| **Booking** | **Verified appointments** | **GoHighLevel — not the browser** |
| **Qualified** | **Calls actually attended** | **GoHighLevel opportunity stage** |
| **Won** | **Customers won** | **GoHighLevel opportunity status** |

The bottom three rows are the ones worth optimising for. They cannot be
measured in the browser, and the front end does not pretend otherwise.

### Reading them together

- **Submissions up, qualified calls flat** → the funnel is attracting the wrong
  businesses. Tighten the copy and the questions, not the button colour.
- **Recommendation views high, submissions low** → the ask after the
  recommendation is not landing.
- **A step with a high exit rate** → that question is unclear, too personal, or
  too early.
- **Booking clicks high, verified bookings low** → the calendar itself is the
  problem (availability, load failure, friction), not the funnel.

---

## Where each number comes from

### Browser events

`src/lib/analytics.ts` is a vendor-neutral adapter. Register a sink to send
events anywhere:

```ts
registerAnalyticsSink({
  track: (event, props) => window.gtag?.("event", event, props),
});
```

| Event | Fired when |
|---|---|
| `landing_cta_clicked` | Any landing CTA — `cta_location` says which |
| `assessment_started` | The funnel mounts; `entry_point` is `audience_card` or `direct` |
| `assessment_step_viewed` | A question screen is shown |
| `assessment_step_completed` | Continue is pressed, with `dwell_seconds` |
| `assessment_step_exited` | The visitor goes back, with `exit_reason` |
| `assessment_completed` | The last question is answered |
| `recommendation_viewed` | The result screen is shown |
| `contact_step_viewed` | The contact step is opened |
| `lead_submission_succeeded` | The server confirmed durable storage |
| `lead_submission_failed` | Submission rejected or unreachable, with `error_code` |
| `booking_link_clicked` | The booking link is clicked — **a click, nothing more** |

**Abandonment** is derived, not sent: `assessment_step_viewed` minus
`assessment_step_completed` for the same `step_id`. There is no beacon on
unload, because an unreliable event is worse than an honest subtraction.

### Privacy

Event properties are restricted to an allow-list of non-identifying keys, and
any value containing whitespace or an `@` is dropped. Names, email addresses,
phone numbers, business names, website URLs and free text therefore cannot
reach analytics even by mistake. This is enforced in `sanitiseProps` and
asserted in `tests/analytics.test.ts`.

### CRM outcomes

Verified bookings, attendance and won business live in GoHighLevel:

| Outcome | Where it lives |
|---|---|
| Verified booking | Appointment event → `/api/integrations/ghl/callback` |
| Strategy Call Booked | Opportunity stage, set only on a verified booking |
| Qualified | Opportunity stage, set by the person who ran the call |
| Won / lost | Opportunity status |

Join them to the funnel with the `submission_id` custom field, which is written
on every contact. That is the key that ties a browser session to a customer.

---

## What we deliberately do not count

- **A booking-link click is not a booking.** It is tracked separately and named
  separately. Only a verified appointment event or an authenticated API read
  can establish an appointment, and only that moves an opportunity to Strategy
  Call Booked.
- **A stored submission is not a synced CRM record.** The API reports
  `delivery: "pending"` until the CRM writes actually complete.
- **A successful inbound webhook response is not a completed workflow.** It
  means the event was accepted.
- **No fabricated engagement metrics.** No "X businesses assessed this week",
  no countdowns, no scarcity.

---

## Conversion hypotheses to test

Written as hypotheses because that is what they are. Each names the change, the
reasoning and the metric that would settle it. Copy for all of these lives in
`src/content/site.ts`, so changing it is a content edit.

| # | Hypothesis | Measure by |
|---|---|---|
| 1 | Showing the recommendation before asking for contact details raises submission rate, because the visitor has already received something | `recommendation_viewed` → `lead_submission_succeeded` |
| 2 | Audience entry cards raise completion, because the funnel opens already reflecting the visitor's business | Completion rate split by `entry_point` |
| 3 | Requiring Continue rather than auto-advancing lowers accidental answers and back-navigation | `assessment_step_exited` with `exit_reason: "back"` |
| 4 | A direct booking path for warm traffic raises booked calls without lowering assessment starts | `booking_link_clicked` with `entry_point: "landing_direct"` |
| 5 | Naming the production partner as optional reduces drop-off at the content step | Exit rate on `content-needs` |

No experimentation platform is wired up for the first release, as specified.
The seams are ready: copy is centralised and every event carries the properties
needed to split by variant.

---

## Before any of this produces data

- [ ] Register an analytics sink — without one, events go nowhere in production.
- [ ] Map the `submission_id` custom field in GoHighLevel (see
      `docs/ghl-field-mapping.md`), or the browser and CRM numbers cannot be
      joined.
- [ ] Decide who reviews qualified-call and won-customer counts, and how often.
- [ ] Publish a privacy policy before collecting anything (see
      `docs/launch-checklist.md`).

## Core Web Vitals

Targets, not results. Nothing here has been measured on production hardware or
a real network.

| Metric | Target |
|---|---|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |

What the build does to support them: the landing page is statically
prerendered with its static bands as server components (no JavaScript
shipped for them); fonts are self-hosted, subset to Latin, limited to three
weights and set to `swap`; there is no hero video, no calendar iframe and no
third-party script; the Motion runtime is loaded only on `/assessment`, via
`LazyMotion` with the `domAnimation` feature set; and animations are limited
to opacity and transform so they do not trigger layout.

Measure with real field data before claiming any of these are met.
