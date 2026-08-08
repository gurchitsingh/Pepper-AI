import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { User } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { DURATION_ENTER, DURATION_EXIT, EASE_IN, EASE_OUT } from "../lib/motion";
import { useAuth } from "../auth/AuthContext";

export function AppLayout() {
  const location = useLocation();
  const { avatarUrl } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="fixed top-0 w-full z-50 bg-bg/80 backdrop-blur-md">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-[1200px] mx-auto">
          <Link to="/settings" className="flex items-center gap-3" aria-label="Settings">
            <span className="w-8 h-8 rounded-full bg-surface border border-text-secondary/15 flex items-center justify-center text-text-secondary shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={16} />
              )}
            </span>
            <h1 className="font-heading text-text-primary text-lg font-semibold tracking-tight">Pepper AI</h1>
          </Link>
        </div>
      </header>
      {/* Opacity-only: Chatbot uses a fixed-positioned inner element, and a
          transform on this ancestor would change its containing block and
          break that positioning. */}
      <main className="relative flex-grow pt-24 pb-32">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
