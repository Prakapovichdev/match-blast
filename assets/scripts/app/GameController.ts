import { debugLog } from '../debug/Debug';
import { TileClickPayload, TILE_COLORS, TilePos } from '../shared/types';
import BoardModel from '../domain/BoardModel';
import BoardFiller from '../board/BoardFiller';
import HUDScore from '../ui/HUDScore';
import GameState from './GameState';
import { BoardConfig, GameConfig } from './AppConfig';
import TeleportController, {
  TeleportClickResult,
} from './controllers/TeleportController';
import BombController from './controllers/BombController';
import MegaBombController from './controllers/MegaBombController';

export type NoMovesCallback = (reshufflesLeft: number) => void;
export type BombsChangedCallback = (bombsLeft: number) => void;
export type TeleportsChangedCallback = (teleportsLeft: number) => void;

interface EndTurnOptions {
  updateBombs?: boolean;
  removedCells?: TilePos[];
}

/**
 * Central game logic controller:
 * - owns BoardModel and GameState
 * - reacts to input (tile clicks, boosters, reshuffles)
 * - coordinates BoardFiller animations and HUD updates
 */
export default class GameController {
  private boardModel: BoardModel | null = null;
  private boardFiller: BoardFiller;
  private hudScore: HUDScore | null = null;
  private gameState: GameState | null = null;

  private lastSelected: TilePos | null = null;

  private teleportController: TeleportController;
  private bombController: BombController;
  private megaBombController: MegaBombController;

  /** Whether any animations are currently running (removal, gravity, teleports, etc.). */
  private isAnimating: boolean = false;

  /** Callbacks into View layer (GameEntry / popups / buttons). */
  onWin: (() => void) | null = null;
  onLose: (() => void) | null = null;
  onNoMoves: NoMovesCallback | null = null;
  onBombsChanged: BombsChangedCallback | null = null;
  onTeleportsChanged: TeleportsChangedCallback | null = null;

  constructor(boardFiller: BoardFiller, hudScore: HUDScore | null) {
    this.boardFiller = boardFiller;
    this.hudScore = hudScore;

    this.teleportController = new TeleportController(null);
    this.bombController = new BombController(null);
    this.megaBombController = new MegaBombController(
      null,
      GameConfig.megaBombMinGroupSize
    );
  }

  // === PUBLIC API ===

  /** Start or restart the game with a fresh board and state. */
  public initNewGame() {
    debugLog('GameController', 'initNewGame()');

    this.isAnimating = false;

    this.boardModel = new BoardModel(
      BoardConfig.rows,
      BoardConfig.cols,
      TILE_COLORS
    );
    this.boardModel.randomFill();
    this.boardFiller.renderFromGrid(this.boardModel.grid);

    this.gameState = new GameState();
    this.lastSelected = null;

    this.teleportController.setBoard(this.boardModel);
    this.teleportController.reset();

    this.bombController.setBoard(this.boardModel);
    this.bombController.reset();

    this.megaBombController.setBoard(this.boardModel);

    debugLog(
      'GameController',
      `state: score=${this.gameState.data.score}, movesLeft=${this.gameState.data.movesLeft}, target=${this.gameState.data.targetScore}, reshufflesLeft=${this.gameState.data.reshufflesLeft}, bombsLeft=${this.gameState.data.bombsLeft}, teleportsLeft=${this.gameState.data.teleportsLeft}`
    );

    if (this.hudScore) {
      this.hudScore.applyGameState(this.gameState.data);
    }

    if (this.onBombsChanged) {
      this.onBombsChanged(this.gameState.data.bombsLeft);
    }

    if (this.onTeleportsChanged) {
      this.onTeleportsChanged(this.gameState.data.teleportsLeft);
    }

    this.ensureHasMoves();
  }

  /**
   * Tile click entrypoint.
   * Behavior depends on current mode: teleport, bomb, mega bomb or normal group removal.
   */
  public onTileClick(payload: TileClickPayload) {
    if (!this.isGameInteractive()) return;
    if (!this.boardModel) return;

    // 1) Teleport mode: delegate to TeleportController
    if (this.teleportController.isActive()) {
      const result = this.teleportController.handleClick(payload);
      this.handleTeleportResult(result);
      return;
    }

    // 2) Bomb mode: use BombController around clicked cell
    if (this.bombController.isActive()) {
      this.handleBombClick(payload);
      return;
    }

    // 3) Clicked an existing mega bomb – blow up the whole board
    if (this.megaBombController.isMegaBomb(payload.row, payload.col)) {
      this.handleMegaBombClick(payload.row, payload.col);
      return;
    }

    // 4) Normal click on a colored group
    this.handleNormalTileClick(payload);
  }

  /** Booster button: toggle teleport mode. */
  public onBoosterTeleportClick() {
    if (!this.isGameInteractive()) return;
    if (!this.gameState) return;

    if (!this.gameState.canUseTeleport()) {
      debugLog(
        'GameController',
        'Booster TELEPORT clicked, but no teleports left'
      );
      return;
    }

    // Teleport and bomb modes must not be active at the same time
    this.bombController.reset();
    this.clearSelection();

    this.teleportController.toggle();
  }

  /** Booster button: toggle bomb mode. */
  public onBoosterBombClick() {
    if (!this.isGameInteractive()) return;
    if (!this.gameState) return;

    if (!this.gameState.canUseBomb()) {
      debugLog('GameController', 'Booster BOMB clicked, but no bombs left');
      return;
    }

    // Bomb and teleport modes are mutually exclusive
    this.teleportController.reset();

    this.bombController.toggle();
  }

  /** "No moves" popup confirmed by user. */
  public onNoMovesPopupOk() {
    if (!this.isGameInteractive()) return;
    if (!this.gameState) return;

    const used = this.gameState.useReshuffle();
    if (!used) {
      this.forceLoseByNoMoves();
      return;
    }

    this.reshuffleBoard();
    this.ensureHasMoves();
    this.checkGameOver();
  }

  /** Restart current level. */
  public onRestartRequested() {
    this.initNewGame();
  }

  // === INTERNAL LOGIC ===

  /** Normal tile click (no bomb, no teleport, no mega bomb). */
  private handleNormalTileClick(payload: TileClickPayload) {
    if (!this.boardModel || !this.gameState) return;

    const group = this.boardModel.findGroup(payload.row, payload.col);
    const size = group.length;

    if (!this.gameState.canRemoveGroup(size)) {
      return;
    }

    this.clearSelection();

    this.gameState.applyGroup(size);

    const center: TilePos = { row: payload.row, col: payload.col };

    // Large groups may spawn a mega bomb instead of simple removal
    if (this.megaBombController.canCreateFromSize(size)) {
      const result = this.megaBombController.createFromGroup(group, center);

      if (result.created) {
        this.boardFiller.setMegaBombVisual(center.row, center.col);

        this.applyBoardChangesAndEndTurn({
          removedCells: result.removedCells,
        });
        return;
      }
    }

    this.boardModel.removeGroup(group);

    this.applyBoardChangesAndEndTurn({
      removedCells: group,
    });
  }

  /** Click on regular bomb booster. */
  private handleBombClick(payload: TileClickPayload) {
    if (!this.boardModel || !this.gameState) return;

    const cells = this.bombController.handleClick(payload.row, payload.col);
    const size = cells.length;
    if (size === 0) {
      debugLog('GameController', 'Bomb click: no cells to remove');
      return;
    }

    const used = this.gameState.useBomb();
    if (!used) {
      debugLog('GameController', 'Bomb click, but no bombs left in state');
      return;
    }

    const gained = this.gameState.applyBomb(size);
    debugLog(
      'GameController',
      `BOMB remove size=${size}, gained=${gained}, score=${this.gameState.data.score}, movesLeft=${this.gameState.data.movesLeft}, bombsLeft=${this.gameState.data.bombsLeft}`
    );

    const radius = this.bombController.getRadius();
    this.boardFiller.playBombShake();
    this.boardFiller.playBombFlash(payload.row, payload.col, radius);

    this.boardModel.removeGroup(cells);

    this.applyBoardChangesAndEndTurn({
      updateBombs: true,
      removedCells: cells,
    });
  }

  /** Click on mega bomb – removes all tiles on the board. */
  private handleMegaBombClick(row: number, col: number) {
    if (!this.boardModel || !this.gameState) return;

    const res = this.megaBombController.explode(row, col);
    if (!res) return;

    const { removedCells, totalTiles } = res;

    this.clearSelection();
    this.teleportController.reset();
    this.bombController.reset();

    const gained = this.gameState.applyBomb(totalTiles);
    debugLog(
      'GameController',
      `MEGA BOMB explode, tiles=${totalTiles}, gained=${gained}, score=${this.gameState.data.score}, movesLeft=${this.gameState.data.movesLeft}`
    );

    this.boardFiller.playBombShake();
    this.boardFiller.playBombFlash(
      row,
      col,
      Math.max(this.boardModel.rows, this.boardModel.cols)
    );

    this.applyBoardChangesAndEndTurn({
      removedCells,
    });
  }

  /** Handle teleport click result (selection / reselection / swap). */
  private handleTeleportResult(result: TeleportClickResult | null) {
    if (!result) return;

    switch (result.type) {
      case 'select': {
        const v = this.boardFiller.getTileView(result.pos.row, result.pos.col);
        if (v) v.setSelected(true);
        break;
      }
      case 'deselect': {
        const v = this.boardFiller.getTileView(result.pos.row, result.pos.col);
        if (v) v.setSelected(false);
        break;
      }
      case 'reselect': {
        const oldV = this.boardFiller.getTileView(
          result.from.row,
          result.from.col
        );
        if (oldV) oldV.setSelected(false);

        const newV = this.boardFiller.getTileView(result.to.row, result.to.col);
        if (newV) newV.setSelected(true);
        break;
      }
      case 'swap': {
        if (!this.boardModel || !this.gameState) return;

        const usedTeleport = this.gameState.useTeleport();
        if (!usedTeleport) {
          debugLog(
            'GameController',
            'Teleport swap performed, but no teleports left in state'
          );
        } else {
          debugLog(
            'GameController',
            `Teleport used, teleportsLeft=${this.gameState.data.teleportsLeft}`
          );
        }

        if (this.onTeleportsChanged) {
          this.onTeleportsChanged(this.gameState.data.teleportsLeft);
        }

        const from = result.from;
        const to = result.to;

        const viewA = this.boardFiller.getTileView(from.row, from.col);
        const viewB = this.boardFiller.getTileView(to.row, to.col);

        if (!viewA || !viewB) {
          this.boardFiller.renderFromGrid(this.boardModel.grid);
          this.ensureHasMoves();
          this.checkGameOver();
          return;
        }

        const posA = viewA.node.position.clone();
        const posB = viewB.node.position.clone();

        if (viewA.button) viewA.button.interactable = false;
        if (viewB.button) viewB.button.interactable = false;

        this.isAnimating = true;

        let finished = 0;
        const onDone = () => {
          finished++;
          if (finished < 2) return;

          this.boardFiller.renderFromGrid(this.boardModel!.grid);

          this.ensureHasMoves();
          this.checkGameOver();

          this.isAnimating = false;
        };

        viewA.playTeleportSwap(posB, onDone);
        viewB.playTeleportSwap(posA, onDone);

        break;
      }
    }
  }

  /** Check if there are any valid moves left, and trigger reshuffle/no-moves flow if needed. */
  private ensureHasMoves() {
    if (!this.boardModel || !this.gameState) return;
    if (this.gameState.data.gameOver) return;

    const hasMoves = this.boardModel.hasAnyMoves(GameConfig.minGroupSize);

    if (hasMoves) return;

    if (!this.gameState.canUseReshuffle()) {
      this.forceLoseByNoMoves();
      return;
    }

    if (this.onNoMoves) {
      this.onNoMoves(this.gameState.data.reshufflesLeft);
    }
  }

  /** Lose the level because there are no moves and no reshuffles left. */
  private forceLoseByNoMoves() {
    if (!this.gameState) return;
    if (this.gameState.data.gameOver) return;

    this.gameState.data.gameOver = true;
    this.gameState.data.gameOverReason = 'lose';
    this.checkGameOver();
  }

  /** Shuffle the board when there are no moves, consuming one reshuffle. */
  private reshuffleBoard() {
    if (!this.boardModel || !this.gameState) return;
    if (this.gameState.data.gameOver) return;

    this.boardModel.randomFill();
    this.boardFiller.renderFromGrid(this.boardModel.grid);

    this.lastSelected = null;
    this.teleportController.reset();
    this.bombController.reset();
  }

  // === GAME END ===

  private checkGameOver() {
    if (!this.gameState || !this.gameState.data.gameOver) return;

    if (this.gameState.data.gameOverReason === 'win') {
      debugLog('GameController', 'GAME OVER: WIN');
      if (this.onWin) this.onWin();
    } else if (this.gameState.data.gameOverReason === 'lose') {
      debugLog('GameController', 'GAME OVER: LOSE');
      if (this.onLose) this.onLose();
    }
  }

  // === HELPERS ===

  private isGameInteractive(): boolean {
    return (
      !!this.boardModel &&
      !!this.gameState &&
      !this.gameState.data.gameOver &&
      !this.isAnimating
    );
  }

  private clearSelection() {
    if (!this.lastSelected) return;

    const prevView = this.boardFiller.getTileView(
      this.lastSelected.row,
      this.lastSelected.col
    );
    if (prevView) prevView.setSelected(false);

    this.lastSelected = null;
  }

  public isTeleportActive(): boolean {
    return this.teleportController.isActive();
  }

  public isBombActive(): boolean {
    return this.bombController.isActive();
  }

  /**
   * Common end-of-turn pipeline after any board change (group removal, bomb, mega bomb).
   * Applies gravity and refills, plays animations, updates HUD and checks for next moves / game over.
   */
  private applyBoardChangesAndEndTurn(options: EndTurnOptions = {}) {
    if (!this.boardModel || !this.gameState) return;

    this.isAnimating = true;

    const afterRemove = () => {
      const movements = this.boardModel!.applyGravity();
      const refills = this.boardModel!.refillEmptyCells();

      const finalize = () => {
        this.lastSelected = null;

        if (this.hudScore) {
          this.hudScore.applyGameState(this.gameState!.data);
        }

        if (options.updateBombs && this.onBombsChanged) {
          this.onBombsChanged(this.gameState!.data.bombsLeft);
        }

        this.ensureHasMoves();
        this.checkGameOver();

        this.isAnimating = false;
      };

      this.boardFiller.applyGravityAndRefillAnimations(
        this.boardModel!.grid,
        movements,
        refills,
        finalize
      );
    };

    const removed = options.removedCells;

    if (removed && removed.length > 0) {
      this.boardFiller.removeTileViews(removed, afterRemove);
    } else {
      afterRemove();
    }
  }
}
