# PROJECT_STATE.md
> 本文件由 changelog-keeper skill 维护，反映项目**当前**状态快照。
> 每次重大变更后自动更新（覆盖写入，非追加）。

---

## ⚡ 新 Session Agent — 从这里开始

> 你是这个项目的新接手 Agent，请在做任何事之前先读完本节。

**第一步（必须）**：读完本文件的全部内容，了解项目当前状态。
**第二步（按需）**：读取 `CHANGELOG_FOR_AGENT.md` 最近 3-5 条记录，了解项目最近的演进轨迹。
**第三步**：在你的第一条回复中，用一句话确认你已理解当前状态，例如：
> 「已读取项目状态。当前处于 [阶段]，上次未完成的任务是 [任务]，我从这里继续。」

⚠️ 不要跳过以上步骤。跳过会导致你重复已完成的工作，或无意中破坏已有的设计决策。

---

_最后更新：2026-06-03_

---

## 项目概览

- **项目名称**：5KILL5（吾 skills）
- **技术栈**：前端纯 HTML/JS/CSS + Rust CLI/Core + Python CLI + Cloudflare Workers/D1/R2（API 骨架）
- **项目阶段**：🚧 早期开发（MVP 验证中）

## 当前目录结构（核心文件）

```
5kill5/
├── apps/
│   └── web/                    # Web 控制台（纯前端 localStorage）
│       ├── app.js              # 核心逻辑（~1600 行）
│       ├── index.html          # 页面结构
│       ├── styles.css          # 样式
│       └── server.mjs          # Node.js HTTP 服务器（端口 5173）
├── cli/                        # Python CLI（fivekill5）
│   ├── src/fivekill5/          # Typer + Rich 实现
│   ├── pyproject.toml
│   └── README.md
├── crates/
│   ├── 5kill5-core/            # Rust 核心库（质量扫描、manifest、plan/apply/rollback）
│   └── 5kill5-cli/             # Rust CLI（存档，已被 Python CLI 替代）
├── docs/                       # 设计文档
├── services/api/               # Cloudflare Workers API 骨架（未与 Web 控制台集成）
├── migrations/                 # D1 Schema
├── agent.md                    # Agent 指南
└── README.md
```

## 核心模块状态

| 模块 | 状态 | 说明 |
|------|------|------|
| Web 控制台 | ✅ 可用 | 纯前端 localStorage，支持技能导入/删除/标签编辑/GitHub 导入/ZIP上传 |
| Python CLI | ✅ 可用 | Typer + Rich，支持 manifest 解析、质量检查、plan/apply/rollback |
| Rust CLI | 📦 存档 | 保留代码，不再主动开发 |
| Cloudflare API | 🏗️ 骨架 | 有 D1 Schema 和 Workers 代码，但未与 Web 控制台集成 |
| D1 数据库 | 📋 设计完成 | 14 张表 Schema 已定义，未部署 |

## 已知问题 & 技术债

- localStorage 存储有 ~5MB 限制，大量 ZIP 上传可能导致溢出
- GitHub API 速率限制（60 req/hour 未认证），降级方案只能获取 SKILL.md，附属文件不可用
- Web 控制台与 Cloudflare API 未集成，数据仅存浏览器本地
- `createSkillFromGitHub()` 和 `createSkillFromZipFile()` 的 `source` 字段结构不统一
- 没有数据导出功能，清除浏览器数据 = 丢失所有数据

## 上次 Session 未完成的任务

- 无明确未完成任务

## 关键设计决策记录

- **Rust CLI → Python CLI**：用户更熟悉 Python，保留 Rust 代码作为存档
- **tags → officialTags/userTags**：官方标签来自 SKILL.md 不可编辑，用户标签可自由增删
- **.skill = .zip**：.skill 扩展名只是语义化，本质是 ZIP 文件，用 JSZip 解析
- **栈式 YAML 解析**：自写解析器而非引入完整 YAML 库，保持零依赖（除 JSZip 外）
- **质量检查规则放宽**：不再强制 ## Trigger/## Steps，因为业界 Skill 规范无此要求
