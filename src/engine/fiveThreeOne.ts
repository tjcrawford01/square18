import type { HoleInfo } from '../types/course';
import { netScore } from './handicap';

export interface NetScoreEntry {
  playerId: number;
  net: number;
}

export interface HolePointsResult {
  playerId: number;
  points: number;
}

/**
 * Compute points for a single hole given three net scores.
 * Tie-breaking: clear 5-3-1; tie low 4-4-1; tie high 5-2-2; three-way 3-3-3.
 */
export function holePoints(netScores: NetScoreEntry[]): HolePointsResult[] {
  if (netScores.length !== 3) {
    return netScores.map(({ playerId }) => ({ playerId, points: 0 }));
  }
  const sorted = [...netScores].sort((a, b) => a.net - b.net);
  const low = sorted[0]!.net;
  const mid = sorted[1]!.net;
  const high = sorted[2]!.net;

  if (low === mid && mid === high) {
    return sorted.map(({ playerId }) => ({ playerId, points: 3 }));
  }
  if (low === mid) {
    return sorted.map((s, i) => ({
      playerId: s.playerId,
      points: i < 2 ? 4 : 1,
    }));
  }
  if (mid === high) {
    return sorted.map((s, i) => ({
      playerId: s.playerId,
      points: i === 0 ? 5 : 2,
    }));
  }
  return sorted.map((s, i) => ({
    playerId: s.playerId,
    points: i === 0 ? 5 : i === 1 ? 3 : 1,
  }));
}

export interface FiveThreeOneResult {
  playerId: number;
  points: number;
  pointsByHole: number[];
}

type Scores = Record<number, Record<number, number>>;
type Handicaps = Record<number, number>;

/**
 * Compute cumulative points over all played holes (net scores use playing handicaps).
 */
export function computeFiveThreeOne(
  scores: Scores,
  hcps: Handicaps,
  playerIds: number[],
  holes: HoleInfo[]
): FiveThreeOneResult[] {
  const pointsByPlayer: Record<number, number[]> = {};
  playerIds.forEach((id) => (pointsByPlayer[id] = []));

  for (let h = 1; h <= 18; h++) {
    const holeInfo = holes[h - 1];
    if (!holeInfo) continue;
    const netScores: NetScoreEntry[] = playerIds
      .map((id) => {
        const gross = scores[id]?.[h];
        if (gross == null) return null;
        return { playerId: id, net: netScore(gross, hcps[id] ?? 0, holeInfo.si) };
      })
      .filter((x): x is NetScoreEntry => x != null);
    if (netScores.length !== 3) continue;
    const pts = holePoints(netScores);
    pts.forEach(({ playerId, points }) => {
      pointsByPlayer[playerId]!.push(points);
    });
  }

  return playerIds.map((id) => ({
    playerId: id,
    points: (pointsByPlayer[id] ?? []).reduce((s, p) => s + p, 0),
    pointsByHole: pointsByPlayer[id] ?? [],
  }));
}

/**
 * Settlement: pairwise differentials.
 * For every pair of players, the one with fewer points pays the one with more points: payment = diff × stake.
 * Each point is worth exactly the stake amount (user-entered $ per point).
 */
export function fiveThreeOneSettlement(
  results: { playerId: number; points: number }[],
  stakePerPoint: number
): { playerId: number; net: number }[] {
  if (results.length !== 3) return results.map((r) => ({ playerId: r.playerId, net: 0 }));
  const stake = stakePerPoint;

  const netPerPlayer: Record<number, number> = {};
  results.forEach((r) => (netPerPlayer[r.playerId] = 0));

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i]!;
      const b = results[j]!;
      const diff = Math.abs(a.points - b.points);
      const amt = Math.round(diff * stake);
      if (diff > 0 && amt > 0) {
        if (a.points > b.points) {
          netPerPlayer[a.playerId] = (netPerPlayer[a.playerId] ?? 0) + amt;
          netPerPlayer[b.playerId] = (netPerPlayer[b.playerId] ?? 0) - amt;
        } else {
          netPerPlayer[b.playerId] = (netPerPlayer[b.playerId] ?? 0) + amt;
          netPerPlayer[a.playerId] = (netPerPlayer[a.playerId] ?? 0) - amt;
        }
      }
    }
  }

  return results.map((r) => ({
    playerId: r.playerId,
    net: netPerPlayer[r.playerId] ?? 0,
  }));
}
