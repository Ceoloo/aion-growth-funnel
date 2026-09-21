import http from "node:http";

/**
 * Mock GoHighLevel + mock workflow webhook.
 * Records every request so the integration can be inspected end to end.
 */
const state = {
  requests: [],
  contacts: new Map(),   // email -> { id, tags:Set, customFields:[], dnd }
  opportunities: [],
  notes: [],
  workflowEvents: [],
  failNext: null,        // { path, status, times }
};

let contactSeq = 0, oppSeq = 0, noteSeq = 0;

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    const body = raw ? JSON.parse(raw) : undefined;
    state.requests.push({ method: req.method, path, query: Object.fromEntries(url.searchParams), body, headers: req.headers });

    // Control plane for the test harness.
    if (path === "/__state") return send(res, 200, {
      requests: state.requests,
      contacts: [...state.contacts.entries()].map(([email, c]) => ({ email, id: c.id, tags: [...c.tags], customFields: c.customFields, dnd: c.dnd })),
      opportunities: state.opportunities,
      notes: state.notes,
      workflowEvents: state.workflowEvents,
    });
    if (path === "/__fail") { state.failNext = { path: url.searchParams.get("path"), status: Number(url.searchParams.get("status")), times: Number(url.searchParams.get("times") ?? 1) }; return send(res, 200, { ok: true }); }
    if (path === "/__reset") { state.requests = []; state.contacts.clear(); state.opportunities = []; state.notes = []; state.workflowEvents = []; state.failNext = null; return send(res, 200, { ok: true }); }
    if (path === "/__seed-contact") {
      // Pre-existing contact with unrelated tags and an opt-out, to prove they survive.
      contactSeq += 1;
      state.contacts.set(body.email, { id: `contact_${contactSeq}`, tags: new Set(body.tags ?? []), customFields: [], dnd: body.dnd ?? false });
      return send(res, 200, { ok: true, id: `contact_${contactSeq}` });
    }

    // Injected failure.
    if (state.failNext && path.includes(state.failNext.path) && state.failNext.times > 0) {
      state.failNext.times -= 1;
      return send(res, state.failNext.status, { message: "injected failure" });
    }

    // Auth must be present on every GHL call.
    if (path.startsWith("/contacts") || path.startsWith("/opportunities")) {
      if (!req.headers.authorization?.startsWith("Bearer ")) return send(res, 401, { message: "unauthorized" });
      if (!req.headers.version) return send(res, 400, { message: "missing Version header" });
    }

    if (path === "/contacts/upsert" && req.method === "POST") {
      const email = body.email;
      let contact = state.contacts.get(email);
      const isNew = !contact;
      if (!contact) { contactSeq += 1; contact = { id: `contact_${contactSeq}`, tags: new Set(), customFields: [], dnd: false }; state.contacts.set(email, contact); }
      // GHL semantics: `tags` on upsert REPLACES. Our client must never send it.
      if (body.tags) contact.tags = new Set(body.tags);
      if (body.dnd !== undefined) contact.dnd = body.dnd;
      if (body.customFields) contact.customFields = body.customFields;
      return send(res, 200, { new: isNew, contact: { id: contact.id, email }, traceId: "t1" });
    }

    const tagMatch = path.match(/^\/contacts\/([^/]+)\/tags$/);
    if (tagMatch && req.method === "POST") {
      const contact = [...state.contacts.values()].find((c) => c.id === tagMatch[1]);
      if (!contact) return send(res, 404, { message: "no contact" });
      for (const t of body.tags) contact.tags.add(t);
      return send(res, 201, { tags: [...contact.tags] });
    }

    const noteMatch = path.match(/^\/contacts\/([^/]+)\/notes$/);
    if (noteMatch && req.method === "GET") {
      return send(res, 200, { notes: state.notes.filter((n) => n.contactId === noteMatch[1]) });
    }
    if (noteMatch && req.method === "POST") {
      noteSeq += 1;
      const note = { id: `note_${noteSeq}`, contactId: noteMatch[1], body: body.body };
      state.notes.push(note);
      return send(res, 201, { note });
    }

    if (path === "/opportunities/search" && req.method === "GET") {
      const contactId = url.searchParams.get("contactId");
      return send(res, 200, { opportunities: state.opportunities.filter((o) => o.contactId === contactId), meta: {} });
    }
    if (path === "/opportunities/" && req.method === "POST") {
      oppSeq += 1;
      const opp = { id: `opp_${oppSeq}`, name: body.name, contactId: body.contactId, pipelineId: body.pipelineId, pipelineStageId: body.pipelineStageId, status: body.status, monetaryValue: body.monetaryValue };
      state.opportunities.push(opp);
      return send(res, 201, { opportunity: opp });
    }

    if (path === "/workflow-hook" && req.method === "POST") {
      state.workflowEvents.push({ body, headers: req.headers });
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { message: `unhandled ${req.method} ${path}` });
  });
});

const PORT = Number(process.env.MOCK_GHL_PORT ?? 4599);
server.listen(PORT, () => console.log(`Mock GoHighLevel listening on ${PORT}`));
