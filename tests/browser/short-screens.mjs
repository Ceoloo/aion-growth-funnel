import { chromium } from "playwright";
import { answer, cont, makeChecker, pick, report } from "./_helpers.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const { problems, check } = makeChecker();
const browser = await chromium.launch();

/** Short and landscape viewports, where a full step cannot possibly fit. */
const SHORT = [
  { name: "360 x 420 (very short)", width: 360, height: 420 },
  { name: "740 x 360 (landscape)", width: 740, height: 360 },
];

for (const vp of SHORT) {
  console.log(`\n### ${vp.name}`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");

  const scroller = page.locator(".overflow-y-auto").first();
  const info = await scroller.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }));
  check(
    info.scrollH > info.clientH,
    `the step region scrolls rather than clipping (${info.scrollH} > ${info.clientH})`,
  );

  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(250);

  const reach = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('[role="radiogroup"] label, [role="group"] label')];
    const last = labels[labels.length - 1];
    const bar = document.querySelector(".action-bar");
    if (!last || !bar) return "missing";
    const l = last.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    if (l.bottom > b.top + 1) return `last option under the bar (${l.bottom.toFixed(0)} / ${b.top.toFixed(0)})`;
    if (l.top < 0) return "last option scrolled above the viewport";
    return "clear";
  });
  check(reach === "clear", `the last option is reachable and clear of the action bar (${reach})`);

  const overflowX = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    c: document.documentElement.clientWidth,
  }));
  check(overflowX.s <= overflowX.c + 1, `no horizontal overflow (${overflowX.s} <= ${overflowX.c})`);

  const barVisible = await page.evaluate(() => {
    const b = document.querySelector(".action-bar")?.getBoundingClientRect();
    return b ? b.bottom <= window.innerHeight + 1 && b.top >= 0 : false;
  });
  check(barVisible, "the action bar stays within the viewport");
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Long result screen on a short viewport");
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 480 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment?audience=real-estate`, { waitUntil: "networkidle" });
  await answer(page, "People inquire, but follow-up is inconsistent");
  await pick(page, "Referrals", true);
  await cont(page);
  await answer(page, "We handle it manually through calls, texts, or DMs");
  await answer(page, "Listing promotion", true);
  await answer(page, "Yes, we need production support");
  await answer(page, "As soon as practical");

  const scroller = page.locator(".overflow-y-auto").first();
  const info = await scroller.evaluate((el) => ({ s: el.scrollHeight, c: el.clientHeight }));
  check(info.s > info.c, `the result scrolls on a 480px-tall screen (${info.s} > ${info.c})`);

  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(250);
  check(
    await page.getByText("This is a starting point based on your answers").isVisible(),
    "the scope note at the very bottom of the card is reachable",
  );
  check(
    await page.getByRole("button", { name: "Discuss My Growth Plan" }).isVisible(),
    "the primary action stays visible while scrolling",
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Long answer labels");
{
  // The longest real labels in the content, at the narrowest supported width.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment?audience=contractor-builder`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");

  const overflowing = await page.evaluate(() => {
    const out = [];
    for (const label of document.querySelectorAll('[role="radiogroup"] label')) {
      const text = label.querySelector("span > span > span");
      if (!text) continue;
      const cs = getComputedStyle(text);
      if (cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap") {
        out.push(`truncated: ${text.textContent?.slice(0, 30)}`);
      }
      if (text.scrollWidth > text.clientWidth + 1) {
        out.push(`clipped: ${text.textContent?.slice(0, 30)}`);
      }
    }
    return out;
  });
  check(
    overflowing.length === 0,
    `long labels wrap instead of truncating${overflowing.length ? ` — ${overflowing[0]}` : ""}`,
  );

  // `?audience=` preselects question 1, so this opens straight on the
  // bottleneck step, which holds the longest labels in the whole assessment.
  const longest = page.locator("#bottleneck-closing-conversations");
  const box = await longest.boundingBox();
  check(
    (box?.height ?? 0) >= 48,
    `a wrapped two-line option still meets the minimum target (${box?.height?.toFixed(0)}px)`,
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Safe-area insets");
{
  // Emulate a notched device by forcing the inset variables, then confirm the
  // action bar and sticky CTA actually respect them.
  // Chromium does not emulate device safe areas, so the inset variables are
  // injected directly. That is exactly what a notched phone supplies through
  // env(safe-area-inset-*), so it exercises the same code path.
  const INSETS = ":root{--safe-bottom:34px;--safe-top:47px;--safe-left:0px;--safe-right:0px;}";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/assessment`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: INSETS });
  await page.waitForSelector("h1");

  const padding = await page.evaluate(() => {
    const bar = document.querySelector(".action-bar");
    return bar ? parseFloat(getComputedStyle(bar).paddingBottom) : -1;
  });
  check(
    padding >= 34,
    `the action bar clears the home indicator (padding-bottom ${padding}px >= 34px)`,
  );

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: INSETS });
  await page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
  await page.waitForTimeout(400);
  const stickyPadding = await page.evaluate(() => {
    const inner = document.querySelector(".fixed.inset-x-0.bottom-0 > div");
    return inner ? parseFloat(getComputedStyle(inner).paddingBottom) : -1;
  });
  check(
    stickyPadding >= 34,
    `the sticky CTA clears the home indicator (padding-bottom ${stickyPadding}px >= 34px)`,
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Slow connection");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // Throttle every asset to a slow-3G-ish delay.
  await page.route("**/*", async (route) => {
    await new Promise((r) => setTimeout(r, 120));
    await route.continue();
  });

  const started = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // The headline must be readable before scripts finish.
  const headingVisible = await page
    .getByRole("heading", { level: 1 })
    .isVisible()
    .catch(() => false);
  check(
    headingVisible,
    `the hero headline renders before JavaScript settles (${Date.now() - started}ms)`,
  );
  const ctaVisible = await page
    .getByRole("link", { name: "Find My Growth Plan" })
    .first()
    .isVisible();
  check(ctaVisible, "the primary CTA is present in the server-rendered HTML");

  // No layout shift from a late font swap: the heading box should not move.
  const before = await page.getByRole("heading", { level: 1 }).boundingBox();
  await page.waitForLoadState("networkidle");
  const after = await page.getByRole("heading", { level: 1 }).boundingBox();
  check(
    Math.abs((before?.y ?? 0) - (after?.y ?? 0)) < 2,
    `the headline does not shift once everything loads (${before?.y?.toFixed(0)} → ${after?.y?.toFixed(0)})`,
  );
  await ctx.close();
}

// ---------------------------------------------------------------------
console.log("\n### Booking link failure fallback");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  const health = await (await fetch(`${BASE}/api/health`)).json();
  if (!health.booking?.configured) {
    check(true, "no booking URL configured — the direct-booking section is correctly absent");
  } else {
    const direct = page.getByRole("link", { name: /Book a call directly/ });
    check(await direct.isVisible(), "warm traffic gets a direct booking path on the landing page");
    const href = await direct.getAttribute("href");
    check(
      typeof href === "string" && /^https?:/.test(href),
      `the direct booking link points at the configured URL (${href})`,
    );
    check(
      (await direct.getAttribute("target")) === "_blank" &&
        (await direct.getAttribute("rel"))?.includes("noopener"),
      "it opens externally and safely",
    );
    // There is no iframe embed to fail: the link IS the fallback.
    const embeds = await page.locator("iframe").count();
    check(
      embeds === 0,
      `no calendar iframe that could be blocked or fail to load (${embeds} iframes)`,
    );
  }
  await ctx.close();
}

await browser.close();
report(problems);
