// 棋盘组件
import React, { useState, useEffect, useCallback } from 'react';
import { StoneColor, Position, Move } from '../types';
import { validateMove } from '../game/engine';
import './Board.css';

// 棋盘格子大小
const CELL_SIZE = 32;
const BOARD_PADDING = 30;
const BOARD_SIZE = 19;

interface BoardProps {
  board: (StoneColor | null)[][];
  currentTurn: StoneColor;
  onMove: (position: Position) => void;
  disabled?: boolean;
  koPosition: Position | null;
  lastMove: Position | null;
  moves: Move[];
  showMoveNumbers?: boolean;
}

const Board: React.FC<BoardProps> = ({
  board,
  currentTurn,
  onMove,
  disabled = false,
  koPosition,
  lastMove,
  moves,
  showMoveNumbers = false,
}) => {
  // 鼠标悬停位置
  const [hoverPosition, setHoverPosition] = useState<Position | null>(null);
  
  // 计算棋盘尺寸
  const boardPixelSize = BOARD_PADDING * 2 + (BOARD_SIZE - 1) * CELL_SIZE;
  
  // 获取坐标
  const getPositionFromMouse = useCallback((e: React.MouseEvent<HTMLDivElement>): Position | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - BOARD_PADDING) / CELL_SIZE);
    const y = Math.round((e.clientY - rect.top - BOARD_PADDING) / CELL_SIZE);
    
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      return { x, y };
    }
    return null;
  }, []);

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const pos = getPositionFromMouse(e);
    setHoverPosition(pos);
  }, [disabled, getPositionFromMouse]);

  // 处理鼠标离开
  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  // 处理点击
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const pos = getPositionFromMouse(e);
    if (pos && board[pos.y][pos.x] === null) {
      // 检查是否有效落子
      const result = validateMove(board, pos.x, pos.y, currentTurn, koPosition);
      if (result.valid) {
        onMove(pos);
      }
    }
  }, [disabled, getPositionFromMouse, board, currentTurn, koPosition, onMove]);

  // 渲染星位（天元和星位）
  const starPoints = [
    { x: 3, y: 3 }, { x: 3, y: 9 }, { x: 3, y: 15 },
    { x: 9, y: 3 }, { x: 9, y: 9 }, { x: 9, y: 15 },
    { x: 15, y: 3 }, { x: 15, y: 9 }, { x: 15, y: 15 },
  ];

  // 获取棋谱序号
  const getMoveNumber = (x: number, y: number): number | null => {
    if (!showMoveNumbers) return null;
    const move = moves.find(m => m.position.x === x && m.position.y === y);
    return move?.moveNumber ?? null;
  };

  // 渲染格子
  const renderGrid = () => {
    const lines = [];
    
    // 横向线
    for (let i = 0; i < BOARD_SIZE; i++) {
      const y = BOARD_PADDING + i * CELL_SIZE;
      lines.push(
        <line key={`h-${i}`} x1={BOARD_PADDING} y1={y} x2={boardPixelSize - BOARD_PADDING} y2={y} />
      );
    }
    
    // 纵向线
    for (let i = 0; i < BOARD_SIZE; i++) {
      const x = BOARD_PADDING + i * CELL_SIZE;
      lines.push(
        <line key={`v-${i}`} x1={x} y1={BOARD_PADDING} x2={x} y2={boardPixelSize - BOARD_PADDING} />
      );
    }
    
    return lines;
  };

  // 渲染星位
  const renderStarPoints = () => {
    return starPoints.map((point, index) => (
      <circle
        key={`star-${index}`}
        cx={BOARD_PADDING + point.x * CELL_SIZE}
        cy={BOARD_PADDING + point.y * CELL_SIZE}
        r={4}
        className="star-point"
      />
    ));
  };

  // 渲染棋子
  const renderStones = () => {
    const stones = [];
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const color = board[y][x];
        if (color) {
          const cx = BOARD_PADDING + x * CELL_SIZE;
          const cy = BOARD_PADDING + y * CELL_SIZE;
          const moveNumber = getMoveNumber(x, y);
          const isLastMove = lastMove && lastMove.x === x && lastMove.y === y;
          
          stones.push(
            <circle
              key={`stone-${x}-${y}`}
              cx={cx}
              cy={cy}
              r={CELL_SIZE / 2 - 2}
              className={`stone ${color} ${isLastMove ? 'last-move' : ''}`}
            >
              {moveNumber && (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`move-number ${color}`}
                >
                  {moveNumber}
                </text>
              )}
            </circle>
          );
        }
      }
    }
    
    return stones;
  };

  // 渲染悬停预览
  const renderHoverPreview = () => {
    if (!hoverPosition || disabled) return null;
    
    const { x, y } = hoverPosition;
    if (board[y][x] !== null) return null;
    
    // 检查是否有效
    const result = validateMove(board, x, y, currentTurn, koPosition);
    const isValid = result.valid;
    
    return (
      <circle
        cx={BOARD_PADDING + x * CELL_SIZE}
        cy={BOARD_PADDING + y * CELL_SIZE}
        r={CELL_SIZE / 2 - 2}
        className={`stone-preview ${currentTurn} ${isValid ? 'valid' : 'invalid'}`}
      />
    );
  };

  // 渲染禁入点标记
  const renderInvalidMarkers = () => {
    if (disabled) return null;
    
    const markers = [];
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] === null) {
          const result = validateMove(board, x, y, currentTurn, koPosition);
          if (!result.valid) {
            markers.push(
              <circle
                key={`invalid-${x}-${y}`}
                cx={BOARD_PADDING + x * CELL_SIZE}
                cy={BOARD_PADDING + y * CELL_SIZE}
                r={6}
                className="invalid-marker"
              />
            );
          }
        }
      }
    }
    
    return markers;
  };

  return (
    <div 
      className="go-board"
      style={{ width: boardPixelSize, height: boardPixelSize }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <svg width={boardPixelSize} height={boardPixelSize}>
        {/* 木纹背景 */}
        <rect x={0} y={0} width={boardPixelSize} height={boardPixelSize} className="board-bg" />
        
        {/* 格子线 */}
        <g className="grid-lines">
          {renderGrid()}
        </g>
        
        {/* 星位 */}
        {renderStarPoints()}
        
        {/* 禁入点标记 */}
        {renderInvalidMarkers()}
        
        {/* 棋子 */}
        {renderStones()}
        
        {/* 悬停预览 */}
        {renderHoverPreview()}
      </svg>
    </div>
  );
};

export default Board;
