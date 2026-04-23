interface HexTileProps {
  num: number;
  showFace: boolean;
  disabled?: boolean;
  selectable?: boolean;
  isAi?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function HexTile({ num, showFace, disabled, selectable, isAi, onClick, className = '' }: HexTileProps) {
  const isBlack = num % 2 === 0;
  const faceClass = showFace
    ? isBlack ? 'tile-black' : 'tile-white'
    : 'tile-hidden';

  const tileClass = [
    'hex-tile',
    disabled ? 'disabled' : '',
    selectable ? 'selectable' : '',
    isAi ? 'ai-tile' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={tileClass} data-value={num} data-testid={`tile-${showFace ? num : 'hidden'}`} onClick={disabled ? undefined : onClick}>
      <div className="hex-shadow" />
      <div className="hex-border" />
      <div className={`hex-face ${faceClass}`}>{showFace ? num : undefined}</div>
    </div>
  );
}

// Simplified hex tile for play area slots
export function PlayTile({ num, visible, isAi }: { num: number | null; visible: boolean; isAi?: boolean }) {
  // Face rendering rules:
  //  - num null         → fully hidden (no tile played yet)
  //  - isAi && num set  → show color (black/white) but mask the number (opponent view)
  //  - !isAi && num set → full reveal (player sees their own tile)
  let faceClass: string;
  let content: number | null = null;

  if (num === null) {
    faceClass = 'tile-hidden';
  } else {
    const isBlack = num % 2 === 0;
    const colorClass = isBlack ? 'tile-black' : 'tile-white';
    if (isAi) {
      faceClass = `${colorClass} tile-masked`;
    } else {
      faceClass = colorClass;
      content = num;
    }
  }

  return (
    <div
      className={`hex-tile slot-tile ${visible ? 'visible' : ''} ${isAi ? 'ai-tile' : ''}`}
      data-testid={isAi ? 'played-ai' : 'played-player'}
    >
      <div className="hex-shadow" />
      <div className="hex-border" />
      <div className={`hex-face ${faceClass}`}>
        {content}
      </div>
    </div>
  );
}
