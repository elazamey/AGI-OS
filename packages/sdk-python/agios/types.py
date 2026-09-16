"""AGI-OS Python SDK — Type definitions"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class MissionResult:
    id: str
    status: str
    output: Optional[str] = None
    governance_audit: dict = field(default_factory=dict)
    metrics: dict = field(default_factory=dict)
    events: list = field(default_factory=list)


@dataclass
class HealthStatus:
    status: str
    version: str
    uptime: float
    missions: int
    skills: int


@dataclass
class Skill:
    name: str
    description: str
    triggers: list[str] = field(default_factory=list)
    risk_level: str = "LOW"


@dataclass
class ModelInfo:
    id: str
    name: str
    provider: str


@dataclass
class MemoryEntry:
    key: str
    value: Any
    namespace: Optional[str] = None


@dataclass
class ExecuteOptions:
    prompt: str
    capabilities: list[str] = field(default_factory=list)
    context: dict = field(default_factory=dict)
    webhook_url: Optional[str] = None
    budget_usd: Optional[float] = None
    budget_tokens: Optional[int] = None
