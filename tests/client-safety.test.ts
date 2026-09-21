import { readdirSync, readFileSync, statSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SERVER_ONLY_ENV_NAMES } from "@/lib/env";

/**
 * Static guards against a secret reaching the browser.
 *
 * Two layers are checked:
 *  1. source — no server-only variable is read outside server modules;
 *  2. build output — if `.next` exists, no server-only variable NAME appears
 *     in a client chunk (Next inlines `process.env.X` by name, so the name
 *     appearing there would mean the value was inlined too).
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Files allowed to read server-only variables. */
function isServerModule(file: string): boolean {
  const rel = file.replace(`${process.cwd()}/`, "");
  return (
    rel.startsWith("src/lib/env.ts") ||
    rel.startsWith("src/lib/store/") ||
    rel.startsWith("src/lib/ghl/") ||
    rel.startsWith("src/lib/delivery/") ||
    rel.startsWith("src/app/api/") ||
    rel.startsWith("scripts/")
  );
}

describe("source", () => {
  const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));

  it("reads server-only variables only from server modules", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (isServerModule(file)) continue;
      const source = readFileSync(file, "utf8");
      for (const name of SERVER_ONLY_ENV_NAMES) {
        if (source.includes(`process.env.${name}`)) {
          offenders.push(`${file} reads ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("marks every server module that touches secrets with the server-only guard", () => {
    for (const file of files) {
      const rel = file.replace(`${process.cwd()}/`, "");
      if (!rel.startsWith("src/lib/ghl/") && !rel.startsWith("src/lib/delivery/")) continue;
      // Pure mapping and event modules hold no secrets and are imported by
      // tests directly, so only the modules that read configuration are
      // required to carry the guard.
      const source = readFileSync(file, "utf8");
      if (!source.includes("serverEnv") && !source.includes("resolveGhlConfig")) continue;
      expect(source, `${rel} must import "server-only"`).toContain('import "server-only"');
    }
  });

  it("exposes only genuinely public values through the public config", () => {
    const source = readFileSync(join(SRC, "lib/public-config.ts"), "utf8");
    const referenced = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    for (const name of referenced) {
      expect(name?.startsWith("NEXT_PUBLIC_")).toBe(true);
    }
  });

  it("keeps contact details out of browser persistence", () => {
    const sessionSource = readFileSync(join(SRC, "lib/session-answers.ts"), "utf8");
    for (const field of ["fullName", "email", "businessName", "phone", "website"]) {
      expect(sessionSource).not.toContain(`"${field}"`);
    }
    // Nothing anywhere actually uses localStorage; answers live in
    // sessionStorage so they do not outlive the tab. (Mentions in comments
    // are fine — this looks for real calls.)
    const localStorageUse = /\blocalStorage\s*\.\s*(set|get|remove)Item/;
    const offenders = walk(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => localStorageUse.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(`${process.cwd()}/`, ""));
    expect(offenders).toEqual([]);
  });
});

describe("build output", () => {
  const staticDir = join(process.cwd(), ".next", "static");

  it.runIf(existsSync(staticDir))(
    "contains no server-only variable names in client chunks",
    () => {
      const chunks = walk(staticDir).filter((f) => f.endsWith(".js"));
      expect(chunks.length).toBeGreaterThan(0);

      const offenders: string[] = [];
      for (const chunk of chunks) {
        const source = readFileSync(chunk, "utf8");
        for (const name of SERVER_ONLY_ENV_NAMES) {
          if (source.includes(name)) offenders.push(`${chunk} mentions ${name}`);
        }
      }
      expect(offenders).toEqual([]);
    },
  );
});
