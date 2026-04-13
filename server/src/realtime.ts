import { Server, Socket } from 'socket.io';
import { supabase } from './supabase';
import { generateNickname, generatePlayerId, GAME_CONFIG } from './shared';
import { validateMove, makeMove, calculateScore, isValidPosition } from './gameEngine';

type StoneColor = 'black' | 'white';
type RoomStatus = 'waiting' | 'playing' | 'finished';

interface Player {
  id: string;
  nickname: string;
  role: 'host' | 'guest' | 'spectator';
  color: StoneColor | null;
  isReady: boolean;
  connected: boolean;
  timeRemaining: number;
  byoyomiCount: number;
  isInByoyomi: boolean;
}

interface Move {
  position: { x: number; y: number };
  color: StoneColor;
  moveNumber: number;
  timestamp: number;
  capturedStones?: { x: number; y: number }[];
}

interface Room {
  id: string;
  name: string;
  password: string;
  status: RoomStatus;
  board: (StoneColor | null)[][];
  currentTurn: StoneColor;
  koPosition: { x: number; y: number } | null;
  lastMove: Move | null;
  winner: StoneColor | null;
  result: string;
  startedAt: number | null;
  createdAt: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  timestamp: number;
}

const socketMap = new Map<string, { password: string; playerId: string }>();
const subscriptions = new Map<string, () => void>();

function generateRoomId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateRoomPassword(length: number = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function createEmptyBoard(): (StoneColor | null)[][] {
  return Array(19).fill(null).map(() => Array(19).fill(null));
}

async function getRoomByPassword(password: string): Promise<Room | null> {
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('password', password)
    .single();
  return data;
}

async function getPlayersByRoom(password: string): Promise<Player[]> {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('room_password', password);
  return data || [];
}

async function subscribeToRoom(password: string, io: Server): Promise<void> {
  if (subscriptions.has(password)) return;

  const channel = supabase.channel(`room:${password}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `password=eq.${password}` }, async (payload) => {
      const room = await getRoomByPassword(password);
      if (room) {
        io.to(password).emit('room:updated', room);
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `room_password=eq.${password}` }, async (payload) => {
      const players = await getPlayersByRoom(password);
      io.to(password).emit('room:player-joined', players);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_password=eq.${password}` }, async (payload) => {
      const players = await getPlayersByRoom(password);
      const room = await getRoomByPassword(password);
      if (room && players.length === 2) {
        const host = players.find(p => p.role === 'host');
        const guest = players.find(p => p.role === 'guest');
        if (host?.isReady && guest?.isReady) {
          room.status = 'playing';
          room.startedAt = Date.now();
          await supabase.from('rooms').update({ status: 'playing', started_at: room.startedAt }).eq('password', password);
          io.to(password).emit('room:game-start', room);
        }
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players', filter: `room_password=eq.${password}` }, async (payload) => {
      const players = await getPlayersByRoom(password);
      io.to(password).emit('room:player-left', payload.old?.id);
      const room = await getRoomByPassword(password);
      if (room) io.to(password).emit('room:updated', room);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `room_password=eq.${password}` }, async (payload) => {
      const room = await getRoomByPassword(password);
      if (room) {
        io.to(password).emit('game:move', payload.new, room);
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_password=eq.${password}` }, (payload) => {
      io.to(password).emit('chat:message', payload.new);
    })
    .subscribe();

  subscriptions.set(password, () => {
    supabase.removeChannel(channel);
  });
}

export function setupRealtime(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('room:create', async (roomName: string, callback: (room: Room) => void) => {
      const playerId = generatePlayerId();
      const password = generateRoomPassword();
      
      const host: Player = {
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

      const room: Room = {
        id: generateRoomId(),
        name: roomName,
        password,
        status: 'waiting',
        board: createEmptyBoard(),
        currentTurn: 'black',
        koPosition: null,
        lastMove: null,
        winner: null,
        result: '',
        startedAt: null,
        createdAt: Date.now(),
      };

      await supabase.from('rooms').insert({
        id: room.id,
        name: room.name,
        password: room.password,
        status: room.status,
        board: JSON.stringify(room.board),
        current_turn: room.currentTurn,
        ko_position: null,
        last_move: null,
        started_at: null,
        created_at: room.createdAt,
      });

      await supabase.from('players').insert({
        id: host.id,
        room_password: password,
        nickname: host.nickname,
        role: host.role,
        color: host.color,
        is_ready: host.isReady,
        connected: host.connected,
        time_remaining: host.timeRemaining,
        byoyomi_count: host.byoyomiCount,
        is_in_byoyomi: host.isInByoyomi,
      });

      socketMap.set(socket.id, { password, playerId });
      socket.join(password);
      await subscribeToRoom(password, io);
      callback(room);
    });

    socket.on('room:join', async (password: string, callback: (room: Room | null, player: Player | null, error?: string) => void) => {
      const room = await getRoomByPassword(password);
      if (!room) {
        callback(null, null, '房间不存在');
        return;
      }

      if (room.status === 'finished') {
        callback(null, null, '对局已结束');
        return;
      }

      const players = await getPlayersByRoom(password);
      const hasHost = players.some(p => p.role === 'host');
      const hasGuest = players.some(p => p.role === 'guest');

      const role = hasGuest ? 'spectator' : 'guest';
      const color = role === 'guest' ? 'white' : null;

      const player: Player = {
        id: generatePlayerId(),
        nickname: generateNickname(),
        role,
        color,
        isReady: false,
        connected: true,
        timeRemaining: GAME_CONFIG.BASE_TIME,
        byoyomiCount: GAME_CONFIG.BYOYOMI_COUNT,
        isInByoyomi: false,
      };

      await supabase.from('players').insert({
        id: player.id,
        room_password: password,
        nickname: player.nickname,
        role: player.role,
        color: player.color,
        is_ready: player.isReady,
        connected: player.connected,
        time_remaining: player.timeRemaining,
        byoyomi_count: player.byoyomiCount,
        is_in_byoyomi: player.isInByoyomi,
      });

      socketMap.set(socket.id, { password, playerId: player.id });
      socket.join(password);
      await subscribeToRoom(password, io);
      callback(room, player);
    });

    socket.on('room:ready', async () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      await supabase.from('players').update({ is_ready: true }).eq('id', playerId);
    });

    socket.on('game:move', async (position: { x: number; y: number }, callback: (success: boolean, error?: string) => void) => {
      const map = socketMap.get(socket.id);
      if (!map) {
        callback(false, '未加入房间');
        return;
      }

      const { password, playerId } = map;
      const room = await getRoomByPassword(password);
      if (!room) {
        callback(false, '房间不存在');
        return;
      }

      if (room.status !== 'playing') {
        callback(false, '游戏未开始');
        return;
      }

      const players = await getPlayersByRoom(password);
      const player = players.find(p => p.id === playerId);
      if (!player || !player.color) {
        callback(false, '不是有效玩家');
        return;
      }

      if (player.color !== room.current_turn) {
        callback(false, '还没轮到你落子');
        return;
      }

      const board = JSON.parse(JSON.stringify(room.board));
      const koPos = room.ko_position ? { x: room.ko_position.x, y: room.ko_position.y } : null;
      const validation = validateMove(board, position.x, position.y, player.color, koPos);

      if (!validation.valid) {
        callback(false, validation.error);
        return;
      }

      const capturedStones = makeMove(board, position.x, position.y, player.color);

      const move: Move = {
        position,
        color: player.color,
        moveNumber: (room.last_move?.moveNumber || 0) + 1,
        timestamp: Date.now(),
        capturedStones,
      };

      const nextTurn: StoneColor = player.color === 'black' ? 'white' : 'black';

      await supabase.from('rooms').update({
        board: JSON.stringify(board),
        current_turn: nextTurn,
        last_move: JSON.stringify(move),
      }).eq('password', password);

      await supabase.from('moves').insert({
        room_password: password,
        position: JSON.stringify(position),
        color: player.color,
        move_number: move.moveNumber,
        captured_stones: capturedStones.length > 0 ? JSON.stringify(capturedStones) : null,
        timestamp: move.timestamp,
      });

      callback(true);
    });

    socket.on('game:pass', async () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      const room = await getRoomByPassword(password);
      if (!room || room.status !== 'playing') return;

      const players = await getPlayersByRoom(password);
      const player = players.find(p => p.id === playerId);
      if (!player || !player.color) return;

      const move: Move = {
        position: { x: -1, y: -1 },
        color: player.color,
        moveNumber: (room.last_move?.moveNumber || 0) + 1,
        timestamp: Date.now(),
      };

      const nextTurn: StoneColor = player.color === 'black' ? 'white' : 'black';

      const lastMove = room.last_move ? JSON.parse(JSON.stringify(room.last_move)) : null;
      if (lastMove && lastMove.position.x === -1) {
        const board = JSON.parse(room.board as any);
        const scores = calculateScore(board);
        const winner = scores.winner === 'draw' ? null : scores.winner;
        const result = `黑子：${scores.black}，白子：${scores.white}（含贴目3.75），${scores.winner === 'black' ? '黑方获胜' : scores.winner === 'white' ? '白方获胜' : '和棋'}`;

        await supabase.from('rooms').update({
          status: 'finished',
          winner,
          result,
          last_move: JSON.stringify(move),
        }).eq('password', password);

        const updatedRoom = await getRoomByPassword(password);
        if (updatedRoom) io.to(password).emit('game:end', updatedRoom);
      } else {
        await supabase.from('rooms').update({
          current_turn: nextTurn,
          last_move: JSON.stringify(move),
        }).eq('password', password);

        const updatedRoom = await getRoomByPassword(password);
        if (updatedRoom) io.to(password).emit('game:pass', move, updatedRoom);
      }
    });

    socket.on('game:resign', async () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      const room = await getRoomByPassword(password);
      if (!room || room.status !== 'playing') return;

      const players = await getPlayersByRoom(password);
      const player = players.find(p => p.id === playerId);
      if (!player || !player.color) return;

      const winner: StoneColor = player.color === 'black' ? 'white' : 'black';
      const result = player.color === 'black' ? '黑方认负，白方获胜' : '白方认负，黑方获胜';

      await supabase.from('rooms').update({
        status: 'finished',
        winner,
        result,
      }).eq('password', password);

      const updatedRoom = await getRoomByPassword(password);
      if (updatedRoom) {
        io.to(password).emit('game:resign', winner);
        io.to(password).emit('game:end', updatedRoom);
      }
    });

    socket.on('chat:send', async (content: string) => {
      const map = socketMap.get(socket.id);
      if (!map || !content.trim()) return;

      const { password, playerId } = map;
      const room = await getRoomByPassword(password);
      if (!room) return;

      const players = await getPlayersByRoom(password);
      const player = players.find(p => p.id === playerId);
      if (!player) return;

      const message: ChatMessage = {
        id: `msg_${Date.now()}`,
        senderId: playerId,
        senderNickname: player.nickname,
        content: content.trim(),
        timestamp: Date.now(),
      };

      await supabase.from('chat_messages').insert({
        id: message.id,
        room_password: password,
        sender_id: message.senderId,
        sender_nickname: message.senderNickname,
        content: message.content,
        timestamp: message.timestamp,
      });
    });

    socket.on('room:leave', async () => {
      const map = socketMap.get(socket.id);
      if (!map) return;

      const { password, playerId } = map;
      await supabase.from('players').delete().eq('id', playerId);
      socketMap.delete(socket.id);
      socket.leave(password);
    });

    socket.on('disconnect', async () => {
      const map = socketMap.get(socket.id);
      if (map) {
        const { password, playerId } = map;
        await supabase.from('players').update({ connected: false }).eq('id', playerId);
        socketMap.delete(socket.id);
        console.log(`Client disconnected: ${socket.id}`);
      }
    });
  });
}