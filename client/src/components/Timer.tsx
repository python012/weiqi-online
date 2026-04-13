// 计时器组件
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player, StoneColor, GAME_CONFIG } from '../types';
import './Timer.css';

interface TimerProps {
  players: { host: Player | null; guest: Player | null };
  currentTurn: StoneColor;
  onTimeout: (loserColor: StoneColor) => void;
}

const Timer: React.FC<TimerProps> = ({ players, currentTurn, onTimeout }) => {
  // 格式化时间
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 计算显示时间（考虑读秒阶段）
  const getDisplayTime = (player: Player | null): { time: string; isByoyomi: boolean; byoyomiLeft: number } => {
    if (!player) return { time: '--:--', isByoyomi: false, byoyomiLeft: 0 };
    
    if (player.timeRemaining <= 0 && player.isInByoyomi) {
      // 在读秒阶段，显示剩余秒数
      return { 
        time: formatTime(player.timeRemaining), 
        isByoyomi: true, 
        byoyomiLeft: player.byoyomiCount 
      };
    } else if (player.isInByoyomi) {
      return { 
        time: formatTime(player.timeRemaining), 
        isByoyomi: true, 
        byoyomiLeft: player.byoyomiCount 
      };
    }
    
    return { time: formatTime(player.timeRemaining), isByoyomi: false, byoyomiLeft: player.byoyomiCount };
  };

  const hostInfo = getDisplayTime(players.host);
  const guestInfo = getDisplayTime(players.guest);

  return (
    <div className="timer-container">
      <div className={`timer-player ${currentTurn === 'black' ? 'active' : ''}`}>
        <div className="timer-label">黑方</div>
        <div className={`timer-time ${hostInfo.isByoyomi ? 'byoyomi' : ''}`}>
          {hostInfo.time}
        </div>
        {hostInfo.isByoyomi && (
          <div className="timer-byoyomi">
            读秒: {hostInfo.byoyomiLeft}/3
          </div>
        )}
      </div>
      
      <div className="timer-divider">VS</div>
      
      <div className={`timer-player ${currentTurn === 'white' ? 'active' : ''}`}>
        <div className="timer-label">白方</div>
        <div className={`timer-time ${guestInfo.isByoyomi ? 'byoyomi' : ''}`}>
          {guestInfo.time}
        </div>
        {guestInfo.isByoyomi && (
          <div className="timer-byoyomi">
            读秒: {guestInfo.byoyomiLeft}/3
          </div>
        )}
      </div>
    </div>
  );
};

export default Timer;
