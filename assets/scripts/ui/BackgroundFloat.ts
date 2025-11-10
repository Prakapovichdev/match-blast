const { ccclass, property } = cc._decorator;

/**
 * Simple background blink:
 * - smoothly fades between full and lower opacity
 * - runs forever
 */
@ccclass
export default class BackgroundBlink extends cc.Component {
  @property({
    tooltip: 'Minimum opacity during blink (0–255)',
  })
  minOpacity: number = 140;

  @property({
    tooltip: 'Total blink duration in seconds (fade out + fade in)',
  })
  duration: number = 3;

  onLoad() {
    const startOpacity = this.node.opacity;
    const min = cc.misc.clampf(this.minOpacity, 0, 255);
    const half = this.duration / 2;

    cc.Tween.stopAllByTarget(this.node);

    cc.tween(this.node)
      .repeatForever(
        cc
          .tween()
          .to(half, { opacity: min })
          .to(half, { opacity: startOpacity })
      )
      .start();
  }
}
