# OpenTeam：用 Claude Code 构建多 Agent 协作开发团队的架构与实现

> 作者：Jackie Zhan
> 日期：2026-02-15

---

## 引言

如果你可以在 iMessage 里发一条消息，就启动一个由 5 个 AI Agent 组成的虚拟开发团队，从需求分析、架构设计、编码实现、测试到代码审查，全流程自动完成——这就是 **OpenTeam** 做的事情。

OpenTeam 是一个基于 Claude Code CLI 的多 Agent 编排系统。它的核心思路很简单：**把一个软件开发任务拆解为多个角色，每个角色由一个独立的 Claude Code 进程承担，通过上下文接力（Handoff）或 AI 调度（Orchestrator）协调完成整个流程**。

本文将从架构设计到实现细节，完整记录这个系统是如何构建的。

---

## 一、系统全景

### 1.1 一句话描述

```
用户通过 iMessage 发送 @openteam 指令 → 系统解析命令 →
普通对话直接回复 / 开发模式启动 Agent Pipeline/Team/Auto →
每个 Agent 作为独立 Claude Code 进程运行 →
实时推送进度 → 完成后通过 iMessage 回复结果
```

### 1.2 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                       用户层                              │
│    iMessage  ←→  OpenClaw CLI  ←→  ImsgWatcher (Polling) │
└──────────────────────┬──────────────────────────────────┘
                       │ /openteam <task>
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    命令解析层                              │
│              MessageParser → ParsedCommand               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    编排引擎层                              │
│                                                          │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐         │
│   │ Pipeline  │   │   Team    │   │   Auto    │         │
│   │           │   │   Mode    │   │   Mode    │         │
│   │ P→A→D→T→R │   │ AI 按角色 │   │ AI 自主   │         │
│   │ 顺序执行   │   │ 调度      │   │ 规划拆解  │         │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘         │
│         │               │               │                │
│         └───────────────┼───────────────┘                │
│                     ▼                                    │
│              HandoffContext                               │
│         (上下文在 Agent 间传递)                             │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    Agent 执行层                            │
│                                                          │
│   ClaudeRunner → 管理 Claude Code CLI 子进程               │
│   StreamParser → 解析 NDJSON 实时输出流                     │
│   AgentSession → 追踪每个 Agent 的状态和成本                 │
│                                                          │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐ │
│   │Product │ │  Arch  │ │  Dev   │ │  Test  │ │Review │ │
│   │Agent   │ │ Agent  │ │ Agent  │ │ Agent  │ │Agent  │ │
│   └────────┘ └────────┘ └────────┘ └────────┘ └───────┘ │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    基础设施层                              │
│                                                          │
│   EventBus (异步事件总线)    Config (热重载配置)            │
│   SessionStore (会话存储)    Logger (结构化日志)            │
│   Admin API + WebSocket (实时监控面板)                     │
└─────────────────────────────────────────────────────────┘
```

### 1.3 技术栈

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| 语言 | Python 3.13+ | 异步生态成熟，Claude SDK 支持好 |
| Web 框架 | FastAPI | 原生 async，WebSocket 支持，自动 OpenAPI |
| 配置管理 | Pydantic | 类型安全，自动校验，JSON 序列化 |
| AI 引擎 | Claude Code CLI | 原生工具调用，文件操作，子进程隔离 |
| 消息网关 | OpenClaw CLI | macOS iMessage 桥接 |
| 工具扩展 | MCP (Model Context Protocol) | 标准化工具协议 |
| 异步模型 | asyncio | 协程并发，适合 IO 密集场景 |

---

## 二、核心概念

### 2.1 五个 Agent 角色

OpenTeam 模拟一个完整的软件开发团队，每个 Agent 对应一个角色：

| Agent | 角色 | 职责 | 可用工具 | 最大轮次 |
|-------|------|------|---------|---------|
| **Product** | 产品经理 | 需求分析、用户故事、验收标准 | Read, Glob, Grep | 10 |
| **Architecture** | 架构师 | 技术选型、系统设计、方案评审 | Read, Glob, Grep, Bash | 15 |
| **Development** | 开发者 | 代码实现、API 开发 | Read, Bash, Edit, Write, Grep, Glob | 30 |
| **Testing** | 测试工程师 | 自动化测试、质量验证 | Read, Bash, Edit, Write, Grep, Glob | 20 |
| **Review** | 代码审查 | 代码质量、安全审查、最佳实践 | Read, Bash, Grep, Glob | 10 |

一个关键设计：**每个 Agent 只能使用自己角色对应的工具子集**。Product Agent 不能写代码（没有 Edit/Write 权限），Review Agent 不能修改文件（只读审查）。这不仅是安全考量，更模拟了现实团队中角色权责分离的理念。

### 2.2 Agent 定义 = Markdown + JSON

Agent 的定义分两部分：

**系统提示词（Markdown 文件）**：定义 Agent 的行为和输出格式

```markdown
# agents/product_agent.md

You are the **Product Agent** in an AI development team.

## Responsibilities
1. Analyze the user's task description and clarify requirements
2. Break down the task into specific, actionable user stories
3. Define acceptance criteria for each feature
4. Identify edge cases and potential issues

## Output Format
Provide a structured product specification:
  ## Product Specification
  ### Task Summary
  ### Features / User Stories
  ### Edge Cases & Considerations
  ### Out of Scope
```

**参数配置（JSON 文件）**：定义工具权限和约束

```json
// agents/agent_params.json
{
  "product": {
    "description": "Analyzes requirements and creates product specifications",
    "max_turns": 10,
    "allowed_tools": "Read,Glob,Grep"
  },
  "development": {
    "description": "Implements code changes based on technical design",
    "max_turns": 30,
    "allowed_tools": "Read,Bash,Edit,Write,Grep,Glob"
  }
}
```

`AgentRegistry` 在启动时自动扫描 `agents/` 目录下所有 `*_agent.md` 文件，与 `agent_params.json` 合并，构建出完整的 Agent 定义：

```python
class AgentRegistry:
    def load(self, prompts_dir):
        for md_file in sorted(prompts_dir.glob("*_agent.md")):
            name = md_file.stem.replace("_agent", "")  # "product_agent" → "product"
            prompt = md_file.read_text()
            agent_params = params.get(name, {})
            self._agents[name] = AgentDef(
                name=name,
                system_prompt=prompt,
                max_turns=agent_params.get("max_turns", 30),
                allowed_tools=agent_params.get("allowed_tools", "..."),
            )
```

这意味着：**添加新 Agent 只需要新增一个 `.md` 文件，并在 JSON 中配置参数**。零代码变更。

### 2.3 四种工作模式

#### Chat 模式：普通对话（默认）

`@openteam <消息>` 不带任何开发模式参数时进入 Chat 模式。系统调用 Claude Code 进行简单对话回复，不触发任何 Agent 流水线。适合问答、闲聊、了解系统功能等场景。

#### Pipeline 模式：确定性流水线

```
Product → Architecture → Development → Testing → Review
```

通过 `--pipeline` 或指定阶段名（如 `dev`、`dev+test`）触发。每个 Agent 按固定顺序执行，前一个 Agent 的输出作为下一个的上下文输入。这模拟了传统软件开发的瀑布流程。

**特点**：可预测、可追踪、成本可控。适合结构清晰的开发任务。

#### Team 模式：AI 按角色调度

```
         ┌─────────┐
         │Orchestrator│
         └────┬────┘
        ╱     │     ╲
   Product  Dev   Testing
              │
           Review
```

通过 `--team` 触发。由一个 AI Orchestrator 分析任务，按预定义的角色 Agent（Product、Architecture、Development、Testing、Review）自主决定调用顺序和组合。

**特点**：灵活、智能，Agent 角色固定但调度顺序由 AI 决定。

#### Auto 模式：AI 自主规划

```
         ┌─────────┐
         │Orchestrator│
         └────┬────┘
        ╱   ╱   ╲   ╲
   前端开发  API设计  数据库  测试
```

通过 `--auto` 触发。AI Orchestrator 完全按任务需求自由拆解子任务，不受预定义角色约束，动态创建面向任务的 Agent（如"前端开发"、"API 设计"、"数据库迁移"等）。

**特点**：最大灵活性，AI 自主决定拆解粒度和执行策略。适合复杂、跨领域的任务。

---

## 三、Pipeline 模式实现：Handoff 协议

Pipeline 模式的核心问题是：**如何在独立进程间传递上下文？**

每个 Agent 是一个独立的 Claude Code 子进程，它们之间没有共享内存。解决方案是 **HandoffContext**——一个简单但有效的上下文接力协议。

### 3.1 HandoffContext

```python
@dataclass
class HandoffContext:
    original_task: str                    # 用户原始任务
    pipeline_stages: list[str]            # 流水线阶段列表
    previous_outputs: dict[str, str]      # {阶段名: 输出文本}
    working_dir: str
    task_id: str

    def build_prompt(self, current_stage: str) -> str:
        parts = [f"## Original Task\n\n{self.original_task}"]

        if self.previous_outputs:
            parts.append("\n## Previous Stage Outputs\n")
            for stage, output in self.previous_outputs.items():
                truncated = output[:8000] if len(output) > 8000 else output
                parts.append(f"### {stage}\n\n{truncated}\n")

        parts.append(
            f"\n## Your Role\n\n"
            f"You are the **{current_stage}** agent. "
            f"Complete your responsibilities for the task above. "
            f"Working directory: `{self.working_dir}`"
        )
        return "\n".join(parts)

    def record_output(self, stage: str, output: str) -> None:
        self.previous_outputs[stage] = output
```

这段代码虽短，但包含了几个重要设计决策：

1. **输出截断到 8000 字符**：Claude Code 的上下文窗口有限，且前面 Agent 的完整输出可能非常长。截断是在"信息完整性"和"上下文窗口利用率"之间的权衡。
2. **累积式上下文**：每个 Agent 能看到所有前序 Agent 的输出，而不仅仅是上一个。这让 Review Agent 能同时参考 Product 规格和 Development 实现。
3. **结构化 Prompt**：明确告知 Agent 原始任务、前序输出、当前角色，减少歧义。

### 3.2 Pipeline 执行流程

```python
async def execute(self, task_session: TaskSession) -> None:
    handoff = HandoffContext(
        original_task=task_session.description,
        pipeline_stages=task_session.pipeline,
        working_dir=working_dir,
    )

    while True:
        stage_name = task_session.advance_stage()
        if stage_name is None:
            break  # 所有阶段完成

        agent_def = self._registry.get(stage_name)
        prompt = handoff.build_prompt(stage_name)

        # 每个 Agent 是独立的 Claude Code 进程
        cp = await self._runner.run(
            prompt=prompt,
            system_prompt=agent_def.system_prompt,
            max_turns=agent_def.max_turns,
            allowed_tools=agent_def.allowed_tools,
        )

        # 流式读取输出
        collected_text = []
        async for chunk in cp.read_stream():
            if chunk.chunk_type == ChunkType.TEXT_DELTA:
                collected_text.append(chunk.text)
            # 同时推送到 Admin UI
            await bus.publish(Event(type=EventType.AGENT_OUTPUT, ...))

        output = "".join(collected_text)
        handoff.record_output(stage_name, output)  # 记录输出供后续 Agent 使用
```

**实际执行效果**：发送 `/openteam 实现一个用户注册功能` 后，系统会依次：
1. Product Agent 输出需求规格（功能列表、验收标准、边界情况）
2. Architecture Agent 基于规格输出技术设计（文件结构、API 设计、数据模型）
3. Development Agent 基于设计实际编写代码（创建文件、编辑代码）
4. Testing Agent 编写并运行测试
5. Review Agent 审查所有变更，给出质量评估

---

## 四、Team / Auto 模式实现：AI Orchestrator

Team 和 Auto 模式的哲学完全不同：**不再预设执行顺序，而是让 AI 自己决定如何组织团队**。Team 模式按预定义角色调度，Auto 模式则完全由 AI 自主规划任务拆解。

### 4.1 两种后端实现

Team 模式支持两种后端，解决同一个问题——"如何让 Orchestrator 调度其他 Agent"：

#### Task 后端（内置 Task 工具）

利用 Claude Code 自带的 Task 工具，Orchestrator 可以直接 spawn 子 Agent：

```python
# Orchestrator 获得的系统提示
system_prompt = """
# Team Orchestrator

You are a Team Orchestrator. Coordinate specialized agents to complete the task.

## Available Agents
### product
- Description: Analyzes requirements and creates product specifications
### development
- Description: Implements code changes based on technical design
...

## Instructions
1. Analyze the user's task and decide which agents to involve.
2. Use the Task tool to spawn sub-agents.
3. You may run agents in parallel when their work is independent.
4. Coordinate handoffs between agents.
"""
```

Orchestrator 作为单个 Claude Code 进程运行，通过 Task 工具创建子进程。系统通过解析 NDJSON 流来追踪 Task 工具调用：

```python
# 检测 Task 工具调用，识别被 spawn 的 Agent
if chunk.chunk_type == ChunkType.TOOL_USE_START:
    if chunk.tool_name == "Task":
        _in_task_tool = True

if chunk.chunk_type == ChunkType.TOOL_USE_INPUT and _in_task_tool:
    _task_input_parts.append(chunk.text)
    # 解析 JSON，模糊匹配 Agent 名称
    agent_name = self._try_extract_subagent(tool_input)
```

#### MCP 后端（dispatch_agent 工具）

通过 Model Context Protocol 暴露一个 `dispatch_agent` 工具。Orchestrator 调用这个工具时，实际上是向 OpenTeam 服务器发送 HTTP 请求，在服务端启动独立的 Claude Code 进程：

```python
# mcp_server.py
@mcp.tool()
async def dispatch_agent(agent_name: str, task: str) -> str:
    """Dispatch a task to a specialized agent."""
    url = f"{OPENTEAM_URL}/api/internal/dispatch"
    payload = {"task_id": OPENTEAM_TASK_ID, "agent_name": agent_name, "task": task}

    async with httpx.AsyncClient(timeout=600.0) as client:
        resp = await client.post(url, json=payload)
        result = resp.json()

    return f"{result['output']}\n\n[Agent {agent_name} completed · cost=${cost:.4f}]"
```

MCP 后端的优势是每个 Agent 作为完全独立的进程运行，有自己的上下文窗口和工具权限。

### 4.2 动态写入 MCP 配置

MCP 后端有一个巧妙的实现细节：Claude Code 通过工作目录下的 `.mcp.json` 发现 MCP 服务器。OpenTeam 在启动 Team 任务前动态写入这个文件：

```python
def _write_mcp_config(self, working_dir: str, task_id: str) -> Path:
    mcp_config = {
        "mcpServers": {
            "openteam": {
                "command": sys.executable,
                "args": [mcp_server_path],
                "env": {
                    "OPENTEAM_URL": f"http://127.0.0.1:{port}",
                    "OPENTEAM_TASK_ID": task_id,
                },
            }
        }
    }
    mcp_path = Path(working_dir) / ".mcp.json"
    mcp_path.write_text(json.dumps(mcp_config, indent=2))
    return mcp_path
```

任务完成后自动清理 `.mcp.json`，不留痕迹。

---

## 五、Claude Code 集成：进程管理与流解析

### 5.1 进程生命周期

每个 Agent 实际上是一次 Claude Code CLI 调用：

```bash
claude -p "<prompt>" \
  --output-format stream-json \
  --verbose \
  --system-prompt "<agent_prompt>" \
  --max-turns 30 \
  --allowedTools "Read,Bash,Edit,Write" \
  --dangerously-skip-permissions
```

`ClaudeRunner` 管理所有子进程的生命周期：
- 启动：`asyncio.create_subprocess_exec`
- 追踪：按 `task_id` 索引活跃进程
- 停止：`process.terminate()` + 超时后 `process.kill()`
- 环境：注入 HTTP 代理等环境变量

### 5.2 NDJSON 流解析

Claude Code 的 `--output-format stream-json` 模式输出 NDJSON（Newline-Delimited JSON），每行一个 JSON 对象。`StreamParser` 将这些原始数据解析为结构化的 `StreamChunk`：

```python
class ChunkType(str, Enum):
    TEXT_DELTA = "text_delta"         # Agent 的文本输出
    TOOL_USE_START = "tool_use_start" # 工具调用开始（含工具名）
    TOOL_USE_INPUT = "tool_use_input" # 工具调用参数（流式 JSON 片段）
    TOOL_RESULT = "tool_result"       # 工具执行结果
    RESULT = "result"                 # 最终结果（含总成本、耗时）
    SYSTEM = "system"                 # 系统消息（session_id 等）
    ERROR = "error"                   # 解析错误
    UNKNOWN = "unknown"               # 未识别的消息类型

def parse_line(line: str) -> StreamChunk | None:
    data = json.loads(line)
    msg_type = data.get("type", "")

    if msg_type == "assistant":
        # 提取文本内容
        content = data["message"]["content"]
        text = "".join(b["text"] for b in content if b["type"] == "text")
        return StreamChunk(chunk_type=ChunkType.TEXT_DELTA, text=text)

    if msg_type == "content_block_start":
        block = data["content_block"]
        if block["type"] == "tool_use":
            return StreamChunk(
                chunk_type=ChunkType.TOOL_USE_START,
                tool_name=block["name"],
            )

    if msg_type == "result":
        return StreamChunk(
            chunk_type=ChunkType.RESULT,
            cost_usd=data.get("cost_usd", 0.0),
            duration_ms=data.get("duration_ms", 0),
        )
```

这个解析器是整个系统的"眼睛"——通过它，我们能实时知道 Agent 在做什么、调用了哪些工具、花费了多少成本。

---

## 六、事件驱动架构

### 6.1 EventBus

系统内部通信完全基于异步事件总线：

```python
class EventBus:
    def __init__(self):
        self._handlers: dict[EventType, list[EventHandler]] = {}
        self._queue: asyncio.Queue[Event] = asyncio.Queue()

    async def publish(self, event: Event) -> None:
        await self._queue.put(event)

    async def start(self) -> None:
        while self._running:
            event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
            for handler in self._handlers.get(event.type, []):
                await handler(event)
```

11 种事件类型覆盖了系统的完整生命周期：

```
MESSAGE_RECEIVED → COMMAND_PARSED → TASK_STARTED →
  STAGE_STARTED → AGENT_OUTPUT (实时流) → STAGE_COMPLETED →
  ... (重复各阶段) →
TASK_COMPLETED / TASK_FAILED / TASK_STOPPED
```

事件总线的好处是**解耦**：Orchestrator 不需要知道 Admin UI 的存在；WebSocket 不需要知道 iMessage 的存在。它们都只和事件总线交互。

### 6.2 实时监控

Admin WebSocket 订阅所有事件，将它们广播给连接的浏览器客户端：

```python
# websocket.py
async def _broadcast_event(self, event: Event):
    message = json.dumps({"type": event.type.value, "data": event.data})
    for connection in self._connections:
        await connection.send_text(message)
```

前端通过 WebSocket 接收事件，实时展示 Agent 的输出流、工具调用、阶段变化等信息。

---

## 七、iMessage 命令系统

### 7.1 用户交互界面

OpenTeam 的用户界面不是 Web 页面或 CLI，而是 **iMessage**。这个选择看起来非正统，但有几个优势：
- 随时随地发消息，不需要打开终端
- 天然支持多人群聊（团队共享 Agent 输出）
- 消息持久化，便于回顾

### 7.2 命令解析

```python
# 支持的命令格式
@openteam <message>             # 普通对话（默认）
@openteam --pipeline <task>     # 全流水线
@openteam dev <task>            # 单阶段（Pipeline 模式）
@openteam dev+test <task>       # 多阶段组合（Pipeline 模式）
@openteam --team <task>         # Team 模式
@openteam --auto <task>         # Auto 模式
@openteam --dir ~/repo <task>   # 指定工作目录
@openteam status                # 查看状态
@openteam stop task-0001        # 停止任务

# 阶段别名
product → prod, p
architecture → arch, a
development → dev, d
testing → test, t
review → rev, r
```

`MessageParser` 的实现充分考虑了自然输入的灵活性：支持 `/` 和 `@` 两种前缀、阶段名缩写、`+` 号组合多阶段、可选的 flag 参数。默认不带模式参数时进入普通对话模式，避免误触发开发流水线。

### 7.3 消息轮询

`ImsgWatcher` 通过 OpenClaw 的 `imsg` CLI 工具定期轮询 iMessage 群聊：

```python
# 每 5 秒轮询一次
imsg history --chat-id 67 --limit 20 --json
```

关键细节：
- 通过 `rowid` 去重，只处理新消息
- 过滤掉自己发出的消息（`is_from_me`）
- 只响应 `/openteam` 或 `@openteam` 开头的消息

---

## 八、配置系统：热重载

### 8.1 Pydantic 配置模型

```python
class AppConfig(BaseModel):
    server: ServerConfig = ServerConfig()
    openclaw: OpenClawConfig = OpenClawConfig()
    claude: ClaudeConfig = ClaudeConfig()
    agents: AgentsConfig = AgentsConfig()
    notifications: NotificationsConfig = NotificationsConfig()
    admin: AdminConfig = AdminConfig()
```

Pydantic 提供了类型安全的配置验证。如果 `config.json` 中有错误的字段类型，系统启动时就会报错，而不是运行时出现诡异 bug。

### 8.2 文件监听与热重载

系统使用文件监听器，当 `config.json` 被修改时自动重载配置，**无需重启服务**。这在调试和运维时非常实用——调整代理地址、修改轮询间隔，保存即生效。

---

## 九、可视化展示层

除了后端系统，我还做了一个独立的可视化页面 [agent.yuanchu.ai](https://agent.yuanchu.ai)，用纯 HTML/CSS/JS 展示 OpenTeam 的工作模式。

### 9.1 Workflow 可视化

页面包含一个交互式 Workflow 区域，通过 Tab 切换三种视图：

**Pipeline 视图**：五个 Agent 节点横向排列，通过流光连接线串联，节点依次激活模拟任务在流水线中流转。

```
┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│Product │ →→ │  Arch  │ →→ │  Dev   │ →→ │  Test  │ →→ │ Review │
└────────┘    └────────┘    └────────┘    └────────┘    └────────┘
              ▲ 流光动画从左向右流动
```

**Team 视图**：Orchestrator 居中，五个 Agent 以五边形分布环绕，SVG 连接线从中心辐射到各节点，随机 dispatch 动画模拟 AI 按角色调度过程。

**Auto 视图**：Orchestrator 居中，动态展示 AI 自主规划的任务拆解过程。Agent 池从预定义的任务类型（如前端开发、API 设计、数据库等）中随机选取 3-6 个，每个周期动态变化，模拟 AI 根据任务需求自由拆解的过程。

### 9.2 动画实现

Pipeline 的节点激活动画使用了简单的 `setInterval` + class 切换：

```javascript
// 每 450ms 激活下一个节点，约 3.5s 完成一个完整周期
setInterval(function() {
    if (step === 0) {
        // 重置所有节点
        nodes.forEach(n => n.classList.remove('active'));
        connectors.forEach(c => c.classList.remove('active'));
    } else if (step <= total) {
        // 依次点亮
        nodes[step - 1].classList.add('active');
        if (step > 1) connectors[step - 2].classList.add('active');
    }
    step = step > total + 1 ? 0 : step + 1;
}, 450);
```

连接线的流光效果用 CSS `transform: translateX` 动画实现，配合 `overflow: hidden` 实现粒子穿越效果。

Team 视图的 dispatch 动画用 SVG `stroke-dasharray` + `stroke-dashoffset` 动画模拟虚线流动：

```css
.team-dispatch.active {
    opacity: 1;
    animation: dashFlow 0.6s linear infinite;
}
@keyframes dashFlow {
    to { stroke-dashoffset: -20; }
}
```

---

## 十、项目结构

```
openteam/
├── config/
│   └── config.json              # 运行时配置
├── agents/                      # Agent 定义（Markdown + JSON）
│   ├── product_agent.md
│   ├── architecture_agent.md
│   ├── development_agent.md
│   ├── testing_agent.md
│   ├── review_agent.md
│   └── agent_params.json
├── src/openteam/
│   ├── __main__.py              # CLI 入口
│   ├── app.py                   # FastAPI 应用工厂
│   ├── mcp_server.py            # MCP 工具服务器
│   ├── core/                    # 基础设施
│   │   ├── config.py            # 配置管理（热重载）
│   │   ├── events.py            # 异步事件总线
│   │   ├── lifecycle.py         # 优雅关闭
│   │   └── logger.py            # 结构化日志
│   ├── claude/                  # Claude Code 集成
│   │   ├── runner.py            # 子进程管理
│   │   ├── session.py           # 会话状态追踪
│   │   └── stream_parser.py     # NDJSON 流解析
│   ├── agents/                  # 编排与调度
│   │   ├── registry.py          # Agent 注册表
│   │   ├── orchestrator.py      # Pipeline & Team 编排器
│   │   ├── handoff.py           # 上下文传递协议
│   │   └── dispatch.py          # 内部 dispatch 端点
│   ├── openclaw/                # iMessage 集成
│   │   ├── client.py            # OpenClaw CLI 封装
│   │   ├── message_parser.py    # 命令解析器
│   │   └── webhook.py           # 消息轮询
│   └── admin/                   # 管理面板
│       ├── router.py            # REST API
│       └── websocket.py         # WebSocket 实时推送
└── tests/                       # 单元测试
    ├── test_config.py
    ├── test_message_parser.py
    ├── test_orchestrator.py
    └── test_stream_parser.py
```

---

## 十一、设计决策与权衡

### 为什么用 CLI 子进程而不是 API 调用？

Claude Code CLI 提供了 API 不具备的能力：原生文件操作（Edit/Write）、Bash 命令执行、代码搜索（Grep/Glob）。这些正是软件开发任务所需要的。代价是每个 Agent 都是独立进程，内存开销更大，但换来了完整的开发工具链。

### 为什么用 iMessage 作为界面？

这是一个"dogfooding"的选择——我日常使用 macOS，iMessage 是最自然的异步通信方式。更实际的好处是：消息天然持久化（可以回顾历史任务），支持多设备同步（iPhone 上也能收到 Agent 进度通知），群聊模式可以让多人共享 Agent 输出。

### 8000 字符截断是否太激进？

在实践中这是个好的平衡点。产品规格通常在 3000-5000 字符，架构设计在 5000-8000 字符。超过 8000 的通常是代码实现，而后续 Agent（如 Review）更关心代码变更摘要而非完整代码。如果需要完整代码，Agent 可以直接读取文件。

### Pipeline vs Team vs Auto 如何选择？

- **Pipeline 模式**：确定性串行执行，可预测、成本可控。适合结构清晰的标准开发任务。
- **Team 模式**：AI 按预定义角色调度，灵活但保持角色约束。适合需要多角色协作但顺序不固定的任务。
- **Auto 模式**：AI 完全自主规划，最大灵活性。适合复杂、跨领域、无法预定义角色分工的任务。

### Team/Auto 的 Task 后端 vs MCP 后端如何选择？

- **Task 后端**更简单，Orchestrator 和子 Agent 在同一个 Claude Code 进程树中。适合快速原型和简单任务。
- **MCP 后端**让每个 Agent 完全独立，有自己的上下文窗口，通过 HTTP API 通信。适合复杂任务和需要更细粒度控制的场景。

---

## 十二、经验总结

### 什么有效

1. **角色分离 + 工具权限约束**：让每个 Agent 专注自己的职责，避免了"一个 Agent 试图做所有事"的混乱局面。
2. **流式输出 + 事件总线**：实时可见 Agent 在做什么，极大提升了调试效率和用户体验。
3. **Markdown 定义 Agent**：修改 Agent 行为只需编辑文本文件，迭代速度极快。
4. **HandoffContext 的简洁设计**：用最少的代码实现了可靠的上下文传递。

### 待改进

1. **上下文窗口管理**：随着 Pipeline 推进，累积的 Handoff 上下文会越来越大。未来可以引入 RAG 或摘要机制。
2. **错误恢复**：目前某个阶段失败后整个 Pipeline 停止。可以支持从断点恢复或跳过非关键阶段。
3. **并行执行**：Pipeline 模式是严格串行的。某些场景下 Testing 和 Review 可以并行进行。
4. **成本优化**：Team/Auto 模式下 Orchestrator 本身也消耗 token，某些简单任务直接用 Pipeline 更经济。

---

## 结语

OpenTeam 的核心理念是：**把 Claude Code 当作"员工"来管理，而不是当作"工具"来调用**。每个 Agent 有自己的角色、权限和行为规范，Orchestrator 负责调度和协调，事件系统负责通信——这和管理一个真实的开发团队并没有本质区别。

当然，这还是一个早期项目。但它验证了一个有趣的方向：**Multi-Agent 协作不需要复杂的框架，CLI + 子进程 + Prompt Engineering 就能构建出实用的系统**。

源码在 GitHub 上开放，欢迎探索。

---

*本文由 Jackie Zhan 撰写，记录 OpenTeam 项目从 0 到 1 的构建过程。*
