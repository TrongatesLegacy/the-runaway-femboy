import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
for (const [w,h,d,t,name] of [[1440,900,1,false,'d-howto'],[390,844,3,true,'m-howto']]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: d, isMobile: t, hasTouch: t });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
  await p.waitForFunction('window.__done === true');
  if (t) await p.evaluate(() => document.body.classList.add('touch'));
  await p.click('#btn-howto'); await new Promise(r => setTimeout(r, 600));
  await p.screenshot({ path: `test/shots/${name}.png` });
  await p.close();
}
await browser.close();
