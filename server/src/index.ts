import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupRealtime } from './realtime';
import { supabase } from './supabase';

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/room/create', async (req, res) => {
  try {
    const { roomName } = req.body;
    const password = generateRoomPassword();
    const id = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hostId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nickname = generateNickname();
    const now = Date.now();

    const { data: room, error } = await supabase.from('rooms').insert({
      id,
      name: roomName,
      password,
      status: 'waiting',
      board: JSON.stringify(Array(19).fill(null).map(() => Array(19).fill(null))),
      current_turn: 'black',
      created_at: now,
    }).select().single();

    if (error) throw error;

    await supabase.from('players').insert({
      id: hostId,
      room_password: password,
      nickname,
      role: 'host',
      color: 'black',
      is_ready: false,
      connected: true,
      time_remaining: 20 * 60 * 1000,
      byoyomi_count: 3,
      is_in_byoyomi: false,
    });

    res.json({
      room: {
        id,
        name: roomName,
        password,
        status: 'waiting',
        players: {
          host: {
            id: hostId,
            nickname,
            role: 'host',
            color: 'black',
            isReady: false,
            connected: true,
            timeRemaining: 20 * 60 * 1000,
            byoyomiCount: 3,
            isInByoyomi: false,
          },
          guest: null,
        },
        spectators: [],
        board: Array(19).fill(null).map(() => Array(19).fill(null)),
        moves: [],
        currentTurn: 'black',
        koPosition: null,
        lastMove: null,
        winner: null,
        result: '',
        startedAt: null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/room/join', async (req, res) => {
  try {
    const { password } = req.body;

    const { data: room } = await supabase.from('rooms').select('*').eq('password', password).single();
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    if (room.status === 'finished') {
      return res.status(400).json({ error: '对局已结束' });
    }

    const { data: players } = await supabase.from('players').select('*').eq('room_password', password);
    const hasHost = players?.some((p: any) => p.role === 'host');
    const hasGuest = players?.some((p: any) => p.role === 'guest');

    const role = hasGuest ? 'spectator' : 'guest';
    const color = role === 'guest' ? 'white' : null;

    const guestId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nickname = generateNickname();

    await supabase.from('players').insert({
      id: guestId,
      room_password: password,
      nickname,
      role,
      color,
      is_ready: false,
      connected: true,
      time_remaining: 20 * 60 * 1000,
      byoyomi_count: 3,
      is_in_byoyomi: false,
    });

    const { data: updatedPlayers } = await supabase.from('players').select('*').eq('room_password', password);

    const host = updatedPlayers?.find((p: any) => p.role === 'host');
    const guest = updatedPlayers?.find((p: any) => p.role === 'guest');

    res.json({
      room: {
        id: room.id,
        name: room.name,
        password: room.password,
        status: room.status,
        board: typeof room.board === 'string' ? JSON.parse(room.board) : room.board,
        currentTurn: room.current_turn,
        koPosition: room.ko_position,
        lastMove: room.last_move,
        winner: room.winner,
        result: room.result,
        startedAt: room.started_at,
        players: {
          host: host ? transformPlayer(host) : null,
          guest: guest ? transformPlayer(guest) : null,
        },
        spectators: [],
        moves: [],
      },
      player: {
        id: guestId,
        nickname,
        role,
        color,
        isReady: false,
        connected: true,
        timeRemaining: 20 * 60 * 1000,
        byoyomiCount: 3,
        isInByoyomi: false,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/room/ready', async (req, res) => {
  try {
    const { playerId } = req.body;
    await supabase.from('players').update({ is_ready: true }).eq('id', playerId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/game/move', async (req, res) => {
  try {
    const { playerId, password, position } = req.body;

    const { data: room } = await supabase.from('rooms').select('*').eq('password', password).single();
    if (!room || room.status !== 'playing') {
      return res.status(400).json({ success: false, error: '游戏未开始' });
    }

    const { data: players } = await supabase.from('players').select('*').eq('room_password', password);
    const player = players?.find((p: any) => p.id === playerId);
    if (!player || !player.color || player.color !== room.current_turn) {
      return res.status(400).json({ success: false, error: '还没轮到你落子' });
    }

    const board = typeof room.board === 'string' ? JSON.parse(room.board) : room.board;
    const koPos = room.ko_position ? { x: room.ko_position.x, y: room.ko_position.y } : null;
    const { validateMove, makeMove } = await import('./gameEngine');
    const validation = validateMove(board, position.x, position.y, player.color, koPos);

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const capturedStones = makeMove(board, position.x, position.y, player.color);
    const moveNumber = room.last_move ? (typeof room.last_move === 'string' ? JSON.parse(room.last_move).moveNumber : room.last_move.moveNumber) + 1 : 1;
    const move = { position, color: player.color, moveNumber, timestamp: Date.now(), capturedStones };
    const nextTurn = player.color === 'black' ? 'white' : 'black';

    await supabase.from('rooms').update({
      board: JSON.stringify(board),
      current_turn: nextTurn,
      last_move: JSON.stringify(move),
    }).eq('password', password);

    await supabase.from('moves').insert({
      room_password: password,
      position: JSON.stringify(position),
      color: player.color,
      move_number: moveNumber,
      captured_stones: capturedStones.length > 0 ? JSON.stringify(capturedStones) : null,
      timestamp: move.timestamp,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/game/pass', async (req, res) => {
  try {
    const { playerId, password } = req.body;

    const { data: room } = await supabase.from('rooms').select('*').eq('password', password).single();
    if (!room || room.status !== 'playing') {
      return res.status(400).json({ error: '游戏未开始' });
    }

    const { data: players } = await supabase.from('players').select('*').eq('room_password', password);
    const player = players?.find((p: any) => p.id === playerId);
    if (!player || !player.color) return res.status(400).json({ error: '无效玩家' });

    const lastMove = room.last_move ? (typeof room.last_move === 'string' ? JSON.parse(room.last_move) : room.last_move) : null;
    if (lastMove && lastMove.position.x === -1) {
      const board = typeof room.board === 'string' ? JSON.parse(room.board) : room.board;
      const { calculateScore } = await import('./gameEngine');
      const scores = calculateScore(board);
      const winner = scores.winner === 'draw' ? null : scores.winner;
      const result = `黑子：${scores.black}，白子：${scores.white}（含贴目3.75），${scores.winner === 'black' ? '黑方获胜' : scores.winner === 'white' ? '白方获胜' : '和棋'}`;

      await supabase.from('rooms').update({ status: 'finished', winner, result }).eq('password', password);
    } else {
      const nextTurn = player.color === 'black' ? 'white' : 'black';
      const passMove = { position: { x: -1, y: -1 }, color: player.color, moveNumber: (lastMove?.moveNumber || 0) + 1, timestamp: Date.now() };
      await supabase.from('rooms').update({ current_turn: nextTurn, last_move: JSON.stringify(passMove) }).eq('password', password);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/game/resign', async (req, res) => {
  try {
    const { playerId, password } = req.body;

    const { data: room } = await supabase.from('rooms').select('*').eq('password', password).single();
    if (!room || room.status !== 'playing') {
      return res.status(400).json({ error: '游戏未开始' });
    }

    const { data: players } = await supabase.from('players').select('*').eq('room_password', password);
    const player = players?.find((p: any) => p.id === playerId);
    if (!player || !player.color) return res.status(400).json({ error: '无效玩家' });

    const winner = player.color === 'black' ? 'white' : 'black';
    const result = player.color === 'black' ? '黑方认负，白方获胜' : '白方认负，黑方获胜';

    await supabase.from('rooms').update({ status: 'finished', winner, result }).eq('password', password);

    res.json({ success: true, winner });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/send', async (req, res) => {
  try {
    const { playerId, password, content } = req.body;
    if (!content.trim()) return res.status(400).json({ error: '消息不能为空' });

    const { data: players } = await supabase.from('players').select('*').eq('room_password', password);
    const player = players?.find((p: any) => p.id === playerId);
    if (!player) return res.status(400).json({ error: '无效玩家' });

    const message = {
      id: `msg_${Date.now()}`,
      sender_id: playerId,
      sender_nickname: player.nickname,
      content: content.trim(),
      timestamp: Date.now(),
    };

    await supabase.from('chat_messages').insert({
      ...message,
      room_password: password,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function generateRoomPassword(length: number = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateNickname(): string {
  const adjectives = ['快乐的', '聪明的', '勇敢的', '温柔的', '活泼的', '善良的', '可爱的', '机智的', '调皮的', '开心的'];
  const animals = ['小熊', '小兔', '小鹿', '小猫', '小狐狸', '小松鼠', '小企鹅', '小海豚', '小浣熊', '小熊猫'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${animals[Math.floor(Math.random() * animals.length)]}`;
}

function transformPlayer(p: any): any {
  return {
    id: p.id,
    nickname: p.nickname,
    role: p.role,
    color: p.color,
    isReady: p.is_ready,
    connected: p.connected,
    timeRemaining: p.time_remaining,
    byoyomiCount: p.byoyomi_count,
    isInByoyomi: p.is_in_byoyomi,
  };
}

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

setupRealtime(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});