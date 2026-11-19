import { defineConfig } from "@playwright/test";

// Gate M2 runs against the compose stack (`docker compose up -d --build` first), not vite preview.
export default defineConfig({
  testDir: "e2e",
  testMatch: "gate_m2.spec.ts",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: process.env.QUADERNO_URL || "http://127.0.0.1:8000", trace: "off" },
});
