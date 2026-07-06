import { useEffect, useState } from "react";
import { useWebSocket, useGame } from "./hooks";
import {
  ConnectScreen,
  LobbyScreen,
  GameScreen,
  LeaderboardScreen,
} from "./screens";
import type {
  ClientMessage,
  JoinedMessage,
  StateUpdateMessage,
  MatchResultMessage,
} from "@quickeye/shared";
import "./App.css";

export default function App() {
  const game = useGame();
  const defaultUrl = import.meta.env.VITE_WSS_URL || "";
  const [wsUrl, setWsUrl] = useState(defaultUrl);
  const [savedName, setSavedName] = useState(() => {
    return localStorage.getItem("quickeye_player_name") || "";
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Auto-save player name to localStorage
  const handleNameChange = (name: string) => {
    setSavedName(name);
    localStorage.setItem("quickeye_player_name", name);
    game.setPlayerName(name);
  };

  const ws = useWebSocket({ url: wsUrl, enabled: !!wsUrl });

  const handleConnect = (url: string) => {
    setWsUrl(url);
  };

  // Listen for game messages
  useEffect(() => {
    const unsubJoined = ws.on("joined", (msg: any) => {
      const m = msg as JoinedMessage;
      game.setGameId(m.gameId);
      game.setPlayerId(m.playerId);
      console.log("Joined game:", m.gameId, "state:", m.state);
      game.setState(m.state);
    });

    const unsubStateUpdate = ws.on("stateUpdate", (msg: any) => {
      const m = msg as StateUpdateMessage;
      console.log("State update:", m.state);
      game.setState(m.state);
    });

    const unsubMatchResult = ws.on("matchResult", (msg: any) => {
      const m = msg as MatchResultMessage;
      if (m.correct) {
        // Score update will come via stateUpdate
        console.log("Match correct!");
      } else {
        alert("Incorrect match, try again!");
      }
    });

    const unsubError = ws.on("error", (msg: any) => {
      game.setError(msg.message);
    });

    return () => {
      unsubJoined();
      unsubStateUpdate();
      unsubMatchResult();
      unsubError();
    };
  }, [ws, game]);

  // Screen routing
  if (!ws.connected) {
    return (
      <div className="container">
        <ConnectScreen
          onConnect={handleConnect}
          error={ws.error || undefined}
          defaultUrl={defaultUrl}
          savedName={savedName}
          onNameChange={handleNameChange}
        />
      </div>
    );
  }

  // Show leaderboard overlay if requested
  if (showLeaderboard) {
    return (
      <div className="container">
        <LeaderboardScreen onClose={() => setShowLeaderboard(false)} />
      </div>
    );
  }

  if (!game.state) {
    return (
      <div className="container">
        <LobbyScreen
          state={null}
          playerId={game.playerId || ""}
          playerName={game.playerName}
          onCreateGame={(name) => {
            game.setPlayerName(name);
            ws.send({
              action: "createGame",
              playerName: name,
            } as ClientMessage);
          }}
          onJoinGame={(gameId, name) => {
            game.setPlayerName(name);
            ws.send({
              action: "joinGame",
              gameId,
              playerName: name,
            } as ClientMessage);
          }}
          onStartGame={() => {
            ws.send({
              action: "startGame",
              gameId: game.gameId!,
            } as ClientMessage);
          }}
          isHost={false}
          onShowLeaderboard={() => setShowLeaderboard(true)}
        />
      </div>
    );
  }

  const isHost =
    game.state.players.length > 0 && game.state.players[0].playerId === game.playerId;

  if (game.state.status === "lobby") {
    return (
      <div className="container">
        <LobbyScreen
          state={game.state}
          playerId={game.playerId || ""}
          playerName={game.playerName}
          onCreateGame={() => {}}
          onJoinGame={() => {}}
          onStartGame={() => {
            ws.send({
              action: "startGame",
              gameId: game.gameId!,
            } as ClientMessage);
          }}
          isHost={isHost}
          onShowLeaderboard={() => setShowLeaderboard(true)}
        />
      </div>
    );
  }

  return (
    <div className="game-container">
      <GameScreen
        state={game.state}
        playerId={game.playerId || ""}
        onSubmitMatch={(symbolId) => {
          ws.send({
            action: "submitMatch",
            gameId: game.gameId!,
            symbolId,
          } as ClientMessage);
        }}
        onRematch={() => {
          game.setState(null);
          setTimeout(() => {
            ws.send({
              action: "startGame",
              gameId: game.gameId!,
            } as ClientMessage);
          }, 100);
        }}
        onReturnLobby={() => {
          game.setState(null);
        }}
      />
    </div>
  );
}
