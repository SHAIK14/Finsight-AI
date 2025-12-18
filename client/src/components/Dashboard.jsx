import { useState, useRef, useEffect } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useToast } from "./Toast";
import { DashboardSkeleton } from "./DashboardSkeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// Use environment variable for API URL (falls back to localhost for dev)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Environment-based logger - only logs in development
const isDev = import.meta.env.DEV;
const logger = {
  log: (...args) => isDev && console.log(...args),
  error: (...args) => console.error(...args), // Always log errors
  warn: (...args) => isDev && console.warn(...args),
  info: (...args) => isDev && console.info(...args),
};

export function Dashboard({ user, isLoaded }) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const toast = useToast();

  const [userProfile, setUserProfile] = useState(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUsageTooltip, setShowUsageTooltip] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentStatus, setCurrentStatus] = useState("");
  const [webSearchSources, setWebSearchSources] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const abortControllerRef = useRef(null);

  // Load all data in parallel on mount
  useEffect(() => {
    if (isLoaded && user) {
      loadAllData();
    }
  }, [isLoaded, user]);

  const loadAllData = async () => {
    /**
     * Load all initial data in parallel using Promise.all
     * This prevents the staggered UI effect where elements appear one-by-one
     */
    setIsDataLoading(true);
    try {
      await Promise.all([
        fetchUserProfile(),
        fetchDocuments(),
        fetchChatHistory(),
      ]);
    } finally {
      setIsDataLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    /**
     * Fetch user profile with detailed logging for debugging
     *
     * Common issues:
     * - Missing token: Clerk not initialized properly
     * - 401 error: Token expired or invalid
     * - Network error: Backend not running
     * - 500 error: Backend auth middleware issue
     */
    try {
      logger.log("🔐 [Auth] Fetching user profile...");

      const token = await getToken();
      logger.log("🔑 [Auth] Token status:", token ? "✓ Present" : "✗ Missing");

      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      logger.log(
        "📡 [Auth] Response status:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("❌ [Auth] Failed:", errorText);
        throw new Error(`Auth failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      logger.log("✅ [Auth] User profile loaded:", {
        role: data.role,
        email: data.email,
        uploads: `${data.uploads_this_month}/${data.uploads_limit || "∞"}`,
        queries: `${data.queries_this_month}/${data.queries_limit || "∞"}`,
      });

      setUserProfile(data);
    } catch (error) {
      logger.error("❌ [Auth] Error:", error.message);
      toast.error("Authentication failed", error.message);

      // If auth fails, user might need to re-login
      if (error.message.includes("401") || error.message.includes("token")) {
        toast.error("Session expired", "Please sign in again");
      }
    }
  };

  const fetchDocuments = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/documents/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUploadedDocs(data.documents || []);
    } catch (error) {
      logger.error("Failed to fetch documents:", error);
    }
  };

  const fetchChatHistory = async () => {
    /**
     * Load all chat sessions from database
     *
     * How it works:
     * 1. Call backend API to get user's chats
     * 2. Populate chatHistory state
     * 3. Chats are sorted by updated_at (most recent first)
     *
     * Why on mount?
     * - User sees their previous conversations immediately
     * - Survives page refresh
     */
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/chat/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setChatHistory(data.chats || []);
    } catch (error) {
      logger.error("Failed to fetch chat history:", error);
    }
  };

  const saveChat = async () => {
    /**
     * Save current chat session to database
     *
     * How it works:
     * 1. Check if there are messages to save
     * 2. Send to backend (upsert - insert or update)
     * 3. Backend handles duplicate prevention
     *
     * When called?
     * - After streaming completes (in handleQuery)
     * - When user clicks "New Chat" (to save before clearing)
     *
     * Why auto-save?
     * - User never loses their conversation
     * - No manual "Save" button needed
     * - ChatGPT-style seamless experience
     */
    if (messages.length === 0) return;

    try {
      const token = await getToken();
      const chatId = currentChatId || Date.now().toString();

      await fetch(`${API_URL}/api/chat/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: chatId,
          title: messages[0]?.content.substring(0, 50) || "New Chat", // First 50 chars
          messages: messages,
        }),
      });

      // Update currentChatId if it was null
      if (!currentChatId) {
        setCurrentChatId(chatId);
      }

      // Refresh chat history to show in sidebar
      await fetchChatHistory();
    } catch (error) {
      logger.error("Failed to save chat:", error);
    }
  };

  const handleUpload = async (file) => {
    /**
     * Upload a PDF and add it to the current chat as a document message
     *
     * How it works:
     * 1. Validate file type and upload limits
     * 2. Upload to backend (/api/documents/upload)
     * 3. Create document message in chat (/api/chat-sessions/document-message)
     * 4. Add document message to local messages state
     * 5. Refresh documents list and user profile
     *
     * Why add to chat?
     * - User can see uploaded documents in conversation
     * - Can delete documents directly from chat
     * - Better UX - like ChatGPT's file attachments
     */

    // Check if user can upload (free users have limit)
    if (userProfile?.role === "free" && userProfile?.uploads_limit) {
      if (userProfile.uploads_this_month >= userProfile.uploads_limit) {
        toast.error(
          "Upload limit reached",
          `Free tier allows ${userProfile.uploads_limit} upload per month`
        );
        return;
      }
    }

    if (!file.type.includes("pdf")) {
      toast.error("Invalid file type", "Please upload a PDF file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // Step 1: Upload the file
      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const uploadData = await response.json();
      setUploadProgress(100);

      // Step 2: Create document message in chat session
      const docMessageResponse = await fetch(
        `${API_URL}/api/chat-sessions/document-message`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: currentSessionId,
            document_id: uploadData.document.id,
            file_name: uploadData.document.fileName,
            file_size: uploadData.document.fileSize,
            file_url: "", // Not needed for display
            status: uploadData.document.status,
          }),
        }
      );

      if (docMessageResponse.ok) {
        const docMessageData = await docMessageResponse.json();

        // Update session ID if a new one was created
        if (docMessageData.session_id && !currentSessionId) {
          setCurrentSessionId(docMessageData.session_id);
        }

        // Step 3: Add document message to local state
        const documentMessage = {
          id: docMessageData.message.id,
          role: "document",
          content: uploadData.document.fileName,
          documentData: {
            document_id: uploadData.document.id,
            fileName: uploadData.document.fileName,
            fileSize: uploadData.document.fileSize,
            status: uploadData.document.status,
          },
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, documentMessage]);
        logger.log(
          "📎 [UPLOAD] Document message added to chat:",
          documentMessage
        );
      }

      // Step 4: Refresh documents and user profile
      await fetchDocuments();
      await fetchUserProfile();

      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        toast.success("Upload complete!", `${file.name} uploaded successfully`);
      }, 500);
    } catch (error) {
      logger.error("Upload error:", error);
      toast.error("Upload failed", error.message);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Delete failed");
      }

      // Refresh documents list and user profile
      await fetchDocuments();
      await fetchUserProfile();

      toast.success("Document deleted", "Document removed successfully");
    } catch (error) {
      logger.error("Delete error:", error);
      toast.error("Delete failed", error.message);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/chat/${chatId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Delete failed");
      }

      // If deleted chat was active, clear current chat
      if (chatId === currentChatId) {
        setMessages([]);
        setCurrentChatId(null);
      }

      // Refresh chat history
      await fetchChatHistory();

      toast.success("Chat deleted", "Chat removed successfully");
    } catch (error) {
      logger.error("Delete chat error:", error);
      toast.error("Delete failed", error.message);
    }
  };

  const handleDeleteDocFromChat = async (documentId, messageId) => {
    /**
     * Delete a document from within the chat
     *
     * How it works:
     * 1. Immediately remove from UI (optimistic update)
     * 2. Call backend to delete document message + actual document
     * 3. Refresh documents list
     *
     * Why optimistic update?
     * - Prevents double-click issues
     * - Better UX - instant feedback
     */
    if (!currentSessionId || !documentId) {
      return; // Silently ignore if missing data
    }

    // Immediately remove from UI to prevent double-clicks
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

    try {
      const token = await getToken();
      const response = await fetch(
        `${API_URL}/api/chat-sessions/document-message`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: currentSessionId,
            document_id: documentId,
          }),
        }
      );

      if (!response.ok) {
        // Don't show error for 404 (already deleted)
        if (response.status !== 404) {
          const error = await response.json();
          throw new Error(error.detail || "Delete failed");
        }
      }

      // Refresh documents list
      await fetchDocuments();
      await fetchUserProfile();

      toast.success("Document deleted", "Document removed successfully");
    } catch (error) {
      logger.error("Delete document from chat error:", error);
      toast.error("Delete failed", error.message);
    }
  };

  const handleQuery = async (question) => {
    /**
     * Handle user query with streaming SSE response.
     *
     * How it works:
     * 1. Rate limit check
     * 2. Add user message to chat
     * 3. Create empty assistant message (will fill token-by-token)
     * 4. Make fetch request to backend
     * 5. Read response stream chunk by chunk
     * 6. Parse SSE events and update assistant message
     * 7. Handle completion and errors
     *
     * Why streaming?
     * - User sees response immediately (like ChatGPT)
     * - Better UX - text appears word-by-word
     * - Same cost, just different delivery
     */

    // Step 1: Rate limit check
    if (userProfile?.role === "free" && userProfile?.queries_limit) {
      if (userProfile.queries_this_month >= userProfile.queries_limit) {
        toast.error(
          "Query limit reached",
          `Free tier allows ${userProfile.queries_limit} queries per month`
        );
        return;
      }
    }

    setIsQuerying(true);
    setCurrentStatus("Starting...");
    setWebSearchSources([]);

    // Step 2: Add user message to chat
    const userMessage = {
      id: Date.now(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Step 3: Create empty assistant message that we'll fill token-by-token
    const assistantMessageId = Date.now() + 1;
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "", // Start empty, we'll append tokens
      sources: [],
      webSources: [],
      streaming: true, // Flag to show typing indicator
      status: "Starting...", // Current processing status
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const token = await getToken();

      abortControllerRef.current = new AbortController();

      const response = await fetch(`${API_URL}/api/chat-sessions/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
          document_ids: uploadedDocs.map((d) => d.id),
          session_id: currentSessionId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Query failed");
      }

      // Step 5: Read the stream using response.body
      // response.body is a ReadableStream - we read it chunk by chunk
      const reader = response.body.getReader();
      const decoder = new TextDecoder(); // Converts bytes to text

      let buffer = ""; // Store incomplete SSE messages

      // Step 6: Read stream in a loop
      while (true) {
        // Read one chunk from the stream
        const { done, value } = await reader.read();

        if (done) {
          // Stream finished
          break;
        }

        // Step 7: Decode chunk from bytes to text
        // value is Uint8Array like: [100, 97, 116, 97, 58, ...]
        // decoder turns it into string: "data: {...}\n\n"
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Step 8: Process complete SSE messages
        // SSE messages end with \n\n, so we split by that
        const lines = buffer.split("\n\n");

        // Last element might be incomplete, keep it in buffer
        buffer = lines.pop() || "";

        // Step 9: Process each complete message
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            // Remove "data: " prefix and parse JSON
            const jsonStr = line.slice(6); // Skip "data: "

            try {
              const event = JSON.parse(jsonStr);
              logger.log("📨 [SSE Event]", event.type, event);

              if (event.type === "session_created") {
                // Server created a new session for us
                logger.log("🆕 [Session] Created:", event.session_id);
                setCurrentSessionId(event.session_id);
              } else if (event.type === "status") {
                // Update current status in the assistant message
                logger.log("📊 [Status]", event.content);
                setCurrentStatus(event.content);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, status: event.content }
                      : msg
                  )
                );
              } else if (event.type === "web_search") {
                // Web search sources found - update message with web sources
                logger.log(
                  "🌐 [Web Search]",
                  event.sources.length,
                  "sources found"
                );
                setWebSearchSources(event.sources);
                setCurrentStatus("Web search complete");
                // Update assistant message to show web sources in KineticProgressIndicator
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, webSources: event.sources }
                      : msg
                  )
                );
              } else if (event.type === "token") {
                // Step 10: Append token to assistant message
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + event.content }
                      : msg
                  )
                );
              } else if (event.type === "done") {
                // Step 11: Streaming complete, add sources and session_id
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          sources: event.sources,
                          webSources: event.web_sources || [],
                          streaming: false, // Remove typing indicator
                        }
                      : msg
                  )
                );

                // Update session ID if provided
                if (event.session_id) {
                  setCurrentSessionId(event.session_id);
                }

                // Clear status
                setCurrentStatus("");
                setWebSearchSources([]);

                // Refresh user profile to update query count
                await fetchUserProfile();

                // Refresh chat history to show updated session
                await fetchChatHistory();
              } else if (event.type === "info") {
                // Info message (e.g., web search restricted)
                toast.info(event.content);
              } else if (event.type === "error") {
                // Step 12: Handle errors
                throw new Error(event.content);
              }
            } catch (parseError) {
              logger.error("Failed to parse SSE event:", parseError);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      logger.error("Query error:", error);
      toast.error("Query failed", error.message);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Sorry, I encountered an error: ${error.message}`,
                error: true,
                streaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsQuerying(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsQuerying(false);
      setCurrentStatus("");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.streaming
            ? {
                ...msg,
                streaming: false,
                content: msg.content || "Generation cancelled.",
              }
            : msg
        )
      );
    }
  };

  const handleRegenerate = (messageId) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex > 0) {
      const userMessage = messages[messageIndex - 1];
      if (userMessage.role === "user") {
        setMessages((prev) => prev.slice(0, messageIndex - 1));
        handleQuery(userMessage.content);
      }
    }
  };

  const handleLogout = () => {
    signOut();
  };

  const handleNewChat = async () => {
    /**
     * Start a new chat session
     *
     * How it works:
     * 1. Clear current messages
     * 2. Reset session ID (server will create new session on next query)
     * 3. No need to save - backend auto-saves messages
     *
     * Why no saveChat()?
     * - Backend now auto-saves messages to chat_sessions/chat_messages tables
     * - Session is created/updated automatically on each query
     */
    // Clear current chat
    setMessages([]);
    setCurrentChatId(Date.now().toString());
    setCurrentSessionId(null); // Reset session - server will create new one
  };

  const handleLoadChat = (chatId) => {
    /**
     * Load a previous chat session
     *
     * How it works:
     * 1. Find chat in history
     * 2. Load its messages (including document messages with documentData)
     * 3. Set as current chat
     * 4. Set session ID so queries continue the conversation
     *
     * Document messages:
     * - Have role="document"
     * - Include documentData with fileName, fileSize, status, document_id
     */
    const chat = chatHistory.find((c) => c.id === chatId);
    if (chat) {
      // Messages from backend already include documentData for document messages
      const formattedMessages = chat.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(),
      }));
      setMessages(formattedMessages);
      setCurrentChatId(chatId);
      setCurrentSessionId(chatId); // Use chat ID as session ID
    }
  };

  // Show skeleton while all data is loading
  if (isDataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="h-[calc(100vh-57px)] flex">
      {/* Left Sidebar - ChatGPT Style */}
      <Sidebar
        user={user}
        userProfile={userProfile}
        uploadedDocs={uploadedDocs}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        onLogout={handleLogout}
        onDeleteDoc={handleDeleteDoc}
        onDeleteChat={handleDeleteChat}
        onNewChat={handleNewChat}
        onLoadChat={handleLoadChat}
        showUsageTooltip={showUsageTooltip}
        setShowUsageTooltip={setShowUsageTooltip}
      />

      <ChatArea
        uploadedDocs={uploadedDocs}
        messages={messages}
        uploading={uploading}
        uploadProgress={uploadProgress}
        userProfile={userProfile}
        isQuerying={isQuerying}
        currentStatus={currentStatus}
        webSearchSources={webSearchSources}
        onUpload={handleUpload}
        onQuery={handleQuery}
        onCancel={handleCancel}
        onRegenerate={handleRegenerate}
        onDeleteDocFromChat={handleDeleteDocFromChat}
      />
    </div>
  );
}

// Sidebar Component - ChatGPT Style
function Sidebar({
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

function ChatArea({
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

// Document Item Component - ChatGPT Style (no borders, clean hover)
function DocumentItem({ document, canDelete, onDelete }) {
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
function ChatHistoryItem({ chat, isActive, onClick, onDelete }) {
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

// Thinking Indicator - Iconic Style
function KineticProgressIndicator({ status, webSources }) {
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
function DocumentMessage({ message, onDelete }) {
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

function ChatMessage({ message, onRegenerate, onDeleteDocument, isLast }) {
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
        <div className="max-w-[75%] bg-[var(--color-accent)] text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start group animate-fade-in -mx-3 px-3 py-2 rounded-xl hover:bg-[var(--color-bg-secondary)]/50 transition-colors duration-200">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/70 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm group-hover:shadow-md transition-shadow duration-200">
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>

      <div className="flex-1 space-y-4">
        {message.streaming && message.status && !message.content && (
          <KineticProgressIndicator
            status={message.status}
            webSources={message.webSources || []}
          />
        )}

        {/* Markdown Content */}
        {message.content && (
          <div className="relative">
            <div
              className="prose prose-sm max-w-none
            prose-headings:font-semibold prose-headings:text-[var(--color-text-primary)] prose-headings:mb-3 prose-headings:mt-4 first:prose-headings:mt-0
            prose-p:text-[var(--color-text-primary)] prose-p:leading-relaxed prose-p:my-3 first:prose-p:mt-0 last:prose-p:mb-0
            prose-strong:text-[var(--color-text-primary)] prose-strong:font-semibold
            prose-ul:my-3 prose-ul:list-disc prose-ul:pl-6
            prose-ol:my-3 prose-ol:list-decimal prose-ol:pl-6
            prose-li:text-[var(--color-text-primary)] prose-li:my-1.5
            prose-code:text-[var(--color-accent)] prose-code:bg-[var(--color-bg-secondary)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
            prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0
            prose-table:border-collapse prose-table:w-full prose-table:my-4
            prose-th:border prose-th:border-[var(--color-border)] prose-th:bg-[var(--color-bg-secondary)] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-[var(--color-text-primary)]
            prose-td:border prose-td:border-[var(--color-border)] prose-td:px-3 prose-td:py-2 prose-td:text-[var(--color-text-primary)]
            prose-a:text-[var(--color-accent)] prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-4 prose-blockquote:border-[var(--color-accent)] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-[var(--color-text-secondary)]
          "
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
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
              {message.streaming && (
                <span className="inline-block w-2 h-5 ml-1 bg-[var(--color-accent)] animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        )}

        {message.sources &&
          message.sources.length > 0 &&
          !message.streaming && <SourceCitations sources={message.sources} />}

        {message.webSources &&
          message.webSources.length > 0 &&
          !message.streaming && <WebSourceCards sources={message.webSources} />}

        {!message.streaming && message.content && (
          <div className="flex items-center gap-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md transition-colors"
              title="Copy response"
            >
              {copied ? (
                <svg
                  className="w-4 h-4 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>

            {isLast && onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md transition-colors"
                title="Regenerate response"
              >
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}

            <button
              onClick={() => setFeedback(feedback === "up" ? null : "up")}
              className={`p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md transition-colors ${
                feedback === "up" ? "bg-green-500/10" : ""
              }`}
              title="Good response"
            >
              <svg
                className={`w-4 h-4 ${
                  feedback === "up"
                    ? "text-green-500"
                    : "text-[var(--color-text-tertiary)]"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                />
              </svg>
            </button>

            <button
              onClick={() => setFeedback(feedback === "down" ? null : "down")}
              className={`p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md transition-colors ${
                feedback === "down" ? "bg-red-500/10" : ""
              }`}
              title="Bad response"
            >
              <svg
                className={`w-4 h-4 ${
                  feedback === "down"
                    ? "text-red-500"
                    : "text-[var(--color-text-tertiary)]"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Code Block Component with Copy Button
function CodeBlock({ language, code }) {
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

function SourceCitations({ sources }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!sources || sources.length === 0) return null;

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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          Sources
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {sources.slice(0, 5).map((source, i) => (
          <button
            key={i}
            onClick={() => setExpandedId(expandedId === i ? null : i)}
            className={`flex-shrink-0 w-36 p-3 rounded-lg border text-left transition-all ${
              expandedId === i
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
                : "border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)]/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded bg-[var(--color-accent)]/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-[var(--color-accent)]">
                  {i + 1}
                </span>
              </div>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Page {source.page_number || "?"}
              </span>
            </div>
            <div className="text-xs text-[var(--color-text-primary)] line-clamp-2 leading-relaxed">
              {source.document_name || "Document"}
            </div>
          </button>
        ))}
      </div>

      {expandedId !== null && sources[expandedId] && (
        <div className="p-3 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--color-accent)]">
              Source {expandedId + 1} • Page{" "}
              {sources[expandedId].page_number || "N/A"}
            </span>
            <button
              onClick={() => setExpandedId(null)}
              className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded"
            >
              <svg
                className="w-3 h-3 text-[var(--color-text-tertiary)]"
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
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
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
function WebSourceCards({ sources }) {
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
