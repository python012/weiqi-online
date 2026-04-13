// 等待房间页面
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socket';
import { Room, Player } from '../types';
import './WaitingRoom.css';

const WaitingRoom: React.FC = () => {
  const { password } = useParams<{ password: string }>();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!password) {
      navigate('/');
      return;
    }

    // 获取存储的房间信息
    const savedRoom = localStorage.getItem('currentRoom');
    const savedPlayer = localStorage.getItem('currentPlayer');
    
    if (savedRoom) {
      setRoom(JSON.parse(savedRoom));
    }
    if (savedPlayer) {
      setPlayer(JSON.parse(savedPlayer));
    }

    // 监听房间更新
    const handleRoomUpdated = (updatedRoom: Room) => {
      setRoom(updatedRoom);
      localStorage.setItem('currentRoom', JSON.stringify(updatedRoom));
    };

    const handlePlayerJoined = (newPlayer: Player) => {
      // 更新本地玩家信息
      const savedPlayer = localStorage.getItem('currentPlayer');
      if (savedPlayer) {
        const currentPlayer = JSON.parse(savedPlayer);
        if (!currentPlayer.color && newPlayer.color) {
          currentPlayer.color = newPlayer.color;
          currentPlayer.role = newPlayer.role;
          localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
          setPlayer(currentPlayer);
        }
      }
    };

    const handleGameStart = (startedRoom: Room) => {
      localStorage.setItem('currentRoom', JSON.stringify(startedRoom));
      navigate(`/game/${password}`);
    };

    socketService.onRoomUpdated(handleRoomUpdated);
    socketService.onPlayerJoined(handlePlayerJoined);
    socketService.onGameStart(handleGameStart);

    return () => {
      socketService.offRoomUpdated(handleRoomUpdated);
      socketService.offPlayerJoined(handlePlayerJoined);
      socketService.offGameStart(handleGameStart);
    };
  }, [password, navigate]);

  // 复制密码
  const copyPassword = async () => {
    if (room?.password) {
      await navigator.clipboard.writeText(room.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 确认开始
  const handleReady = () => {
    socketService.setReady(() => {});
  };

  if (!room) {
    return (
      <div className="waiting-container">
        <div className="waiting-loading">加载中...</div>
      </div>
    );
  }

  const isHost = player?.role === 'host';
  const isGuest = player?.role === 'guest';
  const myPlayer = isHost ? room.players.host : room.players.guest;
  const opponent = isHost ? room.players.guest : room.players.host;

  return (
    <div className="waiting-container">
      <div className="waiting-card">
        <h2 className="waiting-title">{room.name}</h2>
        
        <div className="waiting-password">
          <span className="password-label">房间密码：</span>
          <span className="password-value">{room.password}</span>
          <button className="copy-btn" onClick={copyPassword}>
            {copied ? '已复制!' : '复制'}
          </button>
        </div>

        <div className="waiting-info">
          <p>将房间密码发送给好友，好友输入密码即可加入</p>
        </div>

        {/* 当前用户昵称和执棋颜色提示 */}
        {player && (
          <div className="my-info-banner">
            您的昵称是【{player.nickname}】，本次对局由您执{player.color === 'black' ? '黑先行' : '白后行'}
          </div>
        )}

        <div className="players-status">
          <div className={`player-slot ${isHost ? 'black' : 'white'} ${myPlayer?.isReady ? 'ready' : ''}`}>
            <div className="player-color">{isHost ? '黑方' : '白方'}</div>
            <div className="player-name">{myPlayer?.nickname || '等待加入...'}</div>
            <div className="player-status">
              {myPlayer?.isReady ? '已确认' : '等待确认'}
            </div>
          </div>

          <div className="vs-divider">VS</div>

          <div className={`player-slot ${isHost ? 'white' : 'black'} ${opponent?.isReady ? 'ready' : ''}`}>
            <div className="player-color">{isHost ? '白方' : '黑方'}</div>
            <div className="player-name">{opponent?.nickname || '等待加入...'}</div>
            <div className="player-status">
              {opponent ? (opponent.isReady ? '已确认' : '等待确认') : '等待加入'}
            </div>
          </div>
        </div>

        {room.status === 'waiting' && (
          <button 
            className={`ready-btn ${myPlayer?.isReady ? 'ready' : ''}`}
            onClick={handleReady}
            disabled={!opponent}
          >
            {myPlayer?.isReady ? '已确认' : '确认开始对局'}
          </button>
        )}

        {opponent && !myPlayer?.isReady && (
          <p className="waiting-hint">等待双方确认后开始对局</p>
        )}

        {opponent && myPlayer?.isReady && !opponent.isReady && (
          <p className="waiting-hint">等待对方确认...</p>
        )}

        {room.status === 'playing' && (
          <p className="game-started">对局即将开始...</p>
        )}
      </div>
    </div>
  );
};

export default WaitingRoom;
