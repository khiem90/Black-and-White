interface StartScreenProps {
  onStart: () => void;
  onStartOnline: () => void;
}

export default function StartScreen({ onStart, onStartOnline }: StartScreenProps) {
  return (
    <div id="start-screen" className="screen active" data-testid="start-screen">
      <div className="logo-hex" aria-hidden="true">
        <div className="logo-hex-border" />
        <div className="logo-hex-inner">
          <div className="logo-hex-half black" />
          <div className="logo-hex-half white" />
        </div>
      </div>
      <h1 className="title"><span>Black</span> <span className="amp">&amp;</span> White</h1>
      <div className="title-line" />
      <div className="subtitle">Tile Battle</div>
      <div className="rules-box">
        <strong>Rules:</strong> Both players receive 9 tiles (0&ndash;8). Each round, players
        take turns presenting a tile. The higher number wins the round.
        <br /><br />
        <strong>The twist:</strong> Tile numbers are <strong>never revealed</strong> &mdash; you
        only learn if you won, lost, or tied. Outwit your opponent across 9 rounds.
        <br /><br />
        Black tiles: 0, 2, 4, 6, 8 &nbsp;&bull;&nbsp; White tiles: 1, 3, 5, 7
      </div>
      <div className="start-buttons">
        <button className="btn" data-testid="btn-start" onClick={onStart}>
          <span>Play vs. AI</span>
        </button>
        <button className="btn btn-ghost" data-testid="btn-start-online" onClick={onStartOnline}>
          <span>Play Online</span>
        </button>
      </div>
    </div>
  );
}
