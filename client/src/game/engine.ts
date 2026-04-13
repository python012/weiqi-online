// 围棋规则引擎 - 前端版本
import { StoneColor, Position, GAME_CONFIG } from '../types';

const BOARD_SIZE = GAME_CONFIG.BOARD_SIZE;

/**
 * 检查坐标是否在棋盘范围内
 */
export function isValidPosition(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/**
 * 获取棋子上所有相邻的同色棋子（连通块）
 */
function getConnectedGroup(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor,
  visited: boolean[][]
): Position[] {
  if (!isValidPosition(x, y)) return [];
  if (board[y][x] !== color) return [];
  if (visited[y][x]) return [];

  visited[y][x] = true;
  const group: Position[] = [{ x, y }];

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  for (const { dx, dy } of directions) {
    const nx = x + dx;
    const ny = y + dy;
    group.push(...getConnectedGroup(board, nx, ny, color, visited));
  }

  return group;
}

/**
 * 计算棋子块的气数
 */
export function getLiberties(
  board: (StoneColor | null)[][],
  x: number,
  y: number
): number {
  const color = board[y][x];
  if (color === null) return 0;

  const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
  const group = getConnectedGroup(board, x, y, color, visited);

  const liberties = new Set<string>();
  for (const pos of group) {
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (const { dx, dy } of directions) {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (isValidPosition(nx, ny) && board[ny][nx] === null) {
        liberties.add(`${nx},${ny}`);
      }
    }
  }

  return liberties.size;
}

/**
 * 提子
 */
function captureStones(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor
): Position[] {
  const opponentColor: StoneColor = color === 'black' ? 'white' : 'black';
  const capturedStones: Position[] = [];

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  for (const { dx, dy } of directions) {
    const nx = x + dx;
    const ny = y + dy;

    if (isValidPosition(nx, ny) && board[ny][nx] === opponentColor) {
      const liberties = getLiberties(board, nx, ny);
      if (liberties === 0) {
        const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
        const group = getConnectedGroup(board, nx, ny, opponentColor, visited);
        for (const pos of group) {
          if (!capturedStones.some(s => s.x === pos.x && s.y === pos.y)) {
            capturedStones.push(pos);
          }
        }
      }
    }
  }

  for (const pos of capturedStones) {
    board[pos.y][pos.x] = null;
  }

  return capturedStones;
}

/**
 * 检查是否可以落子
 */
export function validateMove(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor,
  koPosition: Position | null
): { valid: boolean; error?: string } {
  if (!isValidPosition(x, y)) {
    return { valid: false, error: '无效的位置' };
  }

  if (board[y][x] !== null) {
    return { valid: false, error: '该位置已有棋子' };
  }

  if (koPosition && koPosition.x === x && koPosition.y === y) {
    return { valid: false, error: '打劫规则：不能立即回提' };
  }

  const testBoard = board.map(row => [...row]);
  testBoard[y][x] = color;

  const captured = captureStones(testBoard, x, y, color);

  if (captured.length === 0) {
    const liberties = getLiberties(testBoard, x, y);
    if (liberties === 0) {
      return { valid: false, error: '禁止自杀：该位置无气' };
    }
  }

  return { valid: true };
}

/**
 * 执行落子（返回新的棋盘副本）
 */
export function makeMove(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor
): { newBoard: (StoneColor | null)[][]; capturedStones: Position[] } {
  const newBoard = board.map(row => [...row]);
  newBoard[y][x] = color;
  const captured = captureStones(newBoard, x, y, color);
  return { newBoard, capturedStones: captured };
}

/**
 * 获取棋盘上所有无气点（禁入点）
 */
export function getInvalidPositions(board: (StoneColor | null)[][], currentTurn: StoneColor, koPosition: Position | null): Position[] {
  const invalidPositions: Position[] = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        const result = validateMove(board, x, y, currentTurn, koPosition);
        if (!result.valid) {
          invalidPositions.push({ x, y });
        }
      }
    }
  }

  return invalidPositions;
}
