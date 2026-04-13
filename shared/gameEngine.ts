// 围棋规则引擎 - 前后端共享
import { StoneColor, Position, Move, GAME_CONFIG } from '../shared';

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

  // 检查四个方向
  const directions = [
    { dx: 0, dy: -1 }, // 上
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
    { dx: 1, dy: 0 }   // 右
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
 * 气是指与棋子块相邻的空位（交叉点）
 */
export function getLiberties(
  board: (StoneColor | null)[][],
  x: number,
  y: number
): number {
  const color = board[y][x];
  if (color === null) return 0;

  // 获取整个连通块
  const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
  const group = getConnectedGroup(board, x, y, color, visited);

  // 统计气数
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
 * 获取某个位置周围的同色棋子块
 */
function getAdjacentGroup(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor
): Position[] {
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  const group: Position[] = [];
  const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));

  for (const { dx, dy } of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (isValidPosition(nx, ny) && board[ny][nx] === color && !visited[ny][nx]) {
      group.push(...getConnectedGroup(board, nx, ny, color, visited));
    }
  }

  return group;
}

/**
 * 执行提子操作
 * 返回被提掉的棋子位置数组
 */
export function captureStones(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor
): Position[] {
  const opponentColor: StoneColor = color === 'black' ? 'white' : 'black';
  const capturedStones: Position[] = [];

  // 检查四个方向是否有对方棋子块无气
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
        // 该棋子块无气，需要提掉
        const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
        const group = getConnectedGroup(board, nx, ny, opponentColor, visited);
        for (const pos of group) {
          // 检查是否已添加，避免重复
          if (!capturedStones.some(s => s.x === pos.x && s.y === pos.y)) {
            capturedStones.push(pos);
          }
        }
      }
    }
  }

  // 执行提子
  for (const pos of capturedStones) {
    board[pos.y][pos.x] = null;
  }

  return capturedStones;
}

/**
 * 检查是否可以落子（包含规则检查）
 * 返回 { valid: boolean, error?: string }
 */
export function validateMove(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor,
  koPosition: Position | null
): { valid: boolean; error?: string } {
  // 检查位置有效性
  if (!isValidPosition(x, y)) {
    return { valid: false, error: '无效的位置' };
  }

  // 检查是否已有棋子
  if (board[y][x] !== null) {
    return { valid: false, error: '该位置已有棋子' };
  }

  // 检查打劫（不能立即回提）
  if (koPosition && koPosition.x === x && koPosition.y === y) {
    return { valid: false, error: '打劫规则：不能立即回提' };
  }

  // 模拟落子并检查是否自杀
  const testBoard = board.map(row => [...row]);
  testBoard[y][x] = color;

  // 检查周围对手棋子是否被提掉
  const captured = captureStones(testBoard, x, y, color);

  // 如果没有提子，检查是否自杀（无气）
  if (captured.length === 0) {
    const liberties = getLiberties(testBoard, x, y);
    if (liberties === 0) {
      return { valid: false, error: '禁止自杀：该位置无气' };
    }
  }

  return { valid: true };
}

/**
 * 执行落子
 * 返回被提掉的棋子数组
 */
export function makeMove(
  board: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor
): Position[] {
  board[y][x] = color;
  const captured = captureStones(board, x, y, color);
  return captured;
}

/**
 * 计算胜负（中国规则数子法）
 * 注意：这是一个简化的实现
 */
export function calculateScore(board: (StoneColor | null)[][]): {
  black: number;
  white: number;
  winner: StoneColor | 'draw';
} {
  const territory = Array(BOARD_SIZE).fill(null).map(() => Array<StoneColor | 'dame' | null>(BOARD_SIZE).fill(null));

  // 第一步：标记所有棋子
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) {
        territory[y][x] = board[y][x];
      }
    }
  }

  // 第二步：计算每块棋子的气并归属
  const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));

  function floodFill(x: number, y: number, color: StoneColor | 'dame') {
    if (!isValidPosition(x, y)) return;
    if (visited[y][x]) return;
    if (territory[y][x] !== null) return;

    visited[y][x] = true;
    territory[y][x] = color;

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (const { dx, dy } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (isValidPosition(nx, ny)) {
        if (board[ny][nx] === null) {
          // 空位，递归填充
          floodFill(nx, ny, color);
        } else if (board[ny][nx] !== color && territory[ny][nx] === null) {
          // 异色棋子，转换为dame
          floodFill(nx, ny, 'dame');
        }
      }
    }
  }

  // 对所有空位进行泛洪填充
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null && !visited[y][x]) {
        floodFill(x, y, 'dame');
      }
    }
  }

  // 第三步：统计领地
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let blackStones = 0;
  let whiteStones = 0;

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (territory[y][x] === 'black') {
        blackTerritory++;
      } else if (territory[y][x] === 'white') {
        whiteTerritory++;
      }

      if (board[y][x] === 'black') {
        blackStones++;
      } else if (board[y][x] === 'white') {
        whiteStones++;
      }
    }
  }

  // 中国规则：黑先，有贴目
  const KOMI = 3.75; // 贴目
  const blackTotal = blackStones + blackTerritory;
  const whiteTotal = whiteStones + whiteTerritory + KOMI;

  let winner: StoneColor | 'draw';
  if (blackTotal > whiteTotal) {
    winner = 'black';
  } else if (whiteTotal > blackTotal) {
    winner = 'white';
  } else {
    winner = 'draw';
  }

  return {
    black: blackTotal,
    white: whiteTotal,
    winner
  };
}
