# Site & Wiki 开发规范

> 涵盖 `docs/site/`（GitHub Pages 主页）和 `docs/wiki/`（VitePress 文档站）的开发约定。

---

## 架构概览

```
docs/
├── site/              ← GitHub Pages 静态主页（纯 HTML + CSS + JS）
│   ├── index.html     ← 单文件 Landing Page
│   ├── content.md     ← 内容蓝图（HTML 内容的 Markdown 源）
│   └── wiki/          ← ⚠️ 构建产物，已 gitignore
└── wiki/              ← VitePress 文档站源码
    ├── package.json   ← 独立项目，不在 pnpm workspace 中
    ├── .vitepress/
    │   ├── config.ts  ← VitePress 配置
    │   └── theme/     ← 自定义主题
    │       ├── index.ts
    │       └── custom.css
    └── **/*.md        ← 文档内容
```

### CI 部署流程 (`deploy-site.yml`)

```
1. Build Wiki:  cd docs/wiki && pnpm install && pnpm build
2. Merge:       cp -r docs/wiki/.vitepress/dist/* docs/site/wiki/
3. Upload:      docs/site/ 整体作为 GitHub Pages artifact 部署
```

---

## 关键 Gotcha

### docs/wiki 不在 pnpm workspace 中

`pnpm-workspace.yaml` 只包含 `packages/*`。`docs/wiki` 是独立项目，本地安装依赖必须：

```bash
cd docs/wiki
pnpm install --ignore-workspace
```

不能用 `pnpm --filter actant-wiki install`，会提示 "No projects matched"。

### docs/wiki/package.json 必须声明 `"type": "module"`

VitePress 1.6+ 是 ESM-only 包。如果 `package.json` 没有 `"type": "module"`，构建时会报：

```
"vitepress" resolved to an ESM file. ESM file cannot be loaded by `require`.
```

### docs/site/wiki/ 是构建产物

已在 `.gitignore` 中排除。本地预览需要先构建 wiki 再合并：

```bash
cd docs/wiki && pnpm build
# 然后复制 .vitepress/dist/* 到 docs/site/wiki/
```

---

## 设计规范

### 统一配色体系

主页和 Wiki 必须使用同一套配色方案，保持品牌一致性：

| 变量 | 色值 | 用途 |
|------|------|------|
| `--accent` | `#d4644a` | 品牌主色、链接、按钮、高亮 |
| `--accent-hover` | `#e0775e` | 悬停态 |
| `--teal` | `#3db9a2` | 辅助色（提示、成功） |
| `--blue` | `#5b9cf5` | 辅助色（信息） |
| `--green` | `#6ec96e` | 辅助色（完成状态） |
| `--purple` | `#a78bfa` | 辅助色（愿景/规划） |
| `--bg` | `#0c0c0c` | 页面背景 |
| `--bg-raised` | `#151515` | 次级背景 |
| `--bg-card` | `#1a1a1a` | 卡片背景 |
| `--text` | `#f2efea` | 主文字 |
| `--text-2` | `#a8a29e` | 次文字 |
| `--text-3` | `#6b6560` | 辅助文字 |
| `--border` | `rgba(255,255,255,.07)` | 边框 |

### Wiki VitePress 主题配置要点

1. **默认暗色模式**：`appearance: 'dark'`
2. **CSS 变量覆盖**：必须同时在 `:root` 和 `.dark` 中设置，确保无论暗色模式检测结果如何都生效
3. **代码高亮主题**：使用 `github-dark`，不要用 CSS `!important` 强制覆盖代码文字颜色，会破坏 Shiki 语法高亮
4. **代码块背景**：`#1e1e1e`（VS Code 默认暗色），比页面背景 `#0c0c0c` 亮，形成层次
5. **字体**：正文 `DM Sans`（Google Fonts），代码 `Maple Mono`（Fontsource CDN），fallback `Fira Code`

```css
/* 正确：通过 Shiki 主题控制高亮 */
markdown: {
  theme: { light: 'github-dark', dark: 'github-dark' },
}

/* 错误：用 CSS 覆盖高亮颜色 */
div[class*="language-"] code { color: #d4d4d4 !important; }  /* 会消灭所有语法高亮 */
```

### 字体加载

- 正文字体通过 Google Fonts `<link>` 标签加载
- 代码字体 Maple Mono 通过 Fontsource jsDelivr CDN 加载，需要声明 `@font-face`：

```css
@font-face {
  font-family: 'Maple Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('https://cdn.jsdelivr.net/fontsource/fonts/maple-mono@latest/latin-400-normal.woff2') format('woff2');
}
```

---

## 品牌资产与图标管理

### Logo 变体

`logo/` 目录存放所有品牌资产。三个核心 PNG 变体由设计稿裁切而来（非程序生成），是**视觉权威源**：

| 文件 | 尺寸 | 适用场景 |
|------|------|---------|
| `logo-full-brand.png` | 360×360 | 文档页脚、关于页、印刷品（含 icon + Actant + Nexus A） |
| `logo-primary.png` | 551×551 | Hero 区域、README 头部、OG 社交预览（含 icon + Actant） |
| `logo-icon-only.png` | 285×285 | Favicon、头像、工具栏、紧凑 UI（纯 Nexus A 图标） |

### 部署位置

| 用途 | 文件路径 | 格式 | 引用位置 |
|------|---------|------|---------|
| Wiki 导航栏 logo | `docs/wiki/public/logo.svg` | SVG (PNG 内嵌) | `.vitepress/config.ts` → `themeConfig.logo` |
| Wiki favicon | `docs/wiki/public/favicon.svg` | SVG (PNG 内嵌) | `.vitepress/config.ts` → `head` |
| Wiki OG 社交预览 | `docs/wiki/public/og-image.png` | PNG | `.vitepress/config.ts` → `head` meta |
| Dashboard favicon | `packages/dashboard/client/public/actant.svg` | SVG (PNG 内嵌) | `client/index.html` → `<link rel="icon">` |

### PNG→SVG 转换模式

需要 SVG 格式但必须保持与设计稿像素级一致时，使用 base64 内嵌模式：

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <image width="{w}" height="{h}"
         href="data:image/png;base64,{base64_data}"/>
</svg>
```

> **禁止**用 `generate.py` 的程序化 SVG 替代设计稿裁切的 logo。`generate.py` 生成的 `nexus-a*.svg` 和 `icon-*.png` 仅用于开发参考和尺寸预览，不作为品牌交付物。

### 更新 Logo 流程

1. 修改 `logo/logo-*.png` 源文件
2. 重新运行 PNG→SVG 内嵌转换
3. 将产物复制到上表中的部署路径
4. 确认 `config.ts` 和 `index.html` 的引用路径正确

---

## 主页内容维护

### 内容更新流程

1. 先修改 `docs/site/content.md`（内容蓝图）
2. 再同步修改 `docs/site/index.html`（实际页面）
3. 两者必须保持一致

### 页面结构（v0.2.2）

| 区块 | ID | 内容 |
|------|-----|------|
| Hero | — | Slogan "The Docker for AI Agents" + 安装命令 |
| Identity | `#identity` | "Actant — 行动者" 品牌语义（叙事学/ANT/Actor Model） |
| Features | `#features` | 6 大核心能力 |
| Use Cases | `#usecases` | 3 个真实场景（CI/虚拟雇员/ACP） |
| Demo | `#demo` | 终端演示 |
| Vision | `#vision` | 进化架构 + 三愿景卡片 |
| Flow | `#flow` | 生命周期 5 步 |
| Roadmap | `#roadmap` | 6 个 Phase |
| Stats | `#stats` | 代码量/测试/RPC/CLI 数据 |
| CTA | — | 号召行动 |

### Docker 类比原则

Hero 的 "The Docker for AI Agents" 作为 Slogan 保留，但页面主体不应围绕 Docker 对比展开。
重点展示 Actant 自身的能力、理念和使用场景。
