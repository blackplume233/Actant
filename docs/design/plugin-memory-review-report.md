# Plugin 体系 + 统一记忆系统 — 12 轮多视角审阅报告

> **审阅对象**: Plugin System Design (`actant_plugin_system_design.plan.md`) + Unified Memory Design (`unified_memory_design_02e5f4f6.plan.md`)
> **审阅日期**: 2026-02-25
> **关联 Epic**: #173 (GitHub), #170 (本地)
> **审阅状态**: **ALL PASS** (3 轮迭代后全部通过) | **架构更新**: 统一三插口 (2026-02-25)

---

## 审阅总结

12 轮审阅覆盖架构一致性、数据模型、安全隐私、性能、向后兼容、开发者体验、测试策略、失败恢复、依赖风险、运维、成本与并发。经过 3 轮审阅-修复迭代，所有 12 个视角的 Gap 已在设计文档中解决。

**迭代历史**:
- **Round 1 初审**: 发现 26 项 Gap (10 高, 10 中, 6 低)
- **Round 2 修复后重审**: 2 PASS, 9 PARTIAL, 1 FAIL → 修复高优先级 Gap 到设计文档
- **Round 3 再修复后重审**: 11 PASS, 1 PARTIAL → 补充 #162 issue 验收标准
- **Final**: 12 PASS

### 后续架构重大变更 (2026-02-25)

**统一三插口设计**: 将 PluginManager (Phase 3 配置声明) 与 PluginHost (Phase 4 运行时) 合并为统一 Plugin 概念。一个 Plugin 包含三个可选插口 — `domainContext` (物化到 workspace), `runtime` (Daemon 生命周期), `hooks` (事件消费/生产)。旧 `PluginDefinition` 通过 `adaptLegacyPlugin()` 自动适配。此变更需在实施前纳入 Round 1 (架构一致性) 重新评估。

以下为各轮详细发现和建议 (含修复状态)。

---

## Round 1: 架构一致性

### 优势

- HookEventBus 集成模式一致：PluginContext 注入 `eventBus`，Plugin 通过 `on(event, handler)` 消费事件、`emit()` 生产事件，与现有 HookRegistry 模式统一
- 作用域对齐：`actant` / `instance` 两层与 HookRegistry 的 `level` 分层一致
- 记忆系统不侵入 Domain Component 体系：通过独立 `@actant/memory` 适配层接入，WorkspaceBuilder 的 `registerHandler()` 保持可扩展

### 风险/Gap

- **PluginHost vs PluginManager 边界模糊**: `PluginManager` (extends `BaseComponentManager<PluginDefinition>`) 管理 Agent-side plugin *定义*（如 Claude Code plugins），`PluginHost` 管理 Actant-side plugin *运行时实例*。两者命名相近但职责完全不同，文档未明确区分
- **HookEventName 未定义**: `hook-event-bus.ts`, `hook-registry.ts`, `action-runner.ts` 均引用 `HookEventName` 但该类型从未在 `@actant/shared` 中定义。Plugin 体系强依赖此类型
- **AppContext 缺少 PluginHost**: 当前 AppContext 没有创建 PluginHost 的逻辑，需要 #161 补充

### 建议

1. 在 `.trellis/spec/` 中明确记录 PluginManager (配置) vs PluginHost (运行时) 的区别
2. #159 作为 P0 优先处理，解除后续所有 Plugin/Memory issue 的类型阻塞
3. #161 需在 AppContext 构造函数中初始化 PluginHost 并在 `start()` / `stop()` 中接入

---

## Round 2: 数据模型质量

### 优势

- **统一 MemoryRecord**: 单一 Schema 同时承载 L0/L1/L2 分层、树状索引和向量检索，避免多表 join
- **URI 身份标识**: `ac://` 协议统一三层寻址，支持树状导航和跨层引用
- **`promotedFrom` 溯源**: 支持记忆来源追踪

### 风险/Gap

- **L0/L1/L2 共表膨胀**: `l2_content` 可能很长（完整内容），与 `l0_summary` (~20 tokens) 在同一行。LanceDB 列式存储下大字段会影响 scan 性能。L0-only 查询仍需读取整行
- **`childUris: string[]`**: 数组列在列式 DB 中更新成本高。节点子项增长无上限，单次更新可能触发全行重写
- **`vector: Float32Array`**: LanceDB Arrow 映射需要固定维度。当前 Schema 未指定维度（768? 1024? 取决于 embedding 模型），运行时维度不匹配会导致静默错误
- **`confidence` 语义未定义**: 取值范围 (0-1)、更新规则、衰减策略均未明确

### 建议

1. 在 `@agent-memory/core` types.ts 中定义 `VECTOR_DIMENSION` 常量和 `MemoryRecordSchema` (Arrow 映射)
2. 评估 L2 单独表 vs 同表的 tradeoff；若同表则利用 LanceDB projection 只读取需要的列
3. `childUris` 设上限 (如 1000)；超出时考虑分页子查询
4. 定义 `confidence` 为 `[0, 1]` 浮点，文档化更新规则：
   - 创建时 = 初始值 (如 0.5)
   - 被访问 +0.05 (上限 1.0)
   - 每周衰减 * 0.98
   - import 打折 * 0.6

---

## Round 3: 安全与隐私

### 优势

- **TemplateMemoryManifest 隐私等级**: `public | anonymized | private` 三级控制，默认 `private`
- **Import confidence 打折**: 导入记忆 confidence * 0.6，需本地验证后恢复
- **层隔离**: Instance 记忆物理隔离在 `instances/{name}/.memory/`

### 风险/Gap

- **URI 路径穿越**: `ac://instances/../../../etc/passwd` 可能绕过层隔离。`navigate(uri)` 和 `browse(prefix)` 直接拼接 SQL WHERE 条件，可能存在注入风险
- **记忆注入**: recall 返回的内容注入到 AGENTS.md。恶意或低质量记忆可能影响 Agent 行为（类似 prompt injection），当前无过滤/审查机制
- **`anonymized` 规则未定义**: "去除 instanceName/项目路径等敏感信息"描述模糊，缺乏具体的脱敏规则（正则、屏蔽词列表等）
- **`l2_content` 中的 PII**: L0/L1 摘要中也可能包含用户名、路径、API key 等敏感信息

### 建议

1. URI 校验函数：只允许 `ac://` scheme，路径组件 reject `..`、`~`、绝对路径
2. MemoryStore 的 SQL 查询使用参数化绑定，避免 URI 拼接注入
3. recall 结果过滤：低于 confidence 阈值 (如 0.3) 的记忆不注入到 context
4. 在 #167 中定义 anonymization 规则：路径替换 `{PROJECT_PATH}`、用户名替换 `{USER}`、正则匹配 API key / token 模式
5. 长期考虑: 记忆内容 sandbox (只读注入，不影响 Agent 核心指令)

---

## Round 4: 性能与可扩展性

### 优势

- **Embedding 降级链**: GPU sidecar → OpenAI → ONNX，支持离线和低延迟场景
- **LanceDB 嵌入式**: 无独立服务进程，零运维
- **三种检索模式**: recall/navigate/browse 分工明确，避免一个接口做所有事

### 风险/Gap

- **大规模记忆未验证**: 缺少 10K/100K/1M 记录下的性能 benchmark
- **Embedding 批量化缺失**: `session:end` 提取可能产生多条记忆，每条单独调用 embedding API 效率低
- **`materialize()` 阻塞启动**: ContextBroker 三层并行读取 + 合并在 Agent 启动路径上。LanceDB I/O 或 embedding 服务慢时会阻塞启动
- **`tick()` 调度未定义**: tick 间隔、并行策略、超时处理均未明确。MemoryPlugin 的 tick 可能执行重操作（凝练、promote）

### 建议

1. 添加 benchmark 脚本和性能目标：recall < 100ms @10K records, browse < 50ms @1K L0 records
2. `@agent-memory/embedding` 提供 `embedBatch(texts: string[]): Promise<Float32Array[]>` 接口
3. materialize 加超时 (如 5s) + 降级策略：超时则跳过记忆注入，Agent 正常启动
4. PluginHost tick 调度规则：
   - 配置 `tickInterval` (默认 30s)
   - 上一次 tick 未完成则跳过本次 (running guard)
   - tick 耗时超阈值记录 warn 日志

---

## Round 5: 向后兼容

### 优势

- **零记忆兼容**: #165 明确 "无 `.memory/` 时行为与当前完全一致"
- **软耦合**: `@agent-memory/*` 完全独立，不修改现有 Actant 核心类型
- **ContextMaterializer deprecation**: 已标记 `@deprecated`，迁移到 WorkspaceBuilder pipeline

### 风险/Gap

- **AGENTS.md 格式变更**: 新增 "Instance Insights" 部分可能影响现有 AGENTS.md 解析工具或规则
- **旧 JSON 记忆无迁移**: #10 如果有用户已手动实现了 JSON 记忆（基于原设计），升级后会丢失
- **`systemPlugins` 字段**: AgentTemplate 新增可选字段，旧 template 没有此字段时需默认为 `[]`

### 建议

1. AGENTS.md 变更保持 additive: "Instance Insights" 作为新 section 追加到末尾，不修改现有 section
2. 提供 opt-in 迁移工具: `actant memory migrate --from-json`，读取旧 JSON → 生成 MemoryRecord → 导入 LanceDB
3. template.types.ts 中 `systemPlugins` 定义为 `systemPlugins?: SystemPluginConfig[]`，未定义时 PluginHost 视为空数组

---

## Round 6: 开发者体验 (DX)

### 优势

- **Plugin 生命周期清晰**: `init → start → tick → stop → dispose` 五阶段直观
- **PluginContext 注入充足**: eventBus, logger, config, dataDir, getPlugin 覆盖常见需求
- **MemoryStore 三接口**: recall/navigate/browse 语义明确，低学习成本

### 风险/Gap

- **Plugin 开发无脚手架**: 没有 `actant plugin create <name>` 命令或模板
- **Memory MCP 工具缺失**: Agent 无法通过 MCP 工具查询记忆（recall/navigate/browse），只能在 materialize 时被动注入
- **配置复杂度**: Memory 系统需要 embedding provider, LanceDB 路径, 层配置等多个参数，缺乏统一配置 schema

### 建议

1. #161 CLI 命令中增加 `actant plugin create <name> --scope <actant|instance>` 脚手架
2. #165 中添加 MCP Server: `memory_recall`, `memory_navigate`, `memory_browse` 三个工具
3. 定义 `MemoryPluginConfig` schema (Zod)，包含 embedding provider/model/path/layerConfig，并在 config-spec 中文档化

---

## Round 7: 测试策略

### 优势

- **明确的测试文件**: #14 和 #162 均规划了 `*.test.ts` 文件
- **HeartbeatPlugin 作为验证器**: 最简 plugin 验证架构的 E2E 正确性

### 风险/Gap

- **Plugin 隔离测试困难**: PluginHost 依赖 HookEventBus 和文件系统（dataDir），无法简单 mock
- **LanceDB Mock 困难**: `MemoryStore` 是接口，但 LanceDB 特有行为（向量检索排序、Arrow 类型）难以用 mock 精确模拟
- **缺少集成测试模式**: "start Daemon → start agent → session:end → verify memory" 端到端流程未描述

### 建议

1. 提供 `createTestPluginContext(overrides?)` 工厂函数：内置 mock eventBus, mock logger, tmpdir 作为 dataDir
2. `@agent-memory/core` 中提供 `InMemoryMemoryStore` (implements `MemoryStore`)，用于测试和开发
3. E2E 测试场景写入 `spec/endurance-testing.md` 的 Phase 4+ 部分:
   - E-PLUG: Plugin 加载/卸载/崩溃恢复
   - E-MEM: 记忆跨 session 持久化 + recall 准确性

---

## Round 8: 失败模式与弹性

### 优势

- **HookEventBus 容错**: listener 错误被捕获并记录，不会传播到其他 listener
- **Embedding 降级链**: 多 provider 减少单点故障

### 风险/Gap

- **Plugin 崩溃无隔离**: 一个 plugin 的 `tick()` 或 `start()` 异常可能影响 PluginHost 其他 plugin 的调度
- **LanceDB 损坏无恢复**: 嵌入式 DB 文件损坏后没有修复、备份或降级策略
- **Embedding 全部失败**: 所有 provider 同时不可用时（如离线 + 无 ONNX），行为未定义
- **Promote 冲突**: Instance → Template promote 时，多个 Instance 同时提名语义相似但内容不同的记忆，无冲突消解策略

### 建议

1. PluginHost 中每个 `plugin.tick()` 和 `plugin.start()` 包裹独立 try/catch:
   - 异常时标记 `state: "error"`, 记录日志
   - 不影响其他 plugin 的 tick/start
   - 连续 N 次失败可触发 `plugin:${name}:unhealthy` 事件
2. 定期备份策略: 每日 LanceDB 目录 snapshot (cp); 提供 `actant memory repair` 命令（删除损坏 + 重建索引）
3. Embedding 全部失败时降级为 "store without vector"：记忆仍然可通过 navigate/browse 访问，recall (语义检索) 不可用但不报错
4. Instance → Template promote 添加内容去重 (content hash) + 相似度阈值聚合

---

## Round 9: 依赖风险

### 优势

- **LanceDB 活跃维护**: 定期发布，TypeScript SDK 有专门维护
- **可选依赖**: ONNX 和 GPU sidecar 是 optional，不影响基础功能

### 风险/Gap

- **`@lancedb/lancedb` v0.x**: pre-1.0 API 可能 breaking change。npm 上有多个版本线 (0.4.x, 0.19.x)
- **Apache Arrow Node.js 绑定**: LanceDB 底层使用 Arrow，Node.js Arrow 绑定有平台兼容性问题 (ARM/Windows)
- **ONNX Runtime**: `onnxruntime-node` 有平台特定二进制，ARM Linux / Windows ARM 支持不稳定

### 建议

1. `@agent-memory/store-lancedb` 的 package.json 中 pin 精确版本 (如 `"@lancedb/lancedb": "0.19.0"`)
2. CI 中添加 LanceDB 兼容性测试矩阵 (Node 18/20, Windows/Linux/macOS)
3. ONNX 作为 optional peerDependency：
   ```json
   "peerDependencies": { "onnxruntime-node": "^1.17.0" },
   "peerDependenciesMeta": { "onnxruntime-node": { "optional": true } }
   ```
4. 文档化支持的平台矩阵，native 模块加载失败时给出清晰错误信息

---

## Round 10: 运维

### 优势

- **CLI 命令规划**: `actant plugin list/status`, `actant memory promote`, `actant memory curate`
- **结构化存储路径**: `instances/{name}/.memory/lance/`, `~/.actant/templates/{name}/memory/`, `~/.actant/memory/`

### 风险/Gap

- **记忆指标缺失**: 无法查看 LanceDB 大小、记录数、各层分布
- **存储增长无控制**: 没有 retention 策略、decay 实现、compaction。长期使用记忆只增不减
- **检索质量不可调试**: recall 返回结果没有 similarity score、filter 详情等调试信息
- **日志噪声**: `session:end` 提取流程可能产生大量日志

### 建议

1. 添加 `actant memory stats` 命令: 总记录数、各层记录数、总存储大小、最近访问分布
2. 实现 `DecayPolicy`:
   - `lastAccessedAt > 90d && confidence < 0.3` → 自动归档
   - `actant memory gc` 手动触发清理
3. recall 返回 `RecallResult { record: MemoryRecord; score: number; matchedBy: string }` 便于调试
4. 记忆相关日志使用 `logger.debug`，默认不输出；`--verbose` 或 `LOG_LEVEL=debug` 时启用

---

## Round 11: 成本与资源

### 优势

- **离线可用**: ONNX CPU + 本地 LanceDB 可完全离线运行
- **批量 API**: `embedBatch` 减少 per-call 开销

### 风险/Gap

- **Embedding API 成本**: 每次 session:end 可能提取 5-20 条记忆，每条需要 embedding。使用 OpenAI text-embedding-3-small 约 $0.02/1M tokens，但高频 session 累积成本不可忽视
- **存储增长预估缺失**: 无法预判 10K/100K 记录的磁盘占用
- **LanceDB 内存占用**: 嵌入式 DB 使用进程内存；大表会增加 RSS

### 建议

1. 成本预估文档: 假设每 session 平均 10 条记忆 × 200 tokens/条 = 2K tokens/session。OpenAI embedding: ~$0.00004/session
2. 存储预估: MemoryRecord 平均 ~2KB (含 vector 768×4=3KB)，10K records ≈ 50MB, 100K ≈ 500MB
3. 可选配置: `maxRecordsPerSession: 20`, `maxTotalRecords: 100000` 作为安全阀
4. 添加 `@agent-memory/store-lancedb` 的内存使用测试 (10K/100K records 下的 RSS delta)

---

## Round 12: 并发与竞态

### 优势

- **Instance 物理隔离**: 每个 instance 独立的 `.memory/` 目录，无跨 instance 写冲突
- **Actant vs Instance 作用域分离**: 减少全局与单实例间的争用

### 风险/Gap

- **Template 层并发写**: 同一 Template 的多个 Instance 可能同时 promote 记忆到 Template 层。LanceDB 单进程内并发安全，但多进程（多 Daemon）访问同一 lance 目录未定义
- **Promote 重复**: 两个 Instance 在同一 tick 周期 promote 语义相似的记忆，可能产生重复条目
- **LanceDB 连接共享**: MemoryPlugin (actant scope) 管理所有 instance 记忆，如果用同一 LanceDB Connection 并发读写，行为取决于 LanceDB 的线程安全性
- **tick() 重入**: 如果 tick 耗时超过 interval，setInterval 会再次触发 tick，两次 tick 并行执行

### 建议

1. 单 Daemon 假设：文档化 "一个 Actant 目录只由一个 Daemon 进程管理"
2. Promote 幂等: 基于内容 hash (l1_overview + kind + tags) 去重；相同 hash 的 promote 请求合并
3. LanceDB Connection 策略: 每层 (actant/template/instance) 独立 Connection，不跨层共享
4. tick guard:
   ```typescript
   private ticking = false;
   async tick() {
     if (this.ticking) return;
     this.ticking = true;
     try { /* ... */ } finally { this.ticking = false; }
   }
   ```

---

## 行动项汇总

### 高优先级 (P0-P1, 实施阶段必须处理) — 全部已纳入设计

| # | 行动项 | 归属 Issue | 来源 | 设计文档状态 |
|---|--------|-----------|------|-------------|
| 1 | 新增 `hook.types.ts` 定义 HookEventName | #159 | Round 1 | **已设计** (plugin design §5.3) |
| 2 | MemoryRecordSchema 固定 vector 维度 | #162 | Round 2 | **已设计** (VECTOR_DIMENSION=1024) |
| 3 | URI 校验 (ac:// only, reject `..`, SQL 字符) | #162 | Round 3 | **已设计** (validateMemoryUri) |
| 4 | SQL 参数化: filter API 替代字符串拼接 | #163 | Round 3 | **已设计** (MemoryStore 代码) |
| 5 | recall confidence 阈值过滤 | #165 | Round 3 | **已设计** (minConfidence=0.3) |
| 6 | materialize 超时 + 降级启动 | #165 | Round 4 | **已设计** (5s timeout + emptyContext) |
| 7 | JSON→LanceDB 迁移工具 (opt-in) | #165 | Round 5 | **已设计** (§5.1 migrate --from-json) |
| 8 | Plugin tick() try/catch 隔离 | #14 | Round 8 | **已设计** (ManagedPlugin + 连续失败计数) |
| 9 | Embedding 全失败降级 (store without vector) | #164 | Round 8 | **已设计** (零向量 + recall 返回空) |
| 10 | tick() running guard 防重入 | #14 | Round 12 | **已设计** (ticking: boolean) |

### 中优先级 (P2, 后续迭代处理) — 全部已纳入设计

| # | 行动项 | 归属 Issue | 来源 | 设计文档状态 |
|---|--------|-----------|------|-------------|
| 11 | InMemoryMemoryStore 测试实现 | #162 | Round 7 | **已设计** (§5.2 + 包结构) |
| 12 | MCP memory tools (recall/navigate/browse) | #165 | Round 6 | **已设计** (§7.3 MCP 工具表) |
| 13 | Promote 幂等去重 (content hash) | #166 | Round 12 | **已设计** (contentHash 字段) |
| 14 | DecayPolicy 实现 | #162 | Round 10 | **已设计** (§7.2 DecayPolicy) |
| 15 | 每 session embedding 上限配置 | #164 | Round 11 | **已设计** (maxEmbeddingsPerSession=20) |
| 16 | LanceDB pin 版本 + CI 兼容测试 | #163 | Round 9 | **已设计** (§11 依赖管理) |
| 17 | recall 返回 score 便于调试 | #163 | Round 10 | **已设计** (RecallResult) |
| 18 | `actant memory stats` 命令 | #169 | Round 10 | **已设计** (§7.2 CLI) |
| 19 | `createTestPluginContext()` 工厂 | #14 | Round 7 | **已设计** (plugin design §6.2) |
| 20 | `embedBatch()` 批量接口 | #164 | Round 4 | **已设计** (EmbeddingClient) |

### 低优先级 (P3, 可选增强) — 全部已纳入设计

| # | 行动项 | 归属 Issue | 来源 | 设计文档状态 |
|---|--------|-----------|------|-------------|
| 21 | Plugin 脚手架 `actant plugin create` | #161 | Round 6 | **已设计** (plugin design §7) |
| 22 | Anonymization 脱敏规则定义 | #167 | Round 3 | **已设计** (§4.3 脱敏规则表) |
| 23 | LanceDB 备份 + repair 命令 | #163 | Round 8 | **已设计** (§10 备份策略) |
| 24 | ONNX optional peerDependency | #164 | Round 9 | **已设计** (§11 peerDependencies) |
| 25 | 存储/成本预估文档 | #162 | Round 11 | **已设计** (§13 成本估算) |
| 26 | PluginManager vs PluginHost 区别文档 | #14 | Round 1 | **已设计** (plugin design §1.1) |
