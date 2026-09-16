"""
AGI-OS Python SDK — Official client for AGI-OS Cognitive Agent OS

Usage:
    from agios import AGIOS

    client = AGIOS(base_url="https://elazamey-agi-system.hf.space")
    result = client.agent.execute(prompt="Analyze codebase")
"""

from .client import AGIOS
from .types import MissionResult, HealthStatus, Skill, ModelInfo

__version__ = "1.0.0"
__all__ = ["AGIOS", "MissionResult", "HealthStatus", "Skill", "ModelInfo"]
