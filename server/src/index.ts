import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers';

const app = express();
app.use(cors());

// 简单的健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 设置Socket.IO事件处理
setupSocketHandlers(io);

console.log('围棋对弈服务器启动，监听端口 4000');

httpServer.listen(4000, () => {
  console.log('服务器运行在 http://localhost:4000');
});
