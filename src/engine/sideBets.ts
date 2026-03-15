export interface SideBetConfig {
  id: number | string;
  type: string;
  hole: number | null;
  amount: number;
}

export interface PlayerLike {
  id: number;
}

export interface TeamLike {
  playerIds: number[];
}

function is2v2(players: PlayerLike[], teams?: TeamLike[]): boolean {
  return (
    players.length === 4 &&
    teams != null &&
    teams.length >= 2 &&
    teams[0].playerIds.length === 2 &&
    teams[1].playerIds.length === 2
  );
}

export function computeSideBetNet(
  sideBets: SideBetConfig[],
  sideBetWinners: Record<string | number, number | undefined>,
  players: PlayerLike[],
  teams?: TeamLike[],
): Record<number, number> {
  const net: Record<number, number> = {};
  players.forEach((p) => {
    net[p.id] = 0;
  });

  const useTeamPayout = is2v2(players, teams);

  sideBets.forEach((sb) => {
    const winnerId = sideBetWinners[sb.id];
    if (!winnerId) return;

    if (useTeamPayout && teams) {
      const winnerTeam = teams.find((t) => t.playerIds.includes(winnerId));
      const loserTeam = teams.find((t) => !t.playerIds.includes(winnerId));
      if (winnerTeam && loserTeam) {
        const totalToWinners = sb.amount * loserTeam.playerIds.length;
        const perWinner = totalToWinners / winnerTeam.playerIds.length;
        winnerTeam.playerIds.forEach((id) => {
          net[id] += perWinner;
        });
        loserTeam.playerIds.forEach((id) => {
          net[id] -= sb.amount;
        });
        return;
      }
    }

    // Per-player (1v1 or non-2v2)
    players.forEach((p) => {
      if (p.id === winnerId) net[p.id] += sb.amount * (players.length - 1);
      else net[p.id] -= sb.amount;
    });
  });
  return net;
}

