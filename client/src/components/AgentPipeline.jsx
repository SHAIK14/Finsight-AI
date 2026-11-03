import { useRef } from "react";
import { AgentThinking } from "./AgentThinking";

/**
 * Collapsible agent todo strip driven by live SSE status strings.
 */

const CORE = [
  { id: "understand", title: "Understand query" },
  { id: "retrieve", title: "Hybrid search + rerank" },
  { id: "research", title: "Research agent" },
  { id: "synthesize", title: "Synthesis + reflection" },
];

function stageFromStatus(status) {
  const s = status || "";
  if (/generating|quality|finaliz|writing/i.test(s)) return "synthesize";
  if (/risk/i.test(s)) return "risk";
  if (/verification/i.test(s)) return "verify";
  if (/research/i.test(s)) return "research";
  if (/searching|reranking|loading your documents|processing |cache/i.test(s))
    return "retrieve";
  if (/understanding|analyzing query|loading conversation|starting/i.test(s))
    return "understand";
  return "understand";
}

function friendlyLabel(status) {
  if (!status) return "Thinking";
  if (status.includes("Loading conversation")) return "Loading context";
  if (status.includes("Understanding")) return "Understanding question";
  if (status.includes("Loading your documents")) return "Loading documents";
  if (status.includes("Processing")) return status.replace("...", "");
  if (status.includes("Analyzing query")) return "Analyzing query";
  if (status.includes("cache")) return "Retrieved from cache";
  if (status.includes("Research agent")) return "Researching documents";
  if (status.includes("Research complete")) return "Research complete";
  if (status.includes("Verification")) return "Verifying facts";
  if (status.includes("Risk agent")) return "Assessing risks";
  if (status.includes("Searching") && status.includes("documents"))
    return "Searching documents";
  if (status.includes("Reranking")) return "Finding best matches";
  if (status.includes("web")) return "Searching the web";
  if (status.includes("Generating")) return "Writing response";
  if (status.includes("Quality") || status.includes("Finalizing"))
    return "Finalizing";
  return status.replace("...", "").replace(" ✓", "").replace(" ⚡", "").trim();
}

function StatusIcon({ state }) {
  if (state === "completed") {
    return (
      <svg
        className="size-4 text-emerald-500"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.15" />
        <path
          d="M7.5 12.25 10.5 15.25 16.75 8.75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === "in-progress") {
    return (
      <span className="relative grid size-4 place-items-center" aria-hidden>
        <span className="absolute inset-0 rounded-full border-2 border-[var(--color-accent)]/30" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-accent)] animate-spin" />
      </span>
    );
  }
  return (
    <span
      className="size-4 rounded-full border border-dashed border-[var(--color-border)]"
      aria-hidden
    />
  );
}

export function AgentPipeline({ status, webSources = [] }) {
  const seen = useRef({ verify: false, risk: false });
  if (/verification/i.test(status || "")) seen.current.verify = true;
  if (/risk/i.test(status || "")) seen.current.risk = true;

  const steps = [...CORE];
  if (seen.current.verify) {
    steps.splice(steps.length - 1, 0, {
      id: "verify",
      title: "Verification agent",
    });
  }
  if (seen.current.risk) {
    steps.splice(steps.length - 1, 0, { id: "risk", title: "Risk agent" });
  }

  const currentId = stageFromStatus(status);
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) => s.id === currentId)
  );
  // If optional stage not in list yet, map to nearest prior
  const activeIdx =
    currentIdx >= 0
      ? currentIdx
      : Math.max(
          0,
          steps.findIndex((s) => s.id === "research")
        );

  const label = friendlyLabel(status);
  const completedCount = Math.min(activeIdx, steps.length);

  return (
    <div className="w-full max-w-md space-y-3">
      <AgentThinking label={label} />

      <section
        aria-label="Agent task list"
        className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40"
      >
        <div className="flex h-10 items-center gap-2 px-3.5 border-b border-[var(--color-border)]/70">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Agents
          </span>
          <span className="ml-auto text-xs tabular-nums text-[var(--color-text-tertiary)]">
            {completedCount}/{steps.length}
          </span>
        </div>
        <ol className="px-2 py-2 space-y-0.5">
          {steps.map((step, i) => {
            const state =
              i < activeIdx
                ? "completed"
                : i === activeIdx
                  ? "in-progress"
                  : "pending";
            return (
              <li
                key={step.id}
                className="flex min-h-9 items-center gap-2.5 rounded-xl px-2 py-1"
              >
                <StatusIcon state={state} />
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    state === "pending"
                      ? "text-[var(--color-text-tertiary)]"
                      : state === "in-progress"
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-tertiary)] line-through decoration-[var(--color-border)]"
                  }`}
                >
                  {step.title}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {webSources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {webSources.slice(0, 4).map((source, i) => {
            let domain = "web";
            try {
              domain = new URL(source.url).hostname
                .replace("www.", "")
                .split(".")[0];
            } catch {
              /* ignore */
            }
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]"
              >
                <span className="capitalize">{domain}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
