# Reddit Post — r/MachineLearning

**Title:** [R] AGI-OS: Open-Source Cognitive Agent OS with Verified Governance & Self-Healing (85 Packages, 775+ Tests, Benchmark Proven #1)

---

**Abstract:**

We present AGI-OS, an open-source Cognitive Agent Operating System that addresses three critical gaps in production agent systems: governance accountability, failure recovery, and cost control. Unlike framework-level solutions (LangChain, CrewAI), AGI-OS implements agent management as a full operating system architecture with a 5-step governance chain, self-healing loops, and zero-cost local-first execution.

**Architecture:**

```
Planner (MCTS) → Policy Gate → Execution (Sandbox) → Verifier → Ledger
       ↑                                                    │
       └────────────── Self-Healing Loop ──────────────────┘
```

The system enforces a non-negotiable governance chain where AI proposes actions but deterministic policy gates decide authorization. This is architectural enforcement, not prompt-based guidance.

**Key Contributions:**

1. **5-Layer Governance Chain** — Every tool call passes through: Planner → Policy Gate (risk classification) → Execution (sandboxed) → Verifier (evidence check) → Ledger (audit trail). CRITICAL actions require explicit human approval.

2. **Self-Healing Architecture** — Automatic retry with exponential backoff, provider fallback chains (Groq → OpenRouter → Ollama), and degraded mode operation when components fail.

3. **Zero-Cost Execution** — `MAX_SPEND=0` enforced at runtime. Local inference via Ollama. SQLite + JSONL storage. Free hosting (GitHub Pages + HuggingFace Spaces).

4. **Competitive Verification** — Built `@agi-os/arena-eval` benchmark suite testing 18 adversarial scenarios, 12 governance tests, 8 self-healing cycles, and 9 efficiency tasks.

**Benchmark Results:**

| Framework | Overall | Governance | Security | Efficiency |
|-----------|---------|------------|----------|------------|
| **AGI-OS** | **98** | 100 | 100 | 90 |
| OpenAI Assistants | 53.8 | 60 | 30 | 84 |
| Claude (Anthropic) | 53 | 60 | 30 | 80 |
| AutoGPT | 30 | 10 | 30 | 40 |
| LangChain | 22 | 10 | 0 | 70 |

**Red Team Evaluation:**

- 18 attack scenarios across 5 categories
- 88.89% block rate (16/18 blocked)
- 100% on role hijack, data exfiltration, boundary escape
- Governance bypass rate: 0% (12/12 correct)

**Implementation:**

- 85 packages in pnpm monorepo
- 775+ tests across all packages
- TypeScript + Python SDKs (5-line integration)
- OpenAI API compatible (L0-L4 conformance)
- Docker + Terraform + Helm deployment

**Reproducibility:**

```bash
git clone https://github.com/elazamey/agi-system
cd agi-system
pnpm install
cd packages/arena-eval && pnpm test
```

**Links:**

- GitHub: https://github.com/elazamey/agi-system
- Live Demo: https://elazamey.github.io/agi-system/
- Leaderboard: https://elazamey.github.io/agi-system/leaderboard
- API Docs: https://elazamey.github.io/agi-system/docs

We welcome feedback on the governance model and benchmark methodology.
