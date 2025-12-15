/**
 * Dashboard Skeleton Loader
 *
 * Displayed while user profile data is loading to prevent
 * the flash of "Free" plan before correct role appears.
 *
 * Layout matches Dashboard component for smooth transition.
 */
export function DashboardSkeleton() {
  return (
    <div className="h-[calc(100vh-57px)] flex">
      {/* Left Sidebar Skeleton */}
      <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col">
        {/* New Chat Button */}
        <div className="p-4">
          <div className="w-full h-11 bg-[var(--color-bg-tertiary)] rounded-lg animate-pulse" />
        </div>

        {/* Documents Section */}
        <div className="px-4 pb-4">
          <div className="h-8 w-32 bg-[var(--color-bg-tertiary)] rounded animate-pulse mb-3" />
          <div className="space-y-2">
            <div className="h-12 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            <div className="h-12 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
          </div>
        </div>

        {/* Profile Skeleton - Bottom */}
        <div className="mt-auto border-t border-[var(--color-border)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-bg-tertiary)] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
              <div className="h-3 w-16 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-2xl w-full space-y-4">
            <div className="h-8 w-64 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse mx-auto" />
            <div className="h-6 w-96 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse mx-auto" />
            <div className="grid gap-3 mt-8">
              <div className="h-16 bg-[var(--color-bg-secondary)] rounded-xl animate-pulse" />
              <div className="h-16 bg-[var(--color-bg-secondary)] rounded-xl animate-pulse" />
              <div className="h-16 bg-[var(--color-bg-secondary)] rounded-xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Input Area Skeleton */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-6 py-6">
          <div className="max-w-3xl mx-auto">
            <div className="h-14 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
