// Renders the 30s trailer from the real game engine (scripts/trailer.html) and mixes music + sfx.
// Needs `npm run dev` running on :5199, local Google Chrome and ffmpeg.
//   node scripts/make-trailer.mjs preview   → contact sheet of every 10th frame (fast check)
//   node scripts/make-trailer.mjs           → public/trailer.mp4 + public/trailer-preview.webp
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mode = process.argv[2] || 'full';
const TMP = join(process.env.TRAILER_TMP || tmpdir(), 'trf-trailer');
if (existsSync(TMP)) rmSync(TMP, { recursive: true });
mkdirSync(TMP, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()));
await page.goto('http://localhost:5199/scripts/trailer.html', { waitUntil: 'networkidle0' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });
const info = await page.evaluate(() => window.TRAILER);
console.log(`trailer: ${info.TOTAL.toFixed(2)}s, ${info.frames} frames`);

const decode = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

if (mode === 'preview') {
  const every = +(process.argv[3] || 10);
  for (let i = 0; i < info.frames; i++) {
    const url = await page.evaluate((n) => window.renderFrame(n), i);
    if (i % every === 0) writeFileSync(join(TMP, `p${String(i).padStart(4, '0')}.jpg`), decode(url));
  }
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', join(TMP, 'p*.jpg'), '-vf', 'scale=384:-1,tile=6x16:padding=4', '-frames:v', '1', 'test/shots/trailer-sheet.png']);
  console.log('wrote test/shots/trailer-sheet.png');
  await browser.close();
  process.exit(0);
}

// ---- video: pipe JPEG frames into ffmpeg
const silent = join(TMP, 'video.mp4');
const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(info.FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < info.frames; i++) {
  const url = await page.evaluate((n) => window.renderFrame(n), i);
  if (!ff.stdin.write(decode(url))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 90 === 0) console.log(`frame ${i}/${info.frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
const sfx = await page.evaluate(() => window.getSfx());
await browser.close();
console.log(`${sfx.length} sfx cues`);

// ---- audio: mold ambience + growl intro, stage-3 music from the title slam, win jingle on the end card
const A = 'public/audio/';
const shots = info.shots;
const titleAt = shots[2].start;
const endAt = shots[shots.length - 1].start;
const total = info.TOTAL;
const inputs = [];
const filters = [];
const add = (file, filter) => {
  inputs.push('-i', file);
  const n = inputs.length / 2 - 1;
  filters.push(`[${n}:a]${filter}[a${n}]`);
};
add(`${A}ambient/mold.ogg`, `atrim=0:${titleAt + 0.6},volume=2.2,afade=t=in:d=0.6,afade=t=out:st=${titleAt - 0.1}:d=0.7,aresample=44100,aformat=channel_layouts=stereo`);
add(`${A}music/stage3.ogg`, `atrim=0:${endAt - titleAt + 0.6},volume=0.95,afade=t=out:st=${endAt - titleAt - 0.2}:d=0.8,adelay=${Math.round(titleAt * 1000)}|${Math.round(titleAt * 1000)},aresample=44100,aformat=channel_layouts=stereo`);
add(`${A}music/win.ogg`, `atrim=0:${total - endAt},volume=0.9,afade=t=out:st=${total - endAt - 0.9}:d=0.9,adelay=${Math.round(endAt * 1000)}|${Math.round(endAt * 1000)},aresample=44100,aformat=channel_layouts=stereo`);
for (const s of sfx.slice(0, 90)) {
  const ms = Math.max(0, Math.round(s.t * 1000));
  const gain = (s.key === 'sfx/star' ? 0.35 : 0.8) * s.vol;
  const rate = s.rate && s.rate !== 1 ? `,asetrate=44100*${s.rate},aresample=44100` : '';
  add(`${A}${s.key}.ogg`, `aresample=44100${rate},volume=${gain.toFixed(2)},adelay=${ms}|${ms},aformat=channel_layouts=stereo`);
}
const n = inputs.length / 2;
const mix = filters.join(';') + ';' + Array.from({ length: n }, (_, i) => `[a${i}]`).join('') + `amix=inputs=${n}:normalize=0:dropout_transition=0,alimiter=limit=0.89,atrim=0:${total}[out]`;
const audioFile = join(TMP, 'audio.m4a');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', mix, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', audioFile]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', silent, '-i', audioFile, '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', 'public/trailer.mp4']);
console.log('wrote public/trailer.mp4');

// ---- README preview: animated WebP (no sound) of the whole trailer, via libwebp's img2webp
const PF = join(TMP, 'pv');
mkdirSync(PF, { recursive: true });
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', 'public/trailer.mp4', '-vf', 'fps=12,scale=720:-1:flags=lanczos', join(PF, 'f%04d.png')]);
const pv = readdirSync(PF).filter((f) => f.endsWith('.png')).sort().map((f) => join(PF, f));
execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', '55', '-m', '6', '-d', String(Math.round(1000 / 12)), ...pv, '-o', 'public/trailer-preview.webp']);
console.log('wrote public/trailer-preview.webp');
