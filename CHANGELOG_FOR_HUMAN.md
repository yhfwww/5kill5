# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [0.2.0] - 2026-06-03

### Added
- 支持 .zip 和 .skill 文件上传，自动解压并识别 SKILL.md 及附属文件（scripts、references、assets）
- 支持从 SKILL.md 的深层嵌套结构（如 metadata.openclaw.tags）中提取标签
- 导入预览中显示解析出的技能名称、版本、描述、作者和标签
- 已导入技能支持删除功能
- 区分官方标签（只读，来自 SKILL.md）和用户自定义标签（可编辑）
- Python CLI（fivekill5）：基于 Typer + Rich 重构，支持 Windows 和 Linux

### Changed
- 重写 YAML 解析器，支持任意层级嵌套（之前只能解析一层）
- 质量检查规则调整：不再强制要求 ## Trigger 和 ## Steps 章节，改为检查是否存在任意章节标题
- GitHub 导入的 URL 编码修复，解决含中文路径的仓库无法获取的问题

### Fixed
- 修复页面显示崩溃：旧数据中缺少 officialTags/userTags 字段导致渲染失败
- 修复二进制文件上传时的 btoa 编码错误
- 修复 GitHub API 速率限制时降级获取 SKILL.md 的 URL 编码问题

### Dependencies
- 新增：JSZip 3.10.1（CDN）— 用于解析 .zip/.skill 文件

## [0.1.0] - 2026-05-17

### Added
- Web 控制台：纯前端技能管理界面，支持中英文切换
- Rust 核心库：质量扫描、manifest 解析、plan/apply/rollback
- Rust CLI：auth、device、pull、plan、apply、status、rollback
- Cloudflare Workers API 骨架
- D1 数据库 Schema（14 张表）
- 设计文档：需求规格、技术方案、产品决策、MVP 实现说明
