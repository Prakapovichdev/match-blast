// assets/scripts/app/controllers/MegaBombController.ts

import BoardModel from '../../domain/BoardModel';
import { TilePos, TileColor } from '../../shared/types';
import { debugLog } from '../../debug/Debug';

export interface MegaBombCreationResult {
  created: boolean;
  center?: TilePos;
  /** Cells that should be removed from the board (excluding the center). */
  removedCells: TilePos[];
}

export interface MegaBombExplosionResult {
  /** Cells that were removed by explosion. */
  removedCells: TilePos[];
  /** Total number of tiles on the board at the moment of explosion. */
  totalTiles: number;
}

/**
 * Handles creation and explosion of a "mega bomb" tile.
 * - can convert a large group into a mega bomb at its center
 * - knows how to detect and explode existing mega bombs
 */
export default class MegaBombController {
  private board: BoardModel | null = null;
  private readonly minGroupSize: number;

  constructor(board: BoardModel | null, minGroupSize: number) {
    this.board = board;
    this.minGroupSize = minGroupSize;
  }

  public setBoard(board: BoardModel | null) {
    this.board = board;
  }

  /** Check if a group of given size can become a mega bomb. */
  public canCreateFromSize(size: number): boolean {
    return size >= this.minGroupSize;
  }

  /** Check if a given cell is already a mega bomb. */
  public isMegaBomb(row: number, col: number): boolean {
    if (!this.board) return false;
    return this.board.grid[row][col] === TileColor.MegaBomb;
  }

  /**
   * Turn a group into a mega bomb at the given center:
   * - all cells except `center` are removed
   * - center tile becomes `TileColor.MegaBomb`
   */
  public createFromGroup(
    group: TilePos[],
    center: TilePos
  ): MegaBombCreationResult {
    if (!this.board) {
      return { created: false, removedCells: [] };
    }

    const size = group.length;
    if (size < this.minGroupSize) {
      return { created: false, removedCells: [] };
    }

    const withoutCenter = group.filter(
      (p) => !(p.row === center.row && p.col === center.col)
    );

    this.board.removeGroup(withoutCenter);

    // mark center cell as mega bomb
    (this.board.grid as any)[center.row][center.col] = TileColor.MegaBomb;

    debugLog(
      'MegaBombController',
      `Create MegaBomb at (${center.row},${center.col}), groupSize=${size}`
    );

    return {
      created: true,
      center,
      removedCells: withoutCenter,
    };
  }

  /**
   * Explode a mega bomb:
   * - collects all non-empty cells
   * - removes them from the board
   */
  public explode(row: number, col: number): MegaBombExplosionResult | null {
    if (!this.board) return null;
    if (this.board.grid[row][col] !== TileColor.MegaBomb) {
      debugLog(
        'MegaBombController',
        `explode: cell (${row},${col}) is not MegaBomb`
      );
      return null;
    }

    const removed: TilePos[] = [];
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        if (this.board.grid[r][c] != null) {
          removed.push({ row: r, col: c });
        }
      }
    }

    const totalTiles = removed.length;
    if (totalTiles === 0) {
      debugLog('MegaBombController', 'explode: board already empty');
      return null;
    }

    this.board.removeGroup(removed);

    debugLog(
      'MegaBombController',
      `explode: tiles=${totalTiles} (MegaBomb at ${row},${col})`
    );

    return { removedCells: removed, totalTiles };
  }
}
