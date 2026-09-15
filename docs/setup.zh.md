# 后端配置

[English](setup.md) | 中文

`dsh-gme-workflow` 是一份现有 GME Test Agent 源码目录的客户端：它启动并访问那个工程自己的本地 HTTP 后端，不随包分发、不复制、也不替代它。本页是那一侧的配置清单。

## 1. GME Test Agent 源码目录

先拿到这份检出本身。它**不随本插件分发**。公开副本（framework 本体，不含 GME 专有生成数据）在 [nuaaweixinye/gme-agent](https://github.com/nuaaweixinye/gme-agent)：

```powershell
git clone https://github.com/nuaaweixinye/gme-agent.git
cd gme-agent
scripts\install.ps1 -GmeRepo D:\GME   # 自检工具链 → 建 .venv → 装两个钉住的 harness wheel 与 requirements → 写 config.local.json
scripts\run_web.ps1                   # 启动后端
```

其余说明见它的 README，包括用你自己的 GME 检出生成模块接口目录（`scripts/generate_interface_catalog.py`）——未生成时目录资源为空是预期行为，依赖目录的用例会自动跳过。完整检出（含生成的接口目录与内部笔记）为私有，访问权限由 [@nuaaweixinye](https://github.com/nuaaweixinye) 按人授予。

你设为 `backendRoot` 的目录必须包含：

- `backend/run_backend.py` —— 被托管的入口。
- `config.local.json` —— 后端配置（或用 `configFile` 指定的其他文件名）：GME 仓库路径，以及编码会话使用的 `dsh_home` / `dsh_profile`。
- `logs/` —— API token 默认放在这里的 `web-api-token.log`，至少 32 个字符。自动启动时若文件缺失会生成随机 token；`autoStart: false` 时该文件是必需项，缺失会报 `Cannot read GME API token file`。
- 后端已经在用的任务数据库与生成测试的工作树。

GME 仓库本身、编译工具链，以及后端构建/测试阶段需要的依赖都必须就位——插件是触发这些阶段，而不是绕过它们。

## 2. Python 环境

`pythonPath` 必须指向一个已安装后端自身依赖的解释器，并在其中安装版本匹配的 `deepseek-harness-sdk` 与 `deepseek-harness-runtime-bin` wheel——后端的编码工作通过 Harness Python SDK 执行。默认值是 `python`；机器上有多个解释器时请显式写清楚。

## 3. 编码配置

后端编码会话运行在另一个 Harness profile 中（由 `config.local.json` 里的 `dsh_profile` 指定，惯例名是 `sdk`）。它需要：

- 文件、搜索与 shell 工具，让编码 agent 能改代码并跑测试；
- SDK 使用的 DeepSeek 凭据，在配置的 `dsh_home` 中可用；
- **排除本插件**，避免生成出来的工作继续创建 GME 任务。

外层工作流对话与每个后端编码会话分别保存历史。

## 4. Harness 侧配置

要么在启动 Harness 前设置环境变量：

```powershell
$env:GME_TEST_AGENT_ROOT  = 'D:/workspace/gme-test-agent'
$env:GME_TEST_AGENT_PYTHON = 'C:/ProgramData/Miniconda3/envs/agent/python.exe'
dsh web
```

这些值在启动时读取：改动后需要重启。要么在 profile 补丁（`$DSH_HOME/profiles/web/cordis.patch.yml`）里覆盖该条目——补丁条目只替换它写明的键，所以想保留的字段要全部重述：

```yaml
- id: gme-workflow
  config:
    backendRoot: D:/workspace/gme-agent
    pythonPath: C:/ProgramData/Miniconda3/envs/agent/python.exe
    port: 8765
    autoStart: true
```

重启前先确认 profile 实际会挂载什么：

```sh
dsh --profile web --dump-config
```

组合后的条目会原样打印 `gme-workflow` 行及其 `!!js` 表达式，因此无需真正启动就能看出值是否被解析或被覆盖。

## 5. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 重启后没有 `gme_*` 工具：插件在运行但不注册任何工具，并记录 `backendRoot is not configured` | 未设置 `backendRoot`，条目解析为空路径 | 启动 Harness 前设置 `GME_TEST_AGENT_ROOT`，或用明确的 `backendRoot` 覆盖该条目。模型已经被告知这些步骤，用户问起时它会说明 |
| 启动时报 `dsh: 1 entry did not activate` 并指出该条目 | 手工改过的条目配置校验失败（例如 `!!js` 表达式里的 `backendRoot: null`） | 修正或删除该覆盖；随包条目只会退化为“未配置”，不会抛错 |
| `Cannot read GME API token file: …` | `autoStart: false` 而 `tokenFile` 不存在 | 创建 token 文件（≥32 字符），或允许自动启动 |
| `GME autoStart requires a Harness subprocess provider` | profile 没有本机 `subprocess` 服务 | 使用基于 base 的 profile，它自带该服务 |
| `GME backend is unavailable. Start GME Test Agent or enable autoStart.` | 端口上没有服务，且自动启动关闭 | 自行启动后端，或设 `autoStart: true` |
| `The configured port is not an authenticated GME backend` | 端口已被其他服务占用 | 换一个空闲端口，或停止那个服务；插件不会在其上再启动一个 worker |
| `GME backend exited during startup` | Python 入口立即退出 | 手工运行 `python backend/run_backend.py --config config.local.json` 看真实报错（依赖缺失、路径不对） |
| 工具能调用但任务不推进 | 任务正在执行，或某次提交被中断 | 用 `gme_check` 轮询；超时后先查询任务再决定是否重发，因为 POST 不会自动重试 |

## 6. 可选：知识注入与轨迹可观测

后端支持在生成任务开始前把**本地历史分歧先验 + 知识库（WeKnora）参照**注入给编码会话，并把内层会话的工具调用记入任务事件。该能力**默认关闭**，全部在后端侧配置，与本插件的配置键无关：

1. 在后端的 `config.local.json` 增加 `knowledge` 块（占位格式见后端仓库的 `config.example.json`）：

   ```json
   "knowledge": {
     "enabled": true,
     "weknora": {
       "base_url": "http://<weknora-host>/api/v1",
       "api_key_env": "WEKNORA_API_KEY",
       "timeout_ms": 3000,
       "knowledge_bases": [
         { "label": "kb00", "id": "<kb00-knowledge-base-id>" }
       ]
     },
     "budgets": { "max_priors": 8, "max_kb_hits": 6, "max_chars": 4000 },
     "closed_loop": { "enabled": true, "min_stable_runs": 2 }
   }
   ```

2. 后端**进程**的环境里要有 `api_key_env` 指向的变量（默认 `WEKNORA_API_KEY`）。
3. 关闭时行为与旧版完全一致；开启后任何检索失败只降级（事件里记一条警告），绝不会让任务失败。

**与本插件的唯一交点是托管进程的环境。** `autoStart` 启动的后端子进程只继承 `GME_AGENT_API_TOKEN` 一个变量——`WEKNORA_API_KEY` 不会到达它，知识库检索会以 `API key is not set` 降级（本地先验注入不受影响）。因此需要知识库检索时，请**自行启动后端**（`scripts\run_web.ps1` 从你的 shell 继承完整环境），把本插件的 `autoStart` 留作无人值守时的兜底；插件会在端口上发现你启动的后端并直接复用。

判据、升格闭环与完整降级表见后端仓库的 `docs/knowledge-injection.md`。
