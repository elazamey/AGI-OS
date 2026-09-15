# @agi-os/provider-orchestrator — the control plane

Everything between *"build feature X and deploy it"* and *"here is the verified URL"*.
The agent is not supposed to know how Vercel, Hugging Face or Cloudflare work; this
package knows, and it is the only thing in the repository that decides who thinks,
who publishes, and what counts as proof.

One package, four modules and one gate — instead of five packages (`provider-registry`,
`quota-manager`, `evidence`, `deployment-orchestrator`, `provider-orchestrator`).
The modules are separate files with separate exports and no cycles; the split into
five packages would have multiplied `package.json`/tsconfig/lockfile surface while
adding a strong new way to be wrong (registry state shared across package
boundaries). Separation of concerns is enforced by the type system and the tests:
a deployment record cannot be routed as an agent, and a health claim cannot be
fabricated by the plane it describes.

---

## The four planes, and why they are separate types

```ts
export type ProviderKind = 'agent' | 'model' | 'deployment' | 'verification';
```

| kind | who | chosen by | may say about health |
|---|---|---|---|
| `agent` | whole-mission adapters — Arena, Codex, Claude API, Manus | **Agent Router** | nothing |
| `model` | prompt APIs — OpenRouter Free, Gemini, Cerebras, HF, Cloudflare AI, local | **Model Router** | nothing |
| `deployment` | who publishes — Vercel, HF Space, Cloudflare Pages | `deployment.ts` | "it is published" |
| `verification` | who proves — functional chain, `tests/production` | `verification.ts` / `gate.ts` | **only this plane** |

The bug class this layout exists to prevent: a platform that *runs models* being
treated as one that *publishes output*, and a platform reporting **"Ready"** being
treated as evidence that the thing works. "Ready" is a deployment-plane word.
`VERIFIED` is a verification-plane word. They are never the same event, and the
gate is where they are compared.

```
Task → Agent Router → Free-First Model Router → capability → health → free → quota → policy → ranking(score)
                                                     ↓
                                             selected provider
                                                     ↓
                                     AGI-OS execution → GitHub → CI/CD
                                                     ↓
                             Vercel / HF Space / Cloudflare Pages  (deployment plane)
                                                     ↓
                     functional chain + production certification   (verification plane)
                                                     ↓
                                gate: VERIFIED · DEGRADED · BLOCKED + evidence
```

Because the deployment pipeline reads no provider id, **the model can be swapped
mid-mission without breaking a publish**. That is the point of the split.

---

## FREE_ONLY: the policy, not a preference

> AGI-OS runs on free APIs first and never upgrades to a paid API automatically.

`agi-os-providers.json` declares `policy.freeOnly: true`. It is read at plan time,
written into every evidence line, and there is no code path that flips it by itself.
The per-provider decision is the operator's ladder:

```
available? → free? → quota remaining? → capability? → policy? → YES: execute
                                                                  NO: next provider
                                                           all failed: NO_FREE_PROVIDER_AVAILABLE → BLOCKED
```

`free` is a stage in the router, *before* ranking, so a paid provider cannot win a
scoring argument it was never entitled to enter. "Free" is not one thing, which is
why `freeTier` is a discriminated shape instead of a boolean:

| provider | what "free" actually is | enforcement |
|---|---|---|
| OpenRouter | `openrouter/free` picks among ~25 `:free` models | per-day request ceiling + a **model allowlist** (`freeTier.freeModels`); a model id without `:free` is metered, so it is refused |
| Gemini | free tier with per-model **and** per-account limits | quota-aware: 429 → cooldown, not failure; never treated as unlimited |
| Cerebras | ~$5 introductory credit, then metered | `trial-usd`; at 0 remaining the rung is *dropped*, not topped up |
| Hugging Face | ~$0.10/month of Inference Providers credit, then pay-as-you-go | `usd-per-month` with `hardStop: true` — the difference between a free call and an invoice |
| Cloudflare Workers AI | 10 000 neurons/day, some models paid-plan only | `neurons-per-day` + the model itself is checked before selection |
| local (llama.cpp/Ollama/Jan) | no per-call cost, no egress | `unlimited-local`; the last rung before BLOCKED |
| agent adapters | subscription/credit accounts, not free APIs | `billing: 'subscription'`, allowed on the **agent plane only**; `billing: 'paid'` is refused everywhere |

Two refusals that are worth naming, because they are the difference between a policy
and a comment:

* **`hardStop: false` is rejected at parse time.** Writing it to "just get this one
  call through" is the auto-upgrade; the loader reports
  `hardStop:false on a usd-per-month tier allows the router to cross into
  pay-as-you-go — forbidden by FREE_ONLY` and the provider is not registered.
* **A paid entry stays in the manifest.** `claude-api` is declared `billing: 'paid'`
  on purpose: FREE_ONLY has to be provable against a real paid path (see
  `tests/orchestrator.test.ts`), and an override is only reachable via a human —
  `--allow-paid` (operator flag) *or* `paidOverride` on the record, and either way it
  is written into the trace as `override: claude-api (paid, operator override)`.

Arena's tool-budget exhaustion is the case this was built for: the rungs are tried in
order, each failure records evidence and puts the provider on a cooldown, and the
mission continues without a human. Nothing is deleted, nothing is asked.

---

## Ranking: a score, not a hard-coded number

Blind priority lists rot the day a provider changes its limits. Ranking therefore
recomputes per call from observables (`src/score.ts`):

```
score = capability + availability + quota + latency + reliability + task-fit + bias − failures   (0…100)
```

`quota` is the *remaining free allowance* (0…1 runway × 18), `latency` comes from the
last probe, `reliability` decays with consecutive failures (penalty capped at 30 so a
bad day is not permanent exile), `task-fit` matches the task kind against the provider's
declared strengths, and the manifest's `priority` survives only as a ±2 `bias`
tiebreaker. Every provider's `parts` are returned, and the ranking stage's trace line
prints them (`aaa-fast: 79 · bbb-slow: 73`), so "why 63?" is answerable from the
evidence file weeks later.

```
$ npm run control:plan -- --task=coding
plane:    model
provider: openrouter-free (score 85)
reason:   free-first model provider "openrouter-free" scored 85; agent plane not requested

model ladder (fallback order):
  1. openrouter-free    score  85  openrouter/auto          requests-per-day ≤ 50
  2. cerebras           score  77  llama3.3-70b             trial-usd ≤ 5
  3. local              score  76  qwen2.5-coder-32b-q4    unlimited-local ≤ 1
  4. gemini-free        score  71  gemini-2.5-flash         requests-per-day ≤ 200
  5. huggingface        score  64  Qwen2.5-Coder-32B        usd-per-month ≤ 0.1
```

Tomorrow, if Gemini's free limits move, `89 → 94` happens in the data and no file is
edited.

---

## The gate

`gate.ts` combines the three inputs and takes the **worst**:

| deployment | verification | certification | final gate | exit |
|---|---|---|---|---|
| DEPLOYED | VERIFIED | PASSED | **VERIFIED** | 0 |
| DEPLOYED | VERIFIED | DEGRADED | DEGRADED (BLOCKED under `--strict`) | 1 / 2 |
| DEPLOYED | VERIFIED | **BLOCKED** | **BLOCKED** | 2 |
| DEPLOYED | **BLOCKED** (UI 200, backend dead) | PASSED | **BLOCKED** | 2 |
| DEPLOYED | skipped (offline run) | PASSED | DEGRADED | 1 |
| FAILED / unobserved | any | any | **BLOCKED** | 2 |
| any | any | missing | **BLOCKED** | 2 |

The second row from the bottom is the real one: the deployed UI returned HTTP 200 and
rendered `Disconnected` while the Space behind it answered nothing. A green build with
an unreachable backend is `BLOCKED`, not a warning, because the alternative is
documentation that quietly becomes fiction.

`interface DeploymentResult { provider; deploymentId; url?; status: "DEPLOYED"|"FAILED"|"BLOCKED" }`
— and note what is *not* in that union: there is no `VERIFIED` value, so the
deployment plane cannot claim one even by accident. The functional chain produces:

```json
{ "frontend": "PASS", "frontend_http": 200, "backend": "FAIL", "backend_health": 404,
  "api_contract": "FAIL", "deployment": "BLOCKED" }
```

---

## Running it

No install step is required or expected — the point is that the gate runs in a bare
container, on a laptop, and in CI identically (`node ≥ 22.6`).

```bash
npm run control:providers                                   # both planes + allowances + state
npm run control:plan -- --task=coding --json                # routing decision, scores, trace
npm run control:verify -- --live --frontend=… --backend=…  # post-deploy functional chain
npm run control:gate -- --live --strict --run-certification # everything, writes the report
node scripts/run-tests.mjs                                  # 82 tests, 15 suites
```

Artefacts land in `.agi-os/control/` (gitignored): `gate-<run>.md`, `gate-latest.json`
and an append-only `gate-<run>.jsonl` evidence ledger — one line per decision,
redacted (Bearer tokens, `sk-`/`hf_`/`ghp_` secrets), written as the run proceeds so a
crashed run still leaves an audit trail.

Exit codes: `0` VERIFIED · `1` DEGRADED · `2` BLOCKED · `64` bad command. CI treats
anything but 0 as "not certified", and `deployment-gate` is the check branch
protection should require.

---

## Configuration

`agi-os-providers.json` at the repository root. `${VAR}` indirection is expanded at
load time and **must** carry a fallback (`${LOCAL_INFERENCE_URL:http://127.0.0.1:8080/v1}`)
— a missing variable is a config error, loudly reported, because a silently empty base
URL becomes a mysterious connection failure three steps away. Secrets are never
written here: `accountNotes` names the env var instead.

Parsing is strict and reports what it rejected rather than dropping it silently, since
a typo'd capability that disappears from the registry shows up later as "no provider
matched" with no explanation.

## Tests

| file | covers |
|---|---|
| `router.test.ts` | six pipeline stages, every rejection named with its stage, both planes isolated |
| `free-first.test.ts` | paid refusal, override, per-platform allowance shapes, `hardStop` abuse, parse-time guards |
| `score.test.ts` | score bounds, health/quota/failure effects, tie-break determinism |
| `quota.test.ts` / `health.test.ts` | per-minute pacing; cooldown maths and auto-recovery |
| `failover.test.ts` | ladder walk on quota exhaustion, allowance charging, credential redaction, `NO_FREE_PROVIDER_AVAILABLE` |
| `verification.test.ts` | the functional chain over real sockets, including "UI up / backend dead" and "backend fakes its answer" |
| `gate.test.ts` | `DEPLOYED ≠ VERIFIED`, worst-of semantics, missing-evidence blocking, strict mode |
| `orchestrator.test.ts` | Agent Router above Model Router, fallbacks, the repository manifest itself |
| `cli.test.ts` | exit-code contract, evidence ordering, artefact shapes |
