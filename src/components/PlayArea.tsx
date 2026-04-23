import { PlayTile } from './HexTile';
import type { RoundResult } from '../hooks/useGame';

interface PlayAreaProps {
  playerPick: number | null;
  aiPick: number | null;
  roundResult: RoundResult | null;
}

export default function PlayArea({ playerPick, aiPick, roundResult }: PlayAreaProps) {
  const flashClass = roundResult ? `flash-${roundResult}` : '';

  return (
    <div className={`play-area ${flashClass}`} data-testid="play-area">
      <div className="play-slot" id="slot-ai">
        <div className="play-slot-label">Rival</div>
        <div className="play-slot-hex">
          <div className="slot-outline" />
          <PlayTile num={aiPick} visible={aiPick !== null} isAi />
        </div>
      </div>

      <div className="vs-badge"><span>VS</span></div>

      <div className="play-slot" id="slot-player">
        <div className="play-slot-label">You</div>
        <div className="play-slot-hex">
          <div className="slot-outline" />
          <PlayTile num={playerPick} visible={playerPick !== null} />
        </div>
      </div>
    </div>
  );
}
