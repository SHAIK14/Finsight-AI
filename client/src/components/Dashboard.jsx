import { useState, useRef, useEffect } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { useToast } from './Toast'

const API_URL = 'http://localhost:8000'

export function Dashboard({ user, isLoaded }) {
  const { getToken } = useAuth()
  const { signOut } = useClerk()
  const toast = useToast()

  // State management
  const [userProfile, setUserProfile] = useState(null)
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [messages, setMessages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUsageTooltip, setShowUsageTooltip] = useState(false)
  const [isQuerying, setIsQuerying] = useState(false)

  // Fetch user profile on mount
  useEffect(() => {
    if (isLoaded && user) {
      fetchUserProfile()
      fetchDocuments()
    }
  }, [isLoaded, user])

  const fetchUserProfile = async () => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setUserProfile(data)
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
    }
  }

  const fetchDocuments = async () => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/documents/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setUploadedDocs(data.documents || [])
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
  }

  const handleUpload = async (file) => {
    // Check if user can upload (free users have limit)
    if (userProfile?.role === 'free' && userProfile?.uploads_limit) {
      if (userProfile.uploads_this_month >= userProfile.uploads_limit) {
        toast.error('Upload limit reached', `Free tier allows ${userProfile.uploads_limit} upload per month`)
        return
      }
    }

    if (!file.type.includes('pdf')) {
      toast.error('Invalid file type', 'Please upload a PDF file')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', file)

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const data = await response.json()
      setUploadProgress(100)

      // Refresh documents and user profile
      await fetchDocuments()
      await fetchUserProfile()

      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        toast.success('Upload complete!', `${file.name} uploaded successfully`)
      }, 500)

    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Upload failed', error.message)
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteDoc = async (docId) => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Delete failed')
      }

      // Refresh documents list and user profile
      await fetchDocuments()
      await fetchUserProfile()

      toast.success('Document deleted', 'Document removed successfully')
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Delete failed', error.message)
    }
  }

  const handleQuery = async (question) => {
    // Check query limit
    if (userProfile?.role === 'free' && userProfile?.queries_limit) {
      if (userProfile.queries_this_month >= userProfile.queries_limit) {
        toast.error('Query limit reached', `Free tier allows ${userProfile.queries_limit} queries per month`)
        return
      }
    }

    setIsQuerying(true)

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: question,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/queries/ask`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: question,
          document_ids: uploadedDocs.map(d => d.id)
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Query failed')
      }

      const data = await response.json()

      // Add assistant message to chat
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        cached: data.cached,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      // Refresh user profile to update query count
      await fetchUserProfile()

    } catch (error) {
      console.error('Query error:', error)
      toast.error('Query failed', error.message)

      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        error: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsQuerying(false)
    }
  }

  const handleLogout = () => {
    signOut()
  }

  return (
    <div className="h-[calc(100vh-57px)] flex">
      {/* Left Sidebar - ChatGPT Style */}
      <Sidebar
        user={user}
        userProfile={userProfile}
        uploadedDocs={uploadedDocs}
        onLogout={handleLogout}
        onDeleteDoc={handleDeleteDoc}
        showUsageTooltip={showUsageTooltip}
        setShowUsageTooltip={setShowUsageTooltip}
      />

      {/* Main Chat Area */}
      <ChatArea
        uploadedDocs={uploadedDocs}
        messages={messages}
        uploading={uploading}
        uploadProgress={uploadProgress}
        userProfile={userProfile}
        isQuerying={isQuerying}
        onUpload={handleUpload}
        onQuery={handleQuery}
      />
    </div>
  )
}

// Sidebar Component - ChatGPT Style
function Sidebar({ user, userProfile, uploadedDocs, onLogout, onDeleteDoc, showUsageTooltip, setShowUsageTooltip }) {
  return (
    <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col">
      {/* New Chat Button */}
      <div className="p-4">
        <button className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg transition-colors text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Documents Section */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-3">
          <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider px-2 mb-2">
            Documents
          </h3>

          {uploadedDocs.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)] px-2 py-4 text-center">
              No documents uploaded yet
            </p>
          ) : (
            <div className="space-y-1">
              {uploadedDocs.map((doc) => (
                <DocumentItem
                  key={doc.id}
                  document={doc}
                  canDelete={userProfile?.role === 'premium' || userProfile?.role === 'admin'}
                  onDelete={onDeleteDoc}
                />
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Profile Section - Bottom */}
      <div className="border-t border-[var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-semibold flex-shrink-0">
            {user?.firstName?.[0] || 'U'}
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.firstName || 'User'}
            </div>

            {/* Plan Badge with Tooltip */}
            <div className="relative">
              <button
                onMouseEnter={() => setShowUsageTooltip(true)}
                onMouseLeave={() => setShowUsageTooltip(false)}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <span className="capitalize">{userProfile?.role || 'free'} Plan</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Usage Tooltip */}
              {showUsageTooltip && userProfile && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] p-3 z-10">
                  <div className="text-xs font-medium mb-3">Usage This Month</div>

                  {/* Uploads */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-secondary)]">Uploads</span>
                      <span className="font-mono">
                        {userProfile.uploads_this_month}/{userProfile.uploads_limit || '∞'}
                      </span>
                    </div>
                    {userProfile.uploads_limit && (
                      <div className="h-1 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)]"
                          style={{ width: `${(userProfile.uploads_this_month / userProfile.uploads_limit) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Queries */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-secondary)]">Queries</span>
                      <span className="font-mono">
                        {userProfile.queries_this_month}/{userProfile.queries_limit || '∞'}
                      </span>
                    </div>
                    {userProfile.queries_limit && (
                      <div className="h-1 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)]"
                          style={{ width: `${(userProfile.queries_this_month / userProfile.queries_limit) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {userProfile.role === 'free' && (
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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// Chat Area Component
function ChatArea({ uploadedDocs, messages, uploading, uploadProgress, userProfile, isQuerying, onUpload, onQuery }) {
  const fileInputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [showUploadPrompt, setShowUploadPrompt] = useState(false)

  const suggestedQueries = [
    'What was the revenue growth?',
    'Summarize key financial risks',
    'Compare quarterly performance',
    'Extract all metrics and KPIs'
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!query.trim()) return

    if (uploadedDocs.length === 0) {
      setShowUploadPrompt(true)
      return
    }

    // Send query to backend
    onQuery(query)
    setQuery('')
  }

  const handleSuggestedQuery = (suggestedQuery) => {
    if (uploadedDocs.length === 0) {
      setShowUploadPrompt(true)
      return
    }
    onQuery(suggestedQuery)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
      setShowUploadPrompt(false)
    }
  }

  const hasDocuments = uploadedDocs.length > 0
  const hasMessages = messages.length > 0

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {!hasDocuments && !hasMessages ? (
          // Empty State - Show suggested queries
          <div className="h-full flex items-center justify-center px-6">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-12">
                <h2 className="text-2xl font-serif font-semibold mb-3 text-[var(--color-text-primary)]">
                  What would you like to know?
                </h2>
                <p className="text-[var(--color-text-secondary)] text-base leading-relaxed">
                  Upload a financial document to begin analyzing with AI
                </p>
              </div>

              <div className="space-y-3">
                {suggestedQueries.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(suggestion)
                      setShowUploadPrompt(true)
                    }}
                    className="w-full text-left px-5 py-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-xl text-[var(--color-text-primary)] transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm">{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>

              {showUploadPrompt && (
                <div className="mt-6 p-4 bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Upload a document first
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Click the paperclip icon below to upload a financial document (10-K, 10-Q, or earnings report).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Chat Messages
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map((message, i) => (
              <ChatMessage key={i} message={message} />
            ))}
            {isQuerying && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    <span className="text-sm text-[var(--color-text-tertiary)] ml-2">Analyzing documents...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Input Area - Always visible */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-6 py-6">
        <div className="max-w-3xl mx-auto">
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
                      <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="2" fill="none" />
                      <circle
                        cx="12" cy="12" r="10"
                        stroke="var(--color-accent)"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 10}`}
                        strokeDashoffset={`${2 * Math.PI * 10 * (1 - uploadProgress / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />
                    </svg>
                  </div>
                ) : (
                  <svg className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </form>

          {userProfile && (
            <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3">
              {userProfile.uploads_limit
                ? `${userProfile.uploads_limit - userProfile.uploads_this_month} upload${userProfile.uploads_limit - userProfile.uploads_this_month === 1 ? '' : 's'} remaining`
                : 'Unlimited uploads'
              }
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Document Item Component
function DocumentItem({ document, canDelete, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = () => {
    onDelete(document.id)
    setShowDeleteConfirm(false)
  }

  return (
    <div className="group relative px-2 py-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors">
      <div className="flex items-start gap-2">
        {/* PDF Icon */}
        <svg className="w-4 h-4 text-[var(--color-error)] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>

        {/* Document Info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
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
            <svg className="w-3.5 h-3.5 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Delete Confirmation Tooltip */}
      {showDeleteConfirm && (
        <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] p-2 z-20">
          <p className="text-xs text-[var(--color-text-secondary)] mb-2">Delete this document?</p>
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
  )
}

// Chat Message Component
function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-secondary)]'} rounded-2xl px-5 py-3`}>
        <p className={`text-sm leading-relaxed ${isUser ? '' : 'font-serif'}`}>
          {message.content}
        </p>
      </div>
    </div>
  )
}
