import { TAU } from '../util';
import { starPath } from './things';

const OL = '#2a1420';

/** Astray's cozy rooftop apartment – the finish line. Door centre at x+180. */
export function drawHouse(ctx: CanvasRenderingContext2D, x0: number, gy: number, t: number, open: number) {
  const x = x0 - 60;
  ctx.save();
  // warm spill light on the ground
  ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createRadialGradient(x + 180, gy, 10, x + 180, gy, 300);
  sg.addColorStop(0, `rgba(255,200,120,${0.35 + open * 0.3})`);
  sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(x - 120, gy - 300, 600, 340);
  ctx.globalCompositeOperation = 'source-over';

  // body
  ctx.beginPath();
  ctx.rect(x, gy - 270, 420, 270);
  const wg = ctx.createLinearGradient(0, gy - 270, 0, gy);
  wg.addColorStop(0, '#ffd6e4');
  wg.addColorStop(1, '#e8a8c4');
  ctx.fillStyle = wg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OL;
  ctx.stroke();
  // siding lines
  ctx.strokeStyle = 'rgba(160,80,120,0.25)';
  ctx.lineWidth = 2;
  for (let y = gy - 250; y < gy; y += 22) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 416, y);
    ctx.stroke();
  }
  // roof
  ctx.beginPath();
  ctx.moveTo(x - 30, gy - 262);
  ctx.lineTo(x + 210, gy - 392);
  ctx.lineTo(x + 450, gy - 262);
  ctx.closePath();
  const rg = ctx.createLinearGradient(0, gy - 392, 0, gy - 262);
  rg.addColorStop(0, '#d4283f');
  rg.addColorStop(1, '#8e1226');
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OL;
  ctx.stroke();
  // roof tiles
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 1; i < 6; i++) {
    const yy = gy - 392 + i * 22;
    const half = (i * 22 * 240) / 130;
    ctx.beginPath();
    ctx.moveTo(x + 210 - half, yy);
    ctx.lineTo(x + 210 + half, yy);
    ctx.stroke();
  }
  // chimney + puffs
  ctx.beginPath();
  ctx.rect(x + 320, gy - 380, 40, 70);
  ctx.fillStyle = '#7a4a58';
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.4 + i / 3) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + 340 + k * 30, gy - 390 - k * 90, 10 + k * 18, 0, TAU);
    ctx.fill();
  }
  // star sign over door
  ctx.save();
  ctx.translate(x + 180, gy - 236);
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  gl.addColorStop(0, 'rgba(255,230,120,0.6)');
  gl.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-60, -60, 120, 120);
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(Math.sin(t * 2) * 0.08);
  starPath(ctx, 22);
  ctx.fillStyle = '#ffe66b';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.restore();

  // windows
  for (const wx of [x + 40, x + 300]) {
    ctx.beginPath();
    ctx.rect(wx, gy - 190, 80, 80);
    ctx.fillStyle = '#ffd98a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OL;
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const wgl = ctx.createRadialGradient(wx + 40, gy - 150, 5, wx + 40, gy - 150, 90);
    wgl.addColorStop(0, 'rgba(255,200,110,0.45)');
    wgl.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = wgl;
    ctx.fillRect(wx - 50, gy - 240, 180, 180);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = OL;
    ctx.fillRect(wx + 38, gy - 190, 4, 80);
    ctx.fillRect(wx, gy - 152, 80, 4);
    // curtains
    ctx.fillStyle = '#ff8fb8';
    ctx.beginPath();
    ctx.moveTo(wx + 2, gy - 188);
    ctx.quadraticCurveTo(wx + 20, gy - 150, wx + 6, gy - 112);
    ctx.lineTo(wx + 2, gy - 112);
    ctx.closePath();
    ctx.moveTo(wx + 78, gy - 188);
    ctx.quadraticCurveTo(wx + 60, gy - 150, wx + 74, gy - 112);
    ctx.lineTo(wx + 78, gy - 112);
    ctx.closePath();
    ctx.fill();
    // flower box
    ctx.fillStyle = '#8e4a2a';
    ctx.fillRect(wx - 6, gy - 108, 92, 14);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = ['#ff6fae', '#ffe66b', '#ffffff', '#ff9a5c', '#c48bff'][i];
      ctx.beginPath();
      ctx.arc(wx + 6 + i * 18, gy - 112, 6, 0, TAU);
      ctx.fill();
    }
  }
  // door
  const dx = x + 135, dw = 90, dh = 150;
  ctx.fillStyle = '#3a1f14';
  ctx.fillRect(dx - 6, gy - dh - 6, dw + 12, dh + 6);
  // interior light
  const ig = ctx.createLinearGradient(0, gy - dh, 0, gy);
  ig.addColorStop(0, '#fff3c4');
  ig.addColorStop(1, '#ffc46a');
  ctx.fillStyle = ig;
  ctx.fillRect(dx, gy - dh, dw, dh);
  // door panel swings open (scaleX)
  const sw = 1 - open * 0.85;
  ctx.save();
  ctx.translate(dx, gy - dh);
  ctx.scale(sw, 1);
  ctx.beginPath();
  ctx.rect(0, 0, dw, dh);
  ctx.fillStyle = '#9b5a3a';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.strokeRect(12, 14, dw - 24, 54);
  ctx.strokeRect(12, 80, dw - 24, 56);
  ctx.fillStyle = '#ffe66b';
  ctx.beginPath();
  ctx.arc(dw - 16, dh / 2 + 6, 5, 0, TAU);
  ctx.fill();
  ctx.restore();
  // doormat
  ctx.fillStyle = '#d4283f';
  ctx.fillRect(dx - 14, gy - 6, dw + 28, 8);
  ctx.fillStyle = '#fff';
  ctx.font = '11px "Lilita One", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOME ☆', dx + dw / 2, gy + 1);
  // string lights along the eaves
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    const lx = x - 20 + k * 460;
    const ly = gy - 262 + Math.sin(k * Math.PI) * 18;
    const c = ['#ffe66b', '#ff6fae', '#6fe7ff'][i % 3];
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(lx, ly + 6, 0, lx, ly + 6, 16);
    lg.addColorStop(0, c);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i);
    ctx.fillStyle = lg;
    ctx.fillRect(lx - 16, ly - 10, 32, 32);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(lx, ly + 6, 3.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
