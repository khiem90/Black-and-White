import type { RoundResult } from '../hooks/useGame';

interface RoundsTrackProps {
  round: number;
  totalRounds: number;
  results: RoundResult[];
}

export default function RoundsTrack({ round, totalRounds, results }: RoundsTrackProps) {
  return (
    <div className="rounds-track" data-testid="rounds-track">
      {Array.from({ length: totalRounds }, (_, i) => {
        const r = i + 1;
        const isActive = r === round;
        const isDone = r < round;
        const res = isDone ? results[i] : null;

        const cls = [
          'round-dot',
          isActive ? 'active' : '',
          isDone ? 'done' : '',
          res === 'win' ? 'won' : '',
          res === 'lose' ? 'lost' : '',
          res === 'tie' ? 'tied' : '',
        ].filter(Boolean).join(' ');

        const label = r === totalRounds ? 'F' : String(r);

        return (
          <div key={r} className={cls}>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
