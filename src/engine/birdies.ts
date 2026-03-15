import type { HoleInfo } from '../types/course';
import type { Scores } from './matchPlay';

/** Count gross birdies per player (grossScore < par = one under or better). No handicap. */
export function countBirdies(scores: Scores, playerIds: number[], holes: HoleInfo[]): Record<number, number> {
  const counts: Record<number, number> = {};
  playerIds.forEach((id) => {
    counts[id] = 0;
  });
  holes.forEach((hd) => {
    const holeNum = hd.hole;
    const par = hd.par;
    playerIds.forEach((id) => {
      const gross = scores[id]?.[holeNum];
      if (gross != null && gross < par) counts[id]++;
    });
  });
  return counts;
}

export interface BirdiePoolResult {
  winnerIds: number[];
  birdieCount: number;
  netPerPlayer: Record<number, number>;
}

/**
 * Auto-determine birdie pool winner(s). Most birdies wins. Tie = split pot equally.
 * No birdies = no money changes hands.
 */
export function computeBirdiePoolResult(
  birdieCounts: Record<number, number>,
  playerIds: number[],
  amount: number,
): BirdiePoolResult {
  const netPerPlayer: Record<number, number> = {};
  playerIds.forEach((id) => {
    netPerPlayer[id] = 0;
  });
  const maxBirdies = Math.max(...playerIds.map((id) => birdieCounts[id] ?? 0), 0);
  if (maxBirdies === 0) {
    return { winnerIds: [], birdieCount: 0, netPerPlayer };
  }
  const winnerIds = playerIds.filter((id) => (birdieCounts[id] ?? 0) === maxBirdies);
  const numWinners = winnerIds.length;
  const numLosers = playerIds.length - numWinners;
  const totalPot = amount * numLosers;
  const perWinner = numWinners > 0 ? totalPot / numWinners : 0;
  winnerIds.forEach((id) => {
    netPerPlayer[id] = perWinner;
  });
  playerIds.filter((id) => !winnerIds.includes(id)).forEach((id) => {
    netPerPlayer[id] = -amount;
  });
  return { winnerIds, birdieCount: maxBirdies, netPerPlayer };
}

