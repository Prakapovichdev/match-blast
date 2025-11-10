export enum TileColor {
  Green = 'green',
  Blue = 'blue',
  Purple = 'purple',
  Red = 'red',
  Yellow = 'yellow',

  // Optional logical color for mega bomb (visual may be handled separately)
  MegaBomb = 'megaBomb',
}

/** List of regular tile colors used for random generation. */
export const TILE_COLORS: TileColor[] = [
  TileColor.Green,
  TileColor.Blue,
  TileColor.Purple,
  TileColor.Red,
  TileColor.Yellow,
];

/**
 * Special type for a cell.
 * Kept separate from TileColor so we can have "normal" and "special" layers.
 */
export enum TileSpecial {
  None = 'none',
  MegaBomb = 'mega_bomb',
}

/**
 * Legacy grid type: just colors.
 * Kept for compatibility with existing code.
 */
export type TileGrid = (TileColor | null)[][];

export interface TileClickPayload {
  row: number;
  col: number;
  color: TileColor;
}

export type TilePos = { row: number; col: number };

/**
 * Tile data model for view layer.
 * `special` is optional so old code that doesn't use it still works.
 */
export interface TileModel {
  pos: TilePos;
  color: TileColor | null;
  special?: TileSpecial;
}
