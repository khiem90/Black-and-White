import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from './hooks/useGame';
import { useMultiplayerGame } from './hooks/useMultiplayerGame';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import LobbyScreen from './components/LobbyScreen';
import ResultOverlay from './components/ResultOverlay';
import './App.css';

type Mode = 'menu' | 'ai' | 'host' | 'guest';

function readRoomParam(): string | null {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('room');
  } catch {
    return null;
  }
}

function leaveRoom() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  } catch { /* ignore */ }
}

export default function App() {
  const initialRoomId = useMemo(() => readRoomParam(), []);
  const [mode, setMode] = useState<Mode>(() => (initialRoomId ? 'guest' : 'menu'));

  return (
    <>
      <div className="bg-grid" />
      {mode === 'menu' && (
        <StartScreen
          onStart={() => setMode('ai')}
          onStartOnline={() => setMode('host')}
        />
      )}
      {mode === 'ai' && <AiGame onLeave={() => setMode('menu')} />}
      {mode === 'host' && (
        <MultiplayerGame
          mode="host"
          onLeave={() => {
            leaveRoom();
            setMode('menu');
          }}
        />
      )}
      {mode === 'guest' && initialRoomId && (
        <MultiplayerGame
          mode="guest"
          roomId={initialRoomId}
          onLeave={() => {
            leaveRoom();
            setMode('menu');
          }}
        />
      )}
    </>
  );
}

function AiGame({ onLeave: _onLeave }: { onLeave: () => void }) {
  const { state, startGame, playerSelect } = useGame();
  const startedRef = useRef(false);

  // Auto-start once. Ref guard survives StrictMode double-mount in dev.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startGame();
  }, [startGame]);

  return (
    <>
      <GameScreen state={state} onTileSelect={playerSelect} />
      {state.phase === 'result' && (
        <ResultOverlay
          playerScore={state.playerScore}
          aiScore={state.aiScore}
          replayCount={state.replayCount}
          roundHistory={state.roundHistory}
          onReplay={startGame}
        />
      )}
    </>
  );
}

interface MultiplayerGameProps {
  mode: 'host' | 'guest';
  roomId?: string;
  onLeave: () => void;
}

function MultiplayerGame({ mode, roomId, onLeave }: MultiplayerGameProps) {
  const { state, info, playerSelect, rematch } = useMultiplayerGame({ mode, roomId });

  // Show the lobby until the connection is up AND the first match has started.
  const inLobby = state.phase === 'start' || info.status !== 'connected';

  if (inLobby) {
    return <LobbyScreen info={info} onCancel={onLeave} />;
  }

  return (
    <>
      <GameScreen state={state} onTileSelect={playerSelect} />
      {state.phase === 'result' && (
        <ResultOverlay
          playerScore={state.playerScore}
          aiScore={state.aiScore}
          replayCount={state.replayCount}
          roundHistory={state.roundHistory}
          onReplay={rematch}
        />
      )}
    </>
  );
}
