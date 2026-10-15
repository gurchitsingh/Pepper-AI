import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, MessageCircle, TrendingUp, Settings, Plus } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home, end: true },
  { to: "/chat", label: "Chat", Icon: MessageCircle, end: false },
];

const NAV_ITEMS_RIGHT = [
  { to: "/insights", label: "Insights", Icon: TrendingUp, end: false },
  { to: "/settings", label: "Settings", Icon: Settings, end: false },
];

function NavItem({ to, label, Icon, end }: { to: string; label: string; Icon: typeof Home; end: boolean }) {
  return (
    <NavLink key={to} to={to} end={end} className="flex-1 min-w-0 flex flex-col items-center gap-1 pt-2" aria-label={label}>
      {({ isActive }) => (
        <motion.span
          whileTap={{ scale: 0.9 }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isActive ? "text-accent-ink" : "text-text-secondary"
          }`}
        >
          <Icon size={24} strokeWidth={isActive ? 2.25 : 1.75} />
          <span className="text-xs font-medium">{label}</span>
        </motion.span>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full h-[88px] z-50 bg-bg shadow-[0_-1px_0_var(--line)]">
      <div className="flex items-start h-full px-2 pt-1.5 max-w-[600px] mx-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        <div className="flex-1 min-w-0 flex justify-center">
          <NavLink to="/save" aria-label="Add">
            <motion.span
              whileTap={{ scale: 0.92 }}
              className="w-14 h-14 rounded-full bg-accent text-accent-contrast flex items-center justify-center"
            >
              <Plus size={26} strokeWidth={1.75} />
            </motion.span>
          </NavLink>
        </div>
        {NAV_ITEMS_RIGHT.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>
    </nav>
  );
}
