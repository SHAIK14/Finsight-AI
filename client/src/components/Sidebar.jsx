import { useState } from "react";

/**
 * Sidebar Components
 *
 * Contains the main sidebar with documents list, chat history,
 * and user profile section. ChatGPT-style design.
 */

// Sidebar Component - ChatGPT Style
export function Sidebar({
  user,
  userProfile,
  uploadedDocs,
  chatHistory,
  currentChatId,
  onLogout,
  onDeleteDoc,
  onDeleteChat,
  onNewChat,
  onLoadChat,
  showUsageTooltip,
  setShowUsageTooltip,
}) {
  const [docsExpanded, setDocsExpanded] = useState(true);

  return (
    <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col">
      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg transition-colors text-sm font-medium"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Documents Section - Collapsible */}
        <div className="mb-6">
          <button
            onClick={() => setDocsExpanded(!docsExpanded)}
            className="w-full flex items-center justify-between px-2 py-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors group"
          >
            <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Documents ({uploadedDocs.length})
            </h3>
            <svg
              className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${
                docsExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {docsExpanded && (
            <div className="mt-2">
              {uploadedDocs.length === 0 ? (
                <p className="text-xs text-[var(--color-text-tertiary)] px-2 py-4 text-center">
                  No documents yet
                </p>
              ) : (
                <div className="space-y-0.5">
                  {uploadedDocs.map((doc) => (
                    <DocumentItem
                      key={doc.id}
                      document={doc}
                      canDelete={
                        userProfile?.role === "premium" ||
                        userProfile?.role === "admin"
                      }
                      onDelete={onDeleteDoc}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat History Section - Scrollable */}
        {chatHistory.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider px-2 mb-2">
              Recent Chats
            </h3>
            <div className="space-y-0.5">
              {chatHistory.map((chat) => (
                <ChatHistoryItem
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === currentChatId}
                  onClick={() => onLoadChat(chat.id)}
                  onDelete={onDeleteChat}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile Section - Bottom */}
      <div className="border-t border-[var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-semibold flex-shrink-0">
            {user?.firstName?.[0] || "U"}
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.firstName || "User"}
            </div>

            {/* Plan Badge with Tooltip */}
            <div className="relative">
              {!userProfile ? (
                // Clean loading shimmer for plan badge
                <div className="h-4 w-16 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
              ) : (
                <button
                  onMouseEnter={() => setShowUsageTooltip(true)}
                  onMouseLeave={() => setShowUsageTooltip(false)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <span className="capitalize">{userProfile.role} Plan</span>
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}

              {/* Usage Tooltip */}
              {showUsageTooltip && userProfile && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] p-3 z-10">
                  <div className="text-xs font-medium mb-3">
                    Usage This Month
                  </div>

                  {/* Uploads */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-secondary)]">
                        Uploads
                      </span>
                      <span className="font-mono">
                        {userProfile.uploads_this_month}/
                        {userProfile.uploads_limit || "∞"}
                      </span>
                    </div>
                    {userProfile.uploads_limit && (
                      <div className="h-1 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)]"
                          style={{
                            width: `${
                              (userProfile.uploads_this_month /
                                userProfile.uploads_limit) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Queries */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-secondary)]">
                        Queries
                      </span>
                      <span className="font-mono">
                        {userProfile.queries_this_month}/
                        {userProfile.queries_limit || "∞"}
                      </span>
                    </div>
                    {userProfile.queries_limit && (
                      <div className="h-1 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)]"
                          style={{
                            width: `${
                              (userProfile.queries_this_month /
                                userProfile.queries_limit) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {userProfile.role === "free" && (
                    <button className="w-full mt-3 px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-medium rounded-md transition-colors">
                      Upgrade to Premium
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
            title="Sign out"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Document Item Component - ChatGPT Style (no borders, clean hover)
export function DocumentItem({ document, canDelete, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    onDelete(document.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="group relative px-2 py-2.5 hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors cursor-default">
      <div className="flex items-start gap-2">
        {/* PDF Icon */}
        <svg
          className="w-3.5 h-3.5 text-[var(--color-error)] flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
            clipRule="evenodd"
          />
        </svg>

        {/* Document Info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--color-text-primary)] truncate">
            {document.fileName}
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            {document.fileSize}
          </div>
        </div>

        {/* Delete Button - Only for premium/admin */}
        {canDelete && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--color-error)]/10 rounded transition-all flex-shrink-0"
            title="Delete document"
          >
            <svg
              className="w-3.5 h-3.5 text-[var(--color-error)]"
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
        )}
      </div>

      {/* Delete Confirmation Tooltip */}
      {showDeleteConfirm && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] p-2 z-20">
          <p className="text-xs text-[var(--color-text-secondary)] mb-2">
            Delete this document?
          </p>
          <div className="flex gap-1">
            <button
              onClick={handleDelete}
              className="flex-1 px-2 py-1 bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-white text-xs rounded transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-2 py-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-xs rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Chat History Item Component - ChatGPT Style
export function ChatHistoryItem({ chat, isActive, onClick, onDelete }) {
  /**
   * Display a past chat session in the sidebar
   *
   * Shows:
   * - First question as title (truncated)
   * - Relative timestamp
   * - Active state highlight
   * - Delete button with confirmation modal on hover
   */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getRelativeTime = (timestamp) => {
    const now = new Date();

    // Parse timestamp as UTC (Supabase returns UTC timestamps)
    // If timestamp doesn't end with 'Z', it needs to be treated as UTC
    const timestampStr = timestamp.endsWith("Z") ? timestamp : timestamp + "Z";
    const messageTime = new Date(timestampStr);

    const diff = now - messageTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return messageTime.toLocaleDateString();
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(chat.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-200 ${
          isActive
            ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] shadow-sm"
            : "hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        <div className="flex items-start gap-2.5">
          {/* Chat Icon */}
          <svg
            className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-colors ${
              isActive ? "text-[var(--color-accent)]" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>

          {/* Chat Info */}
          <div className="flex-1 min-w-0 pr-6">
            <div className="text-sm font-medium truncate leading-tight">
              {chat.title}
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
              {getRelativeTime(chat.updated_at)}
            </div>
          </div>
        </div>
      </button>

      {/* Delete Button - Shows on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDeleteConfirm(true);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
        title="Delete chat"
      >
        <svg
          className="w-3.5 h-3.5 text-red-500"
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] p-2 z-20">
          <p className="text-xs text-[var(--color-text-secondary)] mb-2">
            Delete this chat?
          </p>
          <div className="flex gap-1">
            <button
              onClick={handleDelete}
              className="flex-1 px-2 py-1 bg-[var(--color-error)] hover:bg-[var(--color-error)]/90 text-white text-xs rounded transition-colors"
            >
              Delete
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              className="flex-1 px-2 py-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-xs rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
