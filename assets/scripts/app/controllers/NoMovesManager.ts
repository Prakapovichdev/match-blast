/**
 * Tracks how many reshuffles are available when there are no moves left.
 * Pure counter utility, does not know anything about the board itself.
 */
export default class NoMovesManager {
  private readonly maxReshuffles: number;
  private reshufflesLeft: number;

  constructor(maxReshuffles: number) {
    this.maxReshuffles = maxReshuffles;
    this.reshufflesLeft = maxReshuffles;
  }

  public reset() {
    this.reshufflesLeft = this.maxReshuffles;
  }

  public getReshufflesLeft(): number {
    return this.reshufflesLeft;
  }

  public canReshuffle(): boolean {
    return this.reshufflesLeft > 0;
  }

  /**
   * Spend one reshuffle if available.
   * @returns true if reshuffle was consumed, false otherwise
   */
  public useReshuffle(): boolean {
    if (this.reshufflesLeft <= 0) {
      return false;
    }
    this.reshufflesLeft--;
    return true;
  }
}
