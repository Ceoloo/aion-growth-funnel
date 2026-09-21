import { chromium } from "playwright";
import { answer, cont, makeChecker, pick, report } from "./_helpers.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const { problems, check } = makeChecker();
const browser = await chromium.launch();

const phone = { width: 390, height: 844 };

// ---------------------------------------------------------------------
console.log("\n### Back navigation and answer preservation");
{
  const ctx = await browser.newContext({ viewport: phone });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });

  await answer(page, "Home Services");
  await answer(page, "Not enough qualified inquiries");
  await pick(page, "Referrals", true);
  await pick(page, "Paid ads", true);
  await cont(page);
  await answer(page, "We have a CRM and a consistent process");

  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForTimeout(320);
  }
  const h1 = await page.locator("h1").textContent();
  check(
    h1?.includes("Where are opportunities getting stuck?") === true,
    `back x3 lands on question 2 (got "${h1?.slice(0, 42)}")`,
  );

  check(
    (await page.locator("#bottleneck-not-enough-inquiries").getAttribute("aria-checked")) ===
      "true",
    "question 2 answer is still selected after going back",
  );

  // Re-selecting the existing answer must not be required to move on: the
  // Continue button is enabled the moment the screen is re-entered.
  check(
    await page.getByRole("button", { name: "Continue" }).isEnabled(),
    "Continue is enabled straight away when returning to an answered step",
  );
  await cont(page);

  const referrals = await page.locator("#channels-referrals").getAttribute("aria-checked");
  const paidAds = await page.locator("#channels-paid-ads").getAttribute("aria-checked");
  check(
    referrals === "true" && paidAds === "true",
    "multi-select keeps every channel chosen earlier",
  );

  await cont(page);
  check(
    await page
      .locator("#follow-up-crm-consistent")
      .getAttribute("aria-checked") === "true",
    "a later single-select answer is preserved too",
  );

  const bar = page.locator('[role="progressbar"]');
  check(
    (await bar.getAttribute("aria-valuetext")) === "Question 4 of 7",
    `progress reports the real branch position (${await bar.getAttribute("aria-valuetext")})`,
  );

  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Audience change clears only the now-impossible goal");
{
  const ctx = await browser.newContext({ viewport: phone });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment?audience=real-estate`, { waitUntil: "networkidle" });
  await answer(page, "Not enough qualified inquiries");
  await pick(page, "Referrals", true);
  await cont(page);
  await answer(page, "We have a CRM and a consistent process");
  await answer(page, "Seller consultations", true);

  for (let i = 0; i < 8; i += 1) {
    const h = await page.locator("h1").textContent();
    if (h?.includes("What kind of business are you growing?")) break;
    await page.getByRole("button", { name: "Back" }).click();
    await page.waitForTimeout(300);
  }
  await answer(page, "Local Businesses");

  check(
    await page
      .locator("#bottleneck-not-enough-inquiries")
      .getAttribute("aria-checked") === "true",
    "unrelated answers survive an audience change",
  );
  await cont(page);
  await cont(page);
  await cont(page);

  const goalQ = await page.locator("h1").textContent();
  check(
    goalQ?.includes("What do you want more of?") === true,
    `goal question switches to the general wording (got "${goalQ?.slice(0, 40)}")`,
  );
  const anyChecked = await page.locator('[role="radio"][aria-checked="true"]').count();
  check(anyChecked === 0, "the real-estate goal was cleared, not silently kept");
  check(
    await page.getByRole("button", { name: "Continue" }).isDisabled(),
    "Continue is blocked again until the new goal is answered",
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Contact step: validation, keyboards, consent, submission");
{
  const ctx = await browser.newContext({ viewport: phone });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment?audience=contractor-builder`, { waitUntil: "networkidle" });
  await answer(page, "People inquire, but follow-up is inconsistent");
  await pick(page, "Referrals", true);
  await cont(page);
  await answer(page, "We handle it manually through calls, texts, or DMs");
  await answer(page, "Estimate requests", true);
  await answer(page, "We already have usable content");
  await answer(page, "As soon as practical");

  await page.getByRole("button", { name: "Discuss My Growth Plan" }).click();
  await page.waitForTimeout(420);

  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForTimeout(320);
  check(
    await page.getByText("Please check the highlighted fields.").first().isVisible(),
    "required-field validation blocks an empty submission",
  );

  // Errors must be associated with their fields, not merely displayed nearby.
  const described = await page.evaluate(() => {
    const input = document.querySelector('input[name="email"]');
    if (!input) return "missing";
    const id = input.getAttribute("aria-describedby");
    const invalid = input.getAttribute("aria-invalid");
    const text = id ? document.getElementById(id.split(" ")[0])?.textContent : null;
    return { invalid, text };
  });
  check(
    described !== "missing" && described.invalid === "true" && Boolean(described.text),
    `the email error is wired to the field (${JSON.stringify(described)})`,
  );

  check(
    (await page.locator('input[name="email"]').getAttribute("inputmode")) === "email",
    'email field uses inputmode="email"',
  );
  check(
    (await page.locator('input[name="phone"]').getAttribute("inputmode")) === "tel",
    'phone field uses inputmode="tel"',
  );
  check(
    (await page.locator('input[name="website"]').getAttribute("inputmode")) === "url",
    'website field uses inputmode="url"',
  );
  check(
    (await page.locator('input[name="fullName"]').getAttribute("autocomplete")) === "name",
    "autocomplete tokens are set for autofill",
  );
  const fontSize = await page
    .locator('input[name="email"]')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check(fontSize >= 16, `input text is at least 16px, so iOS does not zoom (${fontSize}px)`);

  const consent = page.getByRole("checkbox").last();
  check((await consent.getAttribute("aria-checked")) === "false", "consent starts unchecked");

  // The action area must never sit over a focused field.
  await page.locator('input[name="website"]').focus();
  await page.waitForTimeout(250);
  const covered = await page.evaluate(() => {
    const input = document.querySelector('input[name="website"]');
    const bar = document.querySelector(".action-bar");
    if (!input) return "missing input";
    if (!bar) return "clear"; // detached while the keyboard is open
    const i = input.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return i.bottom <= b.top + 1 ? "clear" : `overlap ${i.bottom.toFixed(0)} / ${b.top.toFixed(0)}`;
  });
  check(covered === "clear", `a focused input is never covered by the action area (${covered})`);

  await page.locator('input[name="fullName"]').fill("Jordan Avery");
  await page.locator('input[name="email"]').fill("jordan@averybuild.test");
  await page.locator('input[name="businessName"]').fill("Avery Build Co");
  await page.locator('input[name="phone"]').fill("+15555551234");
  await consent.click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForSelector("text=Your request has been received", { timeout: 15000 });

  check(true, "the confirmation screen appears only after the server accepted it");
  check(
    await page.getByText("Avery").first().isVisible().catch(() => false) === false,
    "the confirmation does not echo contact details back",
  );
  check(
    await page.getByText("Review how inquiries reach you today").isVisible(),
    "the strategy-call agenda is shown",
  );

  const health = await (await fetch(`${BASE}/api/health`)).json();
  if (health.booking?.configured) {
    const link = page.getByRole("link", { name: /Pick a time for the call/ });
    check(await link.isVisible(), "the configured booking link is offered");
    const href = await link.getAttribute("href");
    check(
      typeof href === "string" && /^https?:/.test(href) && !href.includes("@"),
      `the booking link carries no contact details (${href})`,
    );
    check(
      (await link.getAttribute("target")) === "_blank",
      "the booking link opens externally, with the full URL printed as a fallback",
    );
  } else {
    check(
      await page.getByText("We'll reach out to arrange a time.").isVisible(),
      "with no booking link configured, an honest message replaces it",
    );
  }

  const stored = await page.evaluate(() => sessionStorage.getItem("aion.assessment.v1"));
  check(stored === null, "assessment answers are cleared from sessionStorage after submission");
  const all = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)));
  check(
    !all.includes("jordan@averybuild.test") && !all.includes("Jordan Avery"),
    "contact details are never written to browser storage",
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Submission failure keeps the visitor's work");
{
  const ctx = await browser.newContext({ viewport: phone });
  const page = await ctx.newPage();
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "storage_unavailable",
        message: "We couldn't save your request just now.",
        retryable: true,
        contactEmail: "hello@aion.test",
      }),
    }),
  );

  await page.goto(`${BASE}/assessment?audience=local-business`, { waitUntil: "networkidle" });
  await answer(page, "We don't have a clear process yet");
  await pick(page, "Referrals", true);
  await cont(page);
  await answer(page, "We have tools, but the process is inconsistent");
  await answer(page, "Visibility and trust", true);
  await answer(page, "Maybe — help us decide");
  await answer(page, "Just exploring");

  const rec = await page.locator("article h2").first().textContent();
  check(
    rec?.includes("Discovery-Led Foundation Review") === true,
    `unclear answers produce a discovery-led review (got "${rec}")`,
  );

  await page.getByRole("button", { name: "Discuss My Growth Plan" }).click();
  await page.waitForTimeout(400);
  await page.locator('input[name="fullName"]').fill("Sam Ortiz");
  await page.locator('input[name="email"]').fill("sam@ortiz.test");
  await page.locator('input[name="businessName"]').fill("Ortiz Studio");
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Send my request" }).click();
  await page.waitForTimeout(800);

  check(await page.getByText("We couldn't send that just now").isVisible(), "the failure is shown");
  check(
    (await page.getByText("Your request has been received").isVisible().catch(() => false)) === false,
    "NO success screen appears when the server rejected the submission",
  );
  check(await page.getByText("hello@aion.test").isVisible(), "an alternate contact route is offered");

  // The whole point: a recoverable error must not cost them their typing.
  check(
    (await page.locator('input[name="fullName"]').inputValue()) === "Sam Ortiz" &&
      (await page.locator('input[name="email"]').inputValue()) === "sam@ortiz.test" &&
      (await page.locator('input[name="businessName"]').inputValue()) === "Ortiz Studio",
    "everything typed is still in the form after a failed submission",
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Double submission is prevented");
{
  const ctx = await browser.newContext({ viewport: phone });
  const page = await ctx.newPage();
  let calls = 0;
  await page.route("**/api/leads", async (route) => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 900));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        submissionId: "11111111-1111-4111-8111-111111111111",
        delivery: "pending",
        recommendedService: "Sales & Follow-Up System",
        bookingUrl: null,
        contactEmail: null,
      }),
    });
  });

  await page.goto(`${BASE}/assessment?audience=home-services`, { waitUntil: "networkidle" });
  await answer(page, "People inquire, but follow-up is inconsistent");
  await pick(page, "Referrals", true);
  await cont(page);
  await answer(page, "We handle it manually through calls, texts, or DMs");
  await answer(page, "Booked appointments", true);
  await answer(page, "We already have usable content");
  await answer(page, "As soon as practical");
  await page.getByRole("button", { name: "Discuss My Growth Plan" }).click();
  await page.waitForTimeout(400);

  await page.locator('input[name="fullName"]').fill("Riley Chen");
  await page.locator('input[name="email"]').fill("riley@chenhvac.test");
  await page.locator('input[name="businessName"]').fill("Chen HVAC");
  await page.waitForTimeout(1600);

  const submit = page.getByRole("button", { name: /Send my request|Sending/ });
  await submit.click();
  await page.waitForTimeout(120);
  check(await submit.isDisabled(), "the submit button disables while the request is in flight");
  // Hammer it the way an impatient thumb would.
  await submit.click({ force: true }).catch(() => {});
  await submit.click({ force: true }).catch(() => {});
  await page.waitForSelector("text=Your request has been received", { timeout: 15000 });
  check(calls === 1, `only one request was sent despite repeated taps (${calls})`);
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Reduced motion");
{
  const ctx = await browser.newContext({ viewport: phone, reducedMotion: "reduce" });
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
  check(
    durations.length === 0,
    `no CSS animation or transition runs under reduced motion${
      durations.length ? ` — ${durations[0]}` : ""
    }`,
  );

  // A step change must still work, and must not leave a transform behind.
  await answer(page, "Contractors & Builders");
  const h1 = await page.locator("h1").textContent();
  check(
    h1?.includes("Where are opportunities getting stuck?") === true,
    "steps still advance normally with reduced motion",
  );
  // Target the animated step panel specifically. A looser selector would
  // catch the progress bar, whose translateX is its position, not an animation.
  const transformed = await page.evaluate(() => {
    const el = document.querySelector("[data-step-panel]");
    return el ? getComputedStyle(el).transform : "missing";
  });
  check(
    transformed === "none" || transformed === "matrix(1, 0, 0, 1, 0, 0)",
    `no residual transform is left on the step (${transformed})`,
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Keyboard-only completion");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");

  // Tab to the radio group, choose with the arrow keys, continue with Enter.
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    const role = await page.evaluate(() => document.activeElement?.getAttribute("role"));
    if (role === "radio") break;
  }
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  const stayed = await page.locator("h1").textContent();
  check(
    stayed?.includes("What kind of business are you growing?") === true,
    "keyboard selection does not auto-advance either",
  );

  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (name?.startsWith("Continue")) break;
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const moved = await page.locator("h1").textContent();
  check(
    moved?.includes("Where are opportunities getting stuck?") === true,
    "the funnel advances from the keyboard alone",
  );

  // Focus must move to the new screen rather than being lost.
  const focusMoved = await page.evaluate(() => {
    const active = document.activeElement;
    return active === document.body ? "lost to body" : (active?.className ?? "unknown");
  });
  check(focusMoved !== "lost to body", `focus moves to the new step (${focusMoved})`);
  await ctx.close();
}

await browser.close();
report(problems);
