"""5KILL5 CLI - Typer-based command line interface."""

import os
import shutil
import socket
import sys
import time
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from .manifest import ReleaseManifest
from .distribution import plan_manifest, apply_manifest, rollback_latest, DistributionAction
from . import __version__

app = typer.Typer(
    name="fivekill5",
    help="5KILL5 Skill Manager CLI",
    add_completion=False,
)

console = Console()


def _app_home() -> Path:
    """Get the application data directory."""
    if home := os.environ.get("FIVEKILL5_HOME"):
        return Path(home)
    if localappdata := os.environ.get("LOCALAPPDATA"):
        return Path(localappdata) / "5kill5"
    if home := os.environ.get("HOME"):
        return Path(home) / ".config" / "5kill5"
    if userprofile := os.environ.get("USERPROFILE"):
        return Path(userprofile) / ".5k5kill5"
    raise RuntimeError("Cannot determine application data directory; set FIVEKILL5_HOME")


def _device_code() -> str:
    """Generate a device code."""
    seed = str(int(time.time()))
    chars = seed[::-1]
    part1 = chars[:4].upper()
    part2 = chars[4:8].upper() if len(chars) > 4 else ""
    return f"{part1}-{part2}"


def _hostname() -> str:
    """Get hostname for device registration."""
    return (
        os.environ.get("COMPUTERNAME")
        or os.environ.get("HOSTNAME")
        or socket.gethostname()
        or "current-device"
    )


def _safe_segment(value: str) -> str:
    """Sanitize a string for cache directory."""
    return "".join(
        c if c.isalnum() or c in "-_" else "-"
        for c in value
    ).strip("-")


# ============ Auth Commands ============

auth_app = typer.Typer(name="auth", help="Authentication commands")


@auth_app.command("login")
def auth_login():
    """Login with device code."""
    home = _app_home()
    home.mkdir(parents=True, exist_ok=True)

    token_path = home / "token.json"
    token = f'''{{
  "token_type": "device_code_placeholder",
  "scope": "release:read apply:report",
  "created_at": "{int(time.time())}"
}}
'''
    token_path.write_text(token + "\n", encoding="utf-8")

    console.print(f"Open [link]https://app.5kill5.xyz/device[/link]")
    console.print(f"Enter code: {_device_code()}")
    console.print(f"Token cache: {token_path}")


@auth_app.command("status")
def auth_status():
    """Check authentication status."""
    token_path = _app_home() / "token.json"
    if token_path.exists():
        console.print(f"[green]authenticated:[/green] {token_path}")
    else:
        console.print("[yellow]not authenticated[/yellow]")


# ============ Device Commands ============

device_app = typer.Typer(name="device", help="Device management commands")


@device_app.command("register")
def device_register(name: Optional[str] = None):
    """Register this device."""
    name = name or _hostname()
    home = _app_home()
    home.mkdir(parents=True, exist_ok=True)

    device_file = home / "device.txt"
    content = (
        f"name={name}\n"
        f"os={os.name}\n"
        f"arch={os.environ.get('PROCESSOR_ARCHITECTURE', 'unknown')}\n"
        f"registered_at={int(time.time())}\n"
    )
    device_file.write_text(content, encoding="utf-8")
    console.print(f"[green]registered device:[/green] {name}")


# ============ Targets Commands ============

targets_app = typer.Typer(name="targets", help="Target path configuration")


@targets_app.command("set")
def targets_set(
    agent: str = typer.Option("generic", "--agent", help="Agent type"),
    path: str = typer.Option(..., "--path", help="Target path"),
):
    """Set the default target path for an agent."""
    home = _app_home()
    home.mkdir(parents=True, exist_ok=True)

    targets_file = home / "targets.tsv"
    targets_file.write_text(f"{agent}\t{path}\n", encoding="utf-8")
    console.print(f"[green]target saved:[/green] {agent} -> {path}")


# ============ Main Commands ============

@app.command()
def profiles(
    manifest: Optional[str] = typer.Option(None, "--manifest", help="Path to manifest file"),
):
    """List available profiles."""
    if manifest:
        try:
            release = ReleaseManifest.from_file(manifest)
            console.print(f"{release.profile_name} [{release.agent_type} / {release.task_context}]")
            console.print(f"release: {release.release_id}")
            console.print(f"skills: {len(release.skills)}")
        except Exception as e:
            console.print(f"[red]error:[/red] {e}", err=True)
            raise typer.Exit(1)
    else:
        console.print(
            "[yellow]cloud profile listing requires the hosted API; "
            "use --manifest to inspect a local release[/yellow]"
        )


@app.command()
def pull(
    profile: str = typer.Option("default", "--profile", help="Profile name"),
    manifest: str = typer.Option(..., "--manifest", help="Path to manifest file"),
):
    """Pull and cache a manifest."""
    home = _app_home()
    cache_dir = home / "cache" / "releases" / _safe_segment(profile)
    cache_dir.mkdir(parents=True, exist_ok=True)

    src = Path(manifest)
    if not src.exists():
        console.print(f"[red]error:[/red] manifest file not found: {manifest}", err=True)
        raise typer.Exit(1)

    shutil.copy2(src, cache_dir / "manifest.json")
    console.print(f"[green]cached manifest for profile[/green] {profile}")


@app.command()
def plan(
    manifest: str = typer.Option(..., "--manifest", help="Path to manifest file"),
    target: Optional[str] = typer.Option(None, "--target", help="Target directory"),
):
    """Preview distribution plan."""
    try:
        release = ReleaseManifest.from_file(manifest)
    except Exception as e:
        console.print(f"[red]error:[/red] {e}", err=True)
        raise typer.Exit(1)

    target_dir = _resolve_target(target)

    try:
        plan_result = plan_manifest(release, target_dir)
        _print_plan(plan_result)

        if plan_result.has_conflicts():
            console.print("[red]error:[/red] plan contains conflicts", err=True)
            raise typer.Exit(1)
    except Exception as e:
        console.print(f"[red]error:[/red] {e}", err=True)
        raise typer.Exit(1)


@app.command()
def apply(
    manifest: str = typer.Option(..., "--manifest", help="Path to manifest file"),
    target: Optional[str] = typer.Option(None, "--target", help="Target directory"),
    yes: bool = typer.Option(False, "--yes", help="Skip confirmation"),
):
    """Apply a manifest to target directory."""
    try:
        release = ReleaseManifest.from_file(manifest)
    except Exception as e:
        console.print(f"[red]error:[/red] {e}", err=True)
        raise typer.Exit(1)

    target_dir = _resolve_target(target)

    try:
        plan_result = plan_manifest(release, target_dir)
        _print_plan(plan_result)

        if plan_result.has_conflicts():
            console.print("[red]error:[/red] apply stopped because the plan contains conflicts", err=True)
            raise typer.Exit(1)

        if not yes:
            confirm = typer.confirm("Apply this plan?")
            if not confirm:
                raise typer.Exit(0)

        applied = apply_manifest(release, target_dir, True)
        console.print(f"[green]applied {applied.writable_count()} changes to {target_dir}[/green]")
    except Exception as e:
        console.print(f"[red]error:[/red] {e}", err=True)
        raise typer.Exit(1)


@app.command()
def status(
    target: Optional[str] = typer.Option(None, "--target", help="Target directory"),
):
    """Show deployment status."""
    target_dir = _resolve_target(target)
    record_file = target_dir / ".5kill5" / "current-manifest.txt"

    if record_file.exists():
        console.print(record_file.read_text(encoding="utf-8").strip())
    else:
        console.print(f"[yellow]no 5KILL5 apply record in {target_dir}[/yellow]")

    # List managed skills
    if target_dir.exists():
        for entry in target_dir.iterdir():
            if entry.is_dir() and (entry / ".5kill5.json").exists():
                console.print(f"managed: {entry.name}")


@app.command()
def rollback(
    target: Optional[str] = typer.Option(None, "--target", help="Target directory"),
):
    """Rollback to the previous deployment."""
    target_dir = _resolve_target(target)

    try:
        restored = rollback_latest(target_dir)
        console.print(f"[green]restored {restored} files[/green]")
    except Exception as e:
        console.print(f"[red]error:[/red] {e}", err=True)
        raise typer.Exit(1)


# ============ Cache Commands ============

cache_app = typer.Typer(name="cache", help="Cache management commands")


@cache_app.command("clear")
def cache_clear():
    """Clear the cache directory."""
    cache = _app_home() / "cache"
    if cache.exists():
        shutil.rmtree(cache)
    console.print("[green]cache cleared[/green]")


# Register sub-apps
app.add_typer(auth_app)
app.add_typer(device_app)
app.add_typer(targets_app)
app.add_typer(cache_app)


def _resolve_target(target: Optional[str]) -> Path:
    """Resolve target directory from argument or config."""
    if target:
        return Path(target)

    # Try to read from config
    targets_file = _app_home() / "targets.tsv"
    if targets_file.exists():
        content = targets_file.read_text(encoding="utf-8")
        line = content.strip().split("\n")[0]
        if "\t" in line:
            _, path = line.split("\t", 1)
            return Path(path.strip())

    raise typer.BadParameter("--target is required or configure targets set first")


def _print_plan(plan_result):
    """Print distribution plan in a formatted table."""
    console.print(f"release: {plan_result.release_id}")
    console.print(f"target: {plan_result.target_dir}")
    console.print()

    table = Table(show_header=True)
    table.add_column("action", style="cyan")
    table.add_column("skill", style="white")
    table.add_column("reason", style="dim")

    for item in plan_result.items:
        action_str = item.action.value
        if item.action == DistributionAction.CONFLICT:
            action_str = f"[red]{action_str}[/red]"
        elif item.action == DistributionAction.ADD:
            action_str = f"[green]{action_str}[/green]"
        elif item.action == DistributionAction.UPDATE:
            action_str = f"[yellow]{action_str}[/yellow]"

        table.add_row(action_str, item.skill_name, item.reason)

    console.print(table)


def main():
    """Entry point."""
    app()


if __name__ == "__main__":
    main()
