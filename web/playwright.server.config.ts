import { defineConfig } from "@playwright/test";

// Gates M2 and M3 run against the compose stack (`docker compose up -d --build` first), not vite preview.
export default defineConfig({
  testDir: "e2e",
  testMatch: /gate_m[23]\.spec\.ts/, // m2 first: it needs an empty database
  workers: 1,
  fullyParallel: false,
  use: { baseURL: process.env.QUADERNO_URL || "http://127.0.0.1:8000", trace: "off" },
});
