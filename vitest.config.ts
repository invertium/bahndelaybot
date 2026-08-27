import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 80,
      },
      include: [
        "src/lib/security.ts",
        "src/lib/invitations.ts",
        "src/lib/import/**/*.ts",
        "src/lib/transport/**/*.ts",
        "src/app/api/invitations/**/*.ts",
        "src/app/invite/**/*.tsx",
        "src/app/admin/*.tsx",
      ],
    },
  },
});
