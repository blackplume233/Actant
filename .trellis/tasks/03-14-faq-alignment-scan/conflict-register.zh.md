# FAQ 对齐冲突项登记表

> 用于支撑母 issue《对齐 FAQ 产品定位，开展仓库历史内容审查、概念收缩与现状整理》。
> 目标不是穷举所有措辞差异，而是优先记录会持续误导产品定位、概念边界或 Phase 4 推进路径的关键冲突项。

## 使用方式

每条冲突项统一按以下结构记录：

- 问题
- 冲突基线
- 证据文件
- 影响
- 建议动作
- 优先级

---

## C-01 产品主叙事仍停留在泛化“Agent 平台 / Docker 类比”

- 问题
  - 部分关键文档仍以 “Docker for AI Agents” 或包结构/功能平铺叙事为主，没有把 Actant 作为底层平台、支撑上层 App / SOP / CI / 引擎集成的角色放到首位。
- 冲突基线
  - 当前应以“Actant 是底层平台”为主叙事，Docker 类比只能作为辅助比喻。
- 证据文件
  - `docs/wiki/reference/architecture.md:13`
  - `docs/planning/roadmap.md:11`
  - `docs/design/core-agent-progress-report.md:38`
- 影响
  - 读者容易继续把 Actant 理解成单一 Agent 产品或通用 Agent 管理器。
  - Phase 4 的平台底座优先级会被功能清单叙事稀释。
- 建议动作
  - 重写 architecture / roadmap 顶部叙事。
  - 在 concepts 或 vision 文档中建立统一产品 framing，并让其它文档引用它。
- 优先级
  - P0

## C-02 `service` 已定义但尚未被稳定确立为主交付形态

- 问题
  - 虽然 `repo -> service -> employee` 已经在概念文档中出现，但更广泛的规划和示例仍没有把 `service` 突出为默认主交付形态。
- 冲突基线
  - 当前应明确：`service` 是最常见、最重要的主交付形态；`employee` 是其上的自治增强层。
- 证据文件
  - `docs/wiki/guide/concepts.md:40`
  - `docs/wiki/recipes/employee-agent.md:7`
  - `docs/planning/phase4-employee-steps.md:13`
- 影响
  - 规划和实现容易被带向“employee-first”。
  - service 的平台契约和验证口径容易长期缺位。
- 建议动作
  - 在 concepts / architecture / roadmap / recipe 中统一加入 `service` 主形态表达。
  - 增加 service-oriented 示例或 recipe。
- 优先级
  - P0

## C-03 `employee` 在历史和示例材料中被过度中心化

- 问题
  - 多个规划与示例入口以 employee 为中心，容易让团队形成“未来主体就是 employee”的默认印象。
- 冲突基线
  - `employee` 应被视为增强自治层，而不是默认主体。
- 证据文件
  - `docs/planning/phase4-employee-steps.md:11`
  - `docs/wiki/recipes/employee-agent.md:7`
  - `docs/wiki/features/scheduler.md:13`
- 影响
  - 容易造成能力优先级失焦：把自治增强放在主交付形态之前。
  - 验证和叙事更难围绕 archetype 递进模型收敛。
- 建议动作
  - 调整文档展示顺序与措辞，强调 employee 是 `service + autonomy`。
  - 在 roadmap 中用 archetype progression 替代 employee-centric 视角。
- 优先级
  - P0

## C-04 `plugin` 术语同时指向 agent-side 与 actant-side 两层概念

- 问题
  - 现有 `PluginManager` 管的是 agent/workspace 侧定义，而 Phase 4 #14 要做的是 actant-side PluginHost。两者共享“plugin”一词，造成高歧义。
- 冲突基线
  - agent-side plugin 与 actant-side system plugin 不是同一层，必须显式拆分命名和边界。
- 证据文件
  - `packages/core/src/domain/plugin/plugin-manager.ts:16`
  - `docs/design/mvp-next-design.md:72`
  - `docs/planning/phase4-plan.md:76`
  - `docs/planning/phase4-employee-steps.md:247`
- 影响
  - #14 很容易被错误理解成“把现有 plugin CRUD 做强一点”。
  - 文档、规划、实现层都会继续积累歧义。
- 建议动作
  - 在 spec 和 architecture 中正式拆分术语：workspace plugin / agent-side plugin vs PluginHost / system plugin。
  - 必要时重命名类型或章节标题。
- 优先级
  - P0

## C-05 Domain Context 与 Platform Runtime Services 的层次仍然混杂

- 问题
  - 当前不同文档中，Workflow / MCP / Plugin / Scheduler / Memory / Email 有时被一并看作 Domain Context 组件，有时又被规划为平台底座能力。
- 冲突基线
  - 应明确区分 template/domain-context layer 与 platform/runtime-services layer。
- 证据文件
  - `docs/wiki/guide/concepts.md:60`
  - `.trellis/spec/config-spec.md:204`
  - `docs/planning/phase4-plan.md:88`
- 影响
  - 平台能力与模板能力边界持续模糊。
  - 后续 spec、实现、验证都更难对齐。
- 建议动作
  - 在 concepts / architecture / config-spec 中增加正式分层图或分层表。
  - 明确哪些能力是模板引用/物化，哪些能力是平台注入/托管。
- 优先级
  - P1

## C-06 规划层仍把部分能力描述为“待从零设计”，忽略现有基础设施

- 问题
  - 某些主线工作在规划叙事中仍像 greenfield，但代码层已经具备重要基础设施。
- 冲突基线
  - #14、#37、#122 等工作应优先按“整合已有模块”理解，而不是默认从零发明。
- 证据文件
  - `packages/core/src/initializer/pipeline/step-registry.ts:10`
  - `packages/core/src/initializer/pipeline/initialization-pipeline.ts:24`
  - `packages/core/src/manager/agent-manager.ts:353`
  - `docs/planning/phase4-plan.md:105`
- 影响
  - 容易重复设计、重复实现。
  - 也会让 planning 与 code reality 长期脱节。
- 建议动作
  - 在 planning / architecture 中增加“已有基础”章节。
  - 为 #14 / #37 / #122 分别注明可复用模块清单。
- 优先级
  - P1

## C-07 architecture 文档明显滞后于 runtime 和 dashboard 的当前建模

- 问题
  - architecture 仍以包结构与旧版模块描述为主，尚未充分体现 archetype-first、context injection、service keepAlive、employee conversation 等新事实。
- 冲突基线
  - 架构文档应反映当前主要实现事实，而不是停留在旧阶段概览。
- 证据文件
  - `docs/wiki/reference/architecture.md:74`
  - `packages/core/src/manager/agent-manager.ts:118`
  - `packages/core/src/manager/agent-manager.ts:404`
  - `packages/dashboard/client/src/lib/archetype-config.ts:55`
- 影响
  - 新读者会从旧架构文档得到错误或不完整理解。
  - dashboard 和 runtime 反而比 architecture 更接近当前产品模型。
- 建议动作
  - 重写 architecture 文档，按产品层 / archetype 层 / runtime layer / protocol layer 组织。
- 优先级
  - P1

## C-08 验证资产仍主要按 phase/feature 组织，尚未围绕 archetype 建立验收主线

- 问题
  - endurance spec 已有生命周期与扩展方向，但还没有形成 `repo/service/employee` 的主验收矩阵。
- 冲突基线
  - Spec 与 endurance 应能直接验证 archetype 级产品承诺。
- 证据文件
  - `.trellis/spec/endurance-testing.md:23`
  - `.trellis/spec/endurance-testing.md:197`
  - `.trellis/spec/config-spec.md:71`
- 影响
  - 无法直接回答三种形态是否分别成立。
  - 未来测试仍可能只跟随 issue backlog 滚动。
- 建议动作
  - 在 endurance spec 中增加 archetype baseline matrix。
  - 为 repo/service/employee 建立最小验收集合。
- 优先级
  - P1

## C-09 历史设计稿仍在隐性充当当前概念依据

- 问题
  - 部分旧设计稿虽已不完全适配当前主线，但仓库中缺少明确状态标识，仍可能被视作当前设计依据。
- 冲突基线
  - 历史文档应保留，但不能继续隐性参与当前概念定义。
- 证据文件
  - `docs/design/core-agent-progress-report.md:1`
  - `docs/design/mvp-next-design.md:1`
- 影响
  - 讨论很容易回退到旧术语、旧边界、旧阶段目标。
- 建议动作
  - 为历史 design doc 增加状态头或顶部说明。
  - 在当前有效文档中集中定义最新基线。
- 优先级
  - P2

## C-10 launcher 层与 archetype 层的概念尚未被清晰区分

- 问题
  - `create-launcher.ts` 表达的是 mock/real 基础设施选择，但在缺少明确说明时，容易被误读为产品 archetype 相关抽象。
- 冲突基线
  - launcher 是底层实现选择，不是 repo/service/employee 建模层。
- 证据文件
  - `packages/core/src/manager/launcher/create-launcher.ts:5`
- 影响
  - 容易在实现讨论中把基础设施抽象与产品模型混为一谈。
- 建议动作
  - 在 architecture 或 runtime 文档中明确 launcher / backend / archetype 的不同层级。
- 优先级
  - P2

---

## 处置状态汇总 (2026-03-16 #278 session)

| 冲突项 | 优先级 | 状态 | 处置 |
|--------|--------|------|------|
| C-01 | P0 | ✅ 已解决 | architecture.md 重写为平台主叙事；roadmap.md 已含平台定位 |
| C-02 | P0 | ✅ 已解决 | architecture.md/concepts.md/endurance-testing.md/phase4-employee-steps.md 均已明确 service 为主交付形态 |
| C-03 | P0 | ✅ 已解决 | phase4-employee-steps.md 设计理念已更新；employee-agent.md recipe 增加前置说明 |
| C-04 | P0 | ✅ 已解决 | architecture.md 概念模型增加 Plugin 术语注意；config-spec.md 已有分层说明 |
| C-05 | P1 | ✅ 已解决 | architecture.md 增加 Layer Separation 模型；concepts.md 已区分 domainContext 与 platform runtime |
| C-06 | P1 | ✅ 已解决 | phase4-plan.md 已有"已落地基础"章节；phase4-employee-steps.md Step 4 状态已修正 |
| C-07 | P1 | ✅ 已解决 | architecture.md 从 v0.2.6 更新到 v0.3.0，包含 ActantChannel/TUI/RecordSystem/VFS |
| C-08 | P1 | ✅ 已解决 | endurance-testing.md 已有 archetype-oriented baseline (§2.1) |
| C-09 | P2 | ✅ 已解决 | core-agent-progress-report.md 标记 Historical；mvp-next-design.md 标记 Partially Valid |
| C-10 | P2 | ✅ 已解决 | architecture.md archetype 表格已明确区分管理深度与技术实现层 |

## 建议后续

- 本轮 10 个冲突项全部完成初步处置
- 后续随代码演进，持续检查新文档/新 feature 是否继续符合已建立的基线
- 建议在下一次 stage/release 前通过 `/review` 再次检查一致性
