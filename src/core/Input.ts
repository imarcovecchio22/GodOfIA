import type { PlayerInput } from '../entities/Player';

/** Acciones de un solo disparo; se acumulan hasta que un paso de simulación las consume. */
type PressAction = 'attack' | 'heavy' | 'axe' | 'recall' | 'dodge';

const KEY_ACTIONS: Partial<Record<string, PressAction>> = {
  Space: 'dodge',
  KeyQ: 'axe',
  KeyE: 'recall',
};

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Teclado y mouse traducidos a acciones. El juego lee `PlayerInput` por paso de simulación,
 * así que una pulsación durante el hit-stop no se pierde: espera al próximo paso.
 * Pensado para sumar gamepad en la fase 6 sin tocar la simulación.
 */
export class Input {
  /** Solo se registran acciones mientras se está jugando. */
  enabled = false;
  /** Teclas que no son de gameplay (pausa, silencio); se reciben siempre. */
  onKeyDown: ((code: string) => void) | null = null;

  private readonly held = new Set<string>();
  private readonly pressed = new Set<PressAction>();
  private lookX = 0;
  private lookY = 0;
  private readonly out: PlayerInput = {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    attack: false,
    heavy: false,
    axe: false,
    recall: false,
    dodge: false,
  };

  constructor(private readonly lookEnabled: () => boolean) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('mousedown', this.mouseDown);
    document.addEventListener('mousemove', this.mouseMove);
    window.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.held.clear();
    });
  }

  private readonly keyDown = (ev: KeyboardEvent): void => {
    this.held.add(ev.code);
    if (PREVENT_DEFAULT.has(ev.code)) ev.preventDefault();
    this.onKeyDown?.(ev.code);
    if (!this.enabled || ev.repeat) return;
    const action = KEY_ACTIONS[ev.code];
    if (action) this.pressed.add(action);
  };

  private readonly keyUp = (ev: KeyboardEvent): void => {
    this.held.delete(ev.code);
  };

  private readonly mouseDown = (ev: MouseEvent): void => {
    if (!this.enabled) return;
    if (ev.button === 0) this.pressed.add('attack');
    else if (ev.button === 2) this.pressed.add('heavy');
  };

  private readonly mouseMove = (ev: MouseEvent): void => {
    if (!this.lookEnabled()) return;
    this.lookX += ev.movementX;
    this.lookY += ev.movementY;
  };

  /** Movimiento acumulado del mouse desde la última llamada. */
  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.lookX, dy: this.lookY };
    this.lookX = this.lookY = 0;
    return r;
  }

  /** Estado para un paso de simulación. El objeto se reutiliza: no guardarlo. */
  consumeStep(): PlayerInput {
    const h = this.held;
    const o = this.out;
    o.moveX = (h.has('KeyD') ? 1 : 0) - (h.has('KeyA') ? 1 : 0);
    o.moveZ = (h.has('KeyW') ? 1 : 0) - (h.has('KeyS') ? 1 : 0);
    o.sprint = h.has('ShiftLeft') || h.has('ShiftRight');
    o.attack = this.pressed.has('attack');
    o.heavy = this.pressed.has('heavy');
    o.axe = this.pressed.has('axe');
    o.recall = this.pressed.has('recall');
    o.dodge = this.pressed.has('dodge');
    this.pressed.clear();
    return o;
  }

  clearPressed(): void {
    this.pressed.clear();
    this.lookX = this.lookY = 0;
  }
}
