import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ChatProvider } from "./chat/ChatContext";
import { isOnboarded } from "./onboarding/onboardingStatus";
import { Slides } from "./onboarding/Slides";
import { Preferences } from "./onboarding/Preferences";
import { ReferralSource } from "./onboarding/ReferralSource";
import { AppLayout } from "./components/AppLayout";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { VerifyEmail } from "./pages/VerifyEmail";
import { Home } from "./pages/Home";
import { Save } from "./pages/Save";
import { Library } from "./pages/Library";
import { LibraryDetail } from "./pages/LibraryDetail";
import { Chatbot } from "./pages/Chatbot";
import { Settings } from "./pages/Settings";
import { Insights } from "./pages/Insights";

// Gate for authenticated routes that require a verified email (preferences, referral,
// and the main app). Waits for the user profile to load before deciding, so a page
// refresh doesn't briefly bounce a verified user to /verify-email.
function RequireVerified({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, userLoading } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (userLoading) return null;
  if (user && !user.email_verified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}

function RequireOnboarded({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, userLoading } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to={isOnboarded() ? "/login" : "/slides"} replace />;
  }
  if (userLoading) return null;
  if (user && !user.email_verified) return <Navigate to="/verify-email" replace />;
  const onboarded = (user?.onboarding_completed ?? false) || isOnboarded();
  if (!onboarded) return <Navigate to="/preferences" replace />;
  return <>{children}</>;
}

// Keeps a verified, already-onboarded user from getting stuck on /verify-email.
function RequireUnverified({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, userLoading } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (userLoading) return null;
  if (user && user.email_verified) {
    const onboarded = (user.onboarding_completed ?? false) || isOnboarded();
    return <Navigate to={onboarded ? "/" : "/preferences"} replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/welcome" element={<Landing />} />
              <Route path="/slides" element={<Slides />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/verify-email"
                element={
                  <RequireUnverified>
                    <VerifyEmail />
                  </RequireUnverified>
                }
              />
              <Route
                path="/preferences"
                element={
                  <RequireVerified>
                    <Preferences />
                  </RequireVerified>
                }
              />
              <Route
                path="/source"
                element={
                  <RequireVerified>
                    <ReferralSource />
                  </RequireVerified>
                }
              />
              <Route
                element={
                  <RequireOnboarded>
                    <AppLayout />
                  </RequireOnboarded>
                }
              >
                <Route path="/" element={<Home />} />
                <Route path="/save" element={<Save />} />
                <Route path="/library" element={<Library />} />
                <Route path="/library/:id" element={<LibraryDetail />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/chat" element={<Chatbot />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
