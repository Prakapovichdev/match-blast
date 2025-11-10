const { ccclass, property } = cc._decorator;

import { debugLog } from '../debug/Debug';
import EventBus from '../app/EventBus';
import { AppSignal } from '../app/AppSignals';

/**
 * "No moves" popup:
 *  - shows how many reshuffles are left;
 *  - plays simple show/hide animations;
 *  - on OK sends NO_MOVES_OK_CLICKED, GameEntry decides what to do next.
 */
@ccclass
export default class PopupNoMoves extends cc.Component {
  @property(cc.Label)
  titleLabel: cc.Label = null;

  @property(cc.Label)
  reshufflesLabel: cc.Label = null;

  /** Panel node that is animated. If not set, root popup node is used. */
  @property(cc.Node)
  panel: cc.Node = null;

  @property(cc.Button)
  okButton: cc.Button = null;

  private baseScale: number = 1;

  // === LIFECYCLE ===

  onLoad() {
    if (!this.panel) {
      this.panel = this.node;
    }

    if (!this.okButton) {
      this.okButton = this.getComponentInChildren(cc.Button);
    }

    this.baseScale = this.panel.scale;

    debugLog(
      'PopupNoMoves',
      `onLoad, node=${this.node.name}, panel=${
        this.panel.name
      }, okButton=${!!this.okButton}`
    );
  }

  onDisable() {
    cc.Tween.stopAllByTarget(this.panel);
  }

  // === PUBLIC API ===

  /** Show popup with remaining reshuffles (перемешки) count. */
  public show(reshufflesLeft: number) {
    debugLog(
      'PopupNoMoves',
      `show(), node=${this.node.name}, reshufflesLeft=${reshufflesLeft}, activeBefore=${this.node.active}`
    );

    if (this.titleLabel) {
      this.titleLabel.string = 'НЕТ ХОДОВ';
    }

    if (this.reshufflesLabel) {
      this.reshufflesLabel.string = `Перемешек: ${reshufflesLeft}`;
    }

    this.node.active = true;

    this.panel.opacity = 0;
    this.panel.scale = this.baseScale * 0.75;

    cc.Tween.stopAllByTarget(this.panel);

    cc.tween(this.panel)
      .to(0.18, { opacity: 255, scale: this.baseScale * 1.05 })
      .to(0.09, { scale: this.baseScale })
      .start();
  }

  /** Hide popup with a short closing animation. */
  public hide() {
    debugLog('PopupNoMoves', `hide(), node=${this.node.name}`);

    cc.Tween.stopAllByTarget(this.panel);

    cc.tween(this.panel)
      .to(0.12, { scale: this.baseScale * 0.9, opacity: 0 })
      .call(() => {
        this.node.active = false;
        this.panel.scale = this.baseScale;
        this.panel.opacity = 255;
      })
      .start();
  }

  /** OK button handler (wired in the inspector). */
  public onOkClick() {
    debugLog('PopupNoMoves', 'onOkClick');
    EventBus.I.emit(AppSignal.NO_MOVES_OK_CLICKED);
  }
}
