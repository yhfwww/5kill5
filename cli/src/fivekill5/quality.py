"""Quality scanning for 5KILL5 skills."""

from dataclasses import dataclass
from enum import Enum
import re


class Severity(Enum):
    """Severity levels for quality findings."""

    BLOCKER = "blocker"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Finding:
    """Represents a quality finding in a skill."""

    severity: Severity
    rule_id: str
    line_start: int
    line_end: int
    message: str
    recommendation: str


@dataclass
class QualityReport:
    """Quality scan report for a skill."""

    status: str
    score: int
    findings: list[Finding]


# Scoring penalties
PENALTIES = {
    Severity.BLOCKER: 45,
    Severity.HIGH: 25,
    Severity.MEDIUM: 12,
    Severity.LOW: 5,
}


def scan_skill(content: str) -> QualityReport:
    """Scan a skill's content and return quality report."""
    findings: list[Finding] = []

    frontmatter = _parse_frontmatter(content)

    # Check required frontmatter
    if not frontmatter.get("name", "").strip():
        findings.append(
            Finding(
                severity=Severity.BLOCKER,
                rule_id="format.required_frontmatter",
                line_start=1,
                line_end=1,
                message="Missing required manifest field: name",
                recommendation="Add name to YAML front matter.",
            )
        )

    version = frontmatter.get("version", "")
    if not version:
        findings.append(
            Finding(
                severity=Severity.BLOCKER,
                rule_id="format.required_frontmatter",
                line_start=1,
                line_end=1,
                message="Missing required manifest field: version",
                recommendation="Add version to YAML front matter.",
            )
        )
    elif not _is_semver(version):
        findings.append(
            Finding(
                severity=Severity.BLOCKER,
                rule_id="format.semver",
                line_start=1,
                line_end=1,
                message=f"Invalid SemVer: {version}",
                recommendation="Use a version such as 1.0.0.",
            )
        )

    # Check required sections
    if not _has_heading(content, "Trigger") or not _has_heading(content, "Steps"):
        findings.append(
            Finding(
                severity=Severity.BLOCKER,
                rule_id="format.required_sections",
                line_start=1,
                line_end=1,
                message="Required sections are incomplete",
                recommendation="Include ## Trigger and ## Steps sections.",
            )
        )

    # Line-by-line security checks
    for line_num, line in enumerate(content.split("\n"), start=1):
        line_lower = line.lower()

        # Secret patterns
        if _has_secret_pattern(line):
            findings.append(
                Finding(
                    severity=Severity.HIGH,
                    rule_id="security.secret_patterns",
                    line_start=line_num,
                    line_end=line_num,
                    message="Potential secret-like value found",
                    recommendation="Review the evidence and remove secrets before upload.",
                )
            )

        # Destructive commands
        if _has_destructive_command(line_lower):
            findings.append(
                Finding(
                    severity=Severity.HIGH,
                    rule_id="security.destructive_commands",
                    line_start=line_num,
                    line_end=line_num,
                    message="Potential destructive command found",
                    recommendation="Keep destructive actions out of skill instructions or require explicit review.",
                )
            )

        # Remote script execution
        if _has_remote_exec(line_lower):
            findings.append(
                Finding(
                    severity=Severity.HIGH,
                    rule_id="supply_chain.remote_fetch",
                    line_start=line_num,
                    line_end=line_num,
                    message="Remote script execution pattern found",
                    recommendation="Replace pipe-to-shell installation with inspectable steps.",
                )
            )

        # Prompt injection
        if _has_prompt_injection(line_lower):
            findings.append(
                Finding(
                    severity=Severity.MEDIUM,
                    rule_id="security.prompt_injection",
                    line_start=line_num,
                    line_end=line_num,
                    message="Prompt-injection language found",
                    recommendation="Review wording and allowlist only after manual verification.",
                )
            )

    # Calculate score
    penalty = sum(PENALTIES[f.severity] for f in findings)
    score = max(0, 100 - penalty)

    # Determine status
    if any(f.severity == Severity.BLOCKER for f in findings):
        status = "blocked"
    elif not findings:
        status = "passed"
    else:
        status = "warning"

    return QualityReport(status=status, score=score, findings=findings)


def _parse_frontmatter(content: str) -> dict[str, str]:
    """Parse YAML frontmatter from skill content."""
    values: dict[str, str] = {}
    lines = content.split("\n")
    
    if not lines or lines[0].strip() != "---":
        return values

    for line in lines[1:]:
        trimmed = line.strip()
        if trimmed == "---":
            break
        if ":" in trimmed:
            key, value = trimmed.split(":", 1)
            value = value.strip().strip('"').strip("'")
            if value:
                values[key.strip()] = value

    return values


def _is_semver(version: str) -> bool:
    """Check if a version string is valid SemVer."""
    # Remove pre-release and build metadata
    core = version.split("-")[0].split("+")[0]
    parts = core.split(".")

    if len(parts) < 3:
        return False

    major, minor, patch = parts[0], parts[1], parts[2]
    
    # Check all parts are numeric
    if not (major.isdigit() and minor.isdigit() and patch.isdigit()):
        return False

    # No leading zeros (except for 0 itself)
    if major != "0" and major.startswith("0"):
        return False
    if minor != "0" and minor.startswith("0"):
        return False
    if patch != "0" and patch.startswith("0"):
        return False

    return True


def _has_heading(content: str, heading: str) -> bool:
    """Check if content contains a specific heading."""
    pattern = re.compile(r"^##\s+(.+)$", re.MULTILINE | re.IGNORECASE)
    for match in pattern.finditer(content):
        if match.group(1).strip().lower() == heading.lower():
            return True
    return False


def _has_secret_pattern(line: str) -> bool:
    """Check if a line contains potential secret patterns."""
    # Direct patterns
    if "BEGIN PRIVATE KEY" in line:
        return True
    if "Authorization: Bearer " in line:
        return True

    # Token patterns (sk-, ghp_, github_pat_, AKIA, xoxb-)
    patterns = [
        (r"\bsk-[a-zA-Z0-9]{20,}", 23),
        (r"\bghp_[a-zA-Z0-9]{20,}", 24),
        (r"\bgithub_pat_[a-zA-Z0-9_]{20,}", 31),
        (r"\bAKIA[A-Z0-9]{16,}", 20),
        (r"\bxoxb-[a-zA-Z0-9-]{20,}", 25),
    ]

    for pattern, min_len in patterns:
        if re.search(pattern, line):
            return True

    return False


def _has_destructive_command(lower: str) -> bool:
    """Check for destructive command patterns."""
    patterns = [
        r"rm\s+-rf\s+/",
        r"remove-item\s+-recurse\s+-force",
        r"del\s+/s\s+/q",
        r"diskpart",
        r"git\s+reset\s+--hard",
        r"format\s+c:",
    ]

    for pattern in patterns:
        if re.search(pattern, lower):
            return True

    return False


def _has_remote_exec(lower: str) -> bool:
    """Check for remote script execution patterns."""
    # Must have curl/wget/invoke-webrequest AND pipe to shell
    has_fetcher = bool(re.search(r"(curl|wget|invoke-webrequest)\s+", lower))
    has_pipe_shell = bool(
        re.search(r"\|\s*(sh|bash|invoke-expression|iex)", lower)
    )

    return has_fetcher and has_pipe_shell


def _has_prompt_injection(lower: str) -> bool:
    """Check for prompt injection patterns."""
    patterns = [
        r"ignore\s+(previous|all)\s+instructions",
        r"ignore\s+system\s+instructions",
        r"leak\s+system\s+prompt",
        r"bypass\s+safety",
        r"silent\s+hidden\s+step",
    ]

    for pattern in patterns:
        if re.search(pattern, lower):
            return True

    return False
