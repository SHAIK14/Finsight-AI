import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import LoadingState from "./beautiful-ui/LoadingState";
import AgentTaskRows from "./beautiful-ui/AgentTaskRows";

/**
 * Chat Message Components
 *
 * All components related to displaying messages in the chat:
 * - ChatMessage: User and assistant message bubbles
 * - DocumentMessage: Document attachment display
 * - CodeBlock: Syntax highlighted code blocks
 * - SourceCitations: Document source cards
 * - WebSourceCards: Web search result cards
 */

export function ChatMessage({
  message,
  onRegenerate,
  onDeleteDocument,
  isLast,
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isUser = message.role === "user";
  const isDocument = message.role === "document";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Document messages are shown as chips in the input area, not in chat
  if (isDocument) {
    return null;
  }

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[#0285ff] px-4 py-3 text-white">
          <p className="text-[14.5px] leading-6 whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  const showPipeline =
    message.streaming && message.status && !message.content;

  return (
    <div className="group animate-fade-in space-y-6">
      {showPipeline ? (
        <div className="space-y-4 max-w-md">
          <LoadingState label={message.status?.replace("...", "") || "Thinking"} />
          <AgentTaskRows status={message.status} />
        </div>
      ) : null}

      {/* Markdown Content */}
      {message.content ? (
        <div
          className="prose prose-sm max-w-none
            prose-headings:font-semibold prose-headings:text-ink prose-headings:tracking-tight
            prose-h1:text-xl prose-h1:mt-0 prose-h1:mb-4
            prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-ink prose-p:leading-7 prose-p:my-4
            prose-strong:text-ink prose-strong:font-semibold
            prose-ul:my-4 prose-ul:list-disc prose-ul:pl-5 prose-ul:space-y-2
            prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-5 prose-ol:space-y-2
            prose-li:text-ink prose-li:leading-7 prose-li:my-0
            prose-code:text-accent-ink prose-code:bg-inset prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0
            prose-table:my-6 prose-table:w-full prose-table:border-collapse prose-table:text-[13px]
            prose-thead:border-b prose-thead:border-line
            prose-th:bg-inset prose-th:px-3.5 prose-th:py-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-ink prose-th:border prose-th:border-line
            prose-td:px-3.5 prose-td:py-2.5 prose-td:text-ink prose-td:border prose-td:border-line prose-td:align-top
            prose-tr:border-b prose-tr:border-line
            prose-a:text-accent-ink prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-2 prose-blockquote:border-line-strong prose-blockquote:pl-4 prose-blockquote:text-ink-2
          "
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              table({ children }) {
                return (
                  <div className="my-6 overflow-x-auto rounded-[10px] border border-line bg-surface shadow-hairline">
                    <table className="m-0 w-full border-collapse text-[13px]">
                      {children}
                    </table>
                  </div>
                );
              },
              thead({ children }) {
                return <thead className="bg-inset">{children}</thead>;
              },
              th({ children }) {
                return (
                  <th className="border-b border-line px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-ink">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="border-b border-line px-3.5 py-2.5 align-top text-ink last:border-0">
                    {children}
                  </td>
                );
              },
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const language = match ? match[1] : "";

                if (!inline && language) {
                  return (
                    <CodeBlock
                      language={language}
                      code={String(children).replace(/\n$/, "")}
                    />
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
          {message.streaming ? (
            <span className="inline-block w-2 h-5 ml-1 bg-[#0285ff] animate-pulse rounded-sm" />
          ) : null}
        </div>
      ) : null}

      {message.sources &&
        message.sources.length > 0 &&
        !message.streaming && <SourceCitations sources={message.sources} />}

      {message.webSources &&
        message.webSources.length > 0 &&
        !message.streaming && <WebSourceCards sources={message.webSources} />}

      {!message.streaming && message.content ? (
        <div className="flex items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="grid size-7 place-items-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            title="Copy response"
            aria-label={copied ? "Copied" : "Copy response"}
          >
            {copied ? (
              <svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {isLast && onRegenerate ? (
            <button
              onClick={() => onRegenerate(message.id)}
              className="grid size-7 place-items-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Regenerate response"
              aria-label="Retry response"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          ) : null}

          <button
            onClick={() => setFeedback(feedback === "up" ? null : "up")}
            className={`grid size-7 place-items-center rounded-md transition-colors ${
              feedback === "up"
                ? "bg-[var(--color-bg-secondary)] text-emerald-500"
                : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
            title="Helpful"
            aria-pressed={feedback === "up"}
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>

          <button
            onClick={() => setFeedback(feedback === "down" ? null : "down")}
            className={`grid size-7 place-items-center rounded-md transition-colors ${
              feedback === "down"
                ? "bg-[var(--color-bg-secondary)] text-red-500"
                : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
            title="Not helpful"
            aria-pressed={feedback === "down"}
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * DocumentMessage Component - Displays uploaded document in chat
 *
 * How it works:
 * - Shows a card with document icon, name, size, and status
 * - Has delete button that removes both message and actual document
 * - Status badge shows processing state (pending/processed/failed)
 *
 * Why in chat?
 * - User can see what documents are attached to this conversation
 * - Can delete directly without going to sidebar
 * - Better visibility of upload context
 */
export function DocumentMessage({ message, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const documentData = message.documentData || message.sources || {};
  const fileName = documentData.fileName || message.content || "Document";
  const fileSize = documentData.fileSize || "Unknown size";
  const status = documentData.status || "pending";
  const documentId = documentData.document_id;

  const getStatusBadge = () => {
    switch (status) {
      case "processed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Processed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <svg
              className="w-3 h-3 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Ready to analyze
          </span>
        );
    }
  };

  const handleDelete = () => {
    if (onDelete && documentId) {
      onDelete(documentId, message.id);
    }
    setShowDeleteConfirm(false);
  };

  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[85%] w-80">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl rounded-br-md overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
          {/* Header with icon and delete */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-tertiary)]/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                PDF Document
              </span>
            </div>

            {/* Delete button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
              title="Delete document"
            >
              <svg
                className="w-4 h-4 text-[var(--color-text-tertiary)] hover:text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          {/* Document info */}
          <div className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {fileName}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  {fileSize}
                </p>
              </div>
            </div>

            {/* Status badge */}
            <div className="mt-3">{getStatusBadge()}</div>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="px-4 py-3 bg-red-500/5 border-t border-red-500/20">
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                Delete this document? This will also remove the file.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-1.5 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-xs font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Code Block Component with Copy Button
export function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      {/* Language Label */}
      <div className="flex items-center justify-between bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] border-b-0 rounded-t-lg px-4 py-2">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-primary)] border border-[var(--color-border)] transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: "0.5rem",
          borderBottomRightRadius: "0.5rem",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function SourceCitations({ sources }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">Sources</span>
        <span className="inline-flex h-5 items-center rounded-md bg-inset px-1.5 text-[11.5px] font-medium text-ink-2 shadow-hairline tabular-nums">
          {sources.length}
        </span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {sources.slice(0, 5).map((source, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setExpandedId(expandedId === i ? null : i)}
            className={`flex w-44 shrink-0 flex-col gap-2 rounded-[10px] border p-3 text-left transition-colors ${
              expandedId === i
                ? "border-[#0285ff]/40 bg-accent-tint"
                : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-accent-tint text-[11px] font-semibold text-accent-ink">
                {i + 1}
              </span>
              <span className="text-[12px] font-medium text-ink-2">
                Page {source.page_number || "?"}
              </span>
            </div>
            <div className="line-clamp-2 text-[12.5px] leading-snug text-ink">
              {source.document_name || "Document"}
            </div>
          </button>
        ))}
      </div>

      {expandedId !== null && sources[expandedId] && (
        <div className="rounded-[10px] border border-line bg-inset p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-accent-ink">
              Source {expandedId + 1} · Page{" "}
              {sources[expandedId].page_number || "N/A"}
            </span>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="rounded p-1 text-ink-3 hover:bg-hover-2 hover:text-ink"
              aria-label="Close preview"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-[13px] leading-6 text-ink">
            {sources[expandedId].content ||
              sources[expandedId].content_preview ||
              "No preview available"}
          </p>
        </div>
      )}
    </div>
  );
}

// Web Source Cards Component
export function WebSourceCards({ sources }) {
  if (!sources || sources.length === 0) return null;

  const getFaviconUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-[var(--color-accent)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          Web sources
        </span>
      </div>

      <div className="grid gap-2">
        {sources.slice(0, 3).map((source, i) => {
          const faviconUrl = getFaviconUrl(source.url);
          const hostname = source.url
            ? new URL(source.url).hostname.replace("www.", "")
            : "";

          return (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] hover:shadow-sm transition-all group"
            >
              {/* Favicon */}
              <div className="w-8 h-8 rounded-md bg-[var(--color-bg-tertiary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt=""
                    className="w-5 h-5"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                ) : (
                  <svg
                    className="w-4 h-4 text-[var(--color-text-tertiary)]"
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
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors truncate">
                  {source.title || "Web Result"}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {hostname}
                </div>
              </div>

              {/* Arrow */}
              <svg
                className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}
