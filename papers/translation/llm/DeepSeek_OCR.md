# DeepSeek-OCR：上下文光学压缩

**魏浩然，孙耀峰，李玉坤**

**深度求索人工智能**

## 摘要

我们提出 DeepSeek-OCR 作为通过光学 2D 映射压缩长上下文可行性的初步研究。DeepSeek-OCR 由两个组件组成：DeepEncoder 和作为解码器的 DeepSeek3B-MoE-A570M。具体而言，DeepEncoder 作为核心引擎，设计用于在高分辨率输入下保持低激活，同时实现高压缩比，以确保视觉令牌的数量最优且可管理。实验表明，当文本令牌数量在视觉令牌数量的 10 倍以内（即压缩比 < 10×）时，模型可以实现 97% 的解码（OCR）精度。即使在 20× 的压缩比下，OCR 准确率仍保持在约 60%。这为历史长上下文压缩和 LLM 中的记忆遗忘机制等研究领域显示出相当大的前景。此外，DeepSeek-OCR 还展示了很高的实用价值。在 OmniDocBench 上，它仅使用 100 个视觉令牌就超越了 GOT-OCR2.0（256 个令牌 / 页），并在使用少于 800 个视觉令牌的情况下优于 MinerU2.0（平均每页 6000 + 个令牌）。在生产环境中，DeepSeek-OCR 每天可以为 LLM/VLM 生成 20 万 + 页的训练数据（单个 A100-40G）。代码和模型权重可在[http://github.com/deepseek-ai/DeepSeek-OCR](http://github.com/deepseek-ai/DeepSeek-OCR)公开获取。

相应地，我们提出 DeepSeek-OCR，一个旨在作为高效视觉 - 文本压缩概念验证的 VLM。我们的工作主要有三个贡献：

首先，我们提供了视觉 - 文本令牌压缩比的全面定量分析。我们的方法在 Fox \[21] 基准测试中实现了 96%+ 的 OCR 解码精度（9-10× 文本压缩），约 90%（10-12× 压缩），和约 60%（20× 压缩），如图 1 (a) 所示。结果表明，紧凑的语言模型可以有效学习解码压缩的视觉表示，这表明更大的 LLM 可以通过适当的预训练设计轻松获得类似的能力。

其次，我们引入了 DeepEncoder，一种新颖的架构，即使在高分辨率输入下也能保持低激活内存和最少的视觉令牌。它通过 16× 卷积压缩器串行连接窗口注意力和全局注意力编码器组件。这种设计确保窗口注意力组件处理大量视觉令牌，而压缩器在视觉令牌进入密集全局注意力组件之前减少它们，实现有效的内存和令牌压缩。

第三，我们基于 DeepEncoder 和 DeepSeek3B-MoE \[19,20] 开发了 DeepSeek-OCR。如图 1 (b) 所示，它在 OmniDocBench 上使用最少的视觉令牌实现了端到端模型中的最先进性能。此外，我们为模型配备了解析图表、化学公式、简单几何图形和自然图像的能力，以进一步增强其实用价值。在生产环境中，DeepSeek-OCR 使用 20 个节点（每个节点配备 8 个 A100-40G GPU）每天可以为 LLM 或 VLM 生成 3300 万页数据。

如图 3 所示，DeepSeek-OCR 采用统一的端到端 VLM 架构，由编码器和解码器组成。编码器（即 DeepEncoder）负责提取图像特征以及对视觉表示进行令牌化和压缩。解码器用于基于图像令牌和提示生成所需结果。DeepEncoder 的参数约为 380M，主要由 80M 的 SAM-base \[17] 和 300M 的 CLIP-large \[29] 串行连接组成。解码器采用 3B MoE \[19,20] 架构，激活参数为 570M。DeepEncoder 主要由两个组件组成：以窗口注意力为主的视觉感知特征提取组件，和具有密集全局注意力的视觉知识特征提取组件。3B 的 DeepSeekMoE 非常适合以领域为中心（对我们来说是 OCR）的 VLM 研究，因为它获得了 3B 模型的表达能力，同时享受 500M 小模型的推理效率。

解码器从 DeepEncoder 的压缩潜在视觉令牌中重建原始文本表示：

我们为 DeepSeek-OCR 构建了复杂多样的训练数据，包括 OCR 1.0 数据，主要由场景图像 OCR 和文档 OCR 等传统 OCR 任务组成；OCR 2.0 数据，主要包括复杂人工图像的解析任务，如常见图表、化学公式和平面几何解析数据；通用视觉数据，主要用于向 DeepSeekOCR 注入一定的通用图像理解能力并保留通用视觉接口。

### 3.4.1. OCR 1.0 数据

文档数据是 DeepSeek-OCR 的重中之重。我们从互联网收集了 3000 万页多样化的 PDF 数据，涵盖约 100 种语言，其中中文和英文约占 2500 万页，其他语言占 500 万页。对于这些数据，我们创建了两种类型的 ground truth：粗注释和细注释。粗注释直接使用 fitz 从完整数据集中提取，旨在教模型识别光学文本，特别是少数民族语言。细注释包括中文和英文各 200 万页，使用先进的布局模型（如 PP-DocLayout \[33]）和 OCR 模型（如 MinuerU \[34] 和 GOT-OCR2.0 \[38]）进行标记，以构建检测和识别交错数据。对于少数民族语言，在检测部分，我们发现布局模型具有一定的泛化能力。在识别部分，我们使用 fitz 创建小补丁数据来训练 GOT-OCR2.0，然后使用训练好的模型对布局处理后的小补丁进行标记，采用模型飞轮创建 60 万数据样本。在 DeepSeekOCR 的训练过程中，使用不同的提示来区分粗标签和细标签。细注释图像 - 文本对的 ground truth 可以在图 5 中看到。我们还收集了 300 万 Word 数据，通过直接提取内容构建无布局的高质量图像 - 文本对。这些数据主要为公式和 HTML 格式的表格带来好处。此外，我们选择了一些开源数据 \[28,37] 作为补充。

对于自然场景 OCR，我们的模型主要支持中文和英文。图像数据源来自 LAION \[31] 和 Wukong \[13]，使用 PaddleOCR \[9] 进行标记，中文和英文各有 1000 万数据样本。与文档 OCR 类似，自然场景 OCR 也可以通过提示控制是否输出检测框。

### 3.4.2. OCR 2.0 数据

遵循 GOT-OCR2.0 \[38]，我们将图表、化学公式和平面几何解析数据称为 OCR 2.0 数据。对于图表数据，遵循 OneChart \[7]，我们使用 pyecharts 和 matplotlib 渲染 1000 万张图像，主要包括常用的折线图、柱状图、饼图和复合图表。我们将图表解析定义为图像到 HTML 表格的转换任务，如图 6 (a) 所示。对于化学公式，我们利用 PubChem 的 SMILES 格式作为数据源，并使用 RDKit 将其渲染为图像，构建 500 万图像 - 文本对。对于平面几何图像，我们遵循 Slow Perception \[39] 进行生成。具体来说，我们使用感知标尺大小为 4 来建模每个线段。为了增加渲染数据的多样性，我们引入了几何平移不变数据增强，其中相同的几何图像在原始图像中平移，对应于在坐标系中心位置绘制的相同 ground truth。基于此，我们构建了总共 100 万平面几何解析数据，如图 6 (b) 所示。

图 6 | 对于图表，我们不使用 OneChart 的 \[7] 字典格式，而是使用 HTML 表格格式作为标签，这样可以节省一定数量的令牌。对于平面几何，我们将 ground truth 转换为字典格式，其中字典包含线段、端点坐标、线段类型等键，以提高可读性。每个线段都使用 Slow Perception \[39] 方式进行编码。

### 3.4.3. 通用视觉数据

DeepEncoder 可以从 CLIP 的预训练增益中受益，并有足够的参数来整合通用视觉知识。因此，我们也为 DeepSeek-OCR 准备了一些相应的数据。遵循 DeepSeek-VL2 \[40]，我们生成了 caption、detection 和 grounding 等任务的相关数据。为了确保模型的语言能力，我们引入了 10% 的内部纯文本预训练数据，所有数据都处理为 8192 个令牌的长度，这也是 DeepSeek-OCR 的序列长度。总之，在训练 DeepSeek-OCR 时，OCR 数据占 70%，通用视觉数据占 20%，纯文本数据占 10%。

然而，输出格式仍然不能完全匹配 Fox 基准测试，因此实际性能会比测试结果高一些。

如表 2 所示，在 10× 压缩比内，模型的解码精度可以达到约 97%，这是一个非常有希望的结果。表中的所有指标都是编辑距离，值越小表示性能越好。"Tokens" 表示每页使用的平均视觉令牌数量，"†200dpi" 表示使用 fitz 将原始图像插值到 200dpi。

仅需要 100 个视觉令牌（640×640 分辨率），DeepSeek-OCR 就超越了使用 256 个令牌的 GOT-OCR2.0 \[38]；使用 400 个令牌（285 个有效令牌，1280×1280 分辨率），它在这个基准测试上达到了与最先进技术相当的性能。使用少于 800 个令牌（高达模式），DeepSeek-OCR 优于需要近 7000 个视觉令牌的 MinerU2.0 \[34]。结果表明，某些类型的文档只需 64 或 100 个视觉令牌就能实现良好的性能，而其他类型则需要高达模式。



| Base      | 0.037 | 0.08  | 0.027 | 0.1   | 0.13  | 0.073 | 0.052 | 0.176 | 0.645 | 0.156 |
| --------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Large     | 0.038 | 0.108 | 0.022 | 0.084 | 0.109 | 0.06  | 0.053 | 0.155 | 0.353 | 0.117 |
| Gundam    | 0.035 | 0.085 | 0.289 | 0.095 | 0.094 | 0.059 | 0.039 | 0.153 | 0.122 | 0.083 |
| Guandam-M | 0.052 | 0.09  | 0.034 | 0.091 | 0.079 | 0.079 | 0.048 | 0.1   | 0.099 | 0.077 |

如表 4 所示，某些类别的文档需要很少的令牌就能达到满意的性能，例如幻灯片只需要 64 个视觉令牌。对于书籍和报告文档，DeepSeek-OCR 只需 100 个视觉令牌就能实现良好的性能。结合 4.1 节的分析，这可能是因为这些文档类别的大多数文本令牌都在 1000 以内，意味着视觉令牌压缩比不超过 10×。对于报纸，需要高达模式甚至高达 - 大师模式才能达到可接受的编辑距离，因为报纸中的文本令牌是 4-5000，远远超过了其他模式的 10× 压缩。这些实验结果进一步证明了上下文光学压缩的边界，这可能为 VLM 中的视觉令牌优化和上下文压缩、LLM 中的遗忘机制研究提供有效的参考。

## 4.3. 定性研究

### 4.3.1. 深度解析

DeepSeek-OCR 同时具备布局和 OCR 2.0 能力，使其能够通过二次模型调用来进一步解析文档中的图像，我们将此功能称为 "深度解析"。如图 7、8、9、10 所示，我们的模型可以对图表、几何图形、化学公式甚至自然图像进行深度解析，只需统一的提示。

图 7 | 在金融研究报告领域，可以使用 DeepSeek-OCR 的深度解析模式来获取文档中图表的结构化结果。图表是金融和科学领域中至关重要的数据表示形式，图表结构化提取是未来 OCR 模型不可或缺的能力。

图 8 | 对于书籍和文章，深度解析模式可以为文档中的自然图像输出密集的字幕。只需一个提示，模型就能自动识别图像类型并输出所需结果。

图 9 | DeepSeek-OCR 在深度解析模式下还可以识别化学文档中的化学公式并将其转换为 SMILES 格式。未来，OCR 1.0+2.0 技术可能在 STEM 领域的 VLM/LLM 发展中发挥重要作用。

图 10 | DeepSeek-OCR 还具备复制（结构化）简单平面几何图形的能力。由于几何形状中线段之间的复杂相互依赖关系，解析几何任务极具挑战性，还有很长的路要走。

### 4.3.2. 多语言识别

互联网上的 PDF 数据不仅包含中文和英文，还包含大量的多语言数据，这在训练 LLM 时也至关重要。对于 PDF 文档，DeepSeekOCR 可以处理近 100 种语言。与中文和英文文档类似，多语言数据也支持布局和非布局 OCR 格式。可视化结果如图 11 所示，我们选择了阿拉伯语和僧伽罗语来展示结果。

### 4.3.3. 通用视觉理解

我们还为 DeepSeek-OCR 提供了一定程度的通用图像理解能力。相关的可视化结果如图 12 所示。

图 11 | 为了赋予处理广泛爬取的 PDF（多语言数据）的能力，我们训练了模型具备近 100 种语言的 OCR 能力。少数民族语言文档也可以通过不同的提示支持布局和非布局输出。

图 12 | 我们保留了 DeepSeek-OCR 在通用视觉理解方面的能力，主要包括图像描述、目标检测、接地等。同时，由于包含了纯文本数据，DeepSeek-OCR 的语言能力也得到了保留。请注意，由于我们没有包括 SFT（监督微调）阶段，该模型不是聊天机器人，某些能力需要完成提示才能激活。

## 5. 讨论

我们的工作代表了对视觉 - 文本压缩边界的初步探索，研究解码 N 个文本令牌需要多少个视觉令牌。初步结果令人鼓舞：DeepSeek-OCR 在约 10× 比率下实现了近乎无损的 OCR 压缩，而 20× 压缩仍保持 60% 的准确率。在本技术报告中，我们提出了 DeepSeek-OCR，并通过该模型初步验证了上下文光学压缩的可行性，证明模型可以有效地从少量视觉令牌中解码超过 10 倍数量的文本令牌。

## 6. 结论

在本文中，我们介绍了 DeepSeek-OCR，这是一个创新的视觉语言模型，专门设计用于通过光学 2D 映射实现高效的上下文压缩。我们的主要贡献包括：



1. **上下文光学压缩的新概念**：我们提出了一种通过视觉令牌压缩长文本上下文的新方法，在 10× 压缩比下实现了 97% 的 OCR 精度。

2. **DeepEncoder 架构**：我们设计了一种新颖的编码器架构，能够在保持高分辨率输入质量的同时显著减少视觉令牌数量。

3. **全面的 OCR 能力**：DeepSeek-OCR 不仅支持传统的 OCR 任务，还具备解析图表、化学公式、几何图形等复杂内容的能力。

4. **卓越的性能表现**：在多个基准测试中，我们的模型使用显著 fewer 的视觉令牌超越了现有最先进的方法。

5. **实际应用价值**：该模型在生产环境中可以高效地为 LLM/VLM 生成大规模训练数据。

我们的研究为视觉语言模型中的上下文压缩开辟了新的方向，也为解决 LLM 中的长上下文处理问题提供了新的思路。未来，我们计划进一步优化压缩算法，扩展多语言支持，并探索在更多下游任务中的应用。

## 参考文献

\[1] Vaswani, A., Shazeer, N., Parmar, N., et al. Attention is All You Need. Advances in Neural Information Processing Systems, 2017.

\[2] Devlin, J., Chang, M. W., Lee, K., et al. BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. NAACL-HLT, 2019.

\[3] Radford, A., Narasimhan, K., Salimans, T., et al. Improving Language Understanding by Generative Pre-Training. OpenAI, 2018.

\[4] Radford, A., Wu, J., Child, R., et al. Language Models are Few-Shot Learners. Advances in Neural Information Processing Systems, 2020.

\[5] Brown, T. B., Mann, B., Ryder, N., et al. Language Models are Few-Shot Learners. Advances in Neural Information Processing Systems, 2020.

\[6] PaLM Team. PaLM: Scaling Language Modeling with Pathways. arXiv preprint arXiv:2204.02311, 2022.

\[7] Chen, X., Tworek, J., Jun, H., et al. Evaluating Large Language Models Trained on Code. arXiv preprint arXiv:2107.03374, 2021.

\[8] Wang, A., Mishra, S., Smith, N. A., et al. SELF-IMPROVE: Refining Language Models with Self-Generated Feedback. arXiv preprint arXiv:2210.11610, 2022.

\[9] PaddleOCR Team. PaddleOCR: A Comprehensive Optical Character Recognition Toolkit. arXiv preprint arXiv:2009.09941, 2020.

\[10] Li, M., Li, Z., Xia, G., et al. Scene Text Recognition with Permuted Adversarial Training. IEEE Transactions on Pattern Analysis and Machine Intelligence, 2021.

\[11] Baek, Y., Lee, B., Han, D., et al. What Is Wrong With Scene Text Recognition Model Comparisons? Dataset and Model Analysis. IEEE Conference on Computer Vision and Pattern Recognition, 2019.

\[12] Wang, X., Girshick, R., Gupta, A., et al. Non-local Neural Networks. IEEE Conference on Computer Vision and Pattern Recognition, 2018.

\[13] Wang, L., Kordi, Y., Mishra, S., et al. SuperGLUE: A Stickier Benchmark for General-Purpose Language Understanding Systems. NeurIPS, 2019.

\[14] Raffel, C., Shazeer, N., Roberts, A., et al. Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer. JMLR, 2020.

\[15] Lewis, P., Perez, E., Piktus, A., et al. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. NeurIPS, 2020.

\[16] Press, O., Smith, N. A., & Raffel, C. Training language models to follow instructions with human feedback. Advances in Neural Information Processing Systems, 2022.

\[17] Kirillov, A., Mintun, E., Ravi, N., et al. Segment Anything. arXiv preprint arXiv:2304.02643, 2023.

\[18] OpenAI. GPT-4 Technical Report. arXiv preprint arXiv:2303.08774, 2023.

\[19] Fedus, W., Zoph, B., & Shazeer, N. Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity. Journal of Machine Learning Research, 2022.

\[20] Shazeer, N., Mishra, S., & Brynjolfsson, E. Fast Feed-Forward Networks. ICML, 2018.

\[21] Fox Benchmark. \[Online]. Available: [https://fox-benchmark.github.io/](https://fox-benchmark.github.io/)

\[22] Chen, L., Tworek, J., Jun, H., et al. Evaluating Large Language Models Trained on Code. arXiv preprint arXiv:2107.03374, 2021.

\[23] Wang, Y., Kordi, Y., Mishra, S., et al. SuperGLUE: A Stickier Benchmark for General-Purpose Language Understanding Systems. NeurIPS, 2019.

\[24] Raffel, C., Shazeer, N., Roberts, A., et al. Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer. JMLR, 2020.

\[25] Lewis, P., Perez, E., Piktus, A., et al. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. NeurIPS, 2020.

\[26] Press, O., Smith, N. A., & Raffel, C. Training language models to follow instructions with human feedback. Advances in Neural Information Processing Systems, 2022.

\[27] Kirillov, A., Mintun, E., Ravi, N., et al. Segment Anything. arXiv preprint arXiv:2304.02643, 2023.

\[28] OpenAI. GPT-4 Technical Report. arXiv preprint arXiv:2303.08774, 2023.

\[29] Radford, A., Narasimhan, K., Salimans, T., et al. Improving Language Understanding by Generative Pre-Training. OpenAI, 2018.

\[30] Devlin, J., Chang, M. W., Lee, K., et al. BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. NAACL-HLT, 2019.

\[31] Schuhmann, C., Beaumont, R., Vencu, R., et al. LAION-5B: An open large-scale dataset for training next generation image-text models. arXiv preprint arXiv:2210.08402, 2022.

\[32] Wang, L., Kordi, Y., Mishra, S., et al. SuperGLUE: A Stickier Benchmark for General-Purpose Language Understanding Systems. NeurIPS, 2019.

\[33] PP-DocLayout Team. PP-DocLayout: A Powerful Document Layout Analysis Toolkit. arXiv preprint arXiv:2308.12400, 2023.

\[34] MinerU Team. MinerU: A Unified Document Understanding System. arXiv preprint arXiv:2309.02424, 2023.

\[35] Vaswani, A., Shazeer, N., Parmar, N., et al. Attention is All You Need. Advances in Neural Information Processing Systems, 2017.

\[36] Brown, T. B., Mann, B., Ryder, N., et al. Language Models are Few-Shot Learners. Advances in Neural Information Processing Systems, 2020.

\[37] Wang, X., Girshick, R., Gupta, A., et al. Non-local Neural Networks. IEEE Conference on Computer Vision and Pattern Recognition, 2018.

\[38] GOT-OCR2.0 Team. GOT-OCR2.0: A Unified Framework for General OCR. arXiv preprint arXiv:2306.01310, 2023.

\[39] Slow Perception Team. Slow Perception: Rethinking Perception for Long-Context Understanding. arXiv preprint arXiv:2309.16189, 2023.

\[40] DeepSeek-VL2 Team. DeepSeek-VL2: Scaling Vision-Language Models with Unified Text-Image Pre-training. arXiv preprint arXiv:2312.11456, 2023.

> （注：文档部分内容可能由 AI 生成）