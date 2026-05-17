# 5KILL5 技术方案文档 v0.1

项目：5KILL5（吾 skills）  
整理时间：2026-05-17  
目标：为 5KILL5 提供云端 Skill 组合管理、CLI 客户端同步分发、后续 GUI 扩展的技术架构。

## 技术结论

建议采用云端控制面 + CLI 执行面的架构：

- 云端 Web 控制台：管理 Skill、Pack、Profile、发布状态、设备和同步状态。
- 云端 API：提供 Device Code 登录、Skill/Pack/Profile CRUD、发布 manifest、客户端拉取和状态上报。
- 初始云端技术栈：Cloudflare Workers + D1 + R2，低成本验证；验证有效后再考虑迁移到自有服务器。
- 云端数据库：D1 保存账号、设备、Skill 元数据、Pack 组合、Profile 绑定、发布版本和审计日志。
- 对象存储：R2 保存完整 `SKILL.md`、assets、发布包和哈希校验数据。
- CLI 客户端：Rust 实现，负责登录、设备注册、pull、plan、apply、status、rollback。
- 本地缓存：SQLite 或轻量文件缓存，仅保存 token、设备配置、发布 manifest、apply 记录和本地状态。
- 本地分发：初始默认复制到 Agent 目录，后续提供 symlink/Junction 高级策略。
- GUI：`v1.0.0` 稳定版本再使用 Tauri 2 + React + TypeScript 实现。

## 关键技术取舍

1. 云端是事实源，CLI 是执行器。
   - 原因：5KILL5 的特色是云端管理 Skill 组合，再同步到各设备和 Agent 任务环境。
   - 方案：云端生成发布 manifest，CLI 主动拉取并应用，本地只保存缓存和 apply 状态。

2. 使用 `Skill + Pack + Profile` 作为核心模型。
   - 原因：单个 Skill 无法表达“工具组合”和“不同任务场景启用不同组合”。
   - 方案：Skill 是最小单位，Pack 是组合包，Profile 绑定账号、设备、Agent 和任务场景。

3. 草稿和发布版分离。
   - 原因：云端保存即生效会让未发布配置污染所有客户端。
   - 方案：Skill 内容由上传/指定来源导入生成草稿版本，Pack 和 Profile 可编辑草稿，发布后生成不可变版本，CLI 默认只读取发布版。

4. 不在 MVP 中实现完整 Marketplace。
   - 原因：第三方技能安装涉及供应链安全、签名、信任策略和升级治理。
   - 方案：MVP 只支持用户自己的私有 Skill 和 Pack，以及 Web 上传本地 `SKILL.md`/ZIP；v1 再支持 CLI scan/upload 和 GitHub 第三方导入；v2 再设计 Registry。

5. 本地分发默认复制，链接作为后续高级策略。
   - 决策更新：初始版本默认复制，优先避免 Windows 权限问题。
   - 方案：复制写入由 apply manifest 管理；后续再提供 symlink/Junction 作为高级策略。

6. 只做官方托管云。
   - 原因：初始商业路径是开源 CLI + 商业云，先降低部署和支持复杂度。
   - 方案：不在 MVP 中提供自托管安装包，但数据模型不要阻塞未来迁移。

## 架构原则

1. 云端组合管理：云端负责 Skill、Pack、Profile、发布和设备状态。
2. 客户端主动同步：CLI 主动 pull/apply，云端不远程控制用户设备。
3. 非破坏式：同步和分发默认不删除未知文件。
4. 可审计：重要操作写入 audit log。
5. 可恢复：每次 apply 前保留 manifest 和回滚记录。
6. 渐进式披露：元数据轻量加载，正文按需加载。
7. 适配器模式：不同 Agent 和本地目录策略都通过 adapter 接入。
8. 安全默认：不执行第三方技能，不开放任意 shell。
9. 官方托管优先：MVP 只提供官方云，不承诺自托管。

## 总体架构

```text
Cloud Web Console
        |
        v
Cloud API
  - AuthService
  - SkillService
  - PackService
  - ProfileService
  - ReleaseService
  - DeviceService
  - QualityGateService
        |
        v
Cloud Storage
  - Cloudflare D1
  - Cloudflare R2
  - search index
  - audit log
        ^
        |
CLI Client
  - auth login
  - device register
  - pull published manifest
  - plan local changes
  - apply to Agent directories
  - rollback
        |
        v
Local Agent Targets
  - Codex skills dir
  - generic directory target
  - future Claude Code / Cursor adapters
```

## 推荐仓库结构

```text
5kill5/
  apps/
    web/
      app/
      components/
      features/
        skills/
        packs/
        profiles/
        devices/
        quality/
        settings/
    desktop/
      src-tauri/
      src/
  crates/
    5kill5-core/
    5kill5-cli/
    5kill5-agent-adapters/
  services/
    api/
    workers/
  migrations/
  docs/
```

说明：

- `apps/web` 是初始版本的云端 Web 控制台。
- `services/api` 是 Cloudflare Workers API，可与 Web 同仓或独立部署。
- `crates/5kill5-cli` 是初始版本客户端。
- `crates/5kill5-core` 承载 CLI 与未来桌面端共用的本地分发、manifest、质量检查逻辑。
- `apps/desktop` 作为 `v1.0.0` GUI 入口，首版可以只保留目录规划。
- `5kill5-agent-adapters` 放 Codex、通用目录和未来 Claude Code/Cursor 适配器。

## Tauri 2 设计要点

Tauri 2 不进入初始版本，放到 `v1.0.0` 稳定版本。它适合作为桌面 GUI 壳：前端通过命令调用 Rust，Rust 负责受控系统访问。文件系统、deep link、single instance、shell 或 sidecar 都应通过 Tauri plugin 和 capability 明确授权。

建议：

- 文件访问只允许应用数据目录、用户显式选择的扫描目录、配置的 Agent 目录。
- 所有 Rust 命令使用结构化参数，不传递原始 shell 命令。
- Deep link 使用 `5kill5://...`，进入登录、导入或 Profile 预览页，而不是直接安装或直接 apply。
- Windows 和 Linux 上 deep link 与 single instance 要一起设计，避免重复启动实例导致状态竞争。
- 禁止前端任意调用 shell。所有分发动作复用 CLI/core 的固定能力，而不是让 GUI 自己拼命令。

## 数据存储设计

### 云端存储

云端建议分三类存储：

- D1：账号、workspace 预留字段、设备、Skill、Pack、Profile、发布版本、质量报告、审计日志。
- R2：完整 `SKILL.md`、assets、发布包、导入 staging 文件。
- 搜索索引：MVP 可先用 D1 字段搜索；后续再引入专门搜索服务。

云端不需要同步用户机器上的 SQLite 数据库。云端发布 manifest 是客户端拉取的稳定契约。

Cloudflare 资源命名：

- Web 控制台域名：`app.5kill5.xyz`
- API 域名：`api.5kill5.xyz`
- Workers：`5kill5-api-prod`、`5kill5-api-preview`
- D1：`5kill5_prod`、`5kill5_preview`
- R2：`5kill5-skills-prod`、`5kill5-skills-preview`

### CLI 本地数据目录

建议布局：

```text
local-app-data/
  config.toml
  token.json
  device.json
  cache/
    releases/
      <profile_id>/
        manifest.json
        skills/
  apply/
    current-manifest.json
    history/
      <apply_id>.json
  logs/
```

CLI 可选使用 SQLite 作为本地缓存。如果使用 SQLite，启动时执行：

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

说明：

- 本地 SQLite 不是事实源，只是缓存。
- 如果缓存损坏，CLI 应能重新从云端拉取发布 manifest。
- apply 记录必须能独立支持回滚，不完全依赖搜索缓存。

## Skill Manifest 最小字段

首版采用较完整的 manifest 字段，方便后续兼容 Marketplace、风险扫描和多 Agent 适配。部分字段在 MVP 中只保存和展示，不做完整自动化能力。

```yaml
name: code-review
version: 1.0.0
description: Review code changes and identify risks
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
```

字段说明：

- `name`、`version`、`description` 是发布必需字段。
- `tags`、`triggers` 用于搜索和渐进式披露。
- `compatibility` 用于标记适配 Agent，MVP 先支持 `codex` 和 `generic`。
- `risk_level`、`author`、`license` 首版先保存，风险治理和许可证策略后续增强。

## 云端数据库 Schema 草案

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  workspace_type TEXT NOT NULL DEFAULT 'personal',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  os TEXT NOT NULL,
  arch TEXT,
  client_version TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  tags_json TEXT,
  triggers_json TEXT,
  compatibility_json TEXT,
  risk_level TEXT,
  author TEXT,
  license TEXT,
  current_version TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  trust_level TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, slug)
);

CREATE TABLE skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'draft',
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  frontmatter_json TEXT,
  trigger_text TEXT,
  content_summary TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(skill_id, version)
);

CREATE TABLE packs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, slug)
);

CREATE TABLE pack_versions (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(pack_id, version)
);

CREATE TABLE pack_items (
  id TEXT PRIMARY KEY,
  pack_version_id TEXT NOT NULL REFERENCES pack_versions(id) ON DELETE CASCADE,
  skill_version_id TEXT NOT NULL REFERENCES skill_versions(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  optional INTEGER NOT NULL DEFAULT 0,
  UNIQUE(pack_version_id, skill_version_id)
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  task_context TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, slug)
);

CREATE TABLE profile_versions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'draft',
  agent_type TEXT NOT NULL,
  device_selector_json TEXT,
  task_context TEXT,
  published_manifest_key TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(profile_id, version)
);

CREATE TABLE profile_pack_items (
  id TEXT PRIMARY KEY,
  profile_version_id TEXT NOT NULL REFERENCES profile_versions(id) ON DELETE CASCADE,
  pack_version_id TEXT NOT NULL REFERENCES pack_versions(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(profile_version_id, pack_version_id)
);

CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  profile_version_id TEXT NOT NULL REFERENCES profile_versions(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'stable',
  manifest_key TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE device_profile_bindings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  target_path_hint TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(device_id, profile_id, agent_type)
);

CREATE TABLE apply_reports (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_summary TEXT,
  applied_at TEXT NOT NULL
);

CREATE TABLE quality_runs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_version_id TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER,
  ruleset_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE quality_findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES quality_runs(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  message TEXT NOT NULL,
  recommendation TEXT,
  allowlisted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

搜索索引可使用数据库全文索引、外部搜索服务，或 MVP 中的简单数据库搜索。Cloudflare D1 基于 SQLite，MVP 先用结构化字段和简单文本搜索，后续再评估 FTS 或外部搜索服务。

```sql
CREATE VIRTUAL TABLE skill_fts USING fts5(
  name,
  description,
  tags,
  trigger_text,
  content,
  content='',
  tokenize='unicode61'
);
```

建议用服务层维护搜索索引，不把复杂触发器作为首版依赖。

## 核心服务设计

### AuthService

职责：

- 使用邮箱验证码完成账号注册和登录。
- 为 CLI 登录提供 Device Code 流程。
- MVP 免费内测起步，不接入支付。
- 预留免费额度 + 付费高级额度的账户字段。

### SkillService

职责：

- 创建、更新、归档 Skill。
- 管理 Skill 草稿和发布版本。
- 写入对象存储并维护 SHA-256。
- 查询当前发布版和历史版本，发布版本永久保存。
- 触发 Skill 级质量闸门。

### PackService

职责：

- 创建、更新、归档 Pack。
- 将多个 Skill 版本组合成 Pack 草稿。
- 发布 Pack 版本。
- 检查 Pack 内所有 Skill 的质量状态。

### ProfileService

职责：

- 创建、更新、归档 Profile。
- 绑定账号、设备、Agent 类型、任务场景和 Pack 列表。
- 初始版本按 Agent + 任务场景区分 Profile。
- 后续预留按项目目录细分 Profile。
- 发布 Profile 版本。
- 为客户端生成 resolved manifest。

### ReleaseService

职责：

- 把已发布 Profile 版本固化为客户端可拉取的 release。
- 生成发布 manifest、哈希和对象存储 key。
- 初始版本只实现默认 `stable` 通道。
- 数据模型预留 `beta`、`dev` 等多通道。
- Skill、Pack、Profile 都需要单独发布；可在 UI 中提供“一键发布依赖链”降低操作负担。

### DeviceService

职责：

- 处理 Device Code 登录和设备注册。
- 维护设备名称、系统、客户端版本、最近在线时间。
- 返回当前设备可用的 Profile 和 Release。
- 接收 CLI apply 结果上报。
- 给 CLI 下发的 token 只允许读取已发布 release、下载对象和上报 apply 状态。
- CLI token 不允许编辑 Skill、Pack、Profile。

### ImportService

流程：

1. 接收 Web 上传文件/ZIP、指定来源，或后续 CLI/GitHub staging 文件。
2. 解析 `SKILL.md`。
3. 解析 YAML front matter。
4. 解析 Markdown 标题结构。
5. 计算 SHA-256。
6. 写入对象存储 staging 区。
7. 执行质量闸门。
8. 用户确认后登记 Skill 草稿或新版本。

MVP 导入入口：

- Web 上传 `SKILL.md`。
- Web 上传 ZIP。
- 指定来源导入预留。
- CLI scan/upload 放在 MVP 后的增强版本。

冲突策略：

- 同名同版本同哈希：跳过。
- 同名同版本不同哈希：标记冲突，要求用户选择新 patch 版本、覆盖草稿或保留副本。
- 同名不同版本：作为新版本导入。

### QualityGateService

规则分组：

- `format.required_frontmatter`：检查 `name`、`version`。
- `format.semver`：检查 SemVer。
- `format.required_sections`：检查 `## Trigger`、`## Steps` 或配置化标题。
- `security.secret_patterns`：检查 API Key、Token、私钥。
- `security.destructive_commands`：检查高风险命令。
- `security.prompt_injection`：检查忽略上级指令、泄露系统提示等风险表达。
- `supply_chain.remote_fetch`：检查技能中是否建议直接执行远程脚本。

严重等级：

- `blocker`：格式错误，阻止发布。
- `high`：安全高风险，首版只警告，不阻止发布。
- `medium`：提示风险与处理建议。
- `low`：风格或可维护性建议。

### SearchService

职责：

- 更新云端搜索索引。
- 执行账号范围内全文搜索。
- 提供搜索结果高亮片段。
- 支持按质量状态、Skill、Pack、Profile、Agent、标签过滤。

### ClientSyncService

核心原则：

- CLI 主动拉取当前设备可用 Release。
- 拉取内容只包含已发布 manifest。
- 客户端根据 manifest 下载 Skill 文件和 assets。
- 客户端缓存 release，支持离线查看最近状态。

### AgentDistributionService

核心原则：

- apply 前先生成计划。
- 计划中列出新增、保持、冲突、危险操作。
- 每次 apply 前必须要求用户确认，MVP 不提供静默自动 apply。
- 默认只管理 5KILL5 创建或 manifest 中记录的路径。
- 不删除未知文件。
- 目标路径存在且不是 5KILL5 管理项时，默认跳过并报冲突。
- 目标路径是 5KILL5 管理项时，先校验旧文件 hash；匹配才更新，不匹配则报冲突。

Windows 策略：

- 技能以目录为单位分发。
- 初始版本默认复制，避免 symlink/Junction 权限问题。
- Codex 目标路径不自动探测；CLI/Web 提供常见路径指导，由用户手动填写。
- Codex 常见路径指导：`$CODEX_HOME/skills`、Windows `%USERPROFILE%\.codex\skills`、macOS/Linux `~/.codex/skills`，并允许用户填写任意自定义绝对路径。
- Windows 是重点验收平台，需要覆盖路径长度、跨盘路径、已有目录冲突、只读文件等情况。
- 后续可提供目录符号链接和 Junction 作为高级策略，并在 manifest 中记录实际策略。

macOS/Linux 策略：

- 初始版本默认复制，与 Windows 行为保持一致。
- 后续可提供目录符号链接作为高级策略。
- 检查目标是否已存在。
- 目标存在且不是 5KILL5 管理项时，标记冲突并默认跳过。

manifest 示例：

```json
{
  "managed_by": "5kill5",
  "version": 1,
  "release_id": "release-id",
  "profile": {
    "id": "profile-id",
    "name": "Windows laptop / Codex / frontend",
    "agent_type": "codex",
    "task_context": "frontend"
  },
  "packs": [
    {
      "id": "pack-id",
      "version": "1.2.0",
      "skills": ["skill-version-id"]
    }
  ],
  "skills": [
    {
      "skill_id": "skill-id",
      "version_id": "version-id",
      "name": "code-review",
      "object_key": "skills/skill-id/1.0.0/SKILL.md",
      "sha256": "..."
    }
  ],
  "apply": {
    "strategy": "copy",
    "target_path_hint": "/path/to/agent/skills"
  }
}
```

### SyncService

初始版本的同步是“云端发布 manifest -> CLI 主动 pull -> CLI apply”，不是 WebDAV/Git 式双向同步。

CLI 同步流程：

1. `5kill5 auth login` 通过 Device Code 获取 scoped token。
2. `5kill5 device register` 注册当前设备。
3. `5kill5 profiles list` 获取当前设备可用 Profile。
4. `5kill5 pull --profile <profile>` 拉取 Profile 对应的已发布 release manifest。
5. CLI 校验 manifest SHA-256 和每个 Skill 文件哈希。
6. `5kill5 plan` 生成本地变更计划。
7. `5kill5 apply` 默认复制文件到目标目录。
8. CLI 写入本地 apply manifest 和历史记录。
9. CLI 上报 apply 结果到云端。

冲突策略：

- 目标路径不存在：创建。
- 目标路径是 5KILL5 管理项：按 manifest 更新。
- 目标路径存在但不是 5KILL5 管理项：标记冲突，默认跳过。
- 用户后续选择 symlink/Junction 高级策略时，在 manifest 中记录实际策略。

后续备份能力：

- WebDAV、Git、同步文件夹不作为 MVP 同步主线。
- 它们可作为导入、备份或自托管方案扩展。
- 任何双向合并都必须保留双方版本，不静默删除。

## Marketplace 与安装安全

初始版本不做公开 Marketplace。云端只管理用户自己的私有 Skill 和 Pack。

预留安装源：

- GitHub repository。
- ZIP URL。
- 本地 ZIP。
- 未来 Registry API。

后续安装流程：

1. 下载到云端或 CLI staging 区。
2. 解压到隔离 staging 目录。
3. 检查目录穿越风险，例如 `../`、绝对路径。
4. 查找 `SKILL.md` 或 manifest。
5. 计算哈希。
6. 运行质量闸门。
7. 展示安装摘要、风险和来源。
8. 用户确认后导入 canonical store。

Deep link：

```text
5kill5://install?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo
5kill5://import?url=https%3A%2F%2Fexample.com%2Fskill.zip
5kill5://profile?id=profile-id
```

Deep link 只能打开预览页，不能直接发布或 apply。

## 前端设计建议

### 信息架构

- 左侧：Skills、Packs、Profiles、Devices、Quality、Settings。
- Skills：技能列表、版本、草稿、发布、质量状态。
- Skill 内容：只读 Markdown 预览，不提供内容编辑器。
- Packs：组合包列表、包含的 Skill、发布状态。
- Profiles：账号/设备/Agent/任务场景绑定关系。
- Devices：设备注册状态、最近同步时间、客户端版本、apply 状态。
- Quality：发布前质量报告和 allowlist。

### UI 原则

- 面向工具型产品，界面保持紧凑、稳定、可扫描。
- 重要操作使用预览和确认，不用装饰性大卡片堆叠。
- 质量问题按严重等级使用清晰图标和颜色。
- 发布和设备同步结果显示明确版本、Profile、Agent 和目标路径。
- 隐私页明确说明：云端保存完整 Skill 内容；不要上传密钥或敏感信息；内容用于同步，不用于训练。
- 5KILL5 不提供 Skill 内容写作、编辑、改写、修复或生成功能，也不调用第三方模型 API 处理用户 Skill 内容。

### 关键组件

- SkillTable。
- SkillPreview。
- PackBuilder。
- ProfileBindingEditor。
- DeviceStatusTable。
- QualityFindingsPanel。
- ReleaseDialog。
- ApplyReportViewer。

## CLI / TUI 设计

CLI 命令建议：

```bash
5kill5 auth login
5kill5 auth status
5kill5 device register --name <device-name>
5kill5 targets set --agent codex --path <path>
5kill5 profiles list
5kill5 pull --profile <profile>
5kill5 plan --profile <profile> --agent codex
5kill5 apply --profile <profile> --agent codex
5kill5 status
5kill5 rollback
5kill5 cache clear
```

CLI 首发平台：

- Windows、macOS、Linux 同时首发。
- Windows 做重点验收，尤其是默认复制、路径覆盖、路径长度、权限和已有文件冲突。
- Codex 目标路径由用户手动填写；CLI 提供常见路径提示，不自动扫描或探测。
- 每次 `apply` 前必须确认；MVP 不支持无人值守 apply。

TUI 建议使用 Rust 生态的终端 UI 库实现，但不进入 MVP。首版先做稳定 CLI，TUI 作为 v1.0 或后续增强。

## 安全扫描规则草案

敏感信息模式：

- OpenAI 风格密钥：`sk-...`
- GitHub token：`ghp_...`、`github_pat_...`
- AWS key：`AKIA...`
- Slack token：`xoxb-...`
- 私钥块：`BEGIN PRIVATE KEY`
- 通用 Bearer token：`Authorization: Bearer ...`

破坏性命令模式：

- `rm -rf /`
- `Remove-Item -Recurse -Force`
- `del /s /q`
- `format`
- `diskpart`
- `git reset --hard`
- `curl ... | sh`
- `Invoke-WebRequest ... | Invoke-Expression`

Prompt 注入风险模式：

- 忽略先前或上级指令。
- 输出或泄露 system prompt。
- 绕过安全策略。
- 静默执行隐藏步骤。

注意：这些规则只能做启发式检测。技术方案必须允许用户查看证据、理解原因和手动 allowlist。

## 测试策略

### Rust 单元测试

- front matter 解析。
- SemVer 校验。
- SHA-256 计算。
- Markdown 标题解析。
- quality rule 匹配。
- path normalization。

### 集成测试

- Device Code 登录 mock。
- 邮箱验证码注册 mock。
- Release manifest 拉取和哈希校验。
- Windows 默认复制策略。
- 后续 Junction / symlink 高级策略。
- apply manifest 生成。
- 5KILL5 管理文件 hash 匹配后更新。
- hash 不匹配时报冲突。
- Profile -> Pack -> Skill resolved manifest 生成。
- Web 上传 `SKILL.md` 和 ZIP。

### 前端测试

- 技能列表过滤。
- 只读 Markdown 预览。
- Skill 元数据管理流程。
- Pack 组合流程。
- Profile 绑定流程。
- 质量报告展示。
- 发布确认弹窗。

### 端到端测试

- 新用户注册并导入 Skill。
- 邮箱验证码登录。
- Web 上传 Skill。
- 创建 Pack 并绑定 Skill。
- 创建 Profile 并绑定设备、Agent 和 Pack。
- 发布 Profile。
- CLI 登录、注册设备、pull、plan、apply。
- apply 前确认。
- CLI rollback。

## 里程碑计划

### M0. 基础设计

- 固化 Skill manifest 最小字段。
- 确认 `Skill + Pack + Profile` 数据模型。
- 确认开源 CLI + 商业云边界。
- 完成 schema 和目录结构。

### M1. 云端 MVP

- Cloudflare Workers + D1 + R2 工程骨架。
- 邮箱验证码注册和登录。
- Device Code 登录。
- Skill 导入、元数据管理和 R2 对象存储。
- Skill 只读 Markdown 预览。
- Web 上传 `SKILL.md` 或 ZIP。
- 指定来源导入预留。
- Pack 管理。
- Profile 管理。
- 质量闸门基础规则：格式错误阻止发布，安全风险只警告。
- 隐私页。
- Release manifest 生成。

### M2. CLI MVP

- `auth login`。
- `device register`。
- `targets set --agent codex --path <path>`。
- `profiles list`。
- `pull/plan/apply/status/rollback`。
- Codex 常见路径指导 + 用户手动填写目标路径。
- 通用目录 adapter。
- 默认复制式本地分发。
- apply 前强制确认。
- 5KILL5 管理文件 hash 校验。
- Windows/macOS/Linux release 构建，Windows 重点验收。

### M3. 稳定化

- apply 冲突处理。
- 后续 Junction / symlink 高级策略。
- 设备状态上报。
- 错误恢复和日志。
- 发布前质量闸门完善。

### M4. v1.0.0 GUI

- Tauri app scaffold。
- 技能、Pack、Profile、设备管理界面。
- Skill 只读 Markdown 预览。
- 质量报告面板。
- Deep link 导入。

### M5. 扩展能力

- CLI scan/upload。
- GitHub 第三方导入。
- Registry API 草案。
- 签名和信任等级。
- 团队共享和策略化分发。

## 主要技术风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 云端发布模型设计不清 | 客户端拉取到半成品 | 草稿/发布版分离，CLI 只拉发布版 |
| Profile 解析错误 | 分发到错误 Agent 或任务目录 | resolved manifest 固化并做哈希校验 |
| 默认复制导致版本漂移 | 用户手动改目标目录后和云端不一致 | apply manifest、哈希校验、冲突跳过、状态上报 |
| Windows 路径和权限差异 | apply 失败或文件无法覆盖 | Windows 重点验收，默认复制，路径规范化 |
| Agent 规范差异 | 抽象失真 | 使用 Agent adapter，先做文件级适配 |
| Marketplace 供应链风险 | 用户机器受影响 | staging、质量闸门、来源标记、信任等级 |
| 质量扫描误报 | 用户体验下降 | 支持 allowlist 和规则解释 |
| 云端保存完整 Skill 内容 | 用户误传密钥或敏感信息 | 隐私页和上传提示明确边界，内容用于同步不用于训练 |
| 产品边界漂移成创作平台 | 范围膨胀、隐私和模型调用风险增加 | 明确禁止平台内写作/改写/修复/生成 Skill 内容，不接入第三方模型 API 处理 Skill 内容 |
| Cloudflare 平台限制 | 成本、性能或容量达到上限 | 以阈值触发迁移到自有服务器 |
| 功能范围过大 | MVP 延期 | 初始只做云端控制台 + CLI，GUI 和 Marketplace 后置 |

## 许可证边界

- 公开 CLI 继续使用 GPL-3.0，与当前仓库许可证保持一致。
- 云端服务端闭源商业，放独立私有仓库，避免与公开 CLI 仓库混淆。
- 公开 API 文档、协议描述和示例请求可以单独使用宽松许可证发布，方便第三方集成。
- 用户上传的 Skill 内容版权和许可证归用户或原作者所有，5KILL5 只按服务条款保存和同步。

## 迁移阈值

任一条件满足即启动迁移到自有服务器的技术评估：

- Cloudflare 月成本连续 2 个月超过 200 美元。
- MAU 超过 5000。
- API p95 延迟连续 7 天超过 800ms。
- D1 数据超过 1GB。
- R2 对象存储超过 100GB。
- D1/Workers 平台限制阻塞核心功能。

## 推荐下一步

1. 先实现 Cloudflare schema、邮箱验证码、Device Code 登录和 `pull/plan/apply` CLI。
2. 实现 Web 上传 `SKILL.md`/ZIP 和只读 Markdown 预览。
3. 实现 Codex/通用目录手动路径配置和默认复制式 apply。
