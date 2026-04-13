// 主页 - 创建/加入房间
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { realtimeService, supabase } from '../services/supabase';
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
    // 连接实时服务
    realtimeService.connect();

    return () => {
      realtimeService.disconnect();
    };
  }, []);

  // 创建房间
  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError('请输入房间名称');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const room = await realtimeService.createRoom(roomName.trim());
      localStorage.setItem('currentRoom', JSON.stringify(room));
      if (room.players.host) {
        localStorage.setItem('currentPlayer', JSON.stringify(room.players.host));
      }
      navigate(`/room/${room.password}`);
    } catch (err: any) {
      setError(err.message || '创建房间失败');
      setLoading(false);
    }
  };

  // 加入房间
  const handleJoin = async () => {
    if (!password.trim()) {
      setError('请输入房间密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { room, player } = await realtimeService.joinRoom(password.trim().toUpperCase());
      localStorage.setItem('currentRoom', JSON.stringify(room));
      localStorage.setItem('currentPlayer', JSON.stringify(player));
      navigate(`/room/${room.password}`);
    } catch (err: any) {
      setError(err.message || '加入房间失败');
      setLoading(false);
    }
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
