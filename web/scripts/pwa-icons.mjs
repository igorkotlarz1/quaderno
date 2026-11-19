// Renders the PNG app icons for the PWA manifest from docs/assets/brand/icon.svg.
// Run after changing the icon: `node scripts/pwa-icons.mjs` (uses the Playwright Chromium from devDependencies).
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

const svg = readFileSync(new URL("../../docs/assets/brand/icon.svg", import.meta.url), "utf8");
const out = new URL("../public/icons/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// "any": the rounded tile as drawn. "full": red to the edges with the tile inside the safe zone,
// for Android maskable icons and iOS (both cut their own shape out of it).
const page = (size, full) => `<html><body style="margin:0;width:${size}px;height:${size}px;background:${full ? "#c8321b" : "transparent"};display:grid;place-items:center">
  <div style="width:${full ? 82 : 100}%;height:${full ? 82 : 100}%">${svg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"')}</div></body></html>`;

const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];

const browser = await chromium.launch();
for (const [name, size, full] of targets) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, full));
  await p.screenshot({ path: out + name, omitBackground: !full });
  await p.close();
}
await browser.close();
console.log("wrote", targets.map((t) => t[0]).join(", "), "to", out);
