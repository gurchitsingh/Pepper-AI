import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, PlusCircle, MessageCircle, LayoutGrid, Sparkles } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/save", label: "Save", Icon: PlusCircle },
  { to: "/chat", label: "Chat", Icon: MessageCircle },
  { to: "/library", label: "Library", Icon: LayoutGrid },
  { to: "/insights", label: "Insights", Icon: Sparkles },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-surface border-t border-text-secondary/10">
      <div className="flex justify-around items-center px-2 py-3 max-w-[600px] mx-auto">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className="flex-1">
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? "text-accent" : "text-text-secondary"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="font-body text-[11px]">{label}</span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
