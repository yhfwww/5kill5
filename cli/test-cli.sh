#!/bin/bash

# 5KILL5 CLI 快速测试脚本
# 使用方法: ./test-cli.sh

set -e

echo "=== 5KILL5 CLI 快速测试 ==="
echo ""

# 检查是否已安装
if ! command -v fivekill5 &> /dev/null; then
    echo "错误: fivekill5 命令未找到，请先安装"
    echo "运行: cd cli && pip install -e ."
    exit 1
fi

echo "1. 检查 CLI 版本..."
fivekill5 --help
echo "✓ CLI 可用"
echo ""

echo "2. 测试 profiles 命令..."
fivekill5 profiles --manifest /workspace/fixtures/demo-release.json
echo "✓ profiles 命令正常"
echo ""

# 创建临时目录
TEST_DIR=$(mktemp -d -t fivekill5-test-XXXXXX)
echo "3. 创建测试目录: $TEST_DIR"

echo "4. 测试 plan 命令..."
fivekill5 plan --manifest /workspace/fixtures/demo-release.json --target "$TEST_DIR"
echo "✓ plan 命令正常"
echo ""

echo "5. 测试 apply 命令..."
fivekill5 apply --manifest /workspace/fixtures/demo-release.json --target "$TEST_DIR" --yes
echo "✓ apply 命令正常"
echo ""

echo "6. 测试 status 命令..."
fivekill5 status --target "$TEST_DIR"
echo "✓ status 命令正常"
echo ""

echo "7. 测试 rollback 命令..."
fivekill5 rollback --target "$TEST_DIR"
echo "✓ rollback 命令正常"
echo ""

# 清理
echo "8. 清理测试目录..."
rm -rf "$TEST_DIR"
echo "✓ 清理完成"
echo ""

echo "=== 所有测试通过！==="
echo ""
echo "下一步："
echo "  fivekill5 --help          # 查看完整帮助"
echo "  fivekill5 auth login      # 设备登录"
echo "  fivekill5 device register # 注册设备"
