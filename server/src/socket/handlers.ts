// Socket.IO 事件处理模块
import { Server, Socket } from 'socket.io';
import { roomManager } from '../rooms/roomManager';
import { Player, StoneColor, ChatMessage, Position, GAME_CONFIG } from '../shared';

// 存储每个socketId对应的房间密码和玩家ID
const socketMap = new Map<string, { password: string; playerId: string }>();

/**
 * 生成随机玩家ID
 */
function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成随机昵称
 */
function generateNickname(): string {
  const adjectives = ['快乐', '聪明', '勇敢', '冷静', '热情', '悠闲', '勤奋', '自信'];
  const nouns = ['棋手', '玩家', '高手', '大师', '新人', '棋子', '棋盘', '围棋'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
}

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`客户端连接: ${socket.id}`);

    // 创建房间
    socket.on('room:create', (roomName: string, callback: (room: any) => void) => {
      const playerId = generatePlayerId();
      const player: Player = {
        id: playerId,
        nickname: generateNickname(),
        role: 'host',
        color: 'black',
        isReady: false,
        connected: true,
        timeRemaining: GAME_CONFIG.BASE_TIME,
        byoyomiCount: GAME_CONFIG.BYOYOMI_COUNT,
        isInByoyomi: false,
      };

      const room = roomManager.createRoom(roomName, player);
      socketMap.set(socket.id, { password: room.password, playerId });

      socket.join(room.password);
      callback(room);
    });

    // 加入房间
    socket.on('room:join', (password: string, callback: (room: any, player: any, error?: string) => void) => {
      const result = roomManager.joinRoom(password, {
        id: generatePlayerId(),
        nickname: generateNickname(),
        role: 'guest',
        color: 'white',
        isReady: false,
        connected: true,
        timeRemaining: GAME_CONFIG.BASE_TIME,
        byoyomiCount: GAME_CONFIG.BYOYOMI_COUNT,
        isInByoyomi: false,
      });

      if (result.error) {
        callback(null, null, result.error);
        return;
      }

      if (result.room) {
        // 获取新创建的玩家
        const player = result.room.players.guest || result.room.players.host;
        if (player) {
          socketMap.set(socket.id, { password, playerId: player.id });
          socket.join(password);

          // 通知房主
          io.to(password).emit('room:player-joined', player);
          callback(result.room, player);
        }
      }
    });

    // 观战
    socket.on('room:spectate', (password: string, callback: (room: any, player: any, error?: string) => void) => {
      const result = roomManager.joinRoom(password, {
        id: generatePlayerId(),
        nickname: generateNickname(),
        role: 'spectator',
        color: null,
        isReady: false,
        connected: true,
        timeRemaining: 0,
        byoyomiCount: 0,
        isInByoyomi: false,
      }, true);

      if (result.error) {
        callback(null, null, result.error);
        return;
      }

      if (result.room) {
        const player = result.room.spectators[result.room.spectators.length - 1];
        socketMap.set(socket.id, { password, playerId: player.id });
        socket.join(password);

        io.to(password).emit('room:player-joined', player);
        callback(result.room, player);
      }
    });

    // 准备/确认开始
    socket.on('room:ready', () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      const bothReady = roomManager.playerReady(password, playerId);

      if (bothReady) {
        const room = roomManager.getRoomByPassword(password);
        if (room) {
          io.to(password).emit('room:game-start', room);
        }
      } else {
        const room = roomManager.getRoomByPassword(password);
        if (room) {
          io.to(password).emit('room:updated', room);
        }
      }
    });

    // 落子
    socket.on('game:move', (position: Position, callback: (success: boolean, error?: string) => void) => {
      const map = socketMap.get(socket.id);
      if (!map) {
        callback(false, '未加入房间');
        return;
      }

      const { password, playerId } = map;
      const result = roomManager.makeMove(password, playerId, position.x, position.y);

      if (result.success && result.move) {
        const room = roomManager.getRoomByPassword(password);
        if (room) {
          io.to(password).emit('game:move', result.move, room);
        }
        callback(true);
      } else {
        callback(false, result.error);
      }
    });

    // Pass
    socket.on('game:pass', () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      const result = roomManager.pass(password, playerId);

      if (result.success && result.move) {
        const room = roomManager.getRoomByPassword(password);
        if (room) {
          if (room.status === 'finished') {
            io.to(password).emit('game:end', room);
          } else {
            io.to(password).emit('game:pass', result.move, room);
          }
        }
      }
    });

    // 认输
    socket.on('game:resign', () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      const result = roomManager.resign(password, playerId);

      if (result.success) {
        const room = roomManager.getRoomByPassword(password);
        if (room) {
          io.to(password).emit('game:resign', result.winner);
          io.to(password).emit('game:end', room);
        }
      }
    });

    // 聊天
    socket.on('chat:send', (content: string) => {
      const map = socketMap.get(socket.id);
      if (!map || !content.trim()) return;

      const { password, playerId } = map;
      const room = roomManager.getRoomByPassword(password);
      if (!room) return;

      // 查找发送者
      let sender = room.players.host?.id === playerId ? room.players.host :
                   room.players.guest?.id === playerId ? room.players.guest :
                   room.spectators.find(s => s.id === playerId);

      if (!sender) return;

      const message: ChatMessage = {
        id: `msg_${Date.now()}`,
        senderId: playerId,
        senderNickname: sender.nickname,
        content: content.trim(),
        timestamp: Date.now(),
      };

      io.to(password).emit('chat:message', message);
    });

    // 离开房间
    socket.on('room:leave', () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      roomManager.leaveRoom(password, playerId);

      const room = roomManager.getRoomByPassword(password);
      if (room) {
        io.to(password).emit('room:player-left', playerId);
        io.to(password).emit('room:updated', room);
      }

      socketMap.delete(socket.id);
    });

    // 断开连接
    socket.on('disconnect', () => {
      const map = socketMap.get(socket.id);
      if (map) {
        const { password, playerId } = map;
        roomManager.setPlayerConnected(password, playerId, false);
        socketMap.delete(socket.id);

        const room = roomManager.getRoomByPassword(password);
        if (room) {
          io.to(password).emit('room:player-left', playerId);
        }
      }
      console.log(`客户端断开: ${socket.id}`);
    });
  });
}
