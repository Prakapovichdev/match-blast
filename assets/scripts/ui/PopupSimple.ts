const { ccclass, property } = cc._decorator;

/**
 * Generic popup with a title and single OK button.
 * Used for WIN / LOSE screens. The actual reaction to OK is
 * passed via the `onOk` callback from GameEntry.
 */
@ccclass
export default class PopupSimple extends cc.Component {
  @property(cc.Label)
  titleLabel: cc.Label = null;

  /** Panel node that is animated (background). Defaults to root node. */
  @property(cc.Node)
  panel: cc.Node = null;

  @property(cc.Button)
  okButton: cc.Button = null;

  /** Callback invoked when OK is pressed. Assigned from GameEntry. */
  public onOk: (() => void) | null = null;

  private baseScale: number = 1;

  // === LIFECYCLE ===

  onLoad() {
    if (!this.panel) {
      this.panel = this.node;
    }

    if (!this.okButton) {
      // try to find button somewhere in children
      this.okButton = this.getComponentInChildren(cc.Button);
    }

    this.baseScale = this.panel.scale;
  }

  // === PUBLIC API ===

  /** Show popup with optional title text. */
  public show(title?: string) {
    if (this.titleLabel && title != null) {
      this.titleLabel.string = title;
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

  /** OnClick handler for the OK button (hooked up in the editor). */
  public onOkButtonClick() {
    if (this.onOk) {
      this.onOk();
    }
  }
}
