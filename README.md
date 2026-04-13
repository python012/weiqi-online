# 围棋在线对弈平台

一个面向休闲娱乐玩家的围棋在线对弈平台，无需注册即可快速上手，创建房间邀请好友对弈。

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Node.js + Express + TypeScript
- **实时通信**: Socket.IO

## 快速开始

### 安装依赖

```bash
cd client && npm install
cd server && npm install
```

### 启动服务

```bash
# 终端1：启动后端
cd server && npm run dev

# 终端2：启动前端
cd client && npm run dev
```

访问 http://localhost:3000

## 功能特性

- 19×19 标准棋盘
- 完整围棋规则（禁入点、提子、打劫）
- 房间密码邀请对战
- 实时聊天
- 对局复盘
- 计时系统（20分钟 + 3次60秒读秒）

## 项目结构

```
weiqi-online/
├── client/          # 前端 React 项目
├── server/          # 后端 Node.js 项目
└── shared/          # 共享类型定义
```
