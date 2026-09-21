import { chromium } from "playwright";
import {
  MIN_ACTION,
  answer,
  auditLayout,
  cont,
  makeChecker,
  pick,
  report,
} from "./_helpers.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";

/** The five widths named in the design directive. */
const VIEWPORTS = [
  { name: "360 (small phone)", width: 360, height: 640 },
  { name: "390 (iPhone)", width: 390, height: 844 },
  { name: "430 (large phone)", width: 430, height: 932 },
  { name: "768 (tablet)", width: 768, height: 1024 },
  { name: "1440 (desktop)", width: 1440, height: 900 },
];

const { problems, check } = makeChecker();
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  console.log(`\n### ${vp.name}`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await auditLayout(page, check, "landing");

  // Primary actions are at least 52px tall.
  const heroCta = page
    .locator("main section")
    .first()
    .getByRole("link", { name: "Find My Growth Plan" })
    .first();
  const heroBox = await heroCta.boundingBox();
  check(
    (heroBox?.height ?? 0) >= MIN_ACTION - 0.5,
    `landing: hero CTA is >= ${MIN_ACTION}px (${heroBox?.height?.toFixed(1)})`,
  );

  // Alternating surfaces: the page should use light, tint and dark bands.
  const surfaces = await page.evaluate(() =>
    [...document.querySelectorAll("main > section")].map((s) =>
      s.className.match(/surface-(light|tint|dark)/)?.[1] ?? "none",
    ),
  );
  const adjacentRepeat = surfaces.find((s, i) => i > 0 && s === surfaces[i - 1]);
  check(
    new Set(surfaces).size >= 3 && surfaces.includes("dark") && !adjacentRepeat,
    `landing: surfaces alternate with no repeats (${surfaces.join(" → ")})`,
  );

  // Sticky mobile CTA: hidden at the top, revealed after the hero CTA leaves.
  const stickyHiddenAtTop = await page.evaluate(() => {
    const el = document.querySelector('[aria-hidden="true"].fixed.inset-x-0.bottom-0');
    return el ? getComputedStyle(el).opacity === "0" : "absent";
  });
  await page.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }));
  await page.waitForTimeout(400);
  const stickyShown = await page.evaluate(() => {
    const el = document.querySelector(".fixed.inset-x-0.bottom-0");
    if (!el) return "absent";
    return { hidden: el.getAttribute("aria-hidden"), opacity: getComputedStyle(el).opacity };
  });

  if (vp.width < 1024) {
    check(stickyHiddenAtTop === true, "landing: sticky CTA hidden while the hero CTA is visible");
    check(
      stickyShown !== "absent" && stickyShown.opacity === "1",
      `landing: sticky CTA appears after the hero CTA scrolls away (${JSON.stringify(stickyShown)})`,
    );
    // It must not cover the footer.
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
    );
    await page.waitForTimeout(400);
    const clearsFooter = await page.evaluate(() => {
      const footer = document.querySelector("footer");
      const sticky = document.querySelector(".fixed.inset-x-0.bottom-0");
      if (!footer || !sticky) return "missing";
      const f = footer.getBoundingClientRect();
      const s = sticky.getBoundingClientRect();
      return f.bottom <= s.top + 1 ? "clear" : `overlap ${f.bottom.toFixed(0)} vs ${s.top.toFixed(0)}`;
    });
    check(clearsFooter === "clear", `landing: sticky CTA never covers the footer (${clearsFooter})`);
  } else {
    const hiddenOnDesktop = await page.evaluate(() => {
      const el = document.querySelector(".fixed.inset-x-0.bottom-0");
      return el ? getComputedStyle(el).display === "none" : "absent";
    });
    check(hiddenOnDesktop === true, "landing: sticky CTA is not shown on desktop");
  }

  // --- Assessment ---
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await auditLayout(page, check, "assessment step 1");

  const continueBtn = page.getByRole("button", { name: "Continue" });
  check(await continueBtn.isVisible(), "assessment: a visible Continue action is always present");
  check(await continueBtn.isDisabled(), "assessment: Continue is disabled until an answer is given");
  const contBox = await continueBtn.boundingBox();
  check(
    (contBox?.height ?? 0) >= MIN_ACTION - 0.5,
    `assessment: Continue is >= ${MIN_ACTION}px (${contBox?.height?.toFixed(1)})`,
  );

  // Every option must be reachable and operable from the keyboard alone.
  await page.keyboard.press("Tab");
  const reached = await page.evaluate(() => {
    let guard = 0;
    return new Promise((resolve) => {
      const check = () => {
        const el = document.activeElement;
        if (el && (el.getAttribute("role") === "radio" || el.getAttribute("role") === "checkbox")) {
          resolve(true);
          return;
        }
        if (guard++ > 20) resolve(false);
        else requestAnimationFrame(check);
      };
      check();
    });
  });
  if (!reached) {
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const role = await page.evaluate(() => document.activeElement?.getAttribute("role"));
      if (role === "radio" || role === "checkbox") break;
    }
  }
  const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  check(
    focusedRole === "radio",
    `assessment: options are reachable by keyboard (focused role: ${focusedRole})`,
  );

  // No auto-advance: selecting must not move the screen on its own.
  await pick(page, "Contractors & Builders");
  await page.waitForTimeout(400);
  const stillOnQ1 = await page.locator("h1").textContent();
  check(
    stillOnQ1?.includes("What kind of business are you growing?") === true,
    "assessment: selecting an answer does NOT auto-advance",
  );
  check(await continueBtn.isEnabled(), "assessment: Continue enables once an answer is given");

  // Desktop: two columns, with the step column held to a readable measure.
  const asideVisible = await page.locator("aside").isVisible().catch(() => false);
  if (vp.width >= 1024) {
    check(asideVisible, "desktop: two-column layout with a context column");
    const stepWidth = await page
      .locator(".container-step")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    check(
      stepWidth >= 420 && stepWidth <= 580,
      `desktop: step column stays in the 440–560px band (${stepWidth.toFixed(0)}px)`,
    );
  } else {
    check(!asideVisible, "mobile/tablet: single column, the question owns the viewport");
  }

  check(errors.length === 0, `no console errors${errors.length ? `: ${errors[0]}` : ""}`);
  await ctx.close();
}

// --- All four audience paths, end to end -------------------------------
console.log("\n### Full funnel walk, all four audiences");
const AUDIENCES = [
  { id: "contractor-builder", goalLabel: "Estimate requests" },
  { id: "home-services", goalLabel: "Booked appointments" },
  { id: "local-business", goalLabel: "Repeat customers" },
  { id: "real-estate", goalLabel: "Seller consultations" },
];

for (const aud of AUDIENCES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/assessment?audience=${aud.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");

  const q2 = await page.locator("h1").textContent();
  check(
    q2?.includes("Where are opportunities getting stuck?") === true,
    `${aud.id}: a preselected audience opens on question 2`,
  );

  await answer(page, "People inquire, but follow-up is inconsistent");

  // Multi-select: the instruction must be explicit.
  const multiHelp = await page.locator("h1 + p").textContent();
  check(
    multiHelp?.includes("Select all that apply.") === true,
    `${aud.id}: multi-select says "Select all that apply."`,
  );
  await pick(page, "Referrals", true);
  await pick(page, "Google / Website", true);
  await cont(page);

  await answer(page, "We handle it manually through calls, texts, or DMs");

  const goalQ = await page.locator("h1").textContent();
  const expected =
    aud.id === "real-estate" ? "What do you want to improve first?" : "What do you want more of?";
  check(goalQ?.includes(expected) === true, `${aud.id}: goal question is "${expected}"`);
  await answer(page, aud.goalLabel, true);

  await answer(page, "Yes, we need production support");
  await answer(page, "As soon as practical");

  const heading = await page.locator("h1").textContent();
  check(
    heading?.includes("Here's your suggested starting point") === true,
    `${aud.id}: the result is shown before contact details are requested`,
  );
  const recTitle = await page.locator("article h2").first().textContent();
  check(
    recTitle?.includes("Sales & Follow-Up System") === true,
    `${aud.id}: recommends Sales & Follow-Up System (got "${recTitle}")`,
  );
  check(
    await page.getByText("optional add-on").first().isVisible(),
    `${aud.id}: production is shown as an optional add-on`,
  );
  check(
    await page.getByText(aud.goalLabel, { exact: true }).first().isVisible(),
    `${aud.id}: the selected goal is echoed back`,
  );

  await auditLayout(page, check, `${aud.id} result`);
  check(errors.length === 0, `${aud.id}: no page errors${errors.length ? `: ${errors[0]}` : ""}`);
  await ctx.close();
}

await browser.close();
report(problems);
