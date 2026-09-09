import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { AnimatePresence } from 'motion/react';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import { FadeRoute } from './components/FadeRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { Toaster } from './components/ui/Toaster';

// Code-split routes for bundle optimization
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Clerk] VITE_CLERK_PUBLISHABLE_KEY is missing. Set it in frontend/.env.'
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            <BrowserRouter>
              <RoutedApp />
              <Toaster />
            </BrowserRouter>
          </ClerkProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

/**
 * RoutedApp — split out so it can use `useLocation`. Wrapping the
 * <Routes> in <AnimatePresence mode="wait"> gives every route a clean
 * 200ms fade-in (FadeRoute) and fade-out on navigation.
 */
function RoutedApp() {
  const location = useLocation();
  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<FadeRoute><LandingPage /></FadeRoute>} />
          <Route path="/sign-in" element={<FadeRoute><SignInPage /></FadeRoute>} />
          <Route path="/sign-up" element={<FadeRoute><SignUpPage /></FadeRoute>} />
          <Route path="/documentation" element={<FadeRoute><DocumentationPage /></FadeRoute>} />
          <Route path="/privacy" element={<FadeRoute><PrivacyPolicyPage /></FadeRoute>} />
          <Route path="/terms" element={<FadeRoute><TermsOfServicePage /></FadeRoute>} />
          <Route
            path="/workspace"
            element={
              <FadeRoute>
                <ProtectedRoute>
                  <WorkspacePage />
                </ProtectedRoute>
              </FadeRoute>
            }
          />
          <Route path="*" element={<FadeRoute><LandingPage /></FadeRoute>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}