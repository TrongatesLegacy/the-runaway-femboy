import { Rng, TAU, makeCanvas, rgba } from '../util';
import { PIPE_STYLES, pipeH, pipeV, starPath, valveWheel } from './things';

export const GY = 600; // ground line (logical px)
export const TILE = 2048;

export type StageId = 0 | 1 | 2;
export type Particles = 'spores' | 'dust' | 'fireflies';

interface Layer {
  c: HTMLCanvasElement;
  factor: number;
}

export interface StageTheme {
  id: StageId;
  name: string;
  subtitle: string;
  sky: [number, string][]; // y → colour
  readonly layers: Layer[];
  fog: string;
  particles: Particles;
  pipeStyles: string[];
  music: string;
  ambient: string;
  groundTop: string;
  groundFill: string;
  groundDark: string;
  accent: string;
}

const OL = '#2a1420';

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
function wrapDraw(w: number, x: number, span: number, fn: (x: number) => void) {
  fn(x);
  if (x + span > w) fn(x - w);
  if (x < 0) fn(x + w);
}

function windowsGrid(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  cw: number,
  ch: number,
  gap: number,
  lit: string[],
  dark: string,
  pLit: number,
) {
  for (let yy = y + gap; yy + ch < y + h - 4; yy += ch + gap) {
    for (let xx = x + gap; xx + cw < x + w - 2; xx += cw + gap) {
      const on = rng.chance(pLit);
      ctx.fillStyle = on ? rng.pick(lit) : dark;
      ctx.fillRect(xx, yy, cw, ch);
    }
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${size}px "Lilita One", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = size * 0.25;
  ctx.fillText(text, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${size * 0.98}px "Lilita One", sans-serif`;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------
// STAGE 1 — THE MOLDY BASEMENT (sewer)
// ---------------------------------------------------------------------
function sewerLayers(): Layer[] {
  const rng = new Rng(11);
  // far vault arches
  const far = makeCanvas(TILE, 720);
  {
    const ctx = far.ctx;
    for (let i = 0; i < 6; i++) {
      const x = i * (TILE / 6);
      // pillar
      ctx.fillStyle = '#16233a';
      ctx.fillRect(x - 30, 120, 60, 520);
      // arch opening glow
      const ax = x + TILE / 12;
      const g = ctx.createRadialGradient(ax, 420, 10, ax, 420, 260);
      g.addColorStop(0, 'rgba(90,170,160,0.35)');
      g.addColorStop(1, 'rgba(90,170,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ax - 260, 160, 520, 480);
      ctx.strokeStyle = '#1d2c46';
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(x, 640);
      ctx.lineTo(x, 330);
      ctx.arc(ax, 330, TILE / 12, Math.PI, 0);
      ctx.lineTo(x + TILE / 6, 640);
      ctx.stroke();
      // tiny far pipes
      ctx.fillStyle = '#1a2a40';
      ctx.fillRect(x, 190 + (i % 3) * 30, TILE / 6, 12);
    }
    // distant drips of light
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(140,220,200,${rng.range(0.05, 0.2)})`;
      ctx.fillRect(rng.range(0, TILE), rng.range(150, 600), 2, rng.range(10, 40));
    }
  }
  // mid: big pipes + hanging bulbs
  const mid = makeCanvas(TILE, 720);
  {
    const ctx = mid.ctx;
    const st = { ...PIPE_STYLES.steel, base: '#3c4a63', light: '#6f81a3', dark: '#141b2a', flange: '#2c3850', rust: 0 };
    const st2 = { ...PIPE_STYLES.copper, base: '#6b4430', light: '#a8714f', dark: '#26150d', flange: '#4f301f', rust: 0 };
    pipeH(ctx, -20, 120, TILE + 40, 30, st, 1);
    pipeH(ctx, -20, 196, TILE + 40, 16, st2, 2);
    for (let i = 0; i < 7; i++) {
      const x = 140 + i * 290 + rng.range(-40, 40);
      pipeV(ctx, x, 120, 560, rng.pick([14, 18, 22]), rng.chance(0.5) ? st : st2, false);
      if (rng.chance(0.6)) valveWheel(ctx, x, rng.range(300, 460), 14, rng.range(0, 3), '#7a2b33');
    }
    // hanging bulbs with warm glow
    for (let i = 0; i < 5; i++) {
      const x = 200 + i * 410 + rng.range(-60, 60);
      const len = rng.range(70, 150);
      ctx.strokeStyle = '#0e1320';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 150);
      ctx.lineTo(x, 150 + len);
      ctx.stroke();
      const by = 150 + len;
      ctx.globalCompositeOperation = 'lighter';
      // light cone
      const cg = ctx.createLinearGradient(0, by, 0, 600);
      cg.addColorStop(0, 'rgba(255,190,110,0.28)');
      cg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(x - 10, by);
      ctx.lineTo(x + 10, by);
      ctx.lineTo(x + 170, 600);
      ctx.lineTo(x - 170, 600);
      ctx.closePath();
      ctx.fill();
      glow(ctx, x, by + 8, 90, '#ffbf73', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#2a2a34';
      ctx.fillRect(x - 7, by - 4, 14, 8);
      ctx.fillStyle = '#fff1c8';
      ctx.beginPath();
      ctx.arc(x, by + 9, 7, 0, TAU);
      ctx.fill();
    }
  }
  // near: brick wall with arches, mold patches, graffiti
  const near = makeCanvas(TILE, 720);
  {
    const ctx = near.ctx;
    const wallTop = 300;
    const g = ctx.createLinearGradient(0, wallTop, 0, 620);
    g.addColorStop(0, '#2a3346');
    g.addColorStop(1, '#1b2232');
    ctx.fillStyle = g;
    ctx.fillRect(0, wallTop, TILE, 340);
    // bricks
    for (let row = 0; row < 16; row++) {
      const y = wallTop + row * 20;
      for (let x = (row % 2) * -22; x < TILE; x += 44) {
        const v = rng.range(-8, 8);
        ctx.fillStyle = `rgb(${46 + v},${56 + v},${78 + v})`;
        ctx.fillRect(x + 2, y + 2, 40, 16);
      }
    }
    // arched tunnels cut into wall (dark)
    for (let i = 0; i < 3; i++) {
      const cx = 300 + i * 700 + rng.range(-60, 60);
      const r = rng.range(90, 120);
      ctx.fillStyle = '#0b0f1a';
      ctx.beginPath();
      ctx.moveTo(cx - r, 620);
      ctx.lineTo(cx - r, 620 - r * 0.9);
      ctx.arc(cx, 620 - r * 0.9, r, Math.PI, 0);
      ctx.lineTo(cx + r, 620);
      ctx.closePath();
      ctx.fill();
      // grate bars
      ctx.strokeStyle = '#3d4860';
      ctx.lineWidth = 6;
      for (let b = -r + 22; b < r; b += 26) {
        ctx.beginPath();
        ctx.moveTo(cx + b, 620);
        ctx.lineTo(cx + b, 620 - r * 0.9 - Math.sqrt(Math.max(0, r * r - b * b)) + 6);
        ctx.stroke();
      }
      // arch rim
      ctx.strokeStyle = '#4a5674';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(cx - r, 620);
      ctx.lineTo(cx - r, 620 - r * 0.9);
      ctx.arc(cx, 620 - r * 0.9, r, Math.PI, 0);
      ctx.lineTo(cx + r, 620);
      ctx.stroke();
    }
    // mold patches crawling on the wall
    for (let i = 0; i < 14; i++) {
      const x = rng.range(0, TILE);
      const y = rng.range(wallTop + 10, 600);
      const r = rng.range(20, 70);
      wrapDraw(TILE, x, r, (xx) => {
        for (let k = 0; k < 9; k++) {
          const a = rng.range(0, TAU);
          const d = rng.range(0, r);
          const rr = rng.range(r * 0.2, r * 0.55);
          const mg = ctx.createRadialGradient(xx + Math.cos(a) * d, y + Math.sin(a) * d, 0, xx + Math.cos(a) * d, y + Math.sin(a) * d, rr);
          mg.addColorStop(0, 'rgba(110,170,70,0.55)');
          mg.addColorStop(1, 'rgba(60,110,40,0)');
          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.arc(xx + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, TAU);
          ctx.fill();
        }
      });
    }
    // graffiti
    ctx.save();
    ctx.globalAlpha = 0.75;
    neonTextFlat(ctx, 'NYA~', 640, 420, 46, '#ff6fae', -0.08);
    neonTextFlat(ctx, '☆ ASTRAY ☆', 1540, 370, 32, '#7fe0ff', 0.04);
    neonTextFlat(ctx, 'mold zone', 1080, 470, 26, '#b6ee6c', -0.05);
    ctx.restore();
    // ladders
    for (let i = 0; i < 2; i++) {
      const x = 900 + i * 820;
      ctx.strokeStyle = '#59647f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, 260);
      ctx.lineTo(x, 610);
      ctx.moveTo(x + 36, 260);
      ctx.lineTo(x + 36, 610);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (let y = 280; y < 610; y += 26) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 36, y);
        ctx.stroke();
      }
    }
  }
  return [
    { c: far.c, factor: 0.1 },
    { c: mid.c, factor: 0.28 },
    { c: near.c, factor: 0.55 },
  ];
}

function neonTextFlat(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${size}px "Lilita One", sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeText(text, 2, 3);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------
// STAGE 2 — BACK ALLEY AT DUSK
// ---------------------------------------------------------------------
function alleyLayers(): Layer[] {
  const rng = new Rng(23);
  const far = makeCanvas(TILE, 720);
  {
    const ctx = far.ctx;
    let x = 0;
    while (x < TILE) {
      const w = rng.range(60, 150);
      const h = rng.range(140, 330);
      ctx.fillStyle = '#8a4f86';
      ctx.fillRect(x, 560 - h, w, h + 80);
      if (rng.chance(0.3)) {
        ctx.fillRect(x + w / 2 - 2, 560 - h - 40, 4, 40);
      }
      windowsGrid(ctx, rng, x, 560 - h, w, h, 5, 7, 7, ['#ffd9a0', '#ffc27a'], 'rgba(0,0,0,0)', 0.18);
      x += w + rng.range(-10, 6);
    }
    // haze
    const hz = ctx.createLinearGradient(0, 300, 0, 640);
    hz.addColorStop(0, 'rgba(255,160,140,0)');
    hz.addColorStop(1, 'rgba(255,170,140,0.55)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 300, TILE, 340);
  }
  const mid = makeCanvas(TILE, 720);
  {
    const ctx = mid.ctx;
    let x = 0;
    while (x < TILE) {
      const w = rng.range(140, 260);
      const h = rng.range(220, 400);
      const top = 600 - h;
      ctx.fillStyle = '#4c2a5c';
      ctx.fillRect(x, top, w, h + 40);
      ctx.fillStyle = '#5f3670';
      ctx.fillRect(x, top, w, 10);
      windowsGrid(ctx, rng, x, top + 10, w, h - 10, 14, 20, 12, ['#ffcf7a', '#ffb867', '#ffe3a8'], '#2f1a3c', 0.4);
      if (rng.chance(0.5)) {
        // water tower
        const tx = x + rng.range(20, w - 60);
        ctx.fillStyle = '#3a1f47';
        ctx.fillRect(tx, top - 62, 46, 46);
        ctx.beginPath();
        ctx.moveTo(tx - 4, top - 62);
        ctx.lineTo(tx + 23, top - 84);
        ctx.lineTo(tx + 50, top - 62);
        ctx.fill();
        ctx.fillRect(tx + 6, top - 16, 4, 16);
        ctx.fillRect(tx + 36, top - 16, 4, 16);
      }
      x += w + rng.range(4, 30);
    }
  }
  const near = makeCanvas(TILE, 720);
  {
    const ctx = near.ctx;
    let x = -40;
    const brick = ['#5a2f3f', '#64344a', '#4e2838'];
    while (x < TILE) {
      const w = rng.range(260, 420);
      const top = rng.range(150, 260);
      const col = rng.pick(brick);
      ctx.fillStyle = col;
      ctx.fillRect(x, top, w, 620 - top);
      // brick texture
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = top + 8; y < 620; y += 16) {
        for (let bx = x + ((y / 16) % 2) * 14; bx < x + w; bx += 30) ctx.fillRect(bx, y, 26, 2);
      }
      // roof ledge
      ctx.fillStyle = '#3a1c2a';
      ctx.fillRect(x - 6, top - 10, w + 12, 14);
      // windows w/ warm light + blinds
      for (let wy = top + 40; wy < 520; wy += 110) {
        for (let wx = x + 40; wx < x + w - 70; wx += 120) {
          const lit = rng.chance(0.55);
          ctx.fillStyle = '#2a1520';
          ctx.fillRect(wx - 5, wy - 5, 60, 78);
          ctx.fillStyle = lit ? '#ffcf86' : '#3b2440';
          ctx.fillRect(wx, wy, 50, 68);
          if (lit) {
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, wx + 25, wy + 34, 80, '#ffb35c', 0.25);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(160,90,60,0.35)';
            for (let b = 0; b < 68; b += 8) ctx.fillRect(wx, wy + b, 50, 3);
          }
          ctx.fillStyle = '#2a1520';
          ctx.fillRect(wx + 23, wy, 4, 68);
          // sill
          ctx.fillStyle = '#7a4a58';
          ctx.fillRect(wx - 8, wy + 70, 66, 6);
          if (rng.chance(0.3)) {
            // flower pot
            ctx.fillStyle = '#b5543a';
            ctx.fillRect(wx + 4, wy + 58, 16, 12);
            ctx.fillStyle = '#ff7aa8';
            ctx.beginPath();
            ctx.arc(wx + 8, wy + 54, 5, 0, TAU);
            ctx.arc(wx + 16, wy + 52, 5, 0, TAU);
            ctx.fill();
          }
        }
      }
      // fire escape
      if (rng.chance(0.7)) {
        const fx = x + rng.range(30, w - 160);
        ctx.strokeStyle = '#1f1220';
        ctx.lineWidth = 4;
        for (let fy = top + 120; fy < 560; fy += 110) {
          ctx.strokeRect(fx, fy, 130, 8);
          for (let r = fx; r <= fx + 130; r += 13) {
            ctx.beginPath();
            ctx.moveTo(r, fy);
            ctx.lineTo(r, fy - 30);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(fx, fy - 30);
          ctx.lineTo(fx + 130, fy - 30);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(fx + 20, fy + 8);
          ctx.lineTo(fx + 110, fy + 102);
          ctx.stroke();
        }
      }
      // AC unit
      if (rng.chance(0.6)) {
        const ax = x + rng.range(20, w - 80);
        const ay = top + rng.range(60, 200);
        ctx.fillStyle = '#9aa3b5';
        ctx.fillRect(ax, ay, 60, 38);
        ctx.fillStyle = '#6b7385';
        for (let k = 0; k < 5; k++) ctx.fillRect(ax + 6, ay + 6 + k * 6, 48, 2);
      }
      x += w + rng.range(30, 70);
    }
    // laundry lines with maid outfits & socks
    for (let i = 0; i < 3; i++) {
      const lx = 200 + i * 640 + rng.range(-50, 50);
      const ly = rng.range(230, 300);
      const lw = 360;
      ctx.strokeStyle = '#1a0f18';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(lx + lw / 2, ly + 40, lx + lw, ly);
      ctx.stroke();
      for (let k = 1; k < 6; k++) {
        const px = lx + (k * lw) / 6;
        const py = ly + Math.sin((k / 6) * Math.PI) * 30;
        const kind = rng.int(0, 3);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rng.range(-0.08, 0.08));
        if (kind === 0) {
          // tiny maid dress
          ctx.fillStyle = '#211c2e';
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(12, 0);
          ctx.lineTo(20, 44);
          ctx.lineTo(-20, 44);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fdfbff';
          ctx.fillRect(-8, 8, 16, 32);
        } else if (kind === 1) {
          ctx.fillStyle = rng.pick(['#ff9ec4', '#9ed0ff', '#fff3a8']);
          ctx.fillRect(-14, 0, 28, 34);
          ctx.fillRect(-20, 0, 8, 14);
          ctx.fillRect(12, 0, 8, 14);
        } else if (kind === 2) {
          ctx.fillStyle = '#fbf8ff';
          ctx.fillRect(-4, 0, 8, 36);
          ctx.fillStyle = '#f59cbe';
          ctx.fillRect(-4, 0, 8, 5);
        } else {
          ctx.fillStyle = '#d4283f';
          ctx.fillRect(-15, 0, 30, 26);
        }
        ctx.fillStyle = '#e8d9b0';
        ctx.fillRect(-2, -3, 4, 6);
        ctx.restore();
      }
    }
    // neon signs
    neonText(ctx, 'CAFE ♥', 520, 210, 34, '#ff5fa2', -0.05);
    neonText(ctx, 'MAID', 1460, 190, 30, '#6fe7ff', 0.03);
    // power lines
    ctx.strokeStyle = 'rgba(20,10,20,0.85)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(0, 90 + k * 14);
      for (let px = 0; px <= TILE; px += TILE / 4) {
        ctx.quadraticCurveTo(px + TILE / 8, 130 + k * 14, px + TILE / 4, 90 + k * 14);
      }
      ctx.stroke();
    }
  }
  return [
    { c: far.c, factor: 0.06 },
    { c: mid.c, factor: 0.2 },
    { c: near.c, factor: 0.5 },
  ];
}

// ---------------------------------------------------------------------
// STAGE 3 — NEON ROOFTOPS
// ---------------------------------------------------------------------
function rooftopLayers(): Layer[] {
  const rng = new Rng(37);
  const far = makeCanvas(TILE, 720);
  {
    const ctx = far.ctx;
    let x = 0;
    while (x < TILE) {
      const w = rng.range(50, 130);
      const h = rng.range(180, 420);
      const top = 600 - h;
      ctx.fillStyle = '#1b1840';
      ctx.fillRect(x, top, w, h + 40);
      windowsGrid(ctx, rng, x, top, w, h, 4, 6, 6, ['#7fe0ff', '#ff9fd6', '#fff1a8'], 'rgba(0,0,0,0)', 0.22);
      if (rng.chance(0.35)) {
        ctx.fillStyle = '#1b1840';
        ctx.fillRect(x + w / 2 - 2, top - 50, 4, 50);
        ctx.fillStyle = '#ff3b5c';
        ctx.beginPath();
        ctx.arc(x + w / 2, top - 52, 3, 0, TAU);
        ctx.fill();
      }
      x += w + rng.range(-6, 10);
    }
    const hz = ctx.createLinearGradient(0, 380, 0, 640);
    hz.addColorStop(0, 'rgba(120,60,160,0)');
    hz.addColorStop(1, 'rgba(150,70,170,0.6)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 380, TILE, 260);
  }
  const mid = makeCanvas(TILE, 720);
  {
    const ctx = mid.ctx;
    let x = 0;
    const signs = ['NYA~', '☆', 'MAYO?', 'BINGUS', '24H', 'MOLD-FREE', '♥', 'PEARS', 'MAID CAFE', 'UwU'];
    let signI = 0;
    const colors = ['#ff4fa3', '#45e3ff', '#b6ff5c', '#ffd84a', '#c48bff'];
    while (x < TILE) {
      const w = rng.range(150, 260);
      const h = rng.range(280, 470);
      const top = 610 - h;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#231d52');
      g.addColorStop(1, '#2e2566');
      ctx.fillStyle = g;
      ctx.fillRect(x, top, w, h + 40);
      windowsGrid(ctx, rng, x, top + 12, w, h - 12, 10, 14, 10, ['#9ff0ff', '#ffc3ea', '#fff3b8'], '#1a1540', 0.33);
      if (rng.chance(0.75)) {
        const c = rng.pick(colors);
        const sx = x + w / 2;
        const sy = top + rng.range(50, 140);
        ctx.fillStyle = 'rgba(10,8,30,0.85)';
        ctx.fillRect(sx - 70, sy - 26, 140, 52);
        neonText(ctx, signs[signI++ % signs.length], sx, sy, 30, c, 0);
      }
      x += w + rng.range(10, 40);
    }
  }
  const near = makeCanvas(TILE, 720);
  {
    const ctx = near.ctx;
    // rooftop furniture silhouettes
    let x = 0;
    while (x < TILE) {
      const kind = rng.int(0, 4);
      if (kind === 0) {
        // water tank
        const bx = x;
        ctx.fillStyle = '#2b2152';
        ctx.fillRect(bx + 10, 470, 8, 140);
        ctx.fillRect(bx + 92, 470, 8, 140);
        ctx.fillStyle = '#3b2d6b';
        ctx.fillRect(bx, 360, 110, 120);
        ctx.fillStyle = '#4a3a82';
        for (let k = 0; k < 4; k++) ctx.fillRect(bx, 372 + k * 28, 110, 4);
        ctx.fillStyle = '#2b2152';
        ctx.beginPath();
        ctx.moveTo(bx - 8, 362);
        ctx.lineTo(bx + 55, 318);
        ctx.lineTo(bx + 118, 362);
        ctx.fill();
        x += 180;
      } else if (kind === 1) {
        // antenna + dish
        ctx.strokeStyle = '#3b2d6b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + 20, 610);
        ctx.lineTo(x + 20, 330);
        ctx.moveTo(x + 4, 380);
        ctx.lineTo(x + 36, 380);
        ctx.moveTo(x + 8, 420);
        ctx.lineTo(x + 32, 420);
        ctx.stroke();
        ctx.fillStyle = '#ff3b5c';
        ctx.beginPath();
        ctx.arc(x + 20, 326, 4, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x + 20, 326, 26, '#ff3b5c', 0.6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#4a3a82';
        ctx.beginPath();
        ctx.ellipse(x + 90, 540, 34, 14, -0.6, 0, TAU);
        ctx.fill();
        ctx.fillRect(x + 86, 548, 8, 62);
        x += 160;
      } else if (kind === 2) {
        // billboard
        const bw = 300;
        ctx.fillStyle = '#20183f';
        ctx.fillRect(x + 30, 420, 10, 190);
        ctx.fillRect(x + bw - 40, 420, 10, 190);
        ctx.fillStyle = '#16112e';
        ctx.fillRect(x, 270, bw, 150);
        const bg = ctx.createLinearGradient(x, 270, x + bw, 420);
        bg.addColorStop(0, '#ff6fb5');
        bg.addColorStop(1, '#7a5cff');
        ctx.fillStyle = bg;
        ctx.fillRect(x + 8, 278, bw - 16, 134);
        ctx.fillStyle = '#fff';
        ctx.font = '40px "Lilita One", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(rng.pick(['EAT PICKLES', 'PEAR POWER', 'PIE TIME']), x + bw / 2, 340);
        ctx.font = '22px Fredoka, sans-serif';
        ctx.fillText('★ stay mold-free ★', x + bw / 2, 380);
        ctx.textAlign = 'start';
        // spotlights
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [x + 60, x + bw - 60]) {
          const lg = ctx.createLinearGradient(0, 420, 0, 270);
          lg.addColorStop(0, 'rgba(255,240,200,0.35)');
          lg.addColorStop(1, 'rgba(255,240,200,0)');
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(lx - 6, 425);
          ctx.lineTo(lx + 6, 425);
          ctx.lineTo(lx + 60, 270);
          ctx.lineTo(lx - 60, 270);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        x += bw + 60;
      } else {
        // AC block with fan
        ctx.fillStyle = '#3b2d6b';
        ctx.fillRect(x, 530, 120, 80);
        ctx.fillStyle = '#2b2152';
        ctx.beginPath();
        ctx.arc(x + 60, 570, 26, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#4a3a82';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 36, 570);
        ctx.lineTo(x + 84, 570);
        ctx.moveTo(x + 60, 546);
        ctx.lineTo(x + 60, 594);
        ctx.stroke();
        x += 170;
      }
      x += rng.range(40, 140);
    }
    // string lights
    for (let i = 0; i < 2; i++) {
      const lx = 300 + i * 1000;
      const lw = 520;
      ctx.strokeStyle = 'rgba(10,8,30,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, 300);
      ctx.quadraticCurveTo(lx + lw / 2, 380, lx + lw, 300);
      ctx.stroke();
      for (let k = 1; k < 14; k++) {
        const tt = k / 14;
        const px = lx + tt * lw;
        const py = 300 + 2 * tt * (1 - tt) * 80;
        const c = ['#ffd84a', '#ff6fb5', '#6fe7ff'][k % 3];
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, px, py + 5, 16, c, 0.7);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(px, py + 5, 3.5, 0, TAU);
        ctx.fill();
      }
    }
  }
  return [
    { c: far.c, factor: 0.05 },
    { c: mid.c, factor: 0.18 },
    { c: near.c, factor: 0.45 },
  ];
}

// ---------------------------------------------------------------------
let themes: StageTheme[] | null = null;
const layerCache = new Map<string, Layer[]>();
/** Parallax layers are big canvases: build each stage's set on first use. */
function lazyLayers(key: string, build: () => Layer[]) {
  let l = layerCache.get(key);
  if (!l) {
    l = build();
    layerCache.set(key, l);
  }
  return l;
}

export function getThemes(): StageTheme[] {
  if (themes) return themes;
  themes = [
    {
      id: 0,
      name: 'The Moldy Basement',
      subtitle: 'Stage 1',
      sky: [
        [0, '#070b16'],
        [300, '#13203a'],
        [620, '#1f3550'],
      ],
      get layers() {
        return lazyLayers('sewer', sewerLayers);
      },
      fog: '#1a3048',
      particles: 'spores',
      pipeStyles: ['copper', 'steel', 'green'],
      music: 'music/stage1',
      ambient: 'ambient/sewer',
      groundTop: '#56637d',
      groundFill: '#2c3447',
      groundDark: '#151a26',
      accent: '#b6ee6c',
    },
    {
      id: 1,
      name: 'Back Alley at Dusk',
      subtitle: 'Stage 2',
      sky: [
        [0, '#241a4a'],
        [200, '#6b3a7c'],
        [380, '#e0727a'],
        [540, '#ffc08a'],
      ],
      get layers() {
        return lazyLayers('alley', alleyLayers);
      },
      fog: '#c8708a',
      particles: 'dust',
      pipeStyles: ['red', 'copper', 'steel'],
      music: 'music/stage2',
      ambient: 'ambient/city',
      groundTop: '#6c5070',
      groundFill: '#3a2a40',
      groundDark: '#1e1424',
      accent: '#ffb36b',
    },
    {
      id: 2,
      name: 'Neon Rooftops',
      subtitle: 'Stage 3',
      sky: [
        [0, '#04061a'],
        [260, '#16123f'],
        [600, '#4a2470'],
      ],
      get layers() {
        return lazyLayers('rooftop', rooftopLayers);
      },
      fog: '#5a2f8a',
      particles: 'fireflies',
      pipeStyles: ['violet', 'steel', 'red'],
      music: 'music/stage3',
      ambient: 'ambient/night',
      groundTop: '#5b4a9a',
      groundFill: '#2a2058',
      groundDark: '#120d2a',
      accent: '#6fe7ff',
    },
  ];
  return themes;
}

// ---------------------------------------------------------------------
// per-frame drawing
// ---------------------------------------------------------------------
const STARS = (() => {
  const r = new Rng(99);
  return Array.from({ length: 140 }, () => ({ x: r.next(), y: r.range(0, 420), s: r.range(0.6, 2.2), p: r.range(0, TAU) }));
})();

/** Sky + celestial body + parallax layers for one theme. vx0/vw are the visible logical x-range; top/bottom are visible y-range. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  th: StageTheme,
  camX: number,
  vw: number,
  top: number,
  bottom: number,
  t: number,
) {
  // sky
  const g = ctx.createLinearGradient(0, th.sky[0][0], 0, th.sky[th.sky.length - 1][0]);
  const span = th.sky[th.sky.length - 1][0] - th.sky[0][0];
  for (const [y, c] of th.sky) g.addColorStop((y - th.sky[0][0]) / span, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, vw, bottom - top);

  if (th.id === 1) {
    // setting sun
    const sx = vw * 0.68, sy = 470;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, sx, sy, 420, '#ff9a5c', 0.45);
    glow(ctx, sx, sy, 160, '#ffd9a0', 0.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffe2b0';
    ctx.beginPath();
    ctx.arc(sx, sy, 78, 0, TAU);
    ctx.fill();
    // sun stripes
    ctx.fillStyle = 'rgba(224,114,122,0.55)';
    for (let i = 0; i < 4; i++) ctx.fillRect(sx - 80, sy + 18 + i * 14, 160, 4 + i * 1.5);
    // soft clouds
    ctx.fillStyle = 'rgba(255,190,200,0.35)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 400 - camX * 0.02) % (vw + 400) + vw + 400) % (vw + 400) - 200;
      const cy = 120 + (i % 3) * 70;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 140, 16, 0, 0, TAU);
      ctx.ellipse(cx + 60, cy - 10, 80, 14, 0, 0, TAU);
      ctx.fill();
    }
  } else if (th.id === 2) {
    // stars + moon
    for (const s of STARS) {
      const x = (((s.x * vw * 1.5 - camX * 0.01) % (vw * 1.5)) + vw * 1.5) % (vw * 1.5);
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.p));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, s.y, s.s, s.s);
    }
    const mx = vw * 0.78, my = 150;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, mx, my, 260, '#b58cff', 0.35);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff6e6';
    ctx.beginPath();
    ctx.arc(mx, my, 62, 0, TAU);
    ctx.fill();
    // soft terminator shading + subtle craters
    const mg = ctx.createRadialGradient(mx - 22, my - 22, 10, mx, my, 64);
    mg.addColorStop(0, 'rgba(255,255,255,0)');
    mg.addColorStop(1, 'rgba(190,160,220,0.45)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 62, 0, TAU);
    ctx.fill();
    for (const [cx2, cy2, r] of [[-22, -8, 9], [16, 20, 7], [24, -22, 5], [-6, 28, 4], [6, -6, 3.5]]) {
      ctx.fillStyle = 'rgba(205,185,225,0.5)';
      ctx.beginPath();
      ctx.arc(mx + cx2, my + cy2, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(mx + cx2 + r * 0.25, my + cy2 + r * 0.25, r * 0.7, 0, TAU);
      ctx.fill();
    }
    // a little star-shaped twinkle near the moon (☆)
    ctx.save();
    ctx.translate(mx - 120, my + 40);
    ctx.rotate(t * 0.5);
    starPath(ctx, 7 + Math.sin(t * 3) * 1.5);
    ctx.fillStyle = '#fff3b0';
    ctx.fill();
    ctx.restore();
  }

  // parallax layers with atmospheric fog between
  th.layers.forEach((L, i) => {
    const off = -(((camX * L.factor) % TILE) + TILE) % TILE;
    for (let x = off; x < vw; x += TILE) ctx.drawImage(L.c, Math.round(x), 0);
    if (i < th.layers.length - 1) {
      const fg = ctx.createLinearGradient(0, 200, 0, 640);
      fg.addColorStop(0, rgba(th.fog, 0));
      fg.addColorStop(1, rgba(th.fog, 0.28));
      ctx.fillStyle = fg;
      ctx.fillRect(0, 200, vw, 440);
    }
  });
}

/** Ground band from GY down to bottom. */
export function drawGround(ctx: CanvasRenderingContext2D, th: StageTheme, camX: number, vw: number, bottom: number, t: number) {
  const gy = GY;
  const g = ctx.createLinearGradient(0, gy, 0, gy + 140);
  g.addColorStop(0, th.groundFill);
  g.addColorStop(1, th.groundDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, gy, vw, bottom - gy);
  if (bottom > gy + 140) {
    ctx.fillStyle = th.groundDark;
    ctx.fillRect(0, gy + 140, vw, bottom - gy - 140);
  }
  const off = -((camX % 2000) + 2000) % 2000;
  if (th.id === 0) {
    // concrete slabs + grate + water channel
    ctx.fillStyle = th.groundTop;
    ctx.fillRect(0, gy, vw, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, gy, vw, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let x = off % 160; x < vw; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + 46);
      ctx.stroke();
    }
    ctx.fillStyle = '#1b2232';
    ctx.fillRect(0, gy + 46, vw, 8);
    // water channel
    const wg = ctx.createLinearGradient(0, gy + 54, 0, gy + 130);
    wg.addColorStop(0, '#1d4a4a');
    wg.addColorStop(1, '#0c1d22');
    ctx.fillStyle = wg;
    ctx.fillRect(0, gy + 54, vw, Math.max(80, bottom - gy - 54));
    ctx.strokeStyle = 'rgba(140,230,200,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const wx = ((i * 173 - camX * 1.0 + t * 30) % (vw + 200) + vw + 200) % (vw + 200) - 100;
      const wy = gy + 66 + (i % 4) * 14;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 20, wy - 3, wx + 40 + (i % 3) * 20, wy);
      ctx.stroke();
    }
    // green glow floating on water
    ctx.fillStyle = 'rgba(160,240,120,0.08)';
    ctx.fillRect(0, gy + 54, vw, 6);
  } else if (th.id === 1) {
    // sidewalk + curb + asphalt
    ctx.fillStyle = '#8a6a86';
    ctx.fillRect(0, gy, vw, 8);
    ctx.fillStyle = '#5a4060';
    ctx.fillRect(0, gy + 8, vw, 34);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let x = off % 90; x < vw; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 8);
      ctx.lineTo(x - 8, gy + 42);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a1e30';
    ctx.fillRect(0, gy + 42, vw, Math.max(100, bottom - gy - 42));
    ctx.fillStyle = '#e9c46a';
    for (let x = off % 220; x < vw; x += 220) ctx.fillRect(x, gy + 90, 110, 6);
    // puddle reflections of the sky
    for (let i = 0; i < 4; i++) {
      const px = ((i * 530 - camX) % (vw + 600) + vw + 600) % (vw + 600) - 300;
      const pg = ctx.createLinearGradient(0, gy + 52, 0, gy + 74);
      pg.addColorStop(0, 'rgba(255,190,150,0.45)');
      pg.addColorStop(1, 'rgba(200,110,150,0.15)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(px, gy + 62, 90, 9, 0, 0, TAU);
      ctx.fill();
    }
  } else {
    // rooftop ledge tiles with edge lights
    ctx.fillStyle = th.groundTop;
    ctx.fillRect(0, gy, vw, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, gy, vw, 2);
    ctx.fillStyle = '#3b2f78';
    ctx.fillRect(0, gy + 12, vw, 30);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    for (let x = off % 60; x < vw; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 12);
      ctx.lineTo(x, gy + 42);
      ctx.stroke();
    }
    for (let x = off % 240; x < vw; x += 240) {
      const c = ['#ff6fb5', '#6fe7ff'][Math.floor((x - off) / 240) % 2] ?? '#ff6fb5';
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x + 30, gy + 26, 26, c, 0.6 + 0.3 * Math.sin(t * 4 + x));
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = c;
      ctx.fillRect(x + 26, gy + 22, 8, 8);
    }
    // building face below with windows
    ctx.fillStyle = '#1a1442';
    ctx.fillRect(0, gy + 42, vw, Math.max(100, bottom - gy - 42));
    for (let x = off % 120; x < vw; x += 120) {
      ctx.fillStyle = 'rgba(255,220,150,0.25)';
      ctx.fillRect(x + 20, gy + 64, 30, 40);
      ctx.fillStyle = 'rgba(120,220,255,0.18)';
      ctx.fillRect(x + 70, gy + 64, 30, 40);
    }
  }
  // contact shadow line
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, gy - 2, vw, 2);
}

/** One-way platform look per stage. */
export function drawPlatform(ctx: CanvasRenderingContext2D, th: StageTheme, x: number, y: number, w: number) {
  if (th.id === 0) {
    // metal catwalk with railings & grate
    ctx.fillStyle = '#58647e';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = '#2c3447';
    ctx.fillRect(x, y + 10, w, 8);
    ctx.strokeStyle = '#1b2232';
    ctx.lineWidth = 2;
    for (let i = x + 6; i < x + w; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, y + 10);
      ctx.lineTo(i + 4, y + 18);
      ctx.stroke();
    }
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 18);
    // chains
    ctx.strokeStyle = '#3d4860';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 10, -100);
    ctx.moveTo(x + w - 10, y);
    ctx.lineTo(x + w - 10, -100);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (th.id === 1) {
    // dumpster-lid / awning: striped awning
    ctx.fillStyle = '#3a1c2a';
    ctx.fillRect(x + 8, y + 12, 6, 30);
    ctx.fillRect(x + w - 14, y + 12, 6, 30);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 2);
    ctx.lineTo(x + w + 6, y + 2);
    ctx.lineTo(x + w, y + 22);
    ctx.lineTo(x, y + 22);
    ctx.closePath();
    ctx.clip();
    for (let i = x - 10; i < x + w + 10; i += 20) {
      ctx.fillStyle = (Math.floor((i - x) / 20) & 1) === 0 ? '#ff7a9a' : '#fff1f4';
      ctx.fillRect(i, y, 20, 24);
    }
    ctx.restore();
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 2);
    ctx.lineTo(x + w + 6, y + 2);
    ctx.lineTo(x + w, y + 22);
    ctx.lineTo(x, y + 22);
    ctx.closePath();
    ctx.stroke();
    // scalloped edge
    ctx.fillStyle = '#ff7a9a';
    for (let i = x; i < x + w; i += 20) {
      ctx.beginPath();
      ctx.arc(i + 10, y + 22, 10, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // neon-lit floating ledge
    ctx.fillStyle = '#2e2566';
    ctx.fillRect(x, y, w, 16);
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(0, y - 6, 0, y + 30);
    lg.addColorStop(0, 'rgba(111,231,255,0)');
    lg.addColorStop(0.3, 'rgba(111,231,255,0.5)');
    lg.addColorStop(1, 'rgba(111,231,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x - 10, y - 6, w + 20, 36);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#6fe7ff';
    ctx.fillRect(x, y, w, 3);
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 16);
  }
}

/** Decorative non-colliding props at ground level (variety!). */
export type DecorKind =
  | 'barrel'
  | 'crate'
  | 'mushroom'
  | 'sign'
  | 'cone'
  | 'trash'
  | 'hydrant'
  | 'plant'
  | 'vending'
  | 'cat'
  | 'lamp'
  | 'vent'
  | 'neonarrow'
  | 'bench';

export const DECOR_BY_STAGE: DecorKind[][] = [
  ['barrel', 'crate', 'mushroom', 'sign', 'barrel', 'mushroom', 'lamp'],
  ['cone', 'trash', 'hydrant', 'plant', 'vending', 'cat', 'lamp', 'bench'],
  ['vent', 'plant', 'neonarrow', 'crate', 'cat', 'lamp', 'bench'],
];

export function drawDecor(ctx: CanvasRenderingContext2D, kind: DecorKind, x: number, gy: number, t: number, seed: number) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = OL;
  switch (kind) {
    case 'barrel': {
      const c = ['#3f6d8a', '#8a3f4a', '#3f8a5a'][seed % 3];
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.quadraticCurveTo(-28, -32, -22, -64);
      ctx.lineTo(22, -64);
      ctx.quadraticCurveTo(28, -32, 22, 0);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-26, -48, 52, 6);
      ctx.fillRect(-26, -18, 52, 6);
      ctx.fillStyle = '#f5c531';
      ctx.beginPath();
      ctx.arc(0, -33, 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = OL;
      ctx.font = 'bold 10px Fredoka';
      ctx.textAlign = 'center';
      ctx.fillText('☢', 0, -29);
      // green ooze
      ctx.fillStyle = '#9ad85a';
      ctx.beginPath();
      ctx.ellipse(6, -64, 14, 4, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'crate': {
      ctx.beginPath();
      ctx.rect(-28, -56, 56, 56);
      ctx.fillStyle = '#a8743f';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#6b4520';
      ctx.lineWidth = 4;
      ctx.strokeRect(-24, -52, 48, 48);
      ctx.beginPath();
      ctx.moveTo(-24, -52);
      ctx.lineTo(24, -4);
      ctx.stroke();
      break;
    }
    case 'mushroom': {
      for (let i = 0; i < 3; i++) {
        const mx = i * 16 - 16, h = 14 + ((seed + i) % 3) * 8;
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(mx - 2.5, -h, 5, h);
        ctx.beginPath();
        ctx.ellipse(mx, -h, 10, 7, 0, Math.PI, TAU);
        ctx.fillStyle = '#7fd65a';
        ctx.fill();
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, mx, -h - 2, 20, '#b6ee6c', 0.35 + 0.15 * Math.sin(t * 3 + i));
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    }
    case 'sign': {
      ctx.fillStyle = '#4a4a55';
      ctx.fillRect(-3, -70, 6, 70);
      ctx.beginPath();
      ctx.moveTo(0, -110);
      ctx.lineTo(32, -78);
      ctx.lineTo(0, -46);
      ctx.lineTo(-32, -78);
      ctx.closePath();
      ctx.fillStyle = '#f5c531';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = OL;
      ctx.font = '900 20px "Lilita One"';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -70);
      ctx.font = 'bold 8px Fredoka';
      ctx.fillText('MOLD', 0, -58);
      break;
    }
    case 'cone': {
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-5, -44);
      ctx.lineTo(5, -44);
      ctx.lineTo(16, 0);
      ctx.closePath();
      ctx.fillStyle = '#ff7a2a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-10, -26, 20, 6);
      ctx.fillStyle = '#d95a1a';
      ctx.fillRect(-20, -4, 40, 4);
      break;
    }
    case 'trash': {
      ctx.beginPath();
      ctx.ellipse(-12, -20, 22, 20, 0, 0, TAU);
      ctx.fillStyle = '#2a2a3a';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(16, -16, 18, 16, 0, 0, TAU);
      ctx.fillStyle = '#3a3a52';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(-18, -28, 6, 3, -0.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'hydrant': {
      ctx.fillStyle = '#d93a3a';
      ctx.beginPath();
      ctx.rect(-12, -46, 24, 46);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -46, 13, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(-20, -34, 40, 10);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'plant': {
      ctx.fillStyle = '#b5543a';
      ctx.beginPath();
      ctx.moveTo(-16, -30);
      ctx.lineTo(16, -30);
      ctx.lineTo(12, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4fae5a';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.45 + Math.sin(t * 2 + i) * 0.05;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 18, -30 + Math.sin(a) * 18, 7, 16, a + Math.PI / 2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'vending': {
      ctx.beginPath();
      ctx.rect(-30, -120, 60, 120);
      ctx.fillStyle = '#e8456a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bfe8ff';
      ctx.fillRect(-24, -110, 34, 70);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, -7, -75, 50, '#9fdcff', 0.35);
      ctx.globalCompositeOperation = 'source-over';
      const cols = ['#7ed957', '#ffd84a', '#ff8fd4', '#6fe7ff'];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        ctx.fillStyle = cols[(r + c) % 4];
        ctx.fillRect(-21 + c * 11, -106 + r * 17, 7, 12);
      }
      ctx.fillStyle = '#2a1420';
      ctx.fillRect(14, -100, 10, 4);
      ctx.fillRect(-24, -30, 48, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Fredoka';
      ctx.fillText('PICKLE', -22, -116 + 112);
      break;
    }
    case 'cat': {
      // a regular (fluffy!) alley cat silhouette that blinks, for contrast with binguses
      ctx.fillStyle = '#1a1220';
      ctx.beginPath();
      ctx.ellipse(0, -14, 16, 14, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-10, -30, 10, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18, -36);
      ctx.lineTo(-16, -48);
      ctx.lineTo(-10, -38);
      ctx.moveTo(-6, -38);
      ctx.lineTo(-2, -48);
      ctx.lineTo(0, -34);
      ctx.fill();
      ctx.strokeStyle = '#1a1220';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(14, -8);
      ctx.quadraticCurveTo(30, -20, 24 + Math.sin(t * 2 + seed) * 6, -40);
      ctx.stroke();
      if (Math.sin(t * 0.7 + seed) < 0.95) {
        ctx.fillStyle = '#f2e24a';
        ctx.beginPath();
        ctx.ellipse(-14, -31, 2.4, 3, 0, 0, TAU);
        ctx.ellipse(-6, -31, 2.4, 3, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'lamp': {
      ctx.fillStyle = '#2a2236';
      ctx.fillRect(-4, -190, 8, 190);
      ctx.fillRect(-4, -190, 40, 6);
      ctx.fillStyle = '#3a3048';
      ctx.beginPath();
      ctx.moveTo(22, -186);
      ctx.lineTo(48, -186);
      ctx.lineTo(42, -174);
      ctx.lineTo(28, -174);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 35, -170, 80, '#ffd08a', 0.45);
      const cg = ctx.createLinearGradient(0, -174, 0, 0);
      cg.addColorStop(0, 'rgba(255,210,140,0.22)');
      cg.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(28, -174);
      ctx.lineTo(42, -174);
      ctx.lineTo(110, 0);
      ctx.lineTo(-40, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'vent': {
      ctx.beginPath();
      ctx.rect(-26, -46, 52, 46);
      ctx.fillStyle = '#4a3a82';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-32, -46);
      ctx.lineTo(0, -70);
      ctx.lineTo(32, -46);
      ctx.closePath();
      ctx.fillStyle = '#5b4a9a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a2058';
      for (let i = 0; i < 4; i++) ctx.fillRect(-20, -40 + i * 9, 40, 4);
      break;
    }
    case 'neonarrow': {
      ctx.fillStyle = '#20183f';
      ctx.fillRect(-3, -100, 6, 100);
      ctx.save();
      ctx.translate(0, -118);
      ctx.globalCompositeOperation = 'lighter';
      const on = Math.sin(t * 6 + seed) > -0.7;
      ctx.shadowColor = '#ff4fa3';
      ctx.shadowBlur = on ? 18 : 0;
      ctx.strokeStyle = on ? '#ff6fb5' : '#5a2a48';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(24, 0);
      ctx.moveTo(10, -14);
      ctx.lineTo(26, 0);
      ctx.lineTo(10, 14);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = '12px "Lilita One"';
      ctx.textAlign = 'center';
      ctx.fillText('HOME →', 0, -92);
      break;
    }
    case 'bench': {
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath();
      ctx.rect(-44, -30, 88, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(-44, -56, 88, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a2236';
      ctx.fillRect(-38, -48, 5, 48);
      ctx.fillRect(33, -48, 5, 48);
      break;
    }
  }
  ctx.restore();
}
