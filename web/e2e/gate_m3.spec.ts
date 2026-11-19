// Gate M3: "lekcja wpisana w trybie samolotowym zapisuje się i synchronizuje po powrocie sieci".
// Runs against the server (compose stack in CI, QUADERNO_URL). Made-up words only.
// `context.setOffline(true)` is airplane mode for this browser: every request fails, the service worker
// has to serve the app, and IndexedDB has to keep what is typed.
import { expect, test, type Page } from "@playwright/test";

const word = { it: "il gatto", pl: "kot" };

async function serverHas(request: import("@playwright/test").APIRequestContext) {
  const state = await (await request.get("/api/state")).json();
  return state.lessons.some((l: { entries: { it: string | null; pl: string | null }[] }) =>
    l.entries.some((e) => e.it === word.it && e.pl === word.pl));
}

const rows = (page: Page) => page.locator("#rows .row");
const itValues = (page: Page) => page.$$eval("#rows input.it", (els) => (els as HTMLInputElement[]).map((e) => e.value));

test("a lesson typed in airplane mode is saved and syncs when the network is back", async ({ browser, request }) => {
  expect(await serverHas(request), "the word must not be on the server before the test").toBe(false);
  const context = await browser.newContext({ viewport: { width: 412, height: 860 } });
  const page = await context.newPage();

  // 1. Online once: the service worker installs and takes over the page.
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.locator("#sync")).toContainText("Zapisane na serwerze", { timeout: 10_000 });

  // 2. Airplane mode. The app still opens: from the service worker cache, not the network.
  await context.setOffline(true);
  await page.reload();
  await expect(rows(page).first()).toBeVisible();
  await expect(page.locator("#sync")).toContainText("Offline");

  // 3. Type during the "lesson" in the first empty row.
  // (the lesson may already hold words from gate M2: Enter in the last row opens a new one, as in class)
  const hasEmpty = await page.evaluate(() => {
    const empty = [...document.querySelectorAll<HTMLInputElement>("#rows input.it")].find((i) => !i.value);
    empty?.focus();
    return !!empty;
  });
  if (!hasEmpty) {
    await rows(page).last().locator("input.pl").focus();
    await page.keyboard.press("Enter");
  }
  await page.keyboard.type(word.it);
  await page.keyboard.press("Enter");
  await page.keyboard.type(word.pl);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sync")).toContainText("1 lekcja czeka na wysłanie");

  // 4. Still offline: close and reopen the app. The words are there (IndexedDB), the server has nothing yet.
  await page.reload();
  await expect.poll(() => itValues(page)).toContain(word.it);
  expect(await serverHas(request)).toBe(false);

  // 5. Network back: the waiting lesson goes to the server by itself.
  await context.setOffline(false);
  await expect(page.locator("#sync")).toContainText("Zapisane na serwerze", { timeout: 45_000 });
  await expect.poll(() => serverHas(request), { timeout: 10_000 }).toBe(true);
  await context.close();
});

test("the app can be installed: manifest with name and icons", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("Quadernote");
  expect(m.display).toBe("standalone");
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const i of m.icons) expect((await request.get("/" + i.src)).status()).toBe(200);
});
