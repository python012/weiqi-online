// Socket.IO 客户端服务层
import { io, Socket } from 'socket.io-client';
import { Room, Player, Move, ChatMessage, Position } from '../types';

// 创建Socket连接
const SOCKET_URL = import.meta.env.PROD ? '' : 'http://localhost:4000';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * 连接Socket服务器
   */
  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('已连接到服务器');
    });

    this.socket.on('disconnect', () => {
      console.log('已断开连接');
    });

    this.socket.on('error', (error: string) => {
      console.error('Socket错误:', error);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * 创建房间
   */
  createRoom(roomName: string, callback: (room: Room) => void): void {
    this.socket?.emit('room:create', roomName, callback);
  }

  /**
   * 加入房间
   */
  joinRoom(password: string, callback: (room: Room | null, player: Player | null, error?: string) => void): void {
    this.socket?.emit('room:join', password, callback);
  }

  /**
   * 观战
   */
  spectateRoom(password: string, callback: (room: Room | null, player: Player | null, error?: string) => void): void {
    this.socket?.emit('room:spectate', password, callback);
  }

  /**
   * 准备/确认开始
   */
  setReady(callback: () => void): void {
    this.socket?.emit('room:ready', callback);
  }

  /**
   * 离开房间
   */
  leaveRoom(callback: () => void): void {
    this.socket?.emit('room:leave', callback);
  }

  /**
   * 落子
   */
  makeMove(position: Position, callback: (success: boolean, error?: string) => void): void {
    this.socket?.emit('game:move', position, callback);
  }

  /**
   * Pass
   */
  pass(callback: () => void): void {
    this.socket?.emit('game:pass', callback);
  }

  /**
   * 认输
   */
  resign(callback: () => void): void {
    this.socket?.emit('game:resign', callback);
  }

  /**
   * 发送聊天消息
   */
  sendChatMessage(content: string, callback: () => void): void {
    this.socket?.emit('chat:send', content, callback);
  }

  // 事件监听方法
  onRoomCreated(callback: (room: Room) => void): void {
    this.socket?.on('room:created', callback);
  }

  onRoomJoined(callback: (room: Room, player: Player) => void): void {
    this.socket?.on('room:joined', callback);
  }

  onRoomUpdated(callback: (room: Room) => void): void {
    this.socket?.on('room:updated', callback);
  }

  onPlayerJoined(callback: (player: Player) => void): void {
    this.socket?.on('room:player-joined', callback);
  }

  onPlayerLeft(callback: (playerId: string) => void): void {
    this.socket?.on('room:player-left', callback);
  }

  onGameStart(callback: (room: Room) => void): void {
    this.socket?.on('room:game-start', callback);
  }

  onMove(callback: (move: Move, room: Room) => void): void {
    this.socket?.on('game:move', callback);
  }

  onPass(callback: (move: Move, room: Room) => void): void {
    this.socket?.on('game:pass', callback);
  }

  onResign(callback: (winner: 'black' | 'white') => void): void {
    this.socket?.on('game:resign', callback);
  }

  onGameEnd(callback: (room: Room) => void): void {
    this.socket?.on('game:end', callback);
  }

  onChatMessage(callback: (message: ChatMessage) => void): void {
    this.socket?.on('chat:message', callback);
  }

  onError(callback: (error: string) => void): void {
    this.socket?.on('error', callback);
  }

  // 移除监听
  offRoomCreated(callback: (room: Room) => void): void {
    this.socket?.off('room:created', callback);
  }

  offRoomJoined(callback: (room: Room, player: Player) => void): void {
    this.socket?.off('room:joined', callback);
  }

  offRoomUpdated(callback: (room: Room) => void): void {
    this.socket?.off('room:updated', callback);
  }

  offPlayerJoined(callback: (player: Player) => void): void {
    this.socket?.off('room:player-joined', callback);
  }

  offPlayerLeft(callback: (playerId: string) => void): void {
    this.socket?.off('room:player-left', callback);
  }

  offGameStart(callback: (room: Room) => void): void {
    this.socket?.off('room:game-start', callback);
  }

  offMove(callback: (move: Move, room: Room) => void): void {
    this.socket?.off('game:move', callback);
  }

  offPass(callback: (move: Move, room: Room) => void): void {
    this.socket?.off('game:pass', callback);
  }

  offResign(callback: (winner: 'black' | 'white') => void): void {
    this.socket?.off('game:resign', callback);
  }

  offGameEnd(callback: (room: Room) => void): void {
    this.socket?.off('game:end', callback);
  }

  offChatMessage(callback: (message: ChatMessage) => void): void {
    this.socket?.off('chat:message', callback);
  }

  offError(callback: (error: string) => void): void {
    this.socket?.off('error', callback);
  }
}

// 导出单例
export const socketService = new SocketService();
