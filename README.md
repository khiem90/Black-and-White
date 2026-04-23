# Black & White

A tile-battle game of bluff and deduction. Each player gets nine numbered
tiles (0–8); each round you both lay down one face-down tile, and the
higher number wins the round. The trick: **the numbers are never revealed**
— only the *colour* of your tile leaks to your opponent. Do that nine times,
and the higher score wins the match.

Built as a single-page React + TypeScript app with two play modes:

- **Play vs. AI** — a self-pacing opponent with an adaptive strategy
- **Play Online** — peer-to-peer over WebRTC, share a link with a friend

The dev server runs locally; there is no backend. Multiplayer signalling
goes through the free public PeerJS broker.

---

## How to play

Both players start with tiles numbered **0** through **8**.

- Even-numbered tiles (**0, 2, 4, 6, 8**) are **black**.
- Odd-numbered tiles (**1, 3, 5, 7**) are **white**.

Each round:

1. The starting player presents one of their remaining tiles. Their
   opponent can see the *colour* of the tile (black or white) but not
   the number.
2. The other player presents one of their tiles in response.
3. Whoever presents the higher number wins the round and scores a point.
   Ties score nothing.
4. The winner of the round starts the next round. (Ties leave the
   starting player unchanged.)

After nine rounds the higher score wins. If the match ends in a tie, it
automatically replays from round 1 with fresh tiles until someone wins.

After the final round, a **results screen** shows a round-by-round
breakdown — both tiles revealed, alongside the win/loss/tie of each round.

---

## Features

- Nine-round main match with automatic tie-breaking replay
- Adaptive AI: weighs tiles by score differential, rounds remaining, and
  — when responding — the opponent's revealed tile colour. Against a
  white tile (max value 7) it treats its own 8 as a guaranteed win.
- Online PvP via a shareable `?room=…` link. Works across browsers and
  devices on the open internet; no accounts, no backend.
- Tile masking: the opponent's played tile shows its colour (black or
  white face) but renders `?` for the number — same CSS class is reused
  for both modes.
- Live round tracker, round-by-round score flash, and a flavour text
  line for each result.
- Responsive layout that fits any viewport without scrolling, from
  375×667 mobile portrait up to wide desktop.
- 20 Playwright end-to-end tests covering both modes.

---

## Tech stack

- **React 19** + **TypeScript** + **Vite 8** for the app
- **PeerJS 1.5** over WebRTC for multiplayer data channels
- **CSS clip-path** for the hexagonal tiles — no SVG, no canvas
- **Playwright** for end-to-end tests (two-context runs for PvP)
- **CSS `clamp()`** and dynamic viewport units (`dvh`, `vmin`) for the
  responsive layout

No external UI library, no state-management library, no styling framework.

---

## Architecture notes

### Game state lives in two hooks

**`src/hooks/useGame.ts`** — single-player mode. A state machine with
phases (`start`, `playing`, `result`) and turn states (`player-pick`,
`opponent-picking`, `resolving`, `round-result`, `idle`). Async
transitions (AI thinking, result display, round advance) are driven by
three `useEffect` blocks keyed on `turnState` + `phase`. Side effects
live in effects — not inside `setState` updaters — so React StrictMode
doesn't double-fire them.

**`src/hooks/useMultiplayerGame.ts`** — PvP mode. Same state shape as
`useGame` (so the UI components don't care which hook they're fed), but
transitions are driven by incoming peer messages instead of timers:

- Both clients run the same state machine.
- Round advancement is event-driven (on receipt of the opponent's
  `pick`), never trusted to a local timer — so latency between clients
  can't cause state divergence.
- The host is authoritative for anything random: who starts, the
  starting role after a tie-replay, and the flavour text for the round
  result (which it broadcasts so both screens show the same message).

### Peer wrapper

**`src/utils/peer.ts`** is a thin wrapper around the PeerJS `Peer`
class exposing `createHost()`, `joinAsGuest(hostId)`, `send(msg)`,
`onMessage`, `onStatus`, and `destroy`. It:

- Keys sessions in a module-level `Map` by role (`'host'` / `'guest:<id>'`)
  so React StrictMode's double-mount reuses the same peer instead of
  spawning a second one and burning a broker ID.
- Runs a 5-second heartbeat; flags the peer as disconnected after 15 s
  of missed pongs or an explicit `close`/`error` from PeerJS.
- Defines the wire protocol via a discriminated union:
  `hello | start | pick | result-flavor | rematch | bye | ping | pong`.

### AI strategy

**`src/utils/ai.ts`** assigns a weight to every remaining tile and picks
via weighted random. Weights start from score differential and rounds
remaining, then — when responding — apply a colour-aware adjustment:

- If the player played **white** (max 7), tiles > 7 (i.e. an 8) get a
  3× weight multiplier (guaranteed win); tiles < 1 (i.e. a 0) get 0.3×
  (guaranteed loss).
- If the player played **black** (max 8), no tile guarantees a win, so
  the base weights apply.

### Hexagonal tiles without SVG

Every hex in the UI (tiles, avatars, round-track dots, logo, the VS
badge, the play-area slots) is a `<div>` with
`clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)`.
The outer *frame* is a slightly larger sibling hex (`inset: -4px`)
rendered behind the face. Drop-shadows do the depth.

Tile size scales with the viewport:
`--hex-w: clamp(34px, 7vmin, 64px);` — same rule for every hex, so
everything scales together.

The "reveal colour, mask number" behaviour is a single CSS class:
`.hex-face.tile-masked { color: transparent }` plus a `::after`
pseudo-element that shows `?` inheriting the face colour for legibility.

### Responsive layout

All screens use `height: 100dvh` (dynamic viewport height) so mobile
browsers' collapsing address bars don't leave dead space. The start
screen and lobby use `clamp()` on every size-sensitive property
(gap, padding, font-size, logo). Two height-based media queries
(`max-height: 640px` and `max-height: 480px`) tighten padding and hide
decorative bits (title underline, subtitle, play-slot labels) when
vertical space is tight.

---

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:3004
```

### Playing online locally

Open `http://localhost:3004/` in one browser → **Play Online** → copy
the share URL from the lobby → paste it into another browser (or
incognito window). Both sides connect via the public PeerJS broker
and the game starts automatically.

---

## Testing

```bash
npx playwright install chromium       # first time only
npx playwright test                   # run all 20 tests
npx playwright test tests/game.spec.ts         # AI mode only
npx playwright test tests/multiplayer.spec.ts  # PvP only
```

The multiplayer suite spins up two browser contexts in a single test
and drives both sides through the handshake. It hits the real PeerJS
broker, so it can be flaky on slow networks — set
`TEST_SKIP_MULTIPLAYER=1` to skip it in CI.

Animations are automatically disabled in the Playwright context
(`reducedMotion: 'reduce'`) because the selectable-tile pulse is an
infinite animation that would otherwise stop Playwright from ever
considering a tile "stable" for click actionability checks.

---

## Project layout

```
black-and-white/
├── src/
│   ├── App.tsx                   # routing between menu / AI / PvP
│   ├── index.css                 # design tokens + dvh root sizing
│   ├── App.css                   # component styles + responsive rules
│   ├── hooks/
│   │   ├── useGame.ts            # single-player state machine
│   │   └── useMultiplayerGame.ts # PvP state machine
│   ├── utils/
│   │   ├── ai.ts                 # AI tile-pick strategy
│   │   └── peer.ts               # PeerJS wrapper + heartbeat
│   └── components/
│       ├── StartScreen.tsx       # title, rules, "Play vs. AI" / "Play Online"
│       ├── LobbyScreen.tsx       # host share-link / guest joining
│       ├── GameScreen.tsx        # board, tiles, status
│       ├── HexTile.tsx           # hand tile + play-area tile
│       ├── PlayArea.tsx          # the two slots + VS badge
│       ├── ScorePanel.tsx        # header with scores & round badge
│       ├── RoundsTrack.tsx       # row of nine round dots
│       └── ResultOverlay.tsx     # end-of-match screen with round history
├── tests/
│   ├── game.spec.ts              # 16 tests: start screen, game screen, AI play
│   └── multiplayer.spec.ts       # 4 tests: lobby + two-context PvP handshake
├── playwright.config.ts
├── vite.config.ts
└── package.json
```

---

## Limitations / known gaps

- No backend = no rejoin. If either player refreshes mid-game the match
  is over — the other side shows "Opponent disconnected" after ~15 s.
- The PeerJS public broker has no SLA. If it's down, multiplayer won't
  connect. Self-hosting the broker is the obvious mitigation.
- Tile numbers are sent in plaintext over the data channel, then
  hidden by the UI. This is a friendly game between friends — a
  cheating opponent could inspect network messages to peek. A commit-
  reveal scheme would fix this if it ever matters.
