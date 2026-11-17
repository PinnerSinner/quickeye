import type { GameState, Player } from "@quickeye/shared";
import {
  STALE_LOBBY_SECONDS,
  hostConnectionId,
  isHostConnected,
  isStaleLobbyGame,
} from "../src/lib/lobby";

const NOW = 1_800_000_000;

function player(id: string, connectionId: string | null): Player {
  return { playerId: id, name: id, connectionId, score: 0, currentCardId: null };
}

function game(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "ABCD",
    status: "lobby",
    hostId: "host",
    players: [player("host", "conn-host"), player("guest", "conn-guest")],
    centerCardId: null,
    drawPile: [],
    gameMode: "time-attack-60",
    gameType: "multiplayer",
    createdAt: NOW - 60,
    ttl: NOW + 3600,
    ...overrides,
  };
}

const live = (...ids: string[]) => new Set(ids);

describe("hostConnectionId / isHostConnected", () => {
  it("finds the host's socket even when the host isn't first in the list", () => {
    const g = game({ players: [player("guest", "conn-guest"), player("host", "conn-host")] });
    expect(hostConnectionId(g)).toBe("conn-host");
  });

  it("is false when the host's connectionId has been nulled by $disconnect", () => {
    const g = game({ players: [player("host", null)] });
    expect(isHostConnected(g, live("conn-host"))).toBe(false);
  });

  it("is false when the game still has a connectionId but the socket row is gone", () => {
    expect(isHostConnected(game(), live("conn-guest"))).toBe(false);
  });

  it("is true when the host's socket row exists", () => {
    expect(isHostConnected(game(), live("conn-host"))).toBe(true);
  });
});

describe("isStaleLobbyGame", () => {
  it("keeps a fresh lobby whose host is connected", () => {
    expect(isStaleLobbyGame(game(), live("conn-host"), NOW)).toBe(false);
  });

  it("keeps a lobby right on the age boundary", () => {
    const g = game({ createdAt: NOW - STALE_LOBBY_SECONDS });
    expect(isStaleLobbyGame(g, live("conn-host"), NOW)).toBe(false);
  });

  it("deletes a lobby older than the stale window even if the host is connected", () => {
    const g = game({ createdAt: NOW - STALE_LOBBY_SECONDS - 1 });
    expect(isStaleLobbyGame(g, live("conn-host"), NOW)).toBe(true);
  });

  it("deletes a fresh lobby whose host has gone", () => {
    expect(isStaleLobbyGame(game(), live(), NOW)).toBe(true);
  });

  it("never touches games that are playing or finished", () => {
    const old = NOW - 10 * STALE_LOBBY_SECONDS;
    expect(isStaleLobbyGame(game({ status: "playing", createdAt: old }), live(), NOW)).toBe(false);
    expect(isStaleLobbyGame(game({ status: "finished", createdAt: old }), live(), NOW)).toBe(false);
  });
});
