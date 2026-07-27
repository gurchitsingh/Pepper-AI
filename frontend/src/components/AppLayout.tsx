import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { useAuth } from "../auth/AuthContext";

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-[1200px] mx-auto">
          <h1 className="font-display text-primary text-2xl font-bold tracking-tight">Weave AI</h1>
          <button
            onClick={logout}
            className="font-body text-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="flex-grow pt-24 pb-32">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
