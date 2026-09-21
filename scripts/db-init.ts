/**
 * Creates the lead store schema.
 *
 * Both drivers create their tables on first use, so this script exists mainly
 * to fail fast during setup: run it once after configuring the database and
 * you find out immediately whether the credentials work.
 *
 *   npm run db:init
 */
import { getStore } from "../src/lib/store";

async function main() {
  const store = await getStore();
  console.log(`Lead store ready (driver: ${store.driver}).`);
  await store.close();
}

main().catch((error: unknown) => {
  console.error(
    `Could not initialise the lead store: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});
