const { ccclass, property } = cc._decorator;

@ccclass
export default class PopupOkButton extends cc.Component {
  @property(cc.Button)
  button: cc.Button = null;

  private baseScale: number = 1;
  private isPressed: boolean = false;

  // === LIFECYCLE ===

  onLoad() {
    if (!this.button) {
      this.button = this.getComponent(cc.Button);
    }

    this.baseScale = this.node.scale;

    // Touch (mobile + mouse clicks in web)
    this.node.on(cc.Node.EventType.TOUCH_START, this.onPress, this);
    this.node.on(cc.Node.EventType.TOUCH_END, this.onRelease, this);
    this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.onRelease, this);

    // Mouse hover / press for desktop
    this.node.on(cc.Node.EventType.MOUSE_DOWN, this.onPress, this);
    this.node.on(cc.Node.EventType.MOUSE_UP, this.onRelease, this);
    this.node.on(cc.Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    this.node.on(cc.Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
  }

  onDestroy() {
    this.node.off(cc.Node.EventType.TOUCH_START, this.onPress, this);
    this.node.off(cc.Node.EventType.TOUCH_END, this.onRelease, this);
    this.node.off(cc.Node.EventType.TOUCH_CANCEL, this.onRelease, this);

    this.node.off(cc.Node.EventType.MOUSE_DOWN, this.onPress, this);
    this.node.off(cc.Node.EventType.MOUSE_UP, this.onRelease, this);
    this.node.off(cc.Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    this.node.off(cc.Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
  }

  onDisable() {
    cc.Tween.stopAllByTarget(this.node);
    this.node.scale = this.baseScale;
    this.isPressed = false;
  }

  // === HOVER ===

  private onMouseEnter() {
    if (this.isPressed) return;

    cc.Tween.stopAllByTarget(this.node);
    cc.tween(this.node)
      .to(0.08, { scale: this.baseScale * 1.06 })
      .start();
  }

  private onMouseLeave() {
    if (this.isPressed) return;

    cc.Tween.stopAllByTarget(this.node);
    cc.tween(this.node).to(0.1, { scale: this.baseScale }).start();
  }

  // === PRESS / RELEASE ===

  /** Pressed: light "depress" effect. */
  private onPress() {
    this.isPressed = true;

    cc.Tween.stopAllByTarget(this.node);
    cc.tween(this.node)
      .to(0.06, { scale: this.baseScale * 0.94 })
      .start();
  }

  /** Released / canceled: small ping and back to normal. */
  private onRelease() {
    this.isPressed = false;

    cc.Tween.stopAllByTarget(this.node);
    cc.tween(this.node)
      .to(0.08, { scale: this.baseScale * 1.06 })
      .to(0.08, { scale: this.baseScale })
      .start();
  }
}
