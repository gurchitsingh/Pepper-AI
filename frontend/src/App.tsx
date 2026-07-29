import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { isOnboarded } from "./onboarding/onboardingStatus";
import { Slides } from "./onboarding/Slides";
import { Preferences } from "./onboarding/Preferences";
import { ReferralSource } from "./onboarding/ReferralSource";
import { AppLayout } from "./components/AppLayout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Home } from "./pages/Home";
import { Save } from "./pages/Save";
import { Library } from "./pages/Library";
import { LibraryDetail } from "./pages/LibraryDetail";
import { Chatbot } from "./pages/Chatbot";
import { Settings } from "./pages/Settings";
import { Stub } from "./pages/Stub";

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
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
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
              <Route path="/insights" element={<Stub title="Insights" />} />
              <Route path="/chat" element={<Chatbot />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
