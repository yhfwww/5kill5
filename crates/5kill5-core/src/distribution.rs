use crate::manifest::{ReleaseManifest, SkillFile};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DistributionAction {
    Add,
    Update,
    Skip,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedSkill {
    pub action: DistributionAction,
    pub skill_name: String,
    pub target_file: PathBuf,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DistributionPlan {
    pub release_id: String,
    pub target_dir: PathBuf,
    pub items: Vec<PlannedSkill>,
}

impl DistributionPlan {
    pub fn has_conflicts(&self) -> bool {
        self.items.iter().any(|item| item.action == DistributionAction::Conflict)
    }

    pub fn writable_count(&self) -> usize {
        self.items
            .iter()
            .filter(|item| matches!(item.action, DistributionAction::Add | DistributionAction::Update))
            .count()
    }
}

pub fn plan_manifest(manifest: &ReleaseManifest, target_dir: &Path) -> Result<DistributionPlan, String> {
    let mut items = Vec::new();

    for skill in &manifest.skills {
        let skill_dir = target_dir.join(safe_segment(&skill.name));
        let target_file = skill_dir.join("SKILL.md");
        let state_file = skill_dir.join(".5kill5.json");

        let planned = if !target_file.exists() {
            PlannedSkill {
                action: DistributionAction::Add,
                skill_name: skill.name.clone(),
                target_file,
                reason: "target file does not exist".to_string(),
            }
        } else if !state_file.exists() {
            PlannedSkill {
                action: DistributionAction::Conflict,
                skill_name: skill.name.clone(),
                target_file,
                reason: "existing file is not managed by 5KILL5".to_string(),
            }
        } else {
            let current = read_to_string(&target_file)?;
            let current_hash = content_hash(&current);
            let previous_hash = read_state_hash(&state_file).unwrap_or_default();
            let incoming_hash = incoming_content_hash(skill);

            if current_hash != previous_hash {
                PlannedSkill {
                    action: DistributionAction::Conflict,
                    skill_name: skill.name.clone(),
                    target_file,
                    reason: "managed file changed locally; refusing overwrite".to_string(),
                }
            } else if current_hash == incoming_hash {
                PlannedSkill {
                    action: DistributionAction::Skip,
                    skill_name: skill.name.clone(),
                    target_file,
                    reason: "already current".to_string(),
                }
            } else {
                PlannedSkill {
                    action: DistributionAction::Update,
                    skill_name: skill.name.clone(),
                    target_file,
                    reason: "managed file hash matches previous release".to_string(),
                }
            }
        };

        items.push(planned);
    }

    Ok(DistributionPlan {
        release_id: manifest.release_id.clone(),
        target_dir: target_dir.to_path_buf(),
        items,
    })
}

pub fn apply_manifest(manifest: &ReleaseManifest, target_dir: &Path, confirmed: bool) -> Result<DistributionPlan, String> {
    if !confirmed {
        return Err("apply requires explicit confirmation".to_string());
    }

    let plan = plan_manifest(manifest, target_dir)?;
    if plan.has_conflicts() {
        return Err("apply plan contains conflicts".to_string());
    }

    let history_dir = target_dir.join(".5kill5").join("history").join(timestamp());
    fs::create_dir_all(&history_dir).map_err(|err| format!("failed to create history dir: {err}"))?;

    for item in &plan.items {
        if !matches!(item.action, DistributionAction::Add | DistributionAction::Update) {
            continue;
        }

        let skill = manifest
            .skills
            .iter()
            .find(|candidate| candidate.name == item.skill_name)
            .ok_or_else(|| format!("skill {} missing from manifest", item.skill_name))?;
        write_skill(skill, manifest, &item.target_file, &history_dir)?;
    }

    write_apply_record(manifest, target_dir, &plan)?;
    Ok(plan)
}

pub fn rollback_latest(target_dir: &Path) -> Result<usize, String> {
    let history_root = target_dir.join(".5kill5").join("history");
    let mut entries = fs::read_dir(&history_root)
        .map_err(|err| format!("failed to read history dir {}: {err}", history_root.display()))?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    let Some(latest) = entries.pop() else {
        return Err("no rollback history found".to_string());
    };

    let manifest_path = latest.path().join("rollback.tsv");
    let body = read_to_string(&manifest_path)?;
    let mut restored = 0usize;
    for line in body.lines() {
        let mut parts = line.splitn(2, '\t');
        let Some(target) = parts.next() else { continue };
        let Some(backup) = parts.next() else { continue };
        if backup == "<created>" {
            let path = PathBuf::from(target);
            if path.exists() {
                fs::remove_file(&path).map_err(|err| format!("failed to remove {}: {err}", path.display()))?;
                restored += 1;
            }
            continue;
        }
        let target_path = PathBuf::from(target);
        fs::copy(backup, &target_path)
            .map_err(|err| format!("failed to restore {}: {err}", target_path.display()))?;
        restored += 1;
    }

    Ok(restored)
}

fn write_skill(skill: &SkillFile, manifest: &ReleaseManifest, target_file: &Path, history_dir: &Path) -> Result<(), String> {
    let Some(content) = &skill.content else {
        return Err(format!("skill {} does not include inline content; download object_key first", skill.name));
    };
    let skill_dir = target_file
        .parent()
        .ok_or_else(|| format!("invalid target path {}", target_file.display()))?;
    fs::create_dir_all(skill_dir).map_err(|err| format!("failed to create {}: {err}", skill_dir.display()))?;

    let backup_path = if target_file.exists() {
        let backup = history_dir.join(format!("{}.SKILL.md.bak", safe_segment(&skill.name)));
        fs::copy(target_file, &backup)
            .map_err(|err| format!("failed to back up {}: {err}", target_file.display()))?;
        backup.to_string_lossy().to_string()
    } else {
        "<created>".to_string()
    };

    let rollback_path = history_dir.join("rollback.tsv");
    let mut rollback = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&rollback_path)
        .map_err(|err| format!("failed to open rollback file: {err}"))?;
    writeln!(rollback, "{}\t{}", target_file.display(), backup_path)
        .map_err(|err| format!("failed to write rollback file: {err}"))?;

    fs::write(target_file, content).map_err(|err| format!("failed to write {}: {err}", target_file.display()))?;
    let state = format!(
        "{{\n  \"managed_by\": \"5kill5\",\n  \"release_id\": \"{}\",\n  \"profile\": \"{}\",\n  \"skill_id\": \"{}\",\n  \"version_id\": \"{}\",\n  \"remote_sha256\": \"{}\",\n  \"source_sha256\": \"{}\"\n}}\n",
        json_escape(&manifest.release_id),
        json_escape(&manifest.profile_name),
        json_escape(&skill.skill_id),
        json_escape(&skill.version_id),
        json_escape(&skill.sha256),
        json_escape(&incoming_content_hash(skill))
    );
    fs::write(skill_dir.join(".5kill5.json"), state)
        .map_err(|err| format!("failed to write state for {}: {err}", skill.name))?;
    Ok(())
}

fn write_apply_record(manifest: &ReleaseManifest, target_dir: &Path, plan: &DistributionPlan) -> Result<(), String> {
    let root = target_dir.join(".5kill5");
    fs::create_dir_all(&root).map_err(|err| format!("failed to create {}: {err}", root.display()))?;
    let mut body = String::new();
    body.push_str(&format!("release_id={}\n", manifest.release_id));
    body.push_str(&format!("profile={}\n", manifest.profile_name));
    body.push_str(&format!("agent_type={}\n", manifest.agent_type));
    body.push_str(&format!("task_context={}\n", manifest.task_context));
    body.push_str(&format!("strategy={}\n", manifest.strategy));
    body.push_str(&format!("writable_count={}\n", plan.writable_count()));
    fs::write(root.join("current-manifest.txt"), body).map_err(|err| format!("failed to write apply record: {err}"))
}

fn read_state_hash(path: &Path) -> Result<String, String> {
    let body = read_to_string(path)?;
    extract_state_string(&body, "source_sha256").ok_or_else(|| "source_sha256 missing".to_string())
}

fn extract_state_string(input: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\"");
    let start = input.find(&needle)?;
    let colon = input[start..].find(':')? + start;
    let open = input[colon + 1..].find('"')? + colon + 1;
    let close = input[open + 1..].find('"')? + open + 1;
    Some(input[open + 1..close].to_string())
}

fn read_to_string(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|err| format!("failed to open {}: {err}", path.display()))?;
    let mut body = String::new();
    file.read_to_string(&mut body)
        .map_err(|err| format!("failed to read {}: {err}", path.display()))?;
    Ok(body)
}

fn safe_segment(value: &str) -> String {
    let mut output = value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
        .collect::<String>();
    while output.contains("--") {
        output = output.replace("--", "-");
    }
    output.trim_matches('-').to_string()
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn incoming_content_hash(skill: &SkillFile) -> String {
    skill
        .content
        .as_ref()
        .map(|content| content_hash(content))
        .unwrap_or_else(|| skill.sha256.clone())
}

fn content_hash(content: &str) -> String {
    sha256_hex(content.as_bytes())
}

fn sha256_hex(input: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    let mut h: [u32; 8] = [
        0x6a09e667,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];

    let bit_len = (input.len() as u64) * 8;
    let mut data = input.to_vec();
    data.push(0x80);
    while (data.len() % 64) != 56 {
        data.push(0);
    }
    data.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in data.chunks_exact(64) {
        let mut w = [0u32; 64];
        for index in 0..16 {
            let start = index * 4;
            w[index] = u32::from_be_bytes([
                chunk[start],
                chunk[start + 1],
                chunk[start + 2],
                chunk[start + 3],
            ]);
        }
        for index in 16..64 {
            let s0 = w[index - 15].rotate_right(7) ^ w[index - 15].rotate_right(18) ^ (w[index - 15] >> 3);
            let s1 = w[index - 2].rotate_right(17) ^ w[index - 2].rotate_right(19) ^ (w[index - 2] >> 10);
            w[index] = w[index - 16]
                .wrapping_add(s0)
                .wrapping_add(w[index - 7])
                .wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut hh = h[7];

        for index in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[index])
                .wrapping_add(w[index]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    h.iter().map(|value| format!("{value:08x}")).collect::<Vec<_>>().join("")
}

fn json_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plans_new_skill_as_add() {
        let manifest = ReleaseManifest {
            release_id: "rel".to_string(),
            profile_name: "profile".to_string(),
            agent_type: "codex".to_string(),
            task_context: "general".to_string(),
            strategy: "copy".to_string(),
            target_path_hint: String::new(),
            skills: vec![SkillFile {
                skill_id: "s1".to_string(),
                version_id: "v1".to_string(),
                name: "code-review".to_string(),
                sha256: "abc".to_string(),
                content: Some("content".to_string()),
            }],
        };
        let target = std::env::temp_dir().join(format!("5kill5-test-{}", timestamp()));
        let plan = plan_manifest(&manifest, &target).unwrap();
        assert_eq!(plan.items[0].action, DistributionAction::Add);
        let _ = fs::remove_dir_all(target);
    }
}
