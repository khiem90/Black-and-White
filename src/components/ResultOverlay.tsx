import type { RoundEntry } from '../hooks/useGame';

interface ResultOverlayProps {
  playerScore: number;
  aiScore: number;
  replayCount: number;
  roundHistory: RoundEntry[];
  onReplay: () => void;
}

function TileCell({ num }: { num: number }) {
  const isBlack = num % 2 === 0;
  return (
    <div className="rh-tile-cell">
      <div className={`rh-hex ${isBlack ? 'rh-black' : 'rh-white'}`}>{num}</div>
    </div>
  );
}

export default function ResultOverlay({ playerScore, aiScore, replayCount, roundHistory, onReplay }: ResultOverlayProps) {
  const isWin = playerScore > aiScore;
  const isLose = playerScore < aiScore;

  const title = isWin ? 'Victory' : isLose ? 'Defeat' : 'Draw';
  const titleClass = isWin ? 'win' : isLose ? 'lose' : 'draw';

  const replaySuffix = replayCount > 0 ? ` (after ${replayCount} replay${replayCount > 1 ? 's' : ''})` : '';
  const subtitle = isWin
    ? `You dominated the match!${replaySuffix}`
    : isLose
    ? `The rival outplayed you.${replaySuffix}`
    : 'A battle of equals.';

  return (
    <div className="result-overlay show" data-testid="result-overlay">
      <div className="result-scroll">
        {/* Header */}
        <div className="result-header">
          <div className={`result-title ${titleClass}`} data-testid="result-title">{title}</div>
          <div className={`result-line ${titleClass}`} />
          <div className="result-subtitle">{subtitle}</div>
          <div className="result-scores">
            <div className="result-score-card">
              <div className="hex-frame">
                <span
                  className="score-num"
                  data-testid="final-player-score"
                  style={{ color: isWin ? 'var(--gold-light)' : isLose ? 'var(--text-dim)' : 'var(--blue)' }}
                >
                  {playerScore}
                </span>
              </div>
              <div className="score-label">You</div>
            </div>
            <div className="result-score-card">
              <div className="hex-frame">
                <span
                  className="score-num"
                  data-testid="final-ai-score"
                  style={{ color: isLose ? 'var(--red)' : isWin ? 'var(--text-dim)' : 'var(--blue)' }}
                >
                  {aiScore}
                </span>
              </div>
              <div className="score-label">Rival</div>
            </div>
          </div>
        </div>

        {/* Round History Table */}
        <div className="rh-section" data-testid="round-history">
          <div className="rh-table-header">
            <span className="rh-col-round">Round</span>
            <span className="rh-col-you">You</span>
            <span className="rh-col-result">Result</span>
            <span className="rh-col-rival">Rival</span>
          </div>
          {roundHistory.map((entry, i) => (
            <div
              key={i}
              className={`rh-row rh-${entry.result}`}
              data-testid={`round-row-${i + 1}`}
            >
              <span className="rh-col-round">
                <span className={`rh-round-num rh-${entry.result}`}>{i + 1}</span>
              </span>
              <span className="rh-col-you">
                <TileCell num={entry.playerTile} />
              </span>
              <span className="rh-col-result">
                <span className={`rh-result-badge rh-${entry.result}`}>
                  {entry.result === 'win' ? 'WIN' : entry.result === 'lose' ? 'LOSE' : 'TIE'}
                </span>
              </span>
              <span className="rh-col-rival">
                <TileCell num={entry.aiTile} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky bottom button */}
      <div className="result-bottom">
        <button className="btn" data-testid="btn-replay" onClick={onReplay}>
          <span>Play Again</span>
        </button>
      </div>
    </div>
  );
}
