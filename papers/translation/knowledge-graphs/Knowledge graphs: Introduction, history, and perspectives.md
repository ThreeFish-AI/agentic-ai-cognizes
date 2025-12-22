# 知识图谱：介绍、历史与展望

**原文标题**: Knowledge graphs: Introduction, history, and perspectives
**作者**: Vinay K. Chaudhri, Chaitanya Baru, Naren Chittar, Xin Luna Dong, Michael Genesereth, James Hendler, Aditya Kalyanpur, Douglas B. Lenat, Juan Sequeda, Denny Vrandečić, Kuansan Wang
**期刊**: AI Magazine 2022.43:17-29
**翻译**: Claude Code

## 摘要

本文从历史和技术的角度介绍知识图谱（KG）的概念。知识图谱是一种由节点和边组成的有向标记图，其中节点可以代表任何现实世界的实体，例如人员、公司和计算机。边标签捕获两个节点之间感兴趣的关系。例如，两个人之间的友谊关系；公司与个人之间的客户关系；或者两台计算机之间的网络连接。

有多种方法可以为节点和边关联含义。在最简单的层面上，含义可以表达为人类可理解语言（如英语）的文档字符串。在计算层面上，含义可以用形式化规范语言（如一阶逻辑）来表达。当前研究的一个活跃领域是自动计算由数字序列组成的向量中捕获的含义。我们将在后面关于符号表示与向量表示的部分中对比这些捕获含义的方法。

信息可以通过人工驱动、半自动和/或全自动方法的组合添加到知识图谱中。无论采用何种方法，都期望记录的信息能够被人类轻松理解和验证。我们将在后面关于人工整理与机器整理的部分中对比创建知识图谱的不同方法。

知识图谱上的搜索和查询操作可以简化为图导航。例如，在友谊知识图谱中，要获得某个人A的朋友的朋友，可以首先从A导航到所有通过标记为朋友的关系连接到A的节点B。然后可以递归地导航到通过朋友关系连接到每个B的所有节点C。有向标记图表示和图算法对几类问题是有效的。然而，它们不足以捕获所有感兴趣的推理。我们将在后面关于大语义与小语义的部分中更详细地讨论这一点。

实际系统调整有向标记图表示以适应特定的应用需求。例如，一个在万维网上显著使用的知识图谱模型，称为资源描述框架（RDF）（Cygniak, Wood, and Lanthaler 2014），使用国际资源标识符（IRI）来唯一标识"事物"（实体）。属性图模型（Robinson, Webber, and Eifrem 2015）将属性和值与每个节点和每个边相关联。边属性可用于多种目的：表示有争议的事实（例如，克什米尔所在的争端国家）；高度时间依赖的信息（例如，美国总统）；或真正的多样性（例如，用户行为）。随着最近对负责任人工智能的强调，用边如何获得的信息来注释边在解释基于知识图谱的推理中起着关键作用。例如，边的置信度属性可用于表示该关系已知为真的概率。最后，查询语言，如用于RDF的SPARQL（Pérez et al. 2006）和用于属性图模型的图查询语言，分别提供了查询RDF和属性图知识图谱中信息的能力。

## 知识图谱的应用

导致知识图谱人气激增的两个关键应用是：(1) 整合和组织关于已知"实体"的信息，要么作为网络上公开可访问的资源，要么作为企业/组织内的专有资源；以及 (2) 表示AI/ML算法的输入和输出信息。这些应用用例在以下部分中进一步探讨。

### 组织开放信息

Wikidata是一个协作编辑的开放知识图谱，为维基百科和网络上的其他用途提供数据（Vrandečić and Krötzsch 2014）。如下面的例子所示，Wikidata知识图谱可以帮助增强和改善维基百科中的信息质量。考虑温特图尔镇的维基百科页面，其中包括温特图尔所有姊妹镇的列表：两个在瑞士，一个在捷克共和国，一个在奥地利。维基百科还有加利福尼亚州安大略市的条目，其中将温特图尔列为它的姊妹城市。"姊妹城市"和"双子城市"关系意在相同且互惠。因此，如果城市A是另一个城市B的姊妹（双子），那么B必须是A的姊妹（双子）。在维基百科中，"姊妹城市"和"双子城镇"只是章节标题，两者之间没有指定任何关系/链接。因此，很难自动检测这种差异。相反，温特图尔的Wikidata表示包括一个称为"结对行政主体"的关系，其中包括加利福尼亚州安大略市。由于这种关系在知识图谱中被定义为对称关系，SPARQL查询引擎可以推断加利福尼亚州安大略市的Wikidata页面应该链接到温特图尔的Wikidata页面。

Wikidata通过策展人创建的关系定义以及使用知识图谱推理引擎实现的推理来解决识别逆关系的问题。这种推理的更高级形式在本期中报道的环境智能开放知识网络（Janowicz et al. 2022）和洪水影响评估开放知识网络（Johnson et al. 2022）中得到说明。

**图1：Wikidata知识图谱的一个片段**

```
Wikidata底层图结构
温特图尔
安大略
结对行政主体
苏黎世大都会区
瑞士
属于
属于
国家
美国
属于
北美洲
温特图尔
等同于
国会图书馆
```

图1描绘了温特图尔和安大略之间的双向关系，并显示了温特图尔和安大略连接到的一些其他对象。Wikidata包括来自几个独立提供者的信息，例如，国会图书馆。通过使用独特内部标识符来识别来自各种来源（如国会图书馆和其他来源）的不同实体（例如，温特图尔），可以轻松地将关于实体的信息链接在一起。Wikidata通过发布Wikidata关系到schema.org本体的映射，使集成不同数据源变得容易。最近利用这些工具向Wikidata添加了关于COVID-19的信息（Waagmeester et al. 2021）。从Wikidata中的关系名称到其他来源中的关系名称的映射使得能够使用对该组站点通用的关系来制定和处理跨越此类站点多个数据集的查询（Peng et al. 2018）。此类请求的一个例子是：在地图上显示在温特图尔去世的人的出生城市。没有共同的关系词汇表，例如，出生城市，就有必要在一个站点中使用的关系与其他站点中使用的关系之间创建适当的翻译。搜索引擎例行使用此类查询的结果来增强其结果（Noy et al. 2019）。

截至2021年，Wikidata包含超过9000万个不同对象，这些对象之间有超过10亿个关系。Wikidata跨越4872个不同的目录建立连接，这些目录由独立数据提供者以414种不同语言发布。根据最近的估计，31%的网站和超过1200万个数据提供者目前正在使用schema.org的词汇表向其网页发布注释（Guha, Brickley, and Macbeth 2016）。

Wikidata知识图谱有许多新的令人兴奋的方面。首先，它是一个前所未有规模的公共图，也是当今开放可用的最大知识图谱之一。其次，即使它是手动策展的，策展成本也由贡献者社区分担。第三，虽然Wikidata中的一些数据可能是从来源自动提取的（Wu, Hoffmann, and Weld 2008），但根据Wikidata编辑政策，所有信息都必须易于理解和验证。最后，也是重要的是，致力于通过schema.org中的词汇表为关系名称提供语义定义。

另一个开放可访问的知识图谱的最近例子来自Data Commons的努力，其目标是使公开可用的数据易于访问和使用。Data Commons对来自各种公开可用的政府和其他权威数据源的数据进行必要的清理和连接，并提供对结果知识图谱的访问。它目前包含关于人口统计（美国人口普查，Eurostat）、经济学（世界银行，劳工统计局，经济分析局）、健康（世界卫生组织，疾病控制中心）、气候（政府间气候变化专门委员会，国家海洋和大气管理局）和可持续性的数据。

### 组织企业信息

数据集成对现代企业的运作至关重要，其中公司数据通常驻留在许多不同的数据库和非结构化来源中。此外，几乎所有企业向在线运营的广泛转变导致在分布式位置积累了大量有价值的用户行为数据。此外，来自第三方数据供应商的数据激增为企业提供了高度有价值的信息，这些信息需要与内部数据集成以实现更有效的业务运营。

考虑以下例子：一份财经新闻报道已经发布，称"Acma Retail Inc"因大流行而申请破产，因此其许多供应商将面临财务压力（Ding et al. 2021）。如果作为Acma供应商的公司C正在经历财务压力，人们可能期望类似的压力也会依次由C的供应商经历。这种供应链关系目前正在作为名为Factset的商业可用数据集的一部分进行策展。

公司客户的"360度视图"包括来自公司内部的客户数据和来自公司外部的客户数据。公司可以通过将第三方数据（例如，Factset和来自开放财经新闻的信息）与公司自己的内部数据库相结合，创建其客户的"360度视图"。这通常需要解决实体消歧问题以唯一识别所讨论的实体——这也是本期中描述的OKN相关项目中解决的问题（Cafarella et al. 2022）和（Pah et al. 2022）。由此产生的知识图谱可用于跟踪Acma供应链，并帮助识别其风险可能值得监控的 stressed 供应商。

创建客户360度视图的数据集成过程可能从知识工程师与业务分析师开始，勾勒出他们感兴趣跟踪的关键实体、事件和关系的模式（见图2）。这个过程的一个重要部分是用户就术语的含义达成一致。例如，"组织"何时变成"客户"——在下订单时，还是在产品交付时？在实践中，图导向的知识图谱模式的视觉性质促进了业务用户和主题专家在指定其需求时的白板讨论。接下来，知识图谱模式需要映射到底层源的模式，以便各自的数据可以加载到知识图谱引擎中。存储在企业数据库中的数据的含义隐藏在嵌入在查询、数据模型、应用程序代码、书面文档中的逻辑中，或者简单地隐藏在主题专家的头脑中，这需要在映射过程中投入人力和机器努力（Sequeda and Lassila 2021）。

**图2：360度视图的示例模式**

```
客户
供应商
有供应商
姓名
行业部门
产品
数量
姓名
新闻
事件
相关于
```

让我们考虑使用知识图谱进行数据集成的新颖和令人兴奋的方面。首先，集成信息可能来自文本和其他非结构化来源（例如，新闻、社交媒体等）以及结构化数据源（例如，关系数据库）。由于许多信息提取系统已经以三元组的形式输出信息，使用通用三元组模式大大降低了启动此类数据集成项目的成本。其次，与调整传统关系数据库所需的努力相比，基于三元组的模式更容易适应变化。这是因为关系系统通常被建模为支持应用程序（McComb 2018），因此模式更改通常需要数据库重组。另一方面，在知识图谱系统中，模式被建模为代表企业（McComb 2019），其三元组表示保持固定。最后，现代知识图谱引擎高度优化，用于回答需要遍历数据中图关系的问题。对于图2的示例模式，典型的图引擎能够使用内置操作来识别（1）供应链网络中的中心供应商，（2）密切相关的客户或供应商群体，以及（3）不同供应商的影响范围。所有这些计算都利用领域无关的图算法，如中心性检测和社区检测。

由于创建和可视化模式的相对容易性以及内置分析操作的可用性，知识图谱正在成为企业中将数据转化为智能的流行解决方案。例如，本期后面报道的精准医学开放知识网络广泛使用基于图的可视化和推理来解决生物医学问题（Baranzini et al. 2022）。

### 表示AI算法的信息

知识图谱是自然语言处理（NLP）、计算机视觉（CV）和常识推理的必要技术。由于NLP和CV深度学习的最新进展，这些领域的算法正在超越基本识别任务，转向提取对象之间的关系，从而需要一个表示方案，其中提取的关系可以存储以供进一步处理和推理。在常识推理中，IBM Watson中使用的混合方法的成功（Ferrucci et al. 2010）促使许多人追求符号和统计方法的组合，用于需要使用知识图谱的常识推理。

**图3：使用实体和关系提取创建的知识图谱**

```
阿尔伯特·爱因斯坦
德国
相对论
理论物理学家
出生在
职业
发展
物理学家
物理学
实践
类型
分支
阿尔伯特·爱因斯坦是一位德裔理论物理学家，他发展了相对论。
```

图3描绘了使用知识图谱表示NLP提取的知识的一个例子。它显示了一个句子，从中可以提取实体：阿尔伯特·爱因斯坦、德国、理论物理学家和相对论；以及关系出生在、职业和发展。一旦这个知识片段被纳入更大的知识图谱中，我们就可以使用逻辑推理推导出额外的链接（由虚线边显示），例如理论物理学家是实践物理学的物理学家的一种类型，而相对论是物理学的分支。本期中描述的法庭记录开放知识网络项目广泛使用了类似的实体提取技术（Pah et al. 2022）。

在计算机视觉中，图像被表示为一组具有一组属性的对象，其中每个对象对应一个由对象检测器识别的边界框，并且对象通过一组命名关系相互连接，这些关系由训练用于识别视觉关系的模型预测。在图4中，CV算法生成右侧显示的知识图谱，对象如女人、奶牛和面具，以及关系如持有、喂养等。在现代CV研究中，这样的知识图谱被称为场景图（Chen et al. 2019），它已成为在CV算法中实现组合行为的中心工具。也就是说，一旦CV算法被训练识别某些对象，然后通过利用场景图，它可以用更少的例子训练识别这些对象的任何组合。场景图还为视觉问答等任务提供了基础（Zhu et al. 2016）。

**图4：使用计算机视觉技术创建的知识图谱**

```
女人
面具
草地
奶牛
穿着
喂养
持有
吃
```

接下来我们以特定类型的常识推理为例，称为因果关系推理。给定一个事件，如X击退Y的攻击，人类可以对为什么会发生击退？X对这次攻击感觉如何？这种击退可能产生什么影响等问题做出许多常识推理。对此类推理进行编程的一般策略是首先手动策展一个知识图谱，然后将其与机器学习算法结合使用，以预测知识图谱中不存在的事件的影响。例如，给定一个新事件，如X在没有Y的情况下离开，系统做出如X想要独处，X想要回家，Y可能会想念他的朋友等推理。此类系统的两个例子是ATOMIC，包含超过30万个事件节点和超过80万个因果关系三元组（Sap et al. 2019），以及GLUCOSE，包含超过67万个因果关系三元组（Mostafazadeh, et al. 2020）。

在知识图谱的这些AI应用中，知识图谱的自动创建是该方法的核心组成部分。对于常识推理知识图谱，即使创建训练集需要大量的前期手动工作，一旦训练完成，学习算法将以零额外成本处理许多新案例。其次，人们清楚地认识到，知识图谱表示是AI系统中实现组合行为的核心要素。这在场景图的背景下得到了清楚说明，也在捕获NLP输出和创建因果关系知识图谱的基本原理中得到了说明。

## 开放知识网络项目

本AI杂志特刊包含一系列关于开放知识网络（OKN）的文章。OKN代表开放知识网络，旨在支持大型、多模态、多领域知识图谱的创建和使用，它们作为基础设施为大量人工智能应用提供支持。OKN计划是美国国家科学基金会融合加速器计划在2019-2020年期间资助的一个研发主题。本期中的OKN项目涵盖了知识图谱研究的不同方面，包括环境和气候科学、生物医学、数据集成基础设施、洪水影响评估以及法律记录分析。

**表1：本期涵盖的OKN项目**

| OKN项目 | 使用的表示 | 解决的技术问题 |
|---------|------------|----------------|
| 环境智能 (Janowicz et al. 2022) | RDF | 空间知识、n度属性路径查询、模块化本体开发 |
| 洪水影响评估 (Johnson et al. 2022) | RDF | 基于本体的推理、多个相关图 |
| 精准医学 (Baranzini et al. 2022) | 属性图 | 图推理、网络可视化、生物医学本体 |
| OKN基础设施 (Cafarella et al. 2022) | JSON | 作者消歧、数据精炼、数据生命周期 |
| 法庭记录 (Pah et al. 2022) | 对象关系映射到SQL数据库 | 实体消歧、诉讼事件本体 |

OKN, 开放知识网络; RDF, 资源描述框架。

通过结合各种方法来发挥优势的方式是OKN项目的独特之处。我们在这里呈现不同观点的目标是使每个观点都能得到更好的理解，并阐明某种解决方案合适的问题。

## 符号表示与向量表示

用于NLP和CV的机器学习算法依赖于文本和图像的向量表示。深度学习在多个任务上的最近成功促使许多人拒绝任何符号表示的需要。我们将更仔细地检查这些替代观点。

NLP中常用的向量表示是词嵌入。例如，给定一个文本语料库，可以计算一个词出现在每个其他词旁边的频率，从而得到一个数字向量。有复杂的算法可用于减少向量的维度以计算更紧凑的向量，称为词嵌入（Mikolov et al. 2013）。词嵌入以计算可在任务中利用的方式捕获词的语义含义，如词相似性计算、实体提取和关系提取。类似地，CV算法操作图像的向量表示。图嵌入是词嵌入的推广，但用于图结构输入（Hamilton 2020）。

使用向量表示的算法在许多任务上都表现出色，例如网络搜索和图像识别。使用今天的网络搜索，我们可以回答诸如：1956年10月英国的首相是谁？这样的问题。但如果问题被修改为不寻常的推理步骤组合，搜索就会失败，例如：特蕾莎·梅出生时英国的首相是谁？人类在理解此类问题方面几乎没有困难（Lenat 2019a; Lenat 2019b）。向量表示的局限性可以通过将从文本和图像中提取的信息编码到知识图谱中来解决，正如我们在图3和图4中看到的那样。

补充向量和符号表示使程序能够实现组合行为，并促进推理和推理。将图嵌入与神经网络一起使用——也称为图的机器学习——正在被用于处理我们之前考虑的因果关系知识图谱中未见过的动作。

神经符号推理是一个快速兴起的研究领域，它利用嵌入自动计算的好处，同时认识到需要具体的知识图谱来产生人类可理解的表示。我们在故事理解任务上说明神经符号推理（Dunietz et al. 2020）。考虑以下故事：费尔南多去了一家植物商店。他喜欢叶子的薄荷味。他买了一盆植物并把它放在窗边。鉴于这个故事，我们想回答问题：费尔南多为什么买这盆植物？一个可能的人类可理解的推理链涉及以下步骤：(a) 如果A（植物）有部分B（叶子），而B有属性P（薄荷味），那么A有属性P；(b) 如果A（人）喜欢B（植物）的属性P（薄荷叶），那么A喜欢B；(c) 如果A喜欢B，A可能购买B。在这个推理链中，步骤(a)和(b)是传统符号知识库中可能存在的规则的例子，而(c)是我们在前面部分考虑的因果关系知识图谱中可能发现的那种概率规则。此类规则可能已经作为知识图谱策展部分的一部分存在，或者可以提前使用图神经网络推断，或者可以响应查询动态推断。神经符号推理器可以管理和执行这个推理过程（Kalyanpur et al. 2020）。

### 人工整理与机器整理

工业知识图谱，如Google知识图谱、Amazon产品图谱（APG）和Microsoft学术图谱（MAG）规模空前（Noy et al. 2019）。关于在多大程度上可以通过自动化方法（也称为机器整理）还是通过人工努力创建此类知识图谱，经常存在争论。这种权衡通过基于MAG和APG（利用了大量自动化）的两个例子，以及基于Wikidata知识图谱和Cyc知识库（主要通过人工整理创建）的两个例子来说明。

MAG团队使用机器整理来解决唯一识别作者及其出版物的问题（Wang et.al 2020）。人工整理策略主张设立标准，如用于唯一识别出版物的数字对象标识符（DOI），和用于唯一识别作者的开放研究者和贡献者ID（ORCID）。这种方法依赖于作者和出版组织贡献手动努力来用DOI和ORCID注释文档。然而，即使是如此简单任务的人工整理也因几个原因而存在问题。首先，此类标识符的人类可读性较低，阻碍了其使用。其次，频繁的打字错误造成了采用障碍。第三，出版物没有DOI并没有阻碍其可访问性，因为网络上有多种查找出版物的方式。最后，统一标识符存在一些滥用。例如，一些个人获得多个标识符将其出版物分区到单独的档案中，这违背了ORCID作为唯一标识符的设计目标。因此，MAG团队利用机器整理，通过内容识别出版物，并根据作者的研究领域、所属机构、合著者和其他对人类更自然的因素来消除作者的歧义。

APG是多语言的，旨在收集数百万产品类别的产品知识和每个产品数千个属性的信息。虽然人们可以合理地假设有兴趣通过亚马逊销售其产品的供应商可能自愿提供可以直接输入APG的结构化信息，但这在实践中并非如此，结构化数据稀疏且嘈杂。然而，完全通过人工整理创建APG将需要数百人年的努力。机器整理技术在不同扩展水平上被利用。为了启动项目，创建了高度准确的自动知识提取模型，为小范围产品生成可信赖的数据，其中每个模型从单个产品领域提取单个属性的知识（Zheng et al. 2018）。即使探索了神经网络来自动化过程，也涉及大量手动工作来创建训练数据、进行人工评估以及识别后处理规则以去除提取噪声。下一个扩展水平旨在通过AutoML和自动清洁技术减少建模成本（Wang et al. 2020），以便显著减少每个知识提取模型的手动调整。进一步扩展需要减少提取各种知识所需模型的总数，这是通过迁移学习技术实现的，使模型能够提取多个属性和多个领域的知识（Karamanolakis, Ma, and Dong 2020）。最终的扩展水平旨在通过多模态信息（例如，从文本和图像中提取）增加知识提取产量（Lin et al. 2021; Yan et al. 2021）。人类创建的高度精确模型是这个过程的基础。不同级别的扩展需要利用命名实体识别、封闭信息提取、知识清洁和基于知识的问答等技术。

Wikidata知识图谱的启动是为了解决维基百科数据埋藏在30个不同语言的3000万篇文章中的问题，从中自动提取本身就困难。相同的信息经常出现在多种语言的文章和单语言内的多篇文章中。例如，罗马的人口数字可以在关于罗马的英语和意大利语文章中找到，但也在英语文章"Italian cities"中找到。数据不一致——这些不同维基百科文档中的人口数字都不同。由于建立在多元性原则基础上，不容易甚至不可能在"真实"数据上达成全球共识，因为许多事实是有争议的或简单地不确定的。与MAG和APG不同，Wikidata允许冲突数据共存并提供机制来组织这种值的多样性。检查、验证和允许这种数据多样性是维基百科社区多年来一直在做的事情。Wikidata的人工整理努力涉及超过40万编辑者的社区，其中超过2万活跃编辑者。在这个过程中，Wikidata利用了标准发布的标识符，包括国际标准名称标识符（ISNI）、中国学术图书馆和信息系统（CALIS）、国际航空运输协会（IATA）、专辑和表演者的MusicBrainz，以及北大西洋盆地的飓风数据库（HURDAT）。Wikidata本身发布其语料库中出现项目的标准标识符列表，现在越来越多地被商业知识图谱使用。

最后，考虑Cyc，最大的可用常识知识库，捕获复杂的人类常识。Cyc知识库主要通过人工整理创建，因为该项目旨在捕获没有明确写在文本中的"隐藏"知识，因此无法自动提取。早期版本的Cyc采用了类似当今知识图谱的表示。自1989年以来，Cyc使用了一种称为CycL的表示语言，它基于高阶逻辑和嵌套模态（Lenat and Guha 1991）。需要CycL来表示和推理诸如：当朱丽叶喝下她的药水时，她期望一旦罗密欧听到她死了他会相信什么，为什么（Lenat 2019a）？即使要输入的知识已经明确写下，自动提取知识到如此高度表现力的语言中也超出了当前NLP技术的范围。Cyc正在构建越来越自动化的工具，以帮助降低创建和修改其知识库的门槛。项目的知识公理化研究所（KNAXI）也对所有教育水平的"本体工程"教育和专业培训感兴趣，以促进CycL知识库的创建。

### 小语义与大语义

大语义观点可以被看作是倡导捕获更多关于概念含义的观点。而小语义观点专注于捕获/记录基本事实，而不太关注概念含义。定义为有向标记图的知识图谱是小语义方法的代表性技术。表示语言CycL是大语义方法的代表性技术。

仅使用有向标记图表示知识图谱有其固有的局限性。这种限制的一个简单例子是在表示语句：洛杉矶在美国101号公路上位于圣地亚哥和圣何塞之间。这个语句可以通过一种称为具体化的技术在有向标记图中捕获，但需要多个三元组（见图5A）。如果我们允许四元谓词，这个语句可以直接捕获，而不受有向图的支持——尽管许多图和语义网数据库实现确实包含这种能力。对于这个例子，知识图谱表示类似于使用汇编语言而不是高级编程语言。使用三元组和具体化使下游任务（如自然语言生成）更加困难，因为它们现在必须组装分散在多个三元组中的信息。作为一个更复杂的例子，考虑语句每个瑞典人都有一个国王和每个瑞典人都有一个母亲，它们在英语中语法相似，许多知识图谱会相同地表示它们，但这些语句具有非常不同的计算含义（见图5B）。可以通过各种方式扩展有向图以正确捕获图5B中考虑的示例的语义（Chaudhri et al. 2004; Sowa 2008），但这样的扩展失去了三元组表示提供的简单性。不足为奇，类似的努力也在非二元关系的机器学习中进行中（Fatemi et al. 2019）。

**图5：示例句子及其在知识图谱和一阶逻辑中的表示**

**(A) 洛杉矶位于圣地亚哥和圣何塞之间的美国101号公路上**

```
知识图谱表示：
洛杉矶 -[位于]-> 路径1
路径1 -[位于]-> 圣地亚哥
路径1 -[位于]-> 圣何塞
路径1 -[是]-> 美国公路101
```

**(B) 每个瑞典人都有一个国王和每个瑞典人都有一个母亲**

```
知识图谱表示（相同但语义不同）：
瑞典人 -[有]-> 国王
瑞典人 -[有]-> 母亲

一阶逻辑表示（不同语义）：
∀x (Swede(x) → ∃y (King(y) ∧ hasKing(x,y)))
∀x (Swede(x) → ∃y (Mother(y) ∧ hasMother(x,y)))
```

尽管有上述限制，有向标记图表示已被发现对解决许多实际问题有用，这些问题通过小语义很好地得到服务。Wikidata、Data Commons、MAG和APG都在其核心采用有向标记图表示，它们的存在和商业有用性是小语义大有作为的有力证据（Hendler 2007）。此外，即使对于简单的有向标记图表示，也有许多未解决的问题。例如，我们如何创建开放知识图谱？——这正是本期多个OKN项目正在解决的问题。什么通用命名约定将允许用户与多个现有知识图谱交互并创建自己的组合产品，这些产品又可被他人使用并进一步组合，无限循环？我们如何设计工作流程，使构建、维护和改进知识图谱成为任何人都可以参与的活动，而不仅仅是专家？

## 结论

知识图谱已经成为现代AI应用中用于表示和推理结构化知识的基本技术。本文从历史和技术角度提供了知识图谱的介绍，强调了它们在整合组织信息和支持AI算法方面的关键作用。

我们已经看到，知识图谱从早期的语义网络和数据库系统发展到今天的规模，为各种应用提供了基础设施支持。通过不同的表示方法（RDF、属性图等）和创建方法（人工整理、机器整理），知识图谱适应了不同的使用场景和需求。

我们探讨了符号表示与向量表示之间的紧张关系，以及神经符号推理如何成为结合两者优势的有前途的方向。我们还看到人工整理和机器整理各自在不同场景下的价值，以及小语义和大语义方法之间的权衡。

随着开放知识网络等项目的发展，我们期望知识图谱技术将继续演进，为更大规模、更复杂的AI应用提供支持。知识的民主化和知识构建过程的可访问性将继续是该领域发展的重要主题。

## 参考文献

1. Baranzini, A., P. Rose, S. Israni, and S. Huang 2022. "A Biomedical Open Knowledge Network Harnesses the Power of AI to Understand Deep Human Biology." AI Magazine 43(1): 46–58.

2. Berners-Lee, T., J. Hendler, and O. Lassila 2001. "The semantic web." Scientific American 284(5): 34–43.

3. Borgida, A., and J. Mylopoulos 2009. "A Sophisticate's Guide to Informational Modeling." In Metamodeling for Method Engineering. Cambridge, MA MIT: MIT Press.

4. Brachman, R. J., and H. J. Levesque 1984. "The Tractability of Subsumption in Frame-Based Description Languages." In the proceedings of the annual conference of the Association for the Advancement of Artificial Intelligence 84: 34–7.

5. Brin, S., and L. Page 1999. "The anatomy of a large-scale hypertextual web search engine." Computer Networks and ISDN Systems 30(1-7): 107–17.

6. Buneman, P. 1997. "Semistructured Data." In Proceedings of the 16th ACM SIGACT-SIGMOD-SIGART Symposium on Principles of Database Systems 117–21.

7. Cafarella, M., M. Anderson, I. Beltagy, A. Cattan, S. Chasins, I. Dagan, D. Downey, O. Etzioni, S. Feldman, T. Gao, T. Hope, K. Huang, S. Johnson, D. King, K. Lo, Y. Lou, M. Shapiro, D. Shen, S. Subramanian, L. Wang, Y. Wang, Y. Wang, D. Weld, J. Vo-Phamhi, A. Zeng, and J. Zou 2022. "Infrastructure for Rapid Open Knowledge Network Development." AI Magazine 43(1): 59–68.

8. Chaitan, B., Scott, B., Lara, C., Aurali, D., Pradeep, F., Alex, L., Douglas, M., Ibrahim, M., Linda, M., Michael, P., Michael, R., Shelby, S., Nicole, T. The NSF Convergence Accelerator Program, AI Magazine 43(1).

9. Chaudhri, V., K. Murray, J. Pacheco, P. Clark, B. Porter, and P. Hayes 2004. "Graph-Based Acquisition of Expressive Knowledge." In International Conference on Knowledge Engineering and Knowledge Management, 231–47. Berlin, Heidelberg: Springer.

10. Chen, V. S., P. Varma, R. Krishna, M. Bernstein, C. Re, and L. Fei-Fei 2019. "Scene Graph Prediction with Limited Labels." In Proceedings of the IEEE/CVF International Conference on Computer Vision 2580–90.

11. Codd, E. F. 1982. "Relational Database: A Practical Foundation for Productivity." In Communications of the ACM 25(2): 109–17.

12. Cygniak, R., D. Wood, and M. Lanthaler 2014. "RDF 1.1 Concepts and Abstract Syntax. https://www.w3.org/TR/rdf11-concepts/

13. Ding, W., V. K. Chaudhri, N. Chittar, and K. Konakanchi May 2021. "JEL: Applying End-to-End Neural Entity Linking in JPMorgan Chase." In Proceedings of the AAAI Conference on Artificial Intelligence 35(17): 15301–8.

14. Dunietz, J., G. Burnham, A. Bharadwaj, O. Rambow, J. Chu-Carroll, and D. Ferrucci 2020. "To Test Machine Comprehension, Start by Defining Comprehension." arXiv preprint arXiv:2005.01525 [cs.CL].

15. Fatemi, B., P. Taslakian, D. Vazquez, and D. Poole 2019. "Knowledge Hypergraphs: Extending Knowledge Graphs Beyond Binary Relations." arXiv preprint arXiv:1906.00137.

16. Feigenbaum, E. A. 1984. "Knowledge Engineering." Annals of the New York Academy of Sciences 426(1): 91–107.

17. Ferrucci, D., E. Brown, J. Chu-Carroll, J. Fan, D. Gondek, A. A. Kalyanpur, A. Lally, J. W. Murdock, E. Nyberg, J. Prager, and N. Schlaefer 2010. "Building Watson: An overview of the DeepQA project." AI Magazine 31(3): 59–79.

18. Guha, R. V. 1996. Meta-Content Format. Working Paper, Apple Computers.

19. Guha, R. V., D. Brickley, and S. Macbeth 2016. "Schema. org: Evolution of Structured Data on the Web." Communications of the ACM 59(2): 44–51.

20. Gutiérrez, G., and J. F. Sequeda 2021. "Knowledge Graphs." Communications of the ACM 64(3): 96–104.

21. Hamilton, W. L. 2020. "Graph Representation Learning." Synthesis Lectures on Artificial Intelligence and Machine Learning 14(3): 1–159.

22. Hayes, P. J. 1981. "The Logic of Frames." In Readings in Artificial Intelligence, 451–8. San Mateo, CA: Morgan Kaufmann.

23. Hendler, J. 2007. "The Dark Side of the Semantic Web." IEEE Intelligent Systems 22(1): 2–4.

24. Janowicz, K., P. Hitzler, W. Li, D. Rehberger, M. Schildhauer, R. Zhu, C. Shimizu, C. Fisher, L. Cai, G. Mai, J. Zalewski, Z. Lu, S. Stephen, S. Gonzalez, A. Carr, A. Schroeder, D. Smith, L. Usery, D. Varanka, D. Wright, S. Wang, Y. Tian, Z. Liu, and Z. Gu 2022. "Know, Know Where, KnowWhereGraph: A Densely Connected, Cross-Domain Knowledge Graph and Geo-Enrichment Service Stack for Applications in Environmental Intelligence." AI Magazine 43(1): 30–39.

25. Johnson, J., T. Narock, J. Singh-Mohudpur, D. Fils, K. Clarke, S. Saksena, A. Shepherd, S. Arumugam, and L. Yeghiazarian 2022. "Knowledge Graphs to Support Real-Time Flood Impact Evaluation." AI Magazine 43(1): 40–45.

26. Kalyanpur, A., T. Breloff, D. Ferrucci, A. Lally, and J. Jantos 2020. "Braid: Weaving Symbolic and Neural Knowledge into Coherent Logical Explanations." arXiv preprint arXiv:2011.13354.

27. Karamanolakis, G., J. Ma, and X. L. Dong 2020. "Txtract: Taxonomy-Aware Knowledge Extraction for Thousands of Product Categories." arXiv preprint arXiv:2004.13852.

28. Kowalski, R. 2014. "History of Logic Programming." Computational Logic 9: 523–69.

29. Lenat, D. B., and R. V. Guha 1991. "The Evolution of CycL, the Cyc Representation Language." ACM SIGART Bulletin 2(3): 84–7.

30. Lenat, D. B. 1995. "CYC: A Large-Scale Investment in Knowledge Infrastructure." Communications of the ACM 38(11): 33–8.

31. Lenat, D. B. 2019a. "What AI Can Learn From Romeo & Juliet, Forbes," July 3, 2019. https://www.forbes.com/sites/cognitiveworld/2019/07/03/what-ai-can-learn-from-romeo--juliet/?sh=7f96d5851bd0

32. Lenat, D. B. 2019b. "Not As Good As Gold: Today's AI are Dangerously Lacking in AU (Artificial Understanding), Forbes," February 18, 2019. https://www.forbes.com/sites/cognitiveworld/2019/02/18/not-good-as-gold-todays-ais-are-dangerously-lacking-in-au-artificial-understanding/?sh=b84ea9536dd4

33. Lin, R., X. He, J. Feng, N. Zalmout, Y. Liang, L. Xiong, and X. L. Dong 2021. "PAM: Understanding Product Images in Cross Product Category Attribute Extraction." arXiv preprint arXiv:2106.04630.

34. McCarthy, J. 1989. "Artificial Intelligence, Logic and Formalizing Common Sense." In Klüver Academic. http://jmc.stanford.edu/articles/ailogic.html

35. McComb, D. 2018. Software Wasteland: How the Application-Centric Mindset is Hobbling our Enterprises. Basking Ridge, NJ, USA: Technics Publications.

36. McComb, D. 2019. The Data-Centric Revolution: Restoring Sanity to Enterprise Information Systems. Basking Ridge, NJ, USA: Technics Publications.

37. Mikolov, T., K. Chen, G. Corrado, and J. Dean 2013. "Efficient estimation of word representations in vector space." arXiv preprint arXiv:1301.3781.

38. Mostafazadeh, N., A. Kalyanpur, L. Moon, D. Buchanan, L. Berkowitz, O. Biran, and J. Chu-Carroll 2020. "Glucose: Generalized and contextualized story explanations." arXiv preprint arXiv:2009.07758.

39. Newell, A. 1982. "The Knowledge Level." Artificial Intelligence 18(1): 87–127.

40. Noy, N., Y. Gao, A. Jain, A. Narayanan, A. Patterson, and J. Taylor 2019. "Industry-Scale Knowledge Graphs: Lessons and Challenges." Communications of the ACM 62(8): 36–43.

41. Pah, A., D. Schwartz, S. Sanga, C. Alexander, K. Hammond, and L. Amaral 2022. "The Promise of AI in an Open Justice System." AI Magazine 43(1): 69–74.

42. Peng, P., L. Zou, M. T. Özsu, and D. Zhao 2018. "Multi-Query Optimization in Federated RDF Systems." In International Conference on Database Systems for Advanced Applications, 745–65. Cham: Springer.

43. Pérez, J., M. Arenas, and C. Gutierrez 2009. "Semantics and Complexity of SPARQL." ACM Transactions on Database Systems (TODS) 34(3): 1–45.

44. Robinson, I., J. Webber, and E. Eifrem 2015. "Graph Databases: New Opportunities for Connected Data. North Sebastopol, CA: O'Reilly Media, Inc.

45. Sequeda, J. F., and O. Lassila 2021. Designing and Building Enterprise Knowledge Graphs. Williston, VT: Morgan and Claypool Publishers.

46. Sap, M., R. Le Bras, E. Allaway, C. Bhagavatula, N. Lourie, H. Rashkin, B. Roof, N. A. Smith, and Y. Choi 2019. "Atomic: An Atlas of Machine Commonsense for If-Then Reasoning." In Proceedings of the AAAI Conference on Artificial Intelligence 33(1): 3027–35.

47. Sowa, J. F. 2008. "Conceptual graphs." Foundations of Artificial Intelligence 3: 213–37.

48. Taylor, R. W., and R. L. Frank 1976. "CODASYL Data-Base Management Systems." ACM Computing Surveys (CSUR) 8(1): 67–103.

49. Vrandečić, D., and M. Krötzsch 2014. "Wikidata: A Free Collaborative Knowledgebase." Communications of the ACM 57(10): 78–85.

50. Waagmeester, A., E. L. Willighagen, A. I. Su, M. Kutmon, J. E. L. Gayo, D. Fernández-Álvarez, Q. Groom, P. J. Schaap, L. M. Verhagen, and J. J. Koehorst 2021. "A Protocol for Adding Knowledge to Wikidata: Aligning Resources on Human Coronaviruses." BMC Biology 19(1): 1–14.

51. Wang, K., Zhihong, S., Chiyuan, H., Chieh-Han, W., Yuxiao, D., and Anshul, K. "Microsoft academic graph: When experts are not enough." Quantitative Science Studies 1, no. 1 (2020): 396–413.

52. Wang, Y., Y. E. Xu, X. Li, X. L. Dong, and J. Gao 2020. "Automatic Validation of Textual Attribute Values in E-Commerce Catalog by Learning with Limited Labeled Data." In Proceedings of the 26th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining 2533–41.

53. Woods, W. A. 1975. "What's in a Link: Foundations for Semantic Networks." In Representation and Understanding, 35–82. San Mateo, CA: Morgan Kaufmann.

54. Wu, F., R. Hoffmann, D. S. Weld 2008. "Information Extraction from Wikipedia: Moving Down the Long Tail." In Proceedings of the 14th ACM SIGKDD International Conference on Knowledge Discovery and Data Mining 731–9.

55. Yan, J., N. Zalmout, Y. Liang, C. Grant, X. Ren, and X. L. Dong 2021. "AdaTag: Multi-Attribute Value Extraction from Product Profiles with Adaptive Decoding." arXiv preprint arXiv:2106.02318.

56. Zheng, G., S. Mukherjee, X. L. Dong, and F. Li 2018. "Opentag: Open Attribute Value Extraction from Product Profiles." In Proceedings of the 24th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining 1049–58.

57. Zhu, Y., O. Groth, M. Bernstein, and L. Fei-Fei 2016. "Visual7w: Grounded Question Answering in Images." In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition 4995–5004.

## 作者简介

**Vinay K. Chaudhri** 目前是摩根大通公司的执行董事，致力于金融服务行业的人工智能。在本文进行时，他是斯坦福大学计算机科学系的访问讲师。在此之前，他在SRI International工作，参与了创建智能教科书的Project Halo和后来被拆分为SIRI并被苹果收购的Project Calo。

**Chaitanya Baru** 是加州大学圣地亚哥分校圣地亚哥超级计算机中心的杰出科学家。从2014年到2018年，他是美国国家科学基金会数据科学高级顾问，为包括BIGDATA、大数据中心、TRIPODS、数据科学军团在内的数据项目提供领导。从2019年到2021年，他是融合加速器的高级顾问，也是建立该计划的团队成员。

**Naren Chittar** 是摩根大通董事总经理兼AI核心服务主管。他创立了Minhash，这是一家于2015年被Salesforce收购的NLP初创公司。在此之前，他共同创建了e-Bay的第一个大规模相似商品推荐引擎和图像搜索技术。

**Xin Luna Dong** 是Meta AR/VR助手的首席科学家。在此之前，她是亚马逊的高级首席科学家，领导构建亚马逊产品知识图谱的努力。她合著了《机器知识：综合知识库的创建和策展》和《大数据集成》书籍，获得了ACM杰出会员和VLDB早期职业研究贡献奖，是KDD 2022、WSDM 2022和VLDB 2021的PC联席主席。

**Michael Genesereth** 是斯坦福大学计算机科学系的教授，同时也是斯坦福法学院的客座教授。他最著名的工作是在计算逻辑及其在企业管理、计算法律和一般游戏博弈中的应用。

**James Hendler** 是伦斯勒理工学院（RPI）数据探索与应用研究所所长和计算机、网络与认知科学Tetherless World教授。他还担任RPI-IBM人工智能研究协作的代理主任，并担任英国慈善Web Science Trust董事会主席。Hendler在语义网、人工智能、基于代理的计算和高性能处理领域撰写了超过400本书籍、技术论文和文章。

**Aditya Kalyanpur** 是Elemental Cognition的机器学习和自然语言处理总监。此前，他是IBM Watson问答系统的关键开发者之一，该系统在2011年赢得了Jeopardy！挑战，并因此获得了AAAI Feigenbaum奖。

**Douglas B. Lenat** 是世界领先的计算机科学家之一，Cyc项目和Cycorp的创始人。Lenat博士曾是卡内基梅隆大学和斯坦福大学的计算机科学教授，获得了两年一度的IJCAI计算机与思想奖，这是人工智能领域的最高荣誉。他是人工智能促进协会（AAAI）的第一位Fellow；是美国科学促进会（AAAS）和认知科学学会的Fellow，也是唯一同时担任微软和苹果科学顾问委员会成员的人。

**Juan Sequeda** 是data.world的首席科学家。他通过收购Capsenta加入该公司，这是他从德克萨斯大学奥斯汀分校计算机科学博士研究中创立的衍生公司。他的目标是从不可理解的数据中可靠地创建知识。

**Denny Vrandečić** 在维基媒体基金会从事Abstract Wikipedia工作。此前，他是谷歌的本体论学家，维基媒体基金会董事会受托人，Wikidata创始人，Semantic MediaWiki的共同开发者，也是"Das Schwarze Auge"几个RPG模块的作者。

**Kuansan Wang** 是微软搜索的合作伙伴架构师。此前，他是微软研究院（MSR）外展董事总经理，负责微软学术服务（MAS）。

## 如何引用本文

Chaudhri, V. K., C. Baru, N. Chittar, X. L. Dong, M. Genesereth, J. Hendler, A. Kalyanpur, D. Lenat, J. Sequeda, D. Vrandečić, and K. Wang 2022. "Knowledge graphs: Introduction, history, and perspectives." AI Magazine 43: 17–29. https://doi.org/10.1002/aaai.12033

---

**翻译说明**：
- 本翻译遵循原文的结构和内容组织
- 保留了所有图表引用和技术术语
- 对人名和机构名称采用标准翻译
- 技术术语保持一致性
- 参考文献和作者信息完整保留
- 翻译力求准确传达原文的学术含义