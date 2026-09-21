# Launch checklist

What must be true before this funnel accepts real leads.

---

## Blocking — do not accept live leads until these are done

### 1. Privacy policy — **missing, and required**

The funnel collects a name, email address, business name and optionally a phone
number and website, and offers an optional email-marketing consent box.

**There is no privacy policy URL, and none has been written.** No policy is
published in this repository and none is linked from the site — deliberately, as
inventing one would be worse than having none.

Before launch:

- [ ] Publish a real privacy policy at a real URL.
- [ ] Link it from the footer and from the contact step.
- [ ] Make sure it describes what is collected, why, how long it is kept, who it
      is shared with (including GoHighLevel as a processor), and how to request
      deletion.

Depending on where the visitors are, an incomplete or absent policy may also be
a legal problem, not just a trust one. That is a decision for AION and its
counsel, not something this codebase can settle.

### 2. Company details

No legal entity name, registered address, company number or jurisdiction appears
anywhere in the site. None were fabricated.

- [ ] Add the real legal entity details to the footer if required in your
      jurisdiction.

### 3. Durable storage

- [ ] `DATABASE_URL` (or `LEAD_STORE_SQLITE_PATH`) configured.
- [ ] `npm run db:init` runs cleanly.
- [ ] `GET /api/health` reports `acceptingLeads: true`.

Until this is done, `/api/leads` returns 503 and accepts nothing — which is the
intended behaviour, not a bug.

### 4. Delivery worker

- [ ] `DELIVERY_WORKER_SECRET` set.
- [ ] A schedule calls `/api/jobs/process-deliveries` (or runs
      `npm run worker:once`) at least every few minutes.

Without it, any submission that fails its inline attempt sits in the outbox
untouched.

### 5. GoHighLevel verification against a real location

Everything in this repository is verified against **mocks**. No call has been
made to a live GoHighLevel account.

- [ ] Authorised test location available.
- [ ] One end-to-end submission per audience; contact, tags, opportunity and
      note all look correct.
- [ ] Repeat submission confirms no duplicate opportunity or note is created.
- [ ] Existing tags and DND settings on a test contact survive a submission.

---

## Recommended before launch

- [ ] `NEXT_PUBLIC_BOOKING_URL` set. Without it, the confirmation screen
      honestly says AION will reach out — which is fine, just slower.
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` set, so a failed submission has somewhere to go.
- [ ] `LEAD_IP_HASH_SALT` set to a random value in production.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain, for metadata and the sitemap.
- [ ] An analytics sink registered via `registerAnalyticsSink` if you want
      events recorded anywhere.
- [ ] Test the funnel on a real phone, not only a simulator.

---

## Explicitly not done

- **Not deployed.** Nothing has been pushed to a hosting platform.
- **No workflows published** in any GoHighLevel account.
- **No messages sent** and no production CRM records written.
- **No live GHL verification** — mocks only.
- **No testimonials, client logos, performance metrics or guarantees** anywhere
  in the copy. Do not add any that are not real and attributable.
- **No stock photography** presented as completed client work. The site
  currently uses no photography at all; if any is added, it must be AION's own
  or clearly labelled.
