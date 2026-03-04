import { ASPETUCK } from '../data/aspetuck';

export function courseHandicap(index: number, tee: (typeof ASPETUCK.tees)[number]): number {
  return Math.round(index * (tee.slope / 113) + (tee.rating - 71));
}

export function strokesOnHole(courseHcp: number, si: number): number {
  if (courseHcp <= 0) return 0;
  if (courseHcp >= si) {
    return 1 + (courseHcp > 18 && courseHcp - 18 >= si ? 1 : 0);
  }
  return 0;
}

export function netScore(gross: number, courseHcp: number, si: number): number {
  return gross - strokesOnHole(courseHcp, si);
}

