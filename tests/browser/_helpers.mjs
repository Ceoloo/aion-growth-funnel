/**
 * Shared helpers for the browser harnesses.
 *
 * Option labels also appear in the desktop answer-summary aside (present in
 * the DOM but hidden below `lg`), so every option click is scoped to the
 * active question's group — a single-select renders a `radiogroup`, a
 * multi-select a plain `group`.
 */

export const MIN_TARGET = 48;
export const MIN_ACTION = 52;

export function questionGroup(page) {
  return page.locator('[role="radiogroup"], [role="group"]').first();
}

/**
 * Selects an option. Selection never auto-advances — call `cont` to move on.
 *
 * Targets the control by role and accessible name rather than by its visible
 * text: the control is stretched across the whole card (so the card is the
 * real hit area), which means a text-targeted click is intercepted. Going
 * through the accessible name also asserts that each option actually has one.
 */
export async function pick(page, label, exact = false) {
  const name = exact ? new RegExp(`^${escapeRe(label)}`) : new RegExp(escapeRe(label));
  const group = questionGroup(page);
  const radio = group.getByRole("radio", { name });
  const control = (await radio.count()) > 0 ? radio : group.getByRole("checkbox", { name });
  await control.first().click();
  await page.waitForTimeout(120);
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Presses the primary Continue action and waits for the step transition. */
export async function cont(page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(320);
}

/** Selects an option and continues, for steps where one answer is enough. */
export async function answer(page, label, exact = false) {
  await pick(page, label, exact);
  await cont(page);
}

export function makeChecker() {
  const problems = [];
  const check = (ok, message) => {
    if (!ok) problems.push(message);
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${message}`);
  };
  return { problems, check };
}

/** Fails on horizontal overflow and on any interactive target under 48px. */
export async function auditLayout(page, check, label) {
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  check(
    overflow.scrollW <= overflow.clientW + 1,
    `${label}: no horizontal overflow (${overflow.scrollW} <= ${overflow.clientW})`,
  );

  const small = await page.evaluate((min) => {
    const out = [];
    const selector = 'a[href], button, input:not([type=hidden]), summary, label:has(input)';
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (r.height < min - 0.5) {
        out.push(`${el.tagName}.${String(el.className).slice(0, 28)} h=${r.height.toFixed(1)}`);
      }
    }
    return out;
  }, MIN_TARGET);

  check(
    small.length === 0,
    `${label}: every interactive target >= ${MIN_TARGET}px${
      small.length ? ` — ${small.slice(0, 4).join("; ")}` : ""
    }`,
  );
}

export function report(problems) {
  console.log("\n" + "=".repeat(62));
  if (problems.length === 0) {
    console.log("ALL CHECKS PASSED");
  } else {
    console.log(`${problems.length} PROBLEM(S):`);
    problems.forEach((p) => console.log(" - " + p));
    process.exitCode = 1;
  }
}
