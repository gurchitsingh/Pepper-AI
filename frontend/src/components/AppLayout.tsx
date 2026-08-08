import { Link, Outlet } from "react-router-dom";
import { User } from "lucide-react";
import { BottomNav } from "./BottomNav";

export function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="fixed top-0 w-full z-50 bg-bg/80 backdrop-blur-md">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-[1200px] mx-auto">
          <Link to="/settings" className="flex items-center gap-3" aria-label="Settings">
            <span className="w-8 h-8 rounded-full bg-surface border border-text-secondary/15 flex items-center justify-center text-text-secondary shrink-0">
              <User size={16} />
            </span>
            <h1 className="font-heading text-text-primary text-lg font-semibold tracking-tight">Pepper AI</h1>
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
