# Contributing to AGI-OS

Thank you for your interest in contributing to AGI-OS — the Cognitive Agent Operating System.

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **Git**

## Setup

```bash
git clone https://github.com/elazamey/agi-system.git
cd agi-system
pnpm install
```

## Development Workflow

### Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for a specific package
cd packages/agent-os && pnpm test

# Run arena evaluation benchmarks
cd packages/arena-eval && pnpm test
```

### Building

```bash
# Build all packages
pnpm build

# Build a specific package
cd packages/api-gateway && pnpm build
```

### Type Checking

```bash
pnpm typecheck
```

## Architecture Principles

### 1. Governance Chain (Non-Negotiable)

Every skill, tool, and capability MUST pass through the 5-step governance chain:

```
Planner → Policy Gate → Execution → Verifier → Ledger
```

- **AI Proposes**, Deterministic System Decides
- **Deny-by-default** for all tool capabilities
- Risk levels: `SAFE` > `SENSITIVE` > `CRITICAL`
- CRITICAL requires explicit user approval

### 2. Self-Healing

The system MUST attempt automatic recovery for transient failures:
- Tool crashes → retry with backoff
- Sandbox timeouts → escalate to degraded mode
- Provider failures → fallback chain (Groq → OpenRouter → Ollama)

### 3. Zero-Cost by Default

All local-first. Cloud usage only via free tiers:
- `MAX_SPEND=0` enforced at runtime
- SQLite + JSONL storage (no external databases)
- Ollama as primary LLM provider

### 4. Skill Contract

Every new skill MUST include:
- `SKILL.md` with name, description, triggers, instructions
- Entry via `SkillContract` interface
- Kernel as mandatory gatekeeper
- Test coverage >= 80%

## Adding a New Package

1. Create `packages/<name>/` with standard structure:
   ```
   packages/<name>/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   └── index.ts
   └── tests/
       └── <name>.test.ts
   ```

2. Add workspace dependency in `package.json`:
   ```json
   "dependencies": {
     "@agi-os/<name>": "workspace:*"
   }
   ```

3. Write tests with >= 80% coverage

4. Run governance check: `pnpm test` must pass

5. Submit PR with description of capability

## Adding a New Skill

1. Create `skills-registry/skills/<skill-name>/SKILL.md`
2. Follow the format:
   ```markdown
   # Skill Name
   description: Brief description
   triggers: keyword1, keyword2

   ## Instructions
   Step-by-step instructions...
   ```
3. Register in `skills-registry/registry.json`
4. Write integration tests
5. Ensure PolicyGate classifies risk correctly

## Pull Request Requirements

- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] New code has >= 80% test coverage
- [ ] No secrets or API keys committed
- [ ] SKILL.md included for new skills
- [ ] PR description explains the change
- [ ] Governance chain respected for all new capabilities

## Code Style

- TypeScript strict mode
- No comments unless requested
- Follow existing patterns in the codebase
- Use `workspace:*` for inter-package dependencies

## Reporting Issues

Use the GitHub issue templates:
- **Bug Report**: For system bugs
- **Capability Proposal**: For new repository/skill integrations
- **Security Vulnerability**: For security concerns (do NOT open public issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
