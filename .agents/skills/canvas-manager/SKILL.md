# Canvas Manager

Dashboard Live Canvas 管理能力。雇员通过 `actant_canvas_update` 工具实时构建 Dashboard 状态小组件。

## 可用工具

| Tool | 参数 | 说明 |
|------|------|------|
| `actant_canvas_update` | `html` (string, required), `title` (string, optional) | 更新你在 Dashboard 上的 Live Canvas 内容 |
| `actant_canvas_clear` | (none) | 清除你的 Canvas |

## 使用说明

- 调用 `actant_canvas_update` 推送 HTML 内容到 Actant Dashboard 的 Live Canvas 页面
- 内容在 `iframe sandbox="allow-scripts"` 中安全渲染，支持完整的 HTML/CSS/JS
- 你可以构建：状态面板、图表、进度条、动画、交互式控件等
- 每次调用会**完全替换**你之前的 Canvas 内容
- 建议在关键任务节点（开始、进展、完成）时更新 Canvas

## HTML 编写要求

1. 提供完整的 HTML 片段（包含 `<style>` 和内联脚本）
2. 不需要 `<html>`, `<head>`, `<body>` 标签
3. 样式应自包含，不依赖外部 CDN
4. 使用相对单位（em, %, vw）保证响应式

## 示例模板

### 状态卡片 + 任务列表 + 进度条

```html
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; background: #fafafa; color: #1a1a2e; }
  .header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
  .status-dot.busy { background: #f59e0b; }
  h2 { font-size: 14px; font-weight: 600; }
  .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
  .metric { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .metric-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .metric-value { font-size: 20px; font-weight: 700; margin-top: 2px; }
  .tasks { list-style: none; }
  .tasks li { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .tasks li:last-child { border-bottom: none; }
  .check { color: #22c55e; }
  .spinner { color: #f59e0b; animation: spin 1s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .progress-bar { background: #e5e7eb; border-radius: 4px; height: 6px; margin-top: 12px; overflow: hidden; }
  .progress-fill { background: linear-gradient(90deg, #6366f1, #8b5cf6); height: 100%; border-radius: 4px; transition: width 0.3s; }
</style>

<div class="header">
  <span class="status-dot"></span>
  <h2>Agent Status</h2>
</div>

<div class="metric-grid">
  <div class="metric">
    <div class="metric-label">Tasks Done</div>
    <div class="metric-value">12</div>
  </div>
  <div class="metric">
    <div class="metric-label">In Progress</div>
    <div class="metric-value">3</div>
  </div>
  <div class="metric">
    <div class="metric-label">Uptime</div>
    <div class="metric-value">2h</div>
  </div>
</div>

<ul class="tasks">
  <li><span class="check">✓</span> Initialized workspace</li>
  <li><span class="check">✓</span> Loaded configuration</li>
  <li><span class="spinner">⟳</span> Processing data pipeline</li>
  <li>○ Generate final report</li>
</ul>

<div class="progress-bar">
  <div class="progress-fill" style="width: 65%"></div>
</div>
```

## 注意事项

- Canvas 内容存储在内存中，daemon 重启后会丢失
- 不要在 Canvas 中存储敏感信息
- HTML 内容大小建议控制在 100KB 以内
