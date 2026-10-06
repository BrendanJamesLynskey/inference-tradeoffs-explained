import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // the full-sweep replay runs 350 simulations
    testTimeout: 300_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/tradeoffs/vendor/**"],
      thresholds: {
        // The data views, the animations' frames and the values the prose quotes.
        "src/lib/tradeoffs/**": {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 90,
        },
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
