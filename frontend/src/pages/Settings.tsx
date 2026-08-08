import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, User, LogOut, Mail, Lock, Key, Download, Check, Pencil } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { THEMES } from "../theme/themes";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { UserOut } from "../api/types";

const EYEBROW = "text-accent text-[11px] font-semibold uppercase tracking-widest";
const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-widest text-text-secondary";
const FIELD_INPUT =
  "bg-transparent border border-text-secondary/25 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Settings() {
  const { themeId, setThemeId } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<UserOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    api
      .getMe()
      .then(setMe)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load account"));
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  }

  function startEditingProfile() {
    if (!me) return;
    setNameDraft(me.name ?? "");
    setEmailDraft(me.email);
    setProfileError(null);
    setEditingProfile(true);
  }

  function cancelEditingProfile() {
    setEditingProfile(false);
    setProfileError(null);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!me) return;
    setProfileError(null);

    const trimmedName = nameDraft.trim();
    const trimmedEmail = emailDraft.trim();

    if (!trimmedName) {
      setProfileError("Name cannot be blank");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setProfileError("Enter a valid email address");
      return;
    }

    const payload: { name?: string; email?: string } = {};
    if (trimmedName !== (me.name ?? "")) payload.name = trimmedName;
    if (trimmedEmail !== me.email) payload.email = trimmedEmail;

    if (Object.keys(payload).length === 0) {
      setEditingProfile(false);
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await api.updateMe(payload);
      setMe(updated);
      setEditingProfile(false);
      showNotice("Profile updated.");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  function handleConfirmLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="max-w-lg mx-auto px-6 flex flex-col gap-10">
      <div className="flex items-center justify-between -mt-2">
        <h2 className="font-heading text-text-primary text-2xl font-bold">Settings</h2>
        <button
          onClick={() => navigate("/")}
          aria-label="Close"
          className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-col items-center text-center gap-1">
        <span className="w-20 h-20 rounded-full bg-surface border border-text-secondary/15 flex items-center justify-center text-text-secondary mb-2">
          <User size={32} />
        </span>
        {me && (
          <>
            <span className="text-text-primary font-heading text-lg font-semibold">{me.name || me.email}</span>
            <span className="text-text-secondary text-sm capitalize">{me.plan} plan</span>
          </>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h3 className={EYEBROW}>Interface</h3>
          <p className="text-text-secondary text-sm mt-1">Choose your preferred visual atmosphere.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const selected = themeId === t.id;
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setThemeId(t.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                  selected ? "border-accent bg-accent/5" : "border-text-secondary/15 bg-surface"
                }`}
              >
                <span
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: t.colors.accent }}
                >
                  {selected && <Check size={18} color={t.colors.accentContrast} strokeWidth={3} />}
                </span>
                <span className={`text-sm ${selected ? "text-accent" : "text-text-secondary"}`}>{t.name}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className={EYEBROW}>Account Management</h3>
          {me && !editingProfile && (
            <button
              onClick={startEditingProfile}
              className="flex items-center gap-1 text-accent text-xs font-semibold uppercase tracking-widest"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        {!me && !error && <p className="text-text-secondary text-sm">Loading...</p>}

        {me && !editingProfile && (
          <div className="flex flex-col rounded-xl border border-text-secondary/15 bg-surface overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-text-secondary/10">
              <User size={18} className="text-text-secondary shrink-0" />
              <div className="min-w-0">
                <p className="text-text-secondary text-xs">Name</p>
                <p className="text-text-primary text-sm truncate">{me.name || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Mail size={18} className="text-text-secondary shrink-0" />
              <div className="min-w-0">
                <p className="text-text-secondary text-xs">Email Address</p>
                <p className="text-text-primary text-sm truncate">{me.email}</p>
              </div>
            </div>
          </div>
        )}

        {me && editingProfile && (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 bg-surface border border-text-secondary/15 rounded-xl p-4">
            {profileError && <p className="text-error text-sm">{profileError}</p>}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="settings-name" className={FIELD_LABEL}>
                Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="settings-email" className={FIELD_LABEL}>
                Email address
              </label>
              <input
                id="settings-email"
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>

            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={cancelEditingProfile}
                disabled={savingProfile}
                className="flex-grow h-11 rounded-full bg-transparent text-text-secondary border border-text-secondary/20 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="flex-grow h-11 rounded-full bg-accent text-accent-contrast font-medium disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={EYEBROW}>Security</h3>
        <div className="flex flex-col rounded-xl border border-text-secondary/15 bg-surface overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-text-secondary/10">
            <Lock size={18} className="text-text-secondary shrink-0" />
            <span className="text-text-primary text-sm flex-grow">Two-Factor Authentication</span>
            <span className="text-text-secondary text-xs font-semibold uppercase tracking-wide">Disabled</span>
          </div>
          <button
            onClick={() => showNotice("Password changes aren't available yet.")}
            className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-bg/40 transition-colors"
          >
            <Key size={18} className="text-text-secondary shrink-0" />
            <span className="text-text-primary text-sm">Change Password</span>
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={EYEBROW}>Data</h3>
        <button
          onClick={() => showNotice("Chat export isn't available yet.")}
          className="flex items-center gap-3 bg-surface border border-text-secondary/15 rounded-xl px-4 py-3.5 text-left hover:bg-bg/40 transition-colors"
        >
          <Download size={18} className="text-text-secondary shrink-0" />
          <span className="text-text-primary text-sm">Export Your Chat</span>
        </button>
      </section>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-text-secondary text-sm text-center -mt-6"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setConfirmingLogout(true)}
        className="flex items-center justify-center gap-2 h-12 rounded-full border border-error/40 text-error font-medium"
      >
        <LogOut size={18} />
        Sign out of Pepper AI
      </motion.button>

      <p className="text-text-secondary/50 text-xs text-center -mt-6">Built with intention.</p>

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
