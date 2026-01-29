---
name: doc-review
description: 遵循 AGENTS.md 标准，对文档进行系统性审计与熵减优化，确保架构正交、逻辑自洽、内容完整且直观。
allowed-tools: view_file, list_dir, grep_search, find_by_name, replace_file_content, multi_replace_file_content, write_to_file, search_web
---

# Document Review Skill

本 Skill 旨在为文档提供标准化、全维度的审查与精调服务。通过系统性思维与架构视角，确保文档不仅在内容上准确无误，更在结构与逻辑上符合 **Entropy Reduction (熵减)** 与 **Context-Driven (上下文驱动)** 的核心原则。

## 核心审查维度 (The 5 Pillars)

依据 `AGENTS.md` 的工程行为准则，从以下五个正交维度对文档进行深度审计：

### 1. 系统性 (Systemic Integrity)

- **全局视角**：文档是否建立了与项目全景（Pulse, Hippocampus, Perception, Realm of Mind）的链接？
- **涟漪效应**：是否评估了文档变更对上下游（如架构图、API 定义、测试用例）的潜在影响？
- **上下文锚定**：内容是否基于 CDD (Context-Driven Development) 构建，而非孤立的描述？

### 2. 正交性 (Orthogonality)

- **关注点分离**：是否清晰界定了“为什么 (Why)”、“是什么 (What)”与“怎么做 (How)”？
- **概念独立**：各章节是否作为一个独立的概念主体存在？修改一处是否需要联动修改多处（High Coupling）？
- **去冗余**：遵循 DRY (Don't Repeat Yourself) 原则，引用单一事实来源 (Single Source of Truth) 而非重复定义。

### 3. 顺序自洽 (Sequential Consistency)

- **逻辑流**：阅读顺序是否符合认知规律（如：背景 -> 目标 -> 方案 -> 验证）？
- **因果链**：推论是否由前置事实严谨推导得出？是否存在突兀的跳跃？
- **术语一致性**：核心名词与动词在全文及跨文档间是否保持严格一致？

### 4. 完整性 (Completeness)

- **闭环验证**：是否涵盖了“设计-实现-验证”的全链路？是否有明确的测试标准或 SOP？
- **边界覆盖**：是否讨论了限制条件、边缘情况 (Edge Cases) 与故障模式？
- **循证工程**：关键决策是否提供了背景引用或 IEEE 格式的参考文献？

### 5. 直观性 (Intuitiveness)

- **图文并茂**：复杂逻辑是否通过 Mermaid 图表（时序图、流程图、类图）进行了可视化降维？
- **视觉层级**：标题、列表、引用块的使用是否构建了清晰的信息层级？
- **代码规范**：代码示例是否完整、可运行，并符合 Vibe Coding Pipeline 标准？

## 审查工作流 (Review Workflow)

### Step 1: 全景扫描 (Panorama Scan)

- **范围定义**：明确文档的受众、核心目标与边界。
- **体量评估**：检查字数、章节深度，评估是否需要拆分（如果层级 > 4 或字数 > 1万字）。
- **预检清单**：执行元数据检查、语言规范检查与 Checksums 验证。

### Step 2: 骨架评估 (Skeleton Assessment)

- **TOC 分析**：提取目录树，验证是否符合 MECE 原则（完全穷尽，相互独立）。
- **叙事流验证**：检查顶级章节的排序逻辑（如：Input -> Process -> Output 或 Context -> Strategy -> Tactics）。
- **认知负载检查**：识别过于臃肿的章节（Fat Sections），建议拆分或重组。

### Step 3: 内容一致性与正交性 (Consistency & Orthogonality)

- **概念解耦**：检查章节间是否存在强耦合（改A需改B），建议正交化重构。
- **事实核对 (CDD)**：交叉验证文档内容与代码库 (`src/`) 及架构标准 (`AGENTS.md`) 的一致性。
- **术语标准化**：扫描全文，确保专有名词（如 "Hippocampus", "Perception"）定义的唯一性与一致性。

### Step 4: 熵减与精炼 (Entropy Reduction)

- **噪声过滤**：删除冗余的修饰语、过时的描述和重复的定义。
- **信噪比优化**：将大段文本转换为列表、表格或 Mermaid 图表。
- **代码规范**：验证代码块是否完整、可运行，并移除无关的 Log 或注释。

### Step 5: 导航与交互体验 (Navigation & UX)

- **视觉层级**：检查标题、引用块、Alerts 的层级关系是否清晰。
- **路标系统**：验证锚点链接（Inter-links）与外部引用（References）的有效性。
- **图表审查**：确保所有 Mermaid 图表在 Dark Mode 下清晰可见，且具备完整的图例。

## 交付产物 (Deliverables)

每次 Review 应输出以下内容之一或组合：

1. **Review Report**: 包含问题分级（Critical/Major/Minor）的详细清单。
2. **Refined Document**: 直接修正后的文档版本（需注明修改点）。
3. **Optimization Suggestions**: 针对架构或设计层面的改进建议。

## 最佳实践 (Best Practices & Examples)

本 Skill 适用于以下核心场景，请根据具体需求选择侧重点：

### Scenario 1: 架构设计验收 (Systemic & Orthogonal Check)

**适用场景**：提交新的设计文档 (Design Doc) 或重大架构变更时。
**核心关注**：系统性完整性、概念正交性、与 `AGENTS.md` 的对齐度。
**Prompt**:

> "Review `docs/engine/030-the-perception.md`. 重点审查其是否遵循 **正交分解** 原则，检查 'Retrieval' 与 'Ranking' 模块是否解耦。同时验证与 `AGENTS.md` 中 'Entropy Reduction' 理念的符合度。"

### Scenario 2: SOP 可执行性验证 (Consistency & Completeness)

**适用场景**：编写操作手册、部署指南或教程时。
**核心关注**：步骤的顺序自洽、命令的完整性、环境依赖的前置声明。
**Prompt**:

> "检查 `docs/implementation/deployment.md`。像一个新入职工程师一样**模拟执行**所有步骤。验证 Step 2 的 Docker 命令是否依赖 Step 1 的环境变量？是否存在隐含的前置条件未列出？"

### Scenario 3: 存量文档熵减 (Entropy Reduction & Intuitiveness)

**适用场景**：重构历史遗留文档、会议记录或混乱的草稿。
**核心关注**：结构重组、信噪比优化、可视化降维。
**Prompt**:

> "重构 `docs/research/010-context-engineering.md`。执行 **Panorama Scan**，如果字数超过 5000 字请建议拆分。将第 3 节复杂的文本描述转换为 Meredith 时序图。删除所有非信息量的形容词。"

### Scenario 4: 代码-文档一致性校验 (Fact Check)

**适用场景**：代码变更后的文档同步更新。
**核心关注**：单一事实来源 (SSOT)、参数准确性、代码引用有效性。
**Prompt**:

> "基于 `src/cognizes/engine/schema/perception_schema.sql` 的最新变更，审查 `docs/engine/030-the-perception.md` 中的 Schema 定义。指出所有过时或不一致的字段描述。"
