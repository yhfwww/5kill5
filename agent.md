# 5KILL5 Agent Guide

## 项目概述

5KILL5 是一个云端 Skill 组合管理器和 CLI 同步客户端，用于将私有 AI skills 管理成可发布、可审计、可分发到多设备和多 Agent 的工具箱。

## 项目结构

```
/workspace
├── Cargo.toml              # Workspace 配置
├── package.json             # Node 脚本
├── apps/web/                # Web 控制台预览
├── services/api/            # Cloudflare Workers API 骨架
├── migrations/              # D1 数据库 schema
├── crates/
│   ├── 5kill5-core/         # Rust 核心库
│   └── 5kill5-cli/           # Rust CLI
├── docs/                    # 需求和技术文档
└── fixtures/                # 测试数据
```

## 核心库 (5kill5-core)

### 模块

- **manifest**: `ReleaseManifest` 和 `SkillFile` 结构体，负责解析 JSON manifest
- **quality**: Skill 质量扫描，支持多种规则检测
- **distribution**: Plan/Apply/Rollback 机制

### 关键类型

```rust
// manifest.rs
ReleaseManifest { release_id, profile_name, agent_type, task_context, strategy, target_path_hint, skills }
SkillFile { skill_id, version_id, name, sha256, content }

// quality.rs
Severity: Blocker, High, Medium, Low
Finding: { severity, rule_id, line_start, line_end, message, recommendation }
QualityReport: { status, score, findings }

// distribution.rs
DistributionAction: Add, Update, Skip, Conflict
PlannedSkill: { action, skill_name, target_file, reason }
DistributionPlan: { release_id, target_dir, items }
```

## CLI (5kill5-cli)

### 命令

| 命令 | 说明 |
|------|------|
| `5kill5 auth login` | 设备登录认证 |
| `5kill5 auth status` | 查看认证状态 |
| `5kill5 device register --name <name>` | 注册设备 |
| `5kill5 targets set --agent <agent> --path <path>` | 设置目标路径 |
| `5kill5 profiles --manifest <path>` | 列出 profiles |
| `5kill5 pull --profile <profile> --manifest <path>` | 拉取 manifest |
| `5kill5 plan --manifest <path> --target <dir>` | 预览部署计划 |
| `5kill5 apply --manifest <path> --target <dir> [--yes]` | 执行部署 |
| `5kill5 status --target <dir>` | 查看部署状态 |
| `5kill5 rollback --target <dir>` | 回滚上一次部署 |
| `5kill5 cache clear` | 清除缓存 |

### 构建和运行

```bash
cargo build -p 5kill5
./target/debug/5kill5 help
```

## 质量扫描规则 (quality.rs)

### 阻塞级 (Blocker)
- 缺少 `name` 或 `version` frontmatter
- 无效的 SemVer 版本号
- 缺少 `## Trigger` 或 `## Steps` 段落

### 高危级 (High)
- 检测到密钥模式 (sk-, ghp_, github_pat_, AKIA, xoxb-)
- 破坏性命令 (rm -rf /, git reset --hard, format c: 等)
- 远程脚本执行 (curl/wget | sh)

### 中危级 (Medium)
- Prompt injection 模式

### 计分规则
- Blocker: -45
- High: -25
- Medium: -12
- Low: -5
- 分数 ≤ 0 时 status 为 "blocked"

## 部署机制 (distribution.rs)

### Plan 阶段
- 比较本地文件与 manifest 中的 sha256
- 决定 Add/Update/Skip/Conflict

### Apply 阶段
- 创建 `.5kill5/history/<timestamp>/` 备份目录
- 备份被覆盖的文件
- 写入新内容到 `SKILL.md`
- 生成 `.5kill5.json` 状态文件
- 记录 rollback.tsv

### Rollback 阶段
- 读取 `.5kill5/history/` 下最新的备份
- 根据 rollback.tsv 恢复文件或删除新增文件

## 开发命令

```bash
# Web 预览
npm run web:dev

# 验证
npm run web:validate
npm run web:validate:i18n

# 测试
cargo test -p 5kill5-core
cargo test -p 5kill5-cli
```

## 注意事项

1. CLI 使用 `--yes` 参数跳过确认提示
2. 冲突检测：本地文件被修改且非 5KILL5 管理时会拒绝覆盖
3. 应用数据目录优先级：FIVEKILL5_HOME > LOCALAPPDATA > HOME > USERPROFILE
