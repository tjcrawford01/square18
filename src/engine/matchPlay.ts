import type { HoleInfo } from '../data/aspetuck';
import { netScore } from './handicap';

export type Scores = Record<number, Record<number, number | undefined> | undefined>;
export type Handicaps = Record<number, number | undefined>;

export interface MatchResult {
  result: number;
  holesPlayed: number;
}

export function teamMatchResult(
  scores: Scores,
  hcps: Handicaps,
  t1ids: number[],
  t2ids: number[],
  startHole: number,
  endHole: number,
  holes: HoleInfo[],
): MatchResult {
  let result = 0;
  let holesPlayed = 0;
  for (let h = startHole; h <= endHole; h++) {
    const hd = holes[h - 1];
    const b1 = Math.min(
      ...t1ids.map((id) => {
        const g = scores[id]?.[h];
        return g == null ? Infinity : netScore(g, hcps[id] || 0, hd.si);
      }),
    );
    const b2 = Math.min(
      ...t2ids.map((id) => {
        const g = scores[id]?.[h];
        return g == null ? Infinity : netScore(g, hcps[id] || 0, hd.si);
      }),
    );
    if (b1 === Infinity || b2 === Infinity) continue;
    holesPlayed++;
    if (b1 < b2) result++;
    else if (b2 < b1) result--;
  }
  return { result, holesPlayed };
}

export interface Press {
  startHole: number;
  endHole: number;
  stake: number;
  by: 't1' | 't2';
}

export function computePresses(
  scores: Scores,
  hcps: Handicaps,
  t1ids: number[],
  t2ids: number[],
  startHole: number,
  endHole: number,
  stake: number,
  pressAt: number,
  holes: HoleInfo[],
): Press[] {
  const presses: Press[] = [];
  let pressCursor = startHole;
  let t1up = 0;
  for (let h = startHole; h <= endHole; h++) {
    const hd = holes[h - 1];
    const b1 = Math.min(
      ...t1ids.map((id) => {
        const g = scores[id]?.[h];
        return g == null ? Infinity : netScore(g, hcps[id] || 0, hd.si);
      }),
    );
    const b2 = Math.min(
      ...t2ids.map((id) => {
        const g = scores[id]?.[h];
        return g == null ? Infinity : netScore(g, hcps[id] || 0, hd.si);
      }),
    );
    if (b1 === Infinity || b2 === Infinity) continue;
    if (b1 < b2) t1up++;
    else if (b2 < b1) t1up--;
    const holesLeft = endHole - h;
    if (holesLeft > 0) {
      if (t1up <= -pressAt && (presses.length === 0 || presses[presses.length - 1].startHole <= h - pressAt)) {
        const lastPress = presses[presses.length - 1];
        if (!lastPress || lastPress.startHole < h) {
          presses.push({ startHole: h + 1, endHole, stake, by: 't1' });
        }
      } else if (t1up >= pressAt && (presses.length === 0 || presses[presses.length - 1].startHole <= h - pressAt)) {
        const lastPress = presses[presses.length - 1];
        if (!lastPress || lastPress.startHole < h) {
          presses.push({ startHole: h + 1, endHole, stake, by: 't2' });
        }
      }
    }
  }
  return presses;
}

export interface Stakes {
  front: number;
  back: number;
  total: number;
}

export interface PressDetail extends Press {
  result: number;
  amt: number;
}

export interface MatchSettlement {
  front: MatchResult;
  back: MatchResult;
  total: MatchResult;
  fAmt: number;
  bAmt: number;
  tAmt: number;
  pressAmt: number;
  pressDetails: PressDetail[];
  net: number;
}

export function computeMatchSettlement(
  scores: Scores,
  hcps: Handicaps,
  t1ids: number[],
  t2ids: number[],
  stakes: Stakes,
  autoPress: boolean,
  pressAt: number,
  holes: HoleInfo[],
): MatchSettlement {
  const front = teamMatchResult(scores, hcps, t1ids, t2ids, 1, 9, holes);
  const back = teamMatchResult(scores, hcps, t1ids, t2ids, 10, 18, holes);
  const total = teamMatchResult(scores, hcps, t1ids, t2ids, 1, 18, holes);
  const fAmt = Math.sign(front.result) * stakes.front;
  const bAmt = Math.sign(back.result) * stakes.back;
  const tAmt = Math.sign(total.result) * stakes.total;
  let pressAmt = 0;
  const pressDetails: PressDetail[] = [];
  if (autoPress) {
    const frontPresses = computePresses(scores, hcps, t1ids, t2ids, 1, 9, stakes.front, pressAt, holes);
    const backPresses = computePresses(scores, hcps, t1ids, t2ids, 10, 18, stakes.back, pressAt, holes);
    [...frontPresses, ...backPresses].forEach((p) => {
      const pr = teamMatchResult(scores, hcps, t1ids, t2ids, p.startHole, p.endHole, holes);
      const amt = Math.sign(pr.result) * p.stake;
      pressAmt += amt;
      pressDetails.push({ ...p, result: pr.result, amt });
    });
  }
  return { front, back, total, fAmt, bAmt, tAmt, pressAmt, pressDetails, net: fAmt + bAmt + tAmt + pressAmt };
}

