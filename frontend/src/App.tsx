import type { ReactNode } from "react";
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ChatProvider } from "./chat/ChatContext";
import { isOnboarded } from "./onboarding/onboardingStatus";
import { Launch } from "./onboarding/Launch";
import { Slides } from "./onboarding/Slides";
import { Preferences } from "./onboarding/Preferences";
import { ReferralSource } from "./onboarding/ReferralSource";
import { AppLayout } from "./components/AppLayout";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Home } from "./pages/Home";
import { Save } from "./pages/Save";
import { Library } from "./pages/Library";
import { LibraryDetail } from "./pages/LibraryDetail";
import { Chatbot } from "./pages/Chatbot";
import { Settings } from "./pages/Settings";
import { Insights } from "./pages/Insights";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarded({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isOnboarded()) {
    return <Navigate to={isAuthenticated ? "/preferences" : "/slides"} replace />;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const [showLaunch, setShowLaunch] = useState(true);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <BrowserRouter>
            <AnimatePresence>{showLaunch && <Launch onDone={() => setShowLaunch(false)} />}</AnimatePresence>
            <Routes>
              <Route path="/welcome" element={<Landing />} />
              <Route path="/slides" element={<Slides />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/preferences"
                element={
                  <RequireAuth>
                    <Preferences />
                  </RequireAuth>
                }
              />
              <Route
                path="/source"
                element={
                  <RequireAuth>
                    <ReferralSource />
                  </RequireAuth>
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
