import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { AnimatePresence } from 'motion/react';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import WorkspacePage from './pages/WorkspacePage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import { FadeRoute } from './components/FadeRoute';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Clerk] VITE_CLERK_PUBLISHABLE_KEY is missing. Set it in frontend/.env.'
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <RoutedApp />
      </BrowserRouter>
    </ClerkProvider>
  );
}

/**
 * RoutedApp — split out so it can use `useLocation`.  Wrapping the
 * <Routes> in <AnimatePresence mode="wait"> gives every route a clean
 * 200ms fade-in (FadeRoute) and fade-out on navigation.
 */
function RoutedApp() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<FadeRoute><LandingPage /></FadeRoute>} />
        <Route path="/sign-in" element={<FadeRoute><SignInPage /></FadeRoute>} />
        <Route path="/sign-up" element={<FadeRoute><SignUpPage /></FadeRoute>} />
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
  );
}