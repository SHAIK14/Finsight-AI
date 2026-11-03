export default function ContextCards({ chunks = [], labels }) {
  const copy = {
    header: labels?.header ?? "Sources",
    count: labels?.count ?? String(chunks.length),
  };

  if (!chunks.length) return null;

  return (
    <div className="flex w-full max-w-95 flex-col gap-2">
      <div
        className="flex items-center gap-2 px-0.5"
        style={{ animation: "fade-in 400ms ease-out both" }}
      >
        <span className="text-[13px] font-semibold text-ink">{copy.header}</span>
        <span className="inline-flex h-5 items-center rounded-md bg-inset px-1.5 text-[11.5px] font-medium text-ink-2 shadow-hairline tabular-nums">
          {copy.count}
        </span>
      </div>

      {chunks.map((chunk, i) => (
        <div
          key={`${chunk.title}-${i}`}
          className="overflow-hidden rounded-card bg-surface shadow-card"
          style={{
            animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${i * 100}ms both`,
          }}
        >
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              <span className="truncate">{chunk.title}</span>
            </span>
            <span className="ml-auto shrink-0 text-[12px] text-ink-3 tabular-nums">
              {chunk.chars}
            </span>
          </div>
          {chunk.body ? (
            <p className="px-3 pt-2 pb-1 text-[12.5px] leading-relaxed text-ink-2 line-clamp-3">
              {chunk.body}
            </p>
          ) : null}
          <div className="px-3 pb-3 pt-1">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-inset px-2 text-[12px] font-medium text-ink-2 shadow-btn">
              <span
                className={`flex size-3.5 items-center justify-center rounded-[4px] ${chunk.tone || "bg-red"} text-[7px] font-bold text-white`}
              >
                {chunk.badge || "PDF"}
              </span>
              {chunk.source}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
