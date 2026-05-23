#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReleaseManifest {
    pub release_id: String,
    pub profile_name: String,
    pub agent_type: String,
    pub task_context: String,
    pub strategy: String,
    pub target_path_hint: String,
    pub skills: Vec<SkillFile>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillFile {
    pub skill_id: String,
    pub version_id: String,
    pub name: String,
    pub sha256: String,
    pub content: Option<String>,
}

impl ReleaseManifest {
    pub fn from_json(input: &str) -> Result<Self, String> {
        let profile = extract_object(input, "profile").unwrap_or_default();
        let apply = extract_object(input, "apply").unwrap_or_default();
        let skills = extract_array_objects(input, "skills")
            .into_iter()
            .map(|object| SkillFile {
                skill_id: extract_string(&object, "skill_id").unwrap_or_default(),
                version_id: extract_string(&object, "version_id").unwrap_or_default(),
                name: extract_string(&object, "name").unwrap_or_default(),
                sha256: extract_string(&object, "sha256").unwrap_or_default(),
                content: extract_string(&object, "content"),
            })
            .filter(|skill| !skill.name.is_empty())
            .collect::<Vec<_>>();

        if skills.is_empty() {
            return Err("manifest has no skills".to_string());
        }

        Ok(Self {
            release_id: extract_string(input, "release_id").unwrap_or_else(|| "unknown-release".to_string()),
            profile_name: extract_string(&profile, "name").unwrap_or_else(|| "unknown-profile".to_string()),
            agent_type: extract_string(&profile, "agent_type").unwrap_or_else(|| "generic".to_string()),
            task_context: extract_string(&profile, "task_context").unwrap_or_default(),
            strategy: extract_string(&apply, "strategy").unwrap_or_else(|| "copy".to_string()),
            target_path_hint: extract_string(&apply, "target_path_hint").unwrap_or_default(),
            skills,
        })
    }
}

fn extract_object(input: &str, key: &str) -> Option<String> {
    let start = find_key(input, key)?;
    let colon = input[start..].find(':')? + start;
    let open = input[colon + 1..].find('{')? + colon + 1;
    let close = matching_delimiter(input, open, '{', '}')?;
    Some(input[open..=close].to_string())
}

fn extract_array_objects(input: &str, key: &str) -> Vec<String> {
    let Some(start) = find_key(input, key) else {
        return Vec::new();
    };
    let Some(colon) = input[start..].find(':').map(|pos| pos + start) else {
        return Vec::new();
    };
    let Some(open) = input[colon + 1..].find('[').map(|pos| pos + colon + 1) else {
        return Vec::new();
    };
    let Some(close) = matching_delimiter(input, open, '[', ']') else {
        return Vec::new();
    };

    let mut objects = Vec::new();
    let array = &input[open + 1..close];
    let mut offset = 0;
    while let Some(local_open) = array[offset..].find('{') {
        let object_start = offset + local_open;
        if let Some(object_end) = matching_delimiter(array, object_start, '{', '}') {
            objects.push(array[object_start..=object_end].to_string());
            offset = object_end + 1;
        } else {
            break;
        }
    }
    objects
}

fn extract_string(input: &str, key: &str) -> Option<String> {
    let start = find_key(input, key)?;
    let colon = input[start..].find(':')? + start;
    let quote = input[colon + 1..].find('"')? + colon + 1;
    parse_json_string(input, quote)
}

fn find_key(input: &str, key: &str) -> Option<usize> {
    let needle = format!("\"{key}\"");
    input.find(&needle)
}

fn parse_json_string(input: &str, quote: usize) -> Option<String> {
    if input.as_bytes().get(quote) != Some(&b'"') {
        return None;
    }

    let mut output = String::new();
    let mut escaped = false;
    for ch in input[quote + 1..].chars() {
        if escaped {
            match ch {
                '"' => output.push('"'),
                '\\' => output.push('\\'),
                '/' => output.push('/'),
                'b' => output.push('\u{0008}'),
                'f' => output.push('\u{000c}'),
                'n' => output.push('\n'),
                'r' => output.push('\r'),
                't' => output.push('\t'),
                _ => output.push(ch),
            }
            escaped = false;
            continue;
        }

        match ch {
            '\\' => escaped = true,
            '"' => return Some(output),
            _ => output.push(ch),
        }
    }

    None
}

fn matching_delimiter(input: &str, open: usize, left: char, right: char) -> Option<usize> {
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (offset, ch) in input[open..].char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }

        if ch == '"' {
            in_string = true;
        } else if ch == left {
            depth += 1;
        } else if ch == right {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                return Some(open + offset);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_manifest_with_skill_content() {
        let input = r#"{
          "release_id": "rel_1",
          "profile": { "name": "Codex", "agent_type": "codex", "task_context": "frontend" },
          "skills": [
            { "skill_id": "s1", "version_id": "v1", "name": "code-review", "sha256": "abc", "content": "hello\nworld" }
          ],
          "apply": { "strategy": "copy", "target_path_hint": "/tmp/skills" }
        }"#;
        let manifest = ReleaseManifest::from_json(input).unwrap();
        assert_eq!(manifest.release_id, "rel_1");
        assert_eq!(manifest.skills[0].content.as_deref(), Some("hello\nworld"));
    }
}
