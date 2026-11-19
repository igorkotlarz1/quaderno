// Gate M4: "jeden klik zamiast ręcznego promptu; koszt każdego wywołania w logu".
// Runs against the server with LLM_FAKE=true (CI): a stand-in that answers like the Claude API, from fixed
// rules (server/app/llm/fake.py), so no key and no money are needed. With a real key the runbook checks the same.
import { expect, test, type Page } from "@playwright/test";

async function typeRow(page: Page, it: string) {
  const empty = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLInputElement>("#rows input.it")].find((i) => !i.value);
    el?.focus();
    return !!el;
  });
  if (!empty) {
    await page.locator("#rows .row").last().locator("input.pl").focus();
    await page.keyboard.press("Enter");
  }
  await page.keyboard.type(it);
}

async function rowOf(page: Page, it: string) {
  const i = await page.$$eval("#rows input.it", (els, w) => (els as HTMLInputElement[]).findIndex((e) => e.value === w), it);
  expect(i, `row "${it}"`).toBeGreaterThanOrEqual(0);
  return page.locator("#rows .row").nth(i);
}

test("one click fills the lesson through the server, and the call is in the cost log", async ({ page, request }) => {
  const status = await (await request.get("/api/llm/status")).json();
  expect(status.enabled, "start the server with LLM_FAKE=true (or a real key)").toBe(true);
  const callsBefore = status.calls.length;

  await page.goto("/");
  await typeRow(page, "perche");
  await typeRow(page, "il cane");
  await page.locator("#rows .row").last().locator("input.pl").focus(); // leave "il cane" without Polish

  // One click: no prompt to copy, no JSON to paste.
  await page.locator("#t-llm > summary").click();
  await expect(page.locator("#llm-lesson")).toBeVisible();
  await page.locator("#llm-lesson").click();
  await expect(page.locator("#toast")).toContainText("koszt", { timeout: 15_000 });

  await expect((await rowOf(page, "il cane")).locator("input.pl")).toHaveValue("pies");
  const fixed = await rowOf(page, "perché"); // accent fixed, old spelling kept in the tooltip
  await expect(fixed.locator("input.it")).toHaveClass(/fixed/);
  await expect(fixed.locator("input.it")).toHaveAttribute("title", /perche/);

  // The cost of the call is in the log: in the app and on the server.
  await page.locator("#llm-costs summary").click();
  const first = page.locator("#llm-costs tbody tr").first();
  await expect(first).toContainText("lekcja");
  await expect(first).toContainText("haiku-5-5");
  await expect(first).toContainText(/gr|zł/);
  const after = await (await request.get("/api/llm/status")).json();
  expect(after.calls.length).toBe(callsBefore + 1);
  expect(after.calls[0]).toMatchObject({ purpose: "lesson", status: "ok" });
  expect(after.calls[0].cost_usd).toBeGreaterThan(0);

  // The weekly level in one click too.
  await page.locator("#t-week > summary").click();
  await page.locator("#llm-week").click();
  await expect(page.locator("#toast")).toContainText("Nowa ocena poziomu zapisana", { timeout: 15_000 });
  const week = await (await request.get("/api/llm/status")).json();
  expect(week.calls[0]).toMatchObject({ purpose: "week", status: "ok", model: "claude-sonnet-5-5" });
});
