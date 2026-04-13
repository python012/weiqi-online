// 主页 - 创建/加入房间
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketService } from '../services/socket';
import { Room, Player } from '../types';
import './Home.css';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 连接Socket服务
    socketService.connect();

    return () => {
      // 清理连接
    };
  }, []);

  // 创建房间
  const handleCreate = () => {
    if (!roomName.trim()) {
      setError('请输入房间名称');
      return;
    }

    setLoading(true);
    setError('');

    socketService.createRoom(roomName.trim(), (room: Room) => {
      // 存储房间信息和房主玩家信息
      localStorage.setItem('currentRoom', JSON.stringify(room));
      // 房主信息存储到 currentPlayer，确保后续页面能识别身份
      if (room.players.host) {
        localStorage.setItem('currentPlayer', JSON.stringify(room.players.host));
      }
      navigate(`/room/${room.password}`);
    });
  };

  // 加入房间
  const handleJoin = () => {
    if (!password.trim()) {
      setError('请输入房间密码');
      return;
    }

    setLoading(true);
    setError('');

    socketService.joinRoom(password.trim().toUpperCase(), (room, player, error) => {
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      if (room && player) {
        localStorage.setItem('currentRoom', JSON.stringify(room));
        localStorage.setItem('currentPlayer', JSON.stringify(player));
        navigate(`/room/${room.password}`);
      }
    });
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="home-title">围棋在线对弈</h1>
        
        <div className="home-tabs">
          <button 
            className={`home-tab ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >
            创建房间
          </button>
          <button 
            className={`home-tab ${mode === 'join' ? 'active' : ''}`}
            onClick={() => setMode('join')}
          >
            加入房间
          </button>
        </div>

        <div className="home-form">
          {mode === 'create' ? (
            <div className="form-group">
              <label className="form-label">房间名称</label>
              <input
                type="text"
                className="form-input"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="输入房间名称"
                maxLength={20}
              />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">房间密码</label>
              <input
                type="text"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value.toUpperCase())}
                placeholder="输入5位房间密码"
                maxLength={5}
              />
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <button 
            className="home-btn"
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
          >
            {loading ? '处理中...' : mode === 'create' ? '创建房间' : '加入房间'}
          </button>
        </div>

        <div className="home-footer">
          <p>打开主页 → 创建房间 → 复制密码 → 发送给朋友</p>
          <p>朋友输入密码 → 双方确认开始 → 开始对局</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
