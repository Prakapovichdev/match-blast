import { TilePos } from '../../shared/types';
import BoardModel from '../../domain/BoardModel';
import { GameConfig } from '../AppConfig';

/**
 * Bomb logic controller:
 * - tracks whether bomb mode is active
 * - on click, returns affected cells in a square radius
 * - does NOT remove tiles itself, only calculates positions
 */
export default class BombController {
  private board: BoardModel | null;
  private active = false;
  private radius: number;

  constructor(
    board: BoardModel | null,
    radius: number = GameConfig.bombRadius
  ) {
    this.board = board;
    this.radius = radius;
  }

  /** Update board reference (on game start / restart). */
  public setBoard(board: BoardModel | null) {
    this.board = board;
    this.active = false;
  }

  /** Change bomb radius (for different bomb types, if needed). */
  public setRadius(radius: number) {
    this.radius = radius;
  }

  public getRadius(): number {
    return this.radius;
  }

  public reset() {
    this.active = false;
  }

  public toggle() {
    this.active = !this.active;
  }

  public isActive(): boolean {
    return this.active;
  }

  /**
   * Handle a click on the bomb center.
   * Returns a list of cells to be removed.
   * Bomb mode is turned off after a click (one bomb — one explosion).
   */
  public handleClick(row: number, col: number): TilePos[] {
    if (!this.active || !this.board) return [];

    // one bomb — one explosion
    this.active = false;

    const cells: TilePos[] = [];
    const rows = this.board.rows;
    const cols = this.board.cols;
    const r0 = row;
    const c0 = col;
    const R = this.radius;

    // square radius R around (r0, c0)
    for (let r = r0 - R; r <= r0 + R; r++) {
      for (let c = c0 - R; c <= c0 + R; c++) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        if (this.board.grid[r][c] === null) continue;
        cells.push({ row: r, col: c });
      }
    }

    return cells;
  }
}
