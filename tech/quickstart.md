# OpenTeam 快速开始

## 前置要求

- macOS，Python 3.13+
- OpenClaw 已安装并运行（`http://127.0.0.1:18789`）
- Claude Code CLI 已安装，通过 OAuth 登录认证
- `imsg` CLI 已安装，用于 iMessage 桥接

## 安装

```bash
cd openteam
pip install -e ".[dev]"
```

## 初始配置

运行初始化向导：

```bash
python -m openteam --init
```

向导会创建 `config/config.json` 配置文件。也可以手动复制示例配置并编辑：

```bash
cp config/config.example.json config/config.json
# 编辑 config/config.json
```

需要配置的关键项：
- `openclaw.default_target` — 你的 iMessage 手机号或邮箱
- `claude.proxy` — Claude API 的 HTTPS 代理
- `agents.default_working_dir` — 代码项目的工作目录

## 启动 OpenTeam

```bash
python -m openteam
```

启动后 OpenTeam 会：
1. 在 `http://127.0.0.1:8765` 启动 FastAPI 服务
2. 开始轮询 iMessage 新消息
3. 从 `agents/` 目录加载所有 Agent 定义

## 使用方式（通过 iMessage）

通过 iMessage（经由 OpenClaw）发送命令。支持两种前缀：`/openteam` 和 `@openteam`（效果相同，不区分大小写）。

| 命令 | 说明 |
|------|------|
| `/openteam <任务>` | 运行完整流水线（product → arch → dev → test → review） |
| `/openteam dev <任务>` | 仅运行开发 Agent |
| `/openteam dev+test <任务>` | 运行开发 + 测试 Agent |
| `/openteam dev --dir ~/myrepo <任务>` | 指定工作目录 |
| `/openteam status` | 查看活跃任务 |
| `/openteam stop <task_id>` | 停止正在运行的任务 |
| `/openteam help` | 显示帮助信息 |

### 示例

```
/openteam 写一个 Python 脚本，批量重命名文件
@openteam dev 给 server.py 添加健康检查端点
/openteam dev+test 实现用户登录功能
/openteam dev --dir ~/myrepo 修复登录 bug
@openteam --dir /tmp/project 写一个计算器
@openteam status
/openteam stop task-0001
```

### 阶段别名

支持以下阶段缩写，多个阶段用 `+` 连接：

| 阶段 | 别名 |
|------|------|
| product | prod, p |
| architecture | arch, a |
| development | dev, d |
| testing | test, t |
| review | rev, r |

### 指定工作目录（`--dir`）

默认情况下，所有任务在 `agents.default_working_dir`（配置中设定，默认 `~/OpenProjects`）下执行。
使用 `--dir` 参数可以为单个任务指定工作目录：

```
/openteam dev --dir ~/github/myproject 修复 bug
@openteam dev+test --dir /path/to/repo 添加新功能
```

`--dir` 可以放在命令的任意位置（阶段名前后均可）。

### 停止任务

任务可以通过两种方式停止：

1. **iMessage 命令**：发送 `/openteam stop task-0001`，OpenTeam 会终止该任务的所有子进程并回复确认
2. **Admin 面板**：在 `http://localhost:8765/admin` 中点击任务卡片上的 `Stop` 按钮

停止后：
- 当前正在运行的 Claude Code 子进程会被终止
- 后续未执行的流水线阶段不再启动
- 任务状态变为 `stopped`，通过 iMessage 通知用户

## 管理面板

浏览器打开 `http://localhost:8765/admin`，可以：

- 查看活跃任务和流水线进度（状态标签：running / done / stopped / pending）
- 通过 `Stop` 按钮停止正在运行的任务
- 实时查看 Claude Code 输出日志，task ID 高亮显示（通过 WebSocket）
- 查看已加载的 Agent 及其配置
- 查看系统统计信息

## 配置热加载

运行中直接编辑 `config/config.json`，修改会被自动检测并生效，无需重启。

## 运行测试

```bash
pytest tests/
```

## 项目结构

```
openteam/
├── config/config.json          # 配置文件
├── agents/*.md                 # Agent 系统提示词
├── agents/agent_params.json    # Agent 参数配置
├── src/openteam/               # 源代码
│   ├── app.py                  # FastAPI 应用
│   ├── core/                   # 配置、事件、日志
│   ├── openclaw/               # OpenClaw 通信
│   ├── claude/                 # Claude Code CLI 管理
│   ├── agents/                 # 流水线编排
│   └── admin/                  # Web 管理面板
└── tests/                      # 单元测试
```
