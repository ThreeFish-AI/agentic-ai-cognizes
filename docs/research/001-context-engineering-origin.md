---
id: context-engineering
sidebar_position: 1
title: Context Engineering 深度调研报告
last_update:
  author: Aurelius
  date: 2025-12-22
  version: 1.1
  status: 待审阅
tags:
  - Context Engineering
  - 学术论文
  - 主流框架
---

## 1. 执行摘要

**Context Engineering（上下文工程）** 是构建可靠、可扩展 AI Agent 系统的核心学科。它从传统的"写 Prompt"演进为**系统性地设计和优化 AI 系统运行时所需的整个动态信息生态系统**——涵盖上下文的收集（Collection）、管理（Management）和使用（Usage）。

本报告基于：

- **学术论文**：《Context Engineering 2.0: The Context of Context Engineering》[1] 和 《Understanding and Using Context》[2]
- **主流框架文档**：Google ADK [3-6]、Agno [7-10]、LangGraph [11-12]

> [!IMPORTANT] > **核心洞察**：Context Engineering 不仅仅是 Prompt 设计，更是一个涵盖**记忆系统（Memory）、会话管理（Session）、状态持久化（Persistence）、知识检索（RAG）**的完整架构问题。对于 Agentic AI Engine 项目而言，OceanBase 的统一存储架构需要同时解决这些挑战。

---

## 2. Context Engineering 的演进与定义

### 2.1 历史回顾：从 HCI 到 HAI

Context Engineering 并非 Agent 时代的新发明。根据 Dey (2001) 的开创性工作 [2]，早在 2000 年代初期，研究者就已经在探索"上下文感知计算"（Context-Aware Computing）。

> "Context is a poorly used source of information in our computing environments. As a result, we have an impoverished understanding of what context is and how it can be used." — Dey [2]

**Dey 的定义 (2001)** [2]：

> **Context** is any information that can be used to characterize the situation of an entity. An entity is a person, place, or object that is considered relevant to the interaction between a user and an application, including the user and applications themselves.

**SII-GAIR 论文的定义 (2025)** [1]：

$$C = \bigcup_{e \in E_{rel}} Char(e)$$

其中：

- $E_{rel} \subseteq E$ 是与交互相关的实体集合
- $Char(e)$ 返回描述实体 $e$ 的信息集合

**Context Engineering 定义** [1]：

$$CE: (C, T) \rightarrow f_{context}$$

其中 $f_{context}(C) = F(\phi_1, \phi_2, \ldots, \phi_n)(C)$，$F$ 是组合各种上下文工程操作 $\phi_i$ 的函数。

### 2.2 发展阶段

论文 [1] 将 Context Engineering 划分为四个时代：

```mermaid
gantt
    title Context Engineering 发展时代
    dateFormat YYYY
    section Era 1.0
    原始计算时代 (刚性/预定义格式) :done, 1990, 2020
    section Era 2.0
    Agent-Centric 时代 (自然语言/动态上下文) :active, 2020, 2030
    section Era 3.0
    Human-Level 智能 (深度意图理解) :2030, 2040
    section Era 4.0
    Superhuman 智能 (人机角色反转) :2040, 2050
```

| 时代        | 时间范围   | 智能水平      | Context Engineering 特征                    |
| :---------- | :--------- | :------------ | :------------------------------------------ |
| **Era 1.0** | 1990s-2020 | 原始计算      | 刚性、预定义格式（菜单选择、传感器输入）[1] |
| **Era 2.0** | 2020-至今  | Agent-Centric | 自然语言理解、推断隐含意图、动态上下文 [1]  |
| Era 3.0     | 未来       | Human-Level   | 深度意图理解、最小显式上下文需求 [1]        |
| Era 4.0     | 遥远未来   | Superhuman    | 机器引导人类、人机角色反转 [1]              |

> [!NOTE]
> 我们当前处于 **Era 2.0**，核心挑战是让 Agent 能够：(1) 理解自然语言输入；(2) 推断隐含意图；(3) 处理不完整信息；(4) 在有限的 Context Window 中做出最优选择 [1]。

### 2.3 本项目实践：统一定义

```python
# Agentic AI Engine 项目的 Context 定义
from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum

class ContextScope(Enum):
    """上下文作用域"""
    INVOCATION = "invocation"  # 单次调用
    SESSION = "session"        # 会话级别
    USER = "user"              # 用户级别
    APP = "app"                # 应用级别

@dataclass
class Context:
    """统一上下文数据结构"""
    # 系统指令
    system_instruction: str
    # 用户输入
    user_message: str
    # 对话历史（短期记忆）
    chat_history: List[Dict]
    # 长期记忆
    memories: List[Dict]
    # 检索到的知识（RAG）
    knowledge: List[Dict]
    # 工具定义
    tools: List[Dict]
    # 状态
    state: Dict
    # 作用域
    scope: ContextScope
```

---

## 3. Context Engineering 三大支柱

根据论文 [1] 和主流框架实践，Context Engineering 可分解为三大核心维度：

```mermaid
graph TB
    subgraph CE["🧠 Context Engineering"]
        CC["📥 Collection<br>上下文收集"]
        CM["📦 Management<br>上下文管理"]
        CU["🔍 Usage<br>上下文使用"]
    end

    CC --> CC1["用户输入"]
    CC --> CC2["系统指令"]
    CC --> CC3["对话历史"]
    CC --> CC4["外部数据/RAG"]
    CC --> CC5["工具定义"]

    CM --> CM1["分层记忆架构"]
    CM --> CM2["上下文压缩"]
    CM --> CM3["上下文隔离"]
    CM --> CM4["持久化存储"]

    CU --> CU1["语义检索"]
    CU --> CU2["意图推断"]
    CU --> CU3["动态组装"]

    style CE fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style CC fill:#065f46,stroke:#34d399,color:#fff
    style CM fill:#7c2d12,stroke:#fb923c,color:#fff
    style CU fill:#581c87,stroke:#c084fc,color:#fff
```

---

## 4. Context Collection（上下文收集）

### 4.1 核心概念

上下文收集是指从各种来源获取 Agent 运行所需的信息。论文 [1] 指出：

> "Context engineering aims to **collect** relevant context information through sensors or other channels."

### 4.2 各框架的收集策略

#### 4.2.1 Google ADK

Google ADK 将上下文收集抽象为多个层次的 Context 对象 [3]：

| Context 类型          | 描述                         | 可访问位置                 |
| :-------------------- | :--------------------------- | :------------------------- |
| **InvocationContext** | 完整调用上下文，包含所有信息 | Agent 的 `_run_async_impl` |
| **CallbackContext**   | 回调中的只读上下文           | Agent/Model 回调           |
| **ToolContext**       | 工具执行时的可写上下文       | Function Tools             |
| **ReadonlyContext**   | 只读上下文，用于表达式评估   | Agent Config 表达式        |

```python
# Google ADK 上下文收集示例 [4]
from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext

class MyAgent(Agent):
    async def _run_async_impl(self, ctx):
        # 从 InvocationContext 收集各类信息
        session = ctx.session                    # 会话
        state = ctx.session.state                # 会话状态
        user_content = ctx.user_content          # 用户输入
        agent = ctx.agent                        # Agent 配置

        # 从 Memory Service 检索长期记忆
        if ctx.memory_service:
            memories = await ctx.memory_service.search_memory(
                query=user_content.parts[0].text
            )
```

#### 4.2.2 Agno

Agno 的上下文收集基于 Agent 参数配置 [7]：

| 组件                   | 描述                                   | 配置方式                      |
| :--------------------- | :------------------------------------- | :---------------------------- |
| **System Message**     | 主上下文（description + instructions） | Agent 构造参数                |
| **User Message**       | 用户输入                               | `Agent.run(input)`            |
| **Chat History**       | 对话历史                               | `add_history_to_context=True` |
| **Additional Context** | Few-shot 示例等                        | `additional_context` 参数     |
| **Memory**             | 长期记忆                               | `enable_user_memories=True`   |
| **Knowledge**          | 外部知识库                             | `knowledge` 参数              |

```python
# Agno 上下文收集示例 [7][8]
from agno.agent import Agent

agent = Agent(
    name="Helpful Assistant",
    description="You are a helpful assistant",
    instructions=["Help the user with their question"],

    # Context 增强选项
    add_datetime_to_context=True,
    add_location_to_context=True,
    add_name_to_context=True,
    add_session_summary_to_context=True,  # 添加历史摘要
    add_memories_to_context=True,          # 添加长期记忆
    add_session_state_to_context=True,     # 添加会话状态

    # 外部知识
    knowledge=my_knowledge_base,
)
```

#### 4.2.3 LangGraph

LangGraph 通过 State 和 Config 收集上下文 [11][12]：

```python
# LangGraph 上下文收集示例 [12]
from langgraph.graph import StateGraph, MessagesState

def my_node(state: MessagesState, config, *, store):
    # 从 state 获取消息历史
    messages = state["messages"]

    # 从 config 获取用户标识
    user_id = config["configurable"]["user_id"]
    thread_id = config["configurable"]["thread_id"]

    # 从 store 检索长期记忆
    namespace = (user_id, "memories")
    memories = store.search(namespace, query=messages[-1].content)

    return {"messages": [...]}
```

### 4.3 本项目实践：统一收集器

```python
# Agentic AI Engine - 统一上下文收集器
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class CollectionConfig:
    """收集配置"""
    include_system_instruction: bool = True
    include_chat_history: bool = True
    max_history_turns: int = 10
    include_memories: bool = True
    max_memories: int = 5
    include_knowledge: bool = True
    max_knowledge_chunks: int = 3

class ContextCollector:
    """统一上下文收集器"""

    def __init__(
        self,
        session_service,      # 会话服务
        memory_service,       # 记忆服务
        knowledge_service,    # 知识服务
        config: CollectionConfig = None
    ):
        self.session_service = session_service
        self.memory_service = memory_service
        self.knowledge_service = knowledge_service
        self.config = config or CollectionConfig()

    async def collect(
        self,
        user_id: str,
        session_id: str,
        user_message: str,
        agent_config: Dict
    ) -> Context:
        """收集完整上下文"""

        # 1. 系统指令（来自 Agent 配置）
        system_instruction = agent_config.get("system_instruction", "")

        # 2. 对话历史（短期记忆）
        chat_history = []
        if self.config.include_chat_history:
            session = await self.session_service.get_session(
                user_id=user_id,
                session_id=session_id
            )
            chat_history = session.events[-self.config.max_history_turns:]

        # 3. 长期记忆
        memories = []
        if self.config.include_memories:
            memories = await self.memory_service.search_memory(
                user_id=user_id,
                query=user_message,
                limit=self.config.max_memories
            )

        # 4. 知识检索 (RAG)
        knowledge = []
        if self.config.include_knowledge:
            knowledge = await self.knowledge_service.search(
                query=user_message,
                limit=self.config.max_knowledge_chunks
            )

        return Context(
            system_instruction=system_instruction,
            user_message=user_message,
            chat_history=chat_history,
            memories=memories,
            knowledge=knowledge,
            tools=agent_config.get("tools", []),
            state=session.state if session else {},
            scope=ContextScope.SESSION
        )
```

---

## 5. Context Management（上下文管理）

### 5.1 分层记忆架构

论文 [1] 提出了关键的记忆分层模型，这与各框架的设计高度一致：

#### 5.1.1 短期记忆 (Short-term Memory)

**定义** [1]：

$$M_s = f_{short}(c \in C : w_{temporal}(c) > \theta_s)$$

- 高时间相关性
- 快速检索，但可能快速变得不相关
- 对应各框架的**对话历史 (Chat History)** 和 **会话状态 (Session State)**

#### 5.1.2 长期记忆 (Long-term Memory)

**定义** [1]：

$$M_l = f_{long}(c \in C : w_{importance}(c) > \theta_l \land w_{temporal}(c) \leq \theta_s)$$

- 高重要性
- 经过抽象和压缩处理
- 对应各框架的 **Memory Service**

#### 5.1.3 记忆迁移 (Memory Transfer)

**定义** [1]：

$$f_{transfer}: M_s \rightarrow M_l$$

巩固过程：高频访问或高重要性的短期记忆经处理后成为长期记忆。

### 5.2 各框架的记忆实现

#### 5.2.1 Google ADK 记忆体系

```mermaid
graph TD
    subgraph ADK["Google ADK 记忆体系"]
        IC[InvocationContext] --> S[Session]
        IC --> ST[State]
        IC --> M[Memory]

        S --> SE["Events<br>时间序列消息"]
        S --> SS["session.state<br>会话级临时数据"]

        ST --> ST1["无前缀: Session Scope"]
        ST --> ST2["user: User Scope"]
        ST --> ST3["app: App Scope"]
        ST --> ST4["temp: Invocation Scope"]

        M --> MM[MemoryService]
        MM --> MM1[InMemoryMemoryService]
        MM --> MM2[VertexAiMemoryBankService]
    end

    style ADK fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style IC fill:#065f46,stroke:#34d399,color:#fff
    style MM fill:#7c2d12,stroke:#fb923c,color:#fff
```

**State 前缀系统** [5]：

| 前缀    | 作用域               | 持久性                 | 用例               |
| :------ | :------------------- | :--------------------- | :----------------- |
| 无前缀  | 当前 Session         | 取决于 SessionService  | 任务进度、临时标志 |
| `user:` | 跨该用户所有 Session | Database/VertexAI 持久 | 用户偏好、配置     |
| `app:`  | 跨该应用所有用户     | Database/VertexAI 持久 | 全局设置、模板     |
| `temp:` | 当前 Invocation      | 不持久                 | 中间计算、临时数据 |

```python
# Google ADK State 使用示例 [5]
async def my_tool(ctx: ToolContext):
    # Session scope - 仅当前会话
    ctx.state["task_progress"] = 50

    # User scope - 跨会话持久化
    ctx.state["user:preferred_language"] = "zh-CN"

    # App scope - 全局配置
    ctx.state["app:max_retries"] = 3

    # Temp scope - 仅当前调用
    ctx.state["temp:intermediate_result"] = {...}
```

#### 5.2.2 LangGraph 记忆体系

LangGraph 区分两种持久化机制 [11][12]：

| 类型                  | 机制         | 范围      | 用途                   |
| :-------------------- | :----------- | :-------- | :--------------------- |
| **Short-term Memory** | Checkpointer | Thread 内 | 对话历史、状态快照     |
| **Long-term Memory**  | Store        | 跨 Thread | 用户偏好、学习到的知识 |

```python
# LangGraph 短期记忆 (Checkpointer) [12]
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres import PostgresSaver

# 本地测试
checkpointer = InMemorySaver()

# 生产环境
checkpointer = PostgresSaver(conn)

graph = builder.compile(checkpointer=checkpointer)

# 使用 thread_id 标识对话
config = {"configurable": {"thread_id": "conversation-123"}}
graph.invoke(input_data, config)
```

```python
# LangGraph 长期记忆 (Store) [12]
from langgraph.store.memory import InMemoryStore
from langgraph_checkpoint_postgres import PostgresStore

store = InMemoryStore()

# 编译时同时启用 checkpointer 和 store
graph = builder.compile(checkpointer=checkpointer, store=store)

# 在节点中使用 store
def my_node(state, config, *, store):
    user_id = config["configurable"]["user_id"]
    namespace = (user_id, "memories")

    # 存储记忆
    store.put(namespace, "preference", {"food": "pizza"})

    # 检索记忆 (支持语义搜索)
    memories = store.search(namespace, query="what do I like?")
```

#### 5.2.3 Agno 记忆体系

Agno 提供两种 Memory 模式 [8]：

| 模式                 | 配置                         | 行为                            |
| :------------------- | :--------------------------- | :------------------------------ |
| **Automatic Memory** | `enable_user_memories=True`  | 自动从对话中提取和召回记忆      |
| **Agentic Memory**   | `enable_agentic_memory=True` | Agent 自主决定何时创建/更新记忆 |

```python
# Agno Memory 示例 [8]
from agno.agent import Agent
from agno.db.postgres import PostgresDb

db = PostgresDb(
    db_url="postgresql://user:pass@localhost:5432/mydb",
    memory_table="agent_memories"
)

agent = Agent(
    db=db,
    enable_user_memories=True,  # 自动记忆
)

# 记忆自动从对话中提取
agent.print_response(
    "My name is Sarah and I prefer email over phone calls.",
    user_id="user-123"
)

# 记忆自动召回
agent.print_response(
    "What's the best way to reach me?",
    user_id="user-123"
)  # Agent 会记住偏好
```

### 5.3 上下文压缩策略

#### 5.3.1 压缩方法对比

| 策略                | 描述                 | 优缺点                       | 框架支持             |
| :------------------ | :------------------- | :--------------------------- | :------------------- |
| **Trimming**        | 保留最近 K 条消息    | ✅ 简单；❌ 丢失早期重要信息 | LangGraph, Agno      |
| **Summarization**   | 将历史摘要为精简文本 | ✅ 保留语义；❌ 计算开销     | ADK, Agno, LangGraph |
| **Sliding Window**  | 滑动窗口摘要老旧事件 | ✅ 平衡保留与压缩            | ADK                  |
| **Semantic Filter** | 基于相关性过滤       | ✅ 保留重要信息；❌ 可能遗漏 | 自定义实现           |
| **QA 对压缩**       | 将上下文转换为问答对 | ✅ 检索友好；❌ 破坏信息流   | 自定义实现           |

#### 5.3.2 Google ADK 压缩配置

```python
# Google ADK Context Compaction [3]
from google.adk.apps.app import EventsCompactionConfig

app = App(
    name='my-agent',
    root_agent=root_agent,
    events_compaction_config=EventsCompactionConfig(
        compaction_interval=3,  # 每 3 次调用触发压缩
        overlap_size=1,         # 保留前一窗口的 1 个事件
    ),
)
```

#### 5.3.3 LangGraph 消息管理

```python
# LangGraph 消息修剪 [12]
from langchain_core.messages import trim_messages

# 基于 token 限制修剪
trimmer = trim_messages(
    max_tokens=1000,
    strategy="last",  # 保留最新消息
    token_counter=len,
)

# 在节点中使用
def agent_node(state):
    messages = trimmer.invoke(state["messages"])
    response = llm.invoke(messages)
    return {"messages": [response]}
```

### 5.4 上下文隔离

论文 [1] 提出通过 **Sub-Agent 架构** 解决上下文窗口限制：

> "Each sub-agent has its own focused context window, and the main agent coordinates through efficient communication."

#### 5.4.1 LangGraph Subgraph

```python
# LangGraph Subgraph 上下文隔离 [12]
from langgraph.graph import StateGraph

# 子图有独立的状态和上下文
def create_research_subgraph():
    builder = StateGraph(ResearchState)
    builder.add_node("search", search_node)
    builder.add_node("analyze", analyze_node)
    return builder.compile()

# 主图
main_builder = StateGraph(MainState)
main_builder.add_node("research", create_research_subgraph())
main_builder.add_node("respond", respond_node)
```

### 5.5 本项目实践：统一管理器

```python
# Agentic AI Engine - 统一上下文管理器
from enum import Enum
from typing import List, Dict

class CompressionStrategy(Enum):
    NONE = "none"
    TRIM = "trim"
    SUMMARIZE = "summarize"
    SLIDING_WINDOW = "sliding_window"

class ContextManager:
    """统一上下文管理器"""

    def __init__(
        self,
        oceanbase_client,
        llm_client,
        compression_strategy: CompressionStrategy = CompressionStrategy.SLIDING_WINDOW,
        max_context_tokens: int = 8000,
        window_size: int = 10,
        overlap_size: int = 2
    ):
        self.db = oceanbase_client
        self.llm = llm_client
        self.strategy = compression_strategy
        self.max_tokens = max_context_tokens
        self.window_size = window_size
        self.overlap_size = overlap_size

    async def compress_history(
        self,
        session_id: str,
        events: List[Dict]
    ) -> List[Dict]:
        """压缩对话历史"""

        if self.strategy == CompressionStrategy.NONE:
            return events

        if self.strategy == CompressionStrategy.TRIM:
            return events[-self.window_size:]

        if self.strategy == CompressionStrategy.SUMMARIZE:
            # 获取需要摘要的老事件
            old_events = events[:-self.window_size]
            recent_events = events[-self.window_size:]

            if old_events:
                summary = await self._generate_summary(old_events)
                return [{"type": "summary", "content": summary}] + recent_events
            return recent_events

        if self.strategy == CompressionStrategy.SLIDING_WINDOW:
            # ADK 风格的滑动窗口
            if len(events) <= self.window_size:
                return events

            # 分批次管理
            batches = []
            for i in range(0, len(events) - self.window_size, self.window_size - self.overlap_size):
                batch = events[i:i + self.window_size]
                summary = await self._generate_summary(batch)
                batches.append({"type": "summary", "content": summary})

            # 最后一个窗口保留完整
            batches.extend(events[-self.window_size:])
            return batches

    async def transfer_to_long_term(
        self,
        user_id: str,
        session_id: str,
        events: List[Dict]
    ) -> List[str]:
        """记忆迁移：短期 → 长期"""

        # 使用 LLM 提取重要信息
        insights = await self._extract_insights(events)

        memory_ids = []
        for insight in insights:
            # 向量化并存储
            embedding = await self._embed(insight["content"])

            memory_id = await self.db.execute("""
                INSERT INTO agent_memories
                (user_id, content, embedding, importance_score, topics)
                VALUES (?, ?, ?, ?, ?)
                RETURNING memory_id
            """, [
                user_id,
                insight["content"],
                embedding,
                insight["importance"],
                insight["topics"]
            ])
            memory_ids.append(memory_id)

        return memory_ids

    async def _generate_summary(self, events: List[Dict]) -> str:
        """生成摘要"""
        prompt = f"Summarize the following conversation:\n{events}"
        return await self.llm.generate(prompt)

    async def _extract_insights(self, events: List[Dict]) -> List[Dict]:
        """提取重要洞察"""
        prompt = f"""Extract important user preferences, facts, and learnings from this conversation.
        Return as JSON list with fields: content, importance (0-1), topics (list).
        Conversation: {events}"""
        return await self.llm.generate_json(prompt)
```

---

## 6. Context Usage（上下文使用）

### 6.1 检索与选择策略

论文 [1] 强调多维度的检索依据：

| 检索依据                 | 描述                       | 实现方式      |
| :----------------------- | :------------------------- | :------------ |
| **语义相似度**           | 基于向量嵌入的相似度搜索   | Vector Search |
| **时间邻近性 (Recency)** | 最近使用的信息优先级更高   | 时间戳排序    |
| **访问频率 (Frequency)** | 高频访问的信息保持高可用性 | 访问计数器    |
| **重要性评分**           | 预计算的重要性权重         | LLM 评估      |
| **逻辑依赖**             | 追踪推理步骤之间的依赖关系 | 依赖图        |
| **信息去重**             | 过滤传达相同含义的重复信息 | 语义去重      |

### 6.2 混合检索实现

```python
# Agentic AI Engine - 混合检索
class HybridRetriever:
    """混合检索器：语义 + 时间 + 频率"""

    def __init__(self, oceanbase_client):
        self.db = oceanbase_client

    async def retrieve(
        self,
        user_id: str,
        query: str,
        query_embedding: List[float],
        weights: Dict[str, float] = None
    ) -> List[Dict]:
        """
        混合检索，支持权重调整

        Args:
            weights: {"semantic": 0.5, "recency": 0.3, "frequency": 0.2}
        """
        weights = weights or {
            "semantic": 0.5,
            "recency": 0.3,
            "frequency": 0.2
        }

        # OceanBase 混合检索 SQL
        result = await self.db.execute("""
            SELECT
                memory_id,
                content,
                topics,
                -- 综合评分
                (
                    ? * (1 - vec_l2_distance(embedding, ?)) +
                    ? * (1 - DATEDIFF(NOW(), updated_at) / 30.0) +
                    ? * (access_count / (SELECT MAX(access_count) FROM agent_memories WHERE user_id = ?))
                ) AS relevance_score
            FROM agent_memories
            WHERE user_id = ?
              AND vec_l2_distance(embedding, ?) < 0.8
            ORDER BY relevance_score DESC
            LIMIT 10
        """, [
            weights["semantic"], query_embedding,
            weights["recency"],
            weights["frequency"], user_id,
            user_id,
            query_embedding
        ])

        return result
```

### 6.3 动态上下文组装

```mermaid
graph LR
    subgraph Inputs["输入源"]
        I1["System Instruction"]
        I2["User Message"]
        I3["Chat History"]
        I4["Memories"]
        I5["Knowledge (RAG)"]
        I6["Tools"]
    end

    subgraph Assembler["Context Assembler"]
        A1["Token 预算计算"]
        A2["优先级排序"]
        A3["截断与填充"]
        A4["格式化输出"]
    end

    subgraph Output["输出"]
        O1["Formatted Prompt"]
    end

    I1 --> A1
    I2 --> A1
    I3 --> A1
    I4 --> A1
    I5 --> A1
    I6 --> A1
    A1 --> A2 --> A3 --> A4 --> O1

    style Inputs fill:#065f46,stroke:#34d399,color:#fff
    style Assembler fill:#7c2d12,stroke:#fb923c,color:#fff
    style Output fill:#581c87,stroke:#c084fc,color:#fff
```

```python
# Agentic AI Engine - 动态上下文组装器
from typing import List, Dict, Optional
import tiktoken

class ContextAssembler:
    """动态上下文组装器"""

    def __init__(
        self,
        max_tokens: int = 8000,
        reserved_output_tokens: int = 1000,
        tokenizer: str = "cl100k_base"
    ):
        self.max_tokens = max_tokens
        self.reserved = reserved_output_tokens
        self.encoding = tiktoken.get_encoding(tokenizer)

        # 各部分优先级（数字越小优先级越高）
        self.priorities = {
            "system_instruction": 1,
            "tools": 2,
            "user_message": 3,
            "memories": 4,
            "knowledge": 5,
            "chat_history": 6
        }

    def count_tokens(self, text: str) -> int:
        return len(self.encoding.encode(text))

    def assemble(self, context: Context) -> str:
        """组装最终上下文"""

        available_tokens = self.max_tokens - self.reserved
        components = []
        used_tokens = 0

        # 按优先级排序组装
        parts = [
            ("system_instruction", context.system_instruction),
            ("tools", self._format_tools(context.tools)),
            ("user_message", context.user_message),
            ("memories", self._format_memories(context.memories)),
            ("knowledge", self._format_knowledge(context.knowledge)),
            ("chat_history", self._format_history(context.chat_history)),
        ]

        parts.sort(key=lambda x: self.priorities[x[0]])

        for name, content in parts:
            tokens_needed = self.count_tokens(content)

            if used_tokens + tokens_needed <= available_tokens:
                components.append((name, content))
                used_tokens += tokens_needed
            else:
                # 尝试截断
                remaining = available_tokens - used_tokens
                truncated = self._truncate(content, remaining)
                if truncated:
                    components.append((name, truncated))
                    used_tokens += self.count_tokens(truncated)
                break

        return self._format_prompt(components)

    def _format_prompt(self, components: List[tuple]) -> str:
        """格式化最终 Prompt"""
        sections = {
            "system_instruction": "## System Instructions\n{content}\n",
            "tools": "## Available Tools\n{content}\n",
            "memories": "## Relevant Memories\n{content}\n",
            "knowledge": "## Retrieved Knowledge\n{content}\n",
            "chat_history": "## Conversation History\n{content}\n",
            "user_message": "## Current User Message\n{content}\n",
        }

        result = []
        for name, content in components:
            if content and name in sections:
                result.append(sections[name].format(content=content))

        return "\n".join(result)

    def _truncate(self, text: str, max_tokens: int) -> str:
        """智能截断"""
        tokens = self.encoding.encode(text)
        if len(tokens) <= max_tokens:
            return text
        return self.encoding.decode(tokens[:max_tokens]) + "..."
```

### 6.4 主动意图推断

论文 [1] 强调 Context Engineering 应使 Agent 能够**主动推断**用户未明确表达的需求：

> "Proactive Intent Inference: learn user preference from dialogue history and personal data; infer hidden goals from related queries; detect user struggles and offer proactive assistance."

```python
# Agentic AI Engine - 意图推断器
class IntentInferrer:
    """主动意图推断器"""

    def __init__(self, llm_client, memory_service):
        self.llm = llm_client
        self.memory = memory_service

    async def infer_hidden_intent(
        self,
        user_id: str,
        current_query: str,
        chat_history: List[Dict]
    ) -> Dict:
        """推断用户隐藏意图"""

        # 检索用户偏好
        preferences = await self.memory.search_memory(
            user_id=user_id,
            query="user preferences and habits"
        )

        prompt = f"""Analyze the user's query and conversation history to infer their hidden intent.

User Query: {current_query}

Recent Conversation:
{chat_history}

Known User Preferences:
{preferences}

Infer:
1. Explicit Intent: What the user is directly asking for
2. Hidden Intent: What the user might actually need but didn't explicitly say
3. Potential Follow-ups: What the user might ask next
4. Proactive Suggestions: What help we can offer proactively

Return as JSON.
"""
        return await self.llm.generate_json(prompt)
```

---

## 7. 主流框架对比总结

### 7.1 核心概念映射

| 概念           | Google ADK [3-6]       | Agno [7-10]                   | LangGraph [11-12]         |
| :------------- | :--------------------- | :---------------------------- | :------------------------ |
| **会话容器**   | Session                | Session (session_id)          | Thread (checkpointer)     |
| **临时状态**   | session.state          | session_state                 | State (graph state)       |
| **对话历史**   | session.events         | chat_history                  | messages                  |
| **长期记忆**   | MemoryService          | Memory (enable_user_memories) | Store                     |
| **知识库/RAG** | (需自行实现)           | Knowledge                     | VectorStore / Retriever   |
| **上下文缓存** | ContextCacheConfig     | 依赖 LLM Provider             | 依赖 LLM Provider         |
| **上下文压缩** | EventsCompactionConfig | session_summary               | trim_messages / summarize |
| **持久化**     | SessionService         | Database                      | Checkpointer              |

### 7.2 各框架优劣势

| 框架           | 优势                                                                           | 劣势                                              |
| :------------- | :----------------------------------------------------------------------------- | :------------------------------------------------ |
| **Google ADK** | ✅ 清晰的 Service 抽象<br>✅ 与 Vertex AI 深度集成<br>✅ 多语言支持 [3]        | ❌ MemoryBank 强依赖 Vertex AI<br>❌ 社区生态较新 |
| **Agno**       | ✅ 开发体验极佳（配置驱动）<br>✅ Memory 开箱即用<br>✅ Team 多 Agent 支持 [7] | ❌ 相对封闭的生态<br>❌ 文档深度有限              |
| **LangGraph**  | ✅ 状态管理优秀<br>✅ 复杂工作流支持<br>✅ 社区活跃 [11]                       | ❌ 配置复杂度高<br>❌ 调试困难                    |

### 7.3 选型建议

```mermaid
graph TD
    Q1{需要 Google Cloud 集成?}
    Q2{需要复杂工作流?}
    Q3{需要快速开发?}

    Q1 -->|是| ADK["选择 Google ADK"]
    Q1 -->|否| Q2

    Q2 -->|是| LG["选择 LangGraph"]
    Q2 -->|否| Q3

    Q3 -->|是| AGNO["选择 Agno"]
    Q3 -->|否| CUSTOM["自定义实现"]

    style ADK fill:#4285f4,stroke:#1a73e8,color:#fff
    style LG fill:#ff6b35,stroke:#e85a2e,color:#fff
    style AGNO fill:#10b981,stroke:#059669,color:#fff
    style CUSTOM fill:#6366f1,stroke:#4f46e5,color:#fff
```

---

## 8. 技术架构建议

### 8.1 OceanBase 统一存储架构

基于调研，建议以下统一 Schema 设计：

```mermaid
erDiagram
    agent_sessions ||--o{ session_events : contains
    agent_sessions ||--o| session_state : has
    agent_sessions }o--|| agent_memories : consolidates_to
    users ||--o{ agent_sessions : owns
    users ||--o{ agent_memories : owns

    users {
        string user_id PK
        string name
        json preferences
        timestamp created_at
    }

    agent_sessions {
        string session_id PK
        string user_id FK
        string app_name
        string agent_id
        timestamp created_at
        timestamp updated_at
    }

    session_events {
        bigint event_id PK
        string session_id FK
        string event_type
        json event_data
        int token_count
        timestamp created_at
    }

    session_state {
        string session_id FK
        json session_data
        json user_data
        json app_data
        timestamp updated_at
    }

    agent_memories {
        string memory_id PK
        string user_id FK
        string app_name
        text content
        vector embedding
        json topics
        float importance_score
        int access_count
        timestamp created_at
        timestamp updated_at
    }
```

### 8.2 统一 Service 接口设计

```python
# Agentic AI Engine - 统一 Service 接口
from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class BaseSessionService(ABC):
    """会话服务抽象基类"""

    @abstractmethod
    async def create_session(
        self, user_id: str, app_name: str, agent_id: str
    ) -> str: ...

    @abstractmethod
    async def get_session(
        self, session_id: str
    ) -> Optional[Dict]: ...

    @abstractmethod
    async def append_event(
        self, session_id: str, event_type: str, event_data: Dict
    ) -> int: ...

    @abstractmethod
    async def update_state(
        self, session_id: str, state_delta: Dict
    ) -> None: ...

class BaseMemoryService(ABC):
    """记忆服务抽象基类"""

    @abstractmethod
    async def add_memory(
        self, user_id: str, content: str, topics: List[str], importance: float
    ) -> str: ...

    @abstractmethod
    async def search_memory(
        self, user_id: str, query: str, limit: int = 10
    ) -> List[Dict]: ...

    @abstractmethod
    async def update_access(
        self, memory_id: str
    ) -> None: ...

class OceanBaseSessionService(BaseSessionService):
    """OceanBase 会话服务实现"""

    def __init__(self, connection_pool):
        self.pool = connection_pool

    async def create_session(self, user_id: str, app_name: str, agent_id: str) -> str:
        session_id = str(uuid.uuid4())
        await self.pool.execute("""
            INSERT INTO agent_sessions (session_id, user_id, app_name, agent_id)
            VALUES (?, ?, ?, ?)
        """, [session_id, user_id, app_name, agent_id])
        return session_id

    async def append_event(self, session_id: str, event_type: str, event_data: Dict) -> int:
        result = await self.pool.execute("""
            INSERT INTO session_events (session_id, event_type, event_data, token_count)
            VALUES (?, ?, ?, ?)
            RETURNING event_id
        """, [session_id, event_type, json.dumps(event_data), self._count_tokens(event_data)])
        return result[0]["event_id"]

class OceanBaseMemoryService(BaseMemoryService):
    """OceanBase 记忆服务实现"""

    def __init__(self, connection_pool, embedding_client):
        self.pool = connection_pool
        self.embedder = embedding_client

    async def search_memory(self, user_id: str, query: str, limit: int = 10) -> List[Dict]:
        query_embedding = await self.embedder.embed(query)

        return await self.pool.execute("""
            SELECT
                memory_id, content, topics, importance_score,
                vec_l2_distance(embedding, ?) as distance
            FROM agent_memories
            WHERE user_id = ?
            ORDER BY distance ASC
            LIMIT ?
        """, [query_embedding, user_id, limit])
```

### 8.3 记忆检索 SQL 示例

```sql
-- 混合检索：语义相似度 + 时间邻近性 + 访问频率
SELECT
    memory_id,
    content,
    topics,
    -- 综合评分 (值越小越相关)
    (
        0.5 * vec_l2_distance(embedding, :query_embedding) +
        0.3 * (DATEDIFF(NOW(), updated_at) / 30.0) +
        0.2 * (1.0 - access_count / (SELECT MAX(access_count) FROM agent_memories WHERE user_id = :user_id))
    ) AS relevance_score
FROM agent_memories
WHERE user_id = :user_id
  AND app_name = :app_name
  AND vec_l2_distance(embedding, :query_embedding) < 0.8
ORDER BY relevance_score ASC
LIMIT 10;
```

---

## 9. 与项目 Roadmap 的结合建议

### 9.1 Phase 2: Memory Management

**论文指导**：记忆分层架构 + 记忆迁移机制 [1]

**行动建议**：

1. **短期记忆 (Session Log)**

   - 使用 OceanBase 表存储 `session_events`（append-only）
   - 利用 OceanBase 事务保证 `state_delta` 的原子应用

2. **长期记忆 (Insights)**

   - 设计 `agent_memories` 表，包含向量列
   - 实现 Memory Transfer 函数

3. **记忆选择策略**
   - 实现基于 Recency + Frequency + Semantic Similarity 的混合检索
   - 利用 `DBMS_HYBRID_SEARCH` 实现 SQL 层面的混合检索

### 9.2 Phase 3: Context Engineering (RAG & Assembler)

**论文指导**：Context Compression + Context Isolation + Proactive Inference [1]

**行动建议**：

1. **统一检索链路**

   - 在单次 SQL 查询中同时检索 Session Context + Long-term Memory
   - 实现 `OceanBaseMemoryService.search_memory()` 返回 Fused Context

2. **上下文压缩**

   - 参考 ADK 的 EventsCompactionConfig 设计
   - 在 OceanBase 中可通过 Stored Procedure 或应用层实现滑动窗口摘要

3. **动态上下文组装 (Context Budgeting)**
   - 在数据库层估算 Token 大小
   - 实现 Top-K 截断，确保不超过 Context Window

### 9.3 Phase 4: Framework Integration

**论文指导**：上下文共享 + 跨 Agent 通信 [1]

**行动建议**：

1. **ADK Adapter 优先**

   - 实现 `OceanBaseSessionService` 和 `OceanBaseMemoryService`
   - 遵循 ADK 的 Service 抽象，确保与 Google 生态的兼容性

2. **多框架支持**

   - 为 LangGraph 实现 `Checkpointer` + `Store` 双角色
   - 为 Agno 实现 `Database` 接口

3. **A2A Protocol 预研**
   - 关注 Google 的 Agent-to-Agent 开放协议
   - 考虑 OceanBase 作为 Agent 间上下文共享的中央存储

---

## 10. 趋势与挑战

### 10.1 Era 3.0 挑战

根据论文 [1] 预测，未来的 Context Engineering 将面临：

1. **终身上下文保存**：如何可靠存储用户一生的交互上下文？
2. **语义一致性**：随着数据规模膨胀，如何保持语义的准确性？
3. **动态更新**：如何处理过时信息和知识冲突？
4. **隐私与安全**：如何在保护用户隐私的同时提供个性化服务？

### 10.2 OceanBase 的潜在优势

1. **强一致性 (ACID)**：事务级保证避免"记忆分裂"
2. **HTAP 能力**：高频写入 + 复杂分析查询的统一处理
3. **多地多活 (Paxos)**：跨区域记忆一致性
4. **Hybrid Search**：SQL + Vector 的原生混合检索
5. **高可用性**：99.999% SLA 保障关键记忆不丢失

---

## 11. 结论

Context Engineering 是 AI Agent 系统从"玩具"迈向"生产"的关键技术。本报告系统性地梳理了：

1. **理论框架**：从 Dey (2001) 的定义到 SII-GAIR (2025) 的形式化演进
2. **三大支柱**：Collection、Management、Usage 的完整技术栈
3. **框架对比**：Google ADK、Agno、LangGraph 的实现策略
4. **项目实践**：OceanBase 统一存储 + 统一 Service 接口的架构设计

> [!TIP] > **下一步行动**：
>
> 1. 验证 OceanBase Vector 查询性能
> 2. 实现 `OceanBaseSessionService` 和 `OceanBaseMemoryService`
> 3. 构建 Context Assembler 组件
> 4. 集成至 Google ADK 框架

---

## 参考文献

[1] SII-GAIR. (2025). _Context Engineering 2.0: The Context of Context Engineering_. arXiv preprint. [本地文件](../assets/context-engineering/Context%20Engineering%202.0:%20The%20Context%20of%20Context%20Engineering.pdf)

[2] Dey, A. K. (2001). _Understanding and Using Context_. Personal and Ubiquitous Computing, 5(1), 4-7. [本地文件](../assets/context-engineering/Understanding%20and%20Using%20Context.pdf)

[3] Google ADK - Context. https://google.github.io/adk-docs/context/

[4] Google ADK - Sessions, State, Memory Overview. https://google.github.io/adk-docs/sessions/

[5] Google ADK - State. https://google.github.io/adk-docs/sessions/state/

[6] Google ADK - Memory. https://google.github.io/adk-docs/sessions/memory/

[7] Agno - Context Engineering. https://docs.agno.com/basics/context/overview

[8] Agno - Memory. https://docs.agno.com/basics/memory/overview

[9] Agno - Knowledge. https://docs.agno.com/basics/knowledge/overview

[10] Agno - Sessions. https://docs.agno.com/basics/sessions

[11] LangGraph - Overview. https://docs.langchain.com/oss/python/langgraph/overview

[12] LangGraph - Persistence & Memory. https://langchain-ai.github.io/langgraph/ (通过浏览器采集)
