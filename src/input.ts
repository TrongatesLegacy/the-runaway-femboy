export type Action = 'jump' | 'slide' | 'dash' | 'slap' | 'pause';

const KEYMAP: Record<string, Action> = {
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  KeyZ: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  ArrowRight: 'dash',
  KeyD: 'dash',
  KeyX: 'slap',
  KeyF: 'slap',
  KeyJ: 'slap',
  Escape: 'pause',
  KeyP: 'pause',
};

class Input {
  private held = new Set<Action>();
  private pressed = new Map<Action, number>();
  private pointerActions = new Map<number, Action>();
  /** True once the player has used a touch screen; drives on-screen controls. */
  touch = matchMedia('(pointer: coarse)').matches;
  onAnyInput: (() => void) | null = null;
  onPause: (() => void) | null = null;
  onTouchChange: ((touch: boolean) => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (a) {
        // don't hijack keys while a UI control has focus (sliders, buttons)
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if ((tag === 'INPUT' || tag === 'BUTTON') && a !== 'pause') return;
        e.preventDefault();
        if (!e.repeat) this.down(a);
      }
      this.onAnyInput?.();
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.up(a);
    });
    window.addEventListener('blur', () => this.releaseAll());
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch' && !this.touch) {
          this.touch = true;
          this.onTouchChange?.(true);
        }
        this.onAnyInput?.();
      },
      { capture: true },
    );
  }

  /** Wire a DOM element to act as a hold-able button for an action. */
  bindButton(el: HTMLElement, action: Action) {
    const start = (e: PointerEvent) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.pointerActions.set(e.pointerId, action);
      el.classList.add('is-down');
      this.down(action);
    };
    const end = (e: PointerEvent) => {
      if (this.pointerActions.get(e.pointerId) !== action) return;
      this.pointerActions.delete(e.pointerId);
      el.classList.remove('is-down');
      if (![...this.pointerActions.values()].includes(action)) this.up(action);
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private down(a: Action) {
    if (a === 'pause') {
      this.onPause?.();
      return;
    }
    if (!this.held.has(a)) this.pressed.set(a, performance.now());
    this.held.add(a);
  }
  private up(a: Action) {
    this.held.delete(a);
  }

  isHeld(a: Action) {
    return this.held.has(a);
  }
  /** Edge-triggered: true once per press. */
  consume(a: Action) {
    if (this.pressed.has(a)) {
      this.pressed.delete(a);
      return true;
    }
    return false;
  }
  peek(a: Action) {
    return this.pressed.has(a);
  }
  /** Drop edge presses nobody consumed within 150ms (e.g. slide presses). */
  clearPressedIfConsumedStale() {
    const now = performance.now();
    for (const [a, t] of this.pressed) if (now - t > 150) this.pressed.delete(a);
  }
  /** Simulate a tap of the jump button (canvas tap). */
  private tapTimer = 0;
  tapJump() {
    // always register a fresh press so quick double-taps give a double jump
    this.pressed.set('jump', performance.now());
    this.held.add('jump');
    clearTimeout(this.tapTimer);
    this.tapTimer = window.setTimeout(() => this.up('jump'), 220);
  }
  releaseAll() {
    this.held.clear();
    this.pressed.clear();
    this.pointerActions.clear();
    document.querySelectorAll('.is-down').forEach((el) => el.classList.remove('is-down'));
  }
}

export const input = new Input();
