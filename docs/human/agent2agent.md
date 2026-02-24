Agent 2 agent 有多种形式，但是考虑石头门和KimiCLI的形式感觉可以做Email的形式
1. 给任意Agent传送Email，这意味着
    1. 针对雇员，雇员应当有一个主Session，并且主Session来处理这个Email
    2. 针对平凡实例，平凡实例直接启动一个新的进程和Session来处理这个Email
    3. 完成后Email传送回来。 actant本身可以有一个email记录中枢，所谓公共知识，email本身应当支持抄送和群发


这依赖于 一套标准的email机制，通过email对传统的prompt做扩展
email的话最好能够跨时间线发送，参考kimiCLI中的跨时间线机制

这也依赖于一套分层的完备的知识管理框架
