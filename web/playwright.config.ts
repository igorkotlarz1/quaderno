import { defineConfig } from "@playwright/test";

// The gate test builds the app and serves it with `vite preview`.
export default defineConfig({
  testDir: "e2e",
  testMatch: "gate_m1.spec.ts",
  use: { baseURL: "http://localhost:4173", trace: "off" },
  webServer: { command: "npm run build && npm run preview", url: "http://localhost:4173", reuseExistingServer: true, timeout: 120_000 },
});
