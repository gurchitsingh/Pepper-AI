import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Bookmark, Brain, Library, TrendingUp } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/save", label: "Save", Icon: Bookmark },
  { to: "/chat", label: "Chat", Icon: Brain },
  { to: "/library", label: "Library", Icon: Library },
  { to: "/insights", label: "Insights", Icon: TrendingUp },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-bg/80 backdrop-blur-md border-t border-text-secondary/10">
      <div className="flex justify-around items-center h-16 px-2 max-w-[600px] mx-auto">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className="flex-1 flex justify-center" aria-label={label}>
            {({ isActive }) => (
              <motion.span
                whileTap={{ scale: 0.9 }}
                animate={{ scale: isActive ? 1.1 : 1 }}
                className={`flex items-center justify-center transition-colors ${
                  isActive ? "text-accent" : "text-text-secondary"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.25 : 1.75} fill={isActive ? "currentColor" : "none"} />
              </motion.span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
