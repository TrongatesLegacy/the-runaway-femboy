import { TAU, clamp, fbm1, lerp, makeCanvas } from '../util';

const spriteCache = new Map<string, HTMLCanvasElement>();
function cachedSprite(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, r: number) => void) {
  let c = spriteCache.get(key);
  if (!c) {
    const m = makeCanvas(size, size);
    m.ctx.translate(size / 2, size / 2);
    draw(m.ctx, size / 2);
    spriteCache.set(key, m.c);
    c = m.c;
  }
  return c;
}
import { drawPie } from './character';

const OL = '#2a1420';

function fillOl(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 2.4, ol = OL) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ol;
  ctx.stroke();
}

// =====================================================================
// BINGUS — hairless sphynx cat, many variants
// =====================================================================
export type BingusKind = 'walk' | 'hop' | 'chonk' | 'box' | 'balloon';
export interface BingusLook {
  skin: string;
  shade: string;
  inner: string;
  eye: string;
  acc: 'none' | 'sweater' | 'bow' | 'bandana' | 'hat' | 'collar';
  accColor: string;
  accColor2: string;
}

export const BINGUS_SKINS = [
  { skin: '#f4bfb0', shade: '#dc9a8b', inner: '#f08a9a' },
  { skin: '#e9c2c8', shade: '#cc9aa5', inner: '#ee8aa8' },
  { skin: '#d7c0d4', shade: '#b39ab4', inner: '#e78ab6' },
  { skin: '#f6d0b0', shade: '#dcab86', inner: '#f2989a' },
  { skin: '#c9b2b0', shade: '#a68d8d', inner: '#e48c9a' },
];
export const BINGUS_EYES = ['#b8e04a', '#7fd6e8', '#f2c84a', '#9be38a', '#e6a24a'];
export const ACC_COLORS = [
  ['#e8455f', '#ffd1da'],
  ['#4a7be8', '#cfe0ff'],
  ['#3fb07a', '#d4f5e4'],
  ['#f2a33a', '#fff0c9'],
  ['#9b5de5', '#ead9ff'],
  ['#2c2a3a', '#e9e6f2'],
];

export interface BingusState {
  t: number;
  walk: number; // walk phase
  squash: number; // 0..1 flattened
  flying: boolean;
  spin: number;
  dizzy: boolean;
  boxOpen?: number; // 0 hidden → 1 popped out
  scared?: number;
}

export function drawBingus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: BingusKind,
  look: BingusLook,
  st: BingusState,
  s = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  const sc = kind === 'chonk' ? 1.45 * s : s;
  ctx.scale(sc, sc);
  if (st.flying) {
    ctx.translate(0, -26);
    ctx.rotate(st.spin);
    ctx.translate(0, 26);
  }
  const sq = st.squash;
  ctx.scale(1 + sq * 0.6, 1 - sq * 0.65);

  if (kind === 'box') {
    drawBox(ctx, st, look);
    ctx.restore();
    return;
  }
  if (kind === 'balloon') {
    // balloon string + balloon above
    const bob = Math.sin(st.t * 2.4) * 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2, -40);
    ctx.quadraticCurveTo(8 + bob, -70, 2, -98);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(2 + bob * 0.5, -122, 21, 25, 0.1, 0, TAU);
    const bg = ctx.createRadialGradient(-6, -132, 2, 2, -122, 26);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.25, look.accColor);
    bg.addColorStop(1, shadeOf(look.accColor));
    fillOl(ctx, bg, 2.2);
    ctx.beginPath();
    ctx.moveTo(-2 + bob * 0.5, -97);
    ctx.lineTo(6 + bob * 0.5, -97);
    ctx.lineTo(2 + bob * 0.5, -102);
    ctx.closePath();
    fillOl(ctx, shadeOf(look.accColor), 1.6);
  }

  const walk = st.walk;
  const legA = Math.sin(walk) * 0.5;
  const bob = kind === 'balloon' ? 0 : Math.abs(Math.sin(walk)) * 2;
  const dangle = kind === 'balloon';

  // tail
  ctx.strokeStyle = OL;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6.5;
  const tw = Math.sin(st.t * 3.1) * 6;
  ctx.beginPath();
  ctx.moveTo(26, -22 - bob);
  ctx.bezierCurveTo(40, -24, 42 + tw, -44, 34 + tw, -52);
  ctx.stroke();
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // legs (back pair first)
  const leg = (lx: number, a: number, near: boolean) => {
    const len = dangle ? 13 : 12;
    const ex = lx + Math.sin(a) * 6;
    const ey = -10 - bob + len + (dangle ? 2 : 0);
    ctx.lineWidth = 7.2;
    ctx.strokeStyle = OL;
    ctx.beginPath();
    ctx.moveTo(lx, -14 - bob);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.lineWidth = 4.4;
    ctx.strokeStyle = near ? look.skin : look.shade;
    ctx.stroke();
  };
  leg(18, -legA, false);
  leg(-10, legA, false);

  // body
  ctx.beginPath();
  ctx.ellipse(8, -24 - bob, 25, 15, 0, 0, TAU);
  const bodyG = ctx.createLinearGradient(0, -40, 0, -8);
  bodyG.addColorStop(0, look.skin);
  bodyG.addColorStop(1, look.shade);
  fillOl(ctx, bodyG, 2.4);
  // belly wrinkles
  ctx.strokeStyle = look.shade;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(14, -30 - bob);
  ctx.quadraticCurveTo(18, -24 - bob, 14, -18 - bob);
  ctx.moveTo(22, -29 - bob);
  ctx.quadraticCurveTo(25, -24 - bob, 22, -19 - bob);
  ctx.stroke();

  if (look.acc === 'sweater') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(8, -24 - bob, 25, 15, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = look.accColor;
    ctx.fillRect(-14, -42 - bob, 34, 40);
    ctx.fillStyle = look.accColor2;
    for (let i = 0; i < 4; i++) ctx.fillRect(-14, -36 - bob + i * 8, 34, 2.4);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(8, -24 - bob, 25, 15, 0, 0, TAU);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = OL;
    ctx.stroke();
  }

  leg(14, legA, true);
  leg(-14, -legA, true);

  // head
  const hx = -18, hy = -36 - bob;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(Math.sin(st.t * 1.3) * 0.05);
  // ears
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const ex = side * 9;
    ctx.moveTo(ex - 9, -6);
    ctx.lineTo(ex + side * 7, -34 + Math.sin(st.t * 4 + side) * 1.5);
    ctx.lineTo(ex + 9 - side * 2, -4);
    ctx.closePath();
    fillOl(ctx, side < 0 ? look.skin : look.shade, 2.2);
    ctx.beginPath();
    ctx.moveTo(ex - 4.5, -8);
    ctx.lineTo(ex + side * 5.5, -27);
    ctx.lineTo(ex + 5 - side * 1.5, -7);
    ctx.closePath();
    ctx.fillStyle = look.inner;
    ctx.fill();
  }
  // head shape
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 15.5, 0, 0, TAU);
  const hg = ctx.createRadialGradient(-5, -6, 2, 0, 0, 20);
  hg.addColorStop(0, '#fff2ee');
  hg.addColorStop(0.35, look.skin);
  hg.addColorStop(1, look.shade);
  fillOl(ctx, hg, 2.4);
  // forehead wrinkles
  ctx.strokeStyle = look.shade;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -11);
  ctx.quadraticCurveTo(0, -13.5, 6, -11);
  ctx.moveTo(-4, -7.5);
  ctx.quadraticCurveTo(0, -9.5, 4, -7.5);
  ctx.stroke();
  // eyes
  const eyeY = -1;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 7.5 - 1, eyeY);
    if (st.dizzy || st.flying) {
      ctx.strokeStyle = OL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(3, 3);
      ctx.moveTo(3, -3);
      ctx.lineTo(-3, 3);
      ctx.stroke();
    } else {
      ctx.rotate(side * -0.25);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.2, 3.6 + (st.scared ?? 0) * 1.6, 0, 0, TAU);
      fillOl(ctx, look.eye, 1.8);
      ctx.fillStyle = '#121016';
      ctx.beginPath();
      ctx.ellipse(-0.6, 0, 1.2, 3.2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-2, -1.4, 1.1, 0, TAU);
      ctx.fill();
      // heavy smug lid
      ctx.fillStyle = look.shade;
      ctx.beginPath();
      ctx.ellipse(0, -2.6, 5.6, 2.2, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = OL;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5.4, -0.8);
      ctx.lineTo(5.4, -1.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  // nose + mouth
  ctx.fillStyle = look.inner;
  ctx.beginPath();
  ctx.moveTo(-3.5, 5);
  ctx.lineTo(1.5, 5);
  ctx.lineTo(-1, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-1, 8);
  ctx.quadraticCurveTo(-3, 11, -6, 9.5);
  ctx.moveTo(-1, 8);
  ctx.quadraticCurveTo(1, 11, 4, 9.5);
  ctx.stroke();
  // whisker stubs
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(-12, 6);
  ctx.lineTo(-20, 5);
  ctx.moveTo(-12, 8.5);
  ctx.lineTo(-19, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (look.acc === 'bow') {
    ctx.save();
    ctx.translate(9, -12);
    ctx.rotate(0.3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -5);
    ctx.lineTo(-7, 5);
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7, -5);
    ctx.lineTo(7, 5);
    ctx.closePath();
    fillOl(ctx, look.accColor, 1.6);
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, TAU);
    fillOl(ctx, look.accColor2, 1.2);
    ctx.restore();
  } else if (look.acc === 'hat') {
    // tiny party hat
    ctx.save();
    ctx.translate(-2, -14);
    ctx.rotate(-0.2);
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(0, -20);
    ctx.lineTo(8, 0);
    ctx.closePath();
    fillOl(ctx, look.accColor, 1.8);
    ctx.fillStyle = look.accColor2;
    ctx.beginPath();
    ctx.arc(-2, -6, 1.8, 0, TAU);
    ctx.arc(2.5, -11, 1.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -21, 3, 0, TAU);
    fillOl(ctx, look.accColor2, 1.4);
    ctx.restore();
  }
  ctx.restore();

  if (look.acc === 'bandana' || look.acc === 'collar') {
    ctx.save();
    ctx.translate(hx + 3, hy + 13);
    if (look.acc === 'bandana') {
      ctx.beginPath();
      ctx.moveTo(-12, -2);
      ctx.lineTo(12, -4);
      ctx.lineTo(1, 12);
      ctx.closePath();
      fillOl(ctx, look.accColor, 1.8);
      ctx.fillStyle = look.accColor2;
      ctx.beginPath();
      ctx.arc(-2, 1, 1.4, 0, TAU);
      ctx.arc(4, 0, 1.4, 0, TAU);
      ctx.arc(1, 5, 1.3, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, -2, 12, 3.2, -0.1, 0, TAU);
      fillOl(ctx, look.accColor, 1.6);
      ctx.beginPath();
      ctx.arc(0, 3, 3.4, 0, TAU);
      fillOl(ctx, '#f6d04a', 1.4);
    }
    ctx.restore();
  }
  ctx.restore();
}

function shadeOf(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.7);
  const g = Math.round(((n >> 8) & 255) * 0.7);
  const b = Math.round((n & 255) * 0.7);
  return `rgb(${r},${g},${b})`;
}

function drawBox(ctx: CanvasRenderingContext2D, st: BingusState, look: BingusLook) {
  const pop = clamp(st.boxOpen ?? 0, 0, 1);
  // bingus head peeking out
  ctx.save();
  ctx.beginPath();
  ctx.rect(-40, -120, 80, 84);
  ctx.clip();
  ctx.save();
  ctx.translate(0, lerp(14, -10, pop));
  // ears
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 9 - 9, -44);
    ctx.lineTo(side * 16, -72);
    ctx.lineTo(side * 9 + 9 - side * 2, -42);
    ctx.closePath();
    fillOl(ctx, look.skin, 2.2);
    ctx.fillStyle = look.inner;
    ctx.beginPath();
    ctx.moveTo(side * 9 - 4, -46);
    ctx.lineTo(side * 14.5, -65);
    ctx.lineTo(side * 9 + 4, -45);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, -38, 18, 15, 0, 0, TAU);
  fillOl(ctx, look.skin, 2.4);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 7, -39, 4.6, 3.4 + pop * 1.2, 0, 0, TAU);
    fillOl(ctx, look.eye, 1.6);
    ctx.fillStyle = '#121016';
    ctx.beginPath();
    ctx.ellipse(side * 7, -39, 1.1, 3, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  // cardboard box
  ctx.beginPath();
  ctx.moveTo(-34, -40);
  ctx.lineTo(34, -40);
  ctx.lineTo(32, 0);
  ctx.lineTo(-32, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -40, 0, 0);
  g.addColorStop(0, '#d9a066');
  g.addColorStop(1, '#b37a44');
  fillOl(ctx, g, 2.4);
  // flaps
  const fl = pop * 0.9;
  ctx.save();
  ctx.translate(-34, -40);
  ctx.rotate(-0.3 - fl);
  ctx.beginPath();
  ctx.rect(-26, -6, 28, 8);
  fillOl(ctx, '#c88f55', 2);
  ctx.restore();
  ctx.save();
  ctx.translate(34, -40);
  ctx.rotate(0.3 + fl);
  ctx.beginPath();
  ctx.rect(-2, -6, 28, 8);
  fillOl(ctx, '#c88f55', 2);
  ctx.restore();
  // tape + scribble
  ctx.fillStyle = 'rgba(240,220,170,0.7)';
  ctx.fillRect(-6, -40, 12, 40);
  ctx.strokeStyle = '#6b3f1e';
  ctx.lineWidth = 1.6;
  ctx.font = 'bold 9px Fredoka, sans-serif';
  ctx.fillStyle = '#6b3f1e';
  ctx.fillText('FRAGILE', -30, -14);
}

// =====================================================================
// PIPES
// =====================================================================
export interface PipeStyle {
  base: string;
  light: string;
  dark: string;
  flange: string;
  rust: number; // 0..1
}
export const PIPE_STYLES: Record<string, PipeStyle> = {
  copper: { base: '#b8693c', light: '#f0a774', dark: '#5e2f17', flange: '#8a4a28', rust: 0.25 },
  steel: { base: '#7d8aa3', light: '#d3dceb', dark: '#2f3647', flange: '#5a6680', rust: 0.15 },
  green: { base: '#3f8a6a', light: '#8fe0b8', dark: '#173d2e', flange: '#2c6650', rust: 0.35 },
  red: { base: '#b3384a', light: '#f08a98', dark: '#4e1420', flange: '#8a2536', rust: 0.1 },
  violet: { base: '#6a55a8', light: '#c2b2f2', dark: '#251a47', flange: '#4f3f88', rust: 0.05 },
};

function cylGrad(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, st: PipeStyle) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, st.dark);
  g.addColorStop(0.18, st.base);
  g.addColorStop(0.36, st.light);
  g.addColorStop(0.55, st.base);
  g.addColorStop(1, st.dark);
  return g;
}

/** Horizontal pipe segment centred on y with radius r. */
export function pipeH(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, r: number, st: PipeStyle, seed = 0) {
  ctx.beginPath();
  ctx.rect(x, y - r, w, r * 2);
  fillOl(ctx, cylGrad(ctx, 0, y - r, 0, y + r, st), 2.4);
  // rust streaks
  if (st.rust > 0) {
    ctx.save();
    ctx.globalAlpha = st.rust;
    ctx.fillStyle = '#6b3415';
    for (let i = 0; i < Math.floor(w / 50); i++) {
      const rx = x + ((seed * 37 + i * 53) % Math.max(1, w - 10));
      ctx.fillRect(rx, y + r * 0.2, 3, r * 0.75);
    }
    ctx.restore();
  }
  flangeV(ctx, x + 2, y, r, st);
  flangeV(ctx, x + w - 2, y, r, st);
  for (let fx = x + 110; fx < x + w - 60; fx += 130) flangeV(ctx, fx, y, r, st);
}

function flangeV(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, st: PipeStyle) {
  ctx.beginPath();
  ctx.rect(x - 5, y - r - 4, 10, r * 2 + 8);
  fillOl(ctx, cylGrad(ctx, 0, y - r - 4, 0, y + r + 4, { ...st, base: st.flange }), 2);
  ctx.fillStyle = st.light;
  ctx.beginPath();
  ctx.arc(x, y - r + 1, 1.6, 0, TAU);
  ctx.arc(x, y + r - 1, 1.6, 0, TAU);
  ctx.fill();
}

/** Vertical pipe from y0 (top) to y1 (bottom) centred on x. */
export function pipeV(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, r: number, st: PipeStyle, cap = true) {
  ctx.beginPath();
  ctx.rect(x - r, y0, r * 2, y1 - y0);
  fillOl(ctx, cylGrad(ctx, x - r, 0, x + r, 0, st), 2.4);
  if (cap) {
    ctx.beginPath();
    ctx.rect(x - r - 5, y0 - 4, r * 2 + 10, 14);
    fillOl(ctx, cylGrad(ctx, x - r - 5, 0, x + r + 5, 0, { ...st, base: st.flange }), 2.2);
  }
}

export function valveWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color = '#d9363e') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = OL;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(-Math.cos(a) * r, -Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Low U-bend pipe rising from the ground (jump over). */
export function drawLowPipe(ctx: CanvasRenderingContext2D, x: number, gy: number, w: number, h: number, st: PipeStyle, t: number, seed: number) {
  const r = 15;
  pipeV(ctx, x + r + 4, gy - h, gy + 4, r, st, false);
  pipeV(ctx, x + w - r - 4, gy - h, gy + 4, r, st, false);
  pipeH(ctx, x, gy - h, w, r, st, seed);
  // elbow caps
  for (const ex of [x + r + 4, x + w - r - 4]) {
    ctx.beginPath();
    ctx.arc(ex, gy - h, r + 3, 0, TAU);
    fillOl(ctx, cylGrad(ctx, ex - r, gy - h - r, ex + r, gy - h + r, st), 2.2);
  }
  if (seed % 2 === 0) valveWheel(ctx, x + w / 2, gy - h - r - 8, 11, t * 0.6 + seed);
  // ground flanges
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, gy + 2, w / 2 + 6, 6, 0, 0, TAU);
  ctx.fill();
}

/** Tall stack pipe (needs a high jump). */
export function drawTallPipe(ctx: CanvasRenderingContext2D, x: number, gy: number, w: number, h: number, st: PipeStyle, t: number, seed: number) {
  const r = w / 2;
  pipeV(ctx, x + r, gy - h, gy + 4, r, st, true);
  // rings
  for (let yy = gy - h + 50; yy < gy - 20; yy += 55) {
    ctx.beginPath();
    ctx.rect(x - 3, yy, w + 6, 9);
    fillOl(ctx, cylGrad(ctx, x - 3, 0, x + w + 3, 0, { ...st, base: st.flange }), 2);
  }
  // pressure gauge
  ctx.save();
  ctx.translate(x + r, gy - h * 0.55);
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, TAU);
  fillOl(ctx, '#f4f1e8', 2.2);
  ctx.strokeStyle = '#d33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const a = -2.2 + Math.sin(t * 5 + seed) * 0.4 + 1.6;
  ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
  ctx.stroke();
  ctx.restore();
  // steam puff at top
  const puff = (t * 0.8 + seed * 0.37) % 1;
  ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - puff)})`;
  ctx.beginPath();
  ctx.arc(x + r + puff * 10, gy - h - 12 - puff * 40, 8 + puff * 14, 0, TAU);
  ctx.fill();
}

/** Overhead pipe hanging from above (slide under). Returns nozzle x for drips. */
export function drawOverPipe(ctx: CanvasRenderingContext2D, x: number, bottomY: number, w: number, st: PipeStyle, t: number, seed: number, nozzle: boolean) {
  const r = 22;
  const cy = bottomY - r;
  // hangers to the ceiling
  for (const hx of [x + 30, x + w - 30]) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(hx, -400);
    ctx.lineTo(hx, cy);
    ctx.stroke();
    ctx.strokeStyle = '#6b6f80';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  pipeH(ctx, x, cy, w, r, st, seed);
  // vertical riser into ceiling
  pipeV(ctx, x + w * 0.55, -400, cy - r + 4, 14, st, false);
  // hazard stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 18, cy + r - 9, w - 36, 7);
  ctx.clip();
  for (let i = -2; i < w / 14 + 2; i++) {
    ctx.fillStyle = i % 2 ? '#1d1a22' : '#f5c531';
    ctx.beginPath();
    ctx.moveTo(x + 18 + i * 14, cy + r - 2);
    ctx.lineTo(x + 18 + i * 14 + 7, cy + r - 9);
    ctx.lineTo(x + 18 + i * 14 + 21, cy + r - 9);
    ctx.lineTo(x + 18 + i * 14 + 14, cy + r - 2);
    ctx.fill();
  }
  ctx.restore();
  if (nozzle) {
    const nx = x + w * 0.3;
    ctx.beginPath();
    ctx.rect(nx - 7, cy + r - 2, 14, 12);
    fillOl(ctx, '#9aa2b5', 2);
    // forming drip
    const f = (t * 0.9 + seed * 0.3) % 1;
    ctx.beginPath();
    ctx.ellipse(nx, cy + r + 12 + f * 3, 3 + f * 3, 3 + f * 5, 0, 0, TAU);
    fillOl(ctx, '#fff7d8', 1.4, '#d9c47a');
  }
}

/** Steam vent: floor grate that periodically blasts steam (jump over when active). */
export function drawSteamVent(ctx: CanvasRenderingContext2D, x: number, gy: number, w: number, power: number, t: number) {
  ctx.beginPath();
  ctx.rect(x, gy - 8, w, 10);
  fillOl(ctx, '#3a3f4f', 2.2);
  ctx.strokeStyle = '#1b1e28';
  ctx.lineWidth = 2;
  for (let i = 8; i < w; i += 9) {
    ctx.beginPath();
    ctx.moveTo(x + i, gy - 6);
    ctx.lineTo(x + i, gy);
    ctx.stroke();
  }
  // warning light
  const on = power > 0.05;
  ctx.fillStyle = on ? '#ff4d4d' : power < -0.6 ? `rgba(255,190,60,${0.5 + 0.5 * Math.sin(t * 20)})` : '#6b2b2b';
  ctx.beginPath();
  ctx.arc(x + w + 8, gy - 6, 4, 0, TAU);
  ctx.fill();
  if (on) {
    const h = 150 * power;
    for (let i = 0; i < 9; i++) {
      const k = i / 9;
      const yy = gy - 10 - k * h;
      const rr = 14 + k * 26;
      const wob = Math.sin(t * 13 + i * 1.7) * 6;
      ctx.fillStyle = `rgba(240,245,255,${0.55 * (1 - k * 0.7) * Math.min(1, power * 1.4)})`;
      ctx.beginPath();
      ctx.arc(x + w / 2 + wob, yy, rr, 0, TAU);
      ctx.fill();
    }
  }
}

// =====================================================================
// MAYO
// =====================================================================
export function drawMayoPuddle(ctx: CanvasRenderingContext2D, x: number, gy: number, w: number, t: number, seed: number) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const px = k * w;
    const py = -Math.sin(k * Math.PI) * (7 + Math.sin(seed + i * 2.1) * 2);
    if (i === 0) ctx.moveTo(px, 2);
    ctx.lineTo(px, py + 2);
  }
  for (let i = n; i >= 0; i--) {
    const k = i / n;
    ctx.lineTo(k * w, 4 + Math.sin(k * Math.PI) * 5);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, '#fffbe8');
  g.addColorStop(1, '#f2e2a8');
  fillOl(ctx, g, 2, '#c9b26a');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(w * 0.32, -2, w * 0.12, 1.6, 0, 0, TAU);
  ctx.ellipse(w * 0.68, -1, w * 0.06, 1.2, 0, 0, TAU);
  ctx.fill();
  // bubble
  const b = (t * 0.7 + seed) % 1;
  ctx.globalAlpha = 1 - b;
  ctx.strokeStyle = '#d9c47a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(w * 0.5 + Math.sin(seed) * w * 0.2, -4 - b * 6, 2 + b * 3, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export function drawMayoDrop(ctx: CanvasRenderingContext2D, x: number, y: number, vy: number) {
  const st = clamp(vy / 900, 0, 1);
  ctx.beginPath();
  ctx.moveTo(x, y - 10 - st * 10);
  ctx.quadraticCurveTo(x + 8, y, x, y + 7);
  ctx.quadraticCurveTo(x - 8, y, x, y - 10 - st * 10);
  fillOl(ctx, '#fff7d8', 1.8, '#c9b26a');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - 2, y - 1, 1.6, 0, TAU);
  ctx.fill();
}

/** Rolling mayo jar (jump or slap). */
export function drawMayoJar(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(rot);
  // body (circle silhouette as it rolls)
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  const g = ctx.createRadialGradient(-8, -8, 3, 0, 0, 28);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#fdf6dc');
  g.addColorStop(1, '#e6d59a');
  fillOl(ctx, g, 2.6);
  // label band
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#2f5fd0';
  ctx.fillRect(-30, -10, 60, 20);
  ctx.fillStyle = '#e8384f';
  ctx.fillRect(-30, -10, 60, 4);
  ctx.fillRect(-30, 6, 60, 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAYO', 0, 0.5);
  ctx.restore();
  // lid (rotates with jar)
  ctx.beginPath();
  ctx.rect(-14, -32, 28, 9);
  fillOl(ctx, '#2f5fd0', 2);
  // glass shine
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 20, -2.6, -1.9);
  ctx.stroke();
  ctx.restore();
}

/** Mayo squeeze-bottle turret (stage 2/3): squirts arcs of mayo. */
export function drawMayoBottle(ctx: CanvasRenderingContext2D, x: number, gy: number, squeeze: number) {
  ctx.save();
  ctx.translate(x, gy);
  const sq = squeeze;
  ctx.scale(1 + sq * 0.12, 1 - sq * 0.1);
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-20, -52);
  ctx.quadraticCurveTo(0, -64, 20, -52);
  ctx.lineTo(18, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-20, 0, 20, 0);
  g.addColorStop(0, '#e9dc9e');
  g.addColorStop(0.35, '#fffbe6');
  g.addColorStop(1, '#d9c67a');
  fillOl(ctx, g, 2.4);
  ctx.fillStyle = '#e8384f';
  ctx.fillRect(-19, -40, 38, 18);
  ctx.fillStyle = '#fff';
  ctx.font = '900 10px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MAYO', 0, -27);
  // nozzle cap pointing left
  ctx.beginPath();
  ctx.moveTo(-6, -58);
  ctx.lineTo(6, -58);
  ctx.lineTo(3, -68);
  ctx.lineTo(-14, -78);
  ctx.lineTo(-16, -74);
  ctx.lineTo(-3, -66);
  ctx.closePath();
  fillOl(ctx, '#e8384f', 2);
  // angry eyes
  ctx.fillStyle = OL;
  ctx.beginPath();
  ctx.ellipse(-8, -12, 3, 4, 0, 0, TAU);
  ctx.ellipse(7, -12, 3, 4, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-13, -19);
  ctx.lineTo(-4, -16);
  ctx.moveTo(12, -19);
  ctx.lineTo(3, -16);
  ctx.stroke();
  ctx.restore();
}

// =====================================================================
// COLLECTIBLES & POWER-UPS
// =====================================================================
export function starPath(ctx: CanvasRenderingContext2D, r: number, inner = 0.48) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, big = false) {
  const r = big ? 22 : 13;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3 + x * 0.01) * 3);
  // glow (cached sprite)
  const glowS = cachedSprite(big ? 'starglow-big' : 'starglow', 64, (c, R) => {
    const gl = c.createRadialGradient(0, 0, 0, 0, 0, R);
    gl.addColorStop(0, big ? 'rgba(255,170,230,0.55)' : 'rgba(255,225,120,0.5)');
    gl.addColorStop(1, 'rgba(255,225,120,0)');
    c.fillStyle = gl;
    c.fillRect(-R, -R, R * 2, R * 2);
  });
  ctx.drawImage(glowS, -r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
  ctx.scale(Math.cos(t * 2.4 + x * 0.013) * 0.35 + 0.65, 1);
  ctx.rotate(Math.sin(t * 2) * 0.1);
  starPath(ctx, r);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  if (big) {
    g.addColorStop(0, '#fff0fb');
    g.addColorStop(0.5, '#ff8fd4');
    g.addColorStop(1, '#c04aa8');
  } else {
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.5, '#ffd84a');
    g.addColorStop(1, '#f0a020');
  }
  fillOl(ctx, g, big ? 2.6 : 2, big ? '#6a1d5a' : '#8a4a10');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.3, r * 0.18, r * 0.1, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export type PowerKind = 'pickle' | 'pie' | 'pear' | 'rice';
export const POWER_COLORS: Record<PowerKind, string> = { pickle: '#7ed957', pie: '#ffb36b', pear: '#ffe66b', rice: '#ffdca8' };

export function drawPickle(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1, rot = -0.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 21, 0, 0, TAU);
  const g = ctx.createLinearGradient(-9, 0, 9, 0);
  g.addColorStop(0, '#3f8a2a');
  g.addColorStop(0.4, '#8fd65a');
  g.addColorStop(1, '#2f6b1f');
  fillOl(ctx, g, 2.2, '#1f3d12');
  ctx.fillStyle = '#c4f08a';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(Math.sin(i * 2.4) * 4.5, -15 + i * 6, 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-3.5, -6, 1.6, 7, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawPear(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(8, -18, 7, -6, 13, 2);
  ctx.bezierCurveTo(20, 12, 12, 21, 0, 21);
  ctx.bezierCurveTo(-12, 21, -20, 12, -13, 2);
  ctx.bezierCurveTo(-7, -6, -8, -18, 0, -18);
  const g = ctx.createRadialGradient(-5, 2, 2, 0, 4, 22);
  g.addColorStop(0, '#fff6a8');
  g.addColorStop(0.5, '#f2d53a');
  g.addColorStop(1, '#b49a12');
  fillOl(ctx, g, 2.2, '#5a4a08');
  ctx.strokeStyle = '#5a3a14';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.quadraticCurveTo(1, -23, 4, -26);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(8, -23, 7, 3.2, -0.5, 0, TAU);
  fillOl(ctx, '#5ec24a', 1.6, '#24501a');
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-6, 4, 2.4, 5, 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawPowerBubble(ctx: CanvasRenderingContext2D, x: number, y: number, kind: PowerKind, t: number) {
  const bob = Math.sin(t * 3 + x * 0.01) * 5;
  ctx.save();
  ctx.translate(x, y + bob);
  const c = POWER_COLORS[kind];
  // rays
  ctx.save();
  ctx.rotate(t * 0.8);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = c;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(TAU / 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -52);
    ctx.lineTo(7, -52);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const gl = ctx.createRadialGradient(0, 0, 10, 0, 0, 46);
  gl.addColorStop(0, 'rgba(255,255,255,0.25)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, TAU);
  ctx.fill();
  // bubble
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, TAU);
  const bg = ctx.createRadialGradient(-9, -11, 3, 0, 0, 31);
  bg.addColorStop(0, 'rgba(255,255,255,0.75)');
  bg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  bg.addColorStop(1, c + 'aa');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  // icon
  if (kind === 'pickle') drawPickle(ctx, 0, 1, 0.95);
  else if (kind === 'pear') drawPear(ctx, 0, 2, 0.95);
  else if (kind === 'rice') drawRiceBowl(ctx, 0, 6, 0.95, t);
  else drawPie(ctx, 0, 6, Math.PI, 1.45);
  // shine
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 23, -2.5, -1.9);
  ctx.stroke();
  ctx.restore();
}

// =====================================================================
// THE MOLD
// =====================================================================
export function drawMold(
  ctx: CanvasRenderingContext2D,
  edgeX: number,
  top: number,
  bottom: number,
  gy: number,
  t: number,
  anger: number,
  lookY: number,
) {
  const left = Math.min(edgeX - 520, -200);
  // aura glow ahead of the edge
  const ag = ctx.createLinearGradient(edgeX - 40, 0, edgeX + 220, 0);
  ag.addColorStop(0, `rgba(120,220,90,${0.28 + anger * 0.2})`);
  ag.addColorStop(1, 'rgba(120,220,90,0)');
  ctx.fillStyle = ag;
  ctx.fillRect(edgeX - 40, top, 260, bottom - top);

  const edge = (y: number) =>
    edgeX +
    fbm1(y * 0.012 + t * 0.6, 3) * 34 +
    Math.sin(y * 0.03 - t * 3) * 7 +
    // bulge toward the ground where it crawls
    Math.max(0, 1 - Math.abs(y - gy + 40) / 160) * 40;

  // tendrils along the ground
  const reach = 70 + anger * 130;
  for (let i = 0; i < 4; i++) {
    const ty = gy - 6 - i * 22;
    const len = reach * (0.6 + 0.4 * Math.sin(t * 1.7 + i * 2));
    const x0 = edge(ty) - 10;
    ctx.strokeStyle = '#1d3b17';
    ctx.lineCap = 'round';
    ctx.lineWidth = 15 - i * 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, ty);
    ctx.bezierCurveTo(
      x0 + len * 0.35,
      ty - 18 + Math.sin(t * 4 + i) * 12,
      x0 + len * 0.7,
      ty + 8 + Math.sin(t * 5 + i * 3) * 10,
      x0 + len,
      ty - 4 + Math.sin(t * 6 + i) * 8,
    );
    ctx.stroke();
    ctx.strokeStyle = '#5fa83d';
    ctx.lineWidth = 9 - i * 1.8;
    ctx.stroke();
    ctx.fillStyle = '#b6ee6c';
    ctx.beginPath();
    ctx.arc(x0 + len, ty - 4 + Math.sin(t * 6 + i) * 8, 4.5 - i * 0.6, 0, TAU);
    ctx.fill();
  }

  // main mass
  ctx.beginPath();
  ctx.moveTo(left, top);
  for (let y = top; y <= bottom; y += 12) ctx.lineTo(edge(y), y);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  const g = ctx.createLinearGradient(edgeX - 380, 0, edgeX + 20, 0);
  g.addColorStop(0, '#07150c');
  g.addColorStop(0.45, '#163a1c');
  g.addColorStop(0.8, '#2d6a2a');
  g.addColorStop(1, '#4f9a3a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // spore clusters / lumps
  for (let i = 0; i < 26; i++) {
    const yy = top + ((i * 97.3) % (bottom - top));
    const xx = edge(yy) - 30 - ((i * 53.7) % 260);
    const r = 16 + ((i * 31) % 34) + Math.sin(t * 2 + i) * 3;
    const hue = i % 3;
    const lump = cachedSprite('moldlump' + hue, 96, (c, R) => {
      const lg = c.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
      lg.addColorStop(0, hue === 0 ? '#9ad85a' : hue === 1 ? '#6fbf8a' : '#c2e86a');
      lg.addColorStop(0.6, hue === 0 ? '#3f7f2c' : hue === 1 ? '#2f6b4a' : '#5a8a2a');
      lg.addColorStop(1, 'rgba(20,50,20,0)');
      c.fillStyle = lg;
      c.beginPath();
      c.arc(0, 0, R, 0, TAU);
      c.fill();
    });
    ctx.drawImage(lump, xx - r, yy - r, r * 2, r * 2);
    // dark spots
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(10,25,10,0.55)';
      ctx.beginPath();
      ctx.arc(xx + r * 0.2, yy + r * 0.25, r * 0.18, 0, TAU);
      ctx.arc(xx - r * 0.3, yy + r * 0.1, r * 0.1, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  // fuzzy edge
  ctx.lineCap = 'round';
  for (let y = top; y <= bottom; y += 7) {
    const ex = edge(y);
    const len = 8 + Math.abs(Math.sin(y * 0.37 + t * 2)) * 12;
    const a = Math.sin(y * 0.11 + t) * 0.6;
    ctx.strokeStyle = y % 14 === 0 ? 'rgba(190,240,120,0.75)' : 'rgba(120,200,90,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex - 3, y);
    ctx.lineTo(ex + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
    if (y % 21 === 0) {
      ctx.fillStyle = 'rgba(220,255,160,0.8)';
      ctx.beginPath();
      ctx.arc(ex + Math.cos(a) * len, y + Math.sin(a) * len, 2, 0, TAU);
      ctx.fill();
    }
  }

  // eyes
  const eyes = [
    { y: gy - 230, r: 17, off: 70 },
    { y: gy - 150, r: 23, off: 44 },
    { y: gy - 330, r: 12, off: 90 },
    { y: gy - 80, r: 11, off: 110 },
  ];
  eyes.forEach((e, i) => {
    const ex = edge(e.y) - e.off;
    const blink = Math.max(0, Math.sin(t * 0.9 + i * 2.3) - 0.96) * 25;
    const open = clamp(1 - blink, 0.05, 1);
    ctx.save();
    ctx.translate(ex, e.y);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 2.6);
    glow.addColorStop(0, `rgba(230,255,90,${0.45 + anger * 0.3})`);
    glow.addColorStop(1, 'rgba(230,255,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 2.6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r * 1.15, e.r * open, 0, 0, TAU);
    const eg = ctx.createRadialGradient(0, -e.r * 0.3, 1, 0, 0, e.r * 1.2);
    eg.addColorStop(0, '#fbffd0');
    eg.addColorStop(0.6, '#e2f04a');
    eg.addColorStop(1, '#8aa818');
    fillOl(ctx, eg, 2.4, '#0b1a08');
    if (open > 0.3) {
      const dy = clamp((lookY - e.y) / 300, -1, 1) * e.r * 0.3;
      ctx.fillStyle = '#0b1408';
      ctx.beginPath();
      ctx.ellipse(e.r * 0.35, dy, e.r * 0.2, e.r * 0.75 * open, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(-e.r * 0.3, -e.r * 0.35, e.r * 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  });

  // grin (more visible when angry/close)
  if (anger > 0.15) {
    const my = gy - 105;
    const mx = edge(my) - 60;
    const w = 50 + anger * 30;
    const open = 6 + anger * 18 + Math.sin(t * 6) * 3;
    ctx.save();
    ctx.globalAlpha = clamp((anger - 0.15) * 3, 0, 1);
    ctx.beginPath();
    ctx.moveTo(mx - w, my - 4);
    ctx.quadraticCurveTo(mx, my + 10, mx + w * 0.6, my - 12);
    ctx.quadraticCurveTo(mx, my + 10 + open * 1.4, mx - w, my - 4);
    ctx.fillStyle = '#081005';
    ctx.fill();
    ctx.fillStyle = '#e8f5b8';
    for (let i = 0; i < 6; i++) {
      const k = 0.1 + i * 0.15;
      const tx = lerp(mx - w, mx + w * 0.6, k);
      const ty = lerp(my - 4, my - 12, k) + Math.sin(k * Math.PI) * 9;
      ctx.beginPath();
      ctx.moveTo(tx - 4, ty - 1);
      ctx.lineTo(tx + 4, ty - 1);
      ctx.lineTo(tx, ty + 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}


/** Steaming bowl of brothy rice. */
export function drawRiceBowl(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // steam
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const w = Math.sin(t * 3 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(i * 6, -14);
    ctx.bezierCurveTo(i * 6 + 4 + w, -18, i * 6 - 4 - w, -22, i * 6 + w, -27);
    ctx.stroke();
  }
  // rice mound + broth
  ctx.beginPath();
  ctx.ellipse(0, -6, 15, 7, 0, Math.PI, TAU);
  fillOl(ctx, '#fffdf6', 1.8);
  ctx.fillStyle = '#e8c27a';
  ctx.beginPath();
  ctx.ellipse(0, -5, 15, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7ed957';
  ctx.beginPath();
  ctx.arc(-5, -9, 1.6, 0, TAU);
  ctx.arc(4, -10, 1.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2a33a';
  ctx.beginPath();
  ctx.ellipse(7, -8, 3, 1.6, 0.3, 0, TAU);
  ctx.fill();
  // bowl
  ctx.beginPath();
  ctx.moveTo(-17, -5);
  ctx.quadraticCurveTo(-15, 11, 0, 12);
  ctx.quadraticCurveTo(15, 11, 17, -5);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -5, 0, 12);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#dfe6f2');
  fillOl(ctx, g, 2);
  ctx.strokeStyle = '#e8384f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.quadraticCurveTo(0, 4, 15, 0);
  ctx.stroke();
  ctx.fillStyle = '#2f5fd0';
  ctx.fillRect(-4, 11, 8, 3);
  ctx.restore();
}

/** The golden key (secret ending). */
export function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, s = 1) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3) * 4);
  ctx.scale(s, s);
  const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
  gl.addColorStop(0, 'rgba(255,230,120,0.55)');
  gl.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-46, -46, 92, 92);
  ctx.rotate(-0.6 + Math.sin(t * 2) * 0.15);
  ctx.beginPath();
  ctx.arc(-12, 0, 9, 0, TAU);
  ctx.moveTo(-6, -3);
  ctx.lineTo(18, -3);
  ctx.lineTo(18, 3);
  ctx.lineTo(14, 3);
  ctx.lineTo(14, 9);
  ctx.lineTo(10, 9);
  ctx.lineTo(10, 3);
  ctx.lineTo(6, 3);
  ctx.lineTo(6, 7);
  ctx.lineTo(2, 7);
  ctx.lineTo(2, 3);
  ctx.lineTo(-6, 3);
  const g = ctx.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, '#fff3a0');
  g.addColorStop(0.5, '#ffd84a');
  g.addColorStop(1, '#c48a10');
  ctx.fillStyle = g;
  ctx.fill('evenodd');
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-12, 0, 4, 0, TAU);
  ctx.fillStyle = '#2a1a40';
  ctx.fill();
  ctx.stroke();
  // sparkle
  ctx.rotate(0.6);
  const k = (t * 1.3) % 1;
  ctx.globalAlpha = 1 - k;
  starPath(ctx, 5 + k * 4);
  ctx.translate(14, -14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

/** Mysterious rooftop door (opens with the golden key). */
export function drawSecretDoor(ctx: CanvasRenderingContext2D, x: number, gy: number, t: number, open: number, unlockable: boolean) {
  ctx.save();
  ctx.translate(x, gy);
  // little stair hut
  ctx.beginPath();
  ctx.rect(-70, -200, 140, 200);
  const hg = ctx.createLinearGradient(0, -200, 0, 0);
  hg.addColorStop(0, '#3b2d6b');
  hg.addColorStop(1, '#2a2058');
  fillOl(ctx, hg, 2.6);
  ctx.beginPath();
  ctx.moveTo(-82, -196);
  ctx.lineTo(0, -236);
  ctx.lineTo(82, -196);
  ctx.closePath();
  fillOl(ctx, '#4a3a82', 2.6);
  // door glow
  const glowA = unlockable ? 0.55 + 0.25 * Math.sin(t * 4) : 0.2;
  ctx.globalCompositeOperation = 'lighter';
  const gg = ctx.createRadialGradient(0, -70, 10, 0, -70, 140);
  gg.addColorStop(0, `rgba(255,150,220,${glowA})`);
  gg.addColorStop(1, 'rgba(255,150,220,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(-140, -210, 280, 220);
  ctx.globalCompositeOperation = 'source-over';
  // door frame + light behind
  ctx.fillStyle = '#ffd6f0';
  ctx.fillRect(-34, -140, 68, 140);
  ctx.save();
  ctx.translate(-34, -140);
  ctx.scale(1 - open * 0.85, 1);
  ctx.beginPath();
  ctx.rect(0, 0, 68, 140);
  const dg = ctx.createLinearGradient(0, 0, 68, 0);
  dg.addColorStop(0, '#6a2a5a');
  dg.addColorStop(1, '#8e3a78');
  fillOl(ctx, dg, 2.6);
  // heart window + keyhole
  ctx.translate(34, 40);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6);
  ctx.bezierCurveTo(8, -14, 14, -2, 0, 8);
  fillOl(ctx, unlockable ? '#ffb3e0' : '#c48bb0', 2);
  ctx.translate(0, 46);
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, TAU);
  ctx.moveTo(-3, 2);
  ctx.lineTo(-5, 14);
  ctx.lineTo(5, 14);
  ctx.lineTo(3, 2);
  ctx.fillStyle = '#1a0f20';
  ctx.fill();
  ctx.restore();
  // sign
  ctx.fillStyle = '#fff';
  ctx.font = '13px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(unlockable ? 'PRIVATE ♡' : '🔒 PRIVATE', 0, -156);
  ctx.restore();
}
