import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Save } from "./pages/Save";
import { Library } from "./pages/Library";
import { Stub } from "./pages/Stub";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Stub title="Home" />} />
            <Route path="/save" element={<Save />} />
            <Route path="/library" element={<Library />} />
            <Route path="/insights" element={<Stub title="Insights" />} />
            <Route path="/chat" element={<Stub title="Chatbot" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
