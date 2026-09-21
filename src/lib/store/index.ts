import "server-only";
import { serverEnv } from "../env";
import { PostgresSubmissionStore } from "./postgres";
import { SqliteSubmissionStore } from "./sqlite";
import { StoreNotConfiguredError, type SubmissionStore } from "./types";

/**
 * Resolves the configured durable store.
 *
 * There is deliberately no fallback to memory. If durable storage is not
 * configured, the lead endpoint reports that it cannot accept submissions
 * rather than accepting a lead it would then drop.
 */

let cached: Promise<SubmissionStore> | null = null;

function selectDriver(): "postgres" | "sqlite" {
  const explicit = serverEnv.storeDriver;
  if (explicit === "postgres" || explicit === "sqlite") return explicit;
  if (explicit !== undefined) {
    throw new StoreNotConfiguredError(
      `LEAD_STORE_DRIVER="${explicit}" is not a supported driver. Use "postgres" or "sqlite".`,
    );
  }
  if (serverEnv.databaseUrl) return "postgres";
  if (serverEnv.sqlitePath) return "sqlite";
  throw new StoreNotConfiguredError(
    "No durable lead store is configured. Set DATABASE_URL (recommended) or LEAD_STORE_SQLITE_PATH.",
  );
}

async function create(): Promise<SubmissionStore> {
  const driver = selectDriver();
  if (driver === "postgres") {
    const url = serverEnv.databaseUrl;
    if (!url) {
      throw new StoreNotConfiguredError(
        "LEAD_STORE_DRIVER=postgres requires DATABASE_URL to be set.",
      );
    }
    const store = new PostgresSubmissionStore(url);
    await store.init();
    return store;
  }
  const path = serverEnv.sqlitePath;
  if (!path) {
    throw new StoreNotConfiguredError(
      "LEAD_STORE_DRIVER=sqlite requires LEAD_STORE_SQLITE_PATH to be set.",
    );
  }
  const store = new SqliteSubmissionStore(path);
  await store.init();
  return store;
}

export function getStore(): Promise<SubmissionStore> {
  if (!cached) {
    cached = create().catch((error) => {
      // Do not cache a failed initialisation: a transient database outage
      // should not permanently disable the endpoint.
      cached = null;
      throw error;
    });
  }
  return cached;
}

/** Test seam: inject a store (e.g. the in-memory one) or clear the cache. */
export function __setStoreForTests(store: SubmissionStore | null): void {
  cached = store ? Promise.resolve(store) : null;
}

export * from "./types";
