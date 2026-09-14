"""AGI-OS Python SDK — Main Client"""

import time
from typing import Any, Optional

from .http import HTTPClient, AGIOSError
from .types import (
    MissionResult, HealthStatus, Skill, ModelInfo,
    MemoryEntry, ExecuteOptions,
)


class AgentMethods:
    """Agent execution methods."""

    def __init__(self, client: HTTPClient):
        self._client = client

    def execute(self, prompt: str, capabilities: Optional[list[str]] = None,
                context: Optional[dict] = None, webhook_url: Optional[str] = None,
                budget_usd: Optional[float] = None,
                budget_tokens: Optional[int] = None) -> MissionResult:
        body = {"prompt": prompt}
        if capabilities:
            body["capabilities"] = capabilities
        if context:
            body["context"] = context
        if webhook_url:
            body["webhook_url"] = webhook_url
        if budget_usd is not None:
            body["budget_usd"] = budget_usd
        if budget_tokens is not None:
            body["budget_tokens"] = budget_tokens

        result = self._client.post("/api/v1/missions/execute", body)
        return self._poll_mission(result["id"])

    def get_mission(self, mission_id: str) -> MissionResult:
        raw = self._client.get(f"/api/v1/missions/{mission_id}")
        return MissionResult(
            id=raw["id"],
            status=raw["status"],
            output=str(raw.get("result", "")),
            governance_audit={},
            metrics={},
            events=raw.get("events", []),
        )

    def rollback(self, mission_id: str) -> bool:
        result = self._client.post(f"/api/v1/missions/{mission_id}/rollback")
        return result.get("success", False)

    def list_missions(self) -> list[MissionResult]:
        raw = self._client.get("/api/v1/missions")
        return [
            MissionResult(
                id=m["id"],
                status=m["status"],
                events=m.get("events", []),
            )
            for m in (raw or [])
        ]

    def _poll_mission(self, mission_id: str, max_attempts: int = 30) -> MissionResult:
        for _ in range(max_attempts):
            mission = self.get_mission(mission_id)
            if mission.status in ("COMPLETED", "FAILED", "PENDING_APPROVAL"):
                return mission
            time.sleep(0.5)
        return self.get_mission(mission_id)


class MemoryMethods:
    """Memory store and query methods."""

    def __init__(self, client: HTTPClient):
        self._client = client

    def store(self, key: str, value: Any, namespace: Optional[str] = None) -> bool:
        body = {"key": key, "value": value}
        if namespace:
            body["namespace"] = namespace
        result = self._client.post("/api/v1/memory/store", body)
        return result.get("success", False)

    def query(self, query: str, namespace: Optional[str] = None) -> list[Any]:
        body = {"query": query}
        if namespace:
            body["namespace"] = namespace
        return self._client.post("/api/v1/memory/query", body)


class SkillMethods:
    """Skill listing and synthesis methods."""

    def __init__(self, client: HTTPClient):
        self._client = client

    def list(self) -> list[Skill]:
        raw = self._client.get("/api/v1/skills")
        return [
            Skill(
                name=s["name"],
                description=s.get("description", ""),
                triggers=s.get("triggers", []),
                risk_level=s.get("riskLevel", "LOW"),
            )
            for s in (raw or [])
        ]

    def synthesize(self, description: str) -> dict:
        return self._client.post("/api/v1/skills/synthesize", {"description": description})


class AGIOS:
    """
    Official AGI-OS Python SDK Client.

    Usage:
        from agios import AGIOS

        client = AGIOS(base_url="https://elazamey-agi-system.hf.space")

        # Execute a mission
        result = client.agent.execute(
            prompt="Analyze repository and deploy",
            capabilities=["github", "docker"]
        )
        print(f"Status: {result.status}")

        # List skills
        skills = client.skills.list()

        # Query memory
        memories = client.memory.query("deployment history")
    """

    def __init__(self, base_url: str, api_key: Optional[str] = None,
                 timeout: int = 30, retries: int = 3):
        if not base_url:
            raise ValueError("base_url is required")

        self._client = HTTPClient(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            retries=retries,
        )
        self.agent = AgentMethods(self._client)
        self.memory = MemoryMethods(self._client)
        self.skills = SkillMethods(self._client)

    def health(self) -> HealthStatus:
        raw = self._client.get("/health")
        return HealthStatus(
            status=raw.get("status", "unknown"),
            version=raw.get("version", "unknown"),
            uptime=raw.get("uptime", 0),
            missions=raw.get("missions", 0),
            skills=raw.get("skills", 0),
        )

    def models(self) -> list[ModelInfo]:
        raw = self._client.get("/v1/models")
        return [
            ModelInfo(id=m["id"], name=m["id"], provider=m.get("owned_by", "unknown"))
            for m in (raw or [])
        ]

    def ready(self) -> bool:
        try:
            result = self._client.get("/ready")
            return result.get("ready", False)
        except Exception:
            return False
