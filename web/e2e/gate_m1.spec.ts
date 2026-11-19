import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Gate M1: "importing the current JSON export (schema_version 1) shows the same view as the Artifact".
 * We import the same made-up export into the original single-file app (legacy/quaderno.html)
 * and into the React app, then compare what a person sees on both pages.
 */
const fixture = readFileSync(fileURLToPath(new URL("./fixtures/export_v1.json", import.meta.url)), "utf8");
const legacyUrl = new URL("../../legacy/quaderno.html", import.meta.url).href;

async function openWithFixture(page: Page, url: string) {
  await page.clock.setFixedTime(new Date("2026-11-20T10:00:00"));
  await page.goto(url);
  // both apps put the caret in the first Italian field ~50 ms after load; wait for it so it can't
  // land in the middle of filling the import field
  await expect(page.locator("#rows input.it").first()).toBeFocused();
  await page.locator("#t-export summary").click();
  await page.locator("#imp-in").fill(fixture);
  await page.locator("#imp-go").click();
  await expect(page.locator("#toast")).toContainText("Import: 2 nowych");
}

/** Everything visible that M1 must keep the same. */
function snapshot(page: Page) {
  return page.evaluate(() => {
    const t = (sel: string) => (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
    const v = (sel: string) => (document.querySelector(sel) as HTMLInputElement | null)?.value ?? "";
    return {
      level: [t("#lvl-name"), t("#lvl-sub"), t("#lvl-date"), t("#eyebrow-lvl")],
      segments: [...document.querySelectorAll(".lvl-seg")].map((s) => s.className),
      date: [t("#l-display"), t("#l-display-pl")],
      stats: t("#stats"),
      title: v("#l-title"),
      lessonDate: v("#l-date"),
      rows: [...document.querySelectorAll("#rows .row")].map((r) => {
        const [it, pl] = r.querySelectorAll("input");
        return [it.value, pl.value, pl.classList.contains("isnull"), it.classList.contains("fixed"), it.title, r.querySelector(".kind")!.textContent];
      }),
      verbs: [...document.querySelectorAll("#verbs .verb")].map((c) => ({
        name: c.querySelector(".vname b")!.textContent,
        pl: (c.querySelector(".vpl") as HTMLInputElement).value,
        badge: c.querySelector(".vbadge")!.textContent,
        prog: c.querySelector(".vprog")!.textContent,
        cells: [...c.querySelectorAll(".vcell")].map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim()),
      })),
      lessons: [...document.querySelectorAll("#l-select option")].map((o) => o.textContent),
      history: t(".lvl-hist"),
    };
  });
}

test("test_gate_m1: React app shows the same view as the Artifact after importing an export", async ({ browser }) => {
  const legacy = await (await browser.newContext()).newPage();
  const app = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  for (const p of [legacy, app]) p.on("pageerror", (e) => errors.push(e.message));

  await openWithFixture(legacy, legacyUrl);
  await openWithFixture(app, "/");
  for (const p of [legacy, app]) await p.locator("#lvl-toggle").click();

  const a = await snapshot(legacy);
  const b = await snapshot(app);
  expect(b.rows.length).toBe(2);
  expect(b.verbs.map((x) => x.name)).toEqual(["capire"]);
  expect(b).toEqual(a);

  // the older lesson, with revealed and hidden verb forms
  for (const p of [legacy, app]) await p.locator("#l-select").selectOption("fixture-lesson-1");
  const a1 = await snapshot(legacy);
  const b1 = await snapshot(app);
  expect(b1.verbs.map((x) => x.badge)).toEqual(["do sprawdzenia", "automat"]);
  expect(b1).toEqual(a1);

  expect(errors).toEqual([]);
});

test("typing works like in the Artifact: Enter, NULL, accents, verbs", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(200);
  await page.keyboard.type("caffe`");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // empty Polish = NULL
  await page.keyboard.type("Non sono stanco.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Nie jestem zmęczony.");
  await expect(page.locator("#rows .row input.it").first()).toHaveValue("caffè");
  await expect(page.locator("#rows .row").first().locator("input.pl")).toHaveClass(/isnull/);
  await expect(page.locator("#rows .row").nth(1).locator(".kind")).toHaveText("zdanie");
  await expect(page.locator("#stats")).toContainText("1 słowo · 1 zdanie");

  await page.locator("#v-new").fill("bere");
  await page.locator("#v-new").press("Enter");
  await expect(page.locator(".verb .vbadge")).toHaveText("automat");
  await page.locator('.vcover[data-p="io"]').click();
  await expect(page.locator(".vcell.open .vform")).toHaveText("bevo");
  await expect(page.locator(".vprog")).toHaveText("1/6 odkryte");

  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator("#rows .row input.it").first()).toHaveValue("caffè");
  await expect(page.locator(".vprog")).toHaveText("1/6 odkryte");
});
