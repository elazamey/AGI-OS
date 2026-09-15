# AGENTS.md — AGI-OS Monorepo

## Quick Reference

```bash
pnpm install                    # Install all deps
pnpm verify                     # Full gate: hygiene → build → typecheck → test → lint → audit → adversarial
pnpm verify:quick               # Fast gate: hygiene → build → typecheck → audit
pnpm test                       # All package tests (--no-bail continues on failure)
pnpm --filter @agi-os/swarm test  # Single package test
pnpm --filter @agi-os/swarm typecheck  # Single package typecheck
```

## Architecture

- **81 packages** in `packages/`, **3 apps** in `apps/`
- pnpm monorepo with workspace protocol (`workspace:*`)
- All packages use ESM (`"type": "module"`)
- Root `tsconfig.json`: ES2022, strict mode, bundler moduleResolution
- Build tools: `tsup` (most packages), `tsc` (some), `next build` (web-ui), `vite` (workspace)

## Critical Build Order

Packages have dependency chains. If typecheck fails with "Cannot find module", rebuild the dependency first:

```bash
pnpm --filter @agi-os/kernel build    # Foundation — many packages depend on this
pnpm --filter @agi-os/governance build  # Used by skill-executor, certification
pnpm --filter @agi-os/sandbox build    # Used by sandbox-adversarial
```

**Root cause of most typecheck failures**: stale `dist/` output. Rebuild the dependency package, not the consumer.

## Testing

- **Framework**: vitest (most packages), some use node:test (rare)
- **~909 tests** total across 170+ test files
- Test pattern: `**/*.test.ts` (vitest default)
- **Do NOT rename `.js` test files to `.cjs`** — vitest will pick them up and fail
- WebSocket port 24678 conflicts when running parallel tests — this is cosmetic, tests still pass
- **Known vulnerability**: vitest@1.6.1 has GHSA-5xrq-8626-4rwp (critical, UI file read). Allowlisted in `.pnpm-audit-allowlist.json` until 2026-10-15.

## Known Pre-existing Failures

| Package | Issue | Root Cause |
|---------|-------|------------|
| `apps/web-ui` | Next.js build | Pre-existing, not blocking other packages |

## Hygiene Checks

`pnpm hygiene` enforces structural rules (333 checks):
- Bin entries must read `process.argv`
- Publishable packages need `main` and `types` in package.json
- Dockerfiles must copy `tsconfig.json` if packages extend root tsconfig
- No orphan files in workspace

## CI/CD

- `.github/workflows/ci.yml` exists locally but **cannot be pushed via PAT** (lacks `workflow` scope)
- User must create/push CI workflow manually on GitHub
- Docker: `docker compose up -d --build` (HuggingFace Spaces target on port 7860)
- Health endpoint: `GET /health` (returns `{ status: 'healthy' }`)
- Audit gate: `node scripts/audit-gate.mjs --level high` (uses `.pnpm-audit-allowlist.json` for time-boxed exceptions)

## Conventions

- All imports use `.js` extension (ESM requirement): `import { foo } from './bar.js'`
- Type imports use `type` keyword: `import type { Foo } from './bar.js'`
- Governance vocabulary: `normalizeModule()` and `normalizeOperation()` are canonical — always import from `@agi-os/governance`
- Agent roles: `'researcher' | 'coder' | 'auditor' | 'planner' | 'custom'`
- Agent states: `'idle' | 'thinking' | 'executing' | 'completed' | 'failed'`
