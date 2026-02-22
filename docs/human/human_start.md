# Actant Human Start

## 项目说明

该项目旨在创建一个用来构建，管理Agent的平台，目标为在游戏开发类似的复杂业务下，能让用户通过该平台快速构建/复用合适的Agent，零成本的把Ai嵌入到工作流中。

需要典型考虑的场景为：

1. 自定义业务Agent：需要能在该平台上动态快速拼装合适的Agent，这里的拼装指对Agent后端，上下文，插件扩展的能力，上下文包括：Skill，MCP，Prompt，甚至记忆
2. 持续CI集成：该项目的Agent应当能让TeamCity类似的CI工具轻松调用（以CLI的形式）
3. 持续Agent工作：OpenClaw，该平台应当由能力让一个Agent转化为持续工作的Agent，拥有心跳，自我成长，长期记忆，定时任务等能力（心跳，自我成长，长期记忆等能力都应当可以通过拼装的方式组合）
4. Agent As Service:一个持续工作的Agent作为一个雇员接入到IM软件或是Email软件中，作为服务提供给用户
5. 以ACP的形式集成其他AI前端的能力：可以把该项目以AgentServer的形式通过ACP集 到Unreal/unity中，让引擎可以直接和该平台启动的Agent通信
6. Agent之间互相调用

## 语义定义

1. Model Provider:最基本的模型API
2. Agent Client：Agent的前端，一般常见的有TUI形式，IDE形式，专门软件形式（如Claude Desktop）
3. Agent Backend: 算是我生造的一个词，指一个Agent的功能实现，如Claude Code、open code，cursor(不含交互界面部分)，拆分Client和Backend是因为虽然大部分的Agent都会有自己的典型交互方式，但是也一般都支持和其他的前端集成，而不同前端和后端自由组合是我希望能有的
4. **Domain Context：领域上下文，是业务需要持续去构建的内容，主要包括根据不同**
   1. Workflow（参考trellis，可以理解为一套默认指令，hook，）
   2. prompt
   3. MCP/Tools
   4. Skill(Rules)
   5. 可用的SubAgent（和其他Agent嵌套）
      （虽然并非业界标准，但为了方便沟通，下文中会广泛使用以上术语
5. Agent Template：一个Agent的配置文件，包含什么样的Domain Context，Agent的初始化过程等。Actant应当可以通过一个Agent Template 结合用户的诉求来一次性的构建一个Agent Instance
6. Agent Instance: 一个真正可以运行的Agent，包含使用什么样的Provider， Backend，自身的Domain Context，特定的在执行的Hook，自动化流程，插件等。Agent Instance可以用来进行一次性的任务处理，也可以作为一个服务器持续长期执行
7. Employee:一个持续运行的Agent

## 开发准则

1. 该项目作为一个Agent工坊，他本身应当能够充分和不同的Agent前端，后端结合因此要具备极强的兼容性，因此要进行前后端分析，其所有核心功能都应当可以通过文本配置和CLI操作调用执行，但CLI操作的封装也应当考虑到后续需要兼顾交互UI的诉求。
2. 测试驱动，所有的可以暴露为CLI操作或是配置的行为都应当有充分的单元测试
3. 先规划后执行，所有开发操作都要先有明确设计，经过确认后再实施。一次性功能实现不应该过多，以一次Git提交合适的量为准
4. 充分Review，一个功能开发完成后要由专门的Agent进行Review，检验代码质量，可扩展性，可延展性。敏捷迭代的同时保证技术债是有限的

## 模块划分

模块设计仅为初期参考，后续需要根据开发进度动态调整

1. ActantCore：核心的功能模块

   1. 基于命令行的功能交互模块：Actant启动后可以连续的以命令行交互的形式执行指令，参考Python的交互式环境
   2. Agent Template配置模块：
      1. 要能支持配置一个Agent Template模板，主要包括各类Domain Context
         1. 配置Skill，应当有中心的Skill管理器，此处只引用Skill
         2. 配置Prompt
         3. 配置Workflow，参考Trellis，主要是指各类Hook，Command。
         4. 配置MCP
         5. 如有必要配置插件，如记忆系统，定时工作流等
         6. 配置初始化器，参考Trellis
         7. 默认的Agent后端，Agent Provider等
      2. 考虑到各类配置都是可以复用的，Template中大部分都应当是对具体配置的名字引用，配置的具体参数由各类配置的管理器管理，如Skill，Workflowtemplate，mcp，插件等
   3. Agent 初始化器：基于一个AgentTemplate来构造一个Agent Instance，其实质是构造一个可以直接让Agent工作的工作环境（一般是指一个工作目录）。注意到可能会需要构造一次性的临时Agent Instance
      1. 要求用户指定Agent BackEnd,AgentProvder,可以使用默认值
      2. 根据初始化器的流程初始化工作目录
      3. 如果是ServiceAgent则启动对应的Agent
   4. Agent 管理器：负责持续管理所有现存的Agent Instance，维护他们的状态，提供开启，关闭，监控等功能。需要注意到一个Agent Instance可如果不是服务型则可能同时存在多个Session
      1. Agent的启动包含多种方式：
         1. 直接正常启动对应的Agent，如直接开启一个Claude Code界面，直接打开Cursor等
         2. 通过ACP形式启动对应Agent，交互过程由Actant管理，一般运行在后台
            1. 后台启动一个Agent，Agent生命周期由调用方管理，第三方Agent Client可以通过ACP协议直接和这个Agent互动
            2. 后台启动一个Agent，作为持续服务，第三方AgentClient通过和Actant互动来控制Agent
            3. 后台启动一个Agent并完成任务，执行完成后自动关闭

2. Actant ACP：对于由Agent Manager控制的Agent，让外部AgentClient可以通过ACP协议来和对应的Agent交互，但要考虑到Actant可以提供的是一个Agent集群，所以要判断是否要对协议进行改造，或是做特定实现

3. Actant MCP：让Agent可以通过MCP来访问Actant

   1. 可以调用其他的Agent执行一次性任务
   2. 可以控制Service类型的Agent启动或停止
   3. 访问其他必要信息

4. Actant API：针对所有的Command操作提供标准的Restful API，以使得Actant本身可以作为一个服务以Docker的形式部署

5. Actant GUI : 提供方便的UI操作

   



## 参考项目

1. Agent持续集成[PicoClaw - Ultra-Lightweight AI Assistant | Go-Powered, Performance First](https://picoclaw.net/)|[spacedriveapp/spacebot：面向团队、社区和多用户环境的 AI 代理。 --- spacedriveapp/spacebot: An AI agent for teams, communities, and multi-user environments.](https://github.com/spacedriveapp/spacebot)
2. Agent 后端实现：[pi-mono/packages/ai at main · badlogic/pi-mono](https://github.com/badlogic/pi-mono/tree/main/packages/ai)
3. ACP框架：[Introduction - Agent Client Protocol](https://agentclientprotocol.com/get-started/introduction)
4. 持续工作流：[AI Workflow Automation Platform & Tools - n8n](https://n8n.io/?ps_partner_key=NmFhNmYzNGU5Mzlm&ps_xid=txaQHU6MF5FcNO&gsxid=txaQHU6MF5FcNO&gspk=NmFhNmYzNGU5Mzlm&gad_source=1&gad_campaignid=23397401030&gbraid=0AAAABCODLju4k9WBgYyOUf4mbvMCAnNw-&gclid=Cj0KCQiAhtvMBhDBARIsAL26pjFKJuIizz3rI0mvli2l8NPfecZ7DwVi_SuJSB6GfiuPEPB-pWU4q8QaAr4uEALw_wcB)
5. 工程初始化及Workflow设计：[mindfold-ai/Trellis: All-in-one AI framework & toolkit](https://github.com/mindfold-ai/Trellis)
6. 灵感相关来源：
   1. [Get Started - MuleRun Docs](https://mule.mintlify.app/creator-guide/quickstart/get-started)
   2. [EvoMap - AI Self-Evolution Infrastructure](https://evomap.ai/)
7. 关联项目：
   1. [blackplume233/UnrealFairy](https://github.com/blackplume233/UnrealFairy)希望该项目能取代此项目中Actant的部分