import { TAU, clamp, easeOutBack, makeCanvas } from './util';
import { defaultPose, drawAstray, type Pose } from './art/character';
import { drawBingus, drawMayoJar, drawMold, drawRiceBowl, starPath, BINGUS_SKINS, BINGUS_EYES, ACC_COLORS, type BingusLook } from './art/things';
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

let OUTFIT = 'maid';

export function drawEndingScene(ctx: CanvasRenderingContext2D, kind: EndKind, vw: number, vh: number, t: number, outfit = 'maid') {
  OUTFIT = outfit;
  const cx = vw * (vw > vh ? 0.3 : 0.5);
  const floor = vw > vh ? vh * 0.82 : vh * 0.5;
  const s = clamp(Math.min(vw, vh) / 300, 1.6, 3.2);
  if (kind === 'win') drawWin(ctx, vw, vh, t, cx, floor, s);
  else if (kind === 'molded') drawMolded(ctx, vw, vh, t, cx, floor, s);
  else if (kind === 'secret') drawSecret(ctx, vw, vh, t, cx, floor, s);
  else if (kind === 'furry') drawFurry(ctx, vw, vh, t, cx, floor, s);
  else if (kind === 'coma') drawComa(ctx, vw, vh, t, cx, floor, s);
  else drawMayo(ctx, vw, vh, t, cx, floor, s);
}

const maidish = (o: string) => (o === 'regular' ? 'maid' : o);

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
    pose.outfit = maidish(OUTFIT);
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
  const pose = { ...defaultPose(), t, expr: 'panic' as const, stumble: 1, outfit: OUTFIT };
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
  const pose = { ...defaultPose(), t, expr: 'blank' as const, mayo: 1, slide: 0.55, outfit: OUTFIT };
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


function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 10, r / 10);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-12, -2, -8, -12, 0, -5);
  ctx.bezierCurveTo(8, -12, 12, -2, 0, 6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Secret ending: a private dressing room — he secretly loves the outfit. */
function drawSecret(ctx: CanvasRenderingContext2D, vw: number, vh: number, t: number, cx: number, floor: number, s: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, floor);
  wall.addColorStop(0, '#ffd0ea');
  wall.addColorStop(1, '#f7a8d0');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, vw, floor);
  // heart wallpaper
  for (let y = 30; y < floor - 10; y += 64)
    for (let x = ((y / 64) % 2) * 40 + 20; x < vw; x += 80) heart(ctx, x, y, 7, 'rgba(255,255,255,0.45)');
  const fl = ctx.createLinearGradient(0, floor, 0, vh);
  fl.addColorStop(0, '#c98aa8');
  fl.addColorStop(1, '#8e5a78');
  ctx.fillStyle = fl;
  ctx.fillRect(0, floor, vw, vh - floor);
  // clothes rack with dresses in the back
  const rx = vw * 0.04;
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(rx, floor * 0.3);
  ctx.lineTo(rx + vw * 0.16, floor * 0.3);
  ctx.stroke();
  const cols = ['#211c2e', '#8fc4f0', '#f59cbe', '#a99ae0', '#e8c62f'];
  cols.forEach((c, i) => {
    const dx = rx + 14 + i * (vw * 0.16 - 20) / 4;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(dx - 8, floor * 0.3 + 6);
    ctx.lineTo(dx + 8, floor * 0.3 + 6);
    ctx.lineTo(dx + 16, floor * 0.3 + 90);
    ctx.lineTo(dx - 16, floor * 0.3 + 90);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(dx - 5, floor * 0.3 + 22, 10, 50);
  });
  // vanity mirror with reflection
  const mx = cx + 115 * s * 0.6, my = floor - 105 * s * 0.6;
  const mw = 70 * s * 0.6, mh = 105 * s * 0.6;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(mx, my, mw, mh, 0, 0, TAU);
  ctx.fillStyle = '#e9f4ff';
  ctx.fill();
  ctx.clip();
  const mg = ctx.createLinearGradient(mx - mw, my - mh, mx + mw, my + mh);
  mg.addColorStop(0, '#f4f9ff');
  mg.addColorStop(1, '#cfe0f2');
  ctx.fillStyle = mg;
  ctx.fillRect(mx - mw, my - mh, mw * 2, mh * 2);
  ctx.globalAlpha = 0.85;
  const rpose = { ...defaultPose(), t, expr: 'happy' as const, outfit: maidish(OUTFIT), wave: 1 };
  drawAstray(ctx, mx + 10, floor + 30, rpose, s * 0.95, -1);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(mx - mw * 0.6, my - mh);
  ctx.lineTo(mx - mw * 0.2, my - mh);
  ctx.lineTo(mx - mw * 0.9, my + mh);
  ctx.lineTo(mx - mw * 1.3, my + mh);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#e8b84a';
  ctx.beginPath();
  ctx.ellipse(mx, my, mw, mh, 0, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a1420';
  ctx.stroke();
  // Astray twirling, blushing
  const pose = { ...defaultPose(), t, expr: 'happy' as const, outfit: maidish(OUTFIT), wave: 1 };
  ctx.save();
  ctx.translate(cx, floor);
  const tw = Math.sin(t * 2.5) * 0.06;
  ctx.rotate(tw);
  drawAstray(ctx, 0, 0, pose, s);
  ctx.restore();
  // extra blush + floating hearts and sparkles
  for (let i = 0; i < 14; i++) {
    const k = (t * 0.35 + i / 14) % 1;
    const hx = cx - 120 + ((i * 53) % 240);
    heart(ctx, hx + Math.sin(t * 2 + i) * 14, floor - 40 - k * floor * 0.8, 8 + (i % 3) * 4, `rgba(255,${100 + (i % 3) * 40},${170 + (i % 2) * 40},${1 - k})`);
  }
  for (let i = 0; i < 8; i++) {
    const a = t * 1.5 + i * 0.8;
    ctx.save();
    ctx.translate(mx + Math.cos(a) * mw * 1.15, my + Math.sin(a) * mh * 1.1);
    starPath(ctx, 5 + (i % 3) * 2);
    ctx.fillStyle = '#fff6b0';
    ctx.fill();
    ctx.restore();
  }
}

const furLook = (i: number, acc: BingusLook['acc']): BingusLook => ({
  ...BINGUS_SKINS[i % BINGUS_SKINS.length],
  eye: BINGUS_EYES[i % BINGUS_EYES.length],
  acc,
  accColor: ACC_COLORS[i % ACC_COLORS.length][0],
  accColor2: ACC_COLORS[i % ACC_COLORS.length][1],
});

/** Bonus ending: buried in binguses, cat ears and tail — secretly a furry. */
function drawFurry(ctx: CanvasRenderingContext2D, vw: number, vh: number, t: number, cx: number, floor: number, s: number) {
  const bg = ctx.createRadialGradient(cx, floor - 120, 40, cx, floor - 120, Math.max(vw, vh));
  bg.addColorStop(0, '#ffe0ef');
  bg.addColorStop(1, '#f59cbe');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, vw, vh);
  // paw-print pattern
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let y = 40; y < vh; y += 90)
    for (let x = ((y / 90) % 2) * 55 + 30; x < vw; x += 110) {
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 7, 0, 0, TAU);
      ctx.arc(x - 9, y - 10, 3.5, 0, TAU);
      ctx.arc(x - 3, y - 14, 3.5, 0, TAU);
      ctx.arc(x + 3, y - 14, 3.5, 0, TAU);
      ctx.arc(x + 9, y - 10, 3.5, 0, TAU);
      ctx.fill();
    }
  ctx.fillStyle = '#f2a7c6';
  ctx.fillRect(0, floor, vw, vh - floor);
  // binguses behind
  const st = (k: number) => ({ t: t + k, walk: 0, squash: 0, flying: false, spin: 0, dizzy: false });
  drawBingus(ctx, cx - 110 * s * 0.5, floor, 'walk', furLook(1, 'bow'), st(0.3), s * 0.75);
  drawBingus(ctx, cx + 120 * s * 0.5, floor, 'chonk', furLook(2, 'sweater'), st(0.7), s * 0.6);
  // Astray with ears + tail, happy wave
  const pose = { ...defaultPose(), t, expr: 'happy' as const, outfit: OUTFIT, ears: true, tail: true, wave: 1 };
  drawAstray(ctx, cx, floor, pose, s);
  // binguses in front / on top
  drawBingus(ctx, cx - 60 * s * 0.5, floor + 4, 'walk', furLook(3, 'hat'), st(1.1), s * 0.62);
  drawBingus(ctx, cx + 55 * s * 0.5, floor + 6, 'walk', furLook(0, 'bandana'), st(1.6), s * 0.58);
  ctx.save();
  ctx.translate(cx + 2 * s, floor - 147 * s);
  ctx.rotate(Math.sin(t * 2) * 0.08);
  drawBingus(ctx, 0, 0, 'walk', furLook(4, 'collar'), st(2), s * 0.42);
  ctx.restore();
  for (let i = 0; i < 12; i++) {
    const k = (t * 0.4 + i / 12) % 1;
    heart(ctx, cx - 160 + ((i * 61) % 320), floor - 60 - k * floor * 0.7, 8 + (i % 3) * 3, `rgba(255,120,170,${1 - k})`);
  }
}

/** Food coma: stuffed with brothy rice, fast asleep on the floor. */
function drawComa(ctx: CanvasRenderingContext2D, vw: number, vh: number, t: number, cx: number, floor: number, s: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, floor);
  wall.addColorStop(0, '#2c2348');
  wall.addColorStop(1, '#4a3a6a');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, vw, floor);
  // warm lamp glow
  ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createRadialGradient(cx + 40, floor - 40, 20, cx + 40, floor - 40, 420);
  lg.addColorStop(0, 'rgba(255,190,120,0.45)');
  lg.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, vw, vh);
  ctx.globalCompositeOperation = 'source-over';
  // window with moon
  ctx.fillStyle = '#141032';
  const wx = vw * 0.68, wy = floor * 0.18, ww = Math.min(220, vw * 0.22);
  ctx.fillRect(wx, wy, ww, ww * 0.8);
  ctx.fillStyle = '#fff6e6';
  ctx.beginPath();
  ctx.arc(wx + ww * 0.7, wy + ww * 0.25, ww * 0.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8a7ab0';
  ctx.lineWidth = 6;
  ctx.strokeRect(wx, wy, ww, ww * 0.8);
  // tatami floor
  ctx.fillStyle = '#b8a46a';
  ctx.fillRect(0, floor, vw, vh - floor);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  for (let x = 0; x < vw; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, floor);
    ctx.lineTo(x, vh);
    ctx.stroke();
  }
  // low table with a tower of empty bowls
  const tx = cx + 150 * s * 0.6;
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(tx - 70, floor - 34, 140, 12);
  ctx.fillRect(tx - 60, floor - 22, 10, 22);
  ctx.fillRect(tx + 50, floor - 22, 10, 22);
  for (let i = 0; i < 4; i++) drawRiceBowl(ctx, tx - 6 + (i % 2) * 6, floor - 46 - i * 20, 1.3, t + i);
  // chopsticks
  ctx.strokeStyle = '#d9a24a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx + 30, floor - 38);
  ctx.lineTo(tx + 70, floor - 60);
  ctx.moveTo(tx + 34, floor - 36);
  ctx.lineTo(tx + 74, floor - 54);
  ctx.stroke();
  // Astray, lying on his back, very full, fast asleep
  const pose = { ...defaultPose(), t, expr: 'idle' as const, outfit: OUTFIT, belly: 1, blink: 1 };
  ctx.save();
  ctx.translate(cx + 75 * s, floor - 17 * s);
  ctx.rotate(-Math.PI / 2);
  const breathe = 1 + Math.sin(t * 2.2) * 0.015;
  ctx.scale(breathe, 1);
  drawAstray(ctx, 0, 0, pose, s);
  ctx.restore();
  // Zzz
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.45 + i / 3) % 1;
    ctx.save();
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.font = `${22 + k * 26}px "Lilita One", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#2a1420';
    ctx.lineJoin = 'round';
    const zx = cx - 60 * s + k * 90, zy = floor - 50 * s - k * 120;
    ctx.strokeText('Z', zx, zy);
    ctx.fillText('Z', zx, zy);
    ctx.restore();
  }
}
