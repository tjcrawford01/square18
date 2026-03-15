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

/** For 2v2: aggregate birdie counts per team. Returns teamId -> total birdies. */
export function countBirdiesPerTeam(
  birdieCounts: Record<number, number>,
  teams: TeamLike[],
): Record<number, number> {
  const teamCounts: Record<number, number> = {};
  teams.forEach((t, i) => {
    teamCounts[i] = t.playerIds.reduce((s, id) => s + (birdieCounts[id] ?? 0), 0);
  });
  return teamCounts;
}

export interface BirdiePoolResult {
  winnerIds: number[];
  birdieCount: number;
  netPerPlayer: Record<number, number>;
}

export interface TeamLike {
  playerIds: number[];
}

function is2v2(playerIds: number[], teams?: TeamLike[]): boolean {
  return (
    playerIds.length === 4 &&
    teams != null &&
    teams.length >= 2 &&
    teams[0].playerIds.length === 2 &&
    teams[1].playerIds.length === 2
  );
}

/**
 * Auto-determine birdie pool winner(s). Most birdies wins. Tie = split pot equally.
 * No birdies = no money changes hands.
 * For 2v2 match play: count birdies per team. Team with most wins. Tie = no money.
 */
export function computeBirdiePoolResult(
  birdieCounts: Record<number, number>,
  playerIds: number[],
  amount: number,
  teams?: TeamLike[],
): BirdiePoolResult {
  const netPerPlayer: Record<number, number> = {};
  playerIds.forEach((id) => {
    netPerPlayer[id] = 0;
  });

  const useTeamPayout = is2v2(playerIds, teams);
  if (useTeamPayout && teams) {
    const teamCounts = countBirdiesPerTeam(birdieCounts, teams);
    const t0Count = teamCounts[0] ?? 0;
    const t1Count = teamCounts[1] ?? 0;
    const maxTeamBirdies = Math.max(t0Count, t1Count, 0);
    if (maxTeamBirdies === 0) {
      return { winnerIds: [], birdieCount: 0, netPerPlayer };
    }
    if (t0Count === t1Count) {
      return { winnerIds: [], birdieCount: maxTeamBirdies, netPerPlayer };
    }
    const winnerTeamIdx = t0Count > t1Count ? 0 : 1;
    const loserTeamIdx = 1 - winnerTeamIdx;
    const winnerTeam = teams[winnerTeamIdx];
    const loserTeam = teams[loserTeamIdx];
    const totalToWinners = amount * loserTeam.playerIds.length;
    const perWinner = totalToWinners / winnerTeam.playerIds.length;
    winnerTeam.playerIds.forEach((id) => {
      netPerPlayer[id] += perWinner;
    });
    loserTeam.playerIds.forEach((id) => {
      netPerPlayer[id] -= amount;
    });
    return { winnerIds: winnerTeam.playerIds, birdieCount: maxTeamBirdies, netPerPlayer };
  }

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

