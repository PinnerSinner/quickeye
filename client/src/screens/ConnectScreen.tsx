import { useState } from "react";
import { QEyeLogo } from "../components/QEyeLogo";
import "./ConnectScreen.css";

interface ConnectScreenProps {
  onConnect: (url: string) => void;
  error?: string;
  defaultUrl?: string;
  savedName?: string;
  onNameChange?: (name: string) => void;
  hideUrl?: boolean;
}

export function ConnectScreen({
  onConnect,
  error,
  defaultUrl = "",
  savedName = "",
  onNameChange,
  hideUrl = false,
}: ConnectScreenProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [name, setName] = useState(savedName);

  const handleConnect = () => {
    if (!name.trim()) {
      alert("Enter your player name");
      return;
    }
    onNameChange?.(name);
    // If URL is hidden, use default URL. Otherwise require URL input.
    if (!hideUrl && !url.trim()) {
      alert("Enter a WebSocket URL");
      return;
    }
    onConnect(url || defaultUrl);
  };

  return (
    <div className="connect-screen-wrapper">
      <div className="connect-screen">
        {/* Constructivist top band */}
        <div className="connect-banner">
          {/* Red circle top-left */}
          <div className="banner-shape banner-circle" />

          {/* Yellow diamond top-center */}
          <div className="banner-shape banner-diamond" />

          {/* Blue triangle top-right */}
          <div className="banner-shape banner-triangle" />

          {/* Q-eye logo bottom-left */}
          <div className="banner-logo">
            <QEyeLogo size="sm" includeWordmark={true} />
          </div>
        </div>

        {/* Body content */}
        <div className="connect-body">
          <p className="connect-eyebrow">Enter your details</p>
          <p className="connect-instruction">Join a match or create a new one</p>

          <input
            type="text"
            placeholder="Your player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleConnect()}
            autoFocus
            className="connect-input"
          />

          {!hideUrl && (
            <input
              type="text"
              placeholder="wss://your-api-gateway-url/prod"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleConnect()}
              className="connect-input connect-url-input"
            />
          )}

          <button onClick={handleConnect} className="connect-button">
            Start Match
          </button>

          {error && <p className="connect-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
