import { useState } from "react";
import "./ConnectScreen.css";

interface ConnectScreenProps {
  onConnect: (url: string) => void;
  error?: string;
  defaultUrl?: string;
  savedName?: string;
  onNameChange?: (name: string) => void;
}

export function ConnectScreen({
  onConnect,
  error,
  defaultUrl = "",
  savedName = "",
  onNameChange,
}: ConnectScreenProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [name, setName] = useState(savedName);

  const handleConnect = () => {
    if (!url.trim()) {
      alert("Enter a WebSocket URL");
      return;
    }
    if (!name.trim()) {
      alert("Enter your player name");
      return;
    }
    onNameChange?.(name);
    onConnect(url);
  };

  return (
    <div className="connect-screen">
      <h1>Quickeye</h1>
      <p>Enter your name:</p>
      <input
        type="text"
        placeholder="Your player name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleConnect()}
        autoFocus
      />
      <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#999" }}>
        WebSocket URL:
      </p>
      <input
        type="text"
        placeholder="wss://your-api-gateway-url/prod"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleConnect()}
      />
      <button onClick={handleConnect}>Connect</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
