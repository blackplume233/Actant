## 概述

在 Dashboard 中新增 **Agent 编排 (Agent Orchestration)** 一级页签，提供可视化的 Agent 模板创建、技能选配、调度器配置，以及从模板物化 Instance 的完整流程。

当前 Dashboard 已有 Dashboard / Canvas / Agents / Activity / Events / Settings 六个一级页签，Agent 编排页将作为第七个一级页签，路由为 `/orchestration`。

## 背景

- 当前模板仅在后端 REST API 层暴露（`GET/POST /v1/templates`），Dashboard 无模板管理 UI
- actant-hub 已定义 AgentTemplate、SkillDefinition、PromptDefinition、PresetDefinition 等完整组件模型（见 `docs/design/actant-hub-registry-design.md`）
- Agent 有三种 archetype：`repo`(tool)、`service`、`employee`，其中 **employee** 类型支持调度器（heartbeat / cron / hooks）
- Skill 是 Agent 最核心的能力单元，编排界面需将 Skill 选配作为主要交互

## 功能需求

### 1. 一级页签 — `/orchestration`

- 在 Sidebar (`app-sidebar.tsx`) 中新增 "编排" 导航项，位于 Agents 和 Activity 之间
- 页面入口展示已有模板列表（卡片/表格切换）+ "创建模板" CTA
- 支持按 archetype、layer（kernel/auxiliary/spark）、标签筛选

### 2. 模板创建向导（Wizard）

分步骤向导流程：

#### Step 1: 选择模板类型（可多选）

- 提供 archetype 选择：`service` / `employee` / `tool(repo)`
- 可多选（如同时创建 service + employee 变体）
- 每种类型展示简介卡片和适用场景说明
- 选择后进入下一步

#### Step 2: 基础信息填写

- **名称** (name): 必填，slug 格式，自动校验唯一性
- **后端** (backend): 下拉选择（`claude-code` / `cursor` / 其他已注册后端）
- **简介** (description): 必填，一句话描述
- **主 MD** (main prompt): Markdown 编辑器，支持实时预览，用于编写系统提示词
- **Layer**: kernel / auxiliary / spark 选择
- **版本**: semver 格式，默认 `1.0.0`

#### Step 3: 选择技能（Skill 选配 — 核心步骤）

> Skill 是编排界面最主要的概念

- 从已注册 Source 中展示所有可用 Skill（来自 actant-hub 及自定义 Source）
- 支持按分类（kernel/auxiliary/spark）、标签筛选和搜索
- 卡片式展示每个 Skill 的 name、description、tags
- 拖拽排序已选 Skill，支持设定优先级
- 展示已选 Skill 数量和预估 token 占用
- 可预览 Skill 详细内容（SKILL.md / JSON）

#### Step 4: 选择调度器（仅 employee 类型）

- 仅当 Step 1 中包含 `employee` archetype 时显示此步骤
- 配置项：
  - **Heartbeat**: 启用/禁用，间隔时间（ms），心跳 prompt，优先级
  - **Cron 任务**: 可添加多条，配置 cron pattern + prompt + priority
  - **事件 Hook**: 可添加多条，配置 eventName + prompt + priority
- 提供常用调度模板（如 "夜间巡检"、"Session 结束回调" 等快捷预设）

#### Step 5: 预览 & 确认

- 展示完整的 AgentTemplate JSON 预览
- 一键创建，调用 `POST /v1/templates` API
- 成功后跳转到模板详情

### 3. 从模板创建 Instance（物化流程）

在模板列表或模板详情页提供 "创建 Instance" 入口，流程：

#### Step A: 选择模板

- 从已有模板列表中选择（卡片式，支持搜索筛选）
- 展示模板摘要（archetype、skills 数量、描述）

#### Step B: 选择物化的 Instance 类型

- 选择实际运行的 archetype（如模板支持多种，则从中选一）
- 配置 Instance 名称（slug）、工作目录等运行时参数

#### Step C: 是否微调

- 提供开关："使用模板默认配置" vs "微调后创建"
- 若选择微调，进入类似模板创建的完整编排流程（Step 2-4），但以模板配置为初始值
- 微调项包括：调整 Skill 列表、修改 prompt、变更调度器配置
- 微调后的差异以 diff 视图展示

#### Step D: 确认 & 创建

- 展示最终 Instance 配置（含与模板的 diff，若有微调）
- 一键创建，调用 Instance 注册 API
- 成功后跳转到 Agent 详情页

## 技术方案

### 前端

- 路由: 在 `App.tsx` 新增 `/orchestration` 及子路由
- 侧栏: 在 `app-sidebar.tsx` 添加导航项（图标建议 `Workflow` 或 `GitBranch`）
- 向导组件: 实现通用 `Stepper` / `Wizard` 组件，支持步骤间状态持久化
- Skill 选配: 需要调用后端 Source API 获取 Skill 列表
- i18n: 新增 `orchestration` 命名空间的中英文翻译

### 后端 API（可能需要新增/增强）

- `GET /v1/sources/skills` — 列出所有可用 Skill（跨 Source 聚合）
- `GET /v1/sources/prompts` — 列出所有可用 Prompt
- `POST /v1/templates` — 创建模板（已有）
- `POST /v1/instances` — 从模板创建 Instance（可能需要增强，支持微调参数）
- `GET /v1/templates/:name/diff` — 对比模板与微调配置的差异（可选）

### 数据模型参考

```typescript
// AgentTemplate (from actant-hub-registry-design.md)
interface AgentTemplate {
  name: string;
  version: string;
  description: string;
  archetype: "service" | "employee" | "repo";
  backend: { type: string };
  domainContext: {
    skills: string[];
    prompts: string[];
    mcpServers: string[];
  };
  permissions: { ... };
  schedule?: {          // employee only
    heartbeat?: { intervalMs: number; prompt: string; priority: string };
    cron?: Array<{ pattern: string; prompt: string; priority: string }>;
    hooks?: Array<{ eventName: string; prompt: string; priority: string }>;
  };
  metadata: { layer: string; tier: string };
}
```

## UI/UX 要点

- 向导步骤条始终可见，支持点击回退到任意已完成步骤
- Skill 选配步骤应占据最大视觉权重（全宽卡片网格 + 侧边已选列表）
- 调度器配置使用可折叠面板，默认展开 heartbeat
- 模板创建和 Instance 物化复用同一套 Wizard 组件，通过 mode 区分
- 深色主题适配（当前 Dashboard 已支持 dark mode）
- 响应式布局：桌面端侧边步骤条 + 主区域，移动端顶部步骤条 + 全宽

## 验收标准

- [ ] Sidebar 新增 "编排" 一级导航，点击进入 `/orchestration`
- [ ] 模板列表页展示已有模板，支持筛选
- [ ] 模板创建向导完整走通 5 步流程
- [ ] employee 类型正确展示调度器配置步骤，其他类型跳过
- [ ] Skill 选配步骤可搜索、筛选、多选、排序
- [ ] 从模板创建 Instance 流程完整，支持微调
- [ ] 微调时以 diff 视图展示与原模板的差异
- [ ] 中英文 i18n 支持
- [ ] 响应式布局正常
- [ ] 与现有 REST API 正确集成

## 相关

- `docs/design/actant-hub-registry-design.md` — Hub 组件模型设计
- `packages/rest-api/src/routes/templates.ts` — 模板 REST API
- `packages/dashboard/client/src/lib/archetype-config.ts` — Archetype 配置
- `packages/dashboard/client/src/components/layout/app-sidebar.tsx` — 侧栏导航
- Issue #246 — Instance 分层展示
