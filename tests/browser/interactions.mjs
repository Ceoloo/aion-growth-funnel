import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const problems = [];
const check = (ok, m) => { if (!ok) problems.push(m); console.log(`  ${ok ? "PASS" : "FAIL"}  ${m}`); };

/**
 * Clicks an answer option inside the active question fieldset.
 * The desktop answer-summary aside renders the same labels in the DOM (hidden
 * below lg), so an unscoped text match is ambiguous.
 */
async function pick(page, label, exact = false) {
  await page.getByRole("group").getByText(label, exact ? { exact: true } : undefined).click();
  await page.waitForTimeout(160);
}

const browser = await chromium.launch();

// ---------- Back navigation preserves answers ----------
console.log("\n### Back navigation and answer preservation");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });

  await pick(page, "Home Services");
  await pick(page, "Not enough qualified inquiries");
  await pick(page, "Referrals", true);
  await pick(page, "Paid ads", true);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(150);
  await pick(page, "We have a CRM and a consistent process");

  // Walk back three screens.
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForTimeout(150);
  }
  const h1 = await page.locator("h1").textContent();
  check(h1?.includes("Where are opportunities getting stuck?") === true,
    `back x3 lands on question 2 (got "${h1?.slice(0, 40)}")`);

  const bottleneckChecked = await page.locator('input[value="not-enough-inquiries"]').isChecked();
  check(bottleneckChecked, "question 2 answer still selected after going back");

  // Forward again: the multi-select must still hold BOTH channels.
  await pick(page, "Not enough qualified inquiries");
  const referrals = await page.locator('input[value="referrals"]').isChecked();
  const paidAds = await page.locator('input[value="paid-ads"]').isChecked();
  check(referrals && paidAds, "multi-select keeps every channel chosen earlier");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(150);
  const followUp = await page.locator('input[value="crm-consistent"]').isChecked();
  check(followUp, "later single-select answer preserved too");

  // Progress must reflect the real branch.
  const bar = page.locator('[role="progressbar"]');
  check(await bar.getAttribute("aria-valuemax") === "7", "progress total matches the 7-question branch");
  check(await bar.getAttribute("aria-valuenow") === "4", "progress position is correct on question 4");

  await ctx.close();
}

// ---------- Changing audience clears an impossible goal ----------
console.log("\n### Audience change invalidates an impossible goal");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment?audience=real-estate`, { waitUntil: "networkidle" });
  await pick(page, "Not enough qualified inquiries");
  await pick(page, "Referrals", true);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(150);
  await pick(page, "We have a CRM and a consistent process");
  await pick(page, "Seller consultations", true);

  // Walk back to question 1 and switch to a non-real-estate audience.
  for (let i = 0; i < 8; i += 1) {
    const h = await page.locator("h1").textContent();
    if (h?.includes("What kind of business are you growing?")) break;
    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForTimeout(140);
  }
  await pick(page, "Local Businesses");

  // Everything else survives; only the now-impossible goal is cleared.
  const bottleneck = await page.locator('input[value="not-enough-inquiries"]').isChecked();
  check(bottleneck, "unrelated answers survive an audience change");

  await pick(page, "Not enough qualified inquiries");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(150);
  await pick(page, "We have a CRM and a consistent process");
  const goalQ = await page.locator("h1").textContent();
  check(goalQ?.includes("What do you want more of?") === true, "goal question switches to the general wording");
  const anyGoalChecked = await page.locator('fieldset input:checked').count();
  check(anyGoalChecked === 0, "the real-estate goal was cleared, not silently kept");
  await ctx.close();
}

// ---------- Contact validation + successful submission ----------
console.log("\n### Contact step: validation, keyboards, consent, submission");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment?audience=contractor-builder`, { waitUntil: "networkidle" });
  for (const label of ["People inquire, but follow-up is inconsistent"]) {
    await page.getByText(label).click(); await page.waitForTimeout(140);
  }
  await pick(page, "Referrals", true);
  await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(140);
  await pick(page, "We handle it manually through calls, texts, or DMs");
  await pick(page, "Estimate requests", true);
  await pick(page, "We already have usable content");
  await pick(page, "As soon as practical");

  await page.getByRole("button", { name: "Discuss My Growth Plan" }).click();
  await page.waitForTimeout(250);

  // Required-field validation blocks submission.
  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForTimeout(200);
  check(await page.getByText("Please check the highlighted fields.").first().isVisible(),
    "required-field validation blocks an empty submission");

  // Mobile keyboard hints.
  check(await page.locator('input[name="email"]').getAttribute("inputmode") === "email", 'email field uses inputmode="email"');
  check(await page.locator('input[name="phone"]').getAttribute("inputmode") === "tel", 'phone field uses inputmode="tel"');
  check(await page.locator('input[name="website"]').getAttribute("inputmode") === "url", 'website field uses inputmode="url"');
  check(await page.locator('input[name="fullName"]').getAttribute("autocomplete") === "name", "autocomplete tokens set for autofill");

  // Consent box is optional and starts unchecked.
  const consent = page.locator('input[type="checkbox"]').last();
  check(!(await consent.isChecked()), "marketing consent checkbox starts unchecked");

  // Sticky bar must not cover a focused input.
  await page.locator('input[name="website"]').focus();
  await page.waitForTimeout(200);
  const covered = await page.evaluate(() => {
    const input = document.querySelector('input[name="website"]');
    const bar = document.querySelector(".aion-sticky-actions");
    if (!input || !bar) return "missing";
    const i = input.getBoundingClientRect(), b = bar.getBoundingClientRect();
    return i.bottom <= b.top + 1 ? "clear" : `overlap: input bottom ${i.bottom.toFixed(0)} vs bar top ${b.top.toFixed(0)}`;
  });
  check(covered === "clear", `focused input is not covered by the sticky action bar (${covered})`);

  // Fill in and submit for real.
  await page.locator('input[name="fullName"]').fill("Jordan Avery");
  await page.locator('input[name="email"]').fill("jordan@averybuild.test");
  await page.locator('input[name="businessName"]').fill("Avery Build Co");
  await page.locator('input[name="phone"]').fill("+15555551234");
  await consent.check();
  await page.waitForTimeout(1600); // clear the minimum-dwell guard
  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForSelector("text=Your request has been received", { timeout: 10000 });

  check(true, "confirmation screen shown only after the server accepted it");
  check(await page.getByText("Sales & Follow-Up System").first().isVisible(), "confirmation repeats the recommended service");
  check(await page.getByText("Review how inquiries reach you today").isVisible(), "strategy-call agenda shown");
  // Which branch is correct depends on whether a booking URL is configured on
  // the server, so assert against that rather than assuming one of them.
  const health = await (await fetch(`${BASE}/api/health`)).json();
  if (health.booking?.configured) {
    const link = page.getByRole("link", { name: "Pick a time for the call" });
    check(await link.isVisible(), "configured booking link is offered");
    const href = await link.getAttribute("href");
    check(
      typeof href === "string" && /^https?:/.test(href) && !href.includes("@"),
      `booking link uses the configured URL and carries no contact details (${href})`,
    );
    check(await link.getAttribute("target") === "_blank",
      "booking link opens externally, with a visible fallback URL beneath it");
  } else {
    check(await page.getByText("We'll reach out to arrange a time.").isVisible(),
      "with no booking link configured, an honest message is shown instead of a fake URL");
  }

  // Completed assessment state must be cleared.
  const stored = await page.evaluate(() => sessionStorage.getItem("aion.assessment.v1"));
  check(stored === null, "assessment answers cleared from sessionStorage after submission");
  const all = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)));
  check(!all.includes("jordan@averybuild.test") && !all.includes("Jordan Avery"),
    "contact details never written to browser storage");
  await ctx.close();
}

// ---------- Submission failure is surfaced, not hidden ----------
console.log("\n### Submission failure handling");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route("**/api/leads", (route) =>
    route.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "storage_unavailable", message: "We couldn't save your request just now.", retryable: true, contactEmail: "hello@aion.test" }) }));

  await page.goto(`${BASE}/assessment?audience=local-business`, { waitUntil: "networkidle" });
  await pick(page, "We don't have a clear process yet");
  await pick(page, "Referrals", true);
  await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(140);
  await pick(page, "We have tools, but the process is inconsistent");
  await pick(page, "Visibility and trust", true);
  await pick(page, "Maybe — help us decide");
  await pick(page, "Just exploring");

  const rec = await page.locator("article h2").first().textContent();
  check(rec?.includes("Discovery-Led Foundation Review") === true,
    `unclear answers produce a discovery-led review (got "${rec}")`);

  await page.getByRole("button", { name: "Discuss My Growth Plan" }).click(); await page.waitForTimeout(200);
  await page.locator('input[name="fullName"]').fill("Sam Ortiz");
  await page.locator('input[name="email"]').fill("sam@ortiz.test");
  await page.locator('input[name="businessName"]').fill("Ortiz Studio");
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForTimeout(600);

  check(await page.getByText("We couldn't send that just now").isVisible(), "failure is shown to the visitor");
  check(!(await page.getByText("Your request has been received").isVisible().catch(() => false)),
    "NO success screen is shown when the server rejected the submission");
  check(await page.getByText("hello@aion.test").isVisible(), "an alternate contact route is offered on failure");
  await ctx.close();
}

// ---------- Reduced motion ----------
console.log("\n### Reduced motion");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  const durations = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      const a = parseFloat(cs.animationDuration) || 0;
      const t = parseFloat(cs.transitionDuration) || 0;
      if (a > 0.01 || t > 0.01) out.push(`${el.tagName} a=${a} t=${t}`);
    }
    return out;
  });
  check(durations.length === 0, `no animation or transition runs under prefers-reduced-motion${durations.length ? ` — ${durations[0]}` : ""}`);
  check(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) === "auto",
    "smooth scrolling disabled under reduced motion");
  await ctx.close();
}

// ---------- Keyboard navigation ----------
console.log("\n### Keyboard navigation");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await page.locator('input[value="contractor-builder"]').focus();
  await page.keyboard.press("ArrowDown"); // native radio-group behaviour
  await page.waitForTimeout(300);
  const h1 = await page.locator("h1").textContent();
  check(h1?.includes("Where are opportunities getting stuck?") === true,
    "arrow-key selection in the radio group advances the funnel");
  await ctx.close();
}

await browser.close();
console.log("\n" + "=".repeat(60));
if (problems.length === 0) console.log("ALL CHECKS PASSED");
else { console.log(`${problems.length} PROBLEM(S):`); problems.forEach(p => console.log(" - " + p)); process.exitCode = 1; }
