import { TileColor, TileClickPayload } from '../shared/types';
import EventBus from '../app/EventBus';
import { AppSignal } from '../app/AppSignals';
import { debugLog } from '../debug/Debug';

const { ccclass, property } = cc._decorator;

/**
 * Visual representation of a single tile:
 * - stores its row/col/color
 * - plays selection / spawn / burn / teleport animations
 * - sends click events through EventBus
 */
@ccclass
export default class TileView extends cc.Component {
  @property(cc.Button)
  button: cc.Button = null;

  row: number = 0;
  col: number = 0;
  color: TileColor = TileColor.Blue;

  private baseScale: number = 1;
  private selected: boolean = false;

  onLoad() {
    if (!this.button) {
      this.button = this.getComponent(cc.Button);
    }
    this.baseScale = this.node.scale;
  }

  public setup(row: number, col: number, color: TileColor) {
    this.row = row;
    this.col = col;
    this.color = color;

    this.setSelected(false);
  }

  /**
   * Visual selection toggle (used for normal clicks and teleport mode).
   */
  public setSelected(on: boolean) {
    if (this.selected === on) return;
    this.selected = on;

    cc.Tween.stopAllByTarget(this.node);

    if (on) {
      cc.tween(this.node)
        .to(0.08, { scale: this.baseScale * 1.1 })
        .to(0.08, { scale: this.baseScale * 1.05 })
        .start();
    } else {
      cc.tween(this.node).to(0.1, { scale: this.baseScale }).start();
    }
  }

  /**
   * Spawn animation when tile appears on the board.
   */
  public playSpawn(onComplete?: () => void) {
    // start from smaller scale and transparent
    this.node.opacity = 0;
    this.node.scale = this.baseScale * 0.5;

    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node)
      .to(0.12, { opacity: 255, scale: this.baseScale * 1.1 })
      .to(0.08, { scale: this.baseScale })
      .call(() => {
        if (onComplete) onComplete();
      })
      .start();
  }

  /**
   * "Burn" animation before tile is removed.
   * Actual logical removal from the model is handled by BoardModel.
   */
  public playBurn(onComplete?: () => void) {
    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node)
      .to(0.1, { scale: this.baseScale * 1.2 })
      .to(0.15, { scale: this.baseScale * 0.2, opacity: 0 })
      .call(() => {
        if (onComplete) onComplete();
      })
      .start();
  }

  /**
   * Teleport swap animation: move tile to a new position with a small scale "ping".
   */
  public playTeleportSwap(targetPos: cc.Vec2, onComplete?: () => void) {
    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node)
      .to(0.12, {
        x: targetPos.x,
        y: targetPos.y,
        scale: this.baseScale * 1.12,
      })
      .to(0.08, { scale: this.baseScale * 0.98 })
      .to(0.06, { scale: this.baseScale })
      .call(() => {
        if (onComplete) onComplete();
      })
      .start();
  }

  public onClick() {
    debugLog(
      'TileView',
      `CLICK row=${this.row}, col=${this.col}, color=${this.color}`
    );

    const payload: TileClickPayload = {
      row: this.row,
      col: this.col,
      color: this.color,
    };
    EventBus.I.emit(AppSignal.TILE_CLICKED, payload);
  }
}
