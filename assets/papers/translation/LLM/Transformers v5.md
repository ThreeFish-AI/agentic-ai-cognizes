# Transformers v5.0.0rc0 发布说明

## 版本亮点

我们激动地宣布 Transformers v5 的初始版本发布。这是五年来的第一个主要版本，这是一个重要的版本：自最新的小版本发布以来，已经有 800 个提交被推送到 `main` 分支。这个版本移除了许多长期 overdue 的弃用功能，引入了几个重构，显著简化了我们的 API 和内部结构，并带来了大量的错误修复。

我们在以下博客文章中概述了此版本的重点。在这些发布说明中，我们将直接关注 v5 带来的重构和新 API。

这是一个候选发布版本 (RC)。它不是最终的 v5 版本，我们将作为预发布版本推送到 pypi。这意味着当前版本是纯粹可选的，因为安装 `transformers` 而不指定这个确切版本将安装最新版本（截至本文撰写时是 v4.57.3）。

为了安装此版本，请使用以下命令：

```bash
pip install transformers --pre
```

为了让我们能够提供最好的包，我们必须获得关于工具包当前如何为您工作的反馈。请试用它，如果您遇到任何不一致或错误，请提交 issue。

Transformers v5 版本是社区的努力，这是最后的一英里。让我们一起发布它！

## 重要的 API 变更

**注意**

👀 没有什么是最终的，事情仍在积极发展中。我们有一个专门的部分来介绍计划在未来的候选版本中实现的内容，这些内容在 RC0 中已知不工作。请查看"RC0 免责声明"。

我们热切期待在 GitHub issues 中得到您的反馈！

### 分词器

正如我们朝着单一的模型定义后端库发展一样，我们希望我们的分词器和 `Tokenizer` 对象更加直观。在 v5 中，分词器定义更加简单；现在可以初始化一个空的 `LlamaTokenizer` 并直接在您的语料库上训练它。

定义一个新的分词器对象应该像这样简单：

```python
from transformers import TokenizersBackend, generate_merges
from tokenizers import pre_tokenizers, Tokenizer
from tokenizers.model import BPE

class Llama5Tokenizer(TokenizersBackend):
    def __init__(self, unk_token="<unk>", bos_token="<s>", eos_token="</s>", vocab=None, merges=None):
        if vocab is None:
            self._vocab = {
                str(unk_token): 0,
                str(bos_token): 1,
                str(eos_token): 2,
            }
        else:
            self._vocab = vocab

        if merges is not None:
            self._merges = merges
        else:
            self._merges = generate_merges(filtered_vocab)

        self._tokenizer = Tokenizer(
            BPE(vocab=self._vocab, merges=self._merges, fuse_unk=True)
        )
        self._tokenizer.pre_tokenizer = pre_tokenizers.Metaspace(
            replacement="▁", prepend_scheme=_get_prepend_scheme(self.add_prefix_space, self), split=False
        )
        super().__init__(
            tokenizer_object=self._tokenizer,
            unk_token=unk_token,
            bos_token=bos_token,
            eos_token=eos_token,
        )
```

一旦分词器如上定义，您可以使用以下方式加载它：`Llama5Tokenizer()`。这样做会返回一个空的、可训练的分词器，它遵循 `Llama5` 作者的定义（它还不存在 😉）。

上述是重构分词器的主要动机：我们希望分词器的行为类似于模型：已训练的或空的，并且具有在其类定义中定义的确切内容。

### 后端架构变更：移除慢/快分词器分离

到目前为止，transformers 为许多分词器维护两个并行实现：

- "慢"分词器 (`tokenization_<model>.py`) - 基于 Python 的实现，通常使用 SentencePiece 作为后端。
- "快"分词器 (`tokenization_<model>_fast.py`) - 基于 Rust 的实现，使用 🤗 tokenizers 库。

在 v5 中，我们将每个模型合并为单个分词器文件：`tokenization_<model>.py`。该文件将使用最合适的可用后端：

1. **TokenizersBackend**（首选）：来自 🤗 tokenizers 库的基于 Rust 的分词器。通常它提供最佳性能，但它还提供了更多在生态系统中广泛采用的功能：

   - 处理额外 token
   - 用于设置和更新的完整 Python API
   - 自动并行化
   - 自动偏移量
   - 自定义化
   - 训练

2. **SentencePieceBackend**：用于需要 `sentencepiece` 库的分词器。它继承自 `PythonBackend`。
3. **PythonBackend**：`tokenizers` 提供的功能的 Python 实现。基本上允许添加 token。
4. **MistralCommonBackend**：依赖 `MistralCommon` 的分词库（以前称为 `MistralCommonTokenizer`）

`AutoTokenizer` 根据可用文件和依赖项自动选择合适的后端。这是透明的，您可以像以前一样继续使用 `AutoTokenizer.from_pretrained()`。这使得 transformers 具有前瞻性，并且模块化，以便轻松支持未来的后端。

### 在现有后端之外定义分词器

我们使用户和分词器构建者能够从头到尾定义自己的分词器。分词器通常使用诸如 `tokenizers`、`sentencepiece` 或 `mistral-common` 之类的后端来定义，但我们提供了在更高级别设计分词器的可能性，而不依赖于那些后端。

为此，您可以导入 `PythonBackend`（以前称为 `PreTrainedTokenizer`）。该类封装了与添加 token、编码和解码相关的所有逻辑。

如果您想要更高级别的内容，那么 `PreTrainedTokenizerBase` 是 `PythonBackend` 继承的类。它包含最基本的分词器 API 功能：

- `encode`
- `decode`
- `vocab_size`
- `get_vocab`
- `convert_tokens_to_ids`
- `convert_ids_to_tokens`
- `from_pretrained`
- `save_pretrained`
- 以及其他一些

### API 变更

#### 1. 使用 vocab 和 merges 直接初始化分词器

从 v5 开始，我们现在支持初始化空白、未训练的基于 `tokenizers` 的分词器：

```python
from transformers import LlamaTokenizer

tokenizer = LlamaTokenizer()
```

因此，这个分词器将遵循其类定义中定义的 `LlamaTokenizer` 定义。然后可以在语料库上训练它，如 `tokenizers` 文档中所示。

这些分词器也可以从 vocab 和 merges（如果需要）初始化，就像以前的"慢"分词器一样：

```python
from transformers import LlamaTokenizer

vocab = {"<unk>": 0, "<s>": 1, "</s>": 2, "hello": 3, "world": 4}
merges = [("h", "e"), ("l", "l"), ("o", " ")]

tokenizer = LlamaTokenizer(vocab=vocab, merges=merges)
```

该分词器的行为将类似于 Llama 分词器，具有更新的词汇表。这允许比较不同分词器类使用相同词汇表的情况；从而能够比较不同的预分词器、规范化器等。

⚠️ `vocab_file`（即包含词汇表的文件的路径）不能用于初始化 `LlamaTokenizer`，因为从文件加载是为 `from_pretrained` 方法保留的。

#### 2. 简化的解码 API

`batch_decode` 和 `decode` 方法已经统一，以反映 `encode` 方法的行为。单批和批量解码现在都使用相同的 `decode` 方法。请参见以下新行为的示例：

```python
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("t5-small")
inputs = ["hey how are you?", "fine"]
tokenizer.decode(tokenizer.encode(inputs))
```

给出：

```diff
- 'hey how are you?</s> fine</s>'
+ ['hey how are you?</s>', 'fine</s>']
```

我们期望 `encode` 和 `decode` 表现得像同一枚硬币的两面：`encode`、`process`、`decode` 应该可以工作。

**注意**

一个常见的用例是：`encode`、`model.generate`、`decode`。但是，使用 `generate` 会返回 `list[list[int]]`，这与 `decode` 不兼容。

#### 3. 统一的编码 API

`encode_plus` 方法已被弃用，转而使用单一的 `__call__` 方法。

#### 4. `apply_chat_template` 返回 `BatchEncoding`

以前，为了向后兼容，`apply_chat_template` 返回 `input_ids`。从 v5 开始，它现在像其他分词器方法一样一致地返回 `BatchEncoding` 字典。

```python
# v5
messages = [
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi there!"}
]

# 现在返回带有 input_ids、attention_mask 等的 BatchEncoding
outputs = tokenizer.apply_chat_template(messages, return_tensors="pt")
print(outputs.keys())  # dict_keys(['input_ids', 'attention_mask'])
```

#### 5. 移除了遗留的配置文件保存：

我们简化了分词属性的序列化：

- `special_tokens_map.json` - 特殊 token 现在存储在 `tokenizer_config.json` 中。
- `added_tokens.json` - 添加的 token 现在存储在 `tokenizer.json` 中。
- `added_tokens_decoder` 仅在没有 `tokenizer.json` 时存储。

当加载旧的分词器时，为了向后兼容，这些文件仍然会被读取，但新的保存使用合并的格式。我们正在逐步将属性合并到更少的文件中，以便其他库和实现可以更可靠地依赖它们。

#### 6. 特定模型的变更

几个具有相同分词器的模型现在从它们的基本实现导入：

- **LayoutLM** → 使用 BertTokenizer
- **LED** → 使用 BartTokenizer
- **Longformer** → 使用 RobertaTokenizer
- **LXMert** → 使用 BertTokenizer
- **MT5** → 使用 T5Tokenizer
- **MVP** → 使用 BartTokenizer

这些模块最终将被完全移除。

**移除 T5 特定的变通方法**

内部的 `_eventually_correct_t5_max_length` 方法已被移除。T5 分词器现在与其他模型一样一致地处理最大长度。

### 测试变更

应用了一些特定于分词器的测试变更：

- 特定模型的分词测试文件现在专注于集成测试。
- 通用分词 API 测试（例如，`add_tokens`、`encode`、`decode`）现在集中化并自动应用于所有分词器。这减少了测试重复并确保了一致的行为

对于遗留实现，原始的 BERT Python 分词器代码（包括 `WhitespaceTokenizer`、`BasicTokenizer` 等）保留在 `bert_legacy.py` 中供参考。

#### 7. 已弃用/修改的功能

**特殊 Token 结构：**

- `SpecialTokensMixin`：合并到 `PreTrainedTokenizerBase` 以简化分词器架构。
- `special_tokens_map`：现在只存储命名的特殊 token 属性（例如，`bos_token`、`eos_token`）。使用 `extra_special_tokens` 表示额外的特殊 token（以前是 `additional_special_tokens`）。`all_special_tokens` 包括命名的和额外的 token。

```python
# v4
tokenizer.special_tokens_map  # 包含 'additional_special_tokens'

# v5
tokenizer.special_tokens_map  # 只有命名的 token
tokenizer.extra_special_tokens  # 额外的 token
```

- `special_tokens_map_extended` 和 `all_special_tokens_extended`：已移除。如果需要，直接从 `_special_tokens_map` 或 `_extra_special_tokens` 访问 `AddedToken` 对象。
- `additional_special_tokens`：为了向后兼容仍然接受，但会自动转换为 `extra_special_tokens`。

**已弃用的方法：**

- `sanitize_special_tokens()`：已在 v4 中弃用，在 v5 中移除。
- `prepare_seq2seq_batch()`：已弃用；改为使用带有 `text_target` 参数的 `__call__()`。

```python
# v4
model_inputs = tokenizer.prepare_seq2seq_batch(src_texts, tgt_texts, max_length=128)

# v5
model_inputs = tokenizer(src_texts, text_target=tgt_texts, max_length=128, return_tensors="pt")
model_inputs["labels"] = model_inputs.pop("input_ids_target")
```

- `BatchEncoding.words()`：已弃用；使用 `word_ids()` 代替。

**已移除的方法：**

- `create_token_type_ids_from_sequences()`：从基类中移除。需要自定义 token 类型 ID 创建的子类应该直接实现此方法。
- `clean_up_tokenization()`：从基类中移除。现在在模型类级别为需要的模型定义（例如，PLBart、CLVP、Wav2Vec2）。
- `prepare_for_model()`、`build_inputs_with_special_tokens()`、`truncate_sequences()`：从 `tokenization_utils_base.py` 移动到 `tokenization_python.py` 用于 `PythonBackend` 分词器。`TokenizersBackend` 通过 `tokenize()` 和 `encode()` 提供模型就绪的输入，因此基类不再需要这些方法。
- `_switch_to_input_mode()`、`_switch_to_target_mode()`、`as_target_tokenizer()`：从基类中移除。使用带有 `text_target` 参数的 `__call__()` 代替。

```python
# v4
with tokenizer.as_target_tokenizer():
    labels = tokenizer(tgt_texts, ...)

# v5
labels = tokenizer(text_target=tgt_texts, ...)
```

- `parse_response()`：从基类中移除。

## RC0 免责声明

### PEFT + MoE：

因为我们正在从朴素的 MoE（专家的 `nn.ModuleList`）切换，我们目前对带有适配器的 MoE 有一个问题。更多细节见 #42491（评论）。

_我们旨在在 RC0 之后的一周内修复并在后续的候选版本中发布。_

### 张量并行和专家并行 + MoE

我们正在与 vLLM 简化 MoE 支持；在此实施期间，张量并行和专家并行没有按预期工作。

_已知此问题，正在积极解决中。_

_我们旨在在 RC0 之后的一周内修复并在后续的候选版本中发布。_

### 自定义预训练模型：

对于任何继承自 `transformers` `PreTrainedModel` 的人，权重会自动使用通用方案初始化：

```python
@torch.no_grad()
def _init_weights(self, module):
    """
    初始化权重。这是相当通用的，符合我们通常的做法。对于更复杂的初始化方案，
    应该由派生的 `PreTrainedModel` 类覆盖。如果模型添加了显式的 `nn.Parameter`，
    此方法也应该被覆盖以正确初始化它。
    """
    if hasattr(self.config, "initializer_range"):
        std = self.config.initializer_range or 0.02
    elif hasattr(self.config, "init_std"):
        std = self.config.init_std
    elif hasattr(self.config, "initializer_factor"):
        std = self.config.initializer_factor
    else:
        # 0.02 是整个库的标准默认值
        std = getattr(self.config.get_text_config(), "initializer_range", 0.02)

    if isinstance(module, (nn.Linear, nn.Conv1d, nn.Conv2d, nn.Conv3d, nn.ConvTranspose1d, nn.ConvTranspose2d)):
        if getattr(module, "weight", None) is not None:
            init.normal_(module.weight, mean=0.0, std=std)
        if getattr(module, "bias", None) is not None:
            init.zeros_(module.bias)
    elif isinstance(module, nn.Embedding):
        if getattr(module, "weight", None) is not None:
            init.normal_(module.weight, mean=0.0, std=std)
            # 这里我们需要显式检查，因为我们在 `zeros_` 调用中对权重进行切片，所以它会失去标志
            if module.padding_idx is not None and not getattr(module.weight, "_is_hf_initialized", False):
                init.zeros_(module.weight[module.padding_idx])
    elif isinstance(module, nn.MultiheadAttention):
        # 这使用 torch 的原始初始化
        module._reset_parameters()
    # 我们不能在 RMSNorms 或 LayerNorms 上使用 `isinstance`，因为它们通常是在模型之间更改名称的自定义模块
    elif (
        isinstance(module, (nn.GroupNorm, nn.BatchNorm1d, nn.BatchNorm2d, nn.BatchNorm3d))
        or "LayerNorm" in module.__class__.__name__
        or "RMSNorm" in module.__class__.__name__
    ):
        # 规范化层可能没有权重（在这种情况下，从 torch 原语中它们是 None）
        if hasattr(module, "weight") and module.weight is not None:
            init.ones_(module.weight)
        if hasattr(module, "bias") and module.bias is not None:
            init.zeros_(module.bias)
```

如果您想避免这种情况，现在您应该这样做：

```python
class CustomModel(Qwen3VLForConditionalGeneration):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.action_head = nn.Linear(1024, 7)
        self.positional_embedding = nn.Parameter(torch.randn(16, 1152))
        self.post_init()

    def _init_weights(self, module):
        pass
```

这里有一个追踪器：#42418。

## 影响较小的全库变更

### `use_auth_token`

`use_auth_token` 参数/参数已弃用，取而代之的是 `token`。您应该能够搜索并用 `token` 替换 `use_auth_token` 并获得相同的逻辑。

链接 PR：#41666

### 注意力相关功能

我们决定为即将到来的 v5 移除一些功能，因为它们目前只在少数旧模型中支持，并且不再集成在当前的模型添加中。如果您需要它们，建议坚持使用 v4.x。受影响的以下功能：

- 不再支持头部遮罩，见 #41076。此功能允许在注意力计算期间关闭某些头部，并且只适用于 eager。
- 在类似 Bert 的模型中不再支持相对位置偏置，见 #41170。引入此功能是为了在注意力计算中允许相对位置得分（类似于 T5）。然而，此功能在官方模型中很少使用，反而增加了大量复杂性。它也只适用于 eager。
- 不再支持头部剪枝，见 #41417 由 @gante。顾名思义，它允许在您的注意力层中剪枝头部。

### 支持的 torch API 更新

我们放弃了对两个 torch API 的支持：

- `torchscript` 在 #41688
- `torch.fx` 在 #41683

这些 API 已被 PyTorch 团队弃用，我们转而专注于支持的 API `dynamo` 和 `export`。

## 量化变更

我们清理了 transformers 中的量化 API，并显著重构了权重加载，如上所述。

我们放弃了对两个已弃用一段时间的量化参数的支持：

- `load_in_4bit`
- `load_in_8bit`

我们移除它们，取而代之的是 `quantization_config` 参数，该参数更完整。例如，以下是使用该参数加载 4 位 bitsandbytes 模型的方法：

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(load_in_4bit=True)

model_4bit = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    device_map="auto",
    quantization_config=quantization_config
)
```

## 配置

- 删除了用于初始化嵌套配置的方法，如 `from_xxx_config`。配置可以通过 `__init__` 方法以相同方式初始化。见 #41314。
- 不再可能从 URL 文件加载配置类。配置必须从本地路径或 Hub 上的存储库加载。见 #42383。
- 所有用于配置模型旋转嵌入的参数现在存储在 `mode.rope_parameters` 下，包括 `rope_theta` 和 `rope_type`。模型的 `config.rope_parameters` 在大多数情况下是简单的字典，在特殊情况下（即 Gemma3 和 ModernBert）也可以是嵌套字典，每种层类型具有不同的 rope 参数化。尝试获取 `config.rope_theta` 现在将抛出属性错误。见 #39847 和 #42255
- Qwen-VL 系列配置是嵌套格式的，尝试直接访问键将抛出错误（例如 `config.vocab_size`）。用户应该从它们各自的子配置访问键（`config.text_config.vocab_size`）。
- 非生成模型（任何不调用 `model.generate()` 的模型）的配置将不再有 `generation_config`，并且 `model.config.generation_config` 将抛出属性错误。

## 处理

### 分词

- 慢分词器文件（即：`tokenization_<model>.py`）将被移除，取而代之的是使用快分词器文件 `tokenization_<model>_fast.py` --> 将重命名为 `tokenization_<model>.py`。由于快分词器是 🤗`tokenizers` - 后端，它们包含更广泛的可维护和可靠的功能。
- 如果加载快分词器失败，其他后端（sentence piece、tokenizers 等）将通过轻量级层支持
- 移除遗留文件如 special_tokens_map.json 和 added_tokens.json
- 移除 \_eventually_correct_t5_max_length
- `encode_plus` --> `__call__`
- `batch_decode` --> `decode`

`apply_chat_template` 默认返回裸露的 `input_ids` 而不是 `BatchEncoding` 字典。这是不方便的 - 它应该像 `tokenizer.__call__()` 一样返回 `BatchEncoding` 字典，但为了向后兼容我们一直坚持使用它。该方法现在返回 `BatchEncoding`。

链接 PR：

- #40938
- #40936
- #41626

### 处理类

- 在处理类中，每个属性将作为嵌套字典序列化在 `processor_config.json` 下，而不是在自己的配置文件中序列化属性。加载将支持所有旧格式的处理器（#41474）
- `XXXFeatureExtractors` 类被完全移除，取而代之的是所有视觉模型的 `XXXImageProcessor` 类（#41174）
- 次要更改：`XXXFastImageProcessorKwargs` 被移除，取而代之的是 `XXXImageProcessorKwargs`，它将在快和慢处理器之间共享（#40931）

## 建模

- 一些 `RotaryEmbeddings` 层将开始返回元组字典，以防模型使用多个 RoPE 配置（Gemma2、ModernBert）。每个值将是每个 RoPE 类型的 "cos, sin" 元组。
- `RotaryEmbeddings` 层的配置属性将被统一并通过 `config.rope_parameters` 访问。对于某些模型，`rope_theta` 的配置属性可能不再可访问，而将在 `config.rope_parameters['rope_theta']` 中。BC 将尽可能支持一段时间，在不久的将来我们将逐步移至新的 RoPE 格式（#39847）
- 视觉语言模型将无法通过 `model.language_model` 从生成模型快捷访问其语言和视觉组件。建议使用 `model.model.language_model` 或 `model.get_decoder()` 访问模块。见 #42156

### 生成

- 移除了旧的、已弃用的输出类型别名（例如 `GreedySearchEncoderDecoderOutput`）。我们现在只有 4 个由以下矩阵构建的输出类：仅解码器 vs 编码器-解码器，使用束搜索 vs 不使用束搜索（#40998）
- 移除了关于解码方法的已弃用类，这些类由于使用率低而移至 Hub（约束和束搜索分数）（#41223）
- 如果 `generate` 没有接收到任何 KV Cache 参数，现在使用的默认缓存类由模型定义（而不是始终是 `DynamicCache`）（#41505）
- 生成参数不再可以通过模型的配置访问。如果任何旧模型的生成参数序列化在 `config.json` 中，它将被加载回模型的生成配置中。用户应该只使用 `model.generation_config.do_sample = True` 来访问或修改生成参数。

## 训练器

### 新功能

- **ALST/Ulysses 序列并行集成**
  - 通过 HF Accelerate 添加序列并行支持，用于训练更长的序列。启用使用 ALST（All-to-All Long Sequence Training）和带有 DeepSpeed 的 Ulysses 算法在设备间分割序列。
- **改进的 `compute_loss_func` 处理**
  - `compute_loss_func` 现在总是优先于模型内置的损失计算，为用户提供对自定义损失函数的一致控制。
- **预测步骤中的 `num_items_in_batch`**
  - `num_items_in_batch` 参数现在在 `prediction_step` 期间传递给 `compute_loss`，启用评估期间的适当损失缩放。

### 破坏性变更

- **`report_to` 现在默认为 `"none"`**
  - 默认情况下不再自动检测日志集成；用户必须明确指定使用哪些报告后端。

### 由于使用率低而在 `TrainingArguments` 中移除没有弃用周期的参数

- `mp_parameters` -> 旧参数，后来添加到 Sagemaker 训练器
- `_n_gpu` -> 不打算让用户设置，我们将正确初始化它，而不是将其放在 `TrainingArguments` 中
- `overwrite_output_dir` -> 被 `resume_from_checkpoint` 替换，它只在示例脚本中使用，对 Trainer 没有影响
- `logging_dir` -> 只用于 tensorboard，设置 `TENSORBOARD_LOGGING_DIR` 环境变量代替
- `jit_mode_eval` -> 使用 `use_torch_compile` 代替，因为不再推荐 torchscript
- `tpu_num_cores` -> 实际上最好移除它，因为不推荐设置核心数量。默认情况下，使用所有 TPU 核心。设置 `TPU_NUM_CORES` 环境变量代替
- `past_index` -> 只用于非常少数具有特殊架构如 transformersxl 的模型 + 完全没有文档说明如何训练这些模型
- `ray_scope` -> 只用于 ray 集成的小参数。设置 `RAY_SCOPE` var env 代替
- `warmup_ratio` -> 使用 `warmup_step` 代替。我们通过允许在 `warmup_step` 中传递浮点值将两个参数组合在一起。

### 在 `TrainingArguments` 中移除已弃用的参数

- `fsdp_min_num_params` 和 `fsdp_transformer_layer_cls_to_wrap` -> 使用 `fsdp_config`
- `tpu_metrics_debug` -> `debug`
- `push_to_hub_token` -> `hub_token`
- `push_to_hub_model_id` 和 `push_to_hub_organization` -> `hub_model_id`
- `include_inputs_for_metrics` -> `include_for_metrics`
- `per_gpu_train_batch_size` -> `per_device_train_batch_size`
- `per_gpu_eval_batch_size` -> `per_device_eval_batch_size`
- `use_mps_device` -> 如果检测到将默认使用 mps
- `fp16_backend` 和 `half_precision_backend` -> 我们将只依赖 `torch.amp`，因为所有内容都已上传到 torch
- `no_cuda` -> `use_cpu`
- `include_tokens_per_second` -> `include_num_input_tokens_seen`
- `use_legacy_prediction_loop` -> 从现在起我们只使用 `evaluation_loop` 函数

### 在 `Trainer` 中移除已弃用的参数

- 初始化中的 `tokenizer` -> `processing_class`
- `train()` 中的 `model_path` -> `resume_from_checkpoint`

### 为 `Trainer` 移除的功能

- sigpot hp 集成被移除，因为库被归档 + api 停止工作
- 放弃对 sagemaker API <1.10 的支持
- 将 accelerate 最低版本提升到 1.1.0
- 将 peft 最低版本提升到 0.18.0
- 将 bitsandbytes 最低版本提升到 0.46.1

### `Trainer` 的新默认值

- 模型配置中的 `use_cache` 将设置为 `False`。如果需要，您仍然可以通过 `TrainingArguments` `usel_cache` 参数更改缓存值。

## 管道

- 图像到文本的管道将不再接受图像作为单独的参数以及对话聊天。图像数据必须嵌入到聊天的"内容"字段中。见 #42359

## PushToHubMixin

- 从 `PushToHubMixin` 中移除已弃用的 `organization` 和 `repo_url`。您必须传递 `repo_id`。
- 从 `PushToMixin` 中移除 `ignore_metadata_errors`。实际上，如果我们在加载模型卡片时忽略错误，我们将无法将卡片推送回 Hub，所以最好提前失败而不提供以后失败的选项。
- `push_to_hub` 不再接受 `**kwargs`。所有接受的参数都有明确的文档记录。
- `push_to_hub` 的参数现在是仅关键字的，以避免混淆。只有 `repo_id` 可以是位置参数，因为它是主要参数。
- 从 `push_to_hub` 中移除 `use_temp_dir` 参数。我们现在在所有情况下都使用 tmp 目录。

链接 PR：#42391。

## CLI

已弃用的 `transformers-cli ...` 命令已被弃用，`transformers ...` 现在是唯一的 CLI 入口点。

`transformers` CLI 已迁移到 `Typer`，使其更易于维护 + 开箱即用地添加一些不错的功能（改进的 `--help` 部分、自动完成）。

最大的破坏性变更在 `transformers chat` 中。此命令启动一个终端 UI 与聊天模型交互。它过去也能够启动一个由 `transformers` 驱动的聊天完成服务器并与之聊天。在这个重新设计的版本中，此功能已被移除，取而代之的是 `transformers serve`。拆分 `transformers chat` 和 `transformers serve` 的目标是定义客户端和服务器代码之间的清晰边界。这有助于维护，但也使命令不那么臃肿。`transformers chat` 的新签名是：

```bash
用法: transformers chat [选项] BASE_URL MODEL_ID [生成标志]...
从命令行与模型聊天。
```

它与 `transformers serve` 协同工作，这意味着如果 `transformers serve` 在其默认端点上运行，`transformers chat` 可以按如下方式启动：

```bash
transformers chat HuggingFaceTB/SmolLM3-3B
```

但它可以使用任何 OpenAI API 兼容的 HTTP 端点：

```bash
transformers chat HuggingFaceTB/SmolLM3-3B https://router.huggingface.co/v1
```

链接 PR：

- #40997
- #41487

### 移除 `run` 方法

`transformers run`（以前的 `transformers-cli run`）是过去的遗物，没有文档记录也没有测试，也不是任何公共文档的一部分。我们现在移除它，请让我们知道这是否是您正在使用的方法；在这种情况下，我们应该以更好的支持带回来。

链接 PR：#42447

## 环境变量

像 `TRANSFORMERS_CACHE`、`PYTORCH_TRANSFORMERS_CACHE` 和 `PYTORCH_PRETRAINED_BERT_CACHE` 这样的遗留环境变量已被移除。请使用 `HF_HOME` 代替。

常量 `HUGGINGFACE_CO_EXAMPLES_TELEMETRY`、`HUGGINGFACE_CO_EXAMPLES_TELEMETRY`、`HUGGINGFACE_CO_PREFIX` 和 `HUGGINGFACE_CO_RESOLVE_ENDPOINT` 已被移除。请使用 `huggingface_hub.constants.ENDPOINT` 代替。

链接 PR：#42391。

## 需求更新

`transformers` v5 将 `huggingface_hub` 版本固定为 `>=1.0.0`。请参阅此迁移指南以了解更多关于此主要版本的信息。以下是主要方面：

- 将 HTTP 后端从 `requests` 切换到 `httpx`。此更改旨在提高性能并以相同方式支持同步和异步请求。如果您目前在代码库中捕获 `requests.HTTPError` 错误，您需要切换到 `httpx.HTTPError`。
- 与 1 相关，无法从脚本设置代理。要处理代理，您必须设置 `HTTP_PROXY` / `HTTPS_PROXY` 环境变量
- `hf_transfer` 因此 `HF_HUB_ENABLE_HF_TRANSFER` 已完全放弃，取而代之的是 `hf_xet`。这对大多数用户应该是透明的。如果您注意到任何缺点，请告诉我们！

`typer-slim` 已作为必需依赖项添加，用于实现 `hf` 和 `transformers` CLI。

## v5 中的新模型添加

### CWM

代码世界模型 (CWM) 模型在 CWM: An Open-Weights LLM for Research on Code Generation with World Models 中由 Meta FAIR CodeGen Team 提出。CWM 是用于代码生成和推理代码的 LLM，特别是被训练得更好地表示和推理代码和命令如何影响程序或系统的状态。具体来说，我们在 Python 执行轨迹和容器化环境中的代理交互的大量观察-动作轨迹上对 CWM 进行了中期训练。我们在可验证的编码、数学和多轮软件工程环境中进行了广泛的多任务 RL 后训练。

### SAM3

SAM3 (Segment Anything Model 3) 在 SAM 3: Segment Anything with Concepts 中引入。

SAM3 添加添加了四个新架构：

- Sam3
- Sam3Tracker
- Sam3TrackerVideo
- Sam3Video

SAM3 在图像上执行可提示概念分割 (PCS)。PCS 接受文本和/或图像示例作为输入（例如，"黄色校车"），并为每个匹配概念的单一对象预测实例和语义掩码。

Sam3Tracker 和 Sam3TrackerVideo 在图像上执行可提示视觉分割 (PVS)。PVS 接受交互式视觉提示（点、框、掩码）或文本来分割每个提示的特定对象实例。这是 SAM 1 和 SAM 2 专注的任务，SAM 3 在此基础上进行了改进。Sam3Tracker 和 Sam3TrackerVideo 是 SAM2 Video 的更新版本，保持相同的 API，同时提供改进的性能和能力。

SAM3 Video 在视频上执行可提示概念分割 (PCS)。PCS 接受文本作为输入（例如，"黄色校车"），并为每个匹配概念的单一对象预测实例和语义掩码，同时在视频帧之间保持对象身份。该模型将检测模块 (SAM3) 与跟踪模块 (SAM2 风格的跟踪器) 结合，使用文本提示实现跨视频帧的稳健对象跟踪。

### LFM2 MoE

LFM2-MoE 是 LFM2 的专家混合 (MoE) 变体。LFM2 系列通过将短程、输入感知的门控卷积与分组查询注意力 (GQA) 相结合，为设备推理进行了优化，布局调整为在严格的速度和内存约束下最大化质量。

LFM2-MoE 保留了快速骨干，并引入了稀疏 MoE 前馈网络，在不显著增加活动计算路径的情况下增加了表示能力。第一个 LFM2-MoE 发布版本是 LFM2-8B-A1B，具有 8.3B 总参数和 1.5B 活动参数。该模型在质量（可与 3-4B 密集模型相媲美）和速度（比其他 1.5B 级别模型更快）方面表现出色。

### VideoLlama 3

VideoLLaMA3 模型是阿里巴巴 DAMO 学院 VideoLLaMA2 的重大更新。

### AudioFlamingo 3

Audio Flamingo 3 (AF3) 是一个完全开放的大型音频-语言模型，用于对语音、环境声音和音乐进行稳健理解和推理。AF3 将 Whisper 风格的音频编码器与因果语言模型配对，并执行就地替换音频-文本融合：处理器将池化后音频帧与专用占位符 token 对齐，模型在前向传递期间用投影的音频嵌入替换那些 token 插槽。

模型检查点可在：nvidia/audio-flamingo-3-hf

亮点：

- 跨语音、声音和音乐的统一音频编码器。
- 通过窗口化和池化后对齐支持长音频（最长 10 分钟）。模型以 30 秒窗口处理音频，硬限制为 20 个窗口（总共 10 分钟）。超过 10 分钟的音频将被截断。
- 通过用音频嵌入替换音频占位符 token 来保留序列长度的确定性融合。

### Nanochat

NanoChat 是一个紧凑的仅解码器 transformer 模型，用于教育目的和高效训练。该模型具有几个基本的架构创新，这些在现代 transformer 模型中很常见。因此，它是作为起点来理解现代 transformer 模型原理的好模型。NanoChat 是 Llama 架构的变体，具有简化的注意力机制和规范化层。
