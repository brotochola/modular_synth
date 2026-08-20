/**
 * Screenshot every component[data-module] from gallery.html into tmp/module-shots/
 * Usage: npm i && npx playwright install chromium && npm run gallery
 */
import { chromium } from "playwright";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "tmp", "module-shots");
const PORT = 5501;
const BASE = `http://127.0.0.1:${PORT}`;

fs.mkdirSync(outDir, { recursive: true });

function startServer() {
  const child = spawn("npx", ["--yes", "http-server", "-p", String(PORT), "-c-1", "."], {
    cwd: root,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => process.stdout.write("[serve] " + d));
  child.stderr.on("data", (d) => process.stderr.write("[serve] " + d));
  return child;
}

async function waitForServer(url, ms = 45000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start: " + url);
}

const server = startServer();
try {
  console.log("waiting for", BASE);
  await waitForServer(BASE + "/gallery.html");
  console.log("server up, launching browser");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 900, height: 1400 },
    permissions: [],
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.warn("pageerror", e.message));
  page.on("console", (msg) => console.log("browser:", msg.type(), msg.text()));
  await page.goto(BASE + "/gallery.html", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
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
    const sel = `component[data-module="${name}"]`;
    const el = page.locator(sel).first();
    const file = path.join(outDir, name + ".png");
    try {
      await el.screenshot({ path: file });
      console.log("shot", name);
    } catch (e) {
      console.warn("skip", name, e.message);
    }
  }

  await browser.close();
  console.log("done →", outDir);
} finally {
  try {
    server.kill("SIGTERM");
  } catch (_) {}
}
