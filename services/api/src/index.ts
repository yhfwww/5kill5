type Env = {
  DB: D1Database;
  SKILL_OBJECTS: R2Bucket;
  ENVIRONMENT: string;
  RELEASE_CHANNEL: string;
};

type SkillFrontmatter = {
  name?: string;
  version?: string;
  description?: string;
  tags?: string[];
  triggers?: string[];
  compatibility?: { agents?: string[] };
  risk_level?: string;
  author?: string;
  license?: string;
};

type QualityFinding = {
  severity: "blocker" | "high" | "medium" | "low";
  rule_id: string;
  file_path: string;
  line_start: number;
  line_end: number;
  message: string;
  recommendation: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;

    try {
      if (route === "GET /health") {
        return json({ ok: true, service: "5kill5-api", environment: env.ENVIRONMENT });
      }

      if (route === "POST /v1/auth/device-code") {
        return json(await createDeviceCode());
      }

      if (route === "POST /v1/device/register") {
        return json(await registerDevice(request, env));
      }

      if (route === "GET /v1/skills") {
        return json(await listSkills(url, env));
      }

      if (route === "POST /v1/skills/import") {
        return json(await importSkill(request, env), { status: 201 });
      }

      if (request.method === "POST" && /^\/v1\/skills\/[^/]+\/publish$/.test(url.pathname)) {
        return json(await publishSkill(url.pathname.split("/")[3], env));
      }

      if (route === "POST /v1/packs") {
        return json(await createPack(request, env), { status: 201 });
      }

      if (request.method === "POST" && /^\/v1\/packs\/[^/]+\/publish$/.test(url.pathname)) {
        return json(await publishPack(url.pathname.split("/")[3], request, env));
      }

      if (route === "POST /v1/profiles") {
        return json(await createProfile(request, env), { status: 201 });
      }

      if (request.method === "POST" && /^\/v1\/profiles\/[^/]+\/release$/.test(url.pathname)) {
        return json(await releaseProfile(url.pathname.split("/")[3], env));
      }

      if (route === "GET /v1/device/profiles") {
        return json(await listDeviceProfiles(url, env));
      }

      if (route === "POST /v1/apply-reports") {
        return json(await createApplyReport(request, env), { status: 201 });
      }

      return json({ error: "not_found", path: url.pathname }, { status: 404 });
    } catch (error) {
      return json({
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  }
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(init.headers || {})
    }
  });
}

async function bodyJson<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function now() {
  return new Date().toISOString();
}

async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "skill";
}

function accountId(request: Request) {
  const header = request.headers.get("x-5kill5-account-id");
  return header || "acct_demo";
}

async function createDeviceCode() {
  const userCode = Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    device_code: id("device_code"),
    user_code: userCode,
    verification_uri: "https://app.5kill5.xyz/device",
    expires_in: 900,
    interval: 5
  };
}

async function registerDevice(request: Request, env: Env) {
  const input = await bodyJson<{ name: string; os: string; arch?: string; client_version?: string }>(request);
  const deviceId = id("dev");
  const account = accountId(request);
  const created = now();

  await ensureDemoAccount(env, account);
  await env.DB.prepare(
    `INSERT INTO devices (id, account_id, name, os, arch, client_version, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(deviceId, account, input.name, input.os, input.arch || null, input.client_version || null, created, created, created)
    .run();

  await audit(env, "device.registered", "device", deviceId, { account, name: input.name });
  return { id: deviceId, ...input, created_at: created };
}

async function ensureDemoAccount(env: Env, account: string) {
  const created = now();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO accounts (id, email, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(account, `${account}@local.5kill5`, "Local Demo", created, created)
    .run();
}

async function listSkills(url: URL, env: Env) {
  const account = url.searchParams.get("account_id") || "acct_demo";
  const q = `%${url.searchParams.get("q") || ""}%`;
  const agent = url.searchParams.get("agent");
  const risk = url.searchParams.get("risk");

  let sql = `SELECT * FROM skills
             WHERE account_id = ? AND status = 'active'
             AND (name LIKE ? OR description LIKE ? OR tags_json LIKE ? OR triggers_json LIKE ?)`;
  const params: unknown[] = [account, q, q, q, q];

  if (agent) {
    sql += " AND compatibility_json LIKE ?";
    params.push(`%${agent}%`);
  }
  if (risk) {
    sql += " AND risk_level = ?";
    params.push(risk);
  }
  sql += " ORDER BY updated_at DESC LIMIT 100";

  const result = await env.DB.prepare(sql).bind(...params).all();
  return { skills: result.results || [] };
}

async function importSkill(request: Request, env: Env) {
  const input = await bodyJson<{ file_name?: string; content: string; source_url?: string }>(request);
  const account = accountId(request);
  await ensureDemoAccount(env, account);

  const parsed = parseFrontmatter(input.content);
  const fm = parsed.frontmatter;
  const name = fm.name || (input.file_name || "SKILL.md").replace(/\.(md|markdown)$/i, "");
  const version = fm.version || "0.0.0";
  const skillId = id("skill");
  const skillVersionId = id("skill_ver");
  const contentHash = await sha256(input.content);
  const created = now();
  const objectKey = `accounts/${account}/skills/${skillId}/${version}/SKILL.md`;
  const findings = runQualityGate(fm, input.content);
  const qualityStatus = findings.some((finding) => finding.severity === "blocker") ? "blocked" : findings.length ? "warning" : "passed";

  await env.SKILL_OBJECTS.put(objectKey, input.content, {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
    customMetadata: { sha256: contentHash }
  });

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO skills (id, account_id, name, slug, description, tags_json, triggers_json, compatibility_json, risk_level, author, license, current_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      skillId,
      account,
      name,
      slugify(name),
      fm.description || "",
      JSON.stringify(fm.tags || []),
      JSON.stringify(fm.triggers || []),
      JSON.stringify(fm.compatibility || { agents: ["generic"] }),
      fm.risk_level || "medium",
      fm.author || null,
      fm.license || null,
      version,
      created,
      created
    ),
    env.DB.prepare(
      `INSERT INTO skill_versions (id, skill_id, version, lifecycle_state, object_key, sha256, frontmatter_json, trigger_text, content_summary, created_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`
    ).bind(
      skillVersionId,
      skillId,
      version,
      objectKey,
      contentHash,
      JSON.stringify(fm),
      (fm.triggers || []).join("\n"),
      parsed.body.slice(0, 400),
      created
    )
  ]);

  await writeQuality(env, "skill", skillVersionId, qualityStatus, findings);
  await refreshSkillIndex(env, skillId, name, fm, input.content);
  await audit(env, "skill.imported", "skill", skillId, { version, source_url: input.source_url || null, quality_status: qualityStatus });

  return {
    skill_id: skillId,
    version_id: skillVersionId,
    name,
    version,
    lifecycle_state: "draft",
    quality_status: qualityStatus,
    findings
  };
}

async function publishSkill(skillId: string, env: Env) {
  const version = await env.DB.prepare(
    `SELECT sv.id, sv.version
     FROM skill_versions sv
     WHERE sv.skill_id = ? AND sv.lifecycle_state = 'draft'
     ORDER BY sv.created_at DESC LIMIT 1`
  ).bind(skillId).first<{ id: string; version: string }>();

  if (!version) {
    return { error: "draft_not_found" };
  }

  const blocking = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM quality_runs qr
     JOIN quality_findings qf ON qf.run_id = qr.id
     WHERE qr.entity_version_id = ? AND qf.severity = 'blocker' AND qf.allowlisted = 0`
  ).bind(version.id).first<{ count: number }>();

  if ((blocking?.count || 0) > 0) {
    return { error: "quality_blocked", skill_id: skillId };
  }

  const published = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE skill_versions SET lifecycle_state = 'published', published_at = ? WHERE id = ?`).bind(published, version.id),
    env.DB.prepare(`UPDATE skills SET current_version = ?, updated_at = ? WHERE id = ?`).bind(version.version, published, skillId)
  ]);
  await audit(env, "skill.published", "skill", skillId, { version: version.version });
  return { skill_id: skillId, version: version.version, lifecycle_state: "published", published_at: published };
}

async function createPack(request: Request, env: Env) {
  const input = await bodyJson<{ name: string; description?: string; version: string; skill_version_ids: string[] }>(request);
  const account = accountId(request);
  await ensureDemoAccount(env, account);
  const created = now();
  const packId = id("pack");
  const packVersionId = id("pack_ver");

  const statements = [
    env.DB.prepare(
      `INSERT INTO packs (id, account_id, name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(packId, account, input.name, slugify(input.name), input.description || "", created, created),
    env.DB.prepare(
      `INSERT INTO pack_versions (id, pack_id, version, lifecycle_state, created_at)
       VALUES (?, ?, ?, 'draft', ?)`
    ).bind(packVersionId, packId, input.version, created)
  ];

  input.skill_version_ids.forEach((skillVersionId, index) => {
    statements.push(env.DB.prepare(
      `INSERT INTO pack_items (id, pack_version_id, skill_version_id, sort_order)
       VALUES (?, ?, ?, ?)`
    ).bind(id("pack_item"), packVersionId, skillVersionId, index));
  });

  await env.DB.batch(statements);
  await audit(env, "pack.created", "pack", packId, { version: input.version, skill_count: input.skill_version_ids.length });
  return { pack_id: packId, version_id: packVersionId, lifecycle_state: "draft" };
}

async function publishPack(packId: string, request: Request, env: Env) {
  const input = await bodyJson<{ version_id?: string }>(request);
  const packVersion = input.version_id
    ? await env.DB.prepare(`SELECT id, version FROM pack_versions WHERE id = ? AND pack_id = ?`).bind(input.version_id, packId).first<{ id: string; version: string }>()
    : await env.DB.prepare(
        `SELECT id, version FROM pack_versions WHERE pack_id = ? AND lifecycle_state = 'draft' ORDER BY created_at DESC LIMIT 1`
      ).bind(packId).first<{ id: string; version: string }>();

  if (!packVersion) {
    return { error: "draft_not_found" };
  }

  const blocked = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM pack_items pi
     JOIN quality_runs qr ON qr.entity_version_id = pi.skill_version_id
     JOIN quality_findings qf ON qf.run_id = qr.id
     WHERE pi.pack_version_id = ? AND qf.severity = 'blocker' AND qf.allowlisted = 0`
  ).bind(packVersion.id).first<{ count: number }>();

  if ((blocked?.count || 0) > 0) {
    return { error: "quality_blocked", pack_id: packId };
  }

  const published = now();
  await env.DB.prepare(`UPDATE pack_versions SET lifecycle_state = 'published', published_at = ? WHERE id = ?`).bind(published, packVersion.id).run();
  await audit(env, "pack.published", "pack", packId, { version: packVersion.version });
  return { pack_id: packId, version: packVersion.version, lifecycle_state: "published", published_at: published };
}

async function createProfile(request: Request, env: Env) {
  const input = await bodyJson<{
    name: string;
    version: string;
    agent_type: string;
    task_context?: string;
    pack_version_ids: string[];
    target_path_hint?: string;
  }>(request);
  const account = accountId(request);
  await ensureDemoAccount(env, account);
  const created = now();
  const profileId = id("profile");
  const profileVersionId = id("profile_ver");

  const statements = [
    env.DB.prepare(
      `INSERT INTO profiles (id, account_id, name, slug, task_context, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(profileId, account, input.name, slugify(input.name), input.task_context || null, created, created),
    env.DB.prepare(
      `INSERT INTO profile_versions (id, profile_id, version, lifecycle_state, agent_type, device_selector_json, task_context, created_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`
    ).bind(profileVersionId, profileId, input.version, input.agent_type, JSON.stringify({ target_path_hint: input.target_path_hint || "" }), input.task_context || null, created)
  ];

  input.pack_version_ids.forEach((packVersionId, index) => {
    statements.push(env.DB.prepare(
      `INSERT INTO profile_pack_items (id, profile_version_id, pack_version_id, sort_order)
       VALUES (?, ?, ?, ?)`
    ).bind(id("profile_pack"), profileVersionId, packVersionId, index));
  });

  await env.DB.batch(statements);
  await audit(env, "profile.created", "profile", profileId, { version: input.version, agent_type: input.agent_type });
  return { profile_id: profileId, version_id: profileVersionId, lifecycle_state: "draft" };
}

async function releaseProfile(profileId: string, env: Env) {
  const profile = await env.DB.prepare(
    `SELECT pv.*, p.account_id, p.name AS profile_name
     FROM profile_versions pv
     JOIN profiles p ON p.id = pv.profile_id
     WHERE pv.profile_id = ? AND pv.lifecycle_state = 'draft'
     ORDER BY pv.created_at DESC LIMIT 1`
  ).bind(profileId).first<any>();

  if (!profile) {
    return { error: "draft_not_found" };
  }

  const rows = await env.DB.prepare(
    `SELECT
       p.id AS pack_id,
       pv.version AS pack_version,
       s.id AS skill_id,
       s.name AS skill_name,
       sv.id AS skill_version_id,
       sv.version AS skill_version,
       sv.object_key,
       sv.sha256
     FROM profile_pack_items ppi
     JOIN pack_versions pv ON pv.id = ppi.pack_version_id
     JOIN packs p ON p.id = pv.pack_id
     JOIN pack_items pi ON pi.pack_version_id = pv.id
     JOIN skill_versions sv ON sv.id = pi.skill_version_id
     JOIN skills s ON s.id = sv.skill_id
     WHERE ppi.profile_version_id = ?
     ORDER BY ppi.sort_order, pi.sort_order`
  ).bind(profile.id).all<any>();

  const skillRows = rows.results || [];
  const manifest = {
    managed_by: "5kill5",
    version: 1,
    release_id: id("rel"),
    profile: {
      id: profile.profile_id,
      name: profile.profile_name,
      agent_type: profile.agent_type,
      task_context: profile.task_context
    },
    packs: [...new Map(skillRows.map((row) => [row.pack_id, {
      id: row.pack_id,
      version: row.pack_version,
      skills: skillRows.filter((item) => item.pack_id === row.pack_id).map((item) => item.skill_version_id)
    }])).values()],
    skills: skillRows.map((row) => ({
      skill_id: row.skill_id,
      version_id: row.skill_version_id,
      name: row.skill_name,
      object_key: row.object_key,
      sha256: row.sha256
    })),
    apply: {
      strategy: "copy",
      target_path_hint: JSON.parse(profile.device_selector_json || "{}").target_path_hint || ""
    }
  };

  const manifestBody = JSON.stringify(manifest, null, 2);
  const manifestHash = await sha256(manifestBody);
  const manifestKey = `accounts/${profile.account_id}/releases/${manifest.release_id}/manifest.json`;
  const published = now();

  await env.SKILL_OBJECTS.put(manifestKey, manifestBody, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { sha256: manifestHash }
  });

  await env.DB.batch([
    env.DB.prepare(`UPDATE profile_versions SET lifecycle_state = 'published', published_manifest_key = ?, published_at = ? WHERE id = ?`)
      .bind(manifestKey, published, profile.id),
    env.DB.prepare(
      `INSERT INTO releases (id, account_id, profile_version_id, channel, manifest_key, manifest_sha256, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(manifest.release_id, profile.account_id, profile.id, "stable", manifestKey, manifestHash, published)
  ]);

  await audit(env, "profile.released", "profile", profileId, { release_id: manifest.release_id, manifest_sha256: manifestHash });
  return { release_id: manifest.release_id, manifest_key: manifestKey, manifest_sha256: manifestHash, manifest };
}

async function listDeviceProfiles(url: URL, env: Env) {
  const deviceId = url.searchParams.get("device_id");
  if (!deviceId) {
    return { error: "device_id_required" };
  }

  const result = await env.DB.prepare(
    `SELECT p.id, p.name, p.task_context, dpb.agent_type, dpb.target_path_hint, r.id AS release_id, r.manifest_key, r.manifest_sha256, r.created_at AS released_at
     FROM device_profile_bindings dpb
     JOIN profiles p ON p.id = dpb.profile_id
     JOIN profile_versions pv ON pv.profile_id = p.id AND pv.lifecycle_state = 'published'
     LEFT JOIN releases r ON r.profile_version_id = pv.id
     WHERE dpb.device_id = ?
     ORDER BY p.name`
  ).bind(deviceId).all();

  return { profiles: result.results || [] };
}

async function createApplyReport(request: Request, env: Env) {
  const input = await bodyJson<{ device_id: string; release_id: string; agent_type: string; status: string; error_summary?: string }>(request);
  const reportId = id("apply");
  const account = accountId(request);
  const applied = now();

  await env.DB.prepare(
    `INSERT INTO apply_reports (id, account_id, device_id, release_id, agent_type, status, error_summary, applied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(reportId, account, input.device_id, input.release_id, input.agent_type, input.status, input.error_summary || null, applied)
    .run();

  await audit(env, "apply.reported", "apply_report", reportId, input);
  return { id: reportId, applied_at: applied };
}

function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: SkillFrontmatter = {};
  const lines = match[1].split(/\r?\n/);
  let key = "";
  let nested = "";

  for (const line of lines) {
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    const child = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    const item = line.match(/^\s*-\s*(.*)$/);

    if (top) {
      key = top[1];
      nested = "";
      if (top[2]) {
        (frontmatter as any)[key] = cleanYamlValue(top[2]);
      } else if (key === "compatibility") {
        frontmatter.compatibility = {};
      } else {
        (frontmatter as any)[key] = [];
      }
      continue;
    }

    if (child && key === "compatibility") {
      nested = child[1];
      (frontmatter.compatibility as any)[nested] = child[2] ? cleanYamlValue(child[2]) : [];
      continue;
    }

    if (item && key) {
      if (key === "compatibility" && nested) {
        ((frontmatter.compatibility as any)[nested] as string[]).push(cleanYamlValue(item[1]));
      } else {
        ((frontmatter as any)[key] as string[]).push(cleanYamlValue(item[1]));
      }
    }
  }

  return { frontmatter, body: content.slice(match[0].length).trim() };
}

function cleanYamlValue(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function runQualityGate(frontmatter: SkillFrontmatter, content: string): QualityFinding[] {
  const findings: QualityFinding[] = [];
  if (!frontmatter.name) {
    findings.push(quality("blocker", "format.required_frontmatter", "Missing required manifest field: name", "Add name to YAML front matter."));
  }
  if (!frontmatter.version) {
    findings.push(quality("blocker", "format.required_frontmatter", "Missing required manifest field: version", "Add version to YAML front matter."));
  } else if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/.test(frontmatter.version)) {
    findings.push(quality("blocker", "format.semver", `Invalid SemVer: ${frontmatter.version}`, "Use a version such as 1.0.0."));
  }
  if (!/^##\s+Trigger\b/im.test(content) || !/^##\s+Steps\b/im.test(content)) {
    findings.push(quality("blocker", "format.required_sections", "Required sections are incomplete", "Include ## Trigger and ## Steps sections."));
  }

  const rules: Array<[QualityFinding["severity"], string, RegExp, string]> = [
    ["high", "security.secret_patterns", /\b(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xoxb-[A-Za-z0-9-]{20,}|BEGIN PRIVATE KEY|Authorization:\s*Bearer\s+\S+)/i, "Potential secret-like value found"],
    ["high", "security.destructive_commands", /\b(rm\s+-rf\s+\/|Remove-Item\s+-Recurse\s+-Force|del\s+\/s\s+\/q|diskpart|git\s+reset\s+--hard|format\s+[A-Z]:)/i, "Potential destructive command found"],
    ["high", "supply_chain.remote_fetch", /(curl|wget|Invoke-WebRequest)[^\n|]*\|\s*(sh|bash|Invoke-Expression|iex)/i, "Remote script execution pattern found"],
    ["medium", "security.prompt_injection", /(ignore (previous|all|system) instructions|leak.*system prompt|bypass.*safety|silent hidden step)/i, "Prompt-injection language found"]
  ];

  for (const [severity, ruleId, pattern, message] of rules) {
    const match = content.match(pattern);
    if (match) {
      findings.push(quality(severity, ruleId, message, "Review evidence and allowlist only after manual verification.", lineOf(content, match.index || 0)));
    }
  }

  return findings;
}

function quality(
  severity: QualityFinding["severity"],
  ruleId: string,
  message: string,
  recommendation: string,
  lineStart = 1
): QualityFinding {
  return {
    severity,
    rule_id: ruleId,
    file_path: "SKILL.md",
    line_start: lineStart,
    line_end: lineStart,
    message,
    recommendation
  };
}

function lineOf(content: string, index: number) {
  return content.slice(0, index).split(/\r?\n/).length;
}

async function writeQuality(env: Env, entityType: string, entityVersionId: string, status: string, findings: QualityFinding[]) {
  const runId = id("qr");
  const created = now();
  const score = Math.max(0, 100 - findings.reduce((sum, finding) => sum + ({ blocker: 45, high: 25, medium: 12, low: 5 }[finding.severity] || 5), 0));
  const statements = [
    env.DB.prepare(
      `INSERT INTO quality_runs (id, entity_type, entity_version_id, status, score, ruleset_version, created_at)
       VALUES (?, ?, ?, ?, ?, 'mvp-2026-05-22', ?)`
    ).bind(runId, entityType, entityVersionId, status, score, created)
  ];

  findings.forEach((finding) => {
    statements.push(env.DB.prepare(
      `INSERT INTO quality_findings (id, run_id, severity, rule_id, file_path, line_start, line_end, message, recommendation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id("qf"), runId, finding.severity, finding.rule_id, finding.file_path, finding.line_start, finding.line_end, finding.message, finding.recommendation));
  });

  await env.DB.batch(statements);
}

async function refreshSkillIndex(env: Env, skillId: string, name: string, fm: SkillFrontmatter, content: string) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM skill_fts WHERE skill_id = ?`).bind(skillId),
    env.DB.prepare(
      `INSERT INTO skill_fts (skill_id, name, description, tags, trigger_text, content)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(skillId, name, fm.description || "", (fm.tags || []).join(" "), (fm.triggers || []).join(" "), content)
  ]);
}

async function audit(env: Env, eventType: string, entityType: string, entityId: string, payload: unknown) {
  await env.DB.prepare(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id("audit"), eventType, entityType, entityId, JSON.stringify(payload), now()).run();
}
