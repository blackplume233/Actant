读取 `.agents/skills/qa-monitor/SKILL.md` 并按其流程启动 QA 持续监测循环：记录基线 HEAD → 构建 → 初始测试 → 轮询（10 分钟间隔检查新 commit，有变化则重建+完整回归，无变化则继续休眠）。
