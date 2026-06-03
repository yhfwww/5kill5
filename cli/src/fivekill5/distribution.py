"""Distribution mechanism for 5KILL5 skills."""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
import hashlib
import json
import shutil
import time

from .manifest import ReleaseManifest, SkillFile


class DistributionAction(Enum):
    """Actions for skill distribution."""

    ADD = "add"
    UPDATE = "update"
    SKIP = "skip"
    CONFLICT = "conflict"


@dataclass
class PlannedSkill:
    """Represents a planned skill operation."""

    action: DistributionAction
    skill_name: str
    target_file: Path
    reason: str


@dataclass
class DistributionPlan:
    """Represents a complete distribution plan."""

    release_id: str
    target_dir: Path
    items: list[PlannedSkill]

    def has_conflicts(self) -> bool:
        """Check if plan contains any conflicts."""
        return any(item.action == DistributionAction.CONFLICT for item in self.items)

    def writable_count(self) -> int:
        """Count of skills that will be written."""
        return sum(
            1 for item in self.items
            if item.action in (DistributionAction.ADD, DistributionAction.UPDATE)
        )


def plan_manifest(manifest: ReleaseManifest, target_dir: Path) -> DistributionPlan:
    """Create a distribution plan for a manifest."""
    items: list[PlannedSkill] = []

    for skill in manifest.skills:
        skill_dir = target_dir / _safe_segment(skill.name)
        target_file = skill_dir / "SKILL.md"
        state_file = skill_dir / ".5kill5.json"

        if not target_file.exists():
            # New skill - add
            items.append(
                PlannedSkill(
                    action=DistributionAction.ADD,
                    skill_name=skill.name,
                    target_file=target_file,
                    reason="target file does not exist",
                )
            )
        elif not state_file.exists():
            # Existing file not managed by 5KILL5
            items.append(
                PlannedSkill(
                    action=DistributionAction.CONFLICT,
                    skill_name=skill.name,
                    target_file=target_file,
                    reason="existing file is not managed by 5KILL5",
                )
            )
        else:
            # Check hashes
            current_content = target_file.read_text(encoding="utf-8")
            current_hash = _content_hash(current_content)
            previous_hash = _read_state_hash(state_file) or ""
            incoming_hash = _incoming_content_hash(skill)

            if current_hash != previous_hash:
                items.append(
                    PlannedSkill(
                        action=DistributionAction.CONFLICT,
                        skill_name=skill.name,
                        target_file=target_file,
                        reason="managed file changed locally; refusing overwrite",
                    )
                )
            elif current_hash == incoming_hash:
                items.append(
                    PlannedSkill(
                        action=DistributionAction.SKIP,
                        skill_name=skill.name,
                        target_file=target_file,
                        reason="already current",
                    )
                )
            else:
                items.append(
                    PlannedSkill(
                        action=DistributionAction.UPDATE,
                        skill_name=skill.name,
                        target_file=target_file,
                        reason="managed file hash matches previous release",
                    )
                )

    return DistributionPlan(
        release_id=manifest.release_id,
        target_dir=target_dir,
        items=items,
    )


def apply_manifest(
    manifest: ReleaseManifest,
    target_dir: Path,
    confirmed: bool,
) -> DistributionPlan:
    """Apply a manifest to target directory."""
    if not confirmed:
        raise ValueError("apply requires explicit confirmation")

    plan = plan_manifest(manifest, target_dir)
    if plan.has_conflicts():
        raise ValueError("apply plan contains conflicts")

    # Create history directory
    history_dir = target_dir / ".5kill5" / "history" / _timestamp()
    history_dir.mkdir(parents=True, exist_ok=True)

    # Apply each writable skill
    for item in plan.items:
        if item.action not in (DistributionAction.ADD, DistributionAction.UPDATE):
            continue

        skill = next(
            (s for s in manifest.skills if s.name == item.skill_name),
            None,
        )
        if skill is None:
            raise ValueError(f"skill {item.skill_name} missing from manifest")

        _write_skill(skill, manifest, item.target_file, history_dir)

    # Write apply record
    _write_apply_record(manifest, target_dir, plan)

    return plan


def rollback_latest(target_dir: Path) -> int:
    """Rollback to the latest deployment."""
    history_root = target_dir / ".5kill5" / "history"

    if not history_root.exists():
        raise ValueError("no rollback history found")

    # Find latest history directory
    entries = [
        entry for entry in history_root.iterdir()
        if entry.is_dir()
    ]

    if not entries:
        raise ValueError("no rollback history found")

    entries.sort(key=lambda e: e.name)
    latest = entries[-1]

    # Read rollback manifest
    rollback_path = latest / "rollback.tsv"
    if not rollback_path.exists():
        raise ValueError("rollback manifest not found")

    body = rollback_path.read_text(encoding="utf-8")
    restored = 0

    for line in body.strip().split("\n"):
        if not line:
            continue
        parts = line.split("\t", 1)
        if len(parts) < 2:
            continue

        target_path = Path(parts[0])
        backup = parts[1]

        if backup == "<created>":
            # File was created, remove it
            if target_path.exists():
                target_path.unlink()
                restored += 1
        else:
            # Restore from backup
            shutil.copy2(backup, target_path)
            restored += 1

    return restored


def _write_skill(
    skill: SkillFile,
    manifest: ReleaseManifest,
    target_file: Path,
    history_dir: Path,
) -> None:
    """Write a skill file to target."""
    if skill.content is None:
        raise ValueError(
            f"skill {skill.name} does not include inline content; "
            "download object_key first"
        )

    skill_dir = target_file.parent
    skill_dir.mkdir(parents=True, exist_ok=True)

    # Create backup
    if target_file.exists():
        backup_path = history_dir / f"{_safe_segment(skill.name)}.SKILL.md.bak"
        shutil.copy2(target_file, backup_path)
        backup_str = str(backup_path)
    else:
        backup_str = "<created>"

    # Write rollback entry
    rollback_path = history_dir / "rollback.tsv"
    with open(rollback_path, "a", encoding="utf-8") as f:
        f.write(f"{target_file}\t{backup_str}\n")

    # Write skill content
    target_file.write_text(skill.content, encoding="utf-8")

    # Write state file
    state = {
        "managed_by": "5kill5",
        "release_id": manifest.release_id,
        "profile": manifest.profile_name,
        "skill_id": skill.skill_id,
        "version_id": skill.version_id,
        "remote_sha256": skill.sha256,
        "source_sha256": _incoming_content_hash(skill),
    }
    (skill_dir / ".5kill5.json").write_text(
        json.dumps(state, indent=2) + "\n",
        encoding="utf-8",
    )


def _write_apply_record(
    manifest: ReleaseManifest,
    target_dir: Path,
    plan: DistributionPlan,
) -> None:
    """Write the apply record file."""
    root = target_dir / ".5kill5"
    root.mkdir(parents=True, exist_ok=True)

    body = "\n".join([
        f"release_id={manifest.release_id}",
        f"profile={manifest.profile_name}",
        f"agent_type={manifest.agent_type}",
        f"task_context={manifest.task_context}",
        f"strategy={manifest.strategy}",
        f"writable_count={plan.writable_count()}",
    ])

    (root / "current-manifest.txt").write_text(body + "\n", encoding="utf-8")


def _read_state_hash(state_file: Path) -> str | None:
    """Read source_sha256 from state file."""
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
        return state.get("source_sha256")
    except (json.JSONDecodeError, IOError):
        return None


def _safe_segment(value: str) -> str:
    """Sanitize a string for use in file paths."""
    result = "".join(
        c if c.isalnum() or c in "-_" else "-"
        for c in value
    )
    # Collapse multiple dashes
    while "--" in result:
        result = result.replace("--", "-")
    return result.strip("-")


def _timestamp() -> str:
    """Get current Unix timestamp as string."""
    return str(int(time.time()))


def _incoming_content_hash(skill: SkillFile) -> str:
    """Get hash for incoming skill content."""
    if skill.content is not None:
        return _content_hash(skill.content)
    return skill.sha256


def _content_hash(content: str) -> str:
    """Calculate SHA256 hash of content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
