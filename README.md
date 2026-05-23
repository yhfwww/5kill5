# 5KILL5

5KILL5 是一个云端 Skill 组合管理器和 CLI 同步客户端，用来把私有 AI skills 管理成可发布、可审计、可分发到多设备和多 Agent 的工具箱。

当前仓库已经按 `docs/` 中的需求和技术方案落下 MVP 工程：

- `apps/web`：无需依赖安装的 Web 控制台预览。
- `services/api`：Cloudflare Workers API 骨架。
- `migrations`：D1 数据库 schema。
- `crates/5kill5-core`：Rust 核心库，包含质量闸门、manifest、plan/apply/rollback。
- `crates/5kill5-cli`：Rust CLI。

## 本地预览

```powershell
& 'C:\Users\yhf\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' apps\web\server.mjs
```

终止：
```
# 或终止特定端口（如 5173）的进程
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

打开 `http://127.0.0.1:5173`。

如果本机 Node/npm 可用，也可以运行：

```bash
npm run web:dev
```

## CLI 示例

```bash
cargo build -p 5kill5
5kill5 plan --manifest fixtures/demo-release.json --target ./tmp-skills
5kill5 apply --manifest fixtures/demo-release.json --target ./tmp-skills --yes
5kill5 status --target ./tmp-skills
```

更多实现说明见 `docs/mvp-implementation.md`。
