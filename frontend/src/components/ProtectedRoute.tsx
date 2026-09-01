import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute — gates a route on Clerk session state.
 *
 * CRITICAL: hooks MUST be called unconditionally at the top of this
 * component — no early return based on isLoaded/isSignedIn BEFORE
 * useAuth() runs.  Otherwise React throws "Rendered more hooks than
 * previous render" on hot-reload / auth state transitions.
 */
export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          Loading session…
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}