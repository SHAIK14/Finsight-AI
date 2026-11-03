import { useState, useRef } from "react";
import { useToast } from "./Toast";
import { ChatMessage } from "./ChatMessage";
import PromptBar from "./beautiful-ui/PromptBar";

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
    "What was the revenue growth?",
    "Summarize key financial risks",
    "Compare quarterly performance",
    "Extract all metrics and KPIs",
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
          <div className="h-full flex items-end justify-center px-6 pb-4 bg-canvas">
            <div className="w-full max-w-3xl">
              {hasDocuments ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {suggestedQueries.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => onQuery(text)}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              ) : showUploadPrompt ? (
                <p className="mb-3 text-[12.5px] text-ink-3">
                  Upload a PDF with the button in the prompt bar.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
            {messages.map((message, i) => (
              <ChatMessage
                key={message.id || i}
                message={message}
                onRegenerate={onRegenerate}
                onDeleteDocument={onDeleteDocFromChat}
                isLast={i === messages.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Input Area - Always visible */}
      <div className="bg-[var(--color-bg-primary)] px-6 pb-6 pt-2">
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
                    <span className="text-[var(--color-text-primary)] truncate max-w-[150px]">
                      {fileName}
                    </span>
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

          <PromptBar
            onSend={(text) => {
              if (!text.trim()) return;
              if (uploadedDocs.length === 0) {
                setShowUploadPrompt(true);
                toast.warning(
                  "No documents",
                  "Please upload a document first to ask questions"
                );
                return;
              }
              onQuery(text);
              setQuery("");
            }}
            onUpload={() => fileInputRef.current?.click()}
            loading={isQuerying}
            onStop={onCancel}
            disabled={uploading}
            placeholder="Ask anything about your documents…"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

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
