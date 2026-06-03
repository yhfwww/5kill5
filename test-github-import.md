# GitHub 导入功能 - 测试用例

## 测试用例列表

### 1. 基本功能测试

**测试用例 1.1：使用 mvanhorn/last30days-skill**
```
仓库: mvanhorn/last30days-skill
路径: skills/last30days
分支: main
```

**测试用例 1.2：使用示例仓库**
```
仓库: yhfwww/5kill5-skills
路径: 测试的技能包
分支: main
```

### 2. URL 格式测试

**测试用例 2.1：完整 GitHub URL**
```
输入: https://github.com/mvanhorn/last30days-skill/tree/main/skills/last30days
```

**测试用例 2.2：简缩路径格式**
```
仓库: mvanhorn/last30days-skill
路径: skills/last30days
```

### 3. 边界情况测试

**测试用例 3.1：不存在的仓库**
```
仓库: some-nonexistent/repo
期望: 404 错误，友好提示
```

**测试用例 3.2：不存在的路径**
```
仓库: mvanhorn/last30days-skill
路径: skills/nonexistent-skill
期望: 404 错误
```

**测试用例 3.3：没有 SKILL.md 的目录**
```
仓库: mvanhorn/last30days-skill
路径: scripts
期望: 提示没有找到 SKILL.md
```

### 4. 编码测试

**测试用例 4.1：中文路径**
```
仓库: yhfwww/5kill5-skills
路径: 测试的技能包/req-clarifier
```

## 测试步骤

### 通用测试流程
1. 打开 Web 控制台 http://127.0.0.1:5173
2. 点击 "+" 按钮
3. 选择 "GitHub Repository"
4. 输入参数并测试

### 成功导入验证
- 预览显示文件列表
- 点击 "Import" 成功导入
- Skill 显示在列表中
- 可以查看 Skill 内容
- Quality Check 有结果

## 预期结果

### 成功场景
- 显示文件数量
- 列出 SKILL.md 及相关文件
- 导入按钮启用
- 导入后 Skill 正常解析

### 失败场景
- 403: 显示友好的速率限制提示
- 404: 显示找不到仓库/路径
- 无 SKILL.md: 提示找不到文件

## 注意事项

1. **GitHub API 速率限制**（未认证每小时 60 请求）- 已实现自动降级到 Raw URL
2. **大文件可能获取失败但会继续**
3. **中文路径需要正确 URL 编码**（已实现）
4. **需要 User-Agent 请求头**（已添加）

## 降级机制

当遇到 GitHub API 速率限制（HTTP 403）时：
- 自动降级使用 GitHub Raw URL 获取 SKILL.md
- 仅获取主 SKILL.md 文件，其他辅助文件（scripts、assets、references）将不可用
- 界面会显示橙色提示告知用户

## 调试技巧

### 查看浏览器控制台
打开 Chrome DevTools (F12) 查看 console 中的错误信息

### 检查网络请求
在 Network 标签中查看 API 请求是否成功

### 使用测试仓库
优先使用 mvanhorn/last30days-skill，这是稳定的公开仓库
