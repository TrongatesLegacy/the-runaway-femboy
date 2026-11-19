import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await browser.newPage();
await p.setViewport({ width: 1280, height: 720 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
await p.waitForFunction('window.__done === true');
await p.evaluate(() => { __trf.freeze(true); __trf.startRun(); __trf.game.bot = true; });
await new Promise(r => setTimeout(r, 700));
const every = +(process.argv[2] || 7);
for (let i = 0; i < 18; i++) {
  await p.evaluate((s) => __trf.step(s), i === 0 ? 4 : every);
  const st = await p.evaluate(() => __trf.state);
  await p.screenshot({ path: `test/shots/strip-${String(i).padStart(2, '0')}.png` });
  if (st === 'result') break;
}
await browser.close();
