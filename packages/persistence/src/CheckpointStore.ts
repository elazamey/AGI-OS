import type { FileBackend } from './FileBackend.js';
import type { Checkpoint } from './types.js';

export class CheckpointStore {
  constructor(
    private backend: FileBackend,
    private basePath: string = 'checkpoints'
  ) {}

  async save(checkpoint: Checkpoint): Promise<void> {
    const filePath = `${this.basePath}/${checkpoint.missionId}.json`;
    await this.backend.writeFile(filePath, checkpoint);
  }

  async load(missionId: string): Promise<Checkpoint | null> {
    const filePath = `${this.basePath}/${missionId}.json`;
    return this.backend.readFile<Checkpoint>(filePath);
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
