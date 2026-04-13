# 围棋在线对弈平台 - 前端

前端基于 React + TypeScript + Vite 构建，使用 Socket.IO 实现实时通信。

## 技术栈

- React 18.2.0
- TypeScript 5.3.3
- Vite 5.0.8
- React Router DOM 6.21.1
- Socket.IO Client 4.7.2

## 项目结构

```
client/
├── src/
│   ├── pages/              # 页面组件
│   │   ├── Home.tsx        # 主页（创建/加入房间）
│   │   ├── WaitingRoom.tsx # 等待房间页面
│   │   ├── Game.tsx        # 对局页面
│   │   └── Review.tsx      # 复盘页面
│   ├── components/         # 可复用组件
│   │   ├── Board.tsx       # 棋盘组件
│   │   ├── Chat.tsx        # 聊天组件
│   │   └── Timer.tsx       # 计时器组件
│   ├── services/           # 服务层
│   │   └── socket.ts       # Socket.IO 客户端封装
│   ├── game/               # 游戏逻辑
│   │   └── engine.ts       # 前端围棋规则验证
│   ├── types.ts            # TypeScript 类型定义
│   ├── App.tsx             # 路由配置
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式
├── public/                 # 静态资源
├── index.html              # HTML 模板
├── package.json            # 依赖配置
├── vite.config.ts          # Vite 构建配置
└── tsconfig.json           # TypeScript 配置
```

## 页面路由

- `/` - 主页（创建房间 / 加入房间）
- `/room/:password` - 等待房间
- `/game/:password` - 对局页面
- `/review/:password` - 复盘页面

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器（默认端口 3000）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 主要功能

### pages/Home.tsx
- 创建房间（输入房间名称，系统生成密码）
- 加入房间（输入房间密码）

### pages/WaitingRoom.tsx
- 显示房间信息和双方昵称
- 等待对手确认开始
- 显示昵称提示横幅

### pages/Game.tsx
- 19×19 棋盘对弈
- 显示双方信息和计时
- Pass 和认输功能
- 离开对局确认

### pages/Review.tsx
- 棋局回放
- 棋谱列表和控制按钮
- 步数导航（首步/上一步/下一步/末步）

### components/Board.tsx
- 棋盘渲染（19×19 网格）
- 棋子显示和落子交互
- 鼠标悬停预览
- 禁入点视觉提示
- 星位标记
- 步数序号显示

### components/Chat.tsx
- 实时聊天
- 系统消息（橙色背景）
- 用户消息和时间戳
- 快捷键支持（Enter 发送）

### components/Timer.tsx
- 基础时间倒计时
- 读秒模式显示（红色脉冲）
- 额外读秒次数显示

### services/socket.ts
- Socket.IO 客户端连接管理
- 事件监听和发送
- 错误处理

### game/engine.ts
- 围棋规则验证（前端）
- 禁入点计算
- 气数计算
- 提子逻辑

## 本地存储

- `currentRoom` - 当前房间信息（JSON）
- `currentPlayer` - 当前玩家信息（JSON）

## 开发注意事项

1. **WebSocket 连接**：确保后端服务运行在默认端口（通常是 4000）
2. **类型安全**：所有数据类型在 `types.ts` 中定义
3. **组件复用**：棋盘和聊天组件可在复盘页面复用
4. **状态管理**：使用 React Hooks（useState, useEffect）
5. **样式隔离**：每个页面组件有独立的 CSS 文件
