const storageKey = "5kill5:mvp-console";

const sampleSkill = `---
name: code-review
version: 1.0.0
description: Review code changes and identify behavioral risks
tags:
  - coding
  - review
triggers:
  - code review
  - pull request
compatibility:
  agents:
    - codex
risk_level: medium
author: yhfwww
license: GPL-3.0
---

# Code Review

## Trigger

Use this skill when reviewing code changes, pull requests, or risky diffs.

## Steps

1. Inspect the changed files.
2. Prioritize correctness, data loss, and security findings.
3. Report issues with file and line references.
`;

const sampleDocsSkill = `---
name: docs-writer
version: 0.4.0
description: Turn implementation notes into concise user-facing documentation
tags:
  - docs
  - writing
triggers:
  - document this
compatibility:
  agents:
    - codex
    - generic
risk_level: low
author: yhfwww
license: GPL-3.0
---

# Docs Writer

## Trigger

Use this skill when a feature needs release notes, usage docs, or a README update.

## Steps

1. Identify the audience and surface area.
2. Explain the behavior first, then commands and caveats.
3. Keep examples small and directly runnable.
`;

const state = loadState();
if (!state.ui) state.ui = {};
let selectedSkillId = state.ui.selectedSkillId || state.skills[0]?.id;
let selectedPackId = state.ui.selectedPackId || state.packs[0]?.id;
let selectedProfileId = state.ui.selectedProfileId || state.profiles[0]?.id;
let locale = state.ui.locale || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en");

const routeTitleKeys = {
  skills: ["route.skills.eyebrow", "route.skills.title"],
  packs: ["route.packs.eyebrow", "route.packs.title"],
  profiles: ["route.profiles.eyebrow", "route.profiles.title"],
  devices: ["route.devices.eyebrow", "route.devices.title"],
  quality: ["route.quality.eyebrow", "route.quality.title"],
  privacy: ["route.privacy.eyebrow", "route.privacy.title"]
};

const translations = {
  en: {
    "nav.skills": "Skills",
    "app.title": "5KILL5 Skill Manager",
    "nav.packs": "Packs",
    "nav.profiles": "Profiles",
    "nav.devices": "Devices",
    "nav.quality": "Quality",
    "nav.privacy": "Privacy",
    "route.skills.eyebrow": "Private workspace",
    "route.skills.title": "Skills",
    "route.packs.eyebrow": "Reusable bundles",
    "route.packs.title": "Packs",
    "route.profiles.eyebrow": "Device and agent targeting",
    "route.profiles.title": "Profiles",
    "route.devices.eyebrow": "Registered clients",
    "route.devices.title": "Devices",
    "route.quality.eyebrow": "Release readiness",
    "route.quality.title": "Quality",
    "route.privacy.eyebrow": "Service boundary",
    "route.privacy.title": "Privacy",
    "panel.skillLibrary": "Skill Library",
    "panel.skillPreview": "Skill Preview",
    "panel.packBuilder": "Pack Builder",
    "panel.selectedPack": "Selected Pack",
    "panel.profiles": "Profiles",
    "panel.resolvedManifest": "Resolved Manifest",
    "panel.devices": "Devices",
    "panel.qualityGate": "Quality Gate",
    "panel.privacy": "Privacy",
    "placeholder.searchSkills": "Search name, tags, trigger",
    "select.allAgents": "All agents",
    "select.allRisk": "All risk",
    "risk.low": "Low",
    "risk.medium": "Medium",
    "risk.high": "High",
    "table.name": "Name",
    "table.version": "Version",
    "table.tags": "Tags",
    "table.quality": "Quality",
    "table.release": "Release",
    "table.os": "OS",
    "table.agent": "Agent",
    "table.targetPath": "Target path",
    "table.lastApply": "Last apply",
    "button.importSkill": "Import SKILL.md",
    "button.resetDemo": "Reset local demo data",
    "button.publish": "Publish",
    "button.newPack": "New Pack",
    "button.newProfile": "New Profile",
    "button.register": "Register",
    "button.run": "Run",
    "button.cancel": "Cancel",
    "button.save": "Save",
    "button.saveDraft": "Save Draft",
    "status.published": "published",
    "status.draft": "draft",
    "status.passed": "passed",
    "status.blocked": "blocked",
    "status.warning": "warning",
    "status.never": "never",
    "status.ready": "ready",
    "status.registered": "registered",
    "status.manifestPublished": "manifest published",
    "unit.skills": "skills",
    "unit.packs": "packs",
    "quality.noFindings": "No findings",
    "quality.completed": "Quality gate completed.",
    "quality.line": "line {line}",
    "metric.skills": "Skills",
    "metric.passed": "Passed",
    "metric.warning": "Warning",
    "metric.blocked": "Blocked",
    "field.name": "Name",
    "field.version": "Version",
    "field.tags": "Tags",
    "field.slug": "Slug",
    "field.description": "Description",
    "field.agent": "Agent",
    "field.taskContext": "Task context",
    "field.targetPath": "Target path",
    "field.os": "OS",
    "dialog.newPack": "New Pack",
    "dialog.newProfile": "New Profile",
    "dialog.registerDevice": "Register Device",
    "default.newPack": "New Pack",
    "default.newDevice": "New device",
    "alert.packBlocked": "Pack contains blocked skills.",
    "alert.profileUnpublishedPacks": "Profile contains unpublished packs.",
    "alert.zipBrowserPreview": "ZIP files are accepted by the Cloudflare import API; this browser preview imports SKILL.md files.",
    "privacy.storage": "5KILL5 stores full Skill content for synchronization. Do not upload secrets, private keys, tokens, customer data, or other sensitive material.",
    "privacy.usage": "Skill content is used for account storage, release manifest generation, device synchronization, and quality checks. It is not used for model training.",
    "privacy.boundary": "The platform manages and distributes Skill files. It does not write, rewrite, repair, or generate Skill content with third-party model APIs.",
    "finding.format.required_frontmatter.message": "Required manifest field is missing.",
    "finding.format.required_frontmatter.recommendation": "Add the field to YAML front matter.",
    "finding.format.semver.message": "The version is not valid SemVer.",
    "finding.format.semver.recommendation": "Use a version such as 1.0.0.",
    "finding.format.required_sections.message": "Required sections are incomplete.",
    "finding.format.required_sections.recommendation": "Include ## Trigger and ## Steps sections.",
    "finding.security.secret_patterns.message": "Potential secret-like value found.",
    "finding.security.secret_patterns.recommendation": "Review the evidence and remove secrets before upload.",
    "finding.security.destructive_commands.message": "Potential destructive command found.",
    "finding.security.destructive_commands.recommendation": "Keep destructive actions out of Skill instructions or require explicit review.",
    "finding.supply_chain.remote_fetch.message": "Remote script execution pattern found.",
    "finding.supply_chain.remote_fetch.recommendation": "Replace pipe-to-shell installation with inspectable steps.",
    "finding.security.prompt_injection.message": "Prompt-injection language found.",
    "finding.security.prompt_injection.recommendation": "Review wording and allowlist only after manual verification."
  },
  zh: {
    "nav.skills": "技能",
    "app.title": "5KILL5 技能管家",
    "nav.packs": "组合包",
    "nav.profiles": "配置",
    "nav.devices": "设备",
    "nav.quality": "质量",
    "nav.privacy": "隐私",
    "route.skills.eyebrow": "私有工作区",
    "route.skills.title": "技能",
    "route.packs.eyebrow": "可复用组合",
    "route.packs.title": "组合包",
    "route.profiles.eyebrow": "设备与 Agent 分发",
    "route.profiles.title": "配置",
    "route.devices.eyebrow": "已注册客户端",
    "route.devices.title": "设备",
    "route.quality.eyebrow": "发布前检查",
    "route.quality.title": "质量",
    "route.privacy.eyebrow": "服务边界",
    "route.privacy.title": "隐私",
    "panel.skillLibrary": "技能库",
    "panel.skillPreview": "技能预览",
    "panel.packBuilder": "组合包构建",
    "panel.selectedPack": "当前组合包",
    "panel.profiles": "配置",
    "panel.resolvedManifest": "已解析 Manifest",
    "panel.devices": "设备",
    "panel.qualityGate": "质量闸门",
    "panel.privacy": "隐私",
    "placeholder.searchSkills": "搜索名称、标签、触发词",
    "select.allAgents": "全部 Agent",
    "select.allRisk": "全部风险",
    "risk.low": "低",
    "risk.medium": "中",
    "risk.high": "高",
    "table.name": "名称",
    "table.version": "版本",
    "table.tags": "标签",
    "table.quality": "质量",
    "table.release": "发布",
    "table.os": "系统",
    "table.agent": "Agent",
    "table.targetPath": "目标路径",
    "table.lastApply": "最近应用",
    "button.importSkill": "导入 SKILL.md",
    "button.resetDemo": "重置本地演示数据",
    "button.publish": "发布",
    "button.newPack": "新建组合包",
    "button.newProfile": "新建配置",
    "button.register": "注册",
    "button.run": "运行",
    "button.cancel": "取消",
    "button.save": "保存",
    "button.saveDraft": "保存草稿",
    "status.published": "已发布",
    "status.draft": "草稿",
    "status.passed": "通过",
    "status.blocked": "阻止",
    "status.warning": "警告",
    "status.never": "从未",
    "status.ready": "就绪",
    "status.registered": "已注册",
    "status.manifestPublished": "Manifest 已发布",
    "unit.skills": "个技能",
    "unit.packs": "个组合包",
    "quality.noFindings": "无问题",
    "quality.completed": "质量闸门已完成。",
    "quality.line": "第 {line} 行",
    "metric.skills": "技能",
    "metric.passed": "通过",
    "metric.warning": "警告",
    "metric.blocked": "阻止",
    "field.name": "名称",
    "field.version": "版本",
    "field.tags": "标签",
    "field.slug": "Slug",
    "field.description": "描述",
    "field.agent": "Agent",
    "field.taskContext": "任务场景",
    "field.targetPath": "目标路径",
    "field.os": "系统",
    "dialog.newPack": "新建组合包",
    "dialog.newProfile": "新建配置",
    "dialog.registerDevice": "注册设备",
    "default.newPack": "新组合包",
    "default.newDevice": "新设备",
    "alert.packBlocked": "组合包包含被阻止发布的技能。",
    "alert.profileUnpublishedPacks": "配置包含未发布的组合包。",
    "alert.zipBrowserPreview": "ZIP 文件由 Cloudflare 导入 API 接收；当前浏览器预览只导入 SKILL.md 文件。",
    "privacy.storage": "5KILL5 会保存完整 Skill 内容用于同步。请不要上传密钥、私钥、Token、客户数据或其他敏感材料。",
    "privacy.usage": "Skill 内容用于账号存储、发布 manifest 生成、设备同步和质量检查，不用于模型训练。",
    "privacy.boundary": "平台只管理和分发 Skill 文件，不使用第三方模型 API 写作、改写、修复或生成 Skill 内容。",
    "finding.format.required_frontmatter.message": "缺少必需的 manifest 字段。",
    "finding.format.required_frontmatter.recommendation": "请在 YAML front matter 中补充该字段。",
    "finding.format.semver.message": "版本号不是合法 SemVer。",
    "finding.format.semver.recommendation": "请使用类似 1.0.0 的版本号。",
    "finding.format.required_sections.message": "必需章节不完整。",
    "finding.format.required_sections.recommendation": "请包含 ## Trigger 和 ## Steps 章节。",
    "finding.security.secret_patterns.message": "发现疑似密钥或敏感 Token。",
    "finding.security.secret_patterns.recommendation": "上传前请检查证据并移除敏感信息。",
    "finding.security.destructive_commands.message": "发现疑似破坏性命令。",
    "finding.security.destructive_commands.recommendation": "避免在 Skill 指令中包含破坏性操作，或要求显式人工确认。",
    "finding.supply_chain.remote_fetch.message": "发现远程脚本执行模式。",
    "finding.supply_chain.remote_fetch.recommendation": "请用可检查的步骤替代 pipe-to-shell 安装方式。",
    "finding.security.prompt_injection.message": "发现提示注入风险表述。",
    "finding.security.prompt_injection.recommendation": "请检查措辞，只在人工确认后加入 allowlist。"
  }
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  const skills = [createSkillFromContent(sampleSkill), createSkillFromContent(sampleDocsSkill)];
  skills.forEach((skill) => {
    skill.lifecycle = "published";
    skill.publishedAt = nowIso();
  });

  const packId = uid("pack");
  const profileId = uid("profile");
  const deviceId = uid("device");

  return {
    skills,
    packs: [
      {
        id: packId,
        name: "Codex Coding Pack",
        slug: "codex-coding-pack",
        version: "1.0.0",
        description: "Daily coding and documentation skills",
        tags: ["coding", "docs"],
        skillIds: skills.map((skill) => skill.id),
        lifecycle: "published",
        publishedAt: nowIso()
      }
    ],
    profiles: [
      {
        id: profileId,
        name: "Windows laptop / Codex / frontend",
        slug: "windows-codex-frontend",
        version: "1.0.0",
        agentType: "codex",
        taskContext: "frontend",
        deviceSelector: { os: "windows" },
        packIds: [packId],
        targetPathHint: "%USERPROFILE%\\.codex\\skills",
        lifecycle: "published",
        publishedAt: nowIso()
      }
    ],
    devices: [
      {
        id: deviceId,
        name: "Windows workstation",
        os: "windows",
        arch: "x64",
        agentType: "codex",
        targetPath: "%USERPROFILE%\\.codex\\skills",
        clientVersion: "0.1.0",
        lastSeenAt: nowIso(),
        lastApply: "ready"
      }
    ],
    applyReports: [],
    ui: {}
  };
}

function saveState() {
  state.ui = { selectedSkillId, selectedPackId, selectedProfileId, locale };
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function createSkillFromContent(content, fileName = "SKILL.md") {
  const parsed = parseSkill(content, fileName);
  const skill = {
    id: uid("skill"),
    name: parsed.meta.name || fileName.replace(/\.(md|markdown)$/i, "") || "untitled-skill",
    slug: slugify(parsed.meta.name || fileName),
    version: parsed.meta.version || "0.0.0",
    description: parsed.meta.description || "",
    tags: parsed.meta.tags || [],
    triggers: parsed.meta.triggers || [],
    compatibility: parsed.meta.compatibility || { agents: ["generic"] },
    riskLevel: parsed.meta.risk_level || "medium",
    author: parsed.meta.author || "",
    license: parsed.meta.license || "",
    content,
    sha256: hashString(content),
    lifecycle: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  skill.quality = runQualityGate(skill);
  return skill;
}

function parseSkill(content, fileName) {
  const meta = {};
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!match) {
    meta.name = fileName.replace(/\.(md|markdown)$/i, "");
    return { meta, body: content };
  }

  const lines = match[1].split(/\r?\n/);
  let key = "";
  let nested = "";

  for (const line of lines) {
    if (!line.trim()) continue;
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    const child = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    const item = line.match(/^\s*-\s*(.*)$/);

    if (top) {
      key = top[1];
      nested = "";
      if (top[2]) {
        meta[key] = scalar(top[2]);
      } else if (key === "compatibility") {
        meta.compatibility = {};
      } else {
        meta[key] = [];
      }
      continue;
    }

    if (child && key === "compatibility") {
      nested = child[1];
      meta.compatibility[nested] = child[2] ? scalar(child[2]) : [];
      continue;
    }

    if (item && key) {
      if (key === "compatibility" && nested) {
        meta.compatibility[nested].push(scalar(item[1]));
      } else {
        if (!Array.isArray(meta[key])) meta[key] = [];
        meta[key].push(scalar(item[1]));
      }
    }
  }

  return { meta, body: content.slice(match[0].length) };
}

function scalar(value) {
  return value.replace(/^["']|["']$/g, "").trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "skill";
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function runQualityGate(skill) {
  const findings = [];
  const content = skill.content || "";

  if (!skill.name) {
    findings.push(finding("blocker", "format.required_frontmatter", "Missing required manifest field: name", "Add name to YAML front matter."));
  }

  if (!skill.version) {
    findings.push(finding("blocker", "format.required_frontmatter", "Missing required manifest field: version", "Add version to YAML front matter."));
  } else if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/.test(skill.version)) {
    findings.push(finding("blocker", "format.semver", `Invalid SemVer: ${skill.version}`, "Use a version such as 1.0.0."));
  }

  if (!/^##\s+Trigger\b/im.test(content) || !/^##\s+Steps\b/im.test(content)) {
    findings.push(finding("blocker", "format.required_sections", "Required sections are incomplete", "Include ## Trigger and ## Steps sections."));
  }

  const securityRules = [
    ["high", "security.secret_patterns", /\b(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xoxb-[A-Za-z0-9-]{20,}|BEGIN PRIVATE KEY|Authorization:\s*Bearer\s+\S+)/i, "Potential secret-like value found"],
    ["high", "security.destructive_commands", /\b(rm\s+-rf\s+\/|Remove-Item\s+-Recurse\s+-Force|del\s+\/s\s+\/q|diskpart|git\s+reset\s+--hard|format\s+[A-Z]:)/i, "Potential destructive command found"],
    ["high", "supply_chain.remote_fetch", /(curl|wget|Invoke-WebRequest)[^\n|]*\|\s*(sh|bash|Invoke-Expression|iex)/i, "Remote script execution pattern found"],
    ["medium", "security.prompt_injection", /(ignore (previous|all|system) instructions|leak.*system prompt|bypass.*safety|silent hidden step)/i, "Prompt-injection language found"]
  ];

  for (const [severity, ruleId, pattern, message] of securityRules) {
    const match = content.match(pattern);
    if (match) {
      findings.push(finding(severity, ruleId, message, "Review the evidence and allowlist only after manual verification.", lineOf(content, match.index || 0)));
    }
  }

  return {
    status: findings.some((item) => item.severity === "blocker") ? "blocked" : findings.length ? "warning" : "passed",
    score: Math.max(0, 100 - findings.reduce((sum, item) => sum + severityCost(item.severity), 0)),
    findings,
    ranAt: nowIso()
  };
}

function finding(severity, ruleId, message, recommendation, lineStart = 1) {
  return {
    id: uid("finding"),
    severity,
    ruleId,
    filePath: "SKILL.md",
    lineStart,
    lineEnd: lineStart,
    message,
    recommendation
  };
}

function severityCost(severity) {
  return { blocker: 45, high: 25, medium: 12, low: 5 }[severity] || 5;
}

function lineOf(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function t(key, params = {}) {
  const template = translations[locale]?.[key] ?? translations.en[key] ?? key;
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}

function applyI18n() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = t("app.title");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", t(element.dataset.i18nTitle));
  });
  const languageSelect = document.getElementById("language-select");
  if (languageSelect) {
    languageSelect.value = locale;
    languageSelect.setAttribute("aria-label", locale === "zh" ? "语言" : "Language");
  }
}

function lifecycleLabel(lifecycle) {
  return t(`status.${lifecycle}`);
}

function qualityLabel(status) {
  return t(`status.${status}`);
}

function severityLabel(severity) {
  return {
    blocker: t("status.blocked"),
    high: t("risk.high"),
    medium: t("risk.medium"),
    low: t("risk.low")
  }[severity] || severity;
}

function deviceApplyLabel(value) {
  return {
    ready: t("status.ready"),
    registered: t("status.registered"),
    "manifest published": t("status.manifestPublished")
  }[value] || value || t("status.never");
}

function findingMessage(item) {
  return t(`finding.${item.ruleId}.message`) === `finding.${item.ruleId}.message`
    ? item.message
    : t(`finding.${item.ruleId}.message`);
}

function findingRecommendation(item) {
  return t(`finding.${item.ruleId}.recommendation`) === `finding.${item.ruleId}.recommendation`
    ? item.recommendation
    : t(`finding.${item.ruleId}.recommendation`);
}

function activeRoute() {
  const route = location.hash.replace("#", "") || "skills";
  return routeTitleKeys[route] ? route : "skills";
}

function render() {
  const route = activeRoute();
  applyI18n();
  document.querySelectorAll(".nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== `${route}-view`;
  });
  document.getElementById("view-eyebrow").textContent = t(routeTitleKeys[route][0]);
  document.getElementById("view-title").textContent = t(routeTitleKeys[route][1]);

  renderSkills();
  renderPacks();
  renderProfiles();
  renderDevices();
  renderQuality();
}

function renderSkills() {
  const query = document.getElementById("skill-search").value.toLowerCase();
  const agent = document.getElementById("agent-filter").value;
  const risk = document.getElementById("risk-filter").value;
  const filtered = state.skills.filter((skill) => {
    const haystack = [skill.name, skill.description, skill.tags.join(" "), skill.triggers.join(" ")].join(" ").toLowerCase();
    const agentOk = !agent || skill.compatibility?.agents?.includes(agent);
    const riskOk = !risk || skill.riskLevel === risk;
    return haystack.includes(query) && agentOk && riskOk;
  });

  const table = document.getElementById("skills-table");
  table.innerHTML = filtered
    .map((skill) => {
      const quality = qualityBadge(skill.quality.status);
      const release = skill.lifecycle === "published"
        ? `<span class="badge ok">${escapeHtml(lifecycleLabel("published"))}</span>`
        : `<span class="badge draft">${escapeHtml(lifecycleLabel("draft"))}</span>`;
      return `<tr data-skill-id="${skill.id}" class="${skill.id === selectedSkillId ? "selected" : ""}">
        <td title="${escapeHtml(skill.description)}">${escapeHtml(skill.name)}</td>
        <td>${escapeHtml(skill.version)}</td>
        <td><span class="tag-row">${skill.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span></td>
        <td>${quality}</td>
        <td>${release}</td>
      </tr>`;
    })
    .join("");

  table.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      selectedSkillId = row.dataset.skillId;
      saveState();
      render();
    });
  });

  const skill = state.skills.find((item) => item.id === selectedSkillId) || state.skills[0];
  if (!skill) return;
  selectedSkillId = skill.id;
  document.getElementById("skill-detail-title").textContent = skill.name || t("panel.skillPreview");
  document.getElementById("skill-detail-meta").textContent = `${skill.version} · ${skill.compatibility?.agents?.join(", ") || "generic"} · ${skill.sha256}`;
  document.getElementById("skill-preview").textContent = skill.content;
  document.getElementById("skill-findings").innerHTML = renderFindings(skill.quality.findings);
  document.getElementById("publish-skill").disabled = skill.quality.status === "blocked";
}

function qualityBadge(status) {
  if (status === "passed") return `<span class="badge ok">${escapeHtml(qualityLabel("passed"))}</span>`;
  if (status === "blocked") return `<span class="badge blocker">${escapeHtml(qualityLabel("blocked"))}</span>`;
  return `<span class="badge warn">${escapeHtml(qualityLabel("warning"))}</span>`;
}

function renderFindings(findings) {
  if (!findings.length) {
    return `<div class="finding low"><span class="badge ok">${escapeHtml(qualityLabel("passed"))}</span><div><strong>${escapeHtml(t("quality.noFindings"))}</strong><p>${escapeHtml(t("quality.completed"))}</p></div></div>`;
  }
  return findings
    .map((item) => `<div class="finding ${escapeHtml(item.severity)}">
      <span class="badge ${item.severity === "blocker" ? "blocker" : item.severity === "high" ? "danger" : item.severity === "medium" ? "warn" : "ok"}">${escapeHtml(severityLabel(item.severity))}</span>
      <div><strong>${escapeHtml(item.ruleId)} · ${escapeHtml(t("quality.line", { line: item.lineStart }))}</strong><p>${escapeHtml(findingMessage(item))} ${escapeHtml(findingRecommendation(item))}</p></div>
    </div>`)
    .join("");
}

function renderPacks() {
  const packList = document.getElementById("pack-list");
  packList.innerHTML = state.packs
    .map((pack) => `<div class="list-item ${pack.id === selectedPackId ? "selected" : ""}" data-pack-id="${pack.id}">
      <div><h3>${escapeHtml(pack.name)}</h3><p>${escapeHtml(pack.version)} · ${pack.skillIds.length} ${escapeHtml(t("unit.skills"))} · ${escapeHtml(lifecycleLabel(pack.lifecycle))}</p></div>
      <span class="badge ${pack.lifecycle === "published" ? "ok" : "draft"}">${escapeHtml(lifecycleLabel(pack.lifecycle))}</span>
    </div>`)
    .join("");
  packList.querySelectorAll(".list-item").forEach((item) => {
    item.addEventListener("click", () => {
      selectedPackId = item.dataset.packId;
      saveState();
      render();
    });
  });

  const pack = state.packs.find((item) => item.id === selectedPackId) || state.packs[0];
  const editor = document.getElementById("pack-editor");
  if (!pack) {
    editor.innerHTML = "";
    return;
  }
  selectedPackId = pack.id;
  editor.innerHTML = `<div class="editor">
    <div class="field-grid">
      <div class="field"><label>${escapeHtml(t("field.name"))}</label><input id="pack-name" value="${escapeHtml(pack.name)}" /></div>
      <div class="field"><label>${escapeHtml(t("field.version"))}</label><input id="pack-version" value="${escapeHtml(pack.version)}" /></div>
      <div class="field"><label>${escapeHtml(t("field.tags"))}</label><input id="pack-tags" value="${escapeHtml(pack.tags.join(", "))}" /></div>
      <div class="field"><label>${escapeHtml(t("field.slug"))}</label><input id="pack-slug" value="${escapeHtml(pack.slug)}" /></div>
    </div>
    <div class="field"><label>${escapeHtml(t("field.description"))}</label><textarea id="pack-description">${escapeHtml(pack.description)}</textarea></div>
    <div class="checkbox-list">${state.skills.map((skill) => `<label class="check-row">
      <span>${escapeHtml(skill.name)} <span class="muted">${escapeHtml(skill.version)}</span></span>
      <input type="checkbox" data-pack-skill="${skill.id}" ${pack.skillIds.includes(skill.id) ? "checked" : ""} />
    </label>`).join("")}</div>
    <button id="save-pack" class="primary" type="button">${escapeHtml(t("button.saveDraft"))}</button>
  </div>`;

  document.getElementById("save-pack").addEventListener("click", () => {
    pack.name = document.getElementById("pack-name").value.trim() || pack.name;
    pack.version = document.getElementById("pack-version").value.trim() || pack.version;
    pack.slug = document.getElementById("pack-slug").value.trim() || slugify(pack.name);
    pack.tags = document.getElementById("pack-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean);
    pack.description = document.getElementById("pack-description").value.trim();
    pack.skillIds = [...document.querySelectorAll("[data-pack-skill]:checked")].map((input) => input.dataset.packSkill);
    pack.lifecycle = "draft";
    saveState();
    render();
  });
}

function renderProfiles() {
  const profileList = document.getElementById("profile-list");
  profileList.innerHTML = state.profiles
    .map((profile) => `<div class="list-item ${profile.id === selectedProfileId ? "selected" : ""}" data-profile-id="${profile.id}">
      <div><h3>${escapeHtml(profile.name)}</h3><p>${escapeHtml(profile.agentType)} · ${escapeHtml(profile.taskContext)} · ${profile.packIds.length} ${escapeHtml(t("unit.packs"))}</p></div>
      <span class="badge ${profile.lifecycle === "published" ? "ok" : "draft"}">${escapeHtml(lifecycleLabel(profile.lifecycle))}</span>
    </div>`)
    .join("");
  profileList.querySelectorAll(".list-item").forEach((item) => {
    item.addEventListener("click", () => {
      selectedProfileId = item.dataset.profileId;
      saveState();
      render();
    });
  });

  const profile = state.profiles.find((item) => item.id === selectedProfileId) || state.profiles[0];
  if (!profile) return;
  selectedProfileId = profile.id;
  document.getElementById("manifest-preview").textContent = JSON.stringify(resolveManifest(profile), null, 2);
}

function resolveManifest(profile) {
  const packs = state.packs.filter((pack) => profile.packIds.includes(pack.id));
  const skillIds = [...new Set(packs.flatMap((pack) => pack.skillIds))];
  const skills = state.skills.filter((skill) => skillIds.includes(skill.id));
  const releaseId = `rel_${hashString(profile.id + profile.version + skills.map((skill) => skill.sha256).join(""))}`;
  return {
    managed_by: "5kill5",
    version: 1,
    release_id: releaseId,
    profile: {
      id: profile.id,
      name: profile.name,
      agent_type: profile.agentType,
      task_context: profile.taskContext
    },
    packs: packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      version: pack.version,
      skills: pack.skillIds
    })),
    skills: skills.map((skill) => ({
      skill_id: skill.id,
      version_id: `${skill.id}:${skill.version}`,
      name: skill.name,
      object_key: `skills/${skill.id}/${skill.version}/SKILL.md`,
      sha256: skill.sha256,
      content: skill.content
    })),
    apply: {
      strategy: "copy",
      target_path_hint: profile.targetPathHint
    }
  };
}

function renderDevices() {
  const table = document.getElementById("devices-table");
  table.innerHTML = state.devices
    .map((device) => `<tr>
      <td>${escapeHtml(device.name)}</td>
      <td>${escapeHtml(device.os)} ${escapeHtml(device.arch || "")}</td>
      <td>${escapeHtml(device.agentType)}</td>
      <td title="${escapeHtml(device.targetPath)}">${escapeHtml(device.targetPath)}</td>
      <td>${escapeHtml(deviceApplyLabel(device.lastApply))}</td>
    </tr>`)
    .join("");
}

function renderQuality() {
  const findings = state.skills.flatMap((skill) => skill.quality.findings.map((item) => ({ ...item, skillName: skill.name })));
  const blocked = state.skills.filter((skill) => skill.quality.status === "blocked").length;
  const warning = state.skills.filter((skill) => skill.quality.status === "warning").length;
  const passed = state.skills.filter((skill) => skill.quality.status === "passed").length;

  document.getElementById("quality-summary").innerHTML = [
    [t("metric.skills"), state.skills.length],
    [t("metric.passed"), passed],
    [t("metric.warning"), warning],
    [t("metric.blocked"), blocked]
  ]
    .map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");

  document.getElementById("quality-table").innerHTML = findings.length
    ? findings
        .map((item) => `<div class="finding ${escapeHtml(item.severity)}">
          <span class="badge ${item.severity === "blocker" ? "blocker" : item.severity === "high" ? "danger" : item.severity === "medium" ? "warn" : "ok"}">${escapeHtml(severityLabel(item.severity))}</span>
          <div><strong>${escapeHtml(item.skillName)} · ${escapeHtml(item.ruleId)}</strong><p>${escapeHtml(findingMessage(item))} ${escapeHtml(findingRecommendation(item))}</p></div>
        </div>`)
        .join("")
    : renderFindings([]);
}

function openEntityDialog(title, fields, onSave) {
  const dialog = document.getElementById("edit-dialog");
  document.getElementById("dialog-title").textContent = title;
  document.getElementById("dialog-fields").innerHTML = fields
    .map((field) => `<div class="field">
      <label for="dialog-${field.name}">${escapeHtml(field.label)}</label>
      <input id="dialog-${field.name}" name="${escapeHtml(field.name)}" value="${escapeHtml(field.value || "")}" />
    </div>`)
    .join("");

  const save = document.getElementById("dialog-save");
  save.onclick = () => {
    const values = Object.fromEntries(fields.map((field) => [field.name, document.getElementById(`dialog-${field.name}`).value.trim()]));
    onSave(values);
    saveState();
    render();
  };

  dialog.showModal();
}

function publishSkill() {
  const skill = state.skills.find((item) => item.id === selectedSkillId);
  if (!skill || skill.quality.status === "blocked") return;
  skill.lifecycle = "published";
  skill.publishedAt = nowIso();
  saveState();
  render();
}

function publishPack() {
  const pack = state.packs.find((item) => item.id === selectedPackId);
  if (!pack) return;
  const blocked = state.skills.some((skill) => pack.skillIds.includes(skill.id) && skill.quality.status === "blocked");
  if (blocked) {
    alert(t("alert.packBlocked"));
    return;
  }
  pack.lifecycle = "published";
  pack.publishedAt = nowIso();
  saveState();
  render();
}

function publishProfile() {
  const profile = state.profiles.find((item) => item.id === selectedProfileId);
  if (!profile) return;
  const unpublishedPacks = state.packs.some((pack) => profile.packIds.includes(pack.id) && pack.lifecycle !== "published");
  if (unpublishedPacks) {
    alert(t("alert.profileUnpublishedPacks"));
    return;
  }
  profile.lifecycle = "published";
  profile.publishedAt = nowIso();
  const device = state.devices[0];
  if (device) device.lastApply = "manifest published";
  saveState();
  render();
}

document.getElementById("skill-search").addEventListener("input", render);
document.getElementById("agent-filter").addEventListener("change", render);
document.getElementById("risk-filter").addEventListener("change", render);
document.getElementById("language-select").addEventListener("change", (event) => {
  locale = event.target.value === "en" ? "en" : "zh";
  saveState();
  render();
});
document.getElementById("publish-skill").addEventListener("click", publishSkill);
document.getElementById("publish-pack").addEventListener("click", publishPack);
document.getElementById("publish-profile").addEventListener("click", publishProfile);

document.getElementById("skill-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (/\.zip$/i.test(file.name)) {
    alert(t("alert.zipBrowserPreview"));
    event.target.value = "";
    return;
  }
  const content = await file.text();
  const skill = createSkillFromContent(content, file.name);
  state.skills.unshift(skill);
  selectedSkillId = skill.id;
  saveState();
  event.target.value = "";
  render();
});

document.getElementById("create-pack").addEventListener("click", () => {
  openEntityDialog(t("dialog.newPack"), [
    { name: "name", label: t("field.name"), value: t("default.newPack") },
    { name: "version", label: t("field.version"), value: "0.1.0" },
    { name: "description", label: t("field.description"), value: "" }
  ], (values) => {
    const pack = {
      id: uid("pack"),
      name: values.name || t("default.newPack"),
      slug: slugify(values.name || "new-pack"),
      version: values.version || "0.1.0",
      description: values.description || "",
      tags: [],
      skillIds: [],
      lifecycle: "draft",
      createdAt: nowIso()
    };
    state.packs.unshift(pack);
    selectedPackId = pack.id;
  });
});

document.getElementById("create-profile").addEventListener("click", () => {
  openEntityDialog(t("dialog.newProfile"), [
    { name: "name", label: t("field.name"), value: "Codex / general" },
    { name: "agentType", label: t("field.agent"), value: "codex" },
    { name: "taskContext", label: t("field.taskContext"), value: "general" },
    { name: "targetPathHint", label: t("field.targetPath"), value: "%USERPROFILE%\\.codex\\skills" }
  ], (values) => {
    const profile = {
      id: uid("profile"),
      name: values.name || "Codex / general",
      slug: slugify(values.name || "codex-general"),
      version: "0.1.0",
      agentType: values.agentType || "codex",
      taskContext: values.taskContext || "general",
      deviceSelector: {},
      packIds: state.packs[0] ? [state.packs[0].id] : [],
      targetPathHint: values.targetPathHint || "",
      lifecycle: "draft",
      createdAt: nowIso()
    };
    state.profiles.unshift(profile);
    selectedProfileId = profile.id;
  });
});

document.getElementById("register-device").addEventListener("click", () => {
  openEntityDialog(t("dialog.registerDevice"), [
    { name: "name", label: t("field.name"), value: t("default.newDevice") },
    { name: "os", label: t("field.os"), value: "windows" },
    { name: "agentType", label: t("field.agent"), value: "codex" },
    { name: "targetPath", label: t("field.targetPath"), value: "%USERPROFILE%\\.codex\\skills" }
  ], (values) => {
    state.devices.unshift({
      id: uid("device"),
      name: values.name || t("default.newDevice"),
      os: values.os || "windows",
      arch: "x64",
      agentType: values.agentType || "codex",
      targetPath: values.targetPath || "",
      clientVersion: "0.1.0",
      lastSeenAt: nowIso(),
      lastApply: "registered"
    });
  });
});

document.getElementById("run-quality").addEventListener("click", () => {
  state.skills.forEach((skill) => {
    skill.quality = runQualityGate(skill);
  });
  saveState();
  render();
});

document.getElementById("reset-demo").addEventListener("click", () => {
  const currentLocale = locale;
  localStorage.removeItem(storageKey);
  localStorage.setItem(storageKey, JSON.stringify({ ...loadState(), ui: { locale: currentLocale } }));
  location.reload();
});

window.addEventListener("hashchange", render);
render();
