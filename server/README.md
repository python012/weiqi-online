# 围棋在线对弈平台 - 后端

后端基于 Node.js + Express + TypeScript 构建，使用 Socket.IO 提供实时通信服务。

## 技术栈

- Node.js
- Express 4.18.2
- TypeScript 5.3.3
- Socket.IO 4.7.2
- CORS 2.8.5

## 项目结构

```
server/
├── src/
│   ├── index.ts              # Express 服务器入口
│   ├── shared.ts             # 类型定义和常量（与前端共享）
│   ├── gameEngine.ts         # 围棋规则引擎（核心逻辑）
│   ├── rooms/
│   │   └── roomManager.ts    # 房间管理（创建、加入、状态管理）
│   └── socket/
│       └── handlers.ts       # Socket.IO 事件处理
├── package.json              # 依赖配置
├── tsconfig.json             # TypeScript 配置
└── dist/                     # 编译输出目录（生成后）
```

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器（使用 tsx 热重载）
npm run dev

# 编译 TypeScript
npm run build

# 启动生产服务器
npm start
```

## 核心模块说明

### src/index.ts
- Express HTTP 服务器
- Socket.IO WebSocket 服务器
- CORS 配置（允许前端跨域访问）
- 静态文件服务（可选）
- 端口配置（默认 4000）

### src/shared.ts
**与前端共享的类型定义和常量**
- 棋子颜色枚举（Black, White）
- 玩家角色（Host, Guest, Spectator）
- 房间状态
- 游戏状态
- Socket 事件类型定义

### src/gameEngine.ts
**围棋规则引擎（核心算法）**

主要函数：
- `isValidPosition(x, y)` - 检查坐标有效性
- `getConnectedGroup(board, x, y, color)` - 获取连通棋子块（DFS/BFS）
- `getLiberties(board, group)` - 计算棋子块的气数
- `captureStones(board, x, y, color)` - 执行提子
- `validateMove(board, x, y, color, lastMove)` - 验证落子合法性
  - 位置有效性检查
  - 已有棋子检查
  - 打劫规则（禁止立即回提）
  - 禁止自杀（无气且无法提子）
- `makeMove(board, x, y, color)` - 执行落子并返回提子数
- `calculateScore(board)` - 计算胜负（中国规则）
  - 使用泛洪填充算法（Flood Fill）计算领地
  - 黑方总数 = 黑子 + 黑方领地
  - 白方总数 = 白子 + 白方领地 + 贴目（3.75）

### src/rooms/roomManager.ts
**房间管理（内存存储）**

主要功能：
- `createRoom(roomName, hostSocketId)` - 创建房间
  - 生成 5 位密码（数字 + 大写字母）
  - 生成随机昵称（形容词 + 小动物）
  - 初始化房间状态
- `joinRoom(password, playerSocketId, isSpectator)` - 加入房间
  - 验证密码有效性
  - 分配角色和棋色
  - 更新房间状态
- `leaveRoom(password, socketId)` - 离开房间
  - 清理玩家信息
  - 更新房间状态
- `playerReady(password, socketId)` - 玩家确认开始
  - 双方都准备后触发游戏开始
- `makeMove(password, socketId, x, y)` - 落子
  - 验证落子合法性
  - 更新棋盘状态
  - 检查提子
  - 切换回合
- `passMove(password, socketId)` - Pass
  - 记录 Pass
  - 双方 Pass 后进入计目阶段
- `resignGame(password, socketId)` - 认输
  - 判定对方获胜
- `calculateFinalScore(password)` - 计算最终胜负
- `updateTimer(password)` - 更新计时器
- `handleDisconnect(socketId)` - 断线处理
  - 标记玩家为未连接
  - 启动 1 分钟重连倒计时
  - 超时判负

### src/socket/handlers.ts
**Socket.IO 事件处理**

客户端 → 服务端事件：
- `room:create` - 创建房间
- `room:join` - 加入房间
- `room:spectate` - 观战
- `room:ready` - 确认开始
- `game:move` - 落子
- `game:pass` - Pass
- `game:resign` - 认输
- `chat:send` - 发送聊天消息
- `room:leave` - 离开房间

服务端 → 客户端事件：
- `room:created` - 房间创建成功
- `room:joined` - 加入房间成功
- `room:updated` - 房间信息更新
- `room:player-joined` - 玩家加入通知
- `room:player-left` - 玩家离开通知
- `room:game-start` - 对局开始
- `game:move` - 落子通知
- `game:pass` - Pass 通知
- `game:resign` - 认输通知
- `game:end` - 对局结束
- `chat:message` - 聊天消息
- `error` - 错误信息

## 房间数据结构

```typescript
interface Room {
  password: string;              // 房间密码（5位）
  name: string;                  // 房间名称
  status: 'waiting' | 'playing' | 'ended';
  board: Board;                  // 19×19 棋盘状态
  currentPlayer: 'black' | 'white';
  players: {
    host?: Player;
    guest?: Player;
  };
  spectators: Map<string, Player>;
  moveHistory: Move[];
  lastPass?: 'black' | 'white';
  timers: {
    black: { time: number, extra: number };
    white: { time: number, extra: number };
  };
  lastCapture?: { x: number, y: number }; // 打劫规则用
  createdAt: number;
}

interface Player {
  id: string;                    // Socket ID
  nickname: string;              // 随机昵称
  color: 'black' | 'white' | null;
  role: 'host' | 'guest' | 'spectator';
  ready: boolean;
  connected: boolean;
  captured: number;              // 提子数
  disconnectTime?: number;        // 断线时间戳
}
```

## 计时系统

**默认规则（不可更改）**
- 基础用时：每方 20 分钟
- 读秒模式：基础时间耗尽后，60 秒一步
- 额外读秒：每方 3 次机会
  - 读秒模式下，60 秒内未落子 → 消耗 1 次
  - 消耗后重置为 60 秒
  - 3 次耗尽仍超时 → 判负

## 断线重连

- 玩家断线后，对局状态保留 1 分钟
- 重新输入房间密码可恢复连接
- 超过 1 分钟未重连，判断线方负

## 开发注意事项

1. **端口配置**：确保与前端 Socket.IO 客户端 URL 一致
2. **CORS 配置**：允许前端域名访问
3. **错误处理**：所有 Socket 事件需返回错误信息
4. **内存存储**：房间数据存储在内存中（可扩展为 Redis）
5. **类型一致性**：`shared.ts` 与前端 `types.ts` 保持同步
6. **计时器精度**：使用 `setInterval` 每秒更新，避免精度问题
