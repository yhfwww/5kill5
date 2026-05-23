use fivekill5_core::{apply_manifest, plan_manifest, rollback_latest, DistributionAction, ReleaseManifest};
use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<(), String> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    if args.is_empty() {
        print_help();
        return Ok(());
    }

    match args.as_slice() {
        [group, command, rest @ ..] if group == "auth" && command == "login" => auth_login(rest),
        [group, command, ..] if group == "auth" && command == "status" => auth_status(),
        [group, command, rest @ ..] if group == "device" && command == "register" => device_register(rest),
        [group, command, rest @ ..] if group == "targets" && command == "set" => targets_set(rest),
        [command, rest @ ..] if command == "profiles" => profiles_list(rest),
        [command, rest @ ..] if command == "pull" => pull_manifest(rest),
        [command, rest @ ..] if command == "plan" => plan(rest),
        [command, rest @ ..] if command == "apply" => apply(rest),
        [command, rest @ ..] if command == "status" => status(rest),
        [command, rest @ ..] if command == "rollback" => rollback(rest),
        [group, command, ..] if group == "cache" && command == "clear" => cache_clear(),
        [command, ..] if command == "help" || command == "--help" || command == "-h" => {
            print_help();
            Ok(())
        }
        _ => Err("unknown command; run 5kill5 help".to_string()),
    }
}

fn print_help() {
    println!(
        "5KILL5 CLI\n\n\
Commands:\n\
  5kill5 auth login\n\
  5kill5 auth status\n\
  5kill5 device register --name <device-name>\n\
  5kill5 targets set --agent codex --path <path>\n\
  5kill5 profiles --manifest <manifest.json>\n\
  5kill5 pull --profile <profile> --manifest <manifest.json>\n\
  5kill5 plan --manifest <manifest.json> --target <skills-dir>\n\
  5kill5 apply --manifest <manifest.json> --target <skills-dir> [--yes]\n\
  5kill5 status --target <skills-dir>\n\
  5kill5 rollback --target <skills-dir>\n\
  5kill5 cache clear"
    );
}

fn auth_login(_args: &[String]) -> Result<(), String> {
    let home = app_home()?;
    fs::create_dir_all(&home).map_err(|err| format!("failed to create {}: {err}", home.display()))?;
    let token_path = home.join("token.json");
    let token = format!(
        "{{\n  \"token_type\": \"device_code_placeholder\",\n  \"scope\": \"release:read apply:report\",\n  \"created_at\": \"{}\"\n}}\n",
        timestamp()
    );
    fs::write(&token_path, token).map_err(|err| format!("failed to write token: {err}"))?;

    println!("Open https://app.5kill5.xyz/device");
    println!("Enter code: {}", device_code());
    println!("Token cache: {}", token_path.display());
    Ok(())
}

fn auth_status() -> Result<(), String> {
    let token_path = app_home()?.join("token.json");
    if token_path.exists() {
        println!("authenticated: {}", token_path.display());
    } else {
        println!("not authenticated");
    }
    Ok(())
}

fn device_register(args: &[String]) -> Result<(), String> {
    let name = value_after(args, "--name").unwrap_or_else(|| hostname_fallback());
    let home = app_home()?;
    fs::create_dir_all(&home).map_err(|err| format!("failed to create {}: {err}", home.display()))?;
    let body = format!(
        "name={}\nos={}\narch={}\nregistered_at={}\n",
        name,
        env::consts::OS,
        env::consts::ARCH,
        timestamp()
    );
    fs::write(home.join("device.txt"), body).map_err(|err| format!("failed to write device config: {err}"))?;
    println!("registered device: {name}");
    Ok(())
}

fn targets_set(args: &[String]) -> Result<(), String> {
    let agent = value_after(args, "--agent").unwrap_or_else(|| "generic".to_string());
    let path = value_after(args, "--path").ok_or_else(|| "--path is required".to_string())?;
    let home = app_home()?;
    fs::create_dir_all(&home).map_err(|err| format!("failed to create {}: {err}", home.display()))?;
    fs::write(home.join("targets.tsv"), format!("{agent}\t{path}\n"))
        .map_err(|err| format!("failed to write targets: {err}"))?;
    println!("target saved: {agent} -> {path}");
    Ok(())
}

fn profiles_list(args: &[String]) -> Result<(), String> {
    let manifest_path = value_after(args, "--manifest");
    if let Some(path) = manifest_path {
        let manifest = read_manifest(Path::new(&path))?;
        println!("{} [{} / {}]", manifest.profile_name, manifest.agent_type, manifest.task_context);
        println!("release: {}", manifest.release_id);
        println!("skills: {}", manifest.skills.len());
    } else {
        println!("cloud profile listing requires the hosted API; use --manifest to inspect a local release.");
    }
    Ok(())
}

fn pull_manifest(args: &[String]) -> Result<(), String> {
    let profile = value_after(args, "--profile").unwrap_or_else(|| "default".to_string());
    let manifest_path = value_after(args, "--manifest").ok_or_else(|| "--manifest is required for local pull".to_string())?;
    let home = app_home()?;
    let cache_dir = home.join("cache").join("releases").join(safe_segment(&profile));
    fs::create_dir_all(&cache_dir).map_err(|err| format!("failed to create cache dir: {err}"))?;
    fs::copy(Path::new(&manifest_path), cache_dir.join("manifest.json"))
        .map_err(|err| format!("failed to cache manifest: {err}"))?;
    println!("cached manifest for profile {profile}");
    Ok(())
}

fn plan(args: &[String]) -> Result<(), String> {
    let manifest_path = value_after(args, "--manifest").ok_or_else(|| "--manifest is required".to_string())?;
    let target = target_from_args(args)?;
    let manifest = read_manifest(Path::new(&manifest_path))?;
    let plan = plan_manifest(&manifest, &target)?;
    print_plan(&plan);
    if plan.has_conflicts() {
        return Err("plan contains conflicts".to_string());
    }
    Ok(())
}

fn apply(args: &[String]) -> Result<(), String> {
    let manifest_path = value_after(args, "--manifest").ok_or_else(|| "--manifest is required".to_string())?;
    let target = target_from_args(args)?;
    let manifest = read_manifest(Path::new(&manifest_path))?;
    let plan = plan_manifest(&manifest, &target)?;
    print_plan(&plan);
    if plan.has_conflicts() {
        return Err("apply stopped because the plan contains conflicts".to_string());
    }

    let confirmed = args.iter().any(|arg| arg == "--yes") || confirm("Apply this plan?");
    let applied = apply_manifest(&manifest, &target, confirmed)?;
    println!("applied {} changes to {}", applied.writable_count(), target.display());
    Ok(())
}

fn status(args: &[String]) -> Result<(), String> {
    let target = target_from_args(args)?;
    let record = target.join(".5kill5").join("current-manifest.txt");
    if record.exists() {
        println!("{}", fs::read_to_string(&record).map_err(|err| format!("failed to read status: {err}"))?);
    } else {
        println!("no 5KILL5 apply record in {}", target.display());
    }

    for entry in fs::read_dir(&target).map_err(|err| format!("failed to list target: {err}"))? {
        let entry = entry.map_err(|err| format!("failed to read target entry: {err}"))?;
        let state = entry.path().join(".5kill5.json");
        if state.exists() {
            println!("managed: {}", entry.file_name().to_string_lossy());
        }
    }
    Ok(())
}

fn rollback(args: &[String]) -> Result<(), String> {
    let target = target_from_args(args)?;
    let restored = rollback_latest(&target)?;
    println!("restored {restored} files");
    Ok(())
}

fn cache_clear() -> Result<(), String> {
    let cache = app_home()?.join("cache");
    if cache.exists() {
        fs::remove_dir_all(&cache).map_err(|err| format!("failed to clear cache: {err}"))?;
    }
    println!("cache cleared");
    Ok(())
}

fn read_manifest(path: &Path) -> Result<ReleaseManifest, String> {
    let body = fs::read_to_string(path).map_err(|err| format!("failed to read {}: {err}", path.display()))?;
    ReleaseManifest::from_json(&body)
}

fn print_plan(plan: &fivekill5_core::DistributionPlan) {
    println!("release: {}", plan.release_id);
    println!("target: {}", plan.target_dir.display());
    println!("{:<10}  {:<28}  {}", "action", "skill", "reason");
    for item in &plan.items {
        let action = match item.action {
            DistributionAction::Add => "add",
            DistributionAction::Update => "update",
            DistributionAction::Skip => "skip",
            DistributionAction::Conflict => "conflict",
        };
        println!("{:<10}  {:<28}  {}", action, item.skill_name, item.reason);
    }
}

fn confirm(prompt: &str) -> bool {
    print!("{prompt} Type yes to continue: ");
    let _ = io::stdout().flush();
    let mut input = String::new();
    io::stdin().read_line(&mut input).is_ok() && input.trim() == "yes"
}

fn target_from_args(args: &[String]) -> Result<PathBuf, String> {
    value_after(args, "--target")
        .or_else(|| target_from_config().ok())
        .map(PathBuf::from)
        .ok_or_else(|| "--target is required or configure targets set first".to_string())
}

fn target_from_config() -> Result<String, String> {
    let path = app_home()?.join("targets.tsv");
    let body = fs::read_to_string(&path).map_err(|err| format!("failed to read {}: {err}", path.display()))?;
    body.lines()
        .next()
        .and_then(|line| line.split_once('\t').map(|(_, target)| target.to_string()))
        .ok_or_else(|| "target config is empty".to_string())
}

fn value_after(args: &[String], flag: &str) -> Option<String> {
    args.windows(2).find_map(|pair| {
        if pair[0] == flag {
            Some(pair[1].clone())
        } else {
            None
        }
    })
}

fn app_home() -> Result<PathBuf, String> {
    if let Ok(path) = env::var("FIVEKILL5_HOME") {
        return Ok(PathBuf::from(path));
    }
    if let Ok(path) = env::var("LOCALAPPDATA") {
        return Ok(PathBuf::from(path).join("5kill5"));
    }
    if let Ok(path) = env::var("HOME") {
        return Ok(PathBuf::from(path).join(".config").join("5kill5"));
    }
    if let Ok(path) = env::var("USERPROFILE") {
        return Ok(PathBuf::from(path).join(".5kill5"));
    }
    Err("cannot determine application data directory; set FIVEKILL5_HOME".to_string())
}

fn device_code() -> String {
    let seed = timestamp();
    let chars = seed.chars().rev().collect::<String>();
    format!("{}-{}", &chars[0..4.min(chars.len())], &chars[4.min(chars.len())..8.min(chars.len())]).to_uppercase()
}

fn hostname_fallback() -> String {
    env::var("COMPUTERNAME")
        .or_else(|_| env::var("HOSTNAME"))
        .unwrap_or_else(|_| "current-device".to_string())
}

fn timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn safe_segment(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}
