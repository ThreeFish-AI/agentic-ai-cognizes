---
id: vector-search-algorithm
sidebar_position: 3.2
title: 向量数据库原理与算法深度解析
last_update:
  author: Aurelius Huang
  created_at: 2025-12-24
  updated_at: 2025-12-28
  version: 1.2
  status: Pending Review
tags:
  - Vector Database
  - ANN Algorithms
  - Similarity Search
  - HNSW
  - IVF
  - Product Quantization
  - Embedding
---

> [!IMPORTANT] **解读范围**：从 LLM 缺陷的角度出发，引出向量数据库的需求，然后深入解析向量数据库的数学模型、算法原理、实现细节、性能分析、应用场景与选型建议。
>
> 向量数据库的需求不仅来自 LLM 应用，还受到如下有别于传统数据库因素的影响：
>
> - **语义搜索**
> - 数据**规模爆炸**的挑战
> - 数据**维度诅咒**

---

## 1. 背景

### 1.1 大语言模型的固有缺陷

尽管以 GPT 为代表的大语言模型（LLM）展现了惊人的文本理解与生成能力，但它们存在几个关键的固有缺陷<sup>[[1]](#ref1)</sup>：

```mermaid
mindmap
  root((LLM 固有缺陷))
    幻觉问题
      生成虚假信息
      编造不存在的事实
      自信地给出错误答案
    知识时效性
      训练数据截止日期
      无法获取实时信息
      无法感知最新事件
    上下文窗口限制
      有限的 Token 数量
      长文本处理困难
      长期记忆缺失
    领域知识缺乏
      通用知识为主
      缺乏专业领域深度
      无法访问私有数据
    推理能力局限
      复杂数学推理困难
      多步逻辑推理易出错
      因果推理能力不足
```

| 缺陷类型                  | 具体表现                                            | 影响                                 |
| ------------------------- | --------------------------------------------------- | ------------------------------------ |
| **幻觉（Hallucination）** | 生成看似合理但实际错误的内容<sup>[[1]](#ref1)</sup> | 降低输出可信度，可能导致严重错误决策 |
| **知识截止日期**          | 无法获取训练数据之后的信息<sup>[[2]](#ref2)</sup>   | 无法回答时事问题，知识库逐渐过时     |
| **上下文窗口限制**        | 单次对话无法处理超长文本<sup>[[1]](#ref1)</sup>     | 无法维持长期对话记忆，大文档处理受限 |
| **领域知识缺乏**          | 缺少特定行业或私有数据知识<sup>[[3]](#ref3)</sup>   | 无法提供专业精准的领域回答           |
| **推理能力局限**          | 复杂逻辑和数学推理易出错<sup>[[1]](#ref1)</sup>     | 在需要精确计算的场景可靠性不足       |

### 1.2 Embedding：连接语义与计算的桥梁

**Embedding（嵌入向量）** 是解决上述问题的关键技术之一。它将文本、图像、音频等非结构化数据转换为高维向量空间中的数值表示<sup>[[4]](#ref4)</sup>。

#### 1.2.1 Embedding 的数学本质

Embedding 本质上是一个映射函数 $f: X \rightarrow \mathbb{R}^d$，将输入空间 $X$ 中的对象映射到 $d$ 维实数向量空间：

$$
    \text{embed}(x) = [e_1, e_2, ..., e_d] \in \mathbb{R}^d
$$

其中：

- $x$ 是输入对象（如文本、图像）
- $d$ 是嵌入维度（常见值：128, 256, 384, 512, 768, 1024, 1536, 3072）
- $e_i$ 是向量的第 $i$ 个分量

#### 1.2.2 语义相似性的向量化

Embedding 的核心价值在于：**语义相似的对象在向量空间中距离更近**<sup>[[5]](#ref5)</sup>。

```mermaid
quadrantChart
    title Semantic Vector Space
    x-axis "低动物特性" --> "高动物特性"
    y-axis "低生物特性" --> "高生物特性"
    quadrant-1 "生物-动物"
    quadrant-2 "生物-非动物"
    quadrant-3 "非生物-非动物"
    quadrant-4 "非生物-动物"
    Cat: [0.6, 0.8]
    Dog: [0.7, 0.7]
    Car: [0.1, 0.1]
```

> [!TIP] **图示说明**
>
> - **"猫" Cat (0.6, 0.8)** 与 **"狗" Dog (0.7, 0.7)** 位于右上象限，语义距离仅 **0.14**
> - **"汽车" Car (0.1, 0.1)** 位于左下象限，与"猫"语义距离达 **0.86**
> - 这直观体现了语义相似对象在向量空间中聚集的特性

这种特性使得我们可以：

1. **语义搜索**：通过向量距离找到语义相关的内容
2. **知识检索**：从大规模知识库中检索相关信息
3. **去重聚类**：识别和分组相似内容

### 1.3 RAG：弥补 LLM 缺陷的关键架构

**检索增强生成（Retrieval-Augmented Generation, RAG）** 通过将外部知识注入 LLM 的上下文，有效解决了上述缺陷<sup>[[2]](#ref2)</sup>：

```mermaid
flowchart LR
    subgraph "RAG 工作流程"
        Q[用户查询] --> E1[查询嵌入]
        E1 --> S[向量搜索]
        S --> R[检索结果]
        R --> C[上下文增强]
        Q --> C
        C --> LLM[大语言模型]
        LLM --> A[增强回答]
    end

    subgraph "知识库"
        D1[文档1] --> E2[嵌入向量]
        D2[文档2] --> E3[嵌入向量]
        D3[文档...] --> E4[嵌入向量]
        E2 & E3 & E4 --> VDB[(向量数据库)]
    end

    VDB --> S

    style VDB fill:#52c41a,color:#fff
    style LLM fill:#1890ff,color:#fff
```

| RAG 组件       | 功能                       | 解决的 LLM 缺陷          |
| -------------- | -------------------------- | ------------------------ |
| **外部知识库** | 存储最新、专业的知识文档   | 知识时效性、领域知识缺乏 |
| **向量化**     | 将文档转换为语义向量       | 为相似性搜索提供基础     |
| **向量数据库** | 高效存储和检索向量         | 突破上下文窗口限制       |
| **语义检索**   | 找到与查询最相关的知识片段 | 提供事实依据，减少幻觉   |
| **上下文增强** | 将检索内容注入 LLM 提示    | 提供准确信息源           |

### 1.4 向量数据库的必要性

传统数据库（如 MySQL、PostgreSQL）专为结构化数据设计，无法高效处理高维向量的相似性搜索。向量数据库应运而生，解决以下核心挑战<sup>[[7]](#ref7)</sup>：

#### 1.4.1 维度诅咒（Curse of Dimensionality）

随着维度增加，数据点之间的距离趋于均匀化，传统索引方法（如 B-Tree、R-Tree）效率急剧下降：

| 维度    | 数据点数量 | 暴力搜索时间 | 传统索引效果 |
| ------- | ---------- | ------------ | ------------ |
| 2-3     | 100 万     | ~1 秒        | 极好         |
| 10-50   | 100 万     | ~10 秒       | 尚可         |
| 100-500 | 100 万     | ~100 秒      | 失效         |
| 1000+   | 100 万     | ~数分钟      | 完全失效     |

#### 1.4.2 向量数据库的核心能力

```mermaid
graph TB
    subgraph "向量数据库核心能力"
        A[高效向量存储]
        B[近似最近邻搜索 ANN]
        C[向量索引算法]
        D[混合查询支持]
        E[分布式扩展]
        F[实时更新]
    end

    A --> |"压缩量化"| A1[降低存储成本]
    B --> |"亚线性时间"| B1[毫秒级响应]
    C --> |"HNSW/IVF/PQ"| C1[高召回率]
    D --> |"向量+标量"| D1[精准过滤]
    E --> |"水平扩展"| E1[百亿级向量]
    F --> |"增量索引"| F1[实时可用]

    style B fill:#52c41a,color:#fff
    style C fill:#1890ff,color:#fff
```

#### 1.4.3 精确搜索 vs 近似搜索

| 搜索类型                    | 时间复杂度       | 召回率 | 适用场景                |
| --------------------------- | ---------------- | ------ | ----------------------- |
| **暴力搜索（Brute Force）** | O(n × d)         | 100%   | 小数据集（<10 万）      |
| **近似搜索（ANN）**         | O(log n) ~ O(√n) | 95-99% | 大规模数据集（>100 万） |

> **关键洞察**：在大规模场景下，我们愿意用少量的召回率损失（1-5%）换取数量级的性能提升。这正是 ANN 算法的核心价值。

---

## 2. 向量存储与索引基础

### 2.1 向量的数据表示

#### 2.1.1 向量类型分类

| 向量类型             | 描述                     | 存储效率      | 精度 | 典型应用              |
| -------------------- | ------------------------ | ------------- | ---- | --------------------- |
| **Dense Vector**     | 密集向量，所有维度有值   | 中            | 高   | 文本/图像嵌入         |
| **Sparse Vector**    | 稀疏向量，大部分维度为零 | 高            | 高   | TF-IDF、BM25          |
| **Binary Vector**    | 二值向量，仅含 0/1       | 极高（1-bit） | 低   | SimHash、局部敏感哈希 |
| **Quantized Vector** | 量化向量，压缩表示       | 高            | 中   | PQ 编码向量           |

#### 2.1.2 数值精度选择

```mermaid
graph LR
    subgraph "数值精度对比"
        F32[Float32<br/>4 字节/维]
        F16[Float16<br/>2 字节/维]
        BF16[BFloat16<br/>2 字节/维]
        I8[Int8<br/>1 字节/维]
        B1[Binary<br/>1/8 字节/维]
    end

    F32 --> |"精度最高"| APP1[精确计算]
    F16 --> |"GPU 友好"| APP2[推理加速]
    I8 --> |"4x 压缩"| APP3[大规模存储]
    B1 --> |"32x 压缩"| APP4[极限压缩]

    style F32 fill:#1890ff,color:#fff
    style I8 fill:#52c41a,color:#fff
```

| 精度类型   | 存储空间   | 相对误差 | 计算速度 | 推荐场景           |
| ---------- | ---------- | -------- | -------- | ------------------ |
| **FP32**   | 4 字节     | 基准     | 基准     | 精确计算、训练     |
| **FP16**   | 2 字节     | <0.1%    | 1.5-2x   | GPU 推理、存储优化 |
| **BF16**   | 2 字节     | <0.5%    | 1.5-2x   | 训练稳定性         |
| **INT8**   | 1 字节     | <1%      | 2-4x     | 大规模部署         |
| **Binary** | 0.125 字节 | 5-10%    | 10-32x   | 极端压缩、初筛     |

### 2.2 索引结构概览

向量索引（Vector Index）是向量数据库的核心组件，决定了搜索效率和召回质量。主流索引算法可分为以下几类<sup>[[8]](#ref8)</sup>：

```mermaid
graph TB
    subgraph "向量索引分类"
        ROOT[向量索引算法]

        ROOT --> TREE[基于树的索引]
        ROOT --> HASH[基于哈希的索引]
        ROOT --> QUANT[基于量化的索引]
        ROOT --> GRAPH[基于图的索引]

        TREE --> KD[KD-Tree]
        TREE --> BALL[Ball-Tree]
        TREE --> ANNOY[Annoy]

        HASH --> LSH[LSH]
        HASH --> MINHASH[MinHash]

        QUANT --> PQ[Product Quantization]
        QUANT --> SQ[Scalar Quantization]
        QUANT --> OPQ[Optimized PQ]

        GRAPH --> NSW[NSW]
        GRAPH --> HNSW[HNSW]
        GRAPH --> VAMANA[Vamana/DiskANN]
    end

    style HNSW fill:#52c41a,color:#fff
    style PQ fill:#1890ff,color:#fff
    style LSH fill:#fa8c16,color:#fff
```

| 索引类型     | 代表算法       | 时间复杂度 | 空间开销 | 召回率 | 适用场景             |
| ------------ | -------------- | ---------- | -------- | ------ | -------------------- |
| **基于树**   | KD-Tree, Annoy | O(log n)   | 中       | 高     | 低维数据（<20 维）   |
| **基于哈希** | LSH            | O(1) 平均  | 低-中    | 中     | 高吞吐、容忍精度损失 |
| **基于量化** | PQ, SQ         | O(K × M)   | 极低     | 中-高  | 内存受限场景         |
| **基于图**   | HNSW, NSW      | O(log n)   | 高       | 极高   | 高召回要求           |
| **复合索引** | IVF + PQ       | O(√n × M)  | 低       | 高     | 大规模生产环境       |

### 2.3 索引构建与查询流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant API as API 层
    participant IDX as 索引引擎
    participant VDB as 向量存储

    rect rgb(240, 248, 255)
    Note over U,VDB: 索引构建阶段
    U->>API: 插入向量 (id, vector, metadata)
    API->>VDB: 存储原始向量
    API->>IDX: 触发索引更新
    IDX->>IDX: 计算索引结构
    IDX->>VDB: 存储索引数据
    end

    rect rgb(255, 248, 240)
    Note over U,VDB: 查询阶段
    U->>API: 搜索请求 (query_vector, top_k, filter)
    API->>IDX: 执行 ANN 搜索
    IDX->>IDX: 遍历索引结构
    IDX->>VDB: 获取候选向量
    IDX->>IDX: 计算精确距离
    IDX-->>API: 返回 Top-K 结果
    API-->>U: 返回 (id, score, metadata)
    end
```

---

## 3. 基础索引算法

本章详细介绍向量索引的基础算法，包括 K-Means 聚类、局部敏感哈希（LSH）和导航小世界图（NSW）。

### 3.1 K-Means 聚类与向量量化

#### 3.1.1 K-Means 算法原理

K-Means 是向量量化（Vector Quantization）的基础算法，通过将数据划分为 K 个簇，用簇中心（Centroid）代表该簇所有向量<sup>[[9]](#ref9)</sup>。

**数学目标**：最小化簇内平方误差和（Within-Cluster Sum of Squares, WCSS）：

$$
J = \sum_{i=1}^{K} \sum_{x \in C_i} \|x - \mu_i\|^2
$$

其中：

- $K$ 是簇的数量
- $C_i$ 是第 $i$ 个簇
- $\mu_i$ 是第 $i$ 个簇的中心
- $\|x - \mu_i\|^2$ 是向量 $x$ 到簇中心的欧几里得距离的平方

**算法流程**：

```mermaid
flowchart TD
    A[初始化: 随机选择 K 个中心点] --> B[分配步骤: 将每个点分配到最近的中心]
    B --> C[更新步骤: 重新计算每个簇的中心]
    C --> D{中心点是否收敛?}
    D -->|否| B
    D -->|是| E[输出最终簇划分]

    style A fill:#e6f7ff
    style E fill:#f6ffed
```

**伪代码**：

```python
def kmeans(vectors, k, max_iters=100):
    # 1. 随机初始化 K 个中心
    centroids = random_select(vectors, k)

    for _ in range(max_iters):
        # 2. 分配：每个向量分配到最近的中心
        clusters = assign_to_nearest(vectors, centroids)

        # 3. 更新：重新计算中心
        new_centroids = compute_centroids(clusters)

        # 4. 检查收敛
        if converged(centroids, new_centroids):
            break
        centroids = new_centroids

    return centroids, clusters
```

#### 3.1.2 向量量化应用

K-Means 在向量索引中的核心应用是构建**码本（Codebook）**：

```mermaid
graph LR
    subgraph "向量量化过程"
        V[原始向量<br/>1536 维 × N 个] --> KM[K-Means<br/>K=1024]
        KM --> CB[码本<br/>1024 个中心向量]
        KM --> ID[向量编码<br/>每向量 10 bits]
    end

    subgraph "压缩效果"
        ORIG[原始: 6KB/向量] --> COMP[压缩后: 1.25 字节/向量]
    end

    style KM fill:#1890ff,color:#fff
    style COMP fill:#52c41a,color:#fff
```

| 参数         | 作用               | 典型值          | 权衡                 |
| ------------ | ------------------ | --------------- | -------------------- |
| **K**        | 簇的数量，决定精度 | 256, 1024, 4096 | 越大越精确，存储越多 |
| **初始化**   | 中心点初始选择策略 | K-Means++       | 影响收敛速度和质量   |
| **迭代次数** | 最大迭代轮数       | 10-100          | 越多越精确，耗时越久 |

### 3.2 局部敏感哈希（LSH）

#### 3.2.1 LSH 核心思想

局部敏感哈希（Locality Sensitive Hashing, LSH）的核心思想是：**相似的向量以高概率被哈希到同一个桶，不相似的向量以低概率被哈希到同一个桶**<sup>[[10]](#ref10)</sup>。

与传统哈希（尽量减少冲突）相反，LSH **刻意增加相似项的冲突**<sup>[[10]](#ref10)</sup>：

```mermaid
graph TB
    subgraph "传统哈希 vs LSH"
        T[传统哈希] --> T1[最小化冲突]
        T --> T2[相似输入 → 不同桶]

        L[LSH] --> L1[最大化相似冲突]
        L --> L2[相似输入 → 相同桶]
    end

    style T fill:#ff4d4f,color:#fff
    style L fill:#52c41a,color:#fff
```

**数学定义**：一个哈希函数族 $\mathcal{H}$ 是 $(d_1, d_2, p_1, p_2)$-敏感的，当且仅当对任意 $v_1, v_2 \in \mathbb{R}^d$：

- 如果 $\text{dist}(v_1, v_2) \leq d_1$，则 $P[h(v_1) = h(v_2)] \geq p_1$
- 如果 $\text{dist}(v_1, v_2) \geq d_2$，则 $P[h(v_1) = h(v_2)] \leq p_2$

其中 $d_1 < d_2$ 且 $p_1 > p_2$。

#### 3.2.2 随机投影 LSH

对于余弦相似度，最常用的 LSH 方法是**随机超平面投影**<sup>[[10]](#ref10)</sup>：

```mermaid
graph LR
    subgraph "随机投影 LSH"
        V[向量 v] --> P1[投影到超平面 1]
        V --> P2[投影到超平面 2]
        V --> P3[投影到超平面 k]

        P1 --> |"v·r1 > 0 → 1"| B1[1]
        P2 --> |"v·r2 < 0 → 0"| B2[0]
        P3 --> |"v·r3 > 0 → 1"| B3[1]

        B1 & B2 & B3 --> HC[哈希码: 101]
    end
```

**算法流程**：

1. **生成随机超平面**：生成 $k$ 个随机单位向量 $r_1, r_2, ..., r_k$
2. **计算哈希码**：对每个输入向量 $v$，计算 $h_i(v) = \text{sign}(v \cdot r_i)$
3. **构建哈希表**：将具有相同哈希码的向量放入同一个桶
4. **查询**：将查询向量哈希，检索同一桶中的候选向量

**伪代码**：

```python
class RandomProjectionLSH:
    def __init__(self, dim, num_planes, num_tables):
        self.num_tables = num_tables
        # 每个哈希表有不同的随机超平面
        self.hyperplanes = [
            np.random.randn(num_planes, dim)
            for _ in range(num_tables)
        ]
        self.tables = [{} for _ in range(num_tables)]

    def hash(self, vector, table_idx):
        # 计算向量与超平面的点积符号
        projections = self.hyperplanes[table_idx] @ vector
        return tuple((projections > 0).astype(int))

    def insert(self, vector, label):
        for i in range(self.num_tables):
            hash_code = self.hash(vector, i)
            if hash_code not in self.tables[i]:
                self.tables[i][hash_code] = []
            self.tables[i][hash_code].append(label)

    def query(self, vector, k):
        candidates = set()
        for i in range(self.num_tables):
            hash_code = self.hash(vector, i)
            if hash_code in self.tables[i]:
                candidates.update(self.tables[i][hash_code])
        # 对候选集进行精确距离计算，返回 Top-K
        return refine_and_rank(candidates, vector, k)
```

#### 3.2.3 LSH 参数调优

| 参数              | 含义             | 影响                             |
| ----------------- | ---------------- | -------------------------------- |
| **k（比特数）**   | 每个哈希码的位数 | 越大桶越细，召回降低，精度提高   |
| **L（哈希表数）** | 独立哈希表的数量 | 越多召回率越高，但内存和时间增加 |
| **桶大小**        | 每个桶的容量     | 太大查询慢，太小可能漏掉相似项   |

**召回率与哈希表数量的关系**：

$$
P[\text{找到近邻}] = 1 - (1 - p^k)^L
$$

其中 $p$ 是两个相似向量被单个超平面分到同一侧的概率。

#### 3.2.4 LSH 变体

| LSH 变体              | 适用距离度量   | 特点                                       |
| --------------------- | -------------- | ------------------------------------------ |
| **Random Projection** | 余弦相似度     | 使用随机超平面<sup>[[10]](#ref10)</sup>    |
| **MinHash**           | Jaccard 相似度 | 适用于集合数据<sup>[[10]](#ref10)</sup>    |
| **SimHash**           | 汉明距离       | 适用于文档去重<sup>[[10]](#ref10)</sup>    |
| **p-stable LSH**      | Lp 距离        | 适用于 L1/L2 距离<sup>[[10]](#ref10)</sup> |

### 3.3 导航小世界图（NSW）

#### 3.3.1 小世界网络理论

小世界现象源于社会学中的"六度分隔"理论：任意两个人之间平均只需要六个中间人就能建立联系。在图论中，小世界图具有以下特性<sup>[[11]](#ref11)</sup>：

- **高聚类系数**：局部节点紧密连接
- **短平均路径**：任意两点之间的最短路径较短

```mermaid
graph TB
    subgraph "小世界图特性"
        A[节点] --> B[局部连接]
        A --> C[长程连接]
        B --> D["高聚类系数<br/>邻居之间高度互连"]
        C --> E["短路径长度<br/>O(log n) 跳数"]
    end

    style D fill:#91d5ff
    style E fill:#b7eb8f
```

#### 3.3.2 NSW 图构建

**导航小世界图（Navigable Small World, NSW）** 是一种基于贪婪路由的近邻图结构<sup>[[11]](#ref11)</sup>：

**构建算法**：

```mermaid
flowchart TD
    A[输入: 新向量 v] --> B[随机选择入口点]
    B --> C[贪婪搜索: 找到当前最近 M 个邻居]
    C --> D[将 v 与这 M 个邻居双向连接]
    D --> E[插入完成]

    style C fill:#1890ff,color:#fff
```

**伪代码**：

```python
class NSW:
    def __init__(self, M=16):
        self.M = M  # 每个节点的最大邻居数
        self.graph = {}

    def insert(self, vector, label):
        if len(self.graph) == 0:
            self.graph[label] = {'vector': vector, 'neighbors': []}
            return

        # 1. 贪婪搜索找到当前 M 个最近邻居
        neighbors = self.greedy_search(vector, self.M)

        # 2. 建立双向连接
        self.graph[label] = {'vector': vector, 'neighbors': neighbors}
        for n in neighbors:
            self.graph[n]['neighbors'].append(label)
            # 如果邻居数超过 M，移除最远的
            if len(self.graph[n]['neighbors']) > self.M:
                self._prune_neighbors(n)

    def greedy_search(self, query, k, entry=None):
        if entry is None:
            entry = random.choice(list(self.graph.keys()))

        visited = set()
        candidates = [(self._distance(query, entry), entry)]
        results = []

        while candidates:
            dist, current = heapq.heappop(candidates)
            if current in visited:
                continue
            visited.add(current)
            results.append((dist, current))

            # 探索邻居
            for neighbor in self.graph[current]['neighbors']:
                if neighbor not in visited:
                    d = self._distance(query, neighbor)
                    heapq.heappush(candidates, (d, neighbor))

        return [r[1] for r in sorted(results)[:k]]
```

#### 3.3.3 NSW 的搜索过程

NSW 使用**贪婪路由**进行搜索：从入口点开始，每一步都移动到当前节点邻居中距离查询最近的节点，直到无法找到更近的邻居<sup>[[11]](#ref11)</sup>。

```mermaid
graph LR
    subgraph "NSW 贪婪搜索"
        Q[查询向量] --> E[入口点]
        E --> |"移动到更近邻居"| N1[节点1]
        N1 --> |"继续移动"| N2[节点2]
        N2 --> |"继续移动"| N3[节点3]
        N3 --> |"局部最优"| R[返回结果]
    end

    style Q fill:#ffd591
    style R fill:#b7eb8f
```

**复杂度分析**：

| 指标       | 复杂度           | 说明                         |
| ---------- | ---------------- | ---------------------------- |
| 构建时间   | O(n × log n × M) | n 个向量，每个搜索 O(log n)  |
| 搜索时间   | O(log^k n)       | k 是小世界指数，通常 k ≈ 1-2 |
| 空间复杂度 | O(n × M)         | 每个节点存储 M 个邻居        |

**NSW 的局限性**：

1. **局部最优陷阱**：贪婪搜索可能陷入局部最优
2. **入口点敏感**：不同入口点可能导致不同结果
3. **扩展性有限**：单层结构在大规模数据上效率下降

> **进化方向**：HNSW 通过引入多层结构解决了这些问题，将在第 4 章详细介绍。

---

## 4. 高级索引算法

本章深入介绍三种最重要的高级索引算法：分层导航小世界图（HNSW）、倒排文件索引（IVF）系列和乘积量化（PQ）。

### 4.1 分层导航小世界图（HNSW）

#### 4.1.1 HNSW 核心思想

**分层导航小世界图（Hierarchical Navigable Small World, HNSW）** 是当前最流行的高性能 ANN 算法，由 Yury Malkov 在 2016 年提出<sup>[[12]](#ref12)</sup>。

HNSW 的核心创新是将 NSW 与 Skip List 数据结构相结合，构建**多层图结构**：

```mermaid
graph TB
    subgraph "HNSW 多层结构"
        L3["Layer 3 (最稀疏)<br/>长距离跳跃"]
        L2["Layer 2<br/>中等密度"]
        L1["Layer 1<br/>较密集"]
        L0["Layer 0 (最密集)<br/>所有节点"]
    end

    Q[查询] --> L3
    L3 --> |"快速定位区域"| L2
    L2 --> |"逐步细化"| L1
    L1 --> |"精确搜索"| L0
    L0 --> R[最终结果]

    style L3 fill:#ffe58f
    style L0 fill:#91d5ff
    style R fill:#b7eb8f
```

**层级概率**：每个节点被分配到第 $l$ 层的概率为：

$$
P(\text{level} = l) = \frac{1}{m_L} \cdot \left(\frac{1}{m_L}\right)^{l-1} = \left(\frac{1}{m_L}\right)^l
$$

其中 $m_L$ 是层级因子（通常为 $\frac{1}{\ln(M)}$，M 是最大连接数）。

#### 4.1.2 HNSW 图构建算法

```mermaid
flowchart TD
    A[输入: 新向量 q] --> B[计算最大层级 l]
    B --> C[设置入口点 ep = 顶层入口]

    C --> D{当前层 > l?}
    D --> |是| E[在当前层贪婪搜索，找到离 q 最近的点]
    E --> F[下降到下一层]
    F --> D

    D --> |否| G[从当前层到 Layer 0]
    G --> H[在每层搜索 ef_construction 个候选邻居]
    H --> I[选择 M 个邻居建立双向连接]
    I --> J[应用启发式剪枝]
    J --> K{还有更低层?}
    K --> |是| G
    K --> |否| L[更新入口点（如果 l 更高）]
    L --> M[插入完成]

    style B fill:#e6f7ff
    style H fill:#1890ff,color:#fff
    style J fill:#fa8c16,color:#fff
```

**伪代码**：

```python
class HNSW:
    def __init__(self, M=16, ef_construction=200, ml=None):
        self.M = M                       # 每层最大连接数
        self.M0 = 2 * M                  # Layer 0 最大连接数
        self.ef_construction = ef_construction  # 构建时搜索宽度
        self.ml = ml or 1 / math.log(M)  # 层级因子
        self.layers = []
        self.entry_point = None
        self.max_level = 0

    def _random_level(self):
        """随机生成节点所在的最高层级"""
        level = 0
        while random.random() < self.ml and level < self.max_level + 1:
            level += 1
        return level

    def insert(self, vector, label):
        level = self._random_level()

        if self.entry_point is None:
            self.entry_point = label
            self.max_level = level
            self._add_node(label, vector, level)
            return

        # Phase 1: 从顶层贪婪搜索到目标层
        ep = self.entry_point
        for l in range(self.max_level, level, -1):
            ep = self._search_layer(vector, ep, 1, l)[0]

        # Phase 2: 在目标层及以下建立连接
        for l in range(min(level, self.max_level), -1, -1):
            candidates = self._search_layer(vector, ep, self.ef_construction, l)
            neighbors = self._select_neighbors(vector, candidates, self.M if l > 0 else self.M0, l)
            self._add_connections(label, neighbors, l)
            ep = candidates[0]

        # 更新入口点
        if level > self.max_level:
            self.entry_point = label
            self.max_level = level

    def _select_neighbors(self, vector, candidates, M, level):
        """启发式邻居选择：兼顾距离和多样性"""
        # Simple heuristic: 选择最近的 M 个
        # Advanced: 可以使用 RNG（Relative Neighborhood Graph）启发式
        return sorted(candidates, key=lambda c: self._distance(vector, c))[:M]
```

#### 4.1.3 HNSW 搜索算法

```mermaid
sequenceDiagram
    participant Q as 查询
    participant L3 as Layer 3
    participant L2 as Layer 2
    participant L1 as Layer 1
    participant L0 as Layer 0

    Q->>L3: 从入口点开始
    L3->>L3: 贪婪搜索，找到局部最优
    L3->>L2: 下降到 Layer 2
    L2->>L2: 继续贪婪搜索
    L2->>L1: 下降到 Layer 1
    L1->>L1: 贪婪搜索
    L1->>L0: 下降到 Layer 0
    L0->>L0: ef_search 范围搜索
    L0->>Q: 返回 Top-K 结果
```

**搜索伪代码**：

```python
def search(self, query, k, ef_search=None):
    ef = ef_search or k

    # Phase 1: 从顶层贪婪下降
    ep = self.entry_point
    for l in range(self.max_level, 0, -1):
        ep = self._search_layer(query, ep, 1, l)[0]

    # Phase 2: 在 Layer 0 进行宽度优先搜索
    candidates = self._search_layer(query, ep, ef, 0)

    return sorted(candidates, key=lambda c: self._distance(query, c))[:k]

def _search_layer(self, query, entry_point, ef, level):
    visited = {entry_point}
    candidates = [(self._distance(query, entry_point), entry_point)]
    result = list(candidates)

    while candidates:
        dist, current = heapq.heappop(candidates)

        # 如果当前距离大于结果中最远的距离，停止
        if len(result) >= ef and dist > result[-1][0]:
            break

        # 探索邻居
        for neighbor in self._get_neighbors(current, level):
            if neighbor not in visited:
                visited.add(neighbor)
                d = self._distance(query, neighbor)
                if len(result) < ef or d < result[-1][0]:
                    heapq.heappush(candidates, (d, neighbor))
                    result.append((d, neighbor))
                    result = sorted(result)[:ef]

    return [r[1] for r in result]
```

#### 4.1.4 HNSW 参数调优指南

| 参数                | 含义           | 推荐值  | 影响                           |
| ------------------- | -------------- | ------- | ------------------------------ |
| **M**               | 每层最大邻居数 | 16-64   | 越大召回越高，但构建和搜索更慢 |
| **ef_construction** | 构建时搜索宽度 | 100-200 | 越大索引质量越高               |
| **ef_search**       | 搜索时探索宽度 | 10-1000 | 越大召回越高，延迟越大         |
| **ml**              | 层级因子       | 1/ln(M) | 控制层级分布                   |

**性能与召回率权衡**：

```mermaid
graph LR
    subgraph "参数调优"
        M[M=16] --> |"更高召回"| M32[M=32]
        M32 --> |"更高召回"| M64[M=64]

        EF[ef=10] --> |"更高召回"| EF100[ef=100]
        EF100 --> |"更高召回"| EF500[ef=500]
    end

    subgraph "权衡"
        HIGH[高召回率 99%+] --> SLOW[延迟 10-50ms]
        LOW[低召回率 90%] --> FAST[延迟 1-5ms]
    end
```

#### 4.1.5 HNSW 复杂度分析

| 指标     | 复杂度                  | 说明                         |
| -------- | ----------------------- | ---------------------------- |
| 构建时间 | O(n × log n × M × ef_c) | ef_c = ef_construction       |
| 搜索时间 | O(log n × ef × M)       | 实际通常 < 1ms               |
| 内存占用 | O(n × M × L)            | L 是平均层数 ≈ log(n)/log(M) |

### 4.2 倒排文件索引（IVF）系列

#### 4.2.1 IVF 基本原理

**倒排文件索引（Inverted File Index, IVF）** 使用聚类将向量空间划分为多个区域，查询时只搜索最相关的几个区域<sup>[[13]](#ref13)</sup>。

```mermaid
graph TB
    subgraph "IVF 索引结构"
        DATA[原始向量<br/>N 个] --> CLUSTER[K-Means 聚类]
        CLUSTER --> C1[簇 1<br/>中心 c1]
        CLUSTER --> C2[簇 2<br/>中心 c2]
        CLUSTER --> C3[...<br/>...]
        CLUSTER --> CK[簇 K<br/>中心 cK]

        C1 --> V1[向量列表 1]
        C2 --> V2[向量列表 2]
        CK --> VK[向量列表 K]
    end

    Q[查询向量] --> FIND[找到最近的 nprobe 个中心]
    FIND --> SEARCH[只在这些簇中搜索]
    SEARCH --> RESULT[返回 Top-K]

    style CLUSTER fill:#1890ff,color:#fff
    style FIND fill:#fa8c16,color:#fff
```

**数学表述**：

1. **索引构建**：使用 K-Means 将 n 个向量划分为 K 个簇
2. **查询**：给定查询向量 q，首先找到 q 最近的 nprobe 个簇中心，然后在这些簇中进行精确搜索

搜索复杂度从 O(n) 降为 O(K + nprobe × n/K)。

#### 4.2.2 IVFFlat

**IVFFlat** 是最基础的 IVF 变体，簇内存储原始向量：

```python
class IVFFlat:
    def __init__(self, nlist):
        self.nlist = nlist  # 簇的数量
        self.centroids = None
        self.inverted_lists = [[] for _ in range(nlist)]

    def train(self, vectors):
        """使用 K-Means 训练聚类中心"""
        self.centroids = kmeans(vectors, self.nlist)

    def add(self, vectors, labels):
        """将向量分配到对应的簇"""
        for vec, label in zip(vectors, labels):
            cluster_id = self._find_nearest_centroid(vec)
            self.inverted_lists[cluster_id].append((label, vec))

    def search(self, query, k, nprobe):
        """搜索最近的 k 个向量"""
        # 1. 找到最近的 nprobe 个簇
        nearest_clusters = self._find_nearest_centroids(query, nprobe)

        # 2. 在这些簇中精确搜索
        candidates = []
        for cluster_id in nearest_clusters:
            for label, vec in self.inverted_lists[cluster_id]:
                dist = self._distance(query, vec)
                candidates.append((dist, label))

        # 3. 返回 Top-K
        return sorted(candidates)[:k]
```

#### 4.2.3 IVF 参数配置

| 参数         | 建议值                 | 说明                      |
| ------------ | ---------------------- | ------------------------- |
| **nlist**    | sqrt(n) 或 4×sqrt(n)   | 簇的数量，n 是向量数      |
| **nprobe**   | nlist×0.01 ~ nlist×0.1 | 查询时搜索的簇数          |
| **训练数据** | min(n, 256×nlist)      | 用于 K-Means 训练的样本数 |

**nlist 经验公式**：

| 数据规模       | nlist 建议值 | nprobe 建议值 |
| -------------- | ------------ | ------------- |
| n < 1M         | 1,000        | 10-50         |
| 1M ≤ n < 10M   | 4,096        | 50-100        |
| 10M ≤ n < 100M | 16,384       | 100-200       |
| n ≥ 100M       | 65,536       | 200-500       |

### 4.3 乘积量化（Product Quantization）

#### 4.3.1 PQ 核心思想

**乘积量化（Product Quantization, PQ）** 是一种极具效率的向量压缩技术，将高维向量分割为多个子向量，分别量化后用紧凑的码字表示<sup>[[13]](#ref13)</sup>。

**核心思想**：将 d 维向量分割为 M 个子向量，每个子向量独立进行 K 均值聚类：

$$
v = [v_1, v_2, ..., v_M], \quad v_i \in \mathbb{R}^{d/M}
$$

每个子向量 $v_i$ 用其所属簇的码字 $q_i$ 替代：

$$
\tilde{v} = [q_1(v_1), q_2(v_2), ..., q_M(v_M)]
$$

```mermaid
graph TB
    subgraph "PQ 编码过程"
        V["原始向量<br/>128 维"]
        V --> S1["子向量 1<br/>16 维"]
        V --> S2["子向量 2<br/>16 维"]
        V --> S8["...<br/>子向量 8<br/>16 维"]

        S1 --> Q1["量化<br/>K=256"]
        S2 --> Q2["量化<br/>K=256"]
        S8 --> Q8["量化<br/>K=256"]

        Q1 --> C1["码字: 42"]
        Q2 --> C2["码字: 189"]
        Q8 --> C8["码字: 73"]

        C1 & C2 & C8 --> CODE["PQ 编码: [42,189,...,73]<br/>8 字节"]
    end

    style V fill:#ffe58f
    style CODE fill:#b7eb8f
```

#### 4.3.2 PQ 压缩率分析

假设原始向量为 d=128 维 FP32（512 字节），使用 M=8 个子空间，每个子空间 K=256 个聚类中心：

| 项目         | 计算                          | 结果           |
| ------------ | ----------------------------- | -------------- |
| 原始向量大小 | 128 × 4 字节                  | 512 字节       |
| PQ 编码大小  | 8 × 1 字节（log2(256)=8 bit） | 8 字节         |
| 压缩率       | 512 / 8                       | **64 倍**      |
| 码本大小     | 8 × 256 × 16 × 4 字节         | 128 KB（共享） |

#### 4.3.3 PQ 距离计算

PQ 使用**非对称距离计算（Asymmetric Distance Computation, ADC）**：

1. **预计算**：查询向量 q 到每个子空间所有码字的距离表

$$
D_{ij} = \|q_i - c_{ij}\|^2, \quad i \in [1,M], j \in [1,K]
$$

2. **查表计算**：对每个编码向量，通过查表累加距离

$$
\|q - \tilde{v}\|^2 \approx \sum_{i=1}^{M} D_{i, \text{code}_i(v)}
$$

```python
class ProductQuantization:
    def __init__(self, d, M, Ks=256):
        self.d = d       # 向量维度
        self.M = M       # 子空间数量
        self.Ks = Ks     # 每个子空间的聚类数
        self.ds = d // M  # 子向量维度
        self.codebooks = None  # M 个码本，每个 Ks × ds

    def train(self, vectors):
        """训练 M 个独立的码本"""
        self.codebooks = []
        for m in range(self.M):
            sub_vectors = vectors[:, m*self.ds:(m+1)*self.ds]
            centroids = kmeans(sub_vectors, self.Ks)
            self.codebooks.append(centroids)

    def encode(self, vector):
        """将向量编码为 M 个码字"""
        codes = []
        for m in range(self.M):
            sub_vec = vector[m*self.ds:(m+1)*self.ds]
            code = self._find_nearest(sub_vec, self.codebooks[m])
            codes.append(code)
        return np.array(codes, dtype=np.uint8)

    def compute_distance_table(self, query):
        """预计算查询到所有码字的距离表"""
        table = np.zeros((self.M, self.Ks))
        for m in range(self.M):
            sub_query = query[m*self.ds:(m+1)*self.ds]
            for k in range(self.Ks):
                table[m, k] = np.sum((sub_query - self.codebooks[m][k])**2)
        return table

    def search_with_table(self, table, codes, k):
        """使用距离表计算近似距离"""
        distances = []
        for i, code in enumerate(codes):
            dist = sum(table[m, code[m]] for m in range(self.M))
            distances.append((dist, i))
        return sorted(distances)[:k]
```

#### 4.3.4 IVFPQ：IVF + PQ 组合

**IVFPQ** 结合了 IVF 的空间划分和 PQ 的向量压缩，是大规模向量搜索的主流方案<sup>[[14]](#ref14)</sup>：

```mermaid
graph TB
    subgraph "IVFPQ 索引结构"
        V[原始向量] --> IVF[IVF 聚类<br/>nlist 个簇]
        IVF --> R1[簇 1: 残差向量们]
        IVF --> R2[簇 2: 残差向量们]
        IVF --> RK[簇 K: 残差向量们]

        R1 --> PQ1[PQ 编码]
        R2 --> PQ2[PQ 编码]
        RK --> PQK[PQ 编码]
    end

    subgraph "搜索流程"
        Q[查询] --> S1[1. 找最近 nprobe 个簇中心]
        S1 --> S2[2. 计算残差 = query - 中心]
        S2 --> S3[3. 对残差构建距离表]
        S3 --> S4[4. 查表累加计算候选距离]
        S4 --> S5[5. 返回 Top-K]
    end

    style IVF fill:#1890ff,color:#fff
    style PQ1 fill:#52c41a,color:#fff
```

**残差编码**：存储的是向量到簇中心的残差，而不是原始向量：

$$
r = v - c_{\text{cluster}(v)}
$$

这样可以进一步提高量化精度，因为残差分布更集中。

#### 4.3.5 PQ 变体对比

| 算法       | 描述                    | 优点         | 缺点                                  |
| ---------- | ----------------------- | ------------ | ------------------------------------- |
| **PQ**     | 基础乘积量化            | 简单高效     | 子空间相关性丢失                      |
| **OPQ**    | 优化的 PQ，先做旋转变换 | 更高精度     | 训练复杂                              |
| **RQ**     | 残差量化，多级量化残差  | 极高压缩精度 | 编码解码慢                            |
| **SQ**     | 标量量化，每维独立量化  | 实现简单     | 压缩率有限（4x）                      |
| **RaBitQ** | 随机二进制量化          | 内存极低     | 适合特定场景<sup>[[15]](#ref15)</sup> |

---

## 5. 磁盘索引与 GPU 加速

当数据规模超出内存容量，或需要极致性能时，需要考虑磁盘索引和 GPU 加速方案。

### 5.1 DiskANN：突破内存限制的图索引

#### 5.1.1 DiskANN 设计动机

**DiskANN** 由微软研究院开发，专为解决**十亿级向量无法完全载入内存**的问题而设计<sup>[[16]](#ref16)</sup>。其核心创新是将图索引存储在 SSD 上，同时利用内存中的压缩向量加速搜索。

```mermaid
graph TB
    subgraph "DiskANN 混合存储架构"
        RAM[内存]
        SSD[固态硬盘]

        RAM --> PQV[压缩向量<br/>PQ 编码]
        RAM --> ENTRY[入口点缓存]

        SSD --> FULL[完整向量]
        SSD --> GRAPH[图索引结构]
    end

    subgraph "搜索流程"
        Q[查询] --> S1[1. 使用内存中 PQ 向量导航]
        S1 --> S2[2. 读取 SSD 上的候选全精度向量]
        S2 --> S3[3. 精确距离计算]
        S3 --> S4[4. 返回 Top-K]
    end

    style RAM fill:#91d5ff
    style SSD fill:#ffd591
```

#### 5.1.2 Vamana 图构建算法

DiskANN 使用 **Vamana** 算法构建搜索图，与 HNSW 的关键区别在于<sup>[[16]](#ref16)</sup>：

1. **单层结构**：不使用多层层级，而是通过优化图的直径来保证搜索效率
2. **α-RNG 剪枝**：使用相对邻域图（Relative Neighborhood Graph）启发式进行边剪枝

**Vamana 构建流程**：

```mermaid
flowchart TD
    A[初始化随机图] --> B[对每个节点]
    B --> C[贪婪搜索找候选邻居]
    C --> D[α-RNG 剪枝选择邻居]
    D --> E[建立双向连接]
    E --> F{所有节点处理完？}
    F --> |否| B
    F --> |是| G[多次迭代优化]
    G --> H[输出最终图]

    style D fill:#fa8c16,color:#fff
```

**α-RNG 剪枝规则**：

对于候选邻居 $p$，如果存在另一个已选邻居 $p'$ 满足：

$$
\alpha \cdot d(v, p') < d(v, p) \quad \text{且} \quad d(p, p') < d(v, p)
$$

则不选择 $p$ 作为邻居。参数 $\alpha \geq 1$ 控制剪枝的激进程度。

#### 5.1.3 DiskANN 性能特性

| 特性     | 数值              | 说明           |
| -------- | ----------------- | -------------- |
| 数据规模 | 10 亿+ 向量       | 存储在 SSD 上  |
| 内存占用 | 约 8-16 字节/向量 | 仅存储 PQ 编码 |
| 搜索延迟 | 1-5 毫秒          | 95%+ 召回率    |
| 索引构建 | 数小时（十亿级）  | 可并行构建     |

**与 HNSW 的对比**：

| 维度     | HNSW           | DiskANN                     |
| -------- | -------------- | --------------------------- |
| 存储位置 | 全部在内存     | 图+全向量在 SSD，压缩在内存 |
| 内存需求 | ~100 字节/向量 | ~10 字节/向量               |
| 延迟     | 亚毫秒         | 1-5 毫秒                    |
| 召回率   | 极高（99%+）   | 高（95%+）                  |
| 适用规模 | <1 亿向量      | 1-100 亿向量                |

### 5.2 ScaNN：Google 的高效向量搜索

#### 5.2.1 ScaNN 核心技术

**ScaNN（Scalable Nearest Neighbors）** 是 Google 开发的高效向量搜索库，其核心创新是**各向异性向量量化（Anisotropic Vector Quantization）**<sup>[[17]](#ref17)</sup>。

传统 PQ 优化的是**重构误差**：

$$
\min \sum_i \|v_i - \tilde{v}_i\|^2
$$

而 ScaNN 优化的是**内积估计误差**，特别关注高内积值的精度：

$$
\min \sum_i \left( \langle q, v_i \rangle - \langle q, \tilde{v}_i \rangle \right)^2 \cdot w(v_i)
$$

其中权重 $w(v_i)$ 对更可能成为近邻的向量赋予更高权重。

```mermaid
graph LR
    subgraph "ScaNN 三阶段搜索"
        P[分区<br/>Partitioning]
        Q[量化<br/>Anisotropic VQ]
        R[重排序<br/>Reranking]
    end

    Query[查询] --> P
    P --> |"选择相关分区"| Q
    Q --> |"快速近似距离"| R
    R --> |"精确重排"| Result[Top-K 结果]

    style Q fill:#52c41a,color:#fff
```

#### 5.2.2 各向异性量化原理

```mermaid
graph TB
    subgraph "各向同性 vs 各向异性量化"
        ISO[各向同性<br/>均匀优化所有方向]
        ANISO[各向异性<br/>优先优化查询方向]
    end

    ISO --> |"重构误差均匀"| ISO_RES[所有向量精度相同]
    ANISO --> |"内积误差优化"| ANISO_RES[高相似向量精度更高]

    style ANISO fill:#1890ff,color:#fff
    style ANISO_RES fill:#b7eb8f
```

#### 5.2.3 ScaNN 性能基准

根据官方基准测试<sup>[[17]](#ref17)</sup>：

| 数据集     | 向量数 | 维度 | QPS（单线程） | 召回率 |
| ---------- | ------ | ---- | ------------- | ------ |
| SIFT-1M    | 100 万 | 128  | 50,000+       | 95%    |
| GIST-1M    | 100 万 | 960  | 10,000+       | 95%    |
| GloVe-1.2M | 120 万 | 100  | 30,000+       | 95%    |

### 5.3 GPU 加速索引

#### 5.3.1 GPU IVF 系列

Faiss 提供了多种 GPU 加速的 IVF 索引<sup>[[18]](#ref18)</sup>：

| 索引类型         | 描述               | QPS 提升 | 显存需求       |
| ---------------- | ------------------ | -------- | -------------- |
| **GPU_IVF_FLAT** | GPU 加速的 IVFFlat | 10-50x   | 存储全向量     |
| **GPU_IVF_PQ**   | GPU 加速的 IVFPQ   | 5-20x    | 存储 PQ 编码   |
| **GPU_IVF_SQ8**  | GPU 加速的标量量化 | 10-30x   | 存储 INT8 向量 |

#### 5.3.2 CAGRA：NVIDIA 的图索引

**CAGRA（Cuda Accelerated GRAph-based index）** 是 NVIDIA 推出的 GPU 优化图索引<sup>[[18]](#ref18)</sup>：

```mermaid
graph TB
    subgraph "CAGRA 特性"
        F1[GPU 原生设计]
        F2[多 GPU 支持]
        F3[图构建 GPU 加速]
        F4[融合内核优化]
    end

    F1 --> P1[极高吞吐量]
    F2 --> P2[水平扩展]
    F3 --> P3[快速索引构建]
    F4 --> P4[低延迟]

    style F1 fill:#76b900,color:#fff
```

**CAGRA 与 CPU HNSW 对比**：

| 维度       | CPU HNSW         | GPU CAGRA        |
| ---------- | ---------------- | ---------------- |
| 单查询延迟 | 1-10 毫秒        | 0.1-1 毫秒       |
| 批量吞吐   | 1,000-10,000 QPS | 100,000+ QPS     |
| 硬件成本   | 高内存服务器     | GPU 服务器       |
| 适用场景   | 通用场景         | 高吞吐量实时推荐 |

---

## 6. 相似度测量方式

选择正确的相似度度量对向量搜索结果有决定性影响。本章详细介绍三种主流度量方式。

### 6.1 欧几里得距离（L2 Distance）

#### 6.1.1 数学定义

**欧几里得距离**（也称 L2 距离）是最直观的距离度量，表示两点之间的"直线距离"<sup>[[19]](#ref19)</sup>：

$$
d_{L2}(a, b) = \sqrt{\sum_{i=1}^{d}(a_i - b_i)^2} = \|a - b\|_2
$$

通常使用**平方欧几里得距离**以避免开方运算：

$$
d_{L2}^2(a, b) = \sum_{i=1}^{d}(a_i - b_i)^2
$$

#### 6.1.2 几何意义

```mermaid
graph LR
    subgraph "欧几里得距离"
        A["点 A (1,2)"] --> |"直线距离"| B["点 B (4,6)"]
        A --> C["距离 = √((4-1)² + (6-2)²) = 5"]
    end

    style C fill:#91d5ff
```

#### 6.1.3 特性分析

| 特性           | 描述                               |
| -------------- | ---------------------------------- |
| **尺度敏感**   | 对向量的长度敏感，长向量距离更大   |
| **维度诅咒**   | 高维空间中，距离趋于均匀化         |
| **范围**       | $[0, +\infty)$，距离越小越相似     |
| **三角不等式** | 满足 $d(a,c) \leq d(a,b) + d(b,c)$ |

#### 6.1.4 适用场景

- **物理空间距离**：地理位置、图像像素差异
- **聚类分析**：K-Means、DBSCAN
- **特征工程**：当向量已归一化时

```python
def euclidean_distance(a, b):
    return np.sqrt(np.sum((a - b) ** 2))

def squared_euclidean_distance(a, b):
    return np.sum((a - b) ** 2)
```

### 6.2 余弦相似度（Cosine Similarity）

#### 6.2.1 数学定义

**余弦相似度** 测量两个向量之间的夹角余弦值，关注**方向**而非**长度**<sup>[[19]](#ref19)</sup>：

$$
\cos(\theta) = \frac{a \cdot b}{\|a\| \cdot \|b\|} = \frac{\sum_{i=1}^{d} a_i \cdot b_i}{\sqrt{\sum_{i=1}^{d} a_i^2} \cdot \sqrt{\sum_{i=1}^{d} b_i^2}}
$$

**余弦距离**是相似度的补充：

$$
d_{\cos}(a, b) = 1 - \cos(\theta)
$$

#### 6.2.2 几何意义

```mermaid
graph TB
    subgraph "余弦相似度"
        O[原点] --> A[向量 A]
        O --> B[向量 B]
        O --> C[向量 C]

        A --- |"夹角 θ=30°<br/>cos=0.87"| B
        A --- |"夹角 θ=90°<br/>cos=0"| C
    end

    subgraph "特性"
        S1["向量长度被忽略"]
        S2["只关注方向相似性"]
    end

    style S1 fill:#b7eb8f
```

#### 6.2.3 特性分析

| 特性           | 描述                                       |
| -------------- | ------------------------------------------ |
| **尺度无关**   | 向量长度不影响相似度                       |
| **范围**       | $[-1, 1]$，1 为完全相同方向，-1 为完全相反 |
| **归一化等价** | 归一化向量的余弦相似度等于点积             |
| **高维友好**   | 在高维空间表现稳定                         |

#### 6.2.4 适用场景

- **文本语义相似度**：文档比较、问答匹配（推荐首选）
- **推荐系统**：用户偏好向量
- **NLP 任务**：词嵌入、句子嵌入

```python
def cosine_similarity(a, b):
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    return dot_product / (norm_a * norm_b)

def cosine_distance(a, b):
    return 1 - cosine_similarity(a, b)
```

### 6.3 点积相似度（Dot Product / Inner Product）

#### 6.3.1 数学定义

**点积**（内积）直接计算两个向量对应元素的乘积之和<sup>[[19]](#ref19)</sup>：

$$
\langle a, b \rangle = a \cdot b = \sum_{i=1}^{d} a_i \cdot b_i
$$

#### 6.3.2 与余弦相似度的关系

$$
a \cdot b = \|a\| \cdot \|b\| \cdot \cos(\theta)
$$

**关键洞察**：

- 当向量 **已归一化**（$\|a\| = \|b\| = 1$）时，点积 **等于** 余弦相似度
- 当向量 **未归一化** 时，点积同时考虑方向和长度

#### 6.3.3 特性分析

| 特性             | 描述                                                 |
| ---------------- | ---------------------------------------------------- |
| **尺度敏感**     | 长向量的点积更大                                     |
| **范围**         | $(-\infty, +\infty)$，值越大越相似                   |
| **计算高效**     | 无需归一化，可使用 SIMD 加速                         |
| **最大内积问题** | MIPS（Maximum Inner Product Search）是独立的研究问题 |

#### 6.3.4 适用场景

- **归一化向量**：等价于余弦相似度，计算更快
- **推荐系统**：用户向量 × 物品向量，长度代表置信度/流行度
- **注意力机制**：Transformer 中的 Q·K^T

```python
def dot_product(a, b):
    return np.dot(a, b)

# 归一化后的点积等于余弦相似度
def normalized_dot_product(a, b):
    a_norm = a / np.linalg.norm(a)
    b_norm = b / np.linalg.norm(b)
    return np.dot(a_norm, b_norm)
```

### 6.4 曼哈顿距离（Manhattan Distance / L1 Distance）

#### 6.4.1 数学定义

**曼哈顿距离**（也称 L1 距离、城市街区距离）计算两点之间沿坐标轴的绝对差值之和<sup>[[19]](#ref19)</sup>：

$$
d_{L1}(a, b) = \sum_{i=1}^{d} |a_i - b_i| = \|a - b\|_1
$$

#### 6.4.2 几何意义

```mermaid
graph LR
    subgraph "曼哈顿距离 vs 欧几里得距离"
        A["点 A (0,0)"] --> |"L1: |3|+|4|=7"| B["点 B (3,4)"]
        A --> |"L2: √(9+16)=5"| B
    end

    style A fill:#ffe58f
    style B fill:#b7eb8f
```

#### 6.4.3 特性分析

| 特性           | 描述                             |
| -------------- | -------------------------------- |
| **尺度敏感**   | 对向量长度敏感                   |
| **离群值鲁棒** | 比欧几里得距离更不易受极端值影响 |
| **高维适用**   | 在高维稀疏数据中表现更稳定       |
| **范围**       | $[0, +\infty)$，距离越小越相似   |

#### 6.4.4 适用场景

- **高维稀疏数据**：TF-IDF 向量、词袋模型
- **城市路径规划**：网格状道路距离计算
- **图像处理**：像素差异度量

```python
def manhattan_distance(a, b):
    return np.sum(np.abs(a - b))
```

### 6.5 汉明距离（Hamming Distance）

#### 6.5.1 数学定义

**汉明距离** 计算两个等长序列中对应位置不同元素的数量<sup>[[25]](#ref25)</sup>：

$$
d_H(a, b) = \sum_{i=1}^{d} \mathbf{1}[a_i \neq b_i]
$$

其中 $\mathbf{1}[\cdot]$ 是指示函数，当条件为真时返回 1，否则返回 0。

#### 6.5.2 二进制向量的高效计算

对于二进制向量，汉明距离可以通过异或（XOR）运算和位计数高效实现：

$$
d_H(a, b) = \text{popcount}(a \oplus b)
$$

```python
def hamming_distance_binary(a, b):
    """二进制向量的汉明距离"""
    xor_result = np.bitwise_xor(a, b)
    return np.sum(xor_result)

def hamming_distance_general(a, b):
    """通用汉明距离"""
    return np.sum(a != b)
```

#### 6.5.3 特性分析

| 特性         | 描述                       |
| ------------ | -------------------------- |
| **离散度量** | 仅适用于离散/二进制数据    |
| **等长要求** | 输入序列必须等长           |
| **极速计算** | 二进制向量可用硬件指令加速 |
| **范围**     | $[0, d]$，d 为向量维度     |

#### 6.5.4 适用场景

- **二进制哈希码**：SimHash、LSH 的快速比较
- **纠错编码**：检测传输错误的位数
- **DNA 序列比对**：基因突变检测
- **文档去重**：快速识别近似重复

### 6.6 Jaccard 相似度（Jaccard Similarity）

#### 6.6.1 数学定义

**Jaccard 相似度**（也称 Jaccard 系数）衡量两个集合的交集与并集之比<sup>[[26]](#ref26)</sup>：

$$
J(A, B) = \frac{|A \cap B|}{|A \cup B|} = \frac{|A \cap B|}{|A| + |B| - |A \cap B|}
$$

**Jaccard 距离** 是其补集：

$$
d_J(A, B) = 1 - J(A, B)
$$

#### 6.6.2 几何意义

```mermaid
graph TB
    subgraph "Jaccard 相似度"
        A["集合 A: {1,2,3,4}"]
        B["集合 B: {3,4,5,6}"]
        I["交集: {3,4} = 2 个元素"]
        U["并集: {1,2,3,4,5,6} = 6 个元素"]
        R["J(A,B) = 2/6 = 0.33"]
    end

    A --> I
    B --> I
    A --> U
    B --> U
    I --> R
    U --> R

    style R fill:#52c41a,color:#fff
```

#### 6.6.3 MinHash 加速

对于大规模集合，可使用 **MinHash** 近似计算 Jaccard 相似度：

1. 对集合元素应用多个哈希函数
2. 记录每个哈希函数的最小值
3. 比较最小值签名的相等比例

```python
def jaccard_similarity(set_a, set_b):
    """精确 Jaccard 相似度"""
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0

def jaccard_similarity_binary(a, b):
    """二进制向量的 Jaccard 相似度"""
    intersection = np.sum(a & b)
    union = np.sum(a | b)
    return intersection / union if union > 0 else 0
```

#### 6.6.4 特性分析

| 特性         | 描述                     |
| ------------ | ------------------------ |
| **集合度量** | 适用于集合或二进制向量   |
| **对称性**   | $J(A,B) = J(B,A)$        |
| **忽略缺失** | 不考虑两者都为 0 的维度  |
| **范围**     | $[0, 1]$，1 表示完全相同 |

#### 6.6.5 适用场景

- **文档相似度**：基于词集合的文档比较
- **推荐系统**：用户行为集合的相似性
- **重复检测**：MinHash + LSH 的快速去重
- **生物信息学**：基因集合比较

### 6.7 度量方式对比与选择

#### 6.7.1 综合对比表

| 度量方式     | 关注点      | 范围                 | 相似性含义     | 计算复杂度 | 数据类型        |
| ------------ | ----------- | -------------------- | -------------- | ---------- | --------------- |
| **欧几里得** | 长度 + 方向 | $[0, +\infty)$       | 距离越小越相似 | O(d)       | 连续向量        |
| **余弦**     | 仅方向      | $[-1, 1]$            | 值越大越相似   | O(d)       | 连续向量        |
| **点积**     | 长度 + 方向 | $(-\infty, +\infty)$ | 值越大越相似   | O(d)       | 连续向量        |
| **曼哈顿**   | 绝对差异    | $[0, +\infty)$       | 距离越小越相似 | O(d)       | 连续/稀疏向量   |
| **汉明**     | 不同位数    | $[0, d]$             | 距离越小越相似 | O(d/64)\*  | 二进制/离散向量 |
| **Jaccard**  | 重叠比例    | $[0, 1]$             | 值越大越相似   | O(d)       | 集合/二进制向量 |

> \*汉明距离在二进制向量上可使用硬件 POPCNT 指令加速至 O(d/64)

#### 6.7.2 归一化向量的等价性

当所有向量都归一化（$\|v\| = 1$）时：

$$
d_{L2}^2(a,b) = 2 - 2 \cdot \cos(\theta) = 2 \cdot d_{\cos}(a, b)
$$

因此，**归一化向量的欧几里得距离排序与余弦距离排序一致**。

```mermaid
graph LR
    subgraph "归一化向量"
        L2[L2 距离排序] --> |"等价"| COS[余弦距离排序]
        COS --> |"等价"| DOT[点积排序（取反）]
    end

    style L2 fill:#91d5ff
    style COS fill:#b7eb8f
    style DOT fill:#ffd591
```

#### 6.7.3 选择决策树

```mermaid
flowchart TD
    START[选择度量方式] --> Q1{向量已归一化？}
    Q1 --> |是| USE_DOT[使用点积<br/>计算最快]
    Q1 --> |否| Q2{向量长度有意义？}
    Q2 --> |是（如流行度）| USE_IP[使用点积/欧几里得]
    Q2 --> |否| Q3{是文本/语义任务？}
    Q3 --> |是| USE_COS[使用余弦相似度]
    Q3 --> |否| USE_L2[使用欧几里得距离]

    style USE_DOT fill:#52c41a,color:#fff
    style USE_COS fill:#1890ff,color:#fff
```

#### 6.7.4 常见向量模型的推荐度量

| 模型/任务                 | 推荐度量   | 原因                   |
| ------------------------- | ---------- | ---------------------- |
| **OpenAI text-embedding** | 余弦相似度 | 官方推荐，输出已归一化 |
| **Sentence-BERT**         | 余弦相似度 | 语义相似性任务         |
| **CLIP**                  | 余弦相似度 | 图文匹配               |
| **Recommendation (MF)**   | 点积       | 用户-物品交互强度      |
| **Image Features (CNN)**  | 欧几里得   | 特征空间距离           |

---

## 7. 混合搜索与过滤策略

在实际应用中，纯向量搜索往往不够——我们需要结合元数据过滤和全文关键词搜索。

### 7.1 混合搜索概述

**混合搜索（Hybrid Search）** 结合向量相似性搜索与传统结构化/非结构化查询<sup>[[20]](#ref20)</sup>：

```mermaid
graph TB
    subgraph "混合搜索组成"
        VS[向量搜索<br/>语义相似性]
        KS[关键词搜索<br/>BM25]
        MF[元数据过滤<br/>WHERE 条件]
    end

    Q[用户查询] --> VS
    Q --> KS
    Q --> MF

    VS --> FUSION[结果融合]
    KS --> FUSION
    MF --> FUSION
    FUSION --> R[最终排序结果]

    style VS fill:#1890ff,color:#fff
    style FUSION fill:#52c41a,color:#fff
```

### 7.2 过滤策略：Pre-filtering vs Post-filtering

向量搜索中应用元数据过滤有两种主要策略<sup>[[21]](#ref21)</sup>：

#### 7.2.1 Post-filtering（后过滤）

**工作流程**：先执行向量搜索，再对结果应用过滤条件。

```mermaid
sequenceDiagram
    participant Q as 查询
    participant VS as 向量搜索
    participant F as 过滤器
    participant R as 结果

    Q->>VS: 向量搜索 Top-K'（K' > K）
    VS-->>F: K' 个候选结果
    F->>F: 应用 WHERE 条件
    F-->>R: 满足条件的 Top-K
```

**实现示例**：

```python
def post_filtering_search(query_vector, k, filter_condition, margin=2):
    # 1. 获取比需要更多的候选
    k_prime = k * margin  # 多取一些以备过滤损失
    candidates = vector_index.search(query_vector, k_prime)

    # 2. 应用过滤条件
    filtered = [c for c in candidates if filter_condition(c)]

    # 3. 返回 Top-K
    return filtered[:k]
```

**优缺点**：

| 优点               | 缺点                       |
| ------------------ | -------------------------- |
| 实现简单           | 可能返回不足 K 个结果      |
| 向量索引无需修改   | 过滤严格时效率低           |
| 适用于宽松过滤条件 | 可能错过满足条件的真正近邻 |

#### 7.2.2 Pre-filtering（预过滤）

**工作流程**：先应用过滤条件缩小搜索空间，再在子集中执行向量搜索。

```mermaid
sequenceDiagram
    participant Q as 查询
    participant F as 过滤器
    participant VS as 向量搜索
    participant R as 结果

    Q->>F: 评估 WHERE 条件
    F->>F: 确定满足条件的向量 ID 集合
    F-->>VS: 在子集中搜索
    VS->>VS: 子集向量搜索
    VS-->>R: Top-K 结果（保证满足条件）
```

**实现示例**：

```python
def pre_filtering_search(query_vector, k, filter_condition):
    # 1. 获取满足过滤条件的向量 ID
    valid_ids = metadata_index.query(filter_condition)

    # 2. 仅在这些 ID 中进行向量搜索
    if len(valid_ids) == 0:
        return []

    # 创建临时索引或使用 ID 过滤
    results = vector_index.search_in_subset(query_vector, valid_ids, k)

    return results
```

**优缺点**：

| 优点                        | 缺点                                            |
| --------------------------- | ----------------------------------------------- |
| 保证返回 K 个满足条件的结果 | 实现复杂，需要索引集成                          |
| 高选择率过滤下非常高效      | 可能破坏 HNSW 图连通性<sup>[[21]](#ref21)</sup> |
| 准确的召回保证              | 元数据索引成为瓶颈                              |

#### 7.2.3 策略对比与选择

| 场景                 | 推荐策略       | 原因                              |
| -------------------- | -------------- | --------------------------------- |
| 过滤条件宽松（>50%） | Post-filtering | 简单，损失可接受                  |
| 过滤条件严格（<10%） | Pre-filtering  | Post-filtering 可能找不到足够结果 |
| 实时性要求极高       | Pre-filtering  | 避免无效向量计算                  |
| 过滤条件复杂         | Pre-filtering  | 避免过滤逻辑重复评估              |

```mermaid
flowchart TD
    START[选择过滤策略] --> Q1{过滤后剩余比例？}
    Q1 --> |"> 50%"| POST[Post-filtering]
    Q1 --> |"< 10%"| PRE[Pre-filtering]
    Q1 --> |"10-50%"| Q2{是否需要精确 K 个结果？}
    Q2 --> |是| PRE
    Q2 --> |否| POST

    style POST fill:#ffd591
    style PRE fill:#91d5ff
```

### 7.3 混合策略与高级技术

#### 7.3.1 Single-Stage Filtering（单阶段过滤）

一些向量数据库（如 Qdrant）实现了**索引感知过滤**，在图遍历过程中实时跳过不满足条件的节点<sup>[[21]](#ref21)</sup>：

```mermaid
graph LR
    subgraph "索引感知过滤"
        N1[节点1<br/>满足条件] --> N2[节点2<br/>不满足 ❌]
        N2 --> |"跳过"| N3[节点3<br/>满足条件 ✓]
        N3 --> N4[节点4<br/>满足条件 ✓]
    end

    style N2 fill:#ff4d4f,color:#fff
    style N3 fill:#52c41a,color:#fff
```

这种方法结合了两种策略的优点，但需要向量数据库原生支持。

#### 7.3.2 分区索引

对于高选择性的类别字段（如 `tenant_id`），可以为每个值创建独立索引：

```sql
-- PostgreSQL + pgvector 示例
CREATE INDEX idx_tenant_1 ON items
  USING hnsw (embedding vector_cosine_ops)
  WHERE tenant_id = 1;

CREATE INDEX idx_tenant_2 ON items
  USING hnsw (embedding vector_cosine_ops)
  WHERE tenant_id = 2;
```

### 7.4 向量 + 全文的结果融合

#### 7.4.1 融合方法

当同时使用向量搜索和关键词搜索时，需要融合两者的排序结果<sup>[[20]](#ref20)</sup>：

| 融合方法                | 公式                                          | 特点                 |
| ----------------------- | --------------------------------------------- | -------------------- |
| **线性加权**            | $s = \alpha \cdot s_v + (1-\alpha) \cdot s_k$ | 简单，需调参         |
| **倒数排名融合（RRF）** | $s = \sum \frac{1}{k + rank}$                 | 无需归一化，效果稳定 |
| **学习排序（LTR）**     | 机器学习模型                                  | 最优但复杂           |

#### 7.4.2 Reciprocal Rank Fusion (RRF)

RRF 是最常用的无参数融合方法：

$$
RRF(d) = \sum_{r \in R} \frac{1}{k + r(d)}
$$

其中：

- $R$ 是所有排序列表
- $r(d)$ 是文档 $d$ 在排序列表 $r$ 中的排名
- $k$ 是平滑参数（通常 $k=60$）

```python
def reciprocal_rank_fusion(rankings, k=60):
    """
    rankings: List[List[doc_id]] - 多个排序列表
    返回: 融合后的排序
    """
    scores = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            if doc_id not in scores:
                scores[doc_id] = 0
            scores[doc_id] += 1 / (k + rank + 1)  # rank 从 0 开始

    # 按分数降序排列
    return sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
```

#### 7.4.3 Weaviate 混合搜索示例

```python
# Weaviate 混合搜索：alpha 控制权重分配
results = client.query.get("Article", ["title", "content"]).with_hybrid(
    query="机器学习最新进展",
    alpha=0.5,  # 0 = 纯 BM25，1 = 纯向量
    fusion_type="rankedFusion"  # 或 "relativeScoreFusion"
).with_limit(10).do()
```

---

## 8. 性能分析与基准测试

### 8.1 核心性能指标

评估向量数据库性能需要关注以下关键指标<sup>[[22]](#ref22)</sup>：

| 指标                 | 定义                 | 重要性         |
| -------------------- | -------------------- | -------------- |
| **召回率（Recall）** | 返回的真正近邻占比   | 准确性核心指标 |
| **QPS（吞吐量）**    | 每秒处理的查询数     | 高并发场景关键 |
| **延迟（Latency）**  | 单次查询响应时间     | 用户体验关键   |
| **内存占用**         | 索引和数据的内存消耗 | 成本控制       |
| **索引构建时间**     | 创建索引所需时间     | 数据更新效率   |

#### 8.1.1 召回率与 QPS 的权衡

```mermaid
graph LR
    subgraph "召回率-QPS 权衡曲线"
        P1["ef=10<br/>QPS: 50,000<br/>Recall: 85%"]
        P2["ef=50<br/>QPS: 20,000<br/>Recall: 95%"]
        P3["ef=200<br/>QPS: 5,000<br/>Recall: 99%"]
        P4["ef=500<br/>QPS: 1,500<br/>Recall: 99.5%"]
    end

    P1 --> P2 --> P3 --> P4

    style P2 fill:#52c41a,color:#fff
```

> **最佳实践**：大多数应用选择 95% 召回率作为目标，在速度和准确性之间取得平衡。

#### 8.1.2 延迟分布

生产环境应关注**尾延迟（Tail Latency）**，即 P95/P99 延迟<sup>[[22]](#ref22)</sup>：

| 延迟指标 | 含义               | 目标值（推荐） |
| -------- | ------------------ | -------------- |
| **P50**  | 中位数延迟         | < 5ms          |
| **P95**  | 95% 请求的延迟上限 | < 20ms         |
| **P99**  | 99% 请求的延迟上限 | < 50ms         |
| **MAX**  | 最大延迟           | < 200ms        |

### 8.2 主流向量数据库基准对比

基于公开基准测试数据<sup>[[22]](#ref22)</sup>，以下是主流向量数据库的性能对比：

#### 8.2.1 百万级向量基准（SIFT-1M，128 维）

| 数据库          | 召回率@10 | QPS（单节点） | P99 延迟 | 内存占用 |
| --------------- | --------- | ------------- | -------- | -------- |
| **Milvus**      | 95%       | ~15,000       | 8ms      | ~2 GB    |
| **Qdrant**      | 95%       | ~12,000       | 10ms     | ~1.8 GB  |
| **Weaviate**    | 95%       | ~8,000        | 15ms     | ~2.2 GB  |
| **Pinecone**    | 95%       | N/A (云服务)  | 7ms      | N/A      |
| **pgvector**    | 95%       | ~3,000        | 25ms     | ~1.5 GB  |
| **VectorChord** | 95%       | ~15,000       | 8ms      | ~1.2 GB  |

#### 8.2.2 亿级向量基准

| 数据库       | 数据规模 | 召回率 | QPS    | P99 延迟 | 备注         |
| ------------ | -------- | ------ | ------ | -------- | ------------ |
| **Milvus**   | 1 亿     | 95%    | 2,000+ | < 10ms   | 分布式集群   |
| **DiskANN**  | 10 亿    | 95%    | 500+   | < 5ms    | 单机 SSD     |
| **Pinecone** | 10 亿    | 95%    | N/A    | < 10ms   | Pod 类型影响 |

### 8.3 索引算法性能对比

| 索引类型    | 构建时间 | 查询时间 | 内存占用 | 召回率 | 适用规模  |
| ----------- | -------- | -------- | -------- | ------ | --------- |
| **Flat**    | 极快     | O(n)     | 100%     | 100%   | < 10 万   |
| **IVFFlat** | 快       | O(√n)    | 100%     | 95-99% | < 1000 万 |
| **IVFPQ**   | 中       | O(√n)    | ~5%      | 90-98% | 无限制    |
| **HNSW**    | 慢       | O(log n) | 150%+    | 99%+   | < 1 亿    |
| **DiskANN** | 极慢     | O(log n) | ~10%     | 95%+   | 10 亿+    |

---

## 9. 选型建议与场景化方案

### 9.1 决策框架

```mermaid
flowchart TD
    START[向量数据库选型] --> Q1{数据规模？}

    Q1 --> |"< 100 万"| SMALL[小规模]
    Q1 --> |"100 万 - 1 亿"| MEDIUM[中规模]
    Q1 --> |"> 1 亿"| LARGE[大规模]

    SMALL --> Q2{已有 PostgreSQL？}
    Q2 --> |是| PGV[pgvector/VectorChord]
    Q2 --> |否| Q3{需要托管服务？}
    Q3 --> |是| PINECONE[Pinecone Free]
    Q3 --> |否| EMBEDDED[Milvus Lite / Chroma]

    MEDIUM --> Q4{运维能力？}
    Q4 --> |强| SELF[Milvus / Qdrant 自托管]
    Q4 --> |弱| MANAGED[Zilliz Cloud / Pinecone]

    LARGE --> Q5{预算？}
    Q5 --> |充足| CLOUD[全托管云服务]
    Q5 --> |有限| DISKANN[DiskANN + 自建]

    style PGV fill:#336791,color:#fff
    style PINECONE fill:#5048E5,color:#fff
    style SELF fill:#00A1EA,color:#fff
```

### 9.2 场景化推荐

#### 9.2.1 RAG / 知识库问答

| 需求维度     | 推荐方案               | 原因                 |
| ------------ | ---------------------- | -------------------- |
| **快速启动** | Pinecone Serverless    | 零运维，按量付费     |
| **成本敏感** | pgvector + VectorChord | 复用现有 PostgreSQL  |
| **高性能**   | Milvus Distributed     | 高 QPS，低延迟       |
| **开箱即用** | Weaviate               | 内置向量化，简化流程 |

**推荐配置**：

- 向量维度：1536（OpenAI）或 768（开源模型）
- 索引类型：HNSW
- 相似度：余弦相似度
- 分块大小：512 tokens

#### 9.2.2 电商/推荐系统

| 需求维度     | 推荐方案     | 原因                  |
| ------------ | ------------ | --------------------- |
| **实时推荐** | Milvus + GPU | 极高 QPS，毫秒级延迟  |
| **用户画像** | Qdrant       | 强大的过滤能力        |
| **商品搜索** | Weaviate     | 混合搜索（向量+属性） |

**推荐配置**：

- 向量维度：128-256（商品特征）
- 索引类型：IVFPQ（大规模）或 HNSW（中规模）
- 相似度：点积（考虑流行度）
- 过滤策略：Pre-filtering

#### 9.2.3 图像/多模态搜索

| 需求维度     | 推荐方案             | 原因           |
| ------------ | -------------------- | -------------- |
| **通用图搜** | Milvus + CLIP        | 原生多向量支持 |
| **人脸识别** | Milvus + GPU         | 高精度要求     |
| **商品图搜** | Weaviate + multi2vec | 一站式多模态   |

**推荐配置**：

- 向量维度：512-768（CLIP/ViT）
- 索引类型：HNSW（高召回）
- 相似度：余弦相似度
- 归一化：是

### 9.3 成本估算参考

| 数据规模    | 方案选择            | 月成本估算（USD） |
| ----------- | ------------------- | ----------------- |
| 10 万向量   | Pinecone Starter    | $0（免费）        |
| 100 万向量  | pgvector（自托管）  | $50-100           |
| 1000 万向量 | Milvus（自托管）    | $200-500          |
| 1 亿向量    | Zilliz Cloud        | $1,000-3,000      |
| 10 亿向量   | Pinecone Enterprise | $10,000+          |

### 9.4 技术栈匹配

| 技术栈         | 推荐向量数据库           | 集成难度 |
| -------------- | ------------------------ | -------- |
| **Python**     | Milvus, Qdrant, Weaviate | 低       |
| **Node.js**    | Pinecone, Weaviate       | 低       |
| **PostgreSQL** | pgvector, VectorChord    | 极低     |
| **Kubernetes** | Milvus, Qdrant, Weaviate | 中       |
| **Serverless** | Pinecone, Zilliz Cloud   | 低       |

---

## 10. Demo 实施指引

本章提供三种常见场景的实施指引。

### 10.1 PostgreSQL + pgvector 快速入门

#### 10.1.1 环境准备

```bash
# 使用 Docker 快速启动
docker run -d \
  --name pgvector \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  ankane/pgvector
```

#### 10.1.2 创建向量表

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建文档表
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    embedding vector(1536),  -- OpenAI embedding 维度
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建 HNSW 索引
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

#### 10.1.3 Python 集成示例

```python
import psycopg2
from openai import OpenAI

# 初始化
client = OpenAI()
conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/postgres")

def get_embedding(text):
    """获取文本的嵌入向量"""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def insert_document(title, content):
    """插入文档并生成向量"""
    embedding = get_embedding(content)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (title, content, embedding) VALUES (%s, %s, %s)",
            (title, content, embedding)
        )
    conn.commit()

def search_documents(query, top_k=5):
    """语义搜索"""
    query_embedding = get_embedding(query)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, title, 1 - (embedding <=> %s::vector) AS similarity
            FROM documents
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (query_embedding, query_embedding, top_k))
        return cur.fetchall()

# 使用示例
insert_document("AI 介绍", "人工智能是计算机科学的一个分支...")
results = search_documents("什么是机器学习")
print(results)
```

### 10.2 Milvus 分布式部署

#### 10.2.1 Docker Compose 部署

```yaml
# docker-compose.yml
version: "3.5"

services:
  etcd:
    image: quay.io/coreos/etcd:v3.5.5
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
      - ETCD_QUOTA_BACKEND_BYTES=4294967296
    volumes:
      - etcd_data:/etcd

  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/minio_data
    command: minio server /minio_data

  milvus:
    image: milvusdb/milvus:v2.3.3
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - milvus_data:/var/lib/milvus
    ports:
      - "19530:19530"
      - "9091:9091"
    depends_on:
      - etcd
      - minio

volumes:
  etcd_data:
  minio_data:
  milvus_data:
```

#### 10.2.2 Python 客户端示例

```python
from pymilvus import MilvusClient, DataType

# 连接 Milvus
client = MilvusClient(uri="http://localhost:19530")

# 创建 Collection
schema = client.create_schema(auto_id=True, enable_dynamic_field=True)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("embedding", DataType.FLOAT_VECTOR, dim=1536)
schema.add_field("title", DataType.VARCHAR, max_length=512)

index_params = client.prepare_index_params()
index_params.add_index(
    field_name="embedding",
    index_type="HNSW",
    metric_type="COSINE",
    params={"M": 16, "efConstruction": 256}
)

client.create_collection(
    collection_name="documents",
    schema=schema,
    index_params=index_params
)

# 插入数据
data = [
    {"embedding": [0.1] * 1536, "title": "文档1"},
    {"embedding": [0.2] * 1536, "title": "文档2"},
]
client.insert(collection_name="documents", data=data)

# 搜索
results = client.search(
    collection_name="documents",
    data=[[0.15] * 1536],
    limit=5,
    output_fields=["title"]
)
print(results)
```

### 10.3 Faiss 本地索引

#### 10.3.1 安装

```bash
pip install faiss-cpu  # CPU 版本
# 或
pip install faiss-gpu  # GPU 版本（需要 CUDA）
```

#### 10.3.2 完整示例

```python
import numpy as np
import faiss

# 1. 准备数据
d = 128                        # 向量维度
nb = 100000                    # 数据库向量数
nq = 10                        # 查询向量数

np.random.seed(42)
xb = np.random.random((nb, d)).astype('float32')  # 数据库向量
xq = np.random.random((nq, d)).astype('float32')  # 查询向量

# 2. 创建索引
# 方案 A: Flat 索引（精确搜索）
index_flat = faiss.IndexFlatL2(d)

# 方案 B: IVF 索引（近似搜索）
nlist = 100  # 聚类数量
quantizer = faiss.IndexFlatL2(d)
index_ivf = faiss.IndexIVFFlat(quantizer, d, nlist)
index_ivf.train(xb)  # 需要训练

# 方案 C: HNSW 索引
index_hnsw = faiss.IndexHNSWFlat(d, 32)  # M=32

# 3. 添加向量
index_flat.add(xb)
index_ivf.add(xb)
index_hnsw.add(xb)

# 4. 搜索
k = 5  # 返回 Top-K

# Flat 搜索
D_flat, I_flat = index_flat.search(xq, k)

# IVF 搜索（设置探测数量）
index_ivf.nprobe = 10
D_ivf, I_ivf = index_ivf.search(xq, k)

# HNSW 搜索
D_hnsw, I_hnsw = index_hnsw.search(xq, k)

# 5. 比较结果
print(f"Flat 召回: {I_flat}")
print(f"IVF  召回: {I_ivf}")
print(f"HNSW 召回: {I_hnsw}")

# 6. 保存和加载索引
faiss.write_index(index_hnsw, "hnsw.index")
loaded_index = faiss.read_index("hnsw.index")
```

### 10.4 性能调优检查清单

| 阶段     | 检查项               | 优化建议                            |
| -------- | -------------------- | ----------------------------------- |
| **数据** | 向量维度             | 优先选择较低维度模型（768 vs 1536） |
| **数据** | 向量归一化           | 使用余弦/点积时必须归一化           |
| **索引** | 索引类型选择         | 数据量 < 100 万用 HNSW，否则 IVFPQ  |
| **索引** | HNSW M 参数          | 16-32 为平衡值，高召回需求用 48+    |
| **索引** | HNSW ef_construction | 100-200，追求质量可用 400           |
| **查询** | ef_search / nprobe   | 逐步调大直到召回率满足需求          |
| **查询** | 批量 vs 单条         | 尽量批量查询以提高吞吐              |
| **硬件** | 内存                 | 确保索引完全加载到内存              |
| **硬件** | SSD vs HDD           | 使用 DiskANN 时必须用 SSD           |

---

## References

<a id="ref1"></a>[1] T. Brown et al., "Language models are few-shot learners," in _Adv. Neural Inf. Process. Syst._, vol. 33, pp. 1877–1901, 2020.

<a id="ref2"></a>[2] P. Lewis et al., "Retrieval-augmented generation for knowledge-intensive NLP tasks," in _Adv. Neural Inf. Process. Syst._, vol. 33, pp. 9459–9474, 2020.

<a id="ref3"></a>[3] Amazon AWS, "What is retrieval augmented generation (RAG)?" _AWS Documentation_, 2024. [Online]. Available: https://aws.amazon.com/what-is/retrieval-augmented-generation/

<a id="ref4"></a>[4] T. Mikolov et al., "Efficient estimation of word representations in vector space," _arXiv preprint arXiv:1301.3781_, 2013.

<a id="ref5"></a>[5] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence embeddings using siamese BERT-networks," in _Proc. Conf. Empirical Methods Nat. Lang. Process._, pp. 3982–3992, 2019.

<a id="ref6"></a>[6] V. Karpukhin et al., "Dense passage retrieval for open-domain question answering," in _Proc. Conf. Empirical Methods Nat. Lang. Process._, pp. 6769–6781, 2020.

<a id="ref7"></a>[7] Writer, "What is a vector database?" _Writer AI Glossary_, 2024. [Online]. Available: https://writer.com/ai-glossary/vector-database/

<a id="ref8"></a>[8] Milvus Documentation, "Vector index overview," 2024. [Online]. Available: https://milvus.io/docs/index.md

<a id="ref9"></a>[9] S. Lloyd, "Least squares quantization in PCM," _IEEE Trans. Inf. Theory_, vol. 28, no. 2, pp. 129–137, Mar. 1982.

<a id="ref10"></a>[10] P. Indyk and R. Motwani, "Approximate nearest neighbors: Towards removing the curse of dimensionality," in _Proc. 30th Annu. ACM Symp. Theory Comput._, pp. 604–613, 1998.

<a id="ref11"></a>[11] J. Kleinberg, "Navigation in a small world," _Nature_, vol. 406, no. 6798, p. 845, Aug. 2000.

<a id="ref12"></a>[12] Y. A. Malkov and D. A. Yashunin, "Efficient and robust approximate nearest neighbor search using hierarchical navigable small world graphs," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 42, no. 4, pp. 824–836, Apr. 2020.

<a id="ref13"></a>[13] H. Jégou, M. Douze, and C. Schmid, "Product quantization for nearest neighbor search," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 33, no. 1, pp. 117–128, Jan. 2011.

<a id="ref14"></a>[14] Zilliz, "Understanding IVF index," 2024. [Online]. Available: https://zilliz.com/learn/ivf-index-explained

<a id="ref15"></a>[15] TensorChord, "RaBitQ: Randomized binary quantization," 2024. [Online]. Available: https://www.tensorchord.ai/blog/rabitq

<a id="ref16"></a>[16] S. J. Subramanya et al., "DiskANN: Fast accurate billion-point nearest neighbor search on a single node," in _Adv. Neural Inf. Process. Syst._, vol. 32, 2019.

<a id="ref17"></a>[17] R. Guo et al., "Accelerating large-scale inference with anisotropic vector quantization," in _Proc. Int. Conf. Mach. Learn._, vol. 119, pp. 3747–3756, 2020.

<a id="ref18"></a>[18] NVIDIA, "CAGRA: GPU-accelerated graph index for vector search," _NVIDIA RAFT Documentation_, 2024. [Online]. Available: https://docs.nvidia.com/deeplearning/raft/

<a id="ref19"></a>[19] Pinecone, "Vector similarity explained," 2024. [Online]. Available: https://www.pinecone.io/learn/vector-similarity/

<a id="ref20"></a>[20] Weaviate, "Hybrid search explained," 2024. [Online]. Available: https://weaviate.io/developers/weaviate/search/hybrid

<a id="ref21"></a>[21] Qdrant, "Filtered vector search," 2024. [Online]. Available: https://qdrant.tech/articles/filtered-vector-search/

<a id="ref22"></a>[22] ANN-Benchmarks, "Benchmarking nearest neighbor algorithms," 2024. [Online]. Available: https://ann-benchmarks.com/

<a id="ref23"></a>[23] E. Bernhardsson, "Annoy: Approximate nearest neighbors in C++/Python," _GitHub Repository_, 2015. [Online]. Available: https://github.com/spotify/annoy

<a id="ref24"></a>[24] J. Johnson et al., "Billion-scale similarity search with GPUs," _IEEE Trans. Big Data_, vol. 5, no. 1, pp. 107–118, Mar. 2019.

<a id="ref25"></a>[25] R. W. Hamming, "Error detecting and error correcting codes," _Bell Syst. Tech. J._, vol. 29, no. 2, pp. 147–160, Apr. 1950.

<a id="ref26"></a>[26] P. Jaccard, "Étude comparative de la distribution florale dans une portion des Alpes et du Jura," _Bull. Soc. Vaudoise Sci. Nat._, vol. 37, pp. 547–579, 1901.

<a id="ref27"></a>[27] Milvus Documentation, "Filtered vector search," 2024. [Online]. Available: https://milvus.io/docs/filtered_search.md

<a id="ref28"></a>[28] VectorDBBench, "Vector database benchmarking tool," _GitHub Repository_, 2024. [Online]. Available: https://github.com/zilliztech/VectorDBBench

<a id="ref29"></a>[29] OpenAI, "Embeddings guide," _OpenAI Documentation_, 2024. [Online]. Available: https://platform.openai.com/docs/guides/embeddings

<a id="ref30"></a>[30] T. Ge et al., "Optimized product quantization," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 36, no. 4, pp. 744–755, Apr. 2014.
