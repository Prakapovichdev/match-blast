const { ccclass, property } = cc._decorator;

import EventBus from '../app/EventBus';
import { AppSignal } from '../app/AppSignals';
import { debugLog } from '../debug/Debug';

@ccclass
export default class BoosterTeleportButton extends cc.Component {
  @property(cc.Button)
  button: cc.Button = null;

  @property({
    tooltip: 'Label showing remaining teleport charges',
  })
  countLabel: cc.Label = null;

  private baseScale: number = 1;
  private isActive: boolean = false;

  // === LIFECYCLE ===

  onLoad() {
    if (!this.button) {
      this.button = this.getComponent(cc.Button);
    }

    this.baseScale = this.node.scale;

    // Hover is relevant only for mouse/desktop. On mobile it simply won't fire.
    this.node.on(cc.Node.EventType.MOUSE_ENTER, this.onHoverEnter, this);
    this.node.on(cc.Node.EventType.MOUSE_LEAVE, this.onHoverLeave, this);
  }

  onDestroy() {
    this.node.off(cc.Node.EventType.MOUSE_ENTER, this.onHoverEnter, this);
    this.node.off(cc.Node.EventType.MOUSE_LEAVE, this.onHoverLeave, this);
  }

  onDisable() {
    cc.Tween.stopAllByTarget(this.node);
    this.node.scale = this.baseScale;
  }

  // === PUBLIC API ===

  /**
   * Update teleport charges in UI.
   * If there are no charges, visually disable/dim the button.
   */
  public setCount(count: number) {
    if (this.countLabel) {
      this.countLabel.string = String(count);
    }

    const hasCharges = count > 0;

    if (this.button) {
      this.button.interactable = hasCharges;
    }

    // When there are no charges – turn off active state and dim the button a bit.
    if (!hasCharges) {
      this.setActive(false);
      this.node.opacity = 160;
    } else {
      this.node.opacity = 255;
    }
  }

  /** Click handler assigned in the inspector. */
  public onClick() {
    debugLog('BoosterTeleportButton', 'CLICK');

    this.playClickPulse();

    EventBus.I.emit(AppSignal.BOOSTER_TELEPORT_CLICKED);
  }

  /**
   * External method to toggle "teleport mode" state.
   * When active = true, the button stays slightly enlarged and "breathes".
   * Called from GameEntry after onBoosterTeleportClick().
   */
  public setActive(active: boolean) {
    if (this.isActive === active) return;
    this.isActive = active;

    cc.Tween.stopAllByTarget(this.node);

    if (active) {
      this.node.scale = this.baseScale * 1.08;

      cc.tween(this.node)
        .to(0.2, { scale: this.baseScale * 1.12 })
        .to(0.2, { scale: this.baseScale * 1.08 })
        .union()
        .repeatForever()
        .start();
    } else {
      cc.tween(this.node).to(0.15, { scale: this.baseScale }).start();
    }
  }

  // === HOVER EFFECTS ===

  /** Hover effect on mouse enter (only when not active and button is enabled). */
  private onHoverEnter() {
    if (this.button && !this.button.interactable) return;
    if (this.isActive) return;

    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node)
      .to(0.08, { scale: this.baseScale * 1.06 })
      .start();
  }

  /** Reset hover scale on mouse leave. */
  private onHoverLeave() {
    if (this.button && !this.button.interactable) return;
    if (this.isActive) return;

    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node).to(0.1, { scale: this.baseScale }).start();
  }

  // === INTERNAL ANIMATIONS ===

  /** Short "ping" animation on click. */
  private playClickPulse() {
    if (this.button && !this.button.interactable) return;

    cc.Tween.stopAllByTarget(this.node);

    if (this.isActive) {
      cc.tween(this.node)
        .to(0.06, { scale: this.baseScale * 1.14 })
        .to(0.1, { scale: this.baseScale * 1.08 })
        .start();
      return;
    }

    cc.tween(this.node)
      .to(0.06, { scale: this.baseScale * 1.08 })
      .to(0.1, { scale: this.baseScale })
      .start();
  }
}
