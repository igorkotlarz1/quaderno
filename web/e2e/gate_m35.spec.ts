// Gate M3.5: "słowo z top 5000 wpisane w trybie samolotowym dostaje polską podpowiedź bez API;
// do Claude idzie tylko to, czego słownik nie zna".
// Runs against the server with the *test* dictionary loaded (CI: `python -m app.lexicon.build --from
// tests/fixtures/lexicon`): a handful of made-up entries in the real formats, no downloaded data.
import { expect, test, type Page } from "@playwright/test";

const lastRow = (page: Page) => page.locator("#rows .row").last();

/** Type a word in a fresh row, as in class: Enter in the last "polski" field opens a new row. */
async function typeWord(page: Page, it: string) {
  const empty = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLInputElement>("#rows input.it")].find((i) => !i.value);
    el?.focus();
    return !!el;
  });
  if (!empty) {
    await lastRow(page).locator("input.pl").focus();
    await page.keyboard.press("Enter");
  }
  await page.keyboard.type(it);
}

/** The row whose Italian field holds `it` (reads the live value, not the HTML attribute). */
async function rowOf(page: Page, it: string) {
  const i = await page.$$eval("#rows input.it", (els, w) => (els as HTMLInputElement[]).findIndex((e) => e.value === w), it);
  expect(i, `row "${it}"`).toBeGreaterThanOrEqual(0);
  return page.locator("#rows .row").nth(i);
}

test("a known word typed offline gets a Polish suggestion; the prompt keeps only unknown words", async ({ browser, request }) => {
  const meta = await (await request.get("/api/lexicon/meta")).json();
  expect(meta.loaded, "load the test dictionary into the server first").toBe(true);

  const context = await browser.newContext({ viewport: { width: 412, height: 860 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();

  // 1. Online once: the service worker installs and the dictionary lands in IndexedDB.
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.locator("#t-dict summary")).toContainText("najczęstszych słów", { timeout: 10_000 });

  // 2. Airplane mode, app reopened: no server, no API.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#t-dict summary")).toContainText("najczęstszych słów");

  // 3. An inflected form with its article: the chip offers the meaning of the lemma (finestre → finestra → okno).
  await typeWord(page, "le finestre");
  const chips = lastRow(page).locator(".chips button");
  await expect(chips).toHaveText(["okno"]);
  // Nothing is filled in until the user picks.
  await expect(lastRow(page).locator("input.pl")).toHaveValue("");
  await chips.first().click();
  await expect(lastRow(page).locator("input.pl")).toHaveValue("okno");
  await expect(lastRow(page).locator(".chips")).toHaveCount(0);

  // 4. Two more words without a translation: one the dictionary knows, one it does not.
  await typeWord(page, "grazie");
  await expect(lastRow(page).locator(".chips button")).toHaveText(["dziękuję"]);
  await typeWord(page, "il capibara");
  await expect(lastRow(page).locator(".chips")).toHaveCount(0);

  // 5. "Uzupełnij ze słownika" fills what it knows, marked as coming from the dictionary.
  await page.locator("#t-dict summary").click();
  await page.locator("#dict-fill").click();
  await expect((await rowOf(page, "grazie")).locator("input.pl")).toHaveValue("dziękuję");
  await expect((await rowOf(page, "il capibara")).locator("input.pl")).toHaveValue("");
  await expect(page.locator("#dict-sources li")).toHaveCount(3);

  // 6. The prompt for Claude: only the unknown word is still a NULL to translate.
  await page.locator("#t-llm summary").click();
  await page.locator("#copy-prompt").click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toContain("Pozycji bez tłumaczenia: 1.");
  const lesson = JSON.parse(prompt.slice(prompt.indexOf("\n{")));
  const by = (it: string) => lesson.entries.find((e: { it: string }) => e.it === it);
  expect(by("il capibara").pl).toBeNull();
  expect(by("le finestre")).toMatchObject({ pl: "okno", pl_source: "dict" });
  expect(by("grazie")).toMatchObject({ pl: "dziękuję", pl_source: "dict" });
  await context.close();
});
