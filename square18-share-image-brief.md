# Square18 — Shareable Results Image Feature Brief

## Overview
After round settlement, generate a shareable image that looks like a premium sports graphic. The image is generated on-device using `react-native-view-shot` to capture a styled React Native view, then shared via the native iOS share sheet.

---

## Trigger
Add a "Share Results 📸" button on the settlement screen, below the existing "Share Settlement Text" button.

---

## Image Design

### Dimensions
1080x1080px (square, optimized for Instagram/iMessage)

### Style
- Background: #000000 black
- Primary text: #FFFFFF white
- Accent/money positive: #b8953a gold
- Money negative: #8b2020 red
- Dividers: #333333 dark gray
- Font: Use system bold fonts (no custom fonts needed)
- Subtle "via Square18" watermark at bottom center in small gray text

### Layout (top to bottom)

**Header section**
- "SQUARE18" wordmark top-left in small gold caps
- Date top-right (e.g. "SAT MAR 8") in small white caps
- Course name centered below header (e.g. "Aspetuck Valley CC") in white

**Divider line**

**Results section — "MATCH RESULTS"**
Label in small gold caps

Each player on their own row:
- Player name left-aligned in white bold
- Net amount right-aligned: green + for winners, red - for losers
- Winning player(s) get a subtle gold left border or highlight
- Rows ordered: biggest winner first, biggest loser last

**Divider line**

**Highlights section — "HIGHLIGHTS"**
Label in small gold caps

Up to 3 highlight cards, each showing:
- Emoji icon + bold headline
- Supporting detail in smaller white text

Highlight types (compute from round data):

1. **Biggest Moment 🦅**
   - Find the best gross score relative to par across all players and holes
   - Eagle = "Eagle on [Hole #]" (priority)
   - Birdie = "Birdie on [Hole #]"
   - Show: "[Player] • [Hole description]"
   - Example: "Mike • Eagle on 14"

2. **Biggest Choke 💀**
   - Find the worst gross score relative to par + handicap strokes on that hole
   - Adjusted score = gross score - par - strokes given on that hole
   - Highest adjusted score = biggest choke
   - Show: "[Player] • [Score] on [Hole #]"
   - Example: "Tom • +4 on 17"

3. **Momentum Swing ⚡**
   - Find the hole where the match lead changed by the most
   - For Nassau: track cumulative hole-by-hole score, find biggest single-hole swing
   - For Skins: find the hole with the highest skin value (most carry-overs)
   - For Wolf/5-3-1: find the hole with the biggest points swing
   - Show: "[Player] took the lead on [Hole #]"

**Divider line**

**Watermark**
- "via Square18" centered, small, #555555 gray

---

## Technical Implementation

### Library
Use `react-native-view-shot` to capture the styled view as a PNG.

Install: `npx expo install react-native-view-shot`

### Component
Create `src/components/ShareableResultsCard.tsx`
- A React Native View styled to match the design above
- Rendered off-screen via absolute positioning
- Captured via `viewShotRef.current.capture()` when share button is tapped

### Share flow
```typescript
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const viewShotRef = useRef(null);

const handleShareImage = async () => {
  const uri = await viewShotRef.current.capture();
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Share Match Results'
  });
};
```

### Data needed (pass as props to ShareableResultsCard)
```typescript
interface ShareCardProps {
  date: string
  courseName: string
  players: Player[]
  netPerPlayer: Record<string, number>
  scores: Record<string, number[]>
  holes: Hole[]
  gameStyle: string
  round: Round
}
```

### Highlight computation
Create `src/engine/highlights.ts`:
```typescript
export function getBiggestMoment(players, scores, holes): Highlight
export function getBiggestChoke(players, scores, holes, round): Highlight
export function getMomentumSwing(players, scores, holes, round): Highlight
```

Each returns `{ label: string, detail: string, emoji: string }` or null if not computable.

---

## Files to Create/Modify
- `src/components/ShareableResultsCard.tsx` — new styled card component
- `src/engine/highlights.ts` — new highlight computation functions
- `app/settlement.tsx` — add Share Results button, wire up ViewShot ref
- `package.json` — add react-native-view-shot and expo-sharing

---

## Implementation Notes
- If a highlight can't be computed (e.g. no birdies), skip that section gracefully
- expo-sharing may already be installed — check before adding to package.json
- Keep the watermark subtle — "via Square18" should feel like a badge, not an ad
- The card is captured as a static image — no interactivity needed
