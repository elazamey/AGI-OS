/**
 * Ambient types for the Vite dev/build environment.
 *
 * This app's tsconfig does not pull in `vite/client`, so `import.meta.env` had no
 * type and any use of it broke `tsc && vite build`. Declared locally (rather than
 * via a triple-slash reference) so the build works even where the vite package is
 * not installed.
 */
interface ImportMetaEnv {
  /** Gateway origin used as the default in the connection modal. */
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_API_KEY?: string;
  readonly MODE?: string;
  readonly DEV?: boolean;
  readonly PROD?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
