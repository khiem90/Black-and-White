import { useState, useCallback, useEffect, useRef } from 'react';
import { aiPickTile } from '../utils/ai';

export type RoundResult = 'win' | 'lose' | 'tie';
export type GamePhase = 'start' | 'playing' | 'result';
export type TurnState =
  | 'player-pick'
  | 'opponent-picking'
  | 'resolving'
  | 'round-result'
  | 'idle';

export interface RoundEntry {
  playerTile: number;
  aiTile: number;
  result: RoundResult;
}

export interface GameState {
  phase: GamePhase;
  turnState: TurnState;
  playerTiles: number[];
  aiTiles: number[];
  playerScore: number;
  aiScore: number;
  round: number;
  totalRounds: number;
  results: RoundResult[];
  roundHistory: RoundEntry[];
  playerFirst: boolean;
  playerPick: number | null;
  aiPick: number | null;
  roundResult: RoundResult | null;
  statusText: string;
  statusClass: string;
  replayCount: number;
}

const ALL_TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const RESULT_MSGS: Record<RoundResult, string[]> = {
  win: ['Round won!', 'Your tile was higher!', 'Point for you!', 'You take this round!'],
  lose: ['Round lost.', 'Their tile was higher.', 'Point for rival.', 'Rival takes this one.'],
  tie: ['Tie \u2014 no points.', 'A draw this round.', 'Tiles matched!'],
};
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function makeInitial(): GameState {
  const pFirst = Math.random() < 0.5;
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
    playerFirst: pFirst,
    playerPick: null,
    aiPick: null,
    roundResult: null,
    statusText: '',
    statusClass: '',
    replayCount: 0,
  };
}

export function useGame() {
  const [state, setState] = useState<GameState>(makeInitial);
  // Guard to prevent StrictMode double-fire of effects
  const effectGuard = useRef(false);

  // ── Start a new game ──
  const startGame = useCallback(() => {
    const s = makeInitial();
    s.phase = 'playing';
    s.turnState = s.playerFirst ? 'player-pick' : 'opponent-picking';
    s.statusText = s.playerFirst ? 'You go first \u2014 select a tile' : 'Rival is thinking\u2026';
    s.statusClass = '';
    setState(s);
  }, []);

  // ── Player selects a tile (pure state update, no side effects) ──
  const playerSelect = useCallback((num: number) => {
    setState(prev => {
      if (prev.turnState !== 'player-pick') return prev;
      if (!prev.playerTiles.includes(num)) return prev;

      const goingFirst = prev.playerFirst;
      return {
        ...prev,
        playerPick: num,
        playerTiles: prev.playerTiles.filter(t => t !== num),
        turnState: goingFirst ? 'opponent-picking' : 'resolving',
        statusText: goingFirst ? 'Rival is thinking\u2026' : '',
        statusClass: '',
      };
    });
  }, []);

  // ── Effect: handle AI thinking ──
  useEffect(() => {
    if (state.phase !== 'playing' || state.turnState !== 'opponent-picking') return;
    if (effectGuard.current) return;
    effectGuard.current = true;

    const ms = 700 + Math.random() * 600;
    const timer = setTimeout(() => {
      effectGuard.current = false;
      setState(prev => {
        if (prev.turnState !== 'opponent-picking') return prev;
        // When AI is responding (playerFirst), it can see the color of the player's tile.
        const playerTileColor = prev.playerFirst && prev.playerPick !== null
          ? (prev.playerPick % 2 === 0 ? 'black' as const : 'white' as const)
          : null;
        const tilePick = aiPickTile(prev.aiTiles, prev.aiScore, prev.playerScore, prev.round, prev.totalRounds, prev.playerFirst, playerTileColor);
        const newAiTiles = prev.aiTiles.filter(t => t !== tilePick);

        if (prev.playerFirst) {
          // AI is responding — go to resolve
          return { ...prev, aiPick: tilePick, aiTiles: newAiTiles, turnState: 'resolving', statusText: '', statusClass: '' };
        } else {
          // AI went first — now player picks
          return {
            ...prev, aiPick: tilePick, aiTiles: newAiTiles,
            turnState: 'player-pick',
            statusText: 'Your turn \u2014 respond with a tile', statusClass: '',
          };
        }
      });
    }, ms);

    return () => { clearTimeout(timer); effectGuard.current = false; };
  }, [state.turnState, state.phase]);

  // ── Effect: resolve the round ──
  useEffect(() => {
    if (state.phase !== 'playing' || state.turnState !== 'resolving') return;
    if (effectGuard.current) return;
    effectGuard.current = true;

    const timer = setTimeout(() => {
      effectGuard.current = false;
      setState(prev => {
        if (prev.turnState !== 'resolving') return prev;
        if (prev.playerPick === null || prev.aiPick === null) return prev;

        let result: RoundResult;
        let pScore = prev.playerScore;
        let aScore = prev.aiScore;

        if (prev.playerPick > prev.aiPick) { result = 'win'; pScore++; }
        else if (prev.playerPick < prev.aiPick) { result = 'lose'; aScore++; }
        else { result = 'tie'; }

        const msg = pick(RESULT_MSGS[result]);
        const entry: RoundEntry = { playerTile: prev.playerPick, aiTile: prev.aiPick, result };
        return {
          ...prev,
          playerScore: pScore, aiScore: aScore,
          results: [...prev.results, result],
          roundHistory: [...prev.roundHistory, entry],
          roundResult: result,
          turnState: 'round-result',
          statusText: msg, statusClass: result,
        };
      });
    }, 500);

    return () => { clearTimeout(timer); effectGuard.current = false; };
  }, [state.turnState, state.phase]);

  // ── Effect: advance to next round after showing result ──
  useEffect(() => {
    if (state.phase !== 'playing' || state.turnState !== 'round-result') return;
    if (effectGuard.current) return;
    effectGuard.current = true;

    const timer = setTimeout(() => {
      effectGuard.current = false;
      setState(prev => {
        if (prev.turnState !== 'round-result') return prev;

        const nextPFirst = prev.roundResult === 'win' ? true
          : prev.roundResult === 'lose' ? false
          : prev.playerFirst;
        const nextRound = prev.round + 1;

        // Check if game is over
        if (nextRound > prev.totalRounds) {
          // Tied match -> replay the full 9 rounds from the beginning
          if (prev.playerScore === prev.aiScore) {
            const nextFirst = Math.random() < 0.5;
            return {
              ...prev,
              replayCount: prev.replayCount + 1,
              playerTiles: [...ALL_TILES], aiTiles: [...ALL_TILES],
              round: 1, totalRounds: 9,
              results: [], roundHistory: [],
              playerScore: 0, aiScore: 0,
              playerFirst: nextFirst,
              playerPick: null, aiPick: null, roundResult: null,
              turnState: nextFirst ? 'player-pick' : 'opponent-picking',
              statusText: nextFirst ? 'Draw \u2014 replaying! Select a tile' : 'Draw \u2014 replaying! Rival is thinking\u2026',
              statusClass: 'highlight',
            };
          }
          // Game over
          return { ...prev, phase: 'result' as GamePhase, turnState: 'idle' };
        }

        // Next round
        return {
          ...prev,
          round: nextRound, playerFirst: nextPFirst,
          playerPick: null, aiPick: null, roundResult: null,
          turnState: nextPFirst ? 'player-pick' : 'opponent-picking',
          statusText: nextPFirst ? 'You go first \u2014 select a tile' : 'Rival is thinking\u2026',
          statusClass: '',
        };
      });
    }, 1800);

    return () => { clearTimeout(timer); effectGuard.current = false; };
  }, [state.turnState, state.phase]);

  return { state, startGame, playerSelect };
}
