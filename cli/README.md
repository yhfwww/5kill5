# 5KILL5 CLI

5KILL5 Skill Manager CLI - A Python-based tool for managing AI skills.

## 安装

### 前置要求

- Python 3.10 或更高版本
- pip 包管理器

### Windows 安装

#### 方式一：通过 pip 安装（推荐）

```powershell
# 从项目目录安装（开发模式）
cd cli
pip install -e .

# 验证安装
fivekill5 --help
```

#### 方式二：使用 venv 虚拟环境

```powershell
# 创建虚拟环境
python -m venv venv
.\venv\Scripts\Activate

# 安装依赖
cd cli
pip install -e .

# 使用完成后退出
deactivate
```

### Linux / macOS 安装

#### 方式一：通过 pip 安装（推荐）

```bash
# 从项目目录安装（开发模式）
cd cli
pip install -e .

# 验证安装
fivekill5 --help
```

#### 方式二：使用 venv 虚拟环境

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
cd cli
pip install -e .

# 使用完成后退出
deactivate
```

### 从 PyPI 安装（未来版本）

待发布到 PyPI 后，可以直接安装：

```bash
pip install fivekill5
```

## 快速开始

### 0. 一键测试（推荐）

项目提供了测试脚本，可以快速验证所有功能：

**Linux / macOS:**
```bash
cd cli
./test-cli.sh
```

**Windows:**
```cmd
cd cli
test-cli.bat
```

### 1. 查看帮助

```bash
# 查看主帮助
fivekill5 --help

# 查看子命令帮助
fivekill5 auth --help
fivekill5 apply --help
```

### 2. 配置基础环境

```bash
# 设备注册
fivekill5 device register --name my-laptop

# 设置目标路径
fivekill5 targets set --agent codex --path ~/.codex/skills

# 认证登录
fivekill5 auth login
```

### 3. 使用示例 manifest

项目自带 demo 示例：

```bash
# 查看示例 manifest
fivekill5 profiles --manifest /workspace/fixtures/demo-release.json

# 预览部署计划
fivekill5 plan --manifest /workspace/fixtures/demo-release.json --target /tmp/my-skills

# 执行部署（自动确认）
fivekill5 apply --manifest /workspace/fixtures/demo-release.json --target /tmp/my-skills --yes

# 查看状态
fivekill5 status --target /tmp/my-skills

# 回滚
fivekill5 rollback --target /tmp/my-skills
```

## 完整命令列表

| 命令 | 说明 |
|------|------|
| `fivekill5 auth login` | 设备登录认证 |
| `fivekill5 auth status` | 查看认证状态 |
| `fivekill5 device register` | 注册设备 |
| `fivekill5 targets set` | 设置目标路径 |
| `fivekill5 profiles` | 列出 profiles |
| `fivekill5 pull` | 拉取并缓存 manifest |
| `fivekill5 plan` | 预览部署计划 |
| `fivekill5 apply` | 执行部署 |
| `fivekill5 status` | 查看部署状态 |
| `fivekill5 rollback` | 回滚上次部署 |
| `fivekill5 cache clear` | 清除缓存 |

## 项目结构

```
cli/
├── pyproject.toml          # 项目配置
├── README.md               # 本文档
├── test-cli.sh             # Linux/macOS 测试脚本
├── test-cli.bat            # Windows 测试脚本
└── src/fivekill5/
    ├── __init__.py         # 版本信息
    ├── manifest.py         # ReleaseManifest/SkillFile 解析
    ├── quality.py          # 质量扫描规则
    ├── distribution.py     # Plan/Apply/Rollback 机制
    └── cli.py              # Typer 命令行接口
```

## 开发指南

### 安装开发依赖

```bash
cd cli
pip install -e .[dev]  # 若配置了开发依赖
```

### 运行测试

（待实现单元测试）

### 代码格式检查

（可添加 flake8/black/ruff 配置）

## 打包发布

### 构建 wheel 包

```bash
cd cli
pip install build
python -m build
```

产物会生成在 `dist/` 目录下：
- `fivekill5-0.1.0-py3-none-any.whl` - Wheel 包
- `fivekill5-0.1.0.tar.gz` - 源码包

### 上传到 PyPI

```bash
pip install twine
twine upload dist/*
```

### 提供二进制分发

#### 使用 PyInstaller 打包为可执行文件

Windows:
```bash
pip install pyinstaller
cd cli
pyinstaller --onefile --name fivekill5 src/fivekill5/cli.py
```

Linux/macOS:
```bash
pip install pyinstaller
cd cli
pyinstaller --onefile --name fivekill5 src/fivekill5/cli.py
```

可执行文件将在 `dist/` 目录下。

## 配置文件位置

CLI 会在以下位置查找/创建配置：

| 环境变量 | 默认位置（Windows） | 默认位置（Linux/macOS） |
|---------|---------------------|------------------------|
| `FIVEKILL5_HOME` | `%LOCALAPPDATA%\5kill5` | `~/.config/5kill5` |

## 常见问题

### Q: 命令提示找不到 fivekill5？

A: 确保已正确安装并且 Python 的 Scripts/bin 目录在 PATH 中。尝试：
```bash
python -m fivekill5.cli --help
```

### Q: 权限问题？

A: 使用虚拟环境或 `--user` 标志安装：
```bash
pip install -e . --user
```

## License

（待补充）
