import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(w = 1440, h = 900, mobile = false) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
  await p.waitForFunction('window.__done === true');
  await p.evaluate(() => __trf.freeze(true));
  return p;
}
// unlock a few things to show the wardrobe in a mixed state
let p = await page();
await p.evaluate(() => {
  localStorage.setItem('trf.profile.v1', JSON.stringify({ totals: { stars: 90, stomps: 31, slaps: 4, pearSmashes: 3, pickles: 2, pipes: 40, rice: 3, runs: 5 }, endings: { win: 1, molded: 2, furry: 1 }, unlocked: ['maid', 'regular', 'goth', 'mold', 'bingus'], outfit: 'bingus' }));
});
await p.close();
p = await page();
await p.evaluate(() => __trf.step(1));
await p.click('#btn-wardrobe'); await wait(500);
await p.screenshot({ path: 'test/shots/f-wardrobe.png' });
await p.close();
p = await page(390, 844, true);
await p.click('#btn-wardrobe'); await wait(500);
await p.screenshot({ path: 'test/shots/f-wardrobe-m.png' });
await p.close();
// HUD with rice + key, plus the door
p = await page();
await p.evaluate(() => { __trf.startRun(); __trf.step(3.5); const g = __trf.game; g.p.shield = 2; g.p.full = 3; g.p.hasKey = true; __trf.warp(60000); g.ents.push({ type: 'door', x: g.p.x + 520, y: 600, w: 140, h: 200, vx: 0, vy: 0, seed: 1, t: 0, dead: false, hitDone: false }); g.ents.push({ type: 'power', power: 'rice', x: g.p.x + 300, y: 470, w: 56, h: 56, vx: 0, vy: 0, seed: 1, t: 0, dead: false, hitDone: false }); __trf.step(0.2); });
await wait(600); await p.evaluate(() => __trf.render());
await p.screenshot({ path: 'test/shots/f-hud.png' });
await p.close();
for (const k of ['secret', 'furry', 'coma']) {
  p = await page();
  await p.evaluate((k) => { __trf.startRun(); __trf.step(3.5); __trf.end(k); __trf.step(4.5); }, k);
  await wait(2000); await p.evaluate(() => __trf.step(0.01));
  await p.screenshot({ path: `test/shots/f-end-${k}.png` });
  await p.close();
}
await browser.close();
