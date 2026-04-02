# Environment Configuration

## Windows

```powershell
$TEST_DIR = "$env:TEMP\ac-qa-rN-<random>"
$PIPE_ID = "actant-qa-rN-<random>"
$env:ACTANT_HOME = $TEST_DIR
$env:ACTANT_SOCKET = "\\.\pipe\$PIPE_ID"
$env:ACTANT_LAUNCHER_MODE = "mock"  # 仅当 --mock 时
```

## Unix/macOS

```bash
TEST_DIR=$(mktemp -d -t ac-qa-XXXXXX)
export ACTANT_HOME="$TEST_DIR"
export ACTANT_SOCKET="$TEST_DIR/actant.sock"
export ACTANT_LAUNCHER_MODE="mock"  # 仅当 --mock 时
```

## CLI 命令执行

所有 CLI 命令通过以下方式执行：

```
node <project_root>/packages/cli/dist/bin/actant.js <command>
```

## 注意事项

- **环境隔离最高优先级** — 每轮测试必须创建新的临时目录，绝不复用
- **精确传递环境变量** — 委托 SubAgent 时，必须传递实际路径值而非变量引用（因为 SubAgent 在不同 shell 上下文中）
- **Windows 兼容** — `ACTANT_SOCKET` 使用命名管道 `\\.\pipe\<id>`，PIPE_ID 每轮随机生成
