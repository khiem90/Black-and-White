import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createHost,
  joinAsGuest,
  type Message,
  type PeerSession,
  type PeerStatus,
  type Role,
} from '../utils/peer';
import type { GameState, RoundEntry, RoundResult } from './useGame';

// ── Constants ──
const ALL_TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const RESULT_MSGS: Record<RoundResult, string[]> = {
  win: ['Round won!', 'Your tile was higher!', 'Point for you!', 'You take this round!'],
  lose: ['Round lost.', 'Their tile was higher.', 'Point for opponent.', 'Opponent takes this one.'],
  tie: ['Tie \u2014 no points.', 'A draw this round.', 'Tiles matched!'],
};
/**
 * Invert a round result for display on the peer.
 * If I won, they lost. If I lost, they won. Tie stays tie.
 */
function invertResult(r: RoundResult): RoundResult {
  if (r === 'win') return 'lose';
  if (r === 'lose') return 'win';
  return 'tie';
}
function randomMsg(arr: string[]): string { return arr[Math.floor(Math.random() * arr.length)]; }

function makeInitialState(): GameState {
  return {
    phase: 'start',
    turnState: 'idle',
    playerTiles: [...ALL_TILES],
    aiTiles: [...ALL_TILES],
    playerScore: 0,
    aiScore: 0,
    round: 1,
    totalRounds: 9,
    results: [],
    roundHistory: [],
    playerFirst: true,
    playerPick: null,
    aiPick: null,
    roundResult: null,
    statusText: '',
    statusClass: '',
    replayCount: 0,
  };
}

export interface UseMultiplayerGameArgs {
  mode: 'host' | 'guest';
  /** Required when mode is 'guest'. */
  roomId?: string;
}

export interface MultiplayerInfo {
  status: PeerStatus;
  role: Role;
  myPeerId: string | null;
  /** URL the host shares with the guest. */
  shareUrl: string | null;
}

/**
 * Symmetric PvP game hook.
 * Returns a GameState shaped identically to useGame() so the same UI components work.
 * "player*" fields refer to THIS client; "ai*" fields refer to the opponent.
 */
export function useMultiplayerGame({ mode, roomId }: UseMultiplayerGameArgs) {
  const [state, setState] = useState<GameState>(makeInitialState);
  const [info, setInfo] = useState<MultiplayerInfo>({
    status: 'connecting',
    role: mode,
    myPeerId: null,
    shareUrl: null,
  });

  const sessionRef = useRef<PeerSession | null>(null);
  // Track whether we've sent the initial 'hello' after the connection opens.
  const sentHelloRef = useRef(false);
  // Host-only: guard that we've sent 'start' exactly once per match.
  const sentStartRef = useRef(false);
  // Deferred result-flavor message received from host before the resolving transition.
  const pendingFlavorRef = useRef<string | null>(null);

  /** Helper: send a message if the session is alive. */
  const send = useCallback((msg: Message) => {
    sessionRef.current?.send(msg);
  }, []);

  /** Host only: pick who starts and broadcast. Also sets local state's startingRole. */
  const hostStartMatch = useCallback(() => {
    const startingRole: Role = Math.random() < 0.5 ? 'host' : 'guest';
    send({ type: 'start', startingRole });
    applyMatchStart(startingRole);
    sentStartRef.current = true;
  }, [send]);

  /** Apply a match-start locally: both host and guest use this when 'start' arrives. */
  const applyMatchStart = useCallback((startingRole: Role) => {
    setInfo(prev => ({ ...prev })); // trigger re-render
    setState(() => {
      const s = makeInitialState();
      s.phase = 'playing';
      const myRole = sessionRef.current?.role ?? mode;
      s.playerFirst = startingRole === myRole;
      s.turnState = s.playerFirst ? 'player-pick' : 'opponent-picking';
      s.statusText = s.playerFirst
        ? 'You go first \u2014 select a tile'
        : 'Opponent is picking\u2026';
      s.statusClass = '';
      return s;
    });
  }, [mode]);

  /** Resolve the round once both picks are known. Called on both clients. */
  const resolveRound = useCallback((myPick: number, theirPick: number, flavorText: string | null) => {
    setState(prev => {
      let result: RoundResult;
      let pScore = prev.playerScore;
      let aScore = prev.aiScore;
      if (myPick > theirPick) { result = 'win'; pScore++; }
      else if (myPick < theirPick) { result = 'lose'; aScore++; }
      else { result = 'tie'; }
      const entry: RoundEntry = { playerTile: myPick, aiTile: theirPick, result };
      const msg = flavorText ?? randomMsg(RESULT_MSGS[result]);
      return {
        ...prev,
        playerScore: pScore,
        aiScore: aScore,
        results: [...prev.results, result],
        roundHistory: [...prev.roundHistory, entry],
        roundResult: result,
        turnState: 'round-result',
        statusText: msg,
        statusClass: result,
      };
    });
  }, []);

  /** Called by both clients to advance from 'round-result' → next round (or game-over). */
  const advanceRound = useCallback(() => {
    setState(prev => {
      if (prev.turnState !== 'round-result') return prev;
      const nextRound = prev.round + 1;
      const nextPFirst = prev.roundResult === 'win'
        ? true
        : prev.roundResult === 'lose'
          ? false
          : prev.playerFirst;

      if (nextRound > prev.totalRounds) {
        // Tied match → replay from round 1. Host decides starting role and broadcasts.
        if (prev.playerScore === prev.aiScore) {
          // Reset locally; host will send 'start' below.
          return {
            ...prev,
            replayCount: prev.replayCount + 1,
            playerTiles: [...ALL_TILES],
            aiTiles: [...ALL_TILES],
            round: 1,
            totalRounds: 9,
            results: [],
            roundHistory: [],
            playerScore: 0,
            aiScore: 0,
            playerPick: null,
            aiPick: null,
            roundResult: null,
            turnState: 'idle',
            statusText: 'Draw \u2014 replaying!',
            statusClass: 'highlight',
          };
        }
        return { ...prev, phase: 'result', turnState: 'idle' };
      }

      return {
        ...prev,
        round: nextRound,
        playerFirst: nextPFirst,
        playerPick: null,
        aiPick: null,
        roundResult: null,
        turnState: nextPFirst ? 'player-pick' : 'opponent-picking',
        statusText: nextPFirst ? 'You go first \u2014 select a tile' : 'Opponent is picking\u2026',
        statusClass: '',
      };
    });
  }, []);

  /** Local player picks a tile. Update state and broadcast.
   *  If the opponent already picked (we're picking second), resolve the round inline. */
  const playerSelect = useCallback((num: number) => {
    setState(prev => {
      if (prev.turnState !== 'player-pick') return prev;
      if (!prev.playerTiles.includes(num)) return prev;

      const myPick = num;
      const theirPick = prev.aiPick;

      if (theirPick !== null) {
        // Both picks known — resolve immediately.
        let result: RoundResult;
        let pScore = prev.playerScore;
        let aScore = prev.aiScore;
        if (myPick > theirPick) { result = 'win'; pScore++; }
        else if (myPick < theirPick) { result = 'lose'; aScore++; }
        else { result = 'tie'; }
        const entry: RoundEntry = { playerTile: myPick, aiTile: theirPick, result };
        const flavor = pendingFlavorRef.current ?? randomMsg(RESULT_MSGS[result]);
        pendingFlavorRef.current = null;
        return {
          ...prev,
          playerPick: myPick,
          playerTiles: prev.playerTiles.filter(t => t !== num),
          playerScore: pScore,
          aiScore: aScore,
          results: [...prev.results, result],
          roundHistory: [...prev.roundHistory, entry],
          roundResult: result,
          turnState: 'round-result',
          statusText: flavor,
          statusClass: result,
        };
      }

      // Opponent hasn't picked yet — wait.
      return {
        ...prev,
        playerPick: myPick,
        playerTiles: prev.playerTiles.filter(t => t !== num),
        turnState: 'opponent-picking',
        statusText: 'Opponent is picking\u2026',
        statusClass: '',
      };
    });
    send({ type: 'pick', tile: num });
  }, [send]);

  /** Request a full match reset after the result screen. Either side can call. */
  const rematch = useCallback(() => {
    // Reset to makeInitialState (phase=start). Host will broadcast 'start' next.
    setState(makeInitialState);
    sentStartRef.current = false;
    send({ type: 'rematch' });
    // Host kicks off the next match immediately.
    if (sessionRef.current?.role === 'host') {
      // Give the peer a tick to receive the rematch message before start.
      setTimeout(() => hostStartMatch(), 50);
    }
  }, [send, hostStartMatch]);

  /** Handle every incoming peer message. */
  const handleMessage = useCallback((msg: Message) => {
    switch (msg.type) {
      case 'hello': {
        // Version check.
        if (msg.version !== 1) {
          // eslint-disable-next-line no-console
          console.warn('[peer] protocol version mismatch', msg.version);
        }
        // Host: on first hello, kick off the match.
        if (sessionRef.current?.role === 'host' && !sentStartRef.current) {
          hostStartMatch();
        }
        break;
      }
      case 'start': {
        applyMatchStart(msg.startingRole);
        break;
      }
      case 'pick': {
        setState(prev => {
          const theirPick = msg.tile;
          const bothKnown = prev.playerPick !== null;
          if (bothKnown) {
            // We have both picks — move to resolving.
            // Resolve now so state is consistent; flavor may arrive shortly.
            const myPick = prev.playerPick!;
            let result: RoundResult;
            let pScore = prev.playerScore;
            let aScore = prev.aiScore;
            if (myPick > theirPick) { result = 'win'; pScore++; }
            else if (myPick < theirPick) { result = 'lose'; aScore++; }
            else { result = 'tie'; }
            const entry: RoundEntry = { playerTile: myPick, aiTile: theirPick, result };
            const flavor = pendingFlavorRef.current ?? randomMsg(RESULT_MSGS[result]);
            pendingFlavorRef.current = null;
            return {
              ...prev,
              aiPick: theirPick,
              playerScore: pScore,
              aiScore: aScore,
              results: [...prev.results, result],
              roundHistory: [...prev.roundHistory, entry],
              roundResult: result,
              turnState: 'round-result',
              statusText: flavor,
              statusClass: result,
            };
          }
          // We haven't picked yet. Opponent went first.
          return {
            ...prev,
            aiPick: theirPick,
            turnState: 'player-pick',
            statusText: 'Your turn \u2014 respond with a tile',
            statusClass: '',
          };
        });
        break;
      }
      case 'result-flavor': {
        // Apply the host-chosen message so both clients show the same text.
        // From the host's perspective the message matches their result; invert for guest.
        setState(prev => {
          if (prev.turnState !== 'round-result') {
            // Picks might arrive before flavor; stash it.
            pendingFlavorRef.current = msg.text;
            return prev;
          }
          return { ...prev, statusText: msg.text };
        });
        break;
      }
      case 'rematch': {
        // Reset locally; host will broadcast 'start' on top of this.
        setState(makeInitialState);
        sentStartRef.current = false;
        break;
      }
      case 'bye': {
        // Explicit disconnect. Peer listener will also flag status.
        break;
      }
      default:
        break;
    }
  }, [applyMatchStart, hostStartMatch]);

  /** Bring up peer. Safe under StrictMode thanks to the session registry in peer.ts. */
  useEffect(() => {
    const session = mode === 'host'
      ? createHost()
      : joinAsGuest(roomId!);
    sessionRef.current = session;
    setInfo({
      status: 'connecting',
      role: session.role,
      myPeerId: session.peerId || null,
      shareUrl: session.role === 'host'
        ? `${window.location.origin}${window.location.pathname}?room=${session.peerId}`
        : null,
    });

    const offStatus = session.onStatus((s) => {
      setInfo(prev => ({
        ...prev,
        status: s,
        myPeerId: session.peerId || prev.myPeerId,
        shareUrl: session.role === 'host'
          ? `${window.location.origin}${window.location.pathname}?room=${session.peerId}`
          : null,
      }));
      // Once connected, send hello once.
      if (s === 'connected' && !sentHelloRef.current) {
        sentHelloRef.current = true;
        session.send({ type: 'hello', role: session.role, version: 1 });
      }
      // On disconnect during play, mark state.
      if (s === 'disconnected') {
        setState(prev => prev.phase === 'start' ? prev : {
          ...prev,
          statusText: 'Opponent disconnected',
          statusClass: 'lose',
        });
      }
    });
    const offMessage = session.onMessage(handleMessage);

    return () => {
      offStatus();
      offMessage();
      // NOTE: we don't destroy the session in StrictMode dev — the singleton key
      // lets a second mount reuse it. Destroy only when the whole component truly unmounts,
      // which the parent App triggers via a "leave" button if needed.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Host-only effect: when transitioning into 'round-result', broadcast the flavor text
   *  so the guest shows identical status. The resolve callback already picked a random
   *  message locally — rebroadcast it so the other side can adopt it. */
  useEffect(() => {
    if (state.turnState !== 'round-result') return;
    if (sessionRef.current?.role !== 'host') return;
    // The guest's perspective has the inverted result, so pick a fresh message that
    // matches the guest's result. We invert here and let the guest display it directly.
    const guestResult = invertResult(state.roundResult!);
    const text = randomMsg(RESULT_MSGS[guestResult]);
    send({ type: 'result-flavor', text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turnState]);

  /** Cosmetic timer: after showing the result for 1.8s, advance. */
  useEffect(() => {
    if (state.turnState !== 'round-result') return;
    const id = setTimeout(() => advanceRound(), 1800);
    return () => clearTimeout(id);
  }, [state.turnState, advanceRound]);

  /** Host-only: when the match resets (post-tie-replay) to turnState='idle' with phase='playing',
   *  broadcast a new 'start'. */
  useEffect(() => {
    if (sessionRef.current?.role !== 'host') return;
    if (state.phase !== 'playing') return;
    if (state.turnState !== 'idle') return;
    if (state.round !== 1) return;
    if (state.replayCount === 0) return; // first match start is handled on hello
    hostStartMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turnState, state.phase]);

  return {
    state,
    info,
    playerSelect,
    rematch,
    // Silence the unused import warning; `resolveRound` is available for future use.
    _resolveRound: resolveRound,
  };
}
