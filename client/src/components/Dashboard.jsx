import { useState, useRef } from 'react'

export function Dashboard({ user, isLoaded }) {
  const [documents, setDocuments] = useState([]) // TODO: Fetch from API
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Mock user stats - TODO: Fetch from API
  const stats = {
    uploadsUsed: documents.length,
    uploadsLimit: 1,
    queriesUsed: 0,
    queriesLimit: 5,
    role: 'free' // 'free' | 'premium' | 'admin'
  }

  const hasDocuments = documents.length > 0

  return (
    <div className="h-[calc(100vh-57px)] flex">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col">
        {/* Usage Stats - Top */}
        <div className="p-6 space-y-4">
          {/* Uploads */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>Uploads</span>
              <span className="font-mono">{stats.uploadsUsed}/{stats.uploadsLimit}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all"
                style={{ width: `${(stats.uploadsUsed / stats.uploadsLimit) * 100}%` }}
              />
            </div>
          </div>

          {/* Queries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>Queries</span>
              <span className="font-mono">{stats.queriesUsed}/{stats.queriesLimit}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all"
                style={{ width: `${(stats.queriesUsed / stats.queriesLimit) * 100}%` }}
              />
            </div>
          </div>

          {/* Request Premium */}
          {stats.role === 'free' && (
            <button className="w-full mt-2 px-3 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-medium rounded-md transition-colors">
              Request Premium
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Profile - Bottom */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-semibold">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {isLoaded && user?.firstName || 'User'}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {!hasDocuments ? (
          <EmptyState
            stats={stats}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onUpload={(file) => handleUpload(file, setDocuments, setUploading, setUploadProgress)}
          />
        ) : selectedDoc ? (
          <DocumentDetail
            document={selectedDoc}
            onBack={() => setSelectedDoc(null)}
            stats={stats}
          />
        ) : (
          <DocumentLibrary
            documents={documents}
            onSelectDoc={setSelectedDoc}
            onUpload={(file) => handleUpload(file, setDocuments, setUploading, setUploadProgress)}
            uploading={uploading}
            uploadProgress={uploadProgress}
          />
        )}
      </div>
    </div>
  )
}

// Upload handler
async function handleUpload(file, setDocuments, setUploading, setUploadProgress) {
  // Validate file
  if (!file.type.includes('pdf')) {
    alert('Please upload a PDF file')
    return
  }

  if (file.size > 50 * 1024 * 1024) {
    alert('File size must be under 50MB')
    return
  }

  setUploading(true)
  setUploadProgress(0)

  // Simulate upload progress
  const interval = setInterval(() => {
    setUploadProgress(prev => {
      if (prev >= 90) {
        clearInterval(interval)
        return prev
      }
      return prev + 10
    })
  }, 200)

  // TODO: Replace with actual API call
  await new Promise(resolve => setTimeout(resolve, 2000))

  clearInterval(interval)
  setUploadProgress(100)

  // Add mock document
  const newDoc = {
    id: Date.now(),
    company: file.name.replace('.pdf', ''),
    type: '10-K',
    year: '2024',
    uploadedAt: 'Just now',
    status: 'processing',
    fileName: file.name,
    fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
  }

  setDocuments(prev => [newDoc, ...prev])

  // Simulate processing completion
  setTimeout(() => {
    setDocuments(prev => prev.map(doc =>
      doc.id === newDoc.id ? { ...doc, status: 'ready' } : doc
    ))
  }, 3000)

  setUploading(false)
  setUploadProgress(0)
}

function EmptyState({ stats, uploading, uploadProgress, onUpload }) {
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) onUpload(file)
  }

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        {/* Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            isDragging
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 scale-[1.02]'
              : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
          } ${uploading ? 'cursor-wait' : 'cursor-pointer group'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--color-accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold">Uploading...</h3>
              <div className="max-w-xs mx-auto">
                <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">{uploadProgress}%</p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <h3 className="text-xl font-semibold mb-2">
                Upload Your First Document
              </h3>
              <p className="text-[var(--color-text-secondary)] mb-6">
                Drop a 10-K, 10-Q, or earnings report here, or click to browse
              </p>

              <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Select File
              </button>

              <p className="text-xs text-[var(--color-text-tertiary)] mt-4">
                PDF only • Max 50MB • {stats.uploadsLimit - stats.uploadsUsed} upload{stats.uploadsLimit - stats.uploadsUsed === 1 ? '' : 's'} remaining
              </p>
            </>
          )}
        </div>

        {/* Suggested Queries */}
        <div className="mt-12">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
            What you can ask once uploaded:
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              'What was the revenue growth?',
              'Summarize key risks',
              'Compare Q3 vs Q4 performance',
              'Extract all financial metrics'
            ].map((query, i) => (
              <div
                key={i}
                className="px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                {query}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DocumentLibrary({ documents, onSelectDoc, onUpload, uploading, uploadProgress }) {
  const fileInputRef = useRef(null)

  return (
    <div className="h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Your Documents</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {documents.length} document{documents.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])}
            className="hidden"
            disabled={uploading}
          />
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {uploading ? `Uploading ${uploadProgress}%` : 'Upload Document'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} onClick={() => onSelectDoc(doc)} />
        ))}
      </div>
    </div>
  )
}

function DocumentCard({ document, onClick }) {
  const statusColors = {
    ready: 'bg-green-500/10 text-green-600',
    processing: 'bg-amber-500/10 text-amber-600',
    failed: 'bg-red-500/10 text-red-600'
  }

  return (
    <div
      onClick={onClick}
      className="border border-[var(--color-border)] hover:border-[var(--color-border-hover)] rounded-xl p-4 bg-[var(--color-bg-secondary)] transition-all cursor-pointer group hover:shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md font-medium capitalize ${statusColors[document.status] || statusColors.ready}`}>
          {document.status}
        </span>
      </div>

      <h4 className="font-semibold mb-1 group-hover:text-[var(--color-accent)] transition-colors line-clamp-1">
        {document.company}
      </h4>
      <p className="text-sm text-[var(--color-text-secondary)] mb-3">
        {document.type} • {document.year}
      </p>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {document.uploadedAt}
        </div>
        <span className="font-mono">{document.fileSize}</span>
      </div>
    </div>
  )
}

// Document Detail View with Query Interface
function DocumentDetail({ document, onBack, stats }) {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [isQuerying, setIsQuerying] = useState(false)

  const suggestedQueries = [
    'What was the revenue growth?',
    'Summarize key risks',
    'What are the main financial metrics?',
    'Compare this quarter to last quarter'
  ]

  const handleQuery = async (q) => {
    const queryText = q || query
    if (!queryText.trim() || isQuerying) return

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: queryText }])
    setQuery('')
    setIsQuerying(true)

    // Simulate streaming response
    await new Promise(resolve => setTimeout(resolve, 1000))

    const response = `Based on the ${document.type} for ${document.company}, I can help with that. [This is a demo response - actual AI analysis will be connected to the backend API]`

    setMessages(prev => [...prev, { role: 'assistant', content: response }])
    setIsQuerying(false)
  }

  return (
    <div className="h-full flex">
      {/* Left: Document Info */}
      <div className="w-80 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 flex flex-col">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Documents
        </button>

        <div className="flex-1">
          <div className="w-16 h-16 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold mb-2">{document.company}</h2>
          <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-medium">{document.type}</span>
            </div>
            <div className="flex justify-between">
              <span>Year:</span>
              <span className="font-medium">{document.year}</span>
            </div>
            <div className="flex justify-between">
              <span>Size:</span>
              <span className="font-mono text-xs">{document.fileSize}</span>
            </div>
            <div className="flex justify-between">
              <span>Uploaded:</span>
              <span className="font-medium">{document.uploadedAt}</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-2">Status</div>
            <span className="inline-block px-3 py-1 rounded-md bg-green-500/10 text-green-600 text-sm font-medium capitalize">
              {document.status}
            </span>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-tertiary)] mb-3">Queries Remaining</div>
            <div className="text-2xl font-mono font-semibold">
              {stats.queriesLimit - stats.queriesUsed}/{stats.queriesLimit}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Query Interface */}
      <div className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="max-w-2xl w-full">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-2">Ask anything about this document</h3>
                  <p className="text-[var(--color-text-secondary)]">
                    AI will analyze the document and provide verified answers with citations
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Suggested queries:</div>
                  {suggestedQueries.map((sq, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuery(sq)}
                      className="w-full text-left px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-lg text-sm transition-colors"
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto w-full">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                  )}
                  <div className={`px-4 py-3 rounded-lg max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isQuerying && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[var(--color-accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <p className="text-sm text-[var(--color-text-secondary)]">Analyzing...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-[var(--color-border)] p-6 bg-[var(--color-bg-primary)]">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={(e) => { e.preventDefault(); handleQuery(); }} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about this document..."
                disabled={isQuerying}
                className="flex-1 px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!query.trim() || isQuerying}
                className="px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isQuerying ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
