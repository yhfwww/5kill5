"""Manifest parsing for 5KILL5 release manifests."""

from dataclasses import dataclass
from typing import Optional
import json


@dataclass
class SkillFile:
    """Represents a skill file within a release manifest."""

    skill_id: str
    version_id: str
    name: str
    sha256: str
    content: Optional[str] = None

    def __post_init__(self):
        if self.skill_id is None:
            self.skill_id = ""
        if self.version_id is None:
            self.version_id = ""
        if self.name is None:
            self.name = ""
        if self.sha256 is None:
            self.sha256 = ""


@dataclass
class ReleaseManifest:
    """Represents a complete release manifest."""

    release_id: str
    profile_name: str
    agent_type: str
    task_context: str
    strategy: str
    target_path_hint: str
    skills: list[SkillFile]

    @classmethod
    def from_json(cls, input_str: str) -> "ReleaseManifest":
        """Parse a release manifest from JSON string."""
        try:
            data = json.loads(input_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}")

        profile = data.get("profile", {})
        apply_config = data.get("apply", {})
        skills_data = data.get("skills", [])

        skills = []
        for skill_data in skills_data:
            skill = SkillFile(
                skill_id=skill_data.get("skill_id", ""),
                version_id=skill_data.get("version_id", ""),
                name=skill_data.get("name", ""),
                sha256=skill_data.get("sha256", ""),
                content=skill_data.get("content"),
            )
            if skill.name:
                skills.append(skill)

        if not skills:
            raise ValueError("manifest has no skills")

        return cls(
            release_id=data.get("release_id", "unknown-release"),
            profile_name=profile.get("name", "unknown-profile"),
            agent_type=profile.get("agent_type", "generic"),
            task_context=profile.get("task_context", ""),
            strategy=apply_config.get("strategy", "copy"),
            target_path_hint=apply_config.get("target_path_hint", ""),
            skills=skills,
        )

    @classmethod
    def from_file(cls, path: str) -> "ReleaseManifest":
        """Load a release manifest from a file."""
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return cls.from_json(content)
