import { useMemo } from "react";

/**
 * Status-driven task rows (Beautiful UI TaskRows look, FinSight SSE data).
 */

function SpinnerRing({ active, children }) {
  const size = 24;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={active ? { animation: "spin 1.1s linear infinite" } : undefined}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        {active && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.28} ${c * 0.72}`}
          />
        )}
      </svg>
      <span className="relative text-[10.5px] font-semibold tabular-nums text-ink">
        {children}
      </span>
    </span>
  );
}

function Badge({ tone, children }) {
  return (
    <span
      className={`flex size-5.5 shrink-0 items-center justify-center rounded-full text-white ${
        tone === "red" ? "bg-red" : "bg-green"
      }`}
    >
      {children}
    </span>
  );
}

const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

function stageFromStatus(status) {
  const s = status || "";
  if (/generating|quality|finaliz|writing/i.test(s)) return 5;
  if (/risk/i.test(s)) return 4;
  if (/verification/i.test(s)) return 3;
  if (/research/i.test(s)) return 2;
  if (/searching|reranking|loading your documents|processing |cache/i.test(s))
    return 1;
  return 0;
}

function friendlyLabel(status) {
  if (!status) return "Thinking";
  if (status.includes("Understanding")) return "Understanding question";
  if (status.includes("Analyzing query")) return "Analyzing query";
  if (status.includes("Reranking")) return "Reranking chunks";
  if (status.includes("Research")) return "Research agent";
  if (status.includes("Verification")) return "Verification agent";
  if (status.includes("Risk")) return "Risk agent";
  if (status.includes("Generating")) return "Writing response";
  if (status.includes("Quality")) return "Quality check";
  if (status.includes("Searching") && status.includes("web")) return "Web search";
  if (status.includes("Searching")) return "Hybrid search";
  return status.replace("...", "").replace(" ✓", "").trim();
}

const BASE_ROWS = [
  { key: "understand", label: "Understand query", amount: "router" },
  { key: "retrieve", label: "Hybrid search + rerank", amount: "top-k" },
  { key: "research", label: "Research agent", amount: "chunks" },
  { key: "verify", label: "Verification agent", amount: "facts", optional: true },
  { key: "risk", label: "Risk agent", amount: "severity", optional: true },
  { key: "synthesize", label: "Synthesis + reflection", amount: "SSE" },
];

export default function AgentTaskRows({ status }) {
  const stage = stageFromStatus(status);
  const hasVerify = /verification/i.test(status || "") || stage >= 3;
  const hasRisk = /risk/i.test(status || "") || stage >= 4;

  const rows = useMemo(() => {
    return BASE_ROWS.filter((r) => {
      if (r.key === "verify") return hasVerify;
      if (r.key === "risk") return hasRisk;
      return true;
    });
  }, [hasVerify, hasRisk]);

  // Map absolute stage to index in filtered rows
  const order = ["understand", "retrieve", "research", "verify", "risk", "synthesize"];
  const currentKey = order[Math.min(stage, order.length - 1)];
  let activeIdx = rows.findIndex((r) => r.key === currentKey);
  if (activeIdx < 0) {
    // optional skipped — land on nearest prior
    for (let i = stage; i >= 0; i--) {
      const idx = rows.findIndex((r) => r.key === order[i]);
      if (idx >= 0) {
        activeIdx = idx;
        break;
      }
    }
  }

  return (
    <div className="flex w-full max-w-110 flex-col gap-2">
      {rows.map((row, i) => {
        const done = i < activeIdx;
        const running = i === activeIdx;
        return (
          <div
            key={row.key}
            className="self-stretch overflow-hidden bg-surface shadow-card"
            style={{
              borderRadius: 22,
              animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${i * 60}ms both`,
            }}
          >
            <div className="flex h-11 w-full items-center gap-2.5 px-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center">
                {done ? (
                  <Badge tone="green">{CheckIcon}</Badge>
                ) : running ? (
                  <SpinnerRing active>{i + 1}</SpinnerRing>
                ) : (
                  <SpinnerRing>{i + 1}</SpinnerRing>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {row.label}
              </span>
              <span className="text-[12.5px] text-ink-2 tabular-nums">
                {row.amount}
              </span>
              {done ? (
                <span className="inline-flex h-5.5 items-center rounded-full bg-green-tint px-2 text-[11.5px] font-medium text-green">
                  Completed
                </span>
              ) : running ? (
                <span className="inline-flex h-5.5 items-center rounded-full bg-accent-tint px-2 text-[11.5px] font-medium text-accent-ink">
                  Running
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      <p className="px-1 text-[11px] text-ink-3">{friendlyLabel(status)}</p>
    </div>
  );
}
