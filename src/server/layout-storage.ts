import fs from 'fs';
import path from 'path';
import { ChannelLayoutConfig, LayoutStorageData } from '../shared/types.js';

export class LayoutStorage {
  private filePath: string;
  private data: LayoutStorageData = {
    presets: [],
  };

  constructor(customPath?: string) {
    this.filePath =
      customPath ||
      process.env.LAYOUTS_FILE_PATH ||
      path.resolve(process.env.DATA_DIR || process.cwd(), 'data', 'layouts.json');
    this.load();
  }

  public getFilePath(): string {
    return this.filePath;
  }

  public load(): LayoutStorageData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          activeLayout: parsed.activeLayout,
          presets: Array.isArray(parsed.presets) ? parsed.presets : [],
        };
        return this.data;
      }
    } catch (err) {
      console.error('Failed to read layouts file:', err);
    }
    this.data = { presets: [] };
    return this.data;
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('Failed to save layouts file:', err);
    }
  }

  public getActiveLayout(): ChannelLayoutConfig | undefined {
    return this.data.activeLayout;
  }

  public setActiveLayout(layout: ChannelLayoutConfig): void {
    this.data.activeLayout = layout;
    this.save();
  }

  public getPresets(): ChannelLayoutConfig[] {
    return this.data.presets;
  }

  public savePreset(preset: ChannelLayoutConfig): ChannelLayoutConfig[] {
    const name = (preset.presetName || 'Personalizzato').trim();
    const cleanPreset: ChannelLayoutConfig = {
      ...preset,
      presetName: name,
    };

    const existingIdx = this.data.presets.findIndex(
      (p) => (p.presetName || '').toLowerCase() === name.toLowerCase()
    );

    if (existingIdx !== -1) {
      this.data.presets[existingIdx] = cleanPreset;
    } else {
      this.data.presets.push(cleanPreset);
    }

    this.save();
    return this.data.presets;
  }

  public deletePreset(name: string): ChannelLayoutConfig[] {
    const target = name.trim().toLowerCase();
    this.data.presets = this.data.presets.filter(
      (p) => (p.presetName || '').trim().toLowerCase() !== target
    );
    this.save();
    return this.data.presets;
  }

  public getAll(): LayoutStorageData {
    return this.data;
  }
}
