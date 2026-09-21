import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const VIEWPORTS = [
  { name: "360 (small phone)", width: 360, height: 640 },
  { name: "390 (iPhone)", width: 390, height: 844 },
  { name: "768 (tablet)", width: 768, height: 1024 },
  { name: "1440 (desktop)", width: 1440, height: 900 },
];

const problems = [];
function check(ok, message) {
  if (!ok) problems.push(message);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${message}`);
}

async function auditPage(page, label) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scrollW: d.scrollWidth, clientW: d.clientWidth };
  });
  check(
    overflow.scrollW <= overflow.clientW + 1,
    `${label}: no horizontal overflow (scrollW ${overflow.scrollW} <= clientW ${overflow.clientW})`,
  );

  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(
      'a[href], button, input:not([type=hidden]), summary, label:has(input)',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // hidden
      if (el.closest('[aria-hidden="true"]')) continue; // honeypot
      if (r.height < 44 - 0.5) {
        out.push(`${el.tagName}.${el.className?.toString().slice(0, 25)} h=${r.height.toFixed(1)}`);
      }
    }
    return out;
  });
  check(small.length === 0, `${label}: all tap targets >= 44px${small.length ? ` — ${small.slice(0,4).join("; ")}` : ""}`);
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  console.log(`\n### ${vp.name}`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await auditPage(page, "landing");

  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await auditPage(page, "assessment step 1");

  // Desktop two-column adaptation.
  const asideVisible = await page.locator("aside").isVisible().catch(() => false);
  if (vp.width >= 1024) {
    check(asideVisible, "desktop: two-column layout with brand/summary aside");
  } else {
    check(!asideVisible, "mobile/tablet: single column, question owns the viewport");
  }

  check(errors.length === 0, `no console errors${errors.length ? `: ${errors[0]}` : ""}`);
  await ctx.close();
}

// --- Walk all four audience paths, end to end ---
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

  // Preselected audience means we open on question 2.
  const q2 = await page.locator("h1").textContent();
  check(
    q2?.includes("Where are opportunities getting stuck?") === true,
    `${aud.id}: preselected audience skips straight to question 2`,
  );

  await page.getByText("People inquire, but follow-up is inconsistent").click();
  await page.waitForTimeout(150);

  // Multi-select needs an explicit Continue.
  await page.getByText("Referrals", { exact: true }).click();
  await page.getByText("Google / Website", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(150);

  await page.getByText("We handle it manually through calls, texts, or DMs").click();
  await page.waitForTimeout(150);

  // Goal wording and options are audience-specific.
  const goalQ = await page.locator("h1").textContent();
  const expectedQ = aud.id === "real-estate" ? "What do you want to improve first?" : "What do you want more of?";
  check(goalQ?.includes(expectedQ) === true, `${aud.id}: goal question is "${expectedQ}"`);
  await page.getByText(aud.goalLabel, { exact: true }).click();
  await page.waitForTimeout(150);

  await page.getByText("Yes, we need production support").click();
  await page.waitForTimeout(150);
  await page.getByText("As soon as practical").click();
  await page.waitForTimeout(250);

  // Result screen, before any contact details are asked for.
  const heading = await page.locator("h1").textContent();
  check(
    heading?.includes("Here's your suggested starting point") === true,
    `${aud.id}: result shown before contact details are requested`,
  );
  const recTitle = await page.locator("article h2").first().textContent();
  check(
    recTitle?.includes("Sales & Follow-Up System") === true,
    `${aud.id}: recommends Sales & Follow-Up System (got "${recTitle}")`,
  );
  const addOn = await page.getByText("optional add-on").first().isVisible();
  check(addOn, `${aud.id}: production shown as an optional add-on`);
  const goalEcho = await page.getByText(aud.goalLabel, { exact: true }).first().isVisible();
  check(goalEcho, `${aud.id}: selected goal echoed back on the result`);

  await auditPage(page, `${aud.id} result`);
  check(errors.length === 0, `${aud.id}: no page errors${errors.length ? `: ${errors[0]}` : ""}`);
  await ctx.close();
}

await browser.close();

console.log(`\n${"=".repeat(60)}`);
if (problems.length === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`${problems.length} PROBLEM(S):`);
  problems.forEach((p) => console.log(` - ${p}`));
  process.exitCode = 1;
}
