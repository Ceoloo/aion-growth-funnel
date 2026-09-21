import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws when it is not resolved through Next's
      // react-server condition. Tests run these modules directly in Node, so
      // the guard is stubbed out here; it still protects the real build.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The .mjs harnesses under tests/browser and tests/integration drive a
    // real server and are run on demand — see tests/browser/README.md.
    exclude: ["tests/browser/**", "tests/integration/**", "node_modules/**"],
    globals: false,
    env: { AION_LOG_SILENT: "1" },
  },
});
