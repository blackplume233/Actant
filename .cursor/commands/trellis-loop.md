读取 `.agents/skills/codex-loop/SKILL.md`，并使用 `./.trellis/scripts/multi-agent/codex-loop-live.sh` 作为默认执行入口。

执行规则：

1. 先按技能定义补齐 `--name`、`--type`、`--requirement`
2. 默认先跑一次 `--dry-run` 确认 task / branch / worktree / verify mode
3. 确认后使用 live 包装脚本正式执行或续跑
4. 整个 loop 期间必须持续把进度回报到当前界面，不允许静默运行

如果用户只是想创建/修改技能定义而不是实际执行 loop，只更新技能文件，不运行脚本。
