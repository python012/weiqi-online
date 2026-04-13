import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Room, Player, Move, ChatMessage, Position } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private currentRoom: string | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  private notify(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  disconnect(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.currentRoom = null;
  }

  isConnected(): boolean {
    return this.channel !== null;
  }

  async subscribeToRoom(password: string): Promise<void> {
    this.currentRoom = password;
    
    this.channel = supabase.channel(`room:${password}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms', filter: `password=eq.${password}` }, 
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const { data: room } = await supabase.from('rooms').select('*').eq('password', password).single();
            if (room) {
              this.notify('room:updated', this.transformRoom(room));
              if (room.status === 'playing') {
                this.notify('room:game-start', this.transformRoom(room));
              }
              if (room.status === 'finished') {
                this.notify('game:end', this.transformRoom(room));
              }
            }
          }
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'players', filter: `room_password=eq.${password}` }, 
        async (payload) => {
          const { data: players } = await supabase.from('players').select('*').eq('room_password', password);
          if (players) {
            if (payload.eventType === 'INSERT') {
              this.notify('room:player-joined', players.map(p => this.transformPlayer(p)));
            } else if (payload.eventType === 'DELETE') {
              this.notify('room:player-left', payload.old?.id);
            }
          }
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'moves', filter: `room_password=eq.${password}` }, 
        async (payload) => {
          const { data: room } = await supabase.from('rooms').select('*').eq('password', password).single();
          if (room && payload.new) {
            const move = this.transformMove(payload.new);
            this.notify('game:move', { move, room: this.transformRoom(room) });
          }
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_password=eq.${password}` }, 
        (payload) => {
          if (payload.new) {
            this.notify('chat:message', this.transformChatMessage(payload.new));
          }
        }
      )
      .subscribe();
  }

  private transformRoom(room: any): Room {
    const players = room.players || { host: null, guest: null };
    return {
      id: room.id,
      name: room.name,
      password: room.password,
      status: room.status,
      board: typeof room.board === 'string' ? JSON.parse(room.board) : room.board || [],
      currentTurn: room.current_turn || 'black',
      koPosition: room.ko_position,
      lastMove: room.last_move ? (typeof room.last_move === 'string' ? JSON.parse(room.last_move) : room.last_move) : null,
      winner: room.winner,
      result: room.result || '',
      startedAt: room.started_at,
      players: {
        host: players.host,
        guest: players.guest,
      },
      spectators: [],
      moves: [],
    };
  }

  private transformPlayer(player: any): Player {
    return {
      id: player.id,
      nickname: player.nickname,
      role: player.role,
      color: player.color,
      isReady: player.is_ready,
      connected: player.connected,
      timeRemaining: player.time_remaining,
      byoyomiCount: player.byoyomi_count,
      isInByoyomi: player.is_in_byoyomi,
    };
  }

  private transformMove(move: any): Move {
    return {
      position: typeof move.position === 'string' ? JSON.parse(move.position) : move.position,
      color: move.color,
      moveNumber: move.move_number,
      timestamp: move.timestamp,
      capturedStones: move.captured_stones ? (typeof move.captured_stones === 'string' ? JSON.parse(move.captured_stones) : move.captured_stones) : undefined,
    };
  }

  private transformChatMessage(msg: any): ChatMessage {
    return {
      id: msg.id,
      senderId: msg.sender_id,
      senderNickname: msg.sender_nickname,
      content: msg.content,
      timestamp: msg.timestamp,
    };
  }

  async createRoom(roomName: string): Promise<Room> {
    const { data: { user }} = await supabase.auth.getUser();
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/room/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName }),
    });
    const result = await response.json();
    await this.subscribeToRoom(result.room.password);
    return result.room;
  }

  async joinRoom(password: string): Promise<{ room: Room; player: Player }> {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/room/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    await this.subscribeToRoom(password);
    return result;
  }

  async setReady(): Promise<void> {
    // Handled by socket events
  }

  async leaveRoom(): Promise<void> {
    this.disconnect();
  }

  async makeMove(position: Position): Promise<void> {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/game/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  }

  async pass(): Promise<void> {
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/game/pass`, {
      method: 'POST',
    });
  }

  async resign(): Promise<void> {
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/game/resign`, {
      method: 'POST',
    });
  }

  async sendChatMessage(content: string): Promise<void> {
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  }

  onRoomCreated(callback: (room: Room) => void): void {
    this.listeners.get('room:created')?.add(callback) || this.listeners.set('room:created', new Set([callback]));
  }

  onRoomUpdated(callback: (room: Room) => void): void {
    this.listeners.get('room:updated')?.add(callback) || this.listeners.set('room:updated', new Set([callback]));
  }

  onPlayerJoined(callback: (players: Player[]) => void): void {
    this.listeners.get('room:player-joined')?.add(callback) || this.listeners.set('room:player-joined', new Set([callback]));
  }

  onPlayerLeft(callback: (playerId: string) => void): void {
    this.listeners.get('room:player-left')?.add(callback) || this.listeners.set('room:player-left', new Set([callback]));
  }

  onGameStart(callback: (room: Room) => void): void {
    this.listeners.get('room:game-start')?.add(callback) || this.listeners.set('room:game-start', new Set([callback]));
  }

  onMove(callback: (data: { move: Move; room: Room }) => void): void {
    this.listeners.get('game:move')?.add(callback) || this.listeners.set('game:move', new Set([callback]));
  }

  onGameEnd(callback: (room: Room) => void): void {
    this.listeners.get('game:end')?.add(callback) || this.listeners.set('game:end', new Set([callback]));
  }

  onChatMessage(callback: (message: ChatMessage) => void): void {
    this.listeners.get('chat:message')?.add(callback) || this.listeners.set('chat:message', new Set([callback]));
  }

  offRoomCreated(callback: (room: Room) => void): void {
    this.listeners.get('room:created')?.delete(callback);
  }

  offRoomUpdated(callback: (room: Room) => void): void {
    this.listeners.get('room:updated')?.delete(callback);
  }

  offPlayerJoined(callback: (players: Player[]) => void): void {
    this.listeners.get('room:player-joined')?.delete(callback);
  }

  offPlayerLeft(callback: (playerId: string) => void): void {
    this.listeners.get('room:player-left')?.delete(callback);
  }

  offGameStart(callback: (room: Room) => void): void {
    this.listeners.get('room:game-start')?.delete(callback);
  }

  offMove(callback: (data: { move: Move; room: Room }) => void): void {
    this.listeners.get('game:move')?.delete(callback);
  }

  offGameEnd(callback: (room: Room) => void): void {
    this.listeners.get('game:end')?.delete(callback);
  }

  offChatMessage(callback: (message: ChatMessage) => void): void {
    this.listeners.get('chat:message')?.delete(callback);
  }
}

export const realtimeService = new RealtimeService();