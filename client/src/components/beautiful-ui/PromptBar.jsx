import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Paperclip, Plus } from "lucide-react";

/**
 * Beautiful UI Prompt Bar — FinSight adaptation (no glimm dependency).
 */

function parseToken(draft) {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

const COMMANDS = [
  { key: "risks", name: "/risks", desc: "Major risk factors with severity" },
  { key: "metrics", name: "/metrics", desc: "Extract revenue & KPIs" },
  { key: "compare", name: "/compare", desc: "Compare quarterly performance" },
  { key: "summarize", name: "/summarize", desc: "Summarize the document" },
];

export default function PromptBar({
  variant = "Rounded",
  tall = false,
  placeholder = "Ask anything about your documents…",
  onSend,
  onUpload,
  loading = false,
  onStop,
  disabled = false,
}) {
  const pill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [rowBox, setRowBox] = useState(null);
  const [engaged, setEngaged] = useState(false);
  const wide = expanded || tall;
  const composerAnchorRef = useRef(null);
  const controlsRef = useRef(null);
  const inputRef = useRef(null);
  const measureRef = useRef(null);
  const rowRefs = useRef([]);

  const token = dismissed ? null : parseToken(draft);
  const menu = plusOpen ? "slash" : token?.kind === "slash" ? "slash" : null;
  const query = plusOpen ? "" : token?.query ?? "";
  const rows =
    menu === "slash"
      ? COMMANDS.filter((c) => c.name.slice(1).startsWith(query))
      : [];

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target)
      setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, rows.length]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    if (!input || !controls || !measure) return;

    const fixedControlsWidth = 28 * 3 + 72;
    const inlineGaps = 4 * 4;
    const inlineInputWidth =
      controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth =
      draft.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) setExpanded(needsFullWidth);

    const minHeight = 28;
    const maxHeight = 100;
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(
      Math.max(contentHeight, minHeight),
      maxHeight
    )}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft, expanded]);

  useEffect(() => {
    if (!plusOpen) return;
    const close = (event) => {
      if (!(event.target).closest?.("[data-promptbar]")) {
        setPlusOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [plusOpen]);

  const pick = (row) => {
    setDraft(`${token ? draft.slice(0, token.start) : draft}${row.name} `);
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = draft.trim().length > 0 && !disabled && !loading;
  const send = () => {
    if (!canSend) return;
    onSend?.(draft.trim());
    setDraft("");
    setPlusOpen(false);
  };

  return (
    <div data-promptbar className="w-full">
      <div ref={composerAnchorRef} className="relative">
        {menu && rows.length > 0 && (
          <div
            onMouseLeave={() => setEngaged(false)}
            className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-[10px] bg-surface p-1 shadow-raised"
            style={{
              animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
              transformOrigin: "bottom center",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
              style={{
                top: rowBox?.top ?? 0,
                height: rowBox?.height ?? 0,
                opacity: rowBox && engaged ? 1 : 0,
                transition:
                  "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
              }}
            />
            {rows.map((row, i) => (
              <button
                key={row.key}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => {
                  setActive(i);
                  setEngaged(true);
                }}
                onClick={() => pick(row)}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                <span className="shrink-0 text-[12.5px] font-medium text-ink">
                  {row.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">
                  {row.desc}
                </span>
              </button>
            ))}
            <div className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
              Type / for commands
            </div>
          </div>
        )}

        <div
          className={`relative isolate flex flex-col overflow-hidden border border-line bg-surface shadow-card transition-[border-color,border-radius] duration-150 focus-within:border-line-strong ${
            tall ? "gap-2.5 p-3.5" : "gap-1.5 p-1.5"
          } ${
            pill
              ? wide
                ? "rounded-[24px]"
                : "rounded-full"
              : tall
                ? "rounded-[22px]"
                : "rounded-[14px]"
          }`}
        >
          <span
            ref={measureRef}
            aria-hidden
            className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
          >
            {draft}
          </span>

          <div
            ref={controlsRef}
            className={`grid items-end gap-x-1 gap-y-1.5 ${
              wide
                ? "grid-cols-[28px_auto_minmax(0,1fr)_28px_28px]"
                : "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]"
            }`}
          >
            <button
              type="button"
              aria-label="Commands and upload"
              aria-expanded={plusOpen}
              disabled={disabled || loading}
              onClick={() => {
                setPlusOpen((c) => !c);
                inputRef.current?.focus();
              }}
              className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.94] disabled:opacity-40 ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${plusOpen ? "bg-hover text-ink" : ""} ${
                wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1"
              }`}
            >
              <Plus size={16} strokeWidth={2} />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              disabled={disabled || loading}
              onChange={(e) => {
                setDraft(e.target.value);
                setDismissed(false);
                setPlusOpen(false);
              }}
              onKeyDown={(e) => {
                if (menu && rows.length > 0) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setEngaged(true);
                    setActive(
                      (c) =>
                        (c + (e.key === "ArrowDown" ? 1 : rows.length - 1)) %
                        rows.length
                    );
                    return;
                  }
                  if (
                    (e.key === "Enter" && !e.shiftKey) ||
                    e.key === "Tab"
                  ) {
                    e.preventDefault();
                    pick(rows[active]);
                    return;
                  }
                }
                if (e.key === "Escape") {
                  setDismissed(true);
                  setPlusOpen(false);
                  return;
                }
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={placeholder}
              aria-label="Prompt"
              className={`${
                tall
                  ? "min-h-[68px] px-2 py-2 text-[14px] leading-5"
                  : "min-h-7 px-1 py-[5px] text-[13px] leading-[18px]"
              } min-w-0 w-full resize-none bg-transparent text-ink outline-none ring-0 focus:outline-none focus:ring-0 [overflow-wrap:anywhere] placeholder:text-ink-3 disabled:cursor-not-allowed ${
                wide
                  ? "col-span-full col-start-1 row-start-1"
                  : "col-start-2 row-start-1"
              }`}
            />

            <button
              type="button"
              aria-label="Upload PDF"
              disabled={disabled || loading}
              onClick={() => onUpload?.()}
              className={`flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink disabled:opacity-40 ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${
                wide
                  ? "col-start-2 row-start-2 justify-self-start"
                  : "col-start-3 row-start-1"
              }`}
            >
              <Paperclip size={14} />
              PDF
            </button>

            <button
              type="button"
              aria-label="Dictation unavailable"
              disabled
              className={`flex size-7 shrink-0 items-center justify-center text-ink-3 opacity-40 ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1"}`}
            >
              <Mic size={15} />
            </button>

            <button
              type="button"
              aria-label={loading ? "Stop" : "Send"}
              disabled={loading ? !onStop : !canSend}
              onClick={loading ? onStop : send}
              className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
                pill ? "rounded-full" : "rounded-[8px]"
              } ${wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1"}`}
              style={{
                background:
                  loading || canSend ? "var(--ink)" : "var(--line-strong)",
                color: loading || canSend ? "var(--surface)" : "var(--ink-2)",
              }}
            >
              {loading ? (
                <span className="block size-2.5 rounded-[2px] bg-current" />
              ) : (
                <ArrowUp size={16} strokeWidth={2.4} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
