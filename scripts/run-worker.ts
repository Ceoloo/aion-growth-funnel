/**
 * Processes one batch of due submissions and exits.
 *
 * Use this from a cron entry, a CI schedule, or a `while true` loop on a box
 * you control. The HTTP endpoint at /api/jobs/process-deliveries does the same
 * thing for platforms whose scheduler makes an HTTP request.
 *
 *   npm run worker:once
 *   npm run worker:once -- --limit 25
 */
import { processDueSubmissions } from "../src/lib/delivery/runner";
import { getStore } from "../src/lib/store";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const limitArg = argValue("--limit");
  const limit = limitArg ? Number(limitArg) : undefined;

  const result = await processDueSubmissions({
    limit: Number.isFinite(limit) ? limit : undefined,
    budgetMs: 120_000,
  });

  const delivered = result.outcomes.filter((o) => o.status === "delivered").length;
  const needsOperator = result.outcomes.filter((o) => o.status === "needs_operator");
  const retrying = result.outcomes.filter((o) => o.status === "received");

  console.log(
    `Claimed ${result.claimed} · delivered ${delivered} · retrying ${retrying.length} · needs operator ${needsOperator.length}`,
  );
  for (const outcome of needsOperator) {
    console.warn(`  ${outcome.submissionId}: ${outcome.error ?? "see logs"}`);
  }

  const store = await getStore();
  await store.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
