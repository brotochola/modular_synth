import { chromium } from "playwright";
import path from "path";

const BASE = process.env.GALLERY_URL || "http://localhost:8001";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.warn("pageerror", e.message));
await page.goto(BASE + "/index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1000);

// open via space key (simulate keyboard shortcut) on body
await page.click("app");
await page.keyboard.press(" ");
await page.waitForTimeout(300);
let visible = await page.evaluate(() => document.querySelector(".buttons").classList.contains("visible"));
console.log("opened via space:", visible);

// arrow-down from search into grid
await page.focus(".paletteSearch");
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(150);
let focusedIsCard = await page.evaluate(() => document.activeElement.classList.contains("paletteCard"));
console.log("focus moved to card:", focusedIsCard);
let focusedLabel = await page.evaluate(() => document.activeElement.querySelector(".paletteCardLabel")?.textContent);
console.log("first card label:", focusedLabel);

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(100);
let label2 = await page.evaluate(() => document.activeElement.querySelector(".paletteCardLabel")?.textContent);
console.log("after ArrowRight:", label2);

await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);
let label3 = await page.evaluate(() => document.activeElement.querySelector(".paletteCardLabel")?.textContent);
console.log("after ArrowDown:", label3);
await page.screenshot({ path: path.join(process.cwd(), "tmp_palette_focus.png") });

// Escape closes
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
visible = await page.evaluate(() => document.querySelector(".buttons").classList.contains("visible"));
console.log("visible after Escape:", visible);
let overlayVisible = await page.evaluate(() => document.querySelector(".paletteOverlay").classList.contains("visible"));
console.log("overlay visible after Escape:", overlayVisible);

// reopen, click overlay to close
await page.click(".openButtons");
await page.waitForTimeout(300);
await page.click(".paletteOverlay", { position: { x: 5, y: 5 } });
await page.waitForTimeout(300);
visible = await page.evaluate(() => document.querySelector(".buttons").classList.contains("visible"));
console.log("visible after overlay click:", visible);

await browser.close();
console.log("done");
