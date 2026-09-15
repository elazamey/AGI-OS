"""AGI-OS governance gate (deployment-side, dependency-free).

Mirrors the decisions of ``@agi-os/governance`` (see
``packages/governance/src/policy.ts``) for the HuggingFace Space, which runs as a
standalone Python process and cannot import the TypeScript packages.

Two properties matter and are unit-tested in ``tests/test_governance.py``:

1. Matching is whole-word for short triggers. A substring match on ``dd`` used to
   block "added" and on ``format`` blocked "information" — a policy that blocks
   ordinary work is a policy that gets disabled.
2. Attacker-controlled text is normalised before matching: zero-width and
   bidi-control characters, fullwidth homoglyphs and whitespace runs have all been
   used to slip a phrase past a naive substring gate.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable

DANGEROUS_PHRASES = (
    "rm -rf /",
    "rm -rf /*",
    "--no-preserve-root",
    "mkfs.",
    "dd if=/dev/zero of=/dev/sd",
    "shutdown -h now",
    "chmod -R 777 /",
    ":(){ :|:& };:",
    "drop table",
    "truncate table",
    "delete from users",
    "/etc/shadow",
    "/etc/passwd",
    ".ssh/id_rsa",
    "git push --force",
    "push --force origin main",
    "curl -fsSL http://collector.example",
    "| sh",
    "|sh",
    "| bash",
)

# Whole-word triggers. Names that never appear in ordinary prose block on sight…
UNAMBIGUOUS_WORDS = ("mkfs", "fdisk", "parted", "shred")
# …while these are ordinary English words as well as commands ("format the report",
# "the crontab entry"), so they only fire next to an execution verb or a shell
# metacharacter. Without that scoping the gate blocks work it has nothing to do
# with, and the first person under pressure disables the gate.
CONTEXTUAL_WORDS = ("dd", "format", "crontab", "shred")
EXEC_HINT_RE = re.compile(r"\b(run|runs|running|execute|exec|executes|eval|shell|command|cmdline|invoke|bash)\b")
SHELL_METACHAR_RE = re.compile(r"(\|\s*\w|&&|;\s*\w|\$\(|`[^`]+`)")

# State-changing but recoverable: needs a human, not a hard block.
ESCALATE_PHRASES = (
    "git reset --hard",
    "reset --hard",
    "drop index",
    "reboot",
    "systemctl restart",
    "chmod 600",
)

# Text that claims to *be* an instruction to an agent. Data, never directives.
INJECTION_PATTERNS = (
    r"begin trusted instructions",
    r"new instructions for any automated agent",
    r"governance override",
    r"policy_enforce\s*=\s*false",
    r"ignore (all |the )?(previous|prior|above|that)",
    r"system\s+override",
    r"you are dan",
    r"governance is disabled",
    r"operator handoff",
    r"untrusted tool output contains imperative",
)

CONTROL_CHARS = re.compile(r"[\u200b-\u200d\u2060\u202a-\u202e\u2066-\u2069\ufeff]")
WORD_RE = {
    word: re.compile(rf"(^|[^a-z0-9]){re.escape(word)}([^a-z0-9]|$)")
    for word in set(UNAMBIGUOUS_WORDS) | set(CONTEXTUAL_WORDS)
}
OUTBOUND_RE = re.compile(r"https?://|upload|exfil|post the|send the", re.I)
SENSITIVE_PATH_RE = re.compile(r"/etc/(passwd|shadow)|\.ssh/id_rsa|(^|[\s'\"])\.env\b")
WRITE_OUTSIDE_RE = re.compile(r"write[^a-z]{0,12}/(?!tmp/|var/tmp/)[a-z]")


def normalize(text: str) -> str:
    """Neutralise the obfuscation classes that defeat naive substring gates."""
    if not isinstance(text, str):
        text = "" if text is None else str(text)
    stripped = CONTROL_CHARS.sub("", text)
    folded = unicodedata.normalize("NFKC", stripped)
    return re.sub(r"\s+", " ", folded).strip().lower()


@dataclass
class Decision:
    """A governance verdict with the evidence needed to audit it later."""

    decision: str  # allow | ask | block
    rule: str | None = None
    reason: str = ""
    injection: str | None = None
    risk_level: str = "LOW"
    matched: list[str] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return self.decision == "block"

    @property
    def requires_approval(self) -> bool:
        return self.decision == "ask"

    def as_dict(self) -> dict:
        return {
            "decision": self.decision.upper(),
            "rule": self.rule,
            "reason": self.reason,
            "risk_level": self.risk_level,
            "untrusted_instructions": self.injection,
        }


def _matches_dangerous(lower: str) -> tuple[str, str, str] | None:
    for phrase in DANGEROUS_PHRASES:
        if phrase in lower:
            return ("POL-005", "exec of a destructive command", phrase)
    contextual_only = not EXEC_HINT_RE.search(lower) and not SHELL_METACHAR_RE.search(lower)
    for word, pattern in sorted(WORD_RE.items()):
        if not pattern.search(lower):
            continue
        if contextual_only and word in CONTEXTUAL_WORDS:
            continue
        return ("POL-005", "exec of a destructive command", word)
    if SENSITIVE_PATH_RE.search(lower):
        return ("POL-001", "sensitive system file access", "sensitive path")
    if WRITE_OUTSIDE_RE.search(lower):
        return ("POL-006", "filesystem write outside the workspace", "absolute write target")
    return None


def _matches_escalate(lower: str) -> tuple[str, str] | None:
    for phrase in ESCALATE_PHRASES:
        if phrase in lower:
            return ("POL-002", phrase)
    return None


def _injection(lower: str, patterns: Iterable[str] = INJECTION_PATTERNS) -> str | None:
    for pattern in patterns:
        if re.search(pattern, lower, re.I):
            return pattern
    return None


def evaluate(text: str) -> Decision:
    """Decide what may happen for a piece of (possibly hostile) request text."""
    lower = normalize(text)
    injection = _injection(lower)

    danger = _matches_dangerous(lower)
    if danger:
        rule, why, matched = danger
        return Decision(
            decision="block",
            rule=rule,
            reason=f"{why}: {matched!r}" + (" (found inside untrusted content)" if injection else ""),
            injection=injection,
            risk_level="CRITICAL",
            matched=[matched],
        )

    if injection and OUTBOUND_RE.search(lower):
        return Decision(
            decision="block",
            rule="POL-004",
            reason="embedded instruction in untrusted content requests an outbound action",
            injection=injection,
            risk_level="CRITICAL",
            matched=[injection],
        )

    escalation = _matches_escalate(lower)
    if escalation:
        rule, matched = escalation
        return Decision(
            decision="ask",
            rule=rule,
            reason=f"{matched!r} changes state and needs an operator approval",
            injection=injection,
            risk_level="HIGH",
            matched=[matched],
        )

    if injection:
        return Decision(
            decision="allow",
            rule=None,
            reason="no governed operation requested; embedded instructions treated as data",
            injection=injection,
            risk_level="MEDIUM",
            matched=[injection],
        )

    return Decision(decision="allow", reason="no matching deny rule; workspace-scoped operations only", injection=None)
