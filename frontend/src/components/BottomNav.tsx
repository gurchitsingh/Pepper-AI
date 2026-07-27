import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/save", label: "Save", icon: "bookmark" },
  { to: "/library", label: "Library", icon: "database" },
  { to: "/insights", label: "Insights", icon: "insights" },
  { to: "/chat", label: "Chat", icon: "chat_bubble" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#1e2020] border-t border-white/5">
      <div className="flex justify-around items-center px-2 py-3 max-w-[600px] mx-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 transition-colors ${
                isActive ? "text-primary" : "text-on-surface-variant hover:text-primary"
              }`
            }
          >
            <span className="material-symbols-outlined text-[24px] mb-1">{item.icon}</span>
            <span className="font-body text-[11px]">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
