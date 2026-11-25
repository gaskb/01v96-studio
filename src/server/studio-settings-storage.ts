import fs from 'fs';
import path from 'path';
import { StudioSettings } from '../shared/types.js';

const DEFAULT_SETTINGS: StudioSettings = {
  faderGlideDbPerSec: 6,
  usbCable: 0,
  midiChannel: 1,
};

export class StudioSettingsStorage {
  private filePath: string;
  private settings: StudioSettings;

  constructor(customPath?: string) {
    this.filePath =
      customPath ||
      process.env.STUDIO_SETTINGS_PATH ||
      path.resolve(process.env.DATA_DIR || process.cwd(), 'data', 'studio-settings.json');
    this.settings = this.load();
  }

  public load(): StudioSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const glide = Number(parsed?.faderGlideDbPerSec);
        const usbCable = Number(parsed?.usbCable);
        const midiChannel = Number(parsed?.midiChannel);
        return {
          faderGlideDbPerSec: Number.isFinite(glide) && glide >= 1 && glide <= 60 ? glide : 6,
          usbCable: Number.isInteger(usbCable) && usbCable >= 0 && usbCable <= 7 ? usbCable : 0,
          midiChannel:
            Number.isInteger(midiChannel) && midiChannel >= 1 && midiChannel <= 16 ? midiChannel : 1,
        };
      }
    } catch (err) {
      console.error('Failed to read studio settings:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('Failed to save studio settings:', err);
    }
  }

  public get(): StudioSettings {
    return { ...this.settings };
  }

  public update(partial: Partial<StudioSettings>): StudioSettings {
    if (partial.faderGlideDbPerSec !== undefined) {
      const glide = Number(partial.faderGlideDbPerSec);
      if (Number.isFinite(glide)) {
        this.settings.faderGlideDbPerSec = Math.max(1, Math.min(60, Math.round(glide * 10) / 10));
      }
    }
    if (partial.usbCable !== undefined) {
      const cable = Math.round(Number(partial.usbCable));
      if (Number.isInteger(cable)) {
        this.settings.usbCable = Math.max(0, Math.min(7, cable));
      }
    }
    if (partial.midiChannel !== undefined) {
      const ch = Math.round(Number(partial.midiChannel));
      if (Number.isInteger(ch)) {
        this.settings.midiChannel = Math.max(1, Math.min(16, ch));
      }
    }
    this.save();
    return this.get();
  }
}
