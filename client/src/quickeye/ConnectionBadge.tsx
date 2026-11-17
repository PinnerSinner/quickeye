/**
 * Small always-visible pill telling players whether they're in real
 * multiplayer or playing offline against bots.
 */

import type { CSSProperties } from "react";
import type { ConnectionStatus } from "../hooks/useWebSocket";

const LOOK: Record<ConnectionStatus, { dot: string; label: string; hint: string }> = {
  connected: {
    dot: "#22C55E",
    label: "Online",
    hint: "Connected to the Quickeye server. Multiplayer is live.",
  },
  connecting: {
    dot: "#F0C020",
    label: "Connecting…",
    hint: "Reaching the Quickeye server…",
  },
  reconnecting: {
    dot: "#F97316",
    label: "Reconnecting…",
    hint: "Lost the server for a moment, trying again. Solo play still works.",
  },
  offline: {
    dot: "#888",
    label: "Offline · solo & bots only",
    hint: "No game server configured for this build, so multiplayer is switched off.",
  },
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const look = LOOK[status];
  return (
    <div style={pill} title={look.hint} role="status" aria-live="polite" data-testid="connection-badge" data-status={status}>
      <span
        style={{
          ...dot,
          background: look.dot,
          animation: status === "connecting" || status === "reconnecting" ? "qe-glowpulse 1s ease-in-out infinite" : undefined,
        }}
      />
      {look.label}
    </div>
  );
}

const pill: CSSProperties = {
  position: "fixed",
  top: 12,
  right: 12,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  background: "#121212",
  color: "#F0F0F0",
  border: "3px solid #000",
  boxShadow: "3px 3px 0 0 #000",
  font: "800 11px 'Outfit',sans-serif",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  pointerEvents: "auto",
};
const dot: CSSProperties = { width: 10, height: 10, borderRadius: "50%", flex: "none" };
