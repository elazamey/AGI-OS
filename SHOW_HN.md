# Show HN: AGI-OS — Open-Source Cognitive Agent OS (Scored 98/100 vs Claude 53, OpenAI 54)

**URL**: https://github.com/elazamey/agi-system
**Live Demo**: https://elazamey.github.io/AGI-OS/
**Leaderboard**: https://elazamey.github.io/AGI-OS/leaderboard

---

## What I Built

AGI-OS is a **Cognitive Agent Operating System** — not another LLM wrapper, but a full architecture for autonomous AI agents with governance, self-healing, and zero-cost operation.

I got tired of agent frameworks that crash silently, burn through API credits, and have no safety rails. So I built one that:

1. **Never crashes** — self-healing with 3-retry loops, fallback chains (Groq → OpenRouter → Ollama)
2. **Always asks first** — 5-layer governance: AI proposes, deterministic system decides
3. **Costs $0** — local-first (Ollama), free cloud tiers, no credit card
4. **Proves it works** — competitive benchmark scored #1 against 5 frameworks

## How I Measured It

Built `@agi-os/arena-eval` — a benchmark suite that tests:
- **Red Team** (18 attack scenarios): prompt injection, role hijack, data exfil, boundary escape
- **Governance** (12 policy scenarios): CRITICAL/SENSITIVE/SAFE classification
- **Self-Healing** (8 failure cycles): tool crash, timeout, provider down
- **Token Efficiency** (9 tasks): cost per task, budget compliance

Results:

| Framework | Score | Governance | Security |
|-----------|-------|------------|----------|
| **AGI-OS** | **98** | 100 | 100 |
| OpenAI Assistants | 53.8 | 60 | 30 |
| Claude | 53 | 60 | 30 |
| AutoGPT | 30 | 10 | 30 |
| LangChain | 22 | 10 | 0 |

## Tech Stack

- **85 packages** in a pnpm monorepo
- **775+ tests** across all packages
- **Next.js 15** dual-view UI (Chat + Canvas)
- **TypeScript + Python SDKs** (5-line integration)
- **OpenAI API compatible** (L0-L4 conformance)
- **Docker + Terraform + Helm** deployment
- **HuggingFace Spaces** backend (free HTTPS)
- **GitHub Pages** frontend (free static hosting)

## What Makes It Different

1. **Governance Chain** — not just a system prompt. Every tool call goes through: Planner → Policy Gate → Execution → Verifier → Ledger
2. **Self-Healing** — when a tool crashes, the system retries with backoff. When a provider goes down, it falls back to the next one.
3. **Zero-Cost** — `MAX_SPEND=0` enforced at runtime. Ollama for local inference. SQLite + JSONL for storage.
4. **Competitive Proof** — not just claims, but actual benchmark numbers that anyone can reproduce.

## Try It

```bash
# TypeScript
npm install @agi-os/sdk

import { AGIOS } from '@agi-os/sdk';
const client = new AGIOS({ baseUrl: 'https://elazamey-agi-system.hf.space' });
const result = await client.execute({ prompt: 'Analyze my codebase' });

# Python
pip install agios

from agios import AGIOS
client = AGIOS(base_url="https://elazamey-agi-system.hf.space")
result = client.agent.execute(prompt="Analyze my codebase")
```

## What's Next

- Real OAuth integration (Google/GitHub) — live on HF Spaces
- Community skill marketplace
- Enterprise on-premises deployment guide
- Multi-agent swarm federation

---

**GitHub**: https://github.com/elazamey/agi-system
**Live UI**: https://elazamey.github.io/AGI-OS/
**API Docs**: https://elazamey.github.io/AGI-OS/docs

I'd love feedback from the community. What would make this useful for your projects?
