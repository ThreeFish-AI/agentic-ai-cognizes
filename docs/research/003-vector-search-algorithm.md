---
id: vector-search-algorithm
sidebar_position: 3.2
title: 向量索引算法速览
last_update:
  author: Aurelius Huang
  created_at: 2025-12-24
  updated_at: 2025-12-29
  version: 1.2
  status: Pending Review
tags:
  - Vector Database
  - ANN (Approximate Nearest Neighbor) Algorithms
  - Similarity Search
  - HNSW (Hierarchical Navigable Small World)
  - IVF (Inverted File)
  - PQ (Product Quantization)
  - Embedding
---

> [!IMPORTANT]
>
> **速览范围**：从 LLM 的缺陷出发，引出向量数据库的需求，然后深入解析向量数据库的数学模型、算法原理、技术细节、性能对比、应用场景与选型推荐。

---

## 1. 向量索引二三事

### 1.1 天才博士的困境

你聘请了一位博闻强记的**天才博士（LLM）**。他通读了直至 2023 年底的所有人类书籍，才华横溢却又身处窘境——他被关在一个**没有互联网的房间里**。

当我们问他：“2024 年的奥运会冠军是谁？”时，他因为 2023 年以来与世隔绝（**记忆截止**）而一脸茫然；当我们塞给他一本几百页的新书让他立刻总结时，他因为**脑容量（Context Window）有限**而顾此失彼；更糟糕的是，当我们问及他不知道的领域时，为了面子，他偶尔通过一本正经地胡编乱造（**幻觉**）来应付你。

<details>
<summary>LLM 固有缺陷全景</summary>

以 GPT 为代表的 LLM（大语言模型）所面临的真实困境<sup>[[1]](#ref1)</sup> 包括：

```mermaid
graph LR
    %% Root Node
    root((LLM 固有缺陷)):::root
        %% Left Side: Predecessors (Flow: Left -> Root)
    %% Explicitly linking LeftNode --- Root places LeftNode to the left
    H(幻觉问题):::hallucination --- root
    T(知识时效性):::timeliness --- root
        %% Left Leaves (Flow: Leaf -> LeftNode)
    H1[生成虚假信息]:::hallucination --- H
    H2[编造不存在的事实]:::hallucination --- H
    H3[自信地给出错误答案]:::hallucination --- H
        T1[训练数据截止日期]:::timeliness --- T
    T2[无法获取实时信息]:::timeliness --- T
    T3[无法感知最新事件]:::timeliness --- T
        %% Right Side: Successors (Flow: Root -> Right)
    %% Explicitly linking Root --- RightNode places RightNode to the right
    root --- C(上下文窗口限制):::context
    root --- D(领域知识缺乏):::domain
    root --- R(推理能力局限):::reasoning
        %% Right Leaves (Flow: RightNode -> Leaft)
    C --- C1[有限的 Token 数量]:::context
    C --- C2[长文本处理困难]:::context
    C --- C3[长期记忆缺失]:::context
        D --- D1[通用知识为主]:::domain
    D --- D2[缺乏专业领域深度]:::domain
    D --- D3[无法访问私有数据]:::domain
        R --- R1[复杂数学推理困难]:::reasoning
    R --- R2[多步逻辑推理易出错]:::reasoning
    R --- R3[因果推理能力不足]:::reasoning
        classDef root fill:#eb2f96,stroke:#fff,stroke-width:4px,color:#fff
    classDef hallucination fill:#ff4d4f,stroke:#fff,color:#fff
    classDef timeliness fill:#fa8c16,stroke:#fff,color:#fff
    classDef context fill:#52c41a,stroke:#fff,color:#fff
    classDef domain fill:#1890ff,stroke:#fff,color:#fff
    classDef reasoning fill:#722ed1,stroke:#fff,color:#fff
```

| 缺陷类型                  | 具体表现                                            | 影响                                 |
| ------------------------- | --------------------------------------------------- | ------------------------------------ |
| **幻觉（Hallucination）** | 生成看似合理但实际错误的内容<sup>[[1]](#ref1)</sup> | 降低输出可信度，可能导致严重错误决策 |
| **知识截止日期**          | 无法获取训练数据之后的信息<sup>[[2]](#ref2)</sup>   | 无法回答时事问题，知识库逐渐过时     |
| **上下文窗口限制**        | 单次对话无法处理超长文本<sup>[[1]](#ref1)</sup>     | 无法维持长期对话记忆，大文档处理受限 |
| **领域知识缺乏**          | 缺少特定行业或私有数据知识<sup>[[3]](#ref3)</sup>   | 无法提供专业精准的领域回答           |
| **推理能力局限**          | 复杂逻辑和数学推理易出错<sup>[[1]](#ref1)</sup>     | 在需要精确计算的场景可靠性不足       |

</details>

### 1.2 博士的“图书馆”

为了让这位“天才但与世隔绝且脑容量有限的博士”更好的服务我们，我们需要将互联网这个“图书馆”中“新书本”的知识链接给他。但首先面临的问题是：计算机无法直接理解“书本”里内容的含义。

**Embedding（嵌入向量）** 便是解决这一难题的“数字翻译官”。它能将文本、图像、音频等非结构化数据，转译为计算机可计算的**语义坐标（高维向量）**，让计算机“读懂”字面背后的含义<sup>[[4]](#ref4)</sup>。

这里以猫、狗、汽车为例，我们分别在生命性和智能性两个维度的向量空间上使用 Embedding 表示它们：

```mermaid
quadrantChart
    title Semantic Vector Space
    x-axis "低生命性" --> "高生命性"
    y-axis "低智能性" --> "高智能性"
    quadrant-1 "智能生命体"
    quadrant-2 "高等智能"
    quadrant-3 "无生命物"
    quadrant-4 "简单生命体"
    "🐱 Cat [0.8, 0.7]": [0.8, 0.7]
    "🐶 Dog [0.85, 0.75]": [0.85, 0.75]
    "🚗 Car [0.1, 0.1]": [0.1, 0.1]
```

这里直观体现了语义相似对象在向量空间中聚集的特性：

- **"猫" (0.8, 0.7)** 与 **"狗" (0.85, 0.75)** 位于右上象限，语义距离仅 **0.07**
- **"汽车" (0.1, 0.1)** 位于左下象限，与"猫"语义距离达 **0.92**

如果我们引入更多的维度（比如形状、大小、颜色、能力等），就可以以 Embedding 来精准且全面地**语义化表示**任意对象。

Embedding 的核心意义在于：**语义相似的对象在向量空间中距离更近**<sup>[[5]](#ref5)</sup>。这种直观的“语义坐标化”过程，在数学上有严格的定义（**Embedding 的数学模型**）：

> [!NOTE]
>
> $$
>     f: X \rightarrow \mathbb{R}^d
> $$
>
> 即将输入空间 $X$ 中的对象映射到 $d$ 维实数向量空间 $\mathbb{R}^d$，向量化的过程可以表示为：
>
> $$
>     \text{embed}(x) = [e_1, e_2, ..., e_d] \in \mathbb{R}^d
> $$
>
> 其中：
>
> - $x$ 是输入对象（如文本、图像）
> - $d$ 是向量维度（常见值：128, 256, 384, 512, 768, 1024, 1536, 3072）
> - $e_i$ 是向量的第 $i$ 个分量

> [!TIP]
>
> Embedding 是**语义搜索**、**知识检索**、**聚类去重**等任务的基础：
>
> - **语义搜索**：通过向量距离找到语义相关的内容 —— _如搜索"如何提升代码质量"能匹配到"代码重构最佳实践"_
> - **知识检索**：从大规模知识库中检索相关信息 —— _如 RAG 系统从百万文档中秒级定位答案来源_
> - **聚类去重**：识别和分组相似内容 —— _如新闻聚合平台自动归类同一事件的不同报道_

有了 **Embedding** 这座连接语义与计算的桥梁，我们便有了为 **天才博士（LLM）** 外挂互联网这座“图书馆”（**外部知识库**）的能力——这便是 **RAG**。

### 1.3 博士的“图书管理员”

**RAG（Retrieval-Augmented Generation, 检索增强生成）** 的本质，就是给这位天才博士配备一位**极其高效的图书管理员**。

当用户提问时，管理员先利用 Embedding 在图书馆（向量数据库）中检索出最相关的几页资料，然后把**这些资料连同问题**一起递给博士。博士基于这些新鲜、准确的资料进行即时阅读和回答，从而有效解决了记忆截止和幻觉等固有缺陷<sup>[[2]](#ref2)</sup>：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'darkMode': true, 'mainBkg': '#1f2937', 'textColor': '#374151', 'lineColor': '#ffffff', 'signalColor': '#ffffff', 'signalTextColor': '#ffffff', 'noteBkgColor': '#1f2937', 'noteTextColor': '#ffffff', 'actorBkg': '#1f2937', 'actorBorder': '#ffffff', 'actorTextColor': '#ffffff'}, 'sequence': {'mirrorActors': false}}}%%
sequenceDiagram
    participant User as 🙋 用户
    participant RAG as 💁 图书管理员 (RAG)
    participant VDB as 📚 图书馆 (VectorDB)
    participant LLM as 👨‍🎓 天才博士 (LLM)

    Note over User, LLM: RAG 协同工作流程

    User->>RAG: 1. 提问："2024 奥运冠军是谁？"

    rect #374151
    Note right of RAG: 检索阶段
    RAG->>RAG: 把问题转化为"索书号" (Embedding)
    RAG->>VDB: 2. 按"索书号"查找相关书籍
    VDB-->>RAG: 3. 返回最相关的几页资料 (Top-K Chunks)
    end

    rect #1f2937
    Note right of RAG: 生成阶段
    RAG->>LLM: 4. 递交资料："博士，这是查到的资料和原本的问题，请回答"
    Note right of LLM: 阅读资料
    LLM-->>User: 5. 准确回答 (基于资料)
    end
```

将上述 RAG 协同过程抽象为各自独立的协作组件：

| RAG 组件       | 功能                       | 解决的 LLM 缺陷          |
| -------------- | -------------------------- | ------------------------ |
| **外部知识库** | 存储最新、专业的知识文档   | 知识时效性、领域知识缺乏 |
| **向量化**     | 将文档转换为语义向量       | 为相似性搜索提供基础     |
| **向量数据库** | 高效存储和检索向量         | 突破上下文窗口限制       |
| **语义检索**   | 找到与查询最相关的知识片段 | 提供事实依据，减少幻觉   |
| **上下文增强** | 将检索内容注入 LLM 提示    | 提供准确信息源           |

### 1.4 高维图书馆的“诅咒”

当我们将**图书馆（数据库）**从只有行和列的二维表格，升级到拥有成百上千个维度的**语义空间**时，必须面对一个反直觉的物理现象——**维度诅咒（Curse of Dimensionality）**。

这就像从**“在城市地图上找一家店（二维）”**变成了**“在茫茫宇宙中找一颗星（高维）”**。在如此广阔且复杂的空间里，传统的查找方法（如二分查找、B+树）会彻底迷失方向<sup>[[7]](#ref7)</sup>：

> [!WARNING]
>
> 随着维度增加，高维空间出现两个关键现象，导致传统数据库索引（如 KD-Tree, R-Tree）失效：
>
> 1. **距离集中效应**：高维下任意两点的距离差异消失，**所有点看起来都差不多远**。就像所有人距离你都是 99-100 米，"最近"和"最远"失去了界限。
> 2. **空间稀疏性**：空间体积随维度指数级膨胀，数据变得**极端稀疏**。就像将一滴水（数据）分散到整个太平洋（高维空间），传统格子划分法（索引）会完全失效。
>
> 具体表现：
>
> | 维度              | 数据特征 & 索引表现                                    | KD-Tree 效率对比暴力搜索    |
> | :---------------- | :----------------------------------------------------- | :-------------------------- |
> | **低维 (2-10)**   | 距离区分度高，空间划分有效                             | **快 100-1000x** (O(log N)) |
> | **中维 (10-100)** | 距离开始集中，索引剪枝能力大幅下降                     | **持平或略慢**              |
> | **高维 (>100)**   | **距离集中效应**显著，索引需访问几乎所有节点，完全失效 | **更慢** (因额外回溯开销)   |

因此，我们有必要引入专业的**向量数据库**来解决实际应用中的向量索引问题。

### 1.5 权衡利弊的“鉴赏家”

如果说传统数据库是严格的**会计师**（只认准确的 ID 和关键词），那么向量数据库则是直觉敏锐的**鉴赏家**（关注内容和语义的相似度）。

为了在海量的高维数据中，既保持这种敏锐的直觉（高召回率），又能在一眨眼间找到目标（低延迟），向量数据库进化出了以下核心“超能力”：

```mermaid
%%{init: {'theme': 'dark'}}%%
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

为了实现这种极致的检索速度，计算机工程师做出了一个关键的权衡——**用“绝对精度的微小牺牲”换取“检索速度的数量级提升”**：

> [!IMPORTANT]
>
> **精确搜索 vs. 近似搜索**
>
> | 搜索类型                    | 时间复杂度       | 召回率 | 适用场景                |
> | --------------------------- | ---------------- | ------ | ----------------------- |
> | **暴力搜索（Brute Force）** | O(n × d)         | 100%   | 小数据集（<10 万）      |
> | **近似搜索（ANN）**         | O(log n) ~ O(√n) | 95-99% | 大规模数据集（>100 万） |
>
> **关键洞察**：在大规模场景下，我们愿意用少量的召回率损失（1-5%）换取数量级的性能提升。这正是 ANN 算法的核心价值。

那么，具体如何落地 ANN？就像**图书馆**不仅要藏书，更要**编目**。我们必须通过特定的算法将杂乱的向量数据进行**分类（聚类）**或**编码（哈希）**，才能让查找从“大海捞针”变成“按图索骥”。接下来的章节将剖析构建这套“空间索引系统”的三大基石算法：K-Means 聚类、LSH（局部敏感哈希）和 NSW（导航小世界图）。

---

## 2. 基础索引算法

本章将深入剖析构建向量索引大厦的三块基石：**K-Means 聚类**、**LSH (局部敏感哈希)** 和 **NSW (导航小世界图)**。理解它们，是掌握 HNSW、IVF 等现代高阶算法的必经之路。

### 2.1 K-Means 聚类

#### 2.1.1 算法核心（选民站队）

面对海量数据，最直观的索引思路便是 **“物以类聚”**。

K-Means 就像是为数百万个向量选出 $K$ 个 **“代表”（Centroids）**。在查询时，如果不确定目标在哪里，我们只需先问这几个代表，就能快速缩小范围，而无需逐一排查。

选出这些最佳“代表”并不是一蹴而就的，而是一个 **“选民站队 $\leftrightarrow$ 代表调整”** 的反复协商过程：

```mermaid
graph TD
    Start[1. 随机提名] -->|"随机初始化 K 个代表"| Assign(2. 选民站队)
    Assign -->|"选民归入最近邻代表<br/>所在的队伍"| Update(3. 代表调整)
    Update -->|"队伍中心的选民晋升为代表"| Check{4. 是否稳定?}
    Check -->|"代表变动"| Assign
    Check -->|"代表未变"| Done[5. 选举完成]

    style Start fill:#bae7ff,color:#000000
    style Done fill:#d9f7be,color:#000000
    style Check fill:#fff7e6,color:#000000
```

> [!IMPORTANT]
>
> **K-Means 聚类算法** 的核心是将数据划分为 $K$ 个簇，用簇中心（Centroid）代表该簇所有向量<sup>[[9]](#ref9)</sup>。
>
> **数学目标**：最小化簇内方差和（Within-Cluster Sum of Squares, WCSS）：
>
> $$
>     J = \sum_{i=1}^{K} \sum_{x \in C_i} \|x - \mu_i\|^2
> $$
>
> 其中：
>
> - $K$ 是簇的数量
> - $C_i$ 是第 $i$ 个簇
> - $\mu_i$ 是第 $i$ 个簇的中心
> - $\|x - \mu_i\|^2$ 是向量 $x$ 到簇中心的欧几里得距离的平方

<details>
<summary>伪代码</summary>

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

</details>

#### 2.1.2 码本（向量字典）

> [!TIP]
>
> 想象一张包含 1600 万种颜色的照片（原始数据）。为了压缩，我们制作了一张只包含 256 种典型颜色的 **标准调色板（码本）** 来近似表示所有颜色。调色板中的每一种标准色块，就是一个 **码字 (Codeword)**。这样的好处是：
>
> - **数据压缩**：在存储时，不再记录每个像素复杂的 RGB 值（浮点数），而是仅记录它最接近的那个标准色在调色板中的 **编号 ID**。
> - **存储效率**：用极小的 ID（整数）替代了庞大的浮点数数组，虽损失微小精度，但换取了数十倍的存储空间。

K-Means 的关键是**选举少数的代表来近似表示全量的对象**，这种方式能够实现惊人的 **数据压缩**。这便是 **向量量化（Vector Quantization）** 的核心思想。

> [!NOTE]
>
> **码本制作三部曲**
>
> ```mermaid
> graph TD
>    subgraph "压缩效果"
>        ORIG[原始: 6KB/向量] --> COMP[压缩后: 1.25 字节/向量]
>    end
>
>    subgraph "向量量化过程"
>        V[原始向量<br/>1536 维 × N 个] --> KM[K-Means<br/>K=1024]
>        KM --> CB[码本<br/>包含 1024 个标准色]
>        KM --> ID[压缩存储<br/>仅存 10-bit ID]
>    end
>
>    style COMP fill:#52c41a,color:#fff
>    style KM fill:#1890ff,color:#fff
> ```
>
> 1.  **采样**：从海量数据中抽取训练集。
> 2.  **聚类**：运行 K-Means 得到 $K$ 个中心（生成调色板）。
> 3.  **编码**：将所有向量替换为最近中心的 ID（填色）。

影响码本质量的因素：

| 参数         | 作用               | 典型值          | 权衡                                   |
| ------------ | ------------------ | --------------- | -------------------------------------- |
| **K**        | 簇的数量，决定精度 | 256, 1024, 4096 | 越大越精确，存储越多                   |
| **初始化**   | 中心点初始选择策略 | **K-Means++**   | 智能分散初始点，避免局部最优，收敛更快 |
| **迭代次数** | 最大迭代轮数       | 10-100          | 越多越精确，耗时越久                   |

### 2.2 LSH（Locality Sensitive Hashing, 局部敏感哈希）

#### 2.2.1 算法核心（局部冲突）

如果说 K-Means 是精细的 **“选代表”**，那么 LSH 则是快速的 **“粗分桶”**。

它的核心逻辑与我们熟知的传统哈希（如 MD5、SHA）截然相反：传统哈希追求 **“蝴蝶效应”**（输入微小改变，输出天翻地覆）；而 LSH 追求 **“稳定映射”**（输入微小改变，输出保持不变），从而让相似的向量落入同一个“哈希桶”中。

> [!IMPORTANT]
>
> **LSH 的核心思想是“刻意制造局部冲突”**：相似的向量以高概率被哈希到同一个桶，不相似的向量以低概率被哈希到同一个桶<sup>[[10]](#ref10)</sup>。
>
> ```mermaid
> graph LR
>     subgraph Traditional["🔴 传统哈希 (如 MD5) - 最小化冲突"]
>         direction LR
>         A["'apple'"] --> H1(Hash)
>         B["'apply'"] --> H1
>         H1 --> |分散| T1["0x5e..."]
>         H1 --> |分散| T2["0x8a..."]
>     end
>
>     subgraph LSH_Box["🟢 LSH (局部敏感) - 最大化冲突"]
>         direction LR
>         C["'apple'"] --> H2(LSH)
>         D["'apply'"] --> H2
>         H2 --> |聚合| L1["Bucket 01"]
>     end
>
>     style L1 fill:#d9f7be,stroke:#52c41a,color:#000000
>
>     Traditional --> LSH_Box
>
>     style T1 fill:#ffccc7,stroke:#ff4d4f,color:#000000
>     style T2 fill:#ffccc7,stroke:#ff4d4f,color:#000000
>
> ```

使得数学式定义为：

> [!NOTE]
>
> 一个哈希函数族 $\mathcal{H}$ 是 $(d_1, d_2, p_1, p_2)$ 敏感的，当且仅当对任意 $v_1, v_2 \in \mathbb{R}^d$：
>
> - 如果 $\text{dist}(v_1, v_2) \leq d_1$，则 $P[h(v_1) = h(v_2)] \geq p_1$
> - 如果 $\text{dist}(v_1, v_2) \geq d_2$，则 $P[h(v_1) = h(v_2)] \leq p_2$
>
> 其中 $d_1 < d_2$ 且 $p_1 > p_2$。
>
> 这个数学定义可以翻译成 **"两个承诺"**：
>
> - 承诺一（**对近邻负责**）： 如果两个向量非常像（距离小于 $d_1$），那么我保证它们大概率（概率大于 $p_1$）会被分到同一个桶里。
> - 承诺二（**对远邻负责**）： 如果两个向量非常不像（距离大于 $d_2$），那么我保证它们小概率（概率小于 $p_2$）会被分到同一个桶里。

#### 2.2.2 Random Projection（随机超平面投影）

那么，如何构造这样神奇的哈希函数？最直观的方法就是 **“切蛋糕”**。

> [!TIP]
>
> 想象向量空间是一块巨大的多维蛋糕，我们闭着眼睛随机切几刀（随机超平面）。离得很近的两个点（相似向量），大概率会被保留在同一块切片里；而离得很远的点，则很容易被某一刀切开。

> [!NOTE]
>
> **随机超平面投影**是**余弦相似度**测量方式场景下的最常用 LSH 方法<sup>[[10]](#ref10)</sup>。其**随机投影流程**如下：
>
> ```mermaid
> graph LR
>     subgraph "随机投影 LSH"
>         V[向量 v] --> P1[投影到超平面 1]
>         V --> P2[投影到超平面 2]
>         V --> P3[投影到超平面 k]
>
>         P1 --> |"v·r1 > 0 → 1"| B1[1]
>         P2 --> |"v·r2 < 0 → 0"| B2[0]
>         P3 --> |"v·r3 > 0 → 1"| B3[1]
>
>         B1 & B2 & B3 --> HC[哈希码: 101]
>     end
> ```
>
> 1. **生成随机超平面**：生成 $k$ 个随机单位向量 $r_1, r_2, ..., r_k$
> 2. **计算哈希码**：对每个输入向量 $v$，计算 $h_i(v) = \text{sign}(v \cdot r_i)$
> 3. **构建哈希表**：将具有相同哈希码的向量放入同一个桶
> 4. **查询**：将查询向量哈希，检索同一桶中的候选向量
>
> 有一个著名的结论：两个向量被随机超平面分割开的概率，直接与它们之间的夹角 $\theta$ 正相关：
>
> $$
>   P(h(x) \neq h(y)) = \frac{\theta}{\pi}
> $$
>
> 这恰好对应了余弦距离（夹角大小），因此认为随机超平面投影是专门针对余弦相似度这种相似度量方式的索引算法。

<details>
<summary>伪代码</summary>

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

</details>

#### 2.2.3 LSH 参数调优（捕鱼策略）

LSH 的效果高度依赖参数设置，这就像制定 **“捕鱼策略”**：

- **$k$ (比特数) $\approx$ 渔网网眼的密度**：
  网眼越密（$k$ 越大），区分度越高，但太密可能导致“漏鱼”（召回率下降）；网眼越疏，越容易捕获，但会捞进很多杂物（精度下降）。
- **$L$ (哈希表数) $\approx$ 撒网的次数**：
  一次捞不到，就多撒几次网（$L$ 增多）。撒网次数越多，捕获目标的概率越高（召回率提升），但同时也增加了体力和时间的消耗（计算和存储成本增加）。

| 参数              | 含义             | 影响                             |
| ----------------- | ---------------- | -------------------------------- |
| **k（比特数）**   | 每个哈希码的位数 | 越大桶越细，召回降低，精度提高   |
| **L（哈希表数）** | 独立哈希表的数量 | 越多召回率越高，但内存和时间增加 |
| **桶大小**        | 每个桶的容量     | 太大查询慢，太小可能漏掉相似项   |

> [!TIP]
>
> **召回率与哈希表数量的关系**：
>
> $$
>     P[\text{找到近邻}] = 1 - (1 - p^k)^L
> $$
>
> 其中 $p$ 是两个相似向量被单个超平面分到同一侧的概率。

#### 2.2.4 LSH 变体

| LSH 变体              | 适用距离度量   | 特点                                       |
| --------------------- | -------------- | ------------------------------------------ |
| **Random Projection** | 余弦相似度     | 使用随机超平面<sup>[[10]](#ref10)</sup>    |
| **MinHash**           | Jaccard 相似度 | 适用于集合数据<sup>[[10]](#ref10)</sup>    |
| **SimHash**           | 汉明距离       | 适用于文档去重<sup>[[10]](#ref10)</sup>    |
| **p-stable LSH**      | Lp 距离        | 适用于 L1/L2 距离<sup>[[10]](#ref10)</sup> |

### 2.3 NSW（Navigable Small World, 导航小世界图）

#### 2.3.1 算法核心（人脉捷径）

LSH 是靠 **“运气”**（概率）撞大运，而 NSW 则是靠 **“人脉”**（图关系）找捷径。

这基于著名的 **“六度分隔”** 理论：任意两个人之间平均只需要通过 6 个中间人就能建立联系。在向量世界里，如果我们能构建这样一张 **“小世界网络”**，就能从任意起点出发，通过几次跳跃快速找到目标<sup>[[11]](#ref11)</sup>。

```mermaid
graph TB
    subgraph "小世界图特性"
        A[节点] --> B[局部连接]
        A --> C["长程连接 (**捷径**)"]
        B --> D["高聚类系数<br/>邻居之间高度互连"]
        C --> E["短路径长度<br/>O(log n) 跳数"]
    end

    style D fill:#bae7ff,stroke:#1890ff,color:#000000
    style E fill:#d9f7be,stroke:#52c41a,color:#000000
```

#### 2.3.2 NSW 图构建（新人融入）

构建 NSW 的过程，就像一个**新人融入社交圈**的过程。当一个新节点（新向量）加入时，它不能孤立存在，必须建立连接：

```mermaid
flowchart LR
    A[新人加入 v] --> B[1. 随机搭讪: 选入口点]
    B --> C[2. 朋友介绍: <br/>贪婪搜索 M 个近邻]
    C --> D[3. 建立友谊: 双向连接]
    D --> E[融入完成]

    style C fill:#1890ff,color:#fff
```

1.  **随机搭讪**：随机找个现有节点作为入口。
2.  **朋友介绍**：通过入口点，不断认识“更接近自己兴趣”的朋友（贪婪搜索）。
3.  **建立友谊**：找到最投缘的 $M$ 个朋友，建立双向联系。

这样，随着新人不断加入，整个网络就自然形成了既有小圈子又有远方朋友的结构。

<details>
<summary>伪代码</summary>

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

</details>

#### 2.3.3 NSW 的搜索（接力问路）

NSW 的搜索就像是一场 **“接力问路”**。

我们不需要遍历整个数据海洋，而是从入口点开始，每次都向当前的邻居们打听：“你们谁离目的地（查询向量）最近？”然后迅速跳到那个最接近的邻居身上。由于“长程捷径”的存在，这种跳跃通常能以惊人的速度逼近目标。

```mermaid
graph LR
    subgraph "NSW 贪婪搜索"
        direction LR
        Q[查询向量] --> E[入口点]
        E --> |"移动到更近邻居"| N1[节点1]
        N1 --> |"继续移动"| N2[节点2]
        N2 --> |"继续移动"| N3[节点3]
        N3 --> |"局部最优"| R[返回结果]
    end

    style Q fill:#ffd591,color:#000000
    style R fill:#b7eb8f,color:#000000
```

#### 2.3.4 NSW 复杂度分析

| 指标       | 复杂度           | 说明                         |
| ---------- | ---------------- | ---------------------------- |
| 构建时间   | O(n × log n × M) | n 个向量，每个搜索 O(log n)  |
| 搜索时间   | O(log^k n)       | k 是小世界指数，通常 k ≈ 1-2 |
| 空间复杂度 | O(n × M)         | 每个节点存储 M 个邻居        |

**NSW 的局限性（扁平地图的困境）**：

虽然 NSW 表现不错，但它本质上还是一张 **“扁平的地图”**。当数据规模膨胀到亿级时，单纯依靠“问路”会出现问题：

1.  **陷入死胡同（局部最优）**：大概率跳到一个局部最近点，却发现周围没有路通向真正的全局最近点。
2.  **缺乏高速公路**：所有的跳跃都在同一层级进行，缺乏一种“先坐飞机到城市，再坐车到街道”的分层导航机制。

为了解决“扁平”问题，我们需要在这张地图上架设 **“立体高架桥”** —— 这正是下一章 **HNSW** 的核心思想。

---

## 3. 高级索引算法

本章介绍三种最重要的高级索引算法：HNSW（分层导航小世界图）、IVF（倒排文件索引）系列和 PQ（积量化）。

### 3.1 HNSW（Hierarchical Navigable Small World, 分层导航小世界图）<sup>[[12]](#ref12)</sup>

#### 3.1.1 算法核心（立体交通）

如果说 NSW 是错综复杂的地面交通网，那么 HNSW 就是在此基础上修建了 **“立体交通体系”**（飞机-高铁-汽车）。

它通过引入 **Skip List（跳表）** 的思想，将图结构分层：

- **顶层（国际航线）**：节点稀疏，负责超长距离的“洲际跳转”，快速锁定大概区域。
- **中层（高速公路）**：节点较密，负责区域内的快速接近。
- **底层（社区街道）**：包含所有节点，负责最后几百米的精准定位。

这种结构让搜索变成了：**“先坐飞机到城市 $\rightarrow$ 再开车到社区 $\rightarrow$ 最后步行找门牌”**，从而实现了极致的检索效率。

```mermaid
graph LR
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

    style L3 fill:#ffe58f,color:#000000
    style L0 fill:#91d5ff,color:#000000
    style R fill:#b7eb8f,color:#000000
```

> [!TIP]
>
> **层级“晋升”机制**：就像公司的组织架构一样，HNSW 的层级也是金字塔形的：
>
> - 所有人都属于底层员工（Layer 0）。
> - 通过“抛硬币”（概率函数）决定谁能晋升为经理（Layer 1）、总监（Layer 2）甚至 CEO（顶层）。
> - 这种机制保证了高层节点的稀疏性，从而构建出高效的跳跃网络。
>
> **层级概率**：每个节点被分配到第 $l$ 层的概率为：
>
> $$
>     P(\text{level} = l) = \frac{1}{m_L} \cdot \left(\frac{1}{m_L}\right)^{l-1} = \left(\frac{1}{m_L}\right)^l
> $$
>
> 其中 $m_L$ 是层级因子（通常为 $\frac{1}{\ln(M)}$，M 是最大连接数）。

#### 3.1.2 HNSW 图构建（精准空降）

HNSW 插入新节点的过程，就像是一次 **“新住户搬家融入社区”** 的过程：

1. **快速定位（找小区）**：从最顶层（宏观地图）开始，只问路不交友。快速跳跃，找到目标大概所在的区域。这就像先确定要搬到哪个城市、哪个行政区。
2. **逐层落户（建社交）**：当到达了为你分配的 **“最高社交层级”**（比如你被判定为“热心朝阳群众”，层级较高）时，就开始 **“停下来交朋友”**。
3. **全面融入**：从这一层开始，一直到最底层（Layer 0），在每一层你都要找到周围离你最近的 $M$ 个邻居，并与他们交换联系方式（建立双向连接）。这样，不仅你在每层都有了圈子，同时也成为了别人的“捷径”。

```mermaid
flowchart TD
    Start[新节点 q 入场] --> LevelCalc[1. 晋升判定: <br/>随机决定最大层级 L_max]

    subgraph Phase1 ["第一阶段: 高空速降 (只搜不连)"]
        direction LR
        P1_Search[贪婪搜索: 快速逼近] --> P1_Down[逐层下降]
        P1_Down --> |"未到 L_max"| P1_Search
    end

    subgraph Phase2 ["第二阶段: 地面建联 (边搜边连)"]
        direction LR
        P2_Layer["到达层级 L_max"] --> P2_Search[每层搜索: <br/>ef_construction 个邻居]
        P2_Search --> P2_Link[建立连接: <br/>选 M 个最近邻居]
        P2_Link --> P2_Prune[启发式剪枝: <br/>保持连接虽然少但优质]
        P2_Prune --> P2_Next{还有下一层?}
        P2_Next --> |Yes| P2_Down[继续下降] --> P2_Search
        P2_Next --> |No| End[插入完成]
    end

    LevelCalc --> Phase1
    Phase1 --> |"到达 L_max"| Phase2

    style LevelCalc fill:#e6f7ff,stroke:#1890ff,color:#000000
    style P2_Link fill:#d9f7be,stroke:#52c41a,color:#000000
    style P2_Prune fill:#fff7e6,stroke:#fa8c16,color:#000000
```

> [!NOTE]
>
> **启发式剪枝 (Heuristic Pruning)**：**"不仅选最近的，还要选分布广的"** 的邻居选择策略。
>
> 假设你要在微信里选 5 个朋友做“紧急联系人”（建立连接）。**普通策略（只看距离）** 选了 5 个住在你楼下的邻居。如果你要联系住在另一个城市的人，消息传不出去，因为你的圈子太窄了（局部最优陷阱）。
>
> **启发式剪枝策略（HNSW 的做法）** 则先选了 1 个楼下邻居，然后想选第 2 个邻居时："哎，第 2 个邻居虽然也离你很近，但他离第 1 个邻居也近！既然你可以通过第 1 个邻居找到他，那就不需要直接连他了。可以连一个虽然稍远一点，但方向完全不同的人（比如住在隔壁区的同学）。"
>
> 通过这种 **“喜新厌旧”**（偏好那些不能通过现有邻居快速到达的点）的策略，HNSW 构建的图既有短边（保留细节），又有长边（跨越区域），大大提升了搜索时的“导航”效率。
>
> 启发式剪枝的核心目的是优化图的 **连通性**，防止 **“抱团”** 现象（即所有邻居都聚在一起），从而在图中建立更高效的“高速公路”。

<details>
<summary>伪代码</summary>

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

</details>

#### 3.1.3 HNSW 的搜索（卫星变焦）

HNSW 的搜索过程，就像在 **Google Earth** 上找一家烤鸭店：

1. **太空视角（顶层）**：转动地球仪，快速锁定到了“亚洲”（不用看美洲）。
2. **高空视角（中层）**：放大地图，快速定位到“中国 $\rightarrow$ 北京 $\rightarrow$ 朝阳区”。
3. **街景视角（底层）**：进入街道，精确寻找“xx 烤鸭店”。

通过这种 **“由粗到细、逐层放大”** 的方式，避免在茫茫数据中盲目寻找。

```mermaid
graph TB
    %% Define Layers
    subgraph L2 ["Layer 2: 太空视角 (宏观)"]
        direction LR
        P0(( )) --> |"1. 贪婪跳跃"| P1(( ))
        P1 --> |"跨洲际"| P2(( ))
        P2 -.-> |"锁定亚洲"| Down1(⬇️)
    end

    subgraph L1 ["Layer 1: 高空视角 (区域)"]
        direction LR
        P3(( )) --> |"2. 贪婪跳跃"| P4(( ))
        P4 --> |"跨省市"| P5(( ))
        P5 -.-> |"锁定北京"| Down2(⬇️)
    end

    subgraph L0 ["Layer 0: 街景视角 (精细)"]
        direction LR
        P6(( )) --> |"3. 局部搜索"| P7(( ))
        P7 --> |"ef_search"| Target((📍 目标))
    end

    Entry((入口)) --> L2
    L2 --> |"降落"| L1
    L1 --> |"降落"| L0

    %% Styling
    linkStyle 0,1,3,4,6,7 stroke:#1890ff,stroke-width:2px;
    linkStyle 2,5,8 stroke:#fa8c16,stroke-width:2px,stroke-dasharray: 5 5;

    classDef l2 fill:#fff7e6,stroke:#ffd591,color:#000
    classDef l1 fill:#e6f7ff,stroke:#69c0ff,color:#000
    classDef l0 fill:#f6ffed,stroke:#b7eb8f,color:#000

    class L2 l2
    class L1 l1
    class L0 l0

    classDef highlight fill:#ffccc7,stroke:#ff4d4f,color:#000;
    class Target highlight;
```

<details>
<summary>伪代码</summary>

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

</details>

#### 3.1.4 HNSW 参数调优

HNSW 的参数调优本质上是在做 **“质量与速度”的极限拉扯**。我们可以将其看作是 **修建和运营高速公路** 的权衡：

- **$M$ (车道数)**：车道越多（连接越多），路网越四通八达（召回率高），但造价越贵（内存消耗大，构建慢）。
- **`ef_construction` (施工标准)**：地基打得越深、勘测越仔细（搜索越广），路面质量越好（索引更优），但工期也会显著拉长。
- **`ef_search` (导航搜索范围)**：在开车导航时，搜索的范围越大（查看更多备选路线），越容易找到最佳出口（高召回），但计算耗时也越久（高延迟）。

| 参数                | 含义           | 推荐值  | 影响                           |
| ------------------- | -------------- | ------- | ------------------------------ |
| **M**               | 每层最大邻居数 | 16-64   | 越大召回越高，但构建和搜索更慢 |
| **ef_construction** | 构建时搜索宽度 | 100-200 | 越大索引质量越高               |
| **ef_search**       | 搜索时探索宽度 | 10-1000 | 越大召回越高，延迟越大         |
| **ml**              | 层级因子       | 1/ln(M) | 控制层级分布                   |

**性能与召回率权衡**：

```mermaid
graph LR
    subgraph Knobs ["🎛️ 参数调节 (加大投入)"]
        direction TB
        K1["M (车道数): 16 ➔ 64"]
        K2["ef (搜索宽): 100 ➔ 800"]
    end

    subgraph Impact ["⚖️ 权衡结果 (双刃剑)"]
        direction TB
        Good["✅ 召回率 (Recall)<br/>95% ➔ 99.9%"]
        Bad["⚠️ 延迟 (Latency)<br/>1ms ➔ 10ms"]
        Cost["📉 内存/构建 (Cost)<br/>增加 2-4 倍"]
    end

    K1 ==> Good & Bad & Cost
    K2 ==> Good & Bad

    style Good fill:#d9f7be,stroke:#52c41a,color:#000
    style Bad fill:#fff1f0,stroke:#ff4d4f,color:#000
    style Cost fill:#fffbe6,stroke:#fa8c16,color:#000
    style K1 fill:#e6f7ff,stroke:#1890ff,color:#000
    style K2 fill:#e6f7ff,stroke:#1890ff,color:#000
```

#### 3.1.5 HNSW 复杂度分析

| 指标     | 复杂度                  | 说明                         |
| -------- | ----------------------- | ---------------------------- |
| 构建时间 | O(n × log n × M × ef_c) | ef_c = ef_construction       |
| 搜索时间 | O(log n × ef × M)       | 实际通常 < 1ms               |
| 内存占用 | O(n × M × L)            | L 是平均层数 ≈ log(n)/log(M) |

### 3.2 IVF（Inverted File Index, 倒排文件索引）系列

#### 3.2.1 算法核心（分而治之）

如果说 **HNSW** 是靠 **“社交网络”** 找人的人脉，那么 **IVF** 就是靠 **“分而治之”** 找书的 **“图书馆索引”**。

**IVF** 使用聚类算法（通常是 K-Means）将向量空间划分为多个 Voronoi 区域（簇），查询时只搜索最相关的几个区域<sup>[[13]](#ref13)</sup>。

```mermaid
graph TB
    subgraph S["🔍 找一本《乔布斯传》"]
        direction TB
        Q[🔍《乔布斯传》] --> FIND[1. 目录匹配:<br/>定位最近的 nprobe 个分类]
        FIND --> SEARCH[2. 局部查找:<br/>只搜'科技'和'传记'书架]
        SEARCH --> RESULT[✅ 找到目标]
    end

    subgraph I["IVF: 图书馆分类索引"]
        direction TB
        DATA["📚 原始书库 (N 本书)"] --> CLUSTER[K-Means 自动分类]

        CLUSTER --> |"历史类"| C1[🗂️ 书架 1]
        CLUSTER --> |"科技类"| C2[🗂️ 书架 2]
        CLUSTER --> |"..."| C3[🗂️ 书架 ...]
        CLUSTER --> |"艺术类"| CK[🗂️ 书架 K]

        C1 --> V1[📖 书本列表 1]
        C2 --> V2[📖 书本列表 2]
        CK --> VK[📖 书本列表 K]
    end

    style CLUSTER fill:#1890ff,color:#fff
    style FIND fill:#fa8c16,color:#fff
```

**工作流程**：

1. **分类（聚类）**：先将所有书本（向量）按内容归类，分别放入 $K$ 个不同的“书架”（簇/Bucket）。
2. **检索（查表）**：找书时，先确定这本书最可能出现在哪几个书架（`nprobe` 个最近的簇），然后**只去这几个书架**里逐本翻找。
3. **效果**：直接忽略了绝大多数无关的书架，从而将搜索范围从“整个图书馆”缩小到了“几个书架”。

**数学表述**：

1. **索引构建**：使用 K-Means 将 $n$ 个向量划分为 $K$ 个簇。
2. **查询**：给定查询向量 $q$，首先找到距离 $q$ 最近的 `nprobe` 个簇中心，仅在这些簇包含的向量中进行精确搜索。
3. **效果**：搜索复杂度从 $O(n)$ 降为 $O(K + \text{nprobe} \times \frac{n}{K})$。

#### 3.2.2 IVFFlat

IVFFlat（Inverted File with Flat vectors）是 IVF 家族中最基础的成员，它就像是一个 **珍藏完整原本的图书馆**。

- **IVF (倒排)**：书本按主题分架摆放（聚类），找书时只需看特定的几个书架。
- **Flat (平铺)**：书架上放的是厚重的 **完整原本**（完整向量），没有做任何删减或压缩。

这种方式虽然保证了内容的 **原汁原味**（精度高），但也意味着书架必须很大（内存占用高），且每次对比都要阅读全文（计算慢）。

> [!NOTE]
>
> IVF 与 IVFFlat 两个概念容易混淆，其实它们是 **“骨架”** 与 **“血肉”** 的关系：
>
> - **IVF (索引结构)**：决定了 **“怎么找”**（通过聚类缩小范围）。
> - **Flat (存储方式)**：决定了 **“存什么”**（存储未压缩的原始向量）。
>
> **IVFFlat** 就是两者的结合。如果我们把存储方式换成由 PQ（积量化）压缩后的编码，就变成了 **IVF-PQ**（下一节介绍），那时候书架上放的就是“缩印本”了。

<details><summary>伪代码</summary>

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

</details>

#### 3.2.3 IVF 参数调优（图书管理）

IVF 的参数配置，本质上是在调整 **“书架的密度”** 和 **“翻找的耐心”**：

- **`nlist` (书架数量)**：
  - 分得太少（`nlist` 小）：每个书架的书像山一样高，找起来累死人（桶内搜索慢）。
  - 分得太多（`nlist` 大）：书架太多，光是定位“在哪个书架”都要花半天（聚类中心匹配慢）。
  - **经验法则**：通常设置为 $\sqrt{n}$，保持平衡。
- **`nprobe` (翻找范围)**：
  - 翻得少（`nprobe` 小）：速度快，但如果书被归类到了隔壁书架（边界效应），就漏掉了（召回率低）。
  - 翻得多（`nprobe` 大）：越保险，召回率越高，但越接近全量搜索（速度变慢）。

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

### 3.3 PQ（Product Quantization，积量化）

#### 3.3.1 算法核心（拼图画像）

PQ 的核心思想是 **“切分组合”**，就像警方的 **拼图画像还原真凶**：

1. **切分 (Product)**：把一个复杂的 $d$ 维长向量（比如一张人脸照片），切分成 $M$ 个小段（比如眼睛、鼻子、嘴巴）。
2. **量化 (Quantization)**：对每个部位，我们只提供 256 种“标准零件”（Codebook）。
   - 这个人的“眼睛”最像“标准眼 No.5”，那就记下 `5`。
   - 这个人的“鼻子”最像“标准鼻 No.88”，那就记下 `88`。
3. **压缩**：原本需要存储大量浮点数的原始向量，现在只需要存储几个简短的 **ID 号**（如 `[5, 88, ...]`）。

虽然损失了一些细节（精度略降），但存储空间瞬间缩小了几十倍。

**PQ（Product Quantization，积量化）** 是一种极具效率的向量压缩技术，将高维向量分割为多个子向量，分别量化后用紧凑的码字表示<sup>[[13]](#ref13)</sup>。

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

    style V fill:#ffe58f,color:#000000
    style CODE fill:#b7eb8f,color:#000000
```

**数学表述**：将 $d$ 维向量分割为 $M$ 个子向量，每个子向量独立进行 K-Means 聚类（训练出 $M$ 个各自的码本）：

$$
    v = [v_1, v_2, ..., v_M], \quad v_i \in \mathbb{R}^{d/M}
$$

存储时，每个子向量 $v_i$ 用其最近的聚类中心 ID（码字）$q_i$ 替代：

$$
    \text{Code}(v) = [q_1(v_1), q_2(v_2), ..., q_M(v_M)]
$$

#### 3.3.2 PQ 的压缩率

PQ 的压缩效果就像把一本 **500 页的厚书（原始向量）**，浓缩成了一张 **8 页的小纸条（PQ 编码）**。

- **原始版**：需要 512 字节来记录完整信息。
- **PQ 版**：只需要 8 字节（8 个 ID）就能描述大致轮廓。

这种 **64 : 1** 的极致压缩，使得单机内存装下亿级数据成为可能。

假设原始向量为 $d=128$ 维 FP32（512 字节），使用 $M=8$ 个子空间，每个子空间 $K=256$ 个聚类中心：

| 项目         | 计算                          | 结果           |
| ------------ | ----------------------------- | -------------- |
| **原始向量** | 128 × 4 字节                  | 512 字节       |
| **PQ 编码**  | 8 × 1 字节（log2(256)=8 bit） | **8 字节**     |
| **压缩倍率** | 512 / 8                       | **64 倍**      |
| **码本大小** | 8 × 256 × 16 × 4 字节         | 128 KB（共享） |

#### 3.3.3 PQ 的搜索（价目表速查）

PQ 为了极致的计算速度，发明了一种 **“查表速算”** 的技巧 —— **ADC（Asymmetric Distance Computation，非对称距离计算）**。

这就像收银员的 **“扫码算账”**：

1. **预制价目表（Pre-compute）**：当查询向量 $q$ 到来时，先计算它与所有 256 个“标准零件”（聚类中心）的距离。这就像收银员手里拿到了一张今天的《商品价目表》。
2. **扫码求和（Lookup & Sum）**：对于数据库中的压缩向量（只是一串 ID，如 `[5, 88]`），不需要做复杂的几何计算，只需去《价目表》里查 ID=5 和 ID=88 的数值，然后 **加起来** 就行。

运算量从大量的浮点乘加（计算 $d$ 维距离），变成了极简的 **查表求和**（$M$ 次加法），速度提升显著。

**数学表述**：

1. **预计算**：生成查询向量 $q$ 到每个子空间所有 $K$ 个码字的距离表 $D$。

$$
    D_{ij} = \|q_i - c_{ij}\|^2, \quad i \in [1,M], j \in [1,K]
$$

2. **查表计算**：对每个编码向量，通过查表累加距离。

$$
    \|q - \tilde{v}\|^2 \approx \sum_{i=1}^{M} D_{i, \text{code}_i(v)}
$$

<details>
<summary>伪代码</summary>

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

</details>

#### 3.3.4 IVFPQ：IVF + PQ 组合（强强联手）

IVFPQ 是将 IVF 的 **“分而治之”** 与 PQ 的 **“极致压缩”** 完美结合的产物（如 Faiss 标配）。

它就像建立了一个 **“现代化微缩档案馆”**：

1. **分类归档 (IVF)**：先把档案按类别分到不同的柜子（减少搜索范围）。
2. **存差值 (Residual)**：柜子里不存完整档案，只存 **“该档案与标准模板（聚类中心）的差异”**。因为同类档案长得很像，存“差异”比存“全貌”数值更小，更易量化。
3. **微缩拍摄 (PQ)**：把这些“差异数据”进一步切分、量化，拍成极小的 **“微缩胶卷”**（PQ Code）。

```mermaid
graph TD
    subgraph "IVFPQ: 存差值的微缩档案"
        V[原始向量] --> IVF[1. IVF 聚类: 找到所属中心 C]
        IVF --> R_Calc[2. 计算残差: <br/>R = 向量 - 中心 C]
        R_Calc --> PQ[3. PQ 量化: </br>对残差 R 进行压缩]
        PQ --> Store["📦 存储: {簇ID, PQ编码}"]
    end

    style IVF fill:#1890ff,color:#fff
    style PQ fill:#52c41a,color:#fff
    style R_Calc fill:#fa8c16,color:#fff
```

**核心优势**：

- **搜索快**：IVF 排除了大部分无关数据。
- **省内存**：PQ 把向量压缩了 几十倍。
- **精度高**：**残差编码**（$r = v - c$）使得量化的对象数值范围更小、分布更集中，从而大幅降低了量化误差。

#### 3.3.5 PQ 变体（各显神通）

PQ 虽然强大，但并非万能。为了在 **精度、速度、内存** 之间找到更极致的平衡，衍生出了多种变体。

这就像我们 **保存一张高清照片（向量）的不同策略**：

- **PQ (标准版)**：**“切块找替身”**。把照片切成 16 小块，每块用一个“标准贴纸”代替。
- **OPQ (进阶版)**：**“旋转再切块”**。切之前先 **找好角度**（旋转坐标轴），顺着纹理切，保留更多细节。
- **SQ (极速版)**：**“降低分辨率”**。不切块，直接把数据精度从“高清 (FP32)”降级为“标清 (INT8)”，简单粗暴，计算最快。
- **RQ (精修版)**：**“层层修补”**。先画个大概轮廓，再画细节，再画毛孔……用多层残差不断逼近原图。
- **RaBitQ (极限版)**：**“黑白简笔画”**。直接处理成 0 和 1（二值化），极致省地，但只剩骨架。

| 算法       | 核心特性      | 适用场景   | 优势与代价                  |
| :--------- | :------------ | :--------- | :-------------------------- |
| **PQ**     | 基础分块      | 通用大规模 | 基准方案，平衡性最好        |
| **OPQ**    | **旋转** + PQ | 高精度要求 | 召回率更高，但预处理变慢    |
| **SQ**     | **标量** 降准 | 简单快速   | 计算极快，但压缩率有限 (4x) |
| **RQ**     | **残差** 逼近 | 极高精度   | 还原度高，但搜索很慢        |
| **RaBitQ** | **二值** 化   | 内存受限   | 极限压缩 (32x+)，精度损失大 |

---

## 4. 磁盘索引与 GPU 加速

当数据规模超出内存容量，或需要极致性能时，需要考虑磁盘索引和 GPU 加速方案。

### 4.1 DiskANN：突破内存限制的图索引

#### 4.1.1 算法核心（前店后厂）

前面的算法（如 HNSW）都像把所有商品都摆在 **市中心昂贵的展示厅（内存）** 里，虽然拿取方便，但租金太贵，放不下多少东西。

**DiskANN** 的思路是 **“展示厅 + 仓库”** 的混合模式：

```mermaid
graph LR
    subgraph "DiskANN: 前店后厂架构"
        direction TB

        subgraph Store["🏢 展示厅 (RAM)"]
            direction LR
            Entry["🚪 导航入口"]
            Catalog["📖 平板目录 (PQ 压缩向量)"]
            Entry --> Catalog
        end

        subgraph Warehouse["🏭 大仓库 (SSD)"]
            direction LR
            Map["🗺️ 仓库地图 (Adjacency List)"]
            FullGoods["📦 真实商品 (完整向量)"]
            Map --> FullGoods
        end

        Q[客户查询] --> Store
        Store --> |"1. 快速粗选"| Robot[🤖 取货指令]
        Robot --> Warehouse
        Warehouse --> |"2. 精准再验"| Result[✅ 交付]
    end
    style Store fill:#ffffff,stroke:#1890ff,stroke-width:2px,color:#1890ff
    style Warehouse fill:#ffffff,stroke:#fa8c16,stroke-width:2px,color:#fa8c16

    classDef ram fill:#e6f7ff,stroke:#69c0ff,color:#000
    classDef ssd fill:#fff7e6,stroke:#ffc069,color:#000
    classDef action fill:#f6ffed,stroke:#b7eb8f,color:#000
    classDef query fill:#fff,stroke:#000,color:#000

    class Entry,Catalog ram
    class Map,FullGoods ssd
    class Robot,Result action
    class Q query
```

1. **内存（展示厅）**：只放一本薄薄的 **“商品目录”**（压缩的 PQ 向量），用来快速查阅。
2. **SSD（大仓库）**：把占地方的 **“真实商品”**（完整向量和图结构）都堆在便宜的郊区仓库（SSD）里。
3. **搜索**：先在目录上选好，再派机器人去仓库精准取货。

**效果**：用不到 1/10 的内存，就能管理 10 倍的数据量，且速度损失很小。

**DiskANN** 由微软研究院开发，专为解决 **十亿级向量无法完全载入内存** 的问题而设计<sup>[[16]](#ref16)</sup>。

#### 4.1.2 Vamana 图构建（超级单层）

如果说 HNSW 是 **“多层立交桥”**，那么 Vamana 就是 **“含超长隧道的平面地铁网”**。

**“如果你的朋友 A 离 B 很近，你就没必要直接连 B 了（借道 A 即可）。要把宝贵的名额留给那些——现在的圈子接触不到的远方朋友 C。”**

```mermaid
flowchart LR
    subgraph "Vamana 建图: 打造超级捷径"
        direction LR
        Init[1. 随机初始化] --> Iter[2. 迭代优化]
        Iter --> Search[3. 贪婪搜索: 找一群候选人]
        Search --> Prune[4. α-RNG 剪枝: <br/>踢掉'借道也能到'的冗余邻居<br/>保留'方向独特'的远方朋友]
        Prune --> Link[5. 建立双向连接]
        Link --> Check{收敛?}
        Check -->|No| Iter
        Check -->|Yes| Finish[输出: 稀疏但高效的图]
    end

    style Prune fill:#fff7e6,stroke:#fa8c16,color:#000
```

Vamana 通过这种 **“喜新厌旧、去重求远”** 的策略，在**单层图**中构建出了类似“小世界”的高效导航能力。这便是极具侵略性的 **$\alpha$-RNG 剪枝策略**，强行在图中打通了许多 **“远距离捷径”**。Vamana 这种单层图结构特别利于减少磁盘的随机读取次数，因此非常适合**磁盘索引**。

> [!TIP]
>
> **$\alpha$-RNG 剪枝的核心逻辑**：
>
> 对于候选邻居 $p$，如果存在另一个已选邻居 $p'$ 满足：
>
> $$
>     \alpha \cdot d(p, p') < d(v, p)
> $$
>
> 意味着 $p$ 和 $p'$ 离得太近（冗余，可以通过 $p'$ 快速到达 $p$），则 **剔除 $p$**。
>
> 参数 $\alpha \geq 1$ 越大，允许保留的边越长（修的捷径越多），图的鲁棒性越强。

#### 4.1.3 DiskANN 性能特性（卡车 vs 赛车）

如果说 HNSW 是 **“F1 赛车”（极速但昂贵）**，那么 DiskANN 就是 **“重型卡车”（能装且经济）**。

- **HNSW**：为了追求亚毫秒级的极致速度，必须把所有东西（图 + 向量）都塞进昂贵的内存里，就像赛车为了速度不惜一切成本。
- **DiskANN**：为了装下 10 亿级的数据，巧妙地利用了廉价的 SSD。虽然速度稍慢（几毫秒），但 **“载货量”** 是 HNSW 的几十倍，且成本极低。

| 特性         | 数值              | 说明           |
| ------------ | ----------------- | -------------- |
| **数据规模** | 10 亿+ 向量       | 存储在 SSD 上  |
| **内存占用** | 约 8-16 字节/向量 | 仅存储 PQ 编码 |
| **搜索延迟** | 1-5 毫秒          | 95%+ 召回率    |
| **索引构建** | 数小时（十亿级）  | 可并行构建     |

**DiskANN vs. HNSW**：

| 维度     | HNSW (F1 赛车) | DiskANN (重型卡车)          |
| :------- | :------------- | :-------------------------- |
| **存储** | 全部在内存     | 图+全向量在 SSD，压缩在内存 |
| **内存** | ~100 字节/向量 | ~10 字节/向量 (**1/10**)    |
| **延迟** | 亚毫秒 (<1ms)  | 毫秒级 (1-5ms)              |
| **召回** | 极高 (99%+)    | 高 (95%+)                   |
| **规模** | <1 亿向量      | **1-100 亿向量**            |

### 4.2 ScaNN：Google 的高效向量搜索

#### 4.2.1 算法核心（各向异性）

如果说传统 PQ 是追求完美的 **“照相机”**（力求画面与原物分毫不差），那么 ScaNN 就是懂考试的 **“押题王”**。

**ScaNN (Scalable Nearest Neighbors)** 是 Google 提出的高效算法，其杀手锏是 **各向异性向量量化（Anisotropic Vector Quantization）**。

简单来说，它打破了传统算法对待误差“众生平等”的执念，**有策略地“忽视”了对内积计算影响不大的垂直方向上的量化误差**，从而在关键的平行方向保留了极高的精度。

```mermaid
graph LR
    subgraph "ScaNN: 三阶段量化"
        direction LR
        Query[查询] --> P[1. 分区筛选<br/>Partitioning]
        P --> |"选 Top-N 分区"| Q[2. 各向异性量化<br/>Anisotropic VQ]
        Q --> |"快速算分"| R[3. 精确重排<br/>Rescoring]
        R --> |"Top-K"| Result[最终结果]
    end

    style Q fill:#e6f7ff,stroke:#1890ff,color:#000
    style R fill:#fff7e6,stroke:#fa8c16,color:#000
```

- **传统 PQ (照相机)**：试图最小化 **重构误差**（几何距离）。它“公平”地优化所有分量，无论这个分量对最终得分有没有用。
- **ScaNN (押题王)**：试图最小化 **内积误差**（最终得分）。它意识到，**只有和查询 $q$ 平行的分量**才影响最终得分。因此，它 **“偏心”** 地容忍在垂直方向（对得分无影响）上有较大误差，从而把宝贵的精度全部分配给对得分影响最大的方向。

**结果**：这种 **“有的放矢”** 的策略，让 ScaNN 在同等压缩率下，排序精度吊打传统 PQ。

**数学直觉**：

- 传统 PQ 优化目标：$\min \sum \|v - \tilde{v}\|^2$ （让 $\tilde{v}$ 在空间上接近 $v$）
- ScaNN 优化目标：$\min \sum (\langle q, v \rangle - \langle q, \tilde{v} \rangle)^2$ （让 $\tilde{v}$ 的内积得分接近 $v$）

#### 4.2.2 Anisotropic VQ（手影戏原理）

为了理解“各向异性”和“内积优化”的关系，最贴切的类比是 **手影戏**。

我们的目标是用手势在墙上 **投影** 出一只逼真的 **“老鹰”**（获得精准的内积得分）。

- **传统 PQ (死板的雕塑家)**：它认为 **手必须真的长得像老鹰**。它试图在三维空间里把手“整容”成老鹰的样子。因为手的结构限制（码本有限），“整容”后的手必然四不像，投影出来的影子自然也模糊不清。
- **ScaNN (聪明的手影师)**：它意识到 **只要墙上的“影子”像老鹰就行**，手长什么样根本不重要。
  - **策略**：它允许手在 **光线照射的方向**（垂直方向/观察者看不到的死角）上随意扭曲、变形。
  - **魔法**：它把所有的“误差”和“不像”，统统藏在了 **光线看不到的深度方向** 里。

**结果**：虽然你的手看起来奇形怪状（重构误差很大），但墙上的影子却栩栩如生（内积排序精度极高）。

```mermaid
graph LR
    subgraph "传统 PQ: 3D 模仿"
        direction LR
        H1[🖐️ 手] --> |"死磕 3D 形状<br/>(所有方向都学)"| E1[🦅 3D 雕塑鹰]
        E1 --> |"投影"| S1[❓ 模糊的影子]
    end

    subgraph "ScaNN: 2D 投影"
        direction LR
        H2[🖐️ 手] --> |"只学 2D 轮廓<br/>(误差藏在光线里)"| E2[👌 奇怪的手势]
        E2 --> |"投影"| S2[✅ 完美的鹰影]
    end

    style S2 fill:#d9f7be,stroke:#52c41a,color:#000
```

#### 4.2.3 ScaNN 性能基准（速读冠军）

得益于这套聪明的评分系统（各向异性量化），ScaNN 在处理向量搜索时，就像一位 **“速读冠军”** 参加阅卷：

- **速度极快**：一眼扫过试卷就能打分（单核 QPS 破 3 万），比死抠字眼（计算全几何距离）的传统考官快好几倍。
- **眼光毒辣**：虽然读得快，但对好学生（Top-K）是一个不漏（召回率 95%+）。

根据官方基准测试<sup>[[17]](#ref17)</sup>：

| 数据集         | 向量数 | 维度 | QPS（单线程） | 召回率 |
| -------------- | ------ | ---- | ------------- | ------ |
| **SIFT-1M**    | 100 万 | 128  | **50,000+**   | 95%    |
| **GIST-1M**    | 100 万 | 960  | **10,000+**   | 95%    |
| **GloVe-1.2M** | 120 万 | 100  | **30,000+**   | 95%    |

### 4.3 GPU 加速索引

#### 4.3.1 GPU IVF 系列（人海战术）

如果说 CPU 是 **“几位数学教授”**（擅长复杂逻辑，但核心少），那么 GPU 就是 **“成千上万的小学生”**（擅长简单计算，但人多势众）。

Faiss 利用 GPU 的这种 **大规模并行能力**，将 IVF 索引中海量的距离计算任务分配给成千上万个核心同时处理，从而实现了 **几十倍** 的速度提升<sup>[[18]](#ref18)</sup>。

| 索引类型         | 描述               | QPS 提升 | 显存需求              |
| ---------------- | ------------------ | -------- | --------------------- |
| **GPU_IVF_FLAT** | GPU 加速的 IVFFlat | 10-50x   | 存储全向量 (高显存)   |
| **GPU_IVF_PQ**   | GPU 加速的 IVFPQ   | 5-20x    | 存储 PQ 编码 (低显存) |
| **GPU_IVF_SQ8**  | GPU 加速的标量量化 | 10-30x   | 存储 INT8 向量 (中等) |

#### 4.3.2 CAGRA：NVIDIA 的图索引（无人机蜂群）

以往认为图搜索逻辑复杂（需要频繁跳转），只适合 CPU。但 NVIDIA 的 **CAGRA (Cuda Accelerated GRAph-based index)** 打破了这一刻板印象<sup>[[18]](#ref18)</sup>。

如果说 CPU HNSW 是身手敏捷的 **“跑酷高手”**，那么 GPU CAGRA 就是铺天盖地的 **“无人机蜂群”**。

```mermaid
graph LR
    subgraph GPU ["🛸 GPU CAGRA: 无人机蜂群 (并行)"]
        direction LR
        Q_Batch["Query Batch<br/>(1000+ 个查询)"] --> |"饱和式覆盖"| GP((GPU Cores))
        GP --> |"瞬时完成"| R_Batch["Result Batch"]
    end

    subgraph CPU ["🏃 CPU HNSW: 跑酷高手 (串行)"]
        direction LR
        Q1[Query 1] --> |"精细规划路径"| N1((逐个跳跃))
        N1 --> R1[Result 1]
    end

    style Q_Batch fill:#76b900,stroke:#fff,color:#000
    style GP fill:#e6f7ff,stroke:#1890ff,color:#000
```

- **CPU HNSW (跑酷高手)**：单兵作战，反应极快。适合为 **单个用户** 带路，能瞬间做出判断找到终点（追求极致 **低延迟**）。
- **GPU CAGRA (无人机蜂群)**：集团作战，吞吐惊人。适合 **成千上万个用户** 同时问路，虽然启动稍微慢一些，但能一口气处理海量请求（追求极致 **高吞吐**）。

**CAGRA vs. CPU HNSW**：

| 维度         | CPU HNSW (跑酷高手) | GPU CAGRA (无人机蜂群) |
| :----------- | :------------------ | :--------------------- |
| **单次延迟** | **极低** (1ms)      | 较低 (1-5ms)           |
| **吞吐量**   | 一般 (1k-10k QPS)   | **恐怖** (100k+ QPS)   |
| **硬件成本** | 高内存 CPU 服务器   | GPU 服务器             |
| **最佳战场** | 实时搜索、小并发    | **推荐系统、大并发**   |

---

## 5. 相似度的度量（一尺丈量万物）

相似度的度量方式决定了我们眼中的“相似”究竟意味着什么。正确的相似度度量对向量搜索结果有着决定性影响。选择正确的 **“尺子”**（度量方式）往往比选择算法更重要。

### 5.1 L2 Distance（直尺测量）

#### 5.1.1 核心直觉

**L2 Distance（欧几里得距离）** 就像是用一把 **“直尺”** 连接两点，量出的 **绝对直线距离**。

- **关注点**：**“位置的绝对差异”**。
- **类比**：就像**量体裁衣**。不管衣服的款式（方向）多么相似，只要肩宽、袖长等**尺寸数据（坐标值）**相差很大，这件衣服穿在身上就是“不合身”（距离远）。L2 关注的是**数值的绝对吻合度**。

> [!NOTE]
>
> **数学定义**<sup>[[19]](#ref19)</sup>
>
> $$
>     d_{L2}(a, b) = \sqrt{\sum_{i=1}^{d}(a_i - b_i)^2} = \|a - b\|_2
> $$

#### 5.1.2 几何意义

```mermaid
graph LR
    subgraph "L2 几何意义: 多维差异聚合"
        direction LR
        A("点 A (x=1, y=1)")
        B("点 B (x=4, y=5)")

        A -- "Δx (维度 x 差异) = 3" --> B
        A -- "Δy (维度 y 差异) = 4" --> B
        A -- "📏 L2 距离 = √(3²+4²) = 5" --- B

        linkStyle 0 stroke-dasharray: 5 5,color:#fff
        linkStyle 1 stroke-dasharray: 5 5,color:#fff
        linkStyle 2 stroke-width:3px,stroke:#1890ff,color:#1890ff
    end
```

#### 5.1.3 特性与应用

| 特性/场景    | 说明                                                                       |
| :----------- | :------------------------------------------------------------------------- |
| **尺度敏感** | **对数值大小极其敏感**。如 `(1,1)` 和 `(100,100)` 距离很远，哪怕方向相同。 |
| **维度诅咒** | 在高维空间中，点与点之间的距离趋于均匀，区分度下降。                       |
| **适用场景** | **物理位置**（地图）、**图像像素差异**（找茬）、**聚类分析**（K-Means）。  |

```python
def euclidean_distance(a, b):
    # 直观：平方和开根号
    return np.sqrt(np.sum((a - b) ** 2))
```

### 5.2 Cosine Similarity（量角器测量）

#### 5.2.1 核心直觉

如果 L2 是用“尺子”量距离，那么 **余弦相似度** 就是用 **“量角器”** 测角度。

- **关注点**：**“方向的一致性”**（忽略“长短”）。
- **类比**：就像 **两人指月**。
  - 一个是手臂长的大人（向量模长很大），一个是手臂短的小孩（向量模长很小）。
  - 只要他们都指向同一个月亮（夹角为 0），余弦相似度就是 **100%**。
  - **L2 距离** 会认为这两人差别很大（手臂长度差太多），而 **余弦** 认为他们完全一样（关注点相同）。

> [!NOTE]
>
> **数学定义**<sup>[[19]](#ref19)</sup>：
>
> $$
>     \cos(\theta) = \frac{a \cdot b}{\|a\| \cdot \|b\|} = \frac{\sum_{i=1}^{d} a_i \cdot b_i}{\sqrt{\sum_{i=1}^{d} a_i^2} \cdot \sqrt{\sum_{i=1}^{d} b_i^2}}
> $$
>
> **余弦距离**是相似度的补充：
>
> $$
>     d_{\cos}(a, b) = 1 - \cos(\theta)
> $$

#### 5.2.2 几何意义

```mermaid
graph TB
    subgraph "Cosine: 关注夹角"
        O((原点))
        A((向量 A <br/> Short))
        B((向量 B <br/> Long))
        Q((向量 Q <br/> Short))

        O --> A
        O --> B
        O --> Q

        linkStyle 0 stroke:#1890ff,stroke-width:2px;
        linkStyle 1 stroke:#52c41a,stroke-width:4px;
        linkStyle 2 stroke:#52c41a,stroke-width:2px;

        %% Label: Q and B have different lengths but same direction
        Q -.- |"方向相近 (Sim=0.8)"| B
    end
```

#### 5.2.3 特性与应用

| 特性/场景      | 说明                                                                        |
| :------------- | :-------------------------------------------------------------------------- |
| **尺度无关性** | **对长度不敏感**。长文章和短摘要，只要主题（方向）一致，相似度就高。        |
| **范围直观**   | $[-1, 1]$。`1`=方向相同，`0`=毫无关系（正交），`-1`=完全相反。              |
| **高维友好**   | 在高维空间表现稳定                                                          |
| **适用场景**   | **语义搜索**（文本匹配）、**推荐系统**（用户兴趣方向）、**NLP**（词向量）。 |

```python
def cosine_similarity(a, b):
    # 点积除以模长积
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    return dot_product / (norm_a * norm_b)
```

### 5.3 Dot Product / Inner Product（有效做功）

#### 5.3.1 核心直觉

如果说余弦只看 **“方向（质）”**，那么 **点积** 就是兼顾 **“质与量”** 的综合指标。

- **关注点**：同时衡量 **“方向的一致性”** 和 **“本身模长的大小”**。
- **类比**：就像 **推车做功**。
  - **方向**：你推的方向准不准？（与目标是否一致）
  - **力度**：你用的力气大不大？（向量的模长）
  - **点积**：**你对车前进的实际贡献量**。只有 **方向对** 且 **力气大**，点积才会最大。

这在 **推荐系统** 中极具价值：我们既希望推荐的内容 **匹配用户兴趣**（方向对），又希望推荐的内容 **本身质量高/热度高**（模长大）。

> [!NOTE]
>
> 数学定义<sup>[[19]](#ref19)</sup>
>
> **点积**（内积）直接计算两个向量对应元素的乘积之和：
>
> $$
>     \langle a, b \rangle = a \cdot b = \sum_{i=1}^{d} a_i \cdot b_i
> $$
>
> **与余弦相似度的关系**：
>
> $$
>     a \cdot b = \|a\| \cdot \|b\| \cdot \cos(\theta)
> $$
>
> **关键洞察**：
>
> - 当向量 **已归一化**（$\|a\| = \|b\| = 1$）时，点积 **等于** 余弦相似度
> - 当向量 **未归一化** 时，点积同时考虑方向和长度

#### 5.3.2 几何意义

**点积的几何本质** 是 **“投影与放大”**。

$$
    A \cdot B = \underbrace{(|A| \cos \theta)}_{\text{A 在 B 上的投影}} \times \underbrace{|B|}_{\text{B 的长度}}
$$

它衡量了 **向量 A 在向量 B 方向上“积累”了多少有效贡献**。

```mermaid
graph LR
    subgraph "点积物理图解: 推车做功"
        direction LR
        O((起点))
        Push((推力 F))
        Car((车位移 S))
        Effective((有效推力))

        O --> |"💪 推力 F (手臂方向)"| Push
        O ==> |"🚗 车位移 S (前进方向)"| Car

        Push -.- |"浪费的力 (垂直做无用功)"| Effective
        O == "⚡️ 有效推力 (F·cosθ)" ==> Effective

        linkStyle 0 stroke:#1890ff
        linkStyle 1 stroke:#52c41a,stroke-width:3px
        linkStyle 3 stroke:#fa8c16,stroke-width:3px
        style Effective size:0,opacity:0
    end
```

#### 5.3.3 特性与应用

点积最大的特性是 **“对强度的奖励”**（Scale Sensitive）。

- **类比**：**“带货能力”**。
  - **方向（匹配度）**：产品是否符合粉丝口味？
  - **模长（影响力）**：博主本身的粉丝基数大不大？
  - **结果**：**大 V（长向量）** 带对了货，成交额（点积）会远远高于小博主。在推荐系统中，这意味着点积能天然地把 **热门/高质量** 的内容排在前面。

| 特性/场景    | 说明                                                                            |
| :----------- | :------------------------------------------------------------------------------ |
| **赢家通吃** | **模长敏感**。长向量（高热度 Item）更容易获得高分，天然适合做排序（Ranking）。  |
| **计算极速** | **最简单的运算**。纯加乘，无开方、无除法，能极大利用 CPU/GPU 的 SIMD 指令加速。 |
| **核心战场** | **推荐系统**（兼顾兴趣与质量）、**注意力机制**（Transformer 的 $Q K^T$）。      |

```python
def dot_product(a, b):
    # 简单粗暴，速度最快
    return np.dot(a, b)

# 归一化后的点积 = 余弦相似度
def normalized_dot_product(a, b):
    a_norm = a / np.linalg.norm(a)
    b_norm = b / np.linalg.norm(b)
    return np.dot(a_norm, b_norm)
```

### 5.4 Manhattan Distance / L1 Distance（出租车路径）

#### 5.4.1 核心直觉

如果说 L2 是 **“直升机航线”**（两点间直飞），那么 **L1 (曼哈顿距离)** 就是 **“出租车路径”**。

- **场景**：在一个规划整齐的棋盘式城市（如曼哈顿街区），司机不能穿墙而过（走对角线）。
- **计算**：必须沿着街道拐弯抹角。距离 = **横向走的街区数 + 纵向走的街区数**。
- **意义**：它是所有维度差异的 **简单累加**，没有任何“平方放大”效应，这让它对 **异常值（Outliers）** 不那么敏感（鲁棒性更强）。

> [!NOTE]
>
> 数学定义<sup>[[19]](#ref19)</sup>
>
> **曼哈顿距离**（也称 L1 距离、城市街区距离）计算两点之间沿坐标轴的绝对差值之和：
>
> $$
>     d_{L1}(a, b) = \sum_{i=1}^{d} |a_i - b_i| = \|a - b\|_1
> $$

#### 5.4.2 几何意义

```mermaid
graph TB
    subgraph "曼哈顿距离 vs. 欧几里得距离"
        A["点 A (0,0)"] --> |"L1: |3|+|4|=7"| B["点 B (3,4)"]
        A --> |"L2: √(9+16)=5"| B
    end

    style A fill:#ffe58f,color:#000000
    style B fill:#b7eb8f,color:#000000
```

#### 5.4.3 特性与应用（公平判罚）

L1 与 L2 最大的区别在于对错误的 **“惩罚机制”**。

- **L2 (严厉老师)**：通过 **平方** 放大错误。哪怕只在一个维度上偏离很远（异常值），距离就会爆炸式增长（$10^2=100$）。
- **L1 (公平老师)**：按 **绝对值** 累加。错多少计多少，不额外惩罚严重错误（$10=10$）。

这使得 L1 在处理 **高维稀疏数据**（如文本关键词，只有少数维度有值）时，比 L2 更稳健，不容易被个别极端值带偏。

```mermaid
xychart-beta
    title "惩罚对比：L2(陡峭曲线) vs L1(平缓直线)"
    x-axis "单维度误差大小" [1, 2, 3, 4, 5]
    y-axis "计算出的距离贡献" 0 --> 25
    line [1, 4, 9, 16, 25]
    line [1, 2, 3, 4, 5]
```

| 特性/场景      | 说明                                                                     |
| :------------- | :----------------------------------------------------------------------- |
| **鲁棒性**     | **对异常值不敏感**。适合数据噪声较大，或不希望少数极端值主导结果的场景。 |
| **稀疏性友好** | 在高维稀疏向量（如 TF-IDF）中，L1 往往比 L2 能更好地保持区分度。         |
| **核心战场**   | **高维稀疏数据**（文本分类）、**城市路径规划**。                         |

```python
def manhattan_distance(a, b):
    # 绝对值求和
    return np.sum(np.abs(a - b))
```

### 5.5 汉明距离（Hamming Distance）

#### 5.5.1 数学定义

**汉明距离** 计算两个等长序列中对应位置不同元素的数量<sup>[[25]](#ref25)</sup>：

$$
d_H(a, b) = \sum_{i=1}^{d} \mathbf{1}[a_i \neq b_i]
$$

其中 $\mathbf{1}[\cdot]$ 是指示函数，当条件为真时返回 1，否则返回 0。

#### 5.5.2 二进制向量的高效计算

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

#### 5.5.3 特性分析

| 特性         | 描述                       |
| ------------ | -------------------------- |
| **离散度量** | 仅适用于离散/二进制数据    |
| **等长要求** | 输入序列必须等长           |
| **极速计算** | 二进制向量可用硬件指令加速 |
| **范围**     | $[0, d]$，d 为向量维度     |

#### 5.5.4 适用场景

- **二进制哈希码**：SimHash、LSH 的快速比较
- **纠错编码**：检测传输错误的位数
- **DNA 序列比对**：基因突变检测
- **文档去重**：快速识别近似重复

### 5.6 Jaccard 相似度（Jaccard Similarity）

#### 5.6.1 数学定义

**Jaccard 相似度**（也称 Jaccard 系数）衡量两个集合的交集与并集之比<sup>[[26]](#ref26)</sup>：

$$
J(A, B) = \frac{|A \cap B|}{|A \cup B|} = \frac{|A \cap B|}{|A| + |B| - |A \cap B|}
$$

**Jaccard 距离** 是其补集：

$$
d_J(A, B) = 1 - J(A, B)
$$

#### 5.6.2 几何意义

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

#### 5.6.3 MinHash 加速

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

#### 5.6.4 特性分析

| 特性         | 描述                     |
| ------------ | ------------------------ |
| **集合度量** | 适用于集合或二进制向量   |
| **对称性**   | $J(A,B) = J(B,A)$        |
| **忽略缺失** | 不考虑两者都为 0 的维度  |
| **范围**     | $[0, 1]$，1 表示完全相同 |

#### 5.6.5 适用场景

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

    style L2 fill:#91d5ff,color:#000000
    style COS fill:#b7eb8f,color:#000000
    style DOT fill:#ffd591,color:#000000
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

    style USE_DOT fill:#52c41a,color:#000000
    style USE_COS fill:#1890ff,color:#000000
    style USE_L2 fill:#91d5ff,color:#000000
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

    style POST fill:#ffd591,color:#000000
    style PRE fill:#91d5ff,color:#000000
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
---
config:
    xyChart:
        width: 800
        height: 400
        xAxis:
            titlePadding: 10
            labelPadding: 5
        yAxis:
            titlePadding: 10
            labelPadding: 5
---
xychart-beta
    title "HNSW 性能调优：召回率 vs QPS"
    x-axis "Recall (%)" [85, 95, 99, 99.5]
    y-axis "QPS (查询/秒)" 0 --> 55000
    line [50000, 20000, 5000, 1500]
```

> [!TIP] 关键权衡点
>
> - **Recall 85%**: 飞一般的速度 (ef=10)
> - **Recall 95%**: 最佳性价比 (ef=50)，推荐起点
> - **Recall 99%**: 为最后 4% 的精度付出 4 倍性能代价 (ef=200)
> - **Recall 99.5%**: 边际收益递减极快 (ef=500)
>
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

## 2. 向量索引概览

### 2.1 构建与使用

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'darkMode': true, 'mainBkg': '#1f2937', 'textColor': '#000000', 'lineColor': '#000000', 'signalColor': '#000000', 'noteBkgColor': '#374151', 'noteTextColor': '#ffffff', 'actorBkg': '#1f2937', 'actorBorder': '#000000', 'actorTextColor': '#ffffff'}}}%%
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

> [!NOTE]
>
> **通俗案例：图书馆找书**
>
> 上述过程可以类比为图书馆的管理：
>
> 1.  **索引构建（新书上架）**：
>     管理员拿到一本新书《三体》（插入向量），并不仅仅是把它扔进仓库（存储），而是会提取它的分类号（计算索引），然后把它放到“科幻小说区”的特定书架上（更新索引结构），以便日后查找。
> 2.  **查询阶段（读者借书）**：
>     读者问：“有没有关于外星文明的书？”（搜索请求）。管理员不会从第一本书翻到最后一本（暴力搜索），而是直接走到“科幻区”（ANN 搜索，缩小范围），拿出几本最相关的书（候选向量），最后把最符合读者要求的那本递给他（返回 Top-K）。

### 2.2 向量索引算法概览

向量索引（Vector Index）是向量数据库的核心组件，决定了搜索效率和召回质量。主流索引算法可分为以下几类<sup>[[8]](#ref8)</sup>：

```mermaid
%%{init: {'theme': 'dark'}}%%
graph LR
    subgraph "向量索引分类"
        direction LR
        ROOT[向量索引算法]

        %% 左侧分支 (Left Side)
        TREE[基于树的索引] --- ROOT
        HASH[基于哈希的索引] --- ROOT

        %% 左侧叶子 (Leaves extend to left)
        KD[KD-Tree] --- TREE
        BALL[Ball-Tree] --- TREE
        ANNOY[Annoy] --- TREE

        LSH[LSH] --- HASH
        MINHASH[MinHash] --- HASH

        %% 右侧分支 (Right Side)
        ROOT --- QUANT[基于量化的索引]
        ROOT --- GRAPH[基于图的索引]

        %% 右侧叶子 (Leaves extend to right)
        QUANT --- PQ[Product Quantization]
        QUANT --- SQ[Scalar Quantization]
        QUANT --- OPQ[Optimized PQ]

        GRAPH --- NSW[NSW]
        GRAPH --- HNSW[HNSW]
        GRAPH --- VAMANA[Vamana/DiskANN]
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

### 2.3 向量类型分类

| 向量类型             | 描述                     | 存储效率      | 精度 | 典型应用              |
| -------------------- | ------------------------ | ------------- | ---- | --------------------- |
| **Dense Vector**     | 密集向量，所有维度有值   | 中            | 高   | 文本/图像嵌入         |
| **Sparse Vector**    | 稀疏向量，大部分维度为零 | 高            | 高   | TF-IDF、BM25          |
| **Binary Vector**    | 二值向量，仅含 0/1       | 极高（1-bit） | 低   | SimHash、局部敏感哈希 |
| **Quantized Vector** | 量化向量，压缩表示       | 高            | 中   | PQ 编码向量           |

### 2.4 向量数值精度

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

---

## 9. 选型建议与场景化方案

### 9.1 决策框架

```mermaid
flowchart TD
    START[向量数据库选型] --> Q1{数据规模？}

    Q1 --> |"< 100 万"| SMALL[小规模]
    Q1 --> |"100 万 - 10 亿"| MEDIUM[大规模]
    Q1 --> |"> 10 亿"| LARGE[海量]

    SMALL --> Q2{已有 PostgreSQL？}
    Q2 --> |是| PGV[pgvector/VectorChord]
    Q2 --> |否| Q3{需要托管服务？}
    Q3 --> |是| PINECONE[Pinecone Free]
    Q3 --> |否| EMBEDDED[Milvus Lite / Chroma]

    MEDIUM --> Q4{运维能力？}
    Q4 --> |强| SELF[Milvus / Qdrant 自托管]
    Q4 --> |弱| MANAGED[Zilliz Cloud / Pinecone]

    LARGE --> Q5{预算？}
    Q5 --> |不限| CLOUD[全托管云服务]
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

<a id="ref7"></a>[7] Writer, "What is a vector database?" _Writer AI Glossary_, 2024. [Online]. Available: https://www.ai21.com/glossary/foundational-llm/vector-database/

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
