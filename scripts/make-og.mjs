// Renders public/og.png (1200x630) from the game's own art. Needs `npm run dev` running and local Chrome.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await browser.newPage();
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5199/scripts/og.html', { waitUntil: 'networkidle0' });
await p.waitForFunction('window.__done === true');
const el = await p.$('#c');
await el.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
