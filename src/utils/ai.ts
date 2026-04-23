export type TileColor = 'black' | 'white';

export function aiPickTile(
  tiles: number[],
  aiScore: number,
  playerScore: number,
  round: number,
  totalRounds: number,
  playerFirst: boolean,
  /** Color of the player's already-played tile (when AI is responding). */
  playerTileColor: TileColor | null = null,
): number {
  const sorted = [...tiles].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const diff = aiScore - playerScore;
  const left = totalRounds - round + 1;
  const urgency = left <= 3 ? 1.6 : 1;

  let weights = sorted.map((_, i) => {
    const pos = i / (sorted.length - 1);
    let w = 1;
    if (diff < 0) w = 1 + pos * 2.2 * urgency;
    else if (diff > 0) w = 1 + (1 - pos) * 2;
    else w = 1 + (1 - Math.abs(pos - 0.5)) * 1.6;
    if (!playerFirst) w *= 0.8 + pos * 0.4;
    return w;
  });

  // AI is responding and knows the player's tile color.
  // Black tiles are 0,2,4,6,8 (max 8). White tiles are 1,3,5,7 (max 7).
  // Against white (max 7), an 8 guarantees a win; a 0 guarantees a loss.
  // Against black (max 8), no tile guarantees a win or loss.
  if (playerFirst && playerTileColor !== null) {
    const maxPlayer = playerTileColor === 'black' ? 8 : 7;
    const minPlayer = playerTileColor === 'black' ? 0 : 1;
    weights = weights.map((w, i) => {
      const tile = sorted[i];
      if (tile > maxPlayer) return w * 3;   // guaranteed win — boost
      if (tile < minPlayer) return w * 0.3; // guaranteed loss — avoid
      return w;
    });
  }

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < sorted.length; i++) {
    r -= weights[i];
    if (r <= 0) return sorted[i];
  }
  return sorted[sorted.length - 1];
}
