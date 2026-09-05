import { chromium } from "playwright";
import path from "path";

const BASE = process.env.GALLERY_URL || "http://localhost:8001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.warn("pageerror", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("browser:", msg.text());
});
await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);
await page.click(".openButtons");
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(process.cwd(), "tmp_palette_open.png") });

// type a search query
await page.fill(".paletteSearch", "808");
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(process.cwd(), "tmp_palette_search.png") });

await browser.close();
console.log("done");
