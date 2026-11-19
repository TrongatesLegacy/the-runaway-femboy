import { clamp, storage } from './util';

export type Bus = 'music' | 'sfx' | 'ambient';
export interface VolumeSettings {
  master: number;
  music: number;
  sfx: number;
  ambient: number;
}

const DEFAULT_VOLUMES: VolumeSettings = { master: 0.5, music: 0.7, sfx: 0.85, ambient: 0.7 };
const VOL_KEY = 'trf.volumes.v1';

interface ManifestEntry {
  loop?: boolean;
  duration?: number;
}

/** Perceptual-ish slider → gain curve (50% ≈ -12 dB). */
const curve = (v: number) => clamp(v, 0, 1) ** 2;

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  key: string;
}

/** Fallback synth recipes so the game never goes silent if a file is missing. */
const SYNTH: Record<string, { f0: number; f1: number; dur: number; type: OscillatorType; vol: number }> = {
  'sfx/jump': { f0: 380, f1: 760, dur: 0.14, type: 'square', vol: 0.18 },
  'sfx/double_jump': { f0: 520, f1: 1100, dur: 0.16, type: 'square', vol: 0.18 },
  'sfx/star': { f0: 1200, f1: 1800, dur: 0.12, type: 'triangle', vol: 0.25 },
  'sfx/click': { f0: 900, f1: 700, dur: 0.05, type: 'triangle', vol: 0.25 },
  'sfx/hover': { f0: 1400, f1: 1300, dur: 0.03, type: 'sine', vol: 0.15 },
  'sfx/hit': { f0: 200, f1: 60, dur: 0.25, type: 'sawtooth', vol: 0.25 },
  'sfx/stomp': { f0: 300, f1: 700, dur: 0.18, type: 'sine', vol: 0.3 },
  'sfx/countdown': { f0: 660, f1: 660, dur: 0.12, type: 'square', vol: 0.15 },
  'sfx/go': { f0: 990, f1: 990, dur: 0.3, type: 'square', vol: 0.15 },
  'sfx/powerup': { f0: 400, f1: 1600, dur: 0.35, type: 'triangle', vol: 0.25 },
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private manifest: Record<string, ManifestEntry> = {};
  private ext = 'mp3';
  private base = './audio/';
  volumes: VolumeSettings;

  private musicVoice: Voice | null = null;
  private ambientVoices = new Map<string, Voice>();
  private wantedAmbient = new Map<string, number>();
  private lastPlay = new Map<string, number>();
  private wantedMusic: string | null = null;
  private manifestReady: Promise<void>;
  private muffle!: BiquadFilterNode;

  constructor() {
    this.volumes = { ...DEFAULT_VOLUMES, ...storage.get<Partial<VolumeSettings>>(VOL_KEY, {}) };
    const probe = document.createElement('audio');
    this.ext = probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
    this.manifestReady = fetch(this.base + 'manifest.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => {
        this.manifest = m || {};
      })
      .catch(() => {
        this.manifest = {};
      });
  }

  /** Must be called from a user gesture (tap/click/key) to satisfy autoplay rules. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.muffle = this.ctx.createBiquadFilter();
      this.muffle.type = 'lowpass';
      this.muffle.frequency.value = 20000;
      this.master.connect(this.muffle).connect(this.ctx.destination);
      for (const b of ['music', 'sfx', 'ambient'] as Bus[]) {
        const g = this.ctx.createGain();
        g.connect(this.master);
        this.buses[b] = g;
      }
      this.applyVolumes();
      // iOS: play a silent buffer inside the gesture to fully unlock.
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(this.ctx.destination);
      s.start(0);
      this.preload();
      if (this.wantedMusic) {
        const k = this.wantedMusic;
        this.wantedMusic = null;
        this.playMusic(k);
      }
    }
    this.resume();
  }

  get unlocked() {
    return !!this.ctx;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  /** Resume from 'suspended' and WebKit's 'interrupted' (calls, Siri, other apps). */
  resume() {
    const st = this.ctx?.state as string | undefined;
    if (this.ctx && st !== 'running' && st !== 'closed') void this.ctx.resume().catch(() => {});
  }

  setVolume(k: keyof VolumeSettings, v: number) {
    this.volumes[k] = clamp(v, 0, 1);
    storage.set(VOL_KEY, this.volumes);
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(curve(this.volumes.master), t, 0.03);
    this.buses.music.gain.setTargetAtTime(curve(this.volumes.music), t, 0.03);
    this.buses.sfx.gain.setTargetAtTime(curve(this.volumes.sfx), t, 0.03);
    this.buses.ambient.gain.setTargetAtTime(curve(this.volumes.ambient), t, 0.03);
  }

  /** Low-pass the whole mix (pause menu / endings). */
  setMuffled(on: boolean) {
    if (!this.ctx) return;
    this.muffle.frequency.setTargetAtTime(on ? 900 : 20000, this.ctx.currentTime, 0.12);
  }

  private preload() {
    void this.manifestReady.then(() => {
      const keys = Object.keys(this.manifest);
      const early = ['music/title', 'music/stage1', 'ambient/sewer', 'ambient/mold'];
      const first = keys.filter((k) => k.startsWith('sfx') || early.includes(k));
      // jingles are small; load them after the essentials. Stage music is fetched on demand.
      void Promise.all(first.map((k) => this.load(k))).then(() => {
        for (const k of keys) if (k === 'music/win' || k === 'music/lose' || k === 'music/mayo') void this.load(k);
      });
    });
  }

  /** Start loading these keys (e.g. next stage's music) ahead of time. */
  prefetch(keys: string[]) {
    if (!this.ctx) return;
    for (const k of keys) void this.load(k);
  }

  /** Free decoded buffers we no longer need (big music files on low-memory phones). */
  release(keys: string[]) {
    for (const k of keys) {
      if (this.musicVoice?.key === k || this.ambientVoices.has(k)) continue;
      this.buffers.delete(k);
      this.loading.delete(k);
    }
  }

  private load(key: string): Promise<AudioBuffer | null> {
    const existing = this.loading.get(key);
    if (existing) return existing;
    const p = this.manifestReady
      .then(() => {
        if (!this.ctx || !(key in this.manifest)) return null;
        return fetch(`${this.base}${key}.${this.ext}`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then(
            (ab) =>
              new Promise<AudioBuffer>((res, rej) => {
                // callback form for older Safari
                this.ctx!.decodeAudioData(ab, res, rej);
              }),
          )
          .then((buf) => {
            this.buffers.set(key, buf);
            return buf;
          });
      })
      .catch(() => null);
    this.loading.set(key, p);
    return p;
  }

  has(key: string) {
    return this.buffers.has(key);
  }

  /** Play a one-shot sound effect. */
  play(key: string, opts: { vol?: number; rate?: number; jitter?: number; minGap?: number; bus?: Bus } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const minGap = opts.minGap ?? 0.03;
    const last = this.lastPlay.get(key) ?? -1;
    if (now - last < minGap) return;
    this.lastPlay.set(key, now);
    const buf = this.buffers.get(key);
    const vol = opts.vol ?? 1;
    const bus = this.buses[opts.bus ?? 'sfx'];
    const rate = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (opts.jitter ?? 0.04));
    if (!buf) {
      const syn = SYNTH[key];
      if (syn && !(key in this.manifest)) this.synth(syn, vol, rate, bus);
      else void this.load(key);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(bus);
    src.start();
  }

  private synth(s: (typeof SYNTH)[string], vol: number, rate: number, bus: GainNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = s.type;
    o.frequency.setValueAtTime(s.f0 * rate, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, s.f1 * rate), t + s.dur);
    g.gain.setValueAtTime(s.vol * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + s.dur + 0.02);
  }

  private startLoop(key: string, bus: Bus, vol: number, fadeIn: number, loop: boolean): Voice | null {
    const buf = this.buffers.get(key);
    if (!this.ctx || !buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.max(0.01, fadeIn));
    src.connect(g).connect(this.buses[bus]);
    src.start();
    return { src, gain: g, key };
  }

  private stopVoice(v: Voice | null, fade: number) {
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.01, fade));
    try {
      v.src.stop(t + fade + 0.05);
    } catch {
      /* already stopped */
    }
  }

  currentMusic() {
    return this.wantedMusic ?? this.musicVoice?.key ?? null;
  }

  /** Crossfade to a music track. Jingles (non-looping) play once. */
  playMusic(key: string | null, fade = 1.2, vol = 1) {
    if (!this.ctx) {
      this.wantedMusic = key;
      return;
    }
    if (key && this.musicVoice?.key === key) {
      this.wantedMusic = null;
      this.musicVoice.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.3);
      return;
    }
    this.stopVoice(this.musicVoice, fade);
    this.musicVoice = null;
    if (!key) {
      this.wantedMusic = null;
      return;
    }
    this.wantedMusic = key;
    void this.load(key).then(() => {
      if (this.wantedMusic !== key) return;
      this.wantedMusic = null;
      const loop = this.manifest[key]?.loop ?? true;
      this.musicVoice = this.startLoop(key, 'music', vol, fade * 0.6, loop);
    });
  }

  /** Set (or start/stop) an ambient loop at a target volume. */
  setAmbient(key: string, vol: number, ramp = 0.6) {
    if (!this.ctx) return;
    if (vol <= 0.001) this.wantedAmbient.delete(key);
    else this.wantedAmbient.set(key, vol);
    const v = this.ambientVoices.get(key);
    if (vol <= 0.001) {
      if (v) {
        this.stopVoice(v, ramp);
        this.ambientVoices.delete(key);
      }
      return;
    }
    if (v) {
      v.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, ramp / 3);
      return;
    }
    if (!this.buffers.has(key)) {
      void this.load(key).then(() => {
        const want = this.wantedAmbient.get(key);
        if (want !== undefined && !this.ambientVoices.has(key) && this.buffers.has(key)) {
          const nv = this.startLoop(key, 'ambient', want, ramp, true);
          if (nv) this.ambientVoices.set(key, nv);
        }
      });
      return;
    }
    const nv = this.startLoop(key, 'ambient', vol, ramp, true);
    if (nv) this.ambientVoices.set(key, nv);
  }

  stopAllAmbient(fade = 0.8) {
    this.wantedAmbient.clear();
    for (const [k, v] of this.ambientVoices) {
      this.stopVoice(v, fade);
      this.ambientVoices.delete(k);
    }
  }
}

export const audio = new AudioEngine();
