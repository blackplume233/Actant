## QA ??????

**??**: cli-hub-bootstrap
**?????**: QA SubAgent
**??**: 2026-03-17T04:17:40.305Z
**??**: FAILED (1/11 ????, 0 ??)

### ??
| # | ?? | ?? | ?? | ?? |
|---|------|------|------|------|
| 1 | Global actant version | `actant.cmd --version` | FAIL | ? |
| 2 | Global acthub version | `acthub.cmd --version` | FAIL | ? |
| 3 | hub status auto-starts bootstrap host | `actant.cmd hub status --format json` | FAIL | ? |
| 4 | daemon status reflects bootstrap host and hub project | `actant.cmd daemon status --format json` | FAIL | ? |
| 5 | acthub alias reuses same host | `acthub.cmd status --format json` | FAIL | ? |
| 6 | hub read exposes project context through alias path | `acthub.cmd read /project/context.json` | FAIL | ? |
| 7 | hub list exposes project files through alias path | `acthub.cmd list /project --json` | FAIL | ? |
| 8 | MCP connected mode delegates through hub activation | `SDK Client -> packages/mcp-server/dist/index.js (connected mode) -> vfs_read(/project/context.json) + actant(hub.status)` | FAIL | ? |
| 9 | MCP detached-readonly mode keeps VFS but rejects runtime RPC | `SDK Client -> packages/mcp-server/dist/index.js (detached-readonly) -> vfs_read(/project/context.json) + actant(hub.status)` | PASS | ? |
| 10 | daemon stop cleans up bootstrap host | `actant.cmd daemon stop` | FAIL | ? |
| 11 | daemon status confirms host stopped | `actant.cmd daemon status --format json` | FAIL | ? |

### ??/????
**?? 1 - Global actant version [FAIL]**:
- ??: actant --version ??? exit 0

**?? 2 - Global acthub version [FAIL]**:
- ??: acthub --version ??? exit 0

**?? 3 - hub status auto-starts bootstrap host [FAIL]**:
- ??: actant hub status --format json ???

**?? 4 - daemon status reflects bootstrap host and hub project [FAIL]**:
- ??: actant daemon status --format json ???

**?? 5 - acthub alias reuses same host [FAIL]**:
- ??: acthub status --format json ???

**?? 6 - hub read exposes project context through alias path [FAIL]**:
- ??: acthub read /project/context.json ???

**?? 7 - hub list exposes project files through alias path [FAIL]**:
- ??: acthub list /project --json ???

**?? 8 - MCP connected mode delegates through hub activation [FAIL]**:
- ??: connected actant tool ??? hub.status

**?? 10 - daemon stop cleans up bootstrap host [FAIL]**:
- ??: actant daemon stop ???

**?? 11 - daemon status confirms host stopped [FAIL]**:
- ??: Unexpected end of JSON input

### ??????
? G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\qa-log-round1.md
