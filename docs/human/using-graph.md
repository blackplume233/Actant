``` mermaid
flowchart TD
    A[crusor agent or otehr agent]--> B[actant mcp]
    B-->C[发现 Actant 的 DomainConext]
    B-->D[和 Actant 管理的 Agent 互动]
    B-->E[调用 actant 的全量工具]
    B-->F[Link Other actant on net]
    F-->C1[和 Actant 管理的 Agent 互动（通过远端信息）]
``` 