# 5KILL5 需求说明文档 v0.1

项目：5KILL5（吾 skills）  
整理时间：2026-05-17  
整理方式：基于当前设想进行需求澄清和产品化整理  
当前完整度评估：90 / 100

## 一句话描述

5KILL5 是一个云端管理 Skill 组合、通过 CLI 同步到多设备和多 Agent 任务环境的 AI 技能管家。

## 背景与问题

AI Agent 工具正在快速分化。Claude Code、Cursor、Codex CLI、自定义 Agent 等工具通常都有各自的技能、提示词、命令模板或工作流配置目录。用户在长期使用中会沉淀大量 `SKILL.md`、规则文件、脚本和模板，但这些资产经常分散在不同目录、不同设备和不同 Agent 中。

当前主要痛点：

- 技能分散：同一技能可能被复制到多个 Agent 目录，版本不一致。
- 更新困难：修改一个技能后，需要手动同步到多处，容易漏改。
- 缺少质量控制：技能文件可能缺少元数据、触发条件不清晰，甚至包含危险命令或敏感信息。
- 缺少跨设备一致性：换电脑后，需要重新收集和配置技能。
- 缺少可审计性：不知道一个技能来自哪里、何时更新、分发到哪些 Agent。
- 缺少渐进式加载能力：Agent 启动时如果一次性加载大量完整技能，可能增加上下文负担。

5KILL5 的核心价值不是再做一个普通 Markdown 管理器，而是把用户的 AI 技能资产变成可组合、可发布、可按账号/设备/Agent/任务场景分发的云端技能工具箱。CLI 客户端负责把云端发布版同步到本机 Agent 可读取的位置。

## 参考启发与合理性调整

以下内容不是对 CC Switch、Skillshare、Skill Forge 等工具实现细节的复刻，而是从用户给出的参考方向中抽象出的产品原则：

- 从配置切换类工具借鉴：多目标路径管理、启用/停用、切换前预览、可回滚。
- 从技能分享类工具借鉴：来源记录、安装预览、信任等级、更新提示。
- 从技能构建类工具借鉴：模板化创建、质量闸门、版本演进、发布前检查。

已确认的产品路线：

- 初始版本先做云端 Web 控制台和命令行客户端。
- 云端作为组合、发布、设备绑定和分发策略的事实源。
- CLI 客户端通过 Device Code 登录，主动 `pull/apply` 云端已发布配置。
- 数据模型采用 `Skill + Pack + Profile`。
- Profile 按账号、设备、Agent、任务场景决定启用哪些 Pack。
- GUI 客户端放到 `v1.0.0` 稳定版本。
- Marketplace 首版不做，只支持用户自己的私有 Skill 和 Pack。
- 云端先采用 Cloudflare Workers + D1 + R2 低成本验证；有明显效果后再考虑迁移到自有服务器。
- 初始部署形态只做官方托管云。
- 本地分发默认复制，优先避开 Windows symlink/Junction 权限问题。
- Codex 适配初始版本不自动探测路径，而是给出常见路径指导，由用户手动填写目标路径。
- Web 控制台首版只提供 Skill 只读预览和组合管理，不提供 Skill 内容编辑器。
- 质量闸门首版规则：格式错误阻止发布，安全风险只警告。
- 5KILL5 不是 Skill 创作平台，不提供 AI 辅助改写、修复或生成 Skill，也不调用第三方模型 API 处理用户 Skill 内容。
- 安全扫描定位为启发式风险发现，不能承诺证明技能绝对安全。

## 目标与成功标准

### 产品目标

1. 建立云端 Skill 管理中心，统一管理 Skill、Pack、Profile、版本和发布状态。
2. 支持用户在云端组合不同 Skill，形成面向场景的 Pack。
3. 支持按账号、设备、Agent、任务 Profile 下发不同 Skill Pack。
4. 提供 CLI 客户端，完成登录、拉取、预览、应用、回滚和本地状态检查。
5. 在 Skill、Pack、Profile 发布前执行格式验证、安全扫描和版本检查。
6. 采用草稿/发布版机制，客户端只同步已发布版本，避免半成品影响用户环境。
7. `v1.0.0` 稳定版本再提供完整桌面 GUI。

### 可量化成功标准

- 云端管理：用户能在 Web 控制台导入 Skill、组合 Pack、绑定 Profile 并发布。
- CLI 同步：用户能在新设备上通过 Device Code 登录，并在 3 条命令内完成 Agent 技能部署。
- 搜索体验：在 1000 个 Skill 规模下，名称、描述、正文搜索响应时间小于 200ms。
- 数据安全：同步和分发操作默认不删除用户手动创建的文件。
- 分发可靠性：每次 CLI apply 都必须先展示计划并要求用户确认，执行后有结果记录和冲突提示。
- 质量闸门：能识别缺失元数据、SemVer 非法、结构缺失、疑似密钥、破坏性命令等问题。
- 跨平台目标：Windows、macOS、Linux CLI 可运行；Windows 做重点验收，初始版本默认复制。

## 用户与利益相关方

| 角色 | 关系 | 核心诉求 |
|---|---|---|
| AI 重度用户 | 核心用户 | 云端管理多 Agent 技能组合，减少重复维护 |
| 开发者 / 独立黑客 | 核心用户 | 版本化、发布、同步和部署自己的技能资产 |
| 团队负责人 | 后续用户 | 希望团队共享一组经过验证的技能 |
| Skill 作者 | 后续用户 | 发布、升级、维护技能包 |
| CLI 客户端 | 核心载体 | 拉取云端发布版并部署到本机 Agent 目录 |
| Agent 工具 | 集成对象 | 读取被 CLI 分发到指定目录的技能文件 |

## 需求整理

### 1. 背景与问题

- 现状：技能文件分散在多 Agent、多设备、多目录中。
- 痛点：复制式管理导致版本漂移，缺少安全扫描和同步状态。
- 触发原因：用户希望围绕 5KILL5 域名和品牌，构建一个 AI 技能管家应用。

### 2. 目标与成功标准

- 核心目标：做成云端 Skill 组合管理器和 CLI 分发客户端。
- 成功标准：能在云端导入/组合/发布 Skill Pack，并通过 CLI 同步到指定设备、Agent 和任务 Profile。
- 目标用户：AI Agent 重度用户、开发者、未来的团队协作用户。

### 3. 功能范围

Must Have：

- 云端账号体系和 Device Code 登录。
- 云端 Skill 管理，包括草稿、发布版、版本、来源、哈希和质量状态。
- Pack 管理：将多个 Skill 组合成可复用工具包。
- Profile 管理：按账号、设备、Agent、任务场景绑定一个或多个 Pack。
- CLI 客户端：登录、拉取、预览、应用、回滚、状态检查。
- 格式验证、安全扫描和发布前质量闸门。
- 非破坏式本地分发到 Agent 目录。
- Codex + 通用目录两类首批 Agent 适配。
- Web 上传文件/ZIP 导入 Skill。
- Skill 只读 Markdown 预览。
- 邮箱验证码注册。
- 明确隐私页，提示云端保存完整 Skill 内容，内容用于同步不用于训练。
- Windows/macOS/Linux CLI 同时首发，Windows 做重点验收。

Should Have：

- Skill 只读预览增强。
- D1 简单搜索，后续评估 FTS 或外部搜索服务。
- TUI 交互界面。
- WebDAV、Git 或同步文件夹导入/备份。
- 桌面 GUI。
- Marketplace 安装入口。
- Deep link 导入。
- 渐进式披露的元数据索引和按需加载。

Won't Have：

- 首版不做多租户 SaaS。
- 首版不托管官方中心化 Registry。
- 首版不执行技能中的任意脚本。
- 首版不承诺对所有 AI Agent 的私有格式做深度适配。
- 首版不做复杂团队权限、审批和计费。
- 首版不做桌面 GUI，GUI 放到 `v1.0.0` 稳定版本。
- 首版不做 CLI scan/upload，放在 Web 导入入口之后。
- 首版不做完整自动化风险评分，只预留 `risk_level` 字段。
- 首版不自动探测 Codex 默认路径，只做常见路径指导和手动填写。
- 首版不做付费能力，采用免费内测，预留免费额度 + 付费高级额度。
- 首版不允许在平台内写作、编辑、改写、修复或生成 Skill 内容。
- 首版不调用第三方模型 API 处理用户 Skill 内容。

### 4. 资源与约束

- 时间：[待确认]
- 预算：[待确认]
- 初始技术形态：云端 Web 控制台 + Rust CLI 客户端。
- 初始技术栈：Cloudflare Workers + D1 + R2 + Rust CLI。
- `v1.0.0` GUI 技术栈：Tauri 2、Rust、React、TypeScript、Tailwind CSS、shadcn/ui。
- 团队：[待确认]，当前按单人或小团队可推进项目设计。
- 商业策略：开源 CLI + 商业云。
- 许可：公开 CLI 继续使用 GPL-3.0；云端服务端闭源商业，放独立私有仓库；公开 API 文档和协议描述可单独使用宽松许可证。

### 5. 假设与风险

关键假设：

- 技能的核心载体以 `SKILL.md` 为主。
- 不同 Agent 可接受通过文件夹、符号链接或 Junction 暴露技能。
- 用户愿意使用云端账号管理 Skill 组合，但要求 CLI 在本地分发时透明、可预览、可回滚。
- 大部分技能可通过 YAML 元数据、Markdown 结构和正文规则完成基础质量检查。
- CLI 客户端只应用云端发布版，不应用草稿。
- CLI token 只读发布版并上报 apply 状态，不具备编辑 Skill/Pack/Profile 的权限。
- 云端初始版本保存完整 Skill 内容。
- 账号注册使用邮箱验证码。
- 云端历史版本永久保存。
- 迁移到自有服务器由成本、性能、容量或平台限制阈值触发；任一阈值触发迁移评估。
- 用户通过上传文件/ZIP 或指定来源提供 Skill 内容；平台只做管理、校验、组合、发布和分发。

主要风险：

- 不同 Agent 的技能规范差异较大，统一抽象可能过度复杂。
- Windows 下符号链接、Junction、权限和跨盘路径会带来边界问题。
- 云端事实源设计不当会导致客户端之间状态漂移。
- 客户端 apply 如果缺少预览和回滚，可能破坏用户现有 Agent 配置。
- 默认复制能降低权限问题，但会带来重复文件和版本漂移风险，需要通过 apply manifest 管理。
- Marketplace 安装第三方技能存在供应链风险。
- 安全扫描只能降低风险，不能证明技能绝对安全。

## 功能需求

### 核心领域模型

#### Skill

单个技能，是最小可复用单位。通常对应一个 `SKILL.md` 以及相关 assets。

示例：`code-review`、`bug-fix`、`docs-writer`。

#### Pack

技能组合包，将多个 Skill 组合成一个可复用工具箱。

示例：`Codex 编程套装` 包含 `code-review`、`bug-fix`、`test-writer`。

#### Profile

分发配置，描述某个账号、设备、Agent、任务场景应该启用哪些 Pack。

示例：`我的 Windows 笔记本 / Codex / 前端项目` 使用 `Codex 编程套装`。

### F1. 云端 Skill 管理

描述：用户可以在 Web 控制台中查看、搜索、导入、归档 Skill，并管理其元数据和发布状态。平台不允许用户直接写作或修改 Skill 内容。

验收标准：

- 每个 Skill 至少包含名称、版本、描述、标签、触发词、兼容 Agent、风险等级、作者、许可证、来源、文件哈希、质量状态、创建时间、更新时间。
- `compatibility`、`risk_level`、`author`、`license` 首版作为字段保存，部分功能可以先不做深度逻辑。
- 支持按名称、标签、Agent、风险等级、分发状态过滤。
- 支持查看当前版本和历史版本，发布版本永久保存。
- Skill 内容只读；内容变更必须通过上传新文件/ZIP 或指定来源重新导入形成新版本。
- 删除操作默认进入归档状态，不影响已经发布到客户端的历史版本。

推荐最小 manifest：

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

### F2. Pack 组合管理

描述：用户可以将多个 Skill 组合成 Pack，用于复用和批量分发。

验收标准：

- 一个 Pack 可包含多个 Skill，可固定具体版本或跟随发布版。
- Pack 有名称、描述、标签、版本、草稿状态、发布状态。
- 修改 Pack 草稿不会影响客户端，只有发布后客户端才能拉取。
- Pack 发布前需要检查其中所有 Skill 的质量状态。
- Pack 支持复制、归档和版本历史。

### F3. Profile 分发管理

描述：用户可以按账号、设备、Agent、任务场景配置要启用的 Pack。

验收标准：

- Profile 至少包含账号、设备、Agent 类型、任务场景、绑定 Pack 列表。
- 同一设备可有多个 Profile。
- 同一 Agent 可按任务场景启用不同 Pack。
- 初始版本按 Agent + 任务场景区分 Profile。
- 后续预留按项目目录细分 Profile。
- Profile 发布后生成客户端可拉取的 resolved manifest。
- Profile 修改草稿不会影响客户端，发布后才会成为同步目标。

### F4. 草稿与发布机制

描述：Skill、Pack、Profile 都采用草稿/发布版机制，客户端只同步发布版。

验收标准：

- 用户保存编辑内容时生成草稿。
- 发布前执行质量闸门和依赖检查。
- 发布后生成不可变版本记录。
- 支持逐个发布 Skill、Pack、Profile。
- 支持“一键发布依赖链”，减少连续发布操作。
- CLI 默认只拉取发布版。
- 后续预留 `stable`、`beta`、`dev` 多通道，但初始版本只实现一个默认发布通道。

### F5. 质量闸门

描述：每个 Skill 在导入、保存、发布前触发质量检查；Pack 和 Profile 发布前执行组合级检查。

验收标准：

- 格式验证：检查必需 YAML 字段 `name`、`version`。
- 结构验证：检查 `## Trigger`、`## Steps` 或可配置等价标题。
- 版本验证：检查 SemVer。
- 安全扫描：检测疑似 API Key、私钥、Token、破坏性命令、Prompt 注入指令。
- 格式错误阻止发布。
- 安全风险首版只警告，不阻止发布。
- 输出 finding，包括等级、位置、规则、说明和建议。
- 支持 allowlist，但必须记录审计日志。

### F6. CLI 登录、同步与本地分发

描述：CLI 客户端使用 Device Code 登录，主动拉取云端发布版 Profile，并非破坏式应用到本机 Agent 目录。

验收标准：

- CLI 支持 Device Code 登录和 scoped token。
- CLI token 权限限制为读取已发布 release、下载 Skill 内容、上报 apply 状态。
- CLI token 不允许编辑 Skill、Pack、Profile。
- CLI 可注册当前设备，并绑定设备名称、系统、Agent 目标目录。
- Codex 目标路径由用户手动填写，CLI/Web 提供常见路径指导。
- Codex 常见路径指导包括 `$CODEX_HOME/skills`、Windows `%USERPROFILE%\.codex\skills`、macOS/Linux `~/.codex/skills`，并允许填写任意自定义目录。
- `pull` 获取当前设备和 Agent 可用的 Profile。
- `plan` 显示将新增、更新、跳过、冲突的文件。
- `apply` 每次执行前必须要求用户确认。
- `rollback` 回退上一次 apply。
- 不覆盖未知文件。
- 冲突时默认跳过并报冲突。
- 对 5KILL5 已管理文件，先校验旧文件 hash；匹配才更新，不匹配则报冲突。
- 初始版本默认复制文件，避免 symlink/Junction 权限问题。
- 后续可提供 symlink/Junction 作为高级策略，并允许 Profile 覆盖。
- 每次分发写入 manifest 和审计记录。

### F7. CLI 命令

描述：提供终端入口，适合开发者在命令行中登录、拉取、预览、应用和检查状态。

建议命令：

```bash
5kill5 auth login
5kill5 device register --name <device-name>
5kill5 profiles list
5kill5 pull --profile <profile>
5kill5 plan --profile <profile> --agent codex
5kill5 apply --profile <profile> --agent codex
5kill5 status
5kill5 rollback
```

验收标准：

- CLI 输出可读结果，同时支持 JSON 输出。
- 所有会写入本地文件系统的命令都支持 dry-run 或 plan。
- CLI 本地保存缓存和 apply manifest。
- CLI 不读取云端草稿，只读取已发布版本。

### F8. 云端搜索

描述：云端对 Skill、Pack、Profile 建立搜索索引，CLI 可查询自己账号下可用对象。

验收标准：

- 支持关键词搜索。
- 支持按字段加权排序。
- Skill 更新后自动刷新索引。
- 搜索结果能跳转到对应 Skill、Pack 或 Profile。

### F9. 云端同步与客户端状态

描述：云端保存账号级 Skill/Pack/Profile 状态，客户端主动同步并上报本机 apply 结果。

验收标准：

- 云端保存 Skill 内容、Pack 组合、Profile 绑定和发布 manifest。
- 文件内容存对象存储，元数据存云端数据库。
- 云端保存完整 Skill 内容。
- 隐私页明确提示不要上传密钥或敏感信息，内容用于同步，不用于训练。
- CLI 本地只保存缓存、token、设备配置和 apply manifest。
- 客户端主动 `pull/apply`，云端不直接远程控制用户设备。
- 客户端可上报版本、Profile、Agent、apply 状态和错误摘要。
- 云端可展示每台设备最近同步时间和当前版本。

### F10. Marketplace 与安装

描述：初始版本不做公开 Marketplace，只支持用户管理自己的私有 Skill 和 Pack。

验收标准：

- 首版不提供公开技能市场、评分、排行榜和第三方一键安装。
- 数据模型预留来源、信任等级、外部 URL 和哈希字段。
- MVP 支持 Web 上传 `SKILL.md` 或 ZIP 导入。
- MVP 支持指定来源导入的字段预留。
- CLI scan/upload 作为紧随 MVP 的增强能力。
- 后续 GitHub/ZIP 导入必须先进入隔离 staging 区。
- 后续公开 Marketplace 必须有质量闸门、信任等级和版本更新提示。

### F11. 渐进式披露

描述：5KILL5 维护轻量元数据索引，Agent 或用户只在需要时加载完整技能。

验收标准：

- 元数据包含 name、description、trigger、tags、version、risk level、path。
- 完整正文单独存储和索引。
- 对外导出可生成轻量索引文件。
- 触发具体任务时再打开完整 `SKILL.md`。

## 非功能需求

### 安全

- 文件系统访问必须限制在用户授权目录、应用数据目录和配置的 Agent 目录。
- 不执行第三方技能中的任意命令。
- 后续 Marketplace 或 GitHub/ZIP 导入内容必须先进入隔离区。
- 明确隐私页：不要上传密钥或敏感信息；云端保存完整 Skill 内容；内容只用于同步，不用于训练。
- 所有破坏性操作需要显式确认。
- 记录同步、分发、删除、allowlist 等敏感操作。

### 可用性

- 初始版本 Web 控制台面向日常管理，CLI 面向本地同步和分发。
- Web 控制台提供只读 Markdown 预览，不提供 Skill 内容编辑器。
- 所有 CLI 分发操作提供预览。
- 错误信息要明确指出路径、原因和恢复建议。

### 性能

- 云端搜索需要支持账号内 Skill/Pack/Profile 快速检索。
- CLI 本地缓存需要支持离线查看最近一次拉取的发布 manifest。
- 大文件扫描应可取消。
- 文件哈希计算应支持增量或后台任务。

### 可靠性

- 非破坏式合并优先。
- 对管理目录写入 manifest。
- 每次 apply 前生成计划和回滚记录。
- 每次 apply 前必须用户确认。
- 更新 5KILL5 管理文件前必须校验旧 hash。
- 冲突保留双方版本。

### 跨平台

- Windows：作为重点验收平台，处理路径长度、跨盘路径、默认复制、后续 Junction/symlink fallback。
- macOS/Linux：同时首发，默认复制，后续支持符号链接高级策略。
- 所有路径统一使用规范化绝对路径和平台无关存储格式。

## MVP 建议

### MVP 范围

MVP 目标是证明 5KILL5 的核心闭环：云端管理 Skill/Pack/Profile，CLI 拉取发布版并应用到本机 Agent 目录。

MVP 包含：

1. 云端账号体系和 Device Code 登录。
2. Cloudflare Workers + D1 + R2 官方托管云。
3. 云端 Skill 导入、元数据管理、版本和草稿/发布机制。
4. Web 上传 `SKILL.md` 或 ZIP 导入。
5. 指定来源导入预留。
6. Pack 组合管理。
7. Profile 分发管理，支持账号 + 设备 + Agent + 任务场景。
8. Skill 只读 Markdown 预览。
9. 质量闸门基础规则：格式错误阻止发布，安全风险只警告。
10. R2 保存完整 Skill 文件，D1 保存元数据和组合关系。
11. CLI 登录、设备注册、pull、plan、apply、status、rollback。
12. Codex 常见路径指导 + 用户手动填写目标路径。
13. 通用目录适配。
14. 默认复制式本地分发、manifest 和 apply 日志。
15. 每次 apply 前必须确认。
16. Windows/macOS/Linux CLI 同时首发，Windows 做重点验收。
17. 邮箱验证码注册。
18. 隐私提示页。

MVP 暂缓：

1. 桌面 GUI。
2. TUI。
3. 官方 Marketplace。
4. 团队协作和组织权限。
5. GitHub 第三方导入。
6. WebDAV、Git 或同步文件夹备份。
7. 复杂 Markdown 协同编辑。
8. 平台内写作、编辑、改写、修复或生成 Skill 内容。
9. CLI scan/upload。
10. 完整自动化风险评分。
11. 自动探测 Codex 默认路径。
12. 付费能力。
13. 调用第三方模型 API 处理用户 Skill 内容。

理由：5KILL5 的差异化在于云端 Skill 组合管理和按设备/Agent/任务场景分发。先把云端组合和 CLI apply 做稳，再扩展 GUI、Marketplace 和团队能力。

### v1.0 建议范围

- 完整桌面 GUI。
- 稳定 CLI。
- 可选 TUI。
- CLI scan/upload。
- GitHub 第三方导入。
- Deep link 导入。
- 更完善的质量规则和 allowlist。
- 多发布通道预留落地，例如 stable、beta、dev。

### v2.0 建议范围

- 官方或社区 Registry。
- 团队共享空间。
- 策略化分发。
- 技能评分、签名、信任链。
- 对更多 Agent 的适配器。
- WebDAV、Git 或同步文件夹备份。

## 开放问题

当前无阻塞 MVP 的产品/架构开放问题。

## 执行约定

### Codex 路径指导

首版不自动探测 Codex 路径，只展示常见路径并让用户手动填写：

- `$CODEX_HOME/skills`
- Windows：`%USERPROFILE%\.codex\skills`
- macOS/Linux：`~/.codex/skills`
- 自定义目录：用户可以填写任意绝对路径。

### Cloudflare 资源命名

- Web 控制台：`app.5kill5.xyz`
- API：`api.5kill5.xyz`
- Worker：`5kill5-api-prod`、`5kill5-api-preview`
- D1：`5kill5_prod`、`5kill5_preview`
- R2：`5kill5-skills-prod`、`5kill5-skills-preview`

### 迁移阈值

任一条件满足即启动迁移到自有服务器的技术评估：

- Cloudflare 月成本连续 2 个月超过 200 美元。
- MAU 超过 5000。
- API p95 延迟连续 7 天超过 800ms。
- D1 数据超过 1GB。
- R2 对象存储超过 100GB。
- D1/Workers 平台限制阻塞核心功能。
