import { useEffect, useState } from "react";

/**
 * Agent thinking indicator — wave dots + shimmer label + elapsed timer.
 * Inspired by BoardUI agent-thinking; adapted for FinSight (no external deps).
 */

const DOTS_GRID = 3;
const DOTS_SIZE = 4;
const DOTS_GAP = 2;
const DOTS_TICK_MS = 80;
const DOTS_TRAIL = 0.3;
const DOTS_MIN = 0.12;
const DOTS_PHASE_STEP = 1 / 8;
const DOTS_SEED = [0.55, 0.3, 0.15, 0.85, 0.55, 0.3, 1, 0.85, 0.55];

function dotScalar(col, row) {
  const m = DOTS_GRID - 1;
  return ((col + row) / (2 * m)) * (DOTS_GRID / (DOTS_GRID + 1));
}

function dotOpacities(phase) {
  return Array.from({ length: DOTS_GRID * DOTS_GRID }, (_, i) => {
    const s = dotScalar(i % DOTS_GRID, Math.floor(i / DOTS_GRID));
    const behind = (phase - s + 1) % 1;
    const lit = Math.max(0, 1 - behind / DOTS_TRAIL) ** 1.5;
    return DOTS_MIN + (1 - DOTS_MIN) * lit;
  });
}

function WaveDots() {
  const [opacities, setOpacities] = useState(DOTS_SEED);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let phase = 0;
    const id = window.setInterval(() => {
      phase = (phase + DOTS_PHASE_STEP) % 1;
      setOpacities(dotOpacities(phase));
    }, DOTS_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      aria-hidden
      className="grid shrink-0 text-[var(--color-text-secondary)]"
      style={{
        gridTemplateColumns: `repeat(${DOTS_GRID}, ${DOTS_SIZE}px)`,
        gap: DOTS_GAP,
      }}
    >
      {opacities.map((opacity, i) => (
        <span
          key={i}
          className="rounded-[1px] bg-current"
          style={{
            width: DOTS_SIZE,
            height: DOTS_SIZE,
            opacity,
            transition: "opacity 220ms ease",
          }}
        />
      ))}
    </span>
  );
}

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(
      () => setElapsed((performance.now() - started) / 1000),
      100
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
      {elapsed.toFixed(1)}s
    </span>
  );
}

export function AgentThinking({
  label = "Thinking",
  showTimer = true,
  className = "",
}) {
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 ${className}`}
      aria-live="polite"
    >
      <WaveDots />
      <span
        aria-label={label}
        className="text-sm text-[var(--color-text-secondary)] agent-thinking-shimmer"
      >
        {label}
      </span>
      {showTimer ? <ElapsedTimer /> : null}
    </div>
  );
}
