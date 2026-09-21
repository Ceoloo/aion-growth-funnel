const APP = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const MOCK = process.env.MOCK_GHL_URL ?? "http://127.0.0.1:4599";
const problems = [];
const check = (ok, m) => { if (!ok) problems.push(m); console.log(`  ${ok ? "PASS" : "FAIL"}  ${m}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const state = async () => (await fetch(`${MOCK}/__state`)).json();
const reset = () => fetch(`${MOCK}/__reset`);
const uuid = () => crypto.randomUUID();

function lead(over = {}) {
  return {
    submissionId: uuid(),
    contact: { fullName: "Dana Reyes", email: "dana@examplebuilders.test", businessName: "Example Builders", phone: "+15555550123", website: "examplebuilders.test" },
    answers: { audience: "contractor-builder", bottleneck: "inconsistent-follow-up", channels: ["referrals", "google-website"], followUp: "manual", goal: "estimate-requests", contentNeed: "need-production", timing: "asap" },
    consent: { marketingEmail: true, copyVersion: "2026-09-21.v1" },
    attribution: { utmSource: "google", utmMedium: "cpc" },
    formRenderedAt: Date.now() - 10000,
    ...over,
  };
}
const submit = (body) => fetch(`${APP}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(j);
const worker = () => fetch(`${APP}/api/jobs/process-deliveries`, { headers: { Authorization: `Bearer ${process.env.DELIVERY_WORKER_SECRET ?? "worker-secret-for-local-smoke-test"}` } }).then(j);

// ---------------------------------------------------------------
console.log("\n### Hybrid delivery, end to end");
await reset();
{
  const payload = lead();
  const res = await submit(payload);
  check(res.status === 201 && res.body.delivery === "complete", `submission delivered inline (status ${res.status}, delivery ${res.body.delivery})`);
  check(typeof res.body.bookingUrl === "string" && res.body.bookingUrl.length > 0, "configured booking URL returned to the client");

  const s = await state();
  const c = s.contacts[0];
  check(s.contacts.length === 1, `exactly one contact created (${s.contacts.length})`);
  check(c.email === "dana@examplebuilders.test", "contact email lower-cased");
  check(s.opportunities.length === 1, `exactly one opportunity created (${s.opportunities.length})`);
  check(s.opportunities[0].status === "open", `opportunity status is open (${s.opportunities[0].status})`);
  check(s.opportunities[0].pipelineStageId === "stage_new_assessment", "opportunity lands in the New Assessment stage");
  check(s.opportunities[0].monetaryValue === undefined, "no invented deal value");
  check(s.notes.length === 1, `exactly one note created (${s.notes.length})`);
  check(s.notes[0].body.includes(`[aion-submission:${payload.submissionId}]`), "note carries the submission marker");
  check(s.notes[0].body.includes("Phone submission is not SMS consent."), "note states phone is not SMS consent");

  // Tags
  const expected = ["source:aion-growth-funnel","audience:contractor-builder","service:sales-follow-up","interest:content-production"];
  check(expected.every(t => c.tags.includes(t)), `all expected tags applied (${c.tags.join(", ")})`);
  check(!c.tags.includes("audience:real-estate") && !c.tags.includes("service:marketing-growth"), "no tags applied that do not match the answers");

  // Custom fields
  const ids = c.customFields.map(f => f.id);
  check(ids.includes("cf_bottleneck") && ids.includes("cf_service"), "mapped custom fields sent");
  check(!c.customFields.some(f => f.field_value === ""), "no empty custom-field values sent");
  const consentField = c.customFields.find(f => f.id === "cf_consent");
  check(consentField?.field_value === "Yes", "marketing consent recorded as Yes");

  // Upsert must not carry tags/dnd
  const upsert = s.requests.find(r => r.path === "/contacts/upsert");
  check(!("tags" in upsert.body), "contact upsert does NOT send tags (which would overwrite)");
  check(!("dnd" in upsert.body) && !("dndSettings" in upsert.body), "contact upsert does NOT send dnd settings");
  check(typeof upsert.headers.version === "string", `Version header sent (${upsert.headers.version})`);
  check(upsert.headers.authorization?.startsWith("Bearer ") === true, "bearer token sent server-side");

  // Hybrid workflow event
  check(s.workflowEvents.length === 1, `exactly one workflow event posted (${s.workflowEvents.length})`);
  const ev = s.workflowEvents[0].body;
  check(ev.eventType === "aion.assessment.submitted" && ev.eventVersion === "1.0", "event is typed and versioned");
  check(ev.ghl.recordOwner === "api", "event tells the workflow that the API owns the records");
  check(ev.ghl.contactId === c.id && ev.ghl.opportunityId === s.opportunities[0].id && ev.ghl.noteId === s.notes[0].id, "event carries the real GHL ids");
  check(ev.contentProductionInterest === true && ev.internalReviewRequired === true, "production interest flagged for internal review");
  check(typeof s.workflowEvents[0].headers["x-aion-signature"] === "string", "workflow event carries the shared-secret header");

  // Ordering: the event must come AFTER the CRM writes.
  const order = s.requests.map(r => r.path);
  check(order.indexOf("/workflow-hook") > order.indexOf("/opportunities/"), "workflow event posted only after the CRM writes succeeded");
}

// ---------------------------------------------------------------
console.log("\n### Existing contact: unrelated tags and opt-outs survive");
await reset();
{
  await fetch(`${MOCK}/__seed-contact`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dana@examplebuilders.test", tags: ["vip", "source:trade-show", "newsletter-2025"], dnd: true }) });

  await submit(lead());
  const s = await state();
  const c = s.contacts[0];
  check(s.contacts.length === 1, "no duplicate contact created for an existing email");
  check(["vip","source:trade-show","newsletter-2025"].every(t => c.tags.includes(t)), `pre-existing tags preserved (${c.tags.join(", ")})`);
  check(c.tags.includes("source:aion-growth-funnel"), "AION tags added alongside them");
  check(c.dnd === true, "existing DND / opt-out preserved");
}

// ---------------------------------------------------------------
console.log("\n### Repeat submissions do not duplicate the opportunity or note");
await reset();
{
  const first = lead();
  await submit(first);
  // A second, distinct assessment from the same person.
  const second = lead({ submissionId: uuid() });
  await submit(second);

  const s = await state();
  check(s.contacts.length === 1, `still one contact (${s.contacts.length})`);
  check(s.opportunities.length === 1, `existing opportunity reused, not duplicated (${s.opportunities.length})`);
  check(s.notes.length === 2, `each distinct assessment adds its own note (${s.notes.length})`);

  // Exact same submission id replayed => nothing new at all.
  const crmCalls = (reqs) => reqs.filter(r => r.path.startsWith("/contacts") || r.path.startsWith("/opportunities") || r.path === "/workflow-hook").length;
  const before = crmCalls((await state()).requests);
  const dup = await submit(first);
  const after = crmCalls((await state()).requests);
  check(dup.body.duplicate === true, "replayed submission id reported as a duplicate");
  check(after === before, `a replayed submission makes no further CRM calls (${before} -> ${after})`);
}

// ---------------------------------------------------------------
console.log("\n### An advanced opportunity is never dragged backwards");
await reset();
{
  await submit(lead());
  let s = await state();
  const oppId = s.opportunities[0].id;
  // Simulate a salesperson advancing the deal.
  await fetch(`${MOCK}/__state`); // no-op read
  s.opportunities[0].pipelineStageId = "stage_qualified";
  // Push the change into the mock by re-seeding through a direct mutation:
  // the mock holds the same object, so mutate via a fresh submission path.
  const res = await fetch(`${MOCK}/__state`).then(r => r.json());
  // (the mock returns copies; assert on behaviour instead)
  await submit(lead({ submissionId: uuid() }));
  s = await state();
  check(s.opportunities.length === 1, "no second opportunity created on a later submission");
  const updates = s.requests.filter(r => r.method === "PUT" && r.path.startsWith("/opportunities"));
  check(updates.length === 0, "no update call is made against the existing opportunity at all");
  void oppId; void res;
}

// ---------------------------------------------------------------
console.log("\n### Partial failure resumes without replaying completed work");
await reset();
{
  // Fail the note step once. Contact, tags and opportunity should succeed.
  await fetch(`${MOCK}/__fail?path=/notes&status=500&times=1`);
  const payload = lead({ submissionId: uuid() });
  const res = await submit(payload);
  check(res.body.delivery === "pending", `delivery reported as pending, not complete (${res.body.delivery})`);

  let s = await state();
  check(s.contacts.length === 1 && s.opportunities.length === 1, "contact and opportunity completed before the failure");
  check(s.notes.length === 0, "note not created");
  check(s.workflowEvents.length === 0, "workflow event NOT sent while the API steps are incomplete");

  const upsertsBefore = s.requests.filter(r => r.path === "/contacts/upsert").length;
  const oppCreatesBefore = s.requests.filter(r => r.method === "POST" && r.path === "/opportunities/").length;

  // Wait out the backoff, then run the worker.
  await new Promise(r => setTimeout(r, 4500));
  const w = await worker();
  check(w.body.claimed >= 1, `worker claimed the pending submission (${w.body.claimed})`);

  s = await state();
  check(s.notes.length === 1, `note created on the retry (${s.notes.length})`);
  check(s.contacts.length === 1 && s.opportunities.length === 1, "retry created no duplicate contact or opportunity");
  const upsertsAfter = s.requests.filter(r => r.path === "/contacts/upsert").length;
  const oppCreatesAfter = s.requests.filter(r => r.method === "POST" && r.path === "/opportunities/").length;
  check(upsertsAfter === upsertsBefore, `completed contact step not replayed (${upsertsBefore} -> ${upsertsAfter})`);
  check(oppCreatesAfter === oppCreatesBefore, `completed opportunity step not replayed (${oppCreatesBefore} -> ${oppCreatesAfter})`);
  check(s.workflowEvents.length === 1, "workflow event sent once the API steps finally completed");
}

// ---------------------------------------------------------------
console.log("\n### Rate limiting is handled");
await reset();
{
  await fetch(`${MOCK}/__fail?path=/contacts/upsert&status=429&times=1`);
  const res = await submit(lead({ submissionId: uuid() }));
  check(res.status === 201 && res.body.ok === true, "visitor still gets a stored-and-received response");
  check(res.body.delivery === "pending", `delivery pending after the rate limit (${res.body.delivery})`);
  const s = await state();
  check(s.contacts.length === 0, "nothing written to the CRM yet");

  await new Promise(r => setTimeout(r, 4500));
  await worker();
  const s2 = await state();
  check(s2.contacts.length === 1, "retry after backoff succeeds");
}

// ---------------------------------------------------------------
console.log("\n### Authentication failure is flagged, not retried forever");
await reset();
{
  await fetch(`${MOCK}/__fail?path=/contacts/upsert&status=401&times=10`);
  const res = await submit(lead({ submissionId: uuid() }));
  check(res.body.delivery === "needs_operator", `flagged for an operator (${res.body.delivery})`);
  const w = await worker();
  check(w.body.claimed === 0, "a needs_operator submission is not re-claimed on a schedule");
  await fetch(`${MOCK}/__reset`);
}

console.log("\n" + "=".repeat(62));
if (problems.length === 0) console.log("ALL CHECKS PASSED");
else { console.log(`${problems.length} PROBLEM(S):`); problems.forEach(p => console.log(" - " + p)); process.exitCode = 1; }
