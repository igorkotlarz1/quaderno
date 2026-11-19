/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // `npm run dev` talks to the local API (uv run uvicorn app.main:app) on port 8000.
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  // `vite preview` (gate M1) must stay server-less, so it does not inherit the proxy.
  preview: { proxy: {} },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
