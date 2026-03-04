import { ASPETUCK } from '../data/aspetuck';
import { SIDE_BET_TYPES } from '../data/sideBetTypes';
import type { MatchSettlement } from './matchPlay';
import type { SkinResult } from './skins';

function stripHandle(handle: string | undefined): string {
  return handle?.replace(/^@/, '') || '';
}

/** Deep link: request = scorekeeper is owed; pay = scorekeeper owes. */
export function venmoDeepLink(
  recipientHandle: string | undefined,
  amount: number,
  note: string,
  txn: 'pay' | 'request',
): string {
  const handle = stripHandle(recipientHandle);
  const encoded = encodeURIComponent(note || 'Square18');
  return `venmo://paycharge?txn=${txn}&recipients=${handle}&amount=${amount}&note=${encoded}`;
}

export function venmoLink(recipientHandle: string | undefined, amount: number, note: string): string {
  return venmoDeepLink(recipientHandle, amount, note, 'pay');
}

/** Web link for use in settlement text (iMessage); no @ in handle. */
export function venmoWebLink(handle: string | undefined): string {
  const h = stripHandle(handle);
  return h ? `venmo.com/u/${h}` : '';
}

export function iMessageLink(body: string): string {
  return `sms:&body=${encodeURIComponent(body)}`;
}

export interface SettlementRoundLike {
  tee: string;
  gameStyle: 'matchplay' | 'skins';
  players: { id: number; name: string; initials: string; venmo?: string }[];
  teams: { id: number; playerIds: number[] }[];
  stakes: { front: number; back: number; total: number };
  skinValue: number;
  sideBets: { id: string | number; type: string; hole: number | null; amount: number }[];
}

export interface SkinsSettlementSummary {
  skinResults: SkinResult[];
  skinsWon: Record<number, number>;
  perSkin: number;
}

export interface SettlementTextOptions {
  netPerPlayer: Record<number, number>;
  matchContrib?: Record<number, number>;
  sbNet?: Record<number, number>;
  birdieCounts?: Record<number, number>;
}

function teamName(round: SettlementRoundLike, teamPlayerIds: number[], scorekeeperId: number): string {
  return teamPlayerIds
    .map((id) => {
      const p = round.players.find((x) => x.id === id);
      return p ? (id === scorekeeperId ? 'YOU' : p.name) : '';
    })
    .filter(Boolean)
    .join(' & ');
}

export function buildSettlementText(
  round: SettlementRoundLike,
  settlement: MatchSettlement | null,
  skinsSettlement: SkinsSettlementSummary | null,
  sideBetWinners: Record<string | number, number | undefined>,
  options: SettlementTextOptions,
): string {
  const scorekeeper = round.players[0];
  const scorekeeperId = scorekeeper?.id ?? 0;
  const netPerPlayer = options.netPerPlayer;
  const matchContrib = options.matchContrib ?? {};
  const sbNet = options.sbNet ?? {};
  const birdieCounts = options.birdieCounts ?? {};

  const lines: string[] = [
    `⛳ Square18 — ${ASPETUCK.name}`,
    `${round.tee} tees · ${round.gameStyle === 'matchplay' ? 'Match Play' : 'Skins'}${round.players.length === 2 ? ' · 1v1' : ''}`,
    '',
  ];

  if (round.gameStyle === 'matchplay' && settlement) {
    const t1 = teamName(round, round.teams[0].playerIds, scorekeeperId);
    const t2 = teamName(round, round.teams[1].playerIds, scorekeeperId);
    lines.push(`${t1} vs ${t2}`);
    lines.push('');
    lines.push(
      `Front 9:  ${settlement.front.result > 0 ? t1 : settlement.front.result < 0 ? t2 : 'Tied'} win${settlement.front.result !== 0 ? `  ($${Math.abs(settlement.fAmt)})` : '   ($0)'}`,
    );
    lines.push(
      `Back 9:   ${settlement.back.result > 0 ? t1 : settlement.back.result < 0 ? t2 : 'Tied'}${settlement.back.result !== 0 ? `  ($${Math.abs(settlement.bAmt)})` : '      ($0)'}`,
    );
    lines.push(
      `Overall:  ${settlement.total.result > 0 ? t1 : settlement.total.result < 0 ? t2 : 'Tied'}${settlement.total.result !== 0 ? `  ($${Math.abs(settlement.tAmt)})` : '      ($0)'}`,
    );
    settlement.pressDetails.forEach((p) => {
      const winner = p.result > 0 ? t1 : p.result < 0 ? t2 : 'Tied';
      lines.push(`🔁 Press H${p.startHole}:  ${winner}  ($${Math.abs(p.amt)})`);
    });
    const net = Math.abs(settlement.net);
    const teamSize = round.teams[0].playerIds.length;
    const netLine =
      settlement.net === 0
        ? 'All square'
        : `${settlement.net > 0 ? t2 : t1} owe${teamSize === 1 ? 's' : ''} ${settlement.net > 0 ? t1 : t2} $${net} total${teamSize > 1 ? ` ($${Math.round(net / teamSize)} each)` : ''}`;
    lines.push('');
    lines.push(`NET: ${netLine}`);
  }

  if (round.gameStyle === 'skins' && skinsSettlement) {
    const totalSkins = skinsSettlement.skinResults.reduce((s, r) => s + (r.skinsWon ?? 0), 0);
    round.players
      .slice()
      .sort((a, b) => skinsSettlement.skinsWon[b.id] - skinsSettlement.skinsWon[a.id])
      .forEach((p) => {
        const won = skinsSettlement.skinsWon[p.id];
        const amt = won * skinsSettlement.perSkin;
        const name = p.id === scorekeeperId ? 'You' : p.name;
        lines.push(`${name}: ${won} skin${won !== 1 ? 's' : ''} = $${amt}`);
      });
  }

  if (round.sideBets.length > 0) {
    lines.push('');
    lines.push('─────────────────────────');
    lines.push('SIDE BETS');
    lines.push('');
    round.sideBets.forEach((sb) => {
      const type = SIDE_BET_TYPES.find((t) => t.id === sb.type);
      const winnerId = sideBetWinners[sb.id];
      const winner = winnerId ? round.players.find((p) => p.id === winnerId) : null;
      const pot = sb.amount * round.players.length;
      const holeLabel = sb.hole != null ? ` · Hole ${sb.hole}` : '';
      lines.push(`${type?.label ?? sb.type}${holeLabel} · $${pot} pot`);
      if (winner) {
        const birdieNote = sb.type === 'birdie' && birdieCounts[winner.id] != null ? ` (${birdieCounts[winner.id]} birdies)` : '';
        lines.push(`Winner: ${winner.id === scorekeeperId ? 'You' : winner.name}${birdieNote}`);
        round.players
          .filter((p) => p.id !== winner.id)
          .forEach((p) => {
            const link = venmoWebLink(winner.venmo);
            const name = p.id === scorekeeperId ? 'You' : p.name;
            const toName = winner.id === scorekeeperId ? 'You' : winner.name;
            lines.push(`${name} owes ${toName} $${sb.amount}${link ? ` → ${link}` : ''}`);
          });
      } else {
        lines.push('Winner: TBD');
      }
      lines.push('');
    });
  }

  lines.push('─────────────────────────');
  lines.push('SETTLE UP');
  lines.push('');
  round.players.forEach((p) => {
    const net = Math.round(netPerPlayer[p.id] ?? 0);
    const name = p.id === scorekeeperId ? 'You' : p.name;
    const m = Math.round(matchContrib[p.id] ?? 0);
    const s = Math.round(sbNet[p.id] ?? 0);
    let breakdown = '';
    if (round.gameStyle === 'matchplay' && (m !== 0 || s !== 0)) {
      const parts: string[] = [];
      if (m !== 0) parts.push(`(match) $${m}`);
      if (s !== 0) parts.push(`(side bets) ${s > 0 ? '+' : ''}$${s}`);
      breakdown = ` ${parts.join(' + ')} = `;
    }
    const owesOrCollects = net >= 0 ? 'collects' : 'owes';
    const netStr = `$${Math.abs(net)} net`;
    const link = p.venmo ? ` → ${venmoWebLink(p.venmo)}` : '';
    lines.push(`${name}  ${owesOrCollects}${breakdown}${netStr}${link}`);
  });

  lines.push('');
  lines.push('─────────────────────────');
  lines.push('Powered by Square18');
  return lines.join('\n');
}

