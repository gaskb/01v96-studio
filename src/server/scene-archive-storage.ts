import fs from 'fs';
import path from 'path';
import { SceneBackupData } from '../shared/types.js';

export type SceneArchiveStore = Record<string, SceneBackupData>;

export class SceneArchiveStorage {
  private filePath: string;
  private store: SceneArchiveStore = {};

  constructor(customPath?: string) {
    this.filePath =
      customPath ||
      process.env.SCENES_ARCHIVE_PATH ||
      path.resolve(process.env.DATA_DIR || process.cwd(), 'data', 'scenes-archive.json');
    this.store = this.load();
  }

  public load(): SceneArchiveStore {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to read scenes archive:', err);
    }
    return {};
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('Failed to save scenes archive:', err);
    }
  }

  public getScene(sceneNo: number): SceneBackupData | undefined {
    return this.store[String(sceneNo)];
  }

  public hasScene(sceneNo: number): boolean {
    return !!this.store[String(sceneNo)];
  }

  public archiveScene(sceneNo: number, data: SceneBackupData): void {
    this.store[String(sceneNo)] = structuredClone(data);
    this.save();
  }

  public getAllScenes(): SceneArchiveStore {
    return structuredClone(this.store);
  }

  public deleteScene(sceneNo: number): void {
    delete this.store[String(sceneNo)];
    this.save();
  }
}
