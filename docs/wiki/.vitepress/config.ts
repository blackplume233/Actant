import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Actant',
  description: 'The Docker for AI Agents — 构建、管理和编排 AI Agent 的平台',
  base: '/Actant/wiki/',

  head: [
    ['meta', { name: 'robots', content: 'noai, noimageai' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Actant Wiki',

    nav: [
      { text: '入门', link: '/guide/getting-started' },
      { text: '功能', link: '/features/' },
      { text: '实战', link: '/recipes/create-hub' },
      { text: '参考', link: '/reference/architecture' },
      { text: 'GitHub', link: 'https://github.com/blackplume233/Actant' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '安装', link: '/guide/installation' },
            { text: '核心概念', link: '/guide/concepts' },
          ],
        },
      ],
      '/features/': [
        {
          text: '核心功能',
          items: [
            { text: '功能总览', link: '/features/' },
            { text: 'Agent 模板', link: '/features/agent-template' },
            { text: 'Agent 生命周期', link: '/features/lifecycle' },
            { text: '领域上下文', link: '/features/domain-context' },
            { text: '多后端支持', link: '/features/multi-backend' },
            { text: '权限控制', link: '/features/permissions' },
          ],
        },
        {
          text: '运行调度',
          items: [
            { text: '雇员调度器', link: '/features/scheduler' },
            { text: 'ACP 连接', link: '/features/acp-proxy' },
          ],
        },
        {
          text: '组件生态',
          items: [
            { text: '组件源', link: '/features/component-source' },
            { text: '可扩展架构', link: '/features/extensibility' },
          ],
        },
        {
          text: '工具',
          items: [
            { text: 'CLI 命令', link: '/features/cli' },
          ],
        },
      ],
      '/recipes/': [
        {
          text: '实战教程',
          items: [
            { text: '创建组件仓库', link: '/recipes/create-hub' },
            { text: 'CI/CD 集成', link: '/recipes/ci-integration' },
            { text: '打造雇员 Agent', link: '/recipes/employee-agent' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '架构概览', link: '/reference/architecture' },
            { text: 'Changelog', link: '/reference/changelog' },
          ],
        },
      ],
    },

    footer: {
      message: '本站内容由 AI 辅助生成，仅供人类用户参考。<br>AI Agent 开发参考请使用 <code>.trellis/spec/</code> 和 <code>docs/stage/</code>。',
      copyright: 'MIT License © Actant',
    },

    search: { provider: 'local' },
    outline: { level: [2, 3], label: '目录' },
    lastUpdated: { text: '更新于' },
    docFooter: { prev: '上一页', next: '下一页' },
  },
})
