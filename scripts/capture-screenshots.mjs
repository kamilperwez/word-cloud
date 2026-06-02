import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE_URL = process.env.SCREENSHOT_URL ?? "http://localhost:3000";
const OUT_DIR = "docs/images";

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1500);
await page
  .locator("g.word-bubble, [aria-label='Word cloud results']")
  .first()
  .waitFor({ state: "visible", timeout: 15_000 })
  .catch(() => undefined);
await page.waitForTimeout(1000);

await page.screenshot({
  path: `${OUT_DIR}/app-screenshot.png`,
  fullPage: true,
});

await page.screenshot({
  path: `${OUT_DIR}/portfolio-showcase.png`,
  fullPage: false,
});

const main = page.locator("main");
const box = await main.boundingBox();
if (box) {
  const side = Math.min(Math.max(box.width, box.height), 1200);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.screenshot({
    path: `${OUT_DIR}/portfolio-square.png`,
    clip: {
      x: Math.max(0, cx - side / 2),
      y: Math.max(0, cy - side / 2),
      width: side,
      height: side,
    },
  });
}

await browser.close();
console.log(`Saved screenshots to ${OUT_DIR}/`);
