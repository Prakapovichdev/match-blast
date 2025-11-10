import { GameConfig } from './AppConfig';

export type GameOverReason = 'win' | 'lose' | null;

export interface GameStateData {
  score: number;
  movesLeft: number;
  targetScore: number;
  gameOver: boolean;
  gameOverReason: GameOverReason;

  reshufflesLeft: number;
  bombsLeft: number;
  teleportsLeft: number;
}

/**
 * Pure game state container:
 * - tracks score, moves, boosters, reshuffles
 * - knows win/lose conditions
 * - does NOT touch view or board
 */
export default class GameState {
  public data: GameStateData;

  constructor() {
    this.data = {
      score: 0,
      movesLeft: GameConfig.startMoves,
      targetScore: GameConfig.targetScore,
      gameOver: false,
      gameOverReason: null,
      reshufflesLeft: GameConfig.reshuffleLimit,
      bombsLeft: GameConfig.startBombs,
      teleportsLeft: GameConfig.startTeleports,
    };
  }

  // === GROUP MOVES ===

  /** Check if a group of given size can be removed at all (by rules and game state). */
  public canRemoveGroup(size: number): boolean {
    if (this.data.gameOver) return false;
    return size >= GameConfig.minGroupSize;
  }

  /**
   * Apply a normal group removal:
   * - spends 1 move
   * - adds score for the removed tiles
   * Returns the gained score for this move.
   */
  public applyGroup(size: number): number {
    if (!this.canRemoveGroup(size)) {
      return 0;
    }

    const gained = size * GameConfig.baseScorePerTile;
    this.data.score += gained;
    this.data.movesLeft -= 1;

    this.updateGameOver();

    return gained;
  }

  private updateGameOver() {
    if (this.data.gameOver) return;

    // Win by reaching target score
    if (this.data.score >= this.data.targetScore) {
      this.data.gameOver = true;
      this.data.gameOverReason = 'win';
      return;
    }

    // Lose when no moves left
    if (this.data.movesLeft <= 0) {
      this.data.gameOver = true;
      this.data.gameOverReason = 'lose';
      return;
    }
  }

  // === AUTO-RESHUFFLES (NO MOVES) ===

  public canUseReshuffle(): boolean {
    if (this.data.gameOver) return false;
    return this.data.reshufflesLeft > 0;
  }

  /** Consume one reshuffle if available. Returns true on success. */
  public useReshuffle(): boolean {
    if (!this.canUseReshuffle()) {
      return false;
    }
    this.data.reshufflesLeft -= 1;
    return true;
  }

  // === BOMB BOOSTER ===

  public canUseBomb(): boolean {
    if (this.data.gameOver) return false;
    return this.data.bombsLeft > 0;
  }

  /** Consume one bomb charge. Returns true if there was at least one bomb. */
  public useBomb(): boolean {
    if (!this.canUseBomb()) return false;
    this.data.bombsLeft -= 1;
    return true;
  }

  /**
   * Apply bomb explosion:
   * - adds score for `count` removed tiles
   * - does NOT spend a move
   */
  public applyBomb(count: number): number {
    if (this.data.gameOver || count <= 0) return 0;

    const gained = count * GameConfig.baseScorePerTile;
    this.data.score += gained;

    this.updateGameOver();

    return gained;
  }

  // === TELEPORT BOOSTER ===

  public canUseTeleport(): boolean {
    if (this.data.gameOver) return false;
    return this.data.teleportsLeft > 0;
  }

  /**
   * Consume one teleport charge.
   * Teleport itself:
   * - does NOT give score
   * - does NOT spend a move
   * It only helps prepare a better move.
   */
  public useTeleport(): boolean {
    if (!this.canUseTeleport()) return false;
    this.data.teleportsLeft -= 1;
    return true;
  }
}
