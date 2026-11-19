import puppeteer from 'puppeteer-core';
const runs = +(process.argv[2] || 6);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await browser.newPage();
await p.setViewport({ width: 1440, height: 900 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
await p.waitForFunction('window.__done === true');
await p.evaluate(() => __trf.freeze(true));
for (let i = 0; i < runs; i++) {
  const r = await p.evaluate(() => {
    __trf.startRun();
    const g = __trf.game;
    g.bot = true;
    let maxMayo = 0, t = 0;
    while (t < 320 && __trf.state !== 'result') {
      for (let k = 0; k < 120; k++) { __trf.step(1/120 * 0 + 0.0084); }
      t += 120 * 0.0084;
      maxMayo = Math.max(maxMayo, g.p.mayo);
    }
    return { end: g.ending, x: Math.round(g.p.x), time: Math.round(g.stats.time), hits: g.stats.hits, minGap: Math.round(g.minGap), maxMayo: Math.round(maxMayo), stars: g.stats.stars, stomps: g.stats.stomps, slaps: g.stats.slaps, pows: g.stats.powerups, log: g.hitLog.slice(0, 40).join(' ') };
  });
  console.log(JSON.stringify(r));
}
await browser.close();
