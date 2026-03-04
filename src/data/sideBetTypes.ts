export type SideBetId = 'ctp' | 'longdrive' | 'birdie';

export interface SideBetType {
  id: SideBetId;
  label: string;
  desc: string;
  par3only: boolean;
  par3exclude: boolean;
  noHole: boolean;
}

export const SIDE_BET_TYPES: SideBetType[] = [
  {
    id: 'ctp',
    label: 'Closest to Pin',
    desc: 'Par 3s only',
    par3only: true,
    par3exclude: false,
    noHole: false,
  },
  {
    id: 'longdrive',
    label: 'Longest Drive',
    desc: 'Par 4s & 5s',
    par3only: false,
    par3exclude: true,
    noHole: false,
  },
  {
    id: 'birdie',
    label: 'Birdie Pool',
    desc: 'Most birdies wins the pot',
    par3only: false,
    par3exclude: false,
    noHole: true,
  },
];

