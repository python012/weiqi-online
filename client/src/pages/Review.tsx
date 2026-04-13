// 复盘页面
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Room, Move, StoneColor } from '../types';
import Board from '../components/Board';
import './Review.css';

const Review: React.FC = () => {
  const { password } = useParams<{ password: string }>();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [board, setBoard] = useState<(StoneColor | null)[][]>([]);

  // 加载对局数据
  useEffect(() => {
    const savedRoom = localStorage.getItem('currentRoom');
    if (savedRoom) {
      const r = JSON.parse(savedRoom);
      setRoom(r);
      // 初始棋盘为空
      setBoard(createEmptyBoard());
    }
  }, []);

  // 创建空棋盘
  const createEmptyBoard = () => {
    return Array(19).fill(null).map(() => Array(19).fill(null));
  };

  // 更新棋盘到指定步数
  useEffect(() => {
    if (!room) return;

    const newBoard = createEmptyBoard();
    
    // 重放所有步数到当前位置
    for (let i = 0; i <= currentStep && i < room.moves.length; i++) {
      const move = room.moves[i];
      if (move.position.x >= 0 && move.position.y >= 0) {
        newBoard[move.position.y][move.position.x] = move.color;
        
        // 提子
        if (move.capturedStones) {
          for (const stone of move.capturedStones) {
            newBoard[stone.y][stone.x] = null;
          }
        }
      }
    }

    setBoard(newBoard);
  }, [currentStep, room]);

  // 处理落子（用于重新开始对局）
  const handleMove = useCallback((position: { x: number; y: number }) => {
    // 复盘模式下不处理落子
  }, []);

  // 前进
  const handleNext = useCallback(() => {
    if (room && currentStep < room.moves.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, room]);

  // 后退
  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // 跳到开始
  const handleFirst = useCallback(() => {
    setCurrentStep(0);
  }, []);

  // 跳到末尾
  const handleLast = useCallback(() => {
    if (room) {
      setCurrentStep(room.moves.length - 1);
    }
  }, [room]);

  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  if (!room) {
    return <div className="review-loading">加载中...</div>;
  }

  const currentMove = room.moves[currentStep];

  return (
    <div className="review-container">
      <div className="review-header">
        <div className="review-title">
          <h2>{room.name} - 复盘</h2>
        </div>
        <button className="review-leave-btn" onClick={() => navigate('/')}>
          返回大厅
        </button>
      </div>

      <div className="review-main">
        <div className="review-left">
          <Board
            board={board}
            currentTurn={currentMove?.color || 'black'}
            onMove={handleMove}
            disabled={true}
            koPosition={null}
            lastMove={currentMove?.position || null}
            moves={room.moves.slice(0, currentStep + 1)}
            showMoveNumbers={true}
          />

          <div className="review-controls">
            <button className="review-btn" onClick={handleFirst} disabled={currentStep === 0}>
              首步
            </button>
            <button className="review-btn" onClick={handlePrev} disabled={currentStep === 0}>
              上一步
            </button>
            <span className="step-info">
              {currentStep + 1} / {room.moves.length}
            </span>
            <button className="review-btn" onClick={handleNext} disabled={currentStep >= room.moves.length - 1}>
              下一步
            </button>
            <button className="review-btn" onClick={handleLast} disabled={currentStep >= room.moves.length - 1}>
              末步
            </button>
          </div>
        </div>

        <div className="review-right">
          <div className="move-list">
            <h3>棋谱</h3>
            <div className="move-items">
              {room.moves.map((move, index) => (
                <div 
                  key={index}
                  className={`move-item ${index === currentStep ? 'active' : ''}`}
                  onClick={() => setCurrentStep(index)}
                >
                  <span className="move-number">{move.moveNumber}</span>
                  <span className="move-color">{move.color === 'black' ? '黑' : '白'}</span>
                  <span className="move-position">
                    {move.position.x >= 0 
                      ? `${String.fromCharCode(65 + move.position.x)}${move.position.y + 1}`
                      : 'Pass'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Review;
