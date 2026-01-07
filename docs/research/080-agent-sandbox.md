---
id: agent-sandbox
sidebar_position: 8
title: Agent Sandbox
last_update:
  author: Aurelius Huang
  created_at: 2026-xx-xx
  updated_at: 2026-xx-xx
  version: 1.0
  status: Pending Review
tags:
  - Agent Sandbox
  - Zerocore-ai/Microsandbox
  - Vertex AI Agent Engine
  - 代码执行环境
---

## **1. 核心摘要与战略综述**

在生成式人工智能（Generative AI）向代理式人工智能（Agentic AI）演进的宏大叙事中，代码执行环境（Code Execution Environment）已不再仅仅是计算资源的容器，而是成为了智能体（Agent）思考与行动的物理边界。随着大型语言模型（LLM）被赋予编写并执行代码以解决复杂推理任务的能力，运行时（Runtime）的安全性、隔离性、启动延迟以及状态管理能力成为了决定系统成败的关键基础设施。

本报告旨在对当前市场上两种极具代表性但设计哲学截然不同的代理沙箱环境进行详尽、深入且正交的对比分析：**Zerocore-ai Microsandbox** 与 **Google Vertex AI Agent Engine Code Execution**。

Zerocore-ai Microsandbox 代表了 **“去中心化与主权控制”** 的技术路线。作为一个基于 Rust 编写的开源项目，它利用 libkrun 技术实现了基于 KVM 的硬件级 MicroVM 隔离，旨在为开发者提供一个轻量级、毫秒级启动且完全兼容 OCI 标准的本地或私有云沙箱。其核心价值在于对底层执行栈的绝对控制权与 **零信任架构** 的硬件强制隔离 1。

相比之下，Google Vertex AI Agent Engine Code Execution 代表了 **“超大规模托管与生态集成”** 的技术路线。作为 Google Cloud Vertex AI 平台的一部分，它提供了一个完全托管、无服务器（Serverless）的执行环境，通过 VPC Service Controls (VPC-SC) 和 IAM 体系实现了企业级的合规性与安全性。其核心优势在于与 Gemini 模型的深度原生集成、海量并发的弹性伸缩能力以及免运维（NoOps）的体验 3。

本分析将超越表面的功能对比，深入到底层虚拟化技术（MicroVM vs. gVisor）、网络安全架构（Host-Bridge vs. VPC-SC）、以及全生命周期的数据流转机制，为架构师和技术决策者提供一份具有深度的选型指南。

## **2. 代理式 AI 代码执行的风险图谱与技术演进**

### **2.1 从静态生成到动态执行的安全跃迁**

在传统的 RAG（检索增强生成）架构中，LLM 仅输出文本，风险主要集中在内容生成层面。然而，Agentic AI 引入了“工具使用（Tool Use）”范式，其中最强大的工具莫过于通用代码解释器（Code Interpreter）。当 Agent 被允许生成并执行 Python 或 Shell 脚本时，它实质上获得了一个由于模型幻觉或提示注入（Prompt Injection）可能被滥用的 Shell 访问权限。

传统的容器化技术（如 Docker）依赖于 Linux 内核的命名空间（Namespaces）和控制组（Cgroups）进行隔离。这种设计虽然轻量，但所有容器共享宿主机内核。一旦发生内核级漏洞逃逸（如 Dirty Cow 或 runC 漏洞），恶意代码即可攻陷整个节点 6。对于运行不可信 AI 生成代码的场景，这种“软隔离”被普遍认为是不可接受的风险。

### **2.2 隔离技术的代际分化**

为了应对这一挑战，工业界演化出了两条主要的技术路线，这也正是本次对比分析的两个主角所分别代表的方向：

1. **硬件级虚拟化（MicroVMs）：** 通过极度精简的虚拟机监视器（VMM），为每个沙箱提供独立的 Guest Kernel。这利用了 CPU 的硬件虚拟化指令集（Intel VT-x / AMD-V），提供了物理级别的内存和中断隔离。**Microsandbox** 是这一路线的典型代表，它利用 libkrun 实现了类似 AWS Firecracker 的安全性，但保持了类似容器的易用性 8。
2. **用户态内核仿真（Application Kernels）：** 通过在用户态拦截并重新实现系统调用（Syscalls），在应用程序与宿主机内核之间建立一道防火墙。Google 的 **gVisor** 是这一领域的各种事实标准，也是 Vertex AI 底层极大概率采用的技术栈 7。

## **3. Zerocore-ai Microsandbox：技术架构与深度剖析**

### **3.1 核心架构：Rust 与 MicroVM 的融合**

Microsandbox 的设计哲学是“为不可信代码提供既安全又快速的执行骨架”。其架构高度模块化，主要组件包括 Server、CLI、Core 和 SDK，其中核心逻辑约 77.9% 由 **Rust** 编写，体现了对内存安全和高性能的极致追求 1。

#### **3.1.1 虚拟化引擎：libkrun**

Microsandbox 并没有直接使用 QEMU 这种重型虚拟化方案，也没有直接复用 Firecracker 二进制文件，而是选择了 **libkrun**。

- **库级虚拟化：** libkrun 是一个基于 KVM（Linux）和 Hypervisor.framework（macOS）的动态库。这意味着虚拟化能力被直接嵌入到了 Microsandbox 的进程中，而不是通过外部进程调用。这种设计显著降低了上下文切换的开销 2。
- **启动延迟：** 得益于 libkrun 对启动流程的极致优化（剔除不必要的设备驱动、BIOS 仿真等），Microsandbox 能够实现 **<200 毫秒** 的启动时间。这对于需要实时交互的 Agent 来说至关重要，用户几乎感知不到虚拟机的冷启动过程 1。
- **硬件隔离边界：** 每个 Microsandbox 实例都运行在独立的 Guest Linux Kernel 上。即使 Agent 执行了恶意代码触发了 Kernel Panic，崩溃的也仅仅是 MicroVM 内部的内核，宿主机和其他沙箱完全不受影响。这是目前公认的最高级别隔离标准之一 1。

#### **3.1.2 OCI 兼容性与镜像管理**

Microsandbox 的另一大技术突破在于将 MicroVM 的安全性与 Docker 容器的生态便利性相结合。

- **镜像透传：** 它支持直接运行标准的 OCI 容器镜像（如 microsandbox/python 或 alpine）。系统会自动处理镜像层的拉取、解压，并将其挂载为 MicroVM 的根文件系统（RootFS）。这使得开发者可以复用现有的 Dockerfile 构建流程，无需专门为 MicroVM 制作镜像 1。
- **缓存机制：** 镜像层被缓存于 $HOME/.microsandbox 目录中，确保了后续启动的高效性 1。

### **3.2 资源管理与持久化机制**

#### **3.2.1 资源配额**

Microsandbox 允许通过 CLI 标志（如 --cpus 和 --memory）对每个沙箱实例进行细粒度的资源限制。这些限制并非通过 Cgroups 实现，而是在 VMM 层面直接分配给虚拟机的最大资源，从而从物理层面防止了“吵闹邻居（Noisy Neighbor）”效应导致的主机资源耗尽 1。

#### **3.2.2 项目级持久化**

与传统的 Docker 容器重启即重置不同，Microsandbox 引入了类似 venv 或 node_modules 的项目级持久化概念。

- **./menv 目录：** 当使用 Sandboxfile 定义项目时，沙箱内的所有文件变更、包安装（如 pip install）都会被持久化到宿主机的 ./menv 目录中。这使得 Agent 可以拥有“记忆”，在多次对话之间保持环境状态，极大地便利了复杂任务的开发与调试 1。

### **3.3 网络栈的局限与挑战**

根据目前的 Issue 追踪和文档分析，网络功能是 Microsandbox 的一个活跃开发区，但也存在显著的复杂性。

- **默认隔离：** 出于安全考虑，默认配置下沙箱网络往往是受限的。虽然可以通过参数配置网络桥接，但在 MicroVM 环境下实现高效且安全的网络透传（尤其是涉及 DNS 解析和出站流量控制时）比容器要复杂得多 13。
- **Issue #336：** 社区目前正在进行网络栈的重构（Revamp networking stack），这表明当前的实现可能在灵活性或性能上存在瓶颈，特别是对于需要频繁访问外部 API 的 Agent 来说，可能需要额外的手动配置 1。

## **4. Google Vertex AI Agent Engine：技术架构与深度剖析**

### **4.1 核心架构：托管式应用内核与 Borg 生态**

Vertex AI Agent Engine 的 Code Execution 是一个建立在 Google 庞大基础设施之上的 PaaS 服务。它不向用户暴露底层的虚拟机或容器，而是提供一个高可用的 API 端点。

#### **4.1.1 gVisor 与 Borg 的协同**

虽然 Google 未公开所有底层细节，但根据 Google Cloud 在 GKE Sandbox、Cloud Run 等产品线的技术惯例，以及业界对其安全架构的分析，Vertex AI Code Execution 极大概率运行在 **gVisor** 之上 10。

- **gVisor (runsc)：** 这是一个用 Go 语言编写的用户态内核。它拦截应用程序的所有系统调用，并在用户空间的 Sentry 进程中进行处理，而不是直接传递给宿主机内核。Sentry 仅使用极少数经过严格审计的宿主机系统调用。
- **安全边界：** 这种架构提供了纵深防御。第一层是 gVisor 的系统调用拦截，第二层是 Google Borg 集群的容器隔离，第三层是底层的 Hypervisor。虽然从理论上讲，软件模拟的内核隔离性略逊于硬件虚拟化，但在 Google 规模化的安全运营体系下，其实际安全性极高 6。
- **预热池（Warm Pool）：** 为了解决冷启动问题，Google 维护了一个巨大的预热沙箱池。当 API 请求到达时，系统可以瞬间分配一个已就绪的沙箱，实现**亚秒级**的代码执行响应，这在用户体验上与本地执行几乎无异 4。

#### **4.1.2 预置环境与库支持**

与 Microsandbox 允许任意镜像不同，Vertex AI Code Execution 目前提供的是一个**高度标准化的预置环境**。

- **预装库：** 环境中预装了数据科学常用的 Python 库，如 pandas, numpy, matplotlib, scipy, sklearn 等。这大大简化了数据分析类 Agent 的构建 15。
- **限制性：** 关键限制在于用户**不能**在代码执行过程中随意安装新的库（即不支持运行时的 pip install 任意包，除非通过特定的自定义容器构建流程，但这通常用于 Agent 本身而非动态代码执行环节）15。这反映了其“开箱即用”但牺牲部分灵活性的设计权衡。

### **4.2 安全治理与企业级集成**

#### **4.2.1 VPC Service Controls (VPC-SC)**

这是 Vertex AI 相对于任何开源自建方案的杀手级特性。VPC-SC 允许企业定义一个虚拟的安全边界，将 Vertex AI 资源包裹其中。

- **网络防火墙：** 即使 Agent 生成的代码试图发起恶意的外网连接（例如连接到 C&C 服务器或上传数据到未授权的 S3 存储桶），VPC-SC 也会在网络层直接阻断这些流量。这是一种独立于代码逻辑之外的架构级防御 17。
- **私有连接：** 通过 Private Service Connect (PSC)，企业可以在完全不暴露公网 IP 的情况下，让 Agent 访问内部的 BigQuery 数据仓库或私有 API，满足金融和医疗行业的严苛合规要求 18。

#### **4.2.2 状态管理与生命周期**

Vertex AI 引入了会话（Session）概念，支持长达 **14 天** 的状态保持。

- **上下文记忆：** 在同一会话 ID 下的连续调用可以共享内存状态（变量、函数定义）。这对于需要多轮对话逐步修正代码或进行探索性数据分析的场景至关重要。相比之下，传统的 FaaS（如 AWS Lambda）通常是无状态的，无法原生支持这种交互模式 4。

## **5. 正交维度对比分析**

为了提供精准的选型依据，我们将从隔离机制、性能、开发者体验、网络治理四个正交维度进行深度对比。

### **5.1 维度一：隔离原语与攻击面 (Isolation Primitives & Attack Surface)**

| 特性         | Microsandbox (Zerocore-ai)      | Vertex AI Agent Engine (Google)     |
| :----------- | :------------------------------ | :---------------------------------- |
| **核心技术** | **MicroVM (libkrun/KVM)**       | **Application Kernel (gVisor)**     |
| **隔离边界** | 硬件辅助虚拟化 (Ring -1/0)      | 软件系统调用拦截 (Ring 3)           |
| **内核关系** | 每个沙箱拥有独立的 Guest Kernel | 共享 Host Kernel (由 Sentry 代理)   |
| **攻击面**   | 极小 (仅限 Hypervisor/VMM 交互) | 较小 (受限于 Sentry 实现的 Syscall) |
| **逃逸难度** | 极高 (需突破 KVM/HVF)           | 高 (需突破 Gofer/Sentry + Borg)     |
| **防御纵深** | 依赖宿主机配置                  | Google 基础设施级纵深防御           |

深度洞察：
Microsandbox 提供了理论上更强的隔离性，因为它完全切断了不可信代码与宿主机内核的直接联系。如果代码触发了内核崩溃，它只杀死虚拟机。而 gVisor 虽然拦截了系统调用，但在极端情况下（如 CPU 侧信道攻击或未被拦截的底层漏洞），共享内核架构仍存在理论风险。然而，对于绝大多数应用场景，Google 的多层防御体系（gVisor + Borg + 硬件安全模块）提供的实际安全性已经远超一般企业自建的 KVM 环境。

### **5.2 维度二：性能特征与资源开销 (Performance & Overhead)**

| 特性           | Microsandbox (Zerocore-ai)    | Vertex AI Agent Engine (Google)     |
| :------------- | :---------------------------- | :---------------------------------- |
| **冷启动时间** | **< 200 ms** 1                | **亚秒级** (基于预热池) 4           |
| **运行时开销** | 极低 (CPU 虚拟化指令集直通)   | 中等 (Syscall 拦截带来的上下文切换) |
| **I/O 性能**   | 高 (virtio-fs 优化)           | 一般 (Gofer 代理文件系统操作)       |
| **伸缩性**     | 受限于单机物理资源 (垂直扩展) | **无限水平伸缩** (全球云资源池)     |
| **并发能力**   | 取决于本地内存/CPU            | 仅受限于云配额 (Quota)              |

深度洞察：  
Microsandbox 在单体执行效率上具有优势，特别是对于计算密集型任务，因为它几乎是原生运行在 CPU 上的。gVisor 由于需要拦截每一个系统调用，对于重 I/O 或重 Syscall 的任务（如大量小文件读写）会有显著的性能损耗 19。  
然而，在并发吞吐量上，Vertex AI 具有压倒性优势。如果需要同时运行 10,000 个 Agent 会话，Microsandbox 需要用户自行搭建庞大的服务器集群并管理调度，而 Vertex AI 仅需调用 API 即可瞬间满足需求。

### **5.3 维度三：网络治理与数据主权 (Networking & Sovereignty)**

| 特性         | Microsandbox (Zerocore-ai)                | Vertex AI Agent Engine (Google)        |
| :----------- | :---------------------------------------- | :------------------------------------- |
| **网络连接** | 默认受限/桥接，配置复杂，仍在重构中       | **默认无公网**，通过 VPC-SC 严格管控   |
| **数据驻留** | **完全本地/私有** (数据不出域)            | 托管于 Google Cloud (支持区域驻留 DRZ) |
| **外部访问** | 需手动配置网桥/NAT，灵活性高但风险大      | 需通过 PSC/NAT 网关，合规性强          |
| **协议支持** | 原生支持 **MCP (Model Context Protocol)** | 支持 Agent2Agent (A2A) 及 MCP 适配     |

深度洞察：  
Microsandbox 是数据主权的捍卫者。对于极度敏感的数据（如核心知识产权代码、未脱敏的 PII 数据），Microsandbox 允许在完全断网的物理机上运行 Agent，确保数据绝对不离开物理边界。  
Vertex AI 则是企业合规的标杆。VPC-SC 实际上构建了一个“云上局域网”，使得 Agent 可以在拥有云端算力的同时，像在内网一样安全地访问企业数据。

### **5.4 维度四：开发者体验与运维模型 (DX & Ops)**

| 特性         | Microsandbox (Zerocore-ai)                | Vertex AI Agent Engine (Google)   |
| :----------- | :---------------------------------------- | :-------------------------------- |
| **部署模式** | 自托管 (二进制/脚本安装)                  | SaaS (全托管服务)                 |
| **环境定义** | **Sandboxfile** (声明式，类似 Dockerfile) | API 参数 / 预置环境               |
| **定制化**   | **极高** (任意 OCI 镜像，任意语言)        | 中等 (主要支持 Python/JS，库受限) |
| **运维负担** | 高 (需管理宿主机、更新、监控)             | **零 (NoOps)**                    |
| **定价模型** | 开源免费 + 硬件成本                       | 按 vCPU/小时 + 存储计费 3         |

深度洞察：  
Microsandbox 提供了极致的定制自由度。开发者可以加载一个包含特定版本 Fortran 编译器的 Alpine 镜像来运行古老的科学计算代码。而 Vertex AI 目前更像是一个标准化的“Python 数据分析沙箱”，虽然稳定但缺乏这种底层定制能力。

## **6. 场景化选型指南**

基于上述分析，我们提出以下具体的场景化选型建议：

### **6.1 推荐使用 Microsandbox 的场景**

1. **本地开发与 CI/CD 流水线：** 开发者在笔记本电脑上构建 Agent 时，需要一个快速、零成本且能离线工作的环境。Microsandbox 提供的 CLI 工具完美契合这一“内循环（Inner Loop）”需求。
2. **边缘计算与 IoT：** 在网络连接不稳定或带宽昂贵的边缘设备（如工厂网关、车载电脑）上运行 Agent，Microsandbox 的轻量级和本地化特性是唯一选择。
3. **极度敏感的数据处理：** 涉及国家安全、核心机密等绝对禁止数据上云的场景。
4. **非标准运行时需求：** 需要运行 Rust、C++、Go 甚至 COBOL 等非 Python/JS 代码，或者需要特定 OS 级依赖库的场景。

### **6.2 推荐使用 Vertex AI Agent Engine 的场景**

1. **企业级生产环境：** 需要 SLA 保证、审计日志、以及符合 SOC2/HIPAA/GDPR 合规要求的生产系统。
2. **海量并发数据处理：** 例如金融行业的实时研报分析 Agent，需要同时处理数千份文档，Vertex AI 的弹性伸缩能力无可替代。
3. **Google Cloud 生态深度用户：** 已经在使用 BigQuery、Gemini Pro 或 Google Cloud Storage 的团队。VPC-SC 提供的内网互通体验能极大降低胶水代码的编写成本。
4. **RAG 与数据分析：** 利用其预置的 Pandas/Matplotlib 环境，快速构建能生成图表和深度洞察的数据分析 Agent。

## **7. 结论**

**Zerocore-ai Microsandbox** 与 **Google Vertex AI Agent Engine** 并非简单的竞争关系，而是代表了两种互补的基础设施进化方向。

**Microsandbox 是“构建者的瑞士军刀”**。它将硬件级隔离技术民主化，赋予了开发者在本地以极低延迟和极高安全性运行任意代码的能力。它是 Agent 开发、测试和私有化部署的理想基石，解决了“最后一公里”的安全执行问题。

**Vertex AI Agent Engine 是“企业的数字化堡垒”**。它将代码执行工业化、服务化，解决了大规模 Agent 部署中的运维、合规与安全治理难题。它是构建全球化、高可靠 Agent 应用的坚实地基。

**最终建议：** 对于追求极致控制力、定制化及数据主权的团队，Microsandbox 是不二之选；而对于追求快速上市、运维省心及生态协同的企业，Vertex AI Agent Engine 则是最佳拍档。在实际架构中，许多成熟的团队可能会采取**混合策略**：在开发阶段使用 Microsandbox 进行快速迭代和单元测试，在生产阶段将核心逻辑部署至 Vertex AI 以获得规模化优势，从而兼得两家之长。

## **Works cited**

1. zerocore-ai/microsandbox: opensource self-hosted sandboxes for ai agents - GitHub, accessed January 7, 2026, [https://github.com/zerocore-ai/microsandbox](https://github.com/zerocore-ai/microsandbox)
2. Microsandbox: Solving the Code Execution Security Dilemma | by Simardeep Singh, accessed January 7, 2026, [https://medium.com/@simardeep.oberoi/microsandbox-solving-the-code-execution-security-dilemma-4e3ea9138ef8](https://medium.com/@simardeep.oberoi/microsandbox-solving-the-code-execution-security-dilemma-4e3ea9138ef8)
3. Vertex AI Agent Builder | Google Cloud, accessed January 7, 2026, [https://cloud.google.com/products/agent-builder](https://cloud.google.com/products/agent-builder)
4. Agent Engine Code Execution | Vertex AI Agent Builder - Google Cloud Documentation, accessed January 7, 2026, [https://docs.cloud.google.com/agent-builder/agent-engine/code-execution/overview](https://docs.cloud.google.com/agent-builder/agent-engine/code-execution/overview)
5. Introducing Code Execution: The code sandbox for your agents on Vertex AI Agent Engine, accessed January 7, 2026, [https://discuss.google.dev/t/introducing-code-execution-the-code-sandbox-for-your-agents-on-vertex-ai-agent-engine/264336](https://discuss.google.dev/t/introducing-code-execution-the-code-sandbox-for-your-agents-on-vertex-ai-agent-engine/264336)
6. Choosing a Workspace for AI Agents: The Ultimate Showdown Between gVisor, Kata, and Firecracker - DEV Community, accessed January 7, 2026, [https://dev.to/agentsphere/choosing-a-workspace-for-ai-agents-the-ultimate-showdown-between-gvisor-kata-and-firecracker-b10](https://dev.to/agentsphere/choosing-a-workspace-for-ai-agents-the-ultimate-showdown-between-gvisor-kata-and-firecracker-b10)
7. A field guide to sandboxes for AI - Luis Cardoso, accessed January 7, 2026, [https://www.luiscardoso.dev/blog/sandboxes-for-ai](https://www.luiscardoso.dev/blog/sandboxes-for-ai)
8. AI Sandboxes: Daytona vs microsandbox - Pixeljets, accessed January 7, 2026, [https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/?utm_source=seoca](https://pixeljets.com/blog/ai-sandboxes-daytona-vs-microsandbox/?utm_source=seoca)
9. Self-Hosted Sandboxes: How to Pick Between Containers and MicroVMs | by Dafe - Medium, accessed January 7, 2026, [https://medium.com/@odafe41/self-hosted-sandboxes-how-to-pick-between-containers-and-microvms-1fa4803b7bdf](https://medium.com/@odafe41/self-hosted-sandboxes-how-to-pick-between-containers-and-microvms-1fa4803b7bdf)
10. Agentic AI on Kubernetes and GKE | Google Cloud Blog, accessed January 7, 2026, [https://cloud.google.com/blog/products/containers-kubernetes/agentic-ai-on-kubernetes-and-gke](https://cloud.google.com/blog/products/containers-kubernetes/agentic-ai-on-kubernetes-and-gke)
11. gVisor: The Container Security Platform, accessed January 7, 2026, [https://gvisor.dev/](https://gvisor.dev/)
12. microsandbox_core - Rust - Docs.rs, accessed January 7, 2026, [https://docs.rs/microsandbox-core](https://docs.rs/microsandbox-core)
13. Issues · zerocore-ai/microsandbox - GitHub, accessed January 7, 2026, [https://github.com/zerocore-ai/microsandbox/issues](https://github.com/zerocore-ai/microsandbox/issues)
14. Isolate AI code execution with Agent Sandbox | GKE AI/ML - Google Cloud Documentation, accessed January 7, 2026, [https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/agent-sandbox)
15. Code execution | Generative AI on Vertex AI - Google Cloud Documentation, accessed January 7, 2026, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/code-execution](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/code-execution)
16. Code execution | Gemini API - Google AI for Developers, accessed January 7, 2026, [https://ai.google.dev/gemini-api/docs/code-execution](https://ai.google.dev/gemini-api/docs/code-execution)
17. Vertex AI Agent Engine overview - Google Cloud Documentation, accessed January 7, 2026, [https://docs.cloud.google.com/agent-builder/agent-engine/overview](https://docs.cloud.google.com/agent-builder/agent-engine/overview)
18. Vertex AI networking access overview - Google Cloud Documentation, accessed January 7, 2026, [https://docs.cloud.google.com/vertex-ai/docs/general/netsec-overview](https://docs.cloud.google.com/vertex-ai/docs/general/netsec-overview)
19. Security Without Sacrifice: Edera Performance Benchmarking, accessed January 7, 2026, [https://edera.dev/stories/security-without-sacrifice-edera-performance-benchmarking](https://edera.dev/stories/security-without-sacrifice-edera-performance-benchmarking)
20. Comparing 3 Docker container runtimes - Runc, gVisor and Kata Containers, accessed January 7, 2026, [https://dev.to/rimelek/comparing-3-docker-container-runtimes-runc-gvisor-and-kata-containers-16j](https://dev.to/rimelek/comparing-3-docker-container-runtimes-runc-gvisor-and-kata-containers-16j)
