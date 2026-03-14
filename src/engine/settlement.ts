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

export interface SettlementTextOptions {
  netPerPlayer: Record<number, number>;
  matchContrib?: Record<number, number>;
  sbNet?: Record<number, number>;
  birdieCounts?: Record<number, number>;
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
        const name = p && p.id === scorekeeperId ? 'YOU' : p?.name?.toUpperCase() ?? '';
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
    const totalWinner =
      settlement.total.result > 0 ? t1 : settlement.total.result < 0 ? t2 : 'Tied';
    lines.push(
      `Front 9:  ${frontWinner}${frontWinner === 'Tied' ? '      ' : ' wins  '}`,
    );
    lines.push(
      `Back 9:   ${backWinner === 'Tied' ? 'Tied      ' : backWinner + ' wins'}`,
    );
    lines.push(
      `Overall:  ${totalWinner === 'Tied' ? 'Tied      ' : totalWinner + ' wins'}`,
    );
    settlement.pressDetails.forEach((p) => {
      const winner = p.result > 0 ? t1 : p.result < 0 ? t2 : 'Tied';
      lines.push(`🔁 Press H${p.startHole}-${p.endHole ?? p.startHole}: ${winner} wins`);
    });
  }

  if (round.gameStyle === 'wolf' && Object.keys(wolfNet).length > 0) {
    round.players
      .slice()
      .sort((a, b) => (wolfNet[b.id] ?? 0) - (wolfNet[a.id] ?? 0))
      .forEach((p) => {
        const net = Math.round(wolfNet[p.id] ?? 0);
        const name = p.id === scorekeeperId ? 'You' : p.name;
        const line = net >= 0 ? `${name}: +$${net}` : `${name}: -$${Math.abs(net)}`;
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
        const name = p.id === scorekeeperId ? 'You' : p.name;
        lines.push(`${name}: ${won} skin${won !== 1 ? 's' : ''} = $${amt}`);
      });
  }

  const birdiePool = round.sideBets.find((sb) => sb.type === 'birdie');
  if (birdiePool && !sideBetWinners[birdiePool.id]) {
    lines.push('');
    lines.push('Birdie Pool — no birdies this round 🕳️');
  }

  lines.push('');
  lines.push('MATCH RESULTS');
  round.players
    .slice()
    .sort((a, b) => (netPerPlayer[b.id] ?? 0) - (netPerPlayer[a.id] ?? 0))
    .forEach((p) => {
      const net = Math.round(netPerPlayer[p.id] ?? 0);
      const name = p.id === scorekeeperId ? 'You' : p.name;
      lines.push(`${name}      ${net >= 0 ? '+' : ''}$${net}`);
    });
  lines.push('');
  lines.push('SETTLE UP');
  lines.push('');
  const transactions = minTransactions(netPerPlayer);
  if (round.players.length === 2) {
    if (transactions.length === 0) {
      lines.push('Everyone is square. 🤝');
    } else {
      transactions.forEach((tx) => {
        const fromName = round.players.find((x) => x.id === tx.fromId);
        const toName = round.players.find((x) => x.id === tx.toId);
        const fromLabel = fromName?.name ?? '';
        const toLabel = toName && toName.id === scorekeeperId ? 'you' : toName?.name ?? '';
        const link = venmoWebLink(toName?.venmo);
        if (fromName?.id === scorekeeperId) {
          lines.push(`You owe ${toLabel} $${tx.amount}${link ? ` → ${link}` : ''}`);
        } else {
          lines.push(`${fromLabel} owes you $${tx.amount}${link ? ` → ${link}` : ''}`);
        }
      });
    }
  } else {
    round.players.forEach((p) => {
      const net = Math.round(netPerPlayer[p.id] ?? 0);
      const name = p.id === scorekeeperId ? 'You' : p.name;
      const line = net >= 0 ? `${name}: +$${net}` : `${name}: -$${Math.abs(net)}`;
      lines.push(line);
    });
    lines.push('');
    lines.push('Pay these amounts (min transfers):');
    lines.push('');
    if (transactions.length === 0) {
      lines.push('Everyone is square. 🤝');
    } else {
      transactions.forEach((tx) => {
        const fromName = round.players.find((x) => x.id === tx.fromId);
        const toName = round.players.find((x) => x.id === tx.toId);
        const fromLabel = fromName && fromName.id === scorekeeperId ? 'You' : fromName?.name ?? '';
        const toLabel = toName && toName.id === scorekeeperId ? 'You' : toName?.name ?? '';
        lines.push(`${fromLabel} pays ${toLabel} $${tx.amount}`);
      });
    }
  }

  const highlights = options.highlights ?? [];
  const displayHighlights = highlights.filter((h): h is HighlightLike => h != null);
  if (displayHighlights.length > 0) {
    lines.push('');
    lines.push('HIGHLIGHTS');
    displayHighlights.forEach((h) => {
      lines.push(`${h.emoji} ${h.detail}`);
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
  const headerNames = ['PAR', ...players.map((p) => (p.id === players[0].id ? 'YOU' : p.name.toUpperCase()))];
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

