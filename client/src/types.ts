// 前后端共享的类型定义（前端版本）
export type StoneColor = 'black' | 'white';
export type PlayerRole = 'host' | 'guest' | 'spectator';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Player {
  id: string;
  nickname: string;
  role: PlayerRole;
  color: StoneColor | null;
  isReady: boolean;
  connected: boolean;
  timeRemaining: number;
  byoyomiCount: number;
  isInByoyomi: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export interface Move {
  position: Position;
  color: StoneColor;
  moveNumber: number;
  timestamp: number;
  capturedStones?: Position[];
}

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
  board: (StoneColor | null)[][];
  moves: Move[];
  currentTurn: StoneColor;
  koPosition: Position | null;
  lastMove: Move | null;
  winner: StoneColor | null;
  result: string;
  startedAt: number | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  timestamp: number;
}

export const GAME_CONFIG = {
  BOARD_SIZE: 19,
  BASE_TIME: 20 * 60 * 1000,
  BYOYOMI_TIME: 60 * 1000,
  BYOYOMI_COUNT: 3,
  RECONNECT_TIMEOUT: 60 * 1000,
};
