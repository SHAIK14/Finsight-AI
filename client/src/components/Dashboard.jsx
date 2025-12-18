import { useState, useRef, useEffect } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useToast } from "./Toast";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { Sidebar } from "./Sidebar";
import { ChatArea } from "./ChatArea";
import { API_URL, logger } from "./dashboardUtils";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
