import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await browser.newPage();
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' });
await p.waitForFunction('window.__done === true');
await p.click('#btn-play');
await new Promise(r => setTimeout(r, 4000));
const info = await p.evaluate(async () => {
  const mod = await import('/src/audio.ts');
  const a = mod.audio;
  return { state: a.ctx?.state, master: a.volumes.master, music: a.currentMusic(), ambient: [...a.ambientVoices.keys()], buffers: [...a.buffers.keys()].length, wantedAmb: [...a.wantedAmbient.keys()] };
});
console.log(JSON.stringify(info));
await browser.close();
