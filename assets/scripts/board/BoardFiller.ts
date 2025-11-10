import { debugLog } from '../debug/Debug';
import { TileColor, TILE_COLORS, TileGrid, TilePos } from '../shared/types';
import TileView from './TileView';
import { GravityMovement, RefillInfo } from '../domain/BoardModel';

const { ccclass, property } = cc._decorator;

// Aspect from art: width 100, height 112
const TILE_ASPECT = 112 / 100; // height / width

/**
 * BoardFiller:
 * - owns tile nodes and their layout
 * - renders full board from TileGrid
 * - plays gravity, spawn and bomb-related animations
 */
@ccclass
export default class BoardFiller extends cc.Component {
  @property(cc.Prefab)
  tilePrefab: cc.Prefab = null;

  @property
  rows: number = 9;

  @property
  cols: number = 9;

  @property
  paddingX: number = 4;

  @property
  paddingY: number = 4;

  @property
  gapX: number = 6;

  @property
  gapY: number = 5;

  @property
  offsetY: number = 0;

  @property([cc.SpriteFrame])
  tileSprites: cc.SpriteFrame[] = [];

  /** Local bomb flash sprite (radial glow). */
  @property(cc.SpriteFrame)
  bombFlashSprite: cc.SpriteFrame = null;

  /** Sprite for mega bomb (block_bomb_max). */
  @property(cc.SpriteFrame)
  megaBombSprite: cc.SpriteFrame = null;

  private grid: TileGrid = [];
  private viewGrid: (TileView | null)[][] = [];

  // cached layout for animations
  private tileWidth: number = 0;
  private tileHeight: number = 0;
  private startX: number = 0;
  private startY: number = 0;

  onLoad() {
    // Board is created by GameEntry via renderFromGrid
  }

  /**
   * Full board render from model grid.
   * Used on game start / reset / reshuffle.
   */
  public renderFromGrid(grid: TileGrid) {
    if (!grid || grid.length === 0) {
      debugLog('BoardFiller', 'renderFromGrid: empty grid');
      return;
    }

    this.grid = grid;

    const rows = grid.length;
    const cols = grid[0].length;

    this.rows = rows;
    this.cols = cols;

    this.recalculateLayout(rows, cols);

    this.node.removeAllChildren();
    this.viewGrid = [];

    for (let row = 0; row < rows; row++) {
      const rowColors = grid[row];
      const viewRow: (TileView | null)[] = [];

      for (let col = 0; col < cols; col++) {
        const color = rowColors[col];

        // empty model cell -> no tile view
        if (!color) {
          viewRow.push(null);
          continue;
        }

        const view = this.createTileView(row, col, color);
        viewRow.push(view);
      }

      this.viewGrid.push(viewRow);
    }
  }

  /**
   * Animation for gravity and refills after model already applied:
   * - removeGroup
   * - applyGravity
   * - refillEmptyCells
   */
  public applyGravityAndRefillAnimations(
    grid: TileGrid,
    movements: GravityMovement[],
    refills: RefillInfo[],
    onComplete?: () => void
  ) {
    // sync with current model state
    this.grid = grid;

    if (!this.tileWidth || !this.tileHeight) {
      this.recalculateLayout(this.rows, this.cols);
    }

    let pending = 0;

    const tryFinish = () => {
      if (pending === 0 && onComplete) {
        onComplete();
      }
    };

    // existing tiles falling
    for (const move of movements) {
      const from = move.from;
      const to = move.to;

      const view = this.getTileView(from.row, from.col);
      if (!view) continue;

      if (!this.viewGrid[to.row]) {
        this.viewGrid[to.row] = [];
      }
      this.viewGrid[to.row][to.col] = view;
      this.viewGrid[from.row][from.col] = null;

      view.row = to.row;
      view.col = to.col;

      const targetPos = this.getTilePosition(to.row, to.col);

      pending++;

      cc.Tween.stopAllByTarget(view.node);

      cc.tween(view.node)
        .to(0.15, { y: targetPos.y })
        .call(() => {
          pending--;
          tryFinish();
        })
        .start();
    }

    // spawn new tiles
    for (const info of refills) {
      const { pos, color } = info;
      const view = this.createTileView(pos.row, pos.col, color);
      if (!view) continue;

      if (!this.viewGrid[pos.row]) {
        this.viewGrid[pos.row] = [];
      }
      this.viewGrid[pos.row][pos.col] = view;

      pending++;

      view.playSpawn(() => {
        pending--;
        tryFinish();
      });
    }

    if (pending === 0) {
      tryFinish();
    }
  }

  public getTileView(row: number, col: number): TileView | null {
    const rowArr = this.viewGrid[row];
    if (!rowArr) return null;
    return rowArr[col] || null;
  }

  // === INTERNAL HELPERS ===

  private recalculateLayout(rows: number, cols: number) {
    const size = this.node.getContentSize();
    const boardW = size.width;
    const boardH = size.height;

    const innerW = boardW - this.paddingX * 2;
    const innerH = boardH - this.paddingY * 2;

    const cellW = (innerW - (cols - 1) * this.gapX) / cols;
    const cellH = (innerH - (rows - 1) * this.gapY) / rows;

    let tileW = cellW;
    let tileH = tileW * TILE_ASPECT;

    if (tileH > cellH) {
      tileH = cellH;
      tileW = tileH / TILE_ASPECT;
    }

    const tilesTotalW = cols * tileW + (cols - 1) * this.gapX;
    const tilesTotalH = rows * tileH + (rows - 1) * this.gapY;

    const freeW = innerW - tilesTotalW;
    const freeH = innerH - tilesTotalH;

    this.tileWidth = tileW;
    this.tileHeight = tileH;

    this.startX = -innerW / 2 + freeW / 2 + tileW / 2;
    this.startY = innerH / 2 - freeH / 2 - tileH / 2 + this.offsetY;

    debugLog(
      'BoardFiller',
      `recalculateLayout rows=${rows}, cols=${cols}, board=${boardW}x${boardH}`
    );
    debugLog(
      'BoardFiller',
      `cellW=${cellW.toFixed(1)}, cellH=${cellH.toFixed(
        1
      )}, tileW=${tileW.toFixed(1)}, tileH=${tileH.toFixed(1)}`
    );
    debugLog(
      'BoardFiller',
      `tilesTotalW=${tilesTotalW.toFixed(1)}, tilesTotalH=${tilesTotalH.toFixed(
        1
      )}, freeW=${freeW.toFixed(1)}, freeH=${freeH.toFixed(1)}`
    );
  }

  private getTilePosition(row: number, col: number): cc.Vec2 {
    const x = this.startX + col * (this.tileWidth + this.gapX);
    const y = this.startY - row * (this.tileHeight + this.gapY);
    return cc.v2(x, y);
  }

  /** Create a TileView for given color and position. */
  private createTileView(
    row: number,
    col: number,
    color: TileColor
  ): TileView | null {
    if (!this.tilePrefab) {
      debugLog('BoardFiller', 'WARNING: tilePrefab is not set');
      return null;
    }

    const tile = cc.instantiate(this.tilePrefab);
    tile.parent = this.node;

    tile.width = this.tileWidth;
    tile.height = this.tileHeight;

    const sprite =
      tile.getComponent(cc.Sprite) || tile.getComponentInChildren(cc.Sprite);

    if (sprite) {
      // 1. Special case for mega bomb
      if (color === TileColor.MegaBomb) {
        if (this.megaBombSprite) {
          sprite.spriteFrame = this.megaBombSprite;
        } else {
          debugLog(
            'BoardFiller',
            'WARNING: megaBombSprite is not assigned in inspector'
          );
        }
      } else {
        // 2. Regular colored tiles — by index from TILE_COLORS
        const idx = TILE_COLORS.indexOf(color);
        if (idx >= 0 && idx < this.tileSprites.length) {
          sprite.spriteFrame = this.tileSprites[idx];
        } else {
          debugLog('BoardFiller', `WARNING: no sprite for color=${color}`);
        }
      }
    }

    const pos = this.getTilePosition(row, col);
    tile.setPosition(pos);

    const view = tile.getComponent(TileView);
    if (view) {
      view.setup(row, col, color);
      return view;
    }

    debugLog('BoardFiller', 'WARNING: TileView component not found on prefab');
    return null;
  }

  /**
   * Remove TileViews for specified cells with "burn" animation.
   */
  public removeTileViews(cells: TilePos[], onComplete?: () => void) {
    if (!cells || cells.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const views: TileView[] = [];
    const seen = new Set<TileView>();

    for (const { row, col } of cells) {
      const view = this.getTileView(row, col);
      if (!view) continue;
      if (seen.has(view)) continue;
      seen.add(view);
      views.push(view);

      if (this.viewGrid[row]) {
        this.viewGrid[row][col] = null;
      }
    }

    if (views.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    let pending = views.length;

    const finishOne = () => {
      pending--;
      if (pending === 0 && onComplete) {
        onComplete();
      }
    };

    for (const view of views) {
      if (view.button) {
        view.button.interactable = false;
      }

      cc.Tween.stopAllByTarget(view.node);

      view.playBurn(() => {
        view.node.destroy();
        finishOne();
      });
    }
  }

  /**
   * Change sprite of an existing tile to mega bomb sprite.
   */
  public setMegaBombVisual(row: number, col: number) {
    const view = this.getTileView(row, col);
    if (!view) {
      debugLog('BoardFiller', `setMegaBombVisual: no view at ${row},${col}`);
      return;
    }

    const sprite =
      view.node.getComponent(cc.Sprite) ||
      view.node.getComponentInChildren(cc.Sprite);

    if (!sprite) {
      debugLog(
        'BoardFiller',
        `setMegaBombVisual: no Sprite on tile at ${row},${col}`
      );
      return;
    }

    if (!this.megaBombSprite) {
      debugLog('BoardFiller', 'setMegaBombVisual: megaBombSprite not assigned');
      return;
    }

    debugLog(
      'BoardFiller',
      `setMegaBombVisual: row=${row}, col=${col}, apply megaBombSprite`
    );

    sprite.spriteFrame = this.megaBombSprite;
  }

  public playBombShake(
    duration: number = 0.18,
    strength: number = 14,
    onComplete?: () => void
  ) {
    const node = this.node;
    cc.Tween.stopAllByTarget(node);

    const originalPos = node.position.clone();

    const offsets = [
      cc.v2(-strength, 0),
      cc.v2(strength, 0),
      cc.v2(0, strength),
      cc.v2(0, -strength),
      cc.v2(0, 0),
    ];

    const step = duration / offsets.length;

    let t = cc.tween(node);

    offsets.forEach((off) => {
      const targetPos = cc.v2(originalPos.x + off.x, originalPos.y + off.y);
      t = t.to(step, { position: targetPos });
    });

    t.call(() => {
      node.setPosition(originalPos);
      if (onComplete) onComplete();
    }).start();
  }

  public playBombFlash(
    centerRow: number,
    centerCol: number,
    radius: number = 1,
    duration: number = 0.25
  ) {
    if (!this.bombFlashSprite) {
      return;
    }

    const centerView = this.getTileView(centerRow, centerCol);
    if (!centerView) {
      return;
    }

    const flashNode = new cc.Node('BombFlash');
    const sprite = flashNode.addComponent(cc.Sprite);
    sprite.spriteFrame = this.bombFlashSprite;

    flashNode.parent = this.node;
    flashNode.setPosition(centerView.node.position);

    const tileW = centerView.node.width;
    const tileH = centerView.node.height;

    const factor = 1 + radius * 0.8;
    flashNode.width = tileW * factor * 2;
    flashNode.height = tileH * factor * 2;

    flashNode.opacity = 0;
    flashNode.scale = 0.7;

    cc.tween(flashNode)
      .to(duration * 0.4, { opacity: 220, scale: 1.05 })
      .to(duration * 0.6, { opacity: 0, scale: 1.4 })
      .call(() => {
        flashNode.destroy();
      })
      .start();
  }
}
