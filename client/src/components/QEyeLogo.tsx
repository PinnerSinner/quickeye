import { useState, useEffect } from "react";
import "./QEyeLogo.css";

interface QEyeLogoProps {
  size?: "sm" | "md" | "lg";
  cycleIris?: boolean;
  fixedIrisColor?: string;
  includeWordmark?: boolean;
}

const IRIS_CYCLE = [
  "#1040C0", // blue
  "#F0C020", // yellow
  "#D02020", // red
  "#12A594", // teal
  "#E255A1", // pink
  "#8B5CF6", // purple
  "#F97316", // orange
  "#22C55E", // green
  "#0EA5E9", // cyan
];

export function QEyeLogo({
  size = "md",
  cycleIris = true,
  fixedIrisColor = "#1040C0",
  includeWordmark = true,
}: QEyeLogoProps) {
  const [irisIdx, setIrisIdx] = useState(0);

  useEffect(() => {
    if (!cycleIris) return;

    // Blink cycle is 3.4s; change iris color at ~96% (3.26s)
    const interval = setInterval(() => {
      setIrisIdx((prev) => (prev + 1) % IRIS_CYCLE.length);
    }, 3400);

    return () => clearInterval(interval);
  }, [cycleIris]);

  const irisColor = cycleIris ? IRIS_CYCLE[irisIdx] : fixedIrisColor;

  const sizeMap = {
    sm: { disc: 38, wordmarkSize: "0.9rem" },
    md: { disc: 64, wordmarkSize: "1.4rem" },
    lg: { disc: 88, wordmarkSize: "1.8rem" },
  };

  const { disc, wordmarkSize } = sizeMap[size];

  return (
    <div className="qeye-logo-container">
      <div
        className="qeye-disc"
        style={{ width: disc, height: disc }}
      >
        {/* Iris with smooth color transition */}
        <div
          className="qeye-iris"
          style={{
            background: irisColor,
            width: disc * 0.5,
            height: disc * 0.5,
          }}
        >
          {/* Pupil */}
          <div
            className="qeye-pupil"
            style={{ width: disc * 0.15, height: disc * 0.15 }}
          />
        </div>

        {/* Q-tail */}
        <div
          className="qeye-tail"
          style={{
            width: disc * 0.41,
            height: disc * 0.14,
          }}
        />
      </div>

      {includeWordmark && (
        <span
          className="qeye-wordmark"
          style={{ fontSize: wordmarkSize }}
        >
          uickeye
        </span>
      )}
    </div>
  );
}
