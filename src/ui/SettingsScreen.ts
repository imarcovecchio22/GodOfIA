import type { Quality } from '../data/graphics';
import type { Settings } from './settings';

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Falta #${id} en index.html`);
  return e;
}

/** Pantalla de ajustes: cada cambio se aplica en vivo y se guarda. */
export class SettingsScreen {
  private readonly root = el('settings');
  private readonly sensitivity = el('setSensitivity') as HTMLInputElement;
  private readonly invertY = el('setInvertY') as HTMLInputElement;
  private readonly master = el('setMaster') as HTMLInputElement;
  private readonly music = el('setMusic') as HTMLInputElement;
  private readonly sfx = el('setSfx') as HTMLInputElement;
  private readonly quality = el('setQuality') as HTMLSelectElement;
  private onClose: (() => void) | null = null;

  constructor(
    private readonly current: () => Settings,
    private readonly onChange: (s: Settings) => void,
  ) {
    el('settingsForm').addEventListener('input', () => {
      this.onChange(this.read());
    });
    el('settingsBack').addEventListener('click', () => {
      this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private read(): Settings {
    return {
      sensitivity: Number(this.sensitivity.value),
      invertY: this.invertY.checked,
      master: Number(this.master.value),
      music: Number(this.music.value),
      sfx: Number(this.sfx.value),
      quality: this.quality.value as Quality,
    };
  }

  /** Muestra los ajustes; `onClose` vuelve a la pantalla de origen. */
  open(onClose: () => void): void {
    const s = this.current();
    this.sensitivity.value = String(s.sensitivity);
    this.invertY.checked = s.invertY;
    this.master.value = String(s.master);
    this.music.value = String(s.music);
    this.sfx.value = String(s.sfx);
    this.quality.value = s.quality;
    this.onClose = onClose;
    this.root.classList.remove('hidden');
    this.sensitivity.focus();
  }

  close(): void {
    this.root.classList.add('hidden');
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }
}
