import { Link, Outlet } from "react-router-dom";
import { User } from "lucide-react";
import { BottomNav } from "./BottomNav";

export function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="fixed top-0 w-full z-50 bg-bg/80 backdrop-blur-md">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-[1200px] mx-auto">
          <h1 className="font-heading text-accent text-2xl font-bold tracking-tight">Pepper</h1>
          <Link
            to="/settings"
            aria-label="Settings"
            className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
          >
            <User size={18} />
          </Link>
        </div>
      </header>
      <main className="flex-grow pt-24 pb-32">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
