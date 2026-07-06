import { useState } from "react";
import "./App.css";

export default function App() {
  const [wsUrl, setWsUrl] = useState("");
  const [connected, setConnected] = useState(false);

  const handleConnect = () => {
    if (!wsUrl.trim()) {
      alert("Enter a WebSocket URL");
      return;
    }
    // Connection logic will be implemented next
    console.log("Connecting to:", wsUrl);
  };

  if (!connected) {
    return (
      <div className="container">
        <h1>Quickeye</h1>
        <div className="setup-screen">
          <p>Enter your WebSocket API URL to connect:</p>
          <input
            type="text"
            placeholder="wss://your-api-gateway-url/prod"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleConnect()}
          />
          <button onClick={handleConnect}>Connect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Quickeye</h1>
      <p>Connected! Lobby coming next...</p>
    </div>
  );
}
