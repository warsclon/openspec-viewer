import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
