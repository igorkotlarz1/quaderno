// Gate M2: "telefon i laptop widzą tę samą lekcję; próbne odtworzenie kopii działa".
// Runs against the real compose stack (QUADERNO_URL, default http://127.0.0.1:8000).
// Two browser contexts = two devices with separate localStorage. Made-up words only.
import { execSync } from "node:child_process";
import { devices, expect, test } from "@playwright/test";

const repo = new URL("../..", import.meta.url).pathname;
const compose = (cmd: string) => execSync(`docker compose ${cmd}`, { cwd: repo, encoding: "utf8" });

test("phone and laptop see the same lesson", async ({ browser, request }) => {
  // Needs an empty database (CI, or a fresh `docker compose -p quaderno-test`), never your real one.
  const state = await (await request.get("/api/state")).json();
  expect(state.lessons, "gate M2 must run on an empty stack, not on real data").toHaveLength(0);

  const laptop = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const phone = await (await browser.newContext({ ...devices["Pixel 7"] })).newPage();

  // Laptop: type two words during the lesson.
  await laptop.goto("/");
  await expect(laptop.locator("#rows input.it").first()).toBeFocused();
  await laptop.keyboard.type("la finestra");
  await laptop.keyboard.press("Enter");
  await laptop.keyboard.type("okno");
  await laptop.keyboard.press("Enter");
  await laptop.keyboard.type("il tavolo");
  await laptop.keyboard.press("Enter");
  await laptop.keyboard.press("Enter"); // no Polish yet = NULL
  await expect(laptop.locator("#sync")).toContainText("Zapisane na serwerze", { timeout: 10_000 });

  // Phone: opens the app for the first time and gets the same lesson, not a new empty one.
  await phone.goto("/");
  await expect(phone.locator("#rows .row input.it").nth(0)).toHaveValue("la finestra", { timeout: 10_000 });
  await expect(phone.locator("#rows .row input.it").nth(1)).toHaveValue("il tavolo");
  await expect(phone.locator("#rows .row").nth(1).locator("input.pl")).toHaveClass(/isnull/);

  // Phone: fills the missing translation after the lesson.
  await phone.locator("#rows .row").nth(1).locator("input.pl").fill("stół");
  await expect(phone.locator("#sync")).toContainText("Zapisane na serwerze", { timeout: 10_000 });

  // Laptop: gets it on the next pull (coming back to the tab triggers one).
  await laptop.reload();
  await expect(laptop.locator("#rows .row").nth(1).locator("input.pl")).toHaveValue("stół", { timeout: 10_000 });
});

test("trial restore of a backup works", () => {
  const backup = compose("exec -T backup backup.sh");
  expect(backup).toMatch(/backup: \/backups\/quaderno_.*\.dump/);
  const restore = compose("exec -T backup restore-test.sh");
  expect(restore).toContain("restore-test: OK");
  // The restored copy holds the lesson typed above (1 lesson, at least 2 words).
  const counts = restore.match(/restored\s+lessons\/entries\/verbs\/assessments = (\d+) (\d+)/);
  expect(Number(counts?.[1])).toBeGreaterThanOrEqual(1);
  expect(Number(counts?.[2])).toBeGreaterThanOrEqual(2);
});
