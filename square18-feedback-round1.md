# Square18 — Feedback Round 1 Fix Brief

All edits must be made directly in `/Users/thecrawfords/Projects/square18`. Do not use the Cursor worktree.

---

## 1. Aspetuck Valley CC — Refresh Course Data
The golfapi.io API has updated ratings for Aspetuck Valley CC. The hardcoded fallback data in `src/data/aspetuckCourse.ts` may be stale. 

- On app load, if Aspetuck Valley CC is the selected course (courseID `012141520679645759931`), force a fresh fetch from the API to get current ratings/slopes
- Alternatively, delete the hardcoded file and rely entirely on the API with caching
- API auth: `Authorization: Bearer 6eb5787c-8c90-49af-9d86-abf630081069`
- Endpoint: `GET https://www.golfapi.io/api/v2.3/courses/012141520679645759931`

---

## 2. Keyboard Blocking Course Search Results
On the splash screen, when the user types in the course search box, the keyboard covers the search results list.

- Wrap the course search UI in a `KeyboardAvoidingView` with `behavior="padding"`
- Ensure the results FlatList scrolls above the keyboard
- The results should be visible while the keyboard is open

---

## 3. Remove Game Mode Hint on Players Screen
On the Players & Handicaps screen, there is a bar below the "Add Player" button that shows a hint like "1v1 Nassau — each player is their own team."

- Remove this hint bar entirely — it's unnecessary and sometimes inaccurate (e.g. Skins works with 2 players too)
- Clean up any related state or logic that drove this display

---

## 4. Side Bets — Allow Multiple Holes
Currently, Closest to Pin and Longest Drive side bets only allow selecting one hole. They should support multiple holes.

- Change the hole selector for CTP and Longest Drive from single-select to multi-select
- User can tap multiple holes to toggle them on/off
- Each selected hole is a separate side bet instance (e.g. CTP on holes 4, 7, and 12 = three separate bets)
- Store as an array of hole numbers per bet type
- Update settlement to calculate winnings per hole for multi-hole side bets

---

## 5. Live Scoring Display — Names and Color Logic

**Names:** Replace initials with first names in the live scoreboard panel at the bottom of the hole screen.
- Use `player.name.split(' ')[0]` to get first name
- For teams: "Mike/Dan +$30" not "MD +$30"

**Color logic:** The green/red color on the scoreboard should reflect who is actually winning, not who is keeping score.
- Green = the player or team that is currently ahead
- Red = the player or team that is currently behind
- If tied = neutral color (white or gray)
- This should be independent of which player is the scorekeeper (players[0])

---

## 6. Settlement Screen ("You're Square") Fixes

**A. Remove scorekeeper box**
Remove the "You're the scorekeeper" informational box at the top of the settlement screen. It's unnecessary.

**B. Merge side bets into match results**
Do not show side bets as a separate section. Include side bet winnings/losses in each player's total net amount in the main results section. The per-player net shown should already incorporate side bets.

**C. Fix Settle Up section**
The "Settle Up" section showing who owes whom is not calculating correctly. Rewrite the minimum-transactions debt settlement algorithm:
1. Calculate net per player (positive = won, negative = lost)
2. Use a greedy algorithm: match the biggest debtor with the biggest creditor, settle as much as possible, repeat
3. Result: minimum number of transactions to clear all debts
4. Display as: "[Player] owes [Player] $X"
Example: If Mike +$50, Dan -$20, Tom -$30:
- Tom pays Mike $30
- Dan pays Mike $20

**D. Simplify Venmo buttons for 3+ players**
- 2 players: show individual Venmo request/pay buttons (current behavior is fine)
- 3+ players: remove individual Venmo buttons, show only the "Send Group Settlement Text" button
- This avoids confusion with multiple simultaneous Venmo transactions

---

## 7. Replace Shareable Black Card with Enhanced Settlement Screen

Remove the separate black shareable image feature. Instead:

**A. Add highlights to the settlement screen**
Below the results section on the settlement screen, add a "Highlights" section showing:
- 🦅 Biggest Moment: best gross score relative to par (eagle/birdie)
- 💀 Biggest Choke: worst adjusted score (gross − par − strokes received)
- ⚡ Momentum Swing: hole where lead changed most

Use the existing `src/engine/highlights.ts` functions.

**B. Enhance the settlement text**
Update `src/engine/settlement.ts` `buildSettlementText()` to include highlights at the bottom of the generated text:

```
🏌️ SQUARE18 RESULTS
Aspetuck Valley CC • Sat Mar 8

MATCH RESULTS
Mike      +$50
Dan       -$20
Tom       -$30

SETTLE UP
Tom pays Mike $30
Dan pays Mike $20

HIGHLIGHTS
🦅 Mike • Eagle on 14
💀 Tom • +4 on 17
⚡ Mike took the lead on 12

Set it. Play it. Square it. — via Square18
```

**C. Make the settlement screen shareable**
Add a "Share Results 📸" button that uses React Native's built-in `Share.share()` API to share the enhanced settlement text (no image capture needed, just the formatted text). Remove `react-native-view-shot` dependency.

---

## 8. Skins — Fix Payout Calculation

Current bug: skins payout is incorrectly counting a player's own contribution.

Correct formula:
- Each skin is worth `stake × (number of OTHER players)`
- Example: $5/skin with 3 players → each skin worth $5 × 2 = $10 to the winner
- Example: $5/skin with 4 players → each skin worth $5 × 3 = $15 to the winner

Fix in:
- `src/engine/skins.ts` — update net calculation
- Live scoreboard: update running skins total display
- Settlement screen: update skins results display

---

## 9. 5-3-1 Fixes

**A. Remove "needs 5s" note** — delete this UI element from the 5-3-1 game setup or scoring screen.

**B. Fix settlement math**
Current settlement is incorrect. Correct algorithm:

With scores P1=69pts, P2=48pts, P3=45pts at $1/point:
- Net per player relative to average OR use pairwise differentials:
  - P3 owes P1: (69-45) × $1 = $24
  - P3 owes P2: (48-45) × $1 = $3
  - P2 owes P1: (69-48) × $1 = $21

The correct approach is pairwise: for every pair of players, the one with fewer points pays the one with more points the difference × stake.

Fix in `src/engine/fiveThreeOne.ts` — rewrite the settlement calculation using pairwise differentials.

---

## Priority Order
Fix in this order:
1. #8 Skins payout (math bug)
2. #9B 5-3-1 settlement math (math bug)
3. #6C Settle Up algorithm (math bug)
4. #5 Live scoring names and colors
5. #6A, #6B, #6D Settlement screen cleanup
6. #7 Enhanced settlement text + highlights on screen
7. #3 Remove game mode hint
8. #4 Multi-hole side bets
9. #2 Keyboard fix
10. #1 Aspetuck course data refresh

Let me know what changed when done.
