// assets/scripts/app/controllers/TeleportController.ts

import { TileClickPayload, TilePos } from '../../shared/types';
import BoardModel from '../../domain/BoardModel';
import { debugLog } from '../../debug/Debug';

/**
 * Result of handling a click in teleport mode.
 * GameController uses this to update selection visuals and trigger board redraws.
 */
export type TeleportClickResult =
  | { type: 'select'; pos: TilePos }
  | { type: 'deselect'; pos: TilePos }
  | { type: 'reselect'; from: TilePos; to: TilePos }
  | { type: 'swap'; from: TilePos; to: TilePos };

/**
 * Teleport controller:
 * - tracks teleport mode state and selected tile
 * - validates neighbor clicks
 * - performs tile swap in the BoardModel
 */
export default class TeleportController {
  private boardModel: BoardModel | null = null;

  private active = false;
  private first: TilePos | null = null;

  constructor(boardModel: BoardModel | null) {
    this.boardModel = boardModel;
  }

  /** Update board reference (on game start / restart). */
  public setBoard(boardModel: BoardModel) {
    this.boardModel = boardModel;
    this.reset();
  }

  public isActive(): boolean {
    return this.active;
  }

  /** Toggle teleport mode. Returns the new state. */
  public toggle(): boolean {
    this.active = !this.active;
    this.resetSelection();
    debugLog('TeleportController', `Teleport mode = ${this.active}`);
    return this.active;
  }

  /** Clear currently selected tile, but keep mode active. */
  public resetSelection() {
    this.first = null;
  }

  /** Full reset of teleport state (mode + selection). */
  public reset() {
    this.resetSelection();
    this.active = false;
  }

  /**
   * Handle a click on a tile while teleport mode is active.
   *
   * Returns:
   * - `select`   — first tile selected
   * - `deselect` — clicked the same tile again, selection cleared
   * - `reselect` — selection moved to another non-neighbor tile
   * - `swap`     — neighbor tile clicked, tiles swapped in BoardModel
   *
   * If nothing meaningful happens, returns null.
   */
  public handleClick(payload: TileClickPayload): TeleportClickResult | null {
    if (!this.active) return null;
    if (!this.boardModel) return null;

    const pos: TilePos = { row: payload.row, col: payload.col };

    // 1) No tile selected yet — select the first one
    if (!this.first) {
      this.first = pos;
      return { type: 'select', pos };
    }

    // 2) Clicked the same tile — deselect
    if (this.first.row === pos.row && this.first.col === pos.col) {
      const prev = this.first;
      this.first = null;
      return { type: 'deselect', pos: prev };
    }

    // 3) Check if neighbor (Manhattan distance == 1)
    const dr = Math.abs(this.first.row - pos.row);
    const dc = Math.abs(this.first.col - pos.col);
    const isNeighbor = dr + dc === 1;

    if (!isNeighbor) {
      // Not a neighbor — move selection to another tile
      const prev = this.first;
      this.first = pos;
      return { type: 'reselect', from: prev, to: pos };
    }

    // 4) Neighbor tile — perform swap in the model
    const from = this.first;
    const to = pos;

    this.boardModel.swapTiles(from, to);

    this.first = null;
    this.active = false;

    debugLog('TeleportController', 'Teleport swap performed');

    return { type: 'swap', from, to };
  }
}
