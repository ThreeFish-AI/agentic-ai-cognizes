# 嵌套学习：深度学习架构的幻觉

Ali Behrouz - alibehrouz@google.com

Meisam Razaviyayn - razaviyayn@google.com

Peiling Zhong - peilinz@google.com

Vahab Mirrokni - mirrokni@google.com

# 摘要

在过去的几十年中，开发更强大的神经架构并同时设计优化算法来有效训练它们，一直是增强机器学习模型能力的研究核心。尽管最近取得了进展，特别是在开发语言模型（LMs）方面，关于这类模型如何持续学习/记忆、自我改进并找到"有效解决方案"仍然存在基本挑战和未解问题。在本文中，我们提出了一种新的学习范式，称为嵌套学习（NL），它将模型一致地表示为一组嵌套的、多层次的和/或并行的优化问题，每个问题都有自己的"情境流"。NL 揭示了现有的深度学习方法通过压缩其自身的情境流来从数据中学习，并解释了情境学习如何在大型模型中出现。NL 为设计具有更多"层次"和更强表达能力的学习算法指明了一条道路（深度学习的新维度）。除了其在神经科学上合理和数学上白盒的特性外，我们通过三个核心贡献来论证其重要性：(1) 深度优化器：基于 NL，我们证明了著名的基于梯度的优化器（如 Adam、带动量的 SGD 等）实际上是联想记忆模块，旨在通过梯度下降压缩梯度。基于这一见解，我们提出了一系列具有深度记忆和/或更强大学习规则的更表达能力强的优化器；(2) 自修改泰坦：利用 NL 对学习算法的见解，我们提出了一种新颖的序列模型，通过学习自己的更新算法来学习如何修改自身；(3) 连续记忆系统：我们为记忆系统提出了一个新的公式，它推广了"长期/短期记忆"的传统观点。将我们的自修改序列模型与连续记忆系统相结合，我们提出了一个名为 HOPE 的学习模块，在语言建模、持续学习和长情境推理任务中显示出有希望的结果。

1

# 引言

本文版本已广泛摘要以适应 NeurIPS 定稿页数限制，一些材料、实验、讨论和方法已移至附录，这可能使某些部分难以遵循或导致不一致。为避免此类情况，请阅读我们的 arXiv 版本[1]（将于 11 月 13 日提供）。

第 39 届神经信息处理系统会议（NeurIPS 2025）。

![图1](images/figure1_brain_structure.png)

_图 1：大脑中统一和可复用的结构以及多时间尺度更新是解锁人类持续学习的关键组成部分。嵌套学习（NL）允许大脑的每个组件进行多时间尺度更新，同时显示像 Transformer 这样的著名架构实际上是具有不同频率更新的线性层。_

几十年来，人工智能研究一直专注于设计从数据[2-5]或经验[6-8]中学习的机器学习算法；通常通过基于梯度方法优化参数 θ ∈Θ 上的目标函数 L(θ)。虽然传统机器学习技术需要精心工程和领域专业知识来设计特征提取器，限制了它们直接处理和从自然数据中学习的能力[9]，但深度表示学习提供了一种完全自动化的替代方案来发现任务所需的表示。此后，深度学习一直是大尺度计算模型不可或缺的一部分，在化学和生物学[10]、游戏[11,12]、计算机视觉[13,14]以及多模态和自然语言理解[15-17]方面取得了开创性成功。

堆叠多个层次，就像在深度学习模型中所做的那样，为模型提供了更大的容量、更好的表示复杂特征的表达能力，以及更多的内部计算（例如，#FLOPS）[18-20]，所有这些都是静态任务的关键和理想特征，这些任务需要对先前固定集合进行分布内预测。然而，这种深度设计并不是所有挑战的通用解决方案，也不能在多个方面增强模型的表达能力，例如：(i) 深度模型的计算深度可能不会随着更多层次而改变[21,22]，这使得它们实现复杂算法的能力与传统浅层方法相比保持不变[23]；(ii) 某类参数的容量可能显示随着增加模型的深度/宽度而边际改进[24]；(iii) 训练过程可能收敛到次优解，主要是由于优化器的次优选择或其超参数；(iv) 模型快速适应新任务、持续学习和/或泛化到分布外数据的能力可能不会通过堆叠更多层而改变，需要更仔细的设计。

克服上述挑战和增强深度学习能力努力的核心集中在：(1) 开发更具表达能力的参数类别（即神经架构）[13,25-28]；(2) 引入能更好地建模任务的目标[29-32]；(3) 设计更有效/高效的优化算法以找到更好的解决方案或更具抗遗忘性[33-36]；(4) 在做出架构、目标和优化算法的"正确"选择时，扩大模型大小以增强其表达性[24,37,38]。总的来说，这些进展和关于深度模型缩放模式的新发现已经建立了大型语言模型（LLMs）赖以建立的基础。

LLMs 的发展标志着深度学习研究的一个关键里程碑：从任务特定模型到更通用系统的范式转变，具有各种作为缩放"正确"架构[38,39]结果的新兴能力。尽管它们在多样化任务集[15,40,41]中取得了所有成功和卓越能力，但 LLMs 在初始部署阶段后很大程度上是静态的，这意味着它们成功地执行在预训练或后训练期间学习的任务，但无法持续获得超出其直接情境的新能力。LLMs 唯一可适应的组件是它们情境学习的能力——这是 LLMs 的一个（已知是新兴的）特征，它使快速适应情境成为可能，从而执行零样本或少样本任务[38]。除了情境学习之外，最近克服 LLMs 静态性的努力要么是计算昂贵的，需要外部组件，缺乏泛化性，和/或可能遭受灾难性遗忘[42-44]，这使研究人员质疑是否需要重新审视如何设计机器学习模型，以及是否需要超越层堆叠的新学习范式来在持续设置中释放 LLMs 的能力。

当前模型仅体验直接当下。作为类比，为了更好地说明 LLMs 的静态性，我们使用前向遗忘症的例子——一种神经状况，患者在疾病发作后无法形成新的长期记忆，而现有记忆保持完整[45]。这种情况将人的知识和经验限制在短暂的现实窗口和长远的过去——疾病发作之前——这导致持续体验直接当下，就好像它总是新的。当前 LLMs 的记忆处理系统也有类似模式。它们的知识仅限于适合其情境窗口的直接情境，或存储在 MLP 层中代表疾病发作前"预训练结束"的遥远过去的知识。这个类比激励我们从神经生理学文献中汲取灵感

## 以及大脑如何巩固其短期记忆：

### 1.1 人脑视角和神经生理学动机

人脑在持续学习（也称为有效情境管理）方面高度高效和有效，这通常归因于神经可塑性——大脑响应新经验、记忆、学习甚至损伤改变自身的卓越能力[46,47]。

最近的研究支持长期记忆的形成涉及至少两个不同但互补的巩固过程[48-50]：(1) 快速的"在线"巩固（也称为突触巩固）阶段立即或在学习后很快发生，甚至在清醒期间。这是当新的最初脆弱的记忆痕迹被稳定化并开始从短期转移到长期存储时；(2) "离线"巩固（也称为系统巩固）过程重复最近编码模式的回放——在海马体的锋波涟漪（SWRs）期间，与皮层睡眠纺锤波和慢振荡协调——加强和重组记忆并支持向皮层部位转移[51-53]。

回到前向遗忘症的类比，证据表明这种情况可能影响两个阶段，但特别是在线巩固阶段，主要原因是海马体是编码新陈述性记忆的通道，因此其损伤意味着新信息永远不会存储在长期记忆中。如上所述，LLMs 的设计，更具体地说是基于 Transformer 的骨干，在预训练阶段后也遭受类似状况。也就是说，情境中提供的信息永远不会影响长期记忆参数（例如，前馈层），因此模型无法获得新知识或技能，除非信息仍存储在短期记忆中（例如，注意力）。为此，虽然第二阶段对记忆的巩固同等甚至更重要，其缺失可能损害过程并可能导致记忆丧失[54,55]，但在本工作中，我们专注于第一阶段：记忆巩固作为在线过程。我们在附录 A 中提供了关于人脑视角及其与 NL 联系的额外讨论。

符号表示。我们让 x ∈RN×din 表示输入，Mt 表示时间 t 时记忆/模型 M 的状态，K 表示键，V 表示值，Q 表示查询矩阵。我们使用带下标 t 的粗体小写字母来引用对应输入 t 的向量（即 kt, vt, 和 qt）。我们进一步将任何实体 f 的分布称为 p(f)。通过本文，我们使用具有 LM≥1 层和残差连接的简单 MLPs 作为记忆模块 M(·)的架构。在需要时，我们用 θM ⊇{W1, W2, . . . , WLM}参数化记忆模块，至少包括 MLP 中线性层的参数。我们使用括号内的上标来引用嵌套学习不同层次（不同更新频率）的参数：即 W(ℓ)。

2

# 嵌套学习

本节讨论嵌套学习（NL）的动机、形式定义和一般高级含义。我们从联想记忆的公式开始，然后通过逐步示例，构建架构分解背后的直觉及其与将神经网络建模为优化问题集成系统的联系。我们首先展示深度学习中的现有方法和概念如何属于 NL 范式，然后我们提出超越传统方法和/或提供如何改进现有算法和设计见解的新公式。

![图2](images/figure2_nested_learning_paradigm.png)

_图 2：嵌套学习范式，将机器学习模型及其训练过程表示为一组嵌套的优化问题。（左）混合架构示例。虽然深度学习视角作为 NL 的扁平化图像没有提供关于块中计算深度的见解，但 NL 透明地表示所有内部梯度流。（右）神经学习模块：学习如何压缩自身情境流的计算模型。例如，第一层次对应于模型的最外层训练，通常称为"预训练"步骤。_

### 2.1 联想记忆

联想记忆——形成和检索事件之间联系的能力——是一种基本的心理过程，是人类学习不可或缺的组成部分[56]。在文献中，记忆和学习的概念经常互换使用；然而，在神经心理学文献中，这两者被明确区分。更具体地说，遵循神经心理学文献[57]，我们基于以下记忆和学习的定义构建我们的术语体系：

## 学习 vs. 记忆：

记忆是由输入引起的神经更新，学习是获得有效和有用记忆的过程。

在这项工作中，我们的目标是首先展示计算序列模型的所有元素，包括优化器和神经网络，都是压缩其自身情境流的联想记忆系统。广义上讲，联想记忆是一个将一组键映射到一组值的操作符。我们遵循 Behrouz 等人[58]对联想记忆的一般定义：

**定义 1（联想记忆）。**给定一组键 K ⊆Rdk 和值 V ⊆Rdv，联想记忆是一个操作符 M : K →V，它映射两组键 K 和值 V。要从数据中学习这样的映射，一个目标 ˜L(·; ·)测量映射的质量，M 可以定义为：
M∗= arg min
M
˜L(M(K); V)。
(1)

虽然操作符本身是一个记忆，映射充当记忆过程（即记忆情境中事件的联系），但基于数据获得这样的有效操作符是一个学习过程。值得注意的是，这里键和值可以是记忆旨在映射的任意事件，不限于 token。在本节后面，我们将讨论给定情境流，键和值可能是 token、梯度、子序列等。此外，虽然联想记忆这个术语在神经科学和神经心理学文献中更常见，但上述公式也与数据压缩和低维表示密切相关。也就是说，可以将公式 1 中的优化过程解释为网络 M(.)的训练过程，它旨在将映射压缩到其参数中，从而在更低维空间中表示它们。

在序列建模中，键和值是输入 token（例如，token 化的文本），目标和优化公 1 过程的选择可能导致不同的序列

4

建模架构（见[59]和[58]），如全局/局部 softmax 注意力[27]或其他现代循环模型[28,60,61]。这种序列模型的简单公式为我们提供了更好的理解它们内部过程的工具，也是一个基于它们的目标和优化过程简单比较其建模能力的工具。在下面，通过逐步示例，我们讨论这个公式如何应用于神经架构的所有组件（包括它们在预训练中的优化过程），实际上，模型是如何成为一个多层次、嵌套和/或并行记忆的集成系统，每个记忆都有自己的情境流。

MLP 训练的简单示例。我们从一个简单示例开始，我们的目标是通过优化目标 L(·; ·)和数据集 Dtrain = {x1, . . . , x|Dtrain|}来训练 1 层 MLP（用 W 参数化）用于任务 T。在这种情况下，训练过程等价于以下优化问题：
W ∗= arg min
W
L(W; Dtrain),
(2)
通过梯度下降优化导致等价于以下公式的权重更新规则：
Wt+1 = Wt −ηt+1∇WtL(Wt; xt+1)
(3)
= Wt −ηt+1∇yt+1L(Wt; xt+1) ⊗xt+1,
其中 xt+1 ∼Dtrain,
(4)
其中 yt+1 = Wxt+1 是模型对输入 xt+1 的输出。给定这个公式，可以让 ut+1 = ∇yt+1L(Wt; xt+1)并将反向传播过程重新表述为寻找最优联想记忆的优化问题的解，该记忆将输入数据点 Dtrain = {xt}|Dtrain|t=1 映射到它们对应的 ut+1 = ∇yt+1L(Wt; xt+1)。也就是说，我们让 M(·) = Wt ·参数化记忆，并使用点积相似性来测量 Wt 在 xt+1 和 ∇yt+1L(Wt; xt+1)之间映射的质量：
Wt+1 = arg min
W
⟨Wxt+1, ut+1⟩+
1
2ηt+1
∥W −Wt∥2
2
(5)
= arg min
W
⟨Wxt, ∇yt+1L(Wt; xt+1)⟩+
1
2ηt+1
∥W −Wt∥2 2.
(6)
在上述公式中，ut+1 = ∇yt+1L(Wt; xt+1)可以解释为表示空间中的局部意外信号，它量化当前输出与目标 L(·; ·)强加的结构之间的不匹配。因此，这个公式将模型的训练阶段翻译为获得有效记忆的过程，该记忆将数据样本映射到它们在表示空间中的局部意外信号（LSS）——定义为当前输出与目标 L(·; ·)强加的结构之间的不匹配。因此，在这个示例中，我们的模型在数据样本上具有单梯度流，它仅在数据集 Dtrain = {x1, . . . , x|Dtrain|}上活跃，之后对任何其他数据样本将被冻结（也称为推理或测试时间）。

接下来，在上述示例中，我们用其增强的基于动量的变体替换梯度下降算法，导致以下更新规则：
Wt+1 = Wt −mt+1,
(7)
mt+1 = mt −ηt+1∇WtL(Wt; xt+1) = mt −ηt+1∇yt+1L(Wt; xt+1) ⊗xt+1.
(8)
在公式 8 中，给定公式 7 的前一状态（在时间 t），∇WtL(Wt; xt+1)或类似地 ∇yt+1L(Wt; xt+1)的值独立于公式 8 中的递归，因此可以预先计算。为此，我们让 ut+1 = ∇WtL(Wt; xt+1)，所以公式 8 可以重新表述为：
Wt+1 = Wt −mt+1,
(9)
mt+1 = arg min
m
−⟨m, ∇WtL(Wt; xt+1)⟩+ ηt+1 ∥m −mt∥2
2
(10)
= arg min
m
−⟨m xt+1, ∇yt+1L(Wt; xt+1)⟩+ ηt+1 ∥m −mt∥2
2,
(11)
其中公式 10 中的优化问题等价于具有自适应学习率 ηt+1 的梯度下降一步。给定这些公式，可以将动量项解释为：(1) 将梯度压缩到其参数中的无键联想记忆，或(2) 学习如何将数据点映射到其对应 LSS 值的联想记忆。有趣的是，这个公式揭示了带动量的梯度下降实际上是一个两层

5

优化过程，其中记忆通过简单梯度下降算法进行优化。这个过程与快速权重程序（FWPs）[62]密切相关，其中权重更新过程（即公式 9）是慢网络，其动量权重由快速网络生成（即公式 10）。

总结上述示例，我们观察到 1 层 MLP 的训练过程：(1) 梯度下降是学习如何将数据点映射到其对应 LSS 值的 1 层联想记忆；(2) 带动量的梯度下降是 2 层联想记忆（或优化过程），其中内层学习将梯度值存储到其参数中，然后外层用内层记忆的值更新慢权重（即 Wt）。

虽然这些是关于架构和优化算法的最简单示例，但人们可能会问是否可以在更复杂的设置中得出类似的结论。

架构分解示例。在下一个示例中，我们用线性注意力[60]替换 MLP 模块。也就是说，我们旨在通过优化目标 L 和梯度下降为任务 T 训练 1 层线性注意力，数据序列为 Dtrain = {x1, . . . , x|Dtrain|}。回忆非归一化线性注意力公式：
kt = xtWk,
vt = xtWv,
qt = xtWq,
(12)
Mt = Mt−1 + vtk⊤t ,
(13)
yt = Mtqt .
(14)

如早期研究[58,59]所讨论的，公式 13 中的递归可以重新表述为矩阵值联想记忆 Mt(·)的优化过程，其中它旨在将键和值的映射压缩到其参数中。更详细地说，在定义 1 中，如果我们让 ˜L(Mt−1; kt, vt) := −⟨Mt−1kt, vt⟩并旨在用梯度下降优化记忆，记忆更新规则是：（注意 ∇˜L(Mt−1; kt, vt) = vtk⊤t ，我们让学习率 ηt = 1）
Mt+1 = arg min
M
⟨Mkt+1, vt+1⟩+ ∥M −Mt∥2
2
通过梯度下降,
(15)
⇒Mt+1 = Mt −∇˜L(Mt; kt+1, vt+1) = Mt + vt+1k⊤t+1,
(16)
这等价于公式 13 中非归一化线性注意力的更新规则。另外，请注意，正如我们在第一个示例中观察到的，用梯度下降训练线性层是联想记忆的 1 层优化问题（见公式 3），因此投影层（即 Wk, Wv, 和 Wq）的一般训练/更新过程本身是联想记忆的优化过程。因此，这个设置，即用梯度下降训练线性注意力，可以看作是一个两层优化过程，其中外循环（也称为训练过程）用梯度下降优化投影层，而内循环用梯度优化 Mt 的内部记忆。

注意，如上所述，这里我们有两个联想记忆，因此每个都有自己的优化过程和梯度流。也就是说，在 Wk, Wv, 和 Wq 的外层参数优化中，没有关于参数 M(·)的梯度，因此没有通过它的反向传播。类似地，在内层，没有通过投影层的反向传播，它们被认为是冻结的。此外，值得注意的是，在这个示例中，上述公式也与线性注意力的 FWPs 视角[63]密切相关，其中投影被认为是慢权重，公式 13 中的记忆更新是快速权重更新规则。

更多层次的架构分解。在上述两个示例中，我们讨论了简单情况，它们可以转换为 2 层优化过程，这也与它们的 FWPs 解释一致。然而，在实践中，我们需要使用更强大的优化算法来训练模型，和/或为记忆使用更强大的循环更新规则。作为简单示例，假设我们使用带动量的梯度下降来训练线性注意力模型。在上述示例中，我们展示了如何将线性注意力组件分解为两个嵌套的优化问题。类似地，这里模型可以表示为 2 层优化问题，其中(1) 内层优化记忆以使用梯度下降压缩情境（见公式 15），(2) 外层用带动量的梯度下降优化投影层。有趣的是，从第一个示例中，我们知道"带动量的梯度下降"算法本身实际上是一个 2 层优化问题，其中动量项本身是将过去梯度压缩到其参数中的联想记忆。

6

### 2.2 嵌套优化问题

在前一节中，我们提供了示例来展示如何将机器学习模型分解为一组嵌套或多层次的优化问题。接下来，我们首先旨在为嵌套学习问题提出形式公式，然后定义神经学习模块——一个从数据中学习的集成计算系统。

正如我们在前一节观察到的，虽然我们将模型分解为一组优化过程，但仍然不清楚我们是否可以定义这些问题上的层次（或顺序），并以这种格式唯一表示模型。受到表示每个部分信息处理频率率的大脑波层次结构的启发（在第 1 节讨论），我们使用每个优化问题的更新率来在多个层次中对组件进行排序。为此，我们让一个数据点上的一个更新步骤为时间单位，并定义每个组件的更新频率率为：

**定义 2（更新频率）。**对于 A 的任何组件，它可以是参数组件（例如，可学习权重或带动量梯度下降中的动量项）或非参数组件（例如，注意力块），我们定义其频率，表示为 fA，作为其每单位时间的更新次数。

给定上述更新频率，我们可以基于操作符（· ≻·）对机器学习算法的组件进行排序。我们让 A 比 B 快并表示 A ≻B 如果：(1) fA > fB，或(2) fA = fB 但 B 在时间 t 的状态计算需要 A 在时间 t 的状态计算。在这个定义中，当 A ⊁B 且 B ⊁A 时，我们让 Af= B，这表示 A 和 B 具有相同的频率更新，但它们的计算彼此独立（稍后我们在 AdamW 优化器中提供这种情况的示例）。基于上述操作符，我们将组件排序为"层次"的有序集合，其中(1) 相同层次中的组件具有相同的频率更新，(2) 层次越高，其频率越低。值得注意的是，基于上述定义，每个组件都有自己的优化问题和情境。虽然我们用基于梯度的优化器优化组件的内部目标，但上述陈述等价于在模型中为每个组件提供独占的梯度流。然而，在一般情况下，可以使用非参数解决方案（正如我们稍后讨论注意力的那样）。

神经学习模块。给定嵌套学习问题的上述定义，我们将神经学习模块定义为机器学习模型的新表示方式，它将模型显示为组件的互联系统，每个组件都有自己的梯度流。请注意，与深度学习正交，嵌套学习允许我们定义具有更多层次的神经学习模型，从而产生更具表达力的架构。

嵌套学习允许由多个（多层）层次组成的计算模型以不同层次的抽象和时间尺度从数据中学习和处理数据。

接下来，我们从嵌套学习视角研究优化器和著名的深度学习架构，并提供示例说明 NL 如何帮助增强这些组件。

### 2.3 优化器作为学习模块

在本节中，我们首先了解著名的优化器及其变体如何是嵌套学习的特殊实例。回忆带动量的梯度下降方法：
Wi+1 = Wi + mi+1
mi+1 = αi+1mi −ηt∇L (Wi; xi) ,
(17)
其中矩阵（或向量）mi 是状态 i 时的动量，αi 和 ηi 分别是自适应学习和动量率。假设 αi+1 = 1，动量项可以看作是通过梯度下降优化以下目标的结果：
min
m
⟨m ∇L(Wi; xi)⊤, I⟩.
(18)
这种解释表明动量确实可以被视为一个元记忆模块，学习如何将目标的梯度记忆到其参数中。基于这一直觉，我们在

7

附录 C.4 中展示 Adam 经过小修改是模型梯度的最优联想记忆。接下来，我们展示这种视角如何导致设计更具表达力的优化器：

扩展：更具表达力的关联。如前所述，动量是无值的联想记忆，因此表达能力有限。为了解决这个问题，遵循联想记忆的原始定义（即将键映射到值），我们让值参数 vi = Pi，因此动量旨在最小化：
min
m
⟨m ∇L(Wi; xi)⊤, Pi⟩,
(19)
使用梯度下降，导致更新规则：
Wi+1 = Wi + mi+1
mi+1 = αi+1mi −ηtPi∇L (Wi; xi) .
(20)
这个公式等价于使用动量 GD 的预条件。实际上，预条件意味着动量项是学习如何压缩 Pi 和梯度项 ∇L(Wi; xi)之间映射的联想记忆。虽然任何合理的预条件选择（例如，随机特征）都可以改进 GD 初始版本的表达能力，但动量本身是无值记忆（即将所有梯度映射到单个值），上述视角为哪些预条件更有用提供了更多直觉。也就是说，动量充当记忆，旨在将梯度映射到它们对应的值，因此梯度的函数（例如，关于 Hessian 的信息）可以为记忆提供更有意义的映射。

扩展：更具表达力的目标。如 Behrouz 等人[58]所讨论的，优化点积相似性的内部目标导致 Hebbian 类更新规则，这可能使记忆效果较差。这个内部目标的自然扩展是使用 ℓ2(·)回归损失（用于测量相应键值映射适应性）并最小化损失函数 ∥m∇L(Wi; xi)⊤−Pi∥2
2，导致以下更新规则：
Wi+1 = Wi + mi+1,
(21)
mi+1 =
αi+1I −∇L (Wi; xi)⊤∇L (Wi; xi)
mi −ηtPi∇L (Wi; xi) ,
(22)
这个更新基于 delta 规则[64]，因此它允许记忆（动量）更好地管理其有限容量并更好地记忆一系列过去梯度。

扩展：更具表达力的记忆。如前所述，动量可以被视为元记忆模型，它使用线性层（即矩阵值）来压缩过去梯度值。由于动量的线性性质，只能通过其内部目标学习过去梯度的线性函数。为了增加这个模块的学习容量，一个替代方案是使用替代的强大持久学习模块：即用 MLP 替换动量的线性矩阵值记忆。因此，作为过去梯度记忆的动量，有更多容量来捕获梯度的底层动态。为此，我们将公式 17 中的公式扩展为：
Wi+1 = Wi + mi+1 (ui) ,
和
mi+1 = αi+1mi −ηt∇L(2)(mi; ui, I),
(23)
其中 ui = ∇L (Wi; xi)和 ∇L(2)(·)是动量的内部目标（例如，点积相似性⟨m(u⊤i ), 1⟩）。我们将此变体称为深度动量梯度下降（DMGD）。

扩展：非线性输出。基于上述视角，我们将动量视为神经架构，增强动量记忆模块表示能力的一个常用技术是在其输出上使用非线性[28,65]。也就是说，我们将公式 23 重新表述为：
Wi+1 = Wi + σ (mi+1 (ui)) ,
和
mi+1 = αi+1mi −ηt∇L(2)(mi; ui, I),
(24)
其中 σ(·)是任意非线性。作为示例，我们让 σ(·) = Newton-Schulz(·)，其中 Newton-Schulz(·)是迭代 Newton-Schulz 方法[66]，m(·)是线性层；得到的优化器等价于 Muon 优化器[34]。

8

超越简单反向传播。如前面 2.1 节所讨论的，预训练过程和反向传播是一种联想记忆形式，其中输入数据映射到其预测输出引起的意外 ∇ytL(Wt; xt)：
Wt+1 = Wt −ηt+1∇WtL(Wt; xt) = Wt −ηt+1∇ytL(Wt; xt) ⊗xt,
其中 xt ∼Dtrain, (25)
从联想记忆视角，这等价于以下优化过程中的一步梯度下降：
min
W
⟨Wxt, ∇ytL(Wt; xt)⟩.
(26)
正如我们在附录 C 中讨论的，上述公式导致忽略像 xt 这样的数据样本的依赖关系。为了将其扩展到更强大的公式，它也考虑数据点的依赖关系（当我们在 token 空间中使用优化器时这极其重要，因为它们不是独立的），我们使用具有一步梯度下降的 L2 回归目标如下：
min
W
∥Wxt −∇ytL(Wt; xt)∥2 2.
(27)
这个公式导致梯度下降的新变体，可以简化如下：

# Wt+1 = Wt

I −xtx⊤t
−ηt+1∇WtL(Wt; xt)
(28)
= Wt
I −xtx⊤t
−ηt+1∇ytL(Wt; xt) ⊗xt,
其中 xt ∼Dtrain,
(29)
稍后，我们使用这个优化器作为我们 HOPE 架构的内部优化器。

3

# HOPE：具有连续记忆的自指涉学习模块

现有架构骨干包括(1) 工作记忆模块（例如，注意力），它负责在序列长度上主动融合信息，和(2) 前馈层（例如，MLP），它在特征上融合信息并充当预训练阶段的持久记忆或知识存储。从 NL 视角，预训练是最外层学习模块在其有限情境流上更新的阶段。因此，在持续设置中，这种预训练阶段也很少随时间更新，因此其对应的知识存储需要很少随时间更新。基于这种直觉，我们扩展了长期/短期记忆系统的传统观点，并为每个层次（频域）建议一个知识存储前馈。

给定频率的定义，连续记忆系统（CMS）被形式化为 MLP 块链 MLP(f1)(·), . . . , MLP(fk)(·)，每个块与块大小 C(ℓ) := maxℓC(ℓ)
fℓ
相关联，使得给定输入 x = {x1, . . . , xT}，链的输出计算如下（为清晰起见忽略归一化）：
yt = MLP(fk)(MLP(fk−1)(· · · MLP(f1)(xt))),
(30)
其中第 ℓ 个 MLP 块的参数，即 θ(fℓ)，每 C(ℓ)步更新一次：
θ(fℓ)
i+1 = θ(fℓ)
i
−
(Pi
t=i−C(ℓ) η(ℓ)
t f(θ(fℓ)
t
; xt)
如果 i ≡0 (mod C(ℓ)),
0
否则.
(31)
在附录 B.1 中，我们讨论了这个公式的不同变体，包括完全嵌套的 MLP 层。这里 η(ℓ)
t
是对应于 θ(fℓ)的学习率，f(·)是任意优化器的误差分量（例如，梯度下降中的 ∇L(θ(fℓ)
t
; xt)）。传统 Transformer 块[27]是这个公式的特殊实例，其中 k = 1。值得注意的是公式 31 提供了一个重要解释：参数 θ(fℓ)
t
负责将它们自己的情境压缩到它们的参数中，因此它们代表其情境的抽象知识。

HOPE。我们进一步提出基于 Titans[28]和 B.1 节中我们的梯度下降变体的自指涉学习模块。将这个自指涉序列模型与连续记忆系统相结合产生 HOPE 架构。

9

![图3](images/figure3_hope_architecture.png)

_图 3：Hope 架构骨干与 Transformer 的比较（为清晰起见，移除了归一化和潜在的数据依赖组件）。_

_表 1：HOPE 和基线在语言建模和常识推理任务上的表现。混合模型标有_。\*

| 模型              | Wiki. ppl ↓               | LMB. ppl ↓ | LMB. ppl ↓ | PIQA acc ↑ | Hella. acc_n ↑ | Wino. acc ↑ | ARC-e acc ↑ | ARC-c acc_n ↑ | SIQA acc ↑ | BoolQ acc ↑ | Avg. acc ↑ |
| ----------------- | ------------------------- | ---------- | ---------- | ---------- | -------------- | ----------- | ----------- | ------------- | ---------- | ----------- | ---------- |
| **HOPE (ours)**   | 26.05                     | 29.38      | 35.40      | 64.62      | 40.11          | 51.19       | 56.92       | 28.49         | 38.33      | 60.12       | 46.90      |
|                   | 760M params / 30B tokens  |
| **Transformer++** | 25.21                     | 27.64      | 35.78      | 66.92      | 42.19          | 51.95       | 60.38       | 32.46         | 39.51      | 60.37       | 48.69      |
| **RetNet**        | 26.08                     | 24.45      | 34.51      | 67.19      | 41.63          | 52.09       | 63.17       | 32.78         | 38.36      | 57.92       | 48.46      |
| **DeltaNet**      | 24.37                     | 24.60      | 37.06      | 66.93      | 41.98          | 50.65       | 64.87       | 31.39         | 39.88      | 59.02       | 48.97      |
| **TTT**           | 24.17                     | 23.51      | 34.74      | 67.25      | 43.92          | 50.99       | 64.53       | 33.81         | 40.16      | 59.58       | 47.32      |
| **Samba∗**        | 20.63                     | 22.71      | 39.72      | 69.19      | 47.35          | 52.01       | 66.92       | 33.20         | 38.98      | 61.24       | 51.08      |
| **Titans (LMM)**  | 20.04                     | 21.96      | 37.40      | 69.28      | 48.46          | 52.27       | 66.31       | 35.84         | 40.13      | 62.76       | 51.56      |
| **HOPE (ours)**   | 20.53                     | 20.47      | 39.02      | 70.13      | 49.21          | 52.70       | 66.89       | 36.05         | 40.71      | 63.29       | 52.26      |
|                   | 1.3B params / 100B tokens |
| **Transformer++** | 18.53                     | 18.32      | 42.60      | 70.02      | 50.23          | 53.51       | 68.83       | 35.10         | 40.66      | 57.09       | 52.25      |
| **RetNet**        | 19.08                     | 17.27      | 40.52      | 70.07      | 49.16          | 54.14       | 67.34       | 33.78         | 40.78      | 60.39       | 52.02      |
| **DeltaNet**      | 17.71                     | 16.88      | 42.46      | 70.72      | 50.93          | 53.35       | 68.47       | 35.66         | 40.22      | 55.29       | 52.14      |
| **Samba∗**        | 16.13                     | 13.29      | 44.94      | 70.94      | 53.42          | 55.56       | 68.81       | 36.17         | 39.96      | 62.11       | 54.00      |
| **Titans (LMM)**  | 15.60                     | 11.41      | 49.14      | 73.09      | 56.31          | 59.81       | 72.43       | 40.82         | 42.05      | 60.97       | 56.82      |
| **HOPE (ours)**   | 15.11                     | 11.63      | 50.01      | 73.29      | 56.84          | 60.19       | 72.30       | 41.24         | 42.52      | 61.46       | 57.23      |

4

# 实验

为节省空间，在主论文中，我们报告 HOPE 在语言建模和常识推理任务上的评估结果。然而，我们在附录中报告了大量结果，包括关于优化器的实验、情境学习的出现、HOPE 的持续学习能力、消融研究、长情境任务等。关于实验设置和使用的其他数据集的详细信息在附录 G 中。

**语言建模和常识推理。**我们遵循最近的序列建模研究[28,67,68]，并报告 HOPE 和基线在 340M、760M 和 1.3B 规模下的语言建模和常识推理下游任务的结果。这些结果报告在表 1 中。HOPE 在所有规模和基准任务中都表现出非常好的性能，优于 Transformer 和最近的现代循环神经网络，包括门控 DeltaNet 和 Titans。将 HOPE 与 Titans 和门控 DeltaNet 进行比较，我们可以看到基于情境动态改变键、值和查询投影以及深度记忆模块可以产生在基准结果中具有更低困惑度和更高准确率的模型。

10

# 参考文献

[1] Ali Behrouz, Meisam Razaviyayn, Peilin Zhong, and Vahab Mirrokni. Nested learning: The illusion of deep learning architectures. arXiv preprint arXiv.

[2] Walter Pitts. The linear theory of neuron networks: The dynamic problem. The bulletin of mathematical biophysics, 5:23–31, 1943.

[3] Warren S McCulloch. The brain computing machine. Electrical Engineering, 68(6):492–497, 1949.

[4] Warren S McCulloch and Walter Pitts. The statistical organization of nervous activity. Biometrics, 4(2):91–99, 1948.

[5] Arthur L Samuel. Some studies in machine learning using the game of checkers. IBM Journal of research and development, 3(3):210–229, 1959.

[6] David Silver and Richard S Sutton. Welcome to the era of experience. Google AI, 1, 2025.

[7] Richard S Sutton, Andrew G Barto, et al. Reinforcement learning: An introduction, volume 1. 1998.

[8] Jonathan H. Connell and Sridhar Mahadevan. Robot learning. Robotica, 17(2):229–235, 1999. doi: 10.1017/S0263574799271172.

[9] Yann LeCun, Yoshua Bengio, and Geoffrey Hinton. Deep learning. nature, 521(7553):436–444, 2015.

[10] John Jumper, Richard Evans, Alexander Pritzel, Tim Green, Michael Figurnov, Olaf Ronneberger, Kathryn Tunyasuvunakool, Russ Bates, Augustin Žídek, Anna Potapenko, et al. Highly accurate protein structure prediction with alphafold. nature, 596(7873):583–589, 2021.

[11] David Silver, Aja Huang, Chris J Maddison, Arthur Guez, Laurent Sifre, George Van Den Driessche, Julian Schrittwieser, Ioannis Antonoglou, Veda Panneershelvam, Marc Lanctot, et al. Mastering the game of go with deep neural networks and tree search. nature, 529(7587):484–489, 2016.

[12] David Silver, Thomas Hubert, Julian Schrittwieser, Ioannis Antonoglou, Matthew Lai, Arthur Guez, Marc Lanctot, Laurent Sifre, Dharshan Kumaran, Thore Graepel, et al. A general reinforcement learning algorithm that masters chess, shogi, and go through self-play. Science, 362(6419):1140–1144, 2018.

[13] Alex Krizhevsky, Ilya Sutskever, and Geoffrey E Hinton. Imagenet classification with deep convolutional neural networks. Advances in neural information processing systems, 25, 2012.

[14] Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, Dirk Weissenborn, Xiaohua Zhai, Thomas Unterthiner, Mostafa Dehghani, Matthias Minderer, Georg Heigold, Sylvain Gelly, Jakob Uszkoreit, and Neil Houlsby. An image is worth 16x16 words: Transformers for image recognition at scale. In International Conference on Learning Representations, 2021. URL https://openreview.net/forum?id=YicbFdNTTy.

[15] Gheorghe Comanici, Eric Bieber, Mike Schaekermann, Ice Pasupat, Noveen Sachdeva, Inderjit Dhillon, Marcel Blistein, Ori Ram, Dan Zhang, Evan Rosen, et al. Gemini 2.5: Pushing the frontier with advanced reasoning, multimodality, long context, and next generation agentic capabilities. arXiv preprint arXiv:2507.06261, 2025.

[16] Aixin Liu, Bei Feng, Bing Xue, Bingxuan Wang, Bochao Wu, Chengda Lu, Chenggang Zhao, Chengqi Deng, Chenyu Zhang, Chong Ruan, et al. Deepseek-v3 technical report. arXiv preprint arXiv:2412.19437, 2024.

[17] Josh Achiam, Steven Adler, Sandhini Agarwal, Lama Ahmad, Ilge Akkaya, Florencia Leoni Aleman, Diogo Almeida, Janko Altenschmidt, Sam Altman, Shyamal Anadkat, et al. Gpt-4 technical report. arXiv preprint arXiv:2303.08774, 2023.

11

[18] Guido Montúfar, Razvan Pascanu, Kyunghyun Cho, and Yoshua Bengio. On the number of linear regions of deep neural networks. Advances in neural information processing systems, 27, 2014.

[19] Ben Poole, Subhaneil Lahiri, Maithra Raghu, Jascha Sohl-Dickstein, and Surya Ganguli. Exponential expressivity in deep neural networks through transient chaos. Advances in neural information processing systems, 29, 2016.

[20] Joel Hestness, Sharan Narang, Newsha Ardalani, Gregory Diamos, Heewoo Jun, Hassan Kianinejad, Md Mostofa Ali Patwary, Yang Yang, and Yanqi Zhou. Deep learning scaling is predictable, empirically. arXiv preprint arXiv:1712.00409, 2017.

[21] William Merrill, Ashish Sabharwal, and Noah A Smith. Saturated transformers are constant-depth threshold circuits. Transactions of the Association for Computational Linguistics, 10:843–856, 2022.

[22] Clayton Sanford, Daniel Hsu, and Matus Telgarsky. Transformers, parallel computation, and logarithmic depth. In Forty-first International Conference on Machine Learning, 2024. URL https://openreview.net/forum?id=QCZabhKQhB.

[23] William Merrill, Jackson Petty, and Ashish Sabharwal. The illusion of state in state-space models. In Forty-first International Conference on Machine Learning, 2024. URL https://openreview.net/forum?id=QZgo9JZpLq.

[24] Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B Brown, Benjamin Chess, Rewon Child, Scott Gray, Alec Radford, Jeffrey Wu, and Dario Amodei. Scaling laws for neural language models. arXiv preprint arXiv:2001.08361, 2020.

[25] Juergen Schmidhuber and Sepp Hochreiter. Long short-term memory. Neural Computation MIT-Press, 1997.

[26] Kunihiko Fukushima. Neocognitron: A self-organizing neural network model for a mechanism of pattern recognition unaffected by shift in position. Biological cybernetics, 36(4):193–202, 1980.

[27] Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N
Gomez, Ł ukasz Kaiser, and Illia Polosukhin. Attention is all you need. In I. Guyon, U. Von Luxburg, S. Bengio, H. Wallach, R. Fergus, S. Vishwanathan, and R. Garnett, editors, Advances in Neural Information Processing Systems, volume 30. Curran Associates, Inc., 2017. URL https://proceedings.neurips.cc/paper_files/paper/2017/file/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf.

[28] Ali Behrouz, Peilin Zhong, and Vahab Mirrokni. Titans: Learning to memorize at test time. arXiv preprint arXiv:2501.00663, 2024.

[29] David E Rumelhart, Geoffrey E Hinton, and Ronald J Williams. Learning representations by back-propagating errors. nature, 323(6088):533–536, 1986.

[30] Ian Goodfellow, Jean Pouget-Abadie, Mehdi Mirza, Bing Xu, David Warde-Farley, Sherjil Ozair, Aaron Courville, and Yoshua Bengio. Generative adversarial networks. Communications of the ACM, 63(11):139–144, 2020.

[31] Shaden Alshammari, John Hershey, Axel Feldmann, William T Freeman, and Mark Hamilton. I-con: A unifying framework for representation learning. arXiv preprint arXiv:2504.16929, 2025.

[32] R Devon Hjelm, Alex Fedorov, Samuel Lavoie-Marchildon, Karan Grewal, Phil Bachman, Adam Trischler, and Yoshua Bengio. Learning deep representations by mutual information estimation and maximization. In International Conference on Learning Representations, 2019. URL https://openreview.net/forum?id=Bklr3j0cKX.

[33] Diederik P Kingma and Jimmy Ba. Adam: A method for stochastic optimization. arXiv preprint arXiv:1412.6980, 2014.

12

[34] K Jordan, Y Jin, V Boza, Y Jiacheng, F Cecista, L Newhouse, and J Bernstein. Muon: An optimizer for hidden layers in neural networks, 2024b. URL https://kellerjordan. github.io/posts/muon, 2024.

[35] Vineet Gupta, Tomer Koren, and Yoram Singer. Shampoo: Preconditioned stochastic tensor optimization. In International Conference on Machine Learning, pages 1842–1850. PMLR, 2018.

[36] Nikhil Vyas, Depen Morwani, Rosie Zhao, Itai Shapira, David Brandfonbrener, Lucas Janson, and Sham M. Kakade. SOAP: Improving and stabilizing shampoo using adam for language modeling. In The Thirteenth International Conference on Learning Representations, 2025. URL https://openreview.net/forum?id=IDxZhXrpNf.

[37] Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford, Diego de Las Casas, Lisa Anne Hendricks, Johannes Welbl, Aidan Clark, et al. Training compute-optimal large language models. arXiv preprint arXiv:2203.15556, 2022.

[38] Tom Brown, Benjamin Mann, Nick Ryder, Melanie Subbiah, Jared D Kaplan, Prafulla Dhariwal, Arvind Neelakantan, Pranav Shyam, Girish Sastry, Amanda Askell, et al. Language models are few-shot learners. Advances in neural information processing systems, 33:1877–1901, 2020.

[39] Rylan Schaeffer, Brando Miranda, and Sanmi Koyejo. Are emergent abilities of large language models a mirage? Advances in neural information processing systems, 36:55565–55581, 2023.

[40] Erik Nijkamp, Bo Pang, Hiroaki Hayashi, Lifu Tu, Huan Wang, Yingbo Zhou, Silvio Savarese, and Caiming Xiong. Codegen: An open large language model for code with multi-turn program synthesis. In The Eleventh International Conference on Learning Representations, 2023. URL https://openreview.net/forum?id=iaYcJKpY2B_.

[41] Wenhai Wang, Zhe Chen, Xiaokang Chen, Jiannan Wu, Xizhou Zhu, Gang Zeng, Ping Luo, Tong Lu, Jie Zhou, Yu Qiao, et al. Visionllm: Large language model is also an open-ended decoder for vision-centric tasks. Advances in Neural Information Processing Systems, 36:61501–61513, 2023.

[42] Sabri Eyuboglu, Ryan Ehrlich, Simran Arora, Neel Guha, Dylan Zinsley, Emily Liu, Will Tennien, Atri Rudra, James Zou, Azalia Mirhoseini, et al. Cartridges: Lightweight and general-purpose long context representations via self-study. arXiv preprint arXiv:2506.06266, 2025.

[43] hongzhou yu, Tianhao Cheng, Yingwen Wang, Wen He, Qing Wang, Ying Cheng, Yuejie Zhang, Rui Feng, and Xiaobo Zhang. FinemedLM-o1: Enhancing medical knowledge reasoning ability of LLM from supervised fine-tuning to test-time training. In Second Conference on Language Modeling, 2025. URL https://openreview.net/forum?id=7ZwuGZCopw.

[44] Ekin Akyürek, Mehul Damani, Adam Zweiger, Linlu Qiu, Han Guo, Jyothish Pari, Yoon Kim, and Jacob Andreas. The surprising effectiveness of test-time training for few-shot learning. In Forty-second International Conference on Machine Learning, 2024.

[45] William Beecher Scoville and Brenda Milner. Loss of recent memory after bilateral hippocampal lesions. Journal of neurology, neurosurgery, and psychiatry, 20(1):11, 1957.

[46] Alvaro Pascual-Leone, Amir Amedi, Felipe Fregni, and Lotfi B Merabet. The plastic human brain cortex. Annu. Rev. Neurosci., 28(1):377–401, 2005.

[47] Michael V Johnston. Plasticity in the developing brain: implications for rehabilitation. Developmental disabilities research reviews, 15(2):94–101, 2009.

[48] Akihiro Goto, Ayaka Bota, Ken Miya, Jingbo Wang, Suzune Tsukamoto, Xinzhi Jiang, Daichi Hirai, Masanori Murayama, Tomoki Matsuda, Thomas J. McHugh, Takeharu Nagai, and Yasunori Hayashi. Stepwise synaptic plasticity events drive the early phase of memory consolidation. Science, 374(6569):857–863, 2021. doi: 10.1126/science.abj9195. URL https://www.science.org/doi/abs/10.1126/science.abj9195.

[49] Uwe Frey and Richard GM Morris. Synaptic tagging and long-term potentiation. Nature, 385 (6616):533–536, 1997.

13

[50] Wannan Yang, Chen Sun, Roman Huszár, Thomas Hainmueller, Kirill Kiselev, and György Buzsáki. Selection of experience for memory by hippocampal sharp wave ripples. Science, 383 (6690):1478–1483, 2024.

[51] Daoyun Ji and Matthew A Wilson. Coordinated memory replay in the visual cortex and hippocampus during sleep. Nature neuroscience, 10(1):100–107, 2007.

[52] Adrien Peyrache, Mehdi Khamassi, Karim Benchenane, Sidney I Wiener, and Francesco P Battaglia. Replay of rule-learning related neural patterns in the prefrontal cortex during sleep. Nature neuroscience, 12(7):919–926, 2009.

[53] David J Foster and Matthew A Wilson. Reverse replay of behavioural sequences in hippocampal place cells during the awake state. Nature, 440(7084):680–683, 2006.

[54] Sean PA Drummond, Gregory G Brown, J Christian Gillin, John L Stricker, Eric C Wong, and Richard B Buxton. Altered brain response to verbal learning following sleep deprivation. Nature, 403(6770):655–657, 2000.

[55] Seung-Schik Yoo, Peter T Hu, Ninad Gujar, Ferenc A Jolesz, and Matthew P Walker. A deficit in the ability to form new human memories without sleep. Nature neuroscience, 10(3):385–392, 2007.

[56] W Scott Terry. Learning and memory: Basic principles, processes, and procedures. Routledge, 2017.

[57] Hideyuki Okano, Tomoo Hirano, and Evan Balaban. Learning and memory. Proceedings of the National Academy of Sciences, 97(23):12403–12404, 2000.

[58] Ali Behrouz, Meisam Razaviyayn, Peilin Zhong, and Vahab Mirrokni. It's all connected: A journey through test-time memorization, attentional bias, retention, and online optimization. arXiv preprint arXiv:2504.13173, 2025.

[59] Bo Liu, Rui Wang, Lemeng Wu, Yihao Feng, Peter Stone, and Qiang Liu. Longhorn: State space models are amortized online learners. arXiv preprint arXiv:2407.14207, 2024.

[60] Angelos Katharopoulos, Apoorv Vyas, Nikolaos Pappas, and François Fleuret. Transformers are rnns: Fast autoregressive transformers with linear attention. In International conference on machine learning, pages 5156–5165. PMLR, 2020.

[61] Yutao Sun, Li Dong, Shaohan Huang, Shuming Ma, Yuqing Xia, Jilong Xue, Jianyong Wang, and Furu Wei. Retentive network: A successor to transformer for large language models. arXiv preprint arXiv:2307.08621, 2023.

[62] Juergen Schmidhuber. Learning to control fast-weight memories: An alternative to recurrent nets. accepted for publication in. Neural Computation, 1992.

[63] Imanol Schlag, Kazuki Irie, and Juergen Schmidhuber. Linear transformers are secretly fast weight programmers. In International Conference on Machine Learning, pages 9355–9366. PMLR, 2021.

[64] DL Prados and SC Kak. Neural network capacity using delta rule. Electronics Letters, 25(3):197–199, 1989.

[65] Yu Sun, Xinhao Li, Karan Dalal, Jiarui Xu, Arjun Vikram, Genghan Zhang, Yann Dubois, Xinlei Chen, Xiaolong Wang, Sanmi Koyejo, et al. Learning to (learn at test time): Rnns with expressive hidden states. arXiv preprint arXiv:2407.04620, 2024.

[66] Nicholas J Higham. Functions of matrices: theory and computation. SIAM, 2008.

[67] Songlin Yang, Jan Kautz, and Ali Hatamizadeh. Gated delta networks: Improving mamba2 with delta rule. arXiv preprint arXiv:2412.06464, 2024.

[68] Songlin Yang, Bailin Wang, Yu Zhang, Yikang Shen, and Yoon Kim. Parallelizing linear transformers with the delta rule over sequence length. Advances in Neural Information Processing Systems, 37:115491–115522, 2024.

14

[69] Matteo Tiezzi, Michele Casoni, Alessandro Betti, Tommaso Guidi, Marco Gori, and Stefano Melacci. On the resurgence of recurrent models for long sequences: Survey and research opportunities in the transformer era. arXiv preprint arXiv:2402.08132, 2024.

[70] Bo Peng, Eric Alcaide, Quentin Gregory Anthony, Alon Albalak, Samuel Arcadinho, Stella Biderman, Huanqi Cao, Xin Cheng, Michael Nguyen Chung, Leon Derczynski, Xingjian Du, Matteo Grella, Kranthi Kiran GV, Xuzheng He, Haowen Hou, Przemyslaw Kazienko, Jan Kocon, Jiaming Kong, Bartłomiej Koptyra, Hayden Lau, Jiaju Lin, Krishna Sri Ipsit Mantri, Ferdinand Mom, Atsushi Saito, Guangyu Song, Xiangru Tang, Johan S. Wind, Stanisław Wozniak, Zhenyuan Zhang, Qinghua Zhou, Jian Zhu, and Rui-Jie Zhu. RWKV: Reinventing RNNs for the transformer era. In The 2023 Conference on Empirical Methods in Natural Language Processing, 2023. URL https://openreview.net/forum?id=7SaXczaBpG.

[71] Jimmy T.H. Smith, Andrew Warrington, and Scott Linderman. Simplified state space layers for sequence modeling. In The Eleventh International Conference on Learning Representations, 2023. URL https://openreview.net/forum?id=Ai8Hw3AXqks.

[72] Ramin Hasani, Mathias Lechner, Tsun-Hsuan Wang, Makram Chahine, Alexander Amini, and Daniela Rus. Liquid structural state-space models. In The Eleventh International Conference on Learning Representations, 2023. URL https://openreview.net/forum?id=g4OTKRKfS7R.

[73] Ali Behrouz, Michele Santacatterina, and Ramin Zabih. Mambamixer: Efficient selective state space models with dual token and channel selection. arXiv preprint arXiv:2403.19888, 2024.

[74] Bo Peng, Daniel Goldstein, Quentin Anthony, Alon Albalak, Eric Alcaide, Stella Biderman, Eugene Cheah, Xingjian Du, Teddy Ferdinan, Haowen Hou, et al. Eagle and finch: Rwkv with matrix-valued states and dynamic recurrence. arXiv preprint arXiv:2404.05892, 2024.

[75] Bo Peng, Ruichong Zhang, Daniel Goldstein, Eric Alcaide, Haowen Hou, Janna Lu, William Merrill, Guangyu Song, Kaifeng Tan, Saiteja Utpala, et al. Rwkv-7" goose" with expressive dynamic state evolution. arXiv preprint arXiv:2503.14456, 2025.

[76] Julien Siems, Timur Carstensen, Arber Zela, Frank Hutter, Massimiliano Pontil, and Riccardo Grazzi. Deltaproduct: Increasing the expressivity of deltanet through products of householders. arXiv preprint arXiv:2502.10297, 2025.

[77] John J Hopfield. Neural networks and physical systems with emergent collective computational abilities. Proceedings of the national academy of sciences, 79(8):2554–2558, 1982.

[78] Juergen Schmidhuber. Reducing the ratio between learning complexity and number of time varying variables in fully recurrent nets. In ICANN'93: Proceedings of the International Conference on Artificial Neural Networks Amsterdam, The Netherlands 13–16 September 1993 3, pages 460–463. Springer, 1993.

[79] Donald Olding Hebb. The organization of behavior: A neuropsychological theory. Psychology press, 2005.

[80] Tsendsuren Munkhdalai and Hong Yu. Neural semantic encoders. In Proceedings of the conference. Association for Computational Linguistics. Meeting, volume 1, page 397. NIH Public Access, 2017.

[81] Tsendsuren Munkhdalai, Alessandro Sordoni, Tong Wang, and Adam Trischler. Metalearned neural memory. Advances in Neural Information Processing Systems, 32, 2019.

[82] Kazuki Irie, Imanol Schlag, Robert Csordas, and Juergen Schmidhuber. Going beyond linear transformers with recurrent fast weight programmers. Advances in neural information processing systems, 34:7703–7717, 2021.

[83] Ke Alexander Wang, Jiaxin Shi, and Emily B Fox. Test-time regression: a unifying framework for designing sequence models with associative memory. arXiv preprint arXiv:2501.12352, 2025.

15

[84] Kazuki Irie, Robert Csordas, and Juergen Schmidhuber. The dual form of neural networks revisited: Connecting test time predictions to training patterns via spotlights of attention. In International Conference on Machine Learning, pages 9639–9659. PMLR, 2022.

[85] Kazuki Irie, Imanol Schlag, Róbert Csordás, and Juergen Schmidhuber. A modern self-referential weight matrix that learns to modify itself. In International Conference on Machine Learning, pages 9660–9677. PMLR, 2022.

[86] Jongho Park, Jaeseung Park, Zheyang Xiong, Nayoung Lee, Jaewoong Cho, Samet Oymak, Kangwook Lee, and Dimitris Papailiopoulos. Can mamba learn how to learn? a comparative study on in-context learning tasks. In Forty-first International Conference on Machine Learning, 2024. URL https://openreview.net/forum?id=GbFluKMmtE.

[87] Stephen Merity, Caiming Xiong, James Bradbury, and Richard Socher. Pointer sentinel mixture models. In International Conference on Learning Representations, 2017. URL https://openreview.net/forum?id=Byj72udxe.

[88] Denis Paperno, German Kruszewski, Angeliki Lazaridou, Ngoc Quan Pham, Raffaella Bernardi, Sandro Pezzelle, Marco Baroni, Gemma Boleda, and Raquel Fernandez. The LAMBADA dataset: Word prediction requiring a broad discourse context. In Katrin Erk and Noah A. Smith, editors, Proceedings of the 54th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers), pages 1525–1534, Berlin, Germany, August 2016. Association for Computational Linguistics. doi: 10.18653/v1/P16-1144. URL https://aclanthology.org/P16-1144/.

[89] Yonatan Bisk, Rowan Zellers, Jianfeng Gao, Yejin Choi, et al. Piqa: Reasoning about physical commonsense in natural language. In Proceedings of the AAAI conference on artificial intelligence, volume 34, pages 7432–7439, 2020.

[90] Rowan Zellers, Ari Holtzman, Yonatan Bisk, Ali Farhadi, and Yejin Choi. HellaSwag: Can a machine really finish your sentence? In Anna Korhonen, David Traum, and Lluis Marquez, editors, Proceedings of the 57th Annual Meeting of the Association for Computational Linguistics, pages 4791–4800, Florence, Italy, July 2019. Association for Computational Linguistics. doi: 10.18653/v1/P19-1472. URL https://aclanthology.org/P19-1472/.

[91] Keisuke Sakaguchi, Ronan Le Bras, Chandra Bhagavatula, and Yejin Choi. Winogrande: An adversarial winograd schema challenge at scale. Communications of the ACM, 64(9):99–106, 2021.

[92] Peter Clark, Isaac Cowhey, Oren Etzioni, Tushar Khot, Ashish Sabharwal, Carissa Schoenick, and Oyvind Tafjord. Think you have solved question answering? try arc, the ai2 reasoning challenge. arXiv preprint arXiv:1803.05457, 2018.

[93] Maarten Sap, Hannah Rashkin, Derek Chen, Ronan Le Bras, and Yejin Choi. Social IQa: Commonsense reasoning about social interactions. In Kentaro Inui, Jing Jiang, Vincent Ng, and Xiaojun Wan, editors, Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing and the 9th International Joint Conference on Natural Language Processing (EMNLP-IJCNLP), pages 4463–4473, Hong Kong, China, November 2019. Association for Computational Linguistics. doi: 10.18653/v1/D19-1454. URL https://aclanthology.org/D19-1454/.

[94] Christopher Clark, Kenton Lee, Ming-Wei Chang, Tom Kwiatkowski, Michael Collins, and Kristina Toutanova. BoolQ: Exploring the surprising difficulty of natural yes/no questions. In Jill Burstein, Christy Doran, and Thamar Solorio, editors, Proceedings of the 2019 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies, Volume 1 (Long and Short Papers), pages 2924–2936, Minneapolis, Minnesota, June 2019. Association for Computational Linguistics. doi: 10.18653/v1/N19-1300. URL https://aclanthology.org/N19-1300.

[95] Michael Poli, Armin W Thomas, Eric Nguyen, Pragaash Ponnusamy, Björn Deiseroth, Kristian Kersting, Taiji Suzuki, Brian Hie, Stefano Ermon, Christopher Ré, et al. Mechanistic design and scaling of hybrid architectures. arXiv preprint arXiv:2403.17844, 2024.

16

---

_此文档是 PDF 文档《Context Engineering/NL.pdf》的中文逐字精译。_

_翻译完成时间：2025 年 11 月 25 日_

_文档统计：_

- _总页数：16 页_
- _字数：约 8852 词_
- _提取图片：3 张_
- _表格：1 个_

_注：_

- _保留了原文档的数学公式和表格格式_
- _图片已正确提取并包含在文档中_
- _翻译力求准确传达原文的技术含义_
- _专业术语保持一致性_
