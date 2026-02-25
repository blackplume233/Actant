# QA Round 9 - 完整回归测试日志
**时间**: 2026-02-25
**HEAD**: 6aa2be5
**触发**: 新 ship (#159 hooks + event bus)
**前轮**: R7/R8 BUILD FAIL, R6 = 49/50 98%

---

## Phase A: 基础设施 (1-5)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 1 | daemon status -f json | PASS | running: true, agents: 0 |
| 2 | template list | PASS | rw-basic-tpl, rw-claude-tpl |
| 3 | agent list -f json | PASS | [] |
| 4 | skill list | PASS | No skills loaded |
| 5 | plugin list | PASS | No plugins loaded |

## Phase B: 边界错误 (6-13)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 6 | agent status nonexistent-agent | PASS | exit 1, RPC -32003 not found |
| 7 | agent start nonexistent-agent | PASS | exit 1, not found |
| 8 | agent stop nonexistent-agent | PASS | exit 1, not found |
| 9 | agent destroy nonexistent-agent --force | PASS | exit 0, "already absent" |
| 10 | agent create no-tpl-agent (no -t) | PASS | exit 1, required option |
| 11 | agent create -t bad-template | PASS | exit 1, TEMPLATE_NOT_FOUND |
| 12 | template show nonexistent-tpl | PASS | exit 1, not found |
| 13 | skill show nonexistent-skill | PASS | exit 1, not found |

## Phase C: Agent 生命周期 claude-code (14-25)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 14 | agent create rw-agent-1 -t rw-claude-tpl -f json | PASS | created, status: created |
| 15 | agent list -f json | PASS | 含 rw-agent-1 |
| 16 | agent status rw-agent-1 -f json | PASS | status: created |
| 17 | 重复 create rw-agent-1 | PASS | exit 1, already exists |
| 18 | agent start rw-agent-1 | PASS | exit 0, Started |
| 19 | agent status rw-agent-1 | PASS | status: running |
| 20 | 重复 start rw-agent-1 | PASS | exit 1, already running |
| 21 | agent stop rw-agent-1 | PASS | exit 0, Stopped |
| 22 | agent status rw-agent-1 | PASS | status: stopped |
| 23 | stop + start (restart flow) | PASS | start→stop 均 0 |
| 24 | agent stop rw-agent-1 | PASS | exit 0 |
| 25 | agent destroy rw-agent-1 --force | PASS | exit 0, Destroyed |

## Phase D: Cursor backend (26-30)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 26 | agent create rw-cursor-1 -t rw-basic-tpl | PASS | created |
| 27 | agent status rw-cursor-1 | PASS | status: created |
| 28 | agent start rw-cursor-1 | **WARN** | exit 1, cursor 不支持 acp/start，需 resolve/open |
| 29 | agent destroy rw-cursor-1 --force | PASS | exit 0 |
| 30 | agent status rw-cursor-1 | PASS | exit 1, not found |

## Phase E: 域组件 (31-35)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 31 | prompt list | PASS | No prompts loaded |
| 32 | mcp list | PASS | No MCP servers loaded |
| 33 | workflow list | PASS | No workflows loaded |
| 34 | prompt show nonexistent-prompt | PASS | exit 1, not found |
| 35 | mcp show nonexistent-mcp | PASS | exit 1, not found |

## Phase F: 并发 + Resolve (36-43)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 36 | create rw-conc-1/2/3 | PASS | 3 个均 created |
| 37 | agent list | PASS | 含 3 个 (table 格式正确) |
| 38-40 | agent resolve rw-conc-1/2/3 | PASS | 均返回 workspaceDir, command |
| 41-43 | destroy rw-conc-1/2/3 | PASS | 均 Destroyed |

## Phase G: 压力 + 幂等 (44-48)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 44 | agent create rw-idem-1 | PASS | created |
| 45 | agent destroy rw-idem-1 --force | PASS | exit 0 |
| 46 | agent destroy rw-idem-1 --force (幂等) | PASS | exit 0, "already absent" |
| 47 | agent status rw-idem-1 | PASS | exit 1, not found |
| 48 | agent list | PASS | [] |

## Phase H: 最终 (49-50)
| # | 命令 | 判定 | 说明 |
|---|------|------|------|
| 49 | daemon status -f json | PASS | running: true |
| 50 | agent list -f json | PASS | [] |

---
