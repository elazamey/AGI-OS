import { FileBackend } from './FileBackend.js';

export class MissionStore {
  constructor(
    private backend: FileBackend,
    private basePath: string = 'missions'
  ) {}

  async save(missionId: string, missionData: unknown): Promise<void> {
    const filePath = `${this.basePath}/${missionId}.json`;
    await this.backend.writeFile(filePath, missionData);
  }

  async load<T>(missionId: string): Promise<T | null> {
    const filePath = `${this.basePath}/${missionId}.json`;
    return this.backend.readFile<T>(filePath);
  }

  async delete(missionId: string): Promise<void> {
    const filePath = `${this.basePath}/${missionId}.json`;
    await this.backend.deleteFile(filePath);
  }

  async exists(missionId: string): Promise<boolean> {
    const filePath = `${this.basePath}/${missionId}.json`;
    return this.backend.exists(filePath);
  }
}
