# Custom-field mapping

AION's internal field names are stable. Your GoHighLevel custom-field ids are
not — they are specific to your location. `GHL_CUSTOM_FIELD_MAP_JSON` is the
bridge between the two.

**No id is ever invented.** A field with no id in the map is simply not sent.

---

## Setting it up

1. In GoHighLevel: **Settings → Custom Fields**, create a field for each row you
   want populated, using the suggested type below.
2. Copy each field's id.
3. Put them in `GHL_CUSTOM_FIELD_MAP_JSON` as `{"internal_key": "ghl_field_id"}`.

```json
{
  "business_category": "aBcD1234EfGh",
  "primary_bottleneck": "iJkL5678MnOp",
  "recommended_service": "qRsT9012UvWx"
}
```

Keys that are not in the table below are ignored, with a warning on
`/api/health`. Invalid JSON disables custom fields entirely (also warned) —
the rest of the delivery still runs.

---

## Field reference

| Internal key | Suggested GHL type | Example value | Source |
|---|---|---|---|
| `business_category` | Single line / Dropdown | `Contractors & Builders` | Step 1 |
| `primary_bottleneck` | Single line / Dropdown | `People inquire, but follow-up is inconsistent` | Step 2 |
| `inquiry_channels` | Multi line | `Referrals, Google / Website` | Step 3 (comma-joined) |
| `current_follow_up` | Single line / Dropdown | `We handle it manually through calls, texts, or DMs` | Step 4 |
| `desired_outcome` | Single line / Dropdown | `Estimate requests` | Step 5 |
| `content_production_interest` | Single line / Dropdown | `Yes, we need production support` | Step 6 |
| `start_timeframe` | Single line / Dropdown | `As soon as practical` | Step 7 |
| `recommended_service` | Single line | `Sales & Follow-Up System` | Recommendation rules |
| `submission_id` | Single line | `11111111-1111-4111-8111-111111111111` | Generated per assessment |
| `submitted_at` | Single line / Date | `2026-09-21T10:00:00.000Z` | Server timestamp |
| `utm_source` | Single line | `google` | URL at first visit |
| `utm_medium` | Single line | `cpc` | URL at first visit |
| `utm_campaign` | Single line | `fall-remodel` | URL at first visit |
| `utm_content` | Single line | `variant-b` | URL at first visit |
| `utm_term` | Single line | `kitchen remodel` | URL at first visit |
| `landing_page` | Single line | `https://aionsystems.example/` | First page of the session |
| `referrer` | Single line | `https://google.com/` | External referrer only |
| `marketing_consent` | Single line / Checkbox | `Yes` / `No` | Optional consent box |
| `marketing_consent_at` | Single line / Date | `2026-09-21T10:00:00.000Z` | Only present when consent was given |
| `consent_copy_version` | Single line | `2026-09-21.v1` | Version of the wording they agreed to |

If you use **Dropdown** fields, the option values in GoHighLevel must match the
example strings exactly, or the value will be rejected. Single line is the
lower-maintenance choice.

---

## Standard contact fields

These are mapped automatically and need no configuration:

| Canonical field | GoHighLevel field |
|---|---|
| `contact.firstName` | `firstName` |
| `contact.lastName` | `lastName` |
| `contact.fullName` | `name` |
| `contact.email` | `email` (lower-cased; the upsert key) |
| `contact.phone` | `phone` |
| `contact.businessName` | `companyName` |
| `contact.website` | `website` |

An optional field the visitor left blank is **omitted from the request**, not
sent as an empty string, so it cannot overwrite a value already in the CRM.

`tags`, `dnd` and `dndSettings` are never sent on the upsert. See
[`ghl-integration.md`](./ghl-integration.md#4-endpoints-used) for why.

---

## Tags

Applied additively via `POST /contacts/{id}/tags`. Only tags matching the
visitor's actual answers are applied.

| Tag | Applied when |
|---|---|
| `source:aion-growth-funnel` | Always |
| `audience:contractor-builder` | Step 1 = Contractors & Builders |
| `audience:home-services` | Step 1 = Home Services |
| `audience:local-business` | Step 1 = Local Businesses |
| `audience:real-estate` | Step 1 = Real Estate Agents & Teams |
| `service:sales-follow-up` | Sales & Follow-Up System recommended |
| `service:marketing-growth` | Marketing & Growth System recommended |
| `interest:content-production` | Production recommended **or** requested at step 6 |

Exactly one `audience:` tag is applied per submission. Tags already on the
contact from other sources are left untouched.

---

## Consent

`marketing_consent` reflects a **separate, optional, unchecked** checkbox. It is
email marketing only.

Submitting the form is a request for a reply — it is **not** SMS consent, and a
submitted phone number is never enrolled in text campaigns. The contact note
states this explicitly so it is visible to whoever picks up the lead.

`consent_copy_version` records which wording the person actually saw. Bump
`MARKETING_CONSENT_VERSION` in `src/content/consent.ts` whenever the consent
copy changes, and never reuse an old version string for new wording.
