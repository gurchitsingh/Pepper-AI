import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Cropper, { type Area } from "react-easy-crop";
import { User, LogOut, Mail, Lock, KeyRound, Download, Check, Camera, Pencil, ChevronRight, Clock } from "lucide-react";
import { Mark } from "../components/Mark";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { THEMES } from "../theme/themes";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import { DURATION_ENTER, DURATION_EXIT, EASE_IN, EASE_OUT } from "../lib/motion";
import { getCroppedImageBlob } from "../lib/cropImage";
import type { BillingStatus } from "../api/types";

const SHADOW_CARD = { boxShadow: "var(--shadow-card)" };
const EYEBROW = "text-accent-ink text-[11px] font-semibold uppercase tracking-widest";
const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-widest text-text-secondary";
const FIELD_INPUT =
  "bg-transparent border border-line rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Settings() {
  const { themeId, setThemeId } = useTheme();
  const { user, avatarUrl, logout, refreshUser, setAvatar } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingSubmitting, setChangingSubmitting] = useState(false);

  const newPasswordStrong = /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && newPassword.length >= 8;
  const newPasswordsMatch = newPassword === confirmNewPassword;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    refreshUser().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load account"));
    api.getBillingStatus().then(setBilling).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  }

  function startEditingProfile() {
    if (!user) return;
    setNameDraft(user.name ?? "");
    setEmailDraft(user.email);
    setProfileError(null);
    setEditingProfile(true);
  }

  function cancelEditingProfile() {
    setEditingProfile(false);
    setProfileError(null);
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
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
    if (trimmedName !== (user.name ?? "")) payload.name = trimmedName;
    if (trimmedEmail !== user.email) payload.email = trimmedEmail;

    if (Object.keys(payload).length === 0) {
      setEditingProfile(false);
      return;
    }

    setSavingProfile(true);
    try {
      await api.updateMe(payload);
      await refreshUser();
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

  function openChangePassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError(null);
    setChangingPassword(true);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (!newPasswordStrong) {
      setPasswordError("New password must be at least 8 characters with an uppercase letter and a number");
      return;
    }
    if (!newPasswordsMatch) {
      setPasswordError("New passwords do not match");
      return;
    }
    setChangingSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setChangingPassword(false);
      showNotice("Password changed successfully.");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setChangingSubmitting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    const reader = new FileReader();
    reader.onload = () => setPendingImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  function closeCropModal() {
    if (savingAvatar) return;
    setPendingImageSrc(null);
    setAvatarError(null);
  }

  async function handleSaveAvatar() {
    if (!pendingImageSrc || !croppedAreaPixels) return;
    setSavingAvatar(true);
    setAvatarError(null);
    try {
      const blob = await getCroppedImageBlob(pendingImageSrc, croppedAreaPixels);
      const updated = await api.uploadAvatar(blob);
      setAvatar(updated, blob);
      setPendingImageSrc(null);
      showNotice("Profile picture updated.");
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Failed to save profile picture");
    } finally {
      setSavingAvatar(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 flex flex-col gap-10">
      <h2 className="font-heading text-text-primary text-2xl font-bold -mt-2">Settings</h2>

      <div className="flex flex-col items-center text-center gap-1">
        <div className="relative mb-2">
          <span className="w-20 h-20 rounded-full bg-surface border border-line flex items-center justify-center text-text-secondary overflow-hidden">
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <User size={32} />}
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change profile picture"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-accent-contrast flex items-center justify-center border-2 border-bg"
          >
            <Camera size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        {user && (
          <>
            <span className="text-text-primary font-heading text-lg font-semibold">{user.name || user.email}</span>
            <span className="text-text-secondary text-sm capitalize">{user.plan} plan</span>
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
                  selected ? "border-accent bg-tint" : "border-line bg-surface"
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
          {user && !editingProfile && (
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
        {!user && !error && <p className="text-text-secondary text-sm">Loading...</p>}

        {user && !editingProfile && (
          <div className="flex flex-col rounded-xl border border-line bg-surface overflow-hidden" style={SHADOW_CARD}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <User size={18} className="text-text-secondary shrink-0" />
              <div className="min-w-0">
                <p className="text-text-secondary text-xs">Name</p>
                <p className="text-text-primary text-sm truncate">{user.name || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Mail size={18} className="text-text-secondary shrink-0" />
              <div className="min-w-0">
                <p className="text-text-secondary text-xs">Email address</p>
                <p className="text-text-primary text-sm truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {user && editingProfile && (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 bg-surface border border-line rounded-xl p-4">
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
                className="flex-grow h-11 rounded-full bg-transparent text-text-secondary border border-line disabled:opacity-50"
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

      {billing && billing.limit_seconds !== null && (
        <section className="flex flex-col gap-3">
          <h3 className={EYEBROW}>Usage</h3>
          <div className="flex flex-col gap-2 rounded-xl border border-text-secondary/15 bg-surface px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-text-secondary shrink-0" />
              <div className="min-w-0 flex-grow">
                <p className="text-text-primary text-sm">
                  {Math.round(billing.total_seconds / 60)} / {Math.round(billing.limit_seconds / 60)} min used
                </p>
                <p className="text-text-secondary text-xs">Free plan monthly content limit</p>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-text-secondary/15 overflow-hidden">
              <div
                className={`h-full rounded-full ${billing.over_limit ? "bg-error" : "bg-accent"}`}
                style={{ width: `${Math.min(100, (billing.total_seconds / billing.limit_seconds) * 100)}%` }}
              />
            </div>
            {billing.over_limit && (
              <p className="text-error text-xs">
                You've reached the free plan limit. Upgrade to keep saving new content.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className={EYEBROW}>Security</h3>
        <div className="flex flex-col rounded-xl border border-line bg-surface overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
            <Lock size={18} className="text-text-secondary shrink-0" />
            <span className="text-text-primary text-sm flex-grow">Two-factor authentication</span>
            <span className="text-text-secondary text-[11px] font-semibold uppercase tracking-wide">Disabled</span>
          </div>
          <button
            onClick={openChangePassword}
            className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-bg/40 transition-colors"
          >
            <KeyRound size={18} className="text-text-secondary shrink-0" />
            <span className="text-text-primary text-sm flex-grow">Change password</span>
            <ChevronRight size={18} className="text-text-secondary shrink-0" />
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={EYEBROW}>Data</h3>
        <button
          onClick={() => showNotice("Chat export isn't available yet.")}
          className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-3.5 text-left hover:bg-bg/40 transition-colors"
        >
          <Download size={18} className="text-text-secondary shrink-0" />
          <span className="text-text-primary text-sm flex-grow">Export your chat</span>
          <span className="text-text-secondary text-xs">Coming soon</span>
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

      <div className="flex flex-col items-center gap-2 -mt-2">
        <Mark size={28} />
        <p className="text-text-secondary/50 text-xs text-center">Pepper AI &middot; Built with intention.</p>
      </div>

      <AnimatePresence>
        {confirmingLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4"
            onClick={() => setConfirmingLogout(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
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

      <AnimatePresence>
        {changingPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4"
            onClick={() => setChangingPassword(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 w-full max-w-xs flex flex-col gap-4"
            >
              <p className="text-text-primary font-medium text-center">Change Password</p>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                {passwordError && <p className="text-error text-sm">{passwordError}</p>}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="current-password" className={FIELD_LABEL}>
                    Current password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    required
                    autoFocus
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="new-password" className={FIELD_LABEL}>
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={FIELD_INPUT}
                  />
                  {newPassword.length > 0 && !newPasswordStrong && (
                    <p className="text-error text-xs">Must include an uppercase letter and a number</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm-new-password" className={FIELD_LABEL}>
                    Repeat new password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className={FIELD_INPUT}
                  />
                  {confirmNewPassword.length > 0 && !newPasswordsMatch && (
                    <p className="text-error text-xs">Passwords do not match</p>
                  )}
                </div>

                <div className="flex gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setChangingPassword(false)}
                    className="flex-grow h-11 rounded-full bg-surface text-text-secondary border border-text-secondary/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingSubmitting}
                    className="flex-grow h-11 rounded-full bg-accent text-accent-contrast font-medium disabled:opacity-50"
                  >
                    {changingSubmitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingImageSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-4"
            onClick={closeCropModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
            >
              <p className="text-text-primary font-medium text-center">Position your photo</p>
              <div className="relative w-full h-72 rounded-xl overflow-hidden bg-black/20">
                <Cropper
                  image={pendingImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                />
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="w-full accent-accent"
              />
              {avatarError && <p className="text-error text-sm text-center">{avatarError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={closeCropModal}
                  disabled={savingAvatar}
                  className="flex-grow h-11 rounded-full bg-surface text-text-secondary border border-text-secondary/20 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAvatar}
                  disabled={savingAvatar || !croppedAreaPixels}
                  className="flex-grow h-11 rounded-full bg-accent text-accent-contrast font-medium disabled:opacity-50"
                >
                  {savingAvatar ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
