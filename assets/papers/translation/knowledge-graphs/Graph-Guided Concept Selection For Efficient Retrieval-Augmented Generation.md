# 基于图引导概念选择的高效检索增强生成

**作者**: Ziyu Liu†, Yijing Liu†, Jianfei Yuan, Minzhi Yan, Le Yue, Honghuai Xiong, Yi Yang∗
**机构**: 华为云计算技术有限公司，中国
**邮箱**: {liuziyu16,liuyijing5,yuanjianfei,yanminzhi}@huawei.com
{yuele,xionghonghuai,yangyi104}@huawei.com

## 摘要

基于图的检索增强生成（Graph-based RAG）从文本块构建知识图（KG），以增强基于大语言模型（LLM）的问答系统中的检索效果。它在生物医学、法律和政治科学等领域特别有益，因为在这些领域中，有效的检索通常涉及对私有文档的多跳推理。然而，这些方法需要大量LLM调用来从文本块中提取实体和关系，在大规模应用中产生高昂的成本。通过精心设计的消融研究，我们观察到某些词语（称为概念）及其相关文档更为重要。基于这一洞察，我们提出了图引导概念选择（Graph-Guided Concept Selection, G2ConS）。其核心包括一个文本块选择方法和一个独立于LLM的概念图。前者选择显著的文档块以降低KG构建成本；后者以零成本填补文本块选择引入的知识空白。在多个真实世界数据集上的评估表明，G2ConS在构建成本、检索有效性和回答质量方面都优于所有基线方法。

## 1 引言

检索增强生成（RAG）使大语言模型能够访问最新或特定领域的信息，显著提高其问答（QA）性能而无需额外训练（Gao et al., 2023a;b; Fan et al., 2024）。一个代表性的方法是Text-RAG（Lewis et al., 2020），它依赖于文档分块和密集检索。然而，这种方法忽略了知识间的相互依赖关系，在多跳问题上导致明显的准确性下降（Peng et al., 2024）。为了解决这一限制，最近基于图的RAG（GraphRAG）技术预先构建一个图来捕获这些依赖关系，在复杂QA场景中显著提升了RAG的准确性（Procko & Ochoa, 2024; Jimenez Gutierrez et al., 2024; Edge et al., 2024）。在法律、医学和科学等专业领域，GraphRAG已被证明能显著增强大模型的问答能力（Li et al., 2024a; Delile et al., 2024; Liang et al., 2024）。

GraphRAG中的一个核心步骤是在文档和知识之间建立连接；然而，高昂的构建成本阻碍了这些方法在真实世界应用中的部署（Abane et al., 2024; Wang et al., 2025）。例如，Microsoft-GraphRAG（MS-GraphRAG）（Edge et al., 2024）处理单个5GB法律案例（Arnold & Romero, 2022）估计成本为33,000美元（Huang et al., 2025b）。这种昂贵成本对于企业级知识检索系统来说是不可接受的，无论是初始构建还是后续更新。为了降低构建成本，最近的研究限制了图结构以减少LLM调用次数：LightRAG（Guo et al., 2024）采用键值模式，HiRAG（Huang et al., 2025a）和ArchRAG（Wang et al., 2025）采用树状结构，其中关键思想是通过单次LLM调用来总结多个文本块。其他方法则采用更粗粒度的图构建来减少LLM依赖；Raptor（Sarthi et al., 2024）利用向量模型构建层次集群，KET-RAG（Huang et al., 2025b）引入了实体-文档二分图。

虽然这些方法降低了构建开销，但仍然存在两个主要挑战：（1）当前方法通过重新设计流程来解决成本问题，限制了其改进的通用性。此外，在许多应用中，重新设计现有GraphRAG系统并从头构建的成本过高且不切实际。（2）图结构的限制不可避免地牺牲了准确性：LightRAG的键值设计限制了检索深度，而HiRAG和ArchRAG的自顶向下搜索策略难以找到直接相关的实体。

**图1：概念删除实验的设计和结果。（a）我们根据相关词语将文本块划分为不同组，称为概念。（b）通过以不同顺序删除概念，我们发现某些概念具有更大的重要性。**

为了解决上述两个挑战，我们提出了图引导概念选择（G2ConS），这是一种与主流GraphRAG方法兼容的高效RAG方案。我们的方法从称为概念删除的消融研究开始，该研究调查了不同知识对Graph RAG的重要性。如图1（a）所示，我们首先按概念划分知识，其中概念定义为一个词语以及包含该词语的所有文本块。划分后，原始知识文档可以视为多个概念的组合。通过概念删除，即根据组删除文本块，我们能够识别不同知识成分（以概念为索引）的贡献。作为一个合理的假设，我们声称与其他概念有更多连接的概念具有更大的重要性。为了说明这一点，我们首先在MuSiQue数据集（Trivedi et al., 2022）上构建概念关系图：我们使用传统关键词提取方法（Ramos et al., 2003）从文本块中提取概念，然后连接在同一文本块中共现的概念。最后，我们按度对概念进行排序，其中排名较高的概念表示与其他概念的连接性更强。我们使用MS-GraphRAG进行概念删除，结果如图1（b）所示，其中x轴表示删除的token数量，y轴表示相应的准确性（EM分数）。我们评估了两种删除策略：前向删除（从最高排名到最低排名删除概念）和后向删除（从最低排名到最高排名删除概念）。为了比较，我们还展示了MS-GraphRAG在所有文本块情况下的性能，即图中的"基线"。结果表明，即使token数量相等，删除高排名概念仍会导致更大的性能下降。基于这一观察，G2ConS提出了两个有效策略。1. 对于第一个挑战，我们引入核心文本块选择，通过删除低排名概念来减少输入文本块，从而在不修改图构建过程的情况下降低构建成本。2. 对于第二个挑战以及文本块选择引入的知识空白，我们提出了概念图检索。由于概念图的构建不依赖于LLM且不施加结构约束，它能够以低成本有效地检索被删除的低排名概念。

该工作的主要贡献如下：

* 我们提出了G2ConS，这是一种高效的GraphRAG方案，从KG和独立于LLM的概念图进行检索。G2ConS有效平衡了构建成本和QA性能，在多个基准测试中优于最先进的方法，特别是在MuSiQue的多个指标上平均实现31.44%的改进。
* 我们引入了核心文本块选择，这是一种以最小精度损失降低GraphRAG构建成本的通用方法。结合概念图，现有GraphRAG方法可以在降低成本80%的同时进一步提高QA准确性。

## 2 相关工作

### 基于图的RAG

将文档表示为图结构进行检索和问答可以追溯到Min et al. (2019)，他们提出基于共现关系从文本块构建图，并展示了明显的性能提升，从而确立了基于图的检索对QA的有效性。然而，这种方法忽略了文档间的语义链接，将知识分散在不连通的区域。随着LLM的兴起，许多工作将它们注入图构建中。KG提取方法如GraphRAG（Edge et al., 2024）、HippoRAG（Jimenez Gutierrez et al., 2024）、LightRAG（Guo et al., 2024）、KAG（Liang et al., 2024）、FastRAG（Abane et al., 2024）和GraphReader（Li et al., 2024b），提高了质量和QA准确性，但重复的LLM调用用于实体-关系提取在大规模上成本仍然过高。如RAPTOR（Sarthi et al., 2024）、HiRAG（Huang et al., 2025a）、ArchRAG（Wang et al., 2025）和MemWalker（Chen et al., 2023）等层次方法递归地将文档总结为分层索引；它们的批处理降低了构建成本，但自顶向下的检索难以找到直接相关的知识，降低了检索准确性。如AutoKG（Chen & Bertozzi, 2023）、PathRAG（Chen et al., 2025）和KGP（Wang et al., 2024）等文本级方法分割输入文本并使用LLM建立文本间或文本到实体的链接。通过避免细粒度提取，这些方法保持了与Text-RAG（Lewis et al., 2020）相当的构建成本；然而，它们在多跳问题上表现出性能下降。相比之下，G2ConS通过结合KG和概念图的混合检索策略在构建成本和QA质量方面都实现了最优性能，并且它与主流GraphRAG方法兼容。

### 高效KG-based RAG

KG的构建已被证明能显著提升RAG在多跳推理任务上的性能（Peng et al., 2024）。然而，KG构建的高成本是实际部署的主要障碍。为了解决这个问题，各种方法试图简化KG构建过程。例如，LightRAG（Guo et al., 2024）将复杂节点网络简化为键值表，而HiRAG（Huang et al., 2025a）和ArchRAG（Wang et al., 2025）构建树状KG以减少LLM调用次数。尽管如此，这些方法通常由于对KG的结构约束而在多跳任务上遭受准确性降低。另一系列工作探索使用粗粒度图通过轻量级命名实体识别（NER）技术来降低KG构建成本。例如，Ket-RAG（Huang et al., 2025b）将二分图与知识图结合以降低总体构建开销。E2GraphRAG（Zhao et al., 2025）引入了基于LLM生成的摘要树构建的粗粒度实体-文档块图，从而消除了对高质量KG的依赖。与这些方法相比，G2ConS强调图构建中的概念选择，并与主流GraphRAG方法兼容，在成本效率和性能上都产生一致的改进。

## 3 G2ConS框架

在本节中，我们首先提供GraphRAG的问题表述。然后我们介绍概念图的构建过程，以及G2ConS两个关键策略的实施细节：核心文本块选择和双路径检索。

### 3.1 问题定义

为了更好地说明GraphRAG旨在解决的问题，我们从Text-RAG（Lewis et al., 2020）开始。给定文档语料库，RAG根据某种策略将文档分割成文本块。设T是从文档预处理的文本块集合。Text-RAG使用嵌入函数ϕ(·)对每个文本块进行向量化，从而构建文本块-向量对的索引：{(ti, ϕ(ti))|ti ∈T }。在检索过程中，给定查询q，Text-RAG计算查询嵌入ϕ(q)，并在文本块-向量对索引中基于向量相似性搜索最相关的文本块。最后，在答案生成阶段，这些检索到的文本块作为上下文输入LLM，LLM生成对查询q的最终答案。GraphRAG的关键区别在于它基于T构建图G = (V, E)，其中V表示节点集合——每个节点可能代表特定文本块或实体——E表示节点间的边集合，边属性可能包括权重或文本描述以表征连接节点间的关系。在检索过程中，GraphRAG主要遵循局部搜索范式：它首先使用嵌入函数ϕ(·)计算节点-查询相似性来识别与查询q最相关的节点，然后对图G执行广度优先搜索（BFS），通过遍历和收集相关邻居节点来扩展上下文。在答案生成阶段，GraphRAG将BFS识别的子图序列化并将其作为上下文输入LLM以产生最终响应。GraphRAG的目标是找到G以最大化LLM答案准确性（Jimenez Gutierrez et al., 2024; Edge et al., 2024）；在我们的工作中，我们还在G的设计上施加成本约束。

### 3.2 将概念关系表示为图

在第1节中，我们介绍了概念图对文本块选择的重要性及其构建思想。在我们的实现中，我们进一步丰富了图的结构。结果，概念图可以同时用于文本块选择和检索。

#### 概念提取和向量化

如第1节所述，我们使用传统关键词提取方法（Ramos et al., 2003）从文本块中提取概念W，即W = {Extract(ti)|ti ∈T }。对于每个wi ∈W，我们根据其来源在wi与其源文本块ti之间构建边。为了支持高效检索和模糊实体匹配，许多GraphRAG方法集成了向量化技术（Sarmah et al., 2024; Guo et al., 2024），我们遵循相同的设计原则。然而，根据概念的定义——即一个词语以及包含该词语的所有文本块；单独一个词语或文本块的嵌入不能准确表示概念。另一方面，由于文本块通常包含许多token（通常超过500个），其语义表示可能被多个概念污染。

为了解决这个问题，我们提出在句子级别为概念构建语义嵌入。具体来说，对于概念wi，我们首先识别连接到wi的所有文本块，然后使用句子分割器（Loper & Bird, 2002）将这些文本块分割成句子，产生包含wi的所有句子集合，表示为Swi。我们将wi的向量表示定义为：

```
Vector(wi) = (1/|Swi|) Σ si∈Swi ϕ(si), (1)
```

其中ϕ(·)是第3.1节介绍的嵌入函数。我们强调在句子级别定义概念嵌入能更好地捕获概念本身的内在语义，并能在检索期间实现与查询相关概念的更准确匹配。

#### 通过相关性连接概念

根据我们的概念删除实验，共现有效表征了概念的重要性。然而，在检索过程中单独依赖共现，特别是在使用BFS查找给定概念的相关概念时，往往会引入显著的噪声，即虚假相关现象（Calude & Longo, 2017）。为了缓解这个问题，在我们的实现中，概念图的边是通过联合考虑语义相关性和共现来构建的。

具体来说，给定概念wi和wj，当且仅当Sim(Vector(wi), Vector(wj)) ≥θsem且Co(wi, wj) ≥θco时存在边e(wi, wj)，其中Sim(·, ·)表示余弦相似性，Co(·, ·)计算两个概念在不同文本块中的共现频率，Vector(·)按公式1计算，θsem, θco是常数。当e(wi, wj)存在时，我们使用Dice系数（Li et al., 2019）定义边权重rwi,wj来量化两个概念之间的具体关联强度：

```
rwi,wj = 2 Co(wi,wj) / (|Twi|+|Twj|)
```

其中Twi和Twj分别表示包含wi和wj的文本块集合。总之，我们构建的概念图是一个经过语义过滤的共现图。

#### 核心文本块选择和KG构建

构建概念图后，为了更好地评估概念的全局重要性，我们选择使用PageRank（Page et al., 1999）而不是像度中心性这样的局部指标来对它们进行排序。我们注意到这个选择不影响第1节中呈现的实验结果。一旦概念被排序，我们随后根据它们关联的概念对文本块进行排序。GraphRAG方法允许根据指定比例选择核心文本块来构建KG，从而降低总体构建成本。在G2ConS中，概念图和KG共存。KG由MS-GraphRAG构建，由于它完全由核心文本块构建，我们简称为core-KG。

### 3.2.1 双路径检索和集成

虽然核心文本块选择有效降低了成本，但它不可避免地过滤掉了许多文本块。为了确保知识完整性，我们提出从概念图和core-KG两者进行检索。

#### 概念图上的局部搜索

概念图上的检索很大程度上遵循当前GraphRAG的主流设计，特别是第3.1节描述的局部搜索。关键区别在于我们引入了预算参数β来精确控制检索到的上下文token数量。给定问题q，我们首先计算其对应的向量ϕ(q)，然后计算ϕ(q)与所有概念向量之间的余弦相似性。基于这个相似性排序，我们检索top-k最相关的概念，k是常数，称为直接关联概念。随后，使用这些直接关联概念作为种子节点，我们执行BFS检索i跳概念（对于i=1,...,N），称为扩展概念。我们为这两种类型的概念采用不同的上下文构建策略：对于直接关联概念，我们按它们与ϕ(q)的相似性排序，依次检索每个概念对应的文本块，然后在将它们添加到上下文之前根据它们与ϕ(q)的相似性对这些文本块进行重新排序。我们将此过程称为局部重新排序。我们收集通过BFS发现的所有概念及其相关文本块，对整个检索到的文本块集合相对于ϕ(q)执行重新排序，然后将它们添加到上下文中，这个过程称为全局重新排序。每次将文本块添加到上下文时，我们检查累积的token计数；如果超过β，整个检索过程终止。我们省略core-KG上检索过程的细节，因为它遵循使用的GraphRAG方案，只是检索内容被截断到token预算β。我们注意到概念图和core-KG上的检索并行进行以最大化检索效率。

#### 加权上下文集成

检索后，我们实际上获得了两个上下文，每个都不超过β个token。然而，检索结果的粒度不同：概念图完全由文本块组成；core-KG结果包括实体、关系和文本块。因此，我们进一步引入组合权重λ ∈(0, 1)来设置两者之间的偏好。其次，由于两者都可能检索到重叠的文本块，我们基于投票策略为重叠文本块分配更高优先级。最后，我们根据以下原则构建最终上下文：1. 确保总token数不超过β；2. 优先保留重叠文本块；3. 概念图占用不超过(1 −λ)β个token，core-KG占用不超过λβ个token。

## 4 实验

### 4.1 实验设置

我们在三个广泛使用的多跳QA基准上评估我们的方法：MuSiQue（Trivedi et al., 2022）、HotpotQA（Yang et al., 2018）和2wikimultihopqa（citeho2020constructing）。遵循先前工作（Jimenez Gutierrez et al., 2024; Wang et al., 2024; Huang et al., 2025b），我们从每个数据集的验证集中采样500个QA对。对于每对，我们收集所有相关的支持和干扰段落来为RAG构建外部语料库T。生成的语料库包含MuSiQue的6,761个段落（741,285个token）、HotpotQA的9,811个段落（1,218,542个token）和2wikimultihopqa的6,119个段落（626,376个token）。

在评估方面，我们遵循多跳QA任务的常见实践。检索质量通过上下文召回率（Context Recall, CR）来衡量，它评估检索到的上下文是否包含真实答案。生成质量通过提示LLM基于检索到的上下文生成答案并将它们与给定答案进行比较来评估。评估指标包括精确匹配（Exact Match, EM），它衡量与真实答案完全匹配的预测比例；F1分数，它通过token级重叠捕获部分正确性；以及BERTScore，它使用基于BERT的嵌入计算语义相似性。

我们系统地评估了16种解决方案的性能，分为两组：（i）现有方法：TextRAG（Lewis et al., 2020）、MS-GraphRAG（Edge et al., 2024）、Hybrid-RAG（Sarmah et al., 2024）、HippoRAG（Jimenez Gutierrez et al., 2024）、LightRAG（Guo et al., 2024）（包括Local、Global和Hybrid变体）、Fast-GraphRAG（AI, 2024）、Raptor（Sarthi et al., 2024）和KET-RAG（Huang et al., 2025b）（包括Keyword、Skeleton和Combine变体）；（ii）提出的方法：Concept-GraphRAG（仅从Gc检索）、Core-KG-RAG（仅从Gck检索，Gck默认使用MS-GraphRAG构建，除非另有说明）、G2ConS（从Gc和Gck两者检索）。关于基线的更多细节在附录A.1中。所有解决方案共享相同的推理设置：使用OpenAI GPT-4o-mini进行生成，OpenAI text-embedding-3-small进行嵌入，使用OpenAI tiktoken cl100k base进行tokenization。我们将最大输入文本块大小设置为ℓ= 1200，所有方法的输出上下文限制设置为β = 12000。在G2ConS内部，除非另有说明，使用默认参数：θsim = 0.65, θco = 3, κ = 0.8, λ = 0.6, k = 25, N = 2。这些参数的定义总结在表1中。我们运行所有实验五次并报告平均值。

**表1：G2ConS中的关键参数**
| 符号 | 描述 |
|------|------|
| θsem | 概念图的相似性阈值 |
| θco | 概念图的共现阈值 |
| κ | 核心文本块选择比例 |
| λ | 上下文集成中core-KG的权重 |
| k | 检索的top-k项数量 |
| N | 概念图检索中BFS的深度 |

### 4.2 性能评估

我们通过在三个广泛使用的多跳QA基准（MuSiQue、HotpotQA和2WikiMultihopQA）上将G2ConS与代表性GraphRAG基线进行比较来开始我们的实证研究。基线包括Text-RAG、MS-GraphRAG、HippoRAG、LightRAG、Fast-GraphRAG和KET-RAG。表2报告了完整结果。总体而言，G2ConS在准确性和效率方面实现了最佳平衡，在显著降低计算成本的同时，在检索和生成质量方面都取得了显著提升。

**表2：在MuSiQue、HotpotQA和2WIKImultihopQA上的主要结果**

| 数据集 | 方法 | MuSiQue | | | | | HotpotQA | | | | | 2wikimultihopqa | | | | |
|--------|------|---------|----|----|----|----------|----|----|----|-------------------|----|----|----|----|
| | | USD | CR | EM | F1 | BERTScore | USD | CR | EM | F1 | BERTScore | USD | CR | EM | F1 | BERTScore |
| Text-RAG | | 0.01 | 22.2 | 4.0 | 5.4 | 63.0 | 0.02 | 75.4 | 41.8 | 53.3 | 80.0 | 0.01 | 49.8 | 20.8 | 27.8 | 71.7 |
| MS-GraphRAG | | 2.47 | 40.7 | 12.8 | 16.8 | 66.9 | 4.06 | 83.2 | 50.2 | 62.7 | 82.7 | 1.38 | 62.6 | 29.6 | 38.3 | 74.6 |
| HippoRAG | | 1.99 | 45.4 | 12.8 | 17.8 | 67.0 | 3.27 | 78.3 | 46.8 | 57.6 | 83.0 | 1.78 | 68.8 | 48.0 | 54.6 | 81.0 |
| LightRAG-Local | | 1.23 | 50.4 | 8.6 | 12.9 | 65.7 | 2.02 | 80.6 | 39.8 | 52.1 | 80.0 | 1.01 | 58.0 | 21.8 | 30.2 | 72.8 |
| LightRAG-Global | | 1.23 | 55.2 | 9.2 | 13.1 | 65.8 | 2.02 | 84.0 | 39.4 | 52.7 | 80.3 | 1.01 | 46.8 | 6.6 | 12.1 | 66.6 |
| LightRAG-Hybrid | | 1.23 | 58.2 | 9.0 | 14.9 | 66.8 | 2.02 | 88.7 | 39.4 | 53.8 | 80.7 | 1.01 | 56.6 | 19.6 | 29.1 | 72.7 |
| Fast GraphRAG | | 1.47 | 31.6 | 13.4 | 18.9 | 69.2 | 2.13 | 78.4 | 46.0 | 56.3 | 84.5 | 1.12 | 62.5 | 31.0 | 35.4 | 76.1 |
| raptor | | 1.10 | 43.1 | 9.2 | 15.1 | 67.0 | 1.81 | 75.0 | 44.4 | 55.5 | 81.7 | 0.62 | 48.0 | 29.6 | 36.7 | 75.0 |
| KET-RAG-Keyword | | 0.03 | 60.5 | 11.6 | 17.1 | 67.2 | 0.05 | 86.7 | 48.4 | 60.9 | 82.1 | 0.01 | 64.7 | 27.2 | 34.0 | 74.1 |
| KET-RAG-Skeleton | | 1.74 | 32.4 | 9.8 | 12.8 | 65.2 | 2.86 | 71.5 | 38.0 | 49.6 | 78.7 | 1.03 | 52.8 | 19.6 | 26.8 | 71.2 |
| KET-RAG | | 1.77 | 50.8 | 12.2 | 17.4 | 66.9 | 2.91 | 83.4 | 45.6 | 57.9 | 81.3 | 1.04 | 64.8 | 26.0 | 33.1 | 73.6 |
| G2ConS-Concept | | 0.01 | 68.4 | 15.0 | 24.1 | 69.9 | 0.02 | 84.7 | 48.6 | 62.4 | 82.7 | 0.01 | 62.7 | 35.8 | 44.4 | 77.6 |
| G2ConS-Core-KG | | 1.75 | 57.2 | 13.2 | 19.9 | 68.4 | 2.88 | 75.0 | 42.4 | 54.4 | 80.0 | 1.03 | 60.8 | 31.0 | 38.5 | 75.8 |
| G2ConS | | 1.76 | 71.2 | 19.8 | 29.1 | 71.7 | 2.90 | 85.5 | 51.0 | 65.1 | 83.7 | 1.04 | 70.0 | 49.6 | 55.1 | 79.9 |

在MuSiQue上，G2ConS建立了最强的整体性能。**检索**：它相对于LightRAG-Hybrid提供了明显改进（+22.3% CR）。**生成**：G2ConS相对于Fast-GraphRAG提供了显著改进（+47.8% EM / +54.0% F1），相对于MS-GraphRAG的改进更大（+54.7% EM / +73.2% F1）。**效率**：轻量级变体G2ConS-Concept总体排名第二，而运行成本仅为G2ConS的0.6%，与Text-RAG相当，突显了我们方法的可扩展性。

在HotpotQA上，G2ConS显示出依赖于数据集的性能。**生成**：它实现了最先进的结果，相对于MS-GraphRAG（+2.0% EM / +4.0% F1）和相对于HippoRAG更大的改进（+9.0% EM / +13.0% F1）。虽然相对于MS-GraphRAG的差距很小，但G2ConS的运行成本约为其构建成本的70%（降低30%），突显了卓越的成本-性能权衡。**检索**：相比之下，G2ConS落后于利用局部和全局检索的LightRAG-Hybrid，以及通过召回1000个片段来提升CR的KET-RAG-Keyword。然而，后者的优势似乎是数据集特定的，因为其在基准测试中的CR并不一致高。

在2WikiMultihopQA上，G2ConS在检索和生成方面都树立了新的最先进水平。**检索**：它略微优于HippoRAG（+2% CR），更明显地超越KET-RAG（+8% CR）。**生成**：G2ConS相对于HippoRAG实现了小但一致的改进（+3% EM / +1% F1），相对于MS-GraphRAG的显著改进（+67.6% EM / +43.9% F1）。**效率**：尽管与HippoRAG的性能接近，但G2ConS的运行成本仅为HippoRAG的58.4%（降低41.6%），并且只需要其图构建时间的5%，如图3(b)所示，突显了显著更好的效率特征。

### 4.3 与主流GraphRAG兼容性研究

为了评估G2ConS与广泛使用的工业方法的兼容性，我们选择三个代表性GraphRAG模型——LightRAG、MS-GraphRAG和HippoRAG——作为G2ConS-CoreKG索引的构建骨干。在完整文本块集合上构建G2ConS概念图后，我们应用PageRank对其重要性进行排序，并选择top 20%和80%的重要子集，然后用于知识图构建。为了说明，我们以LightRAG为例，使用100%、80%和20%的文本块分别构建三个索引：Glight100、Glight80和Glight20。在G2ConS增强设置中，来自Glight80和Glight20的局部搜索结果与从G2ConS概念图检索到的上下文结合，然后将合并的上下文输入LLM生成答案（最大输入长度为λ个token）。

**表3：有无G2ConS-Concept的GraphRAG框架对比**

| 数据集 | 方法 | MuSiQue | | | | | HotpotQA | | | | |
|--------|------|---------|----|----|----|----------|----|----|----|----|
| | | CCR(%) | EM | F1 | BERTScore | CCR(%) | EM | F1 | BERTScore |
| lightrag(100%) | | 0 | 7.2 | 12.3 | 65.8 | 0 | 37.2 | 49.8 | 79.5 |
| G2Cons-Concept+LightRAG(20%) | | 80 | 10.0 | 20.3 | 69.1 | 80 | 42.0 | 57.1 | 81.6 |
| G2Cons-Concept+LightRAG(80%) | | 20 | 13.2 | 21.8 | 69.2 | 20 | 43.0 | 59.1 | 82.1 |
| MS-GraphRAG(100%) | | 0 | 9.2 | 15.5 | 66.0 | 0 | 45.6 | 59.4 | 82.3 |
| G2Cons Concept + MS-GraphRAG(20%) | | 80 | 13.2 | 22.3 | 69.4 | 80 | 46 | 58.3 | 82.5 |
| G2Cons Concept + MS-GraphRAG(80%) | | 20 | 16.8 | 25.5 | 70.6 | 20 | 49.2 | 63.9 | 83.6 |
| HippoRAG(100%) | | 0 | 11.2 | 17.1 | 67.8 | 0 | 46.0 | 57.3 | 83.3 |
| G2Cons Concept + HippoRAG(20%) | | 80 | 12.4 | 22.4 | 69.6 | 80 | 47.2 | 61.2 | 83.2 |
| G2Cons Concept + HippoRAG(80%) | | 20 | 13.6 | 22.9 | 70.0 | 20 | 49.2 | 64.0 | 83.9 |

*CCR表示构建成本降低*

如表3所示，集成G2ConS概念图在所有三种GraphRAG方法中产生一致的改进，同时大幅减少构建开销。即使只使用20%的文本，G2ConS增强模型在EM和F1方面都优于其全文本块基线，构建成本降低约80%。当使用80%的文本时，性能增益更大，而成本仍比基线低约20%。这些结果的产生是因为G2ConS识别并保留了高度连接的概念，从而为RAG方法提供了紧凑但语义更丰富的候选段池用于图构建。双路径检索确保LLM在相同token预算内利用更丰富的上下文，从而提高准确性并降低计算成本。

### 4.4 构建时间和成本研究

为了检验不同方法如何平衡效率和准确性，我们在MuSiQue基准上评估G2ConS与六种代表性RAG方法的对比，重点关注构建成本、构建时间和性能之间的权衡。我们采用数据集范围的成本和性能中位数作为参考阈值形成二维象限空间，将方法分为四个区域。

**图3：MuSiQue上的构建开销与性能对比**

如图3(a)所示，G2ConS-Concept定义了低成本-高性能前沿，以最小开销实现领先准确性。Fast-GraphRAG也位于此象限，但成本更高，性能接近中位数。G2ConS-Core-KG位于中位数交叉点，作为平衡基线，而G2ConS占据高成本-高性能区域，在较高构建成本下表现出卓越准确性。其余方法聚集在低成本-低性能区域。在"构建时间 vs. 性能"平面（图3(b)）上，G2ConS-Concept和Core-KG再次表现出低成本-高性能优势，而G2ConS位于中等成本-高性能边界。相比之下，HippoRAG和LightRAG需要更长的构建时间。总体而言，结果突显了G2ConS系列扩展了效率-性能前沿：G2ConS-Concept适合效率敏感场景，Core-KG提供稳健平衡，G2ConS进一步推动性能上限。

### 4.5 消融研究

#### 共现粒度的影响

我们将G2ConS（当词语在文本块内共现且超过相似性阈值时构建边）与变体A（将共现限制在句子级别）进行比较。如表4所示，在MuSiQue基准上，变体A相对于G2ConS在EM上显示9.1%的下降，在F1分数上显示7.3%的下降。这表明句子级窗口过于严格，导致过于稀疏的图，错过跨句子依赖，而片段级共现更好地覆盖语义相关的词语对，产生更完整的语义图。

**表4：图构建和检索的消融研究**

| 指标 | G2ConS-Concept | A (w/o Chunk CO-occ.) | B (w/o Sem. Sim.) | C (w/o Sent. Emb.) | D (w/o LG Rerank) |
|------|----------------|------------------------|-------------------|-------------------|-------------------|
| EM | 13.2 | 12.0 | 12.4 | 0.4 | 6.4 |
| F1分数 | 21.8 | 20.2 | 20.5 | 1.63 | 14.6 |

#### 带相似性约束的边构建

我们通过比较G2ConS（片段级共现 + 相似性过滤）与变体B（片段级共现无过滤）来进一步分析相似性阈值的作用。如表4所示，G2ConS在MuSiQue基准上优于变体B。相似性阈值有效过滤掉弱相关的词语对，防止原始片段级共现产生的过于密集的图，并突显真正有意义的语义连接。

#### 向量化粒度的影响

我们还检查向量化粒度的影响，比较G2ConS（概念嵌入是所有其句子嵌入的平均值）与变体C（概念嵌入是所有其文本块嵌入的平均值）。如表4所示，变体C表现极差，EM相对于G2ConS下降97.0%，F1分数下降92.5%。这是因为片段级平均导致同一文本块内的许多词语共享几乎相同的表示，模糊了语义区别，严重降低了检索质量。

#### 重新排序级别的影响

有三种重新排序方法：局部重新排序对直接链接到top-k概念的文本块进行重新排序；全局重新排序对其N跳扩展的文本块进行重新排序；朴素重新排序将局部和全局文本块一起汇集而不加区分。我们通过比较G2ConS（局部+全局重新排序）与变体D（朴素重新排序）来检查重新排序级别的影响。如表4所示，局部+全局重新排序实现了明显更高的EM（13.2 vs. 6.4）。优势来自其更细的粒度：通过首先对概念相对于查询进行排序，然后对其相关文本块进行排序，它优先处理高度相关的内容。相比之下，朴素重新排序直接按查询相似性对所有文本块进行排序，这稀释了强信号并导致较差性能。

#### 总体分析

总之，这些消融结果表明G2ConS在图构建和重新排序中都实现了覆盖范围和稳健性之间的理想平衡。片段级共现通过捕获跨句子依赖缓解了句子级图的稀疏性；相似性阈值通过确保边的语义可靠性缓解了原始片段级共现的过度密度；句子级向量化保留了词语级区别，避免了片段级平均引起的语义坍塌。此外，区分局部和全局重新排序范围使G2ConS能够利用概念级线索而不稀释相关性，与朴素汇集形成对比。这些互补的设计选择使G2ConS能够始终优于所有变体。

### 4.6 参数研究

我们进一步检查G2ConS中两个关键参数的影响：核心文本块选择比例κ和上下文集成中core-KG的权重λ。

#### κ的影响

图4(a)报告了λ固定为0.4时变化κ的性能。性能在κ增加到0.6时稳步提高，在[0.6, 0.8]内保持接近最优，然后在超过0.8后下降。这种模式突显了PageRank在选择全局重要文本块方面的作用。

#### λ的影响

图4(b)显示了κ固定为0.8时变化λ的效果。性能快速增长直到λ = 0.2，然后增长更慢，在λ = 0.6达到峰值后下降。这表明最优融合需要平衡G2ConS-Concept和G2ConS-Core-KG两者的贡献：λ太少会低估结构知识，而太多会削弱语义信号。基于这些观察，我们将默认值设置为κ = 0.8和λ = 0.6，这在基准测试中产生稳健性能。

**图4：通过变化κ和λ的答案质量**

## 5 结论

在这项工作中，我们提出了G2ConS，这是一种与主流GraphRAG兼容的高效RAG方案。其核心思想是通过共现关系从知识中挖掘核心概念，并使用这些核心概念来过滤文本块，从而在数据层面降低GraphRAG的构建成本。实验证明G2ConS可以同时在成本和性能方面优化现有GraphRAG方法。此外，G2ConS提出的概念图可以独立执行RAG，在几乎零构建成本下实现与现有方法相当的性能。在未来工作中，我们将进一步研究核心文本块选择的基本原理，并对概念图进行冗余分析以改进G2ConS的各个方面。此外，我们将探索在多模态场景中应用G2ConS，以在更一般化设置中构建高效的RAG系统。

**LLM使用声明：我们仅使用LLM来润色稿件。**

## 参考文献

Amar Abane, Anis Bekri, Abdella Battou, and Saddek Bensalem. Fastrag: Retrieval augmented generation for semi-structured data. arXiv preprint arXiv:2411.13773, 2024.

CircleMind AI. Fast GraphRAG: Streamlined and promptable framework for interpretable, high-precision, agent-driven retrieval workflows. https://github.com/circlemind-ai/fast-graphrag, 2024. Accessed: 2025-04-05.

Shawn Arnold and Clayton Romero. The vital role of managing ediscovery, 2022. URL https://legal-tech.blog/the-vital-role-of-managing-e-discovery.

Cristian S Calude and Giuseppe Longo. The deluge of spurious correlations in big data. Foundations of science, 22(3):595–612, 2017.

Bohan Chen and Andrea L Bertozzi. Autokg: Efficient automated knowledge graph generation for language models. In 2023 IEEE International Conference on Big Data (BigData), pp. 3117–3126. IEEE, 2023.

Boyu Chen, Zirui Guo, Zidan Yang, Yuluo Chen, Junze Chen, Zhenghao Liu, Chuan Shi, and Cheng Yang. Pathrag: Pruning graph-based retrieval augmented generation with relational paths, 2025. URL https://arxiv.org/abs/2502.14902, 2025.

Howard Chen, Ramakanth Pasunuru, Jason Weston, and Asli Celikyilmaz. Walking down the memory maze: Beyond context limit through interactive reading. arXiv preprint arXiv:2310.05029, 2023.

Julien Delile, Srayanta Mukherjee, Anton Van Pamel, and Leonid Zhukov. Graph-based retriever captures the long tail of biomedical knowledge. arXiv preprint arXiv:2402.12352, 2024.

Darren Edge, Ha Trinh, Newman Cheng, Joshua Bradley, Alex Chao, Apurva Mody, Steven Truitt, Dasha Metropolitansky, Robert Osazuwa Ness, and Jonathan Larson. From local to global: A graph rag approach to query-focused summarization. arXiv preprint arXiv:2404.16130, 2024.

Wenqi Fan, Yujuan Ding, Liangbo Ning, Shijie Wang, Hengyun Li, Dawei Yin, Tat-Seng Chua, and Qing Li. A survey on rag meeting llms: Towards retrieval-augmented large language models. In Proceedings of the 30th ACM SIGKDD conference on knowledge discovery and data mining, pp. 6491–6501, 2024.

Luyu Gao, Xueguang Ma, Jimmy Lin, and Jamie Callan. Precise zero-shot dense retrieval without relevance labels. In Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers), pp. 1762–1777, 2023a.

Yunfan Gao, Yun Xiong, Xinyu Gao, Kangxiang Jia, Jinliu Pan, Yuxi Bi, Yixin Dai, Jiawei Sun, Haofen Wang, and Haofen Wang. Retrieval-augmented generation for large language models: A survey. arXiv preprint arXiv:2312.10997, 2(1), 2023b.

Zirui Guo, Lianghao Xia, Yanhua Yu, Tu Ao, and Chao Huang. Lightrag: Simple and fast retrieval-augmented generation. arXiv preprint arXiv:2410.05779, 2024.

Haoyu Huang, Yongfeng Huang, Junjie Yang, Zhenyu Pan, Yongqiang Chen, Kaili Ma, Hongzhi Chen, and James Cheng. Retrieval-augmented generation with hierarchical knowledge. arXiv preprint arXiv:2503.10150, 2025a.

Yiqian Huang, Shiqi Zhang, and Xiaokui Xiao. Ket-rag: A cost-efficient multi-granular indexing framework for graph-rag. In Proceedings of the 31st ACM SIGKDD Conference on Knowledge Discovery and Data Mining V. 2, pp. 1003–1012, 2025b.

Bernal Jimenez Gutierrez, Yiheng Shu, Yu Gu, Michihiro Yasunaga, and Yu Su. Hipporag: Neurobiologically inspired long-term memory for large language models. Advances in Neural Information Processing Systems, 37:59532–59569, 2024.

Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich K¨uttler, Mike Lewis, Wen-tau Yih, Tim Rockt¨aschel, et al. Retrieval-augmented generation for knowledge-intensive nlp tasks. Advances in neural information processing systems, 33:9459–9474, 2020.

Dawei Li, Shu Yang, Zhen Tan, Jae Young Baik, Sukwon Yun, Joseph Lee, Aaron Chacko, Bojian Hou, Duy Duong-Tran, Ying Ding, et al. Dalk: Dynamic co-augmentation of llms and kg to answer alzheimer's disease questions with scientific literature. arXiv preprint arXiv:2405.04819, 2024a.

Shilong Li, Yancheng He, Hangyu Guo, Xingyuan Bu, Ge Bai, Jie Liu, Jiaheng Liu, Xingwei Qu, Yangguang Li, Wanli Ouyang, et al. Graphreader: Building graph-based agent to enhance long-context abilities of large language models. arXiv preprint arXiv:2406.14550, 2024b.

Xiaoya Li, Xiaofei Sun, Yuxian Meng, Junjun Liang, Fei Wu, and Jiwei Li. Dice loss for data-imbalanced nlp tasks. arXiv preprint arXiv:1911.02855, 2019.

L Liang, M Sun, Z Gui, Z Zhu, Z Jiang, L Zhong, Y Qu, P Zhao, Z Bo, J Yang, et al. Kag: Boosting llms in professional domains via knowledge augmented generation, 2024. URL https://arxiv.org/abs/2409.13731, 2024.

Edward Loper and Steven Bird. Nltk: The natural language toolkit. arXiv preprint cs/0205028, 2002.

Sewon Min, Danqi Chen, Luke Zettlemoyer, and Hannaneh Hajishirzi. Knowledge guided text retrieval and reading for open domain question answering. arXiv preprint arXiv:1911.03868, 2019.

Lawrence Page, Sergey Brin, Rajeev Motwani, and Terry Winograd. The pagerank citation ranking: Bringing order to the web. Technical report, Stanford infolab, 1999.

Boci Peng, Yun Zhu, Yongchao Liu, Xiaohe Bo, Haizhou Shi, Chuntao Hong, Yan Zhang, and Siliang Tang. Graph retrieval-augmented generation: A survey. arXiv preprint arXiv:2408.08921, 2024.

Tyler Thomas Procko and Omar Ochoa. Graph retrieval-augmented generation for large language models: A survey. In 2024 Conference on AI, Science, Engineering, and Technology (AIxSET), pp. 166–169. IEEE, 2024.

Juan Ramos et al. Using tf-idf to determine word relevance in document queries. In Proceedings of the first instructional conference on machine learning, volume 242, pp. 29–48. New Jersey, USA, 2003.

Bhaskarjit Sarmah, Dhagash Mehta, Benika Hall, Rohan Rao, Sunil Patel, and Stefano Pasquali. Hybridrag: Integrating knowledge graphs and vector retrieval augmented generation for efficient information extraction. In Proceedings of the 5th ACM International Conference on AI in Finance, pp. 608–616, 2024.

Parth Sarthi, Salman Abdullah, Aditi Tuli, Shubh Khanna, Anna Goldie, and Christopher D Manning. Raptor: Recursive abstractive processing for tree-organized retrieval. In The Twelfth International Conference on Learning Representations, 2024.

Harsh Trivedi, Niranjan Balasubramanian, Tushar Khot, and Ashish Sabharwal. Musique: Multihop questions via single-hop question composition. Transactions of the Association for Computational Linguistics, 10:539–554, 2022.

Shu Wang, Yixiang Fang, Yingli Zhou, Xilin Liu, and Yuchi Ma. Archrag: Attributed community-based hierarchical retrieval-augmented generation. arXiv preprint arXiv:2502.09891, 2025.

Yu Wang, Nedim Lipka, Ryan A Rossi, Alexa Siu, Ruiyi Zhang, and Tyler Derr. Knowledge graph prompting for multi-document question answering. In Proceedings of the AAAI conference on artificial intelligence, volume 38, pp. 19206–19214, 2024.

Zhilin Yang, Peng Qi, Saizheng Zhang, Yoshua Bengio, William W Cohen, Ruslan Salakhutdinov, and Christopher D Manning. Hotpotqa: A dataset for diverse, explainable multi-hop question answering. arXiv preprint arXiv:1809.09600, 2018.

Yibo Zhao, Jiapeng Zhu, Ye Guo, Kangkang He, and Xiang Li. Eˆ2graphrag: Streamlining graph-based rag for high efficiency and effectiveness. arXiv preprint arXiv:2505.24226, 2025.

## 附录

### A.1 基线

**Text-RAG.** Lewis et al. (2020) Text-RAG将预训练的序列到序列语言模型与非参数内存相结合，该内存实现为外部文档（如维基百科）的密集向量索引。在推理时，给定输入查询，预训练的神经检索器首先对查询进行编码并从索引中检索一组相关段落。然后语言模型基于这些检索到的段落生成输出序列。存在两种形式：一种对所有输出token使用相同的检索段落，另一种为每个token动态选择不同的段落。

**MS-GraphRAG.** Edge et al. (2024) GraphRAG是一种基于图的方法，用于在大型私有文本语料库上回答全局性问题。它首先使用大语言模型（LLM）从源文档构建实体知识图。然后，LLM为图中每个密切相关的实体社区生成摘要。在推理时，给定用户问题，GraphRAG检索相关的社区摘要，从中生成部分响应，并通过总结这些部分响应产生最终答案。

**Hybrid-RAG.** Sarmah et al. (2024) HybridRAG将基于知识图的RAG（GraphRAG）和基于向量数据库的RAG（VectorRAG）集成，以改进复杂金融文档（如收益电话会议记录）的问答。该方法从向量索引和领域特定知识图中检索相关上下文，然后结合这些源生成答案。

**HippoRAG.** Jimenez Gutierrez et al. (2024) HippoRAG是一种受人类长期记忆海马索引理论启发的检索框架。它集成了大语言模型、知识图和个性化PageRank算法来模拟新皮质和海马的互补作用。给定新经验，HippoRAG构建知识图并应用个性化PageRank来识别相关节点，这些节点指导问答支持证据的检索。这个过程能够在没有迭代提示的情况下实现高效的单步检索。

**LightRAG.** Guo et al. (2024) LightRAG通过将图结构融入文本索引和检索来增强检索增强生成。它采用双层检索系统，在低级文本单元和高级基于图的知识表示上运行。在检索期间，框架利用向量嵌入和图连通性来高效识别相关实体及其关系。增量更新算法动态地将新数据集成到图中，确保索引保持最新而无需完全重新处理。

**FastGraphRAG.** AI (2024) FastGraphRAG是一种检索增强生成框架，通过利用轻量级图结构进行高效索引和检索来加速知识密集型推理。它从输入文档构建紧凑的实体关系图，并应用快速近似图遍历（如个性化PageRank或随机游走）在单步检索中识别相关上下文。通过将基于图的语义连通性与密集向量表示集成，FastGraphRAG能够快速访问局部和多跳证据，同时最小化计算开销。

**Raptor.** Sarthi et al. (2024) RAPTOR是一种检索增强语言模型，通过文档块的递归嵌入、聚类和摘要构建文本摘要的层次树。从叶子处的细粒度段开始，该方法逐步分组和总结内容以形成向根方向的更高级抽象。在推理时，RAPTOR检索此树中多个级别的相关节点，实现不同粒度信息的集成，支持对长文档的整体理解。

**KET-RAG.** Huang et al. (2025b) KET-RAG是一种用于GraphRAG的多粒度索引框架，平衡检索质量和索引效率。它首先选择一小部分关键文本块，并使用大语言模型提取实体和关系，形成紧凑的知识图骨架。对于剩余文档，它构建轻量级文本关键词二分图，而不是完整的基于三元组的KG。在检索期间，KET-RAG在骨架上执行局部搜索，同时在二分图上模拟类似遍历来丰富上下文。