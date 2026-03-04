export interface SideBetConfig {
  id: number | string;
  type: string;
  hole: number | null;
  amount: number;
}

export interface PlayerLike {
  id: number;
}

export function computeSideBetNet(
  sideBets: SideBetConfig[],
  sideBetWinners: Record<string | number, number | undefined>,
  players: PlayerLike[],
): Record<number, number> {
  const net: Record<number, number> = {};
  players.forEach((p) => {
    net[p.id] = 0;
  });
  sideBets.forEach((sb) => {
    const winnerId = sideBetWinners[sb.id];
    if (!winnerId) return;
    players.forEach((p) => {
      if (p.id === winnerId) net[p.id] += sb.amount * (players.length - 1);
      else net[p.id] -= sb.amount;
    });
  });
  return net;
}

