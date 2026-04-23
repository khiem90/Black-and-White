import HexTile from './HexTile';
import ScorePanel from './ScorePanel';
import RoundsTrack from './RoundsTrack';
import PlayArea from './PlayArea';
import type { GameState } from '../hooks/useGame';

interface GameScreenProps {
  state: GameState;
  onTileSelect: (num: number) => void;
}

const ALL_TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export default function GameScreen({ state, onTileSelect }: GameScreenProps) {
  const canPick = state.turnState === 'player-pick';

  return (
    <div id="game-screen" className="screen active" data-testid="game-screen">
      <ScorePanel
        playerScore={state.playerScore}
        aiScore={state.aiScore}
        round={state.round}
        totalRounds={state.totalRounds}
      />

      <RoundsTrack
        round={state.round}
        totalRounds={state.totalRounds}
        results={state.results}
      />

      <div className="board-container">
        <div className="board">
          {/* Opponent tiles — only show what they still have. The numbers are hidden
              anyway, so showing faded "used" slots adds no info and looks misaligned. */}
          <div className="tile-row" data-testid="ai-tiles">
            {state.aiTiles.map(i => (
              <HexTile
                key={i}
                num={i}
                showFace={false}
                isAi
              />
            ))}
          </div>

          {/* Play area */}
          <PlayArea
            playerPick={state.playerPick}
            aiPick={state.aiPick}
            roundResult={state.roundResult}
          />

          {/* Player tiles */}
          <div className="tile-row" data-testid="player-tiles">
            {ALL_TILES.map(i => {
              const available = state.playerTiles.includes(i);
              return (
                <HexTile
                  key={i}
                  num={i}
                  showFace
                  disabled={!available}
                  selectable={available && canPick}
                  onClick={available && canPick ? () => onTileSelect(i) : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="status-bar">
        <div className={`status-text ${state.statusClass}`} data-testid="status-text">
          {state.statusText}
        </div>
      </div>
    </div>
  );
}
