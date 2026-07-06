import { useState } from "react";
import "./ConnectScreen.css";

interface ConnectScreenProps {
  onConnect: (url: string) => void;
  error?: string;
  defaultUrl?: string;
}

export function ConnectScreen({ onConnect, error, defaultUrl = "" }: ConnectScreenProps) {
  const [url, setUrl] = useState(defaultUrl);

  const handleConnect = () => {
    if (!url.trim()) {
      alert("Enter a WebSocket URL");
      return;
    }
    onConnect(url);
  };

  return (
    <div className="connect-screen">
      <h1>Quickeye</h1>
      <p>Enter your WebSocket API URL to connect:</p>
      <input
        type="text"
        placeholder="wss://your-api-gateway-url/prod"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleConnect()}
        autoFocus
      />
      <button onClick={handleConnect}>Connect</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
