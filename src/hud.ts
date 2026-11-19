import { TAU, clamp, easeOutBack, easeOutCubic, roundRect } from './util';
import { drawAstrayHead } from './art/character';
import { drawPear, drawPickle, starPath, POWER_COLORS, type PowerKind } from './art/things';
import { drawPie } from './art/character';
import { END_X, STAGE_START, type Game } from './game';

const OL = '#2a1420';

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 18) {
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(36,22,58,0.78)');
  g.addColorStop(1, 'rgba(22,12,40,0.78)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, c0: string, c1: string, pulse = 0) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  if (v > 0.001) {
    roundRect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * v), h - 4, (h - 4) / 2);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, x + 6, y + 3, Math.max(0, (w - 12) * v - 4), (h - 4) * 0.32, 3);
    ctx.fill();
  }
  if (pulse > 0) {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(255,120,140,${pulse})`;
    ctx.stroke();
  }
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', font = 'Lilita One', stroke = 0.2) {
  ctx.font = `${size}px "${font}", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * stroke;
    ctx.strokeStyle = OL;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(2, -11);
  ctx.lineTo(-7, 2);
  ctx.lineTo(-1, 2);
  ctx.lineTo(-3, 11);
  ctx.lineTo(7, -3);
  ctx.lineTo(1, -3);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.restore();
}

function jarIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  roundRect(ctx, -8, -8, 16, 18, 4);
  ctx.fillStyle = '#fff7d8';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.fillStyle = '#2f5fd0';
  ctx.fillRect(-8, -1, 16, 6);
  ctx.fillRect(-6, -12, 12, 5);
  ctx.strokeRect(-6, -12, 12, 5);
  ctx.restore();
}

export const HINTS: Record<string, { touch: string; keys: string; label: string }> = {
  jump: { touch: 'Tap  ▲', keys: 'SPACE / ▲', label: 'to JUMP the pipe' },
  slide: { touch: 'Hold  ▼', keys: 'Hold ▼ / S', label: 'to SLIDE under' },
  stomp: { touch: 'Jump on', keys: 'Jump on', label: 'binguses to stomp them' },
  mayo: { touch: 'Avoid', keys: 'Avoid', label: 'MAYO — too much and it\'s over' },
  double: { touch: 'Tap ▲ twice', keys: 'Press ▲ twice', label: 'to DOUBLE JUMP' },
  slap: { touch: 'Tap  🥧', keys: 'X / F', label: 'to SLAP with the pie' },
  dash: { touch: 'Hold  ⚡', keys: 'Hold SHIFT / ►', label: 'to DASH away from the mold' },
};

export function drawHud(ctx: CanvasRenderingContext2D, g: Game, touch: boolean, safeTop: number, rightReserve: number) {
  const v = g.view;
  const p = g.p;
  const t = g.t;
  const top = 14 + safeTop;
  const compact = v.vw < 1150;
  const narrow = v.vw < 980; // portrait phones: progress track drops to a second row
  const rowY = narrow ? top + 92 : top; // progress row
  const below = narrow ? top + 92 + 64 : top + 92; // first free y under the HUD

  // ---- left panel: stamina + mayo ----
  const lx = 18, lw = narrow ? Math.min(300, v.vw - 36 - rightReserve - 190) : compact ? 250 : 300;
  panel(ctx, lx, top, lw, 78);
  const pk = p.pickle > 0;
  bolt(ctx, lx + 24, top + 24, 1.05, pk ? '#9cf06a' : '#ffd84a');
  bar(ctx, lx + 44, top + 14, lw - 58, 20, p.stamina, pk ? '#6fd64a' : '#ffb000', pk ? '#d8ff8a' : '#fff07a');
  jarIcon(ctx, lx + 24, top + 55);
  const m = p.mayo / 100;
  const pulse = m > 0.6 ? 0.5 + 0.5 * Math.sin(t * 10) : 0;
  bar(ctx, lx + 44, top + 45, lw - 58, 20, m, '#f2e2a8', '#fffbe8', pulse);
  if (m > 0.6) text(ctx, 'MAYO!', lx + lw - 20, top + 55, 14, '#ff8fa3', 'right', 'Lilita One', 0.25);

  // ---- power timers ----
  const pows: [PowerKind, number, number][] = [
    ['pickle', p.pickle, 6],
    ['pie', p.pie, 10],
    ['pear', p.pear, 6],
  ];
  let px = lx + 30;
  for (const [k, rem, max] of pows) {
    if (rem <= 0) continue;
    const y = below + 26;
    const blink = rem < 1.5 && Math.floor(t * 8) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.5 : 1;
    ctx.beginPath();
    ctx.arc(px, y, 26, 0, TAU);
    ctx.fillStyle = 'rgba(22,12,40,0.8)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, y, 26, -Math.PI / 2, -Math.PI / 2 + TAU * (rem / max));
    ctx.strokeStyle = POWER_COLORS[k];
    ctx.lineCap = 'round';
    ctx.stroke();
    if (k === 'pickle') drawPickle(ctx, px, y, 0.7);
    else if (k === 'pear') drawPear(ctx, px, y + 2, 0.7);
    else drawPie(ctx, px, y + 4, Math.PI, 0.75);
    ctx.restore();
    px += 64;
  }

  // ---- progress track (top centre) ----
  const tw = narrow ? v.vw - 36 - 40 : Math.min(compact ? 330 : 470, v.vw - lw - 2 * 18 - 300);
  const tx = narrow ? 18 + 24 : (v.vw - tw) / 2 + (compact ? 30 : 0);
  const ty = rowY + 22;
  panel(ctx, tx - 16 - (narrow ? 8 : 0), rowY, tw + 32 + (narrow ? 16 : 0), 52, 16);
  const segCol = ['#4f8a6a', '#e0727a', '#7a5cff'];
  for (let i = 0; i < 3; i++) {
    const a = STAGE_START[i] / END_X;
    const b = (i < 2 ? STAGE_START[i + 1] : END_X) / END_X;
    roundRect(ctx, tx + a * tw + (i ? 2 : 0), ty, (b - a) * tw - (i < 2 ? 2 : 0), 10, 5);
    ctx.fillStyle = segCol[i];
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const prog = g.progress;
  roundRect(ctx, tx, ty, Math.max(10, tw * prog), 10, 5);
  const pg = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  pg.addColorStop(0, '#9cf06a');
  pg.addColorStop(0.5, '#ffb36b');
  pg.addColorStop(1, '#c48bff');
  ctx.fillStyle = pg;
  ctx.fill();
  // house at the end
  ctx.save();
  ctx.translate(tx + tw + 2, ty + 4);
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.lineTo(0, -12);
  ctx.lineTo(11, 0);
  ctx.lineTo(8, 0);
  ctx.lineTo(8, 12);
  ctx.lineTo(-8, 12);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fillStyle = '#ffd6e4';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.restore();
  // mold marker
  const mp = clamp(g.moldX / END_X, 0, 1);
  ctx.save();
  ctx.translate(tx + tw * mp, ty + 5);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const r = 9 + Math.sin(i * 2.7 + t * 6) * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#4f9a3a';
  ctx.fill();
  ctx.strokeStyle = '#0b1a08';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e2f04a';
  ctx.beginPath();
  ctx.arc(-3, -1, 2.2, 0, TAU);
  ctx.arc(3, -1, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  // player head
  drawAstrayHead(ctx, tx + tw * prog, ty + 2, 0.5, g.anger > 0.62 ? 'panic' : 'run', 'maid', t);
  // distance text
  const meters = Math.floor(p.x / 50);
  const total = Math.floor(END_X / 50);
  text(ctx, `${meters}m / ${total}m`, tx + tw / 2, rowY + 41, 13, 'rgba(255,255,255,0.85)', 'center', 'Fredoka', 0);

  // ---- right: stars + score ----
  const rx = v.vw - 18 - rightReserve;
  const rw = narrow ? 180 : compact ? 170 : 210;
  panel(ctx, rx - rw, top, rw, 78);
  ctx.save();
  ctx.translate(rx - rw + 28, top + 26);
  starPath(ctx, 13);
  ctx.fillStyle = '#ffd84a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.restore();
  text(ctx, `${g.stats.stars}`, rx - rw + 48, top + 27, 24, '#fff');
  text(ctx, `${g.score.toLocaleString()}`, rx - 16, top + 56, 26, '#ffe8f4', 'right');
  text(ctx, 'SCORE', rx - rw + 16, top + 58, 12, 'rgba(255,255,255,0.6)', 'left', 'Fredoka', 0);
  if (g.combo >= 3) {
    const mult = g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : 1;
    const s = 1 + Math.sin(t * 12) * 0.05;
    ctx.save();
    ctx.translate(rx - 50, top + 26);
    ctx.scale(s, s);
    text(ctx, `${g.combo} combo${mult > 1 ? ` ×${mult}` : ''}`, 0, 0, 16, mult > 1 ? '#ffd84a' : '#ff9fd6', 'center');
    ctx.restore();
  }

  // ---- contextual hint ----
  if (g.hint) {
    const h = HINTS[g.hint.key];
    if (h) {
      const k = clamp(g.hint.t / 0.3, 0, 1) * clamp((2.6 - g.hint.t) / 0.25 + 0.001, 0, 1);
      const a = easeOutBack(clamp(k, 0, 1));
      const key = touch ? h.touch : h.keys;
      ctx.save();
      ctx.translate(v.vw / 2, below + (narrow ? 100 : 16));
      ctx.scale(a * (narrow ? 0.82 : 1), a * (narrow ? 0.82 : 1));
      ctx.font = '26px "Lilita One"';
      const kw = ctx.measureText(key).width;
      ctx.font = '22px "Fredoka"';
      const lw2 = ctx.measureText(h.label).width;
      const W = kw + lw2 + 70;
      panel(ctx, -W / 2, -26, W, 52, 26);
      roundRect(ctx, -W / 2 + 10, -18, kw + 28, 36, 12);
      ctx.fillStyle = '#ff6fae';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OL;
      ctx.stroke();
      text(ctx, key, -W / 2 + 24, 1, 24, '#fff', 'left', 'Lilita One', 0.15);
      text(ctx, h.label, -W / 2 + kw + 54, 1, 22, '#fff', 'left', 'Fredoka', 0);
      ctx.restore();
    }
  }

  // ---- stage banner ----
  if (g.stageBanner > 0) {
    const th = g.themes[g.bannerStage];
    const age = 3.2 - g.stageBanner;
    const inK = easeOutCubic(clamp(age / 0.45, 0, 1));
    const outK = clamp(g.stageBanner / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = outK;
    const cy = v.vh * 0.36;
    const bw = Math.min(v.vw - 40, 640);
    ctx.translate(v.vw / 2 + (1 - inK) * -v.vw * 0.6, cy);
    ctx.rotate(-0.03);
    ctx.beginPath();
    ctx.moveTo(-bw / 2 - 20, -54);
    ctx.lineTo(bw / 2 + 30, -60);
    ctx.lineTo(bw / 2 + 10, 54);
    ctx.lineTo(-bw / 2, 60);
    ctx.closePath();
    const bg = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    bg.addColorStop(0, 'rgba(30,16,50,0.92)');
    bg.addColorStop(1, 'rgba(60,24,80,0.92)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = th.accent;
    ctx.stroke();
    text(ctx, th.subtitle.toUpperCase(), 0, -24, 22, th.accent, 'center', 'Lilita One', 0.18);
    text(ctx, th.name, 0, 16, 46, '#fff', 'center', 'Lilita One', 0.16);
    ctx.restore();
  }
}

export function drawCountdown(ctx: CanvasRenderingContext2D, vw: number, vh: number, label: string, k: number) {
  const s = easeOutBack(clamp(k * 2.2, 0, 1)) * (1 + (1 - k) * 0.1);
  ctx.save();
  ctx.translate(vw / 2, vh * 0.42);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp((1 - k) * 4, 0, 1);
  const go = label.length > 1;
  text(ctx, label, 0, 0, go ? 120 : 150, go ? '#ff8fc8' : '#ffffff', 'center', 'Lilita One', 0.14);
  ctx.restore();
}
