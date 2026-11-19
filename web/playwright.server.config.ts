import { defineConfig } from "@playwright/test";

// Gates M2, M3 and M3.5 run against the compose stack (`docker compose up -d --build` first), not vite preview.
export default defineConfig({
  testDir: "e2e",
  testMatch: /gate_m(2|3|35)\.spec\.ts/, // m2 first: it needs an empty database; m35 needs the test dictionary
  workers: 1,
  fullyParallel: false,
  use: { baseURL: process.env.QUADERNO_URL || "http://127.0.0.1:8000", trace: "off" },
});
