// 房间管理模块
import {
  Room,
  Player,
  StoneColor,
  Position,
  Move,
  createEmptyBoard,
  generateRoomPassword,
  GAME_CONFIG
} from '../shared';
import { validateMove, makeMove, calculateScore } from '../gameEngine';

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * 创建新房间
   */
  createRoom(roomName: string, host: Player): Room {
    const roomId = this.generateRoomId();
    const room: Room = {
      id: roomId,
      name: roomName,
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

    this.rooms.set(room.password, room);
    return room;
  }

  /**
   * 通过密码获取房间
   */
  getRoomByPassword(password: string): Room | undefined {
    return this.rooms.get(password);
  }

  /**
   * 通过ID获取房间
   */
  getRoomById(id: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.id === id) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * 加入房间
   */
  joinRoom(password: string, player: Player, asSpectator: boolean = false): { room: Room | null; error?: string } {
    const room = this.rooms.get(password);
    if (!room) {
      return { room: null, error: '房间不存在' };
    }

    if (room.status === 'finished') {
      return { room: null, error: '对局已结束' };
    }

    if (asSpectator) {
      // 观战者加入
      const existingSpectator = room.spectators.find(s => s.id === player.id);
      if (!existingSpectator) {
        room.spectators.push(player);
      }
      return { room };
    }

    // 玩家加入
    if (!room.players.host) {
      room.players.host = player;
      player.role = 'host';
      player.color = 'black';
    } else if (!room.players.guest) {
      room.players.guest = player;
      player.role = 'guest';
      player.color = 'white';
    } else {
      // 房间已满，尝试作为观战者
      room.spectators.push(player);
      player.role = 'spectator';
    }

    return { room };
  }

  /**
   * 离开房间
   */
  leaveRoom(password: string, playerId: string): void {
    const room = this.rooms.get(password);
    if (!room) return;

    // 检查是否是玩家
    if (room.players.host?.id === playerId) {
      room.players.host = null;
    } else if (room.players.guest?.id === playerId) {
      room.players.guest = null;
    } else {
      // 移除观战者
      room.spectators = room.spectators.filter(s => s.id !== playerId);
    }

    // 如果房间没有玩家了，删除房间
    if (!room.players.host && !room.players.guest && room.spectators.length === 0) {
      this.rooms.delete(password);
    }
  }

  /**
   * 玩家准备
   */
  playerReady(password: string, playerId: string): boolean {
    const room = this.rooms.get(password);
    if (!room) return false;

    if (room.players.host?.id === playerId) {
      room.players.host.isReady = true;
    } else if (room.players.guest?.id === playerId) {
      room.players.guest.isReady = true;
    }

    // 检查双方是否都准备好
    if (room.players.host?.isReady && room.players.guest?.isReady) {
      this.startGame(room);
      return true;
    }

    return false;
  }

  /**
   * 开始游戏
   */
  private startGame(room: Room): void {
    room.status = 'playing';
    room.currentTurn = 'black';
    room.startedAt = Date.now();

    // 初始化双方时间
    const host = room.players.host;
    const guest = room.players.guest;
    if (host) {
      host.timeRemaining = GAME_CONFIG.BASE_TIME;
      host.byoyomiCount = GAME_CONFIG.BYOYOMI_COUNT;
      host.isInByoyomi = false;
    }
    if (guest) {
      guest.timeRemaining = GAME_CONFIG.BASE_TIME;
      guest.byoyomiCount = GAME_CONFIG.BYOYOMI_COUNT;
      guest.isInByoyomi = false;
    }
  }

  /**
   * 执行落子
   */
  makeMove(password: string, playerId: string, x: number, y: number): { success: boolean; move?: Move; error?: string } {
    const room = this.rooms.get(password);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    if (room.status !== 'playing') {
      return { success: false, error: '游戏未开始' };
    }

    // 确定当前玩家颜色
    let playerColor: StoneColor | null = null;
    if (room.players.host?.id === playerId) {
      playerColor = room.players.host.color;
    } else if (room.players.guest?.id === playerId) {
      playerColor = room.players.guest.color;
    }

    if (!playerColor) {
      return { success: false, error: '不是有效玩家' };
    }

    if (playerColor !== room.currentTurn) {
      return { success: false, error: '还没轮到你落子' };
    }

    // 验证落子是否合法
    const validation = validateMove(room.board, x, y, playerColor, room.koPosition);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 执行落子
    const capturedStones = makeMove(room.board, x, y, playerColor);

    // 更新打劫位置
    let koPosition: Position | null = null;
    if (capturedStones.length === 1) {
      // 单子被提，可能是打劫
      const captured = capturedStones[0];
      // 检查该位置周围是否只有一气
      const opponentColor: StoneColor = playerColor === 'black' ? 'white' : 'black';
      // 简化处理：如果提掉对方一子后该位置无气，则是打劫
      if (room.board[captured.y][captured.x] === null) {
        // 这个位置现在有空位，检查如果在这里落子是否会是自杀
        const testBoard = room.board.map(row => [...row]);
        testBoard[captured.y][captured.x] = opponentColor;
        // 这里简化处理，直接允许
        koPosition = null;
      }
    }

    // 创建棋步记录
    const move: Move = {
      position: { x, y },
      color: playerColor,
      moveNumber: room.moves.length + 1,
      timestamp: Date.now(),
      capturedStones,
    };

    room.moves.push(move);
    room.lastMove = move;
    room.koPosition = koPosition;
    room.currentTurn = playerColor === 'black' ? 'white' : 'black';

    return { success: true, move };
  }

  /**
   * Pass
   */
  pass(password: string, playerId: string): { success: boolean; move?: Move; error?: string } {
    const room = this.rooms.get(password);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    if (room.status !== 'playing') {
      return { success: false, error: '游戏未开始' };
    }

    let playerColor: StoneColor | null = null;
    if (room.players.host?.id === playerId) {
      playerColor = room.players.host.color;
    } else if (room.players.guest?.id === playerId) {
      playerColor = room.players.guest.color;
    }

    if (!playerColor) {
      return { success: false, error: '不是有效玩家' };
    }

    // 检查是否是连续Pass
    const lastMove = room.moves[room.moves.length - 1];
    if (lastMove && lastMove.position.x === -1 && lastMove.position.y === -1) {
      // 双方连续Pass，进入计目阶段
      this.endGame(room);
      return { success: true };
    }

    // 记录Pass
    const passMove: Move = {
      position: { x: -1, y: -1 }, // -1 表示 Pass
      color: playerColor,
      moveNumber: room.moves.length + 1,
      timestamp: Date.now(),
    };

    room.moves.push(passMove);
    room.lastMove = passMove;
    room.currentTurn = playerColor === 'black' ? 'white' : 'black';

    return { success: true, move: passMove };
  }

  /**
   * 认输
   */
  resign(password: string, playerId: string): { success: boolean; winner?: StoneColor; error?: string } {
    const room = this.rooms.get(password);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    if (room.status !== 'playing') {
      return { success: false, error: '游戏未开始' };
    }

    let loserColor: StoneColor | null = null;
    if (room.players.host?.id === playerId) {
      loserColor = room.players.host.color;
    } else if (room.players.guest?.id === playerId) {
      loserColor = room.players.guest.color;
    }

    if (!loserColor) {
      return { success: false, error: '不是有效玩家' };
    }

    const winner: StoneColor = loserColor === 'black' ? 'white' : 'black';
    room.winner = winner;
    room.status = 'finished';
    room.result = loserColor === 'black' ? '黑方认负，白方获胜' : '白方认负，黑方获胜';

    return { success: true, winner };
  }

  /**
   * 结束游戏并计目
   */
  private endGame(room: Room): void {
    const scores = calculateScore(room.board);
    room.status = 'finished';
    room.winner = scores.winner === 'draw' ? null : scores.winner;
    room.result = `黑子：${scores.black}，白子：${scores.white}（含贴目${3.75}），${scores.winner === 'black' ? '黑方获胜' : scores.winner === 'white' ? '白方获胜' : '和棋'}`;
  }

  /**
   * 确认结果
   */
  confirmResult(password: string, playerId: string): boolean {
    const room = this.rooms.get(password);
    if (!room) return false;

    // 玩家确认，这里可以添加确认逻辑
    return true;
  }

  /**
   * 生成房间ID
   */
  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新玩家连接状态
   */
  setPlayerConnected(password: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(password);
    if (!room) return;

    if (room.players.host?.id === playerId) {
      room.players.host.connected = connected;
    } else if (room.players.guest?.id === playerId) {
      room.players.guest.connected = connected;
    }
  }
}

export const roomManager = new RoomManager();
