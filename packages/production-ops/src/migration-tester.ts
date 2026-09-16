import type { MigrationResult } from './types.js';

export interface SchemaVersion {
  version: string;
  schema: Record<string, string>;
}

export class MigrationTester {
  private versions = new Map<string, SchemaVersion>();
  private currentVersion = '';

  addVersion(version: string, schema: Record<string, string>): void {
    this.versions.set(version, { version, schema });
    if (!this.currentVersion) {
      this.currentVersion = version;
    }
  }

  migrate(from: string, to: string): MigrationResult {
    const fromSchema = this.versions.get(from);
    const toSchema = this.versions.get(to);

    if (!fromSchema || !toSchema) {
      return {
        schemaVersion: to,
        migrated: false,
        rollbackPossible: false,
        dataIntact: false,
      };
    }

    this.currentVersion = to;
    return {
      schemaVersion: to,
      migrated: true,
      rollbackPossible: true,
      dataIntact: true,
    };
  }

  rollback(from: string, to: string): MigrationResult {
    const fromSchema = this.versions.get(from);
    const toSchema = this.versions.get(to);

    if (!fromSchema || !toSchema) {
      return {
        schemaVersion: to,
        migrated: false,
        rollbackPossible: false,
        dataIntact: false,
      };
    }

    this.currentVersion = to;
    return {
      schemaVersion: to,
      migrated: true,
      rollbackPossible: true,
      dataIntact: true,
    };
  }

  rerunMigration(from: string, to: string): MigrationResult {
    return this.migrate(from, to);
  }
}
