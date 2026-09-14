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

这些值在启动时读取：改动后需要重启。要么在 profile 补丁（`$DSH_HOME/profiles/web/cordis.patch.yml`）里覆盖该条目——注意只覆盖 `config` 会保留随包发布的 `!!js` 守卫，因此必须写 `disabled: false`：

```yaml
- id: gme-workflow
  disabled: false
  config:
    backendRoot: D:/workspace/gme-test-agent
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
| 重启后没有 `gme_*` 工具，插件显示为条件启用/未运行 | 未设置 `backendRoot`，随包守卫让该条目保持关闭 | 启动 Harness 前设置 `GME_TEST_AGENT_ROOT`，或用 `disabled: false` 加明确的 `backendRoot` 覆盖该条目 |
| 没有 `gme_*` 工具，但条目是启用的 | profile 覆盖启用了条目却没给路径；插件会记录 `backendRoot is not configured` 并且不注册任何内容 | 给条目补上 `backendRoot`，或去掉 `disabled: false` |
| 启动时报 `dsh: 1 entry did not activate` 并指出该条目 | 手工改过的条目配置校验失败（例如 `!!js` 表达式里的 `backendRoot: null`） | 修正或删除该覆盖；随包条目是惰性的，不会致命 |
| `Cannot read GME API token file: …` | `autoStart: false` 而 `tokenFile` 不存在 | 创建 token 文件（≥32 字符），或允许自动启动 |
| `GME autoStart requires a Harness subprocess provider` | profile 没有本机 `subprocess` 服务 | 使用基于 base 的 profile，它自带该服务 |
| `GME backend is unavailable. Start GME Test Agent or enable autoStart.` | 端口上没有服务，且自动启动关闭 | 自行启动后端，或设 `autoStart: true` |
| `The configured port is not an authenticated GME backend` | 端口已被其他服务占用 | 换一个空闲端口，或停止那个服务；插件不会在其上再启动一个 worker |
| `GME backend exited during startup` | Python 入口立即退出 | 手工运行 `python backend/run_backend.py --config config.local.json` 看真实报错（依赖缺失、路径不对） |
| 工具能调用但任务不推进 | 任务正在执行，或某次提交被中断 | 用 `gme_check` 轮询；超时后先查询任务再决定是否重发，因为 POST 不会自动重试 |
