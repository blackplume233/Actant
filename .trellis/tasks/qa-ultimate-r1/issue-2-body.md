## 测试发现

**场景**: ultimate-real-user-journey
**步骤**: p15-edge-overwrite-2

## 复现方式

```bash
set ACTANT_HOME=%TEMP%\ac-qa-test
actant daemon start --foreground
actant agent create overwrite-test -t qa-cursor-tpl
actant agent create overwrite-test -t qa-cursor-tpl --overwrite
```

## 期望行为

第二次创建时 `--overwrite` 参数应移除已有实例目录并重新创建。

## 实际行为

```
[RPC -32002] Instance directory "overwrite-test" already exists
Context: {"validationErrors":[{"path":"name","message":"Directory already exists: ..."}]}
```

## 分析

`--overwrite` 选项的帮助文本为 "If work-dir exists, remove it and recreate"，明确只适用于 `--work-dir` 场景。当不指定 `--work-dir` 时（使用 builtin 实例目录），`--overwrite` 参数被静默忽略。

建议：
1. 要么让 `--overwrite` 也适用于 builtin 实例目录
2. 要么当 `--overwrite` 在非 `--work-dir` 场景使用时输出警告
