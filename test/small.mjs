import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
for (const [w, h, name] of [[375, 667, 'se'], [360, 640, 'android-sm'], [390, 844, 'ip14'], [667, 375, 'se-land']]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
  await p.waitForFunction('window.__done === true');
  await p.evaluate(() => { __trf.freeze(true); __trf.step(1.5); });
  await new Promise((r) => setTimeout(r, 600));
  await p.screenshot({ path: `test/shots/sm-${name}-title.png` });
  await p.evaluate(() => { __trf.startRun(); __trf.step(4.2); __trf.game.p.pie = 5; __trf.step(0.1); });
  await new Promise((r) => setTimeout(r, 700));
  await p.evaluate(() => __trf.render());
  await p.screenshot({ path: `test/shots/sm-${name}-play.png` });
  const ov = await p.evaluate(() => [...document.querySelectorAll('.tbtn')].map((b) => { const r = b.getBoundingClientRect(); return `${b.dataset.act}:${Math.round(r.left)}-${Math.round(r.right)}`; }).join(' ') + ` vw=${innerWidth}`);
  console.log(name, ov);
  await p.close();
}
await browser.close();
