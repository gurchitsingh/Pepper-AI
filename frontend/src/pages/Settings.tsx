import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ThemePicker } from "../components/ThemePicker";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { UserOut } from "../api/types";

export function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<UserOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    api
      .getMe()
      .then(setMe)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load account"));
  }, []);

  function handleConfirmLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="max-w-lg mx-auto px-6 flex flex-col gap-10">
      <h2 className="font-heading text-text-primary text-2xl font-bold">Settings</h2>

      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-text-primary text-lg font-semibold">Theme</h3>
        <ThemePicker />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-text-primary text-lg font-semibold">Account</h3>
        {error && <p className="text-error text-sm">{error}</p>}
        {!me && !error && <p className="text-text-secondary text-sm">Loading...</p>}
        {me && (
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-text-primary font-medium">{me.name || me.email}</span>
            <span className="text-text-secondary text-sm">{me.email}</span>
            <span className="text-text-secondary text-xs uppercase tracking-wide mt-1">{me.plan} plan</span>
          </div>
        )}
      </section>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setConfirmingLogout(true)}
        className="flex items-center justify-center gap-2 h-12 rounded-full border border-error/40 text-error font-medium"
      >
        <LogOut size={18} />
        Sign out
      </motion.button>

      <AnimatePresence>
        {confirmingLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4"
            onClick={() => setConfirmingLogout(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 w-full max-w-xs flex flex-col gap-4 text-center"
            >
              <p className="text-text-primary font-medium">Sign out of Pepper?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingLogout(false)}
                  className="flex-grow h-11 rounded-full bg-surface text-text-secondary border border-text-secondary/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogout}
                  className="flex-grow h-11 rounded-full bg-error text-white font-medium"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
