import fs from 'fs';
import path from 'path';

export interface SceneLabelsData {
  ch?: Record<number, string>;
  aux?: Record<number, string>;
  bus?: Record<number, string>;
}

export type SceneLabelsStore = Record<string, SceneLabelsData>;

export class SceneLabelsStorage {
  private labelsFilePath: string;
  private store: SceneLabelsStore = {};

  constructor(customPath?: string) {
    this.labelsFilePath =
      customPath ||
      process.env.LABELS_FILE_PATH ||
      path.resolve(process.env.DATA_DIR || process.cwd(), 'data', 'scene-labels.json');
    this.store = this.load();
  }

  public load(): SceneLabelsStore {
    try {
      if (fs.existsSync(this.labelsFilePath)) {
        const raw = fs.readFileSync(this.labelsFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to read scene labels:', err);
    }
    return {};
  }

  public save(): void {
    try {
      const dir = path.dirname(this.labelsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.labelsFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.labelsFilePath);
    } catch (err) {
      console.error('Failed to save scene labels:', err);
    }
  }

  public get(sceneNo: number): SceneLabelsData | undefined {
    return this.store[String(sceneNo)];
  }

  public setLabel(sceneNo: number, target: 'ch' | 'aux' | 'bus', id: number, name: string): void {
    const scKey = String(sceneNo);
    if (!this.store[scKey]) this.store[scKey] = {};
    if (!this.store[scKey][target]) this.store[scKey][target] = {};
    this.store[scKey][target]![id] = name;
    this.save();
  }

  public snapshotScene(sceneNo: number, data: SceneLabelsData): void {
    const scKey = String(sceneNo);
    this.store[scKey] = data;
    this.save();
  }

  public getChannelStoredName(sceneNo: number, channelNumber: number): string | undefined {
    return this.store[String(sceneNo)]?.ch?.[channelNumber];
  }
}
