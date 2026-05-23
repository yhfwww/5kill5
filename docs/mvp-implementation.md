# 5KILL5 MVP Implementation Notes

This repository now contains a first implementation of the design documents in `docs/`.

## Implemented Surface

- `apps/web`: a browser console for private Skill, Pack, Profile, Device, Quality, and Privacy workflows.
- The Web console supports selectable Chinese and English UI text, persisted in local storage.
- `services/api`: a Cloudflare Workers style API with D1/R2 bindings, Skill import, publishing, Pack/Profile creation, release manifest generation, device registration, and apply reports.
- `migrations`: executable D1 schema for accounts, devices, skills, versions, packs, profiles, releases, quality findings, audit log, and a simple FTS table.
- `crates/5kill5-core`: dependency-light Rust core for quality scanning, release manifest parsing, local plan/apply, conflict checks, managed-file state, and rollback.
- `crates/5kill5-cli`: Rust CLI command surface for auth, device registration, targets, pull, plan, apply, status, rollback, and cache clearing.

## MVP Decisions Reflected in Code

- Cloud is the source of truth; CLI only reads published release manifests and applies them locally.
- Skill, Pack, and Profile are separate release concepts.
- Local distribution defaults to copy.
- Unknown files are not overwritten.
- Managed files are updated only when the previous local hash still matches the 5KILL5 state file.
- `apply` requires explicit confirmation unless `--yes` is passed.
- The Web console exposes only read-only Skill content preview and metadata/composition management.
- Security findings warn by default; required-format findings block publication.

## Local Preview

The Web console has no npm dependency. It can run with any modern Node.js:

```bash
npm run web:dev
```

If only the bundled Codex runtime is available on Windows:

```powershell
& 'C:\Users\yhf\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' apps\web\server.mjs
```

Then open `http://127.0.0.1:5173`.

## CLI Smoke Flow

```bash
cargo build -p 5kill5
5kill5 auth login
5kill5 device register --name "Windows workstation"
5kill5 targets set --agent codex --path "%USERPROFILE%\.codex\skills"
5kill5 plan --manifest fixtures/demo-release.json --target ./tmp-skills
5kill5 apply --manifest fixtures/demo-release.json --target ./tmp-skills --yes
5kill5 status --target ./tmp-skills
5kill5 rollback --target ./tmp-skills
```

## Cloudflare Setup

```bash
wrangler d1 migrations apply 5kill5_preview --local
wrangler dev
```

Before production deployment, replace the placeholder `database_id` in `wrangler.toml`, configure the R2 bucket, and put the email/device-code flow behind real account verification.

## Known Follow-Up Work

- Replace local CLI auth placeholders with the hosted Device Code token exchange.
- Add multipart Web upload and real ZIP extraction in the Worker import path.
- Add object download support to CLI when a manifest references R2 objects without inline `content`.
- Add automated integration tests once `cargo`, `wrangler`, and the package manager are available in the development environment.

# 中文版：5KILL5 MVP 实现说明

本仓库现在已经包含 `docs/` 设计文档的第一版实现。

## 已实现范围

- `apps/web`：浏览器控制台，覆盖私有 Skill、Pack、Profile、Device、Quality 和 Privacy 工作流。
- Web 控制台支持中文和英文界面文案切换，并持久化到本地存储。
- `services/api`：Cloudflare Workers 风格 API，包含 D1/R2 绑定、Skill 导入、发布、Pack/Profile 创建、发布清单生成、设备注册和 apply 上报。
- `migrations`：可执行的 D1 数据库 Schema，覆盖账号、设备、skills、versions、packs、profiles、releases、quality findings、audit log，以及一个简单的 FTS 表。
- `crates/5kill5-core`：轻依赖 Rust 核心库，负责质量扫描、发布清单解析、本地 plan/apply、冲突检查、受管文件状态和 rollback。
- `crates/5kill5-cli`：Rust CLI 命令入口，覆盖 auth、设备注册、目标路径、pull、plan、apply、status、rollback 和缓存清理。

## 代码中体现的 MVP 决策

- 云端是事实来源；CLI 只读取已发布的 release manifest，并在本地应用。
- Skill、Pack 和 Profile 是相互独立的发布概念。
- 本地分发默认采用复制。
- 不覆盖未知文件。
- 受管文件只有在本地上一版 hash 仍然匹配 5KILL5 state file 时才会被更新。
- `apply` 默认需要显式确认，除非传入 `--yes`。
- Web 控制台只提供只读 Skill 内容预览，以及元数据和组合管理。
- 安全发现默认只警告；必需格式错误会阻止发布。

## 本地预览

Web 控制台没有 npm 依赖，可以用任意现代 Node.js 运行：

```bash
npm run web:dev
```

如果 Windows 上只有 Codex 捆绑运行时可用：

```powershell
& 'C:\Users\yhf\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' apps\web\server.mjs
```

然后打开 `http://127.0.0.1:5173`。

## CLI 冒烟流程

```bash
cargo build -p 5kill5
5kill5 auth login
5kill5 device register --name "Windows workstation"
5kill5 targets set --agent codex --path "%USERPROFILE%\.codex\skills"
5kill5 plan --manifest fixtures/demo-release.json --target ./tmp-skills
5kill5 apply --manifest fixtures/demo-release.json --target ./tmp-skills --yes
5kill5 status --target ./tmp-skills
5kill5 rollback --target ./tmp-skills
```

## Cloudflare 设置

```bash
wrangler d1 migrations apply 5kill5_preview --local
wrangler dev
```

生产部署前，需要替换 `wrangler.toml` 中占位的 `database_id`，配置 R2 bucket，并将邮箱验证和设备码流程接入真实账号校验。

## 已知后续工作

- 用托管 Device Code token exchange 替换本地 CLI auth 占位逻辑。
- 在 Worker 导入路径中增加 multipart Web upload 和真实 ZIP 解压。
- 当 manifest 引用 R2 object 且没有内联 `content` 时，为 CLI 增加对象下载支持。
- 当开发环境具备 `cargo`、`wrangler` 和包管理器后，增加自动化集成测试。
