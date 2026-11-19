import { TAU, clamp, easeOutBack, makeCanvas } from './util';

const glowSprites = new Map<string, HTMLCanvasElement>();
/** Cached soft radial glow sprite (64px) for a colour. */
export function glowSprite(color: string) {
  let c = glowSprites.get(color);
  if (!c) {
    const { c: cv, ctx } = makeCanvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glowSprites.set(color, cv);
    c = cv;
  }
  return c;
}
import { starPath } from './art/things';

export type PKind = 'dust' | 'spark' | 'star' | 'drop' | 'confetti' | 'ring' | 'spore' | 'heart' | 'leaf' | 'smoke';

interface P {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  drag: number;
  screen: boolean; // screen-space (not affected by camera)
}

interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
  size: number;
  rot: number;
}

const MAX_P = 700;

export class Fx {
  ps: P[] = [];
  pops: Popup[] = [];
  shakeAmt = 0;
  shakeOn = true;
  flash = 0;
  flashColor = '#ffffff';
  hitstop = 0;

  add(kind: PKind, x: number, y: number, o: Partial<P> = {}) {
    if (this.ps.length >= MAX_P) this.ps.shift();
    const max = o.max ?? o.life ?? 0.6;
    this.ps.push({
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      g: 0,
      size: 6,
      color: '#ffffff',
      rot: Math.random() * TAU,
      vr: 0,
      drag: 0,
      screen: false,
      ...o,
      life: max,
      max,
    });
  }

  burst(kind: PKind, x: number, y: number, n: number, speed: number, o: Partial<P> = {}, spread = TAU, dir = 0) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.add(kind, x, y, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vr: (Math.random() - 0.5) * 12,
        ...o,
        size: (o.size ?? 6) * (0.6 + Math.random() * 0.8),
        max: (o.max ?? 0.6) * (0.7 + Math.random() * 0.6),
      });
    }
  }

  popup(text: string, x: number, y: number, color = '#ffffff', size = 34) {
    this.pops.push({ text, x, y, life: 0.9, max: 0.9, color, size, rot: (Math.random() - 0.5) * 0.3 });
  }

  shake(a: number) {
    if (this.shakeOn) this.shakeAmt = Math.max(this.shakeAmt, a);
  }

  doFlash(color: string, a = 0.6) {
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }

  update(dt: number) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.ps.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.life -= dt;
      p.y -= 40 * dt;
      if (p.life <= 0) this.pops.splice(i, 1);
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  clear() {
    this.ps.length = 0;
    this.pops.length = 0;
    this.shakeAmt = 0;
    this.flash = 0;
  }

  /** Draw world-space particles (camera transform already applied). */
  draw(ctx: CanvasRenderingContext2D, screen = false) {
    for (const p of this.ps) {
      if (p.screen !== screen) continue;
      const k = p.life / p.max;
      ctx.save();
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case 'dust':
        case 'smoke': {
          ctx.globalAlpha = k * (p.kind === 'smoke' ? 0.35 : 0.55);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (1.6 - k * 0.6), 0, TAU);
          ctx.fill();
          break;
        }
        case 'spark': {
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-p.vx * 0.04, -p.vy * 0.04);
          ctx.stroke();
          break;
        }
        case 'star': {
          ctx.globalAlpha = clamp(k * 1.5, 0, 1);
          ctx.rotate(p.rot);
          starPath(ctx, p.size);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        }
        case 'heart': {
          ctx.globalAlpha = clamp(k * 1.5, 0, 1);
          ctx.rotate(p.rot * 0.2);
          const s = p.size / 10;
          ctx.scale(s, s);
          ctx.beginPath();
          ctx.moveTo(0, 4);
          ctx.bezierCurveTo(-10, -4, -6, -12, 0, -6);
          ctx.bezierCurveTo(6, -12, 10, -4, 0, 4);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        }
        case 'drop': {
          ctx.globalAlpha = clamp(k * 2, 0, 1);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.8, p.size, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, TAU);
          ctx.fill();
          break;
        }
        case 'confetti': {
          ctx.globalAlpha = clamp(k * 2, 0, 1);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.rot * 2));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case 'leaf': {
          ctx.globalAlpha = clamp(k * 2, 0, 1);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
          ctx.fill();
          break;
        }
        case 'ring': {
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * k + 1;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (1 - k) + 6, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'spore': {
          const a = Math.sin((1 - k) * Math.PI);
          ctx.globalAlpha = a * 0.8;
          ctx.drawImage(glowSprite(p.color), -p.size * 2.5, -p.size * 2.5, p.size * 5, p.size * 5);
          break;
        }
      }
      ctx.restore();
    }
    if (screen) return;
    for (const p of this.pops) {
      const age = 1 - p.life / p.max;
      const sc = easeOutBack(clamp(age * 4, 0, 1));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(sc, sc);
      ctx.globalAlpha = clamp(p.life / 0.25, 0, 1);
      ctx.font = `${p.size}px "Lilita One", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = p.size * 0.22;
      ctx.strokeStyle = '#2a1420';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }
}
