// 前后端共享的类型定义

// 棋子颜色
export type StoneColor = 'black' | 'white';

// 玩家角色
export type PlayerRole = 'host' | 'guest' | 'spectator';

// 房间状态
export type RoomStatus = 'waiting' | 'playing' | 'finished';

// 玩家信息
export interface Player {
  id: string;
  nickname: string;
  role: PlayerRole;
  color: StoneColor | null;
  isReady: boolean;
  connected: boolean;
  // 时间控制相关
  timeRemaining: number; // 剩余时间（毫秒）
  byoyomiCount: number; // 剩余读秒次数
  isInByoyomi: boolean; // 是否已进入读秒阶段
}

// 棋盘位置
export interface Position {
  x: number;
  y: number;
}

// 一步棋
export interface Move {
  position: Position;
  color: StoneColor;
  moveNumber: number;
  timestamp: number;
  capturedStones?: Position[]; // 被提掉的棋子
}

// 房间信息
export interface Room {
  id: string;
  name: string;
  password: string;
  status: RoomStatus;
  players: {
    host: Player | null;
    guest: Player | null;
  };
  spectators: Player[];
  board: (StoneColor | null)[][]; // 19x19 棋盘
  moves: Move[];
  currentTurn: StoneColor;
  koPosition: Position | null; // 打劫位置
  lastMove: Move | null;
  // 对局结果
  winner: StoneColor | null;
  result: string;
  // 时间记录
  startedAt: number | null;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  timestamp: number;
}

// Socket 事件类型
export interface ServerToClientEvents {
  'room:created': (room: Room) => void;
  'room:joined': (room: Room, player: Player) => void;
  'room:updated': (room: Room) => void;
  'room:player-joined': (player: Player) => void;
  'room:player-left': (playerId: string) => void;
  'room:game-start': (room: Room) => void;
  'game:move': (move: Move, room: Room) => void;
  'game:pass': (move: Move, room: Room) => void;
  'game:resign': (winner: StoneColor) => void;
  'game:end': (room: Room) => void;
  'chat:message': (message: ChatMessage) => void;
  'error': (error: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (roomName: string, callback: (room: Room) => void) => void;
  'room:join': (password: string, callback: (room: Room | null, player: Player | null, error?: string) => void) => void;
  'room:spectate': (password: string, callback: (room: Room | null, player: Player | null, error?: string) => void) => void;
  'room:ready': (callback: () => void) => void;
  'room:leave': (callback: () => void) => void;
  'game:move': (position: Position, callback: (success: boolean, error?: string) => void) => void;
  'game:pass': (callback: () => void) => void;
  'game:resign': (callback: () => void) => void;
  'chat:send': (content: string, callback: () => void) => void;
}

// 时间控制常量
export const GAME_CONFIG = {
  BOARD_SIZE: 19,
  BASE_TIME: 20 * 60 * 1000, // 20分钟（毫秒）
  BYOYOMI_TIME: 60 * 1000, // 60秒读秒
  BYOYOMI_COUNT: 3, // 3次读秒机会
  RECONNECT_TIMEOUT: 60 * 1000, // 1分钟重连超时
};

// 工具函数：生成房间密码
export function generateRoomPassword(length: number = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// 工具函数：创建空棋盘
export function createEmptyBoard(size: number = 19): (StoneColor | null)[][] {
  return Array(size).fill(null).map(() => Array(size).fill(null));
}

// 工具函数：创建新房间
export function createRoom(id: string, name: string, host: Player): Room {
  return {
    id,
    name,
    password: generateRoomPassword(),
    status: 'waiting',
    players: {
      host,
      guest: null,
    },
    spectators: [],
    board: createEmptyBoard(),
    moves: [],
    currentTurn: 'black',
    koPosition: null,
    lastMove: null,
    winner: null,
    result: '',
    startedAt: null,
  };
}
