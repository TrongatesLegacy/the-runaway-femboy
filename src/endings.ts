import { TAU, clamp, easeOutBack, makeCanvas } from './util';
import { defaultPose, drawAstray, type Pose } from './art/character';
import { drawBingus, drawMayoJar, drawMold, starPath } from './art/things';
import type { EndKind } from './game';

const confetti = Array.from({ length: 90 }, (_, i) => ({
  x: Math.random(),
  y: Math.random(),
  s: 6 + Math.random() * 8,
  sp: 60 + Math.random() * 90,
  r: Math.random() * TAU,
  c: ['#ff6fae', '#ffd84a', '#6fe7ff', '#9cf06a', '#c48bff', '#ffffff'][i % 6],
}));

let tintBuf: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;

/** Draw the character tinted (for the mold ending). */
function drawTinted(ctx: CanvasRenderingContext2D, x: number, y: number, pose: Pose, s: number, color: string, amt: number) {
  if (!tintBuf) tintBuf = makeCanvas(420, 520);
  const b = tintBuf.ctx;
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.clearRect(0, 0, 420, 520);
  drawAstray(b, 210, 480, pose, s);
  b.globalCompositeOperation = 'source-atop';
  b.globalAlpha = amt;
  b.fillStyle = color;
  b.fillRect(0, 0, 420, 520);
  b.globalAlpha = 1;
  b.globalCompositeOperation = 'source-over';
  ctx.drawImage(tintBuf.c, x - 210, y - 480);
}

export function drawEndingScene(ctx: CanvasRenderingContext2D, kind: EndKind, vw: number, vh: number, t: number) {
  const cx = vw * (vw > vh ? 0.3 : 0.5);
  const floor = vw > vh ? vh * 0.82 : vh * 0.5;
  const s = clamp(Math.min(vw, vh) / 300, 1.6, 3.2);
  if (kind === 'win') drawWin(ctx, vw, vh, t, cx, floor, s);
  else if (kind === 'molded') drawMolded(ctx, vw, vh, t, cx, floor, s);
  else drawMayo(ctx, vw, vh, t, cx, floor, s);
}

function drawWin(ctx: CanvasRenderingContext2D, vw: number, vh: number, t: number, cx: number, floor: number, s: number) {
  // cozy bedroom
  const wall = ctx.createLinearGradient(0, 0, 0, floor);
  wall.addColorStop(0, '#ffd9e8');
  wall.addColorStop(1, '#f7b8d2');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, vw, floor);
  // wallpaper stars
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let y = 30; y < floor - 20; y += 70) {
    for (let x = ((y / 70) % 2) * 45 + 20; x < vw; x += 90) {
      ctx.save();
      ctx.translate(x, y);
      starPath(ctx, 8);
      ctx.fill();
      ctx.restore();
    }
  }
  // floor
  const fl = ctx.createLinearGradient(0, floor, 0, vh);
  fl.addColorStop(0, '#b9785a');
  fl.addColorStop(1, '#7a4a38');
  ctx.fillStyle = fl;
  ctx.fillRect(0, floor, vw, vh - floor);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let x = 0; x < vw; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, floor);
    ctx.lineTo(x - 60, vh);
    ctx.stroke();
  }
  // rug
  ctx.fillStyle = '#ff8fb8';
  ctx.beginPath();
  ctx.ellipse(cx, floor + 12, 150 * s * 0.5, 22 * s * 0.5, 0, 0, TAU);
  ctx.fill();
  // window with night sky
  const wx = vw * 0.62, wy = floor * 0.18, ww = Math.min(260, vw * 0.25), wh = ww * 0.9;
  ctx.fillStyle = '#1b1446';
  ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = '#fff6e6';
  ctx.beginPath();
  ctx.arc(wx + ww * 0.7, wy + wh * 0.3, ww * 0.12, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))})`;
    ctx.fillRect(wx + ((i * 47) % ww), wy + ((i * 31) % wh), 2, 2);
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2);
  ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.lineWidth = 5;
  ctx.stroke();
  // fairy lights
  for (let i = 0; i <= 20; i++) {
    const k = i / 20;
    const lx = k * vw;
    const ly = 26 + Math.sin(k * Math.PI * 3) * 14;
    const c = ['#ffe66b', '#ff6fae', '#6fe7ff'][i % 3];
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 20);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i);
    ctx.fillStyle = g;
    ctx.fillRect(lx - 20, ly - 20, 40, 40);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, TAU);
    ctx.fill();
  }
  // wardrobe with the maid outfit hung up
  const ax = cx - 130 * s * 0.5 - 140;
  if (ax > -60) {
    ctx.fillStyle = '#9b5a3a';
    ctx.fillRect(ax, floor - 260, 150, 260);
    ctx.strokeStyle = '#2a1420';
    ctx.lineWidth = 3;
    ctx.strokeRect(ax, floor - 260, 150, 260);
    ctx.fillStyle = '#5a2f22';
    ctx.fillRect(ax + 10, floor - 250, 130, 200);
    // hanger + dress
    ctx.strokeStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(ax + 50, floor - 228);
    ctx.lineTo(ax + 75, floor - 240);
    ctx.lineTo(ax + 100, floor - 228);
    ctx.stroke();
    ctx.fillStyle = '#211c2e';
    ctx.beginPath();
    ctx.moveTo(ax + 58, floor - 228);
    ctx.lineTo(ax + 92, floor - 228);
    ctx.lineTo(ax + 112, floor - 140);
    ctx.lineTo(ax + 38, floor - 140);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fdfbff';
    ctx.fillRect(ax + 64, floor - 210, 22, 64);
    ctx.fillStyle = '#d4283f';
    ctx.fillRect(ax + 70, floor - 226, 10, 6);
  }

  // transformation: first second = maid spin + sparkles, then regular
  const trans = clamp(t / 1.1, 0, 1);
  const pose = { ...defaultPose(), t, expr: 'happy' as const };
  if (trans < 1) {
    pose.outfit = 'maid';
    pose.spin = 0;
    ctx.save();
    ctx.translate(cx, floor);
    ctx.scale(Math.cos(t * 14), 1);
    drawAstray(ctx, 0, 0, pose, s);
    ctx.restore();
    for (let i = 0; i < 10; i++) {
      const a = t * 6 + i * 0.63;
      const r = 70 * s * 0.5 + i * 3;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, floor - 70 * s * 0.5 + Math.sin(a) * r * 0.6);
      starPath(ctx, 6 + (i % 3) * 2);
      ctx.fillStyle = ['#ffe66b', '#ff9fe0', '#9fe8ff'][i % 3];
      ctx.fill();
      ctx.restore();
    }
  } else {
    pose.outfit = 'regular';
    pose.wave = 1;
    const pop = easeOutBack(clamp((t - 1.1) / 0.4, 0, 1));
    ctx.save();
    ctx.translate(cx, floor);
    ctx.scale(pop, pop);
    drawAstray(ctx, 0, 0, pose, s);
    ctx.restore();
    // flash
    const fk = clamp(1 - (t - 1.1) / 0.35, 0, 1);
    if (fk > 0) {
      ctx.fillStyle = `rgba(255,255,255,${fk})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    // confetti
    for (const c of confetti) {
      const yy = ((c.y * vh + (t - 1.1) * c.sp) % (vh + 40)) - 20;
      ctx.save();
      ctx.translate(c.x * vw + Math.sin(t * 2 + c.r) * 20, yy);
      ctx.rotate(c.r + t * 3);
      ctx.scale(1, Math.cos(t * 4 + c.r));
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2);
      ctx.restore();
    }
  }
}

function drawMolded(ctx: CanvasRenderingContext2D, vw: number, vh: number, t: number, cx: number, floor: number, s: number) {
  const bg = ctx.createRadialGradient(cx, floor - 100, 40, cx, floor - 100, Math.max(vw, vh));
  bg.addColorStop(0, '#2f5a2a');
  bg.addColorStop(1, '#050d06');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, vw, vh);
  // the mold wraps around from the left
  const edge = cx + 60 * s + Math.sin(t) * 10;
  drawMold(ctx, edge, -40, vh + 40, floor, t, 1, floor - 100);
  // spores
  for (let i = 0; i < 50; i++) {
    const x = (i * 97 + t * 30 * (1 + (i % 3))) % vw;
    const y = (i * 53 - t * 20 * (1 + (i % 4))) % vh;
    ctx.fillStyle = `rgba(180,240,110,${0.3 + 0.3 * Math.sin(t * 2 + i)})`;
    ctx.beginPath();
    ctx.arc(x, (y + vh) % vh, 2 + (i % 3), 0, TAU);
    ctx.fill();
  }
  // Astray, fuzzy and green, stuck in the mold
  const pose = { ...defaultPose(), t, expr: 'panic' as const, stumble: 1 };
  const amt = clamp(t / 1.5, 0, 0.55);
  ctx.save();
  ctx.translate(cx, floor);
  ctx.rotate(-0.12 + Math.sin(t * 3) * 0.04);
  drawTinted(ctx, 0, 0, pose, s * 0.92, '#5fae3a', amt);
  ctx.restore();
  // mold creeping up over the feet (soft lumpy mound)
  for (let i = 0; i < 9; i++) {
    const bx = cx - 120 + i * 30;
    const r = 34 + Math.sin(i * 1.7 + t * 1.5) * 6 + (4 - Math.abs(i - 4)) * 6;
    const mg = ctx.createRadialGradient(bx - r * 0.3, floor - r * 0.4, 2, bx, floor, r);
    mg.addColorStop(0, '#7fc24a');
    mg.addColorStop(0.6, '#2d6a2a');
    mg.addColorStop(1, '#163a1c');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(bx, floor + 6, r, Math.PI, TAU);
    ctx.fill();
  }
  const fg = ctx.createLinearGradient(0, floor + 10, 0, vh);
  fg.addColorStop(0, '#1d4a1c');
  fg.addColorStop(1, '#050d06');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, vh);
  for (let x = 0; x <= vw; x += 16) ctx.lineTo(x, floor + 14 + Math.sin(x * 0.07 + t) * 4 + Math.sin(x * 0.23) * 3);
  ctx.lineTo(vw, vh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(170,230,110,0.5)';
  ctx.lineWidth = 2;
  for (let x = 6; x < vw; x += 11) {
    const y = floor + 14 + Math.sin(x * 0.07 + t) * 4 + Math.sin(x * 0.23) * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(x + t * 2) * 3, y - 6 - (x % 7));
    ctx.stroke();
  }
}

function drawMayo(ctx: CanvasRenderingContext2D, vw: number, vh: number, t: number, cx: number, floor: number, s: number) {
  // kitchen-ish pastel background
  const bg = ctx.createLinearGradient(0, 0, 0, vh);
  bg.addColorStop(0, '#fff3c9');
  bg.addColorStop(1, '#ffd88a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, vw, vh);
  // checker tiles
  for (let y = 0; y < floor; y += 48)
    for (let x = ((y / 48) % 2) * 48; x < vw; x += 96) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x, y, 48, 48);
    }
  ctx.fillStyle = '#e8c070';
  ctx.fillRect(0, floor, vw, vh - floor);
  // giant tipped jar pouring onto Astray's head
  const headX = cx - 26 * s, headY = floor - 92 * s;
  const jx = cx + 70 * s, jy = floor - 175 * s;
  const ang = -2.3;
  const lipR = 34 * s * 0.75;
  const lipX = jx + Math.sin(ang) * lipR, lipY = jy - Math.cos(ang) * lipR;
  // stream (behind the character)
  const sw = 5 * s + Math.sin(t * 9) * 2;
  const sg = ctx.createLinearGradient(lipX, lipY, headX, headY);
  sg.addColorStop(0, '#fffdf2');
  sg.addColorStop(1, '#fff3c8');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(lipX - sw, lipY);
  ctx.quadraticCurveTo(lipX - 30 * s * 0.5, (lipY + headY) / 2, headX - sw, headY);
  ctx.lineTo(headX + sw * 1.4, headY);
  ctx.quadraticCurveTo(lipX - 18 * s * 0.5, (lipY + headY) / 2, lipX + sw, lipY);
  ctx.closePath();
  ctx.fill();
  // puddle
  ctx.beginPath();
  ctx.ellipse(cx, floor + 6, 200 * s * 0.6, 26 * s * 0.6, 0, 0, TAU);
  ctx.fillStyle = '#fff9e4';
  ctx.fill();
  ctx.strokeStyle = '#d9c47a';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Astray sitting, blank stare, covered
  const pose = { ...defaultPose(), t, expr: 'blank' as const, mayo: 1, slide: 0.55 };
  drawAstray(ctx, cx, floor + 4, pose, s);
  // splash where the stream lands
  ctx.fillStyle = '#fffdf2';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45;
    const k = (t * 2.2 + i * 0.17) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.arc(headX + Math.cos(a) * k * 40, headY - 10 + Math.sin(a) * k * 30 + k * k * 40, 4 + (1 - k) * 3, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(jx, jy);
  ctx.rotate(ang);
  drawMayoJar(ctx, 0, 0, 0, s * 0.75);
  ctx.restore();
  // a smug bingus watching
  const bx = cx - 150 * s * 0.6;
  if (bx > 40)
    drawBingus(ctx, bx, floor + 2, 'walk', { skin: '#f4bfb0', shade: '#dc9a8b', inner: '#f08a9a', eye: '#b8e04a', acc: 'bow', accColor: '#e8455f', accColor2: '#ffd1da' }, { t, walk: 0, squash: 0, flying: false, spin: 0, dizzy: false }, s * 0.7);
  // drips falling from top
  for (let i = 0; i < 8; i++) {
    const x = (i * 173) % vw;
    const k = ((t * 0.6 + i * 0.37) % 1);
    ctx.fillStyle = '#fff9e4';
    ctx.beginPath();
    ctx.ellipse(x, k * vh, 6, 10, 0, 0, TAU);
    ctx.fill();
  }
  // big drip curtain at top
  ctx.fillStyle = '#fff9e4';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= vw; x += 30) ctx.lineTo(x, 20 + Math.abs(Math.sin(x * 0.05 + 1)) * 40 + Math.sin(t * 2 + x) * 4);
  ctx.lineTo(vw, 0);
  ctx.fill();
  void easeOutBack;
}
