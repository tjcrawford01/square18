# Square18 — Cursor Kickoff Prompt

## Before you paste this prompt

1. Open Cursor (cursor.com)
2. File → Open Folder → create a new empty folder called `square18` and open it
3. Drop `square18-v4.jsx` into that folder (drag it in from Finder)
4. Hit **Command + L** to open the chat sidebar
5. Paste this entire prompt

---

I'm building a mobile app called **Square18** — a golf betting settlement app for golfers. I have a fully working React prototype (single JSX file called `square18-v4.jsx` in this folder) that I need ported to **Expo (React Native)** so it runs as a real iOS app.

I'm not a developer — I'm going to follow your instructions. Please tell me exactly what to run in the terminal, one step at a time, and wait for me to confirm before moving on. Open the Cursor terminal with **Control + `** when you need me to run something.

## Your first job

1. Read `square18-v4.jsx` fully before writing any code — all the game logic and UX flow is in there
2. Walk me through scaffolding a new Expo project inside this folder
3. Port the prototype into a proper Expo project structure
4. Get it running on my iPhone via Expo Go

## What the app does

A round of golf has 2–4 players. Before teeing off, they set up:
- **Game style**: Match Play (1v1 Nassau for 2 players, 2v2 best ball Nassau for 4 players) or Skins (any player count)
- **Tees** and **handicap indexes** for each player
- **Stakes** (dollar amounts per match or per skin)
- **Side bets**: Closest to Pin, Longest Drive, or Birdie Pool

During the round, they enter scores hole by hole. The app:
- Shows live match status / skins standings after each hole
- Pops up a reminder before side-bet holes ("CTP on this hole — $20 pot")
- Pops up a winner picker after side-bet holes
- Tracks auto-presses in match play

After hole 18, a settlement screen shows:
- Who owes what (match + side bets netted together)
- Venmo deep links for each payment
- A pre-filled iMessage with the full breakdown

## Tech decisions

- **Framework**: Expo with Expo Router (file-based navigation)
- **Storage**: AsyncStorage — rounds survive being closed mid-round
- **State**: Zustand store for active round state
- **Styling**: React Native StyleSheet — translate the inline styles from the prototype, keep the same colors and fonts
- **Fonts**: expo-font with a serif display font (Palatino if available, Georgia fallback)
- **Deep links**: `Linking.openURL()` for Venmo (`venmo://`) and iMessage (`sms:`)
- **No backend**: Everything local for MVP, no accounts or cloud sync yet
- **Language**: TypeScript

## Project structure

```
square18/
  app/
    _layout.tsx
    index.tsx              # splash screen
    setup/
      players.tsx          # player names, handicap indexes, Venmo handles
      game.tsx             # format, tees, stakes, side bets
    round/
      [hole].tsx           # active scoring screen
    settlement.tsx         # final settlement
  src/
    data/
      aspetuck.ts          # course data (hardcoded)
      sideBetTypes.ts
    engine/
      handicap.ts          # courseHandicap, strokesOnHole, netScore
      matchPlay.ts         # teamMatchResult, computePresses, computeMatchSettlement
      skins.ts             # computeSkins
      birdies.ts           # countBirdies (gross only — no handicap strokes)
      sideBets.ts          # computeSideBetNet
      settlement.ts        # buildSettlementText, venmoLink, iMessageLink
    store/
      roundStore.ts        # Zustand store + AsyncStorage persistence
    components/
      NavBar.tsx
      Card.tsx
      Toggle.tsx
      ScoreboardPanel.tsx
      SideBetPopup.tsx     # handles both "remind" and "winner" popup modes
    theme/
      colors.ts
      fonts.ts
```

## State management

Use **Zustand** with AsyncStorage persistence. The store holds:
- players (2–4), teams, round config (tee, gameStyle, stakes, sideBets, autoPress, pressAt)
- scores: `{ [playerId]: { [hole]: grossScore } }`
- sideBetWinners: `{ [sbId]: playerId }`
- currentHole: number
- popupWinners: `{ [sbId]: playerId }` (mid-round, before confirmed)

Default state is **2 players**. Teams are always auto-assigned for 2–3 players; manually assigned for 4. Use this helper:
```typescript
function buildDefaultTeams(players: Player[]) {
  if (players.length === 2) return [{ id: 1, playerIds: [players[0].id] }, { id: 2, playerIds: [players[1].id] }];
  return [{ id: 1, playerIds: [players[0].id, players[2].id] }, { id: 2, playerIds: [players[1].id, players[3].id] }];
}
```

Install these packages:
```
npx expo install zustand @react-native-async-storage/async-storage expo-font expo-linking
```

Default players (2):
```typescript
const DEFAULT_PLAYERS = [
  { id: 1, name: "You",  initials: "YO", index: 8.4,  venmo: "@you"    },
  { id: 2, name: "Mike", initials: "MG", index: 14.2, venmo: "@mike-g" },
];
```

## Key things to preserve from the prototype exactly

**All math engines** — the handicap, match play, skins, and press logic is correct. Port it verbatim into TypeScript. Do not rewrite or simplify it.

**Player count rules:**
- Default is 2 players (1v1 Nassau)
- Players screen allows 2–4 players with add/remove buttons
- 2 players: teams are auto-assigned (each player is their own "team"), team picker UI is hidden, replaced with a simple "[Player 1] vs [Player 2]" matchup card
- 3 players: Match Play is disabled, Skins only
- 4 players: Manual team assignment UI shown as before
- Skins pot label and birdie pool calculations use `players.length` dynamically, not hardcoded 4
- `teamMatchResult()` already handles single-player teams (arrays of one ID) — no changes needed to the engine

**The popup flow:**
- Pre-hole reminder: fires when navigating TO a hole that has a CTP or Long Drive side bet. Shows bet type, hole, pot size. Dismissed with "Got it — tee off."
- Winner picker: fires after the last score is entered on a side-bet hole. Player taps a name. Winner is stored and added to settlement total. No Venmo at this point — just record and continue.
- "Decide at the end" escape hatch on winner picker

**Venmo deep link format:**
```
venmo://paycharge?txn=pay&recipients={handle_without_@}&amount={amount}&note={encoded_note}
```

**iMessage format:**
```
sms:&body={encodeURIComponent(fullSettlementText)}
```

**Settlement netting:** Side bet wins/losses fold into match play totals. If someone won a CTP but lost the match, their Venmo button shows one net amount. Use `computeSideBetNet()` from the prototype.

**Gross birdies only** in Birdie Pool — no handicap strokes applied. A 5 on a par 4 is never a birdie.

**Auto-press logic** — presses apply to the same nine only, at the same stake as that nine. A press triggers when a team goes down by `pressAt` holes on that nine.

## Course data — Aspetuck Valley CC (hardcoded for MVP)

```typescript
// Par 71
export const ASPETUCK = {
  name: "Aspetuck Valley CC",
  location: "Weston, CT",
  tees: [
    { name: "Black", rating: 72.4, slope: 128 },
    { name: "Blue",  rating: 70.5, slope: 126 },
    { name: "White", rating: 68.8, slope: 125 },
    { name: "Green", rating: 67.5, slope: 122 },
  ],
  holes: [
    { hole: 1,  par: 4, si: 11, yards: 392 },
    { hole: 2,  par: 4, si: 9,  yards: 359 },
    { hole: 3,  par: 4, si: 13, yards: 349 },
    { hole: 4,  par: 5, si: 7,  yards: 570 },
    { hole: 5,  par: 3, si: 17, yards: 155 },
    { hole: 6,  par: 5, si: 1,  yards: 540 },
    { hole: 7,  par: 4, si: 3,  yards: 439 },
    { hole: 8,  par: 3, si: 15, yards: 177 },
    { hole: 9,  par: 4, si: 5,  yards: 375 },
    { hole: 10, par: 4, si: 6,  yards: 401 },
    { hole: 11, par: 5, si: 10, yards: 539 },
    { hole: 12, par: 3, si: 18, yards: 150 },
    { hole: 13, par: 4, si: 12, yards: 341 },
    { hole: 14, par: 4, si: 14, yards: 384 },
    { hole: 15, par: 4, si: 2,  yards: 392 },
    { hole: 16, par: 4, si: 4,  yards: 445 },
    { hole: 17, par: 3, si: 16, yards: 250 },
    { hole: 18, par: 4, si: 8,  yards: 378 },
  ],
};
```

## Design tokens

```typescript
export const Colors = {
  ink:       '#0f1a14',
  forest:    '#1c3a28',
  fairway:   '#2d6a4f',
  rough:     '#52a875',
  cream:     '#f4efe6',
  parchment: '#e8e0d0',
  gold:      '#b8953a',
  sand:      '#c8b882',
  white:     '#ffffff',
  gray:      '#8a9e90',
  grayLight: '#ccd8cc',
  red:       '#8b2020',
  blue:      '#1a4a8a',
};
```

## How to proceed

1. Read `square18-v4.jsx` fully first
2. Tell me what command to run to scaffold the Expo project — wait for me to confirm it ran successfully before continuing
3. Build the engine files first (pure functions, no UI) — these are the most important to get right
4. Build the Zustand store
5. Port screens one at a time in this order: Splash → Players → Game Setup → Active Round → Settlement
6. After each screen, tell me how to preview it before moving on
7. Tell me when to run `npx expo start` to test on my phone via Expo Go

## A few ground rules

- Tell me exactly what to run in the terminal, don't assume I'll figure it out
- If a package install fails, walk me through fixing it before moving on
- If you hit an Expo/React Native API question, make the standard choice — don't ask me
- If you hit a game logic question, ask me — I know the rules of golf betting
- Keep the math engines identical to the prototype. That logic has been carefully verified.

## After it runs on my phone

Once the core app works, we'll add in order:
1. Round history (last 10 rounds, win/loss record per player pairing)
2. Multi-course support via an external API
3. App Store submission

Let's start. Read the prototype file and then tell me the first command to run.
