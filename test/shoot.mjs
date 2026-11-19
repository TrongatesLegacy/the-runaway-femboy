import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://localhost:5199/';
const OUT = 'test/shots/';
const only = process.argv[2];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
async function page(w, h, dpr = 1, touch = false) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: touch, hasTouch: touch });
  p.on('console', m => { if (['error','warning'].includes(m.type())) console.log('[console]', m.type(), m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(BASE, { waitUntil: 'networkidle0' });
  await p.waitForFunction('window.__done === true', { timeout: 20000 });
  await p.evaluate(() => window.__trf.freeze(true));
  return p;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const snap = async (p, name) => { await wait(650); await p.evaluate(() => __trf.render()); return p.screenshot({ path: OUT + name + '.png' }); };
const run = async (name, fn) => { if (only && !name.includes(only)) return; const t = Date.now(); await fn(); console.log('ok', name, Date.now() - t, 'ms'); };

await run('desktop', async () => {
  const p = await page(1440, 900);
  await p.evaluate(() => __trf.step(2.5)); await snap(p, 'd-title');
  await p.evaluate(() => { __trf.startRun(); __trf.step(1.0); }); await snap(p, 'd-countdown');
  await p.evaluate(() => __trf.step(3.2)); await snap(p, 'd-s1a');
  await p.evaluate(() => __trf.step(2.5)); await snap(p, 'd-s1b');
  await p.evaluate(() => { __trf.warp(20600); __trf.step(1.8); }); await snap(p, 'd-s2-transition');
  await p.evaluate(() => __trf.step(3)); await snap(p, 'd-s2');
  await p.evaluate(() => { __trf.warp(47800); __trf.step(1.4); }); await snap(p, 'd-s3-banner');
  await p.evaluate(() => __trf.step(3)); await snap(p, 'd-s3');
  await p.evaluate(() => { __trf.warp(76800); __trf.step(1.5); }); await snap(p, 'd-house');
  await p.close();
});
await run('powers', async () => {
  const p = await page(1440, 900);
  await p.evaluate(() => { __trf.startRun(); __trf.step(3.5); const g = __trf.game; g.p.pear = 5; g.p.pie = 8; g.p.mayo = 65; g.moldX = g.p.x - 160; __trf.step(0.6); }); await snap(p, 'd-powers');
  await p.close();
});
for (const k of ['win', 'molded', 'mayo']) await run('end-' + k, async () => {
  const p = await page(1440, 900);
  await p.evaluate((k) => { __trf.startRun(); __trf.step(3.5); if (k === 'win') __trf.warp(77300); __trf.step(0.5); __trf.end(k); __trf.step(1.0); }, k); await snap(p, 'd-end-' + k + '-a');
  await p.evaluate(() => __trf.step(3.5)); await wait(1900); await p.evaluate(() => __trf.step(0.01)); await snap(p, 'd-end-' + k + '-b');
  await p.close();
});
await run('modals', async () => {
  const p = await page(1440, 900);
  await p.evaluate(() => __trf.step(1)); await p.click('#btn-settings'); await new Promise(r => setTimeout(r, 400)); await snap(p, 'd-settings');
  await p.evaluate(() => document.querySelector('#modal-settings').classList.remove('show'));
  await p.click('#btn-howto'); await new Promise(r => setTimeout(r, 400)); await snap(p, 'd-howto');
  await p.close();
});
await run('phone-land', async () => {
  const p = await page(844, 390, 3, true);
  await p.evaluate(() => __trf.step(2)); await snap(p, 'm-land-title');
  await p.evaluate(() => { __trf.startRun(); __trf.step(5); }); await snap(p, 'm-land-play');
  await p.close();
});
await run('phone-port', async () => {
  const p = await page(390, 844, 3, true);
  await p.evaluate(() => __trf.step(2)); await snap(p, 'm-port-title');
  await p.evaluate(() => { __trf.startRun(); __trf.step(5); }); await snap(p, 'm-port-play');
  await p.evaluate(() => { __trf.end('mayo'); __trf.step(4); }); await wait(1900); await p.evaluate(() => __trf.step(0.01)); await snap(p, 'm-port-end');
  await p.close();
});
await browser.close();
