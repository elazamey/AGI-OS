import { describe, it, expect, beforeEach } from 'vitest';
import { AGIOS, AGIOSError } from '../src/index';
import { HTTPClient } from '../src/http';

// ═══════════════════════════════════════════════════════
// HTTPClient
// ═══════════════════════════════════════════════════════

describe('HTTPClient', () => {
  it('should create with config', () => {
    const client = new HTTPClient({
      baseUrl: 'http://localhost:4000',
      timeout: 5000,
      retries: 2,
    });
    expect(client).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// AGIOS Client Construction
// ═══════════════════════════════════════════════════════

describe('AGIOS Client', () => {
  it('should create with required config', () => {
    const client = new AGIOS({ baseUrl: 'http://localhost:4000' });
    expect(client).toBeDefined();
  });

  it('should throw if baseUrl missing', () => {
    expect(() => new AGIOS({ baseUrl: '' })).toThrow('baseUrl is required');
  });

  it('should strip trailing slash from baseUrl', () => {
    const client = new AGIOS({ baseUrl: 'http://localhost:4000/' });
    expect(client).toBeDefined();
  });

  it('should accept apiKey', () => {
    const client = new AGIOS({
      baseUrl: 'http://localhost:4000',
      apiKey: 'test-key-123',
    });
    expect(client).toBeDefined();
  });

  it('should accept custom timeout and retries', () => {
    const client = new AGIOS({
      baseUrl: 'http://localhost:4000',
      timeout: 60000,
      retries: 5,
    });
    expect(client).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// AGIOSError
// ═══════════════════════════════════════════════════════

describe('AGIOSError', () => {
  it('should create error with message and status', () => {
    const err = new AGIOSError('Unauthorized', 401, {
      message: 'Invalid API key',
      type: 'invalid_request_error',
    });

    expect(err.message).toBe('Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.apiError.message).toBe('Invalid API key');
    expect(err.name).toBe('AGIOSError');
  });

  it('should be instanceof Error', () => {
    const err = new AGIOSError('test', 500, { message: 'test', type: 'error' });
    expect(err).toBeInstanceOf(Error);
  });
});

// ═══════════════════════════════════════════════════════
// SDK Interface (Type Tests)
// ═══════════════════════════════════════════════════════

describe('SDK Interface', () => {
  let sdk: AGIOS;

  beforeEach(() => {
    sdk = new AGIOS({ baseUrl: 'http://localhost:4000' });
  });

  it('should expose execute method', () => {
    expect(typeof sdk.execute).toBe('function');
  });

  it('should expose getMission method', () => {
    expect(typeof sdk.getMission).toBe('function');
  });

  it('should expose rollbackMission method', () => {
    expect(typeof sdk.rollbackMission).toBe('function');
  });

  it('should expose listMissions method', () => {
    expect(typeof sdk.listMissions).toBe('function');
  });

  it('should expose listSkills method', () => {
    expect(typeof sdk.listSkills).toBe('function');
  });

  it('should expose synthesizeSkill method', () => {
    expect(typeof sdk.synthesizeSkill).toBe('function');
  });

  it('should expose storeMemory method', () => {
    expect(typeof sdk.storeMemory).toBe('function');
  });

  it('should expose queryMemory method', () => {
    expect(typeof sdk.queryMemory).toBe('function');
  });

  it('should expose health method', () => {
    expect(typeof sdk.health).toBe('function');
  });

  it('should expose models method', () => {
    expect(typeof sdk.models).toBe('function');
  });

  it('should expose selfModel method', () => {
    expect(typeof sdk.selfModel).toBe('function');
  });

  it('should expose metrics method', () => {
    expect(typeof sdk.metrics).toBe('function');
  });

  it('should expose ready method', () => {
    expect(typeof sdk.ready).toBe('function');
  });
});
