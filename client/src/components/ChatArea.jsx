import { useState, useRef } from "react";
import { useToast } from "./Toast";
import { ChatMessage } from "./ChatMessage";

/**
 * ChatArea Components
 *
 * Main chat interface with message display, input area,
 * and streaming progress indicator.
 */

export function ChatArea({
  uploadedDocs,
  messages,
  uploading,
  uploadProgress,
  userProfile,
  isQuerying,
  currentStatus,
  webSearchSources,
  onUpload,
  onQuery,
  onCancel,
  onRegenerate,
  onDeleteDocFromChat,
}) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);

  // Get document messages from current chat (shown as chips near input)
  const attachedDocs = messages.filter((msg) => msg.role === "document");

  const suggestedQueries = [
    {
      text: "What was the revenue growth?",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
          />
        </svg>
      ),
    },
    {
      text: "Summarize key financial risks",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      ),
    },
    {
      text: "Compare quarterly performance",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
      ),
    },
    {
      text: "Extract all metrics and KPIs",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
          />
        </svg>
      ),
    },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (uploadedDocs.length === 0) {
      setShowUploadPrompt(true);
      toast.warning(
        "No documents",
        "Please upload a document first to ask questions"
      );
      return;
    }

    // Send query to backend
    onQuery(query);
    setQuery("");
  };

  const handleSuggestedQuery = (suggestedQuery) => {
    if (uploadedDocs.length === 0) {
      setShowUploadPrompt(true);
      toast.warning(
        "No documents",
        "Please upload a document first to ask questions"
      );
      return;
    }
    onQuery(suggestedQuery);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      setShowUploadPrompt(false);
    }
  };

  const hasDocuments = uploadedDocs.length > 0;
  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          // Empty Chat State - Premium design
          <div className="h-full flex items-center justify-center px-6">
            <div className="max-w-xl w-full">
              {/* Logo Icon */}
              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-center">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 40 40"
                    fill="none"
                    className="text-[var(--color-text-primary)]"
                  >
                    <circle
                      cx="20"
                      cy="20"
                      r="17"
                      stroke="currentColor"
                      strokeWidth="1"
                      opacity="0.1"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      opacity="0.3"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle cx="20" cy="20" r="1.5" fill="currentColor" />
                    <path
                      d="M27 13 L32 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="34" cy="6" r="2.5" fill="currentColor" />
                  </svg>
                </div>
              </div>

              {/* Heading */}
              <div className="text-center mb-10">
                <h2 className="text-2xl font-medium tracking-tight mb-3 text-[var(--color-text-primary)]">
                  {hasDocuments
                    ? "What would you like to analyze?"
                    : "Start with a document"}
                </h2>
                <p className="text-sm text-[var(--color-text-tertiary)] leading-relaxed max-w-sm mx-auto">
                  {hasDocuments
                    ? "Ask any question about your financial documents"
                    : "Upload a 10-K, 10-Q, or earnings report to get started"}
                </p>
              </div>

              {/* Suggested Queries - 2x2 Grid */}
              <div className="grid grid-cols-2 gap-3">
                {suggestedQueries.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (hasDocuments) {
                        onQuery(suggestion.text);
                      } else {
                        setQuery(suggestion.text);
                        setShowUploadPrompt(true);
                      }
                    }}
                    className="group text-left p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]/50 transition-all duration-200"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-tertiary)] group-hover:bg-[var(--color-accent)]/10 flex items-center justify-center mb-3 transition-colors">
                      <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors">
                        {suggestion.icon}
                      </span>
                    </div>
                    <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors leading-snug block">
                      {suggestion.text}
                    </span>
                  </button>
                ))}
              </div>

              {/* Upload prompt */}
              {showUploadPrompt && !hasDocuments && (
                <div className="mt-6 p-4 rounded-xl bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-[var(--color-accent)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        Upload a document first
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                        Use the paperclip icon below
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map((message, i) => (
              <ChatMessage
                key={message.id || i}
                message={message}
                onRegenerate={onRegenerate}
                onDeleteDocument={onDeleteDocFromChat}
                isLast={i === messages.length - 1}
              />
            ))}
            {isQuerying && (
              <div className="flex justify-center">
                <button
                  onClick={onCancel}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-error)]/10 border border-[var(--color-border)] hover:border-[var(--color-error)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-error)] transition-all"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Stop generating
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Input Area - Always visible */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-6 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Attached documents chips */}
          {attachedDocs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachedDocs.map((doc) => {
                const docData = doc.documentData || doc.sources || {};
                const fileName = docData.fileName || doc.content || "Document";
                const documentId = docData.document_id;

                return (
                  <div
                    key={doc.id}
                    className="group inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm"
                  >
                    {/* PDF icon */}
                    <svg
                      className="w-4 h-4 text-red-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>

                    {/* Filename */}
                    <span className="text-[var(--color-text-primary)] truncate max-w-[150px]">
                      {fileName}
                    </span>

                    {/* Delete button - shows on hover */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteDocFromChat(documentId, doc.id);
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                      title="Remove document"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] hover:text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your documents..."
              disabled={isQuerying}
              className="w-full pl-5 pr-24 py-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl focus:outline-none focus:border-[var(--color-accent)] transition-colors text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {/* Upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors group"
                title="Upload document"
                disabled={uploading}
              >
                {uploading ? (
                  <div className="relative w-5 h-5">
                    <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="var(--color-border)"
                        strokeWidth="2"
                        fill="none"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="var(--color-accent)"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 10}`}
                        strokeDashoffset={`${
                          2 * Math.PI * 10 * (1 - uploadProgress / 100)
                        }`}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />
                    </svg>
                  </div>
                ) : (
                  <svg
                    className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Submit button */}
              <button
                type="submit"
                disabled={!query.trim() || isQuerying}
                className="p-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </div>
          </form>

          {userProfile && (
            <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3">
              {userProfile.uploads_limit
                ? `${
                    userProfile.uploads_limit - userProfile.uploads_this_month
                  } upload${
                    userProfile.uploads_limit -
                      userProfile.uploads_this_month ===
                    1
                      ? ""
                      : "s"
                  } remaining`
                : "Unlimited uploads"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Thinking Indicator - Iconic Style
export function KineticProgressIndicator({ status, webSources }) {
  const getDisplayText = (statusText) => {
    if (!statusText) return "Thinking";
    if (statusText.includes("Loading conversation")) return "Loading context";
    if (statusText.includes("Understanding")) return "Understanding question";
    if (statusText.includes("Loading your documents"))
      return "Loading documents";
    if (statusText.includes("Analyzing query")) return "Analyzing query";
    if (statusText.includes("cache")) return "Retrieved from cache";
    if (statusText.includes("Research agent")) return "Researching documents";
    if (statusText.includes("Research complete")) return "Research complete";
    if (statusText.includes("Verification")) return "Verifying facts";
    if (statusText.includes("Risk agent")) return "Assessing risks";
    if (statusText.includes("Searching") && statusText.includes("documents"))
      return "Searching documents";
    if (statusText.includes("Reranking")) return "Finding best matches";
    if (statusText.includes("web")) return "Searching the web";
    if (statusText.includes("Generating")) return "Writing response";
    if (statusText.includes("Quality") || statusText.includes("Finalizing"))
      return "Finalizing";
    if (statusText.includes("✓")) return statusText.replace(" ✓", "");
    return statusText.replace("...", "");
  };

  const displayText = getDisplayText(status);
  const isComplete = status?.includes("✓");

  return (
    <div className="space-y-3">
      {/* Main status line */}
      <div className="flex items-center gap-2">
        {/* Iconic animated indicator */}
        {isComplete ? (
          <svg
            className="w-4 h-4 text-[var(--color-success)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
                style={{
                  animation: "bounce 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Status text */}
        <span
          className={`text-sm ${
            isComplete
              ? "text-[var(--color-success)]"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          {displayText}
        </span>
      </div>

      {/* Web sources pills */}
      {webSources && webSources.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {webSources.slice(0, 4).map((source, i) => {
            let domain = "web";
            try {
              domain = new URL(source.url).hostname
                .replace("www.", "")
                .split(".")[0];
            } catch {}
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-secondary)]"
                style={{
                  animation: "fadeIn 0.3s ease-out",
                  animationDelay: `${i * 0.1}s`,
                  animationFillMode: "both",
                }}
              >
                <svg
                  className="w-3 h-3 text-[var(--color-accent)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
                  />
                </svg>
                <span className="capitalize">{domain}</span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
