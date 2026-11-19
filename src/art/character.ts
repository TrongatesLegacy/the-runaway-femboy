import { clamp, lerp, TAU } from '../util';
import { styleOf, type OutfitStyle } from './outfits';

export type Expr = 'idle' | 'run' | 'panic' | 'hurt' | 'happy' | 'blank' | 'smug';
export type Outfit = string;

/** Current outfit style, set at the start of every draw call. */
let ST: OutfitStyle = styleOf('maid');

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
  belly?: number; // 0..1 stuffed-tummy (food coma)
  ears?: boolean; // cat ears (bingus ending)
  tail?: boolean; // cat tail (bingus ending)
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
const WHITE = '#fdfbff';
const WHITE_SH = '#dcd7ec';
const JACKET = '#f7f5fa';
const JACKET_SH = '#d3cee0';
const PANTS = '#272434';
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
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  thigh: number,
  shin: number,
  near: boolean,
  _outfit: Outfit,
) {
  const T = 23, S = 24;
  const [tx, ty] = dirv(thigh);
  const kx = hx + tx * T, ky = hy + ty * T;
  const [sx, sy] = dirv(shin);
  const ax = kx + sx * S, ay = ky + sy * S;
  const skin = near ? SKIN : SKIN_FAR;
  const A = near ? ST.legA : shade(ST.legA, 0.82);
  const B = ST.legB;
  const nx = -ty, ny = tx;
  const band = (x: number, y: number, w: number, c: string, lw = 3) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x + nx * w, y + ny * w);
    ctx.lineTo(x - nx * w, y - ny * w);
    ctx.stroke();
  };
  switch (ST.legs) {
    case 'stock': {
      const mx = hx + tx * T * 0.45, my = hy + ty * T * 0.45;
      limb(ctx, [[hx, hy], [mx, my]], [11.5], skin);
      limb(ctx, [[mx, my], [kx, ky], [ax, ay]], [10.5, 8.6], A);
      ctx.globalAlpha = near ? 1 : 0.75;
      band(mx, my, 6.2, B);
      ctx.globalAlpha = 1;
      if (near) {
        ctx.fillStyle = ST.bow;
        ctx.beginPath();
        ctx.arc(mx + nx * 5.5 + tx * 1.5, my + ny * 5.5 + ty * 1.5, 1.8, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'socks': {
      const mx = kx + sx * S * 0.15, my = ky + sy * S * 0.15;
      limb(ctx, [[hx, hy], [kx, ky], [mx, my]], [11, 9], skin);
      limb(ctx, [[mx, my], [ax, ay]], [9.4], A);
      band(mx, my, 5.6, B, 2.6);
      break;
    }
    case 'tights':
      limb(ctx, [[hx, hy], [kx, ky], [ax, ay]], [11.5, 9.4], A);
      break;
    case 'stripes': {
      limb(ctx, [[hx, hy], [kx, ky], [ax, ay]], [11, 9], A);
      ctx.globalAlpha = near ? 1 : 0.7;
      for (let k = 0.2; k < 1; k += 0.2) band(hx + tx * T * k, hy + ty * T * k, 5.4, B, 2.4);
      for (let k = 0.2; k < 0.95; k += 0.2) {
        const [sx2, sy2] = dirv(shin);
        const px = kx + sx2 * S * k, py = ky + sy2 * S * k;
        ctx.strokeStyle = B;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(px - sy2 * 4.4, py + sx2 * 4.4);
        ctx.lineTo(px + sy2 * 4.4, py - sx2 * 4.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'pants': {
      limb(ctx, [[hx, hy], [kx, ky], [ax, ay]], [13, 11.5], A);
      if (ST.pattern === 'stars') {
        ctx.fillStyle = ST.patternColor ?? '#fff';
        for (const k of [0.35, 0.8]) {
          ctx.beginPath();
          ctx.arc(hx + tx * T * k, hy + ty * T * k, 1.5, 0, TAU);
          ctx.arc(kx + sx * S * k, ky + sy * S * k, 1.3, 0, TAU);
          ctx.fill();
        }
      }
      if (ST.body === 'regular') break;
      band(kx + sx * S * 0.9, ky + sy * S * 0.9, 6.4, ST.trim, 2.6);
      break;
    }
    case 'onesie':
      limb(ctx, [[hx, hy], [kx, ky], [ax, ay]], [14, 12.5], A);
      break;
    case 'pipe': {
      limb(ctx, [[hx, hy], [kx, ky], [ax, ay]], [12, 10.5], A);
      ctx.globalAlpha = near ? 1 : 0.8;
      band(hx + tx * T * 0.5, hy + ty * T * 0.5, 7.4, B, 4);
      band(kx, ky, 7.6, ST.dressHL, 4.5);
      band(kx + sx * S * 0.55, ky + sy * S * 0.55, 6.6, B, 4);
      ctx.globalAlpha = 1;
      break;
    }
  }
  // ---- feet: toe points perpendicular-forward to the shin
  const [fx, fy] = dirv(shin + Math.PI / 2);
  const toeX = ax + fx * 12, toeY = ay + fy * 12;
  const F = near ? ST.feetA : shade(ST.feetA, 0.8);
  ctx.save();
  ctx.lineCap = 'round';
  switch (ST.feet) {
    case 'mary':
    case 'loafer':
      limb(ctx, [[ax - Math.sin(shin), ay], [toeX, toeY]], [10], F);
      ctx.strokeStyle = ST.feetB;
      ctx.lineWidth = ST.feet === 'loafer' ? 2.4 : 1.6;
      ctx.beginPath();
      ctx.moveTo(ax + (toeX - ax) * 0.25, ay + (toeY - ay) * 0.25 - 3);
      ctx.lineTo(ax + (toeX - ax) * 0.55, ay + (toeY - ay) * 0.55 - 3);
      ctx.stroke();
      break;
    case 'sneaker': {
      const c = ST.body === 'regular' ? (near ? '#e3394c' : '#a92738') : F;
      limb(ctx, [[ax - 1, ay], [toeX, toeY]], [11.5], c);
      ctx.strokeStyle = ST.body === 'regular' ? WHITE : ST.feetB;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const ox = Math.sin(shin) * 4.2, oy = Math.cos(shin) * 4.2;
      ctx.moveTo(ax + ox, ay + oy);
      ctx.lineTo(toeX + ox, toeY + oy);
      ctx.stroke();
      break;
    }
    case 'boot':
      limb(ctx, [[ax - sx * 9, ay - sy * 9], [ax, ay], [toeX, toeY]], [11, 11], F);
      ctx.strokeStyle = ST.feetB;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax - sx * 9 - sy * 5.5, ay - sy * 9 + sx * 5.5);
      ctx.lineTo(ax - sx * 9 + sy * 5.5, ay - sy * 9 - sx * 5.5);
      ctx.stroke();
      break;
    case 'geta': {
      // wooden clog sole + red thong strap over a white tabi
      limb(ctx, [[ax, ay], [toeX, toeY]], [8.5], near ? '#fdfbff' : '#e0dbe8');
      const ox = Math.sin(shin) * 6, oy = Math.cos(shin) * 6;
      limb(ctx, [[ax + ox - fx * 2, ay + oy - fy * 2], [toeX + ox + fx * 2, toeY + oy + fy * 2]], [5], F);
      ctx.strokeStyle = ST.feetB;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ax + (toeX - ax) * 0.7 + ox * 0.5, ay + (toeY - ay) * 0.7 + oy * 0.5);
      ctx.lineTo(ax + (toeX - ax) * 0.45 - ox * 0.4, ay + (toeY - ay) * 0.45 - oy * 0.4);
      ctx.stroke();
      break;
    }
    case 'slipper': {
      ctx.beginPath();
      const mx = (ax + toeX) / 2, my = (ay + toeY) / 2;
      ctx.ellipse(mx + Math.sin(shin) * 1.5, my + Math.cos(shin) * 1.5, 10, 7.5, Math.atan2(toeY - ay, toeX - ax), 0, TAU);
      fillOl(ctx, F, 2.2);
      // pom-pom
      ctx.beginPath();
      ctx.arc(toeX - fx * 2, toeY - fy * 2 - 3, 3.4, 0, TAU);
      fillOl(ctx, ST.feetB, 1.6);
      break;
    }
    case 'paw': {
      ctx.beginPath();
      const mx = (ax + toeX) / 2, my = (ay + toeY) / 2;
      ctx.ellipse(mx, my + 1, 10.5, 7, Math.atan2(toeY - ay, toeX - ax), 0, TAU);
      fillOl(ctx, F, 2.2);
      ctx.fillStyle = ST.feetB;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(toeX - fx * 2 + Math.cos(shin) * i * 3.4, toeY - fy * 2 - Math.sin(shin) * i * 3.4, 1.6, 0, TAU);
        ctx.fill();
      }
      break;
    }
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
  _outfit: Outfit,
  pie: boolean,
) {
  const U = 16, F = 15;
  const [ux, uy] = dirv(upper);
  const ex = sx + ux * U, ey = sy + uy * U;
  const [fx, fy] = dirv(fore);
  const hx = ex + fx * F, hy = ey + fy * F;
  const skin = near ? SKIN : SKIN_FAR;
  const A = near ? ST.sleeveA : shade(ST.sleeveA, 0.8);
  const B = ST.sleeveB;
  const ring = (x: number, y: number, dx: number, dy: number, w: number, c: string, lw = 3) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x - dy * w, y + dx * w);
    ctx.lineTo(x + dy * w, y - dx * w);
    ctx.stroke();
  };
  let handColor = skin;
  let paw = false;
  switch (ST.sleeve) {
    case 'puff':
      limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], [7.5, 6.8], skin);
      ctx.beginPath();
      ctx.ellipse(sx + ux * 5, sy + uy * 5, 9.5, 8, upper, 0, TAU);
      fillOl(ctx, A, 2.4);
      ring(sx + ux * 11, sy + uy * 11, ux, uy, 6, near ? B : WHITE_SH, 2.6);
      ring(ex + fx * F * 0.72, ey + fy * F * 0.72, fx, fy, 4.2, near ? B : WHITE_SH);
      break;
    case 'jacket': {
      const c = near ? JACKET : JACKET_SH;
      limb(ctx, [[sx, sy], [ex, ey], [ex + fx * F * 0.78, ey + fy * F * 0.78]], [10, 9], c);
      ctx.strokeStyle = near ? RED : RED_DK;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(sx + ux * 4 + uy * 3, sy + uy * 4 - ux * 3);
      ctx.lineTo(ex + uy * 3, ey - ux * 3);
      ctx.stroke();
      break;
    }
    case 'short':
      limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], [7.5, 6.8], skin);
      limb(ctx, [[sx, sy], [sx + ux * U * 0.75, sy + uy * U * 0.75]], [11], A);
      ring(sx + ux * U * 0.72, sy + uy * U * 0.72, ux, uy, 6, B, 2.8);
      break;
    case 'bell': {
      limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], [7, 6.4], skin);
      limb(ctx, [[sx, sy], [ex, ey]], [9.5], A);
      // flared bell cuff with lace
      const cx = ex + fx * F * 0.55, cy = ey + fy * F * 0.55;
      ctx.beginPath();
      ctx.moveTo(ex - fy * 5, ey + fx * 5);
      ctx.lineTo(cx - fy * 10, cy + fx * 10);
      ctx.lineTo(cx + fy * 10, cy - fx * 10);
      ctx.lineTo(ex + fy * 5, ey - fx * 5);
      ctx.closePath();
      fillOl(ctx, A, 2.2);
      ring(cx, cy, fx, fy, 10, B, 2.6);
      break;
    }
    case 'wide': {
      // kimono sleeve: hangs down from the upper arm
      limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], [7, 6.4], skin);
      const ox = ex + fx * 3, oy = ey + fy * 3;
      ctx.beginPath();
      ctx.moveTo(sx - uy * 6, sy + ux * 6);
      ctx.lineTo(ox - fy * 7, oy + fx * 7);
      ctx.quadraticCurveTo(ox - 2, oy + 16, ox - 10, oy + 22);
      ctx.lineTo(sx - 8, sy + 22);
      ctx.quadraticCurveTo(sx - 9, sy + 8, sx + uy * 6, sy - ux * 6);
      ctx.closePath();
      const g = ctx.createLinearGradient(sx, sy, ox, oy + 22);
      g.addColorStop(0, A);
      g.addColorStop(1, B);
      fillOl(ctx, g, 2.2);
      if (ST.pattern === 'petals') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (const [px, py] of [[sx - 2, sy + 12], [ox - 6, oy + 12]]) {
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            ctx.beginPath();
            ctx.ellipse(px + Math.cos(a) * 1.8, py + Math.sin(a) * 1.8, 1.5, 0.9, a, 0, TAU);
            ctx.fill();
          }
        }
      }
      break;
    }
    case 'long':
    case 'paw':
      limb(ctx, [[sx, sy], [ex, ey], [ex + fx * F * 0.82, ey + fy * F * 0.82]], [10, 9], A);
      if (ST.sleeve === 'long') ring(ex + fx * F * 0.78, ey + fy * F * 0.78, fx, fy, 5, B, 3);
      if (ST.sleeve === 'paw') {
        handColor = A;
        paw = true;
      }
      break;
    case 'none':
      limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], [7.5, 6.8], skin);
      ring(ex + fx * F * 0.7, ey + fy * F * 0.7, fx, fy, 4.4, B, 2.6);
      break;
    case 'stub':
      limb(ctx, [[sx, sy], [ex, ey], [hx, hy]], [7.5, 6.8], skin);
      ctx.beginPath();
      ctx.ellipse(sx + ux * 6, sy + uy * 6, 10, 8.5, upper, 0, TAU);
      fillOl(ctx, A, 2.4);
      ctx.fillStyle = ST.patternColor ?? '#d6f5a8';
      ctx.beginPath();
      ctx.arc(sx + ux * 4 - 2, sy + uy * 4 - 1, 1.3, 0, TAU);
      ctx.arc(sx + ux * 8 + 2, sy + uy * 8 + 1, 1.3, 0, TAU);
      ctx.fill();
      break;
    case 'pipe':
      limb(ctx, [[sx, sy], [ex, ey], [ex + fx * F * 0.8, ey + fy * F * 0.8]], [9.5, 8.5], A);
      ring(sx + ux * U * 0.5, sy + uy * U * 0.5, ux, uy, 6.4, B, 3.4);
      ring(ex, ey, ux, uy, 6.8, ST.dressHL, 4);
      ring(ex + fx * F * 0.6, ey + fy * F * 0.6, fx, fy, 5.8, B, 3.4);
      handColor = near ? '#3a3f4f' : '#2a2e3a';
      break;
  }
  ctx.beginPath();
  ctx.arc(hx, hy, paw ? 5.6 : 4.6, 0, TAU);
  fillOl(ctx, handColor, 2.2);
  if (paw) {
    ctx.fillStyle = ST.sleeveB;
    ctx.beginPath();
    ctx.arc(hx + fx * 2, hy + fy * 2, 1.8, 0, TAU);
    ctx.fill();
  }
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

function drawClassicTorso(ctx: CanvasRenderingContext2D, p: Pose, flutter: number) {
  if (ST.base === 'maid') {
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
    sg.addColorStop(0, ST.dressDark);
    sg.addColorStop(0.55, ST.dress);
    sg.addColorStop(1, ST.dressHL);
    fillOl(ctx, sg, 2.6);
    skirtPattern(ctx, hemY, fl);
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
    fillOl(ctx, ST.trim, 2);
    // apron
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.quadraticCurveTo(-16, 8, -19 - fl * 3, hemY - 3 + fl);
    ctx.lineTo(22 - fl * 2, hemY - 4 - fl);
    ctx.quadraticCurveTo(17, 8, 10, -2);
    ctx.closePath();
    const ag = ctx.createLinearGradient(0, -2, 0, hemY);
    ag.addColorStop(0, ST.apron);
    ag.addColorStop(1, ST.apronShade);
    fillOl(ctx, ag, 2.2);
    // apron stripes near hem
    ctx.strokeStyle = ST.stripe;
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
    fillOl(ctx, ST.dress, 2.6);
    // apron bib + straps
    ctx.beginPath();
    ctx.moveTo(-7, -2);
    ctx.lineTo(-8, -20);
    ctx.lineTo(9, -21);
    ctx.lineTo(9, -2);
    ctx.closePath();
    fillOl(ctx, ST.apron, 2);
    ctx.strokeStyle = ST.stripe;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.lineTo(6, -12.5);
    ctx.stroke();
    // waist bow band
    ctx.beginPath();
    ctx.rect(-12.5, -5, 25, 5);
    fillOl(ctx, ST.apron, 1.8);
    // collar
    ctx.beginPath();
    ctx.moveTo(-9, -28);
    ctx.quadraticCurveTo(-6, -20, 1, -23);
    ctx.quadraticCurveTo(8, -19, 11, -28);
    ctx.quadraticCurveTo(1, -31, -9, -28);
    fillOl(ctx, ST.trim, 2);
    // bow
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
    fillOl(ctx, ST.bow, 1.6);
    ctx.beginPath();
    ctx.moveTo(-1, 1);
    ctx.lineTo(-4, 10 + flutter * 2);
    ctx.moveTo(1, 1);
    ctx.lineTo(4, 9 - flutter);
    ctx.strokeStyle = ST.bow;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, TAU);
    fillOl(ctx, ST.bow, 1.4);
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

  if (ST.head !== 'maidband') {
    drawHeadWear(ctx, sway, p.t);
  } else {
    const bandFill = WHITE;
    const bandEdge = MAID_BLACK;
    const tie = MAID_BLACK;
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
    fillOl(ctx, bandFill, 2.2);
    ctx.strokeStyle = bandEdge;
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
    fillOl(ctx, tie, 1.8);
    ctx.strokeStyle = tie;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-1, 1);
    ctx.quadraticCurveTo(-8 - sway * 4, 12, -12 - sway * 7, 20);
    ctx.moveTo(0, 1);
    ctx.quadraticCurveTo(-3 - sway * 3, 13, -4 - sway * 6, 22);
    ctx.stroke();
    ctx.restore();
  }
  if (ST.base === 'regular') {
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
  ST = styleOf(p.outfit);
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

  // tail (behind everything)
  if (ST.tail || p.tail) {
    const tc = ST.tail ?? '#2c2840';
    const wag = Math.sin(p.t * 6) * 6;
    ctx.save();
    torso();
    ctx.lineCap = 'round';
    ctx.strokeStyle = OL;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.bezierCurveTo(-34, 10, -40 + wag, -10, -30 + wag, -26);
    ctx.stroke();
    ctx.strokeStyle = tc;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    ctx.restore();
  }
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
  if (p.ears) catEars(ctx, sway, '#3a3550', '#ff9fc4');
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
  ST = styleOf(outfit);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  drawHead(ctx, p, Math.sin(t * 2) * 0.3);
  ctx.restore();
}


// ---------------------------------------------------------------------
// outfit extras
// ---------------------------------------------------------------------
function skirtPattern(ctx: CanvasRenderingContext2D, hemY: number, fl: number) {
  const c = ST.patternColor ?? '#ffffff';
  ctx.save();
  // clip to skirt
  ctx.beginPath();
  ctx.moveTo(-12, -4);
  ctx.quadraticCurveTo(-24 - fl * 3, 8, -30 - fl * 6, hemY + fl * 2);
  ctx.lineTo(30 - fl * 2, hemY - fl * 1.5);
  ctx.quadraticCurveTo(24, 8, 12, -4);
  ctx.closePath();
  ctx.clip();
  const pts: [number, number][] = [[-22, 14], [-12, 4], [16, 8], [24, 17], [-4, 16], [8, 2], [-26, 20], [18, 2]];
  switch (ST.pattern) {
    case 'spores':
      ctx.fillStyle = c;
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#c8f08a';
      for (const [x, y] of pts.slice(0, 4)) {
        ctx.beginPath();
        ctx.arc(x + 3, y - 3, 1.4, 0, TAU);
        ctx.fill();
      }
      break;
    case 'bumps':
      ctx.fillStyle = c;
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, TAU);
        ctx.fill();
      }
      break;
    case 'stars':
      ctx.fillStyle = c;
      for (const [x, y] of pts.slice(0, 6)) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? 1.3 : 3;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'petals':
      ctx.fillStyle = c;
      for (const [x, y] of pts.slice(0, 6)) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.6, 1, a, 0, TAU);
          ctx.fill();
        }
      }
      break;
    case 'wrinkles':
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.3;
      for (const [x, y] of pts.slice(0, 5)) {
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.quadraticCurveTo(x, y - 2, x + 4, y);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

function catEars(ctx: CanvasRenderingContext2D, sway: number, fill: string, inner: string) {
  for (const [bx, tilt] of [[-16, -0.45], [13, 0.3]] as [number, number][]) {
    ctx.save();
    ctx.translate(bx, -28);
    ctx.rotate(tilt + sway * 0.03);
    ctx.beginPath();
    ctx.moveTo(-9, 3);
    ctx.lineTo(0, -19);
    ctx.lineTo(9, 3);
    ctx.closePath();
    fillOl(ctx, fill, 2.2);
    ctx.beginPath();
    ctx.moveTo(-5, 1);
    ctx.lineTo(0, -12);
    ctx.lineTo(5, 1);
    ctx.closePath();
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.restore();
  }
}

function drawHeadWear(ctx: CanvasRenderingContext2D, sway: number, t: number) {
  switch (ST.head) {
    case 'none':
      return;
    case 'moldhood':
    case 'bingushood': {
      const mold = ST.head === 'moldhood';
      const fill = mold ? '#2d6a2a' : ST.headA ?? '#f4bfb0';
      // hood dome over the hair
      ctx.beginPath();
      ctx.moveTo(-26, 6);
      ctx.bezierCurveTo(-30, -34, 28, -44, 32, -2);
      ctx.quadraticCurveTo(22, -20, -2, -22);
      ctx.quadraticCurveTo(-18, -20, -26, 6);
      fillOl(ctx, fill, 2.6);
      if (mold) {
        // fuzz + eyes on the hood
        ctx.strokeStyle = 'rgba(190,240,120,0.8)';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 12; i++) {
          const a = Math.PI * (1.05 + i * 0.075);
          ctx.beginPath();
          ctx.moveTo(4 + Math.cos(a) * 30, -10 + Math.sin(a) * 30);
          ctx.lineTo(4 + Math.cos(a) * 35, -10 + Math.sin(a) * 35);
          ctx.stroke();
        }
        for (const [ex, ey, r] of [[-8, -30, 4.5], [10, -33, 5.5]] as [number, number, number][]) {
          ctx.beginPath();
          ctx.ellipse(ex, ey, r * 1.1, r, 0, 0, TAU);
          fillOl(ctx, '#e2f04a', 1.6, '#0b1a08');
          ctx.fillStyle = '#0b1408';
          ctx.beginPath();
          ctx.ellipse(ex + 1, ey, r * 0.25, r * 0.75, 0, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#9ad85a';
        for (const [sx, sy] of [[-18, -18], [20, -22], [2, -38]]) {
          ctx.beginPath();
          ctx.arc(sx, sy, 2.4, 0, TAU);
          ctx.fill();
        }
      } else {
        // big bat ears, wrinkles and sleepy eyes on the bingus hood
        for (const [bx, tilt] of [[-14, -0.45], [14, 0.4]] as [number, number][]) {
          ctx.save();
          ctx.translate(bx, -30);
          ctx.rotate(tilt + Math.sin(t * 3) * 0.04);
          ctx.beginPath();
          ctx.moveTo(-9, 4);
          ctx.lineTo(0, -24);
          ctx.lineTo(9, 4);
          ctx.closePath();
          fillOl(ctx, fill, 2.2);
          ctx.beginPath();
          ctx.moveTo(-5, 1);
          ctx.lineTo(0, -16);
          ctx.lineTo(5, 1);
          ctx.closePath();
          ctx.fillStyle = ST.headB ?? '#f08a9a';
          ctx.fill();
          ctx.restore();
        }
        ctx.strokeStyle = '#dc9a8b';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-6, -32);
        ctx.quadraticCurveTo(2, -35, 10, -32);
        ctx.moveTo(-4, -28);
        ctx.quadraticCurveTo(2, -30, 8, -28);
        ctx.stroke();
      }
      return;
    }
    case 'jarlid': {
      ctx.save();
      ctx.rotate(-0.15);
      ctx.beginPath();
      ctx.rect(-16, -42, 34, 12);
      fillOl(ctx, '#2f5fd0', 2.2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = -13; x < 16; x += 5) ctx.fillRect(x, -40, 2, 8);
      ctx.restore();
      return;
    }
    case 'picklehood': {
      // green hood framing the face, bumpy, with a little stem on top
      ctx.beginPath();
      ctx.moveTo(-24, 22);
      ctx.bezierCurveTo(-36, -30, 30, -52, 33, 4);
      ctx.lineTo(30, 18);
      ctx.quadraticCurveTo(26, -18, 2, -24);
      ctx.quadraticCurveTo(-18, -22, -19, 22);
      ctx.closePath();
      const g = ctx.createLinearGradient(-30, 0, 30, 0);
      g.addColorStop(0, '#2f6b1f');
      g.addColorStop(0.5, '#5aa83a');
      g.addColorStop(1, '#3f8a2a');
      fillOl(ctx, g, 2.6, '#1f3d12');
      ctx.fillStyle = '#d6f5a8';
      for (const [bx, by] of [[-22, 0], [-16, -20], [-2, -34], [14, -32], [26, -14], [-24, 14], [29, 8]]) {
        ctx.beginPath();
        ctx.arc(bx, by, 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(-2, -40);
      ctx.quadraticCurveTo(0, -50, 6, -52);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1f3d12';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#6b8a2a';
      ctx.stroke();
      return;
    }
    case 'tophat': {
      ctx.save();
      ctx.translate(6, -34);
      ctx.rotate(0.22 + sway * 0.03);
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 4, 0, 0, TAU);
      fillOl(ctx, ST.headA ?? '#140c18', 2);
      ctx.beginPath();
      ctx.rect(-9, -18, 18, 18);
      fillOl(ctx, ST.headA ?? '#140c18', 2);
      ctx.fillStyle = ST.headB ?? '#c0183a';
      ctx.fillRect(-9, -6, 18, 4);
      // little rose
      ctx.beginPath();
      ctx.arc(8, -4, 3.6, 0, TAU);
      fillOl(ctx, ST.headB ?? '#c0183a', 1.4);
      // lace veil
      ctx.strokeStyle = 'rgba(233,226,239,0.7)';
      ctx.lineWidth = 1;
      for (let k = -10; k <= 12; k += 4) {
        ctx.beginPath();
        ctx.moveTo(k, 2);
        ctx.lineTo(k + 3, 9);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    case 'sakurapin': {
      // kanzashi: blossoms + a dangling bead strand
      const blossom = (x: number, y: number, r: number, c: string) => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 0.3;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r * 0.75, r * 0.5, a, 0, TAU);
          fillOl(ctx, c, 1.2);
        }
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, TAU);
        ctx.fill();
      };
      blossom(-14, -24, 6, '#ffb3cf');
      blossom(-4, -30, 5, '#ffffff');
      blossom(-20, -14, 4.5, '#ff8fb8');
      ctx.strokeStyle = '#e8b84a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-20, -12);
      ctx.quadraticCurveTo(-24 - sway * 2, 0, -22 - sway * 3, 10);
      ctx.stroke();
      ctx.fillStyle = '#e8304a';
      ctx.beginPath();
      ctx.arc(-22 - sway * 3, 11, 2.2, 0, TAU);
      ctx.fill();
      return;
    }
    case 'tiara': {
      ctx.save();
      ctx.translate(2, -33);
      ctx.rotate(0.14 + sway * 0.02);
      const gold = ST.headA ?? '#f2c14e';
      // band with three points
      ctx.beginPath();
      ctx.moveTo(-15, 2);
      ctx.lineTo(-14, -5);
      ctx.lineTo(-9, -2);
      ctx.lineTo(-5, -10);
      ctx.lineTo(0, -3);
      ctx.lineTo(5, -14);
      ctx.lineTo(9, -3);
      ctx.lineTo(13, -8);
      ctx.lineTo(16, 2);
      ctx.quadraticCurveTo(0, 5, -15, 2);
      ctx.closePath();
      fillOl(ctx, gold, 1.8);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-12, -1, 24, 1.4);
      // gems: big centre stone, side pearls
      ctx.beginPath();
      ctx.ellipse(5, -3, 3, 3.6, 0, 0, TAU);
      fillOl(ctx, ST.headB ?? '#6fd3ff', 1.2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(4, -4.5, 1, 0, TAU);
      ctx.fill();
      for (const [x, y] of [[-5, -8], [13, -6], [-14, -3]] as [number, number][]) {
        ctx.beginPath();
        ctx.arc(x, y, 1.9, 0, TAU);
        fillOl(ctx, '#ff6fae', 1);
      }
      // twinkle
      const tw = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(5, -21 - tw * 2);
      ctx.lineTo(5, -17);
      ctx.moveTo(3, -19);
      ctx.lineTo(7, -19);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'beret': {
      ctx.save();
      ctx.rotate(0.12);
      ctx.beginPath();
      ctx.ellipse(4, -30, 25, 10, 0.05, 0, TAU);
      fillOl(ctx, ST.headA ?? '#1f3a78', 2.4);
      ctx.beginPath();
      ctx.arc(4, -40, 2.6, 0, TAU);
      fillOl(ctx, ST.headA ?? '#1f3a78', 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(-4, -34, 9, 3, -0.2, 0, TAU);
      ctx.fill();
      // anchor pin
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(20, -32);
      ctx.lineTo(20, -24);
      ctx.moveTo(17, -29);
      ctx.lineTo(23, -29);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'chefhat': {
      ctx.save();
      ctx.rotate(-0.08);
      ctx.beginPath();
      ctx.arc(-6, -46, 10, 0, TAU);
      ctx.arc(6, -50, 11, 0, TAU);
      ctx.arc(16, -44, 9, 0, TAU);
      fillOl(ctx, '#ffffff', 2.2);
      ctx.beginPath();
      ctx.rect(-14, -40, 32, 12);
      fillOl(ctx, '#ffffff', 2.2);
      ctx.strokeStyle = '#dcd7ec';
      ctx.lineWidth = 1.2;
      for (const x of [-6, 2, 10]) {
        ctx.beginPath();
        ctx.moveTo(x, -39);
        ctx.lineTo(x, -29);
        ctx.stroke();
      }
      // cherry pin
      ctx.beginPath();
      ctx.arc(17, -33, 3.4, 0, TAU);
      fillOl(ctx, '#e8304a', 1.4);
      ctx.restore();
      return;
    }
    case 'leaf': {
      ctx.strokeStyle = '#5a3a14';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(2, -30);
      ctx.quadraticCurveTo(3, -40, 7, -44);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(14, -42, 10, 4.5, -0.5 + sway * 0.05, 0, TAU);
      fillOl(ctx, '#5ec24a', 1.8, '#24501a');
      ctx.strokeStyle = '#3a8a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(6, -38);
      ctx.lineTo(21, -46);
      ctx.stroke();
      return;
    }
    case 'valve': {
      ctx.save();
      ctx.translate(-12, -30);
      ctx.rotate(t * 0.8);
      ctx.strokeStyle = OL;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#d9363e';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.lineTo(-Math.cos(a) * 8, -Math.sin(a) * 8);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    case 'nightcap': {
      ctx.beginPath();
      ctx.moveTo(-24, -14);
      ctx.quadraticCurveTo(-10, -48, 18, -30);
      ctx.quadraticCurveTo(34, -24, 40, -4 + sway * 2);
      ctx.quadraticCurveTo(26, -20, 24, -16);
      ctx.quadraticCurveTo(0, -26, -24, -14);
      fillOl(ctx, ST.headA ?? '#a99ae0', 2.2);
      ctx.strokeStyle = ST.headB ?? '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, -36);
      ctx.lineTo(-2, -22);
      ctx.moveTo(10, -36);
      ctx.lineTo(10, -24);
      ctx.moveTo(24, -26);
      ctx.lineTo(22, -18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(40, -3 + sway * 2, 5, 0, TAU);
      fillOl(ctx, '#ffffff', 1.8);
      // band
      ctx.beginPath();
      ctx.moveTo(-25, -13);
      ctx.quadraticCurveTo(0, -27, 25, -15);
      ctx.lineWidth = 5;
      ctx.strokeStyle = OL;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      return;
    }
  }
}


// ---------------------------------------------------------------------
// outfit bodies (torso frame: hip at 0,0; shoulders ≈ y -28; hem ≈ y 22)
// ---------------------------------------------------------------------
/** Stuffed-tummy bulge that grows out of the outfit's own front edge. */
function bulge(ctx: CanvasRenderingContext2D, b: number, fill: string | CanvasGradient, x0: number, y0: number, y1: number, out = 15) {
  if (!b) return;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + out * b * 1.15, y0 + 1, x0 + out * b * 1.3, y1 - 3, x0 - 1, y1);
  };
  path();
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  path();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(x0 + out * b * 0.55, y0 + (y1 - y0) * 0.32, 2.2 + b * 2, 1.2 + b, -0.6, 0, TAU);
  ctx.fill();
}

function scatter(ctx: CanvasRenderingContext2D, region: () => void, kind: string, color: string) {
  ctx.save();
  region();
  ctx.clip();
  const pts: [number, number][] = [[-14, -24], [6, -22], [-6, -12], [12, -8], [-16, 2], [2, 4], [16, 8], [-8, 14], [8, 18], [-18, 20], [20, -16], [-2, -30]];
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  for (const [x, y] of pts) {
    if (kind === 'stars') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 1.2 : 2.8;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.fill();
    } else if (kind === 'petals') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.6, 1, a, 0, TAU);
        ctx.fill();
      }
    } else if (kind === 'spores') {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, TAU);
      ctx.fill();
    } else if (kind === 'bumps') {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, TAU);
      ctx.fill();
    } else if (kind === 'speckle') {
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, TAU);
      ctx.fill();
    } else if (kind === 'wrinkles') {
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.quadraticCurveTo(x, y - 2, x + 4, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function bodicePath(ctx: CanvasRenderingContext2D, bottom = -2) {
  ctx.beginPath();
  ctx.moveTo(-12, bottom);
  ctx.lineTo(-14, -26);
  ctx.quadraticCurveTo(0, -33, 14, -27);
  ctx.lineTo(12, bottom);
  ctx.quadraticCurveTo(0, bottom + 3, -12, bottom);
}

function skirtPath(ctx: CanvasRenderingContext2D, fl: number, hem: number, w = 30, top = -4) {
  ctx.beginPath();
  ctx.moveTo(-12, top);
  ctx.quadraticCurveTo(-w * 0.8 - fl * 3, top + 12, -w - fl * 6, hem + fl * 2);
  ctx.lineTo(w - fl * 2, hem - fl * 1.5);
  ctx.quadraticCurveTo(w * 0.8, top + 12, 12, top);
  ctx.closePath();
}

function hGrad(ctx: CanvasRenderingContext2D, x0: number, x1: number, dark: string, mid: string, hl: string) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, dark);
  g.addColorStop(0.45, mid);
  g.addColorStop(0.75, hl);
  g.addColorStop(1, mid);
  return g;
}

function scallopEdge(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, n: number, depth: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 0; i < n; i++) {
    const a = i / n, b2 = (i + 1) / n;
    const ax = lerp(x0, x1, a), ay = lerp(y0, y1, a);
    const bx = lerp(x0, x1, b2), by = lerp(y0, y1, b2);
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + depth, bx, by);
  }
  ctx.closePath();
  fillOl(ctx, fill, 1.8);
}

function smallBow(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, s = 1, tails = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-7, -4);
  ctx.lineTo(-7, 4);
  ctx.closePath();
  ctx.moveTo(0, 0);
  ctx.lineTo(7, -4);
  ctx.lineTo(7, 4);
  ctx.closePath();
  fillOl(ctx, c, 1.6);
  if (tails) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-1, 1);
    ctx.lineTo(-4, 10 + tails * 2);
    ctx.moveTo(1, 1);
    ctx.lineTo(4, 9 - tails);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, TAU);
  fillOl(ctx, c, 1.4);
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, p: Pose, flutter: number) {
  const b = clamp(p.belly ?? 0, 0, 1);
  const fl = flutter;
  switch (ST.body) {
    case 'maid':
    case 'regular':
      drawClassicTorso(ctx, p, flutter);
      if (ST.body === 'maid') bulge(ctx, b, ST.apron, 9, -20, 8, 16);
      else bulge(ctx, b, '#d0223b', 9, -24, 2, 14);
      return;

    case 'sailor': {
      const hem = 22;
      skirtPath(ctx, fl, hem, 29);
      fillOl(ctx, hGrad(ctx, -30, 30, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      // pleats
      ctx.strokeStyle = ST.dressDark;
      ctx.lineWidth = 1.4;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3.4, -1);
        ctx.lineTo(i * 8.6 - fl * 3, hem - 1);
        ctx.stroke();
      }
      ctx.strokeStyle = ST.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-27 - fl * 5, hem - 3 + fl);
      ctx.lineTo(27 - fl * 2, hem - 4 - fl);
      ctx.stroke();
      // tiny frilled half-apron
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(16, -2);
      ctx.lineTo(19 - fl, 11);
      ctx.lineTo(-3 - fl, 12);
      ctx.closePath();
      fillOl(ctx, ST.apron, 2);
      scallopEdge(ctx, -3 - fl, 12, 19 - fl, 11, 5, 4, ST.apron);
      // blouse
      bodicePath(ctx);
      fillOl(ctx, ST.trim, 2.6);
      bulge(ctx, b, ST.trim, 11, -22, -1, 14);
      // sailor collar
      ctx.beginPath();
      ctx.moveTo(-14, -27);
      ctx.lineTo(-4, -28);
      ctx.lineTo(3, -16);
      ctx.lineTo(9, -28);
      ctx.lineTo(14, -27);
      ctx.lineTo(12, -20);
      ctx.lineTo(3, -8);
      ctx.lineTo(-13, -19);
      ctx.closePath();
      fillOl(ctx, ST.stripe, 2.2);
      ctx.strokeStyle = ST.trim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-11, -21);
      ctx.lineTo(3, -11);
      ctx.lineTo(10, -21);
      ctx.stroke();
      smallBow(ctx, 3, -11, ST.bow, 1.05, fl + 1);
      return;
    }

    case 'goth': {
      // bat wings (behind)
      const flap = Math.sin(p.t * 9) * 0.25;
      for (const [s2, dx] of [[1, 0], [0.75, -4]] as [number, number][]) {
        ctx.save();
        ctx.translate(-12 + dx, -24);
        ctx.rotate(-0.5 + flap);
        ctx.scale(s2, s2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-26, -12);
        ctx.quadraticCurveTo(-22, -4, -24, 2);
        ctx.quadraticCurveTo(-18, -2, -16, 6);
        ctx.quadraticCurveTo(-10, 0, -8, 8);
        ctx.closePath();
        fillOl(ctx, '#2a1430', 2);
        ctx.restore();
      }
      // three tiers of ruffles
      for (let i = 2; i >= 0; i--) {
        const top = -4 + i * 7, hem = 9 + i * 7;
        const w = 20 + i * 6;
        skirtPath(ctx, fl * (0.5 + i * 0.3), hem, w, top);
        fillOl(ctx, hGrad(ctx, -w, w, ST.dressDark, ST.dress, ST.dressHL), 2.2);
        ctx.strokeStyle = ST.stripe;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-w - fl * 4 + 2, hem - 2);
        ctx.lineTo(w - fl * 2 - 2, hem - 3);
        ctx.stroke();
      }
      scallopEdge(ctx, -32 - fl * 5, 23 + fl, 32 - fl * 2, 22 - fl, 9, 4, ST.trim);
      // corset
      bodicePath(ctx, 0);
      fillOl(ctx, hGrad(ctx, -14, 14, ST.dressDark, ST.apron, ST.dressHL), 2.6);
      bulge(ctx, b, ST.apron, 11, -22, 0, 14);
      ctx.strokeStyle = ST.stripe;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let y = -23; y < -2; y += 4) {
        ctx.moveTo(3, y);
        ctx.lineTo(9, y + 4);
        ctx.moveTo(9, y);
        ctx.lineTo(3, y + 4);
      }
      ctx.stroke();
      scallopEdge(ctx, -13, -27, 14, -27, 6, 3, ST.trim);
      // choker with cross
      ctx.fillStyle = '#0c070f';
      ctx.fillRect(-2, -33, 9, 3);
      ctx.fillStyle = ST.bow;
      ctx.fillRect(2, -31, 1.6, 6);
      ctx.fillRect(0.6, -29.4, 4.4, 1.5);
      return;
    }

    case 'wa': {
      // big obi bow at the back
      ctx.save();
      ctx.translate(-14, -8);
      for (const a of [-0.7, 0.5]) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(-9, 0, 11, 6, 0, 0, TAU);
        fillOl(ctx, ST.bow, 2);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(-2, 2);
      ctx.lineTo(-10 - fl * 3, 22);
      ctx.lineTo(-4 - fl * 3, 22);
      ctx.lineTo(2, 4);
      fillOl(ctx, ST.bow, 1.8);
      ctx.restore();
      // hakama
      const hem = 25;
      skirtPath(ctx, fl, hem, 27, -4);
      fillOl(ctx, hGrad(ctx, -28, 28, shade(ST.stripe, 0.7), ST.stripe, shade(ST.stripe, 1.35)), 2.6);
      ctx.strokeStyle = shade(ST.stripe, 0.6);
      ctx.lineWidth = 1.3;
      for (let i = -2; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 4, 0);
        ctx.lineTo(i * 9 - fl * 3, hem - 1);
        ctx.stroke();
      }
      // frilled white apron over the hakama
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(16, -2);
      ctx.lineTo(19 - fl, 14);
      ctx.lineTo(-1 - fl, 15);
      ctx.closePath();
      fillOl(ctx, ST.apron, 2);
      scallopEdge(ctx, -1 - fl, 15, 19 - fl, 14, 5, 4, ST.apron);
      // kimono top
      bodicePath(ctx, -4);
      fillOl(ctx, hGrad(ctx, -14, 14, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      scatter(ctx, () => bodicePath(ctx, -4), 'petals', '#ffffff');
      // crossed collar
      ctx.lineCap = 'butt';
      for (const [x0, y0, x1, y1] of [[-8, -29, 7, -11], [11, -28, 2, -15]]) {
        ctx.strokeStyle = OL;
        ctx.lineWidth = 6.4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = ST.trim;
        ctx.lineWidth = 3.8;
        ctx.stroke();
      }
      // obi
      ctx.beginPath();
      ctx.rect(-14, -13, 28, 10);
      fillOl(ctx, ST.bow, 2.2);
      bulge(ctx, b, ST.bow, 13, -14, -2, 14);
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-13, -8);
      ctx.lineTo(13 + b * 8, -8);
      ctx.stroke();
      return;
    }

    case 'pajama': {
      const shirt = () => {
        ctx.beginPath();
        ctx.moveTo(-14, -28);
        ctx.quadraticCurveTo(0, -33, 14, -28);
        ctx.lineTo(17, 8);
        ctx.quadraticCurveTo(0, 13, -17, 8);
        ctx.closePath();
      };
      shirt();
      fillOl(ctx, hGrad(ctx, -17, 17, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      scatter(ctx, shirt, 'stars', ST.patternColor ?? '#ffe98a');
      bulge(ctx, b, ST.dress, 15, -20, 8, 15);
      ctx.strokeStyle = ST.trim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(6, -26);
      ctx.lineTo(7, 9);
      ctx.stroke();
      ctx.fillStyle = ST.trim;
      for (const y of [-20, -10, 0]) {
        ctx.beginPath();
        ctx.arc(9, y, 1.7, 0, TAU);
        ctx.fill();
      }
      // collar piping
      ctx.beginPath();
      ctx.moveTo(-8, -29);
      ctx.lineTo(1, -20);
      ctx.lineTo(4, -29);
      ctx.moveTo(4, -29);
      ctx.lineTo(8, -21);
      ctx.lineTo(13, -28);
      fillOl(ctx, ST.trim, 1.8);
      // pocket
      ctx.strokeStyle = ST.trim;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-9, -20, 8, 7);
      return;
    }

    case 'hoodie': {
      // hood bunched behind the neck
      ctx.beginPath();
      ctx.ellipse(-9, -29, 10, 6, -0.3, 0, TAU);
      fillOl(ctx, ST.dressDark, 2.2);
      const hood = () => {
        ctx.beginPath();
        ctx.moveTo(-15, -30);
        ctx.quadraticCurveTo(0, -35, 15, -30);
        ctx.quadraticCurveTo(22, -6, 21, 16);
        ctx.quadraticCurveTo(0, 21, -21, 16);
        ctx.quadraticCurveTo(-22, -6, -15, -30);
      };
      hood();
      fillOl(ctx, hGrad(ctx, -22, 22, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      scatter(ctx, hood, 'spores', ST.patternColor ?? '#1f4a1c');
      bulge(ctx, b, ST.dress, 19, -18, 12, 14);
      // ribbed hem
      ctx.beginPath();
      ctx.moveTo(-21, 12);
      ctx.quadraticCurveTo(0, 17, 21, 12);
      ctx.lineTo(21, 16);
      ctx.quadraticCurveTo(0, 21, -21, 16);
      ctx.closePath();
      fillOl(ctx, ST.dressDark, 2);
      // kangaroo pocket
      ctx.beginPath();
      ctx.moveTo(-6, -3);
      ctx.lineTo(16 + b * 8, -3);
      ctx.lineTo(19 + b * 8, 9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      fillOl(ctx, ST.apron, 1.8);
      // drawstrings
      ctx.strokeStyle = ST.trim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(1, -29);
      ctx.lineTo(-1 + fl, -15);
      ctx.moveTo(7, -29);
      ctx.lineTo(8 + fl, -16);
      ctx.stroke();
      // fuzzy edge
      ctx.strokeStyle = 'rgba(182,238,108,0.8)';
      ctx.lineWidth = 1.4;
      for (let y = -24; y < 14; y += 5) {
        ctx.beginPath();
        ctx.moveTo(-21 + Math.abs(y) * 0.05, y);
        ctx.lineTo(-25 + Math.sin(y + p.t * 3) * 1.5, y - 2);
        ctx.stroke();
      }
      return;
    }

    case 'onesie': {
      const suit = () => {
        ctx.beginPath();
        ctx.moveTo(-14, -29);
        ctx.quadraticCurveTo(0, -33, 14, -28);
        ctx.quadraticCurveTo(18, -10, 16, 8);
        ctx.quadraticCurveTo(0, 13, -16, 8);
        ctx.quadraticCurveTo(-18, -10, -14, -29);
      };
      suit();
      fillOl(ctx, hGrad(ctx, -18, 18, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      scatter(ctx, suit, 'wrinkles', ST.patternColor ?? '#dc9a8b');
      // tummy patch
      ctx.beginPath();
      ctx.ellipse(4 + b * 4, -8, 9 + b * 6, 13 + b * 3, 0, 0, TAU);
      fillOl(ctx, ST.apron, 2);
      bulge(ctx, b, ST.apron, 13, -18, 4, 12);
      // zipper
      ctx.strokeStyle = ST.dressDark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(8, -28);
      ctx.lineTo(8, 6);
      ctx.stroke();
      ctx.fillStyle = '#c9cede';
      ctx.fillRect(6.6, -27, 3, 4);
      return;
    }

    case 'pickle': {
      const rx = 21 + b * 7, ry = 34;
      const cap = () => {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * TAU;
          const bump = 1 + Math.sin(a * 9) * 0.035;
          ctx.lineTo(1 + b * 3 + Math.cos(a) * rx * bump, -6 + Math.sin(a) * ry * bump);
        }
        ctx.closePath();
      };
      cap();
      const g = ctx.createLinearGradient(-rx, 0, rx, 0);
      g.addColorStop(0, ST.dressDark);
      g.addColorStop(0.4, ST.dress);
      g.addColorStop(0.7, ST.dressHL);
      g.addColorStop(1, ST.dress);
      fillOl(ctx, g, 2.6, '#1f3d12');
      scatter(ctx, cap, 'bumps', ST.patternColor ?? '#d6f5a8');
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-8, -14, 3, 15, 0.08, 0, TAU);
      ctx.fill();
      // cute brine label
      ctx.save();
      ctx.translate(6, 2);
      ctx.rotate(-0.08);
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6, 0, 0, TAU);
      fillOl(ctx, '#fffbe0', 1.6, '#1f3d12');
      ctx.fillStyle = '#2f6b1f';
      ctx.font = 'bold 6px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DILL', 0, 2);
      ctx.restore();
      return;
    }

    case 'pear': {
      const k = 1 + b * 0.22;
      const pear = () => {
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.bezierCurveTo(13, -34, 11, -16, 22 * k, -4);
        ctx.bezierCurveTo(33 * k, 10, 22 * k, 28, 0, 28);
        ctx.bezierCurveTo(-22 * k, 28, -32 * k, 10, -22 * k, -4);
        ctx.bezierCurveTo(-11, -16, -13, -34, 0, -34);
      };
      pear();
      const g = ctx.createRadialGradient(-8, 4, 3, 0, 4, 34);
      g.addColorStop(0, ST.dressHL);
      g.addColorStop(0.55, ST.dress);
      g.addColorStop(1, ST.dressDark);
      fillOl(ctx, g, 2.6, '#5a4a08');
      scatter(ctx, pear, 'speckle', ST.patternColor ?? '#9a7f10');
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-12, 2, 4, 9, 0.3, 0, TAU);
      ctx.fill();
      // blush on the pear
      ctx.fillStyle = 'rgba(255,140,90,0.25)';
      ctx.beginPath();
      ctx.ellipse(12, 12, 9, 7, 0, 0, TAU);
      ctx.fill();
      return;
    }

    case 'jar': {
      const w = 21 + b * 6;
      const jar = () => {
        ctx.beginPath();
        ctx.moveTo(-w + 6, -30);
        ctx.lineTo(w - 6, -30);
        ctx.quadraticCurveTo(w, -30, w, -22);
        ctx.lineTo(w, 14);
        ctx.quadraticCurveTo(w, 22, w - 8, 22);
        ctx.lineTo(-w + 8, 22);
        ctx.quadraticCurveTo(-w, 22, -w, 14);
        ctx.lineTo(-w, -22);
        ctx.quadraticCurveTo(-w, -30, -w + 6, -30);
      };
      jar();
      const g = ctx.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, ST.dressDark);
      g.addColorStop(0.4, ST.dress);
      g.addColorStop(0.8, ST.dressHL);
      g.addColorStop(1, ST.dress);
      ctx.fillStyle = g;
      ctx.fill();
      // air gap + glass tint at the top
      ctx.save();
      jar();
      ctx.clip();
      ctx.fillStyle = 'rgba(220,240,255,0.85)';
      ctx.fillRect(-w, -30, w * 2, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const [bx, by, r] of [[-10, 10, 1.6], [6, 16, 1.2], [12, -16, 1.4], [-4, -18, 1]]) {
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      jar();
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = OL;
      ctx.stroke();
      // label
      ctx.beginPath();
      ctx.rect(-w, -13, w * 2, 15);
      fillOl(ctx, ST.stripe, 2);
      ctx.fillStyle = ST.bow;
      ctx.fillRect(-w + 1, -12, w * 2 - 2, 2.5);
      ctx.fillRect(-w + 1, -1.5, w * 2 - 2, 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px "Lilita One", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAYO', 2, -2.5);
      // glass shine
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-w + 5, -20);
      ctx.lineTo(-w + 5, 14);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-w + 9, -22);
      ctx.lineTo(-w + 9, -16);
      ctx.stroke();
      // threads at the neck
      ctx.strokeStyle = 'rgba(42,20,32,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w + 4, -27);
      ctx.lineTo(w - 4, -27);
      ctx.stroke();
      return;
    }

    case 'pipe': {
      const w = 17 + b * 5;
      ctx.beginPath();
      ctx.rect(-w, -32, w * 2, 48);
      fillOl(ctx, hGrad(ctx, -w, w, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      for (const y of [-35, -9, 12]) {
        ctx.beginPath();
        ctx.rect(-w - 3, y, w * 2 + 6, 7);
        fillOl(ctx, hGrad(ctx, -w, w, '#4a2412', ST.trim, ST.dressHL), 2);
        ctx.fillStyle = ST.dressHL;
        for (const bx of [-w + 2, -2, w - 4]) {
          ctx.beginPath();
          ctx.arc(bx, y + 3.5, 1.3, 0, TAU);
          ctx.fill();
        }
      }
      // rust streaks
      ctx.fillStyle = 'rgba(107,52,21,0.35)';
      ctx.fillRect(-8, -2, 2.4, 12);
      ctx.fillRect(9, -26, 2, 14);
      // pressure gauge
      ctx.save();
      ctx.translate(5, -20);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      fillOl(ctx, '#f4f1e8', 2);
      ctx.strokeStyle = '#d33';
      ctx.lineWidth = 1.6;
      const a = -2.4 + Math.sin(p.t * 4) * 0.5 + 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.stroke();
      ctx.restore();
      // steam puffs
      const k = (p.t * 0.9) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(-10 - k * 6, -38 - k * 16, 4 + k * 6, 0, TAU);
      ctx.fill();
      return;
    }

    case 'princess': {
      // ball gown: wide under-skirt, draped over-skirt with gold trim, scalloped petticoat
      const hem = 24;
      scallopEdge(ctx, -35 - fl * 6, hem + fl * 2, 35 - fl * 2, hem - fl * 1.5, 10, 4, ST.trim);
      skirtPath(ctx, fl, hem, 35, -3);
      fillOl(ctx, hGrad(ctx, -35, 35, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      // over-skirt drapes
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 11, -3);
        ctx.quadraticCurveTo(side * 26 - fl * 3, 6, side * 25 - fl * 4, 14 - fl);
        ctx.quadraticCurveTo(side * 14, 9, side * 2, 11);
        ctx.closePath();
        fillOl(ctx, ST.apron, 2);
        ctx.strokeStyle = ST.stripe;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(side * 25 - fl * 4, 14 - fl);
        ctx.quadraticCurveTo(side * 14, 9, side * 2, 11);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(side * 25 - fl * 4, 14 - fl, 2.2, 0, TAU);
        fillOl(ctx, ST.trim, 1);
      }
      // gold hem band
      ctx.strokeStyle = ST.stripe;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-33 - fl * 6, hem - 3 + fl * 2);
      ctx.lineTo(33 - fl * 2, hem - 4 - fl * 1.5);
      ctx.stroke();
      skirtPattern(ctx, hem, fl);
      // bodice
      bodicePath(ctx, 0);
      fillOl(ctx, hGrad(ctx, -14, 14, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      bulge(ctx, b, ST.dress, 11, -22, 0, 14);
      // gold V waist + neckline lace
      ctx.strokeStyle = ST.stripe;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(1, 2);
      ctx.lineTo(12, -4);
      ctx.stroke();
      scallopEdge(ctx, -13, -27, 14, -27, 6, 3, ST.trim);
      smallBow(ctx, 2, -20, ST.bow, 0.8);
      // pearl necklace
      ctx.fillStyle = '#fffaf2';
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.15 + (i / 5) * 0.7);
        ctx.beginPath();
        ctx.arc(2 + Math.cos(a) * 7, -32 + Math.sin(a) * 3, 1.3, 0, TAU);
        ctx.fill();
      }
      return;
    }

    case 'baker': {
      // chef jacket
      bodicePath(ctx, 2);
      fillOl(ctx, hGrad(ctx, -14, 14, ST.dressDark, ST.dress, ST.dressHL), 2.6);
      bulge(ctx, b, ST.dress, 11, -24, 0, 15);
      ctx.fillStyle = '#e8b84a';
      for (const y of [-22, -15, -8]) {
        for (const x of [1, 8]) {
          ctx.beginPath();
          ctx.arc(x + (b * 6 * (x > 4 ? 1 : 0.5)), y, 1.6, 0, TAU);
          ctx.fill();
        }
      }
      // neckerchief
      ctx.beginPath();
      ctx.moveTo(-6, -29);
      ctx.lineTo(10, -29);
      ctx.lineTo(3, -20);
      ctx.closePath();
      fillOl(ctx, ST.bow, 1.8);
      // pie-crust tutu
      const tw = 33 + b * 3;
      ctx.save();
      ctx.translate(0, 3);
      ctx.rotate(-0.04 + fl * 0.02);
      ctx.beginPath();
      ctx.ellipse(0, 0, tw, 9, 0, 0, TAU);
      fillOl(ctx, ST.apron, 2.4);
      // cherry filling peeking + lattice
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, -1, tw - 6, 6, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = '#c0183a';
      ctx.fillRect(-tw, -8, tw * 2, 14);
      ctx.strokeStyle = ST.apron;
      ctx.lineWidth = 3.2;
      for (let x = -tw; x < tw; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, -7);
        ctx.lineTo(x + 7, 6);
        ctx.moveTo(x + 7, -7);
        ctx.lineTo(x, 6);
        ctx.stroke();
      }
      ctx.restore();
      // fluted crust edge
      ctx.fillStyle = ST.apronShade;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * tw, Math.sin(a) * 9, 3.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
  }
}
