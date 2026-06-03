# CHANGELOG_FOR_AGENT.md
> 本文件由 changelog-keeper skill 自动维护，供后续 Agent 快速理解项目演进历史。
> 最新记录在最前。每条记录包含完整的技术上下文，包括文件路径、影响范围、设计决策。
> 接手项目前，请先读取最近 3-5 条记录以获取充分上下文。

---

## [v0.2.0] 2026-06-03

**变更摘要**：Web 控制台多项功能增强与 Bug 修复

### 改动文件
- `apps/web/app.js` — 重写 YAML 解析器、添加标签提取、修复数据兼容性、支持 ZIP/SKILL 上传
- `apps/web/index.html` — 引入 JSZip CDN、扩展文件上传类型、更新下拉菜单文案
- `apps/web/styles.css` — 添加标签编辑、删除按钮等样式

### 核心变化

1. **YAML 解析器重写**：`parseSkill()` 从简单的单层解析改为基于缩进栈的解析器，支持任意层级 YAML 嵌套（如 `metadata.openclaw.tags`）。旧解析器只能处理 `compatibility.agents` 一层嵌套，无法解析 last30days 等复杂 SKILL.md。

2. **标签提取增强**：新增 `extractTags()` 辅助函数，按优先级提取标签：先找顶层 `tags`，再找 `metadata.openclaw.tags`。`createSkillFromContent` 和 `createSkillFromGitHub` 均已更新使用此函数。

3. **页面崩溃修复**：将 `tags` 字段拆分为 `officialTags`/`userTags` 后，旧 localStorage 数据缺少新字段导致渲染崩溃。修复方式：`loadState()` 中添加数据迁移逻辑，渲染代码添加 `|| []` 安全访问。

4. **ZIP/SKILL 文件上传**：引入 JSZip 库，支持上传 `.zip` 和 `.skill` 文件。自动解压、识别 SKILL.md、解析元数据和标签，附属文件（scripts、references、assets）以 Base64 编码存储。新增 `createSkillFromZipFile()` 函数。

5. **GitHub 导入增强**：修复 `fetchGitHubRaw` 的 URL 编码问题（`encodeURIComponent` 会编码 `/` 导致路径错误），导入预览中显示解析出的标签和元数据。

6. **技能删除**：添加删除按钮和确认对话框。

7. **质量检查规则调整**：移除 `## Trigger`/`## Steps` 的 blocker 级别强制要求，改为 low 级别的 `format.minimal_structure`，只检查是否存在任意章节标题。

### 影响范围
- **接口变更**：`parseSkill()` 返回的 `meta` 对象结构变化，支持任意层级嵌套；skill 对象 `tags` 字段被替换为 `officialTags` + `userTags`
- **依赖变更**：新增 JSZip 3.10.1（CDN 引入）
- **行为变更**：上传文件现在支持 .zip/.skill 格式；旧 localStorage 数据自动迁移

### 设计决策
- 选择栈式 YAML 解析器而非引入完整 YAML 库，保持零依赖（除 JSZip 外）
- `officialTags`/`userTags` 拆分而非复用 `tags`，因为官方标签来自 SKILL.md 元数据不可编辑，用户标签可自由增删
- ZIP 上传直接导入而非先预览，与 GitHub 导入的预览流程不同（ZIP 文件已在本地，无需二次确认）

### 后续注意事项
- localStorage 存储有大小限制（~5MB），大量 ZIP 上传可能导致溢出
- GitHub API 速率限制（60 req/hour 未认证）仍存在，降级方案只能获取 SKILL.md
- `createSkillFromGitHub()` 中的 `source` 字段结构与 `createSkillFromZipFile()` 不同，后续可能需要统一

---

## [v0.1.0] 2026-05-17

**变更摘要**：项目初始化，MVP 基础实现

### 改动文件
- `apps/web/` — Web 控制台初始实现（纯前端 localStorage）
- `crates/5kill5-core/` — Rust 核心库（质量扫描、manifest 解析、plan/apply/rollback）
- `crates/5kill5-cli/` — Rust CLI 初始实现
- `services/api/` — Cloudflare Workers API 骨架
- `migrations/` — D1 数据库 Schema
- `docs/` — 设计文档（需求、技术方案、产品决策、MVP 实现）

### 核心变化
- 纯前端 Web 控制台，数据存储在 localStorage
- Rust CLI 支持 auth、device、pull、plan、apply、status、rollback
- D1 Schema 包含 14 张表（accounts、skills、packs、profiles、devices 等）
- 质量闸门基础规则实现

---
