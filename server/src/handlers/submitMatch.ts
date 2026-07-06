/**
 * submitMatch route handler (action: "submitMatch").
 *
 * This is the authoritative anti-cheat path (CLAUDE.md: never trust the client).
 * The client sends only the symbolId it thinks matches; the server re-derives
 * the player's card and the center card from state and checks the match itself.
 *
 * Flow:
 *  1. Resolve the player from their connection.
 *  2. Run the shared applyMatch logic to validate + compute the next state.
 *  3. If correct, write with optimistic locking (center-card guard) so two
 *     simultaneous correct matches can't both advance the game.
 *  4. Reply with the result; broadcast new state to everyone on success.
 */

import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { applyMatch, type SubmitMatchMessage, type LeaderboardEntry } from "@quickeye/shared";
import { getConnection, getGame, putGameIfCenterUnchanged, putLeaderboardEntry } from "../lib/dynamo";
import { sendToConnection, broadcast, endpointFromEvent } from "../lib/apigw";
import { ok, fail } from "../lib/util";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = endpointFromEvent(event.requestContext);

  const sendError = (code: string, message: string) =>
    sendToConnection(endpoint, connectionId, { type: "error", code, message });

  try {
    const body = JSON.parse(event.body ?? "{}") as SubmitMatchMessage;
    const gameId = (body.gameId ?? "").trim().toUpperCase();
    const symbolId = body.symbolId;

    const [conn, game] = await Promise.all([
      getConnection(connectionId),
      getGame(gameId),
    ]);

    if (!game || !conn?.playerId) {
      await sendError("NOT_FOUND", "Game or player not found.");
      return ok();
    }
    if (game.status !== "playing") {
      await sendError("NOT_PLAYING", "Game is not in progress.");
      return ok();
    }

    const expectedCenter = game.centerCardId;
    const outcome = applyMatch(game, conn.playerId, symbolId);

    if (!outcome.correct) {
      // Wrong guess — no state change, just tell the submitter.
      await sendToConnection(endpoint, connectionId, {
        type: "matchResult",
        correct: false,
      });
      return ok();
    }

    // Correct: persist, guarded against a concurrent winner.
    const won = await putGameIfCenterUnchanged(outcome.state, expectedCenter);
    if (!won) {
      await sendToConnection(endpoint, connectionId, {
        type: "matchResult",
        correct: false,
      });
      return ok();
    }

    await sendToConnection(endpoint, connectionId, {
      type: "matchResult",
      correct: true,
      symbolId,
      gameOver: outcome.gameOver,
    });
    await broadcast(
      endpoint,
      outcome.state.players.map((p) => p.connectionId),
      { type: "stateUpdate", state: outcome.state }
    );

    // Save scores to global leaderboard when game ends
    if (outcome.gameOver) {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const timestamp = Math.floor(Date.now() / 1000);
      const gameMode = "time-attack-60"; // TODO: track game mode in GameState

      // Save each player's score to daily and all-time leaderboards
      const leaderboardSaves = outcome.state.players.map((player) => {
        const dailyEntry: LeaderboardEntry = {
          playerId: player.playerId,
          playerName: player.name,
          score: player.score,
          gameMode,
          timestamp,
          date: today,
        };
        const allTimeEntry: LeaderboardEntry = {
          playerId: player.playerId,
          playerName: player.name,
          score: player.score,
          gameMode,
          timestamp,
          date: "all-time",
        };
        return Promise.all([
          putLeaderboardEntry(dailyEntry),
          putLeaderboardEntry(allTimeEntry),
        ]);
      });

      // Fire off leaderboard saves in the background
      Promise.all(leaderboardSaves).catch((err) => {
        console.error("Failed to save leaderboard entries:", err);
      });
    }

    return ok();
  } catch (err) {
    console.error("submitMatch failed", err);
    await sendError("MATCH_FAILED", "Could not process match.");
    return fail();
  }
};
