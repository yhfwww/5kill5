# 5KILL5 产品决策记录

整理时间：2026-05-17

## 已确认决策

| 编号 | 决策项 | 结论 |
|---|---|---|
| D1 | 初始版产品形态 | 云端 Web 控制台 + CLI 客户端 |
| D2 | Skill 组合模型 | `Skill + Pack + Profile` |
| D3 | 同步方式 | CLI 主动 `pull/apply` |
| D4 | 云端事实源 | 云端数据库管理元数据和组合，文件存对象存储，CLI 本地缓存 |
| D5 | 分发粒度 | 按账号 + 设备 + Agent + 任务 Profile 分发 |
| D6 | 发布机制 | 草稿/发布版，客户端只同步发布版，预留 stable/beta/dev 多通道 |
| D7 | CLI 鉴权 | Device Code 登录 + scoped token |
| D8 | 首批 Agent 适配 | Codex + 通用目录起步 |
| D9 | Marketplace | 初始版本不做 Marketplace，只支持私有 Skill/Pack |
| D10 | 团队能力 | 个人账号优先，数据模型预留团队 |
| D11 | 开源/商业策略 | 开源 CLI + 商业云 |
| D12 | GUI 时间点 | `v1.0.0` 稳定版本上桌面 GUI |
| D13 | 云端技术栈 | 先用 Cloudflare Workers + D1 + R2 低成本验证，有效果后再迁移到自有服务器 |
| D14 | 云端部署形态 | 只做官方托管云 |
| D15 | 数据隔离模型 | 个人账号 + 预留 workspace/team 字段 |
| D16 | Skill Manifest 最小字段 | 使用较完整字段：`name`、`version`、`description`、`tags`、`triggers`、`compatibility`、`risk_level`、`author`、`license`；部分字段首版只预留不做完整功能 |
| D17 | Codex Adapter 适配深度 | 重点是把云端 Skill 组合同步到用户指定路径；初始版本不自动探测，提供常见路径指导并让用户手动填写 |
| D18 | 本地分发策略 | 默认复制，避免权限问题；后续可提供 symlink/Junction 作为高级策略 |
| D19 | 冲突处理默认策略 | 默认跳过并报冲突 |
| D20 | 发布机制细节 | Skill、Pack、Profile 都要单独发布 |
| D21 | CLI Token 权限范围 | token 只读发布版 + 上报 apply 状态 |
| D22 | 云端 Skill 内容存储 | 初始版本云端保存完整 Skill 内容，优先降低实现复杂度 |
| D23 | 导入入口 | 只允许从用户上传文件/ZIP 或指定来源导入；MVP 先做 Web 上传 `SKILL.md`/ZIP，CLI scan/upload 后续跟进 |
| D24 | CLI 首发平台 | Windows/macOS/Linux 同时首发，Windows 做重点验收 |
| D25 | Codex Adapter 默认路径策略 | 初始版本指导用户找到常用路径，只让用户手动填写目标路径 |
| D26 | Profile 的任务场景粒度 | 按 Agent + 任务场景起步，预留按项目目录细分 |
| D27 | Web 控制台首版内容能力 | 不提供 Skill 内容编辑器，只提供只读 Markdown 预览和元数据/组合管理 |
| D28 | 质量闸门首版强度 | 格式错误阻止发布，安全风险只警告 |
| D29 | 发布操作体验 | 支持逐个发布，也支持一键发布依赖链 |
| D30 | CLI apply 默认确认 | 每次 apply 前必须确认 |
| D31 | 5KILL5 管理文件更新策略 | 先校验旧文件 hash，匹配才更新，不匹配则冲突 |
| D32 | 云端历史版本保存 | 永久保存所有发布版本 |
| D33 | 账号注册方式 | 邮箱验证码 |
| D34 | MVP 收费策略 | 免费内测起步，预留免费额度 + 付费高级额度 |
| D35 | 云端内容隐私提示 | 明确隐私页：不要上传密钥/敏感信息，内容用于同步不用于训练 |
| D36 | 迁移到自有服务器触发条件 | 成本、性能、容量、平台限制达到阈值后迁移 |
| D37 | Codex 常见路径指导 | 展示 `$CODEX_HOME/skills`，Windows 默认 `%USERPROFILE%\.codex\skills`，macOS/Linux 默认 `~/.codex/skills`，并提示用户可填写任意自定义目录 |
| D38 | Cloudflare 资源命名 | Web: `app.5kill5.xyz`，API: `api.5kill5.xyz`；Workers: `5kill5-api-prod`/`5kill5-api-preview`；D1: `5kill5_prod`/`5kill5_preview`；R2: `5kill5-skills-prod`/`5kill5-skills-preview` |
| D39 | CLI/云端许可证边界 | 公开 CLI 继续使用 GPL-3.0；云端服务端闭源商业，放独立私有仓库；公开 API 文档和协议描述可单独用宽松许可证发布 |
| D40 | 迁移阈值具体数字 | 任一条件触发迁移评估：Cloudflare 月成本连续 2 个月超过 200 美元；MAU 超过 5000；API p95 延迟连续 7 天超过 800ms；D1 数据超过 1GB 或 R2 对象存储超过 100GB；D1/Workers 限制阻塞核心功能 |
| D41 | AI 辅助能力 | 5KILL5 不是 Skill 创作平台，不提供 AI 辅助改写、修复或生成 Skill，也不调用第三方模型 API 处理用户 Skill 内容 |

## 核心模型定义

### Skill

单个技能，最小可复用单位。通常对应一个 `SKILL.md` 以及相关 assets。

### Pack

技能组合包，将多个 Skill 组合成一个可复用工具箱。

示例：`Codex 编程套装` = `code-review` + `bug-fix` + `test-writer`。

### Profile

分发配置，描述某个账号、设备、Agent、任务场景应该启用哪些 Pack。

示例：`我的 Windows 笔记本 / Codex / 前端项目` 使用 `Codex 编程套装`。

## 初始版本边界

初始版本必须完成：

1. 云端 Web 控制台。
2. 账号体系和 Device Code 登录。
3. Skill、Pack、Profile 管理。
4. 草稿/发布版机制。
5. CLI 登录、设备注册、拉取、预览、应用、回滚。
6. Codex 和通用目录适配，目标路径由用户手动填写。
7. Cloudflare Workers + D1 + R2 官方托管云。
8. 默认复制式本地分发。
9. Web 上传 `SKILL.md`/ZIP 导入。
10. 只读 Markdown 预览。
11. Skill 元数据、Pack、Profile 管理。
12. 邮箱验证码注册。
13. 隐私提示页。

初始版本明确不做：

1. 桌面 GUI。
2. 公开 Marketplace。
3. 团队权限和组织空间。
4. GitHub 第三方安装。
5. WebDAV/Git/同步文件夹备份。
6. CLI scan/upload。
7. 完整安全风险治理和风险评分自动化。
8. 自动探测 Codex 默认路径。
9. 付费能力。
10. 在平台内写作、编辑、改写、修复或生成 Skill 内容。
11. 调用第三方模型 API 处理用户 Skill 内容。

## 仍需决策

当前无阻塞 MVP 的产品/架构决策。
