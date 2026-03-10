import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Player {
  id: number;
  name: string;
  initials: string;
  index: number;
  venmo: string;
}

export interface Team {
  id: number;
  playerIds: number[];
}

export interface SideBet {
  id: number;
  type: string;
  hole: number | null;
  amount: number;
}

export interface WolfDecision {
  wolfIndex: number;
  partnerId: number | null;
  isBlind: boolean;
}

export type WolfDecisions = Record<number, WolfDecision>;

export interface RoundConfig {
  gameStyle: 'matchplay' | 'skins' | 'fivethreeone' | 'wolf';
  tee: string;
  numHoles?: '18' | 'front9' | 'back9';
  stakes: { front: number; back: number; total: number };
  skinValue: number;
  autoPress: boolean;
  pressAt: number;
  sideBets: SideBet[];
  /** 5-3-1 only: 'perPoint' = $ per point, 'fixedPot' = total pot */
  five31Mode?: 'perPoint' | 'fixedPot';
  /** 5-3-1 only: dollars per point or total pot $ */
  five31Value?: number;
  /** Wolf only: stake per hole */
  wolfValue?: number;
  /** Wolf only: decisions per hole */
  wolfDecisions?: WolfDecisions;
}

export type Scores = Record<number, Record<number, number>>;

export function buildDefaultTeams(players: Player[]): Team[] {
  if (players.length === 2) {
    return [
      { id: 1, playerIds: [players[0].id] },
      { id: 2, playerIds: [players[1].id] },
    ];
  }
  if (players.length === 4) {
    return [
      { id: 1, playerIds: [players[0].id, players[2].id] },
      { id: 2, playerIds: [players[1].id, players[3].id] },
    ];
  }
  return [
    { id: 1, playerIds: players.length > 0 ? [players[0].id] : [] },
    { id: 2, playerIds: players.length > 1 ? [players[1].id] : [] },
  ];
}

const DEFAULT_PLAYERS: Player[] = [
  { id: 1, name: 'You', initials: 'YO', index: 8.4, venmo: '@you' },
  { id: 2, name: 'Mike', initials: 'MG', index: 14.2, venmo: '@mike-g' },
];

const DEFAULT_TEAMS = buildDefaultTeams(DEFAULT_PLAYERS);

interface RoundState {
  players: Player[];
  teams: Team[];
  round: RoundConfig & { players: Player[]; teams: Team[]; scores: Scores };
  scores: Scores;
  sideBetWinners: Record<number, number>;
  currentHole: number;
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  setTeams: (teams: Team[] | ((prev: Team[]) => Team[])) => void;
  setRound: (round: Partial<RoundState['round']> | ((prev: RoundState['round']) => RoundState['round'])) => void;
  setScores: (scores: Scores | ((prev: Scores) => Scores)) => void;
  setSideBetWinner: (sideBetId: number, playerId: number | undefined) => void;
  setCurrentHole: (hole: number) => void;
  setWolfDecision: (hole: number, decision: WolfDecision) => void;
  startRound: () => void;
  resetRound: () => void;
}

const defaultRound: RoundConfig & { players: Player[]; teams: Team[]; scores: Scores; wolfDecisions?: WolfDecisions } = {
  gameStyle: 'matchplay',
  tee: 'Blue',
  stakes: { front: 10, back: 10, total: 20 },
  skinValue: 5,
  autoPress: true,
  pressAt: 2,
  sideBets: [],
  five31Mode: 'perPoint',
  five31Value: 1,
  players: DEFAULT_PLAYERS,
  teams: DEFAULT_TEAMS,
  scores: {},
  wolfDecisions: {},
};

export const useRoundStore = create<RoundState>()(
  persist(
    (set) => ({
      players: DEFAULT_PLAYERS,
      teams: DEFAULT_TEAMS,
      round: { ...defaultRound },
      scores: {},
      sideBetWinners: {},
      currentHole: 1,

      setPlayers: (players) =>
        set((s) => ({
          players: typeof players === 'function' ? players(s.players) : players,
        })),

      setTeams: (teams) =>
        set((s) => ({
          teams: typeof teams === 'function' ? teams(s.teams) : teams,
        })),

      setRound: (round) =>
        set((s) => ({
          round: typeof round === 'function' ? round(s.round) : { ...s.round, ...round },
        })),

      setScores: (scores) =>
        set((s) => ({
          scores: typeof scores === 'function' ? scores(s.scores) : scores,
          round: { ...s.round, scores: typeof scores === 'function' ? scores(s.scores) : scores },
        })),

      setSideBetWinner: (sideBetId, playerId) =>
        set((s) => ({
          sideBetWinners: { ...s.sideBetWinners, [sideBetId]: playerId ?? undefined },
        })),

      setCurrentHole: (currentHole) => set({ currentHole }),

      setWolfDecision: (hole, decision) =>
        set((s) => ({
          round: {
            ...s.round,
            wolfDecisions: { ...(s.round.wolfDecisions ?? {}), [hole]: decision },
          },
        })),


      startRound: () =>
        set((s) => {
          const finalTeams = s.players.length === 4 ? s.teams : buildDefaultTeams(s.players);
          const freshScores: Scores = {};
          return {
            teams: finalTeams,
            round: {
              ...s.round,
              players: s.players,
              teams: finalTeams,
              scores: freshScores,
              wolfDecisions: {},
            },
            currentHole: 1,
            scores: freshScores,
          };
        }),

      resetRound: () =>
        set({
          players: DEFAULT_PLAYERS,
          teams: DEFAULT_TEAMS,
          round: { ...defaultRound, players: DEFAULT_PLAYERS, teams: DEFAULT_TEAMS, sideBets: [], scores: {} },
          scores: {},
          sideBetWinners: {},
          currentHole: 1,
        }),
    }),
    {
      name: 'square18-round',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        players: s.players,
        teams: s.teams,
        round: { ...s.round, wolfDecisions: s.round.wolfDecisions ?? {} },
        scores: s.scores,
        sideBetWinners: s.sideBetWinners,
        currentHole: s.currentHole,
      }),
      merge: (persistedState, currentState) => {
        console.log('[RoundStore] Merging persisted state', !!persistedState);
        const merged = { ...currentState, ...(persistedState as object) };
        if (!Array.isArray(merged.players) || merged.players.length < 2) {
          console.log('[RoundStore] Invalid players in persisted state, using defaults');
          merged.players = currentState.players;
        }
        if (!Array.isArray(merged.teams)) {
          merged.teams = buildDefaultTeams(merged.players);
        }
        if (!merged.round || typeof merged.round !== 'object') {
          merged.round = { ...defaultRound, players: merged.players, teams: merged.teams };
        }
        merged.round.wolfDecisions = merged.round.wolfDecisions ?? {};
        return merged;
      },
      onRehydrateStorage: () => (state, err) => {
        if (err) console.error('[RoundStore] Rehydration error:', err);
        else console.log('[RoundStore] Rehydration complete, players:', state?.players?.length);
      },
    }
  )
);
