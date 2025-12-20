# 系统架构框架

## 架构总览

Agentic AI Papers 采用分层异步架构，包含 5 个核心 Agent、FastAPI 服务层和 Next.js 前端。

```mermaid
flowchart TD
    %% 用户交互层
    subgraph UserLayer [用户交互层]
        A[API Client<br/>REST/HTTP]
        B[Web UI<br/>Next.js MVP]
    end

    %% API 网关层
    subgraph GatewayLayer [API 服务层]
        C[FastAPI<br/>异步网关]
        D[WebSocket<br/>实时更新]
    end

    %% 路由层
    subgraph RouteLayer [API 路由]
        E["papers<br/>论文管理"]
        F["tasks<br/>任务管理"]
        G["health<br/>健康检查"]
    end

    %% 服务层
    subgraph ServiceLayer [业务服务]
        H[PaperService]
        I[TaskService]
        J[WebSocketService]
    end

    %% Agent 智能层
    subgraph AgentLayer [Agent 层 - 5 个]
        K[WorkflowAgent<br/>流程编排]
        L[PDFAgent<br/>PDF 处理]
        M[TranslationAgent<br/>翻译处理]
        N[BatchAgent<br/>批量处理]
        O[HeartfeltAgent<br/>深度分析]
    end

    %% Skills 能力层
    subgraph SkillLayer [Claude Skills - 7 个]
        P[pdf-reader]
        Q[zh-translator]
        R[doc-translator]
        S[markdown-formatter]
        T[web-translator]
        U[batch-processor]
        V[heartfelt]
    end

    %% 存储层
    subgraph StorageLayer [文件存储]
        Z1[papers/source/<br/>51 篇原始文档]
        Z2[papers/translation/<br/>16 篇翻译]
        Z3[papers/heartfelt/<br/>16 篇分析]
    end

    %% 连接关系
    A --> C
    B --> C
    C --> D
    C --> E
    C --> F
    C --> G

    E --> H
    F --> I
    D --> J

    H --> K
    I --> N
    K --> L
    K --> M
    K --> O

    L --> P
    M --> Q
    M --> R
    M --> S
    O --> V

    H --> Z1
    H --> Z2
    H --> Z3

    %% 样式
    classDef userUI fill:#61DAFB,stroke:#2171B5,color:#fff
    classDef api fill:#2196F3,stroke:#1976D2,color:#fff
    classDef service fill:#00BCD4,stroke:#0097A7,color:#fff
    classDef agent fill:#9C27B0,stroke:#7B1FA2,color:#fff
    classDef skill fill:#673AB7,stroke:#512DA8,color:#fff
    classDef storage fill:#FF9800,stroke:#F57C00,color:#fff

    class A,B userUI
    class C,D,E,F,G api
    class H,I,J service
    class K,L,M,N,O agent
    class P,Q,R,S,T,U,V skill
    class Z1,Z2,Z3 storage
```

## 目录结构

```bash
agentic-ai-papers/
├── agents/                 # 后端核心
│   ├── api/               # FastAPI 服务
│   │   ├── main.py        # 应用入口
│   │   ├── routes/        # API 路由 (papers, tasks, websocket)
│   │   ├── services/      # 业务逻辑 (paper_service, task_service)
│   │   └── models/        # Pydantic 数据模型
│   ├── claude/            # Agent 实现
│   │   ├── base.py        # BaseAgent 抽象基类
│   │   ├── workflow_agent.py    # 工作流编排
│   │   ├── pdf_agent.py         # PDF 处理
│   │   ├── translation_agent.py # 翻译处理
│   │   ├── batch_agent.py       # 批量处理
│   │   ├── heartfelt_agent.py   # 深度分析
│   │   └── skills.py            # Skill 调用封装 (Fallback 实现)
│   └── core/              # 核心组件
│       ├── config.py      # 配置管理
│       ├── exceptions.py  # 异常处理
│       └── utils.py       # 工具函数
├── .claude/skills/        # 7 个 Claude Skills
├── ui/                    # Next.js 前端 (MVP)
│   └── src/
│       ├── app/           # App Router 页面
│       ├── components/    # React 组件
│       ├── hooks/         # 自定义 Hooks (useApi, useWebSocket)
│       ├── store/         # Zustand 状态管理
│       └── services/      # API 服务
├── papers/                # 论文存储
│   ├── source/            # 51 篇原始文档
│   ├── translation/       # 16 篇翻译
│   └── heartfelt/         # 16 篇深度分析
├── tests/                 # 测试套件 (82% 覆盖率)
└── docs/                  # 文档
```

## Agent 架构

采用 Agent-Skill 分层模式，通过 Fallback 实现规避 Claude SDK 依赖问题。

```mermaid
classDiagram
    class BaseAgent {
        <<abstract>>
        +name: str
        +config: dict
        +process(input_data) dict
        +call_skill(skill_name, params) dict
        +batch_call_skill(calls) list
        +validate_input(input_data) bool
    }

    class WorkflowAgent {
        +_full_workflow(source_path, paper_id)
        +_extract_workflow(source_path, paper_id)
        +_translate_workflow(source_path, paper_id)
        +_heartfelt_workflow(source_path, paper_id)
        +batch_process_papers(paper_paths, workflow_type)
        +get_workflow_status(paper_id)
    }

    class PDFProcessingAgent {
        +extract_content(pdf_path)
        +extract_images(pdf_path)
    }

    class TranslationAgent {
        +translate_content(content, target_lang)
        +preserve_formatting(content)
    }

    class HeartfeltAgent {
        +analyze_paper(content)
        +generate_insights(content)
    }

    class BatchAgent {
        +process_batch(documents)
        +parallel_process(tasks)
    }

    BaseAgent <|-- WorkflowAgent
    BaseAgent <|-- PDFProcessingAgent
    BaseAgent <|-- TranslationAgent
    BaseAgent <|-- HeartfeltAgent
    BaseAgent <|-- BatchAgent

    WorkflowAgent --> PDFProcessingAgent : orchestrates
    WorkflowAgent --> TranslationAgent : orchestrates
    WorkflowAgent --> HeartfeltAgent : orchestrates
```

## 技术栈

| 层级     | 技术选型                          |
| -------- | --------------------------------- |
| 前端     | Next.js 14 + TypeScript + Zustand |
| 后端     | FastAPI + Python 3.12 + asyncio   |
| Agent    | 自研 Agent + Fallback Skills      |
| 测试     | Pytest + Vitest + Playwright      |
| PDF 处理 | pypdf2 + pdfplumber               |
| 代码质量 | Ruff + MyPy                       |
| CI/CD    | GitHub Actions                    |

## 关键技术决策

| 决策               | 原因                                | 影响            |
| ------------------ | ----------------------------------- | --------------- |
| Fallback Skills    | 规避 Claude SDK jsonschema 兼容问题 | 功能完整可用    |
| 文件系统存储       | 简化部署，降低运维复杂度            | 零数据库依赖    |
| 异步优先架构       | 优化资源利用率，支持高并发          | 3x 并发处理能力 |
| Next.js App Router | 现代 React 架构，支持 SSR/RSC       | 良好 SEO 支持   |
| Pydantic Models    | 类型安全的 API 数据验证             | 自动文档生成    |

## 当前状态

| 模块     | 状态          | 说明                   |
| -------- | ------------- | ---------------------- |
| Agent 层 | ✅ 已完成     | 5 个 Agent 全部实现    |
| API 层   | ✅ 已完成     | papers/tasks/websocket |
| Skills   | ✅ 已完成     | 7 个 Fallback Skills   |
| Web UI   | ✅ MVP 已实现 | Next.js 论文管理页面   |
| 测试     | ✅ 82% 覆盖率 | Pytest + Vitest        |
| 数据库   | ⏳ 进行中     | OceanBase 向量存储     |
| 知识图谱 | ⏳ 调研中     | Cognee GraphRAG        |

## 下一步计划

- **存储增强**：OceanBase 向量索引集成
- **智能检索**：混合检索（关键词 + 向量）
- **知识图谱**：Cognee 论文关联分析
- **用户系统**：认证与个性化推荐

---

_最后更新：2025 年 12 月_
