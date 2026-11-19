import { clamp, lerp, TAU } from '../util';

export type Expr = 'idle' | 'run' | 'panic' | 'hurt' | 'happy' | 'blank' | 'smug';
export type Outfit = 'maid' | 'regular';

export interface Pose {
  t: number; // seconds, for secondary motion
  run: number; // run cycle phase (radians)
  runAmt: number; // 0 idle → 1 running
  air: number; // 0 grounded → 1 airborne
  vy: number; // vertical velocity (px/s, up negative)
  slide: number; // 0..1
  stumble: number; // 0..1
  slap: number; // 0 = not slapping; (0,1] = swing progress
  spin: number; // radians of flip rotation (double jump)
  expr: Expr;
  blink: number; // 0 open → 1 closed
  outfit: Outfit;
  mayo: number; // 0..1 coverage
  holdPie: boolean;
  wave?: number; // 0..1 victory wave
}

export const defaultPose = (): Pose => ({
  t: 0,
  run: 0,
  runAmt: 0,
  air: 0,
  vy: 0,
  slide: 0,
  stumble: 0,
  slap: 0,
  spin: 0,
  expr: 'idle',
  blink: 0,
  outfit: 'maid',
  mayo: 0,
  holdPie: false,
});

// ---------- palette ----------
const OL = '#2a1420';
const SKIN = '#ffe9df';
const SKIN_SH = '#f6c5b8';
const SKIN_FAR = '#f3cfc4';
const HAIR = '#1f1b29';
const HAIR_MID = '#2c2840';
const HAIR_HL = '#4a4568';
const RED = '#d4283f';
const RED_DK = '#8e1226';
const MAID_BLACK = '#211c2e';
const MAID_BLACK_HL = '#3a3352';
const WHITE = '#fdfbff';
const WHITE_SH = '#dcd7ec';
const STOCK = '#fbf8ff';
const STOCK_FAR = '#d9d4e8';
const PINK = '#f59cbe';
const JACKET = '#f7f5fa';
const JACKET_SH = '#d3cee0';
const PANTS = '#272434';
const PANTS_FAR = '#1c1a27';
const MAYO = '#fff7d8';
const MAYO_SH = '#efdc9c';

interface Limbs {
  nThigh: number;
  nShin: number;
  fThigh: number;
  fShin: number;
  nUpper: number;
  nFore: number;
  fUpper: number;
  fFore: number;
  hipY: number;
  lean: number;
  headTilt: number;
}

function blendLimbs(a: Limbs, b: Limbs, t: number): Limbs {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const o = {} as Limbs;
  for (const k of Object.keys(a) as (keyof Limbs)[]) o[k] = lerp(a[k], b[k], t);
  return o;
}

function computeLimbs(p: Pose): Limbs {
  const breathe = Math.sin(p.t * 2.2);
  const idle: Limbs = {
    nThigh: 0.06,
    nShin: 0.02,
    fThigh: -0.08,
    fShin: -0.06,
    nUpper: 0.14 + breathe * 0.03,
    nFore: 0.55,
    fUpper: -0.16 - breathe * 0.03,
    fFore: 0.3,
    hipY: -55 + breathe * 0.6,
    lean: 0.02,
    headTilt: breathe * 0.02,
  };
  const ph = p.run;
  const legAt = (q: number) => {
    const thigh = 0.12 + 0.78 * Math.sin(q);
    const bend = 0.18 + 1.25 * Math.max(0, Math.cos(q)) ** 1.3;
    return [thigh, thigh - bend];
  };
  const [nT, nS] = legAt(ph);
  const [fT, fS] = legAt(ph + Math.PI);
  const sw = Math.sin(ph);
  const run: Limbs = {
    nThigh: nT,
    nShin: nS,
    fThigh: fT,
    fShin: fS,
    nUpper: -0.85 * sw - 0.1,
    nFore: -0.85 * sw + 1.35,
    fUpper: 0.85 * sw - 0.1,
    fFore: 0.85 * sw + 1.35,
    hipY: -53 - Math.abs(Math.cos(ph)) * 5,
    lean: 0.2,
    headTilt: -0.04 + Math.sin(ph * 2) * 0.03,
  };
  let L = blendLimbs(idle, run, p.runAmt);

  if (p.air > 0) {
    const rising = clamp(-p.vy / 900, 0, 1);
    const up: Limbs = {
      nThigh: 1.15,
      nShin: -0.15,
      fThigh: -0.4,
      fShin: -1.25,
      nUpper: -2.55,
      nFore: -2.9,
      fUpper: -0.9,
      fFore: -0.2,
      hipY: -55,
      lean: 0.12,
      headTilt: -0.12,
    };
    const down: Limbs = {
      nThigh: 0.55,
      nShin: 0.15,
      fThigh: 0.1,
      fShin: -0.55,
      nUpper: -1.9,
      nFore: -1.2,
      fUpper: 1.5,
      fFore: 2.2,
      hipY: -55,
      lean: 0.08,
      headTilt: 0.06,
    };
    L = blendLimbs(L, blendLimbs(down, up, rising), p.air);
  }
  if (p.slide > 0) {
    const sl: Limbs = {
      nThigh: 1.5,
      nShin: 1.62,
      fThigh: 1.78,
      fShin: 1.15,
      nUpper: -2.2,
      nFore: -1.5,
      fUpper: -1.2,
      fFore: -0.4,
      hipY: -19,
      lean: -0.78,
      headTilt: 0.42,
    };
    L = blendLimbs(L, sl, p.slide);
  }
  if (p.stumble > 0) {
    const fl = Math.sin(p.t * 32);
    const st: Limbs = {
      nThigh: -0.5,
      nShin: -1.25,
      fThigh: 0.7,
      fShin: 0.25,
      nUpper: -2.5 + fl * 0.5,
      nFore: -2.2 + fl * 0.4,
      fUpper: -2.0 - fl * 0.5,
      fFore: -1.4,
      hipY: -51,
      lean: 0.55,
      headTilt: 0.25,
    };
    L = blendLimbs(L, st, p.stumble);
  }
  if (p.slap > 0) {
    const s = p.slap;
    // wind-up behind head → whip forward → follow-through
    let a: number;
    if (s < 0.3) a = lerp(L.nUpper, -2.9, s / 0.3);
    else if (s < 0.55) a = lerp(-2.9, 1.25, (s - 0.3) / 0.25);
    else a = lerp(1.25, 0.6, (s - 0.55) / 0.45);
    L = { ...L, nUpper: a, nFore: a + (s < 0.3 ? -0.6 : 0.15), lean: L.lean + Math.sin(s * Math.PI) * 0.15 };
  }
  if (p.wave) {
    const w = p.wave;
    L = {
      ...L,
      nUpper: lerp(L.nUpper, 1.62, w),
      nFore: lerp(L.nFore, 2.85 + Math.sin(p.t * 9) * 0.28, w),
    };
  }
  return L;
}

// ---------- primitives ----------
function limb(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  widths: number[],
  fill: string,
  ol = OL,
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? ol : fill;
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.lineWidth = widths[i] + (pass === 0 ? 3.2 : 0);
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
  }
}

const dirv = (a: number): [number, number] => [Math.sin(a), Math.cos(a)];

function fillOl(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 2.4, ol = OL) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ol;
  ctx.stroke();
}

function mayoBlob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (0.8 + 0.3 * Math.abs(Math.sin(seed * 3.1 + i * 1.7)));
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  // drip
  ctx.moveTo(-r * 0.2, r * 0.5);
  ctx.quadraticCurveTo(-r * 0.25, r * 1.6, 0, r * 1.7);
  ctx.quadraticCurveTo(r * 0.25, r * 1.6, r * 0.2, r * 0.5);
  ctx.fillStyle = MAYO;
  ctx.fill();
  ctx.strokeStyle = MAYO_SH;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.28, r * 0.18, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- body parts ----------
function drawLeg(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  thigh: number,
  shin: number,
  near: boolean,
  outfit: Outfit,
) {
  const T = 23, S = 24;
  const [tx, ty] = dirv(thigh);
  const kx = hx + tx * T, ky = hy + ty * T;
  const [sx, sy] = dirv(shin);
  const ax = kx + sx * S, ay = ky + sy * S;
  if (outfit === 'maid') {
    const stock = near ? STOCK : STOCK_FAR;
    const skin = near ? SKIN : SKIN_FAR;
    // upper thigh skin, then thigh-high stocking from mid-thigh down
    const mx = hx + tx * T * 0.45, my = hy + ty * T * 0.45;
    limb(ctx, [[hx, hy], [mx, my]], [11.5], skin);
    limb(ctx, [[mx, my], [kx, ky], [ax, ay]], [10.5, 8.6], stock);
    // pink band at stocking top
    ctx.strokeStyle = near ? PINK : '#d98aaa';
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    const nx = -ty, ny = tx;
    ctx.beginPath();
    ctx.moveTo(mx + nx * 6.2, my + ny * 6.2);
    ctx.lineTo(mx - nx * 6.2, my - ny * 6.2);
    ctx.stroke();
    if (near) {
      // tiny bow on the band
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(mx + nx * 5.5 + tx * 1.5, my + ny * 5.5 + ty * 1.5, 1.8, 0, TAU);
      ctx.fill();
    }
  } else {
    const c = near ? PANTS : PANTS_FAR;
    limb(ctx, [[hx, hy], [kx, ky], [ax, ay]], [12.5, 10.5], c);
  }
  // shoe: toe points perpendicular-forward to the shin
  const [fx, fy] = dirv(shin + Math.PI / 2);
  const toeX = ax + fx * 12;
  const toeY = ay + fy * 12;
  ctx.save();
  ctx.lineCap = 'round';
  if (outfit === 'maid') {
    limb(ctx, [[ax - Math.sin(shin) * 1, ay], [toeX, toeY]], [10], near ? '#2b2438' : '#1d1828');
    // strap highlight
    ctx.strokeStyle = near ? '#5b4f73' : '#3b3350';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ax + (toeX - ax) * 0.25, ay + (toeY - ay) * 0.25 - 3);
    ctx.lineTo(ax + (toeX - ax) * 0.55, ay + (toeY - ay) * 0.55 - 3);
    ctx.stroke();
  } else {
    limb(ctx, [[ax - 1, ay], [toeX, toeY]], [11.5], near ? '#e3394c' : '#a92738');
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const ox = Math.sin(shin) * 4.2, oy = Math.cos(shin) * 4.2;
    ctx.moveTo(ax + ox, ay + oy);
    ctx.lineTo(toeX + ox, toeY + oy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  upper: number,
  fore: number,
  near: boolean,
  outfit: Outfit,
  pie: boolean,
) {
  const U = 16, F = 15;
  const [ux, uy] = dirv(upper);
  const ex = sx + ux * U, ey = sy + uy * U;
  const [fx, fy] = dirv(fore);
  const hx = ex + fx * F, hy = ey + fy * F;
  const skin = near ? SKIN : SKIN_FAR;
  if (outfit === 'maid') {
    limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], [7.5, 6.8], skin);
    // puffy sleeve
    ctx.beginPath();
    ctx.ellipse(sx + ux * 5, sy + uy * 5, 9.5, 8, upper, 0, TAU);
    fillOl(ctx, near ? MAID_BLACK : '#18141f', 2.4);
    ctx.strokeStyle = near ? WHITE : WHITE_SH;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const cx = sx + ux * 11, cy = sy + uy * 11;
    ctx.moveTo(cx - uy * 6, cy + ux * 6);
    ctx.lineTo(cx + uy * 6, cy - ux * 6);
    ctx.stroke();
    // wrist cuff
    ctx.strokeStyle = near ? WHITE : WHITE_SH;
    ctx.lineWidth = 3;
    const wx = ex + fx * F * 0.72, wy = ey + fy * F * 0.72;
    ctx.beginPath();
    ctx.moveTo(wx - fy * 4.2, wy + fx * 4.2);
    ctx.lineTo(wx + fy * 4.2, wy - fx * 4.2);
    ctx.stroke();
  } else {
    const c = near ? JACKET : JACKET_SH;
    limb(ctx, [[sx, sy], [ex, ey], [ex + fx * F * 0.78, ey + fy * F * 0.78]], [10, 9], c);
    // red stripe on sleeve
    ctx.strokeStyle = near ? RED : RED_DK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(sx + ux * 4 + uy * 3, sy + uy * 4 - ux * 3);
    ctx.lineTo(ex + uy * 3, ey - ux * 3);
    ctx.stroke();
  }
  // hand
  ctx.beginPath();
  ctx.arc(hx, hy, 4.6, 0, TAU);
  fillOl(ctx, skin, 2.2);
  if (pie && near) drawPie(ctx, hx + fx * 6, hy + fy * 6, fore);
}

export function drawPie(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang + Math.PI);
  ctx.scale(s, s);
  // tin
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(15, 0);
  ctx.lineTo(11, 7);
  ctx.lineTo(-11, 7);
  ctx.closePath();
  fillOl(ctx, '#c9cbd8', 2);
  // crust
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 4.5, 0, 0, TAU);
  fillOl(ctx, '#e8a85a', 2);
  // cream mound
  ctx.beginPath();
  ctx.moveTo(-14, -1);
  for (let i = 0; i <= 6; i++) {
    const px = -14 + i * (28 / 6);
    ctx.quadraticCurveTo(px - 2.3, -9 - (i % 2) * 2, px, -3);
  }
  ctx.closePath();
  fillOl(ctx, '#fffaf0', 2);
  ctx.fillStyle = '#e8304a';
  ctx.beginPath();
  ctx.arc(1, -10, 3.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, p: Pose, flutter: number) {
  if (p.outfit === 'maid') {
    // skirt (bell) – drawn first so bodice overlaps waist
    const hemY = 22 + p.slide * -2;
    const fl = flutter;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.quadraticCurveTo(-24 - fl * 3, 8, -30 - fl * 6, hemY + fl * 2);
    ctx.lineTo(30 - fl * 2, hemY - fl * 1.5);
    ctx.quadraticCurveTo(24, 8, 12, -4);
    ctx.closePath();
    const sg = ctx.createLinearGradient(-30, 0, 30, 0);
    sg.addColorStop(0, '#16121f');
    sg.addColorStop(0.55, MAID_BLACK);
    sg.addColorStop(1, MAID_BLACK_HL);
    fillOl(ctx, sg, 2.6);
    // petticoat lace scallops
    ctx.beginPath();
    const n = 8;
    const x0 = -30 - fl * 6, y0 = hemY + fl * 2, x1 = 30 - fl * 2, y1 = hemY - fl * 1.5;
    ctx.moveTo(x0, y0);
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      const ax = lerp(x0, x1, a), ay = lerp(y0, y1, a);
      const bx = lerp(x0, x1, b), by = lerp(y0, y1, b);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 7, bx, by);
    }
    ctx.closePath();
    fillOl(ctx, WHITE, 2);
    // apron
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.quadraticCurveTo(-16, 8, -19 - fl * 3, hemY - 3 + fl);
    ctx.lineTo(22 - fl * 2, hemY - 4 - fl);
    ctx.quadraticCurveTo(17, 8, 10, -2);
    ctx.closePath();
    const ag = ctx.createLinearGradient(0, -2, 0, hemY);
    ag.addColorStop(0, WHITE);
    ag.addColorStop(1, '#efeaf8');
    fillOl(ctx, ag, 2.2);
    // apron stripes near hem
    ctx.strokeStyle = MAID_BLACK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-17 - fl * 3, hemY - 8 + fl);
    ctx.lineTo(20 - fl * 2, hemY - 9 - fl);
    ctx.stroke();
    // apron fold lines
    ctx.strokeStyle = WHITE_SH;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.lineTo(-6 - fl * 2, hemY - 10);
    ctx.moveTo(7, 2);
    ctx.lineTo(9 - fl, hemY - 11);
    ctx.stroke();
    // bodice
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(-14, -26);
    ctx.quadraticCurveTo(0, -33, 14, -27);
    ctx.lineTo(12, -2);
    ctx.quadraticCurveTo(0, 1, -12, -2);
    fillOl(ctx, MAID_BLACK, 2.6);
    // apron bib + straps
    ctx.beginPath();
    ctx.moveTo(-7, -2);
    ctx.lineTo(-8, -20);
    ctx.lineTo(9, -21);
    ctx.lineTo(9, -2);
    ctx.closePath();
    fillOl(ctx, WHITE, 2);
    ctx.strokeStyle = MAID_BLACK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.lineTo(6, -12.5);
    ctx.stroke();
    // waist bow band
    ctx.beginPath();
    ctx.rect(-12.5, -5, 25, 5);
    fillOl(ctx, WHITE, 1.8);
    // collar
    ctx.beginPath();
    ctx.moveTo(-9, -28);
    ctx.quadraticCurveTo(-6, -20, 1, -23);
    ctx.quadraticCurveTo(8, -19, 11, -28);
    ctx.quadraticCurveTo(1, -31, -9, -28);
    fillOl(ctx, WHITE, 2);
    // red bow
    ctx.save();
    ctx.translate(1.5, -23.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -4);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7, -4);
    ctx.lineTo(7, 4);
    ctx.closePath();
    fillOl(ctx, RED, 1.6);
    ctx.beginPath();
    ctx.moveTo(-1, 1);
    ctx.lineTo(-4, 10 + flutter * 2);
    ctx.moveTo(1, 1);
    ctx.lineTo(4, 9 - flutter);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, TAU);
    fillOl(ctx, '#ff4a5f', 1.4);
    ctx.restore();
  } else {
    // hips / pants top
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(12, -6);
    ctx.lineTo(12, 6);
    ctx.lineTo(-12, 6);
    ctx.closePath();
    fillOl(ctx, PANTS, 2.4);
    // tee
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-13, -27);
    ctx.quadraticCurveTo(0, -32, 13, -27);
    ctx.lineTo(11, 0);
    ctx.closePath();
    fillOl(ctx, '#d0223b', 2.4);
    ctx.fillStyle = '#25202f';
    ctx.beginPath();
    ctx.moveTo(-4, -28);
    ctx.lineTo(0, -18);
    ctx.lineTo(4, -28);
    ctx.fill();
    // cross necklace
    ctx.strokeStyle = '#9aa0b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, -29);
    ctx.quadraticCurveTo(0, -12, 6, -29);
    ctx.stroke();
    ctx.fillStyle = '#c9cede';
    ctx.fillRect(-1, -17, 2.4, 9);
    ctx.fillRect(-3.4, -14.5, 7.2, 2.2);
    // open jacket panels
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 6, -29);
      ctx.lineTo(side * 16, -27);
      ctx.lineTo(side * 15, 4);
      ctx.lineTo(side * 7, 5);
      ctx.quadraticCurveTo(side * 9, -10, side * 6, -29);
      fillOl(ctx, side < 0 ? JACKET_SH : JACKET, 2.4);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(side * 7.5, -24);
      ctx.quadraticCurveTo(side * 9.5, -10, side * 8.5, 3);
      ctx.stroke();
    }
    // fluffy hood collar
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r = 15 + (i % 2) * 3;
      const px = Math.cos(a) * r * 1.05;
      const py = -29 + Math.sin(a) * r * 0.45;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.quadraticCurveTo(0, -22, -15.7, -29);
    fillOl(ctx, '#ffffff', 2.2);
  }
}

function drawBackHair(ctx: CanvasRenderingContext2D, p: Pose, sway: number) {
  // two layers of swept-back spikes: outer dark, inner slightly lighter
  const layer = (rTip: number, rIn: number, spikes: number, a0: number, a1: number, fill: string | CanvasGradient, ol: boolean, ph: number) => {
    ctx.beginPath();
    for (let i = 0; i <= spikes * 2; i++) {
      const tt = i / (spikes * 2);
      const a = lerp(a0, a1, tt);
      const tip = i % 2 === 0;
      const r = tip ? rTip + Math.sin(i * 2.3 + ph) * 3 + Math.max(0, -Math.sin(a)) * 7 : rIn;
      const sw = tip ? sway * (0.5 + tt * 0.8) : 0;
      // tips curl backwards (−x) like wind-swept hair
      const px = Math.cos(a) * r - 3 - sw * 5 - (tip ? 5 : 0);
      const py = Math.sin(a) * r - 2 + (tip ? Math.abs(sw) * 1.5 : 0);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (ol) fillOl(ctx, fill, 2.6);
    else {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };
  layer(35, 25, 10, Math.PI * 0.6, Math.PI * 2.05, HAIR, true, 0);
  const ig = ctx.createLinearGradient(-30, -20, 10, 10);
  ig.addColorStop(0, HAIR_HL);
  ig.addColorStop(1, HAIR_MID);
  ctx.globalAlpha = 0.55;
  layer(29, 22, 8, Math.PI * 0.75, Math.PI * 1.9, ig, false, 1.3);
  ctx.globalAlpha = 1;
  // red streak lock on the back
  ctx.beginPath();
  ctx.moveTo(-20, -4);
  ctx.quadraticCurveTo(-33 - sway * 5, 10, -30 - sway * 7, 28);
  ctx.quadraticCurveTo(-22, 14, -12, 6);
  ctx.closePath();
  const rg = ctx.createLinearGradient(-20, -4, -30, 28);
  rg.addColorStop(0, HAIR_MID);
  rg.addColorStop(0.45, RED_DK);
  rg.addColorStop(1, RED);
  fillOl(ctx, rg, 2.2);
  void p;
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  near: boolean,
  expr: Expr,
  blink: number,
  t: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  const flick = near ? 1 : -1;
  if (expr === 'happy' || (blink > 0.85 && expr !== 'hurt' && expr !== 'blank')) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (expr === 'happy') {
      ctx.moveTo(-w, 2);
      ctx.quadraticCurveTo(0, -h * 0.9, w, 2);
    } else {
      ctx.moveTo(-w, 1);
      ctx.quadraticCurveTo(0, h * 0.45, w, 1);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (expr === 'hurt') {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const d = near ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.8 * d, -h * 0.45);
    ctx.lineTo(w * 0.7 * d, 0);
    ctx.lineTo(-w * 0.8 * d, h * 0.45);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const lid = expr === 'smug' ? 0.42 : expr === 'blank' ? 0.5 : expr === 'run' ? 0.12 : 0;
  const open = 1 - Math.max(blink, 0) * 0.85;
  const eh = h * open;
  // sclera
  ctx.beginPath();
  ctx.ellipse(0, 0, w, eh, 0, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const panic = expr === 'panic';
  const iw = panic ? w * 0.42 : w * 0.82;
  const ih = panic ? h * 0.45 : h * 0.92;
  const ix = near ? 1 : 0.5;
  const iy = panic ? -1 + Math.sin(t * 40) * 0.6 : 1.5;
  const ig = ctx.createLinearGradient(0, iy - ih, 0, iy + ih);
  ig.addColorStop(0, '#4a0614');
  ig.addColorStop(0.45, '#b3122d');
  ig.addColorStop(1, '#ff5a66');
  ctx.beginPath();
  ctx.ellipse(ix, iy, iw, ih, 0, 0, TAU);
  ctx.fillStyle = ig;
  ctx.fill();
  if (expr !== 'blank') {
    ctx.beginPath();
    ctx.ellipse(ix + 0.5, iy + 0.5, iw * 0.42, ih * 0.5, 0, 0, TAU);
    ctx.fillStyle = '#2a0610';
    ctx.fill();
    // highlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ix - iw * 0.35, iy - ih * 0.42, iw * 0.38, ih * 0.28, -0.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(ix + iw * 0.4, iy + ih * 0.45, Math.max(1.2, iw * 0.18), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    ctx.arc(ix, iy + 1, iw * 0.3, 0, TAU);
    ctx.fillStyle = '#2a0610';
    ctx.fill();
  }
  // upper lid shadow
  if (lid > 0) {
    ctx.fillStyle = SKIN_SH;
    ctx.fillRect(-w - 2, -eh - 2, w * 2 + 4, eh * 2 * lid + 2);
  }
  ctx.restore();
  // upper lash line
  const ly = -eh + eh * 2 * lid;
  ctx.strokeStyle = OL;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-w * 1.05, ly + 2.5);
  ctx.quadraticCurveTo(0, ly - 3.2, w * 1.08, ly + 1.5);
  ctx.stroke();
  // outer flick
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(flick * w * 0.95, ly + 1.5);
  ctx.lineTo(flick * (w + 4), ly - 1.8);
  ctx.stroke();
  // lower lash hint
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, eh + 0.6);
  ctx.quadraticCurveTo(0, eh + 1.6, w * 0.5, eh + 0.4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMouth(ctx: CanvasRenderingContext2D, expr: Expr, t: number, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (expr) {
    case 'panic': {
      const w = Math.sin(t * 30) * 0.8;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(-2.5, -3 + w, 0, 0);
      ctx.quadraticCurveTo(2.5, -3 - w, 5, 0);
      ctx.quadraticCurveTo(0, 8, -5, 0);
      ctx.fillStyle = '#7a1d2c';
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'hurt':
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.lineTo(0, -2);
      ctx.lineTo(4, 2);
      ctx.closePath();
      ctx.fillStyle = '#7a1d2c';
      ctx.fill();
      ctx.stroke();
      break;
    case 'happy':
      ctx.beginPath();
      ctx.moveTo(-5, -1);
      ctx.quadraticCurveTo(0, 0, 5, -1);
      ctx.quadraticCurveTo(0, 9, -5, -1);
      ctx.fillStyle = '#9b2238';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath();
      ctx.ellipse(0, 3.6, 2.6, 1.6, 0, 0, TAU);
      ctx.fill();
      break;
    case 'blank':
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.stroke();
      break;
    case 'run':
      ctx.beginPath();
      ctx.ellipse(0, 0.5, 2.4, 2.8, 0, 0, TAU);
      ctx.fillStyle = '#8b2034';
      ctx.fill();
      ctx.stroke();
      break;
    default:
      // ":3"
      ctx.beginPath();
      ctx.moveTo(-4.5, -1);
      ctx.quadraticCurveTo(-2.4, 2.5, 0, 0);
      ctx.quadraticCurveTo(2.4, 2.5, 4.5, -1);
      ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, p: Pose, sway: number) {
  drawBackHair(ctx, p, sway);
  // ear (back side)
  ctx.beginPath();
  ctx.ellipse(-15, 6, 5, 7, -0.2, 0, TAU);
  fillOl(ctx, SKIN, 2.2);
  ctx.fillStyle = SKIN_SH;
  ctx.beginPath();
  ctx.ellipse(-15, 6.5, 2.4, 4, -0.2, 0, TAU);
  ctx.fill();
  // face
  ctx.beginPath();
  ctx.moveTo(-17, -6);
  ctx.bezierCurveTo(-18, 14, -8, 24, 9, 27);
  ctx.bezierCurveTo(18, 23, 25, 12, 25, -2);
  ctx.bezierCurveTo(25, -22, -16, -24, -17, -6);
  const fg = ctx.createLinearGradient(-17, 0, 25, 0);
  fg.addColorStop(0, SKIN_SH);
  fg.addColorStop(0.3, SKIN);
  fg.addColorStop(1, SKIN);
  fillOl(ctx, fg, 2.6);
  // blush
  ctx.fillStyle = 'rgba(255,120,150,0.35)';
  ctx.beginPath();
  ctx.ellipse(15, 15, 5.5, 2.6, 0, 0, TAU);
  ctx.ellipse(-5, 15, 4, 2.2, 0, 0, TAU);
  ctx.fill();
  if (p.expr === 'panic' || p.expr === 'hurt') {
    // blue shade of dread
    const dg = ctx.createLinearGradient(0, -10, 0, 8);
    dg.addColorStop(0, 'rgba(80,90,200,0.35)');
    dg.addColorStop(1, 'rgba(80,90,200,0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.ellipse(6, -2, 18, 12, 0, 0, TAU);
    ctx.fill();
  }
  // eyes
  drawEye(ctx, -3.5, 5.5, 6.2, 9.2, false, p.expr, p.blink, p.t);
  drawEye(ctx, 13, 5.5, 7.8, 10.2, true, p.expr, p.blink, p.t);
  // brows (visible on panic)
  if (p.expr === 'panic') {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -9);
    ctx.lineTo(19, -12);
    ctx.moveTo(-8, -10);
    ctx.lineTo(0, -8);
    ctx.stroke();
  }
  // nose dot
  ctx.fillStyle = SKIN_SH;
  ctx.beginPath();
  ctx.arc(19, 11, 1.1, 0, TAU);
  ctx.fill();
  drawMouth(ctx, p.expr, p.t, 10, 19);
  // sweat drop
  if (p.expr === 'panic') {
    ctx.save();
    ctx.translate(25, -6 + (p.t * 20) % 4);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(5, 2, 0, 4);
    ctx.quadraticCurveTo(-5, 2, 0, -6);
    fillOl(ctx, '#bfe6ff', 1.6, '#4a7fb5');
    ctx.restore();
  }
  // front bangs
  ctx.beginPath();
  ctx.moveTo(-22, 4);
  ctx.bezierCurveTo(-26, -30, 22, -40, 30, -4);
  const tips: [number, number][] = [
    [27, 4],
    [24, -4],
    [21, 9],
    [16, -5],
    [12, 3],
    [7, -7],
    [3, 1],
    [-2, -8],
    [-6, -1],
    [-11, -9],
    [-14, 2],
    [-19, -5],
  ];
  for (const [x, y] of tips) ctx.lineTo(x + sway * 0.6, y);
  ctx.closePath();
  const hg = ctx.createLinearGradient(0, -36, 0, 8);
  hg.addColorStop(0, HAIR_MID);
  hg.addColorStop(1, HAIR);
  fillOl(ctx, hg, 2.6);
  // side lock in front of face
  ctx.beginPath();
  ctx.moveTo(25, -10);
  ctx.quadraticCurveTo(31 + sway, 6, 26 + sway * 1.5, 22);
  ctx.quadraticCurveTo(24, 8, 20, -2);
  ctx.closePath();
  fillOl(ctx, HAIR, 2.2);
  // back side lock with red streak
  ctx.beginPath();
  ctx.moveTo(-19, -6);
  ctx.quadraticCurveTo(-25 - sway, 10, -19 - sway * 1.4, 24);
  ctx.quadraticCurveTo(-15, 8, -12, -2);
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, -6, 0, 24);
  sg.addColorStop(0, HAIR);
  sg.addColorStop(0.5, RED_DK);
  sg.addColorStop(1, RED);
  fillOl(ctx, sg, 2.2);
  // hair shine
  ctx.strokeStyle = HAIR_HL;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -22);
  ctx.quadraticCurveTo(4, -27, 15, -21);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-2, -18);
  ctx.lineTo(1, -14);
  ctx.moveTo(7, -19);
  ctx.lineTo(9, -15);
  ctx.stroke();
  // ahoge
  ctx.beginPath();
  ctx.moveTo(2, -30);
  ctx.quadraticCurveTo(10 + sway * 3, -46, 20 + sway * 4, -42);
  ctx.quadraticCurveTo(10, -40, 7, -30);
  fillOl(ctx, HAIR, 2.2);

  if (p.outfit === 'maid') {
    // frilly headdress
    ctx.save();
    ctx.rotate(-0.12);
    ctx.beginPath();
    const n = 7;
    const x0 = -20, x1 = 22;
    ctx.moveTo(x0, -22);
    for (let i = 0; i < n; i++) {
      const a = x0 + (i / n) * (x1 - x0);
      const b = x0 + ((i + 1) / n) * (x1 - x0);
      const ya = -24 - Math.sin((i / n) * Math.PI) * 9;
      const yb = -24 - Math.sin(((i + 1) / n) * Math.PI) * 9;
      ctx.quadraticCurveTo((a + b) / 2, Math.min(ya, yb) - 7, b, yb);
    }
    ctx.lineTo(x1 - 1, -20);
    ctx.quadraticCurveTo(1, -35, x0 + 1, -18);
    ctx.closePath();
    fillOl(ctx, WHITE, 2.2);
    ctx.strokeStyle = MAID_BLACK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x0 + 2, -19.5);
    ctx.quadraticCurveTo(1, -34.5, x1 - 2, -21);
    ctx.stroke();
    ctx.restore();
    // black ribbon ties at the back
    ctx.save();
    ctx.translate(-20, -10);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, -6);
    ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4, -8);
    ctx.lineTo(6, 2);
    ctx.closePath();
    fillOl(ctx, MAID_BLACK, 1.8);
    ctx.strokeStyle = MAID_BLACK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-1, 1);
    ctx.quadraticCurveTo(-8 - sway * 4, 12, -12 - sway * 7, 20);
    ctx.moveTo(0, 1);
    ctx.quadraticCurveTo(-3 - sway * 3, 13, -4 - sway * 6, 22);
    ctx.stroke();
    ctx.restore();
  } else {
    // cross earring
    ctx.fillStyle = '#c9cede';
    ctx.strokeStyle = OL;
    ctx.lineWidth = 1;
    ctx.fillRect(-16.2, 13, 1.8, 7);
    ctx.fillRect(-17.8, 15, 5, 1.6);
  }
}

/**
 * Draw Astray with feet at (x, y). `s` scales; `face` = 1 right / -1 left.
 */
export function drawAstray(ctx: CanvasRenderingContext2D, x: number, y: number, p: Pose, s = 1, face = 1) {
  const L = computeLimbs(p);
  const flutter = Math.sin(p.run * 2 + 0.6) * p.runAmt * 0.8 + (p.air ? clamp(p.vy / 600, -1, 1) * 0.9 : 0);
  const sway = Math.sin(p.run * 2) * 0.7 * p.runAmt + (p.air ? clamp(p.vy / 400, -1.5, 1.5) : 0) + Math.sin(p.t * 1.7) * 0.25;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  if (p.spin) {
    ctx.translate(0, -60);
    ctx.rotate(p.spin);
    ctx.translate(0, 60);
  }
  const hipX = 0, hipY = L.hipY;

  // torso frame helper
  const torso = () => {
    ctx.translate(hipX, hipY);
    ctx.rotate(L.lean);
  };

  // far arm (behind)
  ctx.save();
  torso();
  drawArm(ctx, -5, -26, L.fUpper, L.fFore, false, p.outfit, false);
  ctx.restore();
  // far leg, near leg
  drawLeg(ctx, hipX - 4, hipY, L.fThigh, L.fShin, false, p.outfit);
  drawLeg(ctx, hipX + 4, hipY, L.nThigh, L.nShin, true, p.outfit);
  // torso + skirt
  ctx.save();
  torso();
  // neck
  ctx.beginPath();
  ctx.rect(-2.5, -38, 9, 12);
  fillOl(ctx, SKIN_SH, 2.2);
  drawTorso(ctx, p, flutter);
  if (p.mayo > 0.05) {
    const m = p.mayo;
    if (m > 0.1) mayoBlob(ctx, 4, -16, 6, 1);
    if (m > 0.35) mayoBlob(ctx, -12, 8, 7, 2);
    if (m > 0.55) mayoBlob(ctx, 14, 12, 6.5, 3);
    if (m > 0.75) mayoBlob(ctx, -4, -28, 7, 4);
  }
  // head
  ctx.save();
  ctx.translate(4, -60);
  ctx.rotate(L.headTilt);
  drawHead(ctx, p, sway);
  if (p.mayo > 0.2) mayoBlob(ctx, 2, -30, 9, 5);
  if (p.mayo > 0.65) mayoBlob(ctx, 18, -10, 6, 6);
  if (p.mayo > 0.9) mayoBlob(ctx, -16, -16, 8, 7);
  ctx.restore();
  // near arm (in front)
  drawArm(ctx, 6, -27, L.nUpper, L.nFore, true, p.outfit, p.holdPie);
  ctx.restore();
  ctx.restore();
}

/** Head-only portrait (HUD / progress icon). */
export function drawAstrayHead(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, expr: Expr, outfit: Outfit, t = 0) {
  const p = { ...defaultPose(), expr, outfit, t };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  drawHead(ctx, p, Math.sin(t * 2) * 0.3);
  ctx.restore();
}
