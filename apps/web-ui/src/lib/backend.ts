/**
 * Single source of truth for the API origin the client talks to.
 *
 * Before this, three components hardcoded `sayed101-agi-system.hf.space` while
 * README/openapi/docs all advertised `elazamey-agi-system.hf.space`: the shipped
 * UI polled a Space nobody owns, so the telemetry bar read "Disconnected" and the
 * model list stayed empty even when the real backend was healthy.
 *
 * Override at build time with NEXT_PUBLIC_BACKEND_URL (empty string = same origin,
 * which is what a HuggingFace Space serves when the UI and API share one process).
 */
const raw = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://elazamey-agi-system.hf.space';

export const BACKEND_ORIGIN = raw.replace(/\/+$/, '');

/** Hostname only, for status chips and other display strings. */
export const BACKEND_HOST = BACKEND_ORIGIN.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

export function backendUrl(path: string): string {
  return `${BACKEND_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
