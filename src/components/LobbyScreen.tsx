import { useState } from 'react';
import type { MultiplayerInfo } from '../hooks/useMultiplayerGame';

interface LobbyScreenProps {
  info: MultiplayerInfo;
  onCancel: () => void;
}

export default function LobbyScreen({ info, onCancel }: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);

  const isHost = info.role === 'host';
  const isDisconnected = info.status === 'disconnected';

  const copyLink = async () => {
    if (!info.shareUrl) return;
    try {
      await navigator.clipboard.writeText(info.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select the input so the user can copy manually.
      const el = document.getElementById('share-url') as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <div id="lobby-screen" className="screen active" data-testid="lobby-screen">
      <div className="logo-hex" aria-hidden="true">
        <div className="logo-hex-border" />
        <div className="logo-hex-inner">
          <div className="logo-hex-half black" />
          <div className="logo-hex-half white" />
        </div>
      </div>
      <h1 className="title"><span>{isHost ? 'Waiting' : 'Joining'}</span> Room</h1>
      <div className="title-line" />

      {isHost && (
        <>
          <div className="subtitle">Share this link with a friend</div>
          <div className="lobby-share">
            <input
              id="share-url"
              className="lobby-input"
              readOnly
              value={info.shareUrl ?? 'Generating link\u2026'}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              data-testid="share-url"
            />
            <button
              className="lobby-copy"
              onClick={copyLink}
              disabled={!info.shareUrl}
              data-testid="btn-copy-link"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="lobby-status" data-testid="lobby-status">
            {isDisconnected
              ? 'Connection lost \u2014 try starting over.'
              : info.status === 'connected'
                ? 'Opponent connected! Starting\u2026'
                : 'Waiting for opponent to join\u2026'}
          </div>
        </>
      )}

      {!isHost && (
        <>
          <div className="subtitle">Connecting to room</div>
          <div className="lobby-status" data-testid="lobby-status">
            {isDisconnected
              ? 'Could not reach the host. The game may have ended.'
              : info.status === 'connected'
                ? 'Connected! Starting\u2026'
                : 'Connecting\u2026'}
          </div>
        </>
      )}

      <button className="btn btn-ghost" onClick={onCancel} data-testid="btn-lobby-cancel">
        <span>{isDisconnected ? 'Start Over' : 'Cancel'}</span>
      </button>
    </div>
  );
}
