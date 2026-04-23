interface ScorePanelProps {
  playerScore: number;
  aiScore: number;
  round: number;
  totalRounds: number;
}

const PersonIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
  </svg>
);

export default function ScorePanel({ playerScore, aiScore, round, totalRounds }: ScorePanelProps) {
  return (
    <div className="game-header">
      <div className="score-panel">
        <div className="score-card player" data-testid="player-score-card">
          <div className="avatar-hex"><PersonIcon /></div>
          <div className="score-info">
            <span className="label">You</span>
            <span className="points" data-testid="player-score">{playerScore}</span>
          </div>
        </div>

        <div className="round-badge" data-testid="round-badge">
          Round <b>{round}</b> / <b>{totalRounds}</b>
        </div>

        <div className="score-card ai" data-testid="ai-score-card">
          <div className="avatar-hex"><PersonIcon /></div>
          <div className="score-info">
            <span className="label">Rival</span>
            <span className="points" data-testid="ai-score">{aiScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
