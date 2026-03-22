# Create Changelog Draft

为 ship / merge 级交付生成标准 changelog draft。

## 用法

```bash
./.trellis/scripts/create-changelog-draft.sh --topic <topic> --title "<Title>"
```

常用示例：

```bash
./.trellis/scripts/create-changelog-draft.sh --topic m7-bootstrap --title "M7 Bootstrap"
./.trellis/scripts/create-changelog-draft.sh --topic governance-repair --title "Trellis Governance Repair"
```

## 结果

脚本会在 `docs/agent/changelog-drafts/` 下生成：

- 文件名：`YYYY-MM-DD-<agent>-<topic>.md`
- 结构：标题、变更摘要、用户可见影响、破坏性变更/迁移说明、验证结果、关联 PR / Commit / Issue

如果文件已存在，脚本会拒绝覆盖；需要显式传 `--force`。
