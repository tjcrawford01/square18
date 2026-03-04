import { useState } from "react";

// ─── ASPETUCK VALLEY CC ───────────────────────────────────────────────────────
const ASPETUCK = {
  name: "Aspetuck Valley CC",
  location: "Weston, CT",
  tees: [
    { name: "Black", rating: 72.4, slope: 128, color: "#1a1a1a" },
    { name: "Blue",  rating: 70.5, slope: 126, color: "#1a4a8a" },
    { name: "White", rating: 68.8, slope: 125, color: "#e8e8e8" },
    { name: "Green", rating: 67.5, slope: 122, color: "#2d6a4f" },
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

// ─── SIDE BET TYPES ──────────────────────────────────────────────────────────
const SIDE_BET_TYPES = [
  { id: "ctp",       label: "📍 Closest to Pin",  desc: "Par 3s only",               par3only: true,  par3exclude: false, noHole: false },
  { id: "longdrive", label: "💨 Longest Drive",    desc: "Par 4s & 5s",               par3only: false, par3exclude: true,  noHole: false },
  { id: "birdie",    label: "🐦 Birdie Pool",      desc: "Most birdies wins the pot",  par3only: false, par3exclude: false, noHole: true  },
];

// ─── HANDICAP ENGINE ─────────────────────────────────────────────────────────
function courseHandicap(index, tee) {
  return Math.round(index * (tee.slope / 113) + (tee.rating - 71));
}
function strokesOnHole(courseHcp, si) {
  if (courseHcp <= 0) return 0;
  if (courseHcp >= si) return 1 + (courseHcp > 18 && courseHcp - 18 >= si ? 1 : 0);
  return 0;
}
function netScore(gross, courseHcp, si) {
  return gross - strokesOnHole(courseHcp, si);
}

// Best ball 2v2: returns { result: +N (t1 leads) / -N (t2 leads), holesPlayed }
function teamMatchResult(scores, hcps, t1ids, t2ids, startHole, endHole) {
  let result = 0, holesPlayed = 0;
  for (let h = startHole; h <= endHole; h++) {
    const hd = ASPETUCK.holes[h - 1];
    const b1 = Math.min(...t1ids.map(id => { const g = scores[id]?.[h]; return g == null ? Infinity : netScore(g, hcps[id]||0, hd.si); }));
    const b2 = Math.min(...t2ids.map(id => { const g = scores[id]?.[h]; return g == null ? Infinity : netScore(g, hcps[id]||0, hd.si); }));
    if (b1 === Infinity || b2 === Infinity) continue;
    holesPlayed++;
    if (b1 < b2) result++;
    else if (b2 < b1) result--;
  }
  return { result, holesPlayed };
}

// Skins engine
function computeSkins(scores, hcps, playerIds) {
  let carryover = 0;
  const results = [];
  for (let h = 1; h <= 18; h++) {
    const hd = ASPETUCK.holes[h - 1];
    const nets = playerIds.map(id => { const g = scores[id]?.[h]; return { id, net: g == null ? Infinity : netScore(g, hcps[id]||0, hd.si) }; });
    if (nets.some(n => n.net === Infinity)) { results.push({ hole: h, winner: null, pending: true, carryover }); continue; }
    const best = Math.min(...nets.map(n => n.net));
    const winners = nets.filter(n => n.net === best);
    if (winners.length === 1) {
      const skinsWon = 1 + carryover;
      results.push({ hole: h, winner: winners[0].id, skinsWon, carryover, pending: false, tied: false });
      carryover = 0;
    } else {
      results.push({ hole: h, winner: null, skinsWon: 0, carryover, pending: false, tied: true });
      carryover++;
    }
  }
  return results;
}

// Count GROSS birdies per player (no handicap strokes applied)
function countBirdies(scores, playerIds) {
  const counts = {};
  playerIds.forEach(id => { counts[id] = 0; });
  for (let h = 1; h <= 18; h++) {
    const par = ASPETUCK.holes[h-1].par;
    playerIds.forEach(id => {
      const g = scores[id]?.[h]; // gross score only
      if (g != null && g <= par - 1) counts[id]++;
    });
  }
  return counts;
}

// ─── PRESS ENGINE ─────────────────────────────────────────────────────────────
// Given match state after each hole, determine active presses on a nine.
// A press is triggered when a team goes down by pressAt holes on that nine.
// Each press is its own match for that nine only (same stake as the nine).
// Returns array of press objects: { startHole, endHole, stake }
function computePresses(scores, hcps, t1ids, t2ids, startHole, endHole, stake, pressAt) {
  const presses = [];
  let pressCursor = startHole;
  // Track cumulative match state to detect when to trigger a press
  let t1up = 0;
  for (let h = startHole; h <= endHole; h++) {
    const hd = ASPETUCK.holes[h - 1];
    const b1 = Math.min(...t1ids.map(id => { const g = scores[id]?.[h]; return g == null ? Infinity : netScore(g, hcps[id]||0, hd.si); }));
    const b2 = Math.min(...t2ids.map(id => { const g = scores[id]?.[h]; return g == null ? Infinity : netScore(g, hcps[id]||0, hd.si); }));
    if (b1 === Infinity || b2 === Infinity) continue;
    if (b1 < b2) t1up++;
    else if (b2 < b1) t1up--;
    // Check for press trigger
    const holesLeft = endHole - h;
    if (holesLeft > 0) {
      if (t1up <= -pressAt && (presses.length === 0 || presses[presses.length-1].startHole <= h - pressAt)) {
        // t2 is up pressAt, t1 presses — only trigger once per threshold crossing
        const lastPress = presses[presses.length - 1];
        if (!lastPress || lastPress.startHole < h) {
          presses.push({ startHole: h + 1, endHole, stake, by: "t1" });
        }
      } else if (t1up >= pressAt && (presses.length === 0 || presses[presses.length-1].startHole <= h - pressAt)) {
        const lastPress = presses[presses.length - 1];
        if (!lastPress || lastPress.startHole < h) {
          presses.push({ startHole: h + 1, endHole, stake, by: "t2" });
        }
      }
    }
  }
  return presses;
}

// Settlement: compute total dollars owed. Positive = t1 wins, negative = t2 wins.
function computeMatchSettlement(scores, hcps, t1ids, t2ids, stakes, autoPress, pressAt) {
  const front = teamMatchResult(scores, hcps, t1ids, t2ids, 1, 9);
  const back  = teamMatchResult(scores, hcps, t1ids, t2ids, 10, 18);
  const total = teamMatchResult(scores, hcps, t1ids, t2ids, 1, 18);
  const fAmt = Math.sign(front.result) * stakes.front;
  const bAmt = Math.sign(back.result)  * stakes.back;
  const tAmt = Math.sign(total.result) * stakes.total;
  let pressAmt = 0;
  const pressDetails = [];
  if (autoPress) {
    const frontPresses = computePresses(scores, hcps, t1ids, t2ids, 1, 9, stakes.front, pressAt);
    const backPresses  = computePresses(scores, hcps, t1ids, t2ids, 10, 18, stakes.back, pressAt);
    [...frontPresses, ...backPresses].forEach(p => {
      const pr = teamMatchResult(scores, hcps, t1ids, t2ids, p.startHole, p.endHole);
      const amt = Math.sign(pr.result) * p.stake;
      pressAmt += amt;
      pressDetails.push({ ...p, result: pr.result, amt });
    });
  }
  return { front, back, total, fAmt, bAmt, tAmt, pressAmt, pressDetails, net: fAmt + bAmt + tAmt + pressAmt };
}

// Net side bet dollars per player: positive = they collect, negative = they owe
function computeSideBetNet(sideBets, sideBetWinners, players) {
  const net = {};
  players.forEach(p => { net[p.id] = 0; });
  sideBets.forEach(sb => {
    const winnerId = sideBetWinners[sb.id];
    if (!winnerId) return;
    // Winner collects sb.amount from each other player
    players.forEach(p => {
      if (p.id === winnerId) net[p.id] += sb.amount * (players.length - 1);
      else net[p.id] -= sb.amount;
    });
  });
  return net;
}

// Build Venmo deep link
function venmoLink(recipientHandle, amount, note) {
  const handle = recipientHandle?.replace(/^@/, "") || "";
  const encoded = encodeURIComponent(note || "Square18");
  return `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amount}&note=${encoded}`;
}

// Build iMessage pre-fill URL
function iMessageLink(body) {
  return `sms:&body=${encodeURIComponent(body)}`;
}

// Build settlement text message body
function buildSettlementText(round, settlement, skinsSettlement, sideBetWinners) {
  const lines = [`⛳ Square18 — ${ASPETUCK.name}`, `${round.tee} tees · ${round.gameStyle === "matchplay" ? "Match Play" : "Skins"}`, ""];
  if (round.gameStyle === "matchplay" && settlement) {
    const t1 = round.teams[0].playerIds.map(id => round.players.find(p => p.id === id)?.name).join(" & ");
    const t2 = round.teams[1].playerIds.map(id => round.players.find(p => p.id === id)?.name).join(" & ");
    lines.push(`NASSAU: ${t1} vs ${t2}`);
    lines.push(`Front: ${settlement.front.result > 0 ? t1 : settlement.front.result < 0 ? t2 : "Tied"} ${settlement.front.result !== 0 ? `($${Math.abs(settlement.fAmt)})` : ""}`);
    lines.push(`Back:  ${settlement.back.result > 0 ? t1 : settlement.back.result < 0 ? t2 : "Tied"} ${settlement.back.result !== 0 ? `($${Math.abs(settlement.bAmt)})` : ""}`);
    lines.push(`Total: ${settlement.total.result > 0 ? t1 : settlement.total.result < 0 ? t2 : "Tied"} ${settlement.total.result !== 0 ? `($${Math.abs(settlement.tAmt)})` : ""}`);
    if (settlement.pressDetails.length > 0) lines.push(`Presses: $${Math.abs(settlement.pressAmt)}`);
    const net = Math.abs(settlement.net);
    lines.push(``, `NET: ${settlement.net > 0 ? t1 : settlement.net < 0 ? t2 : "All square"} wins $${net} total`);
    if (net > 0) {
      const perPerson = net / 2;
      const losers = settlement.net > 0 ? round.teams[1].playerIds : round.teams[0].playerIds;
      losers.forEach(id => {
        const p = round.players.find(x => x.id === id);
        if (p?.venmo) lines.push(`${p.name} → venmo.com/u/${p.venmo.replace("@","")} ($${perPerson})`);
      });
    }
  }
  if (round.gameStyle === "skins" && skinsSettlement) {
    lines.push("SKINS RESULTS:");
    round.players.slice().sort((a,b) => skinsSettlement.skinsWon[b.id] - skinsSettlement.skinsWon[a.id]).forEach(p => {
      const won = skinsSettlement.skinsWon[p.id];
      const amt = won * skinsSettlement.perSkin;
      lines.push(`${p.name}: ${won} skin${won!==1?"s":""} = $${amt}`);
    });
  }
  if (round.sideBets.length > 0) {
    lines.push("", "SIDE BETS:");
    round.sideBets.forEach(sb => {
      const type = SIDE_BET_TYPES.find(t => t.id === sb.type);
      const winnerId = sideBetWinners[sb.id];
      const winner = winnerId ? round.players.find(p => p.id === winnerId) : null;
      const pot = sb.amount * round.players.length;
      lines.push(`${type?.label}${sb.hole ? ` H${sb.hole}` : ""}: ${winner ? `${winner.name} wins $${pot}` : "TBD"}`);
    });
  }
  lines.push("", "Settle up ↓");
  return lines.join("\n");
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  ink:      "#0f1a14",
  forest:   "#1c3a28",
  fairway:  "#2d6a4f",
  rough:    "#52a875",
  cream:    "#f4efe6",
  parchment:"#e8e0d0",
  gold:     "#b8953a",
  sand:     "#c8b882",
  white:    "#ffffff",
  gray:     "#8a9e90",
  grayLight:"#ccd8cc",
  red:      "#8b2020",
  redLight: "#c0392b",
  blue:     "#1a4a8a",
};
const font = {
  display: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
  body:    "'Georgia', 'Times New Roman', serif",
  mono:    "'Courier New', Courier, monospace",
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function PhoneShell({ children }) {
  return (
    <div style={{ fontFamily: font.body, background: "#0a120e", minHeight: "100vh",
      display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "24px 0" }}>
      <div style={{ width: 390, minHeight: 820, background: C.cream, display: "flex",
        flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", borderRadius: 4 }}>
        {children}
      </div>
    </div>
  );
}
function NavBar({ title, subtitle, onBack, rightEl }) {
  return (
    <div style={{ background: C.forest, padding: "18px 20px 16px", display: "flex",
      alignItems: "center", gap: 12, borderBottom: `3px solid ${C.gold}`, flexShrink: 0 }}>
      {onBack && <button onClick={onBack} style={{ border:"none", background:"none", color:C.rough, fontSize:20, cursor:"pointer", padding:0, lineHeight:1, flexShrink:0 }}>←</button>}
      <div style={{ flex: 1 }}>
        <div style={{ color:C.cream, fontFamily:font.display, fontSize:17, fontWeight:"bold" }}>{title}</div>
        {subtitle && <div style={{ color:C.rough, fontSize:11, marginTop:1, letterSpacing:"1px", textTransform:"uppercase" }}>{subtitle}</div>}
      </div>
      {rightEl}
    </div>
  );
}
function Card({ children, style={}, accent }) {
  return <div style={{ background:C.white, borderRadius:10, padding:"14px 16px", marginBottom:10, border:`2px solid ${accent||C.grayLight}`, ...style }}>{children}</div>;
}
function SectionLabel({ children }) {
  return <div style={{ fontSize:10, letterSpacing:"2px", color:C.gray, textTransform:"uppercase", marginBottom:8, fontFamily:font.mono }}>{children}</div>;
}
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width:48, height:26, borderRadius:13, background:value?C.fairway:C.grayLight, position:"relative", cursor:"pointer", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:value?24:3, width:20, height:20, borderRadius:10, background:C.white, transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.25)" }} />
    </div>
  );
}
function PrimaryBtn({ label, onClick, disabled, color }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:"100%", padding:"16px 0", background:disabled?C.grayLight:(color||C.forest), border:"none", borderRadius:10, color:disabled?C.gray:C.cream, fontSize:15, fontWeight:"bold", fontFamily:font.display, cursor:disabled?"default":"pointer", borderBottom:disabled?"none":`3px solid ${C.gold}` }}>{label}</button>
  );
}

// ─── SCREEN: SPLASH ──────────────────────────────────────────────────────────
function Splash({ onStart }) {
  return (
    <div style={{ flex:1, background:`linear-gradient(170deg, ${C.ink} 0%, ${C.forest} 60%, #1a4a30 100%)`, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"56px 32px 48px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle at 20% 80%, rgba(184,149,58,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(82,168,117,0.06) 0%, transparent 50%)", pointerEvents:"none" }} />
      <div style={{ textAlign:"center", position:"relative" }}>
        <div style={{ fontSize:52, marginBottom:20, filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>⛳</div>
        <div style={{ fontFamily:font.display, fontSize:48, fontWeight:"bold", color:C.cream, letterSpacing:"-1px", lineHeight:1 }}>Square18</div>
        <div style={{ color:C.gold, fontSize:12, marginTop:10, letterSpacing:"4px", textTransform:"uppercase", fontFamily:font.mono }}>Set it · Play it · Square it</div>
      </div>
      <div style={{ textAlign:"center", position:"relative" }}>
        <div style={{ color:C.rough, fontSize:16, lineHeight:1.9, fontStyle:"italic", marginBottom:32 }}>
          "No spreadsheets. No math. No chasing money."
        </div>
        <div style={{ color:C.cream, fontSize:24, fontFamily:font.display, fontWeight:"bold", marginBottom:40 }}>You're square on 18.</div>
        <button onClick={onStart} style={{ width:"100%", padding:"18px 0", background:C.gold, border:"none", borderRadius:10, borderBottom:`4px solid #8a6a20`, color:C.ink, fontSize:17, fontWeight:"bold", fontFamily:font.display, cursor:"pointer" }}>
          Start a Round at Aspetuck ⛳
        </button>
        <div style={{ color:C.gray, fontSize:12, marginTop:14, fontFamily:font.mono }}>Aspetuck Valley CC · Weston, CT</div>
      </div>
    </div>
  );
}

// ─── SCREEN: SETUP PLAYERS ───────────────────────────────────────────────────
const PLAYER_COLORS = [C.forest, C.blue, C.red, "#6a3d9a"];
function SetupPlayers({ players, setPlayers, onNext }) {
  const [editing, setEditing] = useState(null);
  const upd = (id, field, value) => setPlayers(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p));

  const addPlayer = () => {
    if (players.length >= 4) return;
    const id = Date.now();
    const n = players.length + 1;
    setPlayers(ps => [...ps, { id, name:`Player ${n}`, initials:`P${n}`, index:0, venmo:"" }]);
  };

  const removePlayer = (id) => {
    if (players.length <= 2) return;
    setPlayers(ps => ps.filter(p => p.id !== id));
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
      <NavBar title="Players & Handicaps" subtitle="Step 1 of 3" />
      <div style={{ flex:1, overflowY:"auto", padding:"20px 20px 0" }}>
        <SectionLabel>Who's playing?</SectionLabel>
        {players.map((p, i) => (
          <Card key={p.id} accent={editing===p.id?C.gold:C.grayLight}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:20, background:PLAYER_COLORS[i]||C.parchment, display:"flex", alignItems:"center", justifyContent:"center", color:C.cream, fontWeight:"bold", fontSize:13, flexShrink:0, fontFamily:font.mono, border:`2px solid ${C.gold}`, marginTop:2 }}>{p.initials}</div>
              <div style={{ flex:1 }}>
                {editing===p.id ? (
                  <input autoFocus defaultValue={p.name} onBlur={e => { const name=e.target.value.trim()||p.name; const initials=name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2); upd(p.id,"name",name); upd(p.id,"initials",initials); setEditing(null); }} style={{ border:"none", outline:"none", fontSize:15, fontFamily:font.body, background:"transparent", width:"100%", color:C.ink, fontWeight:"bold" }} />
                ) : (
                  <div style={{ fontSize:15, fontWeight:"bold", color:C.ink }}>{p.name}</div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                  <div style={{ color:C.gray, fontSize:11, fontFamily:font.mono, minWidth:62 }}>HCP INDEX</div>
                  <input type="number" value={p.index??""} placeholder="—" onChange={e => upd(p.id,"index",parseFloat(e.target.value)||0)}
                    style={{ width:52, border:`1px solid ${C.grayLight}`, borderRadius:6, padding:"2px 6px", fontSize:13, fontFamily:font.mono, color:C.forest, fontWeight:"bold", textAlign:"center", outline:"none", background:C.parchment }} />
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                  <div style={{ color:C.gray, fontSize:11, fontFamily:font.mono, minWidth:62 }}>VENMO</div>
                  <input type="text" value={p.venmo??""} placeholder="@username" onChange={e => upd(p.id,"venmo",e.target.value)}
                    style={{ flex:1, border:`1px solid ${C.grayLight}`, borderRadius:6, padding:"2px 8px", fontSize:12, fontFamily:font.mono, color:C.blue, outline:"none", background:C.parchment }} />
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:2 }}>
                <button onClick={() => setEditing(p.id)} style={{ border:"none", background:"none", color:C.gray, fontSize:16, cursor:"pointer", padding:0 }}>✎</button>
                {players.length > 2 && <button onClick={() => removePlayer(p.id)} style={{ border:"none", background:"none", color:C.red, fontSize:18, cursor:"pointer", padding:0, lineHeight:1 }}>×</button>}
              </div>
            </div>
          </Card>
        ))}
        {players.length < 4 && (
          <button onClick={addPlayer} style={{ width:"100%", padding:"12px 0", border:`2px dashed ${C.grayLight}`, borderRadius:10, background:"transparent", color:C.gray, fontSize:13, cursor:"pointer", fontFamily:font.mono, marginBottom:16 }}>
            + Add Player ({players.length}/4)
          </button>
        )}
        <div style={{ background:C.parchment, borderRadius:8, padding:"10px 14px", border:`1px solid ${C.sand}`, marginBottom:16 }}>
          <div style={{ fontSize:12, color:C.gray }}>
            {players.length === 2 ? "1v1 Nassau — each player is their own team." : players.length === 3 ? "3 players — skins only (no match play)." : "4 players — 2v2 teams assigned on next screen."}
          </div>
        </div>
      </div>
      <div style={{ padding:"16px 20px", borderTop:`1px solid ${C.parchment}` }}>
        <PrimaryBtn label="Choose Game →" onClick={onNext} />
      </div>
    </div>
  );
}

// ─── SCREEN: GAME SETUP ──────────────────────────────────────────────────────
function SetupGame({ players, teams, setTeams, round, setRound, onNext, onBack }) {
  const [addingBet, setAddingBet] = useState(false);
  const [newBet, setNewBet] = useState({ type:"ctp", hole:5, amount:5 });

  const eligibleHoles = (typeId) => {
    const t = SIDE_BET_TYPES.find(x => x.id === typeId);
    if (!t) return ASPETUCK.holes.map(h => h.hole);
    if (t.par3only)    return ASPETUCK.holes.filter(h => h.par === 3).map(h => h.hole);
    if (t.par3exclude) return ASPETUCK.holes.filter(h => h.par !== 3).map(h => h.hole);
    return ASPETUCK.holes.map(h => h.hole);
  };

  const addBet = () => {
    setRound(r => ({ ...r, sideBets: [...r.sideBets, { ...newBet, id:Date.now(), winner:null }] }));
    setAddingBet(false);
    setNewBet({ type:"ctp", hole:eligibleHoles("ctp")[0], amount:5 });
  };

  const assignTeam = (pid, ti) => setTeams(prev => {
    const next = prev.map(t => ({ ...t, playerIds:t.playerIds.filter(id => id!==pid) }));
    next[ti].playerIds.push(pid);
    return next;
  });

  const isMatchPlay = round.gameStyle === "matchplay";

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
      <NavBar title="Game Setup" subtitle="Step 2 of 3" onBack={onBack} />
      <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>

        <SectionLabel>Game Style</SectionLabel>
        <div style={{ display:"flex", gap:10, marginBottom:24 }}>
          {[{id:"matchplay",icon:"🏆",label:"Match Play",desc:players.length===2?"1v1 Nassau":"2v2 Best Ball Nassau"},{id:"skins",icon:"💰",label:"Skins",desc:"Win holes, carry ties"}].map(g => (
            <button key={g.id} onClick={() => setRound(r => ({...r,gameStyle:g.id}))} style={{ flex:1, padding:"14px 10px", border:`2px solid ${round.gameStyle===g.id?C.forest:C.grayLight}`, borderRadius:10, background:round.gameStyle===g.id?C.forest:C.white, color:round.gameStyle===g.id?C.cream:C.ink, cursor:"pointer", fontFamily:font.body, textAlign:"center", borderBottom:round.gameStyle===g.id?`4px solid ${C.gold}`:`2px solid ${C.grayLight}` }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{g.icon}</div>
              <div style={{ fontWeight:"bold", fontSize:14 }}>{g.label}</div>
              <div style={{ fontSize:11, opacity:0.7, marginTop:3 }}>{g.desc}</div>
            </button>
          ))}
        </div>

        <SectionLabel>Tees</SectionLabel>
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          {ASPETUCK.tees.map(t => (
            <button key={t.name} onClick={() => setRound(r=>({...r,tee:t.name}))} style={{ flex:1, padding:"10px 4px", border:`2px solid ${round.tee===t.name?t.color:C.grayLight}`, borderRadius:8, background:round.tee===t.name?t.color:C.white, color:round.tee===t.name?(t.name==="White"?C.ink:C.cream):C.gray, fontSize:12, cursor:"pointer", fontFamily:font.mono, fontWeight:round.tee===t.name?"bold":"normal" }}>
              <div>{t.name}</div>
              <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{t.slope}/{t.rating}</div>
            </button>
          ))}
        </div>

        {isMatchPlay && players.length !== 3 && (<>
          <SectionLabel>Nassau Stakes (per match)</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
            {[["front","Front 9"],["back","Back 9"],["total","Overall"]].map(([key,label]) => (
              <div key={key}>
                <div style={{ color:C.gray, fontSize:11, fontFamily:font.mono, textAlign:"center", marginBottom:4 }}>{label}</div>
                <div style={{ background:C.white, borderRadius:8, padding:"10px 6px", border:`1px solid ${C.grayLight}`, textAlign:"center" }}>
                  <span style={{ color:C.gray, fontSize:11 }}>$</span>
                  <input type="number" value={round.stakes[key]} onChange={e => setRound(r=>({...r,stakes:{...r.stakes,[key]:parseInt(e.target.value)||0}}))}
                    style={{ width:"100%", border:"none", outline:"none", textAlign:"center", fontSize:22, fontWeight:"bold", fontFamily:font.mono, color:C.forest, background:"transparent" }} />
                </div>
              </div>
            ))}
          </div>

          {players.length === 2 ? (
            <>
              <SectionLabel>Match-up</SectionLabel>
              <Card accent={C.forest} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ textAlign:"center", flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:"bold", color:C.forest }}>{players[0].name}</div>
                    <div style={{ fontSize:11, color:C.gray, fontFamily:font.mono }}>CH {Math.round((players[0].index||0)*(126/113)+(70.5-71))}</div>
                  </div>
                  <div style={{ fontSize:18, color:C.gold, fontWeight:"bold", fontFamily:font.display }}>vs</div>
                  <div style={{ textAlign:"center", flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:"bold", color:C.blue }}>{players[1].name}</div>
                    <div style={{ fontSize:11, color:C.gray, fontFamily:font.mono }}>CH {Math.round((players[1].index||0)*(126/113)+(70.5-71))}</div>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              <SectionLabel>Teams</SectionLabel>
              {teams.map((team, ti) => (
                <Card key={team.id} accent={ti===0?C.forest:C.gold} style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, fontFamily:font.mono, color:ti===0?C.forest:C.gold, fontWeight:"bold", letterSpacing:"1px", marginBottom:10, textTransform:"uppercase" }}>Team {ti+1}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {players.map(p => { const on=team.playerIds.includes(p.id); return (
                      <button key={p.id} onClick={() => assignTeam(p.id,ti)} style={{ padding:"6px 14px", borderRadius:20, border:`2px solid ${on?(ti===0?C.forest:C.gold):C.grayLight}`, background:on?(ti===0?C.forest:C.gold):C.white, color:on?(ti===0?C.cream:C.ink):C.gray, fontSize:13, cursor:"pointer", fontFamily:font.body, fontWeight:on?"bold":"normal" }}>{p.name}</button>
                    ); })}
                  </div>
                </Card>
              ))}
            </>
          )}

          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:round.autoPress?12:0 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:"bold" }}>Auto-press</div>
                <div style={{ color:C.gray, fontSize:12, marginTop:2 }}>New bet on same nine, same amount</div>
              </div>
              <Toggle value={round.autoPress} onChange={v => setRound(r=>({...r,autoPress:v}))} />
            </div>
            {round.autoPress && (
              <div style={{ display:"flex", gap:8 }}>
                {[1,2,3].map(n => (
                  <button key={n} onClick={() => setRound(r=>({...r,pressAt:n}))} style={{ flex:1, padding:"8px 0", borderRadius:8, border:`2px solid ${round.pressAt===n?C.forest:C.grayLight}`, background:round.pressAt===n?C.forest:C.white, color:round.pressAt===n?C.cream:C.ink, fontSize:13, cursor:"pointer", fontFamily:font.mono }}>Down {n}</button>
                ))}
              </div>
            )}
          </Card>
        </>)}

        {!isMatchPlay && (<>
          <SectionLabel>Skin Value</SectionLabel>
          <div style={{ background:C.white, borderRadius:8, padding:"12px 16px", border:`1px solid ${C.grayLight}`, display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
            <span style={{ color:C.gray, fontSize:18 }}>$</span>
            <input type="number" value={round.skinValue} onChange={e => setRound(r=>({...r,skinValue:parseInt(e.target.value)||0}))}
              style={{ flex:1, border:"none", outline:"none", fontSize:28, fontWeight:"bold", fontFamily:font.mono, color:C.forest, background:"transparent" }} />
            <span style={{ color:C.gray, fontSize:14 }}>per skin</span>
          </div>
          <div style={{ background:C.parchment, borderRadius:8, padding:"10px 14px", border:`1px solid ${C.sand}`, marginBottom:20, fontSize:12, color:C.ink }}>
            {players.length} players × ${round.skinValue} = <strong style={{ color:C.forest }}>${(round.skinValue||0)*players.length} pot per skin</strong>. Ties carry.
          </div>
        </>)}

        <SectionLabel>Side Bets</SectionLabel>
        {round.sideBets.length===0 && !addingBet && <div style={{ color:C.gray, fontSize:13, fontStyle:"italic", marginBottom:12 }}>No side bets yet.</div>}
        {round.sideBets.map(sb => {
          const type = SIDE_BET_TYPES.find(t => t.id===sb.type);
          return (
            <Card key={sb.id} accent={C.sand}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:"bold" }}>{type?.label}{!type?.noHole?` · Hole ${sb.hole}`:" · 18 holes"}</div>
                  <div style={{ color:C.gray, fontSize:12, marginTop:2 }}>${sb.amount} · pot ${sb.amount*players.length}</div>
                </div>
                <button onClick={() => setRound(r=>({...r,sideBets:r.sideBets.filter(s=>s.id!==sb.id)}))} style={{ border:"none", background:"none", color:C.gray, fontSize:20, cursor:"pointer" }}>×</button>
              </div>
            </Card>
          );
        })}

        {addingBet ? (
          <Card accent={C.gold}>
            <div style={{ fontSize:13, fontWeight:"bold", marginBottom:10, color:C.ink }}>New Side Bet</div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, color:C.gray, fontFamily:font.mono, marginBottom:4 }}>TYPE</div>
              <select value={newBet.type} onChange={e => { const t=e.target.value; const bt=SIDE_BET_TYPES.find(x=>x.id===t); const holes=eligibleHoles(t); setNewBet(b=>({...b,type:t,hole:bt?.noHole?null:holes[0]})); }}
                style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.grayLight}`, fontSize:13, fontFamily:font.body, background:C.parchment, color:C.ink, outline:"none" }}>
                {SIDE_BET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:12 }}>
              {!SIDE_BET_TYPES.find(t=>t.id===newBet.type)?.noHole && (
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:C.gray, fontFamily:font.mono, marginBottom:4 }}>HOLE</div>
                  <select value={newBet.hole} onChange={e => setNewBet(b=>({...b,hole:parseInt(e.target.value)}))}
                    style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.grayLight}`, fontSize:13, fontFamily:font.body, background:C.parchment, color:C.ink, outline:"none" }}>
                    {eligibleHoles(newBet.type).map(h => { const hd=ASPETUCK.holes[h-1]; return <option key={h} value={h}>Hole {h} (Par {hd.par})</option>; })}
                  </select>
                </div>
              )}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:C.gray, fontFamily:font.mono, marginBottom:4 }}>AMOUNT ($)</div>
                <input type="number" value={newBet.amount} onChange={e => setNewBet(b=>({...b,amount:parseInt(e.target.value)||0}))}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${C.grayLight}`, fontSize:13, fontFamily:font.mono, fontWeight:"bold", color:C.forest, background:C.parchment, outline:"none", boxSizing:"border-box" }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setAddingBet(false)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:`2px solid ${C.grayLight}`, background:"transparent", fontSize:13, cursor:"pointer", fontFamily:font.body, color:C.gray }}>Cancel</button>
              <button onClick={addBet} style={{ flex:2, padding:"10px 0", borderRadius:8, border:"none", background:C.forest, color:C.cream, fontSize:13, fontWeight:"bold", cursor:"pointer", fontFamily:font.body, borderBottom:`2px solid ${C.gold}` }}>Add ✓</button>
            </div>
          </Card>
        ) : (
          <button onClick={() => setAddingBet(true)} style={{ width:"100%", padding:"12px 0", border:`2px dashed ${C.grayLight}`, borderRadius:10, background:"transparent", color:C.gray, fontSize:13, cursor:"pointer", fontFamily:font.mono, marginBottom:20 }}>+ Add Side Bet</button>
        )}
      </div>
      <div style={{ padding:"16px 20px", borderTop:`1px solid ${C.parchment}` }}>
        <PrimaryBtn label="Lock & Tee Off 🏌️" onClick={onNext} />
      </div>
    </div>
  );
}

// ─── LIVE SCOREBOARD ─────────────────────────────────────────────────────────
function ScoreboardPanel({ round, scores, hcps, currentHole }) {
  const isMatchPlay = round.gameStyle === "matchplay";
  const holesPlayed = currentHole - 1;

  if (isMatchPlay) {
    const t1 = round.teams[0].playerIds;
    const t2 = round.teams[1].playerIds;
    const getName = ids => ids.map(id => round.players.find(p=>p.id===id)?.initials||"?").join("/");

    const front = holesPlayed >= 1 ? teamMatchResult(scores,hcps,t1,t2,1,Math.min(holesPlayed,9)) : null;
    const back  = holesPlayed >= 10 ? teamMatchResult(scores,hcps,t1,t2,10,Math.min(holesPlayed,18)) : null;
    const total = holesPlayed >= 1 ? teamMatchResult(scores,hcps,t1,t2,1,Math.min(holesPlayed,18)) : null;

    // Active presses
    const frontPresses = round.autoPress && holesPlayed >= 1
      ? computePresses(scores,hcps,t1,t2,1,9,round.stakes.front,round.pressAt) : [];
    const backPresses  = round.autoPress && holesPlayed >= 10
      ? computePresses(scores,hcps,t1,t2,10,18,round.stakes.back,round.pressAt) : [];
    const activePresses = [...frontPresses,...backPresses].filter(p => p.startHole <= holesPlayed);

    const dollarBar = (() => {
      if (!total) return null;
      const fAmt = front ? Math.sign(front.result)*round.stakes.front : 0;
      const bAmt = back  ? Math.sign(back.result)*round.stakes.back   : 0;
      const tAmt = total ? Math.sign(total.result)*round.stakes.total : 0;
      let pAmt = 0;
      activePresses.forEach(p => {
        const pr = teamMatchResult(scores,hcps,t1,t2,p.startHole,Math.min(holesPlayed,p.endHole));
        pAmt += Math.sign(pr.result)*p.stake;
      });
      const net = fAmt + bAmt + tAmt + pAmt;
      return { net, leader: net > 0 ? getName(t1) : net < 0 ? getName(t2) : null };
    })();

    const Badge = ({ data, label, maxHoles }) => {
      if (!data) return <div style={{ flex:1 }} />;
      const { result, holesPlayed:hp } = data;
      const rem = maxHoles - hp;
      const dormie = Math.abs(result) > 0 && Math.abs(result) >= rem && rem > 0;
      return (
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ fontSize:9, color:"#5a8a6a", fontFamily:font.mono, letterSpacing:"1px" }}>{label}</div>
          <div style={{ fontFamily:font.mono, fontSize:22, fontWeight:"bold", lineHeight:1.1, color:result===0?"#8a9e90":result>0?"#7dd4a0":"#ff9090" }}>
            {result===0?"AS":result>0?`${result}↑`:`${Math.abs(result)}↓`}
          </div>
          {dormie && <div style={{ fontSize:8, color:C.gold, fontFamily:font.mono, fontWeight:"bold" }}>DORMIE</div>}
          {!dormie && <div style={{ fontSize:9, color:"#5a8a6a", fontFamily:font.mono }}>{result===0?"tied":result>0?getName(t1):getName(t2)}</div>}
        </div>
      );
    };

    return (
      <div style={{ background:"#0e1a12", borderTop:`2px solid #243a2c`, padding:"10px 20px 12px", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ color:"#5a8a6a", fontSize:9, fontFamily:font.mono, letterSpacing:"2px" }}>MATCH STATUS · THRU {holesPlayed}</div>
          {dollarBar && (
            <div style={{ fontFamily:font.mono, fontSize:12, fontWeight:"bold", color:dollarBar.net===0?C.gray:dollarBar.net>0?"#7dd4a0":"#ff9090" }}>
              {dollarBar.net===0?"EVEN":`${dollarBar.leader} +$${Math.abs(dollarBar.net)}`}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:4 }}>
          <Badge data={front} label="FRONT" maxHoles={9} />
          <div style={{ width:1, background:"#243a2c" }} />
          <Badge data={back}  label="BACK"  maxHoles={9} />
          <div style={{ width:1, background:"#243a2c" }} />
          <Badge data={total} label="TOTAL" maxHoles={18} />
        </div>
        {activePresses.length > 0 && (
          <div style={{ marginTop:8, borderTop:"1px solid #243a2c", paddingTop:6 }}>
            {activePresses.map((p,i) => {
              const pr = teamMatchResult(scores,hcps,t1,t2,p.startHole,Math.min(holesPlayed,p.endHole));
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#5a8a6a", fontFamily:font.mono }}>
                  <span>🔁 Press H{p.startHole}–{p.endHole} (${p.stake})</span>
                  <span style={{ color:pr.result===0?C.gray:pr.result>0?"#7dd4a0":"#ff9090", fontWeight:"bold" }}>
                    {pr.result===0?"AS":pr.result>0?`${getName(t1)} +${pr.result}`:`${getName(t2)} +${Math.abs(pr.result)}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Skins scoreboard
  const skinResults = computeSkins(scores, hcps, round.players.map(p=>p.id));
  const skinsWon = {};
  round.players.forEach(p => { skinsWon[p.id]=0; });
  skinResults.forEach(r => { if (r.winner) skinsWon[r.winner]=(skinsWon[r.winner]||0)+r.skinsWon; });
  const currentCarry = skinResults.find(r => r.hole===currentHole)?.carryover || 0;
  const hotPot = (currentCarry+1)*round.skinValue*round.players.length;

  return (
    <div style={{ background:"#0e1a12", borderTop:`2px solid #243a2c`, padding:"10px 20px 12px", flexShrink:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ color:"#5a8a6a", fontSize:9, fontFamily:font.mono, letterSpacing:"2px" }}>SKINS · THRU {holesPlayed}</div>
        {currentCarry > 0 && (
          <div style={{ background:C.red, borderRadius:6, padding:"2px 8px", color:C.cream, fontSize:10, fontFamily:font.mono, fontWeight:"bold" }}>
            🔥 ${hotPot} ON THIS HOLE
          </div>
        )}
      </div>
      <div style={{ display:"flex", gap:6 }}>
        {round.players.map(p => (
          <div key={p.id} style={{ flex:1, textAlign:"center", background:"#1a2e22", borderRadius:8, padding:"6px 4px" }}>
            <div style={{ fontSize:9, color:"#5a8a6a", fontFamily:font.mono }}>{p.initials}</div>
            <div style={{ fontSize:20, fontWeight:"bold", fontFamily:font.mono, color:skinsWon[p.id]>0?C.gold:"#5a8a6a" }}>{skinsWon[p.id]}</div>
            <div style={{ fontSize:9, color:"#5a8a6a", fontFamily:font.mono }}>${skinsWon[p.id]*round.skinValue*round.players.length}</div>
          </div>
        ))}
      </div>
      {currentCarry > 0 && (
        <div style={{ marginTop:6, color:"#5a8a6a", fontSize:10, fontStyle:"italic", textAlign:"center", fontFamily:font.mono }}>
          {currentCarry} skin{currentCarry>1?"s":""} carrying in
        </div>
      )}
    </div>
  );
}

// ─── SCREEN: ACTIVE ROUND ────────────────────────────────────────────────────
function ActiveRound({ round, setRound, onComplete }) {
  const [hole, setHole] = useState(1);
  const [scores, setScores] = useState({});
  // "remind"  = pre-hole reminder (fires when arriving at a side-bet hole)
  // "winner"   = post-hole winner picker (fires after all scores entered)
  const [popup, setPopup] = useState(null); // { mode: "remind"|"winner", bets: [...], index: 0 }
  const [sideBetWinners, setSideBetWinners] = useState({}); // sbId -> playerId — stored for settlement
  const hd = ASPETUCK.holes[hole-1];
  const tee = ASPETUCK.tees.find(t=>t.name===round.tee)||ASPETUCK.tees[1];

  const hcps = {};
  round.players.forEach(p => {
    const raw = courseHandicap(p.index||0, tee);
    hcps[p.id] = round.gameStyle==="matchplay" ? Math.round(raw*0.85) : raw;
  });

  const setScore = (pid, score) => {
    const ns = { ...scores, [pid]: { ...(scores[pid]||{}), [hole]:score } };
    setScores(ns);
    setRound(r => ({...r, scores:ns}));
    // After last score entered, open winner picker for non-birdie side bets on this hole
    const nowAllScored = round.players.every(p => (p.id === pid ? score : scores[p.id]?.[hole]) != null);
    if (nowAllScored && !popup) {
      const pending = round.sideBets.filter(sb => sb.hole === hole && sb.type !== "birdie" && !sideBetWinners[sb.id]);
      if (pending.length > 0) setPopup({ mode:"winner", bets: pending, index: 0 });
    }
  };

  const allScored = round.players.every(p => scores[p.id]?.[hole] != null);
  const sideBetsHere = round.sideBets.filter(sb => sb.hole===hole);

  // Skins carryover for this hole
  const skinResults = round.gameStyle==="skins" ? computeSkins(scores,hcps,round.players.map(p=>p.id)) : [];
  const carryHere = skinResults.find(r=>r.hole===hole)?.carryover||0;

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      {/* Hole header */}
      <div style={{ background:C.forest, borderBottom:`3px solid ${C.gold}`, padding:"14px 20px 14px", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
          <div><div style={{ color:C.rough, fontSize:9, fontFamily:font.mono, letterSpacing:"2px" }}>HOLE</div>
            <div style={{ color:C.cream, fontSize:44, fontWeight:"bold", fontFamily:font.display, lineHeight:1 }}>{hole}</div></div>
          <div style={{ textAlign:"center" }}><div style={{ color:C.rough, fontSize:9, fontFamily:font.mono, letterSpacing:"2px" }}>PAR</div>
            <div style={{ color:C.cream, fontSize:44, fontWeight:"bold", fontFamily:font.display, lineHeight:1 }}>{hd.par}</div></div>
          <div style={{ textAlign:"center" }}><div style={{ color:C.rough, fontSize:9, fontFamily:font.mono, letterSpacing:"2px" }}>SI</div>
            <div style={{ color:C.sand, fontSize:36, fontWeight:"bold", fontFamily:font.display, lineHeight:1 }}>{hd.si}</div></div>
          <div style={{ textAlign:"right" }}><div style={{ color:C.rough, fontSize:9, fontFamily:font.mono, letterSpacing:"2px" }}>YDS</div>
            <div style={{ color:C.cream, fontSize:26, fontWeight:"bold", fontFamily:font.mono, lineHeight:1 }}>{hd.yards}</div></div>
        </div>
        <div style={{ display:"flex", gap:3 }}>
          {ASPETUCK.holes.map(h => (
            <div key={h.hole} onClick={() => setHole(h.hole)} style={{ flex:1, height:4, borderRadius:2, cursor:"pointer", background:h.hole<hole?C.rough:h.hole===hole?C.gold:"rgba(255,255,255,0.2)" }} />
          ))}
        </div>
      </div>

      {/* Alert banners */}
      {sideBetsHere.length > 0 && (
        <div style={{ background:C.gold, padding:"7px 20px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
          <span>🏅</span>
          <div style={{ fontSize:12, fontWeight:"bold", color:C.ink }}>
            {sideBetsHere.map(sb => { const t=SIDE_BET_TYPES.find(x=>x.id===sb.type); return `${t?.label} · $${sb.amount*round.players.length} pot`; }).join("  ·  ")}
          </div>
        </div>
      )}
      {round.gameStyle==="skins" && carryHere > 0 && (
        <div style={{ background:C.red, padding:"7px 20px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
          <span>🔥</span>
          <div style={{ fontSize:12, fontWeight:"bold", color:C.cream }}>
            {carryHere} skin{carryHere>1?"s":""} carrying in — ${(carryHere+1)*round.skinValue*round.players.length} on the line
          </div>
        </div>
      )}

      {/* Scores */}
      <div style={{ flex:1, overflowY:"auto", padding:"14px 20px" }}>
        <SectionLabel>Enter Scores — Hole {hole}</SectionLabel>
        {round.players.map((player, i) => {
          const gs = scores[player.id]?.[hole];
          const strokes = strokesOnHole(hcps[player.id], hd.si);
          return (
            <Card key={player.id} accent={gs!=null?C.forest:C.grayLight}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:36, height:36, borderRadius:18, background:i===0?C.forest:C.parchment, display:"flex", alignItems:"center", justifyContent:"center", color:i===0?C.cream:C.ink, fontWeight:"bold", fontSize:12, flexShrink:0, fontFamily:font.mono, border:i===0?`2px solid ${C.gold}`:`2px solid ${C.grayLight}` }}>{player.initials}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:"bold" }}>{player.name}</div>
                  <div style={{ display:"flex", gap:6, marginTop:2, alignItems:"center" }}>
                    <span style={{ color:C.gray, fontSize:11, fontFamily:font.mono }}>CH {hcps[player.id]}</span>
                    {strokes>0 && <span style={{ background:C.gold, color:C.ink, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:"bold", fontFamily:font.mono }}>{"●".repeat(strokes)} +{strokes}</span>}
                  </div>
                </div>
                {gs!=null && <div style={{ fontFamily:font.mono, fontSize:14, color:gs-hd.par<0?C.fairway:gs-hd.par===0?C.gray:C.red, fontWeight:"bold" }}>{gs-hd.par===0?"E":gs-hd.par>0?`+${gs-hd.par}`:gs-hd.par}</div>}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {[hd.par-1,hd.par,hd.par+1,hd.par+2,hd.par+3].map(s => (
                  <button key={s} onClick={() => setScore(player.id,s)} style={{ flex:1, height:40, borderRadius:8, border:`2px solid ${gs===s?C.forest:C.grayLight}`, background:gs===s?C.forest:"transparent", color:gs===s?C.cream:C.ink, fontSize:16, fontWeight:"bold", cursor:"pointer", fontFamily:font.mono }}>{s}</button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {hole > 1 && <ScoreboardPanel round={round} scores={scores} hcps={hcps} currentHole={hole} />}

      <div style={{ padding:"12px 20px", background:C.white, borderTop:`1px solid ${C.parchment}`, display:"flex", gap:10, flexShrink:0 }}>
        {hole>1 && <button onClick={() => setHole(h=>h-1)} style={{ flex:1, padding:"13px 0", borderRadius:10, border:`2px solid ${C.grayLight}`, background:"transparent", fontSize:14, cursor:"pointer", fontFamily:font.body, color:C.ink }}>← Back</button>}
        {hole<18
          ? <button onClick={() => {
              if (!allScored) return;
              const nextHole = hole + 1;
              // Check for side bets on the NEXT hole → show reminder before advancing
              const upcoming = round.sideBets.filter(sb => sb.hole === nextHole && sb.type !== "birdie");
              if (upcoming.length > 0) {
                setPopup({ mode:"remind", bets: upcoming, index: 0, nextHole });
              } else {
                setHole(nextHole);
              }
            }} style={{ flex:2, padding:"13px 0", borderRadius:10, border:"none", background:allScored?C.forest:C.grayLight, color:allScored?C.cream:C.gray, fontSize:14, fontWeight:"bold", cursor:allScored?"pointer":"default", fontFamily:font.body, borderBottom:allScored?`3px solid ${C.gold}`:"none" }}>Next Hole →</button>
          : <button onClick={() => onComplete(sideBetWinners)} style={{ flex:2, padding:"13px 0", borderRadius:10, border:"none", background:C.gold, color:C.ink, fontSize:15, fontWeight:"bold", cursor:"pointer", fontFamily:font.display, borderBottom:`3px solid #8a6a20` }}>Finish Round ⛳</button>
        }
      </div>

      {/* ── POPUP MODALS: reminder (pre-tee) and winner picker (post-scores) ── */}
      {popup && (() => {
        const sb = popup.bets[popup.index];
        const type = SIDE_BET_TYPES.find(t => t.id === sb.type);
        const pot = sb.amount * round.players.length;

        const advanceOrClose = () => {
          const nextIndex = popup.index + 1;
          if (nextIndex < popup.bets.length) {
            setPopup({ ...popup, index: nextIndex });
          } else {
            if (popup.mode === "remind") setHole(popup.nextHole);
            setPopup(null);
          }
        };

        // ── PRE-HOLE REMINDER ──────────────────────────────────────────────────
        if (popup.mode === "remind") {
          return (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }}>
              <div style={{ width:390, background:C.forest, borderRadius:"18px 18px 0 0", padding:"32px 24px 36px", boxShadow:"0 -12px 48px rgba(0,0,0,0.6)", borderTop:`4px solid ${C.gold}` }}>
                <div style={{ textAlign:"center", marginBottom:24 }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🏅</div>
                  <div style={{ color:C.rough, fontSize:10, fontFamily:font.mono, letterSpacing:"3px", marginBottom:6 }}>SIDE BET — HOLE {popup.nextHole}</div>
                  <div style={{ fontFamily:font.display, fontSize:26, fontWeight:"bold", color:C.cream, marginBottom:6 }}>{type?.label}</div>
                  <div style={{ color:C.gold, fontFamily:font.mono, fontSize:22, fontWeight:"bold" }}>${pot} pot</div>
                  <div style={{ color:C.rough, fontSize:13, marginTop:8, fontStyle:"italic" }}>
                    {type?.desc} · ${sb.amount} per player
                  </div>
                </div>
                <button onClick={advanceOrClose} style={{ width:"100%", padding:"16px 0", background:C.gold, border:"none", borderRadius:10, color:C.ink, fontSize:16, fontWeight:"bold", cursor:"pointer", fontFamily:font.display, borderBottom:`3px solid #8a6a20` }}>
                  Got it — tee off 🏌️
                </button>
              </div>
            </div>
          );
        }

        // ── POST-HOLE WINNER PICKER ────────────────────────────────────────────
        const chosen = sideBetWinners[sb.id];
        const winner = chosen ? round.players.find(p => p.id === chosen) : null;
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }}>
            <div style={{ width:390, background:C.cream, borderRadius:"18px 18px 0 0", padding:"28px 24px 32px", boxShadow:"0 -12px 48px rgba(0,0,0,0.6)" }}>
              <div style={{ textAlign:"center", marginBottom:20 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🏅</div>
                <div style={{ color:C.gray, fontSize:10, fontFamily:font.mono, letterSpacing:"2px", marginBottom:4 }}>HOLE {hole} RESULT</div>
                <div style={{ fontFamily:font.display, fontSize:22, fontWeight:"bold", color:C.ink }}>{type?.label}</div>
                <div style={{ color:C.gray, fontSize:13, marginTop:4 }}>${pot} pot · who won it?</div>
              </div>

              {!winner ? (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {round.players.map(p => (
                    <button key={p.id} onClick={() => setSideBetWinners(prev => ({...prev, [sb.id]: p.id}))}
                      style={{ width:"100%", padding:"14px 0", borderRadius:10, border:`2px solid ${C.grayLight}`, background:C.white, color:C.ink, fontSize:15, fontWeight:"bold", cursor:"pointer", fontFamily:font.body }}>
                      {p.name}
                    </button>
                  ))}
                  <button onClick={() => advanceOrClose()}
                    style={{ background:"none", border:"none", color:C.gray, fontSize:13, cursor:"pointer", marginTop:4, fontFamily:font.mono }}>
                    Decide at the end →
                  </button>
                </div>
              ) : (
                <div style={{ textAlign:"center" }}>
                  <div style={{ background:C.forest, borderRadius:12, padding:"20px", marginBottom:16, borderBottom:`3px solid ${C.gold}` }}>
                    <div style={{ color:C.rough, fontSize:10, fontFamily:font.mono, letterSpacing:"2px", marginBottom:6 }}>WINNER</div>
                    <div style={{ color:C.cream, fontFamily:font.display, fontSize:28, fontWeight:"bold" }}>{winner.name}</div>
                    <div style={{ color:C.gold, fontFamily:font.mono, fontSize:20, fontWeight:"bold", marginTop:4 }}>+${pot}</div>
                    <div style={{ color:C.rough, fontSize:12, marginTop:4 }}>added to settlement</div>
                  </div>
                  <button onClick={() => setSideBetWinners(prev => ({...prev, [sb.id]: null}))}
                    style={{ background:"none", border:"none", color:C.gray, fontSize:12, cursor:"pointer", marginBottom:16, fontFamily:font.mono }}>← Change winner</button>
                  <button onClick={advanceOrClose}
                    style={{ width:"100%", padding:"14px 0", background:C.forest, border:"none", borderRadius:10, color:C.cream, fontSize:15, fontWeight:"bold", cursor:"pointer", fontFamily:font.display, borderBottom:`3px solid ${C.gold}` }}>
                    ✓ Saved — Continue Round
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── SCREEN: SETTLEMENT ──────────────────────────────────────────────────────
function Settlement({ round, onReset, sideBetWinners, setSideBetWinners }) {
  const tee = ASPETUCK.tees.find(t=>t.name===round.tee)||ASPETUCK.tees[1];
  const isMatchPlay = round.gameStyle==="matchplay";

  const hcps = {};
  round.players.forEach(p => {
    const raw = courseHandicap(p.index||0, tee);
    hcps[p.id] = isMatchPlay ? Math.round(raw*0.85) : raw;
  });

  const t1 = round.teams[0].playerIds;
  const t2 = round.teams[1].playerIds;
  const getNames = ids => {
    const names = ids.map(id => round.players.find(p=>p.id===id)?.name).filter(Boolean);
    return names.join(" & ");
  };

  // Match play settlement
  const settlement = isMatchPlay
    ? computeMatchSettlement(round.scores, hcps, t1, t2, round.stakes, round.autoPress, round.pressAt)
    : null;

  // Skins settlement
  const skinResults = !isMatchPlay ? computeSkins(round.scores, hcps, round.players.map(p=>p.id)) : [];
  const skinsWon = {};
  round.players.forEach(p => { skinsWon[p.id]=0; });
  skinResults.forEach(r => { if(r.winner) skinsWon[r.winner]=(skinsWon[r.winner]||0)+r.skinsWon; });
  const perSkin = round.skinValue * round.players.length;
  const skinsSettlement = !isMatchPlay ? { skinResults, skinsWon, perSkin } : null;

  // Birdie pool
  const birdiePool = round.sideBets.find(sb=>sb.type==="birdie");
  const birdieCounts = birdiePool ? countBirdies(round.scores, round.players.map(p=>p.id)) : null;

  // Side bet net per player (positive = they collect overall from side bets)
  const sbNet = computeSideBetNet(round.sideBets, sideBetWinners, round.players);

  // Build message text
  const msgText = buildSettlementText(round, settlement, skinsSettlement, sideBetWinners);

  // Per-player debt for match play including side bets, for Venmo buttons
  const getMatchDebts = () => {
    // Start from match play net (positive = t1 wins), then layer in side bets
    const matchNet = settlement ? settlement.net : 0;
    // For each losing-side player: how much do they owe total?
    // Match: each of the 2 losers pays (|matchNet|/2), each of the 2 winners receives same
    // Side bets: sbNet[id] already accounts for individual wins/losses
    return round.players.map(pid => {
      const p = round.players.find(x => x.id === pid);
      const onT1 = t1.includes(pid);
      const matchContrib = settlement
        ? (onT1 ? Math.sign(settlement.net) : -Math.sign(settlement.net)) * Math.abs(settlement.net) / 2
        : 0;
      const total = matchContrib + (sbNet[pid] || 0);
      return { player: p, total }; // positive = they collect, negative = they owe
    }).filter(x => x.player);
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
      <div style={{ background:`linear-gradient(160deg, ${C.forest} 0%, ${C.ink} 100%)`, padding:"36px 24px 28px", textAlign:"center", borderBottom:`4px solid ${C.gold}`, flexShrink:0 }}>
        <div style={{ fontSize:44, marginBottom:8 }}>⛳</div>
        <div style={{ fontFamily:font.display, fontSize:36, fontWeight:"bold", color:C.gold }}>You're Square.</div>
        <div style={{ color:C.rough, fontSize:12, marginTop:6, fontFamily:font.mono }}>
          {ASPETUCK.name} · {round.tee} tees · {isMatchPlay?"Match Play":"Skins"}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>

        {/* ── MATCH PLAY ── */}
        {isMatchPlay && settlement && (<>
          <SectionLabel>Match Results</SectionLabel>
          <Card accent={C.forest} style={{ marginBottom:16 }}>
            {[["Front 9",settlement.front.result,settlement.fAmt],["Back 9",settlement.back.result,settlement.bAmt],["Overall",settlement.total.result,settlement.tAmt]].map(([label,result,amt]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ color:C.gray, fontSize:13, minWidth:60 }}>{label}</span>
                <span style={{ fontFamily:font.mono, fontSize:12, color:result===0?C.gray:result>0?C.fairway:C.red, fontWeight:"bold", flex:1, textAlign:"center" }}>
                  {result===0?"Tied":result>0?`${getNames(t1)} wins`:`${getNames(t2)} wins`}
                </span>
                <span style={{ fontFamily:font.mono, fontSize:14, fontWeight:"bold", color:result===0?C.gray:C.gold, minWidth:36, textAlign:"right" }}>{result===0?"$0":`$${Math.abs(amt)}`}</span>
              </div>
            ))}
            {settlement.pressDetails.length > 0 && (
              settlement.pressDetails.map((p,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ color:C.gray, fontSize:12, minWidth:60 }}>🔁 Press H{p.startHole}</span>
                  <span style={{ fontFamily:font.mono, fontSize:12, color:p.result===0?C.gray:p.result>0?C.fairway:C.red, flex:1, textAlign:"center" }}>
                    {p.result===0?"Tied":p.result>0?`${getNames(t1)} wins`:`${getNames(t2)} wins`}
                  </span>
                  <span style={{ fontFamily:font.mono, fontSize:14, fontWeight:"bold", color:p.result===0?C.gray:C.gold, minWidth:36, textAlign:"right" }}>{p.result===0?"$0":`$${Math.abs(p.amt)}`}</span>
                </div>
              ))
            )}
            <div style={{ borderTop:`2px solid ${C.grayLight}`, marginTop:4, paddingTop:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:"bold", fontSize:15 }}>
                {settlement.net===0?"All Square":settlement.net>0?`${getNames(t1)} win`:`${getNames(t2)} win`}
              </span>
              <span style={{ color:C.gold, fontWeight:"bold", fontFamily:font.mono, fontSize:22 }}>${Math.abs(settlement.net)}</span>
            </div>
          </Card>

          <SectionLabel>Settle Up — Full Settlement</SectionLabel>
          {(() => {
            const debts = getMatchDebts();
            const payers  = debts.filter(d => d.total < 0);
            const collect = debts.filter(d => d.total > 0);
            if (payers.length === 0 && collect.length === 0) return (
              <Card accent={C.grayLight}><div style={{ textAlign:"center", color:C.gray, fontSize:14 }}>Everyone is even.</div></Card>
            );
            return payers.map(({ player: payer, total: payerTotal }) => {
              const owes = Math.abs(payerTotal);
              // Split what they owe proportionally to collectors
              const totalCollect = collect.reduce((s,d)=>s+d.total,0);
              return (
                <Card key={payer.id} accent={C.redLight}>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontWeight:"bold", fontSize:15 }}>{payer.name}</div>
                    <div style={{ color:C.red, fontFamily:font.mono, fontSize:18, fontWeight:"bold" }}>owes ${owes}</div>
                    <div style={{ color:C.gray, fontSize:11, marginTop:2 }}>includes match + side bets</div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {collect.map(({ player: winner, total: winnerTotal }) => {
                      const amt = totalCollect > 0 ? Math.round(owes * winnerTotal / totalCollect) : Math.round(owes / collect.length);
                      return (
                        <a key={winner.id} href={venmoLink(winner.venmo, amt, `Square18 @${ASPETUCK.name}`)}
                          style={{ flex:1, minWidth:80, background:C.blue, borderRadius:8, color:C.cream, padding:"10px 8px", fontSize:13, fontWeight:"bold", cursor:"pointer", fontFamily:font.mono, textAlign:"center", textDecoration:"none", display:"block", borderBottom:`2px solid #0f2a5a` }}>
                          Pay {winner.name}<br/><span style={{ fontSize:11, fontWeight:"normal" }}>${amt}</span>
                        </a>
                      );
                    })}
                  </div>
                </Card>
              );
            });
          })()}
        </>)}

        {/* ── SKINS ── */}
        {!isMatchPlay && skinsSettlement && (<>
          <SectionLabel>Skins Leaderboard</SectionLabel>
          <Card accent={C.gold} style={{ marginBottom:16 }}>
            {round.players.slice().sort((a,b)=>skinsWon[b.id]-skinsWon[a.id]).map((p,i) => (
              <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:i<round.players.length-1?10:0 }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  {i===0&&skinsWon[p.id]>0&&<span>🏆</span>}
                  <div style={{ fontWeight:i===0?"bold":"normal", fontSize:14 }}>{p.name}</div>
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <span style={{ fontFamily:font.mono, color:C.gray, fontSize:12 }}>{skinsWon[p.id]} skin{skinsWon[p.id]!==1?"s":""}</span>
                  <span style={{ fontFamily:font.mono, fontWeight:"bold", fontSize:18, color:skinsWon[p.id]>0?C.forest:C.gray }}>${skinsWon[p.id]*perSkin}</span>
                </div>
              </div>
            ))}
          </Card>

          {/* Skins settle up with Venmo */}
          {(() => {
            // Total pool, compute net: winners get paid by losers
            const totalPool = round.players.length * round.skinValue * skinResults.filter(r=>r.winner).reduce((sum,r)=>sum+r.skinsWon,0);
            const netAmounts = {}; // positive = net winner
            round.players.forEach(p => {
              netAmounts[p.id] = skinsWon[p.id]*perSkin - round.skinValue*skinResults.filter(r=>r.winner&&r.winner!==null).reduce((sum,r)=>sum+r.skinsWon,0)/round.players.length*round.players.length;
            });
            const payers  = round.players.filter(p=>skinsWon[p.id]===0);
            const winners = round.players.filter(p=>skinsWon[p.id]>0);
            if (winners.length===0) return null;
            return (<>
              <SectionLabel>Settle Up</SectionLabel>
              {payers.map(payer => (
                <Card key={payer.id} accent={C.redLight}>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontWeight:"bold", fontSize:14 }}>{payer.name}</div>
                    <div style={{ color:C.gray, fontSize:12, marginTop:2 }}>owes ${round.skinValue * skinResults.filter(r=>r.winner).reduce((s,r)=>s+r.skinsWon,0) / round.players.length} split across winners</div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {winners.map(w => {
                      const amt = Math.round(skinsWon[w.id]*perSkin/round.players.length);
                      return (
                        <a key={w.id} href={venmoLink(w.venmo,amt,`Square18 Skins @${ASPETUCK.name}`)}
                          style={{ flex:1, minWidth:80, background:C.blue, borderRadius:8, color:C.cream, padding:"8px 0", fontSize:12, fontWeight:"bold", cursor:"pointer", fontFamily:font.mono, textAlign:"center", textDecoration:"none", display:"block", borderBottom:`2px solid #0f2a5a` }}>
                          Pay {w.name}<br/><span style={{ fontSize:10, fontWeight:"normal" }}>${amt}</span>
                        </a>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </>);
          })()}

          <SectionLabel>Hole-by-Hole</SectionLabel>
          <Card>
            {skinsSettlement.skinResults.map(r => {
              if (r.pending) return null;
              const winner = r.winner ? round.players.find(p=>p.id===r.winner) : null;
              return (
                <div key={r.hole} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:6, marginBottom:6, borderBottom:`1px solid ${C.grayLight}` }}>
                  <span style={{ color:C.gray, fontSize:12, fontFamily:font.mono, minWidth:56 }}>Hole {r.hole}</span>
                  {r.carryover>0&&!winner&&!r.tied&&<span style={{ fontSize:10, color:C.red, fontFamily:font.mono, marginRight:4 }}>+{r.carryover} carry</span>}
                  {winner
                    ? <span style={{ fontSize:12, fontWeight:"bold", flex:1, textAlign:"center" }}>{winner.name}{r.skinsWon>1?` (${r.skinsWon}🏌️)`:""}</span>
                    : <span style={{ fontSize:12, color:C.gray, fontStyle:"italic", flex:1, textAlign:"center" }}>{r.tied?"Tied —":"—"}</span>
                  }
                  <span style={{ fontFamily:font.mono, fontSize:12, fontWeight:"bold", color:winner?C.gold:C.gray, minWidth:44, textAlign:"right" }}>
                    {winner?`$${r.skinsWon*perSkin}`:"carry"}
                  </span>
                </div>
              );
            })}
          </Card>
        </>)}

        {/* ── SIDE BETS ── */}
        {round.sideBets.length > 0 && (<>
          <SectionLabel>Side Bets</SectionLabel>
          {round.sideBets.map(sb => {
            const type = SIDE_BET_TYPES.find(t=>t.id===sb.type);
            const pot = sb.amount * round.players.length;
            const winnerId = sideBetWinners[sb.id];
            const winner = winnerId ? round.players.find(p=>p.id===winnerId) : null;
            // Birdie pool: auto-compute winner
            let birdieWinner = null;
            if (sb.type==="birdie" && birdieCounts) {
              const maxBirdies = Math.max(...round.players.map(p=>birdieCounts[p.id]));
              const birdieLeaders = round.players.filter(p=>birdieCounts[p.id]===maxBirdies&&maxBirdies>0);
              if (birdieLeaders.length===1) birdieWinner = birdieLeaders[0];
            }
            const effectiveWinner = sb.type==="birdie" ? birdieWinner : winner;

            return (
              <Card key={sb.id} accent={effectiveWinner?C.forest:C.sand}>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontWeight:"bold", fontSize:14 }}>{type?.label}{!type?.noHole?` · Hole ${sb.hole}`:""}</div>
                  <div style={{ color:C.gray, fontSize:12, marginTop:2 }}>${pot} pot</div>
                </div>

                {sb.type==="birdie" && birdieCounts ? (
                  <div>
                    {round.players.slice().sort((a,b)=>birdieCounts[b.id]-birdieCounts[a.id]).map(p => (
                      <div key={p.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:13 }}>{p.name}</span>
                        <span style={{ fontFamily:font.mono, fontSize:13, fontWeight:"bold", color:birdieCounts[p.id]>0?C.fairway:C.gray }}>{birdieCounts[p.id]} birdie{birdieCounts[p.id]!==1?"s":""}</span>
                      </div>
                    ))}
                    {birdieWinner ? (
                      <div style={{ marginTop:8, borderTop:`1px solid ${C.grayLight}`, paddingTop:8 }}>
                        <div style={{ color:C.forest, fontWeight:"bold", fontSize:13, marginBottom:8 }}>🏆 {birdieWinner.name} wins ${pot}</div>
                        {round.players.filter(p=>p.id!==birdieWinner.id).map(payer => {
                          const amt = sb.amount;
                          return (
                            <a key={payer.id} href={venmoLink(birdieWinner.venmo,amt,`Square18 Birdie Pool @${ASPETUCK.name}`)}
                              style={{ display:"block", background:C.blue, borderRadius:8, color:C.cream, padding:"8px 12px", fontSize:12, fontWeight:"bold", fontFamily:font.mono, textDecoration:"none", marginBottom:4, textAlign:"center", borderBottom:`2px solid #0f2a5a` }}>
                              {payer.name} → Pay {birdieWinner.name} ${amt}
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color:C.gray, fontSize:12, marginTop:8, fontStyle:"italic" }}>Tie — pot splits or carries (agree with group)</div>
                    )}
                  </div>
                ) : (
                  <div>
                    {!effectiveWinner ? (
                      <>
                        <div style={{ color:C.gray, fontSize:12, marginBottom:8 }}>Who won?</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {round.players.map(p => (
                            <button key={p.id} onClick={() => setSideBetWinners(prev=>({...prev,[sb.id]:p.id}))}
                              style={{ flex:1, minWidth:70, padding:"8px 4px", borderRadius:8, border:`2px solid ${C.grayLight}`, background:C.parchment, color:C.ink, fontSize:12, cursor:"pointer", fontFamily:font.body }}>
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div>
                        <div style={{ color:C.forest, fontWeight:"bold", fontSize:13, marginBottom:8 }}>🏆 {effectiveWinner.name} wins ${pot}</div>
                        {round.players.filter(p=>p.id!==effectiveWinner.id).map(payer => {
                          const amt = sb.amount;
                          return (
                            <a key={payer.id} href={venmoLink(effectiveWinner.venmo,amt,`Square18 ${type?.label} @${ASPETUCK.name}`)}
                              style={{ display:"block", background:C.blue, borderRadius:8, color:C.cream, padding:"8px 12px", fontSize:12, fontWeight:"bold", fontFamily:font.mono, textDecoration:"none", marginBottom:4, textAlign:"center", borderBottom:`2px solid #0f2a5a` }}>
                              {payer.name} → Pay {effectiveWinner.name} ${amt}
                            </a>
                          );
                        })}
                        <button onClick={() => setSideBetWinners(prev=>({...prev,[sb.id]:null}))} style={{ background:"none", border:"none", color:C.gray, fontSize:11, cursor:"pointer", marginTop:4, fontFamily:font.mono }}>← Change winner</button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </>)}

        {/* ── SEND TEXT ── */}
        <div style={{ marginTop:16 }}>
          <a href={iMessageLink(msgText)} style={{ display:"block", width:"100%", padding:"18px 0", background:C.gold, border:"none", borderRadius:10, color:C.ink, fontSize:17, fontWeight:"bold", fontFamily:font.display, cursor:"pointer", borderBottom:`4px solid #8a6a20`, textAlign:"center", textDecoration:"none", boxSizing:"border-box" }}>
            📱 Send Group Settlement Text
          </a>
          <div style={{ marginTop:8, background:C.parchment, borderRadius:8, padding:"10px 14px", border:`1px solid ${C.sand}` }}>
            <div style={{ fontSize:10, color:C.gray, fontFamily:font.mono, marginBottom:6, letterSpacing:"1px" }}>PREVIEW</div>
            <pre style={{ fontSize:11, color:C.ink, margin:0, whiteSpace:"pre-wrap", fontFamily:font.mono, lineHeight:1.5 }}>{msgText}</pre>
          </div>
        </div>

        <button onClick={onReset} style={{ width:"100%", marginTop:12, padding:"14px 0", background:"transparent", border:`2px solid ${C.grayLight}`, borderRadius:10, color:C.gray, fontSize:14, cursor:"pointer", fontFamily:font.body }}>
          Start New Round
        </button>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
const DEFAULT_PLAYERS = [
  { id:1, name:"You",  initials:"YO", index:8.4,  venmo:"@you"    },
  { id:2, name:"Mike", initials:"MG", index:14.2, venmo:"@mike-g" },
];
// Teams are always auto-assigned: player 1 vs player 2 (or team of 2 each for 4-player)
function buildDefaultTeams(players) {
  if (players.length === 2) return [{ id:1, playerIds:[players[0].id] }, { id:2, playerIds:[players[1].id] }];
  return [{ id:1, playerIds:[players[0].id, players[2].id] }, { id:2, playerIds:[players[1].id, players[3].id] }];
}
const DEFAULT_TEAMS = buildDefaultTeams(DEFAULT_PLAYERS);
const DEFAULT_ROUND = {
  gameStyle:"matchplay", tee:"Blue",
  stakes:{ front:20, back:20, total:20 },
  skinValue:5, autoPress:true, pressAt:2,
  sideBets:[], scores:{},
  players:DEFAULT_PLAYERS, teams:DEFAULT_TEAMS,
};

export default function Square18() {
  const [screen, setScreen]         = useState("splash");
  const [players, setPlayers]       = useState(DEFAULT_PLAYERS);
  const [teams, setTeams]           = useState(DEFAULT_TEAMS);
  const [round, setRound]           = useState({...DEFAULT_ROUND});
  const [sideBetWinners, setSideBetWinners] = useState({});

  const startRound = () => {
    // Auto-assign teams based on player count
    const autoTeams = buildDefaultTeams(players);
    // For 4 players, use manually assigned teams; for 2-3, always auto
    const finalTeams = players.length === 4 ? teams : autoTeams;
    setTeams(finalTeams);
    setRound(r=>({...r, players, teams:finalTeams}));
    setScreen("active");
  };
  const reset = () => {
    setPlayers(DEFAULT_PLAYERS);
    setTeams(buildDefaultTeams(DEFAULT_PLAYERS));
    setRound({...DEFAULT_ROUND, players:DEFAULT_PLAYERS, teams:buildDefaultTeams(DEFAULT_PLAYERS), sideBets:[], scores:{}});
    setSideBetWinners({});
    setScreen("splash");
  };

  return (
    <PhoneShell>
      {screen==="splash"     && <Splash onStart={() => setScreen("players")} />}
      {screen==="players"    && <SetupPlayers players={players} setPlayers={setPlayers} onNext={() => setScreen("game")} />}
      {screen==="game"       && <SetupGame players={players} teams={teams} setTeams={setTeams} round={round} setRound={setRound} onNext={startRound} onBack={() => setScreen("players")} />}
      {screen==="active"     && <ActiveRound round={round} setRound={setRound} onComplete={(winners) => { setSideBetWinners(winners); setScreen("settlement"); }} />}
      {screen==="settlement" && <Settlement round={round} onReset={reset} sideBetWinners={sideBetWinners} setSideBetWinners={setSideBetWinners} />}
    </PhoneShell>
  );
}
