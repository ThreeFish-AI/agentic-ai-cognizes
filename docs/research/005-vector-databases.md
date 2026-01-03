---
id: vector-databases
sidebar_position: 5
title: 向量数据库深度调研
last_update:
  author: Aurelius Huang
  created_at: 2025-12-23
  updated_at: 2026-01-01
  version: 1.2
  status: Pending Review
tags:
  - Vector Databases
  - PGVector
  - VectorChord
  - Milvus
  - Weaviate
  - Pinecone
  - Qdrant
---

> [!IMPORTANT]
>
> 在前置调研中，我们已经对主流 **ANN 向量索引算法**（HNSW / IVF / PQ / DiskANN 等）建立了比较完整的认识，并对市场上主流向量数据库做过一次“从全景到分层”的宏观梳理。接下来需要回答的问题，会从“向量检索为什么能跑、怎么跑得快”，收束到“在我的真实业务里，选哪一个能长期跑得稳、迭代成本最低”。
>
> 因此，本文会把调研范围进一步聚焦到 5 个最具代表性的候选：**Milvus、Weaviate、Pinecone、PGVector、VectorChord**，并从架构形态、能力边界、工程落地和 TCO 控制四个维度做更深入的对比。
>
> | 类型                            | 产品        | 核心特点                             |
> | ------------------------------- | ----------- | ------------------------------------ |
> | **PostgreSQL Extension**        | PGVector    | 官方扩展，与现有 PostgreSQL 完美集成 |
> |                                 | VectorChord | 高性能扩展，突破 PGVector 性能瓶颈   |
> | **Specialized Vector DataBase** | Milvus      | 开源分布式，支持百亿级向量           |
> |                                 | Weaviate    | AI-Native，内置向量化模块            |
> |                                 | Pinecone    | 全托管 SaaS，零运维                  |

---

## 1. PostgreSQL + PGVector

### 1.1 产品概述

**核心定位**：**PostgreSQL 用户的首选“零迁移”方案，用架构的统一性换取绝大多数业务场景下的“够用”性能。**

作为“改良派”向量数据库的标杆，PGVector 走了一条与其他竞品截然不同的**原生融合**路线。如果将独立向量数据库（如 Milvus）比作**专为赛道打造的 F1 赛车**，那么 PGVector 就像是**为你现有的家用 SUV 加装了一套高性能导航系统**。

- **F1 赛车（独立库）**：为了极致的检索速度和规模而生，但你需要付出昂贵的“赛道维护费”（独立的运维成本与基础设施）。
- **SUV 升级（PGVector）**：它依然是你那辆皮实耐用、通过性极好的座驾（ACID 事务、复杂查询，以及 PostgreSQL 的所有企业级特性）。你不需要换车（数据迁移），只需一次简单的改装，它就能带你驶向“语义检索”的新领域。

```mermaid
graph LR
    subgraph "PGVector：传统数据库的 AI 进化"
        direction LR
        A[PostgreSQL] --> B[结构化数据<br/>（ACID）]
        A --> C[+ PGVector 扩展]
        C --> D[向量检索能力<br/>（HNSW、IVFFlat）]
        B & D --> E[统一 SQL 查询]

        style A fill:#336791,color:#fff
        style C fill:#e67e22,color:#fff
        style E fill:#27ae60,color:#fff
    end
```

### 1.2 核心特性

| 特性          | 描述             | 技术规格                                      |
| ------------- | ---------------- | --------------------------------------------- |
| **向量类型**  | 支持多种向量格式 | vector (FP32)、halfvec (FP16)、bit、sparsevec |
| **最大维度**  | 单精度向量       | 2,000 维（HNSW）/ 16,000 维（存储）           |
| **距离函数**  | 6 种度量方式     | L2、内积、余弦、L1、汉明、Jaccard             |
| **索引类型**  | 近似最近邻       | HNSW、IVFFlat                                 |
| **ACID 支持** | 完整事务保证     | ✅ 支持                                       |

### 1.3 向量数据类型

选择向量精度就像选择**图片格式**：

- **vector (FP32)**：**RAW 格式**。精度无损，细节最全，但体积最大。
- **halfvec (FP16)**：**高清 JPEG**。**推荐首选**。肉眼（模型）难以分辨差异，但空间节省一半，速度更快。
- **bit**：**黑白位图**。极致压缩，仅适用于特定二值化场景。
- **sparsevec**：**稀疏向量**。仅存储非零元素，适用于稀疏向量场景。

```sql
CREATE TABLE items (
    id bigserial PRIMARY KEY,
    -- 推荐：大多数 AI 场景使用 halfvec 平衡性能与成本
    embedding halfvec(1536)
);

-- 插入操作（PGVector 会自动处理类型转换）
INSERT INTO items (embedding) VALUES ('[1.1, 2.2, 3.3, ...]');
```

### 1.4 距离度量

计算相似度，取决于你手里拿的是哪把**尺子**：

- **Cosine (<=>)**：**指南针**。只看**方向**是否一致，不看长短。**语义搜索（NLP）的标准尺子**。
- **L2 (<->)**：**直尺**。测量两点间的绝对距离。常用于图像或音频的物理特征匹配。
- **Inner Product (<#>)**：**投影仪**。计算向量的投影强度。在向量归一化后，它是最高效的替代方案。

| 操作符 | 距离类型     | 核心场景       | 备注             |
| :----- | :----------- | :------------- | :--------------- |
| `<=>`  | 余弦距离     | 语义相似度     | 推荐用于文本嵌入 |
| `<->`  | L2 欧氏距离  | 图片/音频搜索  | 物理特征         |
| `<#>`  | 负内积       | 高性能推荐系统 | 需归一化         |
| `<+>`  | L1 距离      | 曼哈顿距离     | 特定场景         |
| `<~>`  | 汉明距离     | 二进制向量     | bit 类型专用     |
| `<%>`  | Jaccard 距离 | 二进制向量     | bit 类型专用     |

### 1.5 索引算法

> [!TIP]
>
> 索引是面对海量数据的**导航策略**：
>
> - **HNSW（Hierarchical Navigable Small World，分层导航小世界图）**：**立体交通网**（Graph）。利用高速公路和立体枢纽实现跨越式寻找。**性能最强（首选）**，但像修路一样成本高（构建慢）、占地大（吃内存）。
> - **IVFFlat（Inverted File with Flat Clustering，倒排文件与平面聚类）**：**行政区划图**（Cluster）。把城市划分为若干个方格（聚类列表），只去目标所在的方格里找。**简单省地（不仅省内存，还能快速构建）**，但前提是必须先有人（数据）才能划分区域。
>
> 💡 算法底层原理及技术细节请参阅 [003-vector-search-algorithm](./003-vector-search-algorithm.md)。

#### 1.5.1 HNSW 索引

HNSW 是目前综合性能最好的索引算法，实现了**速度与召回率的最佳平衡**。

```sql
-- 创建 HNSW 索引
-- m: 每层最大连接数（默认 16，建议 16-64），"路口"的分岔数。分岔越多搜索越快，但路也越宽（内存占用↑）。
-- ef_construction: 构建时搜索宽度（默认 64，建议 100-200）。建路时的探索范围。范围越大路网质量越好，但修路越慢。
CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ef_search: 查询时搜索宽度（默认 40，建议 100-200）。
SET hnsw.ef_search = 100;
```

#### 1.5.2 IVFFlat 索引

IVFFlat 是一种基于聚类的倒排索引，构建速度快，内存占用低，适合**内存受限**的场景，但查询性能稍逊于 HNSW。

```sql
-- 创建 IVFFlat 索引
-- ⚠️ 必须表中已有数据（建议 >10万行）才能计算聚类中心
-- lists: 把数据划分成多少个“格子”。rows < 1M: lists = rows / 1000；rows >= 1M: lists = sqrt(rows)。
CREATE INDEX ON items USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);

-- probes: 探针数，每次查询要翻找最近的几个“格子”（查询时 SET ivfflat.probes）。
SET ivfflat.probes = 10;  -- 建议 sqrt(lists)
```

### 1.6 过滤与混合查询策略

现实查询往往带有条件（`WHERE`）。这就像在找人（相似度）的同时，要求他必须穿红衣服（过滤）：

- **先筛选（列索引）**：**按名单点名**。如果穿红衣服的人极少，直接把他们叫出来逐个比对长相最快。
- **先检索（向量索引）**：**广场扫视**。如果穿红衣服的人满大街都是，直接在广场上找长得像的人，大概率他正好穿红衣服。
- **专用分区（部分索引/分区）**：**VIP 包间**。如果经常只在“红衣俱乐部”里找人，干脆把他们单独关在一个房间搜，互不干扰，效率最高。

#### 1.6.1 策略选择指南

```sql
-- 混合查询：既要“长得像”，又要“满足条件”
SELECT * FROM items WHERE category_id = 123 ORDER BY embedding <-> '[3,1,2]' LIMIT 5;
```

| 策略              | 适用场景                             | 对应逻辑           | 建议                                                                                                                                              |
| :---------------- | :----------------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **列索引优先**    | **强过滤**（符合条件的数据**很少**） | 精确找 -> 算距离   | 建立普通 B-Tree 索引。<br/>`CREATE INDEX ON items (category_id)`                                                                                  |
| **向量索引优先**  | **弱过滤**（符合条件的数据**很多**） | 近似搜 -> 剔除不符 | 适当增大 `ef_search` 防止搜不到                                                                                                                   |
| **部分/分区索引** | **固定高频**（特定业务域）           | 在子集中搜 HNSW    | 性能最佳，适合多租户/类别固定的场景。<br/>`CREATE INDEX ON items USING hnsw (...) WHERE (category_id = 123)`<br/>`PARTITION BY LIST(category_id)` |

#### 1.6.2 迭代索引扫描 (v0.8.0+)

这是为了解决“先检索后过滤”可能导致结果不足的问题。就像 **HR 招聘**：

- **普通模式**：你要求“招 5 个懂 Rust 的专家（Filter）”。猎头按技术排名找来前 5 名大牛（Vector），结果发现只有 1 个人懂 Rust。于是只给你 1 份简历，任务结束。
- **迭代扫描**：猎头发现前 5 名里只有 1 个符合，于是自动继续往下翻第 6-10 名、第 11-20 名... 直到凑齐 5 个懂 Rust 的专家给你。

```sql
-- 宽松顺序（Relaxed Order）：为了凑齐人数，允许稍微牺牲一点排序的严格性（性能更好）
SET hnsw.iterative_scan = relaxed_order;

-- 严格顺序（Strict Order）：必须严格按距离排序，哪怕要扫描更多数据
SET hnsw.iterative_scan = strict_order;
-- SET ivfflat.iterative_scan = relaxed_order;  -- IVFFlat 索引的迭代扫描模式

-- 使用物化 CTE 在宽松顺序下获取高频查询的严格排序
WITH relaxed_results AS MATERIALIZED (
    SELECT id, embedding <-> '[1,2,3]' AS distance
    FROM items WHERE category_id = 123
    ORDER BY distance LIMIT 5
) SELECT * FROM relaxed_results ORDER BY distance + 0;  -- +0 for PG17+
```

**迭代扫描参数**：

| 参数                   | 描述                   | 默认值 |
| ---------------------- | ---------------------- | ------ |
| `hnsw.max_scan_tuples` | HNSW 最大扫描元组数    | 20000  |
| `ivfflat.max_probes`   | IVFFlat 最大探测列表数 | 全部   |

#### 1.6.3 混合搜索（向量 + 全文）

这是 "Just use PostgreSQL" 的重要原因，比如 **刑侦破案**：

- **向量搜索**：拿着**嫌疑人素描**找长得像的人（模糊语义）。
- **全文搜索**：查**车牌号**包含 "888" 的记录（精确关键词）。
- **混合威力**：在同一个 SQL 里，既查“长得像素描”又查“车牌对得上”的人，无需拼接两个系统的结果。

```sql
-- 混合搜查令：结合“车牌号”与“素描画”
SELECT id, content,
    -- 综合嫌疑指数 = 车牌匹配度(30%) + 长相相似度(70%)
    ts_rank(to_tsvector('english', content), query) * 0.3  -- [车牌] 关键词匹配得分
    + (1 - (embedding <=> '[...]')) * 0.7                  -- [素描] 向量相似度得分
    AS final_score
FROM items, plainto_tsquery('english', 'machine learning') query
WHERE to_tsvector('english', content) @@ query  -- [初筛] 必须包含关键线索
ORDER BY final_score DESC
LIMIT 10;
```

### 1.7 性能调优

要想数据库跑得快，除了引擎好，还得会**保养和驾驶**：

- **数据导入**：像**搬家**。先把东西全搬进屋（COPY），最后再慢慢整理归位（建索引）。边搬边整最慢。
- **索引构建**：给工人准备**大工作台**（Memory）与**多帮手**（Workers），干活才能快。
- **查询精度**：像**寻宝**。搜得越细（ef_search 大），结果越准，但耗时越长。

| 关键动作     | 形象比喻         | 优化策略                                   | 核心配置                                     |
| :----------- | :--------------- | :----------------------------------------- | :------------------------------------------- |
| **批量导入** | **先搬家后整理** | 使用 `COPY` 协议，**先插入数据，后建索引** | `COPY items FROM STDIN WITH (FORMAT BINARY)` |
| **索引构建** | **加大工作台**   | 临时调大维护内存，避免频繁读写磁盘         | `SET maintenance_work_mem = '8GB'`           |
| **并行构建** | **多请几个工人** | 增加并行进程数，充分利用多核 CPU           | `SET max_parallel_maintenance_workers = 7`   |
| **查询优化** | **搜得更仔细**   | 增大搜索广度，用时间换召回率               | `SET hnsw.ef_search = 100`                   |
| **极致性能** | **抄近道**       | 归一化向量改用内积（投影）计算             | 替换 `<=>` 为 `<#>`                          |

---

## 2. VectorChord

### 2.1 产品概述

**核心定位**：**即便死守 PostgreSQL 生态，也不想在性能上向独立向量数据库（如 Milvus）低头的“极客方案”。**

如果说 PGVector 是 PostgreSQL 的“官方标配”，那么 VectorChord 就是追求极限性能的**第三方改装套件**。

还是那辆熟悉的 **PostgreSQL (SUV)**，但 VectorChord 为它换上了 **Rust 打造的涡轮增压引擎**：

- **原厂车 (PGVector)**：主打稳健兼容，适合绝大多数通用途径。
- **改装车 (VectorChord)**：主打**暴力性能**。不换车也能体验“推背感”——查询快 5 倍，写入快 16 倍，且能承载超大规格货物（60K 维）。

> ⚠️ **注意**：VectorChord 是由 TensorChord 开发的原 pgvecto.rs 的下一代重构版本，新项目请直接使用 VectorChord<sup>[[5]](#ref5)</sup>。

```mermaid
graph LR
    subgraph "VectorChord：Rust 驱动的性能怪兽"
        direction LR
        A[PostgreSQL]:::pg --> B("VectorChord 扩展<br/>(RaBitQ 量化算法)"):::vc
        B --> C[5x 查询速度]:::feat
        B --> D[16x 写入吞吐]:::feat
        B --> E[60K 维超宽向量]:::feat
    end

    classDef pg fill:#336791,color:#fff
    classDef vc fill:#e67e22,color:#fff
    classDef feat fill:#87d068,color:#fff
```

### 2.2 核心特性对比 PGVector

| 特性         | PGVector (原厂) | VectorChord (改装) | 提升幅度 |
| :----------- | :-------------- | :----------------- | :------- |
| **查询性能** | 基准            | **5x 更快**        | 🚀 5x    |
| **写入吞吐** | 基准            | **16x 更高**       | 🚀 16x   |
| **索引构建** | 基准            | **16x 更快**       | 🚀 16x   |
| **最大维度** | 2,000 (HNSW)    | **60,000**         | 📏 30x   |
| **存储成本** | $6/400K         | **$1/400K**        | 💰 省 6x |

### 2.3 RaBitQ 量化算法

**RaBitQ（Randomized Bit Quantization）**<sup>[[7]](#ref7)</sup> 就像是给每个向量拍了一张**超微缩略图**。在搜索时，先快速比对缩略图（二进制量化，体积仅为原始数据的 1/32）剔除绝大多数无关数据，再对剩下的候选者进行精细比对。这让它能在极低的内存占用下实现极速检索。

```sql
-- 标准创建（推荐）
CREATE INDEX ON items USING vchordrq (embedding vector_l2_ops);

-- 极客模式：通过 TOML 风格配置微调参数
CREATE INDEX ON items USING vchordrq (embedding vector_cosine_ops)
WITH (options = $$
    residual_quantization = true  -- [照片增强] 不仅存缩略图，还保留了和原图的差异细节，越看越清
    [build.internal]
    lists = [2000]                -- [城市规划] 强制划分为 2000 个行政区（若不填则 AI 自动规划）
    spherical_centroids = true    -- [球面投影] 适合 Cosine 距离，像在地球仪表面划分区域而不是平面地图
    build_threads = 8             -- [施工队] 8 个工人同时干活
$$);
```

### 2.4 索引调优

参数调优的核心是 **“分区管理”**，就像**城市规划**：

- **lists (分区数)**：城市越大，**行政区（Lists）** 就要划得越细，防止单区人口爆炸，检索变慢。
- **probes (探针数)**：找人时，需要排查多少个**相邻行政区**。排查越多越准，但越慢。

| 数据规模                | lists (规划建议) | probes (搜寻建议) |
| :---------------------- | :--------------- | :---------------- |
| **< 1M (小镇)**         | `[]` (自动)      | 默认              |
| **1M - 10M (城市)**     | `[2000]`         | 10                |
| **10M - 100M (大都会)** | `[10000]`        | 30                |
| **> 100M (巨型城市)**   | `[80000]`        | 100               |

```sql
-- 查询时调整搜索范围（即搜寻多少个相邻行政区）
SET vchordrq.probes TO '10';
SELECT * FROM items ORDER BY embedding <-> '[3,1,2]' LIMIT 10;
```

### 2.5 与 PGVector 兼容性

VectorChord 就像是能插进**标准插座（PGVector 接口）**的**超级充电器**。它沿用了 PGVector 的数据类型（插头形状一样）<sup>[[8]](#ref8)</sup>，你不需要修改表结构或业务代码，只需换个“内部引擎”（索引类型），就能瞬间获得性能提升。

```sql
-- 依赖 vchord
CREATE EXTENSION IF NOT EXISTS vchord CASCADE;
-- 1. 数据表还是原来的配方（使用 vector 类型）
CREATE TABLE items (embedding vector(1536));

-- 2. 只需要在创建索引时，悄悄将“引擎”名从 hnsw 改为 vchordrq
-- CREATE INDEX ON items USING hnsw ...  <-- 旧引擎
CREATE INDEX ON items USING vchordrq ...  -- <-- 新引擎
```

### 2.6 vchordg 图索引 (v0.5.0+)

相比 `vchordrq` 是全内存索引，飞快但贵；`vchordg` 则是基于磁盘的**离线地图包**（DiskANN 技术）：它允许你把庞大的向量数据存在便宜的 SSD 硬盘上，只把最关键的“路标”加载到内存。**适合数据量大到内存装不下的场景。**

```sql
/**
 * 离线地图模式 (Disk-Based Index)
 * 适合场景：内存有限，但有一块极速 SSD
 */
CREATE INDEX ON items USING vchordg (embedding vector_cosine_ops)
WITH (options = $$
    bits = 2                -- [地图缩放] 2x 缩放。值越小越省地，但地图越模糊（易指错路）；1 = 极省空间，2 = 兼顾准确；RaBitQ 量化比率，默认 2
    m = 32                  -- [交通枢纽] 规定每个路口最多连接 32 条路。路越多越精准，但路网越复杂；每顶点最大邻居数，默认 32
    ef_construction = 64    -- [勘测范围] 造地图时，先探索周边 64 个路标来确定最佳路线。探索越广，地图质量越高；构建时的搜索范围，默认 64
    alpha = [1.0, 1.2]      -- [绕路容忍度] 允许在建图时稍微绕点路（1.0-1.2倍），以发现潜在的捷径，防止陷入局部死胡同；剪枝时的 alpha 值，默认 [1.0, 1.2]
$$);
```

### 2.7 预过滤 Prefilter (v0.4.0+)

VectorChord 的 `vchordrq.prefilter` 参数允许向量索引利用过滤条件进行剪枝<sup>[[24]](#ref24)</sup>：

```sql
-- 启用预过滤
SET vchordrq.prefilter = on;

-- 适用于严格且低成本的过滤条件
-- 1% 选择率时可获得 200% QPS 提升
-- 10% 选择率时可获得 5% QPS 提升
```

> [!WARNING]
>
> **注意**：预过滤仅推荐用于**严格**（过滤大量行）且**低成本**（计算开销远低于向量距离计算）的过滤条件。

---

## 3. Milvus

### 3.1 产品概述

**核心定位**：**用（较高的）运维复杂度，换取（极高的）水平扩展能力。是“大厂”构建核心 AI 基础设施的首选。**

告别“插件化”的轻量级方案，我们进入**云原生分布式**的重工业领域。Milvus 是 LF AI & Data Foundation 基金会的毕业项目，专为 **十亿级（Billion-scale）** 向量检索而生。

Milvus 的部署模式就像**从“乐高积木”到“摩天大楼”**的进化：

- **Milvus Lite**：**乐高小人**。嵌入 Python 进程，零依赖，写 Demo 最快。
- **Standalone**：**单层平房**。一个 Docker 容器搞定，适合测试或中小规模。
- **Distributed**：**摩天大楼群**。基于 Kubernetes 的微服务架构，存算分离，专治各种“数据量大到存不下”的疑难杂症。

```mermaid
graph LR
    subgraph "Milvus：从玩具到摩天楼"
        direction LR
        L["Lite<br/>(嵌入式)"]:::lego
        S["Standalone<br/>(Docker)"]:::house
        D["Distributed<br/>(K8s)"]:::city
        Z["Zilliz Cloud<br/>(托管)"]:::cloud

        L --> |开发| S
        S --> |生产| D
        D -.-> |托管| Z
    end

    classDef lego fill:#b7eb8f,stroke:none,color:#000
    classDef house fill:#40a9ff,color:#fff,stroke:none
    classDef city fill:#003a8c,color:#fff,stroke:none
    classDef cloud fill:#722ed1,color:#fff,stroke:none
```

### 3.2 核心架构

Milvus 的运作机制就像一个繁忙的**国际机场**：

- **访问层 (Proxy)**：**值机大厅**。负责接待旅客（请求），本来不干重活，只管把人引导到正确的登机口。
- **协调层 (Coordinators)**：**塔台**。不亲自开飞机，但指挥所有飞机的起降顺序，确保航线不冲突（事务一致性）。
- **工作节点 (Worker Nodes)**：**地勤人员**。最苦最累的一线。有的搬行李（DataNode），有的修飞机（IndexNode），有的负责安检扫描（QueryNode）。
- **存储层 (etcd + MinIO + MQ)**：**停机坪与仓库**。真正的物资集散地。etcd 存航班表，MinIO 存行李，Kafka 是行李传送带。

```mermaid
graph TB
    subgraph "Milvus: 国际机场架构"
        direction TB
        subgraph "访问层(值机大厅)"
            Proxy[Proxy<br/>负载均衡与请求路由]:::proxy
        end

        subgraph "协调层(塔台)"
            RC[Root Coord<br/>DDL/DCL 管理]:::coord
            QC[Query Coord<br/>查询调度]:::coord
            DC[Data Coord<br/>数据调度]:::coord
            IC[Index Coord<br/>索引调度]:::coord
        end

        subgraph "工作节点层(地勤)"
            QN[Query Node<br/>向量搜索]:::work
            DN[Data Node<br/>数据持久化]:::work
            IN[Index Node<br/>索引构建]:::work
        end

        subgraph "存储层(仓库)"
            ETCD[(etcd<br/>元数据)]:::store
            MINIO[(MinIO/S3<br/>对象存储)]
            MQ[Kafka/Pulsar<br/>消息队列]:::store
        end

        Proxy --> RC & QC & DC & IC
        QC --> QN
        DC --> DN
        IC --> IN
        QN & DN & IN --> MINIO
        RC --> ETCD
        DN --> MQ
    end

    classDef proxy fill:#00A1EA,color:#fff,stroke:none
    classDef coord fill:#722ed1,color:#fff,stroke:none
    classDef work fill:#faad14,color:#fff,stroke:none
    classDef store fill:#52c41a,color:#fff,stroke:none

    style MINIO fill:#ff5722,color:#fff
```

**组件分工表**：

| 层级       | 组件              | 机场角色     | 核心职责                                                            | 扩展性                                   |
| :--------- | :---------------- | :----------- | :------------------------------------------------------------------ | :--------------------------------------- |
| **访问层** | Proxy             | **值机大厅** | 门面担当，聚合结果<br/>无状态代理，处理客户端请求与结果聚合         | 无状态，随便加机器                       |
| **协调层** | Coordinators      | **塔台**     | 发号施令，脑部中枢<br/>集群拓扑管理、任务调度、一致性控制           | 压力较小，通常不需要扩展                 |
| **工作层** | Worker Nodes      | **地勤**     | **算力黑洞**。搜索、建索引全靠它<br/>向量搜索、数据持久化、索引构建 | **弹性伸缩的核心**（忙时加人，闲时裁员） |
| **存储层** | etcd + MinIO + MQ | **仓库**     | 数据底座，持久化存储<br/>元数据、向量/索引存储、WAL 日志            | 依赖 S3/MinIO 的无限容量                 |

### 3.3 索引算法体系

拥有了能够无限扩展的**存储架构**后，Milvus 进一步提供了覆盖全场景的**索引分级体系**，让你在“速度、成本、精度”的不可能三角中自由裁决。

Milvus 的索引体系就像一个**多级物流网络**：

- **HNSW (内存索引)**：**前置仓（极速达）**。货物就在市中心（内存），下单即送达（延迟最低），但租金寸土寸金，适合热点数据。
- **IVF_PQ (压缩索引)**：**集约化货架（高密度）**。通过真空压缩（量化）技术，在同样的仓库里塞进 10 倍的货物，虽然取货多一道工序，但性价比极高。
- **DiskANN (磁盘索引)**：**郊区中心仓（海量）**。建在地皮便宜的郊区（SSD），通过高速公路（NVMe）临时调货，成本仅为前置仓的 1/10，适合百亿级数据兜底。
- **GPU Index (GPU 索引)**：**自动化流水线（高吞吐）**。遇到“双 11”海量订单（高 QPS），直接上机器臂集群（GPU），处理效率是人工的几十倍。

为了支撑上述多级物流体系，同时处理复杂的元数据过滤（如查找特定类别的商品），Milvus 构建了业界最全的**索引分类树**：

```mermaid
mindmap
  root((Milvus 索引全景))
    向量索引
      图索引(HNSW 前置仓)
        HNSW
        [HNSW_SQ|PQ|PRQ]
      IVF 系列(IVF 集约货架)
        [IVF_FLAT|SQ8|PQ|RABITQ]
      磁盘索引(DiskANN 中心仓)
      GPU 索引(GPU 自动化)
        [GPU_CAGRA|IVF_FLAT|IVF_PQ|BRUTE_FORCE]
    标量索引
      倒排索引：物品清单-查名称
      Bitmap 索引：状态看板-查库存
      Trie 索引：货号前缀-查批次
```

| 索引类型      | 物流角色     | 算法            | 适用场景                                       | 资源消耗    |
| ------------- | ------------ | --------------- | ---------------------------------------------- | ----------- |
| **HNSW**      | **前置仓**   | 多层图搜索      | **唯快不破**。低延迟高召回                     | 🧠 内存极高 |
| **IVF_FLAT**  | **集约货架** | 聚类 + 精确搜索 | 高召回场景                                     | 🧠 内存中   |
| **IVF_SQ8**   | **集约货架** | 聚类 + 标量量化 | **空间魔法**。通过量化压缩数据，平衡性能与召回 | 🧠 内存低   |
| **IVF_PQ**    | **集约货架** | 聚类 + 积量化   | **空间魔法**。通过量化压缩数据，大规模低内存   | 🧠 内存极低 |
| **DiskANN**   | **中心仓**   | 磁盘图索引      | **成本杀手**。使用 SSD 存储超大规模数据        | 💾 依赖 SSD |
| **GPU Index** | **自动化**   | GPU 优化图      | **暴力吞吐**。GPU 加速，适合超高并发场景       | 🎮 显存     |

### 3.4 搜索能力

Milvus 的 `pymilvus` SDK 就是**智能仓储系统的“手持终端”**，简单几行指令就能调度底层的庞大算力。

```python
from pymilvus import MilvusClient

# 1. 登录终端 (连接 Lite 版或集群)
client = MilvusClient("demo.db")

# 2. 划分库区 (创建集合)
client.create_collection(
    collection_name="demo_collection",
    dimension=768  # 货架规格
)

# 3. 商品入库 (插入数据)
client.insert(
    collection_name="demo_collection",
    data=[{"id": 1, "vector": [...], "subject": "history"}]
)

# 4. 模糊找货 (ANN 搜索)
# "帮我找几个跟这个样品最像的货"
results = client.search(
    collection_name="demo_collection",
    data=[query_vector],
    limit=10,
    output_fields=["subject"]
)

# 5. 精确筛选 (带过滤搜索)
# "在'历史区'帮我找跟这个样品最像的货"
results = client.search(
    collection_name="demo_collection",
    data=[query_vector],
    filter='subject == "history"',  # 先去历史区
    limit=10
)
```

**全能检索矩阵**：

| 能力           | 描述          | 价值                                                        |
| :------------- | :------------ | :---------------------------------------------------------- |
| **ANN 搜索**   | 近似最近邻    | **核心能力**。亿级数据毫秒响应。                            |
| **元数据过滤** | 标量条件过滤  | **精准定位**。支持复杂的 boolean 表达式。                   |
| **混合搜索**   | 多路召回融合  | **全能视角**。同时利用向量、BM25 关键词、图片等多模态信息。 |
| **范围搜索**   | Radius Search | **画圈圈地**。只找特定相似度范围内的结果。                  |
| **重排序**     | Rerank        | **精修整备**。引入高精度模型对粗排结果进行二次精选。        |

### 3.5 性能基准

基于 Milvus 2.2 官方基准测试<sup>[[12]](#ref12)</sup>，单 QueryNode（8 核 CPU、8GB 内存、1M 128D Dataset）性能表现：

| 指标        | 性能表现                        |
| ----------- | ------------------------------- |
| **QPS**     | 7153                            |
| **延迟**    | 127ms (P99)<br/> 83ms (P50)     |
| **扩展性**  | 线性扩展（CPU）                 |
| **vs 其他** | 2.5x Latency、4.5x QPS 性能优势 |

### 3.6 部署模式对比

| 模式             | 适用场景          | 数据规模 | 运维复杂度 |
| ---------------- | ----------------- | -------- | ---------- |
| **Milvus Lite**  | 本地开发、Jupyter | < 100K   | ★☆☆☆☆      |
| **Standalone**   | 单机开发测试      | < 10M    | ★★☆☆☆      |
| **Distributed**  | 生产环境          | 百亿级   | ★★★★☆      |
| **Zilliz Cloud** | 全托管生产        | 百亿级   | ★☆☆☆☆      |

---

## 4. Weaviate

### 4.1 产品概述

**核心定位**：AI-Native 向量数据库，提供开箱即用的语义搜索和 RAG 能力。

Weaviate 是一款开源的 AI-Native 向量数据库，专为构建 AI 应用而设计<sup>[[13]](#ref13)</sup>。它的核心特点是内置向量化模块，可以自动将数据转化为向量嵌入。

```mermaid
graph TB
    subgraph "Weaviate 生态系统"
        WDB[Weaviate Database<br/>开源向量数据库]
        WC[Weaviate Cloud<br/>托管服务]
        WA[Weaviate Agents<br/>预构建代理服务]
        WE[Weaviate Embeddings<br/>托管嵌入服务]
    end

    WDB --> WC
    WC --> WA & WE

    style WDB fill:#38b2ac,color:#fff
    style WC fill:#805ad5,color:#fff
```

### 4.2 核心特性

| 特性           | 描述                 | 优势                    |
| -------------- | -------------------- | ----------------------- |
| **内置向量化** | 自动生成向量嵌入     | 无需外部 Embedding 服务 |
| **语义搜索**   | 基于含义的相似性搜索 | 超越关键词匹配          |
| **混合搜索**   | 向量 + BM25 结合     | 兼顾语义与关键词        |
| **RAG 支持**   | 内置生成式搜索       | 简化 RAG 流程           |
| **模块化架构** | 可插拔的向量化模块   | 灵活选择模型            |

### 4.3 向量索引类型

Weaviate 支持三种向量索引类型<sup>[[14]](#ref14)</sup>：

```mermaid
graph BT
    subgraph "索引类型选择"
        direction LR
        HNSW[HNSW 索引<br/>大规模数据]
        Flat[Flat 索引<br/>小规模数据]
        Dynamic[Dynamic 索引<br/>自动切换]
    end

    Small[小数据集] --> Flat
    Large[大数据集] --> HNSW
    Unknown[未知规模] --> Dynamic

    style HNSW fill:#4285f4,color:#fff
    style Dynamic fill:#34a853,color:#fff
```

| 索引类型    | 算法     | 适用场景   | 特点                     |
| ----------- | -------- | ---------- | ------------------------ |
| **HNSW**    | 多层图   | 大规模数据 | 对数时间复杂度，高召回   |
| **Flat**    | 暴力搜索 | 小规模数据 | 完美召回，适合多租户     |
| **Dynamic** | 自动切换 | 未知规模   | 小时用 Flat，大时切 HNSW |

### 4.4 向量化模块

Weaviate 支持多种向量化模块<sup>[[15]](#ref15)</sup>：

| 模块类型                 | 模型提供商  | 支持模态    |
| ------------------------ | ----------- | ----------- |
| **text2vec-openai**      | OpenAI      | 文本        |
| **text2vec-cohere**      | Cohere      | 文本        |
| **text2vec-huggingface** | HuggingFace | 文本        |
| **multi2vec-clip**       | OpenAI CLIP | 图像 + 文本 |
| **multi2vec-bind**       | ImageBind   | 多模态      |

### 4.5 搜索能力

```python
import weaviate

# 连接 Weaviate Cloud
client = weaviate.connect_to_wcs(
    cluster_url="YOUR_WCS_URL",
    auth_credentials=weaviate.auth.AuthApiKey("YOUR_API_KEY")
)

# 创建 Collection（自动向量化）
collection = client.collections.create(
    name="Article",
    vectorizer_config=weaviate.Configure.Vectorizer.text2vec_openai()
)

# 插入数据（自动生成向量）
collection.data.insert({
    "title": "AI 技术发展",
    "content": "人工智能正在改变世界..."
})

# 语义搜索
results = collection.query.near_text(
    query="机器学习的未来",
    limit=5
)

# 混合搜索（向量 + BM25）
results = collection.query.hybrid(
    query="AI applications",
    alpha=0.5,  # 0 = BM25, 1 = 向量
    limit=5
)
```

**搜索功能矩阵**：

| 功能           | 描述                  | 支持情况 |
| -------------- | --------------------- | -------- |
| **向量搜索**   | near_text/near_vector | ✅       |
| **BM25 搜索**  | 关键词搜索            | ✅       |
| **混合搜索**   | 向量 + BM25 融合      | ✅       |
| **生成式搜索** | RAG 内置支持          | ✅       |
| **过滤搜索**   | 属性条件过滤          | ✅       |
| **分组聚合**   | Group by              | ✅       |

### 4.6 部署选项

| 部署方式           | 适用场景   | 特点                   |
| ------------------ | ---------- | ---------------------- |
| **Weaviate Cloud** | 生产环境   | 完全托管，Sandbox 免费 |
| **Docker**         | 本地开发   | 支持本地推理容器       |
| **Kubernetes**     | 自托管生产 | 高可用，零停机更新     |
| **Embedded**       | 快速评估   | Python/JS 直接启动     |

### 4.7 向量量化技术<sup>[[25]](#ref25)</sup>

Weaviate 支持四种向量压缩方法：

| 量化方法                         | 压缩比 | 召回影响 | 特点                  |
| -------------------------------- | ------ | -------- | --------------------- |
| **PQ** (Product Quantization)    | ~24x   | 中等     | 需要训练，适用 HNSW   |
| **BQ** (Binary Quantization)     | 32x    | 较大     | 无训练，V3 模型效果好 |
| **SQ** (Scalar Quantization)     | 4x     | 较小     | 8-bit 压缩，256 个桶  |
| **RQ** (Rotational Quantization) | 4x/32x | 较小     | 无训练，即时启用      |

```python
# 启用 SQ 压缩（推荐）
collection = client.collections.create(
    name="Article",
    vectorizer_config=weaviate.Configure.Vectorizer.text2vec_openai(),
    vector_index_config=weaviate.Configure.VectorIndex.hnsw(
        quantizer=weaviate.Configure.VectorIndex.Quantizer.sq()
    )
)
```

> **提示**：Weaviate 使用**过度获取 + 重排序**策略来弥补量化导致的精度损失。

### 4.8 集群架构<sup>[[26]](#ref26)</sup>

Weaviate 采用 **Raft + Leaderless** 混合架构：

```mermaid
graph TB
    subgraph "元数据复制 - Raft 共识"
        Leader[Leader 节点]
        Follower1[Follower 节点]
        Follower2[Follower 节点]
    end

    subgraph "数据复制 - Leaderless"
        N1[Node 1]
        N2[Node 2]
        N3[Node 3]
    end

    Client[客户端] --> Coordinator[协调节点]
    Coordinator --> N1 & N2 & N3

    style Leader fill:#4285f4,color:#fff
    style Coordinator fill:#34a853,color:#fff
```

| 组件       | 协议                      | 特点                  |
| ---------- | ------------------------- | --------------------- |
| **元数据** | Raft                      | 强一致性，Leader 选举 |
| **数据**   | Leaderless (Dynamo-style) | 高可用，最终一致性    |

**一致性可调**：通过 Replication Factor 和 Consistency Level 平衡可用性与一致性。

## 5. Pinecone

### 5.1 产品概述

**核心定位**：零运维、高性能的全托管向量数据库 SaaS 服务。

Pinecone 是一款全托管的向量数据库服务，专为生产环境中的 AI 应用设计<sup>[[16]](#ref16)</sup>。它提供 Serverless 架构，用户无需管理基础设施即可使用高性能向量搜索。

```mermaid
graph TB
    subgraph "Pinecone 产品线"
        DB[Pinecone Database<br/>向量数据库]
        AS[Pinecone Assistant<br/>AI 助手]
        INF[Integrated Inference<br/>内置嵌入]
    end

    DB --> AS
    DB --> INF

    style DB fill:#5048E5,color:#fff
    style AS fill:#8B5CF6,color:#fff
```

### 5.2 核心特性

| 特性           | 描述                | 优势              |
| -------------- | ------------------- | ----------------- |
| **全托管**     | Serverless 架构     | 零运维，按需扩展  |
| **集成嵌入**   | 内置 Embedding 模型 | 简化开发流程      |
| **命名空间**   | 多租户数据隔离      | 单索引多分区      |
| **元数据过滤** | 标量属性过滤        | 向量 + 结构化查询 |
| **重排序**     | 内置 Reranker       | 提升检索精度      |

### 5.3 索引类型

Pinecone 支持两种索引类型<sup>[[17]](#ref17)</sup>：

| 索引类型         | 描述         | 适用场景          |
| ---------------- | ------------ | ----------------- |
| **Dense Index**  | 稠密向量索引 | 语义搜索（主流）  |
| **Sparse Index** | 稀疏向量索引 | BM25 类关键词搜索 |

```python
from pinecone import Pinecone

# 初始化客户端
pc = Pinecone(api_key="YOUR_API_KEY")

# 创建 Dense Index（带集成嵌入）
pc.create_index_for_model(
    name="my-index",
    cloud="aws",
    region="us-east-1",
    embed={
        "model": "llama-text-embed-v2",
        "field_map": {"text": "chunk_text"}
    }
)

# 创建 Sparse Index
pc.create_index(
    name="sparse-index",
    dimension=None,  # Sparse 无需指定
    metric="dotproduct",
    spec=ServerlessSpec(cloud="aws", region="us-east-1")
)
```

### 5.4 命名空间与多租户

Pinecone 使用命名空间实现数据隔离<sup>[[18]](#ref18)</sup>：

```mermaid
graph TB
    subgraph "Index"
        NS1[Namespace: tenant_a]
        NS2[Namespace: tenant_b]
        NS3[Namespace: tenant_c]
    end

    App[应用程序] --> NS1 & NS2 & NS3

    style NS1 fill:#4285f4,color:#fff
    style NS2 fill:#34a853,color:#fff
    style NS3 fill:#fbbc04,color:#000
```

- 每个索引最多 **100,000** 个命名空间
- 查询和写入操作指定命名空间
- 实现多租户数据隔离

### 5.5 搜索与过滤

```python
# 连接索引
index = pc.Index("my-index")

# 文本搜索（集成嵌入）
results = index.query(
    data={"inputs": {"text": "What is machine learning?"}},
    top_k=10,
    include_metadata=True
)

# 带元数据过滤的搜索
results = index.query(
    vector=[0.1, 0.2, ...],
    top_k=10,
    filter={"genre": {"$eq": "technology"}}
)

# 混合搜索（需要同时使用 Dense + Sparse 索引）
```

**过滤操作符**：

| 操作符 | 描述   | 示例                             |
| ------ | ------ | -------------------------------- |
| `$eq`  | 等于   | `{"field": {"$eq": "value"}}`    |
| `$ne`  | 不等于 | `{"field": {"$ne": "value"}}`    |
| `$gt`  | 大于   | `{"field": {"$gt": 10}}`         |
| `$in`  | 包含于 | `{"field": {"$in": ["a", "b"]}}` |
| `$and` | 逻辑与 | `{"$and": [cond1, cond2]}`       |
| `$or`  | 逻辑或 | `{"$or": [cond1, cond2]}`        |

### 5.6 定价模式

| 计划           | 费用   | 特点     | 限制               |
| -------------- | ------ | -------- | ------------------ |
| **Starter**    | 免费   | 入门体验 | 1 个区域，有限额度 |
| **Standard**   | 按用量 | 生产级   | 更高限制           |
| **Enterprise** | 自定义 | 企业级   | 定制化支持         |

### 5.7 优劣势分析

**优势**：

- ✅ 零运维，开箱即用
- ✅ 高可用，自动扩展
- ✅ 集成嵌入和重排序
- ✅ 企业级 SLA 保障

**劣势**：

- ❌ 仅 SaaS，无法私有部署
- ❌ 成本较高（大规模场景）
- ❌ 数据需传输到云端
- ❌ 功能相对简单

### 5.8 混合搜索<sup>[[27]](#ref27)</sup>

Pinecone 支持两种混合搜索实现方式：

| 方式                   | 优势                                 | 劣势                               |
| ---------------------- | ------------------------------------ | ---------------------------------- |
| **双索引方式**（推荐） | 灵活、支持单独 sparse 查询、多级重排 | 需管理两个索引                     |
| **单混合索引**         | 实现简单                             | 不支持 sparse-only、不支持集成嵌入 |

```python
# 双索引混合搜索
# 1. 创建 Dense + Sparse 索引
pc.create_index_for_model(
    name="dense-index",
    cloud="aws", region="us-east-1",
    embed={"model": "llama-text-embed-v2", "field_map": {"text": "chunk_text"}}
)
pc.create_index_for_model(
    name="sparse-index",
    cloud="aws", region="us-east-1",
    embed={"model": "pinecone-sparse-english-v0", "field_map": {"text": "chunk_text"}}
)

# 2. 分别查询后使用 RRF 融合结果
```

### 5.9 重排序<sup>[[28]](#ref28)</sup>

Pinecone 支持集成重排序和独立重排序：

```python
# 集成重排序 - 在 search 中直接使用
ranked_results = index.search(
    namespace="example-namespace",
    query={"inputs": {"text": "Disease prevention"}, "top_k": 4},
    rerank={
        "model": "bge-reranker-v2-m3",
        "top_n": 2,
        "rank_fields": ["chunk_text"]
    },
    fields=["category", "chunk_text"]
)
```

**可用重排序模型**：

| 模型                 | 最大 Token | 最大文档数 | 特点                  |
| -------------------- | ---------- | ---------- | --------------------- |
| `cohere-rerank-3.5`  | 40,000     | 200        | 高精度、多字段支持    |
| `bge-reranker-v2-m3` | 1,024      | 100        | 平衡性能与精度        |
| `pinecone-rerank-v0` | 512        | 100        | Pinecone 自研、低延迟 |

---

## 6. 系统性对比分析

### 6.1 核心能力对比矩阵

| 维度          | PGVector     | VectorChord | Milvus           | Weaviate     | Pinecone    |
| ------------- | ------------ | ----------- | ---------------- | ------------ | ----------- |
| **开源协议**  | PostgreSQL   | AGPLv3/ELv2 | Apache 2.0       | BSD-3        | 商业        |
| **部署模式**  | 单机/集群    | 单机/集群   | 分布式/托管      | 分布式/托管  | 仅托管      |
| **最大维度**  | 2,000 (HNSW) | 60,000      | 32,768           | 无限制       | 20,000      |
| **向量索引**  | HNSW/IVF     | RaBitQ/HNSW | IVF/HNSW/DiskANN | HNSW/Flat    | 专有算法    |
| **ACID 事务** | ✅ 完整      | ✅ 完整     | ❌ 不支持        | ❌ 不支持    | ❌ 不支持   |
| **混合搜索**  | ✅ 全文检索  | ✅ 全文检索 | ✅ BM25          | ✅ BM25+向量 | ⚠️ 需双索引 |
| **内置嵌入**  | ❌           | ❌          | ⚠️ pymilvus      | ✅ 多模块    | ✅ 集成     |
| **GPU 加速**  | ❌           | ❌          | ✅ CAGRA         | ❌           | ❌          |

### 6.2 性能对比

```mermaid
graph LR
    subgraph "QPS 性能（相对值）"
        VC[VectorChord] --> |5x| PGV[PGVector]
        MV[Milvus] --> |2-5x| Others[其他向量数据库]
    end

    style VC fill:#52c41a,color:#fff
    style MV fill:#00A1EA,color:#fff
```

| 产品            | 1M 768D QPS | 召回率@95% | 索引构建 | 内存效率 |
| --------------- | ----------- | ---------- | -------- | -------- |
| **PGVector**    | ~1,000      | ★★★★☆      | ★★★☆☆    | ★★★☆☆    |
| **VectorChord** | ~5,000      | ★★★★☆      | ★★★★★    | ★★★★★    |
| **Milvus**      | ~10,000+    | ★★★★★      | ★★★★☆    | ★★★★☆    |
| **Weaviate**    | ~5,000      | ★★★★☆      | ★★★★☆    | ★★★★☆    |
| **Pinecone**    | ~5,000      | ★★★★☆      | N/A      | N/A      |

### 6.3 成本对比

| 产品            | 100K 向量    | 1M 向量      | 10M 向量        | 100M 向量        |
| --------------- | ------------ | ------------ | --------------- | ---------------- |
| **PGVector**    | $0（自托管） | $0（自托管） | $0（自托管）    | $0（自托管）     |
| **VectorChord** | $0.25        | $2.5         | $25             | $250             |
| **Milvus**      | $0（自托管） | $0（自托管） | Zilliz: ~$50/月 | Zilliz: ~$500/月 |
| **Weaviate**    | 免费 Sandbox | WCS: ~$25/月 | WCS: ~$100/月   | 自定义           |
| **Pinecone**    | 免费 Starter | ~$70/月      | ~$300/月        | 企业定价         |

> ⚠️ 以上价格为估算参考，实际价格请以官方定价为准。

### 6.4 运维复杂度对比

```mermaid
graph LR
    subgraph "运维复杂度"
        PC[Pinecone<br/>★☆☆☆☆]
        WCS[Weaviate Cloud<br/>★☆☆☆☆]
        ZC[Zilliz Cloud<br/>★☆☆☆☆]
        PGV[PGVector<br/>★★☆☆☆]
        VC[VectorChord<br/>★★☆☆☆]
        WD[Weaviate Docker<br/>★★★☆☆]
        MS[Milvus Standalone<br/>★★★☆☆]
        MD[Milvus Distributed<br/>★★★★★]
    end

    style PC fill:#52c41a,color:#fff
    style MD fill:#ea4335,color:#fff
```

### 6.5 生态集成对比

| 框架/工具      | PGVector | VectorChord | Milvus   | Weaviate        | Pinecone |
| -------------- | -------- | ----------- | -------- | --------------- | -------- |
| **LangChain**  | ✅       | ✅          | ✅       | ✅              | ✅       |
| **LlamaIndex** | ✅       | ✅          | ✅       | ✅              | ✅       |
| **Haystack**   | ✅       | ⚠️          | ✅       | ✅              | ✅       |
| **AutoGPT**    | ⚠️       | ⚠️          | ✅       | ✅              | ✅       |
| **Cognee**     | ✅       | ⚠️          | ✅       | ✅              | ✅       |
| **Python SDK** | psycopg2 | psycopg2    | pymilvus | weaviate-client | pinecone |

---

## 7. 场景推荐与选型指南

### 7.1 决策流程图

```mermaid
flowchart TD
    Start[开始选型] --> Q1{已有 PostgreSQL?}

    Q1 --> |是| Q2{性能要求高?}
    Q1 --> |否| Q3{需要私有部署?}

    Q2 --> |是| VC[VectorChord]
    Q2 --> |否| PGV[PGVector]

    Q3 --> |是| Q4{数据规模?}
    Q3 --> |否| Q5{预算敏感?}

    Q4 --> |< 10M| WV[Weaviate]
    Q4 --> |> 10M| MV[Milvus]

    Q5 --> |是| MV2[Milvus/Weaviate<br/>自托管]
    Q5 --> |否| PC[Pinecone]

    style VC fill:#336791,color:#fff
    style PGV fill:#336791,color:#fff
    style MV fill:#00A1EA,color:#fff
    style WV fill:#38b2ac,color:#fff
    style PC fill:#5048E5,color:#fff
```

### 8.2 场景推荐矩阵

| 场景                     | 首选方案        | 备选方案       | 理由                   |
| ------------------------ | --------------- | -------------- | ---------------------- |
| **已有 PostgreSQL 系统** | VectorChord     | PGVector       | 零迁移成本，数据一致性 |
| **快速原型开发**         | Pinecone        | Weaviate Cloud | 零运维，快速上手       |
| **大规模生产系统**       | Milvus          | Weaviate       | 分布式架构，高可扩展   |
| **AI-Native 应用**       | Weaviate        | Milvus         | 内置向量化，RAG 支持   |
| **成本敏感型**           | PGVector/Milvus | VectorChord    | 开源免费，自托管       |
| **企业合规要求**         | Milvus/Weaviate | VectorChord    | 私有部署，数据主权     |
| **多租户 SaaS**          | Pinecone        | Weaviate Cloud | 命名空间隔离           |

### 8.3 本项目推荐方案

基于本项目（Agentic AI 学术研究与工程应用方案定制）的需求分析：

| 需求维度        | 本项目要求                  | 匹配评估                 |
| --------------- | --------------------------- | ------------------------ |
| **数据规模**    | 初期 < 1M，长期 > 10M       | Milvus 支持百亿级扩展    |
| **混合检索**    | 向量 + 全文 + 图谱          | Milvus BM25 + Neo4j 图谱 |
| **多模态支持**  | 文本、代码、图像            | Milvus 多向量字段        |
| **AI 框架集成** | LangChain/LlamaIndex/Cognee | Milvus 全覆盖            |
| **开发便捷性**  | 本地开发快速迭代            | Milvus Lite 嵌入式       |
| **生产部署**    | 私有化、高可用              | Milvus Distributed       |

> **推荐方案**：选择 **Milvus** 作为本项目的向量数据库方案。

**选择理由**：

1. **开发测试便捷**：Milvus Lite 支持纯 Python 嵌入式运行，无需 Docker
2. **平滑扩展**：从 Lite → Standalone → Distributed 无缝升级
3. **生态完善**：LangChain/LlamaIndex/Cognee 全面支持
4. **性能优秀**：10k+ QPS，支持 GPU 加速
5. **Apache 2.0**：开源协议友好，可商用

---

## 9. 本项目集成方案

### 9.1 技术架构概览

```mermaid
graph TB
    subgraph "数据层"
        MV[(Milvus<br/>向量检索)]
        PG[(PostgreSQL<br/>关系数据)]
        Neo4j[(Neo4j<br/>知识图谱)]
    end

    subgraph "检索层"
        VEC[向量检索<br/>Milvus HNSW/IVF]
        FTS[全文检索<br/>Milvus BM25]
        GRAPH[图谱检索<br/>Neo4j Cypher]
    end

    subgraph "融合层"
        RRF[RRF 重排序]
        LLM[LLM 精排]
    end

    Query[用户查询] --> VEC & FTS & GRAPH
    VEC & FTS & GRAPH --> RRF
    RRF --> LLM
    LLM --> Result[检索结果]

    style MV fill:#00A1EA,color:#fff
    style PG fill:#336791,color:#fff
    style Neo4j fill:#018bff,color:#fff
```

### 9.2 Milvus 向量检索实现

#### 9.2.1 Collection 设计

```python
from pymilvus import MilvusClient, DataType, FieldSchema, CollectionSchema

# 使用 Milvus Lite（本地开发）或连接远程服务
client = MilvusClient("./agentic_ai.db")  # Lite 模式

# 定义 Schema
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="source_id", dtype=DataType.INT64),
    FieldSchema(name="source_type", dtype=DataType.VARCHAR, max_length=50),
    FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=500),
    FieldSchema(name="chunk_text", dtype=DataType.VARCHAR, max_length=65535),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
]

# 创建 Collection
client.create_collection(
    collection_name="source_embeddings",
    schema=CollectionSchema(fields, description="学术资源向量嵌入"),
    index_params={
        "index_type": "HNSW",
        "metric_type": "COSINE",
        "params": {"M": 16, "efConstruction": 128}
    }
```

#### 9.2.2 向量检索与混合搜索

```python
from pymilvus import MilvusClient
from openai import OpenAI

client = MilvusClient("./agentic_ai.db")
openai_client = OpenAI()

def get_embedding(text: str) -> list:
    """生成文本嵌入向量"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def semantic_search(query: str, source_type: str = None, top_k: int = 10):
    """语义相似度搜索"""
    query_embedding = get_embedding(query)

    # 构建过滤条件
    filter_expr = f'source_type == "{source_type}"' if source_type else ""

    results = client.search(
        collection_name="source_embeddings",
        data=[query_embedding],
        limit=top_k,
        filter=filter_expr,
        output_fields=["title", "chunk_text", "source_type"]
    )
    return results

def hybrid_search(query: str, top_k: int = 10):
    """混合搜索（向量 + BM25 全文）"""
    # Milvus 2.4+ 支持 BM25 全文搜索
    from pymilvus import AnnSearchRequest, RRFRanker

    query_embedding = get_embedding(query)

    # 向量搜索请求
    vector_req = AnnSearchRequest(
        data=[query_embedding],
        anns_field="embedding",
        param={"metric_type": "COSINE", "params": {"ef": 100}},
        limit=top_k * 2
    )

    # BM25 全文搜索请求（需要在 Collection 中启用 BM25）
    bm25_req = AnnSearchRequest(
        data=[query],
        anns_field="chunk_text",
        param={"metric_type": "BM25"},
        limit=top_k * 2
    )

    # 使用 RRF 融合结果
    results = client.hybrid_search(
        collection_name="source_embeddings",
        reqs=[vector_req, bm25_req],
        ranker=RRFRanker(k=60),
        limit=top_k,
        output_fields=["title", "chunk_text"]
    )
    return results
```

### 9.3 LlamaIndex 集成示例

```python
from llama_index.core import VectorStoreIndex, Settings
from llama_index.vector_stores.milvus import MilvusVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding

# 配置嵌入模型
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")

# 连接 Milvus（支持 Lite / Standalone / Distributed）
vector_store = MilvusVectorStore(
    uri="./agentic_ai.db",  # Milvus Lite
    # uri="http://localhost:19530",  # Milvus Standalone
    collection_name="source_embeddings",
    dim=1536,
    overwrite=False
)

# 创建索引
index = VectorStoreIndex.from_vector_store(vector_store)

# RAG 查询
query_engine = index.as_query_engine(
    similarity_top_k=10,
    response_mode="tree_summarize"
)

response = query_engine.query(
    "ReAct 和 Chain-of-Thought 有什么区别？"
)
print(response)
```

### 9.4 LangChain 集成示例

```python
from langchain_milvus import Milvus
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA

# 初始化嵌入模型
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# 连接 Milvus 向量存储
vector_store = Milvus(
    embedding_function=embeddings,
    collection_name="source_embeddings",
    connection_args={
        "uri": "./agentic_ai.db"  # Milvus Lite
        # "uri": "http://localhost:19530"  # Milvus Standalone
    }
)

# 创建检索器
retriever = vector_store.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 10}
)

# 构建 RAG 链
llm = ChatOpenAI(model="gpt-4o", temperature=0)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
    return_source_documents=True
)

# 执行查询
result = qa_chain.invoke({"query": "什么是 Agentic RAG？"})
print(result["result"])
```

### 9.5 Milvus 备选方案（开发测试）

```python
from pymilvus import MilvusClient

# 使用 Milvus Lite 进行本地开发
client = MilvusClient("./milvus_demo.db")

# 创建 Collection
client.create_collection(
    collection_name="papers",
    dimension=1536,
    metric_type="COSINE"
)

# 插入数据
client.insert(
    collection_name="papers",
    data=[
        {"id": 1, "vector": embedding, "title": "ReAct Paper", "abstract": "..."},
        # ...
    ]
)

# 创建索引
client.create_index(
    collection_name="papers",
    field_name="vector",
    index_type="HNSW",
    metric_type="COSINE",
    params={"M": 16, "efConstruction": 128}
)

# 搜索
results = client.search(
    collection_name="papers",
    data=[query_embedding],
    limit=10,
    output_fields=["title", "abstract"]
)
```

### 9.6 性能监控与调优

```sql
-- 查看索引使用情况
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM source_embeddings
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- 调整 HNSW 搜索参数
SET hnsw.ef_search = 100;  -- 提升召回率

-- 批量数据导入后重建索引
REINDEX INDEX CONCURRENTLY idx_source_embedding_hnsw;

-- 清理碎片
VACUUM ANALYZE source_embeddings;
```

---

## References

<a id="ref1"></a>[1] LlamaIndex, "Vector Databases in AI Applications," 2024. [Online]. Available: https://docs.llamaindex.ai/

<a id="ref2"></a>[2] pgvector, "Open-source vector similarity search for Postgres," _GitHub Repository_, 2024. [Online]. Available: https://github.com/pgvector/pgvector

<a id="ref3"></a>[3] Y. A. Malkov and D. A. Yashunin, "Efficient and robust approximate nearest neighbor search using hierarchical navigable small world graphs," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 40, no. 11, pp. 2529–2542, Nov. 2018.

<a id="ref4"></a>[4] H. Jégou, M. Douze, and C. Schmid, "Product quantization for nearest neighbor search," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 33, no. 1, pp. 117–128, Jan. 2011.

<a id="ref5"></a>[5] TensorChord, "pgvecto.rs: Scalable Vector Search in Postgres," 2024. [Online]. Available: https://docs.vectorchord.ai/getting-started/overview.html

<a id="ref6"></a>[6] TensorChord, "VectorChord: High-Performance Vector Search," 2024. [Online]. Available: https://docs.vectorchord.ai/vectorchord/getting-started/overview.html

<a id="ref7"></a>[7] J. Gao and C. Long, "RaBitQ: Quantizing high-dimensional vectors with a theoretical error bound," _Proc. ACM Manag. Data_, vol. 2, no. 1, pp. 1–16, Jun. 2024.

<a id="ref8"></a>[8] TensorChord, "pgvector vs. pgvecto.rs Comparison," 2024. [Online]. Available: https://docs.vectorchord.ai/faqs/comparison-pgvector.html

<a id="ref9"></a>[9] Zilliz, "Milvus: The World's Most Advanced Open-Source Vector Database," 2024. [Online]. Available: https://milvus.io/docs/overview.md

<a id="ref10"></a>[10] Zilliz, "Milvus Architecture Overview," 2024. [Online]. Available: https://milvus.io/docs/architecture_overview.md

<a id="ref11"></a>[11] Zilliz, "Milvus Index Explained," 2024. [Online]. Available: https://milvus.io/docs/index-explained.md

<a id="ref12"></a>[12] Zilliz, "Milvus Performance Benchmarks," 2024. [Online]. Available: https://milvus.io/docs/benchmark.md

<a id="ref13"></a>[13] Weaviate, "The AI-Native Vector Database," 2024. [Online]. Available: https://docs.weaviate.io/weaviate/introduction

<a id="ref14"></a>[14] Weaviate, "Vector Indexing," 2024. [Online]. Available: https://docs.weaviate.io/weaviate/concepts/vector-index

<a id="ref15"></a>[15] Weaviate, "Model Providers," 2024. [Online]. Available: https://docs.weaviate.io/weaviate/model-providers

<a id="ref16"></a>[16] Pinecone, "The Vector Database for AI," 2024. [Online]. Available: https://docs.pinecone.io/guides/get-started/overview

<a id="ref17"></a>[17] Pinecone, "Indexing Overview," 2024. [Online]. Available: https://docs.pinecone.io/guides/index-data/indexing-overview

<a id="ref18"></a>[18] Pinecone, "Namespaces," 2024. [Online]. Available: https://docs.pinecone.io/guides/index-data/indexing-overview#namespaces

<a id="ref19"></a>[19] LlamaIndex, "Milvus Integration," 2024. [Online]. Available: https://docs.llamaindex.ai/en/stable/examples/vector_stores/MilvusIndexDemo/

<a id="ref20"></a>[20] LangChain, "Milvus Integration," 2024. [Online]. Available: https://python.langchain.com/docs/integrations/vectorstores/milvus/

<a id="ref21"></a>[21] Zilliz, "Milvus Lite: Lightweight Milvus for Local Development," 2024. [Online]. Available: https://milvus.io/docs/milvus_lite.md

<a id="ref22"></a>[22] pgvector, "Filtering and Iterative Scans," _GitHub Repository_, 2024. [Online]. Available: https://github.com/pgvector/pgvector#filtering

<a id="ref23"></a>[23] TensorChord, "VectorChord Graph Index," 2024. [Online]. Available: https://docs.vectorchord.ai/vectorchord/usage/graph-index.html

<a id="ref24"></a>[24] TensorChord, "VectorChord Prefilter," 2024. [Online]. Available: https://docs.vectorchord.ai/vectorchord/usage/prefilter.html

<a id="ref25"></a>[25] Weaviate, "Vector Quantization," 2024. [Online]. Available: https://docs.weaviate.io/weaviate/concepts/vector-quantization

<a id="ref26"></a>[26] Weaviate, "Cluster Architecture," 2024. [Online]. Available: https://docs.weaviate.io/weaviate/concepts/replication-architecture/cluster-architecture

<a id="ref27"></a>[27] Pinecone, "Hybrid Search," 2024. [Online]. Available: https://docs.pinecone.io/guides/search/hybrid-search

<a id="ref28"></a>[28] Pinecone, "Rerank Results," 2024. [Online]. Available: https://docs.pinecone.io/guides/search/rerank-results
