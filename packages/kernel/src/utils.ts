// ============================================================================
// AGI OS - Utility Functions
// ID generation, hashing, and common operations
// ============================================================================

import { randomUUID, createHash } from 'node:crypto';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Create a SHA-256 hash of data
 */
export function hash(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Create a SHA-256 hash of a string
 */
export function hashString(data: string): string {
  return hash(Buffer.from(data, 'utf-8'));
}

/**
 * Create a SHA-256 hash of an object (serialized to JSON)
 */
export function hashObject(obj: unknown): string {
  return hash(JSON.stringify(obj, Object.keys(obj as object).sort()));
}

/**
 * Deep clone an object (handles Date objects properly)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepClone) as T;
  }
  
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    result[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return result as T;
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      ) as T[keyof T];
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[keyof T];
    }
  }
  return result;
}

/**
 * Get current timestamp as ISO string
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Get current timestamp as Date
 */
export function now(): Date {
  return new Date();
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Assert that a condition is true
 */
export function assert(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert that a value is not null or undefined
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Create a timeout promise
 */
export function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([promise, timeout(ms)]);
}
