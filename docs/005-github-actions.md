# GitHub Actions 自动化流程

## 📋 快速概览

本项目配置了两个核心工作流：

| 工作流       | 功能              | 触发时机                      |
| ------------ | ----------------- | ----------------------------- |
| **ci.yml**   | 完整 CI/CD 流水线 | PR 推送到 main/master/release |
| **ruff.yml** | 自动代码质量修复  | 所有分支推送                  |

---

## 🚀 CI/CD 流水线 (ci.yml)

### 主要功能

- **测试矩阵**: Python 3.12/3.13, Ruff, MyPy, 单元/集成测试
- **安全扫描**: Safety (依赖漏洞) + Bandit (代码安全)
- **Docker**: 多平台构建测试，主分支自动推送
- **性能测试**: PR 性能基准测试
- **发布**: Python 包构建 + GitHub Release

### 触发条件

- PR 到 `main`, `master`, `release/**`
- Push 到 `main`, `master`, `release/**`

---

## 🔧 自动代码质量修复 (ruff.yml)

### 工作流程

1. 检测 Ruff 代码问题
2. 自动应用可修复的问题
3. 创建/更新 PR 提交修复
4. 支持通知配置

### 智能特性

- 避免无限循环（跳过 auto-fix 分支）
- 更新现有 PR 而非创建重复
- 支持并发控制

---

## ⚙️ 配置要求

### 必需的 Secrets

| 名称                | 用途                | 说明                 |
| ------------------- | ------------------- | -------------------- |
| `ANTHROPIC_API_KEY` | API 认证            | 必需                 |
| `DOCKER_USERNAME`   | Docker Hub 用户名   | 推送镜像             |
| `DOCKER_PASSWORD`   | Docker Hub 访问令牌 | 使用访问令牌，非密码 |

### 可选配置（通知）

| 类型      | Secrets                                          | Variables                                                           |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| **Slack** | `SLACK_WEBHOOK_URL`                              | -                                                                   |
| **邮件**  | `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM` | `NOTIFICATION_ENABLED=true`, `EMAIL_NOTIFICATIONS=user@example.com` |

<details>
<summary>📧 邮件通知详细配置</summary>

#### Gmail 配置步骤

1. 启用两步验证
2. 生成应用专用密码
3. 配置 Secrets:
   - `EMAIL_USERNAME`: Gmail 地址
   - `EMAIL_PASSWORD`: 16 位应用密码（含空格）
   - `EMAIL_FROM`: 发件人地址（可选）

#### 自定义 SMTP

```
SMTP_SERVER: smtp.example.com
SMTP_PORT: 587
```

</details>

---

## 📊 质量标准

- **测试覆盖率**: 最低 80%
- **Ruff**: 自动修复可修复问题
- **MyPy**: 静态类型检查（需手动修复）
- **安全扫描**: Safety + Bandit

---

## 🐛 故障排除

### 常见问题速查

| 问题            | 解决方案                        |
| --------------- | ------------------------------- |
| API Key 错误    | 检查 `ANTHROPIC_API_KEY` secret |
| Docker 认证失败 | 确认使用访问令牌而非密码        |
| 测试失败        | 检查环境配置，查看日志          |
| PR 创建失败     | 确认 GITHUB_TOKEN 权限          |
| 通知失败        | 验证 Webhook URL 或 SMTP 配置   |

### 调试技巧

- 查看 workflow 运行日志
- 使用 GitHub Actions 调试功能
- 本地复现失败命令
- 检查 Step Summary

---

## 🔗 相关资源

- [GitHub Actions 运行历史](${{ github.server_url }}/${{ github.repository }}/actions)
- [配置参考](../.github/workflows/)
- [测试运行指南](../tests/agents/run_tests.py)
