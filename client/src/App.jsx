import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react'
import { ThemeToggle } from './components/ThemeToggle'
import { Dashboard } from './components/Dashboard'

function App() {
  const { user, isLoaded } = useUser()

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <SignedOut>
        {/* Header - Landing Page */}
        <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
            <h1 className="text-xl font-semibold tracking-tight">FinSight</h1>
            <ThemeToggle />
          </div>
        </header>
      </SignedOut>

      <SignedIn>
        {/* Header - Dashboard */}
        <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-50">
          <div className="px-6 py-3 flex justify-between items-center">
            <h1 className="text-xl font-semibold tracking-tight">FinSight</h1>
            <ThemeToggle />
          </div>
        </header>
      </SignedIn>

      {/* Main Content */}
      <main>
        <SignedOut>
          {/* Hero Section */}
          <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
            <div className="inline-block mb-4 px-3 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-full text-xs font-medium text-[var(--color-text-secondary)]">
              AI-Powered Analysis
            </div>

            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6 leading-tight">
              Financial Document Analysis,
              <br />
              <span className="text-[var(--color-accent)]">Powered by AI</span>
            </h2>

            <p className="text-lg text-[var(--color-text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload 10-K, 10-Q, and earnings reports. Get instant insights with multi-agent RAG analysis powered by OpenAI and pgvector.
            </p>

            <div className="flex justify-center gap-3 mb-20">
              <SignUpButton mode="modal">
                <button className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]">
                  Get Started
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-primary)] px-6 py-2.5 rounded-lg text-sm font-medium transition-all">
                  Sign In
                </button>
              </SignInButton>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 text-left hover:border-[var(--color-border-hover)] transition-all group">
                <div className="w-10 h-10 bg-[var(--color-accent)]/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold mb-2">Multi-Agent RAG</h3>
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                  Specialized AI agents analyze different aspects of your financial documents
                </p>
              </div>

              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 text-left hover:border-[var(--color-border-hover)] transition-all group">
                <div className="w-10 h-10 bg-[var(--color-accent)]/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold mb-2">Vector Search</h3>
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                  Semantic search powered by pgvector and OpenAI embeddings
                </p>
              </div>

              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 text-left hover:border-[var(--color-border-hover)] transition-all group">
                <div className="w-10 h-10 bg-[var(--color-accent)]/10 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold mb-2">Web Research</h3>
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
                  Premium users get Tavily-powered web search for real-time insights
                </p>
              </div>
            </div>
          </section>
        </SignedOut>

        <SignedIn>
          <Dashboard user={user} isLoaded={isLoaded} />
        </SignedIn>
      </main>
    </div>
  )
}

export default App
