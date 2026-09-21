# Manual verification harnesses

These are **not** part of `npm test`. They drive a real browser (and a real
mock CRM) against a running server, and are kept here so the acceptance
criteria can be re-checked after a change rather than re-derived by hand.

`npm test` (Vitest) stays fast and hermetic; these are the slower,
higher-fidelity checks.

---

## Browser checks

Build and start the app first — these run against a real server, not a dev
build:

```bash
npm run build
LEAD_STORE_DRIVER=sqlite \
LEAD_STORE_SQLITE_PATH=./data/leads.sqlite \
NEXT_PUBLIC_CONTACT_EMAIL=hello@example.test \
npx next start -p 3100
```

Then, in another shell:

```bash
npm run verify:viewports      # layout at 360 / 390 / 768 / 1440 + all four audience paths
npm run verify:interactions   # back navigation, validation, submission, reduced motion, keyboard
npm run verify:short-screens  # scrolling and sticky-bar behaviour on short viewports
```

Override the target with `BASE_URL=https://...`.

### What they cover

| Script | Checks |
|---|---|
| `viewports.mjs` | No horizontal overflow and ≥44px tap targets at 360/390/768/1440; single column on mobile, two columns on desktop; no console errors; all four audience paths reach the right recommendation with the goal echoed back |
| `interactions.mjs` | Back navigation preserves answers (including multi-select); changing audience clears only the now-impossible goal; progress matches the branch; required-field validation; mobile keyboard `inputmode`; consent starts unchecked; the sticky bar never covers a focused input; a success screen appears only when the server accepted the submission; a failure is surfaced with a fallback contact; `sessionStorage` cleared after submission and contact details never written to it; reduced motion; keyboard selection |
| `short-screens.mjs` | On very short and landscape viewports the step region scrolls, the last option stays reachable and clear of the action bar, and the bar stays on screen |

---

## GoHighLevel integration checks

These run the real integration against a **mock** GoHighLevel. No live
account is contacted.

```bash
# 1. Start the mock CRM
npm run mock:ghl

# 2. Start the app pointed at it (see the env block below)
# 3. Run the acceptance checks
npm run verify:ghl
```

App environment for step 2:

```bash
LEAD_STORE_DRIVER=sqlite
LEAD_STORE_SQLITE_PATH=./data/leads-ghl.sqlite
DELIVERY_WORKER_SECRET=local-worker-secret
LEAD_MAX_PER_IP_PER_HOUR=500          # the harness submits more than a person would
NEXT_PUBLIC_BOOKING_URL=https://book.example.test/strategy-call
NEXT_PUBLIC_CONTACT_EMAIL=hello@example.test
GHL_INTEGRATION_MODE=hybrid
GHL_API_BASE_URL=http://127.0.0.1:4599
GHL_ACCESS_TOKEN=test-token
GHL_LOCATION_ID=loc_test
GHL_PIPELINE_ID=pipe_growth
GHL_NEW_ASSESSMENT_STAGE_ID=stage_new_assessment
GHL_ASSIGNED_USER_ID=user_owner
GHL_INBOUND_WEBHOOK_URL=http://127.0.0.1:4599/workflow-hook
GHL_CALLBACK_SECRET=local-callback-secret
GHL_CUSTOM_FIELD_MAP_JSON='{"business_category":"cf_cat","primary_bottleneck":"cf_bottleneck","inquiry_channels":"cf_channels","current_follow_up":"cf_followup","desired_outcome":"cf_goal","content_production_interest":"cf_content","start_timeframe":"cf_timing","recommended_service":"cf_service","submission_id":"cf_subid","utm_source":"cf_utm_source","marketing_consent":"cf_consent"}'
```

### What `ghl-acceptance.mjs` covers

- Hybrid delivery creates exactly one contact, opportunity and note, with the
  right tags, custom fields and stage.
- The contact upsert never sends `tags` or `dnd`, so an existing contact keeps
  its unrelated tags and its opt-out.
- A repeat submission reuses the existing opportunity; a replayed submission id
  makes no CRM calls at all.
- An advanced opportunity is never updated or dragged back.
- A partial failure resumes on the next worker run without replaying the steps
  that already succeeded, and the workflow event is sent only once the API
  steps complete.
- A 429 is retried after backoff; a 401 is flagged for an operator and not
  retried on a schedule.

The mock exposes a small control plane: `POST /__reset`, `POST /__seed-contact`,
`GET /__fail?path=&status=&times=` and `GET /__state`.

> These prove **our** behaviour against GoHighLevel's documented contract. They
> do not verify GoHighLevel itself — that still needs a run against an
> authorised test location. See `docs/launch-checklist.md`.
