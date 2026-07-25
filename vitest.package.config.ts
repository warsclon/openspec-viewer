import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/package/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
