import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one/400.css';
import './style.css';

import { audio, type VolumeSettings } from './audio';
import { input, type Action } from './input';
import { Game, END_X, type EndKind } from './game';
import { drawCountdown, drawHud } from './hud';
import { drawEndingScene } from './endings';
import { drawPear, drawPickle } from './art/things';
import { drawPie as drawPieIcon } from './art/character';
import { clamp, storage } from './util';
import { progress, ENDINGS, outfitProgress, type EndingId } from './progress';
import { OUTFITS, type OutfitId } from './art/outfits';
import { drawAstray, defaultPose } from './art/character';
import { drawRiceBowl } from './art/things';

type State = 'loading' | 'title' | 'countdown' | 'play' | 'paused' | 'result';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const canvas = $<HTMLCanvasElement>('#game');
const ctx = canvas.getContext('2d', { alpha: false })!;

let state: State = 'loading';
let game: Game;
let dpr = 1;
let scale = 1; // css px per logical px
let hudScale = 1;
let safeTop = 0;
let safeLeft = 0;
let safeRight = 0;
const HUD_PANEL = 78; // HUD panel height in HUD units (see hud.ts)
let cssW = 0, cssH = 0;
let countdown = 0;
let lastCountIdx = -1;
let endKind: EndKind | null = null;
let endSceneT = 0;
let resultShown = false;
let pausedFrom: State = 'play';
let frozen = false;
let runId = 0;
let freshUnlocks: OutfitId[] = [];
const sceneDelay = (k: EndKind) => (k === 'win' || k === 'secret' || k === 'coma' ? 1.7 : 0.9);
const slapBtn = document.querySelector('.tbtn-slap') as HTMLElement;
let slapOn = false;
const SETTINGS_KEY = 'trf.settings.v1';
const settings = storage.get(SETTINGS_KEY, { shake: true, touch: null as boolean | null });
const BEST_KEY = 'trf.best.v1';

// ---------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;top:0;left:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);visibility:hidden;pointer-events:none';
document.body.appendChild(safeProbe);

function layout() {
  const vv = window.visualViewport;
  cssW = Math.round(vv?.width ?? window.innerWidth);
  cssH = Math.round(vv?.height ?? window.innerHeight);
  dpr = Math.min(window.devicePixelRatio || 1, cssW * cssH > 1600 * 1000 ? 1.5 : 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const portrait = cssH > cssW;
  const W = portrait ? 820 : clamp((720 * cssW) / cssH, 1100, 1700);
  scale = Math.min(cssW / W, cssH / 720);
  const vw = cssW / scale, vh = cssH / scale;
  hudScale = Math.max(1, (portrait ? 0.68 : 0.62) / scale);
  const sp = getComputedStyle(safeProbe);
  safeTop = parseFloat(sp.paddingTop) || 0;
  safeLeft = parseFloat(sp.paddingLeft) || 0;
  safeRight = parseFloat(sp.paddingRight) || 0;
  // size & place the HTML pause button exactly like a HUD panel
  const unit = scale * hudScale;
  const pb = document.getElementById('btn-pause');
  if (pb) {
    const size = HUD_PANEL * unit;
    pb.style.top = `${safeTop + 14 * unit}px`;
    pb.style.right = `${safeRight + 18 * unit}px`;
    pb.style.width = pb.style.height = `${size}px`;
    pb.style.borderRadius = `${18 * unit}px`;
    pb.style.setProperty('--icon', `${Math.round(size * 0.42)}px`);
  }
  if (game) {
    game.view.vw = vw;
    game.view.vh = vh;
    game.view.oy = portrait ? (vh - 720) * (state === 'title' ? 0.86 : 0.32) : (vh - 720) * 0.5;
    game.view.px = portrait ? 270 : clamp(vw * 0.33, 380, 520);
  }
  document.body.classList.toggle('portrait', portrait);
}
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);

// ---------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------
function show(id: string, on = true) {
  $(id).classList.toggle('show', on);
}
function toast(msg: string, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout((t as unknown as { _h: number })._h);
  (t as unknown as { _h: number })._h = window.setTimeout(() => t.classList.remove('show'), ms);
}
function openModal(id: string) {
  show(id, true);
  audio.setMuffled(true);
  const first = $(id).querySelector<HTMLElement>('button, input');
  first?.focus({ preventScroll: true });
}
function closeModal(id: string) {
  show(id, false);
  if (state !== 'paused') audio.setMuffled(false);
}
function anyModalOpen() {
  return document.querySelector('.modal.show') !== null;
}

function setTouchVisible() {
  const on = settings.touch ?? input.touch;
  document.body.classList.toggle('touch', on);
  $<HTMLInputElement>('#opt-touch').checked = on;
  const playing = state === 'play' || state === 'countdown';
  show('#touch', on && playing);
}

// ---------------------------------------------------------------------
// states
// ---------------------------------------------------------------------
function toTitle() {
  state = 'title';
  layout();
  game.reset(true);
  game.outfit = progress.outfit;
  game.p.vx = 380;
  endKind = null;
  updateWardrobeButton();
  show('#title', true);
  show('#result', false);
  show('#btn-pause', false);
  setTouchVisible();
  const best = storage.get<number>(BEST_KEY, 0);
  $('#best').textContent = best ? `★ Best: ${best.toLocaleString()}` : '';
  audio.setMuffled(false);
  runId++;
  audio.release(['music/stage2', 'music/stage3', 'ambient/city', 'ambient/night']);
  audio.playMusic('music/title', 1.5);
  audio.stopAllAmbient(1);
  audio.setAmbient('ambient/sewer', 0.5);
}

function startRun() {
  audio.unlock();
  input.releaseAll();
  runId++;
  (document.activeElement as HTMLElement | null)?.blur?.();
  // free the long title track while running; prefetch stage 2
  audio.release(['music/title', 'music/stage3', 'ambient/night']);
  audio.prefetch(['music/stage2', 'ambient/city']);
  game.reset(false);
  game.outfit = progress.outfit;
  endKind = null;
  resultShown = false;
  freshUnlocks = [];
  state = 'countdown';
  layout();
  countdown = 0;
  lastCountIdx = -1;
  show('#title', false);
  show('#result', false);
  show('#btn-pause', true);
  setTouchVisible();
  audio.setMuffled(false);
  audio.playMusic(game.themes[0].music, 1.0);
  audio.stopAllAmbient(0.6);
  audio.setAmbient(game.themes[0].ambient, 0.9);
}

function pause() {
  if (state !== 'play' && state !== 'countdown') return;
  pausedFrom = state;
  state = 'paused';
  input.releaseAll();
  openModal('#modal-pause');
  audio.play('sfx/click');
}
function resume() {
  if (state !== 'paused') return;
  closeModal('#modal-pause');
  closeModal('#modal-settings');
  audio.setMuffled(false);
  state = pausedFrom;
  input.releaseAll();
  lastFrame = performance.now();
}

function onEnd(kind: EndKind) {
  const id = runId;
  endKind = kind;
  state = 'result';
  endSceneT = 0;
  show('#btn-pause', false);
  show('#touch', false);
  audio.stopAllAmbient(1);
  const jingle = kind === 'win' || kind === 'secret' || kind === 'furry' ? 'music/win' : kind === 'molded' ? 'music/lose' : 'music/mayo';
  const st = game.stats;
  freshUnlocks = progress.commitRun(
    { stars: st.stars, stomps: st.stomps, slaps: st.slaps, pearSmashes: st.pearSmashes, pickles: st.pickles, pipes: st.pipes, rice: st.rice },
    kind as EndingId,
  );
  audio.playMusic(jingle, 0.2);
  audio.prefetch(['music/title']);
  window.setTimeout(() => {
    if (state === 'result' && runId === id) audio.playMusic('music/title', 2.5, 0.7);
  }, kind === 'win' || kind === 'secret' ? 9000 : 5000);
  if (kind === 'molded') audio.setAmbient('ambient/mold', 0.6, 1);
  window.setTimeout(() => runId === id && showResult(), sceneDelay(kind) * 1000);
}

function showResult() {
  if (state !== 'result' || !endKind || resultShown) return;
  resultShown = true;
  const s = game.stats;
  const r = $('#result');
  r.classList.remove('win', 'molded', 'mayo', 'secret', 'furry', 'coma');
  r.classList.add(endKind);
  const titles: Record<EndKind, [string, string]> = {
    win: ['HOME SAFE!', 'He got his regular back ☆'],
    molded: ['MOLDED!', 'The mold caught up. Fuzzy and green forever…'],
    mayo: ["MAYO'D!", 'Covered head to toe in mayo. Bad ending.'],
    secret: ['SECRET ENDING ♡', 'Turns out… he secretly loves dressing up.'],
    furry: ['BONUS ENDING!', 'Too many binguses. Turns out he’s secretly a furry.'],
    coma: ['FOOD COMA!', 'Way too much brothy rice. He passed out. Zzz…'],
  };
  $('#res-title').textContent = titles[endKind][0];
  $('#res-sub').textContent = titles[endKind][1];
  const score = game.score + Math.floor(game.p.x / 50) + (endKind === 'win' ? 1000 : endKind === 'secret' ? 1500 : 0);
  const special: Partial<Record<EndKind, string>> = { secret: '♡', furry: 'nya', coma: 'Zz' };
  const rank =
    special[endKind] ??
    (endKind !== 'win'
      ? `${Math.round(clamp(game.p.x / END_X, 0, 1) * 100)}%`
      : score >= 5200 && s.hits <= 2
        ? 'S'
        : score >= 3800
          ? 'A'
          : score >= 2600
            ? 'B'
            : 'C');
  const rk = $('#res-rank');
  rk.textContent = rank;
  rk.style.fontSize = rank.length > 2 ? '21px' : rank.length > 1 ? '28px' : '';
  const mins = Math.floor(s.time / 60);
  const secs = Math.floor(s.time % 60).toString().padStart(2, '0');
  const items: [string, string][] = [
    ['Distance', `${Math.floor(game.p.x / 50)}m`],
    ['Stars', `${s.stars}`],
    ['Time', `${mins}:${secs}`],
    ['Stomps', `${s.stomps}`],
    ['Slaps', `${s.slaps}`],
    ['Best combo', `${s.bestCombo}`],
  ];
  $('#res-stats').innerHTML = items.map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  $('#res-score').textContent = score.toLocaleString();
  const best = storage.get<number>(BEST_KEY, 0);
  if (score > best) {
    storage.set(BEST_KEY, score);
    $('#res-best').textContent = best ? '★ New best score! ★' : '';
  } else $('#res-best').textContent = `Best: ${best.toLocaleString()}`;
  const un = $('#res-unlocks');
  un.innerHTML = freshUnlocks
    .map((o) => `<div class="unlock"><canvas data-outfit="${o}" width="120" height="150"></canvas><span><small>NEW OUTFIT</small>${OUTFITS.find((d) => d.id === o)?.name ?? o}</span></div>`)
    .join('');
  un.querySelectorAll<HTMLCanvasElement>('canvas[data-outfit]').forEach((c) => paintOutfit(c, c.dataset.outfit as OutfitId, true));
  if (freshUnlocks.length) window.setTimeout(() => audio.play('sfx/powerup', { vol: 0.6 }), 900);
  show('#result', true);
  const id = runId;
  window.setTimeout(() => {
    if (runId === id && state === 'result' && !input.touch) $<HTMLButtonElement>('#btn-again').focus({ preventScroll: true });
  }, 400);
}

// ---------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------
const STEP = 1 / 120;
let acc = 0;
let lastFrame = performance.now();

function frame(now: number) {
  requestAnimationFrame(frame);
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (dt > 0.1) dt = 0.1;
  if (state === 'loading' || frozen) return;
  tick(dt);
  render();
}

function tick(dt: number) {
  if (state === 'paused') return;
  if (state === 'countdown') {
    countdown += dt;
    const idx = Math.floor(countdown / 0.62);
    if (idx !== lastCountIdx && idx <= 3) {
      lastCountIdx = idx;
      if (idx === 1) void game.themes[1].layers; // build during countdown, not mid-run
      if (idx === 2) void game.themes[2].layers;
      audio.play(idx < 3 ? 'sfx/countdown' : 'sfx/go', { vol: 0.6 });
      if (idx === 3) game.start();
    }
    if (countdown > 0.62 * 4 + 0.2) state = 'play';
  }
  if (state === 'result') endSceneT += dt;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 12) {
    game.update(STEP);
    input.clearPressedIfConsumedStale();
    acc -= STEP;
    n++;
  }
  if (n >= 12) acc = 0;
  // slap button visibility (only touch the DOM on change)
  const on = game.p.pie > 0 && (state === 'play' || state === 'countdown');
  if (on !== slapOn) {
    slapOn = on;
    slapBtn.classList.toggle('on', on);
  }
}

function render() {
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  const v = game.view;
  if (state === 'result' && endKind && endSceneT > sceneDelay(endKind)) {
    // ending vignette scene
    const d = sceneDelay(endKind);
    const k = clamp((endSceneT - d) / 0.5, 0, 1);
    drawEndingScene(ctx, endKind, v.vw, v.vh, endSceneT - d, progress.outfit);
    if (k < 1) {
      const fade: Record<EndKind, string> = { win: '255,248,240', secret: '255,220,240', furry: '255,200,225', coma: '20,14,40', mayo: '255,249,228', molded: '14,40,18' };
      ctx.fillStyle = `rgba(${fade[endKind]},${(1 - k) * 0.9})`;
      ctx.fillRect(0, 0, v.vw, v.vh);
    }
    return;
  }
  game.render(ctx);
  if (state === 'play' || state === 'countdown' || state === 'paused') {
    ctx.save();
    ctx.scale(hudScale, hudScale);
    const unit = scale * hudScale;
    const reserve = HUD_PANEL + 12;
    ctx.translate(safeLeft / unit, 0);
    const hv = { ...v, vw: (cssW - safeLeft - safeRight) / unit, vh: v.vh / hudScale };
    const saved = game.view;
    game.view = hv;
    drawHud(ctx, game, document.body.classList.contains('touch'), safeTop / (scale * hudScale), reserve);
    game.view = saved;
    ctx.restore();
  }
  if (state === 'countdown') {
    const idx = Math.min(3, Math.floor(countdown / 0.62));
    const k = (countdown - idx * 0.62) / 0.62;
    drawCountdown(ctx, v.vw, v.vh, ['3', '2', '1', 'RUN!'][idx], k);
  }
}

// ---------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------
function wireUi() {
  // buttons click sounds
  document.querySelectorAll<HTMLButtonElement>('.btn, .icon-btn').forEach((b) => {
    b.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') audio.play('sfx/hover', { vol: 0.35 });
    });
    b.addEventListener('click', () => {
      audio.unlock();
      audio.play('sfx/click', { vol: 0.6 });
    });
  });
  $('#btn-play').addEventListener('click', startRun);
  $('#btn-again').addEventListener('click', startRun);
  $('#btn-menu').addEventListener('click', toTitle);
  $('#btn-howto').addEventListener('click', () => openModal('#modal-howto'));
  $('#btn-wardrobe').addEventListener('click', () => {
    buildWardrobe();
    openModal('#modal-wardrobe');
  });
  $('#btn-settings').addEventListener('click', () => openModal('#modal-settings'));
  $('#btn-pause').addEventListener('click', pause);
  $('#btn-resume').addEventListener('click', resume);
  $('#btn-pause-settings').addEventListener('click', () => openModal('#modal-settings'));
  $('#btn-restart').addEventListener('click', () => {
    closeModal('#modal-pause');
    startRun();
  });
  $('#btn-quit').addEventListener('click', () => {
    closeModal('#modal-pause');
    toTitle();
  });
  document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      const m = b.closest('.modal') as HTMLElement;
      closeModal('#' + m.id);
      if (state === 'paused') audio.setMuffled(true);
    }),
  );
  document.querySelectorAll<HTMLElement>('.modal').forEach((m) =>
    m.addEventListener('pointerdown', (e) => {
      if (e.target === m && m.id !== 'modal-pause') closeModal('#' + m.id);
    }),
  );

  // volume sliders
  document.querySelectorAll<HTMLInputElement>('input[data-vol]').forEach((inp) => {
    const key = inp.dataset.vol as keyof VolumeSettings;
    const out = inp.parentElement!.querySelector('output')!;
    const sync = () => {
      out.textContent = `${inp.value}%`;
      inp.style.setProperty('--v', `${inp.value}%`);
    };
    inp.value = String(Math.round(audio.volumes[key] * 100));
    sync();
    let lastBeep = 0;
    inp.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(key, Number(inp.value) / 100);
      sync();
      const now = performance.now();
      if (now - lastBeep > 120 && (key === 'sfx' || key === 'master')) {
        lastBeep = now;
        audio.play('sfx/star', { vol: 0.5, minGap: 0 });
      }
    });
  });
  const shake = $<HTMLInputElement>('#opt-shake');
  shake.checked = settings.shake;
  shake.addEventListener('change', () => {
    settings.shake = shake.checked;
    game.fx.shakeOn = shake.checked;
    storage.set(SETTINGS_KEY, settings);
  });
  const touchOpt = $<HTMLInputElement>('#opt-touch');
  touchOpt.addEventListener('change', () => {
    settings.touch = touchOpt.checked;
    storage.set(SETTINGS_KEY, settings);
    setTouchVisible();
  });
  $('#btn-fullscreen').addEventListener('click', () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => toast('Fullscreen not available here'));
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else toast('Tip: “Add to Home Screen” to play fullscreen');
  });

  // touch buttons
  document.querySelectorAll<HTMLElement>('.tbtn').forEach((b) => input.bindButton(b, b.dataset.act as Action));
  input.onTouchChange = () => setTouchVisible();
  input.onPause = () => {
    if (state === 'paused') resume();
    else if (anyModalOpen()) document.querySelectorAll('.modal.show').forEach((m) => closeModal('#' + m.id));
    else pause();
  };
  input.onAnyInput = () => audio.unlock();
  window.addEventListener('pointerup', () => audio.resume(), { capture: true });
  window.addEventListener('touchend', () => audio.resume(), { capture: true });
  // start from title with Space/Enter
  window.addEventListener('keydown', (e) => {
    if (anyModalOpen()) return;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return; // let focused controls handle Enter/Space
    if (state === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      startRun();
    } else if (state === 'result' && resultShown && e.code === 'Space') {
      e.preventDefault();
      startRun();
    }
  });
  // tapping the canvas also jumps (nice on desktop/trackpads + touch when controls hidden)
  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (state === 'play' && !document.body.classList.contains('touch')) {
      e.preventDefault();
      input.tapJump();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state === 'play' || state === 'countdown') pause();
      audio.suspend();
    } else audio.resume();
  });

  // power-up icons in how-to
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-icon]').forEach((c) => {
    const x = c.getContext('2d')!;
    x.scale(2, 2);
    const k = c.dataset.icon;
    if (k === 'pickle') drawPickle(x, 24, 24, 0.95);
    else if (k === 'pear') drawPear(x, 24, 26, 0.95);
    else if (k === 'rice') drawRiceBowl(x, 24, 30, 1.15, 0.5);
    else drawPieIcon(x, 24, 30, Math.PI, 1.2);
  });
}

// ---------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------
async function boot() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('40px "Lilita One"'),
        document.fonts.load('400 20px "Fredoka"'),
        document.fonts.load('600 20px "Fredoka"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fonts are optional */
  }
  game = new Game();
  game.fx.shakeOn = settings.shake;
  game.onEnd = onEnd;
  game.onStage = (s) => {
    if (game.attract) return;
    if (s > 0) audio.release([game.themes[s - 1].music]);
    if (s < 2) audio.prefetch([game.themes[s + 1].music, game.themes[s + 1].ambient]);
    audio.playMusic(game.themes[s].music, 2);
    audio.stopAllAmbient(1.5);
    audio.setAmbient(game.themes[s].ambient, 0.9, 1.5);
  };
  layout();
  wireUi();
  toTitle();
  buildWardrobe();
  show('#loading', false);
  requestAnimationFrame(frame);

  // debug / test hooks
  (window as unknown as Record<string, unknown>).__trf = {
    game,
    startRun,
    toTitle,
    pause,
    resume,
    get state() {
      return state;
    },
    end: (k: EndKind) => game.beginEnding(k),
    warp: (x: number) => {
      game.p.x = x;
      game.moldX = x - 420;
      game.camX = x - game.view.px;
      game.ents = game.ents.filter((e) => e.x > x + 400);
      (game as unknown as { genX: number }).genX = Math.max((game as unknown as { genX: number }).genX, x + 600);
      (game as unknown as { decorX: number }).decorX = x - 400;
    },
    freeze: (on = true) => {
      frozen = on;
    },
    step: (secs: number) => {
      for (let i = 0; i < secs * 120; i++) tick(STEP);
      render();
    },
    setState: (s: State) => {
      state = s;
    },
    render,
    layout,
  };
  (window as unknown as { __done: boolean }).__done = true;
}

void boot();


// ---------------------------------------------------------------------
// wardrobe
// ---------------------------------------------------------------------
function paintOutfit(c: HTMLCanvasElement, id: OutfitId, unlocked: boolean) {
  const x = c.getContext('2d')!;
  const w = c.width, h = c.height;
  x.clearRect(0, 0, w, h);
  const sc = h / 105;
  drawAstray(x, w / 2 - 2, h - 8, { ...defaultPose(), t: 1.3, outfit: id, expr: id === 'regular' ? 'happy' : 'smug' }, sc * 0.55);
  if (!unlocked) {
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#1a1030';
    x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
  }
}

function updateWardrobeButton() {
  const n = OUTFITS.filter((o) => progress.isUnlocked(o.id)).length;
  const b = document.getElementById('btn-wardrobe');
  if (b) b.innerHTML = `Wardrobe <small>${n}/${OUTFITS.length}</small>`;
}

function buildWardrobe() {
  const grid = $('#wardrobe-grid');
  grid.innerHTML = '';
  for (const o of OUTFITS) {
    const unlocked = progress.isUnlocked(o.id);
    const [cur, max] = outfitProgress(progress.data, o.id);
    const card = document.createElement('button');
    card.className = 'outfit' + (unlocked ? '' : ' locked') + (progress.outfit === o.id ? ' selected' : '');
    card.type = 'button';
    card.setAttribute('aria-label', unlocked ? `Wear ${o.name}` : `${o.name} (locked: ${o.how})`);
    const prog = !unlocked && max > 1 ? `<i class="bar"><b style="width:${Math.min(100, (cur / max) * 100)}%"></b></i><em>${Math.min(cur, max)}/${max}</em>` : '';
    card.innerHTML = `<canvas width="132" height="160"></canvas><strong>${unlocked ? o.name : '???'}</strong><span>${unlocked ? (progress.outfit === o.id ? 'Wearing' : 'Tap to wear') : '🔒 ' + o.how}</span>${prog}`;
    paintOutfit(card.querySelector('canvas')!, o.id, unlocked);
    card.addEventListener('click', () => {
      audio.unlock();
      if (!unlocked) {
        audio.play('sfx/bonk', { vol: 0.4, rate: 1.4 });
        return;
      }
      progress.setOutfit(o.id);
      game.outfit = o.id;
      audio.play('sfx/transform', { vol: 0.5 });
      buildWardrobe();
      updateWardrobeButton();
    });
    grid.appendChild(card);
  }
  const ends = $('#endings-list');
  ends.innerHTML = ENDINGS.map((e) => {
    const n = progress.data.endings[e.id] ?? 0;
    return `<div class="ending${n ? ' found' : ''}"><b>${n ? e.name : '???'}</b><span>${n ? `Seen ${n}×` : e.hint}</span></div>`;
  }).join('');
  const found = ENDINGS.filter((e) => (progress.data.endings[e.id] ?? 0) > 0).length;
  $('#endings-count').textContent = `${found}/${ENDINGS.length}`;
}
