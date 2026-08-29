import { chromium } from "playwright";

const errors = [];
const warns = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror " + e.message));
page.on("console", (msg) => {
  let t = msg.type();
  let text = msg.text();
  if (t === "error") errors.push(text);
  if (t === "warning" || /couldn/i.test(text) || /Unknown component/i.test(text))
    warns.push(text);
});

await page.goto("http://localhost:8000/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => window.app && window.app.components, { timeout: 20000 });
await page.click("button.play");
await page.evaluate(() => app.loadSamplePatch("samples/vowel-xy.json"));
await page.waitForFunction(
  () => app.components.filter((c) => c.id !== "output").length >= 60 && !app.bulkLoading,
  { timeout: 40000 },
);
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  let n = app.components.filter((c) => c.id !== "output").length;
  let kb = app.components.find((c) => c.id === "kb");
  let plot = app.components.find((c) => c.id === "plotter");
  return {
    n,
    kbReady: !!(kb && kb.node),
    localSeat: kb ? kb.isLocalSeat() : null,
    plotReady: !!(plot && plot.node),
    slotCap: kb && kb.node && kb.node.numberOfOutputs,
  };
});

const sent = await page.evaluate(() => {
  let kb = app.components.find((c) => c.id === "kb");
  kb.sendKey("down", 10);
  return kb.sabBlock ? kb.sabBlock.getSlot(10) : null;
});
await page.waitForTimeout(500);
const afterA = await page.evaluate(() => {
  let spec = app.components.find((c) => c.id === "spec");
  let bins = new Uint8Array(spec.node.frequencyBinCount);
  spec.node.getByteFrequencyData(bins);
  let energy = 0;
  for (let i = 0; i < bins.length; i++) energy += bins[i];
  let wa = app.components.find((c) => c.id === "wa");
  let peak = wa && wa.sabBlock ? wa.sabBlock.getSlot(96) : null;
  return { energy, sabA: app.components.find((c) => c.id === "kb").sabBlock.getSlot(10), peak };
});
await page.evaluate(() => {
  app.components.find((c) => c.id === "kb").sendKey("up", 10);
  app.components.find((c) => c.id === "kb").sendKey("down", 11);
});
await page.waitForTimeout(400);
const afterS = await page.evaluate(() => {
  let spec = app.components.find((c) => c.id === "spec");
  let bins = new Uint8Array(spec.node.frequencyBinCount);
  spec.node.getByteFrequencyData(bins);
  let energy = 0;
  for (let i = 0; i < bins.length; i++) energy += bins[i];
  return { energy, sabS: app.components.find((c) => c.id === "kb").sabBlock.getSlot(11) };
});
await page.evaluate(() => app.components.find((c) => c.id === "kb").sendKey("up", 11));
const cons = await page.evaluate(() => {
  let kb = app.components.find((c) => c.id === "kb");
  kb.sendKey("down", 23);
  kb.sendKey("down", 25);
  return { b: kb.sabBlock.getSlot(23), m: kb.sabBlock.getSlot(25), nOut: kb.node.numberOfOutputs };
});

await page.screenshot({ path: "tmp/vowel-xy.png", fullPage: true });
await browser.close();

console.log(JSON.stringify({ info, sent, afterA, afterS, cons, errors, warns }, null, 2));
if (!cons || cons.b !== 1 || cons.m !== 1) process.exit(4);
if (!info.kbReady || !info.localSeat) process.exit(1);
if (sent !== 1) process.exit(3);
if (errors.length) process.exit(2);
