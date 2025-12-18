import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { Dashboard } from "./components/Dashboard";
import { ToastContainer } from "./components/Toast";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { LandingPage } from "./components/LandingPage";
import { Logo } from "./components/Logo";

function App() {
  const { user, isLoaded } = useUser();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <ToastContainer />

      <SignedOut>
        {/* Header - Landing Page */}
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <Logo size="md" />
            <ThemeToggle />
          </div>
        </header>

        {/* Landing Page Content */}
        <main className="pt-16">
          <LandingPage />
        </main>
      </SignedOut>

      <SignedIn>
        {/* Header - Dashboard */}
        <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky top-0 z-50">
          <div className="px-6 py-3 flex justify-between items-center">
            <Logo size="md" />
            <ThemeToggle />
          </div>
        </header>

        {/* Dashboard */}
        <main>
          {!isLoaded ? (
            <DashboardSkeleton />
          ) : (
            <Dashboard user={user} isLoaded={isLoaded} />
          )}
        </main>
      </SignedIn>
    </div>
  );
}

export default App;
