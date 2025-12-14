# 开发与维护手册

## 开发环境设置

### 环境要求

- Python 3.12+
- Git
- Docker & Docker Compose
- Claude API Key
- 代码编辑器（推荐 VS Code）

### 本地开发设置

```bash
# 1. 克隆仓库
git clone https://github.com/ThreeFish-AI/agentic-ai-papers.git
cd agentic-ai-papers

# 2. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac

# 3. 安装依赖
uv pip install -e ".[dev]"

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 添加 ANTHROPIC_API_KEY

# 5. 启动开发服务器
uvicorn agents.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Docker 开发环境

```bash
# 启动开发环境
docker-compose up --build

# 后台运行
docker-compose up -d

# 启动包含 MCP 服务的完整环境
docker-compose --profile mcp up
```

## MCP 深度集成开发

### MCP 架构概览

```mermaid
graph TB
    subgraph "Claude Code"
        A[Agent Layer<br/>6个专用Agent]
        B[Skill Layer<br/>7个核心技能]
    end

    subgraph "MCP 服务器"
        C[data-extractor<br/>PDF/网页数据]
        D[time<br/>时间管理]
        E[filesystem<br/>文件操作]
        F[zai-mcp-server<br/>图像分析]
        G[web-search-prime<br/>增强搜索]
        H[web-reader<br/>内容提取]
    end

    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    B --> G
    B --> H

    style C fill:#e3f2fd
    style D fill:#e8f5e9
    style E fill:#fff3e0
    style F fill:#fce4ec
    style G fill:#f3e5f5
    style H fill:#e0f2f1
```

### 7 大核心技能详解

| 技能名称               | 功能描述                           | 典型用例         |
| ---------------------- | ---------------------------------- | ---------------- |
| **pdf-reader**         | PDF 文档解析，支持图像、表格、公式 | 提取学术论文内容 |
| **zh-translator**      | 中文学术文档翻译，保留格式         | 论文中文化       |
| **web-translator**     | 网页内容抓取转换                   | 在线资源本地化   |
| **batch-processor**    | 批量文档处理协调                   | 大规模文档处理   |
| **markdown-formatter** | Markdown 格式优化                  | 后翻译格式整理   |
| **heartfelt**          | 深度理解分析                       | 知识提炼感悟     |
| **data-extractor**     | 结构化数据提取                     | 信息挖掘整理     |

### MCP 调用模式

```python
# 直接 MCP 工具调用示例
async def process_paper_workflow():
    # 1. 提取PDF内容
    pdf_result = await mcp__data_extractor__convert_pdf_to_markdown(
        pdf_source="/papers/source/example.pdf",
        extract_images=True,
        extract_tables=True,
        extract_formulas=True
    )

    # 2. 翻译内容
    if pdf_result.success:
        translation = await zh_translator(
            content=pdf_result.markdown_content
        )

    # 3. 保存结果
    await mcp__filesystem__write_file(
        path="/papers/translation/example.md",
        content=translation.translated_content
    )

    # 4. 深度分析
    await heartfelt(
        document_path="/papers/translation/example.md"
    )
```

### 批处理最佳实践

```mermaid
sequenceDiagram
    participant U as User
    participant BA as Batch Agent
    participant BP as Batch Processor
    participant Skills as MCP Skills
    participant FS as Filesystem

    U->>BA: 提交大文档
    BA->>BA: 分析文档大小
    BA->>BP: 创建批处理计划

    loop 每个批次
        Note over BP: 30页/批次<br/>60段/批次<br/>6000字/批次
        BP->>Skills: 并发处理(最大3)
        Skills-->>BP: 返回处理结果
        BP->>FS: 保存批次结果
    end

    BP->>BP: 合并所有批次
    BP-->>BA: 返回最终结果
    BA-->>U: 完成通知
```

## 6 大专用 Agent 开发

### Agent 架构

```python
# 基础 Agent 类
from agents.claude.base import BaseAgent

class CustomAgent(BaseAgent):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.agent_name = "custom"
        self.required_skills = ["skill1", "skill2"]

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        # 1. 验证输入
        if not self.validate_input(input_data):
            raise ValueError("Invalid input")

        # 2. 调用技能
        result = await self.call_skill("skill1", input_data)

        # 3. 处理结果
        return self._process_result(result)
```

### 1. PDF 处理 Agent

```python
class PDFProcessingAgent(BaseAgent):
    """PDF文档处理专用Agent"""

    def __init__(self, config):
        super().__init__(config)
        self.required_skills = ["pdf-reader", "batch-processor"]

    async def process(self, pdf_path: str) -> Dict:
        # 大文件自动分批处理
        file_info = await mcp__filesystem__get_file_info(pdf_path)

        if file_info.size > 50 * 1024 * 1024:  # 50MB
            # 使用批处理
            return await self._batch_process(pdf_path)
        else:
            # 直接处理
            return await mcp__data_extractor__convert_pdf_to_markdown(
                pdf_source=pdf_path,
                extract_images=True,
                extract_tables=True
            )
```

### 2. 翻译 Agent

```python
class TranslationAgent(BaseAgent):
    """学术论文翻译专用Agent"""

    def __init__(self, config):
        super().__init__(config)
        self.terminology_cache = {}

    async def process(self, content: str, domain: str = "ai") -> Dict:
        # 1. 术语提取
        terms = await self._extract_terms(content, domain)

        # 2. 批量翻译
        result = await zh_translator(
            content=content,
            preserve_formatting=True,
            terminology=terms
        )

        # 3. 术语一致性检查
        await self._check_terminology_consistency(result)

        return result
```

### 3. 批处理 Agent

```python
class BatchProcessingAgent(BaseAgent):
    """批量处理协调Agent"""

    async def process_batch(self, documents: List[str]) -> Dict:
        # 创建批处理任务
        batches = self._create_batches(documents)

        # 并发执行
        semaphore = asyncio.Semaphore(3)  # 最大并发数
        tasks = [
            self._process_with_limit(batch, semaphore)
            for batch in batches
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 合并结果
        return self._merge_results(results)
```

## API 开发模式

### FastAPI 应用结构

```python
# agents/api/main.py
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(
    title="Agentic AI Papers API",
    version="2.0.0"
)

# 性能优化中间件
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### 路由定义示例

```python
# agents/api/routes/papers.py
from fastapi import APIRouter, UploadFile, BackgroundTasks
from agents.api.services.paper_service import PaperService

router = APIRouter(prefix="/api/papers", tags=["papers"])

@router.post("/upload")
async def upload_paper(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    service: PaperService = Depends()
):
    # 异步处理大文件
    task_id = await service.create_processing_task(file)

    # 后台执行
    background_tasks.add_task(
        service.process_paper,
        task_id,
        file.file_path
    )

    return {"task_id": task_id, "status": "processing"}
```

### WebSocket 实时进度

```python
@router.websocket("/ws/progress/{task_id}")
async def progress_ws(websocket: WebSocket, task_id: str):
    await websocket.accept()

    async for progress in service.stream_progress(task_id):
        await websocket.send_json({
            "task_id": task_id,
            "progress": progress.current,
            "total": progress.total,
            "status": progress.status
        })
```

## 性能优化策略

### 批处理优化

```python
# 批处理配置
BATCH_LIMITS = {
    "max_pages": 30,      # PDF页数/批次
    "max_paragraphs": 60, # 段落数/批次
    "max_words": 6000,    # 字数/批次
    "max_concurrent": 3   # 最大并发批次
}

class BatchProcessor:
    def __init__(self, limits=BATCH_LIMITS):
        self.limits = limits
        self.semaphore = asyncio.Semaphore(limits["max_concurrent"])

    async def process_document(self, doc_path: str):
        # 1. 分析文档
        doc_info = await self._analyze_document(doc_path)

        # 2. 计算批次
        batches = self._calculate_batches(doc_info)

        # 3. 并发处理
        results = []
        for batch in batches:
            async with self.semaphore:
                result = await self._process_batch(batch)
                results.append(result)

        # 4. 合并结果
        return self._merge_results(results)
```

### 内存管理

```python
# 流式处理大文件
async def stream_process_large_file(file_path: str):
    chunk_size = 1024 * 1024  # 1MB chunks

    async with aiofiles.open(file_path, 'rb') as f:
        while chunk := await f.read(chunk_size):
            # 处理数据块
            await process_chunk(chunk)

            # 及时释放
            del chunk
            gc.collect()
```

### 缓存策略

```python
from functools import lru_cache
import diskcache as dc

# 多级缓存
cache = dc.Cache("./cache")

@lru_cache(maxsize=128)
async def get_cached_translation(key: str):
    # L1: 内存缓存
    if cached := cache.get(key):
        return cached

    # L2: 磁盘缓存
    result = await translate(key)
    cache.set(key, result, expire=3600)

    return result
```

## 测试策略

### 测试结构

```
tests/
├── unit/          # 单元测试
├── integration/   # 集成测试
├── e2e/          # 端到端测试
├── fixtures/     # 测试数据
└── conftest.py   # 测试配置
```

### MCP 技能测试

```python
@pytest.mark.asyncio
async def test_pdf_processing():
    # 测试PDF提取
    result = await mcp__data_extractor__convert_pdf_to_markdown(
        pdf_source="tests/fixtures/sample.pdf"
    )

    assert result.success
    assert "markdown_content" in result
    assert len(result.markdown_content) > 0
```

### Agent 集成测试

```python
@pytest.mark.asyncio
async def test_translation_workflow():
    agent = TranslationAgent(test_config)

    # 模拟处理流程
    result = await agent.process({
        "content": "Sample AI paper content...",
        "source_lang": "en",
        "target_lang": "zh"
    })

    assert result["success"]
    assert "translated_content" in result
```

## Docker 最佳实践

### Dockerfile 优化

```dockerfile
# 多阶段构建
FROM python:3.12-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages .
COPY . .

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:8000/health || exit 1
```

### Docker Compose 配置

```yaml
version: "3.8"
services:
  api:
    build: .
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./papers:/app/papers
      - ./cache:/app/cache

  mcp-data-extractor:
    image: mcp-data-extractor:latest
    profiles: ["mcp"]

  # 开发环境热重载
  dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/__pycache__
    command: uvicorn --reload agents.api.main:app
```

## 安全考虑

### API 安全

```python
# 输入验证
from pydantic import BaseModel, validator

class PaperUploadRequest(BaseModel):
    title: str
    content: str

    @validator('content')
    def validate_content(cls, v):
        if len(v) > 10 * 1024 * 1024:  # 10MB limit
            raise ValueError('Content too large')
        return v
```

### 敏感信息保护

```python
# API密钥管理
class SecureConfig:
    def __init__(self):
        self.api_key = self._decrypt(
            os.environ.get("ENCRYPTED_API_KEY")
        )

    def _decrypt(self, encrypted: str) -> str:
        # 使用Fernet解密
        key = os.environ.get("MASTER_KEY").encode()
        cipher = Fernet(key)
        return cipher.decrypt(encrypted.encode()).decode()
```

## 贡献指南

### 开发流程

```mermaid
flowchart LR
    A[Fork仓库] --> B[创建功能分支]
    B --> C[编写代码]
    C --> D[编写测试]
    D --> E[本地测试]
    E --> F{测试通过?}
    F -->|否| C
    F -->|是| G[提交PR]
    G --> H[代码审查]
    H --> I[自动测试]
    I --> J{CI通过?}
    J -->|否| H
    J -->|是| K[合并主分支]
```

### 提交规范

```bash
# 使用Conventional Commits
feat(agent): 添加新的翻译Agent
fix(api): 修复WebSocket连接问题
docs(readme): 更新安装说明
perf(batch): 优化批处理性能
```

## 性能监控

### 关键指标

- **API 响应时间**: 目标 < 1 秒
- **批处理吞吐量**: 目标 > 100 页/分钟
- **内存使用**: 稳定在 2GB 以内
- **错误率**: 目标 < 1%

### 监控实现

```python
# Prometheus指标
from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter('api_requests_total', 'Total API requests')
REQUEST_DURATION = Histogram('api_request_duration_seconds', 'Request duration')

@app.middleware("http")
async def monitor_requests(request, call_next):
    start_time = time.time()

    response = await call_next(request)

    REQUEST_COUNT.inc()
    REQUEST_DURATION.observe(time.time() - start_time)

    return response
```

## 故障排查

### 常见问题

1. **MCP 服务不可用**

   ```bash
   # 检查MCP服务状态
   docker ps | grep mcp
   # 重启服务
   docker-compose restart mcp-data-extractor
   ```

2. **批处理内存溢出**

   ```python
   # 减小批次大小
   BATCH_LIMITS["max_pages"] = 20
   BATCH_LIMITS["max_words"] = 4000
   ```

3. **翻译质量不一致**
   ```python
   # 启用术语缓存
   agent = TranslationAgent({
       "use_terminology_cache": True,
       "domain": "computer_science"
   })
   ```

### 日志配置

```python
# 结构化日志
import structlog

logger = structlog.get_logger()

logger.info(
    "Processing document",
    document_id=doc_id,
    batch_id=batch_id,
    progress=0.5
)
```

## Web UI 开发前瞻

### 技术栈建议

- **前端框架**: React + TypeScript
- **状态管理**: Zustand
- **UI 组件**: Ant Design
- **实时通信**: WebSocket
- **构建工具**: Vite

### API 集成规范

```typescript
// API客户端示例
class PapersAPI {
  private ws: WebSocket;

  async uploadPaper(file: File): Promise<TaskId> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/papers/upload", {
      method: "POST",
      body: formData,
    });

    return response.json();
  }

  subscribeToProgress(taskId: TaskId, callback: Callback) {
    this.ws = new WebSocket(`/ws/progress/${taskId}`);
    this.ws.onmessage = (event) => {
      callback(JSON.parse(event.data));
    };
  }
}
```

### 实时进度展示

```mermaid
graph TD
    A[用户上传文件] --> B[创建任务]
    B --> C[WebSocket连接]
    C --> D[实时推送进度]
    D --> E[前端更新UI]
    E --> F[完成通知]

    style D fill:#e8f5e9
    style E fill:#e3f2fd
```

## 发布流程

### 版本管理

使用语义化版本 (SemVer)：

- **主版本**: 不兼容的 API 修改
- **次版本**: 向下兼容的新功能
- **修订号**: 向下兼容的问题修正

### 自动发布

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
```

---

_最后更新: 2025-12-14_
_版本: 2.0.0_
