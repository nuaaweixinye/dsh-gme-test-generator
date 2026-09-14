# dsh-gme-workflow

[English](README.md) | 中文

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）里驱动 GME Test Agent 的工作流：三个工具负责挑选接口、在本地 Python 后端中自主完成测试生成与修复、轮询任务直到待评审，并把对外动作挡在用户显式同意之后。

这是一个社区插件，不是 DeepSeek 官方包；它需要你已经有一份 GME Test Agent 源码目录及其 Python 依赖——它驱动那个工程，而不是替代它。

## 前置条件

- DeepSeek Harness `0.1.x` 线上 `0.1.2-alpha.1` 或更新版本，且 profile 基于 base、提供 `tools` 与 `systemPrompt`。
- 一份 GME Test Agent 源码目录，包含 `backend/run_backend.py`、`config.local.json`、任务数据库，以及它需要的 GME 仓库与编译工具链。**该工程不随本插件分发、也未公开**：它是私有检出，访问权限由维护者按人授予——联系 [@nuaaweixinye](https://github.com/nuaaweixinye)。
- 一个装好后端依赖的 Python 解释器，并在其中安装版本匹配的 `deepseek-harness-sdk` 与 `deepseek-harness-runtime-bin` wheel。
- 若需要自动启动，profile 中要有本机 `subprocess` 服务（所有随附 profile 都有）。

Python 后端通过 DeepSeek Harness Python SDK 在独立的 `sdk` 配置中执行编码工作。构建、测试与内存审计由后端作为每个任务的自动阶段执行，不是对话动作。该编码配置包含文件、搜索与 PowerShell 工具，并排除本插件，因此任务不会递归。

## 安装

在插件市场（设置 → 插件市场）一键安装，或者：

```sh
dsh plugin --profile web add dsh-gme-workflow
```

该命令会安装本包，并把 `dsh-gme-workflow` 追加到 profile 的 `dsh.profile.bundles`；本包自带 `dsh.bundle.patch` 层，因此**无需手工编辑任何 profile 文件**。之后重启 `dsh web` 即可。

## 配置

`backendRoot` 是部署路径，没有默认值，也永远不会作为模型参数暴露。在设置它之前，插入的条目保持**停用**状态（`!!js` 守卫），插件不注册任何内容——未配置的安装是惰性的，绝不会导致启动失败。

**方式一 —— 环境变量**，在 Harness 启动时读取：

```powershell
$env:GME_TEST_AGENT_ROOT  = 'D:/workspace/gme-test-agent'
$env:GME_TEST_AGENT_PYTHON = 'C:/ProgramData/Miniconda3/envs/agent/python.exe'   # 可选，默认 'python'
dsh web
```

**方式二 —— profile 补丁**，写在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`：

```yaml
- id: gme-workflow
  disabled: false            # 必须写：只覆盖 config 会保留上面的 `!!js` 守卫
  config:
    backendRoot: D:/workspace/gme-test-agent
    pythonPath: C:/ProgramData/Miniconda3/envs/agent/python.exe
    port: 8765
    autoStart: true
```

补丁条目只替换它写明的键（`config` 整体替换），其他键保持原样——这正是用这种方式给路径时必须显式关掉守卫的原因。

| 配置键 | 默认值 | 含义 |
|---|---|---|
| `backendRoot` | *必填* | 含 `backend/run_backend.py` 的 GME Test Agent 源码目录 |
| `pythonPath` | `python` | 装好后端依赖的解释器 |
| `configFile` | `config.local.json` | 后端配置，绝对路径或相对 `backendRoot` |
| `tokenFile` | `logs/web-api-token.log` | API token；自动启动时缺失会创建 |
| `port` | `8765` | 后端在 IPv4 回环上的端口 |
| `autoStart` | `true` | 端口拒绝连接时启动由本插件持有的 Python 进程 |
| `timeoutMs` | `15000` | 单次 HTTP 请求（含响应体）的时限 |
| `startupTimeoutMs` | `45000` | 持有的进程变为健康的时限 |
| `maxResponseBytes` | `8388608` | 单次响应最多保留的字节数 |
| `pageChars` | `12000` | 每个报告页的字符数（256–50000） |

如果旧 profile 另外启用了 `tool-gme`，请禁用那条；安装本插件不会删除其他包。

## 工具

| 工具 | 分区 |
|---|---|
| `gme_generate` | 自主生成：按接口 ID 或自由目标创建测试、批量创建、修复已记录的失败、扩展或重试任务 |
| `gme_check` | 无副作用读取：接口目录、任务、增量事件、失败及其观测记录、测试结果、产物 |
| `gme_decide` | 需确认的决策，必须 `confirm: true`：任务 PR、已知失败 skip PR、选中测试 PR、删除选中测试、清理、删除任务 |

创建与扩展测试时，使用接口目录的 `interface_ids` 或自由描述的 `goal`，不能同时提供：后端在选择接口后会丢弃自由目标，插件会拒绝这种组合。批量创建必须使用接口 ID。选择前先查询目录；任务操作使用后端任务 ID，而不是 Harness 会话 ID。

生成从接收起自主运行到 `needs_review`；模型用 `gme_check` 轮询，不干预中间的构建、测试与内存审计阶段。每个响应都携带 `suggested_next` 路标，其 `phase` 依次为 poll → report → decide → done：任务执行期间持续轮询，到 `needs_review` 时汇报摘要、失败与差异，对外动作留给用户。不带 `confirm: true` 的 `gme_decide` 调用会返回引导性错误，不会到达后端。

生成与决策可能返回 `accepted: true`，仅表示已排队，不能当作验证通过。报告返回 `content`（JSON 序列化文本的片段）、`total_characters` 与 `next_offset`；用该 offset 重复同一查询即可继续读取。动态列表在分页期间可能变化；实时进度用 `events.after` 增量查询，稳定报告读取已完成任务的产物。查询到 `status: failed` 的任务是正常结果；基础设施故障表现为工具错误。

## 行为与限制

- **后台进程生命周期。** 首次请求只有在健康检查通过身份验证后才复用已有服务；否则 `autoStart: true` 会启动配置的 Python 入口，并发调用共享这次启动。身份验证失败或端口上是其他服务时，直接失败且不启动进程。卸载插件只终止它自己启动的后端及其子进程——因此关闭或重载 Harness 可能中断托管任务，而独立启动的后端会保留。托管进程退出后，下一次请求会重新启动它，但不会替你重试被中断的任务。取消工具等待只是停止等待，不会取消已接收的后台任务；POST 请求不会自动重发，提交结果不明确时先查询任务。
- **凭据。** token 来自 `tokenFile`，不会出现在工具参数中，且只把 API token 显式传给托管子进程。编码 SDK 使用后端配置的 `dsh_home` 与 `dsh_profile`，凭据必须在那里可用。外层工作流对话与各后端编码会话分别保存历史。
- **已知限制。** 仍然需要 Python 项目及其工具链；后端没有取消接口，也没有进程重启后的任务自动恢复；`gme_decide` 的确认门是插件侧的 `confirm: true` 检查，后端仍按自身规则执行提交与清理；自由描述任务沿用后端自身的选择与验证行为；大报告是字符分页窗口，不是不可变快照或结构化表格。

## 开发

```sh
pnpm install
pnpm run verify        # 类型检查 + 构建 + 测试 + 发布产物冒烟
pnpm run test:live     # 对真实后端只读冒烟（需要 GME_TEST_AGENT_ROOT）
```

`src/backend.ts` 管理身份验证、HTTP 与后台进程，`src/index.ts` 管理工具定义、路由映射、结果展示与“未配置即不注册”的守卫，`src/next-step.ts` 将后端状态映射为 `suggested_next` 路标。`tests/install.spec.ts` 用 include 真实的补丁引擎组合仓库里的 `cordis.patch.yml`，并把得到的条目挂进真实 Loader 树。插件不复制后端持久化任务状态，因此不提供 invariant companion：后端状态是权威来源。

## 许可证

MIT
