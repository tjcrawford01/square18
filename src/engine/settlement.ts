import type { HoleInfo } from '../types/course';
import { SIDE_BET_TYPES } from '../data/sideBetTypes';
import type { MatchSettlement } from './matchPlay';
import type { SkinResult } from './skins';
import { strokesOnHole } from './handicap';

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
  const encoded = encodeURIComponent(note || 'square18');
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
  gameStyle: 'matchplay' | 'skins' | 'fivethreeone' | 'wolf';
  players: { id: number; name: string; initials: string; venmo?: string }[];
  teams: { id: number; playerIds: number[] }[];
  stakes: { front: number; back: number; total: number };
  skinValue: number;
  sideBets: { id: string | number; type: string; hole: number | null; amount: number }[];
  courseName?: string;
}

export interface SkinsSettlementSummary {
  skinResults: SkinResult[];
  skinsWon: Record<number, number>;
  perSkin: number;
}

export interface Five31ResultLike {
  playerId: number;
  points: number;
}

export interface HighlightLike {
  label: string;
  detail: string;
  emoji: string;
}

export interface BirdiePoolResultLike {
  winnerIds: number[];
  birdieCount: number;
}

export interface SettlementTextOptions {
  netPerPlayer: Record<number, number>;
  matchContrib?: Record<number, number>;
  sbNet?: Record<number, number>;
  birdieCounts?: Record<number, number>;
  birdiePoolResult?: BirdiePoolResultLike | null;
  five31Results?: Five31ResultLike[];
  wolfNet?: Record<number, number>;
  highlights?: (HighlightLike | null)[];
  dateStr?: string;
}

/** One transfer: fromId owes toId amount (rounded whole dollars). */
export interface SettlementTransaction {
  fromId: number;
  toId: number;
  amount: number;
}

/**
 * Reduce net positions to minimum number of transactions.
 * Greedy: match biggest debtor with biggest creditor, settle as much as possible, repeat.
 * netPerPlayer: positive = won/collects, negative = lost/owes.
 * Returns transactions as "[fromId] owes [toId] $amount".
 */
export function minTransactions(netPerPlayer: Record<number, number>): SettlementTransaction[] {
  const ids = Object.keys(netPerPlayer).map(Number);
  const balances = new Map<number, number>();
  ids.forEach((id) => balances.set(id, Math.round(netPerPlayer[id] ?? 0)));

  const out: SettlementTransaction[] = [];
  const getCreditors = () =>
    [...balances.entries()].filter(([, b]) => b > 0).sort((a, b) => b[1]! - a[1]!);
  const getDebtors = () =>
    [...balances.entries()].filter(([, b]) => b < 0).sort((a, b) => a[1]! - b[1]!);

  let creditors = getCreditors();
  let debtors = getDebtors();
  while (creditors.length > 0 && debtors.length > 0) {
    const [creditorId, creditAmt] = creditors[0]!;
    const [debtorId, debtAmt] = debtors[0]!;
    const amount = Math.min(creditAmt, -debtAmt);
    if (amount <= 0) break;
    out.push({ fromId: debtorId, toId: creditorId, amount });
    balances.set(creditorId, creditAmt - amount);
    balances.set(debtorId, debtAmt + amount);
    creditors = getCreditors();
    debtors = getDebtors();
  }
  return out;
}

function teamName(round: SettlementRoundLike, teamPlayerIds: number[]): string {
  return teamPlayerIds
    .map((id) => round.players.find((x) => x.id === id)?.name ?? '')
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
  const five31Results = options.five31Results ?? [];
  const wolfNet = options.wolfNet ?? {};
  const dateStr = options.dateStr ?? new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const gameLabel =
    round.gameStyle === 'matchplay' ? 'Match Play' : round.gameStyle === 'fivethreeone' ? '5-3-1' : round.gameStyle === 'wolf' ? 'Wolf' : 'Skins';
  const courseName = round.courseName || 'Course';
  const lines: string[] = [
    `🏌️ square18 results`,
    `${courseName} • ${dateStr}`,
    '',
    `${round.tee} tees · ${gameLabel}${round.players.length === 2 && round.gameStyle === 'matchplay' ? ' · 1v1' : ''}`,
    '',
  ];

  if (round.gameStyle === 'fivethreeone' && five31Results.length > 0) {
    five31Results
      .slice()
      .sort((a, b) => b.points - a.points)
      .forEach((r) => {
        const p = round.players.find((x) => x.id === r.playerId);
        const name = p?.name?.toUpperCase() ?? '';
        lines.push(`${name}:   ${r.points} pts`);
      });
    lines.push('');
  }

  if (round.gameStyle === 'matchplay' && settlement) {
    const t1 = teamName(round, round.teams[0].playerIds);
    const t2 = teamName(round, round.teams[1].playerIds);
    lines.push(`${t1} vs ${t2}`);
    lines.push('');
    const frontWinner =
      settlement.front.result > 0 ? t1 : settlement.front.result < 0 ? t2 : 'Tied';
    const backWinner =
      settlement.back.result > 0 ? t1 : settlement.back.result < 0 ? t2 : 'Tied';
    const overallWinner =
      settlement.total.result > 0 ? t1 : settlement.total.result < 0 ? t2 : 'Tied';
    const is2v2 = round.gameStyle === 'matchplay' && round.players.length === 4 &&
      round.teams?.[0]?.playerIds?.length === 2 && round.teams?.[1]?.playerIds?.length === 2;
    const winVerb = is2v2 ? 'win' : 'wins';
    const matchMult = is2v2 ? 2 : 1;
    const fAmt = settlement.front.result === 0 ? 0 : Math.abs(settlement.fAmt) * matchMult;
    const bAmt = settlement.back.result === 0 ? 0 : Math.abs(settlement.bAmt) * matchMult;
    const tAmt = settlement.total.result === 0 ? 0 : Math.abs(settlement.tAmt) * matchMult;
    lines.push(
      `Front 9:  ${frontWinner}${frontWinner === 'Tied' ? ' Tied' : ` ${winVerb} $${fAmt}`}`,
    );
    lines.push(
      `Back 9:   ${backWinner === 'Tied' ? 'Tied' : backWinner + ` ${winVerb} $${bAmt}`}`,
    );
    lines.push(
      `Overall:  ${overallWinner === 'Tied' ? 'Tied' : overallWinner + ` ${winVerb} $${tAmt}`}`,
    );
    settlement.pressDetails.forEach((pr) => {
      const winner = pr.result > 0 ? t1 : pr.result < 0 ? t2 : 'Tied';
      const pressAmt = pr.result === 0 ? 0 : Math.abs(pr.amt) * matchMult;
      lines.push(`🔁 Press H${pr.startHole}-${pr.endHole ?? pr.startHole}: ${winner}${pr.result === 0 ? ' Tied' : ` ${winVerb} $${pressAmt}`}`);
    });
    round.sideBets
      .filter((sb) => sb.type !== 'birdie' && sideBetWinners[sb.id] != null)
      .forEach((sb) => {
        const type = SIDE_BET_TYPES.find((t) => t.id === sb.type);
        const winnerId = sideBetWinners[sb.id];
        const winner = winnerId ? round.players.find((x) => x.id === winnerId) : null;
        const winnerTeam = winnerId && is2v2 ? round.teams.find((t) => t.playerIds.includes(winnerId)) : null;
        const label = type?.label ?? sb.type;
        const holeSuffix = sb.hole != null ? ` H${sb.hole}` : '';
        const amt = is2v2 && winnerTeam
          ? sb.amount * (round.players.length - winnerTeam.playerIds.length)
          : sb.amount * (round.players.length - 1);
        const winnerLabel = is2v2 && winnerTeam ? teamName(round, winnerTeam.playerIds) : (winner?.name ?? '?');
        const sbWinVerb = is2v2 && winnerTeam ? 'win' : 'wins';
        lines.push(`🏅 ${label}${holeSuffix}: ${winnerLabel} ${sbWinVerb} $${amt}`);
      });
    const bpResult = options.birdiePoolResult;
    const bp = round.sideBets.find((sb) => sb.type === 'birdie');
    if (bp && bpResult) {
      if (bpResult.winnerIds.length === 0) {
        lines.push(bpResult.birdieCount > 0 && is2v2 ? '🏅 Birdie Pool: Tied' : '🏅 Birdie Pool: no birdies 🕳️');
      } else if (is2v2 && round.teams.some((t) => bpResult!.winnerIds.every((id) => t.playerIds.includes(id)))) {
        const winnerTeam = round.teams.find((t) => bpResult!.winnerIds.every((id) => t.playerIds.includes(id)));
        const amt = bp.amount;
        lines.push(`🏅 Birdie Pool: ${winnerTeam ? teamName(round, winnerTeam.playerIds) : '?'} win $${amt}`);
      } else if (bpResult.winnerIds.length === 1) {
        const winner = round.players.find((x) => x.id === bpResult!.winnerIds[0]);
        const amt = bp.amount * (round.players.length - 1);
        lines.push(`🏅 Birdie Pool: ${winner?.name ?? '?'} wins $${amt}`);
      } else {
        const numLosers = round.players.length - bpResult.winnerIds.length;
        const perWinner = Math.round((bp.amount * numLosers) / bpResult.winnerIds.length);
        const names = bpResult.winnerIds.map((id) => round.players.find((x) => x.id === id)?.name ?? '?').join(' and ');
        lines.push(`🏅 Birdie Pool: ${names} split $${perWinner} each`);
      }
    }
    // Total = sum of displayed row amounts (match × matchMult + side bets + birdie pool)
    let displayedTotal = 0;
    displayedTotal += Math.sign(settlement.front.result) * fAmt;
    displayedTotal += Math.sign(settlement.back.result) * bAmt;
    displayedTotal += Math.sign(settlement.total.result) * tAmt;
    settlement.pressDetails.forEach((pr) => {
      displayedTotal += Math.sign(pr.result) * (pr.result === 0 ? 0 : Math.abs(pr.amt) * matchMult);
    });
    round.sideBets
      .filter((sb) => sb.type !== 'birdie' && sideBetWinners[sb.id] != null)
      .forEach((sb) => {
        const winnerId = sideBetWinners[sb.id];
        const winnerTeam = winnerId && is2v2 ? round.teams.find((t) => t.playerIds.includes(winnerId)) : null;
        const sbAmt = is2v2 && winnerTeam
          ? sb.amount * (round.players.length - winnerTeam.playerIds.length)
          : sb.amount * (round.players.length - 1);
        const t1WonSb = winnerTeam === round.teams[0];
        displayedTotal += winnerTeam ? (t1WonSb ? sbAmt : -sbAmt) : 0;
      });
    if (bp && bpResult && bpResult.winnerIds.length > 0) {
      const bpTeamWin = is2v2 && round.teams.some((t) => bpResult!.winnerIds.every((id) => t.playerIds.includes(id)));
      // Match displayed amount: 2v2 team win shows bp.amount (per-person), else team total
      const bpAmt = bpTeamWin ? bp.amount : bp.amount * (round.players.length - bpResult.winnerIds.length);
      const t1WonBp = bpTeamWin && round.teams.find((t) => bpResult!.winnerIds.every((id) => t.playerIds.includes(id))) === round.teams[0];
      displayedTotal += bpTeamWin ? (t1WonBp ? bpAmt : -bpAmt) : 0;
    }
    const totalAmt = Math.round(Math.abs(displayedTotal));
    const totalWinner = displayedTotal > 0 ? t1 : displayedTotal < 0 ? t2 : 'All Square';
    lines.push('');
    lines.push(displayedTotal !== 0 ? `${totalWinner} ${is2v2 ? 'win' : 'wins'} $${totalAmt}` : 'All Square');
  }

  if (round.gameStyle === 'wolf' && Object.keys(wolfNet).length > 0) {
    round.players
      .slice()
      .sort((a, b) => (wolfNet[b.id] ?? 0) - (wolfNet[a.id] ?? 0))
      .forEach((p) => {
        const net = Math.round(wolfNet[p.id] ?? 0);
        const line = net >= 0 ? `${p.name}: +$${net}` : `${p.name}: -$${Math.abs(net)}`;
        lines.push(line);
      });
    lines.push('');
  }

  if (round.gameStyle === 'skins' && skinsSettlement) {
    const totalSkins = skinsSettlement.skinResults.reduce((s, r) => s + (r.skinsWon ?? 0), 0);
    round.players
      .slice()
      .sort((a, b) => skinsSettlement.skinsWon[b.id] - skinsSettlement.skinsWon[a.id])
      .forEach((p) => {
        const won = skinsSettlement.skinsWon[p.id];
        const amt = won * skinsSettlement.perSkin;
        lines.push(`${p.name}: ${won} skin${won !== 1 ? 's' : ''} = $${amt}`);
      });
  }

  lines.push('');
  lines.push('SETTLE UP');
  const transactions = minTransactions(netPerPlayer);
  if (transactions.length === 0) {
    lines.push('Everyone is square. 🤝');
  } else {
    transactions.forEach((tx) => {
      const fromName = round.players.find((x) => x.id === tx.fromId);
      const toName = round.players.find((x) => x.id === tx.toId);
      const fromLabel = fromName?.name ?? '?';
      const toLabel = toName?.name ?? '?';
      const link = venmoWebLink(toName?.venmo);
      lines.push(`${fromLabel} pays ${toLabel} $${tx.amount}${link ? ` → ${link}` : ''}`);
    });
  }

  const highlightEmoji: Record<string, string> = {
    'Biggest Moment': '🔥',
    'Biggest Choke': '💀',
    'Momentum Swing': '⚡',
  };
  const highlights = options.highlights ?? [];
  const displayHighlights = highlights.filter((h): h is HighlightLike => h != null);
  if (displayHighlights.length > 0) {
    lines.push('');
    lines.push('HIGHLIGHTS');
    displayHighlights.forEach((h) => {
      const emoji = highlightEmoji[h.label] ?? h.emoji;
      lines.push(`${emoji} ${h.label}: ${h.detail}`);
    });
  }

  lines.push('');
  lines.push('Set it. Play it. Square it. — via square18');
  return lines.join('\n');
}

/** Format date for scorecard share: "Mon Mar 4, 2026" */
function scorecardDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface ScorecardShareInput {
  round: { tee: string; gameStyle: string };
  courseName: string;
  players: { id: number; name: string }[];
  scores: Record<number, Record<number, number>>;
  hcps: Record<number, number>;
  holes: HoleInfo[];
}

/** Plain-text scorecard for Share API. ● after score on stroke holes. */
export function buildScorecardShareText(input: ScorecardShareInput): string {
  const { round, players, scores, hcps, holes } = input;
  const gameLabel =
    round.gameStyle === 'matchplay' ? 'Match Play' : round.gameStyle === 'fivethreeone' ? '5-3-1' : 'Skins';
  const dateStr = scorecardDate();
  const courseName = input.courseName ?? 'Course';
  const headerNames = ['PAR', ...players.map((p) => p.name.toUpperCase())];
  const colWidths = [4, 5, ...players.map(() => 5)];
  const pad = (s: string, i: number) => s.padStart(colWidths[i] ?? 5);

  const lines: string[] = [
    `⛳ ${courseName} — ${dateStr}`,
    `${round.tee} Tees · ${gameLabel}`,
    '',
    '       ' + headerNames.map((h, i) => pad(h, i)).join('  '),
  ];

  const addHoleRow = (h: HoleInfo) => {
    const par = h.par;
    const cells = [par, ...players.map((pid) => scores[pid.id]?.[h.hole])];
    const display = cells.map((c, i) => {
      if (i === 0) return String(par);
      const gross = c as number | undefined;
      const stroke = gross != null && strokesOnHole(hcps[players[i - 1].id] ?? 0, h.si) > 0;
      return gross != null ? `${gross}${stroke ? '●' : ''}` : '—';
    });
    const row = `H${h.hole}     `.slice(0, 7) + display.map((d, i) => pad(String(d), i)).join('  ');
    lines.push(row);
  };

  holes.slice(0, 9).forEach(addHoleRow);
  const outPars = holes.slice(0, 9).reduce((s, h) => s + h.par, 0);
  const outTotals = players.map((p) =>
    holes.slice(0, 9).reduce((s, h) => s + (scores[p.id]?.[h.hole] ?? 0), 0)
  );
  lines.push('OUT    ' + [outPars, ...outTotals].map((v, i) => pad(String(v), i)).join('  '));
  lines.push('');

  holes.slice(9, 18).forEach(addHoleRow);
  const inPars = holes.slice(9, 18).reduce((s, h) => s + h.par, 0);
  const inTotals = players.map((p) =>
    holes.slice(9, 18).reduce((s, h) => s + (scores[p.id]?.[h.hole] ?? 0), 0)
  );
  lines.push('IN     ' + [inPars, ...inTotals].map((v, i) => pad(String(v), i)).join('  '));
  lines.push('');

  const totalPar = outPars + inPars;
  const totalScores = players.map((p, i) => (outTotals[i] ?? 0) + (inTotals[i] ?? 0));
  lines.push('TOTAL  ' + [totalPar, ...totalScores].map((v, i) => pad(String(v), i)).join('  '));

  return lines.join('\n');
}

