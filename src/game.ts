import { Rng, TAU, approach, clamp, invLerp, lerp, rgba } from './util';
import { audio } from './audio';
import { input } from './input';
import { Fx } from './fx';
import { defaultPose, drawAstray, type Expr, type Pose } from './art/character';
import {
  drawBingus,
  drawLowPipe,
  drawMayoBottle,
  drawMayoDrop,
  drawMayoJar,
  drawMayoPuddle,
  drawMold,
  drawOverPipe,
  drawPowerBubble,
  drawStar,
  drawSteamVent,
  drawTallPipe,
  PIPE_STYLES,
  POWER_COLORS,
  type PowerKind,
} from './art/things';
import {
  GY,
  drawBackdrop,
  drawDecor,
  drawGround,
  drawPlatform,
  getThemes,
  type StageTheme,
} from './art/backgrounds';
import { TUTORIAL, decorFor, ent, pickPattern, runPattern, type Ent, type GenCtx } from './level';
import { drawHouse } from './art/house';

export const STAGE_START = [0, 21000, 48000];
export const END_X = 78000;
const BASE_SPEED = [520, 575, 635];
const MOLD_EMERGE = 1.4;

export type EndKind = 'win' | 'molded' | 'mayo';

export interface View {
  vw: number; // visible logical width
  vh: number; // visible logical height
  oy: number; // world offset (logical px) so the 720 band sits nicely
  px: number; // player screen x
}

export interface Stats {
  stars: number;
  bigStars: number;
  stomps: number;
  slaps: number;
  hits: number;
  powerups: number;
  time: number;
  dist: number;
  bestCombo: number;
}

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
  jumps: number;
  coyote: number;
  buffer: number;
  sliding: boolean;
  slideBlend: number;
  stumble: number;
  invuln: number;
  stamina: number;
  staminaDelay: number;
  dashing: boolean;
  mayo: number;
  pickle: number;
  pie: number;
  pear: number;
  slapT: number;
  slapCd: number;
  spin: number;
  phase: number;
  airBlend: number;
  runAmt: number;
  blinkT: number;
  blink: number;
  happyT: number;
  slip: number;
  land: number;
  platform: Ent | null;
  stepSide: number;
}

export class Game {
  fx = new Fx();
  ents: Ent[] = [];
  decor: Ent[] = [];
  p!: Player;
  moldX = 0;
  camX = 0;
  t = 0;
  playT = 0;
  score = 0;
  combo = 0;
  comboT = 0;
  stats!: Stats;
  stage = 0;
  stageBanner = 0; // seconds remaining of banner
  bannerStage = 0;
  started = false;
  ending: EndKind | null = null;
  endT = 0;
  hint: { key: string; t: number } | null = null;
  private rng = new Rng(Date.now() & 0xffff);
  private genX = 0;
  private decorX = 0;
  private lastPat = '';
  private tut = 0;
  private sinceRest = 0;
  private nextPowerX = 0;
  private powerBag: PowerKind[] = [];
  private houseSpawned = false;
  private ambientT = 0;
  themes: StageTheme[];
  view: View = { vw: 1280, vh: 720, oy: 0, px: 420 };
  onEnd: ((k: EndKind) => void) | null = null;
  onStage: ((s: number) => void) | null = null;
  attract = false; // title-screen demo mode
  bot = false; // automated playtest driver (debug only)
  minGap = 9999;
  hitLog: string[] = [];
  private cullTick = 0;
  pose: Pose = defaultPose();

  constructor() {
    this.themes = getThemes();
    this.reset();
  }

  reset(attract = false) {
    this.attract = attract;
    this.minGap = 9999;
    this.hitLog = [];
    this.fx.clear();
    this.ents = [];
    this.decor = [];
    this.p = {
      x: 0,
      y: GY,
      vx: 0,
      vy: 0,
      ground: true,
      jumps: 0,
      coyote: 0,
      buffer: 0,
      sliding: false,
      slideBlend: 0,
      stumble: 0,
      invuln: 0,
      stamina: 1,
      staminaDelay: 0,
      dashing: false,
      mayo: 0,
      pickle: 0,
      pie: 0,
      pear: 0,
      slapT: 0,
      slapCd: 0,
      spin: 0,
      phase: 0,
      airBlend: 0,
      runAmt: 0,
      blinkT: 2,
      blink: 0,
      happyT: 0,
      slip: 0,
      land: 0,
      platform: null,
      stepSide: 0,
    };
    this.moldX = -330;
    this.camX = -this.view.px;
    this.t = 0;
    this.playT = 0;
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.stats = { stars: 0, bigStars: 0, stomps: 0, slaps: 0, hits: 0, powerups: 0, time: 0, dist: 0, bestCombo: 0 };
    this.stage = 0;
    this.stageBanner = 0;
    this.started = attract;
    this.ending = null;
    this.endT = 0;
    this.hint = null;
    this.genX = 900;
    this.decorX = -400;
    this.lastPat = '';
    this.tut = attract ? TUTORIAL.length : 0;
    this.sinceRest = 0;
    this.nextPowerX = 5200;
    this.powerBag = [];
    this.houseSpawned = false;
  }

  get theme() {
    return this.themes[this.stage];
  }

  get gap() {
    return this.p.x - this.moldX;
  }

  get anger() {
    return 1 - clamp((this.gap - 70) / 360, 0, 1);
  }

  get progress() {
    return clamp(this.p.x / END_X, 0, 1);
  }

  start() {
    this.started = true;
  }

  // ------------------------------------------------------------------
  // generation
  // ------------------------------------------------------------------
  private generate() {
    const ahead = this.camX + this.view.vw + 700;
    while (this.genX < ahead && this.genX < END_X - 1400) {
      const stage = this.stageAt(this.genX);
      const g: GenCtx = {
        rng: this.rng,
        stage,
        diff: clamp(this.genX / END_X, 0, 1),
        speed: BASE_SPEED[stage],
        out: this.ents,
      };
      // power-ups on a schedule, from a shuffled bag so all three show up
      if (this.genX >= this.nextPowerX && !this.attract) {
        if (!this.powerBag.length) this.powerBag = this.shuffle(['pickle', 'pie', 'pear'] as PowerKind[]);
        const kind = this.powerBag.pop()!;
        this.ents.push(ent('power', this.genX + 120, GY - 150, 56, 56, { power: kind }));
        this.genX += 380;
        this.nextPowerX = this.genX + this.rng.range(4800, 7000);
        continue;
      }
      let name: string;
      let hint: string | undefined;
      if (this.tut < TUTORIAL.length) {
        name = TUTORIAL[this.tut].pat;
        hint = TUTORIAL[this.tut].hint;
        this.tut++;
      } else if (this.sinceRest > 6 + this.rng.int(0, 3)) {
        name = 'breather';
        this.sinceRest = 0;
      } else {
        name = pickPattern(g, this.lastPat);
        this.sinceRest++;
      }
      const before = this.ents.length;
      const len = runPattern(name, this.genX, g);
      if (hint) {
        const first = this.ents.slice(before).find((e) => e.type !== 'star');
        if (first) first.hint = hint;
      }
      this.lastPat = name;
      // spacing scales with speed & difficulty (tighter later)
      const spacing = BASE_SPEED[stage] * lerp(1.25, 0.8, g.diff) * this.rng.range(0.9, 1.35);
      this.genX += len + spacing + (hint ? 300 : 0);
    }
    if (!this.houseSpawned && this.genX >= END_X - 1400 && !this.attract) {
      this.houseSpawned = true;
      this.ents.push(ent('house', END_X, GY, 420, 380));
    }
    // decor
    while (this.decorX < ahead) {
      const stage = this.stageAt(this.decorX);
      this.decor.push(decorFor(this.rng, stage, this.decorX));
      this.decorX += this.rng.range(380, 900);
    }
  }

  private shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  stageAt(x: number) {
    return x >= STAGE_START[2] ? 2 : x >= STAGE_START[1] ? 1 : 0;
  }

  // ------------------------------------------------------------------
  // update
  // ------------------------------------------------------------------
  update(dt: number) {
    this.t += dt;
    if (this.fx.hitstop > 0) {
      this.fx.hitstop -= dt;
      this.fx.update(dt * 0.15);
      return;
    }
    const p = this.p;
    if (this.ending) {
      this.updateEnding(dt);
      this.fx.update(dt);
      return;
    }
    if (this.started) this.playT += dt;

    const stage = this.stageAt(p.x);
    if (stage !== this.stage) {
      this.stage = stage;
      this.stageBanner = 3.2;
      this.bannerStage = stage;
      this.onStage?.(stage);
    }
    this.stageBanner = Math.max(0, this.stageBanner - dt);

    // ---- input ----
    const ai = this.attract || this.bot;
    const want = {
      jump: ai ? this.aiJump() : input.consume('jump'),
      jumpHeld: ai ? true : input.isHeld('jump'),
      slide: ai ? this.aiSlide() : input.isHeld('slide'),
      dash: ai ? this.bot && (this.anger > 0.35 || p.stamina > 0.95) : input.isHeld('dash'),
      slap: ai ? this.bot && p.pie > 0 && this.ents.some((e) => (e.type === 'bingus' || e.type === 'jar' || e.type === 'bottle') && !e.hitDone && e.x - p.x > 20 && e.x - p.x < 140) : input.consume('slap'),
    };
    if (!this.started) {
      // waiting (countdown): idle in place
      p.runAmt = approach(p.runAmt, 0, 8, dt);
      this.updatePoseTimers(dt);
      this.fx.update(dt);
      this.updateCamera(dt);
      this.generate();
      return;
    }

    // ---- timers ----
    p.pickle = Math.max(0, p.pickle - dt);
    p.pie = Math.max(0, p.pie - dt);
    p.pear = Math.max(0, p.pear - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.stumble = Math.max(0, p.stumble - dt);
    p.slip = Math.max(0, p.slip - dt);
    p.slapCd = Math.max(0, p.slapCd - dt);
    p.happyT = Math.max(0, p.happyT - dt);
    p.land = Math.max(0, p.land - dt * 5);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    p.mayo = Math.max(0, p.mayo - dt * 1.6);

    // ---- dash / stamina ----
    const canDash = p.pickle > 0 || p.stamina > 0.02;
    p.dashing = want.dash && canDash && p.stumble <= 0;
    if (p.dashing) {
      if (p.pickle <= 0) p.stamina = Math.max(0, p.stamina - dt * 0.42);
      p.staminaDelay = 0.5;
      if (Math.random() < dt * 30) this.fx.add('spark', p.x - 20, p.y - 20 - Math.random() * 100, { vx: -600, vy: 0, color: 'rgba(255,255,255,0.7)', size: 4, max: 0.25 });
    } else {
      p.staminaDelay -= dt;
      if (p.staminaDelay <= 0) p.stamina = Math.min(1, p.stamina + dt * 0.17);
    }
    if (p.pickle > 0) p.stamina = 1;

    // ---- horizontal speed ----
    const base = BASE_SPEED[stage];
    let target = base * (1 + (p.dashing ? 0.45 : 0) + (p.pickle > 0 ? 0.3 : 0));
    if (p.stumble > 0) target = base * 0.38;
    if (p.slip > 0) target *= 0.78;
    if (p.sliding) target *= 0.97;
    p.vx = approach(p.vx, target, p.stumble > 0 ? 12 : 4.5, dt);
    if (p.x > END_X - 60) p.vx = approach(p.vx, 0, 6, dt);

    // ---- jumping ----
    p.coyote = p.ground ? 0.1 : p.coyote - dt;
    if (want.jump) p.buffer = 0.13;
    else p.buffer -= dt;
    if (p.buffer > 0 && p.stumble < 0.25) {
      if (p.ground || p.coyote > 0) {
        p.vy = -1180;
        p.ground = false;
        p.coyote = 0;
        p.jumps = 1;
        p.buffer = 0;
        p.sliding = false;
        p.platform = null;
        audio.play('sfx/jump', { vol: 0.7 });
        this.fx.burst('dust', p.x, p.y, 6, 140, { color: '#ffffff', size: 8, max: 0.35, g: -100 }, Math.PI, Math.PI);
      } else if (p.jumps < 2) {
        p.vy = -1060;
        p.jumps = 2;
        p.buffer = 0;
        p.spin = 0.0001;
        audio.play('sfx/double_jump', { vol: 0.7 });
        this.fx.add('ring', p.x, p.y - 10, { color: 'rgba(255,255,255,0.9)', size: 50, max: 0.35 });
        this.fx.burst('star', p.x, p.y, 6, 220, { color: '#fff3b0', size: 5, max: 0.45, g: 400 });
      }
    }
    // variable jump height
    if (!want.jumpHeld && p.vy < -420 && !p.ground && p.jumps === 1) p.vy = -420;

    // ---- sliding / fast fall ----
    const underPipe = this.ents.some((e) => e.type === 'overpipe' && p.x + 30 > e.x && p.x - 30 < e.x + e.w);
    if (p.ground) {
      const wasSliding = p.sliding;
      p.sliding = (want.slide || (p.sliding && underPipe)) && p.stumble <= 0;
      if (p.sliding && !wasSliding) {
        audio.play('sfx/slide', { vol: 0.6 });
      }
      if (p.sliding && Math.random() < dt * 40) {
        this.fx.add('dust', p.x + 20, p.y - 4, { vx: -120 - Math.random() * 80, vy: -40 - Math.random() * 60, color: '#e8e0f0', size: 6, max: 0.4 });
      }
    } else if (want.slide && p.vy > -200) {
      p.vy = Math.max(p.vy, 1250); // fast fall
    }
    p.slideBlend = approach(p.slideBlend, p.sliding ? 1 : 0, 18, dt);

    // ---- gravity & integrate ----
    const prevFeet = p.y;
    const gravity = p.vy > 0 ? 3900 : 3200;
    if (!p.ground) p.vy = Math.min(1700, p.vy + gravity * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // platform support
    if (p.platform) {
      const pl = p.platform;
      if (p.x < pl.x - 18 || p.x > pl.x + pl.w + 18) {
        p.platform = null;
        p.ground = false;
        p.coyote = 0.1;
      } else p.y = pl.y;
    }
    if (!p.ground && p.vy >= 0) {
      for (const e of this.ents) {
        if (e.type !== 'platform') continue;
        if (p.x > e.x - 16 && p.x < e.x + e.w + 16 && prevFeet <= e.y + 2 && p.y >= e.y) {
          this.landOn(e.y, e);
          break;
        }
      }
    }
    if (p.y >= GY) {
      if (!p.ground) this.landOn(GY, null);
      p.y = GY;
      p.vy = 0;
    }

    // spin (double jump flip)
    if (p.spin > 0) {
      p.spin += dt * 17;
      if (p.spin >= TAU) p.spin = 0;
    }

    // ---- slap ----
    if (want.slap && p.pie > 0 && p.slapCd <= 0) {
      p.slapT = 0.0001;
      p.slapCd = 0.32;
      audio.play('sfx/pie', { vol: 0.5 });
    }
    if (p.slapT > 0) {
      p.slapT += dt / 0.34;
      if (p.slapT >= 1) p.slapT = 0;
    }

    // ---- footsteps ----
    if (p.ground && !p.sliding) {
      const before = p.phase;
      p.phase += p.vx * dt * 0.0215;
      const stepA = Math.floor(before / Math.PI), stepB = Math.floor(p.phase / Math.PI);
      if (stepA !== stepB) {
        p.stepSide ^= 1;
        audio.play(p.stepSide ? 'sfx/step1' : 'sfx/step2', { vol: 0.22, jitter: 0.08, minGap: 0.08 });
        if (Math.random() < 0.6)
          this.fx.add('dust', p.x - 6, p.y - 2, { vx: -60 - Math.random() * 40, vy: -30, color: this.stage === 0 ? '#a8b8c8' : '#e8d0e0', size: 5, max: 0.35 });
      }
    }
    p.runAmt = approach(p.runAmt, p.sliding ? 0.4 : clamp(p.vx / 300, 0, 1), 8, dt);
    p.airBlend = approach(p.airBlend, p.ground ? 0 : 1, 14, dt);

    this.updatePoseTimers(dt);
    this.updateMold(dt);
    this.updateEntities(dt);
    this.updateCamera(dt);
    this.generate();
    this.updateAmbientFx(dt);
    this.updateHints(dt);

    this.stats.dist = p.x;
    if (this.started && this.playT > 2) this.minGap = Math.min(this.minGap, this.gap);
    this.stats.time = this.playT;

    // ---- endings ----
    if (!this.attract) {
      if (p.mayo >= 100) this.beginEnding('mayo');
      else if (this.gap <= 34) this.beginEnding('molded');
      else if (p.x >= END_X - 40) this.beginEnding('win');
    } else {
      // keep the demo going forever, with the mold lurking in view
      if (p.x > END_X - 2600) {
        this.reset(true);
        this.p.vx = 380;
        return;
      }
      this.moldX = approach(this.moldX, p.x - 300 + Math.sin(this.t * 0.7) * 40, 2, dt);
      p.mayo = 0;
    }

    // ---- audio layers ----
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = 0.25;
      audio.setAmbient('ambient/mold', (this.attract ? 0.25 : 0.15 + this.anger * 0.85) * 0.9);
    }
    this.fx.update(dt);
  }

  // ---- title-screen demo "AI" ----
  private aiJump(): boolean {
    const p = this.p;
    if (!p.ground && p.jumps === 1 && p.vy > -120) {
      const tall = this.ents.find((e) => e.type === 'tallpipe' && e.x - p.x < 170 && e.x + e.w > p.x - 10);
      if (tall) return true;
    }
    if (!p.ground) return false;
    for (const e of this.ents) {
      if (e.dead || e.hitDone) continue;
      const dx = e.x - p.x;
      const hazard =
        e.type === 'lowpipe' || e.type === 'tallpipe' || e.type === 'jar' || e.type === 'puddle' || e.type === 'vent' || e.type === 'bottle' || (e.type === 'bingus' && e.kind !== 'balloon' && !e.flying && !(e.squash ?? 0));
      if (!hazard) continue;
      const lead = e.type === 'bingus' || e.type === 'jar' ? 175 : e.type === 'tallpipe' ? 120 : 135;
      if (dx > lead - 70 && dx < lead) return true;
    }
    return false;
  }

  private aiSlide(): boolean {
    const p = this.p;
    return this.ents.some(
      (e) => (e.type === 'overpipe' || (e.type === 'bingus' && e.kind === 'balloon' && !e.flying)) && e.x - p.x < 150 && e.x + e.w > p.x - 50,
    );
  }

  private landOn(y: number, plat: Ent | null) {
    const p = this.p;
    const hard = p.vy > 900;
    p.y = y;
    p.vy = 0;
    p.ground = true;
    p.jumps = 0;
    p.spin = 0;
    p.platform = plat;
    p.land = 1;
    audio.play('sfx/land', { vol: hard ? 0.55 : 0.35 });
    this.fx.burst('dust', p.x, y, hard ? 10 : 5, hard ? 220 : 130, { color: '#ffffff', size: 7, max: 0.4, g: -60 }, Math.PI * 0.9, Math.PI);
    if (hard) this.fx.shake(4);
  }

  private updatePoseTimers(dt: number) {
    const p = this.p;
    p.blinkT -= dt;
    if (p.blinkT <= 0) {
      p.blink = 1;
      p.blinkT = 2 + Math.random() * 3.5;
    }
    p.blink = Math.max(0, p.blink - dt * 7);
  }

  private updateMold(dt: number) {
    const p = this.p;
    const base = BASE_SPEED[this.stage];
    const g = this.gap;
    let k: number;
    if (g > 640) k = 1.4;
    else if (g > 370) k = 1.07;
    else if (g > 190) k = 0.97;
    else k = 0.93;
    const emerge = clamp(this.playT / MOLD_EMERGE, 0, 1);
    if (p.x > END_X - 600) k = 0.6; // it can't follow you home
    this.moldX += base * k * emerge * dt;
    // spores drifting off the mold
    if (Math.random() < dt * (8 + this.anger * 20)) {
      this.fx.add('spore', this.moldX + Math.random() * 60, GY - Math.random() * 420, {
        vx: 60 + Math.random() * 140,
        vy: -20 - Math.random() * 40,
        color: 'rgba(180,240,110,0.9)',
        size: 3 + Math.random() * 4,
        max: 1.6,
      });
    }
    if (!this.attract && this.anger > 0.75 && Math.random() < dt * 1.2) {
      audio.play('sfx/growl', { vol: 0.35 + this.anger * 0.3, minGap: 2.5 });
      this.fx.shake(3);
    }
  }

  private playerBox() {
    const p = this.p;
    if (p.sliding) return { x0: p.x - 34, x1: p.x + 40, y0: p.y - 78, y1: p.y };
    return { x0: p.x - 20, x1: p.x + 22, y0: p.y - 142, y1: p.y - 2 };
  }

  private hurt(kind: 'clang' | 'bonk' | 'steam', e: Ent) {
    const p = this.p;
    if (p.pear > 0) {
      this.smash(e);
      return;
    }
    if (p.invuln > 0) return;
    e.hitDone = true;
    this.hitLog.push(`${e.type}${e.kind ? ':' + e.kind : ''}@${Math.round(p.x)}`);
    p.stumble = 0.45;
    p.invuln = 1.1;
    p.sliding = false;
    this.stats.hits++;
    this.combo = 0;
    this.fx.shake(10);
    this.fx.hitstop = 0.06;
    this.fx.doFlash('#ff4a6a', 0.25);
    audio.play('sfx/hit', { vol: 0.7 });
    if (kind === 'clang') audio.play('sfx/clang', { vol: 0.6 });
    if (kind === 'bonk') audio.play('sfx/bonk', { vol: 0.6 });
    const txt = kind === 'clang' ? 'CLANG!' : kind === 'steam' ? 'HOT!' : 'OOF!';
    this.fx.popup(txt, p.x + 30, p.y - 170, '#ff8fa3', 36);
    this.fx.burst('star', p.x + 10, p.y - 120, 7, 260, { color: '#fff3b0', size: 6, max: 0.6, g: 600 });
  }

  private smash(e: Ent) {
    if (e.dead || e.hitDone) return;
    e.hitDone = true;
    e.dead = e.type !== 'bingus';
    this.fx.shake(7);
    audio.play('sfx/clang', { vol: 0.5, rate: 1.3 });
    audio.play('sfx/bonk', { vol: 0.5 });
    const cx = e.x + e.w / 2;
    const cy = e.type === 'overpipe' ? e.y - 20 : e.y - e.h / 2;
    const col = e.style ? PIPE_STYLES[e.style].base : '#ffffff';
    this.fx.burst('confetti', cx, cy, 16, 520, { color: col, size: 14, max: 0.9, g: 1400 });
    this.fx.burst('star', cx, cy, 10, 380, { color: '#ffe66b', size: 7, max: 0.6, g: 500 });
    this.fx.popup('SMASH!', cx, cy - 60, '#ffe66b', 40);
    this.addScore(20, cx, cy);
    if (e.type === 'bingus') this.launchBingus(e, 1);
  }

  private launchBingus(e: Ent, dir: number) {
    e.flying = true;
    e.hitDone = true;
    e.vx = 500 + Math.random() * 300 * dir;
    e.vy = -900 - Math.random() * 300;
    e.vr = 10 + Math.random() * 8;
    audio.play(Math.random() < 0.5 ? 'sfx/meow1' : 'sfx/meow2', { vol: 0.55, jitter: 0.12 });
  }

  private addScore(n: number, x: number, y: number, label = true) {
    this.combo++;
    this.comboT = 2.2;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const mult = this.combo >= 10 ? 3 : this.combo >= 5 ? 2 : 1;
    this.score += n * mult;
    if (label && n >= 20) this.fx.popup(`+${n * mult}`, x, y - 30, mult > 1 ? '#ffd84a' : '#ffffff', 26);
  }

  private addMayo(n: number, x: number, y: number) {
    const p = this.p;
    if (p.pear > 0) return;
    p.mayo = Math.min(100, p.mayo + n);
    audio.play('sfx/splat', { vol: 0.65 });
    this.fx.burst('drop', x, y, 12, 380, { color: '#fff7d8', size: 6, max: 0.6, g: 1500 });
    this.fx.shake(4);
    if (p.mayo > 70) this.fx.popup('TOO MUCH MAYO!', p.x + 20, p.y - 190, '#fff1b0', 30);
    else this.fx.popup('SPLAT!', x, y - 40, '#fff1b0', 32);
  }

  private updateEntities(dt: number) {
    const p = this.p;
    const box = this.playerBox();
    const slapBox = p.slapT > 0.2 && p.slapT < 0.75 ? { x0: p.x + 10, x1: p.x + 150, y0: p.y - 160, y1: p.y + 4 } : null;
    const over = (a: { x0: number; x1: number; y0: number; y1: number }, x0: number, y0: number, x1: number, y1: number) =>
      a.x0 < x1 && a.x1 > x0 && a.y0 < y1 && a.y1 > y0;

    for (const e of this.ents) {
      if (e.dead) continue;
      e.t += dt;
      switch (e.type) {
        case 'lowpipe':
        case 'tallpipe':
          if (!e.hitDone && over(box, e.x + 4, e.y - e.h - 14, e.x + e.w - 4, e.y)) this.hurt('clang', e);
          break;
        case 'overpipe': {
          if (!e.hitDone && over(box, e.x + 6, -1000, e.x + e.w - 6, e.y)) this.hurt('clang', e);
          if (e.nozzle && e.x > this.camX + 200 && e.x < this.camX + this.view.vw + 100) {
            e.timer = (e.timer ?? 0) + dt;
            if (e.timer > 1.15) {
              e.timer = 0;
              this.ents.push(ent('drop', e.x + e.w * 0.3, e.y + 14, 16, 18, { vy: 60 }));
            }
          }
          break;
        }
        case 'drop': {
          e.vy += 1800 * dt;
          e.y += e.vy * dt;
          if (slapBox && over(slapBox, e.x - 8, e.y - 10, e.x + 8, e.y + 8)) {
            e.dead = true;
            this.fx.burst('drop', e.x, e.y, 8, 300, { color: '#fff7d8', size: 5, max: 0.5, g: 1200 });
            break;
          }
          if (over(box, e.x - 8, e.y - 10, e.x + 8, e.y + 8)) {
            e.dead = true;
            this.addMayo(12, e.x, e.y);
          } else if (e.y >= GY) {
            e.dead = true;
            this.fx.burst('drop', e.x, GY - 2, 6, 180, { color: '#fff7d8', size: 4, max: 0.4, g: 1200 }, Math.PI * 0.8, -Math.PI / 2);
            // no puddles under overhead pipes: the player must slide there, so they'd be unavoidable
            const underPipe = this.ents.some((o) => o.type === 'overpipe' && e.x > o.x - 60 && e.x < o.x + o.w + 60);
            if (!underPipe) this.ents.push(ent('puddle', e.x - 22, GY, 44, 10, { hitDone: false, timer: 4 }));
          }
          break;
        }
        case 'puddle': {
          if (e.timer !== undefined) {
            e.timer -= dt;
            if (e.timer <= 0) e.dead = true;
          }
          if (!e.hitDone && p.ground && p.x + 14 > e.x && p.x - 14 < e.x + e.w && p.y >= GY - 1) {
            e.hitDone = true;
            if (p.pear <= 0) {
              p.slip = 0.6;
              this.addMayo(e.w < 60 ? 8 : 20, p.x, p.y - 6);
            }
          }
          break;
        }
        case 'jar': {
          e.x += e.vx * dt;
          e.rot = (e.rot ?? 0) + (e.vx / 26) * dt;
          if (slapBox && over(slapBox, e.x - 24, e.y - 24, e.x + 24, e.y + 24)) {
            this.breakJar(e, true);
            break;
          }
          if (!e.hitDone && over(box, e.x - 22, e.y - 22, e.x + 22, e.y + 26)) {
            if (p.vy > 0 && box.y1 - (e.y - 24) < 26) {
              this.breakJar(e, true);
              this.bounce(-900);
            } else if (p.pear > 0) this.breakJar(e, true);
            else if (p.invuln <= 0) {
              this.breakJar(e, false);
              this.addMayo(22, p.x, p.y - 60);
              this.hurt('bonk', e);
            }
          }
          break;
        }
        case 'vent': {
          const period = 2.4;
          const ph = ((this.t / period + (e.phase ?? 0)) % 1 + 1) % 1;
          // power: -1..0 warning, >0 blasting
          const power = ph < 0.42 ? Math.sin((ph / 0.42) * Math.PI) : ph > 0.82 ? -((ph - 0.82) / 0.18) : 0;
          e.timer = power;
          if (power > 0.3 && !e.hitDone && over(box, e.x, GY - 150 * power, e.x + e.w, GY)) this.hurt('steam', e);
          if (power > 0.6 && Math.abs(e.x - p.x) < 900) audio.play('sfx/dash', { vol: 0.12, rate: 0.6, minGap: 1.6 });
          if (ph > 0.42 && ph < 0.82) e.hitDone = false;
          break;
        }
        case 'bottle': {
          e.timer = (e.timer ?? 0) - dt;
          const dx = e.x - p.x;
          if (e.timer <= 0 && dx > 150 && dx < 900) {
            e.timer = 1.5;
            e.phase = 0.3;
            // lob a mayo blob toward where the player will be
            const tFlight = 0.85;
            const vx = -(dx + p.vx * tFlight * 0.6) / tFlight + p.vx * 0;
            this.ents.push(ent('blob', e.x - 14, e.y - 76, 18, 18, { vx: vx * 0.55, vy: -820 }));
            audio.play('sfx/splat', { vol: 0.3, rate: 1.5 });
          }
          e.phase = Math.max(0, (e.phase ?? 0) - dt);
          if (slapBox && over(slapBox, e.x - 20, e.y - 70, e.x + 20, e.y)) {
            e.dead = true;
            this.fx.burst('drop', e.x, e.y - 40, 18, 420, { color: '#fff7d8', size: 6, max: 0.6, g: 1400 });
            this.fx.popup('SPLURT!', e.x, e.y - 110, '#fff1b0', 34);
            this.stats.slaps++;
            this.addScore(30, e.x, e.y - 80);
          } else if (!e.hitDone && over(box, e.x - 18, e.y - 64, e.x + 18, e.y)) {
            if (p.vy > 0 && box.y1 - (e.y - 64) < 26) {
              e.dead = true;
              this.bounce(-1000);
              this.fx.burst('drop', e.x, e.y - 40, 16, 420, { color: '#fff7d8', size: 6, max: 0.6, g: 1400 });
              this.addScore(25, e.x, e.y - 80);
            } else if (p.pear > 0) this.smash(e);
            else if (p.invuln <= 0) {
              this.addMayo(16, p.x, p.y - 80);
              this.hurt('bonk', e);
            }
          }
          break;
        }
        case 'blob': {
          e.vy += 1500 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (slapBox && over(slapBox, e.x - 9, e.y - 9, e.x + 9, e.y + 9)) {
            e.dead = true;
            this.fx.burst('drop', e.x, e.y, 8, 300, { color: '#fff7d8', size: 5, max: 0.5, g: 1200 });
          } else if (over(box, e.x - 9, e.y - 9, e.x + 9, e.y + 9)) {
            e.dead = true;
            this.addMayo(12, e.x, e.y);
          } else if (e.y >= GY) {
            e.dead = true;
            this.ents.push(ent('puddle', e.x - 26, GY, 52, 10, { timer: 5 }));
            this.fx.burst('drop', e.x, GY - 2, 6, 180, { color: '#fff7d8', size: 4, max: 0.4, g: 1200 }, Math.PI * 0.8, -Math.PI / 2);
          }
          break;
        }
        case 'bingus':
          this.updateBingus(e, dt, box, slapBox, over);
          break;
        case 'star': {
          const r = e.big ? 34 : 24;
          if (over(box, e.x - r, e.y - r, e.x + r, e.y + r)) {
            e.dead = true;
            this.stats.stars++;
            if (e.big) this.stats.bigStars++;
            this.score += e.big ? 50 : 10;
            this.combo++;
            this.comboT = 2.2;
            this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
            audio.play('sfx/star', { vol: e.big ? 0.6 : 0.4, rate: 1 + Math.min(this.combo, 12) * 0.035, jitter: 0 });
            this.fx.burst('star', e.x, e.y, e.big ? 12 : 5, e.big ? 300 : 160, { color: e.big ? '#ff9fe0' : '#ffe66b', size: e.big ? 6 : 4, max: 0.5 });
            this.fx.add('ring', e.x, e.y, { color: e.big ? '#ff9fe0' : '#fff3b0', size: e.big ? 60 : 34, max: 0.3 });
            if (e.big) this.fx.popup('+50', e.x, e.y - 30, '#ff9fe0', 30);
          }
          break;
        }
        case 'power': {
          if (over(box, e.x - 34, e.y - 34, e.x + 34, e.y + 34)) {
            e.dead = true;
            this.collectPower(e.power!, e.x, e.y);
          }
          break;
        }
      }
    }
    // cull
    const cullX = Math.min(this.camX, this.moldX) - 500;
    if (++this.cullTick % 15 === 0 || this.ents.some((e) => e.dead))
      this.ents = this.ents.filter((e) => !e.dead && e.x + e.w > cullX && e.y < 1600);
    if (this.decor.length && this.decor[0].x < this.camX - 400) this.decor = this.decor.filter((d) => d.x > this.camX - 400);
  }

  private bounce(v: number) {
    const p = this.p;
    p.vy = v;
    p.ground = false;
    p.platform = null;
    p.jumps = 1;
    audio.play('sfx/stomp', { vol: 0.7 });
  }

  private breakJar(e: Ent, good: boolean) {
    e.dead = true;
    audio.play('sfx/glass', { vol: 0.55 });
    this.fx.burst('confetti', e.x, e.y, 12, 420, { color: '#d9f2ff', size: 8, max: 0.6, g: 1400 });
    this.fx.burst('drop', e.x, e.y, 14, 380, { color: '#fff7d8', size: 6, max: 0.6, g: 1500 });
    if (good) {
      this.fx.popup('CRASH!', e.x, e.y - 50, '#bfe6ff', 32);
      this.stats.slaps++;
      this.addScore(25, e.x, e.y);
    }
  }

  private updateBingus(
    e: Ent,
    dt: number,
    box: { x0: number; x1: number; y0: number; y1: number },
    slapBox: { x0: number; x1: number; y0: number; y1: number } | null,
    over: (a: { x0: number; x1: number; y0: number; y1: number }, x0: number, y0: number, x1: number, y1: number) => boolean,
  ) {
    const p = this.p;
    if (e.flying) {
      e.vy += 1800 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.spin = (e.spin ?? 0) + (e.vr ?? 10) * dt;
      if (e.y > 1500) e.dead = true;
      return;
    }
    if ((e.squash ?? 0) > 0) {
      e.squash = Math.min(1, (e.squash ?? 0) + dt * 6);
      e.t += 0;
      if (e.squash >= 1 && e.timer === undefined) e.timer = 0.35;
      if (e.timer !== undefined) {
        e.timer -= dt;
        if (e.timer <= 0) {
          // pop off-screen with a spin
          e.squash = 0;
          e.flying = true;
          e.vx = 260;
          e.vy = -700;
          e.vr = 9;
        }
      }
      return;
    }
    const near = e.x - p.x;
    // only wake up when on/near screen
    if (near < this.view.vw + 100) {
      switch (e.kind) {
        case 'walk':
        case 'chonk':
          e.x += e.vx * dt;
          break;
        case 'hop': {
          e.x += e.vx * dt;
          if (e.y >= GY) {
            e.timer = (e.timer ?? 0) - dt;
            if (e.timer <= 0) {
              e.vy = -700;
              e.timer = 0.9;
            }
          }
          e.vy += 2600 * dt;
          e.y = Math.min(GY, e.y + e.vy * dt);
          break;
        }
        case 'balloon':
          e.x += e.vx * dt;
          e.y = (e.baseY ?? GY - 140) + Math.sin(e.t * 2.2) * 14;
          break;
        case 'box':
          e.boxOpen = approach(e.boxOpen ?? 0, near < 380 ? 1 : 0, 6, dt);
          break;
      }
    }
    if (e.hitDone) return;
    const sc = e.kind === 'chonk' ? 1.45 : 1;
    const top = e.kind === 'balloon' ? e.y - 50 : e.kind === 'box' ? e.y - 44 - (e.boxOpen ?? 0) * 20 : e.y - 52 * sc;
    const bottom = e.kind === 'balloon' ? e.y + 2 : e.y;
    const x0 = e.x - 30 * sc, x1 = e.x + 34 * sc;

    if (slapBox && over(slapBox, x0, top, x1, bottom)) {
      this.launchBingus(e, 1);
      audio.play('sfx/slap', { vol: 0.8 });
      this.fx.popup(this.rng.pick(['SLAP!', 'PIE\'D!', 'BONK!']), e.x, top - 30, '#ffb36b', 40);
      this.fx.burst('drop', e.x, top + 20, 14, 360, { color: '#fffaf0', size: 6, max: 0.6, g: 1300 });
      this.fx.hitstop = 0.05;
      this.fx.shake(6);
      this.stats.slaps++;
      this.addScore(30, e.x, top);
      return;
    }
    if (!over(box, x0 + 6, top, x1 - 6, bottom)) return;
    const stompable = p.vy > 60 && box.y1 - top < 34;
    if (stompable) {
      e.squash = 0.01;
      e.hitDone = true;
      this.bounce(e.kind === 'chonk' ? -1480 : -940);
      this.stats.stomps++;
      this.fx.popup(e.kind === 'chonk' ? 'BOING!' : 'NYA~!', e.x, top - 30, '#ff9fd6', 38);
      this.fx.burst('heart', e.x, top, 6, 200, { color: '#ff8fb8', size: 10, max: 0.7, g: -200 });
      this.fx.burst('dust', e.x, top + 20, 8, 200, { color: '#ffffff', size: 8, max: 0.35 });
      audio.play(Math.random() < 0.5 ? 'sfx/meow1' : 'sfx/meow2', { vol: 0.5, jitter: 0.12 });
      this.fx.hitstop = 0.04;
      this.addScore(e.kind === 'chonk' ? 40 : 25, e.x, top);
      return;
    }
    if (p.pear > 0) {
      this.smash(e);
      return;
    }
    this.hurt('bonk', e);
  }

  private collectPower(kind: PowerKind, x: number, y: number) {
    const p = this.p;
    this.stats.powerups++;
    p.happyT = 0.9;
    const col = POWER_COLORS[kind];
    this.fx.burst('star', x, y, 18, 420, { color: col, size: 7, max: 0.7, g: 300 });
    this.fx.add('ring', x, y, { color: col, size: 110, max: 0.45 });
    this.fx.doFlash(col, 0.35);
    audio.play('sfx/powerup', { vol: 0.6 });
    if (kind === 'pickle') {
      p.pickle = 6;
      p.stamina = 1;
      audio.play('sfx/pickle', { vol: 0.7 });
      this.fx.popup('PICKLE POWER!', x, y - 60, '#9cf06a', 42);
    } else if (kind === 'pie') {
      p.pie = 10;
      audio.play('sfx/pie', { vol: 0.7 });
      this.fx.popup('PIE POWER!', x, y - 60, '#ffc58a', 42);
      this.hint = { key: 'slap', t: 3 };
    } else {
      p.pear = 6;
      audio.play('sfx/pear', { vol: 0.7 });
      this.fx.popup('PEAR POWER!', x, y - 60, '#fff07a', 42);
    }
    this.addScore(50, x, y, false);
  }

  private updateCamera(dt: number) {
    const target = this.p.x - this.view.px;
    this.camX = this.started || this.attract ? target : approach(this.camX, target, 10, dt);
  }

  private updateAmbientFx(dt: number) {
    const th = this.theme;
    const vw = this.view.vw;
    const rate = th.particles === 'fireflies' ? 4 : th.particles === 'dust' ? 5 : 7;
    if (Math.random() < dt * rate) {
      const x = this.camX + Math.random() * (vw + 300);
      const y = 80 + Math.random() * 480;
      if (th.particles === 'spores')
        this.fx.add('spore', x, y, { vx: -20 - Math.random() * 30, vy: -10 - Math.random() * 20, color: 'rgba(170,240,120,0.9)', size: 2 + Math.random() * 3, max: 3 });
      else if (th.particles === 'dust')
        this.fx.add('spore', x, y, { vx: -30 - Math.random() * 30, vy: 5 + Math.random() * 10, color: 'rgba(255,210,170,0.9)', size: 1.5 + Math.random() * 2.5, max: 3.5 });
      else
        this.fx.add('spore', x, y, { vx: -10 + Math.random() * 20, vy: -15 - Math.random() * 15, color: Math.random() < 0.5 ? 'rgba(120,240,255,0.95)' : 'rgba(255,140,220,0.95)', size: 2 + Math.random() * 2.5, max: 3 });
    }
    // speed lines during pickle / dash
    const p = this.p;
    if ((p.pickle > 0 || p.dashing) && Math.random() < dt * 40) {
      this.fx.add('spark', this.camX + vw + 20, 60 + Math.random() * 560, {
        vx: -2400,
        vy: 0,
        color: p.pickle > 0 ? 'rgba(170,255,120,0.55)' : 'rgba(255,255,255,0.4)',
        size: 6,
        max: 0.5,
      });
    }
    if (p.pear > 0 && Math.random() < dt * 30) {
      const c = ['#ffe66b', '#ff9fe0', '#9fe8ff', '#b6ff8a'][Math.floor(Math.random() * 4)];
      this.fx.add('star', p.x - 20 + Math.random() * 30, p.y - Math.random() * 140, { vx: -200, vy: -40, color: c, size: 4 + Math.random() * 3, max: 0.6 });
    }
  }

  private updateHints(dt: number) {
    if (this.attract) return;
    if (this.hint) {
      this.hint.t -= dt;
      if (this.hint.t <= 0) this.hint = null;
    }
    for (const e of this.ents) {
      if (e.hint && !e.hintShown && e.x - this.p.x < 620) {
        e.hintShown = true;
        this.hint = { key: e.hint, t: 2.6 };
      }
    }
  }

  // ------------------------------------------------------------------
  // endings
  // ------------------------------------------------------------------
  beginEnding(k: EndKind) {
    if (this.ending) return;
    this.ending = k;
    this.endT = 0;
    input.releaseAll();
    const p = this.p;
    if (k === 'molded') {
      audio.play('sfx/growl', { vol: 0.9, minGap: 0 });
      audio.play('sfx/hit', { vol: 0.6 });
      this.fx.shake(16);
      p.stumble = 1;
    } else if (k === 'mayo') {
      audio.play('sfx/splat', { vol: 1, rate: 0.7, minGap: 0 });
      this.fx.shake(10);
    } else {
      audio.play('sfx/transform', { vol: 0.7 });
    }
    audio.playMusic(null, 0.8);
    audio.setAmbient('ambient/mold', k === 'molded' ? 1 : 0, 1.5);
  }

  private updateEnding(dt: number) {
    this.endT += dt;
    const p = this.p;
    this.updatePoseTimers(dt);
    if (this.ending === 'win') {
      // walk into the door
      p.vx = approach(p.vx, this.endT < 0.8 ? 260 : 0, 5, dt);
      p.x += p.vx * dt;
      p.phase += p.vx * dt * 0.0215;
      p.runAmt = approach(p.runAmt, clamp(p.vx / 300, 0, 1), 6, dt);
      p.airBlend = approach(p.airBlend, 0, 10, dt);
      p.y = Math.min(GY, p.y + 900 * dt);
      this.moldX -= 300 * dt; // mold retreats
      this.camX = approach(this.camX, END_X + 210 - this.view.vw / 2, 2.5, dt);
      if (this.endT > 1.6 && this.endT - dt <= 1.6) this.onEnd?.('win');
    } else if (this.ending === 'molded') {
      this.moldX += 520 * dt;
      p.vx = approach(p.vx, 0, 4, dt);
      p.x += p.vx * dt;
      if (Math.random() < dt * 60) this.fx.add('spore', p.x + (Math.random() - 0.5) * 140, p.y - Math.random() * 160, { vx: (Math.random() - 0.5) * 100, vy: -60, color: 'rgba(170,240,110,0.95)', size: 3 + Math.random() * 4, max: 1.2 });
      if (this.endT > 1.5 && this.endT - dt <= 1.5) this.onEnd?.('molded');
    } else {
      p.vx = approach(p.vx, 0, 3, dt);
      p.x += p.vx * dt;
      p.runAmt = approach(p.runAmt, 0, 5, dt);
      if (this.endT > 1.6 && this.endT - dt <= 1.6) this.onEnd?.('mayo');
    }
    this.updateCamera2();
  }

  private updateCamera2() {
    if (this.ending !== 'win') this.camX = this.camX; // hold
  }

  // ------------------------------------------------------------------
  // render (world)
  // ------------------------------------------------------------------
  render(ctx: CanvasRenderingContext2D) {
    const v = this.view;
    const shake = this.fx.shakeAmt;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    const top = -v.oy, bottom = v.vh - v.oy;

    ctx.save();
    ctx.translate(sx, v.oy + sy);
    // backdrop with stage cross-fade
    const camX = this.camX;
    const centerX = camX + v.px;
    const st = this.stageAt(centerX);
    const th = this.themes[st];
    // fade from previous stage over the first 1400px of a new stage
    const fadeIn = st > 0 ? invLerp(STAGE_START[st] - 700, STAGE_START[st] + 700, centerX) : 1;
    if (fadeIn < 1) {
      drawBackdrop(ctx, this.themes[st - 1], camX, v.vw, top, bottom, this.t);
      ctx.globalAlpha = fadeIn;
    }
    drawBackdrop(ctx, th, camX, v.vw, top, bottom, this.t);
    ctx.globalAlpha = 1;
    // ambient particles behind world
    ctx.save();
    ctx.translate(-camX, 0);
    // decor (behind)
    for (const d of this.decor) {
      if (d.x < camX - 200 || d.x > camX + v.vw + 200) continue;
      drawDecor(ctx, d.decor!, d.x, GY, this.t, d.seed);
    }
    ctx.restore();

    // ground (cross-faded)
    const gth = this.themes[this.stageAt(centerX)];
    if (fadeIn < 1) {
      drawGround(ctx, this.themes[st - 1], camX, v.vw, bottom, this.t);
      ctx.globalAlpha = fadeIn;
    }
    drawGround(ctx, gth, camX, v.vw, bottom, this.t);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(-camX, 0);
    // entities behind player
    for (const e of this.ents) this.drawEnt(ctx, e, false);
    // player shadow
    const p = this.p;
    const shH = clamp(1 - (GY - p.y) / 400, 0.2, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.28 * shH})`;
    ctx.beginPath();
    ctx.ellipse(p.x + 2, (p.platform ? p.platform.y : GY) + 2, 34 * shH, 7 * shH, 0, 0, TAU);
    ctx.fill();
    this.drawPlayer(ctx);
    for (const e of this.ents) this.drawEnt(ctx, e, true);
    this.fx.draw(ctx);
    // the mold, in front of everything at the left
    const moldScreen = this.moldX - camX;
    if (moldScreen > -900) drawMold(ctx, this.moldX, top - 40, bottom + 40, GY, this.t, this.attract ? 0.3 : this.anger, p.y - 80);
    ctx.restore();

    ctx.restore();

    // danger vignette (screen space)
    const a = this.attract ? 0 : this.anger;
    if (a > 0.25) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * (4 + a * 6));
      const g = ctx.createLinearGradient(0, 0, v.vw * 0.45, 0);
      g.addColorStop(0, `rgba(80,200,60,${(a - 0.25) * 0.55 * (0.7 + 0.3 * pulse)})`);
      g.addColorStop(1, 'rgba(80,200,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, v.vw * 0.45, v.vh);
    }
    if (this.p.pear > 0) {
      const g = ctx.createRadialGradient(v.vw / 2, v.vh / 2, v.vh * 0.3, v.vw / 2, v.vh / 2, v.vw * 0.7);
      g.addColorStop(0, 'rgba(255,230,107,0)');
      g.addColorStop(1, `rgba(255,220,90,${0.18 + 0.08 * Math.sin(this.t * 8)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, v.vw, v.vh);
    }
    // vignette
    const vg = ctx.createRadialGradient(v.vw / 2, v.vh * 0.55, v.vh * 0.35, v.vw / 2, v.vh * 0.55, Math.max(v.vw, v.vh) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,4,20,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, v.vw, v.vh);
    if (this.fx.flash > 0) {
      ctx.fillStyle = rgba(this.fx.flashColor.startsWith('#') ? this.fx.flashColor : '#ffffff', this.fx.flash * 0.5);
      ctx.fillRect(0, 0, v.vw, v.vh);
    }
    // ending overlays in world-time
    if (this.ending === 'mayo') this.drawMayoWave(ctx);
    if (this.ending === 'molded') {
      const k = clamp((this.endT - 0.6) / 0.9, 0, 1);
      ctx.fillStyle = `rgba(14,40,18,${k * 0.85})`;
      ctx.fillRect(0, 0, v.vw, v.vh);
    }
    if (this.ending === 'win') {
      const k = clamp((this.endT - 0.9) / 0.7, 0, 1);
      ctx.fillStyle = `rgba(255,248,240,${k})`;
      ctx.fillRect(0, 0, v.vw, v.vh);
    }
  }

  private drawMayoWave(ctx: CanvasRenderingContext2D) {
    const v = this.view;
    const k = clamp(this.endT / 1.3, 0, 1);
    const y = lerp(-v.vh * 0.2, v.vh * 1.1, k * k);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(v.vw, -10);
    for (let x = v.vw; x >= 0; x -= 30) {
      const drip = Math.abs(Math.sin(x * 0.037 + 1.3)) * 80 + Math.sin(x * 0.11) * 14;
      ctx.lineTo(x, y + drip);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, y + 80);
    g.addColorStop(0, '#fffdf2');
    g.addColorStop(1, '#f6e8b0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#d9c47a';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.p;
    const pose = this.pose;
    pose.t = this.t;
    pose.run = p.phase;
    pose.runAmt = p.runAmt;
    pose.air = p.airBlend;
    pose.vy = p.vy;
    pose.slide = p.slideBlend;
    pose.stumble = Math.min(1, p.stumble * 4);
    pose.slap = p.slapT;
    pose.spin = p.spin;
    pose.blink = p.blink;
    pose.holdPie = p.pie > 0;
    pose.mayo = p.mayo / 100;
    pose.outfit = 'maid';
    let expr: Expr = 'run';
    if (this.ending === 'mayo') expr = 'blank';
    else if (this.ending === 'molded') expr = 'panic';
    else if (this.ending === 'win') expr = 'happy';
    else if (p.stumble > 0) expr = 'hurt';
    else if (p.happyT > 0 || p.pear > 0) expr = 'happy';
    else if (!this.attract && this.anger > 0.62) expr = 'panic';
    else if (!this.started) expr = 'smug';
    pose.expr = expr;
    if (p.invuln > 0 && p.stumble <= 0 && Math.floor(this.t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    // pear: golden aura
    if (p.pear > 0) {
      const g = ctx.createRadialGradient(p.x, p.y - 70, 10, p.x, p.y - 70, 120);
      const hue = (this.t * 300) % 360;
      g.addColorStop(0, `hsla(${hue},100%,75%,0.5)`);
      g.addColorStop(1, `hsla(${hue},100%,70%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 70, 120, 0, TAU);
      ctx.fill();
    }
    if (p.pickle > 0 || p.dashing) {
      // afterimages
      ctx.save();
      ctx.globalAlpha = 0.18;
      for (let i = 1; i <= 2; i++) drawAstray(ctx, p.x - i * 26, p.y, pose, 1.02);
      ctx.restore();
    }
    const squash = p.land * 0.08;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1 + squash, 1 - squash);
    drawAstray(ctx, 0, 0, pose, 1.02);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (this.ending === 'mayo') {
      // pile of mayo over the character
      const k = clamp((this.endT - 0.4) / 0.6, 0, 1);
      ctx.save();
      ctx.translate(p.x, GY);
      ctx.beginPath();
      ctx.moveTo(-90, 0);
      ctx.quadraticCurveTo(-80, -140 * k, 0, -170 * k);
      ctx.quadraticCurveTo(80, -140 * k, 90, 0);
      ctx.closePath();
      ctx.fillStyle = '#fff9e4';
      ctx.fill();
      ctx.strokeStyle = '#d9c47a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEnt(ctx: CanvasRenderingContext2D, e: Ent, front: boolean) {
    const v = this.view;
    if (e.x + e.w < this.camX - 300 || e.x > this.camX + v.vw + 300) return;
    const isFront = e.type === 'star' || e.type === 'power' || e.type === 'drop' || e.type === 'blob' || (e.type === 'bingus' && e.flying);
    if (isFront !== front) return;
    const th = this.themes[this.stageAt(e.x)];
    switch (e.type) {
      case 'lowpipe':
        drawLowPipe(ctx, e.x, e.y, e.w, e.h, PIPE_STYLES[e.style ?? 'steel'], this.t, e.seed);
        break;
      case 'tallpipe':
        drawTallPipe(ctx, e.x, e.y, e.w, e.h, PIPE_STYLES[e.style ?? 'steel'], this.t, e.seed);
        break;
      case 'overpipe':
        drawOverPipe(ctx, e.x, e.y, e.w, PIPE_STYLES[e.style ?? 'steel'], this.t, e.seed, !!e.nozzle);
        break;
      case 'vent':
        drawSteamVent(ctx, e.x, e.y, e.w, e.timer ?? 0, this.t);
        break;
      case 'puddle':
        if (e.timer !== undefined) ctx.globalAlpha = clamp(e.timer, 0, 1);
        drawMayoPuddle(ctx, e.x, e.y, e.w, this.t, e.seed);
        ctx.globalAlpha = 1;
        break;
      case 'drop':
        drawMayoDrop(ctx, e.x, e.y, e.vy);
        break;
      case 'blob':
        drawMayoDrop(ctx, e.x, e.y, e.vy);
        break;
      case 'jar':
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(e.x, GY + 1, 24, 5, 0, 0, TAU);
        ctx.fill();
        drawMayoJar(ctx, e.x, e.y, e.rot ?? 0);
        break;
      case 'bottle':
        drawMayoBottle(ctx, e.x, e.y, e.phase ?? 0);
        break;
      case 'platform':
        drawPlatform(ctx, th, e.x, e.y, e.w);
        break;
      case 'bingus': {
        if (!e.flying && e.kind !== 'balloon') {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(e.x + 4, GY + 1, e.kind === 'chonk' ? 50 : 32, 5, 0, 0, TAU);
          ctx.fill();
        }
        drawBingus(ctx, e.x, e.y, e.kind!, e.look!, {
          t: e.t + (e.phase ?? 0),
          walk: (e.t + (e.phase ?? 0)) * (e.kind === 'chonk' ? 6 : 10),
          squash: e.squash ?? 0,
          flying: !!e.flying,
          spin: e.spin ?? 0,
          dizzy: (e.squash ?? 0) > 0,
          boxOpen: e.boxOpen,
          scared: e.x - this.p.x < 200 && e.x > this.p.x ? 1 : 0,
        });
        break;
      }
      case 'star':
        drawStar(ctx, e.x, e.y, this.t, e.big);
        break;
      case 'power':
        drawPowerBubble(ctx, e.x, e.y, e.power!, this.t);
        break;
      case 'house':
        drawHouse(ctx, e.x, e.y, this.t, this.ending === 'win' ? clamp(this.endT / 0.8, 0, 1) : 0);
        break;
    }
  }
}
