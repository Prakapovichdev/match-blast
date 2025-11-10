// assets/scripts/domain/BoardModel.ts

import { debugLog } from '../debug/Debug';
import {
  TileColor,
  TILE_COLORS,
  TileGrid,
  TilePos,
  TileSpecial,
} from '../shared/types';

export interface GravityMovement {
  from: TilePos;
  to: TilePos;
  color: TileColor;
}

export interface RefillInfo {
  pos: TilePos;
  color: TileColor;
}

/**
 * Pure board model:
 * - stores tile colors and special flags
 * - knows how to find groups, apply gravity, refill and swap tiles
 * - does NOT know anything about visuals or animations
 */
export default class BoardModel {
  readonly rows: number;
  readonly cols: number;
  readonly availableColors: TileColor[];

  /** Main color grid: grid[row][col] = TileColor | null. */
  grid: TileGrid = [];

  /**
   * Parallel grid for special tiles (same geometry as `grid`).
   * TileSpecial.None – regular tile, other values for special ones (mega bomb, etc.).
   */
  specialGrid: TileSpecial[][] = [];

  constructor(rows: number, cols: number, colors: TileColor[]) {
    this.rows = rows;
    this.cols = cols;
    this.availableColors =
      colors && colors.length ? colors.slice() : TILE_COLORS.slice();

    debugLog(
      'BoardModel',
      `ctor rows=${rows}, cols=${cols}, colors=${this.availableColors.length}`
    );
  }

  // === INITIAL GENERATION ===

  /** Fill the board with random colors from availableColors. */
  randomFill() {
    this.grid = [];
    this.specialGrid = [];

    for (let row = 0; row < this.rows; row++) {
      const rowArr: (TileColor | null)[] = [];
      const specialRow: TileSpecial[] = [];

      for (let col = 0; col < this.cols; col++) {
        const idx = Math.floor(Math.random() * this.availableColors.length);
        rowArr.push(this.availableColors[idx]);
        // by default all tiles are regular
        specialRow.push(TileSpecial.None);
      }

      this.grid.push(rowArr as TileColor[]);
      this.specialGrid.push(specialRow);
    }
  }

  // === INTERNAL UTILS ===

  private inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  // === SPECIAL TILE ACCESS ===

  public getSpecial(row: number, col: number): TileSpecial {
    if (!this.inBounds(row, col)) return TileSpecial.None;
    return this.specialGrid[row][col];
  }

  public setSpecial(row: number, col: number, special: TileSpecial) {
    if (!this.inBounds(row, col)) return;
    this.specialGrid[row][col] = special;
  }

  public isMegaBomb(row: number, col: number): boolean {
    return this.getSpecial(row, col) === TileSpecial.MegaBomb;
  }

  // === GROUP SEARCH (4-NEIGHBOR) ===

  public findGroup(startRow: number, startCol: number): TilePos[] {
    if (!this.inBounds(startRow, startCol)) {
      return [];
    }

    const startColor = this.grid[startRow][startCol];
    if (!startColor) {
      // clicked an empty cell
      debugLog(
        'BoardModel',
        `findGroup from (${startRow},${startCol}) -> empty cell`
      );
      return [];
    }

    const visited: boolean[][] = [];
    for (let r = 0; r < this.rows; r++) {
      visited[r] = [];
      for (let c = 0; c < this.cols; c++) {
        visited[r][c] = false;
      }
    }

    const stack: TilePos[] = [{ row: startRow, col: startCol }];
    const group: TilePos[] = [];

    while (stack.length > 0) {
      const { row, col } = stack.pop()!;
      if (!this.inBounds(row, col)) continue;
      if (visited[row][col]) continue;

      visited[row][col] = true;

      const color = this.grid[row][col];
      if (color !== startColor) continue;

      group.push({ row, col });

      // 4-neighbors
      stack.push({ row: row - 1, col }); // up
      stack.push({ row: row + 1, col }); // down
      stack.push({ row, col: col - 1 }); // left
      stack.push({ row, col: col + 1 }); // right
    }

    debugLog(
      'BoardModel',
      `findGroup from (${startRow},${startCol}) color=${startColor} size=${group.length}`
    );
    return group;
  }

  // === GROUP REMOVAL ===

  public removeGroup(group: TilePos[]) {
    if (!group || group.length === 0) return;

    debugLog('BoardModel', `removeGroup size=${group.length}`);

    const g = this.grid as (TileColor | null)[][];
    const s = this.specialGrid;

    for (const { row, col } of group) {
      if (!this.inBounds(row, col)) continue;
      g[row][col] = null;
      s[row][col] = TileSpecial.None;
    }
  }

  // === GRAVITY (DOWN) ===

  /**
   * Apply gravity: all non-empty tiles "fall" down in their columns.
   * Returns a list of movements that can be used for animations.
   */
  public applyGravity(): GravityMovement[] {
    debugLog('BoardModel', 'applyGravity');

    const g = this.grid as (TileColor | null)[][];
    const s = this.specialGrid;
    const movements: GravityMovement[] = [];

    for (let col = 0; col < this.cols; col++) {
      let writeRow = this.rows - 1;

      // walk bottom-up, compact non-empty cells
      for (let row = this.rows - 1; row >= 0; row--) {
        const color = g[row][col];
        if (color !== null) {
          if (writeRow !== row) {
            const spec = s[row][col];

            g[writeRow][col] = color;
            g[row][col] = null;

            s[writeRow][col] = spec;
            s[row][col] = TileSpecial.None;

            movements.push({
              from: { row, col },
              to: { row: writeRow, col },
              color,
            });
          }
          writeRow--;
        }
      }

      // everything above writeRow becomes empty (null + no special)
      for (let row = writeRow; row >= 0; row--) {
        g[row][col] = null;
        s[row][col] = TileSpecial.None;
      }
    }

    return movements;
  }

  // === REFILL EMPTY CELLS ===

  /**
   * Fill empty cells with new random tiles.
   * Returns list of created tiles (position + color) for animations.
   */
  public refillEmptyCells(): RefillInfo[] {
    debugLog('BoardModel', 'refillEmptyCells');

    const g = this.grid as (TileColor | null)[][];
    const s = this.specialGrid;
    const refilled: RefillInfo[] = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (g[row][col] === null) {
          const idx = Math.floor(Math.random() * this.availableColors.length);
          const color = this.availableColors[idx];
          g[row][col] = color;
          s[row][col] = TileSpecial.None;

          refilled.push({
            pos: { row, col },
            color,
          });
        }
      }
    }

    return refilled;
  }

  // === MOVE AVAILABILITY CHECK ===

  /**
   * Check if there is at least one valid move:
   * for minGroupSize >= 2 we only need to check adjacent equal tiles.
   */
  public hasAnyMoves(minGroupSize: number): boolean {
    // for minGroupSize = 1 board is always "playable"
    if (minGroupSize <= 1) return true;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const color = this.grid[row][col];
        if (!color) continue;

        // down
        if (this.inBounds(row + 1, col) && this.grid[row + 1][col] === color) {
          return true;
        }

        // right
        if (this.inBounds(row, col + 1) && this.grid[row][col + 1] === color) {
          return true;
        }
      }
    }

    return false;
  }

  // === TILE SWAP (TELEPORT BOOSTER) ===

  public swapTiles(a: TilePos, b: TilePos) {
    if (!this.inBounds(a.row, a.col) || !this.inBounds(b.row, b.col)) return;

    const g = this.grid as (TileColor | null)[][];
    const s = this.specialGrid;

    const tmp = g[a.row][a.col];
    g[a.row][a.col] = g[b.row][b.col];
    g[b.row][b.col] = tmp;

    const tmpSpec = s[a.row][a.col];
    s[a.row][a.col] = s[b.row][b.col];
    s[b.row][b.col] = tmpSpec;
  }

  // === FULL CLEAR (MEGA BOMB) ===

  /**
   * Clear all non-empty tiles on the board.
   * Returns positions of all removed tiles (for animations/score).
   */
  public clearAllTiles(): TilePos[] {
    const g = this.grid as (TileColor | null)[][];
    const s = this.specialGrid;
    const removed: TilePos[] = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (g[row][col] !== null) {
          removed.push({ row, col });
          g[row][col] = null;
          s[row][col] = TileSpecial.None;
        }
      }
    }

    return removed;
  }

  /**
   * Count how many non-empty tiles are currently on the board.
   * Useful to award score for "clear the whole board" effects.
   */
  public countNonEmptyTiles(): number {
    let count = 0;
    const g = this.grid as (TileColor | null)[][];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (g[row][col] !== null) count++;
      }
    }

    return count;
  }
}
