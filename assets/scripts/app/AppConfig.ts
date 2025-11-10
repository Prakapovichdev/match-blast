// === BOARD CONFIG ===
export const BoardConfig = {
  rows: 9,
  cols: 9,
};

// === GAME CONFIG ===
export const GameConfig = {
  minGroupSize: 2,
  baseScorePerTile: 10,
  startMoves: 20,
  targetScore: 500,

  reshuffleLimit: 3,

  startTeleports: 5,

  bombRadius: 1,
  startBombs: 3,

  megaBombMinGroupSize: 5,
  megaBombScoreMultiplier: 2,
};
