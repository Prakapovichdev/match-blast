const { ccclass, property } = cc._decorator;
import { GameStateData } from '../app/GameState';

@ccclass
export default class HUDScore extends cc.Component {
  // === LABEL REFERENCES ===

  @property(cc.Label)
  titleLabel: cc.Label = null;

  @property(cc.Label)
  valueLabel: cc.Label = null;

  @property(cc.Label)
  movesLabel: cc.Label = null;

  // === DEFAULT VALUES (OVERRIDDEN FROM INSPECTOR IF NEEDED) ===

  @property
  titleText: string = 'SCORE:';

  @property
  current: number = 0; // current score

  @property
  target: number = 500; // target score

  @property
  moves: number = 0; // moves left

  // === LIFECYCLE ===

  onLoad() {
    // Render whatever is configured in the inspector at startup
    this.refreshLabels();
  }

  // === PUBLIC API ===

  /** Main entry: apply current GameState to HUD. */
  public applyGameState(state: GameStateData) {
    if (!state) return;

    this.current = state.score;
    this.target = state.targetScore;
    this.moves = state.movesLeft;

    this.refreshLabels();
  }

  /** Update score only (optionally target). */
  public setScore(current: number, target?: number) {
    this.current = current;
    if (typeof target === 'number') {
      this.target = target;
    }
    this.refreshLabels();
  }

  /** Update moves only. */
  public setMoves(moves: number) {
    this.moves = moves;
    this.refreshLabels();
  }

  // === INTERNAL HELPERS ===

  private refreshLabels() {
    if (this.titleLabel) {
      this.titleLabel.string = this.titleText;
    }

    if (this.valueLabel) {
      this.valueLabel.string = `${this.current}/${this.target}`;
    }

    if (this.movesLabel) {
      this.movesLabel.string = `${this.moves}`;
    }
  }
}
