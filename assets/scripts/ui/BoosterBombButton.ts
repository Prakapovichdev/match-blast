import { debugLog } from '../debug/Debug';
import EventBus from '../app/EventBus';
import { AppSignal } from '../app/AppSignals';

const { ccclass, property } = cc._decorator;

@ccclass
export default class BoosterBombButton extends cc.Component {
  @property({
    tooltip: 'Label showing remaining bomb charges',
  })
  countLabel: cc.Label = null;

  @property(cc.Button)
  button: cc.Button = null;

  private baseScale: number = 1;
  private isActive: boolean = false;

  // === LIFECYCLE ===

  onLoad() {
    if (!this.button) {
      this.button = this.getComponent(cc.Button);
    }

    this.baseScale = this.node.scale;

    // hover is relevant mostly for desktop / mouse input
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

  /** Update bombs counter in UI and visual state. */
  public setCount(count: number) {
    if (this.countLabel) {
      this.countLabel.string = String(count);
    }

    const hasCharges = count > 0;

    if (this.button) {
      this.button.interactable = hasCharges;
    }

    if (!hasCharges) {
      this.setActive(false);
      this.node.opacity = 160;
    } else {
      this.node.opacity = 255;
    }
  }

  /** Turn "bomb mode" on or off. */
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
      // smooth return to base scale
      cc.tween(this.node).to(0.15, { scale: this.baseScale }).start();
    }
  }

  /** Click handler assigned to the booster button. */
  public onClick() {
    debugLog('BoosterBombButton', 'CLICK');

    this.playClickPulse();

    EventBus.I.emit(AppSignal.BOOSTER_BOMB_CLICKED);
  }

  // === HOVER EFFECTS ===

  /** Hover effect when mouse enters (if button is enabled and not active). */
  private onHoverEnter() {
    if (this.button && !this.button.interactable) return;
    if (this.isActive) return; // active mode already "breathes"

    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node)
      .to(0.08, { scale: this.baseScale * 1.06 })
      .start();
  }

  /** Reset hover effect when mouse leaves. */
  private onHoverLeave() {
    if (this.button && !this.button.interactable) return;
    if (this.isActive) return;

    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node).to(0.1, { scale: this.baseScale }).start();
  }

  // === INTERNAL ANIMATIONS ===

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
