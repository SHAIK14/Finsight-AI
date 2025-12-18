import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { Logo } from "./Logo";

/**
 * Landing Page Component
 *
 * Premium, aesthetic landing page showcasing FinSight features:
 * - Hero with app preview
 * - Feature highlights with icons
 * - How it works section
 * - Agent system explanation
 * - CTA section
 */

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)]" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-32">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              AI-Powered Financial Analysis
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-6 leading-[1.1]">
            Stop reading 100-page
            <br />
            <span className="text-[var(--color-accent)]">
              financial reports
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-center text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your 10-K, 10-Q, or earnings reports. Get instant answers
            with page citations. Powered by multi-agent AI.
          </p>

          {/* CTA Buttons */}
          <div className="flex justify-center gap-4 mb-16">
            <SignUpButton mode="modal">
              <button className="px-6 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-xl">
                Get Started Free
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="px-6 py-3 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm font-medium transition-all">
                Sign In
              </button>
            </SignInButton>
          </div>

          {/* App Preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-[var(--color-accent)]/20 via-transparent to-[var(--color-accent)]/20 blur-3xl opacity-50" />
            <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-2xl bg-[var(--color-bg-primary)]">
              <img
                src="/screenshots/dashboard.png"
                alt="FinSight Dashboard"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[var(--color-bg-primary)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-4">
              Everything you need to analyze financials
            </h2>
            <p className="text-[var(--color-text-secondary)] max-w-xl mx-auto">
              Powerful features designed for investors, analysts, and
              researchers
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-secondary)] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-[var(--color-accent)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                PDF Upload
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Drop your 10-K, 10-Q, or earnings reports. We extract and index
                every page automatically.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-secondary)] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                Multi-Agent AI
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Research, verification, and risk agents work together to give
                you accurate, verified answers.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-secondary)] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                Live Web Search
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Get real-time stock prices and news from Bloomberg, Reuters, and
                more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Bento Grid Layout */}
      <section className="py-24 bg-[var(--color-bg-secondary)]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-4">
              How it works
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Three simple steps to financial clarity
            </p>
          </div>

          {/* Bento Grid */}
          <div className="space-y-6">
            {/* Step 1 - Full Width (for wide/short attachment image) */}
            <div className="relative p-6 rounded-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] overflow-hidden">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-semibold text-[var(--color-accent)]">
                    1
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Upload your document
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Attach any 10-K, 10-Q, or earnings report PDF
                  </p>
                </div>
              </div>
              {/* Centered image container with max-width */}
              <div className="flex justify-center">
                <div className="max-w-xl w-full rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-secondary)]">
                  <img
                    src="/screenshots/attachment.png"
                    alt="Upload document"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Steps 2 & 3 - Side by Side */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-semibold text-emerald-500">
                      2
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Ask anything
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      AI agents research and verify in real-time
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-secondary)]">
                  <img
                    src="/screenshots/streaming.png"
                    alt="AI analysis"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-semibold text-blue-500">
                      3
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Get cited answers
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Every fact linked to page & source
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-secondary)]">
                  <img
                    src="/screenshots/sources.png"
                    alt="Sources and citations"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent System */}
      <section className="py-24 bg-[var(--color-bg-primary)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-6">
                Multi-Agent Intelligence
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-8 leading-relaxed">
                Unlike simple chatbots, FinSight uses specialized AI agents that
                work together to analyze your documents with precision.
              </p>

              <div className="space-y-4">
                {/* Research Agent */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">
                      Research Agent
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Searches and retrieves relevant information from your
                      documents
                    </p>
                  </div>
                </div>

                {/* Verification Agent */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">
                      Verification Agent
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Cross-checks facts and numbers for accuracy
                    </p>
                  </div>
                </div>

                {/* Risk Agent */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-amber-500"
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
                  </div>
                  <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">
                      Risk Agent
                    </h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Identifies and highlights potential risk factors
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-amber-500/10 blur-3xl" />
              <div className="relative p-8 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                  </div>
                  <svg
                    className="w-6 h-6 text-[var(--color-text-tertiary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <svg
                    className="w-6 h-6 text-[var(--color-text-tertiary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-amber-500"
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
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Research → Verify → Assess Risk
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                    All in under 10 seconds
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-[var(--color-bg-secondary)]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-4">
              Simple pricing
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Tier */}
            <div className="p-8 rounded-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Free
              </h3>
              <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-6">
                $0
                <span className="text-base font-normal text-[var(--color-text-tertiary)]">
                  /month
                </span>
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <svg
                    className="w-5 h-5 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  1 document per month
                </li>
                <li className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <svg
                    className="w-5 h-5 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  5 queries per month
                </li>
                <li className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <svg
                    className="w-5 h-5 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  All AI agents included
                </li>
              </ul>
              <SignUpButton mode="modal">
                <button className="w-full py-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] text-sm font-medium transition-colors">
                  Get Started
                </button>
              </SignUpButton>
            </div>

            {/* Premium Tier */}
            <div className="p-8 rounded-2xl bg-[var(--color-accent)] text-white relative overflow-hidden">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/20 text-xs font-medium">
                Coming Soon
              </div>
              <h3 className="text-xl font-semibold mb-2">Premium</h3>
              <p className="text-3xl font-bold mb-6">
                $19
                <span className="text-base font-normal opacity-70">/month</span>
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-sm opacity-90">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Unlimited documents
                </li>
                <li className="flex items-center gap-3 text-sm opacity-90">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Unlimited queries
                </li>
                <li className="flex items-center gap-3 text-sm opacity-90">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Live web search
                </li>
                <li className="flex items-center gap-3 text-sm opacity-90">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Priority support
                </li>
              </ul>
              <button
                disabled
                className="w-full py-3 rounded-xl bg-white/20 text-sm font-medium cursor-not-allowed"
              >
                Join Waitlist
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-[var(--color-bg-primary)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Logo size="lg" className="justify-center mb-8" />
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] mb-4">
            Ready to save hours on financial analysis?
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Join thousands of investors using AI to make smarter decisions.
          </p>
          <SignUpButton mode="modal">
            <button className="px-8 py-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-xl">
              Start Analyzing Free
            </button>
          </SignUpButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
              <Logo size="sm" iconOnly />
              <span>FinSight</span>
              <span className="mx-2">·</span>
              <span>© 2025</span>
            </div>
            <a
              href="mailto:smd.20sa@gmail.com"
              className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              smd.20sa@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
