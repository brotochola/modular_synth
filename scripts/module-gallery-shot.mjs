import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp", "module-shots");
const BASE = process.env.GALLERY_URL || "http://127.0.0.1:5501";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
page.on("pageerror", (e) => console.warn("pageerror", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("browser:", msg.text());
});
await page.goto(BASE + "/gallery.html", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(
  () => document.documentElement.getAttribute("data-gallery-ready") === "1",
  { timeout: 90000 }
);
await page.waitForTimeout(1500);
const names = await page.$$eval("component[data-module]", (els) =>
  els.map((el) => el.getAttribute("data-module"))
);
console.log("modules", names.length);
for (const name of names) {
  const file = path.join(outDir, name + ".png");
  try {
    await page.locator(`component[data-module="${name}"]`).first().screenshot({ path: file });
    console.log("shot", name);
  } catch (e) {
    console.warn("skip", name, e.message);
  }
}
await browser.close();
console.log("done →", outDir);
