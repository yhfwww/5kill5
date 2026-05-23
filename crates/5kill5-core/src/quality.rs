#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Severity {
    Blocker,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Finding {
    pub severity: Severity,
    pub rule_id: String,
    pub line_start: usize,
    pub line_end: usize,
    pub message: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QualityReport {
    pub status: String,
    pub score: u8,
    pub findings: Vec<Finding>,
}

pub fn scan_skill(content: &str) -> QualityReport {
    let frontmatter = parse_frontmatter(content);
    let mut findings = Vec::new();

    match frontmatter.get("name") {
        Some(value) if !value.trim().is_empty() => {}
        _ => findings.push(finding(
            Severity::Blocker,
            "format.required_frontmatter",
            1,
            "Missing required manifest field: name",
            "Add name to YAML front matter.",
        )),
    }

    match frontmatter.get("version") {
        Some(value) if is_semver(value) => {}
        Some(value) => findings.push(finding(
            Severity::Blocker,
            "format.semver",
            1,
            &format!("Invalid SemVer: {value}"),
            "Use a version such as 1.0.0.",
        )),
        None => findings.push(finding(
            Severity::Blocker,
            "format.required_frontmatter",
            1,
            "Missing required manifest field: version",
            "Add version to YAML front matter.",
        )),
    }

    if !has_heading(content, "Trigger") || !has_heading(content, "Steps") {
        findings.push(finding(
            Severity::Blocker,
            "format.required_sections",
            1,
            "Required sections are incomplete",
            "Include ## Trigger and ## Steps sections.",
        ));
    }

    for (line_number, line) in content.lines().enumerate() {
        let line_start = line_number + 1;
        let lower = line.to_ascii_lowercase();

        if has_secret_pattern(line) {
            findings.push(finding(
                Severity::High,
                "security.secret_patterns",
                line_start,
                "Potential secret-like value found",
                "Review the evidence and remove secrets before upload.",
            ));
        }

        if has_destructive_command(&lower) {
            findings.push(finding(
                Severity::High,
                "security.destructive_commands",
                line_start,
                "Potential destructive command found",
                "Keep destructive actions out of skill instructions or require explicit review.",
            ));
        }

        if has_remote_exec(&lower) {
            findings.push(finding(
                Severity::High,
                "supply_chain.remote_fetch",
                line_start,
                "Remote script execution pattern found",
                "Replace pipe-to-shell installation with inspectable steps.",
            ));
        }

        if has_prompt_injection(&lower) {
            findings.push(finding(
                Severity::Medium,
                "security.prompt_injection",
                line_start,
                "Prompt-injection language found",
                "Review wording and allowlist only after manual verification.",
            ));
        }
    }

    let penalty: usize = findings
        .iter()
        .map(|item| match item.severity {
            Severity::Blocker => 45,
            Severity::High => 25,
            Severity::Medium => 12,
            Severity::Low => 5,
        })
        .sum();
    let status = if findings.iter().any(|item| item.severity == Severity::Blocker) {
        "blocked"
    } else if findings.is_empty() {
        "passed"
    } else {
        "warning"
    };

    QualityReport {
        status: status.to_string(),
        score: 100usize.saturating_sub(penalty) as u8,
        findings,
    }
}

fn finding(
    severity: Severity,
    rule_id: &str,
    line_start: usize,
    message: &str,
    recommendation: &str,
) -> Finding {
    Finding {
        severity,
        rule_id: rule_id.to_string(),
        line_start,
        line_end: line_start,
        message: message.to_string(),
        recommendation: recommendation.to_string(),
    }
}

fn parse_frontmatter(content: &str) -> std::collections::HashMap<String, String> {
    let mut values = std::collections::HashMap::new();
    let mut lines = content.lines();
    if lines.next().map(str::trim) != Some("---") {
        return values;
    }

    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        if let Some((key, value)) = trimmed.split_once(':') {
            if !value.trim().is_empty() {
                values.insert(key.trim().to_string(), value.trim().trim_matches('"').to_string());
            }
        }
    }

    values
}

fn is_semver(version: &str) -> bool {
    let core = version.split(['-', '+']).next().unwrap_or(version);
    let mut parts = core.split('.');
    let Some(major) = parts.next() else { return false };
    let Some(minor) = parts.next() else { return false };
    let Some(patch) = parts.next() else { return false };
    parts.next().is_none() && is_number(major) && is_number(minor) && is_number(patch)
}

fn is_number(value: &str) -> bool {
    !value.is_empty()
        && value.chars().all(|ch| ch.is_ascii_digit())
        && (value == "0" || !value.starts_with('0'))
}

fn has_heading(content: &str, heading: &str) -> bool {
    content.lines().any(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("##")
            .map(|value| value.trim().eq_ignore_ascii_case(heading))
            .unwrap_or(false)
    })
}

fn has_secret_pattern(line: &str) -> bool {
    line.contains("BEGIN PRIVATE KEY")
        || line.contains("Authorization: Bearer ")
        || line.split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '_' && ch != '-')
            .any(|token| {
                token.starts_with("sk-") && token.len() >= 23
                    || token.starts_with("ghp_") && token.len() >= 24
                    || token.starts_with("github_pat_") && token.len() >= 31
                    || token.starts_with("AKIA") && token.len() >= 20
                    || token.starts_with("xoxb-") && token.len() >= 25
            })
}

fn has_destructive_command(lower: &str) -> bool {
    lower.contains("rm -rf /")
        || lower.contains("remove-item -recurse -force")
        || lower.contains("del /s /q")
        || lower.contains("diskpart")
        || lower.contains("git reset --hard")
        || lower.contains("format c:")
}

fn has_remote_exec(lower: &str) -> bool {
    (lower.contains("curl ") || lower.contains("wget ") || lower.contains("invoke-webrequest "))
        && (lower.contains("| sh")
            || lower.contains("| bash")
            || lower.contains("| invoke-expression")
            || lower.contains("| iex"))
}

fn has_prompt_injection(lower: &str) -> bool {
    lower.contains("ignore previous instructions")
        || lower.contains("ignore system instructions")
        || lower.contains("leak system prompt")
        || lower.contains("bypass safety")
        || lower.contains("silent hidden step")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_missing_required_fields() {
        let report = scan_skill("# Test\n\n## Trigger\n\nx\n\n## Steps\n\nx");
        assert_eq!(report.status, "blocked");
        assert!(report.findings.iter().any(|item| item.rule_id == "format.required_frontmatter"));
    }

    #[test]
    fn warns_on_destructive_command() {
        let content = "---\nname: test\nversion: 1.0.0\n---\n\n## Trigger\n\nx\n\n## Steps\n\nrm -rf /";
        let report = scan_skill(content);
        assert!(report.findings.iter().any(|item| item.rule_id == "security.destructive_commands"));
    }
}
