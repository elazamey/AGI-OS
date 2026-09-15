<p align="center">
  <img src="https://img.shields.io/badge/version-1.34.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/tests-2700+-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/packages-80-purple" alt="Packages">
  <img src="https://img.shields.io/badge/score-90.08/100-orange" alt="Score">
</p>

<h1 align="center">🧠 AGI-OS</h1>
<h3 align="center">Cognitive Agent Operating System</h3>
<p align="center">The open-source alternative to Manus, Claude, and OpenAI Assistants — self-healing, policy-governed, zero-cost.</p>

<p align="center">
  <a href="https://elazamey.github.io/AGI-OS/">Live UI</a> •
  <a href="https://elazamey.github.io/AGI-OS/leaderboard">Leaderboard</a> •
  <a href="https://elazamey.github.io/AGI-OS/docs">API Docs</a> •
  <a href="https://github.com/elazamey/agi-system">GitHub</a>
</p>

---

## What is AGI-OS?

AGI-OS is a **Cognitive Agent Operating System** — not just an LLM wrapper, but a full architecture with:

- **Self-Healing** — automatic retry, fallback, and recovery from failures
- **5-Layer Governance** — AI proposes, deterministic system decides, evidence proves
- **Zero-Cost** — local-first (Ollama), free cloud tiers, no credit card required
- **OpenAI Compatible** — drop-in replacement for OpenAI API (L0-L4 conformance)
- **Dynamic Skill Discovery** — capabilities registered via MCP protocol
- **Competitive Benchmarking** — proven #1 against LangChain, CrewAI, AutoGPT, Claude

## 🏆 Performance

| Metric | AGI-OS | OpenAI | Claude | AutoGPT | LangChain |
|--------|--------|--------|--------|---------|-----------|
| **Overall** | **98** | 53.8 | 53 | 30 | 22 |
| Governance | 100 | 60 | 60 | 10 | 10 |
| Security | 100 | 30 | 30 | 30 | 0 |
| Efficiency | 90 | 84 | 80 | 40 | 70 |

> Verified via `@agi-os/arena-eval` — 18 attack scenarios, 12 governance tests, 8 self-healing cycles.

## Quick Start

### 5-Line TypeScript

```typescript
import { AGIOS } from '@agi-os/sdk';

const client = new AGIOS({ baseUrl: 'https://elazamey-agi-system.hf.space' });
const result = await client.execute({ prompt: 'Analyze repository and deploy' });
console.log(result.output);
```

### 5-Line Python

```python
from agios import AGIOS

client = AGIOS(base_url="https://elazamey-agi-system.hf.space")
result = client.agent.execute(prompt="Analyze repository and deploy")
print(f"Status: {result.status}")
```

### Install

```bash
# TypeScript/JavaScript
npm install @agi-os/sdk

# Python
pip install agios
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AGI-OS KERNEL                          │
│                 (Control Plane & Registry)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Planner  │→ │ Policy   │→ │ Execute  │→ │ Verify   │   │
│  │ (MCTS)   │  │ Gate     │  │ (Sandbox)│  │ (Ledger) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ↑                                             │        │
│       └───────────── Self-Healing Loop ─────────────┘        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Skills: 19+ │ Packages: 80 │ Tests: 2700+                  │
│  LLM: Groq → OpenRouter → Ollama                            │
│  Storage: SQLite + JSONL (zero external DB)                  │
└─────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@agi-os/agent-os` | Core agent runtime with 5-step governance |
| `@agi-os/api-gateway` | OpenAI-compatible API server |
| `@agi-os/sdk` | TypeScript SDK (`npm install @agi-os/sdk`) |
| `agios` | Python SDK (`pip install agios`) |
| `@agi-os/capability-registry` | Dynamic service discovery |
| `@agi-os/arena-eval` | Competitive benchmark suite |
| `@agi-os/deploy` | Docker, Terraform, Helm deployment |
| `@agi-os/mcp-protocol` | Model Context Protocol server |
| `@agi-os/mcts-reasoning` | Monte Carlo Tree Search planner |
| `@agi-os/skill-synthesizer` | Runtime skill generation |
| `@agi-os/web-ui` | Dual-view Next.js 15 interface |

## Deployment (Zero Cost)

### GitHub Pages (Frontend)
```bash
# Automatic on push to main
# Settings → Pages → Source: gh-pages
```

### Hugging Face Spaces (Backend)
```bash
# Create Docker space → Link repo → Auto-builds on port 7860
# Set NEXT_PUBLIC_BACKEND_URL env var
```

### Docker Compose (Local)
```bash
npx agios-deploy docker
```

### Kubernetes
```bash
npx agios-deploy helm
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | OpenAI-compatible chat |
| GET | `/v1/models` | List available models |
| POST | `/api/v1/missions/execute` | Execute agent mission |
| GET | `/api/v1/missions` | List missions |
| POST | `/api/v1/missions/:id/rollback` | Rollback mission |
| GET | `/api/v1/skills` | List skills |
| POST | `/api/v1/skills/synthesize` | Synthesize new skill |
| POST | `/api/v1/memory/store` | Store memory |
| POST | `/api/v1/memory/query` | Query memory |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/auth/github` | GitHub OAuth initiation |
| GET | `/api/auth/google` | Google OAuth initiation |

## Governance Model

```
AI Proposes → Deterministic System Decides → Evidence Proves → Gate Authorizes
```

- **Deny-by-default** for all tool capabilities
- Risk levels: `SAFE` → `SENSITIVE` → `CRITICAL`
- CRITICAL requires explicit user approval
- Every action logged to Rollback Ledger
- Self-healing: 3 retries, then degraded mode

## Live Demo

- **UI**: https://elazamey.github.io/AGI-OS/
- **Leaderboard**: https://elazamey.github.io/AGI-OS/leaderboard
- **API Docs**: https://elazamey.github.io/AGI-OS/docs
- **Backend**: https://elazamey-agi-system.hf.space/health

## Production Certification

`npm run certify:production` points a behavioural test suite at a **running**
deployment and returns a documented gate decision. It is not the unit suite: unit
tests certify the code, this certifies the thing that is actually serving traffic.

```bash
AGIOS_BASE_URL=https://<your-space>.hf.space npm run certify:production
npm run certify:selftest          # boots the reference server, no deployment needed
```

| Suite | Asks |
|---|---|
| Health ● | does `/health` assert health, and does it stay up under repeat probes |
| Link Integrity ● | do README links resolve, does the UI call routes the backend serves, is one backend origin referenced (not two owners' Spaces) |
| OpenAI Compatibility ● | L0 discovery → L1 chat → L2 streaming → L3 tools/JSON → L4 error shapes |
| Mission Execution | does a mission complete with a real artefact, an ordered ledger, readback and rollback |
| Governance Gate ● | dangerous prompts must BLOCK or ASK — never complete silently; ordinary prompts must not be blocked |
| Policy Attacks | override claim, jailbreak, negation/whitespace, unicode/bidi — on both surfaces |
| Tool Abuse | unregistered tools, malicious skill synthesis, anonymous introspection, credential writes |
| Prompt Injection | 3 untrusted-content carriers (email / scraped page / tool stdout) + system-prompt leak |
| Self-Healing | corrupt JSON, oversized bodies, bursts, counter monotonicity |
| End-to-End ● | the full 6-phase journey plus an audit of this run's own evidence ledger |

Rules that make the verdict mean something:

* **a `200` is not a pass** — every test asserts observed behaviour (block/ask status,
  `4xx` instead of `500`, a non-stub artefact);
* **one `FAIL` in a critical suite (●) blocks the gate** and skips everything after
  it, so a dead target reports `BLOCKED` in seconds instead of timing out 60 times;
* **every result is written to `evidence/<runId>.jsonl`** with its request, response
  excerpt and the individual checks — re-auditable, credentials redacted;
* **CI proves the gate can fail** — `ci.yml` runs the suite against a *stub* that fakes
  its answers and a *dead* origin, and fails if either one goes green.

A `{"status":"ok"}` server that does nothing else scores `BLOCKED` with ~39 failed
tests, not `775/775`. Exit codes: `0` PASSED · `1` DEGRADED · `2` BLOCKED.
Full contract and configuration: [`tests/production/README.md`](tests/production/README.md).

## Control plane: who thinks, who publishes, what counts as proof

[`packages/provider-orchestrator`](packages/provider-orchestrator) sits between
*"build feature X and deploy it"* and *"here is the verified URL"*. Agents do not learn
Vercel, Hugging Face or Cloudflare — they pick a lane, and the router picks the API.

```text
Task → Agent Router → Free-First Model Router → capability → health → free → quota → policy → ranking
   → execution → GitHub → Actions → Vercel / HF Space / Cloudflare Pages → verification → evidence
```

**Free API first, no automatic upgrade.** `agi-os-providers.json` declares
`policy.freeOnly: true`, and each model provider declares the *shape* of its free
allowance, because "free" is a different thing on every platform:

| # | rung | what "free" is here |
|---|---|---|
| 1 | `openrouter-free` | `openrouter/free` over the `:free` model pool — model allowlist enforced |
| 2 | `gemini-free` | free tier with per-model **and** per-account limits → quota-aware, never "unlimited" |
| 3 | `cerebras` | ~$5 trial credit, then metered → dropped at zero, never topped up |
| 4 | `hf-inference` | ~$0.10/month credit, then pay-as-you-go → **`hardStop` at zero** |
| 5 | `cloudflare-ai` | 10 000 neurons/day, some models paid-plan only → the *model* is checked too |
| 6 | `local` | llama.cpp / Ollama / Jan — no API cost, no egress; last rung before BLOCKED |

Arena, Codex, Claude and Manus are **optional agent adapters**, not part of the free
path: a `billing: "paid"` entry is refused by the router
(`FREE_ONLY forbids an automatic upgrade`), `hardStop: false` on a metered tier is
rejected *at config parse time*, and every exclusion is written to the evidence ledger
with the stage that produced it. When every free rung is spent, the outcome is
`NO_FREE_PROVIDER_AVAILABLE → BLOCKED` — no silent upgrade, no human in the loop.

Ranking is computed, not configured:
`score = capability + availability + quota + latency + reliability + task-fit − failures`,
so a provider that loses its free limits drops down the ladder on its own. Exhaustion is
a routing input, not an error: the failing rung is recorded, put on an exponential
cooldown, and the mission continues on the next one.

**DEPLOYED ≠ VERIFIED.** The `deployment` plane may only report `DEPLOYED` / `FAILED` /
`BLOCKED`; `VERIFIED` comes solely from the `verification` plane. Vercel stays
*observed*, not re-integrated: it already auto-deploys from `main`, so CI reads
`x-vercel-id` to pin the build it is judging and then re-tests it — `Ready` with 0
errors is platform status, and it was reported while every panel read `Disconnected`.
Cloudflare is declared `enabled: false` because no account is bound here: it shows up in
plans as *unavailable* rather than as a fake success or a silent absence.

```bash
npm run control:providers                 # both planes, allowances, state
npm run control:plan -- --task=coding --json
npm run control:verify -- --live
npm run control:gate -- --live --strict --run-certification   # FINAL GATE, exit 0/1/2
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and architecture principles.

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  Built with 🧠 by the AGI-OS community.<br>
  <sub>AGI ≠ LLM. System intelligence comes from architecture.</sub>
</p>
