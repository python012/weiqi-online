// 对局页面
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socket';
import { Room, Player, Move, ChatMessage, Position, StoneColor, GAME_CONFIG } from '../types';
import Board from '../components/Board';
import Chat from '../components/Chat';
import './Game.css';

const Game: React.FC = () => {
  const { password } = useParams<{ password: string }>();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [capturedStones, setCapturedStones] = useState({ black: 0, white: 0 });
  const [showResult, setShowResult] = useState(false);
  const [myColor, setMyColor] = useState<StoneColor | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // 初始化
  useEffect(() => {
    if (!password) {
      navigate('/');
      return;
    }

    const savedRoom = localStorage.getItem('currentRoom');
    const savedPlayer = localStorage.getItem('currentPlayer');
    
    if (savedRoom) {
      setRoom(JSON.parse(savedRoom));
    }
    if (savedPlayer) {
      const p = JSON.parse(savedPlayer);
      setPlayer(p);
      setMyColor(p.color);
    }

    // 游戏开始时添加系统提示消息
    if (savedRoom && savedPlayer) {
      const parsedRoom: Room = JSON.parse(savedRoom);
      const parsedPlayer: Player = JSON.parse(savedPlayer);
      if (parsedRoom.status === 'playing') {
        const isBlack = parsedPlayer.color === 'black';
        const colorText = isBlack ? '黑' : '白';
        const now = Date.now();
        const sysMessages: ChatMessage[] = [
          {
            id: `sys_name_${now}`,
            senderId: 'system',
            senderNickname: '系统',
            content: `您的昵称是：${parsedPlayer.nickname}`,
            timestamp: now,
          },
          {
            id: `sys_start_${now}`,
            senderId: 'system',
            senderNickname: '系统',
            content: isBlack
              ? `对局开始，本次对局由您执黑，请您开始斟酌落子`
              : `对局开始，本次对局由您执白，现在开始等待对方落子`,
            timestamp: now,
          },
        ];
        setMessages(sysMessages);
      }
    }

    // Socket 事件监听
    const handleRoomUpdated = (updatedRoom: Room) => {
      setRoom(updatedRoom);
      localStorage.setItem('currentRoom', JSON.stringify(updatedRoom));
    };

    const handleMove = (move: Move, updatedRoom: Room) => {
      setRoom(updatedRoom);
      localStorage.setItem('currentRoom', JSON.stringify(updatedRoom));
      
      // 更新提子统计
      if (move.capturedStones && move.capturedStones.length > 0) {
        setCapturedStones(prev => ({
          ...prev,
          [move.color]: prev[move.color] + move.capturedStones!.length
        }));
      }
    };

    const handlePass = (move: Move, updatedRoom: Room) => {
      setRoom(updatedRoom);
      localStorage.setItem('currentRoom', JSON.stringify(updatedRoom));
    };

    const handleResign = (winner: StoneColor) => {
      const currentRoom = localStorage.getItem('currentRoom');
      if (currentRoom) {
        const r = JSON.parse(currentRoom);
        r.status = 'finished';
        r.winner = winner;
        setRoom(r);
        localStorage.setItem('currentRoom', JSON.stringify(r));
        setShowResult(true);
      }
    };

    const handleGameEnd = (endedRoom: Room) => {
      setRoom(endedRoom);
      localStorage.setItem('currentRoom', JSON.stringify(endedRoom));
      setShowResult(true);
    };

    const handleChatMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    };

    socketService.onRoomUpdated(handleRoomUpdated);
    socketService.onMove(handleMove);
    socketService.onPass(handlePass);
    socketService.onResign(handleResign);
    socketService.onGameEnd(handleGameEnd);
    socketService.onChatMessage(handleChatMessage);

    return () => {
      socketService.offRoomUpdated(handleRoomUpdated);
      socketService.offMove(handleMove);
      socketService.offPass(handlePass);
      socketService.offResign(handleResign);
      socketService.offGameEnd(handleGameEnd);
      socketService.offChatMessage(handleChatMessage);
    };
  }, [password, navigate]);

  // 计时器逻辑（简化版）
  useEffect(() => {
    if (!room || room.status !== 'playing') return;

    timerRef.current = setInterval(() => {
      setRoom(prev => {
        if (!prev || prev.status !== 'playing') return prev;
        
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;

        const updatedRoom = { ...prev };
        const currentPlayer = prev.currentTurn === 'black' ? updatedRoom.players.host : updatedRoom.players.guest;
        
        if (currentPlayer) {
          currentPlayer.timeRemaining -= delta;
          
          // 检查是否进入读秒阶段
          if (!currentPlayer.isInByoyomi && currentPlayer.timeRemaining <= 0) {
            currentPlayer.isInByoyomi = true;
            currentPlayer.timeRemaining = GAME_CONFIG.BYOYOMI_TIME;
          }
          
          // 在读秒阶段，如果超时
          if (currentPlayer.isInByoyomi && currentPlayer.timeRemaining <= 0) {
            if (currentPlayer.byoyomiCount > 0) {
              currentPlayer.byoyomiCount -= 1;
              currentPlayer.timeRemaining = GAME_CONFIG.BYOYOMI_TIME;
            } else {
              // 超时判负
              handleTimeout(currentPlayer.color!);
            }
          }
        }

        return updatedRoom;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [room?.status]);

  // 超时判负处理
  const handleTimeout = useCallback((loserColor: StoneColor) => {
    socketService.resign(() => {});
  }, []);

  // 落子
  const handleMove = useCallback((position: Position) => {
    socketService.makeMove(position, (success, error) => {
      if (!success && error) {
        console.error('落子失败:', error);
      }
    });
  }, []);

  // Pass
  const handlePass = useCallback(() => {
    socketService.pass(() => {});
  }, []);

  // 认输
  const handleResign = useCallback(() => {
    if (confirm('确定要认输吗？')) {
      socketService.resign(() => {});
    }
  }, []);

  // 发送消息
  const handleSendMessage = useCallback((content: string) => {
    socketService.sendChatMessage(content, () => {});
  }, []);

  // 重新开始（复盘）
  const handleRestart = useCallback(() => {
    navigate(`/review/${password}`);
  }, [password, navigate]);

  // 返回大厅
  const handleLeave = useCallback(() => {
    if (room?.status === 'playing') {
      const confirmed = confirm(
        `对局正在进行中！\n\n您可以通过对局密码【${room.password}】再次进入对局室。\n\n确定要离开吗？`
      );
      if (!confirmed) return;
    }
    socketService.leaveRoom(() => {});
    localStorage.removeItem('currentRoom');
    localStorage.removeItem('currentPlayer');
    navigate('/');
  }, [navigate, room]);

  if (!room) {
    return <div className="game-loading">加载中...</div>;
  }

  const isMyTurn = player?.color === room.currentTurn && room.status === 'playing';
  const canPlay = player?.role !== 'spectator' && room.status === 'playing' && isMyTurn;

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-room-info">
          <h2 className="game-title">
            {room.players.host?.nickname || '等待中'}（黑） vs {room.players.guest?.nickname || '等待中'}（白）
          </h2>
          <span className="game-status">
            {room.status === 'playing' ? '对局中' : room.status === 'finished' ? '已结束' : '等待中'}
          </span>
        </div>
        <button className="leave-btn" onClick={handleLeave}>返回大厅</button>
      </div>

      <div className="game-main">
        <div className="game-left">
          <div className="game-info-panel">
            <div className="player-info">
              <div className="player-item black">
                <span className="player-label">黑方</span>
                <span className="player-nickname">{room.players.host?.nickname || '-'}</span>
                <span className="captured-count">提子: {capturedStones.black}</span>
              </div>
              <div className="player-item white">
                <span className="player-label">白方</span>
                <span className="player-nickname">{room.players.guest?.nickname || '-'}</span>
                <span className="captured-count">提子: {capturedStones.white}</span>
              </div>
            </div>

            <div className="game-controls">
              <button 
                className="control-btn"
                onClick={handlePass}
                disabled={!canPlay}
              >
                Pass
              </button>
              <button 
                className="control-btn resign"
                onClick={handleResign}
                disabled={!canPlay}
              >
                认输
              </button>
            </div>
          </div>

          <Board
            board={room.board}
            currentTurn={room.currentTurn}
            onMove={handleMove}
            disabled={!canPlay}
            koPosition={room.koPosition}
            lastMove={room.lastMove?.position || null}
            moves={room.moves}
            showMoveNumbers={true}
          />
        </div>

        <div className="game-right">
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            disabled={room.status === 'finished'}
            currentPlayerId={player?.id}
          />
        </div>
      </div>

      {showResult && room.status === 'finished' && (
        <div className="result-modal">
          <div className="result-content">
            <h3>对局结束</h3>
            <p className="result-text">{room.result}</p>
            <div className="result-buttons">
              <button className="result-btn" onClick={handleRestart}>复盘</button>
              <button className="result-btn" onClick={handleLeave}>返回大厅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
