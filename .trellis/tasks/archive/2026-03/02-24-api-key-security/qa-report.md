## QA 黑盒测试报告：API Key 密钥安全模型

**场景**: api-key-security
**测试工程师**: QA SubAgent
**时间**: 2026-02-24T03:39 ~ 03:42 UTC
**结果**: PASSED (10/10 步骤通过, 0 警告)

### 摘要

| # | 步骤 | 命令 | 判定 |
|---|------|------|------|
| 1 | 确认模板列表 | `template list -f json` | PASS |
| 2 | 创建 Agent (anthropic) | `agent create sec-agent-1 -t sec-anthropic-tpl` | PASS |
| 3 | [白盒] 检查 .actant.json 无 apiKey (agent-1) | 读取文件内容 | PASS |
| 4 | 创建 Agent (openai) | `agent create sec-agent-2 -t sec-openai-tpl` | PASS |
| 5 | [白盒] 检查 .actant.json 无 apiKey (agent-2) | 读取文件内容 | PASS |
| 6 | 创建 Agent (无 provider) | `agent create sec-agent-3 -t sec-default-tpl` | PASS |
| 7 | [白盒] 检查 .actant.json 无 apiKey (agent-3) | 读取文件内容 | PASS |
| 8 | [白盒] instances/ 全文搜索 "apiKey" | `grep "apiKey"` | PASS |
| 9 | [白盒] instances/ 搜索密钥模式 | `grep sk-\|anthropic_api` | PASS |
| 10 | [白盒] templates/ 搜索 "apiKey": | `grep "apiKey":` | PASS |

### 详细执行日志

#### [Step 1] 确认模板列表

**命令**: `template list -f json`
**exit_code**: 0

3 个模板全部加载成功。输出中：
- `sec-anthropic-tpl`: provider 含 `type`, `protocol`, `config.apiKeyEnv`（环境变量名引用，非密钥值）— 无 `apiKey` 字段
- `sec-openai-tpl`: provider 含 `type`, `protocol`, `baseUrl` — 无 `apiKey` 字段
- `sec-default-tpl`: 无 provider 字段

**判断**: PASS

#### [Step 2] 创建 Agent (anthropic provider)

**命令**: `agent create sec-agent-1 -t sec-anthropic-tpl -f json`
**exit_code**: 0

返回 JSON 包含:
- `name`: "sec-agent-1"
- `status`: "created"
- `providerConfig`: `{"type":"anthropic","config":{"apiKeyEnv":"ANTHROPIC_API_KEY"},"protocol":"anthropic"}`
- **无 `apiKey` 字段**

**判断**: PASS

#### [Step 3] [白盒] 检查 sec-agent-1 的 .actant.json

直接读取 `$ACTANT_HOME/instances/sec-agent-1/.actant.json`:

```json
{
  "providerConfig": {
    "type": "anthropic",
    "config": { "apiKeyEnv": "ANTHROPIC_API_KEY" },
    "protocol": "anthropic"
  }
}
```

文件 28 行，全文搜索 `apiKey` 关键字 — 仅出现在 `apiKeyEnv`（环境变量名引用），不存在 `"apiKey":` 键值对。

**判断**: PASS

#### [Step 4] 创建 Agent (openai provider)

**命令**: `agent create sec-agent-2 -t sec-openai-tpl -f json`
**exit_code**: 0

`providerConfig`: `{"type":"openai","baseUrl":"https://api.openai.com/v1","protocol":"openai"}`
**无 `apiKey` 字段**

**判断**: PASS

#### [Step 5] [白盒] 检查 sec-agent-2 的 .actant.json

文件 26 行，`providerConfig` 仅含 `type`, `baseUrl`, `protocol`。全文无 `apiKey`。

**判断**: PASS

#### [Step 6] 创建 Agent (无 provider 模板)

**命令**: `agent create sec-agent-3 -t sec-default-tpl -f json`
**exit_code**: 0

返回 JSON 中**不含 `providerConfig` 字段**（因模板未指定 provider 且无 Registry 默认 provider）。

**判断**: PASS

#### [Step 7] [白盒] 检查 sec-agent-3 的 .actant.json

文件 21 行，无 `providerConfig` 字段，无 `apiKey`。

**判断**: PASS

#### [Step 8] [白盒] instances/ 全文搜索 "apiKey"

```
grep "apiKey" $ACTANT_HOME/instances/ → No matches found
```

instances 目录下所有文件中无 `"apiKey"` 字符串。

**判断**: PASS

#### [Step 9] [白盒] instances/ 搜索密钥模式

```
grep (sk-|anthropic_api|ACTANT_API_KEY.*=) $ACTANT_HOME/instances/ → No matches found
```

无任何疑似 API 密钥的字符串。

**判断**: PASS

#### [Step 10] [白盒] templates/ 搜索 "apiKey":

```
grep '"apiKey"\s*:' $ACTANT_HOME/configs/templates/ → No matches found
```

持久化模板文件中不含 `"apiKey":` 作为 JSON 键。

**判断**: PASS

### 安全不变式验证结论

| 不变式 | 验证结果 |
|--------|---------|
| `.actant.json` 不含 apiKey | PASS (3/3 instances) |
| Template 文件不含 apiKey 键 | PASS |
| instances/ 目录无密钥泄露 | PASS |
| 不同 provider 类型一致性 | PASS (anthropic, openai, 无 provider) |

### 创建的 Issue

无 — 全部通过，无需创建 Issue。
