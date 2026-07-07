import { useEffect, useState } from "react";
import { useWebSocket, useGame } from "./hooks";
import {
  ConnectScreen,
  LobbyScreen,
  GameScreen,
  LeaderboardScreen,
  GameModeScreen,
  GameTypeScreen,
} from "./screens";
import { NavHeader } from "./components/NavHeader";
import type {
  ClientMessage,
  JoinedMessage,
  StateUpdateMessage,
  MatchResultMessage,
  GameMode,
} from "@quickeye/shared";
import "./App.css";
import "./components/NavHeader.css";

export default function App() {
  const game = useGame();
  const defaultUrl = import.meta.env.VITE_WSS_URL || "";
  const [wsUrl, setWsUrl] = useState(defaultUrl);
  const [savedName, setSavedName] = useState(() => {
    return localStorage.getItem("quickeye_player_name") || "";
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showGameTypeSelection, setShowGameTypeSelection] = useState(false);
  const [showGameModeSelection, setShowGameModeSelection] = useState(false);
  const [pendingCreateGameName, setPendingCreateGameName] = useState<string | null>(null);
  const [pendingGameType, setPendingGameType] = useState<"solo" | "vs-ai" | "multiplayer" | null>(null);

  const handleHome = () => {
    game.setState(null);
    game.setGameId(null);
    setShowLeaderboard(false);
    setShowGameTypeSelection(false);
    setShowGameModeSelection(false);
    setPendingCreateGameName(null);
    setPendingGameType(null);
  };

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

  // Auto-connect if defaultUrl is already set
  useEffect(() => {
    if (defaultUrl && !wsUrl) {
      setWsUrl(defaultUrl);
    }
  }, [defaultUrl, wsUrl]);

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

    const unsubLeaderboard = ws.on("leaderboard", (msg: any) => {
      console.log("Leaderboard update:", msg);
      // Handled by LeaderboardScreen component
    });

    return () => {
      unsubJoined();
      unsubStateUpdate();
      unsubMatchResult();
      unsubError();
      unsubLeaderboard();
    };
  }, [ws, game]);

  // Screen routing
  if (!ws.connected) {
    return (
      <div className="container">
        <NavHeader onHome={handleHome} />
        <ConnectScreen
          onConnect={handleConnect}
          error={ws.error || undefined}
          defaultUrl={defaultUrl}
          savedName={savedName}
          onNameChange={handleNameChange}
          hideUrl={true}
        />
      </div>
    );
  }

  // Show game type selection FIRST (before any lobby)
  if (showGameTypeSelection && !pendingGameType) {
    return (
      <div className="container">
        <NavHeader onHome={handleHome} />
        <GameTypeScreen
          onSelectType={(type) => {
            setPendingGameType(type);
            if (type === "solo" || type === "vs-ai") {
              // For solo/vs-ai, skip lobby and go straight to game mode selection
              setShowGameModeSelection(true);
            } else {
              // For multiplayer, show lobby first
              setShowGameTypeSelection(false);
            }
          }}
          onCancel={() => {
            setShowGameTypeSelection(false);
          }}
        />
      </div>
    );
  }

  // Show leaderboard overlay if requested
  if (showLeaderboard) {
    return (
      <div className="container">
        <NavHeader onHome={handleHome} />
        <LeaderboardScreen onClose={() => setShowLeaderboard(false)} ws={ws} />
      </div>
    );
  }

  // Show game type selection first
  if (showGameTypeSelection) {
    return (
      <div className="container">
        <NavHeader onHome={handleHome} />
        <GameTypeScreen
          onSelectType={(type) => {
            setPendingGameType(type);
            setShowGameTypeSelection(false);
            // For multiplayer, show game mode selection next
            // For solo/vs-ai, go straight to game mode selection
            setShowGameModeSelection(true);
          }}
          onCancel={() => {
            setShowGameTypeSelection(false);
            setPendingCreateGameName(null);
          }}
        />
      </div>
    );
  }

  // Show game mode selection if creating a new game
  if (showGameModeSelection) {
    return (
      <div className="container">
        <NavHeader onHome={handleHome} />
        <GameModeScreen
          onSelectMode={(mode: GameMode) => {
            game.setGameMode(mode);
            setShowGameModeSelection(false);
            if (pendingGameType) {
              // Use pending name, saved name, or "Player" as fallback
              const playerName = pendingCreateGameName || savedName || "Player";
              game.setPlayerName(playerName);
              ws.send({
                action: "createGame",
                playerName,
                gameMode: mode,
                gameType: pendingGameType,
              } as ClientMessage);
              setPendingCreateGameName(null);
              setPendingGameType(null);
            }
          }}
          onCancel={() => {
            setShowGameModeSelection(false);
            setPendingCreateGameName(null);
            setPendingGameType(null);
          }}
        />
      </div>
    );
  }

  if (!game.state) {
    return (
      <div className="container">
        <NavHeader onHome={handleHome} />
        <LobbyScreen
          state={null}
          playerId={game.playerId || ""}
          playerName={game.playerName}
          onCreateGame={(name) => {
            setPendingCreateGameName(name);
            setShowGameTypeSelection(true);
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
          ws={ws}
        />
      </div>
    );
  }

  const isHost =
    game.state.players.length > 0 && game.state.players[0].playerId === game.playerId;

  if (game.state.status === "lobby") {
    return (
      <div className="container">
        <NavHeader onHome={handleHome} />
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
          ws={ws}
        />
      </div>
    );
  }

  return (
    <div className="game-container">
      <NavHeader onHome={handleHome} />
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
